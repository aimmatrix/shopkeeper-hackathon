'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Mood } from '@/components/dashboard/bot-presence';
import { addDays, shortDate } from '@/components/dashboard/shared';
import {
  AGENTS, ChoiceList, EmailCard, type Face, GrokChat, GrokSidebar, GrokWindow, InvoiceCard, Msg, Note,
  PrimaryButton, ReactionBar, type Recipient, Recipients, StatusBar, Typing,
} from '@/components/grok/grok-chat';

/*
 * The whole demo story on sample data, to show how the kit fits together:
 * a customer asks → Shopkeeper Ltd restocks → the waitlist hears the good news.
 * Timings, copy and gates are suggestions for the real flow in the dashboard.
 */

type ChatId = 'alex' | 'team' | 'waitlist';
type Gate = 'pick' | 'send' | 'pay' | 'notify' | 'broadcast';
type Ctx = { choice: string | null; passed: Set<Gate>; act: (g: Gate) => void; pick: (id: string) => void };
type Step =
  | { kind: 'msg'; chat: ChatId; side?: 'in' | 'out'; author: string; face?: Face; delay: number; text: (c: Ctx) => string; type?: boolean; attach?: (c: Ctx) => ReactNode }
  | { kind: 'note'; chat: ChatId; delay: number; text: (c: Ctx) => string }
  | { kind: 'move'; to: ChatId; delay: number }
  | { kind: 'gate'; chat: ChatId; gate: Gate; hint: string };

const QUOTES = [
  { id: 'north', supplier: 'North Thread', place: 'Manchester', unit: 22, shipping: 12, minimum: 20, days: 3, email: 'orders@norththread.co.uk', badge: 'Best value' },
  { id: 'porto', supplier: 'Atelier Porto', place: 'Porto, Portugal', unit: 18.5, shipping: 35, minimum: 30, days: 8, email: 'hello@atelierporto.pt' },
  { id: 'east', supplier: 'East London Supply', place: 'London', unit: 25, shipping: 8, minimum: 10, days: 2, email: 'trade@eastlondonsupply.co.uk' },
];
const gbp = (n: number) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;
const order = (id: string | null) => {
  const q = QUOTES.find(x => x.id === id) ?? QUOTES[0];
  const units = Math.max(20, q.minimum);
  return { q, units, total: units * q.unit + q.shipping, arrives: shortDate(addDays(new Date(), q.days)) };
};

/** Twelve people already waiting, plus Alex from the first chat. */
const WAITLIST: Recipient[] = [
  { name: 'Alex Morgan', reaction: '🙌' }, { name: 'Priya Shah', reaction: '👍' }, { name: 'Tom Becker', reaction: '😊' },
  { name: 'Aisha Khan', reaction: '🎉' }, { name: 'Jamie Doyle' }, { name: 'Sofia Rossi', reaction: '❤️' },
  { name: 'Kwame Mensah', reaction: '👍' }, { name: 'Hannah Lewis', reaction: '😊' }, { name: 'Omar Farouk', reaction: '👍' },
  { name: 'Chloe Martin' }, { name: 'Liam O’Connor', reaction: '🎉' }, { name: 'Mei Chen', reaction: '👍' }, { name: 'Ben Carter', reaction: '😊' },
];

const alex: Face = { kind: 'person', name: 'Alex Morgan' };
const bot = (b: typeof AGENTS[keyof typeof AGENTS]): Face => ({ kind: 'bot', bot: b });

const STEPS: Step[] = [
  { kind: 'msg', chat: 'alex', author: 'Alex Morgan', face: alex, delay: 1100, text: () => 'Hi! Can I get the Everyday Hoodie in washed black, size M? I’d love 3 if you have them.' },
  { kind: 'msg', chat: 'alex', side: 'out', author: 'Sales agent', face: bot(AGENTS.sales), delay: 1500, type: true, text: () => 'Hi Alex! We’ve only got 1 in medium right now, and 12 people are already waiting for more. I can reserve that 1 for you and add you to the waitlist for the other 2. Shall I?' },
  { kind: 'msg', chat: 'alex', author: 'Alex Morgan', face: alex, delay: 2600, text: () => 'Yes please, go ahead!' },
  { kind: 'msg', chat: 'alex', side: 'out', author: 'Sales agent', face: bot(AGENTS.sales), delay: 1400, type: true, text: () => 'Done! 1 hoodie is reserved for you, and you’re on the waitlist for 2 more. We’ll email you the moment they’re back in stock.' },
  { kind: 'note', chat: 'alex', delay: 2000, text: () => 'Sales agent passed this to Shopkeeper Ltd' },
  { kind: 'move', to: 'team', delay: 1400 },

  { kind: 'msg', chat: 'team', author: 'Stock agent', face: bot(AGENTS.stock), delay: 1300, type: true,
    text: () => 'Heads up: 13 people are waiting for the Everyday Hoodie in washed black, M, and we have none left to sell. These suppliers can make the exact item. Who should we use?',
    attach: c => <ChoiceList label="Suppliers" selected={c.choice} disabled={c.passed.has('pick')} onSelect={id => { c.pick(id); c.act('pick'); }}
      choices={QUOTES.map(q => ({ id: q.id, title: q.supplier, badge: q.badge, price: `${gbp(q.unit)} / item`, meta: `${q.place} · ships in ${q.days} days`, detail: `Min ${q.minimum} · ${gbp(Math.max(20, q.minimum) * q.unit + q.shipping)} with shipping` }))} /> },
  { kind: 'gate', chat: 'team', gate: 'pick', hint: 'Pick a supplier above' },
  { kind: 'msg', chat: 'team', side: 'out', author: 'You', delay: 250, text: c => `Let’s go with ${order(c.choice).q.supplier}.` },
  { kind: 'msg', chat: 'team', author: 'Outreach agent', face: bot(AGENTS.outreach), delay: 1400, type: true,
    text: c => `Here’s the order email for ${order(c.choice).q.supplier}. Send it when you’re happy.`,
    attach: c => { const o = order(c.choice); return <EmailCard to={o.q.email} subject={`Order: ${o.units} × Everyday Hoodie (washed black, M)`} state={c.passed.has('send') ? 'sent' : 'draft'} onSend={() => c.act('send')} sentLabel="Sent just now"
      body={`Hi ${o.q.supplier} team,\n\nWe’d like to order ${o.units} Everyday Hoodies in washed black, size M (SKU EH-WB-M). Please confirm availability and your delivery date, and send over an invoice.\n\nThanks,\nNorth & Form`} />; } },
  { kind: 'gate', chat: 'team', gate: 'send', hint: 'Check the email, then send it' },
  { kind: 'note', chat: 'team', delay: 400, text: c => `Email sent to ${order(c.choice).q.supplier}` },
  { kind: 'msg', chat: 'team', author: 'Supplier', delay: 2400, face: { kind: 'person', name: 'North Thread' },
    text: c => { const o = order(c.choice); return `Thanks! We can do all ${o.units} in washed black, medium. They ship in ${o.q.days} days — invoice attached.`; },
    attach: c => { const o = order(c.choice); return <InvoiceCard number="#2041" from={o.q.supplier} state={c.passed.has('pay') ? 'paid' : 'due'} onPay={() => c.act('pay')} due="Due on receipt" paidLabel="Paid just now"
      lines={[{ label: `${o.units} × Everyday Hoodie`, amount: gbp(o.units * o.q.unit) }, { label: 'Shipping', amount: gbp(o.q.shipping) }]} total={gbp(o.total)} />; } },
  { kind: 'gate', chat: 'team', gate: 'pay', hint: 'Pay the invoice to confirm the order' },
  { kind: 'msg', chat: 'team', author: 'Purchasing agent', face: bot(AGENTS.purchasing), delay: 1300, type: true,
    text: c => { const o = order(c.choice); return `Paid ${gbp(o.total)}. ${o.units} hoodies arrive ${o.arrives}, and I’ve added them to incoming stock. Shall I tell the 13 people on the waitlist?`; },
    attach: c => <div><PrimaryButton disabled={c.passed.has('notify')} onClick={() => c.act('notify')}>Notify the waitlist →</PrimaryButton></div> },
  { kind: 'gate', chat: 'team', gate: 'notify', hint: 'Tell the waitlist the good news' },
  { kind: 'note', chat: 'team', delay: 300, text: () => 'Handed over to Waitlist update' },
  { kind: 'move', to: 'waitlist', delay: 1300 },

  { kind: 'msg', chat: 'waitlist', author: 'Customer care agent', face: bot(AGENTS.care), delay: 1300, type: true,
    text: () => 'Here’s the update for everyone waiting. I’ll email all 13 of them.',
    attach: c => { const o = order(c.choice); const sent = c.passed.has('broadcast'); return <>
      <EmailCard to="13 people on the waitlist" subject="Good news: the Everyday Hoodie is back" state={sent ? 'sent' : 'draft'} onSend={() => c.act('broadcast')} sendLabel="Send to 13 people" sentLabel="Sent to 13 people"
        body={`Hi {first name},\n\nGood news! The Everyday Hoodie in washed black (M) is back in stock on ${o.arrives}. You’re on our waitlist, so you get first pick: reply to this email and we’ll hold one for you.\n\nThanks for waiting,\nNorth & Form`} />
      <Recipients people={WAITLIST} sent={sent} />
      {sent && <ReactionBar people={WAITLIST} />}
    </>; } },
  { kind: 'gate', chat: 'waitlist', gate: 'broadcast', hint: 'Send the update to 13 people' },
  { kind: 'msg', chat: 'waitlist', author: 'Priya Shah', face: { kind: 'person', name: 'Priya Shah' }, delay: 3600, text: () => 'Yes!! Please hold one for me 🙌' },
  { kind: 'msg', chat: 'waitlist', author: 'Tom Becker', face: { kind: 'person', name: 'Tom Becker' }, delay: 1500, text: () => 'Great news, thanks for letting me know 😊' },
  { kind: 'note', chat: 'waitlist', delay: 900, text: () => 'All 13 people notified · restock on its way' },
];

const CHATS: Record<ChatId, { title: string; tag: string; section: string; face: Face; busy: string }> = {
  alex: { title: 'Alex Morgan', tag: 'Web chat', section: 'Customers', face: { kind: 'pair', name: 'Alex Morgan', bot: AGENTS.sales }, busy: 'Sales agent is chatting with Alex…' },
  team: { title: 'Shopkeeper Ltd', tag: '4 agents', section: 'Team', face: { kind: 'group', bots: [AGENTS.stock, AGENTS.outreach, AGENTS.purchasing] }, busy: 'The agents are working…' },
  waitlist: { title: 'Waitlist update', tag: 'Email', section: 'Outreach', face: { kind: 'bot', bot: AGENTS.care }, busy: 'Customer care agent is writing…' },
};
const ORDER: ChatId[] = ['alex', 'team', 'waitlist'];

export function Story() {
  const [run, setRun] = useState(0);
  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }}>
      <div><h1 style={{ fontSize: 26 }}>GrokBot chat kit</h1><p style={{ color: 'var(--sk-muted)', marginTop: 4 }}>Design preview on sample data. Nothing is sent or paid.</p></div>
      <button className="sk-btn outline sm" onClick={() => setRun(r => r + 1)}>Replay story</button>
    </div>
    <Run key={run} />
  </>;
}

function Run() {
  const [n, setN] = useState(0);
  const [typing, setTyping] = useState<number | null>(null);
  const [active, setActive] = useState<ChatId>('alex');
  const [unread, setUnread] = useState<ChatId | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [passed, setPassed] = useState<Set<Gate>>(new Set());
  const [typed, setTyped] = useState<Set<number>>(new Set()); // messages that have finished typing out
  const [seen, setSeen] = useState(0); // messages before this were on screen when the chat last changed: never retype them
  const open = (id: ChatId) => { setActive(id); setSeen(n); };
  const next = STEPS[n];
  const ctx: Ctx = { choice, passed, act: g => setPassed(p => new Set(p).add(g)), pick: setChoice };

  // Advance the story: gates wait for a click, everything else waits its delay (with typing shown near the end).
  useEffect(() => {
    if (!next) return;
    if (next.kind === 'gate') { if (passed.has(next.gate)) setN(n + 1); return; }
    if (next.kind === 'move') setUnread(next.to);
    const typer = next.kind === 'msg' && next.author !== 'You' ? window.setTimeout(() => setTyping(n), Math.max(0, next.delay - 900)) : 0;
    const timer = window.setTimeout(() => {
      setTyping(null);
      if (next.kind === 'move') { setActive(next.to); setSeen(n); setUnread(null); }
      setN(n + 1);
    }, next.delay);
    return () => { clearTimeout(typer); clearTimeout(timer); };
  }, [n, next, passed]);

  const reached = useMemo(() => new Set<ChatId>(['alex', ...STEPS.slice(0, n).flatMap(st => st.kind === 'move' ? [st.to] : [])]), [n]);
  const done = !next;
  const waitingOn = next?.kind === 'gate' ? next : null;
  const busyIn = next && next.kind !== 'gate' && next.kind !== 'move' ? next.chat : null;
  const moodOf = (id: ChatId): Mood => done && id === 'waitlist' ? 'done' : waitingOn?.chat === id ? 'waiting' : typing !== null && busyIn === id ? 'thinking' : 'idle';
  const withMood = (face: Face, mood: Mood): Face => face.kind === 'person' ? face : { ...face, mood };
  const lastText = (id: ChatId) => [...STEPS.slice(0, n)].reverse().flatMap(st => st.kind === 'msg' && st.chat === id ? [st.text(ctx)] : [])[0];

  const chat = CHATS[active];
  const pending = typing !== null ? STEPS[typing] : null;
  const status = done ? 'All done. The restock is on its way.'
    : waitingOn?.chat === active ? waitingOn.hint
    : busyIn === active ? chat.busy
    : waitingOn ? `Waiting for you in ${CHATS[waitingOn.chat].title}` : 'Working…';

  return <GrokWindow
    sidebar={<GrokSidebar title="North & Form" activeId={active} onSelect={id => open(id as ChatId)}
      footer="Simulated demo · You approve each send and payment."
      sections={ORDER.map(id => ({ title: CHATS[id].section, items: [{
        id, name: CHATS[id].title, tag: CHATS[id].tag, face: withMood(CHATS[id].face, moodOf(id)),
        preview: reached.has(id) ? lastText(id) ?? '…' : 'Not started yet', locked: !reached.has(id), unread: unread === id,
      }] }))} />}>
    <GrokChat id={active} title={chat.title} face={withMood(chat.face, moodOf(active))} tag={chat.tag}
      footer={<StatusBar action={waitingOn && waitingOn.chat !== active ? <PrimaryButton onClick={() => open(waitingOn.chat)}>Go to {CHATS[waitingOn.chat].title}</PrimaryButton> : undefined}>{status}</StatusBar>}>
      {STEPS.slice(0, n).map((st, i) => st.kind === 'msg' && st.chat === active
        ? <Msg key={i} side={st.side} author={st.author} face={st.face} type={st.type && i >= seen && !typed.has(i)} onTyped={() => setTyped(t => new Set(t).add(i))} attachment={st.attach?.(ctx)}>{st.text(ctx)}</Msg>
        : st.kind === 'note' && st.chat === active ? <Note key={i}>{st.text(ctx)}</Note> : null)}
      {pending?.kind === 'msg' && pending.chat === active && <Typing side={pending.side} face={pending.face} author={pending.author} />}
    </GrokChat>
  </GrokWindow>;
}
