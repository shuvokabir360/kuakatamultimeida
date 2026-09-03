import { defineEventHandler, readBody } from 'h3';
import { MongoClient, ObjectId } from 'mongodb';

const uri =
  process.env.MONGODB_URI ||
  'mongodb+srv://shuvokuakata27_db_user:Vzea.xxFj4_9Nwc@kmfinace.qf8xxly.mongodb.net/km_finance?retryWrites=true&w=majority&appName=kmfinace';

let client: MongoClient | null = null;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 1,
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
  }
  return client.db('km_finance');
}

export default defineEventHandler(async (event) => {
  try {
    const req = await readBody(event);
    const db = await getDb();

    let colName = req.table;
    if (req.table === 'monthly_salaries') colName = 'monthlysalaries';
    if (req.table === 'bonuses') colName = 'bonus';
    if (req.table === 'shooting_expenses') colName = 'shootingexpenses';
    if (req.table === 'client_payments') colName = 'clientpayments';
    if (req.table === 'attendance') colName = 'attendances';

    const collection = db.collection(colName);

    // 1. UPDATE
    if (req.action === 'update') {
      const targetId = req.filters?.id || req.filters?.name || req.data?.id || req.data?.name;
      const query: any = {};
      if (targetId) {
        try {
          query.$or = [{ _id: new ObjectId(targetId) }, { id: targetId }, { name: targetId }];
        } catch (_) {
          query.$or = [{ id: targetId }, { name: targetId }];
        }
      }
      if (req.filters?.member_id) query.member_id = req.filters.member_id;

      const payload = { ...req.data, updatedAt: new Date() };
      delete payload._id;
      delete payload.id;

      await collection.updateMany(query, { $set: payload }, { upsert: true });
      return { success: true, payload };
    }

    // 2. INSERT
    if (req.action === 'insert') {
      const items = Array.isArray(req.data) ? req.data : [req.data];
      const toInsert = items.map((item: any) => {
        const doc = { ...item };
        delete doc._id;
        delete doc.id;
        doc.createdAt = doc.createdAt || new Date();
        doc.updatedAt = new Date();
        return doc;
      });
      const res = await collection.insertMany(toInsert);
      return { success: true, insertedIds: res.insertedIds };
    }

    // 3. DELETE
    if (req.action === 'delete') {
      const targetId = req.filters?.id || req.filters?.name;
      const delQuery: any = {};
      if (targetId) {
        try {
          delQuery.$or = [{ _id: new ObjectId(targetId) }, { id: targetId }, { name: targetId }];
        } catch (_) {
          delQuery.$or = [{ id: targetId }, { name: targetId }];
        }
      }
      if (req.filters?.member_id) delQuery.member_id = req.filters.member_id;

      await collection.deleteMany(delQuery);
      return { success: true };
    }

    // 4. SELECT
    if (req.action === 'select') {
      const query: any = {};
      if (req.filters?.id) {
        try {
          query.$or = [{ _id: new ObjectId(req.filters.id) }, { id: req.filters.id }, { name: req.filters.id }];
        } catch (_) {
          query.$or = [{ id: req.filters.id }, { name: req.filters.id }];
        }
      }
      if (req.filters?.member_id) query.member_id = req.filters.member_id;
      if (req.filters?.name) query.name = req.filters.name;

      const list = await collection.find(query).toArray();
      return { success: true, data: list };
    }

    return { success: true };
  } catch (err: any) {
    console.error('API /api/sync error:', err);
    return { success: false, error: err?.message || 'MongoDB Error' };
  }
});
