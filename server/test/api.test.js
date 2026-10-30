import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-'));
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
execFileSync('node', ['src/seed.js'], { env: process.env, stdio: 'ignore' });

let server, base;
const jar = { admin: '', cust: '' };
const call = async (method, url, body, cookie = '') => {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: res.headers.getSetCookie?.().map((c) => c.split(';')[0]).join('; ') };
};

before(async () => {
  const { createApp } = await import('../src/index.js');
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const address = (lat, lng) => ({ house: '12', line: 'Test Street', area: 'Test Area', landmark: '', pincode: '110001', instructions: '', lat, lng });
const customer = { name: 'Test Parent', phone: '9876543210', email: '' };

test('search matches name, category, brand and SKU', async () => {
  assert.ok((await call('GET', '/products?q=teddy')).data.total > 3);
  assert.ok((await call('GET', '/products?q=Pentel')).data.total >= 2);
  assert.ok((await call('GET', '/products?q=geometry')).data.total >= 2);
  assert.equal((await call('GET', '/products?q=DP-TOY-027')).data.total, 1);
  assert.equal((await call('GET', '/products?q=zzzzqq')).data.total, 0);
});

test('filters and sorting', async () => {
  const r = await call('GET', '/products?category=toys&sort=price_desc&minPrice=300&maxPrice=1000');
  const prices = r.data.items.map((p) => p.salePrice);
  assert.ok(prices.every((p) => p >= 300 && p <= 1000));
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
});

test('free delivery inside radius, fee outside, refusal beyond max', async () => {
  assert.equal((await call('POST', '/delivery/quote', { lat: 28.64, lng: 77.22 })).data.free, true);
  const out = (await call('POST', '/delivery/quote', { lat: 28.7, lng: 77.3 })).data;
  assert.equal(out.free, false);
  assert.ok(out.fee > 0);
  assert.equal((await call('POST', '/delivery/quote', { lat: 30, lng: 77 })).data.deliverable, false);
});

test('COD order inside zone: server prices, decrements stock, tracking works', async () => {
  const p = (await call('GET', '/products?limit=1&inStock=1')).data.items[0];
  const r = await call('POST', '/orders', { items: [{ productId: p.id, quantity: 2 }], customer, address: address(28.64, 77.22), paymentMethod: 'COD' });
  assert.equal(r.status, 201);
  assert.equal(r.data.order.deliveryCharge, 0);
  assert.equal(r.data.order.total, p.salePrice * 2);
  assert.equal(r.data.order.status, 'NEW');
  const after = (await call('GET', `/products/${p.slug}`)).data.product;
  assert.equal(after.stock, p.stock - 2);
  const t = await call('GET', `/orders/track?orderNo=${r.data.order.orderNo}&phone=9876543210`);
  assert.equal(t.status, 200);
  assert.equal((await call('GET', `/orders/track?orderNo=${r.data.order.orderNo}&phone=9999999999`)).status, 404);
});

test('outside zone requires fee confirmation', async () => {
  const p = (await call('GET', '/products?limit=1&inStock=1')).data.items[0];
  const body = { items: [{ productId: p.id, quantity: 1 }], customer, address: address(28.7, 77.3), paymentMethod: 'COD' };
  const first = await call('POST', '/orders', body);
  assert.equal(first.status, 422);
  assert.equal(first.data.code, 'FEE_CONFIRM_REQUIRED');
  const ok = await call('POST', '/orders', { ...body, acceptOutsideFee: true });
  assert.equal(ok.status, 201);
  assert.ok(ok.data.order.deliveryCharge > 0);
  assert.equal(ok.data.order.total, p.salePrice + ok.data.order.deliveryCharge);
});

test('stock validation blocks overselling', async () => {
  const p = (await call('GET', '/products?limit=1&inStock=1')).data.items[0];
  const r = await call('POST', '/orders', { items: [{ productId: p.id, quantity: p.stock + 1 }], customer, address: address(28.64, 77.22), paymentMethod: 'COD' });
  assert.equal(r.status, 409);
});

test('online payment: unsigned verify fails, signed verify marks PAID', async () => {
  const p = (await call('GET', '/products?limit=1&inStock=1')).data.items[0];
  const r = await call('POST', '/orders', { items: [{ productId: p.id, quantity: 1 }], customer, address: address(28.64, 77.22), paymentMethod: 'ONLINE' });
  assert.equal(r.status, 201);
  const { gatewayOrderId } = r.data.payment;
  const bad = await call('POST', '/payments/verify', { orderNo: r.data.order.orderNo, gatewayOrderId, paymentId: 'x', signature: 'nope' });
  assert.equal(bad.status, 400);
  const pay = (await call('POST', '/payments/test/pay', { gatewayOrderId })).data;
  const good = await call('POST', '/payments/verify', { orderNo: r.data.order.orderNo, gatewayOrderId, paymentId: pay.paymentId, signature: pay.signature });
  assert.equal(good.data.order.paymentStatus, 'PAID');
});

test('admin: auth required, status flow, cancel restores stock', async () => {
  assert.equal((await call('GET', '/admin/orders')).status, 401);
  const login = await call('POST', '/admin/auth/login', { email: 'admin@dreamplace.local', password: 'admin123' });
  assert.equal(login.status, 200);
  jar.admin = login.cookie;
  const p = (await call('GET', '/products?limit=1&inStock=1')).data.items[0];
  const o = (await call('POST', '/orders', { items: [{ productId: p.id, quantity: 3 }], customer, address: address(28.64, 77.22), paymentMethod: 'COD' })).data.order;
  const mid = (await call('GET', `/products/${p.slug}`)).data.product.stock;
  const c = await call('PUT', `/admin/orders/${o.id}/status`, { status: 'CONFIRMED' }, jar.admin);
  assert.equal(c.data.status, 'CONFIRMED');
  await call('PUT', `/admin/orders/${o.id}/status`, { status: 'CANCELLED' }, jar.admin);
  assert.equal((await call('GET', `/products/${p.slug}`)).data.product.stock, mid + 3);
  const reopen = await call('PUT', `/admin/orders/${o.id}/status`, { status: 'NEW' }, jar.admin);
  assert.equal(reopen.status, 409);
});

test('admin settings change delivery rules live', async () => {
  const s = (await call('GET', '/admin/settings', null, jar.admin)).data;
  const put = await call('PUT', '/admin/settings', { free_radius_km: 15 }, jar.admin);
  assert.equal(put.data.free_radius_km, '15');
  assert.equal((await call('POST', '/delivery/quote', { lat: 28.7, lng: 77.3 })).data.free, true);
  await call('PUT', '/admin/settings', { free_radius_km: Number(s.free_radius_km) }, jar.admin);
});

test('admin product create/update validates and customer register/login works', async () => {
  const bad = await call('POST', '/admin/products', { sku: 'X1', name: 'Bad', categoryId: 1, price: 10, discountPrice: 20, stock: 1 }, jar.admin);
  assert.equal(bad.status, 400);
  const good = await call('POST', '/admin/products', { sku: 'x-test-1', name: 'Test Gadget', categoryId: 1, price: 100, discountPrice: 80, stock: 5 }, jar.admin);
  assert.equal(good.status, 201);
  assert.equal(good.data.discountPercent, 20);
  const reg = await call('POST', '/auth/register', { name: 'Zed', email: 'zed@example.com', password: 'secret12' });
  assert.equal(reg.status, 201);
  assert.equal((await call('GET', '/auth/me', null, reg.cookie)).data.user.email, 'zed@example.com');
  assert.equal((await call('GET', '/admin/orders', null, reg.cookie)).status, 401); // customer cookie is not admin
});
