import express from 'express';
import { Member } from '../models/Member.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import { Bonus } from '../models/Bonus.js';
import { ShootingExpense } from '../models/ShootingExpense.js';
import { MonthlySalary } from '../models/MonthlySalary.js';
import { Shooting } from '../models/Shooting.js';

const router = express.Router();

// GET comprehensive summary report
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    // Total members
    const totalMembers = await Member.countDocuments();
    const dailyMembers = await Member.countDocuments({ type: 'daily' });
    const monthlyMembers = await Member.countDocuments({ type: 'monthly' });

    // Date filters
    const dateFilter = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) dateFilter.date.$gte = from;
      if (to) dateFilter.date.$lte = to;
    }

    const attendanceRecords = await Attendance.find({
      ...dateFilter,
      present: true,
    }).populate('member_id', 'rate');

    const totalAttendanceDays = attendanceRecords.length;
    const dailyAttendanceCost = attendanceRecords.reduce(
      (sum, a) => sum + (a.member_id?.rate || 0),
      0
    );

    // Payments
    const payFilter = {};
    if (from || to) {
      payFilter.paid_at = {};
      if (from) payFilter.paid_at.$gte = new Date(from);
      if (to) payFilter.paid_at.$lte = new Date(to + 'T23:59:59.999Z');
    }
    const payments = await Payment.find(payFilter);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Bonuses
    const bonusFilter = {};
    if (from || to) {
      bonusFilter.given_at = {};
      if (from) bonusFilter.given_at.$gte = new Date(from);
      if (to) bonusFilter.given_at.$lte = new Date(to + 'T23:59:59.999Z');
    }
    const bonuses = await Bonus.find(bonusFilter);
    const totalBonuses = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);

    // Shooting Expenses
    const expFilter = {};
    if (from || to) {
      expFilter.spent_at = {};
      if (from) expFilter.spent_at.$gte = new Date(from);
      if (to) expFilter.spent_at.$lte = new Date(to + 'T23:59:59.999Z');
    }
    const expenses = await ShootingExpense.find(expFilter);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Shootings count
    const shootFilter = {};
    if (from || to) {
      shootFilter.shoot_date = {};
      if (from) shootFilter.shoot_date.$gte = from;
      if (to) shootFilter.shoot_date.$lte = to;
    }
    const totalShootings = await Shooting.countDocuments(shootFilter);

    res.json({
      members: { total: totalMembers, daily: dailyMembers, monthly: monthlyMembers },
      attendance: { count: totalAttendanceDays, cost: dailyAttendanceCost },
      payments: { total: totalPaid },
      bonuses: { total: totalBonuses },
      expenses: { total: totalExpenses },
      shootings: { count: totalShootings },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
