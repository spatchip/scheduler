import request from 'supertest';
import { Express } from 'express';

export function extractAuthCookie(headers: request.Response['headers']): string {
  const rawCookies = headers['set-cookie'];
  if (!rawCookies) return '';
  return Array.isArray(rawCookies)
    ? rawCookies.map((c: string) => c.split(';')[0]).join('; ')
    : rawCookies.split(';')[0];
}

export async function login(
  app: Express,
  email: string,
  password: string
): Promise<{ cookie: string; user: Record<string, unknown> }> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  expect(res.status).toBe(200);
  expect(res.body.user).toBeDefined();

  const cookie = extractAuthCookie(res.headers);
  expect(cookie).toContain('auth_token');

  return { cookie, user: res.body.user };
}