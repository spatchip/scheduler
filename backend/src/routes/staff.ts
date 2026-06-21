import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/staff - list all
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, department, phone, notes, created_at FROM staff ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff', details: err.message });
  }
});

// GET /api/staff/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM staff WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff member', details: err.message });
  }
});

// POST /api/staff - create
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, role, department, phone, notes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const result = await query(
      `INSERT INTO staff (name, email, role, department, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, role || null, department || null, phone || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create staff', details: err.message });
  }
});

// PUT /api/staff/:id - update
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, department, phone, notes } = req.body;
    const result = await query(
      `UPDATE staff 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           department = COALESCE($4, department),
           phone = COALESCE($5, phone),
           notes = COALESCE($6, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, email, role, department, phone, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to update staff', details: err.message });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM staff WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete staff', details: err.message });
  }
});

export default router;
