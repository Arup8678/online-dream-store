import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Tags, Users, Star, Megaphone, Settings as Cog, LogOut, Menu, X, ExternalLink } from 'lucide-react';
import { api } from './api.js';
import { Toaster } from './ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Products from './pages/Products.jsx';
import Categories from './pages/Categories.jsx';
import Customers from './pages/Customers.jsx';
import Inbox from './pages/Inbox.jsx';
import Offers from './pages/Offers.jsx';
import Settings from './pages/Settings.jsx';

function Login({ onLogin }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api('/auth/login', { method: 'POST', body: f }); onLogin(r.user); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div className="grid min-h-dvh place-items-center p-4" style={{ backgroundImage: 'radial-gradient(800px 400px at 70% 0%, rgb(139 123 255 / .2), transparent)' }}>
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
        <div className="text-center"><div className="text-4xl">🛠️</div><h1 className="mt-2 text-2xl font-extrabold">Admin sign in</h1><p className="text-sm text-muted">Dream Palace shop manager</p></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="username" autoFocus /></div>
        <div><label className="label">Password</label><input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="current-password" /></div>
        {err && <p className="rounded-lg border border-rose-400/40 bg-rose-400/10 p-2.5 text-sm text-rose-100" role="alert">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

const NAV = [
  ['/', LayoutDashboard, 'Dashboard'], ['/orders', ShoppingCart, 'Orders'], ['/products', Package, 'Products'], ['/categories', Tags, 'Categories'],
  ['/customers', Users, 'Customers'], ['/inbox', Star, 'Reviews & Inbox'], ['/offers', Megaphone, 'Offers'], ['/settings', Cog, 'Settings'],
];

function Shell({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const side = (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="Admin">
      <div className="mb-4 flex items-center gap-2 px-2 pt-1 text-lg font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon to-cyan">🪐</span> Admin</div>
      {NAV.map(([to, Icon, label]) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-neon/20 text-white' : 'text-muted hover:bg-white/5 hover:text-white'}`}><Icon size={18} />{label}</NavLink>
      ))}
      <div className="mt-auto space-y-1 border-t border-line pt-3">
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-white/5 hover:text-white"><ExternalLink size={18} />View storefront</a>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-white/5 hover:text-white"><LogOut size={18} />Sign out</button>
        <p className="px-3 pt-1 text-xs text-muted">{user.email}</p>
      </div>
    </nav>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-panel lg:block">{side}</aside>
      <div className="flex items-center justify-between border-b border-line bg-panel p-3 lg:hidden">
        <button onClick={() => setOpen(true)} className="btn btn-ghost" aria-label="Menu"><Menu size={18} /></button>
        <b>Dream Palace Admin</b><span className="w-10" />
      </div>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} /><div className="absolute inset-y-0 left-0 w-64 bg-panel"><button className="btn btn-ghost btn-sm absolute right-2 top-2" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>{side}</div></div>}
      <main className="min-w-0 p-4 md:p-7">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="customers" element={<Customers />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="offers" element={<Offers />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { api('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)); }, []);
  if (user === undefined) return <p className="p-10 text-center text-muted">Loading…</p>;
  if (!user) return <Login onLogin={setUser} />;
  return <Shell user={user} onLogout={async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); }} />;
}
