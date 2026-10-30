import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import { Field, Spinner, usePageTitle } from '../components/ui.jsx';

export default function Login() {
  usePageTitle('Log in');
  const [params] = useSearchParams();
  const nav = useNavigate();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next') && params.get('next').startsWith('/') ? params.get('next') : '/account';
  if (user) return <Navigate to={next} replace />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = mode === 'login' ? { email: f.email, password: f.password } : { name: f.name, email: f.email, phone: f.phone || undefined, password: f.password };
      const r = await api(`/auth/${mode}`, { method: 'POST', body });
      setUser(r.user); nav(next, { replace: true });
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };
  return (
    <div className="container-x grid min-h-[70dvh] place-items-center py-10">
      <div className="glass w-full max-w-md rounded-3xl p-6 md:p-8">
        <div className="mb-6 grid grid-cols-2 rounded-full bg-white/5 p-1" role="tablist">
          {[['login', 'Log in'], ['register', 'Create account']].map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setErr(''); }} className={`rounded-full py-2 text-sm font-semibold transition ${mode === k ? 'bg-white text-black' : 'text-muted'}`}>{l}</button>)}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} required minLength={2} autoComplete="name" /></Field>}
          <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></Field>
          {mode === 'register' && <Field label="Mobile (optional)"><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>}
          <Field label="Password" hint={mode === 'register' ? 'At least 6 characters' : undefined}><input className="input" type="password" value={f.password} onChange={set('password')} required minLength={mode === 'register' ? 6 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>
          {err && <p className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">{err}</p>}
          <button className="btn btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner /> : mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">You can also order without an account — just go to checkout.</p>
      </div>
    </div>
  );
}
