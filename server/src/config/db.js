import mongoose from 'mongoose';
import dns from 'dns';

// Fix for Windows Node.js DNS resolution with MongoDB Atlas SRV records
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {}
}

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb+srv://kuakatamedia24_db_user:I7LWnpaJ892B3MeC@km-finance-2026.fmlxpib.mongodb.net/km_finance?retryWrites=true&w=majority";
    const conn = await mongoose.connect(uri);
    console.log(`✅ [MongoDB Connected]: ${conn.connection.host} / ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ [MongoDB Connection Error]: ${error.message}`);
  }
};
