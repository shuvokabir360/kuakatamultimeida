import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try loading server/.env first, then root .env
if (fs.existsSync(path.resolve('server/.env'))) {
  dotenv.config({ path: path.resolve('server/.env') });
}
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { authMiddleware } from './middleware/auth.js';
import { initSSR, handleSSR } from './ssrHandler.js';

import authRoutes, { initAdminUser } from './routes/auth.js';
import membersRoutes from './routes/members.js';
import attendanceRoutes from './routes/attendance.js';
import paymentsRoutes from './routes/payments.js';
import shootingsRoutes from './routes/shootings.js';
import reportsRoutes from './routes/reports.js';
import clientsRoutes from './routes/clients.js';
import uploadRoutes from './routes/upload.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize in-process SSR handler
initSSR();

// Connect to MongoDB Atlas and initialize Admin User
connectDB().then(() => {
  initAdminUser();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
const uploadsDir = path.resolve('server/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', authMiddleware, membersRoutes);
app.use('/api/attendance', authMiddleware, attendanceRoutes);
app.use('/api/payments', authMiddleware, paymentsRoutes);
app.use('/api/shootings', authMiddleware, shootingsRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/clients', authMiddleware, clientsRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'MongoDB Atlas',
    time: new Date().toISOString(),
  });
});

// Serve Frontend static assets directly
const publicDir = fs.existsSync(path.resolve('.output/public'))
  ? path.resolve('.output/public')
  : path.resolve('public');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false }));
}

// Handle all page routes via in-process TanStack Start SSR
app.use(handleSSR);

// Fallback if SSR not available: send static index.html or simple error
app.use((req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`🚀 [KM Finance Server] running on http://localhost:${PORT}`);
});
