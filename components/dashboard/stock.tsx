'use client';

import { available } from '@/lib/types';
import ProductViewer from '../storefront/product-viewer';
import { type Dash, isLow, variantLabel } from './shared';
import styles from './stock.module.css';

export function StockList({ d, id = 'stock' }: { d: Dash; id?: string }) {
  if (!d.state.products.length) return <div id={id} className="sk-empty">Your products will appear here.</div>;

  return <div className={styles.grid} id={id}>
    {d.state.products.map(product => {
      const purchases = d.state.purchases.filter(p => p.productId === product.id && ['ordered', 'cancellation_requested'].includes(p.status));
      const incoming = purchases.reduce((sum, p) => sum + p.quantity, 0);
      const stock = Math.max(0, available(product));
      const needsOrdering = isLow(product) || product.demand > 0;
      const status = incoming ? 'Awaiting delivery' : needsOrdering ? 'Needs ordering' : 'In stock';
      return <article className={styles.product} key={product.id} aria-labelledby={`${id}-${product.id}`}>
        <div className={styles.model}><ProductViewer product={product} showFitPreview={false} /></div>
        <div className={styles.details}>
          <div className={styles.heading}>
            <div><h2 id={`${id}-${product.id}`}>{product.name}</h2><p>{variantLabel(product)}</p></div>
            <span className={styles.status} data-tone={incoming ? 'incoming' : needsOrdering ? 'low' : 'stock'}><i aria-hidden="true" />{status}</span>
          </div>
          <dl className={styles.counts}>
            <div><dt>In stock</dt><dd>{stock}</dd></div>
            <div><dt>En route</dt><dd>{incoming}</dd></div>
            <div><dt>Reserved</dt><dd>{product.reserved}</dd></div>
          </dl>
          <div className={styles.footer}>
            <p>{purchases.some(p => p.status === 'cancellation_requested') ? 'Delivery cancellation requested' : product.demand > 0 ? `${product.demand} more wanted · awaiting stock` : incoming ? 'Delivery pending' : needsOrdering ? 'Running low · time to reorder' : 'Ready to sell'}</p>
            <button type="button" onClick={() => d.startRestock(product.id)}>{incoming ? 'View order' : 'Restock'} <span aria-hidden="true">↗</span></button>
          </div>
        </div>
      </article>;
    })}
  </div>;
}

export function StockView(d: Dash) {
  return <><div className="simple-heading"><div><h1>Stock</h1></div></div><StockList d={d} /></>;
}
