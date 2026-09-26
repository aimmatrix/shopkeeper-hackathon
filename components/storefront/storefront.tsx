'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, Minus, Plus, RefreshCw } from 'lucide-react';
import type { Action, Product, ShopState } from '@/lib/types';
import { available, money } from '@/lib/types';
import ProductArt from '@/components/product-art';
import styles from '@/app/shop/shop.module.css';
import AssistantPanel from './assistant-panel';
import { newEventId } from './utils';

type StoreResponse = { state?: ShopState; error?: string };

const POLL_MS = 5000;
const FLASH_MS = 6000;
const MAX_QTY = 5;
// The customer_message workflow in lib/engine.ts only handles this product (washed black / M).
const SUPPORTED_ID = 'hoodie';

async function readState(res: Response): Promise<ShopState> {
  const data = await res.json().catch(() => ({})) as StoreResponse;
  if (!res.ok || !data.state) throw new Error(data.error ?? `The store didn’t respond (${res.status}).`);
  return data.state;
}

function stockText(product: Product) {
  const left = available(product);
  if (left <= 0) return 'Sold out';
  if (left <= 3) return `Only ${left} left`;
  return `${left} in stock`;
}

function StockLine({ product, flashed }: { product: Product; flashed: boolean }) {
  const left = available(product);
  return <p className={styles.stockLine} data-level={left <= 0 ? 'out' : left <= 3 ? 'low' : 'ok'} data-flash={flashed || undefined} aria-live="polite">
    <span className={styles.stockDot} aria-hidden />
    {stockText(product)}
    {flashed && <em>· just updated</em>}
  </p>;
}

export default function Storefront() {
  const [state, setState] = useState<ShopState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [syncFailing, setSyncFailing] = useState(false);
  const [flashed, setFlashed] = useState<Record<string, boolean>>({});
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [replyOrders, setReplyOrders] = useState<Record<string, string>>({});
  const stateRef = useRef<ShopState | null>(null);
  const writes = useRef(0);
  const inFlight = useRef(0);
  const sendingRef = useRef(false);

  const accept = useCallback((next: ShopState, fromPoll: boolean) => {
    const prev = stateRef.current;
    if (prev && fromPoll) {
      // A poll that changes availability means someone else (the merchant workspace, the agent) moved stock.
      const changed = next.products.filter(p => {
        const before = prev.products.find(q => q.id === p.id);
        return before && available(before) !== available(p);
      }).map(p => p.id);
      if (changed.length) {
        setFlashed(f => ({ ...f, ...Object.fromEntries(changed.map(id => [id, true])) }));
        setTimeout(() => setFlashed(f => { const n = { ...f }; changed.forEach(id => delete n[id]); return n; }), FLASH_MS);
      }
    }
    stateRef.current = next;
    setState(next);
    setSyncedAt(new Date());
    setSyncFailing(false);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const seen = writes.current;
    try {
      const next = await readState(await fetch('/api/store', { cache: 'no-store' }));
      if (seen !== writes.current || inFlight.current) return; // a write landed meanwhile; its response is newer
      accept(next, true);
      setLoadError(null);
    } catch (error) {
      if (stateRef.current) setSyncFailing(true);
      else setLoadError((error as Error).message);
    }
  }, [accept]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  const act = useCallback(async (action: Action) => {
    inFlight.current += 1;
    writes.current += 1;
    try {
      const next = await readState(await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) }));
      accept(next, false);
      return next;
    } finally { inFlight.current -= 1; }
  }, [accept]);

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sendingRef.current) return false;
    sendingRef.current = true;
    setOutgoing(text);
    setChatError(null);
    const eventId = newEventId();
    try {
      const next = await act({ type: 'customer_message', text, eventId });
      const order = next.orders.find(o => o.eventId === eventId);
      if (order) {
        // The engine appends the customer message and the assistant reply together, so the reply follows ours.
        const mine = next.messages.map(m => m.sender === 'customer' && m.text === text).lastIndexOf(true);
        const reply = mine >= 0 ? next.messages[mine + 1] : undefined;
        if (reply) setReplyOrders(r => ({ ...r, [reply.id]: order.id }));
      }
      return true;
    } catch (error) {
      setChatError((error as Error).message);
      return false;
    } finally {
      sendingRef.current = false;
      setOutgoing(null);
    }
  }, [act]);

  const checkout = useCallback(async (orderId: string) => { await act({ type: 'complete_order', orderId }); }, [act]);

  const reserveFromHero = (text: string) => {
    if (window.matchMedia('(max-width: 1023px)').matches) document.getElementById('assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void sendMessage(text);
  };

  if (!state) return <div className={styles.page}>
    <SampleNotice />
    <Masthead syncedAt={null} failing={false} />
    <div className={styles.status} role={loadError ? 'alert' : 'status'}>
      {loadError ? <>
        <p><strong>The shop couldn’t load.</strong> {loadError}</p>
        <button className={styles.secondary} onClick={() => { setLoadError(null); refresh(); }}><RefreshCw size={15} /> Try again</button>
      </> : <p><LoaderCircle className={styles.spin} size={18} /> Opening the shop…</p>}
    </div>
  </div>;

  const hero = state.products.find(p => p.id === SUPPORTED_ID) ?? state.products[0];
  const rest = state.products.filter(p => p.id !== hero.id);

  return <div className={styles.page}>
    <SampleNotice />
    <Masthead syncedAt={syncedAt} failing={syncFailing} />
    <main className={styles.main}>
      <Hero product={hero} flashed={Boolean(flashed[hero.id])} busy={outgoing !== null} paused={state.paused} onReserve={reserveFromHero} />
      <aside className={styles.side} id="assistant" aria-label="Shop assistant">
        <AssistantPanel state={state} outgoing={outgoing} error={chatError} replyOrders={replyOrders} onSend={sendMessage} onCheckout={checkout} />
      </aside>
      <section className={styles.catalogue} aria-labelledby="catalogue-title">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>The rest of the edit</p>
          <h2 id="catalogue-title">Browse the collection</h2>
          <p>Prices and stock are live. These pieces are browse-only in this sample store — ordering is connected for the Everyday Hoodie alone.</p>
        </header>
        <ol className={styles.grid}>
          {rest.map((product, i) => {
            const [colour, size] = product.variant.split(' / ');
            return <li key={product.id} className={styles.card}>
              <div className={styles.cardArt}>
                <span className={styles.cardIndex}>{String(i + 2).padStart(2, '0')}</span>
                <ProductArt kind={product.kind} className={styles.cardSvg} />
              </div>
              <div className={styles.cardTitle}><h3>{product.name}</h3><span>{money(product.price)}</span></div>
              <p className={styles.cardVariant}>{colour}{size ? ` · ${size}` : ''}</p>
              <StockLine product={product} flashed={Boolean(flashed[product.id])} />
              <p className={styles.browseOnly}>Browse only in this sample</p>
            </li>;
          })}
        </ol>
      </section>
    </main>
    <footer className={styles.footer}>
      <p><strong>North & Form</strong> is a fictional merchant used to demonstrate Shopkeeper. Stock, reservations and demo checkouts are stored as sample records; no payment is ever taken and nothing ships.</p>
      <a href="/">Open the merchant workspace <ArrowUpRight size={14} /></a>
    </footer>
  </div>;
}

function SampleNotice() {
  return <div className={styles.notice}>
    <p><span className={styles.noticeTag}>DEMO STORE</span> Demo reservations and checkout only — no payment is taken.</p>
    <a href="/">Merchant view <ArrowUpRight size={13} /></a>
  </div>;
}

function Masthead({ syncedAt, failing }: { syncedAt: Date | null; failing: boolean }) {
  return <header className={styles.masthead}>
    <a href="/shop" className={styles.wordmark}>North <i>&</i> Form</a>
    <nav className={styles.mastNav} aria-label="Shop">
      <a href="#top">The edit</a>
      <a href="#catalogue-title">Collection</a>
      <a href="#assistant">Ask the shop</a>
    </nav>
    <p className={styles.live} data-failing={failing || undefined}>
      <span aria-hidden />
      {failing ? 'Reconnecting to live stock…' : syncedAt ? <>Live stock · {syncedAt.toLocaleTimeString('en-GB')}</> : 'Connecting…'}
    </p>
  </header>;
}

function Hero({ product, flashed, busy, paused, onReserve }: { product: Product; flashed: boolean; busy: boolean; paused: boolean; onReserve: (text: string) => void }) {
  const [qty, setQty] = useState(1);
  const left = available(product);
  const [colour, size] = product.variant.split(' / ');
  const [first, ...rest] = product.name.split(' ');
  const reserveText = `Reserve ${qty} medium washed-black Everyday Hoodie${qty > 1 ? 's' : ''}`;
  return <section className={styles.hero} id="top" aria-labelledby="hero-title">
    <div className={styles.heroArt}>
      <span className={styles.plate}>No. 01 — Bestseller</span>
      <ProductArt kind={product.kind} className={styles.heroSvg} />
      <div className={styles.seal} data-flash={flashed || undefined} aria-hidden>
        <strong>{Math.max(left, 0)}</strong><span>left in {size}</span>
      </div>
    </div>
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>The edit · {product.sku}</p>
      <h1 id="hero-title"><span className={styles.hl}>{first}</span>{rest.length ? ` ${rest.join(' ')}` : ''}</h1>
      <p className={styles.lede}>The one we reach for first. Washed black, relaxed through the body, made to be worn every day.</p>
      <div className={styles.priceRow}>
        <span className={styles.price}>{money(product.price)}</span>
        <StockLine product={product} flashed={flashed} />
      </div>
      <dl className={styles.variant}>
        <div><dt>Colour</dt><dd>{colour}</dd></div>
        <div><dt>Size</dt><dd>{size === 'M' ? 'Medium' : size}</dd></div>
      </dl>
      <div className={styles.buy}>
        {left > 0 && <div className={styles.stepper} role="group" aria-label="Quantity">
          <button onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Fewer"><Minus size={14} /></button>
          <output aria-live="polite">{qty}</output>
          <button onClick={() => setQty(q => Math.min(MAX_QTY, q + 1))} disabled={qty >= MAX_QTY} aria-label="More"><Plus size={14} /></button>
        </div>}
        <button className={styles.primary} disabled={busy || paused} onClick={() => onReserve(left > 0 ? reserveText : 'I want a medium washed-black Everyday Hoodie')}>
          {busy ? <><LoaderCircle className={styles.spin} size={16} /> Asking the shop…</> : left > 0 ? `Reserve ${qty} with the assistant` : 'Register restock interest'}
        </button>
      </div>
      {left > 0 && qty > left && <p className={styles.hint}>Only {left} available — the assistant will reserve {left} and record the rest as restock interest.</p>}
      <p className={styles.fine}>
        {paused ? 'The merchant has paused the shop assistant, so new reservations are on hold.'
          : 'Your request goes to the shop assistant, which holds stock the moment it reserves. Checkout afterwards is a demo — no card, no payment.'}
      </p>
    </div>
  </section>;
}
