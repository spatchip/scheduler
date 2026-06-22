import { Router, Request, Response } from 'express';
import { query, getClient } from '../db';
import * as emailService from '../utils/email';

const router = Router();

// POST /api/bookings - public booking creation with transactional overlap check
router.post('/', async (req: Request, res: Response) => {
  const client = await getClient();

  try {
    const {
      staff_id,
      start_time,
      end_time,
      client_name,
      client_email,
      client_phone,
      status,
      service_type,
      notes,
    } = req.body;

    if (!staff_id || !start_time || !end_time || !client_name) {
      return res.status(400).json({ error: 'staff_id, start_time, end_time, client_name are required' });
    }

    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(staff_id)]);

    const overlap = await client.query(
      `SELECT id FROM bookings
       WHERE staff_id = $1
         AND status != 'cancelled'
         AND start_time < $3::timestamptz
         AND end_time > $2::timestamptz
       FOR UPDATE`,
      [staff_id, start_time, end_time]
    );

    if (overlap.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Time slot overlaps with an existing booking for this staff member',
        code: 'BOOKING_OVERLAP',
      });
    }

    const result = await client.query(
      `INSERT INTO bookings
       (staff_id, start_time, end_time, client_name, client_email, client_phone, status, service_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'confirmed'), $8, $9)
       RETURNING *`,
      [
        staff_id,
        start_time,
        end_time,
        client_name,
        client_email || null,
        client_phone || null,
        status || null,
        service_type || null,
        notes || null,
      ]
    );

    await client.query('COMMIT');

    const booking = result.rows[0];

    try {
      if (booking.client_email) {
        const staffRes = await query('SELECT name, email FROM staff WHERE id = $1', [staff_id]);
        if (staffRes.rows.length > 0) {
          await emailService.sendBookingConfirmation(booking, staffRes.rows[0]);
        }
      }
    } catch (emailErr: any) {
      console.error('Simulated email (confirmation) failed (non-fatal):', emailErr.message);
    }

    res.status(201).json(booking);
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking', details: err.message });
  } finally {
    client.release();
  }
});

export default router;