import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import { money } from '../lib/format.js';
import { usePayment } from '../lib/pay.jsx';
import { Empty, Spinner, toast, usePageTitle } from '../components/ui.jsx';
import { OrderBody } from './Track.jsx';

export function useLastOrder(orderNo) {
  const [state, setState] = useState({ order: null, error: '', phone: '' });
  const reload = async () => {
    let phone = '';
    try { const s = JSON.parse(sessionStorage.getItem('dp-last-order') || '{}'); if (s.orderNo === orderNo) phone = s.phone; } catch { /* ignore */ }
    if (!phone) { setState({ order: null, error: 'NEED_PHONE', phone: '' }); return; }
    try { const order = await api('/orders/track', { params: { orderNo, phone } }); setState({ order, error: '', phone }); }
    catch (e) { setState({ order: null, error: e.message, phone }); }
  };
  useEffect(() => { reload(); }, [orderNo]); // eslint-disable-line
  return { ...state, reload };
}

export default function OrderConfirmation() {
  const { orderNo } = useParams();
  usePageTitle(`Order ${orderNo}`);
  const nav = useNavigate();
  const settings = useStore((s) => s.settings);
  const { order, error, phone, reload } = useLastOrder(orderNo);
  const { start, modal } = usePayment();
  const [busy, setBusy] = useState(false);

  if (error === 'NEED_PHONE') { nav(`/track?o=${orderNo}`, { replace: true }); return null; }
  if (error) return <div className="container-x py-16"><Empty icon="🧾" title="We couldn’t load this order">{error}<div className="mt-4"><Link to="/track" className="btn btn-primary">Track an order</Link></div></Empty></div>;
  if (!order) return <div className="grid min-h-[50dvh] place-items-center"><Spinner className="!h-8 !w-8" /></div>;

  const needsPay = order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED';
  const retry = async () => {
    setBusy(true);
    try {
      const { payment } = await api(`/orders/${orderNo}/pay`, { method: 'POST', body: { phone } });
      const res = await start({ orderNo, payment, amount: order.total, customer: order.customer });
      if (res.error) toast(res.error, 'error');
      await reload();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };
  const wa = `https://wa.me/${settings?.whatsapp_number || ''}?text=${encodeURIComponent(`Hi! My order number is ${order.orderNo}.`)}`;

  return (
    <div className="container-x max-w-4xl py-8 md:py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300 shadow-[0_0_60px_-8px_rgba(52,211,153,.7)]"><CheckCircle2 size={44} /></div>
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">{needsPay ? 'Order received — payment pending' : 'Thank you! Your order is placed 🎉'}</h1>
        <p className="mt-2 text-muted">Order <b className="font-mono text-white">{order.orderNo}</b> · We’ve sent the details to the shop. Save this number to track your order.</p>
        {needsPay && <button onClick={retry} disabled={busy} className="btn btn-primary mt-5">{busy ? <Spinner /> : `Pay ${money(order.total)} now`}</button>}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to={`/track?o=${order.orderNo}&p=${encodeURIComponent(phone)}`} className="btn btn-ghost">Track order</Link>
          <a href={wa} target="_blank" rel="noreferrer" className="btn btn-ghost !border-emerald-400/40 !text-emerald-300"><MessageCircle size={17} /> WhatsApp the shop</a>
          <Link to="/shop" className="btn btn-ghost">Keep shopping</Link>
        </div>
      </div>
      <OrderBody order={order} onChange={reload} phone={phone} />
      {modal}
    </div>
  );
}
