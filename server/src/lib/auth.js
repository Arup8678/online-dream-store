import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

// Customers and admins use different cookies so the two apps never share a session.
export const COOKIES = { customer: 'nn_session', admin: 'nn_admin_session' };

export function signIn(res, user, kind) {
  const token = jwt.sign({ uid: user.id, role: user.role }, config.jwtSecret, { expiresIn: kind === 'admin' ? '12h' : '30d' });
  res.cookie(COOKIES[kind], token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd && process.env.COOKIE_SECURE === '1',
    maxAge: (kind === 'admin' ? 12 : 24 * 30) * 3600 * 1000,
    path: '/',
  });
}

export function signOut(res, kind) {
  res.clearCookie(COOKIES[kind], { path: '/' });
}

function load(req, kind) {
  const token = req.cookies?.[COOKIES[kind]];
  if (!token) return null;
  try {
    const { uid } = jwt.verify(token, config.jwtSecret);
    return db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(uid) || null;
  } catch {
    return null;
  }
}

export const attachCustomer = (req, _res, next) => {
  req.user = load(req, 'customer');
  next();
};

export const requireCustomer = (req, res, next) => {
  req.user = load(req, 'customer');
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  next();
};

export const requireAdmin = (req, res, next) => {
  const u = load(req, 'admin');
  if (!u || u.role !== 'admin') return res.status(401).json({ error: 'Admin login required.' });
  req.admin = u;
  next();
};
