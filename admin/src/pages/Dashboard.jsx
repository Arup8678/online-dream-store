import { Link } from 'react-router-dom';
import { api, money, when } from '../api.js';
import { ErrorBox, Loading, PageHead, StatusBadge, useAsync } from '../ui.jsx';

function Stat({ label, value, sub, to, accent = '#8b7bff' }) {
  const Body = (
    <div className="card h-full p-4 transition hover:border-white/25" style={{ backgroundImage: `linear-gradient(135deg, ${accent}22, transparent 60%)` }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>{sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{Body}</Link> : Body;
}

export default function Dashboard() {
  const { data: d, error, loading } = useAsync(() => api('/dashboard'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  const max = Math.max(1, ...d.days.map((x) => x.revenue));
  const s = d.stats;
  return (
    <>
      <PageHead title="Dashboard" sub="How the shop is doing" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New orders" value={s.newOrders} sub="waiting for you" to="/orders" accent="#8b7bff" />
        <Stat label="In progress" value={s.pendingDelivery} sub="confirmed → out for delivery" to="/orders" accent="#22d3ee" />
        <Stat label="Today" value={money(s.revenueToday)} sub={`${s.ordersToday} orders`} accent="#4ade80" />
        <Stat label="All-time revenue" value={money(s.revenueTotal)} sub={`${s.ordersTotal} orders`} accent="#facc15" />
        <Stat label="Products live" value={s.products} to="/products" accent="#f472b6" />
        <Stat label="Customers" value={s.customers} to="/customers" accent="#fb923c" />
        <Stat label="Free vs paid delivery" value={`${s.freeDeliveries} / ${s.paidDeliveries}`} sub="inside / outside radius" accent="#34d399" />
        <Stat label="To review" value={s.unreadMessages + s.pendingReviews} sub={`${s.unreadMessages} messages · ${s.pendingReviews} reviews`} to="/inbox" accent="#fb7185" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">Revenue — last 7 days</h2>
          <div className="flex h-44 items-end gap-2" role="img" aria-label="Bar chart of revenue for the last 7 days">
            {d.days.map((x) => (
              <div key={x.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-muted">{x.revenue ? money(x.revenue) : ''}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-neon/40 to-cyan" style={{ height: `${Math.max(3, (x.revenue / max) * 100)}%`, opacity: x.revenue ? 1 : 0.25 }} title={`${x.orders} orders`} />
                <span className="text-[11px] text-muted">{new Date(x.day).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Low stock</h2>
          {d.lowStock.length === 0 ? <p className="text-sm text-muted">All stocked up 🎉</p> : <ul className="space-y-2 text-sm">{d.lowStock.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate">{p.name}</span><b className={p.stock === 0 ? 'text-rose-300' : 'text-amber-300'}>{p.stock}</b></li>)}</ul>}
          <Link to="/products?stock=low" className="mt-3 inline-block text-xs text-cyan">View all →</Link>
        </section>
        <section className="card overflow-x-auto lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-2"><h2 className="font-bold">Recent orders</h2><Link to="/orders" className="text-xs text-cyan">All orders →</Link></div>
          <table className="w-full"><thead><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Total</th><th className="th">Status</th><th className="th">Placed</th></tr></thead>
            <tbody>{d.recent.map((o) => <tr key={o.id}><td className="td font-mono text-xs">{o.orderNo}</td><td className="td">{o.customer.name}</td><td className="td">{money(o.total)}</td><td className="td"><StatusBadge s={o.status} /></td><td className="td text-muted">{when(o.createdAt)}</td></tr>)}
              {d.recent.length === 0 && <tr><td className="td text-muted" colSpan={5}>No orders yet.</td></tr>}</tbody></table>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Top sellers</h2>
          {d.top.length === 0 ? <p className="text-sm text-muted">Sales will show up here.</p> : <ol className="space-y-2 text-sm">{d.top.map((p, i) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate">{i + 1}. {p.name}</span><b>{p.sold}</b></li>)}</ol>}
        </section>
      </div>
    </>
  );
}
