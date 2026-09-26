import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/types';
import type { Message } from '@/lib/types';
import { Arrow, type Dash, plural, shortDate, unitName } from './shared';
import { arrival, openPurchase } from './today';
import { BotAvatar, type Mood, TypeOut, TypingDots } from './bot-presence';
import s from './inbox.module.css';

const CUSTOMER = 'Alex Morgan';
const ASSISTANT = 'Shopkeeper Sales Assistant';
const TRY_IT = 'Could I get two hoodies?';
/** The dots stay up at least this long, so a fast reply doesn't flash past. */
const MIN_THINK = 700;
/** The header names the sales assistant, so only other shop-side senders get a name above their bubble. */
const LABEL: Partial<Record<Message['sender'], string>> = { stock: 'Stock manager', merchant: 'You' };
const side = (sender: Message['sender']) => sender === 'customer' ? 'user' : 'bot';
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

export function InboxView(d: Dash) {
  const { state, product, busy, needRestock, incoming } = d;
  const [text, setText] = useState('');
  // The customer's message shows immediately while the reply is on its way.
  const [pending, setPending] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  // New replies are held back until they can type themselves out; ones already on screen at load stay put.
  const [streamId, setStreamId] = useState<string | null>(null);
  const [flash, setFlash] = useState<'done' | 'error' | null>(null);
  const known = useRef<Set<string> | null>(null);
  const sentAt = useRef(0);
  const flashTimer = useRef(0);
  const feed = useRef<HTMLDivElement>(null);
  const messages = state.messages;
  known.current ??= new Set(messages.map(m => m.id));
  const shown = messages.filter(m => side(m.sender) === 'user' || known.current!.has(m.id) || m.id === streamId);
  const last = shown[shown.length - 1];
  const preview = pending ?? last?.text;
  const face = thinking ? null : [...shown].reverse().find(m => side(m.sender) === 'bot')?.id;
  const mood: Mood = state.paused ? 'paused' : flash === 'error' ? 'error' : thinking ? 'thinking' : streamId ? 'typing' : flash ?? 'idle';
  const sent = messages.filter(m => m.sender === 'customer').length > 1;
  const orders = state.orders.filter(o => o.customer === CUSTOMER && o.productId === product.id);
  const held = orders.filter(o => o.status === 'reserved').reduce((n, o) => n + o.quantity, 0);
  // The deterministic sales reply states the shortfall ("We’re 1 short of your request").
  const shortMatch = [...messages].reverse().find(m => m.sender === 'sales' && /(\d+) short of your request/.test(m.text))?.text.match(/(\d+) short of your request/);
  const short = shortMatch ? Number(shortMatch[1]) : 0;
  const open = openPurchase(d);

  useEffect(() => { const el = feed.current; if (el) el.scrollTop = el.scrollHeight; }, [shown.length, pending, thinking]);

  // Start typing out the next unseen reply once the dots have had their moment.
  useEffect(() => {
    if (streamId) return;
    const next = messages.find(m => !known.current!.has(m.id) && side(m.sender) === 'bot');
    if (!next) return;
    const timer = window.setTimeout(() => { setThinking(false); setStreamId(next.id); }, Math.max(0, sentAt.current + MIN_THINK - Date.now()));
    return () => clearTimeout(timer);
  }, [messages, streamId]);

  // If a send succeeds but no reply ever arrives, don't leave the dots running forever.
  useEffect(() => {
    if (!thinking || pending !== null) return;
    const timer = window.setTimeout(() => setThinking(false), MIN_THINK + 1500);
    return () => clearTimeout(timer);
  }, [thinking, pending]);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  function flashMood(kind: 'done' | 'error') {
    clearTimeout(flashTimer.current);
    setFlash(kind);
    flashTimer.current = window.setTimeout(() => setFlash(null), kind === 'error' ? 2400 : 1400);
  }

  function finishStream(id: string) {
    known.current!.add(id);
    setStreamId(null);
    flashMood('done');
  }

  async function send(body: string) {
    if (!body.trim() || thinking || streamId) return;
    const typed = text;
    sentAt.current = Date.now();
    setThinking(true);
    setPending(body);
    if (body === typed) setText('');
    const ok = await d.act({ type: 'customer_message', text: body, eventId: crypto.randomUUID() });
    setPending(null);
    if (ok) return;
    setThinking(false);
    flashMood('error');
    if (body === typed) setText(typed);
  }

  return <div className={s.inbox}>
    <h1 className="sr-only">Inbox</h1>
    <div className={s.window}>
      <section className={s.sidebar} aria-labelledby="sk-convos-title">
        <div className={s.lights} aria-hidden="true"><i /><i /><i /></div>
        <div className={s.section}><h2 id="sk-convos-title">Conversations</h2><span>{preview ? 1 : 0}</span></div>
        {preview ? <div className={s.item} aria-current="true">
          <span className={s.pair} aria-hidden="true"><span className={s.letter}>A</span><BotAvatar mood={mood} size={24} className={s.pairBot} /></span>
          <span className={s.itemText}>
            <span className={s.itemTop}><strong>{CUSTOMER}</strong><span className={s.tag}>Web chat</span></span>
            <span className={s.preview}>{preview}</span>
          </span>
        </div> : <p className={s.none}>No conversations yet.</p>}
      </section>

      <section className={s.chat} aria-label="Customer chat">
        <header className={s.head}>
          <div className={s.pill}><BotAvatar mood={mood} size={26} /><h2>{ASSISTANT}</h2><span className={s.tag}>Guided demo</span></div>
        </header>
        <div className={s.feed} ref={feed} role="log" aria-label="Messages">
          {shown.length === 0 && pending === null && <div className={s.empty}>
            <BotAvatar mood={mood} size={56} />
            <strong>{ASSISTANT}</strong>
            <span>Answers questions about sizes, stock and reservations. Replies are a guided demo.</span>
          </div>}
          {shown.map((m, i) => {
            const bot = side(m.sender) === 'bot';
            return <div key={m.id} className={cx(s.msg, s[side(m.sender)], i > 0 && side(shown[i - 1].sender) !== side(m.sender) && s.turn)}>
              {bot && <span className={s.face}>{m.id === face && <BotAvatar mood={mood} size={28} />}</span>}
              <div className={s.stack}>
                {LABEL[m.sender] && <span className={s.label}>{LABEL[m.sender]}</span>}
                <span className={s.bubble}>{m.id === streamId ? <TypeOut text={m.text} onDone={() => finishStream(m.id)} /> : m.text}</span>
              </div>
            </div>;
          })}
          {pending !== null && <div className={cx(s.msg, s.user, !!last && side(last.sender) === 'bot' && s.turn)}>
            <div className={s.stack}><span className={s.bubble}>{pending}</span></div>
          </div>}
          {thinking && <div className={cx(s.msg, s.bot, s.turn)} role="status">
            <span className={s.face}><BotAvatar mood={mood} size={28} /></span>
            <span className="sr-only">The sales assistant is replying</span>
            <span className={cx(s.bubble, s.typing)} aria-hidden="true"><TypingDots /></span>
          </div>}
        </div>
        <div className={s.compose}>
          {!sent && !thinking && !streamId && <button className={s.try} disabled={busy || state.paused} onClick={() => send(TRY_IT)}>Try it: “{TRY_IT}”</button>}
          <form className={s.bar} onSubmit={e => { e.preventDefault(); void send(text); }}>
            <label htmlFor="sk-reply" className="sr-only">Message as the customer</label>
            <input id="sk-reply" type="text" value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder={state.paused ? 'Workflow paused. Resume it from the store menu.' : 'Message as Alex Morgan…'} disabled={busy || state.paused} />
            <button className={s.send} aria-label="Send message" disabled={busy || state.paused || thinking || !!streamId || !text.trim()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg></button>
          </form>
        </div>
      </section>
    </div>

    <aside className="sk-inbox-side">
      <section className="sk-card sk-changed">
        <span className="sk-kicker">WHAT THIS CHANGED</span>
        {!sent && orders.length === 0 ? <p className="sk-muted-copy">Nothing yet. When Alex asks to buy, stock updates here the moment it happens.</p> : <div className="sk-changed-list">
          {held > 0 && <div className="sk-changed-row"><span className="sk-block reserved big" /><span><strong>{held} reserved for Alex</strong><small>Held for them until they pay</small></span></div>}
          {short > 0 && <div className="sk-changed-row"><span className="sk-block waiting big" /><span><strong>{short} short</strong><small>{short === 1 ? 'Logged as a waiting customer, not a sale' : 'Logged as waiting customers, not sales'}</small></span></div>}
          {held === 0 && short === 0 && orders.length === 0 && <p className="sk-muted-copy">No stock has changed from this conversation.</p>}
          {orders.length > 0 && <div className="sk-rule" />}
          {orders.map(o => <div className="sk-changed-order" key={o.id}>
            <span><strong>Alex’s order · {money(o.total)}</strong><small className={o.status === 'paid' ? 'paid' : 'unpaid'}>{o.status === 'paid' ? 'Paid in demo checkout' : 'Waiting on payment'}</small></span>
            {o.status === 'reserved' && <button className="sk-btn outline sm" disabled={busy} onClick={() => d.act({ type: 'complete_order', orderId: o.id }, 'Demo payment recorded. Stock updated.')}>Complete demo checkout</button>}
          </div>)}
        </div>}
      </section>

      <section className="sk-next">
        <span className="sk-kicker accent">NEXT STEP</span>
        {needRestock ? <>
          <strong>The {product.kind} needs a <em>restock.</em></strong>
          <span>{product.demand} {product.demand === 1 ? 'customer is' : 'customers are'} waiting. We’ve compared {state.quotes.length} suppliers for you.</span>
          <button className="sk-btn accent" disabled={busy} onClick={d.openSuppliers}>Review suggestion<Arrow size={16} /></button>
        </> : open ? <>
          <strong>The restock is <em>on its way.</em></strong>
          <span>{incoming} {unitName(product, incoming)} arrive {shortDate(arrival(d, open))}. Customers waiting can be told once it’s delivered.</span>
          <button className="sk-btn accent" onClick={() => d.go('suppliers')}>View order<Arrow size={16} /></button>
        </> : <>
          <strong>Stock is <em>healthy.</em></strong>
          <span>{product.demand ? `${product.demand} ${plural(product.demand, 'customer')} still waiting. ` : ''}Nothing needs restocking right now.</span>
          <button className="sk-btn accent" onClick={() => d.go('today')}>Back to Today<Arrow size={16} /></button>
        </>}
      </section>
    </aside>
  </div>;
}
