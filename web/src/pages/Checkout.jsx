import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, ArrowRight, Banknote, CreditCard, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import { money } from '../lib/format.js';
import { usePayment } from '../lib/pay.jsx';
import { Empty, Field, Spinner, toast, usePageTitle } from '../components/ui.jsx';
import DeliveryPicker, { QuoteResult } from '../components/DeliveryPicker.jsx';
import { Totals, useCartTotals } from './Cart.jsx';

const STEPS = ['Your details', 'Address', 'Delivery', 'Review', 'Payment'];
const MOBILE = /^(\+?91)?[6-9]\d{9}$/;

function validate(step, f) {
  const e = {};
  if (step === 0) {
    if (f.name.trim().length < 2) e.name = 'Please enter your full name';
    if (!MOBILE.test(f.phone.replace(/[\s()-]/g, ''))) e.phone = 'Enter a valid 10-digit mobile number';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email or leave it blank';
  }
  if (step === 1) {
    if (!f.house.trim()) e.house = 'House / building is required';
    if (f.line.trim().length < 3) e.line = 'Street / address is required';
    if (f.area.trim().length < 2) e.area = 'Area / locality is required';
    if (!/^\d{6}$/.test(f.pincode)) e.pincode = 'PIN code must be 6 digits';
  }
  return e;
}

export default function Checkout() {
  usePageTitle('Checkout');
  const nav = useNavigate();
  const cart = useStore((s) => s.cart);
  const user = useStore((s) => s.user);
  const settings = useStore((s) => s.settings);
  const location = useStore((s) => s.location);
  const setLocation = useStore((s) => s.setLocation);
  const clearCart = useStore((s) => s.clearCart);
  const sync = useStore((s) => s.syncCart);
  const t = useCartTotals();
  const { start, modal } = usePayment();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [f, setF] = useState({ name: '', phone: '', email: '', house: '', line: '', area: '', landmark: '', pincode: '', instructions: '', method: 'COD', acceptFee: false });
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => { sync(); }, [sync]);
  useEffect(() => {
    if (!user) return;
    setF((x) => ({ ...x, name: x.name || user.name, phone: x.phone || user.phone || '', email: x.email || user.email }));
    api('/account/addresses').then(setSaved).catch(() => {});
  }, [user]);
  useEffect(() => { if (settings) setF((x) => (settings.cod_enabled === '1' ? x : { ...x, method: 'ONLINE' })); }, [settings]);

  const quote = location?.quote;
  const outside = quote && quote.deliverable && !quote.free;
  const out = useMemo(() => cart.filter((l) => l.product.stock < l.quantity), [cart]);

  if (!cart.length) return <div className="container-x py-16"><Empty icon="🛒" title="Nothing to check out">Your cart is empty.<div className="mt-4"><Link to="/shop" className="btn btn-primary">Browse products</Link></div></Empty></div>;

  const fillSaved = (a) => {
    setF((x) => ({ ...x, name: a.name || x.name, phone: a.phone || x.phone, house: a.house, line: a.address, area: a.area, landmark: a.landmark, pincode: a.pincode }));
    if (a.lat != null) api('/delivery/quote', { method: 'POST', body: { lat: a.lat, lng: a.lng } }).then((quote) => setLocation({ lat: a.lat, lng: a.lng, quote, label: a.label })).catch(() => {});
  };

  const next = () => {
    if (out.length) { setProblem(`${out[0].product.name} — only ${Math.max(0, out[0].product.stock)} available. Please update your cart.`); return; }
    const e = validate(step, f);
    if (step === 2) {
      if (!location) e.location = 'Please pick your delivery location on the map';
      else if (!quote.deliverable) e.location = quote.message;
      else if (outside && !f.acceptFee) e.accept = `Please confirm the ₹${quote.fee} delivery charge to continue`;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setProblem(''); setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const place = async () => {
    setBusy(true); setProblem('');
    try {
      const body = {
        items: cart.map((l) => ({ productId: l.id, quantity: l.quantity })),
        customer: { name: f.name.trim(), phone: f.phone, email: f.email.trim() },
        address: { house: f.house, line: f.line, area: f.area, landmark: f.landmark, pincode: f.pincode, instructions: f.instructions, lat: location.lat, lng: location.lng },
        paymentMethod: f.method, acceptOutsideFee: !!f.acceptFee,
      };
      const { order, payment } = await api('/orders', { method: 'POST', body });
      sessionStorage.setItem('dp-last-order', JSON.stringify({ orderNo: order.orderNo, phone: f.phone }));
      if (f.method === 'ONLINE') {
        // keep this page mounted while the payment window is open; the order already exists either way
        const res = await start({ orderNo: order.orderNo, payment, amount: order.total, customer: { name: f.name, phone: f.phone, email: f.email } });
        if (!res.paid && res.error) toast(res.error, 'error');
      }
      clearCart();
      nav(`/order/${order.orderNo}`, { replace: true });
    } catch (err) {
      setBusy(false);
      if (err.data?.problems) { setProblem(err.message); sync(); setStep(3); } else setProblem(err.message);
    }
  };

  return (
    <div className="container-x py-6 md:py-10">
      <h1 className="mb-6 font-display text-3xl font-extrabold">Checkout</h1>
      <ol className="mb-8 flex items-center gap-1.5 overflow-x-auto no-scrollbar" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex shrink-0 items-center gap-1.5" aria-current={i === step ? 'step' : undefined}>
            <button disabled={i >= step} onClick={() => setStep(i)} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${i === step ? 'bg-gradient-to-r from-neon/30 to-cyan/30 text-white neon-ring' : i < step ? 'text-emerald-300' : 'text-muted'}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i < step ? 'bg-emerald-400 text-black' : i === step ? 'bg-white text-black' : 'bg-white/10'}`}>{i < step ? <Check size={14} /> : i + 1}</span>
              <span className={i === step ? '' : 'hidden sm:inline'}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-line sm:w-8" />}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="glass rounded-3xl p-5 md:p-7">
          {problem && <div className="mb-5 rounded-2xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">{problem}</div>}

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">Your details</h2>
              {!user && <p className="rounded-xl bg-white/5 p-3 text-sm text-muted">Checking out as a guest. <Link to="/login?next=/checkout" className="text-cyan underline">Log in</Link> to use saved addresses and see your order history.</p>}
              <Field label="Full name" error={errors.name}><input className="input" value={f.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} /></Field>
              <Field label="Mobile number" error={errors.phone} hint="We’ll call or WhatsApp only about your delivery."><input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" aria-invalid={!!errors.phone} /></Field>
              <Field label="Email (optional)" error={errors.email}><input className="input" value={f.email} onChange={set('email')} type="email" autoComplete="email" aria-invalid={!!errors.email} /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">Delivery address</h2>
              {saved.length > 0 && (
                <div className="flex flex-wrap gap-2">{saved.map((a) => <button key={a.id} onClick={() => fillSaved(a)} className="chip !px-3 !py-2 hover:bg-white/15">📍 {a.label}: {a.house}, {a.area}</button>)}</div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="House / building" error={errors.house}><input className="input" value={f.house} onChange={set('house')} autoComplete="address-line1" placeholder="Flat 4B, Green Apartments" aria-invalid={!!errors.house} /></Field>
                <Field label="Area / locality" error={errors.area}><input className="input" value={f.area} onChange={set('area')} autoComplete="address-level3" aria-invalid={!!errors.area} /></Field>
              </div>
              <Field label="Street / address" error={errors.line}><input className="input" value={f.line} onChange={set('line')} autoComplete="address-line2" aria-invalid={!!errors.line} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Landmark (optional)"><input className="input" value={f.landmark} onChange={set('landmark')} placeholder="Near the temple" /></Field>
                <Field label="PIN code" error={errors.pincode}><input className="input" value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" autoComplete="postal-code" aria-invalid={!!errors.pincode} /></Field>
              </div>
              <Field label="Delivery instructions (optional)"><textarea className="input" rows={2} value={f.instructions} onChange={set('instructions')} placeholder="Ring the bell twice, call on arrival…" maxLength={300} /></Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">Delivery location</h2>
              <p className="text-sm text-muted">Drop a pin on your delivery spot. We measure the distance from our shop and show your delivery charge instantly.</p>
              <DeliveryPicker value={location} onChange={setLocation}
                onAddress={(a) => setF((x) => ({ ...x, line: x.line || a.line || '', area: x.area || a.area || '', pincode: x.pincode || a.pincode || '' }))} />
              <QuoteResult quote={quote} />
              {errors.location && <p className="text-sm font-medium text-rose-300" role="alert">{errors.location}</p>}
              {outside && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-400/40 p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#8b7bff]" checked={f.acceptFee} onChange={set('acceptFee')} />
                  <span>I understand my location is outside the free {quote.radiusKm} km zone and agree to pay a delivery charge of <b>₹{quote.fee}</b>.</span>
                </label>
              )}
              {errors.accept && <p className="text-sm font-medium text-rose-300" role="alert">{errors.accept}</p>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-xl font-bold">Review your order</h2>
              <ul className="divide-y divide-line">
                {cart.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-3">
                    <img src={l.product.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-semibold">{l.product.name}</p><p className="text-xs text-muted">{l.quantity} × {money(l.product.salePrice)}</p></div>
                    <p className="font-bold">{money(l.product.salePrice * l.quantity)}</p>
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/5 p-4 text-sm"><div className="mb-1 flex justify-between"><b>Contact</b><button className="text-cyan" onClick={() => setStep(0)}>Edit</button></div>{f.name}<br />{f.phone}{f.email && <><br />{f.email}</>}</div>
                <div className="rounded-2xl bg-white/5 p-4 text-sm"><div className="mb-1 flex justify-between"><b>Deliver to</b><button className="text-cyan" onClick={() => setStep(1)}>Edit</button></div>{f.house}, {f.line}<br />{f.area} – {f.pincode}{f.landmark && <><br />Near {f.landmark}</>}</div>
              </div>
              <QuoteResult quote={quote} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">Payment method</h2>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
                {[['COD', Banknote, 'Cash on Delivery', 'Pay in cash or UPI when your order arrives.', settings?.cod_enabled !== '0'], ['ONLINE', CreditCard, 'Pay Online', 'UPI, cards & netbanking via a secure gateway.', settings?.online_enabled !== '0']].filter((m) => m[4]).map(([v, Icon, t1, d]) => (
                  <button key={v} role="radio" aria-checked={f.method === v} onClick={() => setF({ ...f, method: v })} className={`rounded-2xl border p-4 text-left transition ${f.method === v ? 'border-neon bg-neon/10 neon-ring' : 'border-line bg-white/5 hover:bg-white/10'}`}>
                    <Icon className="mb-2 text-cyan" /><p className="font-bold">{t1}</p><p className="text-sm text-muted">{d}</p>
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted"><Lock size={14} /> We never see or store your card details. Online payments are handled by the payment gateway.</p>
              <p className="text-xs text-muted">By placing your order you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
            </div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            {step > 0 ? <button onClick={() => setStep(step - 1)} className="btn btn-ghost" disabled={busy}><ArrowLeft size={16} /> Back</button> : <Link to="/cart" className="btn btn-ghost"><ArrowLeft size={16} /> Cart</Link>}
            {step < 4 ? <button onClick={next} className="btn btn-primary !px-7">Continue <ArrowRight size={16} /></button>
              : <button onClick={place} disabled={busy} className="btn btn-primary !px-7 !py-3.5 text-base">{busy ? <Spinner /> : <>{f.method === 'COD' ? 'Place order' : 'Pay'} · {money(t.total)}</>}</button>}
          </div>
        </div>

        <aside className="h-fit space-y-3 lg:sticky lg:top-28">
          <div className="glass rounded-3xl p-5">
            <h2 className="mb-3 font-display text-lg font-bold">Summary</h2>
            <Totals t={t} compact />
          </div>
        </aside>
      </div>
      {modal}
    </div>
  );
}
