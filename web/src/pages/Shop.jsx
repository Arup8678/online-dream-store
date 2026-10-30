import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import ProductCard, { ProductGridSkeleton } from '../components/ProductCard.jsx';
import { Empty, Modal, usePageTitle } from '../components/ui.jsx';
import { money } from '../lib/format.js';

const SORTS = [['popular', 'Popular'], ['newest', 'Newest'], ['price_asc', 'Price: Low to High'], ['price_desc', 'Price: High to Low'], ['rating', 'Top Rated']];

function Filters({ facets, params, set, cats, activeCat }) {
  const [price, setPrice] = useState({ min: params.get('minPrice') || '', max: params.get('maxPrice') || '' });
  useEffect(() => setPrice({ min: params.get('minPrice') || '', max: params.get('maxPrice') || '' }), [params]);
  const list = (k) => (params.get(k) ? params.get(k).split(',') : []);
  const toggle = (k, v) => { const cur = list(k); set({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',') || null }); };
  const Group = ({ title, children }) => <div className="border-b border-line py-4 last:border-0"><h4 className="mb-2.5 text-sm font-bold">{title}</h4>{children}</div>;
  return (
    <div>
      <Group title="Category">
        <ul className="space-y-1 text-sm">
          <li><button onClick={() => set({ category: null }, true)} className={`w-full rounded-lg px-2 py-1.5 text-left hover:bg-white/10 ${!activeCat ? 'font-bold text-cyan' : ''}`}>All categories</button></li>
          {cats.map((c) => (
            <li key={c.slug}>
              <button onClick={() => set({ category: c.slug }, true)} className={`flex w-full justify-between rounded-lg px-2 py-1.5 text-left hover:bg-white/10 ${activeCat === c.slug ? 'font-bold text-cyan' : ''}`}><span>{c.icon} {c.name}</span><span className="text-muted">{c.productCount}</span></button>
              {(activeCat === c.slug || c.children.some((s) => s.slug === activeCat)) && c.children.length > 0 && (
                <ul className="ml-5 mt-1 space-y-0.5 border-l border-line pl-2">
                  {c.children.map((s) => <li key={s.slug}><button onClick={() => set({ category: s.slug }, true)} className={`flex w-full justify-between rounded-md px-2 py-1 text-left text-[13px] hover:bg-white/10 ${activeCat === s.slug ? 'font-bold text-cyan' : 'text-muted'}`}><span>{s.name}</span><span>{s.productCount}</span></button></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Group>
      <Group title="Price range">
        <form onSubmit={(e) => { e.preventDefault(); set({ minPrice: price.min || null, maxPrice: price.max || null }); }} className="flex items-center gap-2">
          <input className="input !min-h-10 !px-3" inputMode="numeric" placeholder={`₹${facets?.priceMin ?? 0}`} value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value.replace(/\D/g, '') })} aria-label="Minimum price" />
          <span className="text-muted">–</span>
          <input className="input !min-h-10 !px-3" inputMode="numeric" placeholder={`₹${facets?.priceMax ?? 5000}`} value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value.replace(/\D/g, '') })} aria-label="Maximum price" />
          <button className="btn btn-ghost btn-sm">Go</button>
        </form>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[[0, 200], [200, 500], [500, 1000], [1000, 99999]].map(([a, b]) => (
            <button key={a} onClick={() => set({ minPrice: a || null, maxPrice: b < 99999 ? b : null })} className="chip hover:bg-white/15">{b >= 99999 ? `₹${a}+` : `₹${a}–${b}`}</button>
          ))}
        </div>
      </Group>
      {facets?.brands?.length > 0 && (
        <Group title="Brand">
          <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {facets.brands.map((b) => <label key={b.v} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/10"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={list('brand').includes(b.v)} onChange={() => toggle('brand', b.v)} />{b.v}<span className="ml-auto text-muted">{b.n}</span></label>)}
          </div>
        </Group>
      )}
      {facets?.ages?.length > 0 && (
        <Group title="Age group">
          <div className="space-y-1">
            {facets.ages.map((b) => <label key={b.v} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/10"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={list('age').includes(b.v)} onChange={() => toggle('age', b.v)} />{b.v}<span className="ml-auto text-muted">{b.n}</span></label>)}
          </div>
        </Group>
      )}
      <Group title="Availability">
        <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={params.get('inStock') === '1'} onChange={(e) => set({ inStock: e.target.checked ? '1' : null })} />In stock only</label>
        <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#8b7bff]" checked={params.get('onSale') === '1'} onChange={(e) => set({ onSale: e.target.checked ? '1' : null })} />On sale</label>
      </Group>
      <Group title="Rating">
        {[4, 3, 2].map((r) => (
          <button key={r} onClick={() => set({ minRating: params.get('minRating') === String(r) ? null : r })} className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/10 ${params.get('minRating') === String(r) ? 'bg-white/10 font-bold' : ''}`}>
            {Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < r ? 'fill-amber-300 text-amber-300' : 'text-white/25'} />)} <span className="text-muted">& up</span>
          </button>
        ))}
      </Group>
    </div>
  );
}

export default function Shop() {
  const { slug } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const cats = useStore((s) => s.categories) || [];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);

  const isSearch = loc.pathname === '/search';
  const q = isSearch ? params.get('q') || '' : '';
  const activeCat = slug || params.get('category') || '';
  const flat = useMemo(() => cats.flatMap((c) => [c, ...c.children]), [cats]);
  const catObj = flat.find((c) => c.slug === activeCat);
  const title = isSearch ? `Results for “${q}”` : catObj ? catObj.name : params.get('featured') ? 'Featured Products' : params.get('bestSeller') ? 'Best Sellers' : 'All Products';
  usePageTitle(title);

  const apiParams = useMemo(() => {
    const p = {};
    for (const k of ['brand', 'age', 'minPrice', 'maxPrice', 'inStock', 'minRating', 'sort', 'page', 'featured', 'bestSeller', 'newArrival', 'onSale']) if (params.get(k)) p[k] = params.get(k);
    if (q) p.q = q;
    if (activeCat) p.category = activeCat;
    p.limit = 12;
    return p;
  }, [params, q, activeCat]);

  useEffect(() => {
    let live = true;
    setError('');
    api('/products', { params: apiParams }).then((r) => live && setData(r)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [apiParams]);

  /** Update URL params; resetting page. `toRoute` category changes use the param form so search/category pages share state. */
  const set = (patch, isCat = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') next.delete(k); else next.set(k, v); }
    if (!('page' in patch)) next.delete('page');
    if (isCat && slug) { // leaving a /category/:slug route → navigate so the path stays meaningful
      next.delete('category');
      const qs = next.toString();
      navigate(patch.category ? `/category/${patch.category}${qs ? `?${qs}` : ''}` : `/shop${qs ? `?${qs}` : ''}`);
      return;
    }
    setParams(next, { preventScrollReset: true });
  };

  const chips = [];
  for (const k of ['brand', 'age']) (params.get(k) || '').split(',').filter(Boolean).forEach((v) => chips.push([`${v}`, () => set({ [k]: params.get(k).split(',').filter((x) => x !== v).join(',') || null })]));
  if (params.get('minPrice') || params.get('maxPrice')) chips.push([`${money(Number(params.get('minPrice') || 0))} – ${params.get('maxPrice') ? money(Number(params.get('maxPrice'))) : 'any'}`, () => set({ minPrice: null, maxPrice: null })]);
  if (params.get('inStock')) chips.push(['In stock', () => set({ inStock: null })]);
  if (params.get('onSale')) chips.push(['On sale', () => set({ onSale: null })]);
  if (params.get('minRating')) chips.push([`${params.get('minRating')}★ & up`, () => set({ minRating: null })]);
  if (activeCat && catObj && !slug) chips.push([catObj.name, () => set({ category: null })]);
  const filterCount = chips.length;
  const clearAll = () => { const next = new URLSearchParams(); if (q) next.set('q', q); if (slug) { setParams(next); } else setParams(next); };

  return (
    <div className="container-x py-6 md:py-10">
      <nav className="mb-2 text-xs text-muted" aria-label="Breadcrumb"><Link to="/" className="hover:text-white">Home</Link> / <Link to="/shop" className="hover:text-white">Shop</Link>{catObj && <> / <span className="text-white">{catObj.name}</span></>}</nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold md:text-4xl">{catObj && <span className="mr-2">{catObj.icon}</span>}{title}</h1>
          <p className="mt-1 text-sm text-muted">{data ? `${data.total} product${data.total === 1 ? '' : 's'}` : 'Loading…'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDrawer(true)} className="btn btn-ghost lg:hidden"><SlidersHorizontal size={17} /> Filters{filterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neon px-1 text-xs text-black">{filterCount}</span>}</button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" value={params.get('sort') || 'popular'} onChange={(e) => set({ sort: e.target.value === 'popular' ? null : e.target.value })} className="input !w-auto !rounded-full !pr-8">
            {SORTS.map(([v, l]) => <option key={v} value={v} className="bg-panel">{l}</option>)}
          </select>
        </div>
      </div>

      {catObj?.children?.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {catObj.children.map((s) => <Link key={s.slug} to={`/category/${s.slug}`} className="chip whitespace-nowrap !px-3.5 !py-2 hover:bg-white/15">{s.name} <span className="text-muted">{s.productCount}</span></Link>)}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="glass sticky top-28 hidden h-fit max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-3xl px-5 lg:block" aria-label="Filters">
          <Filters facets={data?.facets} params={params} set={set} cats={cats} activeCat={activeCat} />
        </aside>
        <div>
          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map(([label, rm]) => <button key={label} onClick={rm} className="chip hover:bg-white/15">{label} <X size={12} /></button>)}
              <button onClick={clearAll} className="text-xs text-cyan underline">Clear all</button>
            </div>
          )}
          {error ? <Empty icon="📡" title="Couldn’t load products">{error}</Empty>
            : !data ? <ProductGridSkeleton />
            : data.items.length === 0 ? (
              <Empty icon="🔍" title={q ? `No results for “${q}”` : 'No products match your filters'}>
                <p>Try a different spelling, remove a filter, or browse a category.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {filterCount > 0 && <button onClick={clearAll} className="btn btn-primary btn-sm">Clear filters</button>}
                  {cats.slice(0, 5).map((c) => <Link key={c.slug} to={`/category/${c.slug}`} className="chip hover:bg-white/15">{c.icon} {c.name}</Link>)}
                </div>
              </Empty>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{data.items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
                {data.pages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-3">
                    <button className="btn btn-ghost btn-sm" disabled={data.page <= 1} onClick={() => { set({ page: data.page - 1 }); window.scrollTo({ top: 0 }); }}><ChevronLeft size={16} /> Prev</button>
                    <span className="text-sm text-muted">Page {data.page} of {data.pages}</span>
                    <button className="btn btn-ghost btn-sm" disabled={data.page >= data.pages} onClick={() => { set({ page: data.page + 1 }); window.scrollTo({ top: 0 }); }}>Next <ChevronRight size={16} /></button>
                  </div>
                )}
              </>
            )}
        </div>
      </div>

      <Modal open={drawer} onClose={() => setDrawer(false)} title="Filters">
        <Filters facets={data?.facets} params={params} set={set} cats={cats} activeCat={activeCat} />
        <div className="sticky -bottom-5 -mx-5 -mb-5 flex gap-3 border-t border-line bg-panel p-4">
          <button onClick={clearAll} className="btn btn-ghost flex-1">Clear</button>
          <button onClick={() => setDrawer(false)} className="btn btn-primary flex-[2]">Show {data?.total ?? ''} products</button>
        </div>
      </Modal>
    </div>
  );
}
