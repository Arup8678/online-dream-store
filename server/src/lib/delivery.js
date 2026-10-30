import { getSettings } from '../db.js';

const R = 6371; // earth radius, km

export function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Authoritative delivery quote. Shop location, radius and fees all come from
 * the settings table so the admin can change them at any time.
 */
export function quoteDelivery(lat, lng, settings = getSettings()) {
  const shopLat = Number(settings.shop_lat);
  const shopLng = Number(settings.shop_lng);
  const radius = Number(settings.free_radius_km);
  const flat = Number(settings.outside_fee_flat) || 0;
  const perKm = Number(settings.outside_fee_per_km) || 0;
  const maxKm = Number(settings.max_delivery_km) || 0; // 0 = no limit

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'NO_LOCATION', message: 'Please pick your delivery location on the map.' };
  }
  const distance = Math.round(haversineKm(shopLat, shopLng, lat, lng) * 100) / 100;
  if (distance <= radius) {
    return { ok: true, distanceKm: distance, free: true, fee: 0, radiusKm: radius, deliverable: true, message: 'FREE DELIVERY' };
  }
  if (maxKm > 0 && distance > maxKm) {
    return {
      ok: true, distanceKm: distance, free: false, fee: 0, radiusKm: radius, deliverable: false, maxKm,
      message: `Sorry, we deliver up to ${maxKm} km only. Your location is ${distance} km away.`,
    };
  }
  const fee = Math.round(flat + perKm * (distance - radius));
  return {
    ok: true, distanceKm: distance, free: false, fee, radiusKm: radius, deliverable: true,
    message: 'Your location is outside our free 5 km delivery area.'.replace('5 km', `${radius} km`),
  };
}
