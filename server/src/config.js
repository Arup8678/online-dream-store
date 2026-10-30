import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Resolve DB path: use env var if set AND that directory is writable; otherwise fall back to project-local path.
function resolveDbFile() {
  const envPath = process.env.DB_FILE;
  if (envPath) {
    const dir = path.dirname(envPath);
    try { fs.mkdirSync(dir, { recursive: true }); return envPath; } catch { /* fall through */ }
  }
  return path.join(root, 'data', 'dreamplace.db');
}

export const config = {
  root,
  port: Number(process.env.PORT || 4000),
  dbFile: resolveDbFile(),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  publicDir: path.join(root, 'public'),
  // Secret used to sign login cookies. Set JWT_SECRET in .env for production.
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtFromEnv: Boolean(process.env.JWT_SECRET),
  isProd: process.env.NODE_ENV === 'production',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@dreamplace.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
};
