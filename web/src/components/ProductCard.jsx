import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, ShoppingBag } from 'lucide-react';
import { useStore } from '../store.js';
import { Stars, Price, toast } from './ui.jsx';

export default function ProductCard({ product: p, index = 0 }) {
  const addToCart = useStore((s) => s.addToCart);
  const toggleWish = useStore((s) => s.toggleWish);
  const wished = useStore((s) => s.wishlist.some((w) => w.id === p.id));
  const ref = useRef(null);

  // subtle 3D tilt on mouse hover (no effect on touch)
  const move = (e) => {
    if (e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateZ(0)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };

  const add = (e) => {
    e.preventDefault();
    const res = addToCart(p, 1);
    if (!res.ok) toast(res.message, 'error');
    else toast(res.capped ? `Only ${p.stock} available — cart updated` : `Added “${p.name}” to cart`);
  };

  return (
    <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: Math.min(index % 6, 5) * 0.05 }}>
      <div ref={ref} onPointerMove={move} onPointerLeave={leave} style={{ transition: 'transform .25s ease-out' }}
        className="glass group relative flex h-full flex-col overflow-hidden rounded-3xl hover:border-white/25 hover:shadow-[0_20px_60px_-20px_rgba(139,123,255,.55)]">
        <Link to={`/product/${p.slug}`} className="relative block aspect-square overflow-hidden bg-ink-2" aria-label={p.name}>
          <img src={p.images[0]} alt={p.name} loading="lazy" width="400" height="400" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
          {p.images[1] && <img src={p.images[1]} alt="" loading="lazy" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
          <div className="absolute left-2.5 top-2.5 flex flex-col gap-1">
            {p.discountPercent > 0 && <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-extrabold text-black">{p.discountPercent}% OFF</span>}
            {p.newArrival && <span className="rounded-full bg-sun px-2 py-0.5 text-[11px] font-extrabold text-black">NEW</span>}
            {p.bestSeller && <span className="rounded-full bg-pink px-2 py-0.5 text-[11px] font-extrabold text-black">BEST SELLER</span>}
          </div>
          {!p.inStock && <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-bold">Out of stock</div>}
        </Link>
        <button onClick={() => { toggleWish(p); toast(wished ? 'Removed from wishlist' : 'Saved to wishlist'); }} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          className="glass absolute right-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-full transition hover:scale-110 active:scale-90">
          <Heart size={18} className={wished ? 'fill-pink text-pink' : ''} />
        </button>
        <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{p.brand || p.categoryName}</p>
          <Link to={`/product/${p.slug}`} className="line-clamp-2 min-h-[2.6em] font-display text-[15px] font-semibold leading-snug hover:text-cyan">{p.name}</Link>
          <Stars value={p.rating} count={p.ratingCount} />
          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            <Price product={p} />
          </div>
          <button onClick={add} disabled={!p.inStock} className="btn btn-primary btn-sm w-full"><ShoppingBag size={16} /> {p.inStock ? 'Add to Cart' : 'Sold out'}</button>
        </div>
      </div>
    </motion.article>
  );
}

export function ProductGridSkeleton({ n = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: n }, (_, i) => <div key={i} className="skeleton aspect-[3/4.4] rounded-3xl" />)}
    </div>
  );
}
