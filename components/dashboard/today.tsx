import { useState } from 'react';
import { available, money } from '@/lib/types';
import ProductArt from '../product-art';
import { StockList } from './stock';
import { Arrow, Blocks, type Dash, Tick, UnitRow, addDays, clock, inDays, isLow, kickerDate, plural, shortDate, unitName, variantLabel } from './shared';

export function openPurchase(d: Dash) {
  return d.state.purchases.find(p => p.productId === d.product.id && (p.status === 'ordered' || p.status === 'cancellation_requested'));
}
export function arrival(d: Dash, purchase: { quoteId: string; createdAt: string }) {
  const q = d.state.quotes.find(x => x.id === purchase.quoteId);
  return addDays(new Date(purchase.createdAt), q?.leadDays ?? 0);
}

export function Today(d: Dash) {
  const { state, product, incoming, paid, pending, needRestock, quote } = d;
  const [allActivity, setAllActivity] = useState(false);
  const now = new Date();
  const free = Math.max(0, available(product));
  const open = openPurchase(d);
  const received = [...state.purchases].reverse().find(p => p.productId === product.id && p.status === 'received');
  const mode: 'pending' | 'ordered' | 'clear' = incoming > 0 ? 'ordered' : needRestock ? 'pending' : 'clear';
  const units = Math.max(d.quantity, quote.minimum);
  const others = state.products.filter(p => p.id !== product.id);
  const othersLow = others.filter(isLow).length;
  const supplierOf = (id: string) => state.quotes.find(q => q.id === id)?.supplier ?? 'your supplier';
  const waitingOrders = pending.reduce((s, o) => s + o.quantity, 0);
  const waitingSub = pending.length === 0 ? 'Nothing outstanding'
    : pending.length === 1 ? `${pending[0].customer} · ${pending[0].quantity} ${unitName(state.products.find(p => p.id === pending[0].productId) ?? product, pending[0].quantity)} reserved`
    : `${waitingOrders} items reserved · ${money(pending.reduce((s, o) => s + o.total, 0))}`;
  const activities = state.activities.slice(0, allActivity ? 50 : 3);
  const tone = (owner: string) => owner === 'stock' ? 'stock' : owner === 'sales' ? 'sales' : owner === 'merchant' ? 'merchant' : 'system';

  return <>
    <div className="sk-today-head">
      <div className="sk-today-title">
        <span className="sk-kicker">{kickerDate(now)}</span>
        {mode === 'pending'
          ? <h1 className="sk-h1"><span className="sk-hl">One thing</span> needs you today.</h1>
          : <h1 className="sk-h1">You’re <span className="sk-hl">all set</span> for today.</h1>}
      </div>
      <span className="sk-today-aside">{othersLow ? `${othersLow} other ${plural(othersLow, 'item')} running low.` : 'Everything else is stocked and running.'}</span>
    </div>

    <section className="sk-hero" aria-label={`${product.name} stock`}>
      <div className="sk-hero-main">
        <div className="sk-hero-product">
          <div className="sk-hero-art"><ProductArt kind={product.kind} /></div>
          <div className="sk-hero-name">
            {mode === 'pending' && <span className="sk-chip coral">RUNNING OUT</span>}
            {mode === 'ordered' && <span className="sk-chip accent">RESTOCK ON THE WAY</span>}
            {mode === 'clear' && <span className="sk-chip light">IN STOCK</span>}
            <h2>{product.name}</h2>
            <span className="sk-hero-meta">{variantLabel(product).replace(/· M$/, '· Medium')} · {money(product.price)}</span>
          </div>
        </div>

        <div className="sk-units">
          <UnitRow title="On the shelf" sub={`${product.reserved} reserved · ${free} free`} count={Math.max(0, product.onHand)}>
            <Blocks kind="reserved" count={product.reserved} /><Blocks kind="free" count={free} />
          </UnitRow>
          <UnitRow title="Customers waiting" sub={product.demand ? 'Asked, nothing to sell' : 'No one waiting'} count={product.demand} tone={product.demand ? 'waiting' : undefined}>
            <Blocks kind="waiting" count={product.demand} />
          </UnitRow>
          {open && <UnitRow title="On the way" sub={`Arrives ${shortDate(arrival(d, open))}`} count={incoming} tone="incoming"
            extra={<button className="sk-link-button" disabled={d.busy} onClick={() => d.act({ type: 'receive_purchase', purchaseId: open.id }, 'Delivery recorded. The hoodies are now free to sell.')}>Mark delivered (demo)</button>}>
            <Blocks kind="incoming" count={incoming} />
          </UnitRow>}
        </div>

        <div className="sk-legend">
          <div>
            <span><i className="sk-block reserved" />Reserved for a customer</span>
            <span><i className="sk-block free" />Free to sell</span>
            <span><i className="sk-block waiting" />Wanted, none in stock</span>
            <span><i className="sk-block incoming" />Ordered, not sellable yet</span>
          </div>
          <b>1 BLOCK = 1 {product.kind.toUpperCase()}</b>
        </div>
      </div>

      <aside className="sk-suggest">
        {mode === 'pending' && <div className="sk-suggest-body">
          <span className="sk-kicker ink">SUGGESTED RESTOCK</span>
          <div className="sk-suggest-what">{units} {unitName(product, units)} from {quote.supplier}</div>
          <div className="sk-suggest-total">{money(units * quote.unitCost + quote.shipping)}</div>
          <div className="sk-suggest-facts">
            <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 4h14v12H1z" /><path d="M15 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" /></svg>Arrives {shortDate(addDays(now, quote.leadDays))}, {inDays(quote.leadDays)}</span>
            <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Covers about {Math.floor((free + units) / Math.max(1, product.dailySales))} days of sales</span>
            <span><Tick size={18} width={2} />{quote.recommended ? `Your usual supplier, ${quote.country.split(',')[0]}` : `Ships from ${quote.country}`}</span>
          </div>
          <div className="sk-grow" />
          <button className="sk-btn ink big" disabled={d.busy || state.paused} onClick={d.approve}>Approve restock<Arrow /></button>
          <button className="sk-btn outline" disabled={d.busy} onClick={d.openSuppliers}>Compare {state.quotes.length} suppliers</button>
          <span className="sk-suggest-note">{state.paused ? 'The workflow is paused. Resume it from the store menu to approve.' : 'Nothing is ordered until you approve.'}</span>
        </div>}

        {mode === 'ordered' && open && <div className="sk-suggest-body">
          <span className="sk-tick-box"><Tick /></span>
          <span className="sk-kicker ink">{open.status === 'cancellation_requested' ? 'CANCELLATION REQUESTED' : 'ORDERED'}</span>
          <div className="sk-suggest-big">{open.quantity} {unitName(product, open.quantity)} are on the way</div>
          <span className="sk-suggest-line">{supplierOf(open.quoteId)} · {money(open.total)} · arrives {shortDate(arrival(d, open))}</span>
          <span className="sk-suggest-copy">Incoming stock stays separate until it’s delivered, so you never sell what you don’t have.</span>
          <div className="sk-grow" />
          <button className="sk-btn ink" onClick={() => d.go('suppliers')}>View order</button>
          <button className="sk-btn ghost" disabled={d.busy} onClick={d.undo}>Undo (demo)</button>
        </div>}

        {mode === 'clear' && <div className="sk-suggest-body">
          <span className="sk-tick-box"><Tick /></span>
          <span className="sk-kicker ink">{received ? 'DELIVERED' : 'STOCKED'}</span>
          <div className="sk-suggest-big">{free} {unitName(product, free)} free to sell</div>
          {received && <span className="sk-suggest-line">{received.quantity} arrived from {supplierOf(received.quoteId)} · {money(received.total)}</span>}
          <span className="sk-suggest-copy">Nothing needs restocking right now. We’ll flag it here when it does.</span>
          <div className="sk-grow" />
          <button className="sk-btn ink" onClick={() => d.go('suppliers')}>View orders</button>
        </div>}
      </aside>
    </section>

    <div className="sk-tiles">
      <div className="sk-tile">
        <span className="sk-kicker">SALES AT RISK</span>
        <strong className={product.demand ? 'risk' : ''}>{money(product.demand * product.price)}</strong>
        <small>{product.demand ? `${product.demand} ${unitName(product, product.demand)} wanted × ${money(product.price)}` : 'No one is waiting'}</small>
      </div>
      <div className="sk-tile">
        <span className="sk-kicker">PAID TODAY</span>
        <strong>{money(paid)}</strong>
        <small>From demo checkouts</small>
      </div>
      <button className="sk-tile" onClick={() => d.go('stock')} aria-label={`Waiting on payment: ${pending.length}. See reservations`}>
        <span className="sk-kicker">WAITING ON PAYMENT</span>
        <strong>{pending.length}</strong>
        <small>{waitingSub}</small>
      </button>
    </div>

    <div className="sk-lower">
      <StockList d={d} />
      <section className="sk-card">
        <div className="sk-card-head"><h3>Latest</h3>{state.activities.length > 3 && <button className="sk-text-link" onClick={() => setAllActivity(v => !v)}>{allActivity ? 'Show less' : 'See all'}</button>}</div>
        {activities.length === 0 && <p className="sk-empty">Nothing has happened yet.</p>}
        {activities.map(a => <div className="sk-activity" key={a.id}>
          <span className={`sk-dot ${tone(a.owner)}`} />
          <div><strong>{a.title}</strong><span>{a.detail}</span></div>
          <time dateTime={a.at}>{Date.now() - new Date(a.at).getTime() < 60_000 ? 'Now' : clock(a.at)}</time>
        </div>)}
      </section>
    </div>
  </>;
}
