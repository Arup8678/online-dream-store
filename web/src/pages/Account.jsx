import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import { money, dateOnly, STATUS } from '../lib/format.js';
import { Empty, Field, Spinner, toast, usePageTitle } from '../components/ui.jsx';

const TABS = [['orders', '📦 Orders'], ['addresses', '📍 Addresses'], ['profile', '👤 Profile']];

function Orders() {
  const [list, setList] = useState(null);
  useEffect(() => { api('/account/orders').then(setList).catch(() => setList([])); }, []);
  if (!list) return <Spinner />;
  if (!list.length) return <Empty icon="📦" title="No orders yet">When you order while logged in, it shows up here.<div className="mt-4"><Link to="/shop" className="btn btn-primary">Start shopping</Link></div></Empty>;
  return (
    <ul className="space-y-3">
      {list.map((o) => (
        <li key={o.id} className="glass rounded-3xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-mono text-sm font-bold">{o.orderNo}</p><p className="text-xs text-muted">{dateOnly(o.createdAt)} · {o.items.length} item{o.items.length > 1 ? 's' : ''}</p></div>
            <span className="rounded-full px-3 py-1 text-xs font-extrabold text-black" style={{ background: STATUS[o.status].color }}>{STATUS[o.status].label}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">{o.items.slice(0, 6).map((i, k) => <img key={k} src={i.image} alt={i.name} title={i.name} className="h-12 w-12 rounded-xl object-cover" />)}</div>
          <div className="mt-3 flex items-center justify-between"><b>{money(o.total)}</b><Link className="btn btn-ghost btn-sm" to={`/track?o=${o.orderNo}&p=${encodeURIComponent(o.customer.phone)}`}>Track</Link></div>
        </li>
      ))}
    </ul>
  );
}

function Addresses() {
  const [list, setList] = useState(null);
  const [f, setF] = useState(null);
  const load = () => api('/account/addresses').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const save = async (e) => {
    e.preventDefault();
    try { await api('/account/addresses', { method: 'POST', body: { ...f, isDefault: false } }); setF(null); load(); toast('Address saved'); }
    catch (err) { toast(err.message, 'error'); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Saved addresses speed up checkout. You’ll confirm the map pin for each order.</p>
      {!list ? <Spinner /> : list.map((a) => (
        <div key={a.id} className="glass flex items-start justify-between gap-3 rounded-2xl p-4 text-sm">
          <div><b>{a.label}</b>{a.isDefault && <span className="chip ml-2">Default</span>}<p className="text-muted">{a.house}, {a.address}, {a.area} – {a.pincode}</p></div>
          <button className="btn btn-danger btn-sm" onClick={async () => { await api(`/account/addresses/${a.id}`, { method: 'DELETE' }); load(); }}>Remove</button>
        </div>
      ))}
      {f ? (
        <form onSubmit={save} className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
          <Field label="Label"><input className="input" value={f.label} onChange={set('label')} /></Field>
          <Field label="House / building"><input className="input" value={f.house} onChange={set('house')} required /></Field>
          <div className="sm:col-span-2"><Field label="Street / address"><input className="input" value={f.address} onChange={set('address')} required /></Field></div>
          <Field label="Area"><input className="input" value={f.area} onChange={set('area')} required /></Field>
          <Field label="PIN code"><input className="input" inputMode="numeric" maxLength={6} value={f.pincode} onChange={set('pincode')} required pattern="\d{6}" /></Field>
          <Field label="Landmark"><input className="input" value={f.landmark} onChange={set('landmark')} /></Field>
          <div className="flex items-end gap-2"><button className="btn btn-primary flex-1">Save</button><button type="button" className="btn btn-ghost" onClick={() => setF(null)}>Cancel</button></div>
        </form>
      ) : <button className="btn btn-ghost" onClick={() => setF({ label: 'Home', house: '', address: '', area: '', pincode: '', landmark: '' })}>+ Add address</button>}
    </div>
  );
}

function Profile() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const [f, setF] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const saveProfile = async (e) => {
    e.preventDefault();
    try { const r = await api('/account/profile', { method: 'PUT', body: f }); setUser(r.user); toast('Profile updated'); } catch (err) { toast(err.message, 'error'); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    try { await api('/account/password', { method: 'PUT', body: pw }); setPw({ current: '', next: '' }); toast('Password changed'); } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={saveProfile} className="glass space-y-4 rounded-3xl p-5">
        <h3 className="font-display font-bold">Your details</h3>
        <Field label="Email"><input className="input opacity-60" value={user.email} disabled /></Field>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></Field>
        <Field label="Mobile"><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <button className="btn btn-primary">Save</button>
      </form>
      <form onSubmit={savePw} className="glass space-y-4 rounded-3xl p-5">
        <h3 className="font-display font-bold">Change password</h3>
        <Field label="Current password"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></Field>
        <Field label="New password"><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={6} autoComplete="new-password" /></Field>
        <button className="btn btn-primary">Update password</button>
      </form>
    </div>
  );
}

export default function Account() {
  usePageTitle('My account');
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const [tab, setTab] = useState('orders');
  const [ready, setReady] = useState(!!user);
  const nav = useNavigate();
  useEffect(() => { api('/auth/me').then((r) => { setUser(r.user); setReady(true); }).catch(() => setReady(true)); }, [setUser]);
  if (!ready) return <div className="grid min-h-[50dvh] place-items-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login?next=/account" replace />;
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); nav('/'); };
  return (
    <div className="container-x max-w-4xl py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl font-extrabold">Hi, {user.name.split(' ')[0]} 👋</h1><p className="text-muted">{user.email}</p></div>
        <div className="flex gap-2"><Link to="/wishlist" className="btn btn-ghost btn-sm">♡ Wishlist</Link><button onClick={logout} className="btn btn-ghost btn-sm">Log out</button></div>
      </div>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-white text-black' : 'glass text-muted'}`}>{l}</button>)}
      </div>
      {tab === 'orders' && <Orders />}{tab === 'addresses' && <Addresses />}{tab === 'profile' && <Profile />}
    </div>
  );
}
