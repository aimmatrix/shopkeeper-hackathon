import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/types';
import type { Message } from '@/lib/types';
import { Arrow, type Dash, plural, shortDate, unitName } from './shared';
import { arrival, openPurchase } from './today';
import s from './inbox.module.css';

const CUSTOMER = 'Alex Morgan';
const ASSISTANT = 'Shopkeeper Sales Assistant';
const TRY_IT = 'Could I get two hoodies?';
/** The header names the sales assistant, so only other shop-side senders get a name above their bubble. */
const LABEL: Partial<Record<Message['sender'], string>> = { stock: 'Stock manager', merchant: 'You' };
const side = (sender: Message['sender']) => sender === 'customer' ? 'user' : 'bot';

/** GrokBot-style bot avatar: a soft blob with two eyes, in Shopkeeper yellow. */
function Blob({ size }: { size: number }) {
  return <svg className={s.blob} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <path d="M20.6 4.5c8.4 0 14.9 5.9 14.9 14.2 0 9.2-6.7 16.8-16 16.8-8.4 0-15-5.9-15-14.1C4.5 12.2 11.6 4.5 20.6 4.5Z" fill="#F8C642" />
    <ellipse cx="21.5" cy="19" rx="1.5" ry="2.6" fill="#141414" />
    <ellipse cx="27.5" cy="18.4" rx="1.5" ry="2.6" fill="#141414" />
  </svg>;
}

function Bubble({ sender, text, turn }: { sender: Message['sender']; text: string; turn: boolean }) {
  return <div className={[s.msg, s[side(sender)], turn && s.turn].filter(Boolean).join(' ')}>
    {LABEL[sender] && <span className={s.label}>{LABEL[sender]}</span>}
    <span className={s.bubble}>{text}</span>
  </div>;
}

export function InboxView(d: Dash) {
  const { state, product, busy, needRestock, incoming } = d;
  const [text, setText] = useState('');
  // The customer's message shows immediately while the reply is on its way.
  const [pending, setPending] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const messages = state.messages;
  const last = messages[messages.length - 1];
  const preview = pending ?? last?.text;
  const sent = messages.filter(m => m.sender === 'customer').length > 1;
  const orders = state.orders.filter(o => o.customer === CUSTOMER && o.productId === product.id);
  const held = orders.filter(o => o.status === 'reserved').reduce((n, o) => n + o.quantity, 0);
  // The deterministic sales reply states the shortfall ("We’re 1 short of your request").
  const shortMatch = [...messages].reverse().find(m => m.sender === 'sales' && /(\d+) short of your request/.test(m.text))?.text.match(/(\d+) short of your request/);
  const short = shortMatch ? Number(shortMatch[1]) : 0;
  const open = openPurchase(d);

  useEffect(() => { const el = feed.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, pending]);

  async function send(body: string) {
    if (!body.trim() || pending !== null) return;
    const typed = text;
    setPending(body);
    if (body === typed) setText('');
    const ok = await d.act({ type: 'customer_message', text: body, eventId: crypto.randomUUID() });
    setPending(null);
    if (!ok && body === typed) setText(typed);
  }

  return <div className={s.inbox}>
    <h1 className="sr-only">Inbox</h1>
    <div className={s.window}>
      <section className={s.sidebar} aria-labelledby="sk-convos-title">
        <div className={s.lights} aria-hidden="true"><i /><i /><i /></div>
        <div className={s.section}><h2 id="sk-convos-title">Conversations</h2><span>{preview ? 1 : 0}</span></div>
        {preview ? <div className={s.item} aria-current="true">
          <span className={s.pair} aria-hidden="true"><span className={s.letter}>A</span><Blob size={24} /></span>
          <span className={s.itemText}>
            <span className={s.itemTop}><strong>{CUSTOMER}</strong><span className={s.tag}>Web chat</span></span>
            <span className={s.preview}>{preview}</span>
          </span>
        </div> : <p className={s.none}>No conversations yet.</p>}
      </section>

      <section className={s.chat} aria-label="Customer chat">
        <header className={s.head}>
          <div className={s.pill}><Blob size={26} /><h2>{ASSISTANT}</h2><span className={s.tag}>Guided demo</span></div>
        </header>
        <div className={s.feed} ref={feed} role="log" aria-label="Messages">
          {messages.length === 0 && pending === null && <div className={s.empty}>
            <Blob size={56} />
            <strong>{ASSISTANT}</strong>
            <span>Answers questions about sizes, stock and reservations. Replies are a guided demo.</span>
          </div>}
          {messages.map((m, i) => <Bubble key={m.id} sender={m.sender} text={m.text} turn={i > 0 && side(messages[i - 1].sender) !== side(m.sender)} />)}
          {pending !== null && <>
            <Bubble sender="customer" text={pending} turn={!!last && side(last.sender) !== 'user'} />
            <div className={`${s.msg} ${s.bot} ${s.turn}`} role="status">
              <span className="sr-only">The sales assistant is replying</span>
              <span className={`${s.bubble} ${s.typing}`} aria-hidden="true"><i /><i /><i /></span>
            </div>
          </>}
        </div>
        <div className={s.compose}>
          {!sent && pending === null && <button className={s.try} disabled={busy || state.paused} onClick={() => send(TRY_IT)}>Try it: “{TRY_IT}”</button>}
          <form className={s.bar} onSubmit={e => { e.preventDefault(); void send(text); }}>
            <label htmlFor="sk-reply" className="sr-only">Message as the customer</label>
            <input id="sk-reply" type="text" value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder={state.paused ? 'Workflow paused. Resume it from the store menu.' : 'Message as Alex Morgan…'} disabled={busy || state.paused} />
            <button className={s.send} aria-label="Send message" disabled={busy || state.paused || !text.trim()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg></button>
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
