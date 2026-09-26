export type Product = { id: string; name: string; variant: string; sku: string; price: number; cost: number; onHand: number; reserved: number; demand: number; dailySales: number; leadDays: number; tone: string; kind: 'hoodie' | 'tee' | 'bag' | 'cap' };
export type Quote = { id: string; supplier: string; country: string; unitCost: number; shipping: number; minimum: number; leadDays: number; note: string; recommended?: boolean };
export type Message = { id: string; sender: 'customer' | 'sales' | 'merchant' | 'stock'; text: string; at: string };
export type Order = { id: string; productId: string; quantity: number; total: number; customer: string; status: 'reserved' | 'paid'; eventId: string };
export type Purchase = { id: string; productId: string; quoteId: string; quantity: number; unitCost?: number; total: number; status: 'ordered' | 'cancellation_requested' | 'cancelled' | 'received'; createdAt: string; expectedAt?: string; notifiedAt?: string };
export type Activity = { id: string; owner: 'sales' | 'stock' | 'merchant' | 'system'; title: string; detail: string; at: string };
// Set by the API route: 'agent_token' means the bearer-token agent sent it; anything else came through the /agent page.
export type ReportSource = 'agent_token' | 'handoff_page';
export type AgentReport = { summary: string; quoteId: string; quantity: number; rationale: string; at: string; source?: ReportSource };
export type StockRequest = { id: string; channel: 'whatsapp' | 'demo'; contactRef: string; productId: string; quantity: number; createdAt: string; draft?: { text: string; rationale: string; at: string; availableAtDraft: number; reviewedAt?: string; source: 'handoff_page' } };
export type RestockSubscription = { productId: string; customer: string; createdAt: string };
export type CustomerNotification = { id: string; productId: string; purchaseId: string; customer: string; text: string; expectedAt: string; at: string };
export type ShopState = { restockSubscriptions?: RestockSubscription[]; customerNotifications?: CustomerNotification[]; version: number; products: Product[]; quotes: Quote[]; messages: Message[]; orders: Order[]; purchases: Purchase[]; activities: Activity[]; processedEvents: string[]; eventFingerprints?: Record<string, string>; proposalReady: boolean; paused: boolean; agentReport?: AgentReport; stockRequests?: StockRequest[] };
export type Action =
  | { type: 'record_stock_request'; channel: 'whatsapp' | 'demo'; contactRef: string; productId: string; quantity: number }
  | { type: 'save_recovery_draft'; requestId: string; text: string; rationale: string; eventId: string }
  | { type: 'review_recovery_draft'; requestId: string }
  | { type: 'customer_message'; text: string; eventId: string }
  | { type: 'prepare_proposal' }
  | { type: 'agent_report'; summary: string; quoteId: string; quantity: number; rationale: string; eventId: string; source?: ReportSource }
  | { type: 'notify_waitlist'; purchaseId: string; eventId: string }
  | { type: 'approve_purchase'; productId?: string; quoteId: string; quantity: number; negotiatedUnitCost?: number; eventId: string }
  | { type: 'request_cancel'; purchaseId: string }
  | { type: 'confirm_cancel'; purchaseId: string }
  | { type: 'receive_purchase'; purchaseId: string }
  | { type: 'complete_order'; orderId: string }
  | { type: 'toggle_pause' }
  | { type: 'reset' };
export const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: pence % 100 ? 2 : 0 }).format(pence / 100);
export const available = (product: Product) => product.onHand - product.reserved;
