import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerCatalogue } from '../lib/commerce/catalogue';
import { seed, transition } from '../lib/engine';

test('customer catalogue exposes current availability without private commerce records', () => {
  const state = seed();
  const result = customerCatalogue(state);
  assert.equal(result.products.find(p => p.id === 'hoodie')?.available, 1);
  assert.equal(result.products.find(p => p.id === 'hoodie')?.pricePence, 6800);
  for (const key of ['orders', 'messages', 'quotes', 'processedEvents', 'eventFingerprints', 'agentReport']) assert.equal(key in result, false);
  for (const p of result.products) for (const key of ['cost', 'reserved', 'demand', 'customer']) assert.equal(key in p, false);
});
test('incoming stock does not change customer-facing availability', () => {
  const before = transition(seed(), {type:'prepare_proposal'});
  const incoming = transition(before, {type:'approve_purchase',quoteId:'north',quantity:20,eventId:'catalogue-order'});
  assert.equal(customerCatalogue(incoming).products.find(p => p.id === 'hoodie')?.available, 1);
  const received = transition(incoming, {type:'receive_purchase',purchaseId:incoming.purchases[0].id});
  assert.equal(customerCatalogue(received).products.find(p => p.id === 'hoodie')?.available, 21);
});
test('pausing the workflow disables catalogue reservation eligibility', () => {
  const s=transition(seed(),{type:'toggle_pause'});
  assert.equal(customerCatalogue(s).products.some(p=>p.reservationSupported),false);
});
