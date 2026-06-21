import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { generateToken } from '../middleware/auth';
import cookieParser from 'cookie-parser';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const router = Router();

// Use cookie parser for this router (also applied globally in index)
router.use(cookieParser());

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, name, email, password FROM staff WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const staff = result.rows[0];

    if (!staff.password) {
      return res.status(401).json({ error: 'Account not configured for login' });
    }

    const match = await bcrypt.compare(password, staff.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: staff.id,
      email: staff.email,
      name: staff.name,
    });

    // Set httpOnly cookie (secure in prod)
    // Cookie settings for both same-origin dev and cross-origin prod (Vercel frontend + Render/etc backend)
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProd,           // Required for sameSite=none
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return user info (no password or token in body for security)
    res.json({
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
      },
      message: 'Login successful',
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - get current logged in user
router.get('/me', async (req: Request, res: Response) => {
  // The authenticateToken middleware will be applied in index for protected paths,
  // but for /me we can also read directly here for simplicity in some flows.
  // To keep consistent, we'll use a lightweight check.
  const tokenFromCookie = req.cookies?.auth_token;
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);

    // Optionally re-fetch fresh data
    const result = await query('SELECT id, name, email, role, department FROM staff WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

export default router;
