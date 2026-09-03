import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const uri = 'mongodb+srv://kuakatamedia24_db_user:I7LWnpaJ892B3MeC@km-finance-2026.fmlxpib.mongodb.net/km_finance?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas');

    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    console.log('Total users in DB:', users.length);
    for (const u of users) {
      console.log('User in DB:', { id: u._id.toString(), username: u.username, email: u.email, role: u.role, name: u.name });
    }

    const adminUsername = 'adminkm';
    const adminEmail = 'adminkm@kuakatamedia.com';
    const plainPass = '01747729757@SK';
    const hashedPassword = await bcrypt.hash(plainPass, 10);

    const existing = await db.collection('users').findOne({
      $or: [{ username: adminUsername }, { email: adminEmail }]
    });

    if (!existing) {
      await db.collection('users').insertOne({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin KM',
        role: 'admin',
        phone: '01747729757',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Admin user created in MongoDB Atlas successfully!');
    } else {
      await db.collection('users').updateOne(
        { _id: existing._id },
        {
          $set: {
            username: adminUsername,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            name: existing.name || 'Admin KM',
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ Admin user password updated in MongoDB Atlas successfully!');
    }

    // Test verify password
    const checkUser = await db.collection('users').findOne({ username: adminUsername });
    const isMatch = await bcrypt.compare(plainPass, checkUser.password);
    console.log('✅ Verification match test:', isMatch ? 'PASSED (Password matches)' : 'FAILED');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
