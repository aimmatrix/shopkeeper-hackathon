'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { BotAvatar, type Mood, type Shape, TypeOut, TypingDots } from '../dashboard/bot-presence';
import s from './grok-chat.module.css';

/*
 * GrokBot-style chat kit: presentational pieces only. The demo flow (what is said, when, and what each
 * button does) lives with the caller. See app/design/grokbot/page.tsx for the whole story wired up.
 */

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

export type Bot = { name: string; shape: Shape; color: string };

/** Shopkeeper's agents. Each keeps one face across every chat, the way GrokBot bots do. */
export const AGENTS = {
  sales: { name: 'Sales agent', shape: 'blob', color: '#F8C642' },
  stock: { name: 'Stock agent', shape: 'hexagon', color: '#8E8E8E' },
  sourcing: { name: 'Sourcing agent', shape: 'cloud', color: '#7B4FE0' },
  outreach: { name: 'Outreach agent', shape: 'triangle', color: '#FF6B00' },
  purchasing: { name: 'Purchasing agent', shape: 'pill', color: '#2F9BFF' },
  care: { name: 'Customer care agent', shape: 'cloud', color: '#E0368C' },
} satisfies Record<string, Bot>;

export type Face =
  | { kind: 'bot'; bot: Bot; mood?: Mood }
  | { kind: 'person'; name: string }
  | { kind: 'pair'; name: string; bot: Bot; mood?: Mood } // a customer talking to one bot
  | { kind: 'group'; bots: Bot[]; mood?: Mood };          // the agents' group chat

const PERSON_COLORS = ['#3A3A3A', '#4B3F72', '#1F4E5F', '#5A3E36', '#2E4A3F', '#5B2C4A', '#3F4A5C'];
const initials = (name: string) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const personColor = (name: string) => PERSON_COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PERSON_COLORS.length];

function Person({ name, size, className }: { name: string; size: number; className?: string }) {
  return <span className={cx(s.person, className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: personColor(name) }}>{initials(name)}</span>;
}

export function GrokFace({ face, size = 44 }: { face: Face; size?: number }) {
  if (face.kind === 'bot') return <BotAvatar shape={face.bot.shape} color={face.bot.color} mood={face.mood} size={size} />;
  if (face.kind === 'person') return <Person name={face.name} size={size} />;
  const box = { width: size, height: size } satisfies CSSProperties;
  if (face.kind === 'pair') return <span className={s.stackFace} style={box} aria-hidden="true">
    <Person name={face.name} size={Math.round(size * 0.72)} className={s.pairPerson} />
    <BotAvatar shape={face.bot.shape} color={face.bot.color} mood={face.mood} size={Math.round(size * 0.56)} className={s.pairBot} />
  </span>;
  const small = Math.round(size * 0.58);
  return <span className={s.stackFace} style={box} aria-hidden="true">
    {face.bots.slice(0, 3).map((bot, i) => <BotAvatar key={bot.name} shape={bot.shape} color={bot.color} mood={face.mood} size={small} className={s[`group${i}`]} />)}
  </span>;
}

/** The dark GrokBot window: a chat list on the left and the open chat on the right. */
export function GrokWindow({ sidebar, children, className }: { sidebar: ReactNode; children: ReactNode; className?: string }) {
  return <div className={cx(s.window, className)}>{sidebar}<section className={s.pane}>{children}</section></div>;
}

export type ChatItem = {
  id: string; name: string; face: Face; preview?: string; tag?: string;
  unread?: boolean; // blue dot, pulsing — use it just before the story moves into this chat
  locked?: boolean; // not reached yet in the story: greyed out, not clickable
};

export function GrokSidebar({ title, sections, activeId, onSelect, footer }: {
  title: string; sections: { title: string; items: ChatItem[] }[]; activeId: string; onSelect?: (id: string) => void; footer?: ReactNode;
}) {
  const count = sections.reduce((n, sec) => n + sec.items.length, 0);
  return <nav className={s.sidebar} aria-label="Chats">
    <div className={s.lights} aria-hidden="true"><i /><i /><i /></div>
    <div className={s.workspace}><span>{title}</span><span>{count}</span></div>
    {sections.map(sec => <div key={sec.title} className={s.section}>
      <h3>{sec.title}</h3>
      {sec.items.map(item => {
        const active = item.id === activeId;
        const body = <>
          <GrokFace face={item.face} size={44} />
          <span className={s.itemText}>
            <span className={s.itemTop}><strong>{item.name}</strong>{item.tag && <span className={s.tag}>{item.tag}</span>}</span>
            {item.preview && <span className={s.preview}>{item.preview}</span>}
          </span>
          {item.unread && !active && <span className={s.unread}><span className="sr-only">New activity</span></span>}
        </>;
        return onSelect && !item.locked
          ? <button key={item.id} className={cx(s.item, active && s.active)} aria-current={active || undefined} onClick={() => onSelect(item.id)}>{body}</button>
          : <div key={item.id} className={cx(s.item, active && s.active, item.locked && s.locked)} aria-current={active || undefined}>{body}</div>;
      })}
    </div>)}
    {footer && <p className={s.sideFooter}>{footer}</p>}
  </nav>;
}

/**
 * One open chat: floating header pill, a scrolling log that stays pinned to the newest message,
 * and an optional footer. Changing `id` slides the new chat in.
 */
export function GrokChat({ id, title, face, tag, children, footer }: {
  id: string; title: string; face: Face; tag?: string; children: ReactNode; footer?: ReactNode;
}) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    let pinned = true;
    el.scrollTop = el.scrollHeight;
    const onScroll = () => { pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 90; };
    const follow = new MutationObserver(() => { if (pinned) el.scrollTop = el.scrollHeight; });
    el.addEventListener('scroll', onScroll, { passive: true });
    follow.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { el.removeEventListener('scroll', onScroll); follow.disconnect(); };
  }, [id]);

  return <div key={id} className={s.chat}>
    <header className={s.head}>
      <div className={s.pill}><GrokFace face={face} size={26} /><h2>{title}</h2>{tag && <span className={s.tag}>{tag}</span>}</div>
    </header>
    <div className={s.log} ref={log} role="log" aria-label={title}>{children}</div>
    {footer && <div className={s.footer}>{footer}</div>}
  </div>;
}

/**
 * A message. `in` sits on the left (customers, suppliers, agents talking to you); `out` sits on the right
 * (you, or your sales agent answering a customer). `type` makes a string message type itself out.
 * `attachment` goes under the bubble: supplier choices, an email, an invoice…
 */
export function Msg({ side = 'in', author, face, tag, type = false, onTyped, attachment, children }: {
  side?: 'in' | 'out'; author?: string; face?: Face; tag?: string; type?: boolean; onTyped?: () => void; attachment?: ReactNode; children?: ReactNode;
}) {
  return <div className={cx(s.msg, s[side])}>
    {face && <span className={s.face}><GrokFace face={face} size={28} /></span>}
    <div className={cx(s.stack, !!attachment && s.wide)}>
      {author && <span className={s.author}>{author}{tag && <span className={s.tag}>{tag}</span>}</span>}
      {children != null && <div className={s.bubble}>{type && typeof children === 'string' ? <TypeOut text={children} onDone={onTyped} /> : children}</div>}
      {attachment}
    </div>
  </div>;
}

/** Someone is writing. Bots show their thinking shape; people get the plain dots. */
export function Typing({ side = 'in', face, author }: { side?: 'in' | 'out'; face?: Face; author?: string }) {
  const thinking: Face | undefined = face && face.kind !== 'person' ? { ...face, mood: 'thinking' } : face;
  return <div className={cx(s.msg, s[side])} role="status">
    {thinking && <span className={s.face}><GrokFace face={thinking} size={28} /></span>}
    <div className={s.stack}>
      {author && <span className={s.author}>{author}</span>}
      <span className="sr-only">{author ?? 'Someone'} is typing</span>
      <span className={cx(s.bubble, s.dots)} aria-hidden="true"><TypingDots /></span>
    </div>
  </div>;
}

/** A quiet line across the chat: "Alex joined the waitlist", "Handed over to Shopkeeper Ltd". */
export function Note({ children }: { children: ReactNode }) {
  return <p className={s.note}>{children}</p>;
}

/** GrokBot's white pill button — the one primary action on screen. */
export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button className={s.primary} onClick={onClick} disabled={disabled}>{children}</button>;
}

/** Sits where GrokBot's message box would be: what's happening now, plus the next action if it's yours. */
export function StatusBar({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className={s.status}><span>{children}</span>{action}</div>;
}

export type Choice = { id: string; title: string; price: string; meta: string; detail?: string; badge?: string };

export function ChoiceList({ choices, selected, onSelect, disabled, label }: {
  choices: Choice[]; selected?: string | null; onSelect?: (id: string) => void; disabled?: boolean; label: string;
}) {
  return <div className={s.choices} role="group" aria-label={label}>
    {choices.map(c => <button key={c.id} className={cx(s.choice, selected === c.id && s.picked)} aria-pressed={selected === c.id} disabled={disabled} onClick={() => onSelect?.(c.id)}>
      <span className={s.choiceText}>
        <strong>{c.title}{c.badge && <span className={cx(s.tag, s.good)}>{c.badge}</span>}</strong>
        <span>{c.meta}</span>
        {c.detail && <small>{c.detail}</small>}
      </span>
      <span className={s.price}>{c.price}</span>
      <span className={s.check} aria-hidden="true" />
    </button>)}
  </div>;
}

function Sent({ children }: { children: ReactNode }) {
  return <span className={s.sent}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{children}</span>;
}

/** An email, drafted by an agent. Draft → the merchant sends it → it shows as sent. */
export function EmailCard({ to, subject, body, state = 'draft', onSend, sendLabel = 'Send email', sentLabel = 'Sent' }: {
  to: string; subject: string; body: string; state?: 'draft' | 'sent'; onSend?: () => void; sendLabel?: string; sentLabel?: string;
}) {
  return <div className={cx(s.card, state === 'sent' && s.done)}>
    <dl className={s.mailHead}><dt>To</dt><dd>{to}</dd><dt>Subject</dt><dd>{subject}</dd></dl>
    <p className={s.mailBody}>{body}</p>
    <div className={s.cardFoot}>{state === 'sent' ? <Sent>{sentLabel}</Sent> : <PrimaryButton onClick={onSend}>{sendLabel}</PrimaryButton>}</div>
  </div>;
}

export function InvoiceCard({ number, from, lines, total, due, state = 'due', onPay, paidLabel = 'Paid' }: {
  number: string; from: string; lines: { label: string; amount: string }[]; total: string; due?: string; state?: 'due' | 'paid'; onPay?: () => void; paidLabel?: string;
}) {
  return <div className={cx(s.card, state === 'paid' && s.done)}>
    <div className={s.invoiceHead}><strong>Invoice {number}</strong><span>{from}</span></div>
    <dl className={s.lines}>
      {lines.map(l => <div key={l.label}><dt>{l.label}</dt><dd>{l.amount}</dd></div>)}
      <div className={s.total}><dt>Total</dt><dd>{total}</dd></div>
    </dl>
    <div className={s.cardFoot}>
      {due && state === 'due' && <small>{due}</small>}
      {state === 'paid' ? <Sent>{paidLabel}</Sent> : <PrimaryButton onClick={onPay}>Pay {total}</PrimaryButton>}
    </div>
  </div>;
}

export type Recipient = { name: string; reaction?: string };

/**
 * Everyone a broadcast goes to. Once `sent`, each row ticks to delivered and reactions pop in one after
 * another — all CSS, so it plays the same every time and needs no timers.
 */
export function Recipients({ people, sent }: { people: Recipient[]; sent: boolean }) {
  return <ul className={cx(s.recipients, sent && s.isSent)} aria-label={`${people.length} people on the waitlist`}>
    {people.map((p, i) => <li key={p.name} style={{ '--i': i } as CSSProperties}>
      <Person name={p.name} size={28} />
      <span className={s.rName}>{p.name}</span>
      <span className={s.rState}>{sent ? <Sent>Delivered</Sent> : 'Waiting'}</span>
      {sent && p.reaction && <span className={s.reaction} role="img" aria-label={`Reacted ${p.reaction}`}>{p.reaction}</span>}
    </li>)}
  </ul>;
}

/** Reaction totals under a sent message, popping in after the per-person reactions. */
export function ReactionBar({ people }: { people: Recipient[] }) {
  const counts = new Map<string, number>();
  people.forEach(p => { if (p.reaction) counts.set(p.reaction, (counts.get(p.reaction) ?? 0) + 1); });
  return <div className={s.reactionBar}>
    {[...counts].map(([emoji, n], i) => <span key={emoji} style={{ '--i': people.length + i } as CSSProperties}><span role="img" aria-hidden="true">{emoji}</span>{n}</span>)}
  </div>;
}
