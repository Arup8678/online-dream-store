const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
export const money = (n) => (Number.isInteger(n) ? inr.format(n) : inr2.format(n));

export const dateTime = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
export const dateOnly = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const STATUS = {
  NEW: { label: 'Order placed', short: 'New', color: '#8b7bff', icon: '🧾', text: 'We have received your order.' },
  CONFIRMED: { label: 'Confirmed', short: 'Confirmed', color: '#22d3ee', icon: '✅', text: 'The shop has confirmed your order.' },
  PREPARING: { label: 'Preparing', short: 'Preparing', color: '#facc15', icon: '📦', text: 'Your items are being packed.' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', short: 'On the way', color: '#fb923c', icon: '🛵', text: 'Your order is on its way to you.' },
  DELIVERED: { label: 'Delivered', short: 'Delivered', color: '#4ade80', icon: '🎉', text: 'Delivered. Enjoy!' },
  CANCELLED: { label: 'Cancelled', short: 'Cancelled', color: '#fb7185', icon: '✖️', text: 'This order was cancelled.' },
};
export const STEPS = ['NEW', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export const img = (p) => p?.images?.[0] || '';
