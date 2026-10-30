import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Payment provider abstraction.
 *
 *  - If RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set, real Razorpay Orders API
 *    calls are used and the checkout signature is verified server-side.
 *  - Otherwise a clearly-labelled "test gateway" is used so the whole online
 *    payment flow can be exercised locally. It never touches card data.
 *
 * Card details are never received or stored by this server.
 */
export const razorpayLive = () => Boolean(config.razorpay.keyId && config.razorpay.keySecret);

export async function createGatewayOrder({ amountPaise, receipt }) {
  if (razorpayLive()) {
    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const resp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.description || 'Razorpay order creation failed');
    return { provider: 'razorpay', gatewayOrderId: data.id, keyId: config.razorpay.keyId, amountPaise, currency: 'INR' };
  }
  return { provider: 'test', gatewayOrderId: `test_${crypto.randomBytes(8).toString('hex')}`, amountPaise, currency: 'INR' };
}

const testSign = (gatewayOrderId, paymentId) =>
  crypto.createHmac('sha256', config.jwtSecret).update(`${gatewayOrderId}|${paymentId}`).digest('hex');

export function testGatewayPay(gatewayOrderId) {
  const paymentId = `test_pay_${crypto.randomBytes(6).toString('hex')}`;
  return { paymentId, signature: testSign(gatewayOrderId, paymentId) };
}

export function verifyPayment({ provider, gatewayOrderId, paymentId, signature }) {
  if (!gatewayOrderId || !paymentId || !signature) return false;
  const expected = provider === 'razorpay'
    ? crypto.createHmac('sha256', config.razorpay.keySecret).update(`${gatewayOrderId}|${paymentId}`).digest('hex')
    : testSign(gatewayOrderId, paymentId);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
