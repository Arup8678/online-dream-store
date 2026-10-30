import { Router } from 'express';
import { z } from 'zod';
import { db, getSettings } from '../db.js';
import { wrap, HttpError } from '../lib/util.js';
import { shapeProduct, PRODUCT_SELECT, recalcRating } from '../lib/products.js';
import { attachCustomer } from '../lib/auth.js';
import { razorpayLive } from '../lib/payments.js';

const r = Router();

const PUBLIC_SETTINGS = [
  'brand_name', 'tagline', 'shop_address', 'shop_lat', 'shop_lng', 'free_radius_km', 'outside_fee_flat',
  'outside_fee_per_km', 'max_delivery_km', 'contact_phone', 'contact_email', 'whatsapp_number',
  'opening_hours', 'cod_enabled', 'online_enabled',
];

r.get('/settings', (_req, res) => {
  const s = getSettings();
  const out = {};
  for (const k of PUBLIC_SETTINGS) out[k] = s[k];
  out.razorpay_live = razorpayLive();
  res.json(out);
});

r.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name').all();
  const counts = db.prepare('SELECT category_id c, subcategory_id s, COUNT(*) n FROM products WHERE active = 1 GROUP BY 1,2').all();
  const total = (id) => counts.filter((x) => x.c === id).reduce((a, x) => a + x.n, 0);
  const shape = (c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, accent: c.accent, description: c.description, parentId: c.parent_id });
  const top = rows.filter((c) => !c.parent_id).map((c) => ({
    ...shape(c),
    productCount: c.slug === 'new-arrivals'
      ? db.prepare('SELECT COUNT(*) n FROM products WHERE active = 1 AND new_arrival = 1').get().n
      : total(c.id),
    children: rows.filter((s) => s.parent_id === c.id).map((s) => ({ ...shape(s), productCount: counts.filter((x) => x.s === s.id).reduce((a, x) => a + x.n, 0) })),
  }));
  res.json(top);
});

// ---------- product listing / search ----------

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(), // slug of category or subcategory
  brand: z.string().optional(), // comma separated
  age: z.string().optional(), // comma separated
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.enum(['0', '1']).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['popular', 'newest', 'price_asc', 'price_desc', 'rating']).default('popular'),
  featured: z.enum(['0', '1']).optional(),
  bestSeller: z.enum(['0', '1']).optional(),
  newArrival: z.enum(['0', '1']).optional(),
  onSale: z.enum(['0', '1']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
});

const csv = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const likeEsc = (t) => `%${t.replace(/[\\%_]/g, (m) => '\\' + m)}%`;

/** Builds WHERE clause + params. `skip` lets us compute facet counts without a given filter. */
function buildWhere(q, skip = []) {
  const where = ['p.active = 1'];
  const params = [];
  if (q.q && !skip.includes('q')) {
    // every word must match somewhere (name, category, brand, SKU, description)
    for (const tok of q.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      where.push(`(p.name LIKE @t ESCAPE '\\' OR p.brand LIKE @t ESCAPE '\\' OR p.sku LIKE @t ESCAPE '\\' OR p.description LIKE @t ESCAPE '\\' OR c.name LIKE @t ESCAPE '\\' OR s.name LIKE @t ESCAPE '\\' OR p.color LIKE @t ESCAPE '\\')`.replace(/@t/g, '?'));
      params.push(...Array(7).fill(likeEsc(tok)));
    }
  }
  if (q.category && !skip.includes('category')) {
    if (q.category === 'new-arrivals') where.push('p.new_arrival = 1');
    else {
      where.push('(c.slug = ? OR s.slug = ?)');
      params.push(q.category, q.category);
    }
  }
  const brands = csv(q.brand);
  if (brands.length && !skip.includes('brand')) {
    where.push(`p.brand IN (${brands.map(() => '?').join(',')})`);
    params.push(...brands);
  }
  const ages = csv(q.age);
  if (ages.length && !skip.includes('age')) {
    where.push(`p.age_group IN (${ages.map(() => '?').join(',')})`);
    params.push(...ages);
  }
  if (q.minPrice != null && !skip.includes('price')) { where.push('eff_price >= ?'); params.push(q.minPrice); }
  if (q.maxPrice != null && !skip.includes('price')) { where.push('eff_price <= ?'); params.push(q.maxPrice); }
  if (q.inStock === '1' && !skip.includes('inStock')) where.push('p.stock > 0');
  if (q.minRating && !skip.includes('rating')) { where.push('p.rating_avg >= ?'); params.push(q.minRating); }
  if (q.featured === '1') where.push('p.featured = 1');
  if (q.bestSeller === '1') where.push('p.best_seller = 1');
  if (q.newArrival === '1') where.push('p.new_arrival = 1');
  if (q.onSale === '1') where.push('p.discount_price > 0 AND p.discount_price < p.price');
  return { sql: where.join(' AND '), params };
}

const ORDER = {
  popular: 'p.sold_count DESC, p.rating_avg DESC, p.id DESC',
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'eff_price ASC',
  price_desc: 'eff_price DESC',
  rating: 'p.rating_avg DESC, p.rating_count DESC',
};

// Wrap the select so `eff_price` is usable in WHERE.
const FROM = `FROM (${PRODUCT_SELECT}) p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN categories s ON s.id = p.subcategory_id`;

r.get('/products', wrap((req, res) => {
  const q = listQuery.parse(req.query);
  const { sql, params } = buildWhere(q);
  let order = ORDER[q.sort];
  if (q.q && q.sort === 'popular') {
    // relevance first: name hit > brand/sku hit > rest
    order = `(CASE WHEN p.name LIKE ? ESCAPE '\\' THEN 0 WHEN p.sku LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END), ${order}`;
  }
  const orderParams = q.q && q.sort === 'popular' ? [likeEsc(q.q), likeEsc(q.q), likeEsc(q.q)] : [];
  const total = db.prepare(`SELECT COUNT(*) n ${FROM} WHERE ${sql}`).get(...params).n;
  const rows = db.prepare(`SELECT p.* ${FROM} WHERE ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, ...orderParams, q.limit, (q.page - 1) * q.limit);

  // Facets: brand / age lists respect all other filters; price range ignores price.
  const fw = buildWhere(q, ['brand', 'age', 'price']);
  const brands = db.prepare(`SELECT p.brand v, COUNT(*) n ${FROM} WHERE ${fw.sql} AND p.brand != '' GROUP BY p.brand ORDER BY n DESC, v`).all(...fw.params);
  const ages = db.prepare(`SELECT p.age_group v, COUNT(*) n ${FROM} WHERE ${fw.sql} GROUP BY p.age_group ORDER BY v`).all(...fw.params);
  const pr = db.prepare(`SELECT MIN(eff_price) lo, MAX(eff_price) hi ${FROM} WHERE ${fw.sql}`).get(...fw.params);

  res.json({
    items: rows.map(shapeProduct),
    total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)),
    facets: { brands, ages, priceMin: Math.floor(pr.lo || 0), priceMax: Math.ceil(pr.hi || 0) },
  });
}));

r.get('/products/:slug', wrap((req, res) => {
  const row = db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.active = 1`).get(req.params.slug);
  if (!row) throw new HttpError(404, 'Product not found');
  const related = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.id != ? AND (p.subcategory_id = ? OR p.category_id = ?)
    ORDER BY (p.subcategory_id = ?) DESC, p.sold_count DESC LIMIT 8`).all(row.id, row.subcategory_id, row.category_id, row.subcategory_id);
  res.json({ product: shapeProduct(row), related: related.map(shapeProduct) });
}));

/** Cart helper: fresh price/stock for a list of ids */
r.post('/products/lookup', wrap((req, res) => {
  const ids = z.array(z.number().int()).max(100).parse(req.body.ids);
  if (!ids.length) return res.json([]);
  const rows = db.prepare(`${PRODUCT_SELECT} WHERE p.id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  res.json(rows.map(shapeProduct));
}));

// ---------- suggestions ----------
r.get('/search/suggest', wrap((req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 1) return res.json({ products: [], categories: [], brands: [] });
  const like = likeEsc(q);
  const products = db.prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND (p.name LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.brand LIKE ? ESCAPE '\\')
    ORDER BY (p.name LIKE ? ESCAPE '\\') DESC, p.sold_count DESC LIMIT 6`).all(like, like, like, `${q}%`.replace(/[\\%_]/g, (m) => '\\' + m));
  const categories = db.prepare(`SELECT slug, name, icon FROM categories WHERE active = 1 AND name LIKE ? ESCAPE '\\' LIMIT 4`).all(like);
  const brands = db.prepare(`SELECT DISTINCT brand FROM products WHERE active = 1 AND brand LIKE ? ESCAPE '\\' LIMIT 4`).all(like).map((b) => b.brand);
  res.json({
    products: products.map((p) => { const s = shapeProduct(p); return { id: s.id, slug: s.slug, name: s.name, image: s.images[0], price: s.salePrice, category: s.categoryName }; }),
    categories, brands,
  });
}));

r.get('/search/popular', (_req, res) => {
  const rows = db.prepare('SELECT name FROM products WHERE active = 1 ORDER BY sold_count DESC LIMIT 6').all();
  res.json(rows.map((x) => x.name));
});

// ---------- reviews ----------
r.get('/products/:id/reviews', wrap((req, res) => {
  const rows = db.prepare('SELECT id, author, rating, title, body, created_at FROM reviews WHERE product_id = ? AND approved = 1 ORDER BY id DESC LIMIT 50').all(Number(req.params.id));
  const dist = db.prepare('SELECT rating, COUNT(*) n FROM reviews WHERE product_id = ? AND approved = 1 GROUP BY rating').all(Number(req.params.id));
  res.json({ reviews: rows, distribution: Object.fromEntries([1, 2, 3, 4, 5].map((k) => [k, dist.find((d) => d.rating === k)?.n || 0])) });
}));

r.post('/products/:id/reviews', attachCustomer, wrap((req, res) => {
  const body = z.object({
    author: z.string().trim().min(2).max(60).optional(),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(100).default(''),
    body: z.string().trim().max(1000).default(''),
  }).parse(req.body);
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) throw new HttpError(404, 'Product not found');
  const author = req.user?.name || body.author;
  if (!author) throw new HttpError(400, 'Please enter your name.');
  db.prepare('INSERT INTO reviews (product_id, user_id, author, rating, title, body) VALUES (?,?,?,?,?,?)').run(id, req.user?.id ?? null, author, body.rating, body.title, body.body);
  recalcRating(id);
  res.status(201).json({ ok: true });
}));

r.get('/reviews/featured', (_req, res) => {
  const rows = db.prepare(`SELECT r.id, r.author, r.rating, r.title, r.body, p.name AS product, p.slug
    FROM reviews r JOIN products p ON p.id = r.product_id
    WHERE r.approved = 1 AND r.rating >= 4 AND length(r.body) > 30 ORDER BY r.id DESC LIMIT 9`).all();
  res.json(rows);
});

r.get('/offers', (_req, res) => {
  res.json(db.prepare('SELECT id, title, subtitle, badge, link, accent FROM offers WHERE active = 1 ORDER BY sort_order, id').all());
});

// ---------- misc forms ----------
r.post('/contact', wrap((req, res) => {
  const b = z.object({
    name: z.string().trim().min(2).max(80), email: z.string().trim().email().or(z.literal('')).default(''),
    phone: z.string().trim().max(20).default(''), subject: z.string().trim().max(120).default(''),
    body: z.string().trim().min(5).max(2000),
  }).parse(req.body);
  db.prepare('INSERT INTO messages (name,email,phone,subject,body) VALUES (?,?,?,?,?)').run(b.name, b.email, b.phone, b.subject, b.body);
  res.status(201).json({ ok: true });
}));

r.post('/newsletter', wrap((req, res) => {
  const { contact } = z.object({ contact: z.string().trim().min(5).max(120) }).parse(req.body);
  const ok = /^\S+@\S+\.\S+$/.test(contact) || /^[+\d][\d\s-]{7,}$/.test(contact);
  if (!ok) throw new HttpError(400, 'Enter a valid email or mobile number.');
  db.prepare('INSERT OR IGNORE INTO subscribers (contact) VALUES (?)').run(contact);
  res.status(201).json({ ok: true });
}));

export default r;
