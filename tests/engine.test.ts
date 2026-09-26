import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, transition } from '../lib/engine';
import { available } from '../lib/types';

test('reserves only available stock and records shortage separately from sales', () => {
  const next = transition(seed(), { type: 'customer_message', text: 'Can I get two medium black hoodies?', eventId: 'customer-1' });
  assert.equal(available(next.products[0]), 0);
  assert.equal(next.products[0].onHand, 8);
  assert.equal(next.products[0].demand, 13);
  assert.equal(next.orders.find(o => o.customer === 'Alex Morgan')!.quantity, 1);
  assert.equal(next.orders.find(o => o.customer === 'Alex Morgan')!.status, 'reserved');
  assert.equal(next.orders.find(o => o.customer === 'Alex Morgan')!.total, 6800);
});
test('retrying a customer event does not reserve or count demand twice', () => {
  const action = { type: 'customer_message' as const, text: 'Reserve two hoodies', eventId: 'event-1' };
  const once = transition(seed(), action);
  assert.deepEqual(transition(once, action), once);
});
test('quote MOQ is enforced and shipping is included', () => {
  const state = transition(seed(), { type: 'prepare_proposal' });
  assert.throws(() => transition(state, { type: 'approve_purchase', quoteId: 'north', quantity: 10, eventId: 'p1' }), /between 20/);
  const ordered = transition(state, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: 'p2' });
  assert.equal(ordered.purchases[0].total, 45200);
  assert.equal(ordered.products[0].onHand, state.products[0].onHand);
  assert.throws(() => transition(ordered, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: 'p3' }), /already an incoming/);
});
test('cancel requires a supplier confirmation and cannot be received afterwards', () => {
  const prepared = transition(seed(), { type: 'prepare_proposal' });
  const ordered = transition(prepared, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: 'p1' });
  const id = ordered.purchases[0].id;
  assert.throws(() => transition(ordered, { type: 'confirm_cancel', purchaseId: id }), /Request cancellation/);
  const requested = transition(ordered, { type: 'request_cancel', purchaseId: id });
  assert.equal(requested.purchases[0].status, 'cancellation_requested');
  const cancelled = transition(requested, { type: 'confirm_cancel', purchaseId: id });
  assert.equal(cancelled.purchases[0].status, 'cancelled');
  assert.throws(() => transition(cancelled, { type: 'receive_purchase', purchaseId: id }), /cancelled/);
});
test('receiving stock and completing payment are idempotent', () => {
  let s = transition(seed(), { type: 'prepare_proposal' });
  s = transition(s, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: 'p1' });
  const receive = { type: 'receive_purchase' as const, purchaseId: s.purchases[0].id };
  s = transition(s, receive);
  assert.equal(s.products[0].onHand, 28);
  assert.deepEqual(transition(s, receive), s);
  s = transition(s, { type: 'customer_message', text: 'Reserve two hoodies', eventId: 'c1' });
  const pay = { type: 'complete_order' as const, orderId: s.orders.find(o => o.customer === 'Alex Morgan')!.id };
  s = transition(s, pay);
  assert.equal(s.products[0].onHand, 26);
  assert.equal(s.products[0].reserved, 7);
  assert.deepEqual(transition(s, pay), s);
});
test('unknown variants do not create wrong orders', () => {
  const s = transition(seed(), { type: 'customer_message', text: 'I want two large white hoodies', eventId: 'c1' });
  assert.equal(s.orders.filter(o => o.customer === 'Alex Morgan').length, 0);
  assert.equal(s.products[0].reserved, 7);
});
