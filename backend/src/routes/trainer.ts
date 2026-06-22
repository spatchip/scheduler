import { Router, Request, Response } from 'express';
import { query } from '../db';
import * as emailService from '../utils/email';

const router = Router();

// Helper to get current trainer's staff id from auth middleware
function getTrainerId(req: Request): number {
  if (!req.user?.id) throw new Error('Unauthenticated');
  return req.user.id;
}

// GET /api/trainer/bookings - Upcoming confirmed sittings/bookings for the logged-in trainer
// Supports ?status=cancelled to fetch soft-deleted history for this trainer (instead of default upcoming)
router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const trainerId = getTrainerId(req);
    const { status } = req.query;

    if (status === 'cancelled') {
      const result = await query(
        `SELECT id, client_name, client_email, client_phone, start_time, end_time, status, service_type, notes, cancelled_at
         FROM bookings
         WHERE staff_id = $1 
           AND status = 'cancelled'
         ORDER BY cancelled_at DESC NULLS LAST, start_time DESC
         LIMIT 50`,
        [trainerId]
      );
      return res.json(result.rows);
    }

    // Default: upcoming confirmed only (for "Upcoming Sittings")
    const result = await query(
      `SELECT id, client_name, client_email, client_phone, start_time, end_time, status, service_type, notes, cancelled_at
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

// DELETE /api/trainer/bookings/:id - Cancel (soft-delete) one of the trainer's own bookings
router.delete('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const trainerId = getTrainerId(req);
    const { id } = req.params;

    // Fetch the booking first so we can send cancellation email with details
    const bookingRes = await query(
      `SELECT b.*, s.name as staff_name 
       FROM bookings b
       JOIN staff s ON b.staff_id = s.id
       WHERE b.id = $1 AND b.staff_id = $2`,
      [id, trainerId]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or does not belong to you' });
    }

    const booking = bookingRes.rows[0];

    // Soft-delete: set status to 'cancelled' and cancelled_at (instead of hard DELETE)
    const updateRes = await query(
      `UPDATE bookings 
       SET status = 'cancelled', 
           cancelled_at = NOW(), 
           updated_at = NOW()
       WHERE id = $1 AND staff_id = $2 
       RETURNING id`,
      [id, trainerId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or does not belong to you' });
    }

    // Trigger simulated cancellation email to the abhyasi (still happens on soft-cancel)
    if (booking.client_email) {
      await emailService.sendBookingCancellation(booking, { name: booking.staff_name || 'Your trainer' });
    }

    res.json({ success: true, id: updateRes.rows[0].id });
  } catch (err: any) {
    console.error('Trainer cancel booking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
