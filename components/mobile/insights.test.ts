import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, transition } from '../../lib/engine';
import { approvalChange, assess, mostUrgent, openPurchase, quantityError, suggestedQuantity, totalCost } from './insights';

test('the seeded hoodie is the most urgent issue', () => {
  const urgent = mostUrgent(seed());
  assert.equal(urgent?.product.id, 'hoodie');
  assert.equal(urgent?.level, 'critical');
  assert.equal(urgent?.free, 1);
});

test('suggested quantity covers demand and lead-time sales, respecting MOQ', () => {
  const state = seed();
  const [north, porto, east] = state.quotes;
  assert.equal(suggestedQuantity(state.products[0], north), 23); // 12 + 4*3 - 1
  assert.equal(suggestedQuantity(state.products[0], porto), 43); // 12 + 4*8 - 1
  assert.equal(suggestedQuantity(state.products[0], east), 19);
  assert.equal(totalCost(north, 23), 23 * 2200 + 1200);
});

test('quantity validation mirrors the engine bounds', () => {
  const north = seed().quotes[0];
  assert.match(quantityError(north, '19'), /at least 20/);
  assert.match(quantityError(north, '2.5'), /whole number/);
  assert.match(quantityError(north, '501'), /500/);
  assert.equal(quantityError(north, '20'), '');
});

test('approval change keeps incoming separate from on-hand stock', () => {
  const before = transition(seed(), { type: 'prepare_proposal' });
  const after = transition(before, { type: 'approve_purchase', quoteId: 'north', quantity: 23, eventId: 'mobile-1' });
  const change = approvalChange(before, after, 'hoodie');
  assert.ok(change);
  assert.deepEqual(change.onHand, [8, 8]);
  assert.deepEqual(change.incoming, [0, 23]);
  assert.deepEqual(change.free, [1, 1]);
  assert.equal(change.purchase.total, 23 * 2200 + 1200);
  assert.equal(assess(after, after.products[0]).incoming, 23);
  assert.ok(openPurchase(after, 'hoodie'));
  // A replayed event changes nothing, so there is nothing new to report.
  assert.equal(approvalChange(after, transition(after, { type: 'approve_purchase', quoteId: 'north', quantity: 23, eventId: 'mobile-1' }), 'hoodie'), null);
});
