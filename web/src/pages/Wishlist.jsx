import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useStore } from '../store.js';
import ProductCard from '../components/ProductCard.jsx';
import { Empty, usePageTitle } from '../components/ui.jsx';

export default function Wishlist() {
  usePageTitle('Wishlist');
  const wishlist = useStore((s) => s.wishlist);
  const [items, setItems] = useState([]);
  const key = wishlist.map((w) => w.id).join(',');
  useEffect(() => {
    if (!wishlist.length) { setItems([]); return; }
    api('/products/lookup', { method: 'POST', body: { ids: wishlist.map((w) => w.id) } }).then((r) => setItems(r.filter((p) => p.active))).catch(() => {});
  }, [key]); // eslint-disable-line
  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="mb-6 font-display text-3xl font-extrabold">Your wishlist</h1>
      {!wishlist.length ? <Empty icon="💜" title="Nothing saved yet">Tap the heart on any product to save it here.<div className="mt-4"><Link to="/shop" className="btn btn-primary">Browse products</Link></div></Empty>
        : <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{items.filter((p) => wishlist.some((w) => w.id === p.id)).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>}
      <p className="mt-8 text-xs text-muted">Your wishlist is saved on this device.</p>
    </div>
  );
}
