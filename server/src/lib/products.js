import { db } from '../db.js';

// Shape a DB row into what the front-ends consume.
export function shapeProduct(r) {
  if (!r) return null;
  const sale = r.discount_price != null && r.discount_price > 0 && r.discount_price < r.price;
  return {
    id: r.id,
    sku: r.sku,
    slug: r.slug,
    name: r.name,
    description: r.description,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    categoryName: r.category_name,
    categorySlug: r.category_slug,
    subcategoryName: r.subcategory_name,
    price: r.price,
    discountPrice: sale ? r.discount_price : null,
    salePrice: sale ? r.discount_price : r.price,
    discountPercent: sale ? Math.round((1 - r.discount_price / r.price) * 100) : 0,
    stock: r.stock,
    inStock: r.stock > 0,
    images: JSON.parse(r.images || '[]'),
    videoUrl: r.video_url,
    brand: r.brand,
    size: r.size,
    color: r.color,
    ageGroup: r.age_group,
    specs: JSON.parse(r.specs || '{}'),
    featured: !!r.featured,
    bestSeller: !!r.best_seller,
    newArrival: !!r.new_arrival,
    active: !!r.active,
    rating: Math.round(r.rating_avg * 10) / 10,
    ratingCount: r.rating_count,
    soldCount: r.sold_count,
    createdAt: r.created_at,
  };
}

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug, s.name AS subcategory_name,
         COALESCE(CASE WHEN p.discount_price > 0 AND p.discount_price < p.price THEN p.discount_price END, p.price) AS eff_price
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN categories s ON s.id = p.subcategory_id
`;

export function recalcRating(productId) {
  const r = db.prepare('SELECT AVG(rating) a, COUNT(*) n FROM reviews WHERE product_id = ? AND approved = 1').get(productId);
  db.prepare('UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?').run(r.a || 0, r.n, productId);
}
