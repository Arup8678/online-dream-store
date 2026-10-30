import { useState } from 'react';
import { MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import { Field, Spinner, toast, usePageTitle } from '../components/ui.jsx';

export default function Contact() {
  usePageTitle('Contact us');
  const s = useStore((x) => x.settings) || {};
  const [f, setF] = useState({ name: '', email: '', phone: '', subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api('/contact', { method: 'POST', body: f }); setSent(true); } catch (err) { toast(err.message, 'error'); }
    setBusy(false);
  };
  const info = [[MapPin, s.shop_address], [Phone, s.contact_phone], [Mail, s.contact_email], [Clock, s.opening_hours]];
  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-5xl">Say hello 👋</h1>
      <p className="mt-2 max-w-xl text-muted">Questions about a product, a bulk school order, or your delivery? We usually reply within a few hours.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div className="glass space-y-4 rounded-3xl p-6">
            {info.map(([Icon, text], i) => <p key={i} className="flex gap-3 text-sm"><Icon size={18} className="mt-0.5 shrink-0 text-cyan" />{text}</p>)}
          </div>
          <a href={`https://wa.me/${s.whatsapp_number}`} target="_blank" rel="noreferrer" className="btn btn-ghost w-full !border-emerald-400/40 !py-3.5 !text-emerald-300"><MessageCircle size={18} /> Chat on WhatsApp</a>
          {s.shop_lat && <a href={`https://www.google.com/maps/search/?api=1&query=${s.shop_lat},${s.shop_lng}`} target="_blank" rel="noreferrer" className="btn btn-ghost w-full"><MapPin size={18} /> Open shop in Maps</a>}
        </div>
        <div className="glass rounded-3xl p-6">
          {sent ? <div className="py-10 text-center"><div className="text-5xl">✅</div><h2 className="mt-3 font-display text-xl font-bold">Message sent!</h2><p className="text-muted">Thanks — we’ll get back to you soon.</p></div> : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Your name"><input className="input" value={f.name} onChange={set('name')} required minLength={2} /></Field><Field label="Mobile"><input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} /></Field></div>
              <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
              <Field label="Subject"><input className="input" value={f.subject} onChange={set('subject')} /></Field>
              <Field label="Message"><textarea className="input" rows={5} value={f.body} onChange={set('body')} required minLength={5} /></Field>
              <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Send message'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
