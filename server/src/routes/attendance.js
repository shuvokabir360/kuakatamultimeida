import express from 'express';
import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';

const router = express.Router();

// GET attendance with filters
router.get('/', async (req, res) => {
  try {
    const { date, member_id, shooting_id, from, to } = req.query;
    const query = {};

    if (date) query.date = date;
    if (member_id) query.member_id = member_id;
    if (shooting_id) query.shooting_id = shooting_id;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const records = await Attendance.find(query)
      .populate('member_id', 'name role rate photo_url')
      .populate('shooting_id', 'name channel director location shoot_date');
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST mark/upsert single or bulk attendance
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const items = Array.isArray(body) ? body : [body];

    const results = [];
    for (const item of items) {
      const { member_id, date, present, shooting_id, rate_override } = item;
      if (!member_id || !date) continue;

      let validShootingId = null;
      if (shooting_id && mongoose.Types.ObjectId.isValid(shooting_id)) {
        validShootingId = shooting_id;
      }

      const record = await Attendance.findOneAndUpdate(
        { member_id, date },
        {
          member_id,
          date,
          present: present !== undefined ? Boolean(present) : true,
          shooting_id: validShootingId,
          rate_override: rate_override !== undefined ? rate_override : null,
          owner_id: req.user?.id || 'default_admin',
        },
        { upsert: true, new: true }
      );
      results.push(record);
    }

    res.json(Array.isArray(body) ? results : results[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST bulk mark attendance for a date
router.post('/bulk', async (req, res) => {
  try {
    const { date, attendances, shooting_id } = req.body;
    if (!date || !Array.isArray(attendances)) {
      return res.status(400).json({ error: 'date and attendances array are required' });
    }

    let validShootingId = null;
    if (shooting_id && mongoose.Types.ObjectId.isValid(shooting_id)) {
      validShootingId = shooting_id;
    }

    const operations = attendances.map((item) => ({
      updateOne: {
        filter: { member_id: item.member_id, date },
        update: {
          $set: {
            member_id: item.member_id,
            date,
            present: Boolean(item.present),
            shooting_id: validShootingId,
            rate_override: item.rate_override !== undefined ? item.rate_override : null,
            owner_id: req.user?.id || 'default_admin',
          },
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(operations);
    res.json({ message: 'Attendance updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE attendance
router.delete(['/:id', '/'], async (req, res) => {
  try {
    const { id } = req.params;
    const { member_id, date } = req.query;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      await Attendance.findByIdAndDelete(id);
    } else if (member_id && date) {
      await Attendance.findOneAndDelete({ member_id, date });
    }
    res.json({ message: 'Attendance deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
