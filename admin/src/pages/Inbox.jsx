import { useState } from 'react';
import { api, when } from '../api.js';
import { ErrorBox, PageHead, toast, useAsync } from '../ui.jsx';

const Stars = ({ n }) => <span className="text-amber-300">{'★'.repeat(n)}<span className="text-white/20">{'★'.repeat(5 - n)}</span></span>;

export default function Inbox() {
  const [tab, setTab] = useState('reviews');
  const reviews = useAsync(() => api('/reviews'), []);
  const msgs = useAsync(() => api('/messages'), []);
  const subs = useAsync(() => api('/subscribers'), []);
  const run = async (fn, r) => { try { await fn(); r(); } catch (e) { toast(e.message, 'error'); } };
  const pending = reviews.data?.filter((r) => !r.approved).length || 0;
  const unread = msgs.data?.filter((m) => !m.handled).length || 0;
  return (
    <>
      <PageHead title="Reviews & Inbox" />
      <div className="mb-4 flex gap-2">
        {[['reviews', `Reviews${pending ? ` (${pending} hidden)` : ''}`], ['messages', `Messages${unread ? ` (${unread} new)` : ''}`], ['subs', 'Subscribers']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`}>{l}</button>)}
      </div>
      {(reviews.error || msgs.error) && <ErrorBox msg={reviews.error || msgs.error} />}
      {tab === 'reviews' && <div className="space-y-3">{reviews.data?.map((r) => (
        <div key={r.id} className={`card p-4 ${r.approved ? '' : 'border-amber-400/40'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><Stars n={r.rating} /> <b className="ml-2">{r.title}</b></div><span className="text-xs text-muted">{r.author} on <i>{r.product}</i> · {when(r.created_at)}</span></div>
          {r.body && <p className="mt-1 text-sm text-white/80">{r.body}</p>}
          <div className="mt-2 flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => run(() => api(`/reviews/${r.id}`, { method: 'PUT', body: { approved: !r.approved } }), reviews.reload)}>{r.approved ? 'Hide' : 'Approve & show'}</button><button className="btn btn-danger btn-sm" onClick={() => confirm('Delete this review?') && run(() => api(`/reviews/${r.id}`, { method: 'DELETE' }), reviews.reload)}>Delete</button></div>
        </div>))}</div>}
      {tab === 'messages' && <div className="space-y-3">{msgs.data?.map((m) => (
        <div key={m.id} className={`card p-4 ${m.handled ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap justify-between gap-2"><b>{m.subject || '(no subject)'}</b><span className="text-xs text-muted">{when(m.created_at)}</span></div>
          <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
          <p className="mt-2 text-xs text-muted">{m.name} · {m.phone} · {m.email}</p>
          <div className="mt-2 flex gap-2">{m.phone && <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/91${m.phone.replace(/\D/g, '').slice(-10)}`}>WhatsApp</a>}<button className="btn btn-ghost btn-sm" onClick={() => run(() => api(`/messages/${m.id}`, { method: 'PUT', body: { handled: !m.handled } }), msgs.reload)}>{m.handled ? 'Mark unread' : 'Mark handled'}</button></div>
        </div>))}{msgs.data?.length === 0 && <p className="text-muted">No messages.</p>}</div>}
      {tab === 'subs' && <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Contact</th><th className="th">Signed up</th></tr></thead><tbody>{subs.data?.map((s) => <tr key={s.id}><td className="td">{s.contact}</td><td className="td text-muted">{when(s.created_at)}</td></tr>)}{subs.data?.length === 0 && <tr><td className="td text-muted" colSpan={2}>No subscribers yet.</td></tr>}</tbody></table></div>}
    </>
  );
}
