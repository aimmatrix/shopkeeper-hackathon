// Adversarial commerce audit of the pure engine and the store API's access rules. Findings are written up in docs/handoffs/claude-4.md.
// `C4-xx` tests started as reproductions of audit defects; all are now fixed and kept as guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, transition } from '../lib/engine';
import { Action, ShopState, available } from '../lib/types';
import { createRateLimiter } from '../lib/agents/sales';
import { authorizeAction, identifyCaller } from '../lib/store-access';


let n = 0;
const ev = () => `audit-${++n}`;
const say = (s: ShopState, text: string, eventId = ev()) => transition(s, { type: 'customer_message', text, eventId });
const hoodie = (s: ShopState) => s.products.find(p => p.id === 'hoodie')!;
const reservedOrders = (s: ShopState, productId = 'hoodie', includeOpening = false) => s.orders.filter(o => o.productId === productId && o.status === 'reserved' && (includeOpening || o.customer === 'Alex Morgan'));
const customerOrder = (s: ShopState) => s.orders.find(o => o.customer === 'Alex Morgan')!;

// Hoodie with 21 available (8 + 20 received − 7 reserved), so quantity parsing is not masked by the seed's single unit.
function restocked(): ShopState {
  let s = transition(seed(), { type: 'prepare_proposal' });
  s = transition(s, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: ev() });
  return transition(s, { type: 'receive_purchase', purchaseId: s.purchases[0].id });
}

function assertStockInvariants(s: ShopState) {
  for (const p of s.products) {
    assert.ok(Number.isInteger(p.onHand) && p.onHand >= 0, `${p.id} onHand ${p.onHand}`);
    assert.ok(Number.isInteger(p.reserved) && p.reserved >= 0 && p.reserved <= p.onHand, `${p.id} reserved ${p.reserved}/${p.onHand}`);
    const held = reservedOrders(s, p.id, true).reduce((sum, o) => sum + o.quantity, 0);
    assert.ok(held <= p.reserved, `${p.id} orders hold ${held} but only ${p.reserved} reserved`);
  }
}

// ---------------------------------------------------------------------------------------------
// Guards: business rules that currently hold and must keep holding.
// ---------------------------------------------------------------------------------------------

test('a burst of separate customers cannot oversell the last unit', () => {
  let s = seed();
  for (let i = 0; i < 5; i++) s = say(s, 'Reserve two hoodies please');
  assert.equal(reservedOrders(s).reduce((sum, o) => sum + o.quantity, 0), 1);
  assert.equal(available(hoodie(s)), 0);
  assert.equal(hoodie(s).demand, 12 + 1 + 4 * 2, 'every unfulfilled unit is recorded as interest, not as a sale');
  assert.equal(hoodie(s).onHand, 8, 'reservations never touch on-hand stock');
  assertStockInvariants(s);
});

test('a fully reserved request adds no demand and payment releases exactly that reservation', () => {
  const base = restocked();
  let s = say(base, 'Reserve 3 hoodies');
  assert.equal(reservedOrders(s)[0].quantity, 3);
  assert.equal(hoodie(s).demand, hoodie(base).demand);
  const pay: Action = { type: 'complete_order', orderId: customerOrder(s).id };
  s = transition(s, pay);
  assert.equal(hoodie(s).onHand, 25);
  assert.equal(hoodie(s).reserved, 7);
  assert.equal(transition(s, pay), s, 'a retried payment is a no-op');
  assertStockInvariants(s);
});

test('duplicate events return the same state object so the store skips the write', () => {
  const prepared = transition(seed(), { type: 'prepare_proposal' });
  const approve: Action = { type: 'approve_purchase', quoteId: 'east', quantity: 10, eventId: 'po-retry' };
  const once = transition(prepared, approve);
  assert.equal(transition(once, approve), once);
  const report: Action = { type: 'agent_report', summary: 'Restock', quoteId: 'north', quantity: 20, rationale: 'Evidence', eventId: 'report-retry' };
  const reported = transition(prepared, report);
  assert.equal(transition(reported, report), reported);
  const receive: Action = { type: 'receive_purchase', purchaseId: once.purchases[0].id };
  const received = transition(once, receive);
  assert.equal(transition(received, receive), received);
  assert.equal(hoodie(received).onHand, 18);
});

test('transition never mutates the state it was given', () => {
  const before = restocked();
  const snapshot = structuredClone(before);
  const after = say(before, 'Reserve 30 hoodies');
  transition(after, { type: 'complete_order', orderId: customerOrder(after).id });
  assert.deepEqual(before, snapshot);
});

test('zero and oversized numeric quantities are rejected without recording anything', () => {
  const s = seed();
  for (const text of ['Reserve 0 hoodies', 'Reserve 101 hoodies', 'Reserve 999 hoodies']) {
    assert.throws(() => say(s, text), /between 1 and 100/, text);
  }
});

test('purchase approval rejects malformed quantities and unknown suppliers', () => {
  const s = transition(seed(), { type: 'prepare_proposal' });
  for (const quantity of [0, -20, 20.5, NaN, Infinity, 501, '20' as unknown as number]) {
    assert.throws(() => transition(s, { type: 'approve_purchase', quoteId: 'north', quantity, eventId: ev() }), /Quantity must be/, String(quantity));
  }
  assert.throws(() => transition(s, { type: 'approve_purchase', quoteId: 'nowhere', quantity: 20, eventId: ev() }), /not found/);
  assert.throws(() => transition(seed(), { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: ev() }), /Prepare a proposal/);
});

test('incoming stock blocks a second order until it is received or the cancellation is confirmed', () => {
  let s = transition(seed(), { type: 'prepare_proposal' });
  s = transition(s, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: ev() });
  const id = s.purchases[0].id;
  s = transition(s, { type: 'request_cancel', purchaseId: id });
  assert.throws(() => transition(s, { type: 'approve_purchase', quoteId: 'east', quantity: 10, eventId: ev() }), /already an incoming/);
  s = transition(s, { type: 'prepare_proposal' });
  assert.match(s.activities[0].detail, /\b20 incoming\b/, 'pending cancellation still counts as incoming');
  s = transition(s, { type: 'confirm_cancel', purchaseId: id });
  s = transition(s, { type: 'prepare_proposal' });
  assert.match(s.activities[0].detail, /\b0 incoming\b/);
  s = transition(s, { type: 'approve_purchase', quoteId: 'east', quantity: 10, eventId: ev() });
  assert.equal(s.purchases[1].status, 'ordered');
});

test('purchase state machine refuses illegal transitions', () => {
  let s = transition(seed(), { type: 'prepare_proposal' });
  s = transition(s, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: ev() });
  const id = s.purchases[0].id;
  assert.throws(() => transition(s, { type: 'confirm_cancel', purchaseId: id }), /Request cancellation/);
  // The supplier ships before honouring a cancellation request: stock arrives once and the cancellation is moot.
  s = transition(s, { type: 'request_cancel', purchaseId: id });
  s = transition(s, { type: 'receive_purchase', purchaseId: id });
  assert.equal(hoodie(s).onHand, 28);
  assert.throws(() => transition(s, { type: 'confirm_cancel', purchaseId: id }), /Request cancellation/);
  assert.throws(() => transition(s, { type: 'request_cancel', purchaseId: id }), /open purchase/);
  assert.throws(() => transition(s, { type: 'receive_purchase', purchaseId: 'PO-9999' }), /not found/);
  assert.throws(() => transition(s, { type: 'complete_order', orderId: 'NF-9999' }), /not found/);
});

test('a paused workflow records nothing, and a rejected event can be retried after resuming', () => {
  const paused = transition(seed(), { type: 'toggle_pause' });
  const msg: Action = { type: 'customer_message', text: 'Reserve a hoodie', eventId: 'while-paused' };
  assert.throws(() => transition(paused, msg), /paused/);
  assert.throws(() => transition(paused, { type: 'prepare_proposal' }), /paused/);
  const resumed = transition(paused, { type: 'toggle_pause' });
  assert.equal(transition(resumed, msg).orders.filter(o => o.customer === 'Alex Morgan').length, 1, 'a failed attempt must not consume the event id');
});

test('randomised action sequences never oversell or leave negative stock', () => {
  let rng = 20260926;
  const rand = (k: number) => ((rng = (rng * 1103515245 + 12345) % 2 ** 31), rng % k);
  const texts = ['Reserve a hoodie', 'Reserve two hoodies', 'Reserve 7 hoodies', 'Reserve 60 hoodies', 'Is the hoodie in stock?', 'I want a large hoodie'];
  let s = seed();
  for (let step = 0; step < 400; step++) {
    const po = s.purchases[s.purchases.length - 1];
    const order = s.orders[rand(Math.max(s.orders.length, 1))];
    const options: Action[] = [
      { type: 'customer_message', text: texts[rand(texts.length)], eventId: ev() },
      { type: 'prepare_proposal' },
      { type: 'approve_purchase', quoteId: ['north', 'porto', 'east'][rand(3)], quantity: [10, 20, 30][rand(3)], eventId: ev() },
      ...(po ? [{ type: 'receive_purchase', purchaseId: po.id }, { type: 'request_cancel', purchaseId: po.id }, { type: 'confirm_cancel', purchaseId: po.id }] as Action[] : []),
      ...(order ? [{ type: 'complete_order', orderId: order.id } as Action] : []),
    ];
    try { s = transition(s, options[rand(options.length)]); }
    catch (error) { assert.ok(!(error instanceof TypeError), `step ${step}: ${(error as Error).message}`); }
    assertStockInvariants(s);
  }
});

// ---------------------------------------------------------------------------------------------
// Audit findings C4-xx. Each asserts the correct business behaviour; see the handoff for severity and fix.
// ---------------------------------------------------------------------------------------------

test('C4-01 a smart-apostrophe negation must not reserve stock', () => {
  // iOS and macOS substitute ’ for ' by default.
  const s = say(restocked(), 'I don’t want a hoodie, thanks');
  assert.equal(reservedOrders(s).length, 0);
});

test('C4-02 common negations must not reserve stock', () => {
  for (const text of ['I won\'t buy the hoodie', 'I dont want to order a hoodie', 'Never mind, no hoodie for me, I will not order']) {
    assert.equal(reservedOrders(say(restocked(), text)).length, 0, text);
  }
});

test('C4-03 enquiries that use buying verbs must not create reservations', () => {
  const base = restocked();
  for (const text of ['I want to know if the hoodie is in stock', 'Can I get the price of the hoodie?', 'When will my hoodie order arrive?', 'Hey, can I get the price of the hoodie?', 'Hi. When will my hoodie order arrive?', 'Thanks! Where is my hoodie order?']) {
    const s = say(base, text);
    assert.equal(reservedOrders(s).length, 0, text);
    assert.equal(hoodie(s).demand, hoodie(base).demand, text);
  }
});

test('C4-04 unsupported variants must not be reserved as washed black / M', () => {
  for (const text of ['I want a grey hoodie', 'Reserve an XXL hoodie', 'Can I order the hoodie in size S?', 'Reserve a navy hoodie', 'I want the hoodie in XS']) {
    assert.equal(reservedOrders(say(restocked(), text)).length, 0, text);
  }
});

test('C4-05 a four-digit quantity must be rejected, not silently reserved as one', () => {
  assert.throws(() => say(restocked(), 'Reserve 1000 hoodies'), /between 1 and 100/);
});

test('C4-06 fractional and negative quantities must be rejected, not truncated or sign-flipped', () => {
  assert.throws(() => say(restocked(), 'Reserve 2.5 hoodies'), /between 1 and 100/);
  assert.throws(() => say(restocked(), 'Reserve -3 hoodies'), /between 1 and 100/);
});

test('C4-07 numbers that are not quantities must not inflate demand', () => {
  const s = say(seed(), 'I\'m 30 and I want a hoodie');
  assert.equal(reservedOrders(s)[0]?.quantity, 1);
  assert.equal(hoodie(s).demand, 12, 'an age must not become 29 units of unmet demand');
});

test('C4-08 spelled-out quantities above three are honoured', () => {
  const s = say(restocked(), 'Reserve four medium black hoodies');
  assert.equal(reservedOrders(s)[0].quantity, 4);
});

test('C4-09 actions that require an event id are rejected without one', () => {
  // The API casts the JSON body to Action without validation, so these shapes reach the engine.
  const noId = { type: 'customer_message', text: 'Reserve a hoodie' } as unknown as Action;
  assert.throws(() => transition(restocked(), noId), /event identifier/);
  const objectId = () => JSON.parse(JSON.stringify({ type: 'customer_message', text: 'Reserve a hoodie', eventId: { id: 'x' } })) as Action;
  assert.throws(() => transition(restocked(), objectId()), /event identifier/);
  const prepared = transition(seed(), { type: 'prepare_proposal' });
  assert.throws(() => transition(prepared, { type: 'approve_purchase', quoteId: 'north', quantity: 20 } as unknown as Action), /event identifier/);
});

test('C4-10 reusing an event id for a different action is reported, not silently dropped', () => {
  let s = say(seed(), 'Hello', 'shared-id');
  s = transition(s, { type: 'prepare_proposal' });
  assert.throws(() => transition(s, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: 'shared-id' }), /event/i);
});

test('C4-11 seeded reservations are backed by orders that can be paid or released', () => {
  const s = seed();
  for (const p of s.products) assert.equal(reservedOrders(s, p.id, true).reduce((sum, o) => sum + o.quantity, 0), p.reserved, p.id);
});

test('C4-12 a pre-reset event replayed after reset is not applied again', () => {
  const msg: Action = { type: 'customer_message', text: 'Reserve a hoodie', eventId: 'before-reset' };
  const reset = transition(transition(seed(), msg), { type: 'reset' });
  assert.equal(transition(reset, msg).orders.length, seed().orders.length);
});

test('C4-13 an agent report cannot make a proposal ready while the workflow is paused', () => {
  const paused = transition(seed(), { type: 'toggle_pause' });
  assert.throws(() => transition(paused, { type: 'agent_report', summary: 'Restock', quoteId: 'north', quantity: 20, rationale: 'Evidence', eventId: ev() }), /paused/);
});

test('C4-14 a proposal is consumed by the purchase it justified', () => {
  assert.throws(() => transition(restocked(), { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: ev() }), /Prepare a proposal/);
});

test('C4-15 malformed payloads fail validation instead of crashing with a TypeError', () => {
  const payloads = [
    null,
    { type: 'customer_message', text: 42, eventId: 'bad-text' },
    { type: 'agent_report', summary: 5, quoteId: 'north', quantity: 20, rationale: 'r', eventId: 'bad-summary' },
  ];
  for (const payload of payloads) {
    assert.throws(() => transition(seed(), payload as unknown as Action), (e: unknown) => e instanceof Error && !(e instanceof TypeError), JSON.stringify(payload));
  }
});

test('C4-16 the customer parser reserves the hoodie even if the catalogue order changes', () => {
  const s = seed();
  s.products.reverse();
  const next = say(s, 'Reserve a hoodie');
  assert.equal(customerOrder(next)?.productId, 'hoodie');
});

// Decision D-1 (option B): keep the demand counter, but one unverified chat line can add at most
// 10 units (the smallest supplier minimum), and received stock draws unmet demand down.
test('C4-17 one customer message adds at most 10 units of unmet demand', () => {
  const s = say(seed(), 'Reserve 100 hoodies');
  assert.equal(reservedOrders(s)[0].quantity, 1);
  assert.equal(hoodie(s).demand, 12 + 10);
});

test('C4-18 received stock is subtracted from unmet demand, never below zero', () => {
  let s = transition(seed(), { type: 'prepare_proposal' });
  s = transition(s, { type: 'approve_purchase', quoteId: 'east', quantity: 10, eventId: ev() });
  s = transition(s, { type: 'receive_purchase', purchaseId: s.purchases[0].id });
  assert.equal(hoodie(s).demand, 2);
  s = transition(s, { type: 'prepare_proposal' });
  s = transition(s, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: ev() });
  s = transition(s, { type: 'receive_purchase', purchaseId: s.purchases[1].id });
  assert.equal(hoodie(s).demand, 0);
  s = transition(s, { type: 'prepare_proposal' });
  assert.match(s.activities[0].detail, /\b0 units of unmet demand\b/);
});

test('C4-19 ordinary phrasings of a supported request still reserve the right quantity', () => {
  const base = restocked();
  for (const [text, quantity] of [['Can you reserve two hoodies for me?', 2], ['Let\'s reserve two hoodies', 2], ['It\'s a gift, reserve one hoodie', 1], ['Reserve 2 hoodies, when can I collect?', 2], ['I want 2 of the hoodies', 2]] as const) {
    assert.equal(reservedOrders(say(base, text))[0]?.quantity, quantity, text);
  }
});

// ---------------------------------------------------------------------------------------------
// API-1 / API-3: store access rules (lib/store-access.ts). No route, store or database is touched.
// ---------------------------------------------------------------------------------------------

const report: Action = { type: 'agent_report', summary: 'Restock', quoteId: 'north', quantity: 20, rationale: 'Evidence', eventId: 'report-src' };
const browser = { agent: false, sameOrigin: true };
const agent = { agent: true, sameOrigin: false };
const limits = (t = { now: 0 }) => ({ actions: createRateLimiter({ perClient: 40, total: 400, windowMs: 60_000, now: () => t.now }), resets: createRateLimiter({ perClient: 3, total: 6, windowMs: 600_000, now: () => t.now }) });

test('API-3 the server, not the request body, decides where a recommendation came from', () => {
  const spoofed = { ...report, source: 'agent_token' } as Action;
  const fromPage = authorizeAction(browser, 'ip-1', spoofed, limits());
  assert.ok(fromPage.ok && fromPage.action.type === 'agent_report' && fromPage.action.source === 'handoff_page');
  const fromAgent = authorizeAction(agent, 'ip-1', report, limits());
  assert.ok(fromAgent.ok && fromAgent.action.type === 'agent_report' && fromAgent.action.source === 'agent_token');
  const prepared = transition(seed(), { type: 'prepare_proposal' });
  assert.equal(transition(prepared, report).agentReport?.source, 'handoff_page', 'an unverified report never claims to be the agent');
  assert.equal(transition(prepared, { ...report, source: 'agent_token' }).agentReport?.source, 'agent_token');
  assert.throws(() => transition(prepared, { ...report, source: 'grokbot' } as unknown as Action), /Unknown recommendation source/);
});

test('API-1 unauthenticated callers are refused and the agent token only reaches agent_report', () => {
  assert.equal(authorizeAction({ agent: false, sameOrigin: false }, 'ip-1', { type: 'reset' }, limits()).ok, false);
  for (const action of [{ type: 'reset' }, { type: 'complete_order', orderId: 'NF-0997' }, { type: 'approve_purchase', quoteId: 'north', quantity: 20, eventId: 'x' }] as Action[]) {
    const denied = authorizeAction(agent, 'ip-1', action, limits());
    assert.ok(!denied.ok && denied.status === 403, action.type);
  }
  const url = 'https://shop.example/api/store';
  assert.deepEqual(identifyCaller(new Request(url, { headers: { authorization: 'Bearer wrong-token' } }), 'right-token'), { agent: false, sameOrigin: false });
  assert.deepEqual(identifyCaller(new Request(url, { headers: { authorization: 'Bearer right-token' } }), 'right-token'), { agent: true, sameOrigin: false });
  assert.deepEqual(identifyCaller(new Request(url, { headers: { authorization: 'Bearer right-token' } }), undefined), { agent: false, sameOrigin: false });
  // A scripted client can copy the Origin header, which is exactly why the rate limits below exist.
  assert.equal(identifyCaller(new Request(url, { headers: { origin: 'https://shop.example' } }), 'right-token').sameOrigin, true);
});

test('API-1 a scripted caller can reset the shared workspace at most 3 times per 10 minutes', () => {
  const clock = { now: 0 };
  const l = limits(clock);
  for (let i = 0; i < 3; i++) assert.ok(authorizeAction(browser, 'ip-1', { type: 'reset' }, l).ok, `reset ${i + 1}`);
  const blocked = authorizeAction(browser, 'ip-1', { type: 'reset' }, l);
  assert.ok(!blocked.ok && blocked.status === 429 && blocked.retryAfter === 600);
  assert.ok(authorizeAction(browser, 'ip-2', { type: 'reset' }, l).ok, 'another client keeps its own budget');
  assert.ok(authorizeAction(browser, 'ip-1', { type: 'toggle_pause' }, l).ok, 'ordinary actions are unaffected');
  clock.now = 600_000;
  assert.ok(authorizeAction(browser, 'ip-1', { type: 'reset' }, l).ok, 'the budget refills after the window');
});

test('API-1 one client is limited to 40 actions a minute', () => {
  const l = limits();
  for (let i = 0; i < 40; i++) assert.ok(authorizeAction(browser, 'ip-1', { type: 'prepare_proposal' }, l).ok);
  const blocked = authorizeAction(browser, 'ip-1', { type: 'prepare_proposal' }, l);
  assert.ok(!blocked.ok && blocked.status === 429);
  assert.ok(authorizeAction(browser, 'ip-2', { type: 'prepare_proposal' }, l).ok);
});
