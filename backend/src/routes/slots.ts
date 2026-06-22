import { Router, Request, Response } from 'express';
import { computeSlotsForDate, computeSlotsForRange } from '../utils/slots';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseStaffId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !DATE_RE.test(raw)) return null;
  return raw;
}

// GET /api/slots?staffId=1&date=2026-06-21
// GET /api/slots?staffId=1&from=2026-06-21&to=2026-07-04
router.get('/', async (req: Request, res: Response) => {
  try {
    const staffId = parseStaffId(req.query.staffId);
    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required and must be a positive integer' });
    }

    const date = parseDate(req.query.date);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);

    if (date && (from || to)) {
      return res.status(400).json({ error: 'Provide either date or from/to, not both' });
    }

    if (date) {
      const slots = await computeSlotsForDate(staffId, date);
      return res.json({ staffId, date, slots });
    }

    if (from && to) {
      const days = await computeSlotsForRange(staffId, from, to);
      return res.json({ staffId, from, to, days });
    }

    if (from || to) {
      return res.status(400).json({ error: 'Both from and to are required for a date range' });
    }

    return res.status(400).json({
      error: 'date or from/to query parameters are required (format: YYYY-MM-DD)',
    });
  } catch (err: any) {
    console.error('Slots error:', err);
    res.status(500).json({ error: 'Failed to compute available slots', details: err.message });
  }
});

export default router;