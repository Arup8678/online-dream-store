import crypto from 'node:crypto';
import { db, getSettings } from '../db.js';
import { HttpError, money } from './util.js';
import { quoteDelivery } from './delivery.js';

export const ORDER_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newOrderNo() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (;;) {
    const suffix = Array.from(crypto.randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');
    const no = `DP-${ymd}-${suffix}`;
    if (!db.prepare('SELECT 1 FROM orders WHERE order_no = ?').get(no)) return no;
  }
}

/** Price a cart from the DB (never trust client prices). Throws on stock problems. */
export function priceCart(items) {
  if (!items?.length) throw new HttpError(400, 'Your cart is empty.');
  const merged = new Map();
  for (const it of items) merged.set(it.productId, (merged.get(it.productId) || 0) + it.quantity);
  const lines = [];
  const problems = [];
  for (const [productId, quantity] of merged) {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
    if (!p) { problems.push({ productId, message: 'This product is no longer available.' }); continue; }
    if (p.stock < quantity) {
      problems.push({ productId, name: p.name, available: p.stock, message: p.stock === 0 ? `${p.name} is out of stock.` : `Only ${p.stock} of ${p.name} left.` });
      continue;
    }
    const sale = p.discount_price > 0 && p.discount_price < p.price;
    lines.push({
      product: p, productId, quantity,
      unitPrice: sale ? p.discount_price : p.price, listPrice: p.price,
    });
  }
  if (problems.length) throw new HttpError(409, problems[0].message, { problems });
  const listTotal = money(lines.reduce((a, l) => a + l.listPrice * l.quantity, 0));
  const subtotal = money(lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0));
  return { lines, listTotal, subtotal, discount: money(listTotal - subtotal) };
}

export function quoteOrder(items, lat, lng) {
  const cart = priceCart(items);
  const delivery = quoteDelivery(lat, lng, getSettings());
  const deliveryCharge = delivery.ok && delivery.deliverable ? delivery.fee : 0;
  return { cart, delivery, deliveryCharge, total: money(cart.subtotal + deliveryCharge) };
}

export function loadOrder(where, ...params) {
  const o = db.prepare(`SELECT * FROM orders WHERE ${where}`).get(...params);
  return o ? hydrate(o) : null;
}

export function hydrate(o) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  const events = db.prepare('SELECT status, note, created_at FROM order_events WHERE order_id = ? ORDER BY id').all(o.id);
  return {
    id: o.id,
    orderNo: o.order_no,
    customer: { name: o.customer_name, phone: o.customer_phone, email: o.customer_email },
    address: { house: o.address_house, line: o.address_line, area: o.address_area, landmark: o.address_landmark, pincode: o.address_pincode, lat: o.delivery_lat, lng: o.delivery_lng, instructions: o.delivery_instructions },
    distanceKm: o.distance_km,
    withinFreeZone: !!o.within_free_zone,
    items: items.map((i) => ({ productId: i.product_id, name: i.name, sku: i.sku, image: i.image, quantity: i.quantity, unitPrice: i.unit_price, listPrice: i.list_price, lineTotal: money(i.unit_price * i.quantity) })),
    subtotal: o.subtotal, discount: o.discount, deliveryCharge: o.delivery_charge, total: o.total,
    paymentMethod: o.payment_method, paymentStatus: o.payment_status, paymentRef: o.payment_ref,
    status: o.order_status, adminNote: o.admin_note,
    createdAt: o.created_at, updatedAt: o.updated_at, events,
  };
}

export function addEvent(orderId, status, note = '') {
  db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?,?,?)').run(orderId, status, note);
}

/** Move an order to a new status, restoring stock on cancellation. Returns updated order. */
export const changeStatus = db.transaction((orderId, status, note = '') => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!o) throw new HttpError(404, 'Order not found');
  if (o.order_status === status) return hydrate(o);
  if (o.order_status === 'CANCELLED') throw new HttpError(409, 'A cancelled order cannot be reopened.');
  if (o.order_status === 'DELIVERED' && status !== 'DELIVERED') throw new HttpError(409, 'A delivered order cannot be changed.');

  if (status === 'CANCELLED') {
    for (const i of db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId)) {
      if (i.product_id) db.prepare('UPDATE products SET stock = stock + ?, sold_count = MAX(0, sold_count - ?) WHERE id = ?').run(i.quantity, i.quantity, i.product_id);
    }
  }
  let paymentStatus = o.payment_status;
  if (status === 'DELIVERED' && o.payment_method === 'COD') paymentStatus = 'PAID';
  if (status === 'CANCELLED' && o.payment_status === 'PAID') paymentStatus = 'REFUNDED';
  if (status === 'CANCELLED' && o.payment_status === 'PENDING') paymentStatus = 'FAILED';
  db.prepare("UPDATE orders SET order_status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, paymentStatus, orderId);
  addEvent(orderId, status, note);
  return hydrate(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));
});
