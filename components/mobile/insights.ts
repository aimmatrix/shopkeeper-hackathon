import { available, type Product, type Purchase, type Quote, type ShopState } from '../../lib/types';

// Purchases in these states are stock the supplier still owes us: incoming, never on hand.
export const OPEN_PURCHASE: Purchase['status'][] = ['ordered', 'cancellation_requested'];
export const MAX_QUANTITY = 500;

export type Urgency = 'out' | 'critical' | 'watch' | 'healthy';
export type Assessment = { product: Product; free: number; cover: number; incoming: number; level: Urgency };

const rank: Record<Urgency, number> = { out: 0, critical: 1, watch: 2, healthy: 3 };

export function openPurchase(state: ShopState, productId: string) {
  return state.purchases.find(p => p.productId === productId && OPEN_PURCHASE.includes(p.status));
}

export function incomingFor(state: ShopState, productId: string) {
  return state.purchases.filter(p => p.productId === productId && OPEN_PURCHASE.includes(p.status)).reduce((sum, p) => sum + p.quantity, 0);
}

export function assess(state: ShopState, product: Product): Assessment {
  const free = available(product);
  const cover = product.dailySales > 0 ? Math.max(free, 0) / product.dailySales : Infinity;
  let level: Urgency = free <= 0 ? 'out' : cover < product.leadDays ? 'critical' : cover < product.leadDays * 2 ? 'watch' : 'healthy';
  if (level === 'healthy' && product.demand > 0) level = 'watch';
  return { product, free, cover, incoming: incomingFor(state, product.id), level };
}

/** Lowest cover first; unmet demand breaks ties. */
export function mostUrgent(state: ShopState): Assessment | undefined {
  return state.products.map(p => assess(state, p)).sort((a, b) => rank[a.level] - rank[b.level] || a.cover - b.cover || b.product.demand - a.product.demand)[0];
}

/** Unmet demand plus sales during the quoted lead time, minus what can still be sold, lifted to the MOQ. */
export function suggestedQuantity(product: Product, quote: Quote) {
  const need = product.demand + product.dailySales * quote.leadDays - Math.max(available(product), 0);
  return Math.min(Math.max(quote.minimum, need), MAX_QUANTITY);
}

export const totalCost = (quote: Quote, quantity: number) => quote.unitCost * quantity + quote.shipping;

export function quantityError(quote: Quote, text: string): string {
  if (!/^\d+$/.test(text.trim())) return 'Enter a whole number of units.';
  const quantity = Number(text);
  if (quantity < quote.minimum) return `${quote.supplier} needs at least ${quote.minimum} units.`;
  if (quantity > MAX_QUANTITY) return `Keep demo orders at ${MAX_QUANTITY} units or fewer.`;
  return '';
}

export type ApprovalChange = { purchase: Purchase; quote?: Quote; onHand: [number, number]; incoming: [number, number]; free: [number, number] };

/** What an approval actually changed, read from the server's before/after states. */
export function approvalChange(before: ShopState, after: ShopState, productId: string): ApprovalChange | null {
  const known = new Set(before.purchases.map(p => p.id));
  const purchase = after.purchases.find(p => !known.has(p.id) && p.productId === productId);
  const was = before.products.find(p => p.id === productId);
  const now = after.products.find(p => p.id === productId);
  if (!purchase || !was || !now) return null;
  return {
    purchase,
    quote: after.quotes.find(q => q.id === purchase.quoteId),
    onHand: [was.onHand, now.onHand],
    incoming: [incomingFor(before, productId), incomingFor(after, productId)],
    free: [available(was), available(now)],
  };
}
