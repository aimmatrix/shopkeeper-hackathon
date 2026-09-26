import { available, money } from '@/lib/types';
import { type Dash, daysLeft, isLow, swatch, unitName, variantLabel } from './shared';

export function StockList({ d, id = 'stock' }: { d: Dash; id?: string }) {
  const { state, incoming, product: focus } = d;
  return <section className="sk-card" id={id}>
    <div className="sk-card-head"><h3>Stock</h3><span className="sk-card-note">Days left at today’s pace</span></div>
    {state.products.length === 0 && <p className="sk-empty">No products in this store yet.</p>}
    {state.products.map(p => {
      const days = daysLeft(p);
      const low = isLow(p);
      const coming = p.id === focus.id ? incoming : 0;
      const pct = Math.min(100, Math.max(5, Math.round((Number.isFinite(days) ? days : 14) / 14 * 100)));
      const chip = coming ? { cls: 'accent', label: `${coming} ON THE WAY` } : low ? { cls: 'restock', label: 'RESTOCK' } : { cls: 'grey', label: 'HEALTHY' };
      return <div className="sk-stock-row" key={p.id}>
        <span className="sk-swatch" style={{ background: swatch[p.tone] ?? '#D9D9D9' }} />
        <div className="sk-stock-name"><strong>{p.name}</strong><span>{variantLabel(p)}</span></div>
        <div className="sk-bar" aria-hidden="true"><i style={{ width: `${pct}%`, background: low ? '#E04848' : '#0F0F0F' }} /></div>
        <span className="sk-stock-days">{available(p) <= 0 ? 'Sold out' : days < 1 ? 'Under a day' : `${Math.floor(days)} ${Math.floor(days) === 1 ? 'day' : 'days'}`}</span>
        <span className={`sk-chip ${chip.cls}`}>{chip.label}</span>
      </div>;
    })}
  </section>;
}

/** Stock tab: the same list, plus every reservation still waiting on payment (where demo checkouts are completed). */
export function StockView(d: Dash) {
  const { state, pending, busy } = d;
  return <>
    <h1 className="sr-only">Stock</h1>
    <StockList d={d} id="stock-list" />
    <section className="sk-card">
      <div className="sk-card-head"><h3>Waiting on payment</h3><span className="sk-card-note">Reserved stock is held, not sold</span></div>
      {pending.length === 0 && <p className="sk-empty">No reservations are waiting on payment.</p>}
      {pending.map(o => {
        const p = state.products.find(x => x.id === o.productId);
        return <div className="sk-order-row" key={o.id}>
          <div><strong>{o.customer}</strong><span>{o.quantity} × {p ? p.name : o.productId} · {money(o.total)} · {o.id}</span></div>
          <button className="sk-btn outline sm" disabled={busy} onClick={() => d.act({ type: 'complete_order', orderId: o.id }, 'Demo payment recorded. Stock updated.')}>Complete demo checkout</button>
        </div>;
      })}
      <p className="sk-footnote">Free to sell excludes reservations. Incoming {unitName(d.product, 2)} count only once they’re delivered.</p>
    </section>
  </>;
}
