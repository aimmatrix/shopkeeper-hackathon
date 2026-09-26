import { available, money } from '@/lib/types';
import { ProductThumbnail } from './product-thumbnail';
import { Arrow, type Dash, addDays, kickerDate, shortDate, variantLabel } from './shared';

export function openPurchase(d: Dash) {
  return d.state.purchases.find(p => p.productId === d.product.id && (p.status === 'ordered' || p.status === 'cancellation_requested'));
}
export function arrival(d: Dash, purchase: { quoteId: string; createdAt: string }) {
  const q = d.state.quotes.find(x => x.id === purchase.quoteId);
  return addDays(new Date(purchase.createdAt), q?.leadDays ?? 0);
}

export function Today(d: Dash) {
  const { state, product, incoming, paid } = d;
  const free = Math.max(0, available(product));
  const sold = state.orders.filter(o => o.productId === product.id && o.status === 'paid').reduce((n, o) => n + o.quantity, 0);
  const order = openPurchase(d);
  return <>
    <div className="simple-heading"><div><span className="sk-kicker">{kickerDate(new Date())}</span><h1>Your store, at a glance.</h1></div><div className="simple-sales"><strong>{money(paid)}</strong><span>Sales recorded</span></div></div>
    <section className="shortage-card" aria-label={`${product.name} stock shortage`}>
      <div className="shortage-copy"><span className="sk-chip coral">{incoming ? 'RESTOCK EN ROUTE' : free === 0 ? 'OUT OF STOCK' : 'RESTOCK NEEDED'}</span><h2>{incoming ? 'Help is on the way.' : product.demand ? 'People want it. We need more.' : 'Time to restock.'}</h2><p>{incoming ? `${incoming} items ordered${order ? ` · arriving ${shortDate(arrival(d, order))}` : ''}.` : `${product.demand} more ${product.kind === 'tee' ? 'shirts' : 'items'} wanted, with ${free} available to sell.`}</p><div className="shortage-product"><ProductThumbnail product={product} /><div><strong>{product.name}</strong><span>{variantLabel(product)}</span></div></div><button className="sk-btn accent" onClick={() => d.startRestock(product.id)}>{incoming ? 'View restock in GrokBot' : 'Find this item with GrokBot'}<Arrow /></button><small>{incoming ? 'Supplier replies and customer updates live in the same chat.' : 'GrokBot finds suppliers. You choose who to order from.'}</small></div>
      <div className="shortage-counts">{[{ value: sold, label: 'Bought', detail: 'Paid items' }, { value: product.reserved, label: 'Reserved', detail: 'Held for customers' }, { value: product.demand, label: 'Still wanted', detail: 'Waiting for a restock' }].map(x => <div key={x.label}><strong>{x.value}</strong><span>{x.label}</span><small>{x.detail}</small></div>)}</div>
    </section>
    <p className="simple-hint">Customer asks → GrokBot finds suppliers → You approve → Customers get an update.</p>
  </>;
}
