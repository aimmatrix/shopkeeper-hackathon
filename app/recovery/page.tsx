'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, MessageCircle, Package, RefreshCw, Sparkles } from 'lucide-react';
import type { recoveryView } from '@/lib/commerce/recovery';
import { money } from '@/lib/types';
import styles from './recovery.module.css';
type View = ReturnType<typeof recoveryView>;

export default function RecoveryWorkspace() {
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const [rationale, setRationale] = useState('');
  async function refresh() {
    try { const r = await fetch('/api/recovery', { cache: 'no-store' }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setView(data); }
    catch (e) { setStatus((e as Error).message); }
  }
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 5000); return () => clearInterval(timer); }, []);
  async function act(action: object, success: string) {
    setBusy(true); setStatus('');
    try { const r = await fetch('/api/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setView(data); setStatus(success); }
    catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }
  const current = view?.requests.find(r => r.id === selected);
  const ready = view?.requests.filter(r => r.ready) ?? [];
  return <main className={styles.page}>
    <header className={styles.header}><a href="/"><ArrowLeft size={16} /> Merchant workspace</a><span>SHOPKEEPER / RECOVERY DESK</span><button onClick={refresh} aria-label="Refresh recovery workspace"><RefreshCw size={16} /></button></header>
    <section className={styles.hero}><div><p className={styles.kicker}>A CONVERSATION SHOULDN’T END AT “SOLD OUT”.</p><h1>Keep the interest.<br /><em>Bring back the sale.</em></h1><p className={styles.intro}>Customer requests, live stock and a thoughtful follow-up. Your team prepares the next step. You decide what leaves the store.</p></div><aside className={styles.metric}><span>READY FOR A FOLLOW-UP</span><strong>{ready.length.toString().padStart(2, '0')}</strong><p>requests match current stock</p><small>Interest only. No recovered revenue claimed.</small></aside></section>
    <section className={styles.flow} aria-label="Connected merchant team"><div><MessageCircle /><strong>Wassist</strong><span>Records a customer’s request</span></div><span className={styles.arrow}>→</span><div><Package /><strong>Stock Manager</strong><span>Prepares a restock for approval</span></div><span className={styles.arrow}>→</span><div><Sparkles /><strong>Sales & Recovery</strong><span>Drafts a follow-up for review</span></div></section>
    <div className={styles.toolbar}><div><p className={styles.kicker}>THE OPPORTUNITY LIST</p><h2>People asked. We remembered.</h2></div><button disabled={busy || view?.paused} onClick={() => act({ type: 'demo_request' }, 'Sample request added. This is clearly labelled Demo; nothing was reserved.')}><span>+</span> Add sample request</button></div>
    <p role="status" className={styles.status}>{status || (view?.paused ? 'Workflow paused. Resume it in the merchant workspace.' : 'Live inventory · refreshes every 5 seconds · all commerce is a sample demo')}</p>
    {!view && <p>Loading customer requests…</p>}
    {view?.requests.length === 0 && <section className={styles.empty}><MessageCircle size={30} /><h3>The next conversation starts here.</h3><p>Ask the WhatsApp concierge to record interest in two medium black hoodies, or add a labelled sample request to rehearse.</p><p>No customer phone numbers or message transcripts appear here.</p></section>}
    <div className={styles.requests}>{view?.requests.map(r => <article key={r.id} className={styles.card}>
      <div className={styles.cardTop}><span className={styles.channel}>{r.channel === 'whatsapp' ? 'WHATSAPP' : 'DEMO REQUEST'}</span><span className={r.ready ? styles.ready : styles.waiting}>{r.ready ? 'Stock available' : 'Waiting for stock'}</span></div>
      <h3>{r.productName}</h3><p>{r.variant} · {r.quantity} requested</p><div className={styles.stock}><span><strong>{r.available}</strong> available</span><span><strong>{r.incoming}</strong> incoming</span><span><strong>{money(r.pricePence * r.quantity)}</strong> potential value</span></div>
      <p className={styles.fine}>Request {r.id.slice(0, 8)} · nothing reserved · potential value is not a sale</p>
      {r.draft && <div className={styles.draft}><span>DRAFT · HANDOFF PAGE</span><blockquote>{r.draft.text}</blockquote><p>{r.draft.rationale}</p><small>{!r.draftCurrent ? 'Stock changed. Update this draft before review.' : r.draft.reviewedAt ? 'Reviewed by merchant · not sent' : 'Awaiting merchant review · not sent'}</small></div>}
      <div className={styles.actions}><button disabled={busy || view.paused} onClick={() => { setSelected(r.id); setText(r.draft?.text ?? ''); setRationale(r.draft?.rationale ?? ''); document.getElementById('draft-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Write / edit draft <ArrowUpRight size={15} /></button>{r.draft && <button disabled={busy || !r.ready || !r.draftCurrent || Boolean(r.draft.reviewedAt)} onClick={() => act({ type: 'review_recovery_draft', requestId: r.id }, 'Draft marked reviewed. No message was sent and no stock was reserved.')}><Check size={15} /> Mark reviewed</button>}</div>
    </article>)}</div>
    <section id="draft-editor" className={styles.editor}><div><p className={styles.kicker}>GROKBOT SALES & RECOVERY HANDOFF</p><h2>Make the follow-up worth opening.</h2><p>Read the request and current stock above. Draft a relevant reply without promising a reservation or delivery date. Incoming inventory is not available. Save your reasoning so the merchant can check it.</p><p>Submitting this form records a browser handoff; it does not authenticate the author or send a WhatsApp message.</p></div><form onSubmit={e => { e.preventDefault(); void act({ type: 'save_recovery_draft', requestId: selected, text, rationale, eventId: crypto.randomUUID() }, 'Recovery draft saved for merchant review. No external message was sent.'); }}>
      <label>Customer request<select required value={selected} onChange={e => { setSelected(e.target.value); const r = view?.requests.find(r => r.id === e.target.value); setText(r?.draft?.text ?? ''); setRationale(r?.draft?.rationale ?? ''); }}><option value="">Select a request</option>{view?.requests.map(r => <option key={r.id} value={r.id}>{r.channel} · {r.quantity} × {r.productName} · {r.id.slice(0, 8)}</option>)}</select></label>
      {current && <p className={styles.context}>{current.available} available / {current.quantity} requested. {current.ready ? 'Full quantity currently available; not allocated to this request.' : 'Do not claim the full quantity is available.'}</p>}
      <label>Follow-up draft<textarea required maxLength={1200} rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="A helpful, accurate reply for this request…" /></label>
      <label>Reasoning for the merchant<textarea required maxLength={2000} rows={3} value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Why this reply, and what must be checked before sending?" /></label>
      <button className={styles.primary} disabled={busy || !current || view?.paused}>{busy ? 'Saving…' : 'Save draft for merchant review'}</button>
    </form></section><footer className={styles.footer}>North & Form is a fictional sample store. WhatsApp intake and database persistence are real. Purchases, checkout and delivery are simulated. Recovery messages are drafts only.</footer>
  </main>;
}
