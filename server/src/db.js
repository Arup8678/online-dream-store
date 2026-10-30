import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

const rawDb = new DatabaseSync(config.dbFile);
rawDb.exec('PRAGMA journal_mode = WAL');
rawDb.exec('PRAGMA foreign_keys = ON');

let inTx = false;
export const db = {
  exec(sql) { return rawDb.exec(sql); },
  prepare(sql) { return rawDb.prepare(sql); },
  pragma(str) { return rawDb.exec(`PRAGMA ${str}`); },
  transaction(fn) {
    return function (...args) {
      if (inTx) return fn.apply(this, args);
      inTx = true;
      rawDb.exec('BEGIN');
      try {
        const res = fn.apply(this, args);
        rawDb.exec('COMMIT');
        return res;
      } catch (err) {
        try { rawDb.exec('ROLLBACK'); } catch {}
        throw err;
      } finally {
        inTx = false;
      }
    };
  },
  close() { return rawDb.close(); }
};

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '✨',
  accent TEXT DEFAULT '#7c5cff',
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  subcategory_id INTEGER REFERENCES categories(id),
  price REAL NOT NULL,
  discount_price REAL,
  stock INTEGER NOT NULL DEFAULT 0,
  images TEXT NOT NULL DEFAULT '[]',
  video_url TEXT DEFAULT '',
  brand TEXT DEFAULT '',
  size TEXT DEFAULT '',
  color TEXT DEFAULT '',
  age_group TEXT DEFAULT 'All ages',
  specs TEXT NOT NULL DEFAULT '{}',
  featured INTEGER DEFAULT 0,
  best_seller INTEGER DEFAULT 0,
  new_arrival INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  sold_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id, subcategory_id);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  name TEXT, phone TEXT,
  house TEXT, address TEXT, area TEXT, landmark TEXT, pincode TEXT,
  lat REAL, lng REAL,
  is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  address_house TEXT, address_line TEXT, address_area TEXT,
  address_landmark TEXT, address_pincode TEXT,
  delivery_lat REAL, delivery_lng REAL,
  delivery_instructions TEXT DEFAULT '',
  distance_km REAL,
  within_free_zone INTEGER DEFAULT 1,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  delivery_charge REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_ref TEXT DEFAULT '',
  gateway_order_id TEXT DEFAULT '',
  order_status TEXT NOT NULL DEFAULT 'NEW',
  admin_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  image TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  list_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  approved INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT, phone TEXT, subject TEXT, body TEXT,
  handled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  link TEXT DEFAULT '/shop',
  accent TEXT DEFAULT '#7c5cff',
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);
`);

export const DEFAULT_SETTINGS = {
  brand_name: 'Dream Palace',
  tagline: 'Everything for School, Play & More.',
  shop_address: 'Main Market, New Delhi (edit in Admin → Settings)',
  shop_lat: '28.6315',
  shop_lng: '77.2167',
  free_radius_km: '5',
  outside_fee_flat: '40',
  outside_fee_per_km: '8',
  max_delivery_km: '15',
  contact_phone: '+91 70473 71680',
  contact_email: 'hello@dreamplace.local',
  whatsapp_number: '917047371680',
  opening_hours: 'Mon–Sat 9:00 AM – 9:00 PM · Sun 10:00 AM – 6:00 PM',
  cod_enabled: '1',
  online_enabled: '1',
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);
// one-time rename: the brand is spelled "Dream Palace" (only touches rows still holding the old default)
db.prepare("UPDATE settings SET value='Dream Palace' WHERE key='brand_name' AND value='Dream Place'").run();
db.prepare("UPDATE products SET brand='Dream Palace' WHERE brand='Dream Place'").run();

export function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

export function setSettings(obj) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(obj)) if (k in DEFAULT_SETTINGS) stmt.run(k, String(v));
  })();
}
