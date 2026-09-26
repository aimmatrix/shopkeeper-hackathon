import { createHash, randomUUID } from 'node:crypto';
import { Action, Activity, ShopState, available, money } from './types';
import { applyRecoveryAction } from './commerce/recovery';

export function seed(): ShopState {
  const at = new Date().toISOString();
  return {
    version: 0, proposalReady: false, paused: false, processedEvents: [], purchases: [],
    orders: [
      { id: 'NF-0997', productId: 'hoodie', quantity: 7, total: 47600, customer: 'Sample opening reservations', status: 'reserved', eventId: 'opening-hoodie' },
      { id: 'NF-0998', productId: 'tee', quantity: 6, total: 20400, customer: 'Sample opening reservations', status: 'reserved', eventId: 'opening-tee' },
      { id: 'NF-0999', productId: 'bag', quantity: 3, total: 8400, customer: 'Sample opening reservations', status: 'reserved', eventId: 'opening-bag' },
      { id: 'NF-1000', productId: 'cap', quantity: 2, total: 5200, customer: 'Sample opening reservations', status: 'reserved', eventId: 'opening-cap' },
    ],
    products: [
      { id: 'hoodie', name: 'Everyday Hoodie', variant: 'Washed black / M', sku: 'EH-BLK-M', price: 6800, cost: 2200, onHand: 8, reserved: 7, demand: 12, dailySales: 4, leadDays: 3, tone: 'charcoal', kind: 'hoodie' },
      { id: 'tee', name: 'Heavyweight Tee', variant: 'Bone / L', sku: 'HT-BNE-L', price: 3400, cost: 900, onHand: 42, reserved: 6, demand: 0, dailySales: 5, leadDays: 4, tone: 'bone', kind: 'tee' },
      { id: 'bag', name: 'Market Tote', variant: 'Olive / One size', sku: 'MT-OLV-OS', price: 2800, cost: 650, onHand: 25, reserved: 3, demand: 0, dailySales: 2, leadDays: 5, tone: 'olive', kind: 'bag' },
      { id: 'cap', name: 'Studio Cap', variant: 'Clay / One size', sku: 'SC-CLY-OS', price: 2600, cost: 700, onHand: 18, reserved: 2, demand: 0, dailySales: 2, leadDays: 3, tone: 'clay', kind: 'cap' },
    ],
    quotes: [
      { id: 'north', supplier: 'North Thread', country: 'Manchester, UK', unitCost: 2200, shipping: 1200, minimum: 20, leadDays: 3, note: 'Fastest restock · existing supplier', recommended: true },
      { id: 'porto', supplier: 'Atelier Porto', country: 'Porto, Portugal', unitCost: 1850, shipping: 3500, minimum: 30, leadDays: 8, note: 'Lower unit cost · higher minimum' },
      { id: 'east', supplier: 'East London Supply', country: 'London, UK', unitCost: 2500, shipping: 800, minimum: 10, leadDays: 2, note: 'Small batches · fastest delivery' },
    ],
    messages: [
      { id: 'm1', sender: 'customer', text: 'Hey! Is the Everyday Hoodie coming back in medium? Love the washed black.', at },
      { id: 'm2', sender: 'sales', text: 'There’s one medium left in washed black, at £68. I can help you reserve it, or record your interest in the next restock.', at },
    ],
    activities: [
      { id: 'a1', owner: 'stock', title: 'Your bestseller needs a restock', detail: 'Everyday Hoodie · 1 available · 12 units of unmet demand in the demo history', at },
      { id: 'a2', owner: 'sales', title: 'Customer demand, connected', detail: 'Demo conversations are linked to product variants, so enquiries can inform purchasing.', at },
      { id: 'a3', owner: 'system', title: 'North & Form workspace ready', detail: 'Sample catalogue and supplier quotes loaded. No external messages or purchases are sent.', at },
    ],
  };
}

function log(state: ShopState, owner: Activity['owner'], title: string, detail: string) {
  state.activities.unshift({ id: randomUUID(), owner, title, detail, at: new Date().toISOString() });
  state.activities = state.activities.slice(0, 80);
}

export function transition(original: ShopState, action: Action): ShopState {
  if (!action || typeof action !== 'object' || Array.isArray(action) || typeof action.type !== 'string') throw new Error('Send a valid action object.');
  const requiresEvent = ['customer_message', 'approve_purchase', 'agent_report', 'save_recovery_draft'].includes(action.type);
  if (requiresEvent || 'eventId' in action) {
    if (!('eventId' in action) || typeof action.eventId !== 'string' || !action.eventId.trim() || action.eventId.length > 200) throw new Error('A valid event identifier is required.');
  }
  if (action.type === 'customer_message' && typeof action.text !== 'string') throw new Error('Write a message between 1 and 2,000 characters.');
  if (action.type === 'agent_report' && (typeof action.summary !== 'string' || typeof action.rationale !== 'string')) throw new Error('Provide a concise summary and evidence-based rationale.');
  if (action.type === 'reset') return { ...seed(), processedEvents: [...original.processedEvents], eventFingerprints: { ...original.eventFingerprints }, version: original.version + 1 };
  const state = structuredClone(original);
  const fingerprint = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(action).sort(([a], [b]) => a.localeCompare(b))))).digest('hex');
  if ('eventId' in action) {
    if (state.processedEvents.includes(action.eventId)) {
      const previous = state.eventFingerprints?.[action.eventId];
      if (previous && previous !== fingerprint) throw new Error('Event identifier already used for a different action.');
      return original;
    }
  }
  const product = state.products.find(p => p.id === 'hoodie');
  if (!product) throw new Error('The supported hoodie variant is unavailable.');
  if (state.paused && ['customer_message', 'prepare_proposal', 'agent_report', 'approve_purchase'].includes(action.type)) throw new Error('The demo workflow is paused. Resume it to continue.');
  switch (action.type) {
    case 'record_stock_request':
    case 'save_recovery_draft':
    case 'review_recovery_draft': {
      const event = applyRecoveryAction(state, action);
      if (!event) return original;
      log(state, action.type === 'review_recovery_draft' ? 'merchant' : 'sales', event.title, event.detail);
      break;
    }
    case 'customer_message': {
      const text = action.text?.trim();
      if (!text || text.length > 2000) throw new Error('Write a message between 1 and 2,000 characters.');
      const at = new Date().toISOString();
      state.messages.push({ id: randomUUID(), sender: 'customer', text, at });
      // Explicit sample workflow: live GrokBot can use the same inventory API.
      const normalized = text.normalize('NFKC').replace(/[‘’ʼ]/g, "'").toLowerCase();
      let reply: string;
      // An explicit reserve/buy wins; softer verbs ("get the price", "my order") only count outside an enquiry.
      const enquiry = /\b(know|price|cost|how much|when|where|delivery|shipping|arrive|my order|order status|could you tell)\b/.test(normalized);
      const wantsOrder = /\b(reserve|buy)\b/.test(normalized) || (!enquiry && /\b(order|want|take|get)\b/.test(normalized));
      const mentionsHoodie = /hoodie/.test(normalized);
      const wrongVariant = /\b(xs|s|l|xl|xxl|xxxl|small|large|white|blue|red|grey|gray|navy|green|pink|yellow|purple|brown|orange|beige|cream|bone|olive)\b/.test(normalized.replace(/'s\b/g, ''));
      if (/\b(don'?t|do not|won'?t|will not|wouldn'?t|not|never|no thanks|no hoodie|cancel|refund|return|ignore|override)\b/.test(normalized)) {
        reply = 'I haven’t made a new reservation. For an existing order, the merchant can review its status in the workspace.';
      } else if (mentionsHoodie && wrongVariant) {
        reply = 'This demo stocks the Everyday Hoodie in washed black, medium. Would you like that variant? I haven’t reserved anything yet.';
      } else if (mentionsHoodie && wantsOrder) {
        // Quantities must modify the product, never an age, price or order number elsewhere in the sentence.
        const match = normalized.match(/(?:^|\s)(-?\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:of\s+the\s+)?(?:(?:medium|m|washed|black|washed-black|everyday)\s+)*hoodies?\b/);
        const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
        const quantity = match ? (words[match[1]] ?? Number(match[1])) : 1;
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('Please request between 1 and 100 units.');
        const reserved = Math.min(available(product), quantity);
        const shortage = quantity - reserved;
        if (reserved > 0) {
          product.reserved += reserved;
          state.orders.push({ id: `NF-${1001 + state.orders.filter(o => !o.eventId.startsWith('opening-')).length}`, productId: product.id, quantity: reserved, total: reserved * product.price, customer: 'Alex Morgan', status: 'reserved', eventId: action.eventId });
          log(state, 'sales', `${reserved} hoodie${reserved > 1 ? 's' : ''} reserved for Alex`, `${money(reserved * product.price)} pending payment. Stock is reserved immediately to prevent overselling.`);
        }
        const interest = Math.min(shortage, 10);
        product.demand += interest;
        reply = reserved ? `I’ve reserved ${reserved} medium washed-black hoodie${reserved > 1 ? 's' : ''} for you (${money(reserved * product.price)}).` : 'The medium washed-black hoodie is currently out of stock.';
        if (shortage) {
          reply += ` We’re ${shortage} short of your request. I’ve recorded ${interest} unit${interest > 1 ? 's' : ''} of interest for the stock manager${shortage > interest ? ' (the per-message limit is 10)' : ''}. I’ll only promise a restock date once a supplier confirms it.`;
          log(state, 'sales', 'A customer request became a stock signal', `${interest} unfulfilled unit${interest > 1 ? 's' : ''} added to demand. Enquiries are separate from paid orders.`);
        }
        if (reserved) reply += ' This is a demo reservation; no payment has been taken.';
      } else if (/\b(delivery|shipping|arrive|when)\b/.test(normalized)) {
        reply = 'Restock timing depends on supplier confirmation. The current demo quotes range from 2 to 8 days; I won’t promise a delivery date before it’s confirmed.';
      } else if (mentionsHoodie || /\b(stock|available|price)\b/.test(normalized)) {
        const left = available(product);
        reply = left > 0
          ? `The Everyday Hoodie in washed black / medium is ${money(product.price)}. There ${left === 1 ? 'is' : 'are'} ${left} available right now. You can ask “Reserve one medium black hoodie”.`
          : `The Everyday Hoodie in washed black / medium is ${money(product.price)}, but it’s sold out right now. Ask me to reserve one and I’ll record your interest for the restock.`;
      } else {
        reply = 'I can help with the Everyday Hoodie: availability, reserving medium washed-black hoodies, or restock timing. This is a guided sample-store demo.';
      }
      state.messages.push({ id: randomUUID(), sender: 'sales', text: reply, at });
      break;
    }
    case 'agent_report': {
      const chosen = state.quotes.find(q => q.id === action.quoteId);
      if (!chosen || !Number.isInteger(action.quantity) || action.quantity < chosen.minimum || action.quantity > 500) throw new Error('Select a valid supplier and respect its minimum order quantity.');
      if (!action.summary?.trim() || action.summary.length > 1200 || !action.rationale?.trim() || action.rationale.length > 4000) throw new Error('Provide a concise summary and evidence-based rationale.');
      if (action.source !== undefined && action.source !== 'agent_token' && action.source !== 'handoff_page') throw new Error('Unknown recommendation source.');
      // Unless the route verified the agent's token, don't claim the recommendation came from GrokBot.
      const source = action.source ?? 'handoff_page';
      state.agentReport = { summary: action.summary.trim(), quoteId: chosen.id, quantity: action.quantity, rationale: action.rationale.trim(), at: new Date().toISOString(), source };
      state.proposalReady = true;
      log(state, 'stock', source === 'agent_token' ? 'Verified agent recommendation received' : 'Recommendation submitted on the handoff page', `${chosen.supplier} · ${action.quantity} units. ${action.summary.trim()}`);
      break;
    }
    case 'prepare_proposal': {
      state.proposalReady = true;
      const incoming = state.purchases.filter(p => p.productId === product.id && ['ordered', 'cancellation_requested'].includes(p.status)).reduce((sum, p) => sum + p.quantity, 0);
      log(state, 'stock', 'Restock options prepared', `${available(product)} available · ${incoming} incoming · ${product.demand} units of unmet demand. Compare total cost, minimum quantity and lead time.`);
      break;
    }
    case 'approve_purchase': {
      if (state.purchases.some(p => p.productId === product.id && ['ordered', 'cancellation_requested'].includes(p.status))) throw new Error('There is already an incoming order for this product. Review it before ordering again.');
      if (!state.proposalReady) throw new Error('Prepare a proposal before approving a purchase.');
      const quote = state.quotes.find(q => q.id === action.quoteId);
      if (!quote) throw new Error('Supplier quote not found.');
      if (!Number.isInteger(action.quantity) || action.quantity < quote.minimum || action.quantity > 500) throw new Error(`Quantity must be between ${quote.minimum} and 500.`);
      const total = quote.unitCost * action.quantity + quote.shipping;
      const purchase = { id: `PO-${1001 + state.purchases.length}`, productId: product.id, quoteId: quote.id, quantity: action.quantity, total, status: 'ordered' as const, createdAt: new Date().toISOString() };
      state.purchases.push(purchase);
      state.proposalReady = false;
      log(state, 'merchant', `${purchase.id} approved · ${money(total)}`, `${action.quantity} hoodies from ${quote.supplier}. Recorded in the demo supplier portal; no external purchase placed. Stock remains incoming.`);
      break;
    }
    case 'request_cancel':
    case 'confirm_cancel':
    case 'receive_purchase': {
      const purchase = state.purchases.find(p => p.id === action.purchaseId);
      if (!purchase) throw new Error('Purchase order not found.');
      if (action.type === 'request_cancel') {
        if (purchase.status === 'cancellation_requested') return original;
        if (purchase.status !== 'ordered') throw new Error('Only an open purchase order can be cancelled.');
        purchase.status = 'cancellation_requested';
        log(state, 'merchant', `Cancellation requested · ${purchase.id}`, 'Waiting for the demo supplier to confirm. This stock still counts as incoming.');
      } else if (action.type === 'confirm_cancel') {
        if (purchase.status === 'cancelled') return original;
        if (purchase.status !== 'cancellation_requested') throw new Error('Request cancellation before confirming it.');
        purchase.status = 'cancelled';
        log(state, 'stock', `Supplier confirmed cancellation · ${purchase.id}`, 'Demo supplier response recorded. The order no longer counts as incoming.');
      } else {
        if (purchase.status === 'received') return original;
        if (!['ordered', 'cancellation_requested'].includes(purchase.status)) throw new Error('A cancelled purchase cannot be received.');
        const item = state.products.find(p => p.id === purchase.productId)!;
        item.onHand += purchase.quantity;
        item.demand = Math.max(0, item.demand - purchase.quantity);
        purchase.status = 'received';
        log(state, 'stock', `${purchase.quantity} hoodies received`, `${purchase.id} arrived. Available inventory updated once; interested customers can now be contacted.`);
      }
      break;
    }
    case 'complete_order': {
      const order = state.orders.find(o => o.id === action.orderId);
      if (!order) throw new Error('Order not found.');
      if (order.status === 'paid') return original;
      const item = state.products.find(p => p.id === order.productId)!;
      item.onHand -= order.quantity;
      item.reserved -= order.quantity;
      order.status = 'paid';
      log(state, 'sales', `${order.id} paid in demo checkout`, `${money(order.total)} recorded as demo sales. No real payment was processed.`);
      break;
    }
    case 'toggle_pause':
      state.paused = !state.paused;
      log(state, 'merchant', state.paused ? 'Demo workflow paused' : 'Demo workflow resumed', 'Customer-message processing and proposal preparation follow this setting.');
      break;
    default: throw new Error('Unknown action.');
  }
  if ('eventId' in action) {
    state.processedEvents.push(action.eventId);
    state.eventFingerprints = { ...state.eventFingerprints, [action.eventId]: fingerprint };
  }
  state.version += 1;
  return state;
}
