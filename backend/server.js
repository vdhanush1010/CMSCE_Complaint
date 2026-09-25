import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { initSlaCronJob, stopSlaCronJob } from './src/services/slaService.js';

import authRoutes from './src/routes/authRoutes.js';
import complaintRoutes from './src/routes/complaintRoutes.js';
import departmentRoutes from './src/routes/departmentRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';
import announcementRoutes from './src/routes/announcementRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request logger for development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl !== '/api/health') {
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'CMSCE AI Complaint Management System',
    version: '1.2.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Main API Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/announcements', announcementRoutes);

// Dual-mount `/api/v1/...` routes for backward-compatibility with UI manifest specs
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/announcements', announcementRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`
  ======================================================
  🎓 CMSCE AI-Powered Grievance Hub — Backend Engine
  🚀 Server running on http://localhost:${PORT}
  📡 API Base: http://localhost:${PORT}/api/
  ⚡ Health Check: http://localhost:${PORT}/api/health
  ======================================================
  `);
    // Initialize lightweight 15-minute SLA checker cron
    initSlaCronJob('*/15 * * * *');
  });

  // Graceful shutdown handling for container environments (Render, Docker, K8s)
  const gracefulShutdown = async (signal) => {
    console.log(`\n[Process] Received ${signal}. Initiating graceful shutdown...`);
    stopSlaCronJob();
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('[MongoDB] Database connection closed.');
      } catch (err) {
        console.error('[MongoDB] Error closing database connection:', err.message);
      }
      process.exit(0);
    });

    // Force exit if not gracefully closed within 10 seconds
    setTimeout(() => {
      console.error('[Process] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export default app;
