import { useState } from 'react';
import { api, money, when } from '../api.js';
import { ErrorBox, PageHead, useAsync } from '../ui.jsx';

export default function Customers() {
  const [q, setQ] = useState('');
  const { data, error } = useAsync(() => api('/customers', { params: { q } }), [q]);
  return (
    <>
      <PageHead title="Customers" sub="Registered accounts (guest checkouts appear in Orders)" />
      <input className="input mb-4 !w-72" placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
      {error && <ErrorBox msg={error} />}
      <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Phone</th><th className="th">Orders</th><th className="th">Spent</th><th className="th">Joined</th></tr></thead>
        <tbody>{data?.map((c) => <tr key={c.id}><td className="td font-semibold">{c.name}</td><td className="td">{c.email}</td><td className="td">{c.phone || '—'}</td><td className="td">{c.orders}</td><td className="td">{money(c.spent)}</td><td className="td text-muted">{when(c.created_at)}</td></tr>)}
          {data?.length === 0 && <tr><td className="td text-muted" colSpan={6}>No customers yet.</td></tr>}</tbody></table></div>
    </>
  );
}
