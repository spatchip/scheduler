import request from 'supertest';
import app from '../index';
import { closePool } from '../db';

describe('RBAC admin route protection (Integration)', () => {
  let trainerCookie: string;
  const trainerEmail = 'alice.chen@example.com';
  const trainerPassword = 'password123';

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: trainerEmail, password: trainerPassword });

    expect(loginRes.status).toBe(200);

    const rawCookies = loginRes.headers['set-cookie'];
    if (rawCookies) {
      trainerCookie = Array.isArray(rawCookies)
        ? rawCookies.map((c: string) => c.split(';')[0]).join('; ')
        : rawCookies.split(';')[0];
    } else {
      trainerCookie = '';
    }
    expect(trainerCookie).toContain('auth_token');
  });

  it('should return 403 when a standard trainer attempts to access an admin-only staff route', async () => {
    const res = await request(app)
      .get('/api/staff')
      .set('Cookie', trainerCookie);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: expect.stringMatching(/admin access required/i),
      code: 'FORBIDDEN_ADMIN_ONLY',
    });
  });

  it('should return 403 when a standard trainer attempts to access the admin bookings overview', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Cookie', trainerCookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ADMIN_ONLY');
  });

  it('should return 403 when a standard trainer attempts to access the admin availability overview', async () => {
    const res = await request(app)
      .get('/api/availability')
      .set('Cookie', trainerCookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ADMIN_ONLY');
  });

  afterAll(async () => {
    await closePool();
  });
});