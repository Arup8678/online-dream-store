export class ApiError extends Error { constructor(m, status, data) { super(m); this.status = status; this.data = data; } }

export async function api(path, { method = 'GET', body, params, form } = {}) {
  let url = `/api/admin${path}`;
  if (params) { const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)); if ([...q].length) url += `?${q}`; }
  let res;
  try {
    res = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch { throw new ApiError('Cannot reach the server.', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Request failed', res.status, data);
  return data;
}

export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const when = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
export const STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
export const STATUS_COLOR = { NEW: '#8b7bff', CONFIRMED: '#22d3ee', PREPARING: '#facc15', OUT_FOR_DELIVERY: '#fb923c', DELIVERED: '#4ade80', CANCELLED: '#fb7185' };
export const PAY_COLOR = { PENDING: '#facc15', PAID: '#4ade80', FAILED: '#fb7185', REFUNDED: '#94a3b8' };
