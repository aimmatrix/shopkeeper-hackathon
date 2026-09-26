'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, LoaderCircle } from 'lucide-react';
import type { Message, Order, Product, ShopState } from '@/lib/types';
import { money } from '@/lib/types';
import styles from '@/app/shop/shop.module.css';
import { clock } from './utils';

// Every prompt here is one the scripted customer_message workflow in lib/engine.ts answers.
const PROMPTS = [
  'Is the medium washed-black hoodie in stock?',
  'Reserve one medium washed-black hoodie',
  'When will the hoodie be restocked?',
];

const SENDER: Record<Message['sender'], string> = {
  customer: 'Alex (you)',
  sales: 'Shop assistant',
  merchant: 'North & Form team',
  stock: 'Stock manager',
};

type Props = {
  state: ShopState;
  outgoing: string | null;
  error: string | null;
  replyOrders: Record<string, string>;
  onSend: (text: string) => Promise<boolean>;
  onCheckout: (orderId: string) => Promise<void>;
};

export default function AssistantPanel({ state, outgoing, error, replyOrders, onSend, onCheckout }: Props) {
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLOListElement>(null);
  // Stock-manager notes are internal to the merchant workspace; customers only see the storefront conversation.
  const messages = state.messages.filter(m => m.sender !== 'stock');
  const orders = state.orders.filter(o => o.customer === 'Alex Morgan').reverse();
  const busy = outgoing !== null;

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, outgoing]);

  const submit = async (text: string) => {
    if (!text.trim() || busy || state.paused) return;
    setDraft('');
    if (!await onSend(text)) setDraft(text);
  };

  const productFor = (order: Order) => state.products.find(p => p.id === order.productId);

  return <div className={styles.panel}>
    <header className={styles.panelHead}>
      <div>
        <p className={styles.eyebrow}>Customer chat</p>
        <h2>Ask the shop</h2>
      </div>
      <span className={styles.guided}>Guided demo</span>
    </header>
    <p className={styles.panelNote}>Scripted replies for the Everyday Hoodie, backed by live stock records. Every message appears in the merchant’s inbox.</p>

    <ol className={styles.thread} ref={threadRef} aria-live="polite" aria-label="Conversation">
      {messages.map(m => {
        const orderId = replyOrders[m.id];
        const order = orderId ? state.orders.find(o => o.id === orderId) : undefined;
        return <li key={m.id} className={styles.msg} data-side={m.sender === 'customer' ? 'me' : 'shop'}>
          <span className={styles.msgMeta}>{SENDER[m.sender]} · {clock(m.at)}</span>
          <p className={styles.bubble}>{m.text}</p>
          {order && <OrderCard order={order} product={productFor(order)} onCheckout={onCheckout} />}
        </li>;
      })}
      {outgoing && <>
        <li className={styles.msg} data-side="me" data-pending>
          <span className={styles.msgMeta}>Alex (you) · sending</span>
          <p className={styles.bubble}>{outgoing}</p>
        </li>
        <li className={styles.msg} data-side="shop">
          <p className={styles.typing} aria-label="The shop assistant is replying"><span /><span /><span /></p>
        </li>
      </>}
    </ol>

    {orders.length > 0 && <section className={styles.tray} aria-label="Your reservations">
      <h3>Your reservations <span>{orders.filter(o => o.status === 'reserved').length} awaiting checkout</span></h3>
      <ul>
        {orders.slice(0, 3).map(o => <li key={o.id}><OrderCard order={o} product={productFor(o)} onCheckout={onCheckout} compact /></li>)}
      </ul>
      {orders.length > 3 && <p className={styles.trayMore}>+ {orders.length - 3} earlier</p>}
    </section>}

    <div className={styles.composerWrap}>
      {state.paused
        ? <p className={styles.paused} role="status">The merchant has paused the shop assistant. You can still check out existing reservations.</p>
        : <div className={styles.prompts}>
          {PROMPTS.map(p => <button key={p} onClick={() => submit(p)} disabled={busy}>{p}</button>)}
        </div>}
      {error && <p className={styles.chatError} role="alert">{error}</p>}
      <form className={styles.composer} onSubmit={e => { e.preventDefault(); void submit(draft); }}>
        <label className={styles.srOnly} htmlFor="shop-message">Message the shop</label>
        <input id="shop-message" value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} autoComplete="off"
          placeholder={state.paused ? 'Assistant paused by the merchant' : 'Ask about the Everyday Hoodie…'} disabled={state.paused} />
        <button type="submit" disabled={!draft.trim() || busy || state.paused} aria-label="Send message">
          {busy ? <LoaderCircle className={styles.spin} size={17} /> : <ArrowUp size={17} />}
        </button>
      </form>
    </div>
  </div>;
}

function OrderCard({ order, product, onCheckout, compact = false }: { order: Order; product?: Product; onCheckout: (id: string) => Promise<void>; compact?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = order.status === 'paid';

  const confirm = async () => {
    setWorking(true); setError(null);
    try { await onCheckout(order.id); setConfirming(false); }
    catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };

  return <div className={styles.order} data-compact={compact || undefined} data-paid={paid || undefined}>
    <div className={styles.orderRow}>
      <div>
        <strong>{order.id}</strong>
        <span>{order.quantity} × {product?.name ?? order.productId}{product ? ` · ${product.variant}` : ''}</span>
      </div>
      <b>{money(order.total)}</b>
    </div>
    {paid
      ? <p className={styles.orderPaid}><Check size={14} /> Paid in demo checkout — no real payment was processed.</p>
      : confirming
        ? <div className={styles.confirm}>
          <p>Record {order.id} as paid? No card is needed and no money moves — this is a demo sale for the merchant’s records.</p>
          <div>
            <button className={styles.primarySmall} onClick={confirm} disabled={working}>
              {working ? <LoaderCircle className={styles.spin} size={14} /> : null} Confirm demo checkout
            </button>
            <button className={styles.textButton} onClick={() => setConfirming(false)} disabled={working}>Not now</button>
          </div>
        </div>
        : <div className={styles.orderActions}>
          <span>Reserved · stock held</span>
          <button className={styles.primarySmall} onClick={() => setConfirming(true)}>Demo checkout</button>
        </div>}
    {error && <p className={styles.chatError} role="alert">{error}</p>}
  </div>;
}
