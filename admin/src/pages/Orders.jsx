import { useState } from 'react';
import { api, money, when, STATUSES } from '../api.js';
import { ErrorBox, Loading, Modal, PageHead, Pager, PayBadge, StatusBadge, toast, useAsync } from '../ui.jsx';

function OrderDetail({ id, onClose, onChanged }) {
  const { data: o, loading, reload } = useAsync(() => api(`/orders/${id}`), [id]);
  const [note, setNote] = useState(null);
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); onChanged(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <Modal open onClose={onClose} title={o ? `Order ${o.orderNo}` : 'Order'} wide>
      {loading || !o ? <Loading /> : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge s={o.status} /><PayBadge s={o.paymentStatus} /><span className="text-xs text-muted">{o.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online'} · {when(o.createdAt)}</span></div>
            <div><label className="label">Update status</label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => <button key={s} disabled={o.status === s || o.status === 'CANCELLED' || (o.status === 'DELIVERED')} onClick={() => { if (s === 'CANCELLED' && !confirm('Cancel this order? Stock will be restored.')) return; act(() => api(`/orders/${o.id}/status`, { method: 'PUT', body: { status: s } }), `Marked ${s.replaceAll('_', ' ')}`); }} className={`btn btn-sm ${s === 'CANCELLED' ? 'btn-danger' : o.status === s ? 'btn-primary' : 'btn-ghost'}`}>{s.replaceAll('_', ' ')}</button>)}
              </div>
            </div>
            <div><label className="label">Payment status</label>
              <select className="input" value={o.paymentStatus} onChange={(e) => act(() => api(`/orders/${o.id}/payment`, { method: 'PUT', body: { paymentStatus: e.target.value } }), 'Payment updated')}>{['PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            <div className="card bg-panel2 p-4 text-sm">
              <p className="mb-1 font-bold">{o.customer.name}</p>
              <p><a className="text-cyan" href={`tel:${o.customer.phone}`}>{o.customer.phone}</a>{o.customer.email && ` · ${o.customer.email}`}</p>
              <p className="mt-2 text-muted">{o.address.house}, {o.address.line}, {o.address.area} – {o.address.pincode}{o.address.landmark && ` · near ${o.address.landmark}`}</p>
              {o.address.instructions && <p className="mt-1 text-amber-200">“{o.address.instructions}”</p>}
              <p className="mt-2 text-xs">{o.distanceKm} km from shop · {o.withinFreeZone ? <b className="text-emerald-300">free zone</b> : <b className="text-amber-300">outside free zone</b>}</p>
              <div className="mt-2 flex gap-2"><a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.address.lat},${o.address.lng}`}>Open in Maps</a><a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/91${o.customer.phone.slice(-10)}?text=${encodeURIComponent(`Hi ${o.customer.name}, regarding your order ${o.orderNo}`)}`}>WhatsApp</a></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card bg-panel2 p-4">
              <ul className="divide-y divide-line text-sm">{o.items.map((i, k) => <li key={k} className="flex items-center gap-3 py-2"><img src={i.image} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="line-clamp-1">{i.name}</span><span className="text-xs text-muted">{i.sku} · {i.quantity} × {money(i.unitPrice)}</span></span><b>{money(i.lineTotal)}</b></li>)}</ul>
              <dl className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
                {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount already applied</dt><dd>{money(o.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{o.deliveryCharge ? money(o.deliveryCharge) : 'FREE'}</dd></div>
                <div className="flex justify-between text-base font-extrabold"><dt>Total</dt><dd>{money(o.total)}</dd></div>
              </dl>
            </div>
            <div><label className="label">Internal note</label>
              <textarea className="input" rows={2} defaultValue={o.adminNote} onChange={(e) => setNote(e.target.value)} />
              {note != null && <button className="btn btn-ghost btn-sm mt-2" onClick={() => act(() => api(`/orders/${o.id}/note`, { method: 'PUT', body: { note } }), 'Note saved')}>Save note</button>}
            </div>
            <div><label className="label">History</label><ul className="space-y-1 text-xs text-muted">{[...o.events].reverse().map((e, i) => <li key={i}>{when(e.created_at)} — <b className="text-white">{e.status.replaceAll('_', ' ')}</b> {e.note && `· ${e.note}`}</li>)}</ul></div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Orders() {
  const [f, setF] = useState({ status: '', payment: '', q: '', page: 1 });
  const [open, setOpen] = useState(null);
  const { data, error, loading, reload } = useAsync(() => api('/orders', { params: f }), [f.status, f.payment, f.q, f.page]);
  return (
    <>
      <PageHead title="Orders" sub={data ? `${data.total} orders` : ''}><button className="btn btn-ghost" onClick={reload}>Refresh</button></PageHead>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input !w-64" placeholder="Search order no, name, phone" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} aria-label="Search orders" />
        <select className="input !w-auto" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })} aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select>
        <select className="input !w-auto" value={f.payment} onChange={(e) => setF({ ...f, payment: e.target.value, page: 1 })} aria-label="Payment"><option value="">Any payment</option>{['PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="card overflow-x-auto">
        <table className="w-full"><thead><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Total</th><th className="th">Delivery</th><th className="th">Payment</th><th className="th">Status</th><th className="th">Placed</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td className="td text-muted" colSpan={8}>Loading…</td></tr>}
            {data?.items.map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-white/5" onClick={() => setOpen(o.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o.id)}>
                <td className="td font-mono text-xs">{o.orderNo}</td><td className="td">{o.customer.name}<div className="text-xs text-muted">{o.customer.phone}</div></td>
                <td className="td">{o.items.reduce((a, i) => a + i.quantity, 0)}</td><td className="td font-semibold">{money(o.total)}</td>
                <td className="td text-xs">{o.deliveryCharge ? <span className="text-amber-300">{money(o.deliveryCharge)} · {o.distanceKm} km</span> : <span className="text-emerald-300">Free · {o.distanceKm} km</span>}</td>
                <td className="td"><PayBadge s={o.paymentStatus} /><div className="text-xs text-muted">{o.paymentMethod}</div></td><td className="td"><StatusBadge s={o.status} /></td><td className="td text-muted">{when(o.createdAt)}</td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td className="td text-muted" colSpan={8}>No orders match.</td></tr>}
          </tbody></table>
      </div>
      {data && <Pager page={data.page} pages={data.pages} onPage={(p) => setF({ ...f, page: p })} />}
      {open && <OrderDetail id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}
