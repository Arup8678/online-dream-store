import { Link } from 'react-router-dom';
import { useStore } from '../store.js';
import { Empty, Reveal, usePageTitle } from '../components/ui.jsx';

function Page({ title, eyebrow, children }) {
  usePageTitle(title);
  return (
    <div className="container-x max-w-3xl py-10 md:py-16">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan">{eyebrow}</p>}
      <h1 className="mt-1 font-display text-3xl font-extrabold md:text-5xl">{title}</h1>
      <div className="mt-8 space-y-6 leading-relaxed text-white/85 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_a]:text-cyan [&_a]:underline">{children}</div>
    </div>
  );
}

export function About() {
  const s = useStore((x) => x.settings) || {};
  const km = s.free_radius_km || 5;
  return (
    <Page title={`About ${s.brand_name || 'Dream Palace'}`} eyebrow="Our story">
      <p className="text-lg">{s.brand_name || 'Dream Palace'} is your neighbourhood shop for stationery, school supplies, toys, teddy bears and gifts — now with the convenience of ordering online.</p>
      <p>We started with a simple idea: parents and students shouldn’t have to hunt through crowded stores for notebooks the week before school, or settle for a generic gift. We hand-pick products from brands we trust, keep prices fair, and bring everything to your door.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[['🛵', `Free delivery within ${km} km`], ['🧸', 'Hand-picked, kid-safe products'], ['🤝', 'A real local shop you can call']].map(([i, t]) => <Reveal key={t}><div className="glass rounded-3xl p-5 text-center"><div className="text-4xl">{i}</div><p className="mt-2 font-semibold">{t}</p></div></Reveal>)}
      </div>
      <h2>What we sell</h2>
      <p>Pens, pencils, notebooks and registers, school bags, geometry boxes, water bottles and lunch boxes, art and craft supplies, toys, educational and STEM kits, teddy bears and soft toys, and gifts for every occasion.</p>
      <h2>Visit or get in touch</h2>
      <p>{s.shop_address}<br />{s.opening_hours}<br /><Link to="/contact">Contact us</Link> or <a href={`https://wa.me/${s.whatsapp_number}`}>message us on WhatsApp</a>.</p>
    </Page>
  );
}

export function Privacy() {
  const s = useStore((x) => x.settings) || {};
  const n = s.brand_name || 'Dream Palace';
  return (
    <Page title="Privacy Policy" eyebrow="Legal">
      <p>Last updated: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}. This policy explains what information {n} collects when you use this website and how we use it.</p>
      <h2>Information we collect</h2>
      <ul><li>Details you give us when ordering: name, mobile number, email (optional), delivery address and map location.</li><li>Account details if you register: name, email and a securely hashed password.</li><li>Messages you send through the contact form and your newsletter sign-up details.</li><li>Basic technical data such as your cart and wishlist, stored on your own device.</li></ul>
      <h2>How we use it</h2>
      <p>We use your information to process and deliver orders, calculate delivery distance and charges, contact you about your order, answer your questions, and (if you subscribe) send offers. We do not sell your personal information.</p>
      <h2>Payments</h2>
      <p>Cash on Delivery orders involve no card data. Online payments are processed by a third-party payment gateway; <b>we never receive or store your card, UPI PIN or netbanking details</b>.</p>
      <h2>Location</h2>
      <p>Your delivery pin is used only to measure distance from our shop and to deliver your order. We only use your device location if you tap “Use my current location”.</p>
      <h2>Sharing</h2>
      <p>We share information only with people who need it to fulfil your order (for example our delivery staff and the payment gateway) or when required by law.</p>
      <h2>Your choices</h2>
      <p>You can ask us to correct or delete your account and order contact details, or to stop marketing messages, by contacting us at {s.contact_email} or {s.contact_phone}.</p>
      <h2>Security</h2>
      <p>Passwords are stored hashed, and we take reasonable steps to protect your information. No online service can be 100% secure, so please keep your password private.</p>
    </Page>
  );
}

export function Terms() {
  const s = useStore((x) => x.settings) || {};
  const n = s.brand_name || 'Dream Palace';
  const km = s.free_radius_km || 5;
  return (
    <Page title="Terms & Conditions" eyebrow="Legal">
      <p>By placing an order with {n} you agree to these terms.</p>
      <h2>Orders &amp; pricing</h2>
      <ul><li>All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise.</li><li>An order is confirmed when the shop confirms it. We may cancel an order if an item is unavailable or details are incorrect; any online payment will then be refunded.</li><li>Product images are illustrative; colours and packaging may vary slightly.</li></ul>
      <h2>Delivery</h2>
      <ul><li>Delivery is <b>free within {km} km</b> of our shop, measured in a straight line from the shop to the pin you select at checkout.</li><li>Outside this area a delivery charge may apply. It is shown before you place your order and you must agree to it. We deliver up to a maximum distance of {s.max_delivery_km || 'our delivery limit'} km.</li><li>Please share an accurate address, PIN and mobile number. Delivery times are estimates, not guarantees.</li></ul>
      <h2>Payment</h2>
      <p>We accept Cash on Delivery and online payment. For COD, please keep the exact amount ready if possible.</p>
      <h2>Cancellations, returns &amp; refunds</h2>
      <ul><li>You may cancel an order before it is prepared from the Track Order page, or by contacting us.</li><li>If you receive a damaged, defective or wrong item, contact us within 48 hours with a photo and we will replace or refund it.</li><li>Opened art supplies, consumables and personalised items cannot be returned unless faulty.</li></ul>
      <h2>Accounts</h2>
      <p>You are responsible for keeping your login details safe. We may suspend accounts that misuse the site.</p>
      <h2>Contact</h2>
      <p>Questions? <Link to="/contact">Contact us</Link> or call {s.contact_phone}.</p>
    </Page>
  );
}

export function NotFound() {
  usePageTitle('Page not found');
  return <div className="container-x py-20"><Empty icon="🛸" title="This page drifted off into space">We couldn’t find what you were looking for.<div className="mt-4 flex justify-center gap-3"><Link to="/" className="btn btn-primary">Go home</Link><Link to="/shop" className="btn btn-ghost">Shop</Link></div></Empty></div>;
}
