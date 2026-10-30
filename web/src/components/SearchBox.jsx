import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, TrendingUp, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { useStore } from '../store.js';

export default function SearchBox({ autoFocus = false, onDone, className = '' }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(autoFocus);
  const [sugg, setSugg] = useState(null);
  const [popular, setPopular] = useState([]);
  const [active, setActive] = useState(-1);
  const recent = useStore((s) => s.recent);
  const addRecent = useStore((s) => s.addRecent);
  const clearRecent = useStore((s) => s.clearRecent);
  const box = useRef(null);

  useEffect(() => { api('/search/popular').then(setPopular).catch(() => {}); }, []);
  useEffect(() => {
    const t = q.trim();
    if (!t) { setSugg(null); return; }
    const h = setTimeout(() => api('/search/suggest', { params: { q: t } }).then(setSugg).catch(() => setSugg(null)), 180);
    return () => clearTimeout(h);
  }, [q]);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);

  const go = (term) => {
    const t = term.trim();
    if (!t) return;
    addRecent(t);
    setOpen(false); setQ('');
    nav(`/search?q=${encodeURIComponent(t)}`);
    onDone?.();
  };
  const goTo = (path) => { setOpen(false); setQ(''); nav(path); onDone?.(); };

  // flat list of keyboard-navigable rows
  const rows = sugg ? [
    ...sugg.products.map((p) => ({ k: `p${p.id}`, run: () => goTo(`/product/${p.slug}`) })),
    ...sugg.categories.map((c) => ({ k: `c${c.slug}`, run: () => goTo(`/category/${c.slug}`) })),
    ...sugg.brands.map((b) => ({ k: `b${b}`, run: () => go(b) })),
  ] : [];

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && rows[active]) rows[active].run(); else go(q); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} role="search" className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setActive(-1); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} autoFocus={autoFocus}
          className="input !rounded-full !pl-11 !pr-10" placeholder="Search pens, teddy, school bags…" aria-label="Search products" autoComplete="off" enterKeyHint="search"
          role="combobox" aria-expanded={open} aria-controls="search-pop" />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"><X size={16} /></button>}
      </form>
      {open && (
        <div id="search-pop" className="glass-solid absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70dvh] overflow-y-auto rounded-2xl p-2 shadow-2xl">
          {!q.trim() ? (
            <>
              {recent.length > 0 && (
                <div className="p-2">
                  <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-wider text-muted"><span>Recent</span><button onClick={clearRecent} className="normal-case hover:text-white">Clear</button></div>
                  {recent.map((r) => <button key={r} onClick={() => go(r)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/10"><Clock size={14} className="text-muted" />{r}</button>)}
                </div>
              )}
              <div className="p-2">
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Popular right now</div>
                <div className="flex flex-wrap gap-2">{popular.map((r) => <button key={r} onClick={() => go(r)} className="chip hover:bg-white/15"><TrendingUp size={12} />{r}</button>)}</div>
              </div>
            </>
          ) : !sugg ? (
            <p className="p-4 text-sm text-muted">Searching…</p>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm">
              <p className="font-semibold">No quick matches for “{q}”.</p>
              <button onClick={() => go(q)} className="mt-1 text-cyan underline">Search everything for “{q}”</button>
            </div>
          ) : (
            <ul>
              {sugg.products.map((p, i) => (
                <li key={p.id}>
                  <button onClick={rows[i].run} onMouseEnter={() => setActive(i)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${active === i ? 'bg-white/10' : ''}`}>
                    <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1"><span className="line-clamp-1 text-sm font-semibold">{p.name}</span><span className="text-xs text-muted">{p.category}</span></span>
                    <span className="text-sm font-bold">{money(p.price)}</span>
                  </button>
                </li>
              ))}
              {sugg.categories.map((c, j) => {
                const i = sugg.products.length + j;
                return <li key={c.slug}><button onClick={rows[i].run} onMouseEnter={() => setActive(i)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-sm ${active === i ? 'bg-white/10' : ''}`}><span>{c.icon}</span> Category: <b>{c.name}</b></button></li>;
              })}
              {sugg.brands.map((b, j) => {
                const i = sugg.products.length + sugg.categories.length + j;
                return <li key={b}><button onClick={rows[i].run} onMouseEnter={() => setActive(i)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-sm ${active === i ? 'bg-white/10' : ''}`}>🏷️ Brand: <b>{b}</b></button></li>;
              })}
              <li><button onClick={() => go(q)} className="mt-1 w-full rounded-xl p-2 text-center text-sm font-semibold text-cyan hover:bg-white/10">See all results for “{q}”</button></li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
