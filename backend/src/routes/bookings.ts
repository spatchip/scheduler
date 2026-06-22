import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/bookings - admin overview, optional ?staffId= &status= &from= &to=
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
      notes,
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