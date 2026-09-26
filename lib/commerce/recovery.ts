import { createHash } from 'node:crypto';
import { available, type Action, type ShopState } from '../types';

export type RecoveryAction = Extract<Action, { type: 'record_stock_request' | 'save_recovery_draft' | 'review_recovery_draft' }>;

/** Mutates the cloned state only. No reservations, outbound messages or payments. */
export function applyRecoveryAction(state: ShopState, action: RecoveryAction) {
  if (state.paused) throw new Error('The demo workflow is paused. Resume it to continue.');
  if (action.type === 'record_stock_request') {
    if (!['whatsapp', 'demo'].includes(action.channel) || !/^[a-f0-9]{64}$/.test(action.contactRef)) throw new Error('A valid channel identity is required.');
    const product = state.products.find(p => p.id === action.productId);
    if (!product || !Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > 10) throw new Error('Choose a catalogue product and between 1 and 10 units.');
    const id = createHash('sha256').update(`${action.channel}:${action.contactRef}:${product.id}`).digest('hex').slice(0, 24);
    const existing = state.stockRequests?.find(r => r.id === id);
    if (existing) {
      if (existing.quantity !== action.quantity) throw new Error('A request for this product already exists with a different quantity. Ask the merchant to review it.');
      return null;
    }
    if ((state.stockRequests?.length ?? 0) >= 100) throw new Error('The sample request list is full. Ask the merchant to review it.');
    (state.stockRequests ??= []).push({ id, channel: action.channel, contactRef: action.contactRef, productId: product.id, quantity: action.quantity, createdAt: new Date().toISOString() });
    const shortage = Math.max(0, action.quantity - available(product));
    product.demand += shortage;
    return { title: 'A stock request reached the merchant', detail: `${action.channel === 'whatsapp' ? 'WhatsApp' : 'Demo'} · ${action.quantity} × ${product.name} · ${shortage} currently unavailable. Interest recorded; nothing reserved or paid.` };
  }
  const request = state.stockRequests?.find(r => r.id === action.requestId);
  if (!request) throw new Error('Stock request not found.');
  const product = state.products.find(p => p.id === request.productId);
  if (!product) throw new Error('Requested product is unavailable.');
  if (action.type === 'save_recovery_draft') {
    if (typeof action.text !== 'string' || !action.text.trim() || action.text.length > 1200 || typeof action.rationale !== 'string' || !action.rationale.trim() || action.rationale.length > 2000) throw new Error('Provide a follow-up draft and a concise rationale.');
    request.draft = { text: action.text.trim(), rationale: action.rationale.trim(), at: new Date().toISOString(), availableAtDraft: available(product), source: 'handoff_page' };
    return { title: 'Recovery draft saved for review', detail: `${product.name} · request ${request.id.slice(0, 8)}. Submitted through the handoff page; no message sent.` };
  }
  if (!request.draft) throw new Error('Save a draft before reviewing it.');
  if (available(product) !== request.draft.availableAtDraft) throw new Error('Stock changed since this draft. Refresh its wording and save it again.');
  if (available(product) < request.quantity) throw new Error('The full requested quantity is not available yet. Incoming stock cannot be promised.');
  if (request.draft.reviewedAt) return null;
  request.draft.reviewedAt = new Date().toISOString();
  return { title: 'Merchant reviewed a recovery draft', detail: `Request ${request.id.slice(0, 8)} · ready for a separate sending decision. No message sent and no stock reserved.` };
}

export function recoveryView(state: ShopState) {
  return {
    version: state.version, paused: state.paused,
    requests: (state.stockRequests ?? []).map(({ contactRef: _contactRef, ...request }) => {
      const p = state.products.find(p => p.id === request.productId);
      const stock = p ? available(p) : 0;
      return { ...request, productName: p?.name ?? 'Unavailable product', variant: p?.variant ?? '', pricePence: p?.price ?? 0, available: stock,
        incoming: state.purchases.filter(o => o.productId === request.productId && ['ordered', 'cancellation_requested'].includes(o.status)).reduce((n, o) => n + o.quantity, 0),
        ready: !state.paused && stock >= request.quantity,
        draftCurrent: Boolean(request.draft && request.draft.availableAtDraft === stock),
      };
    }),
    products: state.products.map(p => ({ id: p.id, name: p.name, variant: p.variant, available: available(p) })),
  };
}
