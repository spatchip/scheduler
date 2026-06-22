import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// GET /api/public/staff - minimal staff list for public booking (no auth)
router.get('/staff', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, role, department
       FROM staff
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff', details: err.message });
  }
});

export default router;