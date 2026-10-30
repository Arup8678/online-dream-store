import { useCallback, useRef, useState } from 'react';
import { api } from './api.js';
import { useStore } from '../store.js';
import { Modal, Spinner } from '../components/ui.jsx';
import { money } from './format.js';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(s);
  });
}

/**
 * Online payment helper. `start()` resolves { paid: boolean, error? }.
 *  - real Razorpay checkout when the server has live keys
 *  - otherwise a clearly-labelled local test gateway (no real money, no card data)
 */
export function usePayment() {
  const [test, setTest] = useState(null); // { orderNo, payment, amount }
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);
  const settings = useStore((s) => s.settings);

  const verify = (orderNo, p) => api('/payments/verify', { method: 'POST', body: { orderNo, gatewayOrderId: p.gatewayOrderId, paymentId: p.paymentId, signature: p.signature } });

  const start = useCallback(async ({ orderNo, payment, amount, customer }) => {
    if (!payment || payment.error) return { paid: false, error: payment?.error || 'Payment could not be started.' };
    if (payment.mode === 'razorpay') {
      await loadRazorpay();
      return new Promise((resolve) => {
        const rz = new window.Razorpay({
          key: payment.keyId, order_id: payment.gatewayOrderId, amount: payment.amountPaise, currency: 'INR',
          name: settings?.brand_name || 'Dream Palace', description: `Order ${orderNo}`,
          prefill: { name: customer?.name, contact: customer?.phone, email: customer?.email },
          theme: { color: '#8b7bff' },
          handler: async (r) => {
            try { await verify(orderNo, { gatewayOrderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }); resolve({ paid: true }); }
            catch (e) { resolve({ paid: false, error: e.message }); }
          },
          modal: { ondismiss: () => resolve({ paid: false }) },
        });
        rz.on('payment.failed', (r) => resolve({ paid: false, error: r.error?.description }));
        rz.open();
      });
    }
    return new Promise((resolve) => { resolver.current = resolve; setTest({ orderNo, payment, amount }); });
  }, [settings]);

  const finish = (result) => { setTest(null); resolver.current?.(result); };
  const pay = async () => {
    setBusy(true);
    try {
      const { paymentId, signature } = await api('/payments/test/pay', { method: 'POST', body: { gatewayOrderId: test.payment.gatewayOrderId } });
      await verify(test.orderNo, { gatewayOrderId: test.payment.gatewayOrderId, paymentId, signature });
      finish({ paid: true });
    } catch (e) { finish({ paid: false, error: e.message }); }
    setBusy(false);
  };

  const modal = (
    <Modal open={!!test} onClose={() => finish({ paid: false })} title="Test payment gateway">
      <div className="space-y-4">
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">This is a <b>demo gateway</b> for local testing — no real money moves and no card details are collected. Add Razorpay keys on the server to go live.</p>
        <div className="glass rounded-2xl p-4 text-center"><p className="text-sm text-muted">Order {test?.orderNo}</p><p className="font-display text-3xl font-extrabold">{test ? money(test.amount) : ''}</p></div>
        <button onClick={pay} disabled={busy} className="btn btn-primary w-full">{busy ? <Spinner /> : 'Simulate successful payment'}</button>
        <button onClick={() => finish({ paid: false })} disabled={busy} className="btn btn-ghost w-full">Cancel / pay later</button>
      </div>
    </Modal>
  );
  return { start, modal };
}
