import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Star, X, Loader2 } from 'lucide-react';
import { money } from '../lib/format.js';

/* ---------- toast ---------- */
let toasts = [];
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export function toast(message, kind = 'ok') {
  const t = { id: Math.random(), message, kind };
  toasts = [...toasts, t].slice(-3);
  emit();
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }, 3200);
}
export function Toaster() {
  const list = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
      {list.map((t) => (
        <motion.div key={t.id} initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }}
          className={`glass pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl ${t.kind === 'error' ? 'border-rose-400/50 text-rose-200' : 'text-white'}`}>
          {t.kind === 'error' ? '⚠️ ' : '✓ '}{t.message}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- small pieces ---------- */
export function Stars({ value = 0, count, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-amber-300 text-amber-300' : 'text-white/25'} />
        ))}
      </span>
      {count != null && <span className="text-xs text-muted">{value ? value.toFixed(1) : 'New'}{count ? ` (${count})` : ''}</span>}
    </span>
  );
}

export function Price({ product, size = 'md' }) {
  const big = size === 'lg';
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-display font-bold ${big ? 'text-3xl' : 'text-lg'}`}>{money(product.salePrice)}</span>
      {product.discountPrice && <>
        <span className={`text-muted line-through ${big ? 'text-base' : 'text-sm'}`}>{money(product.price)}</span>
        <span className={`rounded-md bg-emerald-400/15 px-1.5 py-0.5 font-bold text-emerald-300 ${big ? 'text-sm' : 'text-xs'}`}>{product.discountPercent}% OFF</span>
      </>}
    </div>
  );
}

export function Spinner({ className = '' }) { return <Loader2 className={`animate-spin ${className}`} size={18} />; }

export function Skeleton({ className = '' }) { return <div className={`skeleton ${className}`} />; }

export function Field({ label, error, children, hint }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-rose-300" role="alert">{error}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className={`glass-solid relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm !min-h-9 !w-9 !p-0" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/* ---------- motion helpers ---------- */
export function Reveal({ children, delay = 0, className = '', y = 24 }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

/** Button/link wrapper that drifts toward the pointer (fine pointers only). */
export function Magnetic({ children, strength = 0.25, className = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const fine = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;
  if (reduce || !fine) return <span className={`inline-flex ${className}`}>{children}</span>;
  return (
    <motion.span ref={ref} className={`inline-flex ${className}`} animate={pos} transition={{ type: 'spring', stiffness: 220, damping: 15, mass: 0.2 }}
      onPointerMove={(e) => { const r = ref.current.getBoundingClientRect(); setPos({ x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength }); }}
      onPointerLeave={() => setPos({ x: 0, y: 0 })}>
      {children}
    </motion.span>
  );
}

export function SectionHead({ eyebrow, title, sub, action }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-extrabold md:text-4xl">{title}</h2>
        {sub && <p className="mt-2 max-w-xl text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon = '🔭', title, children }) {
  return (
    <div className="glass mx-auto my-10 max-w-lg rounded-3xl p-8 text-center">
      <div className="mb-3 text-5xl">{icon}</div>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <div className="mt-2 text-muted">{children}</div>
    </div>
  );
}

export function usePageTitle(title) {
  useEffect(() => { document.title = title ? `${title} · Dream Palace` : 'Dream Palace — Everything for School, Play & More.'; }, [title]);
}

export function useIsLowPower() {
  const [low] = useState(() => {
    if (typeof window === 'undefined') return true;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const conn = navigator.connection;
    const saver = conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '');
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    let gl = false;
    try { const c = document.createElement('canvas'); gl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { gl = false; }
    return reduce || saver || !gl || cores <= 2 || mem <= 2;
  });
  return low;
}
