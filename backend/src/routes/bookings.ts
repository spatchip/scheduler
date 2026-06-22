import { Router, Request, Response } from 'express';
import { query, getClient } from '../db';
import * as emailService from '../utils/email';

const router = Router();

// GET /api/bookings - list, optional ?staffId= &status= &from= &to=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { staffId, status, from, to } = req.query;
    let sql = `
      SELECT b.*, s.name as staff_name, s.email as staff_email
      FROM bookings b
      JOIN staff s ON b.staff_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (staffId) {
      sql += ` AND b.staff_id = $${idx++}`;
      params.push(staffId);
    }
    if (status) {
      sql += ` AND b.status = $${idx++}`;
      params.push(status);
    }
    if (from) {
      sql += ` AND b.start_time >= $${idx++}`;
      params.push(from);
    }
    if (to) {
      sql += ` AND b.end_time <= $${idx++}`;
      params.push(to);
    }
    sql += ' ORDER BY b.start_time DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings', details: err.message });
  }
});

// GET /api/bookings/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT b.*, s.name as staff_name FROM bookings b
       JOIN staff s ON b.staff_id = s.id
       WHERE b.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch booking', details: err.message });
  }
});

// POST /api/bookings - create with transactional overlap check + advisory lock
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
      notes
    } = req.body;

    if (!staff_id || !start_time || !end_time || !client_name) {
      return res.status(400).json({ error: 'staff_id, start_time, end_time, client_name are required' });
    }

    await client.query('BEGIN');

    // Serialize bookings per staff member to prevent double-booking races
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(staff_id)]);

    // Lock overlapping rows; cancelled bookings are ignored and do not block the slot
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

    // Trigger simulated email notification to the abhyasi (client)
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

// PUT /api/bookings/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      staff_id,
      start_time,
      end_time,
      client_name,
      client_email,
      client_phone,
      status,
      service_type,
      notes
    } = req.body;

    const result = await query(
      `UPDATE bookings
       SET staff_id = COALESCE($1, staff_id),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time),
           client_name = COALESCE($4, client_name),
           client_email = COALESCE($5, client_email),
           client_phone = COALESCE($6, client_phone),
           status = COALESCE($7, status),
           cancelled_at = CASE
             WHEN COALESCE($7, status) = 'cancelled' AND status IS DISTINCT FROM 'cancelled' THEN CURRENT_TIMESTAMP
             ELSE cancelled_at
           END,
           service_type = COALESCE($8, service_type),
           notes = COALESCE($9, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [staff_id, start_time, end_time, client_name, client_email, client_phone, status, service_type, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking', details: err.message });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM bookings WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete booking', details: err.message });
  }
});

export default router;
