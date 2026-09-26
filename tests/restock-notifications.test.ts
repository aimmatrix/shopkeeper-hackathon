import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,transition} from '../lib/engine';
import {available} from '../lib/types';

test('customer request, consent, merchant purchase and notification share one persistent flow',()=>{
  let state=seed();state.products[0].reserved=state.products[0].onHand;
  state=transition(state,{type:'customer_message',text:'Can I have the item?',eventId:'ask'});
  assert.match(state.messages.at(-1)!.text,/out of stock.*notify/s);
  assert.equal(state.restockSubscriptions?.length??0,0);
  state=transition(state,{type:'customer_message',text:'Yes please',eventId:'consent'});
  assert.equal(state.restockSubscriptions?.length,1);
  const demand=state.products[0].demand;
  state=transition(state,{type:'customer_message',text:'Notify me when the hoodie is back',eventId:'again'});
  assert.equal(state.restockSubscriptions?.length,1);assert.equal(state.products[0].demand,demand);
  state=transition(state,{type:'prepare_proposal'});
  state=transition(state,{type:'approve_purchase',quoteId:'north',quantity:20,eventId:'pay'});
  const purchase=state.purchases[0];assert.ok(purchase.expectedAt);
  assert.equal(available(state.products[0]),0,'Incoming stock is not available');
  assert.equal(state.customerNotifications?.length??0,0,'Only merchant-approved sends notify');
  state=transition(state,{type:'notify_waitlist',purchaseId:purchase.id,eventId:'send'});
  assert.equal(state.customerNotifications?.length,1);
  assert.equal(state.customerNotifications![0].expectedAt,purchase.expectedAt);
  assert.match(state.messages.at(-1)!.text,/supplier has confirmed/);
  const duplicate=transition(state,{type:'notify_waitlist',purchaseId:purchase.id,eventId:'send-again'});
  assert.equal(duplicate,state);
  state=transition(state,{type:'customer_message',text:'When will it arrive?',eventId:'date'});
  assert.match(state.messages.at(-1)!.text,/supplier-confirmed restock is expected/);
});

test('declining updates does not subscribe and unconfirmed or cancelled orders cannot notify',()=>{
  let state=seed();
  state=transition(state,{type:'customer_message',text:'Do not notify me',eventId:'no'});
  assert.equal(state.restockSubscriptions?.length??0,0);
  assert.throws(()=>transition(state,{type:'notify_waitlist',purchaseId:'unknown',eventId:'bad'}),/confirmed/);
  state=transition(state,{type:'prepare_proposal'});
  state=transition(state,{type:'approve_purchase',quoteId:'north',quantity:20,eventId:'pay'});
  state=transition(state,{type:'request_cancel',purchaseId:state.purchases[0].id});
  assert.throws(()=>transition(state,{type:'notify_waitlist',purchaseId:state.purchases[0].id,eventId:'bad2'}),/confirmed/);
});

test('business demo purchase persists the selected product and pause blocks notification',()=>{
  let state=transition(seed(),{type:'prepare_proposal'});
  state=transition(state,{type:'approve_purchase',productId:'tee',quoteId:'north',quantity:20,eventId:'tee'});
  assert.equal(state.purchases[0].productId,'tee');
  state=transition(state,{type:'toggle_pause'});
  assert.throws(()=>transition(state,{type:'notify_waitlist',purchaseId:state.purchases[0].id,eventId:'paused'}),/paused/);
});

test('a customer joining after the merchant update receives the published date once',()=>{
  let state=transition(seed(),{type:'prepare_proposal'});
  state=transition(state,{type:'approve_purchase',quoteId:'north',quantity:20,eventId:'late-pay'});
  state=transition(state,{type:'notify_waitlist',purchaseId:state.purchases[0].id,eventId:'late-send'});
  state=transition(state,{type:'customer_message',text:'Notify me about the hoodie',eventId:'late-join'});
  assert.equal(state.customerNotifications?.length,1);
  state=transition(state,{type:'customer_message',text:'Notify me about the hoodie',eventId:'late-retry'});
  assert.equal(state.customerNotifications?.length,1);
});
