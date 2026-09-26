import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, transition } from '../lib/engine';
import { recommendedOffer, offerError, rejectionReason } from '../lib/negotiation';

test('Grok suggests £17 for a larger order against the £18.50 quote', () => {
  assert.deepEqual(recommendedOffer(1850, 30), { quantity: 45, unitCost: 1700 });
  assert.equal(offerError(1500, 60, 1850, 30), '');
  for (const [price, quantity] of [[0, 60], [1850, 60], [1500.5, 60], [1500, 29], [1500, 501], [1500, 30.5], [NaN, 60]]) {
    assert.ok(offerError(price, quantity, 1850, 30));
  }
});

test('custom negotiated price persists with correct invoice total and original quote intact', () => {
  const state = transition(seed(), { type: 'prepare_proposal' });
  const action = { type: 'approve_purchase' as const, quoteId: 'porto', quantity: 60, negotiatedUnitCost: 1600, eventId: 'offer' };
  const after = transition(state, action);
  assert.equal(after.purchases[0].unitCost, 1600);
  assert.equal(after.purchases[0].quantity, 60);
  assert.equal(after.purchases[0].total, 99500);
  assert.equal(after.quotes.find(q => q.id === 'porto')?.unitCost, 1850);
  assert.equal(transition(after, action), after);
  for (const price of [0, -1, 1851, 1500.5, NaN, Infinity]) {
    assert.throws(() => transition(state, { ...action, negotiatedUnitCost: price }), /unit price/);
  }
});


test('supplier discounts depend on volume, and excessive requests are rejected', () => {
  assert.equal(rejectionReason({ unitCost: 1700, quantity: 45 }, 1850, 30), '');
  assert.match(rejectionReason({ unitCost: 1500, quantity: 60 }, 1850, 30), /maximum discount.*15%/);
  assert.match(rejectionReason({ unitCost: 1700, quantity: 30 }, 1850, 30), /maximum discount.*5%/);
  assert.match(rejectionReason({ unitCost: 1800, quantity: 91 }, 1850, 30), /cannot supply/);
  assert.match(rejectionReason({ unitCost: 1800, quantity: 29 }, 1850, 30), /smaller order/);
  assert.equal(rejectionReason({ unitCost: 1665, quantity: 45 }, 1850, 30), '');
  assert.ok(rejectionReason({ unitCost: 1664, quantity: 45 }, 1850, 30));
  for (const quantity of [20, 30, 334, 500]) {
    assert.equal(rejectionReason(recommendedOffer(1850, quantity), 1850, quantity), '');
  }
});

test('rejected discounts cannot be purchased, while the original offer remains usable', () => {
  const state = transition(seed(), { type: 'prepare_proposal' });
  assert.throws(() => transition(state, { type: 'approve_purchase', quoteId: 'porto', quantity: 60, negotiatedUnitCost: 1500, eventId: 'low' }), /Supplier declined/);
  assert.throws(() => transition(state, { type: 'approve_purchase', quoteId: 'porto', quantity: 100, negotiatedUnitCost: 1800, eventId: 'large' }), /cannot supply/);
  const after = transition(state, { type: 'approve_purchase', quoteId: 'porto', quantity: 30, eventId: 'original' });
  assert.equal(after.purchases[0].unitCost, 1850);
  assert.equal(after.purchases[0].quantity, 30);
  assert.equal(after.purchases[0].total, 59000);
});
