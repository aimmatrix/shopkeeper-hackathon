import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/types';
import type { Message } from '@/lib/types';
import { Arrow, type Dash, clock, plural, shortDate, unitName, variantLabel } from './shared';
import { arrival, openPurchase } from './today';

const CUSTOMER = 'Alex Morgan';
const TRY_IT = 'Could I get two hoodies?';
const who = (m: Message) => m.sender === 'customer' ? CUSTOMER : m.sender === 'sales' ? 'Sales assistant' : m.sender === 'stock' ? 'Stock manager' : 'You';

export function InboxView(d: Dash) {
  const { state, product, busy, needRestock, incoming } = d;
  const [text, setText] = useState('');
  const feed = useRef<HTMLDivElement>(null);
  const messages = state.messages;
  const last = messages[messages.length - 1];
  const sent = messages.filter(m => m.sender === 'customer').length > 1;
  const orders = state.orders.filter(o => o.customer === CUSTOMER && o.productId === product.id);
  const held = orders.filter(o => o.status === 'reserved').reduce((s, o) => s + o.quantity, 0);
  // The deterministic sales reply states the shortfall ("We’re 1 short of your request").
  const shortMatch = [...messages].reverse().find(m => m.sender === 'sales' && /(\d+) short of your request/.test(m.text))?.text.match(/(\d+) short of your request/);
  const short = shortMatch ? Number(shortMatch[1]) : 0;
  const open = openPurchase(d);

  useEffect(() => { const el = feed.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);

  async function send(body: string) {
    if (!body.trim()) return;
    if (await d.act({ type: 'customer_message', text: body, eventId: crypto.randomUUID() })) setText('');
  }

  return <div className="sk-inbox">
    <h1 className="sr-only">Inbox</h1>
    <section className="sk-card sk-convos">
      <div className="sk-convos-head"><h2>Conversations</h2><span>{messages.length ? '1 OPEN' : '0 OPEN'}</span></div>
      {last ? <div className="sk-convo" aria-current="true">
        <span className="sk-avatar">AM</span>
        <span className="sk-convo-text">
          <span><strong>{CUSTOMER}</strong><time dateTime={last.at}>{clock(last.at)}</time></span>
          <small>Web chat · demo</small>
          <span className="sk-convo-preview">{last.text}</span>
        </span>
      </div> : <p className="sk-empty">No customer messages yet.</p>}
    </section>

    <section className="sk-card sk-chat">
      <div className="sk-chat-head">
        <div><strong>{CUSTOMER}</strong><span>Asking about {product.name} · {variantLabel(product)}</span></div>
        <span className="sk-chip grey">GUIDED DEMO REPLIES</span>
      </div>
      <div className="sk-chat-feed" ref={feed}>
        {messages.length === 0 && <p className="sk-empty">No customer messages yet.</p>}
        {messages.map(m => <div key={m.id} className={`sk-msg ${m.sender === 'customer' ? 'in' : 'out'}`}>
          <span className="sk-msg-who">{who(m)}</span>
          <span className="sk-msg-bubble">{m.text}</span>
        </div>)}
      </div>
      <div className="sk-compose">
        {!sent && <button className="sk-try" disabled={busy || state.paused} onClick={() => send(TRY_IT)}>Try it: “{TRY_IT}”</button>}
        <form onSubmit={e => { e.preventDefault(); void send(text); }}>
          <label htmlFor="sk-reply" className="sr-only">Message as the customer</label>
          <input id="sk-reply" type="text" value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder={state.paused ? 'Workflow paused. Resume it from the store menu.' : 'Write as the customer…'} disabled={busy || state.paused} />
          <button aria-label="Send message" disabled={busy || state.paused || !text.trim()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg></button>
        </form>
      </div>
    </section>

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
