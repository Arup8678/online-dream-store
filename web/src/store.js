import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './lib/api.js';

const snapshot = (p) => ({ id: p.id, slug: p.slug, name: p.name, image: p.images?.[0] || '', price: p.price, salePrice: p.salePrice, stock: p.stock, brand: p.brand });

export const useStore = create(
  persist(
    (set, get) => ({
      // ----- cart -----
      cart: [], // [{ id, quantity, product: snapshot }]
      addToCart(product, qty = 1) {
        const cart = get().cart.map((l) => ({ ...l }));
        const line = cart.find((l) => l.id === product.id);
        const max = product.stock;
        const have = line?.quantity || 0;
        if (max <= 0) return { ok: false, message: 'Sorry, this item is out of stock.' };
        const next = Math.min(have + qty, max);
        if (line) { line.quantity = next; line.product = snapshot(product); } else cart.push({ id: product.id, quantity: next, product: snapshot(product) });
        set({ cart });
        return { ok: true, capped: have + qty > max, quantity: next };
      },
      setQty(id, quantity) {
        set({ cart: get().cart.map((l) => (l.id === id ? { ...l, quantity: Math.max(1, Math.min(quantity, l.product.stock || 1)) } : l)) });
      },
      removeFromCart(id) { set({ cart: get().cart.filter((l) => l.id !== id) }); },
      clearCart() { set({ cart: [] }); },
      /** Refresh prices/stock from the server. */
      async syncCart() {
        const ids = get().cart.map((l) => l.id);
        if (!ids.length) return;
        try {
          const fresh = await api('/products/lookup', { method: 'POST', body: { ids } });
          const byId = new Map(fresh.map((p) => [p.id, p]));
          set({
            cart: get().cart
              .filter((l) => byId.get(l.id)?.active !== false && byId.has(l.id))
              .map((l) => {
                const p = byId.get(l.id);
                return { ...l, quantity: p.stock > 0 ? Math.min(l.quantity, p.stock) : l.quantity, product: snapshot(p) };
              }),
          });
        } catch { /* offline: keep what we have */ }
      },

      // ----- wishlist (ids + snapshot, stored in this browser) -----
      wishlist: [],
      toggleWish(product) {
        const w = get().wishlist;
        set({ wishlist: w.some((x) => x.id === product.id) ? w.filter((x) => x.id !== product.id) : [...w, snapshot(product)] });
      },

      // ----- recent searches -----
      recent: [],
      addRecent(q) {
        const t = q.trim();
        if (!t) return;
        set({ recent: [t, ...get().recent.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6) });
      },
      clearRecent() { set({ recent: [] }); },

      // ----- delivery location chosen by the shopper -----
      location: null, // { lat, lng, label, quote }
      setLocation(location) { set({ location }); },

      // ----- session / settings (not persisted) -----
      user: null,
      setUser(user) { set({ user }); },
      settings: null,
      setSettings(settings) { set({ settings }); },
    }),
    {
      name: 'dreamplace-store',
      version: 1,
      partialize: (s) => ({ cart: s.cart, wishlist: s.wishlist, recent: s.recent, location: s.location }),
    },
  ),
);

export const cartCount = (s) => s.cart.reduce((a, l) => a + l.quantity, 0);
