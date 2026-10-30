import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Search, MapPin } from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import { Spinner } from './ui.jsx';

const emojiIcon = (emoji, size = 34) => L.divIcon({ html: `<div class="pin">${emoji}</div>`, className: '', iconSize: [size, size], iconAnchor: [size / 2, size - 2] });

async function nominatim(path) {
  const r = await fetch(`https://nominatim.openstreetmap.org/${path}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('lookup failed');
  return r.json();
}

/**
 * Map-based delivery location picker.
 * value: { lat, lng } | null — onChange({ lat, lng, quote, label })
 * The distance rule itself always comes from the server (/delivery/quote).
 */
export default function DeliveryPicker({ value, onChange, onAddress, height = 320 }) {
  const settings = useStore((s) => s.settings);
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const circle = useRef(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [mapOk, setMapOk] = useState(true);

  const shop = settings ? [Number(settings.shop_lat), Number(settings.shop_lng)] : null;
  const radiusKm = Number(settings?.free_radius_km || 5);

  const choose = useCallback(async (lat, lng, label = '') => {
    setBusy(true); setNote('');
    try {
      const quote = await api('/delivery/quote', { method: 'POST', body: { lat, lng } });
      onChange({ lat, lng, quote, label });
    } catch (e) { setNote(e.message); }
    setBusy(false);
  }, [onChange]);

  // init map once settings are known
  useEffect(() => {
    if (!shop || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(value ? [value.lat, value.lng] : shop, value ? 14 : 13);
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    let errs = 0;
    tiles.on('tileerror', () => { if (++errs > 3) setMapOk(false); });
    tiles.on('tileload', () => { errs = 0; setMapOk(true); });
    circle.current = L.circle(shop, { radius: radiusKm * 1000, color: '#34d399', weight: 2, fillColor: '#34d399', fillOpacity: 0.1, dashArray: '6 6' }).addTo(m);
    L.marker(shop, { icon: emojiIcon('🏪'), keyboard: false, title: 'Our shop' }).addTo(m);
    m.on('click', (e) => choose(e.latlng.lat, e.latlng.lng));
    map.current = m;
    setTimeout(() => m.invalidateSize(), 150);
    return () => { m.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!shop]);

  // keep circle in sync with admin radius / shop location
  useEffect(() => { if (circle.current && shop) { circle.current.setLatLng(shop); circle.current.setRadius(radiusKm * 1000); } }, [shop?.[0], shop?.[1], radiusKm]); // eslint-disable-line

  // draw customer pin
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], { icon: emojiIcon('📍'), draggable: true }).addTo(m);
      marker.current.on('dragend', () => { const p = marker.current.getLatLng(); choose(p.lat, p.lng); });
    } else marker.current.setLatLng([value.lat, value.lng]);
  }, [value?.lat, value?.lng, choose]); // eslint-disable-line

  const locate = () => {
    if (!navigator.geolocation) { setNote('Your browser cannot share location. Search your address or tap the map.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { const { latitude: lat, longitude: lng } = pos.coords; map.current?.setView([lat, lng], 16); choose(lat, lng, 'My current location'); reverse(lat, lng); },
      () => { setBusy(false); setNote('Could not get your location. Allow location access, search your address, or tap the map.'); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const reverse = async (lat, lng) => {
    if (!onAddress) return;
    try {
      const r = await nominatim(`reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`);
      const a = r.address || {};
      onAddress({
        line: [a.road, a.neighbourhood || a.suburb].filter(Boolean).join(', ') || r.display_name?.split(',').slice(0, 2).join(','),
        area: a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.village || '',
        pincode: a.postcode?.replace(/\s/g, '') || '',
      });
    } catch { /* optional nicety */ }
  };

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setNote('');
    try {
      const bias = shop ? `&viewbox=${shop[1] - 0.3},${shop[0] + 0.3},${shop[1] + 0.3},${shop[0] - 0.3}` : '';
      const r = await nominatim(`search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}${bias}`);
      if (!r.length) { setNote('We could not find that place. Try a nearby landmark or tap the map.'); setBusy(false); return; }
      const lat = Number(r[0].lat), lng = Number(r[0].lon);
      map.current?.setView([lat, lng], 16);
      await choose(lat, lng, r[0].display_name);
      reverse(lat, lng);
    } catch { setNote('Address search is unavailable right now. Please tap your location on the map.'); setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input !pl-10" placeholder="Search your area, street or landmark" aria-label="Search address" />
        </div>
        <button className="btn btn-ghost" type="submit" disabled={busy}>Find</button>
      </form>
      <button type="button" onClick={locate} disabled={busy} className="btn btn-ghost btn-sm w-full sm:w-auto"><Crosshair size={16} /> Use my current location</button>
      <div className="relative overflow-hidden rounded-2xl border border-line" style={{ height }}>
        <div ref={el} className="h-full w-full" />
        {!shop && <div className="absolute inset-0 grid place-items-center bg-ink-2 text-sm text-muted"><Spinner /></div>}
        {busy && <div className="absolute right-3 top-3 z-[500] rounded-full bg-ink/80 p-2"><Spinner /></div>}
        {!mapOk && <div className="absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-black/80 p-3 text-xs">Map images could not load (offline?). You can still use “Use my current location”.</div>}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted"><MapPin size={13} /> Tap the map or drag the pin. The green circle is our <b className="text-emerald-300">free {radiusKm} km</b> delivery zone.</p>
      {note && <p className="text-sm text-amber-300" role="alert">{note}</p>}
    </div>
  );
}

/** Result card for a quote. */
export function QuoteResult({ quote, className = '' }) {
  if (!quote) return null;
  if (!quote.deliverable) return (
    <div className={`rounded-2xl border border-rose-400/40 bg-rose-400/10 p-4 ${className}`} role="alert">
      <p className="font-bold text-rose-200">❌ {quote.message}</p>
      <p className="mt-1 text-sm text-rose-100/80">Please choose a closer address or call us to arrange delivery.</p>
    </div>
  );
  if (quote.free) return (
    <div className={`rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4 ${className}`}>
      <p className="font-display text-lg font-extrabold text-emerald-300">🎉 FREE DELIVERY</p>
      <p className="text-sm text-emerald-100/80">You are within our {quote.radiusKm} km delivery zone ({quote.distanceKm} km from the shop).</p>
    </div>
  );
  return (
    <div className={`rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 ${className}`} role="alert">
      <p className="font-bold text-amber-200">⚠️ Your location is outside our free {quote.radiusKm} km delivery area.</p>
      <p className="text-sm text-amber-100/80">You are {quote.distanceKm} km away. Delivery charge for your location: <b>₹{quote.fee}</b>.</p>
    </div>
  );
}
