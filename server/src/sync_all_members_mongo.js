import mongoose from 'mongoose';

const uri = 'mongodb+srv://shuvokuakata27_db_user:' + encodeURIComponent('Vzea.xxFj4_9Nwc') + '@kmfinace.qf8xxly.mongodb.net/km_finance?retryWrites=true&w=majority&appName=kmfinace';

const ALL_MEMBERS = [
  { name: 'Kabir Hossen Shuvo', role: 'CEO', type: 'monthly', rate: 0, phone: '01713953527' },
  { name: 'Badal', role: 'Production', type: 'daily', rate: 0, phone: '' },
  { name: 'Noyon Moni', role: 'Production', type: 'daily', rate: 0, phone: '' },
  { name: 'Jafor Howlader', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Abu Hasan Milon', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Sojib', role: 'Production', type: 'daily', rate: 0, phone: '' },
  { name: 'Bayzid', role: 'Production', type: 'daily', rate: 0, phone: '' },
  { name: 'Toha', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Tamanna', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Rimi', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Jisan Musulli', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Emon Molla', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Siraj Musulli', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Ziaur Rahman', role: 'Editor & Cameraman', type: 'monthly', rate: 0, phone: '' },
  { name: 'Porosh Moni', role: 'Editor & Cameraman', type: 'monthly', rate: 0, phone: '01610400509' },
  { name: 'Arif Apon', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'Masud Pervez Sagar', role: 'Actor', type: 'daily', rate: 0, phone: '' },
  { name: 'SM Almas', role: 'Actor & Director', type: 'daily', rate: 0, phone: '' },
  { name: 'Abubakar Abir', role: 'Ass. Director', type: 'monthly', rate: 0, phone: '01713953527' },
];

async function syncAllToMongo() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas kmfinace cluster');
    const db = mongoose.connection.db;

    for (const m of ALL_MEMBERS) {
      await db.collection('members').updateOne(
        { name: m.name },
        {
          $set: {
            ...m,
            owner_id: 'default_admin',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    const count = await db.collection('members').countDocuments();
    console.log(`🎉 Total ${count} members synced to MongoDB Atlas kmfinace.members collection!`);

    const list = await db.collection('members').find({}).toArray();
    console.log('Synced members list:', list.map(l => `${l.name} (${l.role})`));

    process.exit(0);
  } catch (err) {
    console.error('Error syncing:', err);
    process.exit(1);
  }
}

syncAllToMongo();
