import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, getSettings, setSettings, DEFAULT_SETTINGS } from '../db.js';
import { config } from '../config.js';
import { wrap, HttpError, slugify, bool } from '../lib/util.js';
import { requireAdmin, signIn, signOut } from '../lib/auth.js';
import { shapeProduct, PRODUCT_SELECT, recalcRating } from '../lib/products.js';
import { hydrate, changeStatus, ORDER_STATUSES, PAYMENT_STATUSES, addEvent } from '../lib/orders.js';

const r = Router();

// ---------- auth ----------
r.post('/auth/login', wrap((req, res) => {
  const b = z.object({ email: z.string().trim(), password: z.string() }).parse(req.body);
  const u = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'").get(b.email);
  if (!u || !bcrypt.compareSync(b.password, u.password_hash)) throw new HttpError(401, 'Incorrect email or password.');
  signIn(res, u, 'admin');
  res.json({ user: { id: u.id, name: u.name, email: u.email } });
}));
r.post('/auth/logout', (_req, res) => { signOut(res, 'admin'); res.json({ ok: true }); });
r.get('/auth/me', requireAdmin, (req, res) => res.json({ user: req.admin }));

// everything below needs an admin session
r.use(requireAdmin);

r.put('/auth/password', wrap((req, res) => {
  const b = z.object({ current: z.string(), next: z.string().min(8, 'Use at least 8 characters').max(100) }).parse(req.body);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(b.current, u.password_hash)) throw new HttpError(400, 'Current password is incorrect.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(b.next, 10), u.id);
  res.json({ ok: true });
}));

// ---------- dashboard ----------
r.get('/dashboard', (_req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const live = "order_status != 'CANCELLED'";
  const stats = {
    ordersToday: one(`SELECT COUNT(*) n FROM orders WHERE date(created_at) = date('now','localtime')`).n,
    revenueToday: one(`SELECT COALESCE(SUM(total),0) v FROM orders WHERE ${live} AND date(created_at) = date('now','localtime')`).v,
    revenueTotal: one(`SELECT COALESCE(SUM(total),0) v FROM orders WHERE ${live}`).v,
    ordersTotal: one('SELECT COUNT(*) n FROM orders').n,
    newOrders: one("SELECT COUNT(*) n FROM orders WHERE order_status = 'NEW'").n,
    pendingDelivery: one("SELECT COUNT(*) n FROM orders WHERE order_status IN ('CONFIRMED','PREPARING','OUT_FOR_DELIVERY')").n,
    customers: one("SELECT COUNT(*) n FROM users WHERE role = 'customer'").n,
    products: one('SELECT COUNT(*) n FROM products WHERE active = 1').n,
    freeDeliveries: one(`SELECT COUNT(*) n FROM orders WHERE ${live} AND within_free_zone = 1`).n,
    paidDeliveries: one(`SELECT COUNT(*) n FROM orders WHERE ${live} AND within_free_zone = 0`).n,
    unreadMessages: one('SELECT COUNT(*) n FROM messages WHERE handled = 0').n,
    pendingReviews: one('SELECT COUNT(*) n FROM reviews WHERE approved = 0').n,
  };
  const days = db.prepare(`
    WITH RECURSIVE d(day) AS (SELECT date('now','localtime','-6 days') UNION ALL SELECT date(day,'+1 day') FROM d WHERE day < date('now','localtime'))
    SELECT d.day, COALESCE(SUM(o.total),0) revenue, COUNT(o.id) orders
    FROM d LEFT JOIN orders o ON date(o.created_at,'localtime') = d.day AND o.order_status != 'CANCELLED' GROUP BY d.day ORDER BY d.day`).all();
  const byStatus = db.prepare('SELECT order_status s, COUNT(*) n FROM orders GROUP BY 1').all();
  const lowStock = db.prepare('SELECT id, name, sku, stock FROM products WHERE active = 1 AND stock <= 5 ORDER BY stock, name LIMIT 10').all();
  const top = db.prepare(`SELECT p.id, p.name, SUM(i.quantity) sold, SUM(i.quantity*i.unit_price) revenue FROM order_items i JOIN products p ON p.id = i.product_id
    JOIN orders o ON o.id = i.order_id WHERE o.order_status != 'CANCELLED' GROUP BY p.id ORDER BY sold DESC LIMIT 5`).all();
  const recent = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8').all().map(hydrate);
  res.json({ stats, days, byStatus, lowStock, top, recent });
});

// ---------- products ----------
const productSchema = z.object({
  sku: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(160),
  description: z.string().max(5000).default(''),
  categoryId: z.number().int().nullable(),
  subcategoryId: z.number().int().nullable().default(null),
  price: z.number().positive().max(10_000_000),
  discountPrice: z.number().positive().nullable().default(null),
  stock: z.number().int().min(0).max(1_000_000),
  images: z.array(z.string().max(500)).max(12).default([]),
  videoUrl: z.string().trim().max(500).default(''),
  brand: z.string().trim().max(60).default(''),
  size: z.string().trim().max(60).default(''),
  color: z.string().trim().max(60).default(''),
  ageGroup: z.string().trim().max(40).default('All ages'),
  specs: z.record(z.string(), z.string()).default({}),
  featured: z.boolean().default(false),
  bestSeller: z.boolean().default(false),
  newArrival: z.boolean().default(false),
  active: z.boolean().default(true),
}).refine((p) => p.discountPrice == null || p.discountPrice < p.price, { message: 'Discount price must be lower than the price', path: ['discountPrice'] });

function uniqueSlug(name, exceptId = 0) {
  const base = slugify(name) || 'product';
  let slug = base, n = 2;
  while (db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(slug, exceptId)) slug = `${base}-${n++}`;
  return slug;
}

const productRow = (id) => db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id);

r.get('/products', wrap((req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const where = ['1=1'], params = [];
  if (q) { where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (req.query.category) { where.push('p.category_id = ?'); params.push(Number(req.query.category)); }
  if (req.query.status === 'active') where.push('p.active = 1');
  if (req.query.status === 'inactive') where.push('p.active = 0');
  if (req.query.stock === 'low') where.push('p.stock <= 5');
  const total = db.prepare(`SELECT COUNT(*) n FROM products p WHERE ${where.join(' AND ')}`).get(...params).n;
  const rows = db.prepare(`${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
  res.json({ items: rows.map(shapeProduct), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

r.get('/products/:id', wrap((req, res) => {
  const row = productRow(Number(req.params.id));
  if (!row) throw new HttpError(404, 'Product not found');
  res.json(shapeProduct(row));
}));

function writeProduct(p, id) {
  const sku = p.sku.toUpperCase();
  if (db.prepare('SELECT 1 FROM products WHERE sku = ? AND id != ?').get(sku, id || 0)) throw new HttpError(409, `SKU ${sku} is already used by another product.`);
  const cols = [sku, p.name, p.description, p.categoryId, p.subcategoryId, p.price, p.discountPrice, p.stock, JSON.stringify(p.images), p.videoUrl, p.brand, p.size, p.color, p.ageGroup, JSON.stringify(p.specs), bool(p.featured), bool(p.bestSeller), bool(p.newArrival), bool(p.active)];
  if (id) {
    db.prepare(`UPDATE products SET sku=?, name=?, description=?, category_id=?, subcategory_id=?, price=?, discount_price=?, stock=?, images=?, video_url=?, brand=?, size=?, color=?, age_group=?, specs=?, featured=?, best_seller=?, new_arrival=?, active=?, updated_at=datetime('now') WHERE id=?`).run(...cols, id);
    return id;
  }
  const info = db.prepare(`INSERT INTO products (sku,name,description,category_id,subcategory_id,price,discount_price,stock,images,video_url,brand,size,color,age_group,specs,featured,best_seller,new_arrival,active,slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...cols, uniqueSlug(p.name));
  return Number(info.lastInsertRowid);
}

r.post('/products', wrap((req, res) => {
  const id = writeProduct(productSchema.parse(req.body));
  res.status(201).json(shapeProduct(productRow(id)));
}));

r.put('/products/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  if (!productRow(id)) throw new HttpError(404, 'Product not found');
  writeProduct(productSchema.parse(req.body), id);
  res.json(shapeProduct(productRow(id)));
}));

r.patch('/products/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  const b = z.object({ active: z.boolean().optional(), stock: z.number().int().min(0).optional(), featured: z.boolean().optional(), bestSeller: z.boolean().optional(), newArrival: z.boolean().optional() }).parse(req.body);
  const map = { active: 'active', stock: 'stock', featured: 'featured', bestSeller: 'best_seller', newArrival: 'new_arrival' };
  for (const [k, v] of Object.entries(b)) db.prepare(`UPDATE products SET ${map[k]} = ?, updated_at = datetime('now') WHERE id = ?`).run(typeof v === 'boolean' ? bool(v) : v, id);
  res.json(shapeProduct(productRow(id)));
}));

r.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- categories ----------
const catSchema = z.object({
  name: z.string().trim().min(2).max(60), parentId: z.number().int().nullable().default(null),
  icon: z.string().max(8).default('✨'), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7c5cff'),
  description: z.string().max(300).default(''), sortOrder: z.number().int().default(0), active: z.boolean().default(true),
});
const shapeCat = (c) => ({ id: c.id, parentId: c.parent_id, slug: c.slug, name: c.name, icon: c.icon, accent: c.accent, description: c.description, sortOrder: c.sort_order, active: !!c.active, productCount: c.n });

r.get('/categories', (_req, res) => {
  res.json(db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id OR p.subcategory_id = c.id) n FROM categories c ORDER BY COALESCE(parent_id, id), parent_id IS NOT NULL, sort_order, name`).all().map(shapeCat));
});
r.post('/categories', wrap((req, res) => {
  const c = catSchema.parse(req.body);
  let slug = slugify(c.name), n = 2;
  while (db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) slug = `${slugify(c.name)}-${n++}`;
  const info = db.prepare('INSERT INTO categories (parent_id,slug,name,icon,accent,description,sort_order,active) VALUES (?,?,?,?,?,?,?,?)').run(c.parentId, slug, c.name, c.icon, c.accent, c.description, c.sortOrder, bool(c.active));
  res.status(201).json({ id: Number(info.lastInsertRowid) });
}));
r.put('/categories/:id', wrap((req, res) => {
  const c = catSchema.parse(req.body);
  const id = Number(req.params.id);
  if (c.parentId === id) throw new HttpError(400, 'A category cannot be its own parent.');
  db.prepare('UPDATE categories SET parent_id=?, name=?, icon=?, accent=?, description=?, sort_order=?, active=? WHERE id=?').run(c.parentId, c.name, c.icon, c.accent, c.description, c.sortOrder, bool(c.active), id);
  res.json({ ok: true });
}));
r.delete('/categories/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare('SELECT COUNT(*) n FROM products WHERE category_id = ? OR subcategory_id = ?').get(id, id).n;
  if (used) throw new HttpError(409, `This category still has ${used} product(s). Move or delete them first, or just hide the category.`);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
}));

// ---------- orders ----------
r.get('/orders', wrap((req, res) => {
  const where = ['1=1'], params = [];
  if (req.query.status && ORDER_STATUSES.includes(String(req.query.status))) { where.push('order_status = ?'); params.push(req.query.status); }
  if (req.query.payment && PAYMENT_STATUSES.includes(String(req.query.payment))) { where.push('payment_status = ?'); params.push(req.query.payment); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(order_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const total = db.prepare(`SELECT COUNT(*) n FROM orders WHERE ${where.join(' AND ')}`).get(...params).n;
  const rows = db.prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
  res.json({ items: rows.map(hydrate), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));
r.get('/orders/:id', wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!o) throw new HttpError(404, 'Order not found');
  res.json(hydrate(o));
}));
r.put('/orders/:id/status', wrap((req, res) => {
  const b = z.object({ status: z.enum(ORDER_STATUSES), note: z.string().max(200).default('') }).parse(req.body);
  res.json(changeStatus(Number(req.params.id), b.status, b.note));
}));
r.put('/orders/:id/payment', wrap((req, res) => {
  const b = z.object({ paymentStatus: z.enum(PAYMENT_STATUSES) }).parse(req.body);
  const id = Number(req.params.id);
  db.prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(b.paymentStatus, id);
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  addEvent(id, o.order_status, `Payment marked ${b.paymentStatus}`);
  res.json(hydrate(o));
}));
r.put('/orders/:id/note', wrap((req, res) => {
  const b = z.object({ note: z.string().max(500) }).parse(req.body);
  db.prepare("UPDATE orders SET admin_note = ?, updated_at = datetime('now') WHERE id = ?").run(b.note, Number(req.params.id));
  res.json({ ok: true });
}));

// ---------- customers ----------
r.get('/customers', (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) orders,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.order_status != 'CANCELLED') spent
    FROM users u WHERE u.role = 'customer' AND (? = '' OR u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?) ORDER BY u.id DESC LIMIT 200`).all(q, `%${q}%`, `%${q}%`, `%${q}%`);
  res.json(rows);
});

// ---------- reviews, messages, subscribers ----------
r.get('/reviews', (_req, res) => {
  res.json(db.prepare(`SELECT r.*, p.name product FROM reviews r JOIN products p ON p.id = r.product_id ORDER BY r.approved, r.id DESC LIMIT 200`).all());
});
r.put('/reviews/:id', wrap((req, res) => {
  const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
  const rev = db.prepare('SELECT product_id FROM reviews WHERE id = ?').get(Number(req.params.id));
  db.prepare('UPDATE reviews SET approved = ? WHERE id = ?').run(bool(approved), Number(req.params.id));
  if (rev) recalcRating(rev.product_id);
  res.json({ ok: true });
}));
r.delete('/reviews/:id', (req, res) => {
  const rev = db.prepare('SELECT product_id FROM reviews WHERE id = ?').get(Number(req.params.id));
  db.prepare('DELETE FROM reviews WHERE id = ?').run(Number(req.params.id));
  if (rev) recalcRating(rev.product_id);
  res.json({ ok: true });
});
r.get('/messages', (_req, res) => res.json(db.prepare('SELECT * FROM messages ORDER BY handled, id DESC LIMIT 200').all()));
r.put('/messages/:id', (req, res) => {
  db.prepare('UPDATE messages SET handled = ? WHERE id = ?').run(bool(req.body.handled), Number(req.params.id));
  res.json({ ok: true });
});
r.get('/subscribers', (_req, res) => res.json(db.prepare('SELECT * FROM subscribers ORDER BY id DESC LIMIT 500').all()));

// ---------- offers ----------
const offerSchema = z.object({
  title: z.string().trim().min(2).max(80), subtitle: z.string().max(200).default(''), badge: z.string().max(30).default(''),
  link: z.string().max(200).default('/shop'), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#7c5cff'),
  active: z.boolean().default(true), sortOrder: z.number().int().default(0),
});
r.get('/offers', (_req, res) => res.json(db.prepare('SELECT * FROM offers ORDER BY sort_order, id').all()));
r.post('/offers', wrap((req, res) => {
  const o = offerSchema.parse(req.body);
  db.prepare('INSERT INTO offers (title,subtitle,badge,link,accent,active,sort_order) VALUES (?,?,?,?,?,?,?)').run(o.title, o.subtitle, o.badge, o.link, o.accent, bool(o.active), o.sortOrder);
  res.status(201).json({ ok: true });
}));
r.put('/offers/:id', wrap((req, res) => {
  const o = offerSchema.parse(req.body);
  db.prepare('UPDATE offers SET title=?,subtitle=?,badge=?,link=?,accent=?,active=?,sort_order=? WHERE id=?').run(o.title, o.subtitle, o.badge, o.link, o.accent, bool(o.active), o.sortOrder, Number(req.params.id));
  res.json({ ok: true });
}));
r.delete('/offers/:id', (req, res) => { db.prepare('DELETE FROM offers WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });

// ---------- settings ----------
r.get('/settings', (_req, res) => res.json(getSettings()));
r.put('/settings', wrap((req, res) => {
  const b = z.object({
    brand_name: z.string().trim().min(1).max(40), tagline: z.string().max(120), shop_address: z.string().max(240),
    shop_lat: z.coerce.number().min(-90).max(90), shop_lng: z.coerce.number().min(-180).max(180),
    free_radius_km: z.coerce.number().min(0).max(200), outside_fee_flat: z.coerce.number().min(0).max(10000),
    outside_fee_per_km: z.coerce.number().min(0).max(1000), max_delivery_km: z.coerce.number().min(0).max(500),
    contact_phone: z.string().max(40), contact_email: z.string().max(120), whatsapp_number: z.string().max(20).regex(/^\d*$/, 'WhatsApp number: digits only, with country code'),
    opening_hours: z.string().max(160), cod_enabled: z.coerce.boolean(), online_enabled: z.coerce.boolean(),
  }).partial().parse(req.body);
  const clean = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? '1' : '0') : v]));
  if (!Object.keys(clean).every((k) => k in DEFAULT_SETTINGS)) throw new HttpError(400, 'Unknown setting');
  setSettings(clean);
  res.json(getSettings());
}));

// ---------- uploads ----------
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm' };
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ALLOWED[file.mimetype] || path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG, WebP, GIF, MP4 or WebM files are allowed.'))),
});
r.post('/upload', upload.array('files', 8), (req, res) => {
  res.status(201).json({ files: (req.files || []).map((f) => `/uploads/${f.filename}`) });
});

export default r;
