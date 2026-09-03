import express from 'express';
import { Channel } from '../models/Channel.js';
import { Director } from '../models/Director.js';
import { ClientPayment } from '../models/ClientPayment.js';
import { Shooting } from '../models/Shooting.js';

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to cleanup duplicate channels and directors in DB
export async function cleanupDuplicates() {
  try {
    // 1. Channel deduplication
    const allChannels = await Channel.find();
    const channelMap = new Map();
    for (const ch of allChannels) {
      const key = ch.name?.trim().toLowerCase();
      if (!key) {
        await Channel.findByIdAndDelete(ch._id);
        continue;
      }
      if (!channelMap.has(key)) {
        channelMap.set(key, ch);
      } else {
        const existing = channelMap.get(key);
        let changed = false;
        if (!existing.logo_url && ch.logo_url) {
          existing.logo_url = ch.logo_url;
          changed = true;
        }
        if (!existing.color && ch.color) {
          existing.color = ch.color;
          changed = true;
        }
        if (ch.is_own !== undefined && existing.is_own !== ch.is_own) {
          existing.is_own = ch.is_own;
          changed = true;
        }
        if (changed) await existing.save();
        await Channel.findByIdAndDelete(ch._id);
      }
    }

    // 2. Director deduplication
    const allDirectors = await Director.find();
    const directorMap = new Map();
    for (const d of allDirectors) {
      const key = d.name?.trim().toLowerCase();
      if (!key) {
        await Director.findByIdAndDelete(d._id);
        continue;
      }
      if (!directorMap.has(key)) {
        directorMap.set(key, d);
      } else {
        const existing = directorMap.get(key);
        let changed = false;
        if (!existing.photo_url && d.photo_url) {
          existing.photo_url = d.photo_url;
          changed = true;
        }
        if (!existing.phone && d.phone) {
          existing.phone = d.phone;
          changed = true;
        }
        if (changed) await existing.save();
        await Director.findByIdAndDelete(d._id);
      }
    }
  } catch (err) {
    console.error('Error during channel/director deduplication:', err.message);
  }
}

// Run cleanup immediately on route load
cleanupDuplicates();

// --- CHANNELS ---

router.get('/channels', async (req, res) => {
  try {
    await cleanupDuplicates();
    const channels = await Channel.find().sort({ name: 1 });
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/channels', async (req, res) => {
  try {
    const { name, is_own, logo_url, color, old_name } = req.body;
    const lookupName = (old_name || name)?.trim();
    if (!lookupName && !name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const targetName = (name || old_name).trim();

    let channel = null;
    if (lookupName) {
      channel = await Channel.findOne({
        name: new RegExp(`^${escapeRegex(lookupName)}$`, 'i'),
      });
    }

    const previousName = channel?.name;

    if (channel) {
      if (is_own !== undefined) channel.is_own = Boolean(is_own);
      if (logo_url !== undefined) channel.logo_url = logo_url;
      if (color !== undefined) channel.color = color;
      channel.name = targetName;
      await channel.save();

      // If channel was renamed, sync with shootings and client payments
      if (previousName && previousName.toLowerCase() !== targetName.toLowerCase()) {
        const Shooting = mongoose.model('Shooting');
        const ClientPayment = mongoose.model('ClientPayment');
        await Shooting.updateMany(
          { channel: new RegExp(`^${escapeRegex(previousName)}$`, 'i') },
          { $set: { channel: targetName } }
        );
        await ClientPayment.updateMany(
          { channel: new RegExp(`^${escapeRegex(previousName)}$`, 'i') },
          { $set: { channel: targetName } }
        );
      }

      return res.json(channel);
    }

    channel = await Channel.create({
      name: targetName,
      is_own: Boolean(is_own),
      logo_url: logo_url || '',
      color: color || '',
      owner_id: req.user?.id || 'default_admin',
    });
    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put(['/channels', '/channels/:id'], async (req, res) => {
  try {
    const idOrName = req.params.id || req.body.id || req.body.old_name || req.body.name;
    const body = { ...req.body };
    delete body._id;
    delete body.id;

    let channel = null;
    if (idOrName && idOrName.match(/^[0-9a-fA-F]{24}$/)) {
      channel = await Channel.findById(idOrName);
    }
    if (!channel && idOrName) {
      channel = await Channel.findOne({
        name: new RegExp(`^${escapeRegex(String(idOrName).trim())}$`, 'i'),
      });
    }
    if (!channel && req.body.name) {
      channel = await Channel.findOne({
        name: new RegExp(`^${escapeRegex(String(req.body.name).trim())}$`, 'i'),
      });
    }

    if (!channel) {
      if (!req.body.name && !idOrName) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      channel = await Channel.create({
        name: String(req.body.name || idOrName).trim(),
        is_own: Boolean(req.body.is_own),
        logo_url: req.body.logo_url || '',
        color: req.body.color || '',
        owner_id: req.user?.id || 'default_admin',
      });
      return res.json(channel);
    }

    const previousName = channel.name;
    if (body.name !== undefined && body.name.trim()) channel.name = String(body.name).trim();
    if (body.is_own !== undefined) channel.is_own = Boolean(body.is_own);
    if (body.logo_url !== undefined) channel.logo_url = body.logo_url;
    if (body.color !== undefined) channel.color = body.color;

    await channel.save();

    if (body.name && previousName && previousName.toLowerCase() !== channel.name.toLowerCase()) {
      const Shooting = mongoose.model('Shooting');
      const ClientPayment = mongoose.model('ClientPayment');
      await Shooting.updateMany(
        { channel: new RegExp(`^${escapeRegex(previousName)}$`, 'i') },
        { $set: { channel: channel.name } }
      );
      await ClientPayment.updateMany(
        { channel: new RegExp(`^${escapeRegex(previousName)}$`, 'i') },
        { $set: { channel: channel.name } }
      );
    }

    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete(['/channels/:id', '/channels'], async (req, res) => {
  try {
    const idOrName = req.params.id || req.query.id || req.query.name || req.body?.id || req.body?.name;
    if (idOrName && idOrName.match(/^[0-9a-fA-F]{24}$/)) {
      await Channel.findByIdAndDelete(idOrName);
    } else if (idOrName) {
      await Channel.findOneAndDelete({
        name: new RegExp(`^${escapeRegex(String(idOrName).trim())}$`, 'i'),
      });
    }
    res.json({ message: 'Channel deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- DIRECTORS ---

router.get('/directors', async (req, res) => {
  try {
    await cleanupDuplicates();
    const directors = await Director.find().sort({ name: 1 });
    res.json(directors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/directors', async (req, res) => {
  try {
    const { name, phone, photo_url } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const trimmed = name.trim();

    let director = await Director.findOne({
      name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i'),
    });

    if (director) {
      if (phone !== undefined) director.phone = phone;
      if (photo_url !== undefined) director.photo_url = photo_url;
      director.name = trimmed;
      await director.save();
      return res.json(director);
    }

    director = await Director.create({
      name: trimmed,
      phone: phone || '',
      photo_url: photo_url || '',
      owner_id: req.user?.id || 'default_admin',
    });
    res.status(201).json(director);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put(['/directors', '/directors/:id'], async (req, res) => {
  try {
    const idOrName = req.params.id || req.body.id || req.body.name;
    const body = { ...req.body };
    delete body._id;
    delete body.id;

    let director = null;
    if (idOrName && idOrName.match(/^[0-9a-fA-F]{24}$/)) {
      director = await Director.findById(idOrName);
    }
    if (!director && idOrName) {
      director = await Director.findOne({
        name: new RegExp(`^${escapeRegex(String(idOrName).trim())}$`, 'i'),
      });
    }
    if (!director && req.body.name) {
      director = await Director.findOne({
        name: new RegExp(`^${escapeRegex(String(req.body.name).trim())}$`, 'i'),
      });
    }

    if (!director) {
      if (!req.body.name && !idOrName) {
        return res.status(404).json({ error: 'Director not found' });
      }
      director = await Director.create({
        name: String(req.body.name || idOrName).trim(),
        phone: req.body.phone || '',
        photo_url: req.body.photo_url || '',
        owner_id: req.user?.id || 'default_admin',
      });
      return res.json(director);
    }

    if (body.name !== undefined) director.name = String(body.name).trim();
    if (body.phone !== undefined) director.phone = body.phone;
    if (body.photo_url !== undefined) director.photo_url = body.photo_url;

    await director.save();
    res.json(director);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete(['/directors/:id', '/directors'], async (req, res) => {
  try {
    const idOrName = req.params.id || req.body.id || req.body.name;
    if (idOrName && idOrName.match(/^[0-9a-fA-F]{24}$/)) {
      await Director.findByIdAndDelete(idOrName);
    } else if (idOrName) {
      await Director.findOneAndDelete({
        name: new RegExp(`^${escapeRegex(String(idOrName).trim())}$`, 'i'),
      });
    }
    res.json({ message: 'Director deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CLIENT PAYMENTS ---

router.get('/payments', async (req, res) => {
  try {
    const { channel, shooting_id } = req.query;
    const query = {};
    if (channel) {
      query.channel = new RegExp(`^${escapeRegex(channel.trim())}$`, 'i');
    }
    if (shooting_id) query.shooting_id = shooting_id;

    const payments = await ClientPayment.find(query).sort({ received_at: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payments', async (req, res) => {
  try {
    const { shooting_id, channel, amount, received_at, method, note } = req.body;
    if (!channel || !amount) {
      return res.status(400).json({ error: 'Channel and amount are required' });
    }

    const payment = await ClientPayment.create({
      shooting_id: shooting_id || null,
      channel: channel.trim(),
      amount: Number(amount) || 0,
      received_at: received_at || new Date().toISOString().split('T')[0],
      method: method || '',
      note: note || '',
      owner_id: req.user?.id || 'default_admin',
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    await ClientPayment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CHANNEL SUMMARY (replaces client_channel_summary RPC) ---

router.get('/channel-summary', async (req, res) => {
  try {
    await cleanupDuplicates();

    // 1. Get all channels
    const allChannels = await Channel.find();
    const ownChannelNames = new Set(
      allChannels
        .filter((c) => c.is_own === true)
        .map((c) => c.name.trim().toLowerCase())
    );

    // 2. Collect unique external channel names from both Channel and Shooting collections
    const uniqueChannelsMap = new Map();

    for (const ch of allChannels) {
      if (!ch.name) continue;
      const key = ch.name.trim().toLowerCase();
      if (!ownChannelNames.has(key)) {
        uniqueChannelsMap.set(key, ch.name.trim());
      }
    }

    const shootingsWithChannel = await Shooting.find({
      channel: { $exists: true, $ne: '' },
    });
    for (const s of shootingsWithChannel) {
      if (!s.channel) continue;
      const key = s.channel.trim().toLowerCase();
      if (!ownChannelNames.has(key) && !uniqueChannelsMap.has(key)) {
        uniqueChannelsMap.set(key, s.channel.trim());
      }
    }

    const channelNames = Array.from(uniqueChannelsMap.values());

    // 3. Build summary for each unique external channel
    const summaries = await Promise.all(
      channelNames.map(async (channelName) => {
        const regex = new RegExp(`^${escapeRegex(channelName)}$`, 'i');

        const shootings = await Shooting.find({ channel: regex });
        const shooting_count = shootings.length || 0;
        const contract_total = shootings.reduce(
          (sum, s) => sum + (Number(s.contract_amount) || 0),
          0
        );

        const payments = await ClientPayment.find({ channel: regex });
        const received_total = payments.reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0
        );

        const due_total = contract_total - received_total;

        return {
          channel: channelName,
          shooting_count: Number(shooting_count) || 0,
          contract_total: Number(contract_total) || 0,
          received_total: Number(received_total) || 0,
          due_total: Number(due_total) || 0,
        };
      })
    );

    summaries.sort((a, b) => b.due_total - a.due_total);
    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
