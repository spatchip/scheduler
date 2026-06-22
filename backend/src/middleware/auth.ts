import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser'; // will be used in index
import { query } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role?: string | null;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return (role || '').toLowerCase() === 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Support both httpOnly cookie and Authorization: Bearer header (for flexibility)
  const tokenFromCookie = req.cookies?.auth_token;
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Attach minimal user info
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role ?? null,
    };
    next();
  });
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await query<{ role: string | null }>(
      'SELECT role FROM staff WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const role = result.rows[0].role;
    if (!isAdminRole(role)) {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'FORBIDDEN_ADMIN_ONLY',
      });
    }

    req.user.role = role;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

export function generateToken(user: { id: number; email: string; name: string; role?: string | null }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role ?? null },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
