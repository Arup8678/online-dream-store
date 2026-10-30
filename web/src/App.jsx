import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { api } from './lib/api.js';
import { useStore } from './store.js';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';

const Shop = lazy(() => import('./pages/Shop.jsx'));
const Product = lazy(() => import('./pages/Product.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation.jsx'));
const Track = lazy(() => import('./pages/Track.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
import { About, Privacy, Terms, NotFound } from './pages/Static.jsx';

export default function App() {
  useEffect(() => {
    api('/settings').then((s) => useStore.getState().setSettings(s)).catch(() => {});
    api('/categories').then((c) => useStore.setState({ categories: c })).catch(() => {});
    api('/auth/me').then((r) => useStore.getState().setUser(r.user)).catch(() => {});
    useStore.getState().syncCart();
  }, []);
  return (
    <Suspense fallback={<div className="container-x py-24 text-center text-muted">Loading…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="category/:slug" element={<Shop />} />
          <Route path="search" element={<Shop />} />
          <Route path="product/:slug" element={<Product />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:orderNo" element={<OrderConfirmation />} />
          <Route path="track" element={<Track />} />
          <Route path="account" element={<Account />} />
          <Route path="login" element={<Login />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
