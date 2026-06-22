import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import staffRoutes from './routes/staff';
import bookingsRoutes from './routes/bookings';
import bookingsPublicRoutes from './routes/bookingsPublic';
import availabilityRoutes from './routes/availability';
import authRoutes from './routes/auth';
import trainerRoutes from './routes/trainer';
import slotsRoutes from './routes/slots';
import publicRoutes from './routes/public';
import { authenticateToken, requireAdmin } from './middleware/auth';
import { testConnection, closePool } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger (simple)
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health + readiness
app.get('/api/health', async (_req: Request, res: Response) => {
  const dbOk = await testConnection();
  res.json({
    status: 'ok',
    service: 'scheduler-backend',
    time: new Date().toISOString(),
    db: dbOk ? 'connected' : 'disconnected',
  });
});

// Public API routes (no auth)
app.use('/api/public', publicRoutes);
app.use('/api/bookings', bookingsPublicRoutes);
app.use('/api/slots', slotsRoutes);

// Admin-only API routes (auth + admin role required)
app.use('/api/staff', authenticateToken, requireAdmin, staffRoutes);
app.use('/api/bookings', authenticateToken, requireAdmin, bookingsRoutes);
app.use('/api/availability', authenticateToken, requireAdmin, availabilityRoutes);

// Auth (public)
app.use('/api/auth', authRoutes);

// Trainer protected routes (JWT/cookie required)
app.use('/api/trainer', authenticateToken, trainerRoutes);

// 404 for API
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Root
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Staff Booking & Scheduling API',
    version: '0.1.0',
    endpoints: [
      'GET /api/health',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/logout',
      'GET /api/trainer/bookings (protected)',
      'DELETE /api/trainer/bookings/:id (protected - cancel + email)',
      'GET/POST/DELETE /api/trainer/availability (protected)',
      'GET /api/public/staff',
      'POST /api/bookings (public create)',
      'GET/PUT/DELETE /api/bookings (admin only)',
      'GET/POST/PUT/DELETE /api/staff (admin only)',
      'GET/POST/DELETE /api/availability (admin only)',
      'GET /api/slots?staffId=&date= (or from=&to=)',
    ],
  });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown - only start server in non-test environments
let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, async () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
    console.log('Testing DB connection...');
    await testConnection();
  });

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function shutdown() {
  console.log('Shutting down gracefully...');
  if (server) {
    server.close(async () => {
      await closePool();
      console.log('Closed DB pool and server');
      process.exit(0);
    });
  }
  // Force close after 10s
  setTimeout(() => process.exit(1), 10000);
}

export default app;
