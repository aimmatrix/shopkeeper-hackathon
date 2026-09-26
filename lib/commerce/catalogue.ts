import { available, type ShopState } from '../types';

/** Customer-facing facts only. Never expose messages, order owners, event keys or supplier costs. */
export function customerCatalogue(state: ShopState) {
  return {
    store: 'North & Form',
    mode: 'fictional hackathon demo',
    currency: 'GBP',
    version: state.version,
    checkedAt: new Date().toISOString(),
    reservationsPaused: state.paused,
    products: state.products.map(p => ({
      id: p.id, name: p.name, variant: p.variant, sku: p.sku,
      pricePence: p.price, available: available(p),
      reservationSupported: p.id === 'hoodie' && !state.paused,
    })),
    policy: {
      stock: 'Available units exclude existing reservations. Incoming purchases are not available to sell.',
      delivery: 'No customer delivery date is confirmed. Supplier quotes are sample estimates, not promises.',
      payments: 'This is a sample store. No real payment or supplier purchase is processed.',
      actions: 'This tool only reads inventory. It cannot reserve, purchase, cancel or send messages.',
    },
  };
}
