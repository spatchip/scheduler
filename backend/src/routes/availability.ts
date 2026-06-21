import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/availability?staffId=xx&dayOfWeek=1 or date=2026-06-21
router.get('/', async (req: Request, res: Response) => {
  try {
    const { staffId, dayOfWeek, date } = req.query;
    let sql = `
      SELECT a.*, s.name as staff_name 
      FROM availability a
      JOIN staff s ON a.staff_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (staffId) {
      sql += ` AND a.staff_id = $${idx++}`;
      params.push(Number(staffId));
    }
    if (dayOfWeek !== undefined) {
      sql += ` AND a.day_of_week = $${idx++}`;
      params.push(Number(dayOfWeek));
    }
    if (date) {
      sql += ` AND (a.specific_date = $${idx++} OR a.specific_date IS NULL)`;
      params.push(date);
    }
    sql += ' ORDER BY a.day_of_week NULLS LAST, a.start_time';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability', details: err.message });
  }
});

// POST /api/availability
router.post('/', async (req: Request, res: Response) => {
  try {
    const { staff_id, start_time, end_time, day_of_week, specific_date, is_available } = req.body;
    if (!staff_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'staff_id, start_time, end_time required' });
    }
    const result = await query(
      `INSERT INTO availability (staff_id, start_time, end_time, day_of_week, specific_date, is_available)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
       RETURNING *`,
      [staff_id, start_time, end_time, day_of_week ?? null, specific_date ?? null, is_available]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create availability', details: err.message });
  }
});

// DELETE /api/availability/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM availability WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Availability slot not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete availability', details: err.message });
  }
});

export default router;
