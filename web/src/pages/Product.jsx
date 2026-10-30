import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Minus, Plus, ShoppingBag, Zap, Play, Share2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import { dateOnly } from '../lib/format.js';
import ProductCard from '../components/ProductCard.jsx';
import DeliveryStatus from '../components/DeliveryStatus.jsx';
import { Empty, Price, Stars, Skeleton, toast, usePageTitle, Field, Spinner } from '../components/ui.jsx';

function Gallery({ p }) {
  const media = useMemo(() => [...p.images.map((src) => ({ type: 'img', src })), ...(p.videoUrl ? [{ type: 'video', src: p.videoUrl }] : [])], [p]);
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(null);
  useEffect(() => setI(0), [p.id]);
  const cur = media[i];
  const youtube = cur?.type === 'video' && /youtu\.?be/.test(cur.src) ? `https://www.youtube.com/embed/${(cur.src.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1]}` : null;
  return (
    <div className="space-y-3">
      <div className="glass relative aspect-square overflow-hidden rounded-3xl"
        onPointerMove={(e) => { if (e.pointerType !== 'mouse' || cur?.type !== 'img') return; const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
        onPointerLeave={() => setZoom(null)}>
        <AnimatePresence mode="wait">
          <motion.div key={i} className="h-full w-full" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {cur?.type === 'img' && <img src={cur.src} alt={p.name} className="h-full w-full object-cover transition-transform duration-200" style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />}
            {cur?.type === 'video' && (youtube ? <iframe title="Product video" src={youtube} className="h-full w-full" allowFullScreen /> : <video src={cur.src} controls playsInline className="h-full w-full bg-black object-contain" />)}
          </motion.div>
        </AnimatePresence>
        {p.discountPercent > 0 && <span className="absolute left-3 top-3 rounded-full bg-emerald-400 px-3 py-1 text-sm font-extrabold text-black">{p.discountPercent}% OFF</span>}
      </div>
      {media.length > 1 && (
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto">
          {media.map((m, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={m.type === 'video' ? 'Play video' : `Image ${k + 1}`} aria-current={k === i}
              className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 transition ${k === i ? 'border-neon shadow-[0_0_20px_-4px_#8b7bff]' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              {m.type === 'img' ? <img src={m.src} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-panel"><Play /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Reviews({ product }) {
  const user = useStore((s) => s.user);
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ rating: 5, title: '', body: '', author: '' });
  const [busy, setBusy] = useState(false);
  const load = () => api(`/products/${product.id}/reviews`).then(setData).catch(() => setData({ reviews: [], distribution: {} }));
  useEffect(() => { load(); }, [product.id]); // eslint-disable-line
  const total = data ? Object.values(data.distribution).reduce((a, b) => a + b, 0) : 0;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api(`/products/${product.id}/reviews`, { method: 'POST', body: { ...form, author: user ? undefined : form.author } });
      toast('Thanks for your review!'); setForm({ rating: 5, title: '', body: '', author: '' }); load();
    } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  };
  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <div>
        <div className="glass rounded-3xl p-5">
          <p className="font-display text-5xl font-extrabold">{product.rating ? product.rating.toFixed(1) : '–'}</p>
          <Stars value={product.rating} size={18} /><p className="mt-1 text-sm text-muted">{total} review{total === 1 ? '' : 's'}</p>
          <div className="mt-4 space-y-1.5">
            {[5, 4, 3, 2, 1].map((r) => (
              <div key={r} className="flex items-center gap-2 text-xs"><span className="w-3">{r}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-300" style={{ width: total ? `${((data?.distribution[r] || 0) / total) * 100}%` : 0 }} /></div>
                <span className="w-5 text-right text-muted">{data?.distribution[r] || 0}</span></div>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="glass mt-4 space-y-3 rounded-3xl p-5">
          <h4 className="font-display font-bold">Write a review</h4>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((r) => <button type="button" key={r} role="radio" aria-checked={form.rating === r} aria-label={`${r} stars`} onClick={() => setForm({ ...form, rating: r })} className={`text-2xl transition hover:scale-125 ${r <= form.rating ? 'text-amber-300' : 'text-white/25'}`}>★</button>)}</div>
          {!user && <input className="input" placeholder="Your name" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} required minLength={2} />}
          <input className="input" placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} />
          <textarea className="input" rows={3} placeholder="What did you think?" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={1000} />
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Submit review'}</button>
        </form>
      </div>
      <div className="space-y-3">
        {!data ? <Skeleton className="h-32" /> : data.reviews.length === 0 ? <p className="text-muted">No reviews yet — be the first!</p> : data.reviews.map((r) => (
          <article key={r.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-muted">{r.author} · {dateOnly(r.created_at)}</span></div>
            {r.title && <h5 className="mt-2 font-semibold">{r.title}</h5>}
            {r.body && <p className="mt-1 text-sm text-white/80">{r.body}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('description');
  const addToCart = useStore((s) => s.addToCart);
  const toggleWish = useStore((s) => s.toggleWish);
  const wished = useStore((s) => data && s.wishlist.some((w) => w.id === data.product.id));
  const inCart = useStore((s) => (data ? s.cart.find((l) => l.id === data.product.id)?.quantity || 0 : 0));
  usePageTitle(data?.product.name);

  useEffect(() => {
    setData(null); setError(''); setQty(1); setTab('description');
    api(`/products/${slug}`).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <div className="container-x py-16"><Empty icon="🧐" title="Product not found">{error}<div className="mt-4"><Link to="/shop" className="btn btn-primary">Back to shop</Link></div></Empty></div>;
  if (!data) return <div className="container-x grid gap-8 py-10 md:grid-cols-2"><Skeleton className="aspect-square" /><div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40" /></div></div>;

  const { product: p, related } = data;
  const canAdd = Math.max(0, p.stock - inCart);
  const add = () => {
    const r = addToCart(p, qty);
    if (!r.ok) return toast(r.message, 'error');
    toast(r.capped ? `Only ${p.stock} available — cart updated` : `Added ${qty} × ${p.name} to cart`);
    return r;
  };
  const buyNow = () => { if (add()) nav('/checkout'); };
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: p.name, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast('Link copied'); } } catch { /* cancelled */ }
  };

  return (
    <div className="container-x py-6 md:py-10">
      <nav className="mb-4 text-xs text-muted" aria-label="Breadcrumb"><Link to="/" className="hover:text-white">Home</Link> / <Link to={`/category/${p.categorySlug}`} className="hover:text-white">{p.categoryName}</Link> / <span className="text-white">{p.name}</span></nav>
      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="md:sticky md:top-28 md:h-fit"><Gallery p={p} /></div>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan">{p.brand} · {p.subcategoryName || p.categoryName}</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight md:text-4xl">{p.name}</h1>
            <div className="mt-2 flex items-center gap-3"><Stars value={p.rating} count={p.ratingCount} size={16} /><span className="text-xs text-muted">SKU: {p.sku}</span></div>
          </div>
          <Price product={p} size="lg" />
          {p.discountPrice && <p className="-mt-3 text-sm text-emerald-300">You save ₹{(p.price - p.discountPrice).toFixed(0)}</p>}
          <p className={`text-sm font-semibold ${p.stock === 0 ? 'text-rose-300' : p.stock <= 5 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {p.stock === 0 ? '● Out of stock' : p.stock <= 5 ? `● Hurry — only ${p.stock} left` : '● In stock'}
          </p>
          <DeliveryStatus />
          {p.stock > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="glass inline-flex items-center rounded-full" role="group" aria-label="Quantity">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Decrease quantity"><Minus size={16} /></button>
                <span className="w-10 text-center font-bold" aria-live="polite">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(canAdd || 1, q + 1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Increase quantity"><Plus size={16} /></button>
              </div>
              {inCart > 0 && <span className="text-xs text-muted">{inCart} already in cart</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button onClick={add} disabled={p.stock === 0 || canAdd === 0} className="btn btn-primary flex-1 !py-3.5 sm:flex-none sm:!px-8"><ShoppingBag size={18} /> Add to Cart</button>
            <button onClick={buyNow} disabled={p.stock === 0 || canAdd === 0} className="btn btn-ghost flex-1 !py-3.5 sm:flex-none sm:!px-8 !border-neon/50"><Zap size={18} /> Buy Now</button>
            <button onClick={() => { toggleWish(p); toast(wished ? 'Removed from wishlist' : 'Saved to wishlist'); }} aria-pressed={wished} aria-label="Wishlist" className="btn btn-ghost !h-12 !w-12 !p-0"><Heart size={20} className={wished ? 'fill-pink text-pink' : ''} /></button>
            <button onClick={share} aria-label="Share" className="btn btn-ghost !h-12 !w-12 !p-0"><Share2 size={19} /></button>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Age group', p.ageGroup], ['Brand', p.brand], ['Size', p.size], ['Color', p.color]].filter(([, v]) => v).map(([k, v]) => <div key={k} className="glass rounded-2xl px-4 py-2.5"><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
          </dl>
        </div>
      </div>

      <section className="mt-14">
        <div className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
          {[['description', 'Description'], ['specs', 'Specifications'], ['reviews', `Reviews (${p.ratingCount})`]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`relative whitespace-nowrap px-4 py-3 text-sm font-semibold ${tab === k ? 'text-white' : 'text-muted hover:text-white'}`}>
              {l}{tab === k && <motion.span layoutId="ptab" className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-gradient-to-r from-neon to-cyan" />}
            </button>
          ))}
        </div>
        {tab === 'description' && <div className="max-w-3xl whitespace-pre-line leading-relaxed text-white/85">{p.description}</div>}
        {tab === 'specs' && (
          <dl className="glass max-w-2xl divide-y divide-line overflow-hidden rounded-3xl">
            {Object.entries({ SKU: p.sku, ...p.specs }).map(([k, v]) => <div key={k} className="grid grid-cols-2 gap-4 px-5 py-3 text-sm"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
        )}
        {tab === 'reviews' && <Reviews product={p} />}
      </section>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-extrabold md:text-3xl">You may also like</h2>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
            {related.slice(0, 8).map((r, i) => <div key={r.id} className="w-[44vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none"><ProductCard product={r} index={i} /></div>)}
          </div>
        </section>
      )}

      {p.stock > 0 && (
        <div className="glass safe-bottom fixed inset-x-0 bottom-[60px] z-30 flex items-center gap-3 border-x-0 px-4 py-2.5 md:hidden">
          <div className="min-w-0 flex-1"><p className="truncate text-xs text-muted">{p.name}</p><p className="font-display font-bold">₹{p.salePrice}</p></div>
          <button onClick={add} disabled={canAdd === 0} className="btn btn-primary btn-sm !px-5">Add to Cart</button>
        </div>
      )}
    </div>
  );
}
