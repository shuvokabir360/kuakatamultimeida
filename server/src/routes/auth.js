import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id || user.id, username: user.username, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'km_finance_secret_key_2026_super_secure',
    { expiresIn: '30d' }
  );
};

// Seed/Ensure default admin user exists
export const initAdminUser = async () => {
  try {
    const adminUsername = 'adminkm';
    const adminEmail = 'adminkm@kuakatamedia.com';
    const adminPassword = '01747729757@SK';

    let user = await User.findOne({
      $or: [{ username: adminUsername }, { email: adminEmail }],
    });

    if (!user) {
      user = await User.create({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        name: 'Admin KM',
        role: 'admin',
        phone: '01747729757',
      });
      console.log(`✅ Default Admin user created [ID: ${adminUsername}]`);
    } else {
      // Update password to ensure it matches
      const isMatch = await user.comparePassword(adminPassword);
      if (!isMatch) {
        user.password = adminPassword;
        user.username = adminUsername;
        await user.save();
        console.log(`✅ Default Admin password updated for [ID: ${adminUsername}]`);
      }
    }
  } catch (error) {
    console.error('Error initializing admin user:', error.message);
  }
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, username, id, password } = req.body;
    const loginIdentifier = (username || id || email || '').trim().toLowerCase();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Username/ID and password are required' });
    }

    let user = await User.findOne({
      $or: [
        { username: loginIdentifier },
        { email: loginIdentifier },
        { phone: loginIdentifier },
      ],
    });

    if (!user) {
      // If adminkm doesn't exist yet, seed on the fly
      if (loginIdentifier === 'adminkm' && password === '01747729757@SK') {
        user = await User.create({
          username: 'adminkm',
          email: 'adminkm@kuakatamedia.com',
          password: '01747729757@SK',
          name: 'Admin KM',
          role: 'admin',
          phone: '01747729757',
        });
      } else {
        return res.status(401).json({ error: 'ভুল ইউজার আইডি অথবা পাসওয়ার্ড' });
      }
    } else {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'ভুল ইউজার আইডি অথবা পাসওয়ার্ড' });
      }
    }

    const token = generateToken(user);
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, name, role, phone } = req.body;
    if (!password || (!email && !username)) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase() }] : []),
        ...(username ? [{ username: username.toLowerCase() }] : []),
      ],
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await User.create({
      username: username ? username.toLowerCase() : '',
      email: email ? email.toLowerCase() : '',
      password,
      name: name || '',
      role: role || 'admin',
      phone: phone || '',
    });

    const token = generateToken(user);
    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Current User
router.get('/me', async (req, res) => {
  try {
    if (req.user) {
      res.json({ user: req.user });
    } else {
      res.json({ user: { id: 'adminkm', username: 'adminkm', role: 'admin' } });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check Role
router.get('/has-role', async (req, res) => {
  try {
    const role = req.query.role || 'admin';
    const hasRole = req.user?.role === role || req.user?.role === 'admin';
    res.json({ has_role: hasRole });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST verify-password for critical actions (e.g. deleting channels/directors)
router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    const trimmedPassword = (password || '').trim();
    if (!trimmedPassword) {
      return res.status(400).json({ error: 'অ্যাডমিন পাসওয়ার্ড আবশ্যক' });
    }

    // Direct check for master / default admin password
    if (trimmedPassword === '01747729757@SK') {
      return res.json({ verified: true });
    }

    let user = null;
    if (req.user?.id && /^[0-9a-fA-F]{24}$/.test(String(req.user.id))) {
      user = await User.findById(req.user.id);
    }
    if (!user && req.user?.username) {
      user = await User.findOne({ username: req.user.username.toLowerCase() });
    }
    if (!user) {
      user = await User.findOne({
        $or: [{ username: 'adminkm' }, { role: 'admin' }],
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'ভুল অ্যাডমিন পাসওয়ার্ড! অনুমতি দেওয়া হয়নি।' });
    }

    const isMatch = await user.comparePassword(trimmedPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'ভুল অ্যাডমিন পাসওয়ার্ড! অনুমতি দেওয়া হয়নি।' });
    }

    res.json({ verified: true });
  } catch (error) {
    console.error('Password verification error:', error);
    if (req.body?.password?.trim() === '01747729757@SK') {
      return res.json({ verified: true });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
