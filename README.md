# Dream Palace — local stationery, toys & gifts store

Full-stack e-commerce: a cinematic 3D **storefront** and a separate **admin panel**, backed by one small Node API with a SQLite database (no external services needed to run locally).

| Part | Tech | Dev URL | Production URL |
| --- | --- | --- | --- |
| Storefront (`web/`) | React 19, Vite, Tailwind 4, Three.js / React Three Fiber, Leaflet | http://localhost:5173 | http://localhost:4000 |
| Admin panel (`admin/`) | React, Vite, Tailwind | http://localhost:5174/admin/ | http://localhost:4000/admin |
| API (`server/`) | Express 5, better-sqlite3, zod, JWT cookies | http://localhost:4000/api | same |

## Run it (Node 20+)

```bash
npm install
npm run seed        # loads 63 demo products, categories, offers, reviews + admin account
npm run dev         # API + storefront + admin with hot reload
```

Or as one process (what you'd deploy):

```bash
npm run build       # builds web/dist and admin/dist
npm start           # http://localhost:4000  (storefront)  ·  /admin  (admin panel)
```

Logins created by the seed:

* Admin: `admin@dreamplace.local` / `admin123` — **change it** in Admin → Settings → Change password.
* Demo customer: `demo@dreamplace.local` / `demo1234` (customers can also check out as guests).

Copy `server/.env.example` to `server/.env` and set at least `JWT_SECRET` (a long random string) before going live.

## What's in the box

**Storefront** — home (3D hero, categories, featured, best sellers, delivery-radius explainer, offers, benefits, reviews, newsletter/WhatsApp), shop with category / search / filters (category, price, brand, age, availability, rating) and sorting (mobile filter drawer), product page (gallery + video, quantity, Buy Now, wishlist, specs, reviews, related), cart with stock validation, 5-step checkout, order confirmation, order tracking timeline, customer account (orders, addresses, profile), wishlist, About, Contact, Privacy, Terms.

**Admin** — dashboard (revenue chart, low stock, top sellers), orders (status workflow, payment status, notes, map + WhatsApp links), products (full CRUD, image/video upload, specs, flags, quick stock/active toggles), categories & subcategories, customers, reviews moderation, contact inbox & subscribers, homepage offers, and **settings**.

### Delivery rules (all editable in Admin → Settings, nothing hard-coded)
Shop location (map pin), free-delivery radius (default 5 km), outside-radius fee (base + per extra km) and a maximum delivery distance. The distance is a straight-line (haversine) measurement computed **on the server** from the pin the customer drops. Inside the radius the fee is ₹0 and shows “FREE DELIVERY”; outside it the customer sees “Your location is outside our free 5 km delivery area”, the fee, and must tick a confirmation; beyond the maximum the order is refused.

### Payments
* **Cash on Delivery** — works out of the box.
* **Online** — `server/src/lib/payments.js` is the single integration point. With `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` set it creates real Razorpay orders, opens Razorpay Checkout, and verifies the signature server-side. Without keys it uses a clearly labelled **test gateway** so the whole flow can be exercised locally. Card data never touches this server.

### Performance & accessibility
The three.js bundle is lazy-loaded when the browser is idle, rendering pauses off-screen, pixel ratio is capped, and a lighter scene is used on phones. On low-power devices (≤2 cores/≤2 GB RAM, data-saver, no WebGL) or when `prefers-reduced-motion` is set, a CSS fallback replaces the 3D scene and animations are disabled.

## Changing the branding
Brand name, tagline, phone, WhatsApp number, e-mail, address and hours live in the database (Admin → Settings) and flow through the whole storefront. Defaults for a fresh database are in `server/src/db.js` (`DEFAULT_SETTINGS`). The logo mark is the 🪐 emoji tile in `web/src/components/Layout.jsx` (`Logo`); swap in an `<img>` there. Colours are the `@theme` tokens at the top of `web/src/index.css`.

## Demo data
Product pictures are generated SVG illustrations (`server/public/art`) so the demo has no image licensing issues — replace them with real photos from Admin → Products (upload up to 12 images and a video per product). `npm run seed -- --force` wipes the catalog and orders and re-seeds.

## Tests
`npm test` runs API integration tests (search, filters, delivery zones, order pricing & stock, payment verification, cancellation, admin auth and settings).

## Before going live
Set `JWT_SECRET` and a strong admin password; serve over HTTPS and set `COOKIE_SECURE=1`; add Razorpay keys; back up `server/data/dreamplace.db` and `server/uploads/`; have the Privacy Policy and Terms (`web/src/pages/Static.jsx`) reviewed for your business; add real product photos. Map tiles and address search use OpenStreetMap/Nominatim, which is fine for a small shop — for heavy traffic use a paid geocoding/tile provider.
