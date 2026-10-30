import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, getSettings } from '../db.js';
import { wrap, HttpError, money } from '../lib/util.js';
import { attachCustomer, requireCustomer, signIn, signOut } from '../lib/auth.js';
import { quoteOrder, priceCart, newOrderNo, addEvent, loadOrder, hydrate, changeStatus } from '../lib/orders.js';
import { quoteDelivery } from '../lib/delivery.js';
import { createGatewayOrder, verifyPayment, testGatewayPay, razorpayLive } from '../lib/payments.js';

const r = Router();

const phone = z.string().trim().transform((s) => s.replace(/[\s()-]/g, '')).refine((s) => /^(\+?91)?[6-9]\d{9}$/.test(s), 'Enter a valid 10-digit Indian mobile number');
const cartItems = z.array(z.object({ productId: z.number().int(), quantity: z.number().int().min(1).max(99) })).min(1).max(50);
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const last10 = (s) => String(s).replace(/\D/g, '').slice(-10);

// ---------- delivery & cart quote ----------
r.post('/delivery/quote', wrap((req, res) => {
  const b = z.object({ lat, lng }).parse(req.body);
  res.json(quoteDelivery(b.lat, b.lng));
}));

r.post('/cart/quote', wrap((req, res) => {
  const b = z.object({ items: cartItems, lat: lat.optional(), lng: lng.optional() }).parse(req.body);
  const cart = priceCart(b.items);
  const delivery = b.lat != null && b.lng != null ? quoteDelivery(b.lat, b.lng) : null;
  const deliveryCharge = delivery?.deliverable ? delivery.fee : 0;
  res.json({
    subtotal: cart.subtotal, discount: cart.discount, listTotal: cart.listTotal,
    delivery, deliveryCharge, total: money(cart.subtotal + deliveryCharge),
  });
}));

// ---------- orders ----------
const orderSchema = z.object({
  items: cartItems,
  customer: z.object({ name: z.string().trim().min(2).max(80), phone, email: z.string().trim().email().or(z.literal('')).default('') }),
  address: z.object({
    house: z.string().trim().min(1, 'House / building is required').max(120),
    line: z.string().trim().min(3, 'Address is required').max(240),
    area: z.string().trim().min(2, 'Area / locality is required').max(120),
    landmark: z.string().trim().max(120).default(''),
    pincode: z.string().trim().regex(/^\d{6}$/, 'PIN code must be 6 digits'),
    instructions: z.string().trim().max(300).default(''),
    lat, lng,
  }),
  paymentMethod: z.enum(['COD', 'ONLINE']),
  acceptOutsideFee: z.boolean().default(false),
});

r.post('/orders', attachCustomer, wrap(async (req, res) => {
  const b = orderSchema.parse(req.body);
  const s = getSettings();
  if (b.paymentMethod === 'COD' && s.cod_enabled !== '1') throw new HttpError(400, 'Cash on Delivery is currently unavailable.');
  if (b.paymentMethod === 'ONLINE' && s.online_enabled !== '1') throw new HttpError(400, 'Online payment is currently unavailable.');

  const create = db.transaction(() => {
    const q = quoteOrder(b.items, b.address.lat, b.address.lng);
    if (!q.delivery.deliverable) throw new HttpError(422, q.delivery.message, { code: 'OUT_OF_RANGE' });
    if (!q.delivery.free && !b.acceptOutsideFee) {
      throw new HttpError(422, 'Your location is outside our free delivery area. Please confirm the delivery fee to continue.', { code: 'FEE_CONFIRM_REQUIRED', delivery: q.delivery });
    }
    const orderNo = newOrderNo();
    const info = db.prepare(`INSERT INTO orders (order_no, user_id, customer_name, customer_phone, customer_email,
        address_house, address_line, address_area, address_landmark, address_pincode, delivery_lat, delivery_lng, delivery_instructions,
        distance_km, within_free_zone, subtotal, discount, delivery_charge, total, payment_method, payment_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      orderNo, req.user?.id ?? null, b.customer.name, b.customer.phone, b.customer.email,
      b.address.house, b.address.line, b.address.area, b.address.landmark, b.address.pincode, b.address.lat, b.address.lng, b.address.instructions,
      q.delivery.distanceKm, q.delivery.free ? 1 : 0, q.cart.subtotal, q.cart.discount, q.deliveryCharge, q.total, b.paymentMethod, 'PENDING');
    const orderId = Number(info.lastInsertRowid);
    for (const l of q.cart.lines) {
      // guarded decrement: protects against two shoppers buying the last item
      const upd = db.prepare('UPDATE products SET stock = stock - ?, sold_count = sold_count + ? WHERE id = ? AND stock >= ?').run(l.quantity, l.quantity, l.productId, l.quantity);
      if (!upd.changes) throw new HttpError(409, `${l.product.name} just went out of stock.`);
      db.prepare('INSERT INTO order_items (order_id, product_id, name, sku, image, quantity, unit_price, list_price) VALUES (?,?,?,?,?,?,?,?)')
        .run(orderId, l.productId, l.product.name, l.product.sku, JSON.parse(l.product.images)[0] || '', l.quantity, l.unitPrice, l.listPrice);
    }
    addEvent(orderId, 'NEW', b.paymentMethod === 'COD' ? 'Order placed — pay on delivery' : 'Order placed — awaiting online payment');
    return orderId;
  });
  const orderId = create();
  const order = hydrate(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));

  let payment = null;
  if (b.paymentMethod === 'ONLINE') {
    try {
      payment = await createGatewayOrder({ amountPaise: Math.round(order.total * 100), receipt: order.orderNo });
      db.prepare('UPDATE orders SET gateway_order_id = ? WHERE id = ?').run(payment.gatewayOrderId, orderId);
      payment.mode = razorpayLive() ? 'razorpay' : 'test';
    } catch (e) {
      // The order exists; the customer can retry payment from the confirmation page.
      payment = { error: e.message };
    }
  }
  res.status(201).json({ order, payment });
}));

r.post('/orders/:orderNo/pay', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.orderNo);
  const { phone: ph } = z.object({ phone: z.string() }).parse(req.body);
  if (!row || last10(ph) !== last10(row.customer_phone)) throw new HttpError(404, 'Order not found');
  if (row.payment_method !== 'ONLINE' || row.payment_status === 'PAID' || row.order_status === 'CANCELLED') throw new HttpError(409, 'This order does not need payment.');
  const payment = await createGatewayOrder({ amountPaise: Math.round(row.total * 100), receipt: row.order_no });
  db.prepare('UPDATE orders SET gateway_order_id = ? WHERE id = ?').run(payment.gatewayOrderId, row.id);
  payment.mode = razorpayLive() ? 'razorpay' : 'test';
  res.json({ payment });
}));

/** Test-gateway only: simulates the customer completing payment. */
r.post('/payments/test/pay', wrap((req, res) => {
  if (razorpayLive()) throw new HttpError(404, 'Not available');
  const { gatewayOrderId } = z.object({ gatewayOrderId: z.string() }).parse(req.body);
  if (!db.prepare('SELECT 1 FROM orders WHERE gateway_order_id = ?').get(gatewayOrderId)) throw new HttpError(404, 'Unknown payment');
  res.json(testGatewayPay(gatewayOrderId));
}));

r.post('/payments/verify', wrap((req, res) => {
  const b = z.object({ orderNo: z.string(), gatewayOrderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(req.body);
  const row = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(b.orderNo);
  if (!row || row.gateway_order_id !== b.gatewayOrderId) throw new HttpError(404, 'Order not found');
  const ok = verifyPayment({ provider: razorpayLive() ? 'razorpay' : 'test', ...b });
  if (!ok) {
    db.prepare("UPDATE orders SET payment_status = 'FAILED', updated_at = datetime('now') WHERE id = ? AND payment_status != 'PAID'").run(row.id);
    throw new HttpError(400, 'Payment could not be verified.');
  }
  db.transaction(() => {
    db.prepare("UPDATE orders SET payment_status = 'PAID', payment_ref = ?, updated_at = datetime('now') WHERE id = ?").run(b.paymentId, row.id);
    addEvent(row.id, row.order_status, 'Online payment received');
  })();
  res.json({ order: loadOrder('id = ?', row.id) });
}));

r.get('/orders/track', wrap((req, res) => {
  const { orderNo, phone: ph } = z.object({ orderNo: z.string().trim().toUpperCase(), phone: z.string() }).parse(req.query);
  const o = loadOrder('order_no = ?', orderNo);
  if (!o || last10(ph) !== last10(o.customer.phone)) throw new HttpError(404, 'We could not find an order with those details.');
  res.json(o);
}));

r.post('/orders/:orderNo/cancel', attachCustomer, wrap((req, res) => {
  const { phone: ph } = z.object({ phone: z.string() }).parse(req.body);
  const o = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.orderNo);
  const owner = req.user && o?.user_id === req.user.id;
  if (!o || (!owner && last10(ph) !== last10(o.customer_phone))) throw new HttpError(404, 'Order not found');
  if (!['NEW', 'CONFIRMED'].includes(o.order_status)) throw new HttpError(409, 'This order is already being prepared. Please call the shop to cancel.');
  res.json(changeStatus(o.id, 'CANCELLED', 'Cancelled by customer'));
}));

// ---------- customer accounts ----------
const pw = z.string().min(6, 'Password must be at least 6 characters').max(100);

r.post('/auth/register', wrap((req, res) => {
  const b = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), phone: phone.optional(), password: pw }).parse(req.body);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(b.email)) throw new HttpError(409, 'An account with this email already exists.');
  const info = db.prepare('INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)').run(b.name, b.email, b.phone || '', bcrypt.hashSync(b.password, 10));
  const user = db.prepare('SELECT id,name,email,phone,role FROM users WHERE id = ?').get(info.lastInsertRowid);
  signIn(res, user, 'customer');
  res.status(201).json({ user });
}));

r.post('/auth/login', wrap((req, res) => {
  const b = z.object({ email: z.string().trim(), password: z.string() }).parse(req.body);
  const u = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'customer'").get(b.email);
  if (!u || !bcrypt.compareSync(b.password, u.password_hash)) throw new HttpError(401, 'Incorrect email or password.');
  signIn(res, u, 'customer');
  res.json({ user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role } });
}));

r.post('/auth/logout', (_req, res) => { signOut(res, 'customer'); res.json({ ok: true }); });
r.get('/auth/me', attachCustomer, (req, res) => res.json({ user: req.user && req.user.role === 'customer' ? req.user : null }));

r.put('/account/profile', requireCustomer, wrap((req, res) => {
  const b = z.object({ name: z.string().trim().min(2).max(80), phone: phone.or(z.literal('')) }).parse(req.body);
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(b.name, b.phone, req.user.id);
  res.json({ user: db.prepare('SELECT id,name,email,phone,role FROM users WHERE id = ?').get(req.user.id) });
}));

r.put('/account/password', requireCustomer, wrap((req, res) => {
  const b = z.object({ current: z.string(), next: pw }).parse(req.body);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(b.current, u.password_hash)) throw new HttpError(400, 'Current password is incorrect.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(b.next, 10), u.id);
  res.json({ ok: true });
}));

r.get('/account/orders', requireCustomer, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id);
  res.json(rows.map(hydrate));
});

const addrSchema = z.object({
  label: z.string().trim().max(30).default('Home'), name: z.string().trim().max(80).default(''), phone: z.string().trim().max(20).default(''),
  house: z.string().trim().max(120), address: z.string().trim().max(240), area: z.string().trim().max(120),
  landmark: z.string().trim().max(120).default(''), pincode: z.string().trim().regex(/^\d{6}$/),
  lat: lat.nullable().default(null), lng: lng.nullable().default(null), isDefault: z.boolean().default(false),
});
const shapeAddr = (a) => ({ id: a.id, label: a.label, name: a.name, phone: a.phone, house: a.house, address: a.address, area: a.area, landmark: a.landmark, pincode: a.pincode, lat: a.lat, lng: a.lng, isDefault: !!a.is_default });

r.get('/account/addresses', requireCustomer, (req, res) => {
  res.json(db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.user.id).map(shapeAddr));
});

r.post('/account/addresses', requireCustomer, wrap((req, res) => {
  const a = addrSchema.parse(req.body);
  const count = db.prepare('SELECT COUNT(*) n FROM addresses WHERE user_id = ?').get(req.user.id).n;
  const def = a.isDefault || count === 0;
  db.transaction(() => {
    if (def) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
    db.prepare('INSERT INTO addresses (user_id,label,name,phone,house,address,area,landmark,pincode,lat,lng,is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.user.id, a.label, a.name, a.phone, a.house, a.address, a.area, a.landmark, a.pincode, a.lat, a.lng, def ? 1 : 0);
  })();
  res.status(201).json({ ok: true });
}));

r.delete('/account/addresses/:id', requireCustomer, (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

r.post('/account/addresses/:id/default', requireCustomer, (req, res) => {
  db.transaction(() => {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
    db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  })();
  res.json({ ok: true });
});

export default r;
