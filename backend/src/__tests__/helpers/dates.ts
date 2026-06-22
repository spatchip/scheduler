let slotSequence = 0;
const runNonce = Date.now() % 1_000_000;

/** Build a unique far-future UTC slot; each call advances a sequence to avoid DB collisions. */
export function uniqueFutureSlot(durationMinutes = 60): {
  startTime: string;
  endTime: string;
} {
  slotSequence += 1;
  const daysAhead = 150 + slotSequence * 5 + (runNonce % 40);
  const hour = 8 + ((slotSequence + runNonce) % 11);

  const base = new Date();
  base.setUTCDate(base.getUTCDate() + daysAhead);
  base.setUTCHours(hour, 0, 0, 0);

  const startTime = base.toISOString();
  const endTime = new Date(base.getTime() + durationMinutes * 60 * 1000).toISOString();
  return { startTime, endTime };
}

export function isoDateDaysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}