import request from 'supertest';
import app from '../index';
import { query } from '../db';
import * as emailService from '../utils/email';
import { login } from './helpers/auth';
import { isoDateDaysFromNow, uniqueFutureSlot } from './helpers/dates';

const TRAINER_EMAIL = 'alice.chen@example.com';
const OTHER_TRAINER_EMAIL = 'marcus.rivera@example.com';
const ADMIN_EMAIL = 'admin@example.com';
const PASSWORD = 'password123';
const ALICE_STAFF_ID = 1;

describe('Scheduler Site Integration (full feature coverage)', () => {
  let trainerCookie: string;
  let otherTrainerCookie: string;
  let adminCookie: string;
  let testRunId: string;

  beforeAll(async () => {
    testRunId = `site-${Date.now()}`;
    const trainer = await login(app, TRAINER_EMAIL, PASSWORD);
    trainerCookie = trainer.cookie;

    const other = await login(app, OTHER_TRAINER_EMAIL, PASSWORD);
    otherTrainerCookie = other.cookie;

    const admin = await login(app, ADMIN_EMAIL, PASSWORD);
    adminCookie = admin.cookie;
  });

  // ─── Health & root ───────────────────────────────────────────────
  describe('Health & service metadata', () => {
    it('GET /api/health returns ok with db status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('scheduler-backend');
      expect(['connected', 'disconnected']).toContain(res.body.db);
    });

    it('GET / returns API index with documented endpoints', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Staff Booking/i);
      expect(res.body.endpoints).toEqual(expect.arrayContaining([
        'GET /api/health',
        'POST /api/auth/login',
      ]));
    });
  });

  // ─── Public booking surface ──────────────────────────────────────
  describe('Public API (no auth)', () => {
    it('GET /api/public/staff returns bookable staff list', async () => {
      const res = await request(app).get('/api/public/staff');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
      });
      expect(res.body[0].email).toBeUndefined();
    });

    it('GET /api/slots validates required query parameters', async () => {
      const missingStaff = await request(app).get('/api/slots?date=2026-07-01');
      expect(missingStaff.status).toBe(400);

      const missingDate = await request(app).get('/api/slots?staffId=1');
      expect(missingDate.status).toBe(400);

      const partialRange = await request(app).get('/api/slots?staffId=1&from=2026-07-01');
      expect(partialRange.status).toBe(400);
    });

    it('GET /api/slots returns slots for a single date', async () => {
      const date = isoDateDaysFromNow(7);
      const res = await request(app).get(`/api/slots?staffId=${ALICE_STAFF_ID}&date=${date}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        staffId: ALICE_STAFF_ID,
        date,
        slots: expect.any(Array),
      });
    });

    it('GET /api/slots returns per-day slots for a date range', async () => {
      const from = isoDateDaysFromNow(7);
      const to = isoDateDaysFromNow(14);
      const res = await request(app).get(
        `/api/slots?staffId=${ALICE_STAFF_ID}&from=${from}&to=${to}`
      );
      expect(res.status).toBe(200);
      expect(res.body.days).toHaveLength(8);
      expect(res.body.days[0]).toMatchObject({
        date: expect.any(String),
        slots: expect.any(Array),
      });
    });
  });

  // ─── Authentication ──────────────────────────────────────────────
  describe('Authentication', () => {
    it('POST /api/auth/login rejects invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TRAINER_EMAIL, password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('GET /api/auth/me returns current user with role when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', trainerCookie);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: expect.any(Number),
        email: TRAINER_EMAIL,
        name: expect.any(String),
      });
      expect(res.body.user.role).toBeDefined();
    });

    it('GET /api/auth/me returns 401 without a session', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('POST /api/auth/logout succeeds and instructs the client to clear the auth cookie', async () => {
      const { cookie } = await login(app, TRAINER_EMAIL, PASSWORD);
      const logout = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);
      expect(logout.status).toBe(200);

      const setCookie = logout.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
      expect(cookieHeader).toMatch(/auth_token=;/);
    });
  });

  // ─── Public booking creation ─────────────────────────────────────
  describe('Public booking creation (POST /api/bookings)', () => {
    it('rejects bookings missing required fields', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .send({ staff_id: ALICE_STAFF_ID });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('creates a booking and triggers confirmation email', async () => {
      const { startTime, endTime } = uniqueFutureSlot();
      const emailSpy = jest.spyOn(emailService, 'sendBookingConfirmation');

      const res = await request(app)
        .post('/api/bookings')
        .send({
          staff_id: ALICE_STAFF_ID,
          start_time: startTime,
          end_time: endTime,
          client_name: `Site Test Client ${testRunId}`,
          client_email: `site-create-${testRunId}@example.com`,
          notes: 'Site integration test booking',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(Number),
        staff_id: ALICE_STAFF_ID,
        status: 'confirmed',
        client_name: `Site Test Client ${testRunId}`,
      });
      expect(emailSpy).toHaveBeenCalledTimes(1);
      emailSpy.mockRestore();
    });

    it('returns 409 when booking overlaps an existing slot', async () => {
      const { startTime, endTime } = uniqueFutureSlot();
      const payload = {
        staff_id: ALICE_STAFF_ID,
        start_time: startTime,
        end_time: endTime,
        client_name: 'Overlap Client A',
        client_email: `overlap-a-${testRunId}@example.com`,
      };

      const first = await request(app).post('/api/bookings').send(payload);
      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/api/bookings')
        .send({ ...payload, client_name: 'Overlap Client B', client_email: `overlap-b-${testRunId}@example.com` });

      expect(second.status).toBe(409);
      expect(second.body.code).toBe('BOOKING_OVERLAP');
    });

    it('allows rebooking a slot after soft-cancellation', async () => {
      const { startTime, endTime } = uniqueFutureSlot();

      const created = await request(app)
        .post('/api/bookings')
        .send({
          staff_id: ALICE_STAFF_ID,
          start_time: startTime,
          end_time: endTime,
          client_name: 'Rebook Client',
          client_email: `rebook-${testRunId}@example.com`,
        });
      expect(created.status).toBe(201);

      const cancelled = await request(app)
        .delete(`/api/trainer/bookings/${created.body.id}`)
        .set('Cookie', trainerCookie);
      expect(cancelled.status).toBe(200);

      const rebooked = await request(app)
        .post('/api/bookings')
        .send({
          staff_id: ALICE_STAFF_ID,
          start_time: startTime,
          end_time: endTime,
          client_name: 'Rebook Client 2',
          client_email: `rebook2-${testRunId}@example.com`,
        });
      expect(rebooked.status).toBe(201);
    });
  });

  // ─── Trainer dashboard API ───────────────────────────────────────
  describe('Trainer dashboard API (/api/trainer)', () => {
    let trainerAvailabilityId: number;

    it('requires authentication', async () => {
      const res = await request(app).get('/api/trainer/bookings');
      expect(res.status).toBe(401);
    });

    it('GET /api/trainer/bookings returns only the logged-in trainer upcoming confirmed bookings', async () => {
      const res = await request(app)
        .get('/api/trainer/bookings')
        .set('Cookie', trainerCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const booking of res.body) {
        expect(booking.status).toBe('confirmed');
        expect(new Date(booking.start_time).getTime()).toBeGreaterThanOrEqual(Date.now() - 60000);
      }
    });

    it('GET /api/trainer/bookings?status=cancelled returns cancelled history', async () => {
      const res = await request(app)
        .get('/api/trainer/bookings?status=cancelled')
        .set('Cookie', trainerCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const booking of res.body) {
        expect(booking.status).toBe('cancelled');
      }
    });

    it('POST /api/trainer/availability adds a recurring block for the trainer', async () => {
      const res = await request(app)
        .post('/api/trainer/availability')
        .set('Cookie', trainerCookie)
        .send({ day_of_week: 5, start_time: '10:00', end_time: '12:00' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        day_of_week: 5,
        start_time: expect.any(String),
        end_time: expect.any(String),
      });
      trainerAvailabilityId = res.body.id;
    });

    it('GET /api/trainer/availability lists the trainer blocks', async () => {
      const res = await request(app)
        .get('/api/trainer/availability')
        .set('Cookie', trainerCookie);
      expect(res.status).toBe(200);
      expect(res.body.some((b: { id: number }) => b.id === trainerAvailabilityId)).toBe(true);
    });

    it('DELETE /api/trainer/availability/:id removes the trainer block', async () => {
      const res = await request(app)
        .delete(`/api/trainer/availability/${trainerAvailabilityId}`)
        .set('Cookie', trainerCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/trainer/bookings/:id soft-cancels and sends cancellation email', async () => {
      const { startTime, endTime } = uniqueFutureSlot();
      const created = await request(app)
        .post('/api/bookings')
        .send({
          staff_id: ALICE_STAFF_ID,
          start_time: startTime,
          end_time: endTime,
          client_name: 'Cancel Flow Client',
          client_email: `cancel-flow-${testRunId}@example.com`,
        });
      expect(created.status).toBe(201);

      const emailSpy = jest.spyOn(emailService, 'sendBookingCancellation');
      const cancel = await request(app)
        .delete(`/api/trainer/bookings/${created.body.id}`)
        .set('Cookie', trainerCookie);
      expect(cancel.status).toBe(200);
      expect(emailSpy).toHaveBeenCalledTimes(1);

      const dbCheck = await query(
        'SELECT status, cancelled_at FROM bookings WHERE id = $1',
        [created.body.id]
      );
      expect(dbCheck.rows[0].status).toBe('cancelled');
      expect(dbCheck.rows[0].cancelled_at).not.toBeNull();
      emailSpy.mockRestore();
    });

    it('prevents a trainer from cancelling another trainer booking', async () => {
      const { startTime, endTime } = uniqueFutureSlot();
      const created = await request(app)
        .post('/api/bookings')
        .send({
          staff_id: ALICE_STAFF_ID,
          start_time: startTime,
          end_time: endTime,
          client_name: 'Scoped Cancel Client',
          client_email: `scoped-${testRunId}@example.com`,
        });
      expect(created.status).toBe(201);

      const res = await request(app)
        .delete(`/api/trainer/bookings/${created.body.id}`)
        .set('Cookie', otherTrainerCookie);
      expect(res.status).toBe(404);

      await request(app)
        .delete(`/api/trainer/bookings/${created.body.id}`)
        .set('Cookie', trainerCookie);
    });
  });

  // ─── RBAC ────────────────────────────────────────────────────────
  describe('Role-based access control', () => {
    it('returns 401 for unauthenticated admin route access', async () => {
      const res = await request(app).get('/api/staff');
      expect(res.status).toBe(401);
    });

    it('returns 403 when a trainer hits admin-only routes', async () => {
      for (const path of ['/api/staff', '/api/bookings', '/api/availability']) {
        const res = await request(app).get(path).set('Cookie', trainerCookie);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_ADMIN_ONLY');
      }
    });

    it('allows admin access to protected overview routes', async () => {
      const staff = await request(app).get('/api/staff').set('Cookie', adminCookie);
      expect(staff.status).toBe(200);
      expect(Array.isArray(staff.body)).toBe(true);

      const bookings = await request(app).get('/api/bookings').set('Cookie', adminCookie);
      expect(bookings.status).toBe(200);
      expect(Array.isArray(bookings.body)).toBe(true);

      const availability = await request(app).get('/api/availability').set('Cookie', adminCookie);
      expect(availability.status).toBe(200);
      expect(Array.isArray(availability.body)).toBe(true);
    });
  });

  // ─── Admin management API ────────────────────────────────────────
  describe('Admin management API', () => {
    const newStaffEmail = `admin-created-${Date.now()}@example.com`;
    let createdStaffId: number;
    let adminAvailabilityId: number;

    it('POST /api/staff creates a staff member', async () => {
      const res = await request(app)
        .post('/api/staff')
        .set('Cookie', adminCookie)
        .send({
          name: 'Integration Test Staff',
          email: newStaffEmail,
          role: 'trainer',
          department: 'QA',
        });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe(newStaffEmail);
      createdStaffId = res.body.id;
    });

    it('GET /api/staff/:id returns the created staff member', async () => {
      const res = await request(app)
        .get(`/api/staff/${createdStaffId}`)
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(newStaffEmail);
    });

    it('PUT /api/staff/:id updates the staff member', async () => {
      const res = await request(app)
        .put(`/api/staff/${createdStaffId}`)
        .set('Cookie', adminCookie)
        .send({ department: 'QA Updated' });
      expect(res.status).toBe(200);
      expect(res.body.department).toBe('QA Updated');
    });

    it('GET /api/bookings supports staffId filter for admin overview', async () => {
      const res = await request(app)
        .get(`/api/bookings?staffId=${ALICE_STAFF_ID}`)
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.every((b: { staff_id: number }) => b.staff_id === ALICE_STAFF_ID)).toBe(true);
    });

    it('PUT /api/bookings/:id lets admin soft-cancel a booking', async () => {
      const { startTime, endTime } = uniqueFutureSlot();
      const created = await request(app)
        .post('/api/bookings')
        .send({
          staff_id: ALICE_STAFF_ID,
          start_time: startTime,
          end_time: endTime,
          client_name: 'Admin Cancel Client',
          client_email: `admin-cancel-${testRunId}@example.com`,
        });
      expect(created.status).toBe(201);

      const res = await request(app)
        .put(`/api/bookings/${created.body.id}`)
        .set('Cookie', adminCookie)
        .send({ status: 'cancelled' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
      expect(res.body.cancelled_at).toBeDefined();
    });

    it('POST /api/availability creates availability via admin', async () => {
      const res = await request(app)
        .post('/api/availability')
        .set('Cookie', adminCookie)
        .send({
          staff_id: createdStaffId,
          start_time: '09:00',
          end_time: '12:00',
          day_of_week: 2,
        });
      expect(res.status).toBe(201);
      adminAvailabilityId = res.body.id;
    });

    it('DELETE /api/availability/:id removes admin-created availability', async () => {
      const res = await request(app)
        .delete(`/api/availability/${adminAvailabilityId}`)
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/staff/:id removes the test staff member', async () => {
      const res = await request(app)
        .delete(`/api/staff/${createdStaffId}`)
        .set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Concurrency ─────────────────────────────────────────────────
  describe('Booking concurrency safety', () => {
    it('allows only one winner when two clients book the same slot concurrently', async () => {
      const { startTime, endTime } = uniqueFutureSlot();
      const base = {
        staff_id: ALICE_STAFF_ID,
        start_time: startTime,
        end_time: endTime,
      };

      const [resA, resB] = await Promise.all([
        request(app).post('/api/bookings').send({
          ...base,
          client_name: 'Race A',
          client_email: `race-a-${testRunId}@example.com`,
        }),
        request(app).post('/api/bookings').send({
          ...base,
          client_name: 'Race B',
          client_email: `race-b-${testRunId}@example.com`,
        }),
      ]);

      expect([resA.status, resB.status].sort()).toEqual([201, 409]);
    });
  });
});