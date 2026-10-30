import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal } from './ui.jsx';
import DeliveryPicker, { QuoteResult } from './DeliveryPicker.jsx';

/** Compact "FREE delivery within X km" line + modal to check your location. Used on product page and cart. */
export default function DeliveryStatus({ compact = false }) {
  const settings = useStore((s) => s.settings);
  const location = useStore((s) => s.location);
  const setLocation = useStore((s) => s.setLocation);
  const [open, setOpen] = useState(false);
  const km = settings?.free_radius_km || 5;
  const q = location?.quote;
  return (
    <>
      <div className={`rounded-2xl border p-3.5 ${q ? (!q.deliverable ? 'border-rose-400/40 bg-rose-400/10' : q.free ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-amber-400/40 bg-amber-400/10') : 'border-emerald-400/30 bg-emerald-400/5'}`}>
        <p className="text-sm font-semibold">
          {!q && <>🛵 <b className="text-emerald-300">FREE delivery</b> within {km} km</>}
          {q?.free && <>🎉 <b className="text-emerald-300">FREE DELIVERY</b> — You are within our {km} KM delivery zone.</>}
          {q && !q.free && q.deliverable && <>⚠️ Your location is outside our free {km} km delivery area. Delivery: <b>₹{q.fee}</b></>}
          {q && !q.deliverable && <>❌ {q.message}</>}
        </p>
        <button onClick={() => setOpen(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-cyan underline-offset-2 hover:underline"><MapPin size={13} /> {q ? 'Change location' : 'Check if we deliver to you'}</button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Check delivery to your location" wide>
        <DeliveryPicker value={location} onChange={(loc) => setLocation(loc)} height={300} />
        <QuoteResult quote={location?.quote} className="mt-3" />
        <button onClick={() => setOpen(false)} className="btn btn-primary mt-4 w-full">Done</button>
      </Modal>
    </>
  );
}
