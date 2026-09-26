'use client';

import { useEffect, useRef, useState } from 'react';
import { money, type Product, type Quote, type Purchase } from '@/lib/types';
import { addDays, shortDate, variantLabel, type Dash } from './shared';
import type { Mood } from './bot-presence';
import { AGENTS, ChoiceList, EmailCard, type Face, GrokChat, GrokSidebar, GrokWindow, InvoiceCard, Msg, Note, PrimaryButton, ReactionBar, Recipients, StatusBar, Typing } from '../grok/grok-chat';

type Props = { d: Dash; product: Product; active: boolean; onOrdered: (purchase: Purchase) => void };
type Conversation = 'customer' | 'team' | 'waitlist';
const conversations: { id: Conversation; title: string; subtitle: string; icon: string }[] = [
  { id: 'customer', title: 'Alex Morgan', subtitle: 'Incoming customer message', icon: 'AM' },
  { id: 'team', title: 'Shopkeeper Ltd', subtitle: 'Your agents working together', icon: '✦' },
  { id: 'waitlist', title: 'Waitlist updates', subtitle: 'Individual customer messages', icon: '↗' },
];
const firstNames = ['Maya', 'Oliver', 'Sofia', 'Leo', 'Amelia', 'Noah', 'Isla', 'Ethan', 'Zara', 'Theo', 'Ava', 'Lucas', 'Freya', 'Arjun'];
const lastNames = ['Patel', 'Bennett', 'Chen', 'Williams', 'Ahmed', 'Clarke', 'Martin', 'Wilson', 'Reed', 'Taylor', 'Evans'];

/** All conversations, recipients, payments and reactions are simulated in this browser. */
export function DemoInbox({ d, product, active, onOrdered }: Props) {
  const existing = d.state.purchases.find(p => p.productId === product.id && ['ordered', 'cancellation_requested'].includes(p.status));
  const [stage, setStage] = useState(existing ? 12 : 0);
  const [conversation, setConversation] = useState<Conversation>(existing ? 'team' : 'customer');
  const [selected, setSelected] = useState<Quote | null>(() => d.state.quotes.find(q => q.id === existing?.quoteId) ?? null);
  const [snapshot] = useState(() => ({ ...product }));
  const [date, setDate] = useState(() => existing ? shortDate(addDays(new Date(existing.createdAt), d.state.quotes.find(q => q.id === existing.quoteId)?.leadDays ?? 0)) : '');
  const [purchase, setPurchase] = useState<Purchase | null>(existing ?? null);
  const [recipients] = useState(() => {
    // Fictional identities for the demo audience, generated once per conversation.
    const offset = Math.floor(Math.random() * lastNames.length);
    return ['Alex Morgan', ...Array.from({ length: 7 }, (_, i) => `${firstNames[(i + offset) % firstNames.length]} ${lastNames[(i * 3 + offset) % lastNames.length]}`)];
  });
  const typed = useRef(new Set<number>());
  function openChat(id: Conversation) {
    for (let i = 0; i <= stage; i++) typed.current.add(i);
    setConversation(id);
  }
  const locked = d.state.paused;
  // Replay the last-unit conversation before today’s stock was fully reserved.
  const free = 1;
  const requested = 3;
  const quantity = purchase?.quantity ?? Math.max(20, snapshot.demand, requested, selected?.minimum ?? 0);
  const total = purchase?.total ?? (selected ? quantity * selected.unitCost + selected.shipping : 0);
  const mood: Mood = locked ? 'paused' : stage >= 16 ? 'done' : [8, 9, 11, 13, 14].includes(stage) ? 'waiting' : 'thinking';
  const current = conversations.find(c => c.id === conversation)!;
  const latest: Conversation = stage >= 14 ? 'waitlist' : stage >= 6 ? 'team' : 'customer';

  useEffect(() => {
    if (!active || locked) return;
    const delays: Record<number, number> = { 0: 800, 1: 1600, 2: 2400, 3: 1300, 4: 2600, 5: 1500, 6: 2200, 7: 2000, 10: 3000, 12: 1800, 15: 1600, 16: 1300 };
    if (!(stage in delays)) return;
    const timer = setTimeout(() => {
      setStage(stage + 1);
      if (stage === 5) { for (let i = 0; i <= 5; i++) typed.current.add(i); setConversation('team'); }
    }, delays[stage]);
    return () => clearTimeout(timer);
  }, [stage, active, locked]);

  function pay() {
    if (!selected || purchase || locked) return;
    const createdAt = new Date().toISOString();
    const order: Purchase = { id: `demo-${crypto.randomUUID()}`, productId: product.id, quoteId: selected.id, quantity, total, createdAt, status: 'ordered' };
    setDate(shortDate(addDays(new Date(createdAt), selected.leadDays)));
    setPurchase(order); onOrdered(order); setStage(12);
  }
  function notify() { if (locked) return; setStage(14); openChat('waitlist'); }
  const bot = (role: keyof typeof AGENTS): Face => ({ kind: 'bot', bot: AGENTS[role] });
  const person = (name: string): Face => ({ kind: 'person', name });
  const faces: Record<Conversation, Face> = {
    customer: { kind: 'pair', name: 'Alex Morgan', bot: AGENTS.sales, mood: conversation === 'customer' ? mood : 'idle' },
    team: { kind: 'group', bots: [AGENTS.stock, AGENTS.outreach, AGENTS.purchasing], mood: conversation === 'team' ? mood : 'idle' },
    waitlist: { kind: 'bot', bot: AGENTS.care, mood: conversation === 'waitlist' ? mood : 'idle' },
  };
  const people = recipients.map((name, i) => ({ name, reaction: ['🙌', '👍', '😊', '❤️'][i % 4] }));
  const message = (id: number, role: keyof typeof AGENTS, text: string, outgoing = false, attachment?: React.ReactNode) =>
    <Msg key={id} side={outgoing ? 'out' : 'in'} author={AGENTS[role].name} face={bot(role)} type={!typed.current.has(id)} onTyped={() => typed.current.add(id)} attachment={attachment}>{text}</Msg>;
  // Disable the kit's action buttons while the merchant has paused the workflow.
  const approval = (content: React.ReactNode) => <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{content}</fieldset>;
  const sent = stage >= 16;
  const status = locked ? 'Workflow paused. Resume from the store menu.' : conversation !== latest ? 'The next step is in another conversation.' : stage >= 16 ? 'All done. Customers updated and restock on its way.' : [8, 9, 11, 13, 14].includes(stage) ? 'Ready for your approval above' : 'Your agents are working…';

  return <GrokWindow sidebar={<GrokSidebar title="North & Form" activeId={conversation} onSelect={id => openChat(id as Conversation)} footer="Simulated demo · You approve each send and payment."
    sections={conversations.map(c => ({ title: c.id === 'customer' ? 'Customers' : c.id === 'team' ? 'Team' : 'Outreach', items: [{ id: c.id, name: c.title, face: faces[c.id], preview: c.subtitle, tag: c.id === 'customer' ? 'Web chat' : c.id === 'team' ? 'Agents' : 'Email', locked: c.id === 'team' ? stage < 6 : c.id === 'waitlist' ? stage < 14 : false, unread: (stage === 5 && c.id === 'team') || (latest === c.id && conversation !== c.id) }] }))} />}>
    <GrokChat id={conversation} title={current.title} face={faces[conversation]} tag={conversation === 'customer' ? 'Web chat' : conversation === 'team' ? 'Internal' : 'Email'} footer={<StatusBar action={conversation !== latest ? <PrimaryButton onClick={() => openChat(latest)}>Go to {conversations.find(c => c.id === latest)?.title} →</PrimaryButton> : undefined}>{status}</StatusBar>}>
      {conversation === 'customer' && <>
        <Note>Earlier today · Incoming customer conversation · Demo replay</Note>
        {stage >= 1 && <Msg author="Alex Morgan" face={person('Alex Morgan')}>{`Hi! Can I get ${requested} of the ${product.name} in ${product.variant}, please?`}</Msg>}
        {stage >= 2 && message(2, 'sales', `Hi Alex! We have ${free} available right now. I can reserve that one for you and add the other ${requested - free} to the waitlist. Shall I?`, true)}
        {stage >= 3 && <Msg author="Alex Morgan" face={person('Alex Morgan')}>Yes please, go ahead! Let me know when they’re back 😊</Msg>}
        {stage >= 4 && message(4, 'sales', 'Done! One is reserved for you, and you’re on the waitlist for two more. We’ll message you as soon as we have a confirmed restock date.', true)}
        {stage >= 5 && <Note>Sales agent passed this to Shopkeeper Ltd</Note>}
        {stage === 0 && <Typing author="Alex Morgan" face={person('Alex Morgan')} />}
        {stage === 1 && <Typing author="Sales agent" side="out" face={bot('sales')} />}
        {stage === 2 && <Typing author="Alex Morgan" face={person('Alex Morgan')} />}
        {stage === 3 && <Typing author="Sales agent" side="out" face={bot('sales')} />}
      </>}
      {conversation === 'team' && <>
        <Note>Internal agent group · {product.name} · {variantLabel(product)}</Note>
        {message(6, 'stock', `We have ${snapshot.reserved} units reserved and ${snapshot.demand} more wanted for ${product.name}. Alex has confirmed their waitlist request. Let’s restock the exact item.`)}
        {stage >= 7 && message(7, 'sourcing', `I’m checking previous suppliers for ${product.name}, ${product.variant}, SKU ${product.sku}.`)}
        {stage >= 8 && message(8, 'sourcing', 'These suppliers match the item. Who should we use?', false,
          <ChoiceList label="Suppliers" selected={selected?.id} disabled={stage !== 8 || locked} onSelect={id => { const q = d.state.quotes.find(q => q.id === id); if (q && !locked) { setSelected(q); setStage(9); } }} choices={d.state.quotes.map(q => ({ id: q.id, title: q.supplier, badge: q.recommended ? 'Previous supplier' : undefined, price: `${money(q.unitCost)} / item`, meta: `${q.country} · ${q.leadDays} days`, detail: `Minimum ${q.minimum} · Exact match · Simulated search` }))} />)}
        {stage >= 9 && selected && message(9, 'outreach', `Here’s the order email for ${selected.supplier}. Send it when you’re happy.`, false, approval(
          <EmailCard to={`${selected.supplier} · Orders team`} subject={`Restock: ${quantity} × ${product.name}`} state={stage >= 10 ? 'sent' : 'draft'} onSend={() => { if (!locked && stage === 9) setStage(10); }} sendLabel="Send supplier email" sentLabel="Sent just now · demo" body={`Hi ${selected.supplier} team,\n\nWe’d like to order ${quantity} × ${product.name}, ${product.variant} (SKU ${product.sku}). Please confirm availability, the total price and delivery date, and send us an invoice.\n\nThanks,\nNorth & Form`} />))}
        {stage === 10 && <><Note>Email sent. Waiting for the supplier’s reply…</Note><Typing author={selected?.supplier} face={person(selected?.supplier ?? 'Supplier')} /></>}
        {stage >= 11 && selected && <Msg author={selected.supplier} face={person(selected.supplier)} attachment={approval(<InvoiceCard number="#2041" from={selected.supplier} state={stage >= 12 ? 'paid' : 'due'} onPay={pay} paidLabel="Payment successful · demo" due="Demo invoice" lines={[{ label: `${quantity} × ${product.name}`, amount: money(quantity * selected.unitCost) }, { label: 'Delivery', amount: money(selected.shipping) }]} total={money(total)} />)}>{`Yes, we can supply all ${quantity} in the exact specification. Delivery is ${date || shortDate(addDays(new Date(), selected.leadDays))}. Your invoice is attached.`}</Msg>}
        {stage >= 12 && message(12, 'purchasing', `Payment successful. ${quantity} items arrive ${date}. I’ve added them to incoming stock.`)}
        {stage >= 13 && message(13, 'care', 'We have a confirmed delivery date. Shall I tell the people on the waitlist?', false, <PrimaryButton disabled={locked} onClick={stage === 13 ? notify : () => openChat('waitlist')}>{stage === 13 ? 'Notify the waitlist →' : 'View customer updates →'}</PrimaryButton>)}
        {stage < 8 && <Typing author="Sourcing agent" face={bot('sourcing')} />}
      </>}
      {conversation === 'waitlist' && <>
        <Note>Individual emails · Fictional demo recipients</Note>
        {message(14, 'care', `Here’s the update for everyone waiting. I’ll email all ${people.length} of them.`, false, <>
          {approval(<EmailCard to={`${people.length} people on the waitlist`} subject={`Good news: your ${product.name} restock is on its way`} state={stage >= 15 ? 'sent' : 'draft'} onSend={() => { if (!locked && stage === 14) setStage(15); }} sendLabel={`Send to ${people.length} people`} sentLabel={sent ? `Delivered to ${people.length} people · demo` : 'Sending…'} body={`Hi {first name},\n\nGood news! The ${product.name} in ${product.variant} you asked about is on its way and is due on ${date}. You’re on our priority list, so we’ll message you as soon as it’s ready to order.\n\nThanks for waiting with us!\nNorth & Form`} />)}
          <Recipients people={people} sent={sent} />{sent && <ReactionBar people={people} />}
        </>)}
        {stage >= 17 && <><Msg author={recipients[1]} face={person(recipients[1])}>Great news, thanks for letting me know 😊</Msg><Note>Everyone notified · Restock on its way</Note></>}
      </>}
    </GrokChat>
  </GrokWindow>;
}
