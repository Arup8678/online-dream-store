import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Heart, Home, LayoutGrid, Search, ShoppingBag, User, MessageCircle, MapPin, Phone, Mail, Clock, X } from 'lucide-react';
import { useStore, cartCount } from '../store.js';
import SearchBox from './SearchBox.jsx';
import { Toaster } from './ui.jsx';

export function Logo({ className = '' }) {
  const name = useStore((s) => s.settings?.brand_name) || 'Dream Palace';
  return (
    <Link to="/" className={`flex items-center gap-2.5 font-display text-xl font-extrabold ${className}`} aria-label={`${name} home`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon via-[#5b8cff] to-cyan text-lg shadow-[0_0_24px_-4px_rgba(139,123,255,.9)]">🪐</span>
      <span>{name}</span>
    </Link>
  );
}

function Header() {
  const count = useStore(cartCount);
  const wish = useStore((s) => s.wishlist.length);
  const user = useStore((s) => s.user);
  const cats = useStore((s) => s.categories) || [];
  const [scrolled, setScrolled] = useState(false);
  const [mSearch, setMSearch] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return (
    <header className={`sticky top-0 z-40 transition ${scrolled ? 'border-b border-line bg-ink/85 backdrop-blur-xl' : 'bg-transparent'}`}>
      <div className="container-x flex h-16 items-center gap-3 md:gap-6">
        <Logo />
        <SearchBox className="hidden max-w-xl flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setMSearch(true)} className="btn btn-ghost !h-11 !w-11 !p-0 md:hidden" aria-label="Search"><Search size={19} /></button>
          <Link to="/wishlist" className="btn btn-ghost relative !h-11 !w-11 !p-0" aria-label="Wishlist"><Heart size={19} />{wish > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 text-[11px] font-bold text-black">{wish}</span>}</Link>
          <Link to={user ? '/account' : '/login'} className="btn btn-ghost !h-11 hidden !px-3 sm:inline-flex" aria-label="Account"><User size={19} /><span className="hidden lg:inline">{user ? user.name.split(' ')[0] : 'Login'}</span></Link>
          <Link to="/cart" className="btn btn-primary relative !h-11 !px-3.5" aria-label={`Cart, ${count} items`}><ShoppingBag size={19} /><span className="hidden sm:inline">Cart</span>{count > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 text-[11px] font-bold text-black">{count}</span>}</Link>
        </div>
      </div>
      <nav className="no-scrollbar container-x hidden gap-1 overflow-x-auto pb-2 md:flex" aria-label="Categories">
        <NavLink to="/shop" end className={({ isActive }) => `rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-white/10 ${isActive ? 'bg-white/10' : 'text-muted'}`}>All Products</NavLink>
        {cats.map((c) => (
          <NavLink key={c.slug} to={`/category/${c.slug}`} className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-white/10 ${isActive ? 'bg-white/10' : 'text-muted'}`}>{c.icon} {c.name}</NavLink>
        ))}
      </nav>
      {mSearch && (
        <div className="fixed inset-0 z-[80] bg-ink/95 p-4 backdrop-blur-xl md:hidden">
          <div className="flex items-start gap-2">
            <SearchBox autoFocus className="flex-1" onDone={() => setMSearch(false)} />
            <button onClick={() => setMSearch(false)} className="btn btn-ghost !h-[46px] !w-[46px] !p-0" aria-label="Close search"><X size={20} /></button>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileNav() {
  const count = useStore(cartCount);
  const user = useStore((s) => s.user);
  const items = [
    { to: '/', icon: Home, label: 'Home', end: true },
    { to: '/shop', icon: LayoutGrid, label: 'Shop' },
    { to: '/cart', icon: ShoppingBag, label: 'Cart', badge: count },
    { to: '/wishlist', icon: Heart, label: 'Saved' },
    { to: user ? '/account' : '/login', icon: User, label: user ? 'Account' : 'Login' },
  ];
  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-x-0 border-b-0 md:hidden" aria-label="Main">
      {items.map(({ to, icon: Icon, label, badge, end }) => (
        <NavLink key={label} to={to} end={end} className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-cyan' : 'text-muted'}`}>
          <span className="relative"><Icon size={21} />{badge > 0 && <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-pink px-1 text-[10px] font-bold text-black">{badge}</span>}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Footer() {
  const s = useStore((s) => s.settings) || {};
  const cats = useStore((s) => s.categories) || [];
  const name = s.brand_name || 'Dream Palace';
  return (
    <footer className="mt-20 border-t border-line bg-ink-2/80 pb-24 pt-14 md:pb-10">
      <div className="container-x grid gap-10 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-3 text-sm text-muted">{s.tagline}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-300">🛵 Free delivery within {s.free_radius_km || 5} km</p>
        </div>
        <div>
          <h4 className="mb-3 font-bold">Shop</h4>
          <ul className="space-y-2 text-sm text-muted">{cats.slice(0, 7).map((c) => <li key={c.slug}><Link className="hover:text-white" to={`/category/${c.slug}`}>{c.name}</Link></li>)}</ul>
        </div>
        <div>
          <h4 className="mb-3 font-bold">Help</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link className="hover:text-white" to="/track">Track your order</Link></li>
            <li><Link className="hover:text-white" to="/account">My account</Link></li>
            <li><Link className="hover:text-white" to="/about">About us</Link></li>
            <li><Link className="hover:text-white" to="/contact">Contact</Link></li>
            <li><Link className="hover:text-white" to="/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-white" to="/terms">Terms &amp; Conditions</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-bold">Visit / call us</h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0" />{s.shop_address}</li>
            <li className="flex gap-2"><Phone size={16} className="mt-0.5 shrink-0" /><a href={`tel:${(s.contact_phone || '').replace(/\s/g, '')}`} className="hover:text-white">{s.contact_phone}</a></li>
            <li className="flex gap-2"><Mail size={16} className="mt-0.5 shrink-0" />{s.contact_email}</li>
            <li className="flex gap-2"><Clock size={16} className="mt-0.5 shrink-0" />{s.opening_hours}</li>
            <li><a href={`https://wa.me/${s.whatsapp_number}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><MessageCircle size={16} /> WhatsApp us</a></li>
          </ul>
        </div>
      </div>
      <div className="container-x mt-10 flex flex-wrap justify-between gap-2 border-t border-line pt-6 text-xs text-muted">
        <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
        <span>Payments: Cash on Delivery · Online (UPI / cards via secure gateway). We never store card details.</span>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-black">Skip to content</a>
      <Header />
      <main id="main" className="min-h-[60dvh]"><Outlet /></main>
      <Footer />
      <MobileNav />
      <Toaster />
    </>
  );
}
