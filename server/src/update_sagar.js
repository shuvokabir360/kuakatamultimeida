import mongoose from 'mongoose';

const uri = 'mongodb+srv://shuvokuakata27_db_user:' + encodeURIComponent('Vzea.xxFj4_9Nwc') + '@kmfinace.qf8xxly.mongodb.net/km_finance?retryWrites=true&w=majority&appName=kmfinace';

async function updateSagar() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas kmfinace cluster');
    const db = mongoose.connection.db;

    await db.collection('members').updateOne(
      { name: 'Masud Pervez Sagar' },
      {
        $set: {
          phone: '01746772754',
          rate: 3500,
          type: 'daily',
          role: 'Actor',
          updatedAt: new Date(),
        },
      }
    );

    const doc = await db.collection('members').findOne({ name: 'Masud Pervez Sagar' });
    console.log('✅ Sagar successfully updated in MongoDB Atlas:', doc);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updateSagar();
