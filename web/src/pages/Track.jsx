import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, MapPin } from 'lucide-react';
import { api } from '../lib/api.js';
import { money, dateTime, STATUS, STEPS } from '../lib/format.js';
import { Field, Spinner, toast, usePageTitle } from '../components/ui.jsx';

export function Timeline({ order }) {
  const cancelled = order.status === 'CANCELLED';
  const idx = STEPS.indexOf(order.status);
  const at = (s) => order.events.find((e) => e.status === s)?.created_at;
  return (
    <div>
      {cancelled && <div className="mb-5 rounded-2xl border border-rose-400/40 bg-rose-400/10 p-4 text-rose-100"><b>✖️ This order was cancelled.</b> {order.paymentStatus === 'REFUNDED' ? 'Your payment will be refunded.' : ''}</div>}
      <ol className="relative">
        {STEPS.map((s, i) => {
          const done = !cancelled && i <= idx;
          const current = !cancelled && i === idx;
          const st = STATUS[s];
          return (
            <li key={s} className="relative flex gap-4 pb-8 last:pb-0">
              {i < STEPS.length - 1 && (
                <span className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 overflow-hidden rounded bg-white/10">
                  <motion.span className="block w-full bg-gradient-to-b from-neon to-cyan" initial={{ height: 0 }} animate={{ height: !cancelled && i < idx ? '100%' : 0 }} transition={{ duration: 0.8, delay: i * 0.25 }} />
                </span>
              )}
              <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.12 }}
                className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${done ? 'text-black' : 'bg-white/10 text-muted'}`} style={done ? { background: st.color, boxShadow: current ? `0 0 0 6px ${st.color}33, 0 0 28px ${st.color}` : undefined } : undefined}>
                {done && !current ? <Check size={18} /> : st.icon}
                {current && <span className="absolute inset-0 rounded-full" style={{ border: `2px solid ${st.color}`, animation: 'pulse-ring 2s ease-out infinite' }} />}
              </motion.span>
              <div className={done ? '' : 'opacity-50'}>
                <p className="font-display font-bold">{st.label}</p>
                <p className="text-sm text-muted">{current ? st.text : done ? 'Completed' : 'Waiting'}</p>
                {at(s) && <p className="text-xs text-muted">{dateTime(at(s))}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OrderBody({ order, onChange, phone }) {
  const [busy, setBusy] = useState(false);
  const canCancel = ['NEW', 'CONFIRMED'].includes(order.status);
  const cancel = async () => {
    if (!confirm('Cancel this order?')) return;
    setBusy(true);
    try { await api(`/orders/${order.orderNo}/cancel`, { method: 'POST', body: { phone } }); toast('Order cancelled'); onChange?.(); }
    catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };
  const st = STATUS[order.status];
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
      <div className="glass rounded-3xl p-6">
        <div className="mb-5 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Order status</h2>
          <span className="rounded-full px-3 py-1 text-xs font-extrabold text-black" style={{ background: st.color }}>{st.label}</span>
        </div>
        <Timeline order={order} />
        {canCancel && <button onClick={cancel} disabled={busy} className="btn btn-danger btn-sm mt-6">{busy ? <Spinner /> : 'Cancel order'}</button>}
      </div>
      <div className="space-y-6">
        <div className="glass rounded-3xl p-6">
          <h2 className="mb-3 font-display text-lg font-bold">Items</h2>
          <ul className="divide-y divide-line">
            {order.items.map((i, k) => (
              <li key={k} className="flex items-center gap-3 py-3">
                <img src={i.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{i.name}</p><p className="text-xs text-muted">{i.quantity} × {money(i.unitPrice)}</p></div>
                <p className="font-bold">{money(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Items total (MRP)</dt><dd>{money(order.subtotal + order.discount)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between text-emerald-300"><dt>Discount</dt><dd>− {money(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Delivery {order.distanceKm != null && `(${order.distanceKm} km)`}</dt><dd className={order.deliveryCharge === 0 ? 'font-bold text-emerald-300' : ''}>{order.deliveryCharge === 0 ? 'FREE' : money(order.deliveryCharge)}</dd></div>
            <div className="flex justify-between font-display text-lg font-extrabold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-muted">Payment: <b className="text-white">{order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online'}</b> · <span className={order.paymentStatus === 'PAID' ? 'text-emerald-300' : 'text-amber-300'}>{order.paymentStatus}</span></p>
        </div>
        <div className="glass rounded-3xl p-6 text-sm">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold"><MapPin size={17} /> Delivering to</h2>
          <p><b>{order.customer.name}</b> · {order.customer.phone}</p>
          <p className="text-muted">{order.address.house}, {order.address.line}, {order.address.area} – {order.address.pincode}{order.address.landmark && ` (near ${order.address.landmark})`}</p>
          {order.address.instructions && <p className="mt-1 text-muted">Note: {order.address.instructions}</p>}
          <p className="mt-2 text-xs text-muted">Placed {dateTime(order.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

export default function Track() {
  usePageTitle('Track your order');
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({ orderNo: params.get('o') || '', phone: params.get('p') || '' });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lookup = async (o = form.orderNo, p = form.phone, quiet = false) => {
    if (!quiet) setBusy(true);
    setError('');
    try { const r = await api('/orders/track', { params: { orderNo: o.trim(), phone: p } }); setOrder(r); sessionStorage.setItem('dp-last-order', JSON.stringify({ orderNo: r.orderNo, phone: p })); }
    catch (e) { setOrder(null); setError(e.message); }
    setBusy(false);
  };
  useEffect(() => { if (params.get('o') && params.get('p')) lookup(params.get('o'), params.get('p')); }, []); // eslint-disable-line
  // gentle auto-refresh while order is in progress
  useEffect(() => {
    if (!order || ['DELIVERED', 'CANCELLED'].includes(order.status)) return;
    const id = setInterval(() => lookup(order.orderNo, form.phone, true), 20000);
    return () => clearInterval(id);
  }, [order?.orderNo, order?.status]); // eslint-disable-line

  return (
    <div className="container-x max-w-5xl py-8 md:py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">Track your order</h1>
      <p className="mt-2 text-muted">Enter your order number and the mobile number used at checkout.</p>
      <form onSubmit={(e) => { e.preventDefault(); setParams({ o: form.orderNo, p: form.phone }, { replace: true }); lookup(); }} className="glass my-6 grid gap-4 rounded-3xl p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Order number"><input className="input font-mono uppercase" placeholder="DP-241014-AB12" value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })} required /></Field>
        <Field label="Mobile number"><input className="input" inputMode="tel" placeholder="10-digit mobile" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></Field>
        <button className="btn btn-primary !h-[46px]" disabled={busy}>{busy ? <Spinner /> : 'Track'}</button>
      </form>
      {error && <div className="mb-6 rounded-2xl border border-rose-400/40 bg-rose-400/10 p-4 text-rose-100" role="alert">{error}</div>}
      {order && <><p className="mb-4 text-sm text-muted">Order <b className="font-mono text-white">{order.orderNo}</b></p><OrderBody order={order} phone={form.phone} onChange={() => lookup(order.orderNo, form.phone, true)} /></>}
    </div>
  );
}
