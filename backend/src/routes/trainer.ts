import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// Helper to get current trainer's staff id from auth middleware
function getTrainerId(req: Request): number {
  if (!req.user?.id) throw new Error('Unauthenticated');
  return req.user.id;
}

// GET /api/trainer/bookings - Upcoming confirmed sittings/bookings for the logged-in trainer
router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const trainerId = getTrainerId(req);
    const result = await query(
      `SELECT id, client_name, client_email, client_phone, start_time, end_time, status, service_type, notes
       FROM bookings
       WHERE staff_id = $1 
         AND status = 'confirmed'
         AND start_time >= NOW()
       ORDER BY start_time ASC
       LIMIT 50`,
      [trainerId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Trainer bookings error:', err);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

// GET /api/trainer/availability - Current recurring availability for the logged-in trainer
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const trainerId = getTrainerId(req);
    const result = await query(
      `SELECT id, start_time, end_time, day_of_week, specific_date, is_available
       FROM availability
       WHERE staff_id = $1
       ORDER BY day_of_week NULLS LAST, specific_date NULLS LAST, start_time`,
      [trainerId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Trainer availability fetch error:', err);
    res.status(500).json({ error: 'Failed to load availability' });
  }
});

// POST /api/trainer/availability - Add a new recurring weekly block
router.post('/availability', async (req: Request, res: Response) => {
  try {
    const trainerId = getTrainerId(req);
    const { day_of_week, start_time, end_time, is_available = true } = req.body;

    if (day_of_week === undefined || day_of_week === null || !start_time || !end_time) {
      return res.status(400).json({ error: 'day_of_week, start_time and end_time are required' });
    }

    // Basic validation
    const dow = parseInt(day_of_week, 10);
    if (isNaN(dow) || dow < 0 || dow > 6) {
      return res.status(400).json({ error: 'day_of_week must be 0-6 (0=Sunday)' });
    }

    const result = await query(
      `INSERT INTO availability (staff_id, start_time, end_time, day_of_week, is_available)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [trainerId, start_time, end_time, dow, is_available]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Add availability error:', err);
    res.status(500).json({ error: 'Failed to add availability block' });
  }
});

// DELETE /api/trainer/availability/:id - Delete one of the trainer's availability blocks
router.delete('/availability/:id', async (req: Request, res: Response) => {
  try {
    const trainerId = getTrainerId(req);
    const { id } = req.params;

    const result = await query(
      `DELETE FROM availability 
       WHERE id = $1 AND staff_id = $2 
       RETURNING id`,
      [id, trainerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Availability block not found or not owned by you' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    console.error('Delete availability error:', err);
    res.status(500).json({ error: 'Failed to delete availability block' });
  }
});

export default router;
