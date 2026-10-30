import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, MessageCircle, Truck, BadgeCheck, MousePointerClick, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import Hero from '../components/Hero.jsx';
import ProductCard, { ProductGridSkeleton } from '../components/ProductCard.jsx';
import { Reveal, SectionHead, Stars, Magnetic, usePageTitle, toast, Spinner } from '../components/ui.jsx';

function Categories() {
  const cats = useStore((s) => s.categories);
  return (
    <section id="categories" className="container-x scroll-mt-24 py-14 md:py-20">
      <SectionHead eyebrow="Browse" title="Popular Categories" sub="Everything a school-going, play-loving kid needs — in one place." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {(cats || Array.from({ length: 8 })).map((c, i) => c ? (
          <Reveal key={c.slug} delay={(i % 4) * 0.06}>
            <Link to={`/category/${c.slug}`} className="glass group relative flex aspect-[4/3.4] flex-col justify-end overflow-hidden rounded-3xl p-4 transition hover:-translate-y-1.5 hover:border-white/30 sm:aspect-[4/3]"
              style={{ '--a': c.accent, backgroundImage: `radial-gradient(120% 90% at 85% 0%, ${c.accent}55, transparent 60%)` }}>
              <span className="absolute right-3 top-2 text-6xl transition duration-500 group-hover:-rotate-6 group-hover:scale-125 sm:text-7xl" style={{ filter: `drop-shadow(0 14px 18px ${c.accent}66)` }}>{c.icon}</span>
              <h3 className="font-display text-base font-bold leading-tight sm:text-lg">{c.name}</h3>
              <p className="text-xs text-muted">{c.productCount} products</p>
              <ArrowRight size={16} className="absolute bottom-4 right-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </Link>
          </Reveal>
        ) : <div key={i} className="skeleton aspect-[4/3] rounded-3xl" />)}
      </div>
    </section>
  );
}

function ProductRow({ title, eyebrow, sub, params, link, scroll = false }) {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/products', { params: { limit: 8, ...params } }).then((r) => setItems(r.items)).catch(() => setItems([])); }, []); // eslint-disable-line
  if (items && !items.length) return null;
  return (
    <section className="container-x py-10 md:py-14">
      <SectionHead eyebrow={eyebrow} title={title} sub={sub} action={<Link to={link} className="btn btn-ghost btn-sm">View all <ArrowRight size={15} /></Link>} />
      {!items ? <ProductGridSkeleton n={4} /> : scroll ? (
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
          {items.slice(0, 8).map((p, i) => <div key={p.id} className="w-[44vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none"><ProductCard product={p} index={i} /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">{items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
      )}
    </section>
  );
}

function DeliveryZone() {
  const s = useStore((x) => x.settings);
  const km = s?.free_radius_km || 5;
  return (
    <section className="container-x py-14 md:py-20">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-[2rem] p-6 md:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Local delivery</p>
              <h2 className="font-display text-3xl font-extrabold md:text-5xl">Free Delivery<br /><span className="gradient-text">Within {km} KM</span></h2>
              <p className="mt-4 max-w-md text-muted">Live inside our {km} km circle and your order arrives at your door at no extra cost — no minimum order. Slightly further? We still deliver for a small, clearly shown fee. Just drop a pin at checkout and we calculate it instantly.</p>
              <ul className="mt-5 space-y-2 text-sm">
                <li>📍 Pick your exact location on the map</li>
                <li>⚡ Instant distance check — no surprises at the door</li>
                <li>🧾 Pay by Cash on Delivery or online</li>
              </ul>
              <Magnetic className="mt-7"><Link to="/shop" className="btn btn-primary">Start shopping <ArrowRight size={17} /></Link></Magnetic>
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-sm" aria-hidden="true">
              {[100, 72, 44].map((p, i) => <div key={p} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/30" style={{ width: `${p}%`, height: `${p}%`, background: i === 0 ? 'radial-gradient(circle, rgb(52 211 153 / .14), rgb(52 211 153 / .02))' : 'transparent' }} />)}
              <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left rounded-tr-full" style={{ background: 'conic-gradient(from 0deg at 0% 0%, rgb(52 211 153 / .4), transparent 25%)', animation: 'sweep 4s linear infinite', transform: 'translate(0,0)' }} />
              <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-gradient-to-br from-neon to-cyan text-3xl shadow-[0_0_40px_rgba(139,123,255,.7)]">🏪</div>
              <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan/60" style={{ animation: 'pulse-ring 2.4s ease-out infinite' }} />
              <span className="absolute left-[18%] top-[30%] text-2xl">🏠</span><span className="absolute right-[16%] top-[58%] text-2xl">🏠</span><span className="absolute bottom-[14%] left-[40%] text-2xl">🏠</span>
              <span className="absolute -right-1 top-1/2 -translate-y-1/2 rounded-full bg-emerald-400 px-2.5 py-1 text-xs font-extrabold text-black">{km} km</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Offers() {
  const [offers, setOffers] = useState([]);
  useEffect(() => { api('/offers').then(setOffers).catch(() => {}); }, []);
  if (!offers.length) return null;
  return (
    <section className="container-x pt-10">
      <SectionHead eyebrow="Deals" title="Special Offers" />
      <div className="grid gap-4 md:grid-cols-3">
        {offers.map((o, i) => (
          <Reveal key={o.id} delay={i * 0.08}>
            <Link to={o.link} className="glass group relative block overflow-hidden rounded-3xl p-6 transition hover:-translate-y-1" style={{ backgroundImage: `linear-gradient(135deg, ${o.accent}38, transparent 70%)` }}>
              {o.badge && <span className="rounded-full px-3 py-1 text-xs font-extrabold text-black" style={{ background: o.accent }}>{o.badge}</span>}
              <h3 className="mt-4 font-display text-2xl font-extrabold">{o.title}</h3>
              <p className="mt-1 text-sm text-muted">{o.subtitle}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: o.accent }}>Shop the deal <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Why() {
  const s = useStore((x) => x.settings);
  const km = s?.free_radius_km || 5;
  const items = [
    [Zap, 'Local & Fast Delivery', 'Same-day delivery from our neighbourhood shop.'],
    [Truck, `Free Delivery Within ${km} KM`, 'No minimum order inside our delivery zone.'],
    [BadgeCheck, 'Quality Products', 'Trusted brands, checked by us before they reach you.'],
    [MousePointerClick, 'Easy Ordering', 'Order in a few taps — or message us on WhatsApp.'],
    [ShieldCheck, 'Secure Payments', 'Cash on Delivery, or online through a secure gateway. We never store card details.'],
  ];
  return (
    <section className="container-x py-14 md:py-20">
      <SectionHead eyebrow="Why us" title="Why Shop With Us?" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={i * 0.06}>
            <div className="glass h-full rounded-3xl p-5 transition hover:-translate-y-1 hover:border-neon/50">
              <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-neon/30 to-cyan/20 text-cyan"><Icon size={22} /></span>
              <h3 className="font-display font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Reviews() {
  const [list, setList] = useState([]);
  useEffect(() => { api('/reviews/featured').then(setList).catch(() => {}); }, []);
  if (!list.length) return null;
  return (
    <section className="container-x py-10 md:py-14">
      <SectionHead eyebrow="Love from our customers" title="Customer Reviews" />
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {list.slice(0, 6).map((r, i) => (
          <Reveal key={r.id} delay={(i % 3) * 0.08} className="w-[82vw] max-w-sm shrink-0 snap-start md:w-auto md:max-w-none">
            <figure className="glass flex h-full flex-col rounded-3xl p-5">
              <Stars value={r.rating} size={16} />
              <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed">“{r.body}”</blockquote>
              <figcaption className="mt-4 text-sm"><b>{r.author}</b> <span className="text-muted">on </span><Link to={`/product/${r.slug}`} className="text-cyan hover:underline">{r.product}</Link></figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Newsletter() {
  const s = useStore((x) => x.settings);
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api('/newsletter', { method: 'POST', body: { contact: v } }); toast('Thanks! You are on the list.'); setV(''); }
    catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  };
  return (
    <section className="container-x py-14">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-neon/40 via-[#3b2fb5]/40 to-cyan/30 p-px">
          <div className="rounded-[calc(2rem-1px)] bg-ink-2/95 p-7 text-center md:p-12">
            <h2 className="font-display text-2xl font-extrabold md:text-4xl">Get offers before everyone else</h2>
            <p className="mx-auto mt-2 max-w-lg text-muted">Back-to-school deals, new toys and festival gifts — straight to your inbox or WhatsApp. No spam.</p>
            <form onSubmit={submit} className="mx-auto mt-6 flex max-w-lg flex-col gap-3 sm:flex-row">
              <input value={v} onChange={(e) => setV(e.target.value)} className="input" placeholder="Email or mobile number" aria-label="Email or mobile number" required />
              <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Subscribe'}</button>
            </form>
            <p className="my-4 text-xs text-muted">or</p>
            <a href={`https://wa.me/${s?.whatsapp_number || ''}?text=${encodeURIComponent('Hi! I would like to know about offers.')}`} target="_blank" rel="noreferrer" className="btn btn-ghost !border-emerald-400/40 !text-emerald-300"><MessageCircle size={18} /> Chat with us on WhatsApp</a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  usePageTitle('');
  return (
    <>
      <Hero />
      <Categories />
      <ProductRow eyebrow="Handpicked" title="Featured Products" sub="Our favourites this season." params={{ featured: 1 }} link="/shop?featured=1" />
      <ProductRow eyebrow="Most loved" title="Best Sellers" params={{ bestSeller: 1, sort: 'popular' }} link="/shop?bestSeller=1" scroll />
      <DeliveryZone />
      <Offers />
      <ProductRow eyebrow="Just in" title="New Arrivals" params={{ newArrival: 1, sort: 'newest' }} link="/category/new-arrivals" />
      <Why />
      <Reviews />
      <Newsletter />
    </>
  );
}
