import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { useStore } from '../store.js';
import { money } from '../lib/format.js';
import { Empty, usePageTitle, toast } from '../components/ui.jsx';
import DeliveryStatus from '../components/DeliveryStatus.jsx';

export function useCartTotals() {
  const cart = useStore((s) => s.cart);
  const location = useStore((s) => s.location);
  const list = cart.reduce((a, l) => a + l.product.price * l.quantity, 0);
  const subtotal = cart.reduce((a, l) => a + l.product.salePrice * l.quantity, 0);
  const q = location?.quote;
  const delivery = q?.deliverable ? q.fee : 0;
  return { list, subtotal, discount: list - subtotal, quote: q, delivery, total: subtotal + delivery };
}

export function Totals({ t, compact }) {
  const q = t.quote;
  return (
    <dl className="space-y-2.5 text-sm">
      <div className="flex justify-between"><dt className="text-muted">Items total (MRP)</dt><dd>{money(t.list)}</dd></div>
      {t.discount > 0 && <div className="flex justify-between text-emerald-300"><dt>Discount</dt><dd>− {money(t.discount)}</dd></div>}
      <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(t.subtotal)}</dd></div>
      <div className="flex justify-between">
        <dt className="text-muted">Delivery</dt>
        <dd className={q?.free ? 'font-bold text-emerald-300' : ''}>{!q ? 'Pick location' : !q.deliverable ? 'Not available' : q.free ? 'FREE' : money(q.fee)}</dd>
      </div>
      <div className={`flex justify-between border-t border-line pt-3 font-display font-extrabold ${compact ? 'text-lg' : 'text-xl'}`}><dt>Total</dt><dd>{money(t.total)}</dd></div>
    </dl>
  );
}

export default function Cart() {
  usePageTitle('Your cart');
  const nav = useNavigate();
  const cart = useStore((s) => s.cart);
  const setQty = useStore((s) => s.setQty);
  const remove = useStore((s) => s.removeFromCart);
  const sync = useStore((s) => s.syncCart);
  const t = useCartTotals();
  useEffect(() => { sync(); }, [sync]);

  if (!cart.length) return <div className="container-x py-16"><Empty icon="🛒" title="Your cart is empty">Add a few things you like — pens, teddies, school bags…<div className="mt-5"><Link to="/shop" className="btn btn-primary">Start shopping</Link></div></Empty></div>;

  const bad = cart.filter((l) => l.product.stock <= 0);
  return (
    <div className="container-x py-6 md:py-10">
      <h1 className="mb-6 font-display text-3xl font-extrabold">Your Cart <span className="text-lg text-muted">({cart.reduce((a, l) => a + l.quantity, 0)} items)</span></h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-3">
          {cart.map((l) => {
            const p = l.product;
            const out = p.stock <= 0;
            return (
              <li key={l.id} className={`glass flex gap-3 rounded-3xl p-3 sm:gap-4 sm:p-4 ${out ? 'border-rose-400/40' : ''}`}>
                <Link to={`/product/${p.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl sm:h-28 sm:w-28"><img src={p.image} alt={p.name} className="h-full w-full object-cover" /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/product/${p.slug}`} className="line-clamp-2 font-display font-semibold leading-snug hover:text-cyan">{p.name}</Link>
                  <p className="text-xs text-muted">{p.brand}</p>
                  {out ? <p className="mt-1 text-sm font-semibold text-rose-300">Out of stock — remove to continue</p>
                    : l.quantity >= p.stock ? <p className="mt-1 text-xs text-amber-300">Max available: {p.stock}</p> : null}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="glass inline-flex items-center rounded-full" role="group" aria-label={`Quantity for ${p.name}`}>
                      <button onClick={() => setQty(l.id, l.quantity - 1)} disabled={l.quantity <= 1 || out} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 disabled:opacity-40" aria-label="Decrease"><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm font-bold">{l.quantity}</span>
                      <button onClick={() => { if (l.quantity >= p.stock) toast(`Only ${p.stock} in stock`, 'error'); else setQty(l.id, l.quantity + 1); }} disabled={out} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 disabled:opacity-40" aria-label="Increase"><Plus size={14} /></button>
                    </div>
                    <div className="text-right"><p className="font-display font-bold">{money(p.salePrice * l.quantity)}</p>{p.salePrice < p.price && <p className="text-xs text-muted line-through">{money(p.price * l.quantity)}</p>}</div>
                    <button onClick={() => remove(l.id)} className="grid h-9 w-9 place-items-center rounded-full text-rose-300 hover:bg-rose-400/15" aria-label={`Remove ${p.name}`}><Trash2 size={16} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
          <DeliveryStatus />
          <div className="glass rounded-3xl p-5">
            <h2 className="mb-4 font-display text-lg font-bold">Order summary</h2>
            <Totals t={t} />
            <button onClick={() => (bad.length ? toast('Please remove out-of-stock items first.', 'error') : nav('/checkout'))} className="btn btn-primary mt-5 w-full !py-3.5 text-base">Checkout <ArrowRight size={18} /></button>
            <Link to="/shop" className="mt-3 flex items-center justify-center gap-2 text-sm text-muted hover:text-white"><ShoppingBag size={15} /> Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
