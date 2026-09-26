import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, transition } from '../lib/engine';
import { recoveryView } from '../lib/commerce/recovery';
import { authenticateWassist, stockRequestAction } from '../lib/commerce/wassist';
import { authorizeAction } from '../lib/store-access';
import type { Action } from '../lib/types';

const request: Action = { type: 'record_stock_request', channel: 'whatsapp', contactRef: 'a'.repeat(64), productId: 'hoodie', quantity: 2 };
function withRequest() { return transition(seed(), request); }
function draft(state = withRequest()) { return transition(state, { type: 'save_recovery_draft', requestId: state.stockRequests![0].id, text: 'Your interest is recorded. We cannot promise a date yet.', rationale: 'Two requested, only one available. Nothing is reserved.', eventId: 'draft-test-1' }); }

test('WhatsApp requests preserve stock and orders, recording only the shortage once', () => {
  const before = seed(), after = transition(before, request);
  assert.deepEqual(after.orders, before.orders);
  assert.equal(after.products[0].reserved, 7);
  assert.equal(after.products[0].demand, 13);
  assert.equal(transition(after, request), after);
  assert.equal(after.stockRequests?.length, 1);
  assert.equal(after.messages.length, before.messages.length);
});
test('distinct contacts stay separate and a changed retry cannot inflate demand', () => {
  const state = withRequest();
  assert.throws(() => transition(state, { ...request, quantity: 3 }), /already exists/);
  const next = transition(state, { ...request, contactRef: 'b'.repeat(64) });
  assert.equal(next.stockRequests?.length, 2);
  assert.equal(next.products[0].demand, 14);
});
test('stock request input bounds, catalogue variants and pause are enforced', () => {
  for (const quantity of [0, -1, 1.5, 11, '2']) assert.throws(() => transition(seed(), { ...request, quantity } as Action));
  assert.throws(() => transition(seed(), { ...request, productId: 'invented' }));
  assert.throws(() => transition(seed(), { ...request, contactRef: 'phone-number' }));
  assert.throws(() => transition(transition(seed(), { type: 'toggle_pause' }), request), /paused/);
});
test('recovery view excludes channel identity and incoming stock is not ready', () => {
  let state = withRequest();
  state = transition(state, { type: 'prepare_proposal' });
  state = transition(state, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: 'incoming' });
  const view = recoveryView(state).requests[0];
  assert.equal('contactRef' in view, false);
  assert.equal(view.available, 1); assert.equal(view.incoming, 20); assert.equal(view.ready, false);
  const received = transition(state, { type: 'receive_purchase', purchaseId: state.purchases[0].id });
  assert.equal(recoveryView(received).requests[0].ready, true);
});
test('drafts persist without sending and review requires sufficient, unchanged stock', () => {
  const state = draft();
  const id = state.stockRequests![0].id;
  assert.equal(state.stockRequests![0].draft?.source, 'handoff_page');
  assert.throws(() => transition(state, { type: 'review_recovery_draft', requestId: id }), /not available/);
  const restocked = structuredClone(state); restocked.products[0].onHand += 20;
  assert.throws(() => transition(restocked, { type: 'review_recovery_draft', requestId: id }), /Stock changed/);
  const fresh = transition(restocked, { type: 'save_recovery_draft', requestId: id, text: 'The requested variant is currently available. Nothing is reserved.', rationale: '21 available; request is for two.', eventId: 'draft-test-2' });
  const reviewed = transition(fresh, { type: 'review_recovery_draft', requestId: id });
  assert.ok(reviewed.stockRequests![0].draft?.reviewedAt);
  assert.deepEqual(reviewed.orders, state.orders);
  assert.deepEqual(reviewed.messages, state.messages);
  assert.equal(transition(reviewed, { type: 'review_recovery_draft', requestId: id }), reviewed);
});
test('draft replay is idempotent and reusing an event with changed text is rejected', () => {
  const state = withRequest();
  const action: Action = { type: 'save_recovery_draft', requestId: state.stockRequests![0].id, text: 'Draft', rationale: 'Reason', eventId: 'unique-draft' };
  const next = transition(state, action);
  assert.equal(transition(next, action), next);
  assert.throws(() => transition(next, { ...action, text: 'Changed' }), /different action/);
});
test('Wassist authentication fails closed and never accepts model-chosen contact identity', () => {
  const headers = { authorization: 'Bearer secret', 'x-wassist-contact-id': 'contact-123', 'x-wassist-conversation-id': 'conversation-123' };
  const req = new Request('https://demo.test', { headers });
  assert.throws(() => authenticateWassist(req, undefined), /not configured/);
  assert.throws(() => authenticateWassist(req, 'wrong'), /Unauthorized/);
  assert.throws(() => authenticateWassist(new Request('https://demo.test', { headers: { authorization: 'Bearer secret' } }), 'secret'), /conversation/);
  const ref = authenticateWassist(req, 'secret');
  assert.match(ref, /^[a-f0-9]{64}$/);
  assert.equal(ref.includes('contact-123'), false);
  const action = stockRequestAction({ productId: 'hoodie', quantity: 2, consent: true, contactRef: 'attacker', channel: 'demo' }, ref);
  assert.equal(action.contactRef, ref); assert.equal(action.channel, 'whatsapp');
  assert.throws(() => stockRequestAction({ productId: 'hoodie', quantity: 2 }, ref), /permission/);
  assert.throws(() => stockRequestAction({ productId: 'hoodie', quantity: '2', consent: true }, ref), /catalogue/);
});
test('generic store API cannot impersonate the WhatsApp intake route', () => {
  const result = authorizeAction({ sameOrigin: true, agent: false }, 'client', request);
  assert.equal(result.ok, false);
});
