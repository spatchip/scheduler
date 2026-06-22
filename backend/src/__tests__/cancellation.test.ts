import request from 'supertest';
import app from '../index';  // default export of the Express app
import { query, closePool } from '../db';
import * as emailService from '../utils/email';

describe('Trainer Cancellation Route (Integration)', () => {
  let authCookie: string;
  const trainerEmail = 'alice.chen@example.com';
  const trainerPassword = 'password123';
  const testStaffId = 1; // Alice Chen

  beforeAll(async () => {
    // Login as trainer to obtain auth cookie (simulates real trainer session)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: trainerEmail,
        password: trainerPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).toBeDefined();

    // Extract cookie for subsequent authenticated requests
    const rawCookies = loginRes.headers['set-cookie'];
    if (rawCookies) {
      authCookie = Array.isArray(rawCookies)
        ? rawCookies.map((c: string) => c.split(';')[0]).join('; ')
        : rawCookies.split(';')[0];
    } else {
      authCookie = '';
    }
    expect(authCookie).toContain('auth_token');
  });

  it('should allow a trainer to successfully soft-delete (cancel) one of their bookings and trigger the simulated email utility', async () => {
    // 1. Create a test booking as an "abhyasi" (public endpoint) for the trainer
    const futureTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days in future
    const startTime = futureTime.toISOString();
    const endTime = new Date(futureTime.getTime() + 60 * 60 * 1000).toISOString(); // +1h

    const createRes = await request(app)
      .post('/api/bookings')
      .send({
        staff_id: testStaffId,
        start_time: startTime,
        end_time: endTime,
        client_name: 'Test Cancellation Client',
        client_email: 'testcancel@example.com',
        service_type: 'Test Sitting',
        notes: 'Integration test booking for cancellation',
      });

    expect(createRes.status).toBe(201);
    const bookingId = createRes.body.id;
    expect(bookingId).toBeDefined();

    // 2. Spy on the email utility BEFORE the delete (it should be triggered on cancel)
    const sendCancelSpy = jest.spyOn(emailService, 'sendBookingCancellation');

    // 3. As the trainer, cancel the booking via the protected trainer route (now soft-delete)
    const deleteRes = await request(app)
      .delete(`/api/trainer/bookings/${bookingId}`)
      .set('Cookie', authCookie);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.id).toBe(bookingId);

    // 4. Verify the simulated email utility was triggered
    expect(sendCancelSpy).toHaveBeenCalledTimes(1);
    expect(sendCancelSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: bookingId,
        client_name: 'Test Cancellation Client',
        client_email: 'testcancel@example.com',
      }),
      expect.objectContaining({
        name: expect.stringContaining('Alice'), // or any staff name
      })
    );

    // 5. Verify soft-delete behavior: booking still exists but status='cancelled' and cancelled_at is set
    const dbCheck = await query('SELECT id, status, cancelled_at FROM bookings WHERE id = $1', [bookingId]);
    expect(dbCheck.rows.length).toBe(1);
    expect(dbCheck.rows[0].status).toBe('cancelled');
    expect(dbCheck.rows[0].cancelled_at).toBeDefined();
    expect(dbCheck.rows[0].cancelled_at).not.toBeNull();

    sendCancelSpy.mockRestore();
  });

  it('should return 404 when trying to cancel a non-existent or unauthorized booking', async () => {
    const deleteRes = await request(app)
      .delete('/api/trainer/bookings/999999')
      .set('Cookie', authCookie);

    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error).toMatch(/not found or does not belong/i);
  });

  afterAll(async () => {
    // Close the DB pool so Jest can exit cleanly
    await closePool();
  });
});
