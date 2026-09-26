'use client';
import { useEffect, useState } from 'react';
import type { ShopState } from '@/lib/types';
import { available, money } from '@/lib/types';
import { Mark } from '@/components/dashboard/shared';

export default function AgentWorkspace() {
  const [state, setState] = useState<ShopState | null>(null);
  const [summary, setSummary] = useState('');
  const [rationale, setRationale] = useState('');
  const [quote, setQuote] = useState('north');
  const [quantity, setQuantity] = useState(20);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/store').then(r => r.json()).then(d => { if (d.state) setState(d.state); else setStatus(d.error); }).catch(() => setStatus('Could not load the workspace.')); }, []);
  return <div className="sk agent-page">
    <div className="sk-strip"><b>DEMO STORE</b><span>Sample catalogue and suppliers. This page records a recommendation only; it never approves a purchase.</span></div>
    <header className="sk-header">
      <a className="sk-brand" href="/" aria-label="Shopkeeper, back to the merchant workspace"><Mark /><span>shopkeeper</span></a>
      <a className="sk-text-link" href="/">← Merchant workspace</a>
    </header>
    <main className="sk-main agent-main">
      <div className="agent-head">
        <span className="sk-kicker">SHOPKEEPER · GROKBOT HANDOFF</span>
        <h1 className="sk-h1 md">Make the case for a <span className="sk-hl">smarter restock.</span></h1>
        <p className="agent-lede">Read the current records below. Compare minimum order quantities, shipping, lead time and total cash commitment. Customer interest is not paid demand. Recommend a supplier and quantity, then save a concise explanation for the merchant. This form records a recommendation only; it does not approve a purchase.</p>
      </div>
      {!state && !status && <p className="sk-loading">Loading the workspace…</p>}
      {state && <>
        <section className="sk-card agent-card">
          <h2 className="agent-card-title">Current product records</h2>
          <table className="agent-table"><thead><tr><th>Product</th><th>Available</th><th>Reserved</th><th>Unmet interest</th><th>Sample sales pace</th><th>Retail price</th></tr></thead><tbody>{state.products.map(p => <tr key={p.id}><td data-label="Product">{p.name} · {p.variant}</td><td data-label="Available">{available(p)}</td><td data-label="Reserved">{p.reserved}</td><td data-label="Unmet interest">{p.demand}</td><td data-label="Sales pace">{p.dailySales}/day</td><td data-label="Retail price">{money(p.price)}</td></tr>)}</tbody></table>
        </section>
        <div className="agent-quotes">
          <section className="sk-card agent-card">
            <h2 className="agent-card-title">Supplier quotes for medium black hoodies</h2>
            <p className="sk-card-note">These are sample offers, not live supplier commitments. Lead times require confirmation. Compare suppliers at quantities that comply with their minimums.</p>
            <table className="agent-table"><thead><tr><th>Supplier / ID</th><th>Unit price</th><th>Minimum</th><th>Shipping</th><th>Lead days</th></tr></thead><tbody>{state.quotes.map(q => <tr key={q.id}><td data-label="Supplier">{q.supplier} / {q.id}</td><td data-label="Unit price">{money(q.unitCost)}</td><td data-label="Minimum">{q.minimum}</td><td data-label="Shipping">{money(q.shipping)}</td><td data-label="Lead days">{q.leadDays}</td></tr>)}</tbody></table>
          </section>
          <aside className="agent-budget">
            <span className="sk-kicker accent">MERCHANT CASH BUDGET</span>
            <strong>£500</strong>
            <p>For this exercise, including shipping.</p>
          </aside>
        </div>
        <section className="sk-card agent-card">
          <h2 className="agent-card-title">Existing purchase orders</h2>
          <p className="agent-orders">{state.purchases.length ? state.purchases.map(p => `${p.id}: ${p.quantity} units, ${p.status}`).join('; ') + '.' : 'No existing purchase orders.'} <strong>Do not recommend a duplicate incoming order.</strong></p>
        </section>
        <form className="sk-card agent-card agent-report-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setStatus(''); try { const r = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'agent_report', summary, rationale, quoteId: quote, quantity, eventId: crypto.randomUUID() }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setState(d.state); setStatus('Recommendation saved. The merchant dashboard now shows this report. No purchase was approved.'); } catch (e) { setStatus((e as Error).message); } finally { setBusy(false); } }}>
          <h2 className="agent-card-title">Write your recommendation</h2>
          <label>Short merchant summary<textarea aria-label="Short merchant summary" required maxLength={1200} value={summary} onChange={e => setSummary(e.target.value)} /></label>
          <div className="agent-form-row">
            <label>Recommended supplier<select aria-label="Recommended supplier" value={quote} onChange={e => { setQuote(e.target.value); setQuantity(state.quotes.find(q => q.id === e.target.value)!.minimum); }}>{state.quotes.map(q => <option key={q.id} value={q.id}>{q.supplier}</option>)}</select></label>
            <label>Recommended quantity<input aria-label="Recommended quantity" type="number" required min={state.quotes.find(q => q.id === quote)!.minimum} max="500" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label>
          </div>
          <label>Reasoning and trade-offs<textarea aria-label="Reasoning and trade-offs" required maxLength={4000} value={rationale} onChange={e => setRationale(e.target.value)} /></label>
          <button className="sk-btn ink big agent-submit" disabled={busy}>{busy ? 'Saving…' : 'Save recommendation for merchant'}</button>
        </form>
      </>}
      <p role="status" className="agent-status">{status}</p>
    </main>
  </div>;
}
