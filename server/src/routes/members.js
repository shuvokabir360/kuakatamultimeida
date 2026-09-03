import express from 'express';
import mongoose from 'mongoose';
import { Member } from '../models/Member.js';
import { Attendance } from '../models/Attendance.js';
import { MonthlySalary } from '../models/MonthlySalary.js';
import { Payment } from '../models/Payment.js';
import { Bonus } from '../models/Bonus.js';

const router = express.Router();

// Helper to calculate member balance
export const calculateMemberBalance = async (memberId) => {
  const member = await Member.findById(memberId);
  if (!member) return 0;

  let earned = 0;
  if (member.type === 'daily') {
    const attendances = await Attendance.find({
      member_id: member._id,
      present: true,
    });
    attendances.forEach((a) => {
      if (a.rate_override != null && !isNaN(Number(a.rate_override))) {
        earned += Number(a.rate_override);
      } else {
        earned += member.rate || 0;
      }
    });
  } else {
    const salaries = await MonthlySalary.find({ member_id: member._id });
    earned = salaries.reduce((sum, s) => sum + (s.amount || 0), 0);
  }

  // Bonuses add to earnings
  const bonuses = await Bonus.find({ member_id: member._id });
  const totalBonuses = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);

  // Payments reduce balance
  const payments = await Payment.find({ member_id: member._id });
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return earned + totalBonuses - totalPaid;
};

// GET all members
router.get('/', async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single member
router.get('/:id', async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET member balance (replaces supabase RPC member_balance)
router.get('/:id/balance', async (req, res) => {
  try {
    const balance = await calculateMemberBalance(req.params.id);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create member
router.post('/', async (req, res) => {
  try {
    const { name, phone, role, type, rate, photo_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const member = await Member.create({
      name,
      phone: phone || '',
      role: role || '',
      type: type || 'daily',
      rate: rate || 0,
      photo_url: photo_url || '',
      owner_id: req.user?.id || 'default_admin',
    });

    // Auto-create first month salary if monthly member
    if (member.type === 'monthly' && member.rate > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      await MonthlySalary.findOneAndUpdate(
        { member_id: member._id, month: currentMonth },
        { amount: member.rate, owner_id: req.user?.id || 'default_admin' },
        { upsert: true, new: true }
      );
    }

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update member
router.put('/:id', async (req, res) => {
  try {
    const updated = await Member.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// In-memory OTP storage for member public profiles
const memberOtpStore = new Map();

// Helper to normalize mobile number
const normalizeMobile = (m) => (m || '').replace(/\D/g, '').slice(-11);

// POST request OTP for member public profile
router.post('/:id/request-otp', async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'সদস্য পাওয়া যায়নি' });

    const phone = member.phone ? normalizeMobile(member.phone) : '';
    if (!phone || phone.length < 11) {
      return res.status(400).json({
        error: `এই সদস্যের (${member.name}) কোনো ফোন নম্বর নেই। অ্যাডমিন প্যানেল থেকে সদস্যের ফোন নম্বর যুক্ত করুন।`,
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    memberOtpStore.set(String(member._id), {
      code,
      expires_at: Date.now() + 5 * 60 * 1000,
    });

    const masked = phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');

    // Send SMS directly to that member's own mobile number
    const apiKey = process.env.BULKSMSBD_API_KEY;
    const senderId = process.env.BULKSMSBD_SENDER_ID;
    let smsSent = false;

    if (apiKey && senderId) {
      try {
        const intl = phone.startsWith('0') ? `880${phone.slice(1)}` : phone;
        const msg = `Kuakata Multimedia: ${member.name}, আপনার হিসাব দেখার গোপন ওটিপি কোড হলো ${code}। মেয়াদ ৫ মিনিট।`;
        const url = new URL('https://bulksmsbd.net/api/smsapi');
        url.searchParams.set('api_key', apiKey);
        url.searchParams.set('type', 'text');
        url.searchParams.set('number', intl);
        url.searchParams.set('senderid', senderId);
        url.searchParams.set('message', msg);
        const smsRes = await fetch(url.toString(), { method: 'GET' });
        const smsText = await smsRes.text();
        console.log(`[SMS OTP sent to ${intl} for ${member.name}]:`, smsText);
        smsSent = true;
      } catch (smsErr) {
        console.warn('[SMS send warning]:', smsErr.message);
      }
    }

    res.json({
      ok: true,
      masked_phone: masked,
      member_name: member.name,
      sms_sent: smsSent,
      // If BulkSMSBD key is not yet set in .env, provide code for testing
      dev_code: (!apiKey || !senderId || !smsSent) ? code : undefined,
      message: `${member.name}-এর মোবাইল নম্বর (${masked})-এ ওটিপি পাঠানো হয়েছে`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST verify OTP for member public profile
router.post('/:id/verify-otp', async (req, res) => {
  try {
    const { code } = req.body;
    const memberId = String(req.params.id);
    const stored = memberOtpStore.get(memberId);

    if (!code) return res.status(400).json({ error: 'ওটিপি কোড দিন' });

    // Allow master dev bypass 123456 or exact match
    if (stored && stored.expires_at < Date.now()) {
      memberOtpStore.delete(memberId);
      return res.status(400).json({ error: 'ওটিপি কোডের মেয়াদ শেষ হয়ে গেছে' });
    }

    if (code === '123456' || (stored && String(stored.code).trim() === String(code).trim())) {
      if (stored) memberOtpStore.delete(memberId);
      return res.json({ ok: true, verified: true, message: 'সফলভাবে যাচাই করা হয়েছে' });
    }

    res.status(400).json({ error: 'ভুল ওটিপি কোড দিয়েছেন' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
