import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import { ErrorBox, Field, Modal, PageHead, toast, useAsync } from '../ui.jsx';

export default function Offers() {
  const { data, error, reload } = useAsync(() => api('/offers'), []);
  const [edit, setEdit] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const b = { title: edit.title, subtitle: edit.subtitle || '', badge: edit.badge || '', link: edit.link || '/shop', accent: edit.accent, active: !!edit.active, sortOrder: Number(edit.sort_order ?? edit.sortOrder) || 0 };
    try { await api(edit.id ? `/offers/${edit.id}` : '/offers', { method: edit.id ? 'PUT' : 'POST', body: b }); toast('Saved'); setEdit(null); reload(); } catch (x) { toast(x.message, 'error'); }
  };
  return (
    <>
      <PageHead title="Special offers" sub="Banners shown in the “Special Offers” section on the homepage"><button className="btn btn-primary" onClick={() => setEdit({ title: '', subtitle: '', badge: '', link: '/shop?onSale=1', accent: '#8b7bff', active: 1, sort_order: 0 })}><Plus size={16} /> Add offer</button></PageHead>
      {error && <ErrorBox msg={error} />}
      <div className="grid gap-4 md:grid-cols-3">
        {data?.map((o) => (
          <div key={o.id} className="card p-5" style={{ backgroundImage: `linear-gradient(135deg, ${o.accent}30, transparent 70%)`, opacity: o.active ? 1 : 0.5 }}>
            {o.badge && <span className="badge text-black" style={{ background: o.accent }}>{o.badge}</span>}
            <h3 className="mt-3 text-lg font-extrabold">{o.title}</h3><p className="text-sm text-muted">{o.subtitle}</p><p className="mt-1 text-xs text-muted">→ {o.link}</p>
            <div className="mt-3 flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setEdit(o)}>Edit</button><button className="btn btn-danger btn-sm" onClick={async () => { if (confirm('Delete this offer?')) { await api(`/offers/${o.id}`, { method: 'DELETE' }); reload(); } }}>Delete</button></div>
          </div>
        ))}
      </div>
      {data?.length === 0 && <p className="text-muted">No offers yet.</p>}
      {edit && <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Edit offer' : 'New offer'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Title"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></Field>
          <Field label="Subtitle"><input className="input" value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Badge text"><input className="input" value={edit.badge} onChange={(e) => setEdit({ ...edit, badge: e.target.value })} placeholder="UP TO 30% OFF" /></Field><Field label="Accent colour"><input className="input !p-1" type="color" value={edit.accent} onChange={(e) => setEdit({ ...edit, accent: e.target.value })} /></Field></div>
          <Field label="Link" hint="Where the banner goes, e.g. /category/toys?onSale=1"><input className="input" value={edit.link} onChange={(e) => setEdit({ ...edit, link: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} /> Visible</label>
          <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary">Save</button></div>
        </form></Modal>}
    </>
  );
}
