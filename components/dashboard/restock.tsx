import { available, money } from '@/lib/types';
import { SupplierResearch } from '../supplier-research';
import { Arrow, type Dash, Tick, addDays, inDays, shortDate, unitName } from './shared';
import { arrival, openPurchase } from './today';

const statusLabel: Record<string, string> = { ordered: 'ORDERED', cancellation_requested: 'CANCELLING', cancelled: 'CANCELLED', received: 'DELIVERED' };

export function Restock(d: Dash) {
  const { state, product, quote: chosen, busy } = d;
  const now = new Date();
  const free = Math.max(0, available(product));
  const open = openPurchase(d);
  const cheapest = Math.min(...state.quotes.map(q => q.unitCost));
  const fastest = Math.min(...state.quotes.map(q => q.leadDays));
  const units = Math.max(d.quantity, chosen.minimum);
  const total = units * chosen.unitCost + chosen.shipping;
  const report = state.agentReport;
  const reportQuote = report ? state.quotes.find(q => q.id === report.quoteId) : undefined;
  const supplierOf = (id: string) => state.quotes.find(q => q.id === id)?.supplier ?? 'Supplier';

  return <div className="sk-restock">
    <div className="sk-restock-head">
      <button className="sk-back" onClick={() => d.go('today')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>BACK TO TODAY</button>
      <div className="sk-restock-title">
        <h1 className="sk-h1 md">Restock the <span className="sk-hl">{product.name}</span></h1>
        <div className="sk-facts">
          <span>{free} free to sell</span>
          <span className="red">{product.demand} {product.demand === 1 ? 'customer' : 'customers'} waiting</span>
          <span>Selling ~{product.dailySales} a day</span>
        </div>
      </div>
      {!open && <span className="sk-lede">Pick a supplier. Nothing is ordered until you approve.</span>}
    </div>

    {open ? <section className="sk-ordered" aria-live="polite">
      <span className="sk-tick-box accent"><Tick size={30} width={2.8} /></span>
      <span className="sk-kicker accent">{open.status === 'cancellation_requested' ? 'CANCELLATION REQUESTED' : 'ORDERED'}</span>
      <h2>{open.quantity} {unitName(product, open.quantity)} ordered</h2>
      <span className="sk-ordered-line">{supplierOf(open.quoteId)} · {money(open.total)} · arrives {shortDate(arrival(d, open))}</span>
      <p>They’ll show as “on the way” and won’t count as sellable until delivered. Demo order: no supplier was contacted.</p>
      <div className="sk-ordered-actions">
        <button className="sk-btn accent" onClick={() => d.go('today')}>Back to Today</button>
        <button className="sk-btn dark-outline" disabled={busy} onClick={d.undo}>Undo (demo)</button>
      </div>
    </section> : <>
      {report && <section className="sk-report">
        <div>
          <span className="sk-kicker">STOCK MANAGER’S RECOMMENDATION · {report.source === 'agent_token' ? 'VIA GROKBOT' : 'VIA HANDOFF PAGE'}</span>
          <p>{report.summary}</p>
          <details><summary>See the reasoning</summary><p>{report.rationale}</p></details>
        </div>
        {reportQuote && (chosen.id !== report.quoteId || d.quantity !== report.quantity) && <button className="sk-btn outline sm" onClick={d.applyReport}>Use {report.quantity} from {reportQuote.supplier}</button>}
      </section>}

      <div className="sk-quotes">
        {state.quotes.map(q => {
          const u = Math.max(d.quantity, q.minimum);
          const selected = q.id === chosen.id;
          const tag = q.recommended ? 'RECOMMENDED' : q.unitCost === cheapest ? 'LOWEST UNIT PRICE' : q.leadDays === fastest ? 'FASTEST' : '';
          return <button key={q.id} className={`sk-quote ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => d.pick(q.id)}>
            <span className="sk-quote-top">
              {tag ? <span className={`sk-chip ${q.recommended ? 'accent' : 'grey'}`}>{tag}</span> : <span />}
              <span className="sk-radio"><Tick size={14} width={3.2} /></span>
            </span>
            <span className="sk-quote-name"><strong>{q.supplier}</strong><span>{q.country}</span></span>
            <span className="sk-quote-arrives"><strong>{shortDate(addDays(now, q.leadDays))}</strong><span>{inDays(q.leadDays)}</span></span>
            <span className="sk-quote-terms">
              <span><span>Per {product.kind}</span><b>{money(q.unitCost)}</b></span>
              <span><span>Shipping</span><b>{money(q.shipping)}</b></span>
              <span><span>Minimum order</span><b>{q.minimum}</b></span>
            </span>
            <span className="sk-quote-total">
              <span><span>Total for {u}</span>{u > d.quantity && <em>Rounded up to the minimum</em>}</span>
              <b>{money(u * q.unitCost + q.shipping)}</b>
            </span>
          </button>;
        })}
      </div>

      <div className="sk-bottom-bar">
        <div className="sk-stepper">
          <span className="sk-kicker soft">HOW MANY</span>
          <div>
            <button aria-label="Five fewer" onClick={() => d.step(-5)} disabled={d.quantity <= 5}>−</button>
            <output aria-live="polite">{d.quantity}</output>
            <button aria-label="Five more" onClick={() => d.step(5)} disabled={d.quantity >= 500}>+</button>
          </div>
        </div>
        <span className="sk-bar-divider" />
        <div className="sk-bar-summary">
          <strong>{units} {unitName(product, units)} from {chosen.supplier} · arrives {shortDate(addDays(now, chosen.leadDays))}</strong>
          <span>{state.paused ? 'The workflow is paused. Resume it from the store menu to approve.' : `Lasts about ${Math.floor((free + units) / Math.max(1, product.dailySales))} days at today’s pace`}</span>
        </div>
        <div className="sk-bar-total"><span className="sk-kicker soft">TOTAL</span><strong>{money(total)}</strong></div>
        <button className="sk-btn accent tall" disabled={busy || state.paused} onClick={d.approve}>Approve restock<Arrow /></button>
      </div>
    </>}

    {state.purchases.length > 0 && <section className="sk-card">
      <div className="sk-card-head"><h3>Purchase orders</h3><span className="sk-card-note">Demo supplier portal</span></div>
      {[...state.purchases].reverse().map(p => <div className="sk-order-row" key={p.id}>
        <div><strong>{p.id} · {supplierOf(p.quoteId)}</strong><span>{p.quantity} × {product.name} · {money(p.total)} incl. shipping</span></div>
        <span className={`sk-chip ${p.status === 'received' ? 'grey' : p.status === 'cancelled' ? 'light-line' : 'accent'}`}>{statusLabel[p.status] ?? p.status}</span>
        <div className="sk-order-actions">
          {p.status === 'ordered' && <>
            <button className="sk-text-link" disabled={busy} onClick={() => d.act({ type: 'request_cancel', purchaseId: p.id }, 'Cancellation requested. Waiting for the supplier to confirm.')}>Request cancellation</button>
            <button className="sk-btn outline sm" disabled={busy} onClick={() => d.act({ type: 'receive_purchase', purchaseId: p.id }, 'Delivery recorded. The hoodies are now free to sell.')}>Simulate delivery</button>
          </>}
          {p.status === 'cancellation_requested' && <button className="sk-btn outline sm" disabled={busy} onClick={() => d.act({ type: 'confirm_cancel', purchaseId: p.id }, 'Demo supplier confirmed the cancellation.')}>Simulate supplier confirmation</button>}
        </div>
      </div>)}
    </section>}

    <section className="sk-card sk-research"><SupplierResearch /></section>
  </div>;
}
