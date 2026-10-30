import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api.js';
import { ErrorBox, Field, Loading, PageHead, toast, useAsync } from '../ui.jsx';

const pin = (e) => L.divIcon({ html: `<div class="pin">${e}</div>`, className: '', iconSize: [34, 34], iconAnchor: [17, 32] });

function ShopMap({ lat, lng, radius, onPick }) {
  const el = useRef(null); const m = useRef(null); const mk = useRef(null); const ci = useRef(null);
  useEffect(() => {
    const map = L.map(el.current).setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    mk.current = L.marker([lat, lng], { icon: pin('🏪'), draggable: true }).addTo(map);
    ci.current = L.circle([lat, lng], { radius: radius * 1000, color: '#34d399', weight: 2, fillOpacity: 0.1, dashArray: '6 6' }).addTo(map);
    mk.current.on('dragend', () => { const p = mk.current.getLatLng(); onPick(p.lat, p.lng); });
    map.on('click', (e) => onPick(e.latlng.lat, e.latlng.lng));
    m.current = map; setTimeout(() => map.invalidateSize(), 100);
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!isNaN(lat) && !isNaN(lng)) { mk.current?.setLatLng([lat, lng]); ci.current?.setLatLng([lat, lng]); } }, [lat, lng]);
  useEffect(() => { if (radius >= 0) ci.current?.setRadius(radius * 1000); }, [radius]);
  return <div ref={el} className="h-72 w-full overflow-hidden rounded-xl border border-line" />;
}

export default function Settings() {
  const { data, error, loading } = useAsync(() => api('/settings'), []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  useEffect(() => { if (data) setF({ ...data, cod_enabled: data.cod_enabled === '1', online_enabled: data.online_enabled === '1' }); }, [data]);
  if (loading || !f) return error ? <ErrorBox msg={error} /> : <Loading />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api('/settings', { method: 'PUT', body: f }); toast('Settings saved — live on the storefront now'); }
    catch (x) { toast(x.data?.issues?.[0] ? `${x.data.issues[0].path}: ${x.data.issues[0].message}` : x.message, 'error'); }
    setBusy(false);
  };
  const find = async () => {
    if (!q.trim()) return;
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`)).json();
      if (!r[0]) return toast('Place not found', 'error');
      setF((x) => ({ ...x, shop_lat: Number(r[0].lat).toFixed(6), shop_lng: Number(r[0].lon).toFixed(6), shop_address: x.shop_address.includes('edit in Admin') ? r[0].display_name : x.shop_address }));
    } catch { toast('Address search unavailable — click the map instead.', 'error'); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try { await api('/auth/password', { method: 'PUT', body: pw }); setPw({ current: '', next: '' }); toast('Password changed'); } catch (x) { toast(x.message, 'error'); }
  };
  const lat = Number(f.shop_lat), lng = Number(f.shop_lng), radius = Number(f.free_radius_km);
  const sample = Number(f.outside_fee_flat) + Number(f.outside_fee_per_km) * 2;
  return (
    <>
      <PageHead title="Settings" sub="Changes apply to the storefront immediately" />
      <form onSubmit={save} className="space-y-5">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">📍 Delivery</h2>
          <p className="text-sm text-muted">Orders within the free radius ship free. Outside it, customers see the fee below and must accept it. Beyond the maximum distance we refuse the order.</p>
          <div className="flex gap-2"><input className="input" placeholder="Search your shop’s address to place the pin" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), find())} /><button type="button" className="btn btn-ghost" onClick={find}>Find</button></div>
          <ShopMap lat={lat || 28.6} lng={lng || 77.2} radius={radius || 0} onPick={(a, b) => setF((x) => ({ ...x, shop_lat: a.toFixed(6), shop_lng: b.toFixed(6) }))} />
          <p className="text-xs text-muted">Click the map or drag the 🏪 pin to set your shop location. The green circle is the free delivery zone.</p>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Shop latitude"><input className="input" value={f.shop_lat} onChange={set('shop_lat')} inputMode="decimal" /></Field><Field label="Shop longitude"><input className="input" value={f.shop_lng} onChange={set('shop_lng')} inputMode="decimal" /></Field></div>
          <Field label="Shop address (shown on site)"><input className="input" value={f.shop_address} onChange={set('shop_address')} /></Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Free delivery radius (km)"><input className="input" type="number" step="0.1" min="0" value={f.free_radius_km} onChange={set('free_radius_km')} /></Field>
            <Field label="Fee outside radius — base (₹)"><input className="input" type="number" min="0" value={f.outside_fee_flat} onChange={set('outside_fee_flat')} /></Field>
            <Field label="+ per extra km (₹)"><input className="input" type="number" min="0" value={f.outside_fee_per_km} onChange={set('outside_fee_per_km')} /></Field>
            <Field label="Max delivery distance (km)" hint="0 = no limit"><input className="input" type="number" min="0" value={f.max_delivery_km} onChange={set('max_delivery_km')} /></Field>
          </div>
          <p className="text-xs text-muted">Example: a customer {radius + 2} km away pays ₹{sample} (₹{f.outside_fee_flat} + 2 km × ₹{f.outside_fee_per_km}). Set the per-km fee to 0 for a flat outside fee.</p>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">🏷️ Branding &amp; contact</h2>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Brand name"><input className="input" value={f.brand_name} onChange={set('brand_name')} /></Field><Field label="Tagline"><input className="input" value={f.tagline} onChange={set('tagline')} /></Field>
            <Field label="Contact phone"><input className="input" value={f.contact_phone} onChange={set('contact_phone')} /></Field><Field label="WhatsApp number" hint="Digits only with country code, e.g. 917047371680"><input className="input" value={f.whatsapp_number} onChange={set('whatsapp_number')} inputMode="numeric" /></Field>
            <Field label="Contact email"><input className="input" value={f.contact_email} onChange={set('contact_email')} /></Field><Field label="Opening hours"><input className="input" value={f.opening_hours} onChange={set('opening_hours')} /></Field></div>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">💳 Payment methods</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={f.cod_enabled} onChange={set('cod_enabled')} /> Cash on Delivery</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={f.online_enabled} onChange={set('online_enabled')} /> Online payment</label>
          <p className="text-xs text-muted">Razorpay keys are set on the server (<code>RAZORPAY_KEY_ID</code> / <code>RAZORPAY_KEY_SECRET</code> in <code>server/.env</code>). Without keys, online payment uses a local test gateway.</p>
        </section>
        <div className="sticky bottom-3 flex justify-end"><button className="btn btn-primary !px-8 shadow-2xl" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
      </form>
      <form onSubmit={changePw} className="card mt-5 max-w-lg space-y-3 p-5">
        <h2 className="font-bold">🔑 Change admin password</h2>
        <Field label="Current password"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></Field>
        <Field label="New password (min 8 characters)"><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} autoComplete="new-password" /></Field>
        <button className="btn btn-ghost">Change password</button>
      </form>
    </>
  );
}
