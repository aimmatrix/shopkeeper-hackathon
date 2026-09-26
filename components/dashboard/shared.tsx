import type { Action, Order, Product, Quote, ShopState } from '@/lib/types';
import { available } from '@/lib/types';

export type View = 'today' | 'inbox' | 'stock' | 'suppliers';

/** Everything a dashboard view needs. Derived values come from workspace.tsx so the math lives in one place. */
export type Dash = {
  state: ShopState;
  product: Product;
  incoming: number;
  paid: number;
  pending: Order[];
  needRestock: boolean;
  quote: Quote;
  quantity: number;
  busy: boolean;
  go: (view: View) => void;
  startRestock: (productId: string) => void;
  act: (action: Action, success?: string) => Promise<boolean>;
  approve: () => Promise<void>;
  openSuppliers: () => Promise<void>;
  undo: () => Promise<void>;
  pick: (quoteId: string) => void;
  step: (delta: number) => void;
  applyReport: () => void;
};

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MO_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const addDays = (from: Date, days: number) => { const d = new Date(from); d.setDate(d.getDate() + days); return d; };
/** "Tue 29 Sep" — built by hand so every browser prints the same thing. */
export const shortDate = (d: Date) => `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
/** "SATURDAY 26 SEPTEMBER" */
export const kickerDate = (d: Date) => `${WD_LONG[d.getDay()]} ${d.getDate()} ${MO_LONG[d.getMonth()]}`.toUpperCase();
export const inDays = (n: number) => (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
/** "Washed black / M" → "Washed black · M" */
export const variantLabel = (p: Product) => p.variant.replace(' / ', ' · ');
export const unitName = (p: Product, n: number) => plural(n, p.kind === 'bag' ? 'tote' : p.kind, p.kind === 'bag' ? 'totes' : `${p.kind}s`);

/** Low = the existing needRestock rule, applied per product. */
export const isLow = (p: Product) => available(p) < p.dailySales * p.leadDays;
export const daysLeft = (p: Product) => (p.dailySales ? Math.max(0, available(p)) / p.dailySales : Infinity);

export const swatch: Record<string, string> = { charcoal: '#2E302D', bone: '#E6DFCC', olive: '#7A8452', clay: '#C07A55' };

export function Mark() {
  return <span className="sk-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="2.4" rx="1" /><rect x="2" y="7" width="9" height="2.4" rx="1" /><rect x="2" y="11" width="5" height="2.4" rx="1" /></svg></span>;
}

const MAX_BLOCKS = 60;
export type BlockKind = 'reserved' | 'free' | 'waiting' | 'incoming';

/** A run of unit blocks: 1 block = 1 item. Long runs are capped with a "+N" tail so the row never explodes. */
export function Blocks({ kind, count }: { kind: BlockKind; count: number }) {
  const shown = Math.min(Math.max(0, count), MAX_BLOCKS);
  return <>{Array.from({ length: shown }, (_, i) => <span key={i} className={`sk-block ${kind}`} />)}{count > MAX_BLOCKS && <span className="sk-block-more">+{count - MAX_BLOCKS}</span>}</>;
}

export function UnitRow({ title, sub, count, tone, children, extra }: { title: string; sub: string; count: number; tone?: 'waiting' | 'incoming'; children: React.ReactNode; extra?: React.ReactNode }) {
  return <div className="sk-unit-row">
    <div className="sk-unit-label"><span>{title}</span><small>{sub}</small>{extra}</div>
    <div className="sk-unit-blocks" aria-hidden="true">{children}</div>
    <span className={`sk-unit-count ${tone ?? ''}`}>{count}</span>
  </div>;
}

export function Arrow({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
}
export function Tick({ size = 24, width = 2.6 }: { size?: number; width?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
}
