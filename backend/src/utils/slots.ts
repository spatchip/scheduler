import { DateTime } from 'luxon';
import { query } from '../db';

export const SLOT_MINUTES = 60;

export interface AvailabilityRow {
  id: number;
  staff_id: number;
  start_time: string;
  end_time: string;
  day_of_week: number | null;
  specific_date: string | null;
  is_available: boolean;
}

export interface BookingRow {
  id: number;
  staff_id: number;
  start_time: string | Date;
  end_time: string | Date;
  status: string;
}

export interface Slot {
  start_time: string;
  end_time: string;
}

export interface DaySlots {
  date: string;
  slots: Slot[];
}

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  return DateTime.fromISO(value, { zone: 'utc' }).toISO()!;
}

/** Compute free 60-minute slots for one calendar date (YYYY-MM-DD). */
export function getFreeSlotsForDate(
  dateStr: string,
  availRules: AvailabilityRow[],
  currentBookings: BookingRow[]
): Slot[] {
  const date = DateTime.fromISO(dateStr, { zone: 'utc' });
  if (!date.isValid) return [];

  const luxWeekday = date.weekday; // 1=Mon ... 7=Sun
  const pgDow = luxWeekday === 7 ? 0 : luxWeekday; // Postgres 0=Sun ... 6=Sat

  const rules = availRules.filter((r) => {
    if (r.is_available === false) return false;
    if (r.specific_date && r.specific_date === dateStr) return true;
    if (r.day_of_week !== null && r.day_of_week === pgDow) return true;
    return false;
  });

  if (rules.length === 0) return [];

  const slots: Slot[] = [];

  for (const rule of rules) {
    const startTime = normalizeTime(rule.start_time || '');
    const endTime = normalizeTime(rule.end_time || '');

    const windowStart = DateTime.fromISO(`${dateStr}T${startTime}Z`, { zone: 'utc' });
    const windowEnd = DateTime.fromISO(`${dateStr}T${endTime}Z`, { zone: 'utc' });

    if (!windowStart.isValid || !windowEnd.isValid || windowEnd <= windowStart) continue;

    let chunkStart = windowStart;
    while (chunkStart.plus({ minutes: SLOT_MINUTES }) <= windowEnd) {
      const chunkEnd = chunkStart.plus({ minutes: SLOT_MINUTES });

      if (chunkEnd <= DateTime.utc()) {
        chunkStart = chunkStart.plus({ minutes: SLOT_MINUTES });
        continue;
      }

      const overlapsExisting = currentBookings.some((b) => {
        if (b.status === 'cancelled') return false;
        const bs = DateTime.fromISO(toIso(b.start_time), { zone: 'utc' });
        const be = DateTime.fromISO(toIso(b.end_time), { zone: 'utc' });
        return bs < chunkEnd && be > chunkStart;
      });

      if (!overlapsExisting) {
        slots.push({
          start_time: chunkStart.toISO()!,
          end_time: chunkEnd.toISO()!,
        });
      }

      chunkStart = chunkStart.plus({ minutes: SLOT_MINUTES });
    }
  }

  slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return slots.filter((s, i, arr) => i === 0 || s.start_time !== arr[i - 1].start_time);
}

export async function loadStaffAvailability(staffId: number): Promise<AvailabilityRow[]> {
  const result = await query<AvailabilityRow>(
    `SELECT id, staff_id, start_time::text, end_time::text, day_of_week, specific_date::text, is_available
     FROM availability
     WHERE staff_id = $1`,
    [staffId]
  );
  return result.rows;
}

export async function loadStaffBookingsForRange(
  staffId: number,
  fromDate: string,
  toDate: string
): Promise<BookingRow[]> {
  const rangeStart = DateTime.fromISO(fromDate, { zone: 'utc' }).startOf('day').toISO();
  const rangeEnd = DateTime.fromISO(toDate, { zone: 'utc' }).endOf('day').toISO();

  const result = await query<BookingRow>(
    `SELECT id, staff_id, start_time, end_time, status
     FROM bookings
     WHERE staff_id = $1
       AND status != 'cancelled'
       AND start_time < $3::timestamptz
       AND end_time > $2::timestamptz`,
    [staffId, rangeStart, rangeEnd]
  );
  return result.rows;
}

export function enumerateDates(fromDate: string, toDate: string): string[] {
  const from = DateTime.fromISO(fromDate, { zone: 'utc' });
  const to = DateTime.fromISO(toDate, { zone: 'utc' });
  if (!from.isValid || !to.isValid || to < from) return [];

  const dates: string[] = [];
  let cursor = from.startOf('day');
  const end = to.startOf('day');
  while (cursor <= end) {
    dates.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}

export async function computeSlotsForDate(
  staffId: number,
  date: string
): Promise<Slot[]> {
  const [availability, bookings] = await Promise.all([
    loadStaffAvailability(staffId),
    loadStaffBookingsForRange(staffId, date, date),
  ]);
  return getFreeSlotsForDate(date, availability, bookings);
}

export async function computeSlotsForRange(
  staffId: number,
  fromDate: string,
  toDate: string
): Promise<DaySlots[]> {
  const [availability, bookings] = await Promise.all([
    loadStaffAvailability(staffId),
    loadStaffBookingsForRange(staffId, fromDate, toDate),
  ]);

  return enumerateDates(fromDate, toDate).map((date) => ({
    date,
    slots: getFreeSlotsForDate(date, availability, bookings),
  }));
}