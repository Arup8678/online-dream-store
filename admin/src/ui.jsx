import { useEffect, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { STATUS_COLOR, PAY_COLOR } from './api.js';

let list = []; const subs = new Set();
export function toast(message, kind = 'ok') {
  const t = { id: Math.random(), message, kind };
  list = [...list, t].slice(-3); subs.forEach((f) => f());
  setTimeout(() => { list = list.filter((x) => x !== t); subs.forEach((f) => f()); }, 3500);
}
export function Toaster() {
  const l = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => list);
  return <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">{l.map((t) => <div key={t.id} className={`card px-4 py-3 text-sm font-medium shadow-2xl ${t.kind === 'error' ? 'border-rose-400/50 text-rose-200' : ''}`}>{t.kind === 'error' ? '⚠️ ' : '✓ '}{t.message}</div>)}</div>;
}

export const StatusBadge = ({ s }) => <span className="badge text-black" style={{ background: STATUS_COLOR[s] }}>{s.replaceAll('_', ' ')}</span>;
export const PayBadge = ({ s }) => <span className="badge text-black" style={{ background: PAY_COLOR[s] }}>{s}</span>;

export function Field({ label, children, hint, error }) {
  return <div><label className="label">{label}</label>{children}{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}{error && <p className="mt-1 text-xs text-rose-300">{error}</p>}</div>;
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`card relative max-h-[94dvh] w-full overflow-y-auto p-5 ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close"><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then((data) => live && setState({ data, error: '', loading: false })).catch((e) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [...deps, tick]); // eslint-disable-line
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function PageHead({ title, sub, children }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold">{title}</h1>{sub && <p className="text-sm text-muted">{sub}</p>}</div><div className="flex flex-wrap gap-2">{children}</div></div>;
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return <div className="mt-4 flex items-center justify-center gap-3 text-sm"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button><span className="text-muted">Page {page} / {pages}</span><button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></div>;
}

export const Loading = () => <p className="p-6 text-sm text-muted">Loading…</p>;
export const ErrorBox = ({ msg }) => <p className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">{msg}</p>;
