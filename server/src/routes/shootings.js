import express from 'express';
import { Shooting } from '../models/Shooting.js';
import { ShootingExpense } from '../models/ShootingExpense.js';
import { Attendance } from '../models/Attendance.js';
import { Member } from '../models/Member.js';

const router = express.Router();

// Helper to calculate shooting summary
export const calculateShootingSummary = async (shootingId) => {
  const shooting = await Shooting.findById(shootingId);
  if (!shooting) return { present_count: 0, attendance_cost: 0, extra_cost: 0, total_cost: 0 };

  // Find attendance for this shooting_id or shoot date
  const attendances = await Attendance.find({
    $or: [{ shooting_id: shooting._id }, { date: shooting.shoot_date }],
    present: true,
  }).populate('member_id', 'rate');

  let att_cost = 0;
  let att_count = attendances.length;

  attendances.forEach((att) => {
    if (att.rate_override != null && !isNaN(Number(att.rate_override))) {
      att_cost += Number(att.rate_override);
    } else if (att.member_id && att.member_id.rate) {
      att_cost += Number(att.member_id.rate);
    }
  });

  const expenses = await ShootingExpense.find({ shooting_id: shooting._id });
  const ext_cost = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return {
    present_count: att_count,
    attendance_cost: att_cost,
    extra_cost: ext_cost,
    total_cost: att_cost + ext_cost,
  };
};

// GET all shootings
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const query = {};
    if (from || to) {
      query.shoot_date = {};
      if (from) query.shoot_date.$gte = from;
      if (to) query.shoot_date.$lte = to;
    }

    const shootings = await Shooting.find(query).sort({ shoot_date: -1 });
    res.json(shootings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET shooting summary (replaces supabase RPC shooting_summary)
router.get('/:id/summary', async (req, res) => {
  try {
    const summary = await calculateShootingSummary(req.params.id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST shooting
router.post('/', async (req, res) => {
  try {
    const { name, shoot_date, director, channel, contract_amount, location, note } = req.body;
    if (!name || !shoot_date) {
      return res.status(400).json({ error: 'নাম এবং শুটিং এর তারিখ আবশ্যক' });
    }

    const trimmedDate = shoot_date.trim();
    // Check if a shooting already exists on this date
    const existing = await Shooting.findOne({ shoot_date: trimmedDate });
    if (existing) {
      return res.status(400).json({
        error: `এই তারিখে (${trimmedDate}) ইতিমধ্যে "${existing.name}" শুটিং তৈরি করা আছে। অনুগ্রহ করে অন্য তারিখ বাছুন।`,
      });
    }

    const shooting = await Shooting.create({
      name: name.trim(),
      shoot_date: trimmedDate,
      director: director ? director.trim() : '',
      channel: channel ? channel.trim() : '',
      contract_amount: Number(contract_amount) || 0,
      location: location ? location.trim() : '',
      note: note ? note.trim() : '',
      owner_id: req.user?.id || 'default_admin',
    });

    res.status(201).json(shooting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT shooting
router.put('/:id', async (req, res) => {
  try {
    const { shoot_date } = req.body;
    if (shoot_date) {
      const trimmedDate = shoot_date.trim();
      const existing = await Shooting.findOne({
        shoot_date: trimmedDate,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(400).json({
          error: `এই তারিখে (${trimmedDate}) ইতিমধ্যে "${existing.name}" শুটিং তৈরি করা আছে। অনুগ্রহ করে অন্য তারিখ বাছুন।`,
        });
      }
    }

    const updated = await Shooting.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Shooting not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE shooting
router.delete('/:id', async (req, res) => {
  try {
    await Shooting.findByIdAndDelete(req.params.id);
    await ShootingExpense.deleteMany({ shooting_id: req.params.id });
    res.json({ message: 'Shooting deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EXPENSES ---

router.get('/:id/expenses', async (req, res) => {
  try {
    const expenses = await ShootingExpense.find({ shooting_id: req.params.id }).sort({ spent_at: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/expenses', async (req, res) => {
  try {
    const { amount, note, spent_at } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    const expense = await ShootingExpense.create({
      shooting_id: req.params.id,
      amount: Number(amount),
      note: note || '',
      spent_at: spent_at ? new Date(spent_at) : new Date(),
      owner_id: req.user?.id || 'default_admin',
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/expenses/:expenseId', async (req, res) => {
  try {
    await ShootingExpense.findByIdAndDelete(req.params.expenseId);
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
