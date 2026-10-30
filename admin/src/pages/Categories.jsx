import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import { ErrorBox, Field, Modal, PageHead, toast, useAsync } from '../ui.jsx';

export default function Categories() {
  const { data, error, reload } = useAsync(() => api('/categories'), []);
  const [edit, setEdit] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const b = { name: edit.name, parentId: edit.parentId ? Number(edit.parentId) : null, icon: edit.icon, accent: edit.accent, description: edit.description || '', sortOrder: Number(edit.sortOrder) || 0, active: edit.active };
    try { await api(edit.id ? `/categories/${edit.id}` : '/categories', { method: edit.id ? 'PUT' : 'POST', body: b }); toast('Saved'); setEdit(null); reload(); } catch (x) { toast(x.message, 'error'); }
  };
  const del = async (c) => { if (!confirm(`Delete “${c.name}”?`)) return; try { await api(`/categories/${c.id}`, { method: 'DELETE' }); toast('Deleted'); reload(); } catch (x) { toast(x.message, 'error'); } };
  const top = data?.filter((c) => !c.parentId) || [];
  return (
    <>
      <PageHead title="Categories" sub="Top-level categories and their subcategories"><button className="btn btn-primary" onClick={() => setEdit({ name: '', parentId: '', icon: '✨', accent: '#7c5cff', description: '', sortOrder: 0, active: true })}><Plus size={16} /> Add category</button></PageHead>
      {error && <ErrorBox msg={error} />}
      <div className="grid gap-4 md:grid-cols-2">
        {top.map((c) => (
          <section key={c.id} className="card p-4" style={{ borderColor: `${c.accent}55` }}>
            <div className="flex items-center justify-between gap-2"><h2 className="font-bold"><span className="mr-2 text-xl">{c.icon}</span>{c.name} {!c.active && <span className="badge bg-white/10">hidden</span>}</h2>
              <div className="flex gap-1.5"><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...c, parentId: '' })}>Edit</button><button className="btn btn-danger btn-sm" onClick={() => del(c)}>Delete</button></div></div>
            <p className="text-xs text-muted">{c.productCount} products · /{c.slug}</p>
            <ul className="mt-3 space-y-1">
              {data.filter((s) => s.parentId === c.id).map((s) => <li key={s.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-sm"><span>{s.name} <span className="text-xs text-muted">({s.productCount})</span> {!s.active && <span className="badge bg-white/10">hidden</span>}</span><span className="flex gap-1"><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...s })}>Edit</button><button className="btn btn-danger btn-sm" onClick={() => del(s)}>×</button></span></li>)}
            </ul>
            {c.slug !== 'new-arrivals' && <button className="mt-2 text-xs text-cyan" onClick={() => setEdit({ name: '', parentId: c.id, icon: c.icon, accent: c.accent, description: '', sortOrder: 0, active: true })}>+ Add subcategory</button>}
          </section>
        ))}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? 'Edit category' : 'New category'}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required minLength={2} autoFocus /></Field>
            <Field label="Parent category" hint="Leave empty for a top-level category"><select className="input" value={edit.parentId ?? ''} onChange={(e) => setEdit({ ...edit, parentId: e.target.value })}><option value="">— Top level —</option>{top.filter((t) => t.id !== edit.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <div className="grid grid-cols-3 gap-3"><Field label="Icon (emoji)"><input className="input" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} maxLength={4} /></Field><Field label="Accent"><input className="input !p-1" type="color" value={edit.accent} onChange={(e) => setEdit({ ...edit, accent: e.target.value })} /></Field><Field label="Order"><input className="input" type="number" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: e.target.value })} /></Field></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Visible in shop</label>
            <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary">Save</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
