# Claude 5 handoff: customer storefront at `/shop`

**Route:** `/shop` (for example `http://localhost:3000/shop`)

## Files (all new, nothing else touched)

- `app/shop/page.tsx` is a server component. It sets the page metadata and renders the client storefront.
- `app/shop/shop.module.css` holds every style for the page. It's scoped, and `globals.css` wasn't edited.
- `components/storefront/storefront.tsx` handles data loading, polling, actions, the hero, the catalogue, the sample notice and the footer.
- `components/storefront/assistant-panel.tsx` contains the customer chat, the reservations tray and the demo-checkout confirmation.
- `components/storefront/utils.ts` has `newEventId()` and `clock()`.

The storefront itself needs no backend, type, engine or global CSS changes. The later engine copy fix is described below. The page uses `ProductArt`, `money`, `available` and the `Action`/`ShopState` types as they are.

## Supported customer flow

1. **Browse.** Every product comes from `GET /api/store`, showing its price (`money`), colour and size (parsed from `variant`), and available stock (`onHand - reserved`).
2. **Ask or reserve the Everyday Hoodie (washed black / M).** Customers can use the chat, the three suggested prompts, or the hero's "Reserve N with the assistant" button (1–5, max 5). Each of these sends `customer_message` with a fresh `eventId`. The hero button sends the reservation request as a visible chat message, so the customer sees exactly what was asked and the real reply.
   - When stock is 0, the hero button reads **Register restock interest** and sends `I want a medium washed-black Everyday Hoodie`. The engine replies "out of stock" and adds the request to `demand`.
   - When the quantity exceeds availability, a hint explains that the engine will reserve what's left and record the shortfall as demand. That's what `transition` does.
3. **Reservations.** An order created by a message (matched on `order.eventId === eventId`) appears as a card under the assistant reply that created it. All orders in state also show in the "Your reservations" tray. Every demo order belongs to the sample customer, Alex Morgan, so the shop is presented as Alex's view.
4. **Demo checkout.** "Demo checkout" opens an explicit confirmation that says no card is needed and no money moves. Confirming sends `complete_order`. Paid orders read "Paid in demo checkout — no real payment was processed."
5. **Merchant-side changes.** The page polls `GET /api/store` every 5s while the tab is visible, and again when the tab becomes visible. Poll responses are dropped if a POST went out meanwhile, so stale reads never overwrite a write. When a poll changes a product's availability, its stock line shows "just updated" and the hoodie's stock seal pops. New merchant (`sender: 'merchant'`) messages show as "North & Form team". `stock` messages are internal and hidden from customers.
6. **Paused.** If `state.paused`, the composer, prompts and reserve button are disabled with a notice. Checkout of existing reservations still works, since the engine allows `complete_order` while paused.

The tee, tote and cap can be browsed only. They're labelled "Browse only in this sample", with no cart or buy button.

## Honesty labels

- The top bar says "Sample store — demo reservations and checkout only, no payment is taken", and the footer says North & Form is fictional.
- The assistant is labelled **Guided demo**: "Scripted replies … backed by live stock records". No chat model is connected. `connections().grok` refers to the stock-manager agent token, not a customer chat model, so the label never switches.
- The loading state, a load failure with retry, a "Reconnecting to live stock…" indicator when polls fail, and per-action errors all show the API's error text.

## Completion summary

### Changed files

The storefront files are new. `lib/engine.ts` was edited later at the user's direct request; see "Engine copy fix" below.

- `app/shop/page.tsx`
- `app/shop/shop.module.css`
- `components/storefront/storefront.tsx`
- `components/storefront/assistant-panel.tsx`
- `components/storefront/utils.ts`
- `docs/handoffs/claude-5.md`
- `lib/engine.ts` (two reply strings only; primary-owned, edited at the user's request)

### Commands run and results

- `npm run typecheck` passes with no errors.
- `npm test`: 56 tests, 38 pass, 0 fail, 18 todo. The todos are Claude 4's open C4-xx engine defects, not from this work.
- I ran a scratch script (in the session scratchpad, not the repo) through `npx tsx`. It fed every suggested prompt and hero message through `seed()` + `transition()`, with no shared data touched. Each hit the intended branch:
  - Info reply.
  - Restock timing.
  - Reserve → `NF-1001` reserved.
  - Reserve 2 with 1 available → 1 reserved plus 1 demand.
  - `complete_order` → paid, `onHand` −1.
- In the browser on the shared dev server (`localhost:3000`, owned by primary), I checked `/shop` at 375px, ~1100px and 1440px. There's no horizontal overflow and no console errors.

### Live test against the shared Supabase state (the user asked for it)

State before: version 6, hoodie `onHand 8 / reserved 8 / available 0 / demand 13`, and order `NF-1001` (1 hoodie) was reserved.

1. **Info prompt:** "Is the medium washed-black hoodie in stock?" returned the real engine reply ("There are 0 available…"). No stock change.
2. **Reserve while sold out:** the hero button showed "Register restock interest". Clicking it sent `I want a medium washed-black Everyday Hoodie`. The engine replied "currently out of stock… recorded 1 unit of interest" and `demand` went 13 → 14. No order was created, which is correct.
3. **Demo checkout:** clicking "Demo checkout" on `NF-1001` opened the confirmation, and "Confirm demo checkout" sent `complete_order`. The tray now reads "Paid in demo checkout — no real payment was processed", with no errors.

State after (read back from `GET /api/store`): version 8, `NF-1001` paid, hoodie `onHand 7 / reserved 7 / available 0 / demand 14`. The merchant activity log gained "NF-1001 paid in demo checkout" and "A customer request became a stock signal".

**Reset and live reservation (the user asked for it):**

1. I saved the pre-reset state (version 8) to the session scratchpad. Then I sent `{ type: 'reset' }` from the `/shop` page, so the request was same-origin. It returned 200, version 9: hoodie `onHand 8 / reserved 7 / available 1 / demand 12`, no orders, the 2 seed messages.
2. I reloaded `/shop` and clicked the hero's **Reserve 1 with the assistant**. It sent `Reserve 1 medium washed-black Everyday Hoodie`. The engine replied "I’ve reserved 1 medium washed-black hoodie for you (£68). This is a demo reservation; no payment has been taken."
3. The UI showed the `NF-1001` card under the reply and in the tray ("Reserved · stock held", with a Demo checkout button). The hero flipped to "Sold out" / "Register restock interest". No errors.
4. `GET /api/store` confirmed version 10:
   - `NF-1001` is reserved for Alex Morgan (£68).
   - Hoodie is `onHand 8 / reserved 8 / available 0`, demand unchanged at 12.
   - The merchant activity log has "1 hoodie reserved for Alex".

Afterwards, at the user's request, I reset the store again for the demo. Version 11 is back to the starting data: hoodie `onHand 8 / reserved 7 / available 1 / demand 12`, no orders, no purchases, the 2 seed messages, not paused.

### Remaining blockers

- **No link to `/shop` from the workspace yet.** `components/workspace.tsx` is primary-owned.

### Environment variables (names only)

The storefront reads none directly. It uses `/api/store`, which depends on the existing server-side configuration:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY`, and `SHOPKEEPER_WORKSPACE_KEY` for persistence. Without them, a local file store is used in development only.

`SHOPKEEPER_AGENT_TOKEN` and `TAVILY_API_KEY` aren't used by `/shop`.

### Integration steps for primary Codex

1. The route already works as-is at `/shop`. No config, dependency or migration is needed.
2. Add a link from the workspace to `/shop`, for example next to the demo badge in the top bar or in the Inbox header, labelled "Open customer storefront ↗".
3. Review the engine copy fix below; it's already applied.
4. The store is already reset to the starting data (version 11). Any rehearsal before the judge demo will use up the single available hoodie, so reset again after rehearsing.
5. Optional: `workspace.tsx` uses `crypto.randomUUID()`, which is undefined on plain-http LAN origins (a phone opening `http://192.168.x.x:3000`). Reuse `newEventId()` from `components/storefront/utils.ts`.
6. When Claude 1's `/api/assist` model endpoint actually powers `customer_message`, update the "Guided demo" badge and panel note in `assistant-panel.tsx`.

### Engine copy fix (`lib/engine.ts`, the `customer_message` case)

The user asked for this directly, so I edited a primary-owned file. Only reply strings changed. Reservation, demand and stock logic are untouched.

1. The closing line "This is a demo reservation; no payment has been taken." is now added only when `reserved > 0`. Before, a sold-out request got the line even though nothing was reserved.
2. The stock/price reply now depends on availability:
   - With stock, it suggests “Reserve one medium black hoodie” instead of "two", which would overrun the last unit.
   - When sold out, it says the hoodie is sold out and offers to record restock interest, instead of "There are 0 available… You can ask ‘Reserve two…’".

Primary had already replaced the "open the Connections tab" fallback with customer-facing copy, so I left it alone.

Checks after the edit:
- `npm run typecheck` passes.
- `npm test`: 66 tests, 48 pass, 0 fail, 18 todo.
- A scratch script checked the replies in both stocked and sold-out states.

Nothing was committed, deployed or migrated.
