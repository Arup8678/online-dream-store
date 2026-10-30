import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Upload, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { api, money } from '../api.js';
import { ErrorBox, Field, Modal, PageHead, Pager, toast, useAsync } from '../ui.jsx';

const EMPTY = { sku: '', name: '', description: '', categoryId: null, subcategoryId: null, price: '', discountPrice: '', stock: 0, images: [], videoUrl: '', brand: '', size: '', color: '', ageGroup: 'All ages', specs: {}, featured: false, bestSeller: false, newArrival: false, active: true };

function ProductForm({ product, cats, onClose, onSaved }) {
  const [f, setF] = useState(() => (product ? { ...EMPTY, ...product, price: product.price, discountPrice: product.discountPrice ?? '' } : EMPTY));
  const [specs, setSpecs] = useState(() => Object.entries(product?.specs || {}).map(([k, v]) => ({ k, v })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const vidRef = useRef(null);
  const top = cats.filter((c) => !c.parentId);
  const subs = cats.filter((c) => c.parentId === f.categoryId);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const upload = async (files, kind) => {
    if (!files.length) return;
    const form = new FormData();
    [...files].forEach((x) => form.append('files', x));
    try {
      const r = await api('/upload', { method: 'POST', form });
      if (kind === 'video') setF((x) => ({ ...x, videoUrl: r.files[0] }));
      else setF((x) => ({ ...x, images: [...x.images, ...r.files] }));
    } catch (e) { toast(e.message, 'error'); }
  };
  const move = (i, d) => setF((x) => { const a = [...x.images]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, images: a }; });

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    const body = {
      ...f, sku: f.sku.trim(), price: Number(f.price), discountPrice: f.discountPrice === '' ? null : Number(f.discountPrice), stock: Number(f.stock),
      categoryId: f.categoryId ? Number(f.categoryId) : null, subcategoryId: f.subcategoryId ? Number(f.subcategoryId) : null,
      specs: Object.fromEntries(specs.filter((s) => s.k.trim()).map((s) => [s.k.trim(), s.v])),
    };
    for (const k of ['id', 'slug', 'categoryName', 'categorySlug', 'subcategoryName', 'salePrice', 'discountPercent', 'inStock', 'rating', 'ratingCount', 'soldCount', 'createdAt']) delete body[k];
    try {
      await api(product ? `/products/${product.id}` : '/products', { method: product ? 'PUT' : 'POST', body });
      toast(product ? 'Product updated' : 'Product created'); onSaved();
    } catch (x) { setErr(x.data?.issues?.[0] ? `${x.data.issues[0].path}: ${x.data.issues[0].message}` : x.message); }
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} title={product ? `Edit: ${product.name}` : 'New product'} wide>
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2"><Field label="Product name *"><input className="input" value={f.name} onChange={set('name')} required minLength={2} /></Field></div>
          <Field label="SKU *"><input className="input uppercase" value={f.sku} onChange={set('sku')} required /></Field>
        </div>
        <Field label="Description"><textarea className="input" rows={4} value={f.description} onChange={set('description')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category *"><select className="input" value={f.categoryId ?? ''} onChange={(e) => setF({ ...f, categoryId: e.target.value ? Number(e.target.value) : null, subcategoryId: null })} required><option value="">Select…</option>{top.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></Field>
          <Field label="Subcategory"><select className="input" value={f.subcategoryId ?? ''} onChange={(e) => setF({ ...f, subcategoryId: e.target.value ? Number(e.target.value) : null })} disabled={!subs.length}><option value="">None</option>{subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price (₹) *"><input className="input" type="number" min="0" step="0.01" value={f.price} onChange={set('price')} required /></Field>
          <Field label="Discount price (₹)" hint="Leave blank for no discount"><input className="input" type="number" min="0" step="0.01" value={f.discountPrice} onChange={set('discountPrice')} /></Field>
          <Field label="Stock quantity *"><input className="input" type="number" min="0" step="1" value={f.stock} onChange={set('stock')} required /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Brand"><input className="input" value={f.brand} onChange={set('brand')} /></Field>
          <Field label="Size"><input className="input" value={f.size} onChange={set('size')} /></Field>
          <Field label="Color"><input className="input" value={f.color} onChange={set('color')} /></Field>
          <Field label="Age group"><input className="input" list="ages" value={f.ageGroup} onChange={set('ageGroup')} /><datalist id="ages">{['All ages', '0-2 years', '3+ years', '5+ years', '8+ years', '10+ years'].map((a) => <option key={a} value={a} />)}</datalist></Field>
        </div>

        <div>
          <label className="label">Images (first one is the main image)</label>
          <div className="flex flex-wrap gap-3">
            {f.images.map((src, i) => (
              <div key={src + i} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-line">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 p-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" onClick={() => move(i, -1)} aria-label="Move left"><ArrowLeft size={14} /></button>
                  <button type="button" onClick={() => setF({ ...f, images: f.images.filter((_, k) => k !== i) })} aria-label="Remove" className="text-rose-300"><X size={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} aria-label="Move right"><ArrowRight size={14} /></button>
                </div>
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-neon px-1 text-[10px] font-bold">MAIN</span>}
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current.click()} className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-line text-xs text-muted hover:bg-white/5"><span className="text-center"><Upload className="mx-auto mb-1" size={18} />Upload</span></button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { upload(e.target.files, 'img'); e.target.value = ''; }} />
          </div>
          <div className="mt-2 flex gap-2"><input id="imgurl" className="input" placeholder="…or paste an image URL" /><button type="button" className="btn btn-ghost" onClick={() => { const el = document.getElementById('imgurl'); if (el.value.trim()) { setF({ ...f, images: [...f.images, el.value.trim()] }); el.value = ''; } }}>Add</button></div>
        </div>

        <div>
          <label className="label">Product video (optional)</label>
          <div className="flex flex-wrap gap-2"><input className="input flex-1" placeholder="MP4 upload, direct video URL or YouTube link" value={f.videoUrl} onChange={set('videoUrl')} /><button type="button" className="btn btn-ghost" onClick={() => vidRef.current.click()}><Upload size={15} /> Upload</button><input ref={vidRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => { upload(e.target.files, 'video'); e.target.value = ''; }} /></div>
        </div>

        <div>
          <label className="label">Specifications</label>
          <div className="space-y-2">
            {specs.map((s, i) => <div key={i} className="flex gap-2"><input className="input" placeholder="e.g. Material" value={s.k} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} /><input className="input" placeholder="e.g. Steel" value={s.v} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} /><button type="button" className="btn btn-ghost btn-sm" aria-label="Remove spec" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div>)}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSpecs([...specs, { k: '', v: '' }])}><Plus size={14} /> Add specification</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[['active', 'Active (visible in shop)'], ['featured', 'Featured'], ['bestSeller', 'Best seller'], ['newArrival', 'New arrival']].map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={f[k]} onChange={set(k)} />{l}</label>)}
        </div>
        {err && <ErrorBox msg={err} />}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button></div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const [sp] = useSearchParams();
  const [f, setF] = useState({ q: '', category: '', status: '', stock: sp.get('stock') || '', page: 1 });
  const [edit, setEdit] = useState(null); // null | 'new' | product
  const cats = useAsync(() => api('/categories'), []);
  const { data, error, loading, reload } = useAsync(() => api('/products', { params: f }), [f.q, f.category, f.status, f.stock, f.page]);
  const patch = async (id, body, msg) => { try { await api(`/products/${id}`, { method: 'PATCH', body }); toast(msg); reload(); } catch (e) { toast(e.message, 'error'); } };
  const del = async (p) => { if (!confirm(`Delete “${p.name}” permanently? Past orders keep their line items. Consider deactivating instead.`)) return; try { await api(`/products/${p.id}`, { method: 'DELETE' }); toast('Deleted'); reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <>
      <PageHead title="Products" sub={data ? `${data.total} products` : ''}><button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> Add product</button></PageHead>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input !w-64" placeholder="Search name, SKU, brand" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} aria-label="Search products" />
        <select className="input !w-auto" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, page: 1 })} aria-label="Category"><option value="">All categories</option>{cats.data?.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input !w-auto" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })} aria-label="Status"><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <select className="input !w-auto" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value, page: 1 })} aria-label="Stock"><option value="">Any stock</option><option value="low">Low stock (≤ 5)</option></select>
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="card overflow-x-auto">
        <table className="w-full"><thead><tr><th className="th">Product</th><th className="th">SKU</th><th className="th">Category</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Flags</th><th className="th">Active</th><th className="th" /></tr></thead>
          <tbody>
            {loading && !data && <tr><td className="td text-muted" colSpan={8}>Loading…</td></tr>}
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td className="td"><div className="flex items-center gap-3"><img src={p.images[0]} alt="" className="h-11 w-11 rounded-lg object-cover" /><div className="min-w-0"><p className="line-clamp-1 max-w-[260px] font-semibold">{p.name}</p><p className="text-xs text-muted">{p.brand}</p></div></div></td>
                <td className="td font-mono text-xs">{p.sku}</td><td className="td text-xs">{p.categoryName}<div className="text-muted">{p.subcategoryName}</div></td>
                <td className="td">{money(p.salePrice)}{p.discountPrice && <div className="text-xs text-muted line-through">{money(p.price)}</div>}</td>
                <td className="td"><input type="number" min="0" defaultValue={p.stock} className={`input !min-h-8 !w-20 !px-2 ${p.stock <= 5 ? '!border-amber-400/60' : ''}`} aria-label={`Stock for ${p.name}`} onBlur={(e) => { const v = Number(e.target.value); if (v !== p.stock && v >= 0) patch(p.id, { stock: v }, 'Stock updated'); }} /></td>
                <td className="td"><div className="flex flex-wrap gap-1 text-[10px] font-bold">{[['featured', 'F', 'Featured'], ['bestSeller', 'B', 'Best seller'], ['newArrival', 'N', 'New']].map(([k, l, t]) => <button key={k} title={`${t} (click to toggle)`} onClick={() => patch(p.id, { [k]: !p[k] }, `${t} ${p[k] ? 'off' : 'on'}`)} className={`h-6 w-6 rounded ${p[k] ? 'bg-neon text-white' : 'bg-white/10 text-muted'}`}>{l}</button>)}</div></td>
                <td className="td"><button role="switch" aria-checked={p.active} aria-label={`Active: ${p.name}`} onClick={() => patch(p.id, { active: !p.active }, p.active ? 'Hidden from shop' : 'Now visible')} className={`h-6 w-11 rounded-full p-0.5 transition ${p.active ? 'bg-emerald-400' : 'bg-white/20'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${p.active ? 'translate-x-5' : ''}`} /></button></td>
                <td className="td"><div className="flex gap-1.5"><button className="btn btn-ghost btn-sm" onClick={() => setEdit(p)}>Edit</button><button className="btn btn-danger btn-sm" aria-label={`Delete ${p.name}`} onClick={() => del(p)}><Trash2 size={14} /></button></div></td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td className="td text-muted" colSpan={8}>No products found.</td></tr>}
          </tbody></table>
      </div>
      {data && <Pager page={data.page} pages={data.pages} onPage={(p) => setF({ ...f, page: p })} />}
      {edit && cats.data && <ProductForm product={edit === 'new' ? null : edit} cats={cats.data} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}
