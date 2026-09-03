import express from 'express';
import { Payment } from '../models/Payment.js';
import { MonthlySalary } from '../models/MonthlySalary.js';
import { Bonus } from '../models/Bonus.js';

const router = express.Router();

// --- PAYMENTS ---

// GET payments (filter by member_id or date range)
router.get('/', async (req, res) => {
  try {
    const { member_id, from, to } = req.query;
    const query = {};
    if (member_id) query.member_id = member_id;
    if (from || to) {
      query.paid_at = {};
      if (from) query.paid_at.$gte = new Date(from);
      if (to) query.paid_at.$lte = new Date(to);
    }

    const payments = await Payment.find(query).sort({ paid_at: -1 }).populate('member_id', 'name role');
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST payment
router.post('/', async (req, res) => {
  try {
    const { member_id, amount, note, paid_at } = req.body;
    if (!member_id || !amount) {
      return res.status(400).json({ error: 'member_id and amount are required' });
    }

    const payment = await Payment.create({
      member_id,
      amount: Number(amount),
      note: note || '',
      paid_at: paid_at ? new Date(paid_at) : new Date(),
      owner_id: req.user?.id || 'default_admin',
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE payment
router.delete('/:id', async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BONUSES ---

router.get('/bonuses', async (req, res) => {
  try {
    const { member_id, from, to } = req.query;
    const query = {};
    if (member_id) query.member_id = member_id;
    if (from || to) {
      query.given_at = {};
      if (from) query.given_at.$gte = new Date(from);
      if (to) query.given_at.$lte = new Date(to);
    }

    const bonuses = await Bonus.find(query).sort({ given_at: -1 }).populate('member_id', 'name role');
    res.json(bonuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bonuses', async (req, res) => {
  try {
    const { member_id, amount, reason, given_at } = req.body;
    if (!member_id || !amount) {
      return res.status(400).json({ error: 'member_id and amount are required' });
    }

    const bonus = await Bonus.create({
      member_id,
      amount: Number(amount),
      reason: reason || '',
      given_at: given_at ? new Date(given_at) : new Date(),
      owner_id: req.user?.id || 'default_admin',
    });

    res.status(201).json(bonus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/bonuses/:id', async (req, res) => {
  try {
    await Bonus.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bonus deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- MONTHLY SALARIES ---

router.get('/salaries', async (req, res) => {
  try {
    const { member_id, month, from, to } = req.query;
    const query = {};
    if (member_id) query.member_id = member_id;
    if (month) query.month = month;
    if (from || to) {
      query.month = {};
      if (from) query.month.$gte = from;
      if (to) query.month.$lte = to;
    }

    const salaries = await MonthlySalary.find(query).sort({ month: -1 }).populate('member_id', 'name rate');
    res.json(salaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/salaries', async (req, res) => {
  try {
    const { member_id, month, amount } = req.body;
    if (!member_id || !month || amount === undefined) {
      return res.status(400).json({ error: 'member_id, month, and amount are required' });
    }

    const salary = await MonthlySalary.findOneAndUpdate(
      { member_id, month },
      { amount: Number(amount), owner_id: req.user?.id || 'default_admin' },
      { upsert: true, new: true }
    );

    res.json(salary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
