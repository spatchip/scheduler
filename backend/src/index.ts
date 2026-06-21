import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import staffRoutes from './routes/staff';
import bookingsRoutes from './routes/bookings';
import availabilityRoutes from './routes/availability';
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

// API routes
app.use('/api/staff', staffRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/availability', availabilityRoutes);

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
      'GET/POST/PUT/DELETE /api/staff',
      'GET/POST/PUT/DELETE /api/bookings',
      'GET/POST/DELETE /api/availability',
    ],
  });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
const server = app.listen(PORT, async () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log('Testing DB connection...');
  await testConnection();
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(async () => {
    await closePool();
    console.log('Closed DB pool and server');
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => process.exit(1), 10000);
}

export default app;
