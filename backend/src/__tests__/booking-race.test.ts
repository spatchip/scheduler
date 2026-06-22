import request from 'supertest';
import app from '../index';
import { closePool } from '../db';

describe('POST /api/bookings double-booking race (Integration)', () => {
  const testStaffId = 1;

  function buildPayload(suffix: string, startTime: string, endTime: string) {
    return {
      staff_id: testStaffId,
      start_time: startTime,
      end_time: endTime,
      client_name: `Race Test Client ${suffix}`,
      client_email: `race-${suffix}@example.com`,
      service_type: 'Race Test Sitting',
      notes: 'Concurrent booking race integration test',
    };
  }

  it('should allow only one booking when two requests target the same slot concurrently', async () => {
    // Use a far-future slot unlikely to collide with seeded or prior test data
    const futureTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    futureTime.setMinutes(0, 0, 0);
    const startTime = futureTime.toISOString();
    const endTime = new Date(futureTime.getTime() + 60 * 60 * 1000).toISOString();

    const payloadA = buildPayload('a', startTime, endTime);
    const payloadB = buildPayload('b', startTime, endTime);

    const [resA, resB] = await Promise.all([
      request(app).post('/api/bookings').send(payloadA),
      request(app).post('/api/bookings').send(payloadB),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const success = resA.status === 201 ? resA : resB;
    const conflict = resA.status === 409 ? resA : resB;

    expect(success.body.id).toBeDefined();
    expect(conflict.body).toMatchObject({
      error: expect.stringMatching(/overlap/i),
      code: 'BOOKING_OVERLAP',
    });
  });

  afterAll(async () => {
    await closePool();
  });
});