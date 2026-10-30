import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config } from './config.js';
import { slugify } from './lib/util.js';
import { recalcRating } from './lib/products.js';
import { ensureAdmin } from './bootstrap.js';

const force = process.argv.includes('--force');
const hasProducts = db.prepare('SELECT COUNT(*) n FROM products').get().n > 0;
if (hasProducts && !force) {
  console.log('Catalog already has products. Use `npm run seed -- --force` to wipe catalog/orders and reseed.');
  if (process.argv[1]?.endsWith('seed.js')) process.exit(0);
} else {
  if (force) {
    db.exec('DELETE FROM reviews; DELETE FROM order_events; DELETE FROM order_items; DELETE FROM orders; DELETE FROM products; DELETE FROM categories; DELETE FROM offers;');
  }

// ---------- categories ----------
const TREE = [
  ['Stationery', '✏️', '#7c5cff', ['Pens', 'Pencils & Erasers', 'Notebooks & Registers', 'Sharpeners', 'Desk Accessories']],
  ['School Supplies', '🎒', '#22d3ee', ['School Bags', 'Geometry Boxes', 'Water Bottles', 'Lunch Boxes']],
  ['Toys', '🚗', '#fb923c', ['Vehicles & Action', 'Building Blocks', 'Puzzles & Games']],
  ['Teddy & Soft Toys', '🧸', '#f472b6', ['Teddy Bears', 'Soft Animals']],
  ['Art & Craft', '🎨', '#a3e635', ['Drawing Books', 'Colours & Paints', 'Craft Kits']],
  ['Educational Toys', '🔬', '#38bdf8', ['STEM Kits', 'Learning Toys']],
  ['Gifts', '🎁', '#fb7185', ['Gift Sets', 'Cards & Wrap']],
  ['New Arrivals', '✨', '#facc15', []],
];
const catId = {};
const insCat = db.prepare('INSERT INTO categories (parent_id,slug,name,icon,accent,description,sort_order) VALUES (?,?,?,?,?,?,?)');
TREE.forEach(([name, icon, accent, subs], i) => {
  const id = Number(insCat.run(null, slugify(name), name, icon, accent, '', i).lastInsertRowid);
  catId[name] = { id, slug: slugify(name) };
  subs.forEach((s, j) => { catId[s] = { id: Number(insCat.run(id, slugify(s), s, icon, accent, '', j).lastInsertRowid), parent: id }; });
});

// ---------- artwork (SVG, generated locally so the demo has no external image dependency) ----------
const artDir = path.join(config.publicDir, 'art');
fs.mkdirSync(artDir, { recursive: true });
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
};
function art(file, emoji, color, variant) {
  const a = shade(color, 40), b = shade(color, -70);
  const dots = Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 137) % 800}" cy="${(i * 211 + 60) % 800}" r="${14 + ((i * 7) % 26)}" fill="#fff" opacity="${0.04 + (i % 4) * 0.02}"/>`).join('');
  const body = [
    `<text x="400" y="470" font-size="340" text-anchor="middle" filter="url(#sh)">${emoji}</text>`,
    `<g transform="rotate(-14 400 400)"><text x="400" y="500" font-size="420" text-anchor="middle" filter="url(#sh)">${emoji}</text></g>`,
    `${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => `<text x="${80 + c * 160}" y="${160 + r * 160}" font-size="80" text-anchor="middle" opacity="${(r + c) % 2 ? 0.35 : 0.2}">${emoji}</text>`).join('')).join('')}<text x="400" y="480" font-size="260" text-anchor="middle" filter="url(#sh)">${emoji}</text>`,
  ][variant];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs><radialGradient id="g" cx="${variant === 1 ? 70 : 30}%" cy="25%" r="95%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
<filter id="sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="26" stdDeviation="22" flood-color="#000" flood-opacity=".45"/></filter></defs>
<rect width="800" height="800" fill="url(#g)"/>${dots}<ellipse cx="400" cy="690" rx="190" ry="26" fill="#000" opacity=".22"/>${body}</svg>`;
  fs.writeFileSync(path.join(artDir, file), svg);
}

// ---------- products ----------
// [sub, name, brand, price, salePrice|0, emoji, color, age, stock, flags, description, specs]
const P = [
  ['Pens', 'GelGlide Ultra Gel Pens (Pack of 10)', 'Pentel', 180, 149, '🖊️', '#3b82f6', '6+ years', 120, 'FB', 'Smooth 0.5 mm gel ink that dries fast and does not smudge — ten vivid colours in a reusable pouch.', { 'Tip size': '0.5 mm', 'Pack': '10 pens', 'Ink': 'Water-based gel' }],
  ['Pens', 'Classic Blue Ball Pens (Box of 50)', 'Reynolds', 250, 0, '🖋️', '#2563eb', '8+ years', 200, 'B', 'The everyday exam favourite. Comfortable grip, consistent flow and a long-lasting refill.', { 'Tip size': '0.7 mm', 'Pack': '50 pens', 'Colour': 'Blue' }],
  ['Pens', 'Fountain Pen Starter Set', 'Camlin', 399, 349, '🖋️', '#6366f1', '10+ years', 40, 'F', 'A beginner-friendly fountain pen with 6 cartridges and a converter for refillable ink.', { 'Nib': 'Medium steel', 'Includes': '6 cartridges + converter' }],
  ['Pens', 'Pastel Highlighter Set (6 colours)', 'Stabilo', 220, 189, '🖍️', '#f59e0b', '8+ years', 85, 'N', 'Soft pastel highlighters that glow without bleeding through the page.', { 'Pack': '6 colours', 'Tip': 'Chisel' }],
  ['Pencils & Erasers', 'HB Pencils Value Pack (Box of 24)', 'Natraj', 120, 99, '✏️', '#eab308', '5+ years', 300, 'B', 'Pre-sharpened, smooth-writing HB pencils with break-resistant lead.', { 'Grade': 'HB', 'Pack': '24 pencils' }],
  ['Pencils & Erasers', 'Mechanical Pencil Set 0.5 mm', 'Pentel', 299, 259, '✏️', '#14b8a6', '10+ years', 60, 'F', 'Metal-grip mechanical pencil with 3 lead tubes and two spare erasers.', { 'Lead': '0.5 mm', 'Includes': '3 lead tubes' }],
  ['Pencils & Erasers', 'Scented Fruity Erasers (Set of 8)', 'Doms', 90, 0, '🧽', '#ec4899', '4+ years', 150, 'N', 'Dust-free erasers in fun fruit shapes with a gentle scent.', { 'Pack': '8 erasers' }],
  ['Pencils & Erasers', 'Jumbo Kids Triangle Pencils (Pack of 6)', 'Faber-Castell', 140, 119, '✏️', '#fb923c', '3+ years', 90, '', 'Thick triangular pencils that help little hands learn the right grip.', { 'Grade': '2B', 'Pack': '6 pencils' }],
  ['Notebooks & Registers', 'Ruled Notebook A4 (Pack of 6)', 'Classmate', 330, 299, '📓', '#8b5cf6', '6+ years', 140, 'B', '172 pages of bright, smooth paper per notebook. Single-line ruling, sturdy binding.', { 'Size': 'A4', 'Pages': '172 each', 'Pack': '6' }],
  ['Notebooks & Registers', 'Hardbound Register 400 Pages', 'Navneet', 260, 0, '📒', '#ef4444', '10+ years', 75, '', 'Case-bound register with numbered pages, ideal for accounts and long-term notes.', { 'Pages': '400', 'Binding': 'Hardbound' }],
  ['Notebooks & Registers', 'Space Explorer Spiral Diary', 'Dream Palace', 199, 169, '🚀', '#0ea5e9', '8+ years', 110, 'FN', 'Wire-bound diary with a glossy galaxy cover and 160 dotted pages.', { 'Pages': '160 dotted', 'Size': 'B5' }],
  ['Notebooks & Registers', 'Drawing + Writing Combo Book', 'Camlin', 150, 129, '📔', '#22c55e', '6+ years', 95, '', 'Half-plain, half-ruled pages for drawing and writing in the same notebook.', { 'Pages': '120' }],
  ['Sharpeners', 'Metal Sharpener Duo (Pack of 4)', 'Apsara', 60, 0, '🔪'.replace('🔪', '✏️'), '#94a3b8', '5+ years', 220, '', 'Razor-sharp metal blade sharpeners for neat points every time.', { 'Pack': '4' }],
  ['Sharpeners', 'Desk Sharpener with Waste Bin', 'Maped', 110, 89, '🗑️', '#f43f5e', '5+ years', 70, 'N', 'A tidy sharpener with a clear shavings box that clicks shut.', { 'Material': 'ABS plastic' }],
  ['Desk Accessories', 'Desk Organizer Pen Stand', 'Dream Palace', 349, 299, '🗂️', '#a855f7', 'All ages', 55, 'F', 'Four-compartment organizer for pens, scissors, notes and phone.', { 'Compartments': '4' }],
  ['Desk Accessories', 'Sticky Notes Mega Pack (1000 sheets)', 'Post-it', 199, 0, '🗒️', '#facc15', 'All ages', 130, '', 'Ten neon pads of repositionable notes.', { 'Sheets': '1000' }],
  ['School Bags', 'Galaxy Explorer School Backpack 25L', 'Wildcraft', 1299, 999, '🎒', '#6366f1', '8+ years', 35, 'FB', 'Ergonomic padded straps, water-resistant fabric and a dedicated laptop/tablet sleeve.', { 'Capacity': '25 L', 'Material': 'Water-resistant polyester' }],
  ['School Bags', 'Kinder Buddy Mini Backpack', 'Skybags', 749, 649, '🎒', '#f472b6', '3-6 years', 45, 'N', 'A light, bright backpack sized for nursery and KG kids.', { 'Capacity': '12 L', 'Weight': '280 g' }],
  ['School Bags', 'Trolley School Bag 32L', 'American Tourister', 1999, 1699, '🧳', '#0ea5e9', '8+ years', 18, '', 'Wheeled bag with telescopic handle — gentle on little backs.', { 'Capacity': '32 L' }],
  ['Geometry Boxes', 'Premium Geometry Box (Metal)', 'Camlin', 249, 219, '📐', '#14b8a6', '9+ years', 80, 'B', 'Complete maths set with compass, divider, protractor, set squares and more.', { 'Pieces': '10', 'Case': 'Metal' }],
  ['Geometry Boxes', 'Pencil Box with Sharpener & Eraser', 'Doms', 160, 139, '🧰', '#f97316', '5+ years', 100, '', 'Two-layer pencil case with magnetic closure.', { 'Compartments': '2' }],
  ['Water Bottles', 'Steel Insulated Bottle 600 ml', 'Milton', 549, 449, '🍶', '#06b6d4', '6+ years', 65, 'FB', 'Keeps drinks cold for 18 hours or hot for 12. Leak-proof lid, food-grade steel.', { 'Capacity': '600 ml', 'Insulation': 'Double wall' }],
  ['Water Bottles', 'Sipper Bottle with Straw 500 ml', 'Cello', 249, 0, '🥤', '#ec4899', '4+ years', 120, 'N', 'BPA-free sipper with a flip-top straw and carry loop.', { 'Capacity': '500 ml', 'BPA': 'Free' }],
  ['Lunch Boxes', 'Insulated Lunch Box Set (3 containers)', 'Milton', 699, 599, '🍱', '#84cc16', '5+ years', 50, 'F', 'Three leak-proof containers in an insulated carry bag with a spoon.', { 'Containers': '3', 'Bag': 'Insulated' }],
  ['Lunch Boxes', 'Dino Snack Lunch Box', 'Cello', 299, 249, '🦖', '#22c55e', '3+ years', 70, 'B', 'Compact dino-themed box with a snap lock and spill-proof seal.', { 'Capacity': '700 ml' }],
  ['Vehicles & Action', 'Remote Control Racing Car', 'Hot Wheels', 1299, 1049, '🏎️', '#ef4444', '6+ years', 28, 'FB', '2.4 GHz remote control car with rechargeable battery and LED headlights.', { 'Range': '30 m', 'Battery': 'Rechargeable' }],
  ['Vehicles & Action', 'Die-cast Cars Gift Pack (Set of 10)', 'Hot Wheels', 899, 749, '🚗', '#f97316', '4+ years', 60, 'B', 'Ten collectible 1:64 scale cars in a showcase pack.', { 'Scale': '1:64', 'Pack': '10 cars' }],
  ['Vehicles & Action', 'Transformer Robot Truck', 'Funskool', 799, 0, '🤖', '#3b82f6', '6+ years', 33, 'N', 'Converts from a rugged truck to a robot in 12 easy steps.', { 'Steps': '12' }],
  ['Building Blocks', 'Creative Blocks Bucket (250 pcs)', 'Lego Compatible', 999, 849, '🧱', '#eab308', '4+ years', 48, 'FB', 'Colourful bricks that fit all major brands. Comes with an idea booklet.', { 'Pieces': '250' }],
  ['Building Blocks', 'Magnetic Tiles Set (60 pcs)', 'Magna', 1499, 1299, '🔷', '#8b5cf6', '3+ years', 22, 'N', 'Translucent magnetic tiles that snap together to build towers, castles and more.', { 'Pieces': '60' }],
  ['Puzzles & Games', '100-Piece World Map Puzzle', 'Ravensburger', 449, 389, '🧩', '#0ea5e9', '6+ years', 40, '', 'A beautiful illustrated map puzzle that teaches geography.', { 'Pieces': '100' }],
  ['Puzzles & Games', 'Family Ludo & Snakes Board Game', 'Funskool', 299, 0, '🎲', '#f59e0b', '5+ years', 85, 'B', 'Two classic games on one big foldable board.', { 'Players': '2-4' }],
  ['Puzzles & Games', 'Rubik Speed Cube 3×3', 'Rubik’s', 349, 299, '🧊', '#22c55e', '8+ years', 66, 'F', 'Smooth, fast-turning cube for beginners and speed-cubers.', { 'Size': '3×3×3' }],
  ['Teddy Bears', 'Cuddly Teddy Bear 60 cm', 'SoftBuddy', 899, 749, '🧸', '#d97706', '1+ years', 40, 'FB', 'Ultra-soft, huggable teddy with a satin bow. Machine washable.', { 'Height': '60 cm', 'Fill': 'Hypoallergenic fibre' }],
  ['Teddy Bears', 'Giant Teddy Bear 120 cm', 'SoftBuddy', 2499, 1999, '🧸', '#b45309', '3+ years', 12, 'F', 'A truly giant 4-foot teddy — the ultimate gift.', { 'Height': '120 cm' }],
  ['Teddy Bears', 'Mini Teddy Keychain (Set of 3)', 'SoftBuddy', 249, 199, '🐻', '#f59e0b', '5+ years', 150, 'N', 'Tiny plush teddies that clip to bags and keys.', { 'Pack': '3' }],
  ['Teddy Bears', 'Love Heart Teddy 40 cm', 'SoftBuddy', 599, 0, '💝', '#ec4899', '3+ years', 36, '', 'Holds a satin heart — perfect for birthdays and anniversaries.', { 'Height': '40 cm' }],
  ['Soft Animals', 'Plush Unicorn 45 cm', 'SoftBuddy', 799, 649, '🦄', '#d946ef', '3+ years', 30, 'B', 'A shimmering rainbow-mane unicorn that kids adore.', { 'Height': '45 cm' }],
  ['Soft Animals', 'Panda Pal Pillow Plush', 'SoftBuddy', 699, 599, '🐼', '#64748b', '2+ years', 44, 'F', 'Half toy, half pillow — soft enough for naps and car rides.', { 'Height': '50 cm' }],
  ['Soft Animals', 'Jungle Friends Plush Set (4 pcs)', 'SoftBuddy', 1199, 999, '🦁', '#f59e0b', '3+ years', 20, 'N', 'Lion, elephant, giraffe and monkey in one soft set.', { 'Pieces': '4' }],
  ['Drawing Books', 'A3 Sketchbook 100 gsm (60 sheets)', 'Camlin', 299, 259, '🖼️', '#f43f5e', '8+ years', 70, 'B', 'Thick, bright-white paper that takes pencil, ink and light colour.', { 'Size': 'A3', 'Paper': '100 gsm' }],
  ['Drawing Books', 'Colouring Book Collection (Set of 4)', 'Navneet', 220, 189, '🖍️', '#fb923c', '3+ years', 100, 'N', 'Animals, vehicles, fairy tales and mandalas to colour.', { 'Books': '4' }],
  ['Colours & Paints', 'Wax Crayons 48 Shades', 'Camlin', 199, 169, '🖍️', '#ef4444', '3+ years', 140, 'FB', 'Non-toxic, smooth crayons with rich pigments.', { 'Shades': '48' }],
  ['Colours & Paints', 'Watercolour Cakes Set 24 Shades', 'Faber-Castell', 399, 349, '🎨', '#06b6d4', '6+ years', 55, 'F', 'Vivid watercolour cakes with a free brush.', { 'Shades': '24' }],
  ['Colours & Paints', 'Glitter Poster Colours (Pack of 12)', 'Camlin', 249, 0, '✨', '#a855f7', '5+ years', 80, 'N', 'Sparkling poster paints for projects and posters.', { 'Pack': '12 tubes' }],
  ['Colours & Paints', 'Sketch Pens 60 Shades', 'Staedtler', 449, 399, '🖊️', '#22d3ee', '5+ years', 62, 'B', 'Washable, bright sketch pens with fine and bold tips.', { 'Shades': '60' }],
  ['Craft Kits', 'DIY Origami Paper Kit', 'Dream Palace', 249, 199, '🦢', '#10b981', '7+ years', 90, 'N', '200 sheets with step-by-step guides for 20 models.', { 'Sheets': '200' }],
  ['Craft Kits', 'Clay Modelling Set (12 colours)', 'Play-Doh', 399, 349, '🏺', '#f97316', '3+ years', 70, 'B', 'Soft, non-toxic dough with moulds and tools.', { 'Colours': '12' }],
  ['Craft Kits', 'Friendship Bracelet Making Kit', 'Dream Palace', 349, 299, '📿', '#ec4899', '8+ years', 48, 'F', 'Beads, threads and charms to make 15 bracelets.', { 'Makes': '15 bracelets' }],
  ['Craft Kits', 'Scissors, Glue & Tape Craft Pack', 'Fevicol', 280, 0, '✂️', '#3b82f6', '5+ years', 120, '', 'Everything for school projects in one pack.', { 'Items': '6' }],
  ['STEM Kits', 'Junior Science Lab Kit', 'Smartivity', 1299, 1099, '🔬', '#06b6d4', '8+ years', 26, 'FB', '30+ safe experiments with a microscope and test tubes.', { 'Experiments': '30+' }],
  ['STEM Kits', 'Solar Robot Kit', 'Smartivity', 899, 799, '🤖', '#22c55e', '10+ years', 32, 'N', 'Build a robot powered by sunlight — no batteries needed.', { 'Power': 'Solar' }],
  ['STEM Kits', 'Electronics Circuit Builder', 'Funskool', 1599, 1399, '💡', '#eab308', '10+ years', 15, 'F', 'Snap-together circuits for 100 projects.', { 'Projects': '100' }],
  ['STEM Kits', 'Beginner Telescope 50 mm', 'Celestron', 2499, 2199, '🔭', '#6366f1', '9+ years', 10, '', 'Explore the moon and planets with a sturdy tripod.', { 'Aperture': '50 mm' }],
  ['Learning Toys', 'Alphabet & Number Wooden Puzzle', 'Skillofun', 349, 299, '🔤', '#f59e0b', '2+ years', 85, 'B', 'Chunky wooden pieces for early learning.', { 'Material': 'Wood' }],
  ['Learning Toys', 'Abacus Learning Frame', 'Skillofun', 299, 0, '🧮', '#ef4444', '4+ years', 60, '', 'Teaches counting and basic maths the hands-on way.', { 'Rows': '10' }],
  ['Learning Toys', 'Talking Alphabet Flash Cards', 'Funskool', 499, 429, '🗣️', '#0ea5e9', '3+ years', 44, 'N', 'Electronic flash cards that say the letters and words aloud.', { 'Cards': '52' }],
  ['Learning Toys', 'Musical Xylophone 8 Notes', 'Funskool', 549, 479, '🎼', '#d946ef', '3+ years', 38, 'F', 'Colourful xylophone with songbook and mallets.', { 'Notes': '8' }],
  ['Gift Sets', 'Back-to-School Stationery Gift Box', 'Dream Palace', 899, 749, '🎁', '#f43f5e', '6+ years', 40, 'FB', 'Pens, notebook, geometry box and extras in a gift box.', { 'Items': '12' }],
  ['Gift Sets', 'Teddy & Chocolate Gift Hamper', 'Dream Palace', 1499, 1299, '🧸', '#f472b6', 'All ages', 25, 'F', 'A plush teddy with chocolates and a greeting card.', { 'Includes': 'Teddy, chocolates, card' }],
  ['Gift Sets', 'Little Artist Gift Set', 'Dream Palace', 1099, 949, '🎨', '#14b8a6', '5+ years', 30, 'N', 'Crayons, paints, sketchbook and brushes — all in a carry case.', { 'Items': '30' }],
  ['Cards & Wrap', 'Birthday Card & Wrap Combo', 'Dream Palace', 149, 119, '💌', '#fb7185', 'All ages', 200, '', 'A card and 3 sheets of wrapping paper.', { 'Contents': 'Card + 3 sheets' }],
  ['Cards & Wrap', 'Balloon Party Pack (50 balloons)', 'Dream Palace', 199, 0, '🎈', '#ef4444', '3+ years', 90, 'N', 'Multicolour balloons for every celebration.', { 'Balloons': '50' }],
];

const insP = db.prepare(`INSERT INTO products (sku,slug,name,description,category_id,subcategory_id,price,discount_price,stock,images,brand,color,age_group,specs,featured,best_seller,new_arrival,sold_count,created_at)
  VALUES (@sku,@slug,@name,@description,@category_id,@subcategory_id,@price,@discount_price,@stock,@images,@brand,@color,@age_group,@specs,@featured,@best_seller,@new_arrival,@sold_count,@created_at)`);
const usedSlugs = new Set();
let n = 0;
db.transaction(() => {
  for (const [sub, name, brand, price, sale, emoji, color, age, stock, flags, desc, specs] of P) {
    const s = catId[sub];
    const top = db.prepare('SELECT * FROM categories WHERE id = ?').get(s.parent);
    let slug = slugify(name);
    while (usedSlugs.has(slug)) slug += '-2';
    usedSlugs.add(slug);
    n += 1;
    const files = [`${slug}.svg`, `${slug}-2.svg`, `${slug}-3.svg`];
    files.forEach((f, v) => art(f, emoji, color, v));
    const ageDays = flags.includes('N') ? n % 20 : 40 + ((n * 17) % 300);
    insP.run({
      sku: `DP-${top.slug.slice(0, 3).toUpperCase()}-${String(n).padStart(3, '0')}`,
      slug, name, description: `${desc}\n\nChosen by our team for quality and value, and delivered free within our local delivery zone. Ask us on WhatsApp if you'd like a bulk or school order.`,
      category_id: top.id, subcategory_id: s.id, price, discount_price: sale || null, stock,
      images: JSON.stringify(files.map((f) => `/art/${f}`)), brand, color: '', age_group: age,
      specs: JSON.stringify({ Brand: brand, 'Age group': age, ...specs }),
      featured: flags.includes('F') ? 1 : 0, best_seller: flags.includes('B') ? 1 : 0, new_arrival: flags.includes('N') ? 1 : 0,
      sold_count: flags.includes('B') ? 80 + ((n * 37) % 220) : (n * 13) % 70,
      created_at: new Date(Date.now() - ageDays * 864e5).toISOString().replace('T', ' ').slice(0, 19),
    });
  }
})();

// ---------- reviews ----------
const names = ['Aarav S.', 'Priya M.', 'Rohan K.', 'Sneha P.', 'Vikram T.', 'Ananya R.', 'Karan D.', 'Meera J.', 'Rahul B.', 'Isha G.', 'Neha A.', 'Arjun V.'];
const bodies = {
  5: ['Excellent quality and my daughter loves it. Delivered to our door within the hour!', 'Exactly as described and great value. Will order again for the new school year.', 'Beautiful product, the kids were thrilled. Packaging was very neat too.', 'Fast local delivery and very friendly shop. Highly recommended for school shopping.'],
  4: ['Very good quality for the price. Slightly smaller than I expected but works well.', 'Nice product, arrived the same day. Colours are lovely.', 'Good value. My son uses it every day at school.'],
  3: ['Decent for the price, nothing special.'],
};
const products = db.prepare('SELECT id, sold_count FROM products').all();
const insR = db.prepare('INSERT INTO reviews (product_id, author, rating, title, body, created_at) VALUES (?,?,?,?,?,?)');
db.transaction(() => {
  products.forEach((p, i) => {
    const count = 2 + ((p.id * 3) % 4);
    for (let k = 0; k < count; k++) {
      const rating = [5, 5, 4, 5, 4, 3][(p.id + k * 2) % 6];
      const pool = bodies[rating];
      insR.run(p.id, names[(p.id + k * 5) % names.length], rating, ['Loved it!', 'Great buy', 'Worth it', 'Happy with this'][(i + k) % 4], pool[(p.id + k) % pool.length], new Date(Date.now() - ((p.id * 3 + k * 11) % 90) * 864e5).toISOString().replace('T', ' ').slice(0, 19));
    }
    recalcRating(p.id);
  });
})();

// ---------- offers ----------
const insO = db.prepare('INSERT INTO offers (title,subtitle,badge,link,accent,sort_order) VALUES (?,?,?,?,?,?)');
insO.run('Back to School Sale', 'Up to 30% off bags, bottles & geometry boxes', 'UP TO 30% OFF', '/shop?category=school-supplies&onSale=1', '#22d3ee', 0);
insO.run('Cuddle Season', 'Teddy bears & soft toys at special prices', 'TEDDY DEALS', '/shop?category=teddy-and-soft-toys&onSale=1', '#f472b6', 1);
insO.run('Little Scientists', 'STEM kits that make learning fun', 'STEM SALE', '/shop?category=educational-toys&onSale=1', '#facc15', 2);

// ---------- demo customer ----------
ensureAdmin();
if (!db.prepare("SELECT 1 FROM users WHERE email = 'demo@dreamplace.local'").get()) {
  db.prepare("INSERT INTO users (name,email,phone,password_hash) VALUES ('Demo Parent','demo@dreamplace.local','9876501234',?)").run(bcrypt.hashSync('demo1234', 10));
}
console.log(`Seeded ${db.prepare('SELECT COUNT(*) n FROM products').get().n} products, ${db.prepare('SELECT COUNT(*) n FROM categories').get().n} categories.`);
console.log(`Admin: ${config.adminEmail} / ${config.adminPassword}   ·   Demo customer: demo@dreamplace.local / demo1234`);
} // close if (!hasProducts || force)
