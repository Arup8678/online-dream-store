import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { db } from './db.js';
import { ensureAdmin } from './bootstrap.js';
import catalog from './routes/catalog.js';
import shop from './routes/shop.js';
import admin from './routes/admin.js';

export function createApp() {
  ensureAdmin();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false, // SPA bundles load map tiles / fonts from CDNs; tighten when deploying
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const limiter = (windowMs, max) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, please try again in a moment.' } });
  app.use('/api/auth/login', limiter(15 * 60_000, 30));
  app.use('/api/admin/auth/login', limiter(15 * 60_000, 20));
  app.use('/api/auth/register', limiter(60 * 60_000, 20));
  app.use('/api/contact', limiter(60 * 60_000, 15));
  const orderLimiter = limiter(60_000, 30);
  app.use('/api/orders', (req, res, next) => (req.method === 'POST' ? orderLimiter(req, res, next) : next()));

  app.use('/art', express.static(path.join(config.publicDir, 'art'), { maxAge: '7d' }));
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/admin', admin);
  app.use('/api', catalog);
  app.use('/api', shop);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Built front-ends (npm run build). Admin lives under /admin, storefront at /.
  const adminDist = path.resolve(config.root, '../admin/dist');
  const webDist = path.resolve(config.root, '../web/dist');
  const spa = (dir, prefix = '/') => {
    if (!fs.existsSync(dir)) return;
    app.use(prefix, express.static(dir, { maxAge: '1h', index: false }));
    app.get(prefix === '/' ? '/{*splat}' : `${prefix}{/*splat}`, (_req, res) => res.sendFile(path.join(dir, 'index.html')));
  };
  spa(adminDist, '/admin');
  spa(webDist, '/');

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return res.status(400).json({ error: first?.message || 'Invalid input', field: first?.path?.join('.'), issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large (max 25 MB).' });
    if (err.status) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });
  return app;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const count = db.prepare('SELECT COUNT(*) n FROM products').get().n;
  if (count === 0) console.log('⚠  No products yet — run `npm run seed` to load the demo catalog.');
  if (!config.jwtFromEnv) console.log('ℹ  JWT_SECRET not set: logins reset on every restart. Set it in server/.env');
  createApp().listen(config.port, () => console.log(`Dream Palace API on http://localhost:${config.port}`));
}
