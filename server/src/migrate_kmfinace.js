import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const uri = 'mongodb+srv://shuvokuakata27_db_user:' + encodeURIComponent('Vzea.xxFj4_9Nwc') + '@kmfinace.qf8xxly.mongodb.net/km_finance?retryWrites=true&w=majority&appName=kmfinace';

async function main() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas kmfinace cluster');
    const db = mongoose.connection.db;

    // 1. Seed Admin User
    const adminPass = await bcrypt.hash('01747729757@SK', 10);
    await db.collection('users').updateOne(
      { username: 'adminkm' },
      {
        $set: {
          username: 'adminkm',
          email: 'adminkm@kuakatamedia.com',
          password: adminPass,
          name: 'Admin KM',
          role: 'admin',
          phone: '01747729757',
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log('✅ Admin user created in kmfinace');

    // 2. Seed Members
    const members = [
      {
        name: 'Kabir Hossen Shuvo',
        role: 'CEO',
        phone: '01713953527',
        type: 'monthly',
        rate: 0,
        photo_url: '',
        owner_id: 'default_admin',
        updatedAt: new Date(),
      },
      {
        name: 'Abubakar',
        role: 'actor',
        phone: '01713953527',
        type: 'daily',
        rate: 0,
        photo_url: '',
        owner_id: 'default_admin',
        updatedAt: new Date(),
      },
      {
        name: 'porosh',
        role: 'production',
        phone: '01610400509',
        type: 'daily',
        rate: 0,
        photo_url: '',
        owner_id: 'default_admin',
        updatedAt: new Date(),
      },
    ];

    for (const m of members) {
      await db.collection('members').updateOne(
        { name: m.name },
        { $set: m },
        { upsert: true }
      );
    }
    console.log('✅ Members seeded into kmfinace');

    // 3. Seed Channels
    const channels = [
      { name: 'Kuakata Multimedia', updatedAt: new Date() },
      { name: 'Malbro Entertainment', updatedAt: new Date() },
      { name: 'Projapoti Multimedia', updatedAt: new Date() },
      { name: 'Mehedi Multimedia', updatedAt: new Date() },
    ];
    for (const c of channels) {
      await db.collection('channels').updateOne(
        { name: c.name },
        { $set: c },
        { upsert: true }
      );
    }
    console.log('✅ Channels seeded into kmfinace');

    // 4. Seed Directors
    const directors = [
      { name: 'Saddam Mal', phone: '', updatedAt: new Date() },
      { name: 'SM ALMAS', phone: '', updatedAt: new Date() },
    ];
    for (const d of directors) {
      await db.collection('directors').updateOne(
        { name: d.name },
        { $set: d },
        { upsert: true }
      );
    }
    console.log('✅ Directors seeded into kmfinace');

    const collections = await db.listCollections().toArray();
    console.log('🎉 Current collections in kmfinace:', collections.map((c) => c.name));

    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} documents`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

main();
