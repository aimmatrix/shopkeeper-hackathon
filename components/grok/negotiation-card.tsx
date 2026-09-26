'use client';

import { useEffect, useState } from 'react';
import { money } from '@/lib/types';
import { offerError, recommendedOffer, rejectionReason, type NegotiatedTerms } from '@/lib/negotiation';
import { AGENTS, Msg, Note, PrimaryButton, Typing } from './grok-chat';
import s from './negotiation-card.module.css';

export function NegotiationCard({ supplier, unitCost, quantity, minimum, shipping, disabled, sent, onSend, agreed, rejected, onReject, onAgree, children }: {
  supplier: string; unitCost: number; quantity: number; minimum: number; shipping: number; disabled?: boolean;
  sent: NegotiatedTerms | null; onSend: (terms: NegotiatedTerms) => void;
  rejected?: string | null; onReject: (reason: string) => void;
  agreed?: NegotiatedTerms | null; onAgree: (terms: NegotiatedTerms) => void; children: React.ReactNode;
}) {
  const suggestion = recommendedOffer(unitCost, quantity);
  const [open, setOpen] = useState(false);
  const [replyTyped, setReplyTyped] = useState(Boolean(agreed || rejected));
  const pending = Boolean(sent && !agreed && !rejected);

  useEffect(() => {
    if (!sent || !pending || disabled) return;
    const timer = setTimeout(() => {
      const reason = rejectionReason(sent, unitCost, quantity);
      if (reason) onReject(reason); else onAgree(sent);
    }, 2600);
    return () => clearTimeout(timer);
  }, [sent, pending, disabled, unitCost, quantity, onReject, onAgree]);
  const [price, setPrice] = useState((suggestion.unitCost / 100).toFixed(2));
  const [units, setUnits] = useState(String(suggestion.quantity));
  const cost = /^\d+(\.\d{1,2})?$/.test(price) ? Math.round(Number(price) * 100) : NaN;
  const count = units.trim() ? Number(units) : NaN;
  const error = offerError(cost, count, unitCost, minimum);
  const recommended = cost === suggestion.unitCost && count === suggestion.quantity;
  return <div>
    {sent && <div className={s.exchange}>
      <Msg side="out" author="Outreach agent" face={{ kind: 'bot', bot: AGENTS.outreach }} tag="Sent · demo">{`Hi ${supplier}, could we renegotiate to ${sent.quantity} units at ${money(sent.unitCost)} per unit instead of ${money(unitCost)}? Please confirm whether you can approve these terms.`}</Msg>
      {pending && <><Note>Renegotiation sent · {disabled ? 'Waiting for the workflow to resume' : 'Waiting for supplier approval'}</Note>{!disabled && <Typing author={supplier} face={{ kind: 'person', name: supplier }} />}</>}
      {(agreed || rejected) && <Msg author={supplier} face={{ kind: 'person', name: supplier }} tag="Simulated reply" type={!replyTyped} onTyped={() => setReplyTyped(true)}>{agreed
        ? `Okay, we’ve approved your renegotiation: ${agreed.quantity} units at ${money(agreed.unitCost)} per unit. Shipping stays ${money(shipping)}. Your revised invoice is below.`
        : `We haven’t approved your renegotiation. ${rejected} Our original offer is final: ${quantity} units at ${money(unitCost)} per unit, plus ${money(shipping)} shipping. You can proceed with the original invoice below.`}</Msg>}
      {agreed && replyTyped && <Note>Saving {money((unitCost - agreed.unitCost) * agreed.quantity)} against the original unit price for this quantity.</Note>}
    </div>}
    {!sent && !agreed && !rejected && !disabled && <div className={s.panel}>
      {!open ? <><p>Want a better price? GrokBot can ask for a volume discount.</p><PrimaryButton onClick={() => setOpen(true)}>Negotiate price</PrimaryButton></> : <>
        <strong>Negotiate with {supplier}</strong>
        <p>Original quote: {money(unitCost)} per unit for {quantity} units.</p>
        <div className={s.recommendation}><strong>GrokBot recommends {money(suggestion.unitCost)} per unit</strong><p>Offer {suggestion.quantity} units to ask for a volume discount. This is a demo suggestion; acceptance is simulated.</p><button type="button" className={s.secondary} onClick={() => { setPrice((suggestion.unitCost / 100).toFixed(2)); setUnits(String(suggestion.quantity)); }}>Use GrokBot recommendation</button></div>
        <div className={s.fields}><label>Order quantity<input type="number" min={minimum} max={500} step="1" value={units} onChange={e => setUnits(e.target.value)} /></label><label>Your price per unit (£)<input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></label></div>
        {error ? <p role="alert">{error}</p> : <><p className={s.preview}>“{count > quantity ? `What if we increase the order to ${count}` : `Can we order ${count}`} units at {money(cost)} per unit instead of {money(unitCost)}?”</p><p>{recommended ? 'GrokBot recommendation' : 'Your custom offer'} · {money(cost * count + shipping)} including shipping</p></>}
        <p>One counteroffer only. If the supplier declines, the original price and quantity are final.</p>
        <div className={s.actions}><PrimaryButton disabled={!!error} onClick={() => { if (!error && !disabled && !sent) { onSend({ quantity: count, unitCost: cost }); setReplyTyped(false); setOpen(false); } }}>Send counteroffer · demo</PrimaryButton><button className={s.secondary} onClick={() => setOpen(false)}>Keep original quote</button></div>
      </>}
    </div>}
    {!pending && (!sent || replyTyped) && (!open || agreed || rejected || disabled) && children}
  </div>;
}
