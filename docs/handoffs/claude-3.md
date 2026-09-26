# Claude 3 — merchant phone experience (`/mobile`)

## Files (all new, nothing shared edited)

- `app/mobile/page.tsx`: route entry with metadata and viewport (`viewport-fit=cover` for notched phones).
- `app/mobile/mobile.module.css`: scoped styles only. Tokens mirror the workspace palette, with Urbanist/Manrope taken from the global `--font-*` vars.
- `components/mobile/mobile-decision.tsx`: the client screen.
- `components/mobile/insights.ts`: pure helpers for urgency, suggested quantity, validation and the approval diff.
- `components/mobile/insights.test.ts`: `node --import tsx --test components/mobile/insights.test.ts` (4 passing).

`npm run typecheck` is clean. I ran no build and started no server; I only used the primary's :3000 for read-only checks.

## Data contract

- It reads `GET /api/store` on load, then every 5s while the tab is visible, and immediately on `visibilitychange`. It only accepts a state whose `version` is equal or newer, so a slow poll can't overwrite a fresher action result.
- It writes only `prepare_proposal`, `approve_purchase` (with `crypto.randomUUID()` eventId, reused if the same confirm is retried) and `toggle_pause` (only shown when the workflow is paused and blocking the proposal).
- The restock decision targets `state.products[0]`, because that's what `approve_purchase` restocks in `lib/engine.ts`. The "most urgent" card ranks every product. If a different product ever ranks first, the decision card says that mobile restocks support the first product only. The screen does not suggest arbitrary products can be restocked.
- Nothing is invented. The "Why" list is computed from `onHand`, `reserved`, `demand`, `dailySales` and `leadDays`. The agent card shows `state.agentReport` verbatim. When there's no report, it says so and uses `connections.grok` to tell "not connected" apart from "connected, nothing submitted".

## Walkthrough

1. Open `/mobile` on a phone (or any window under 600px; wider screens show the column inside a handset frame). The "Desktop" pill at the top left goes back to `/`.
2. **Brief:** the date, a headline (for example "Everyday Hoodie needs you"), and demo sales, open reservations and incoming units.
3. **Urgent card:** "left to sell" (on hand − reserved), with On hand / Reserved / **Incoming** / Unmet as separate figures. A cover bar shows days of stock against the restock lead time.
4. **Why this restock:** the reasons, calculated from store records.
5. **Agent recommendation:** GrokBot's summary, pick and expandable reasoning, or an honest empty state.
6. **Supplier decision,** in three steps:
   - **Prepare:** the thumb dock shows "Prepare restock proposal", which runs `prepare_proposal`. Approval can't be reached until `proposalReady` is true.
   - **Choose:** radio cards show unit cost, MOQ, shipping and quoted lead time. The quantity stepper defaults to the agent's quantity if the agent picked that supplier. Otherwise it defaults to a suggestion (unmet + daily sales × lead − available, raised to the MOQ), and the hint shows that working. The summary lists quantity, MOQ, goods, shipping, the **demo** total and "quoted, not confirmed" lead time. Quantities outside MOQ–500 disable the CTA with an inline reason.
   - **Approve:** "Review demo restock · £X" opens a confirm sheet ("Demo only — no payment, no real order") with Back (or Escape) and "Confirm demo restock". Focus moves to the confirm button.
7. **What changed:** after approval, a card shows the new PO, supplier, total and before → after for On hand (unchanged), Incoming (+qty) and Available to sell (unchanged). Focus moves to it, and the dock becomes "Manage incoming order on desktop".
8. **Duplicate guard:** while a PO is `ordered` or `cancellation_requested`, the decision shows that PO and blocks a second approval. The engine rejects duplicates too, and that error would be shown.
9. **Errors and pending:** buttons show spinners and disable while busy. Server errors appear in a `role="alert"` banner. "Workspace changed" errors trigger a refresh. If the version moves while the confirm sheet is open, the sheet closes and asks the merchant to re-check.

## Verified

- Loaded against live store data at 390px and 320px: no horizontal overflow, and every interactive target is ≥ 44px tall.
- Using a **stubbed** `fetch` in the browser, so no records were written to the shared store, I tested four things:
  - the approve → diff flow
  - the error banner
  - the prepare phase
  - the open-PO block, and agent-report preselection (Porto / 40)
- I did not run a real `approve_purchase` against the shared store, to avoid leaving a PO in the primary's demo. The engine path is covered by the helper tests, which drive `seed()`/`transition()`.

## Requests for primary

- Optional: link to `/mobile` from the desktop workspace (e.g. a "Phone view" link). I didn't edit `components/workspace.tsx`.
- If `approve_purchase` ever takes a `productId`, `components/mobile/mobile-decision.tsx` only needs `product` switched from `state.products[0]` to the urgent product.

## Completion handoff

### Changed files (all new and untracked; nothing shared was edited or committed)

- `app/mobile/page.tsx`
- `app/mobile/mobile.module.css`
- `components/mobile/mobile-decision.tsx`
- `components/mobile/insights.ts`
- `components/mobile/insights.test.ts`
- `docs/handoffs/claude-3.md`

### Commands run and results

- `npm run typecheck`: exit 0, no errors. An earlier run showed `components/storefront/storefront.tsx(9,28): Cannot find module './assistant-panel'`, which is another agent's in-progress file. It no longer reproduces.
- `node --import tsx --test components/mobile/insights.test.ts`: 4 tests, 4 passing, 0 failing.
- Read-only checks against the primary's dev server at `http://localhost:3000/mobile` in the built-in browser at 390px and 320px: no horizontal overflow, all tap targets ≥ 44px, no console errors.
- Approve, error, prepare, open-PO and agent-report states were checked with a browser-side `fetch` stub. No POST reached the shared store.
- Screenshots were taken with headless Chrome over the DevTools protocol, emulating 390×844 at 2x: one of the first screen and one of the full scroll. They're scratch files and are not in the repo.
- I ran no `npm run build`, started no dev server, and made no commits, deployments or migrations.

### Remaining blockers

- None for `/mobile` itself.
- Nothing links to `/mobile` yet: the desktop workspace is owned by the primary.
- A real end-to-end `approve_purchase` was not run from `/mobile` against the shared store. Doing so leaves an open PO that blocks further approvals until it's received or cancelled on the desktop.
- Mobile restocks only apply to `state.products[0]`, because that's what the engine's `approve_purchase` restocks. That's a current engine limitation.

### Environment variables

`/mobile` reads none directly. It depends on `/api/store`, which uses:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY`
- `SHOPKEEPER_WORKSPACE_KEY`
- `SHOPKEEPER_AGENT_TOKEN`: its presence switches the agent card from "not connected" to "connected".

### Integration steps (for primary Codex)

1. `git add app/mobile components/mobile docs/handoffs/claude-3.md`. No dependency, env or migration changes are needed.
2. Optional: add a link to `/mobile` in `components/workspace.tsx` (e.g. a "Phone view" link in the header or sidebar).
3. Run the production build as usual. `/mobile` is a static server shell around a client component, with no route-segment config.
4. Smoke test on a phone or at 390px:
   1. Open `/mobile` and tap "Prepare restock proposal" if shown.
   2. Pick a supplier and a quantity.
   3. Tap "Review demo restock", then "Confirm demo restock".
   4. Check the "What changed" card: on hand unchanged, incoming +qty.
   5. Tap "Manage incoming order on desktop", then receive or cancel the PO there to reset the flow.
5. Optional: run `node --import tsx --test components/mobile/insights.test.ts` in CI. The existing `npm test` glob only covers `tests/*.test.ts`.

Not done by me: deployment, desktop linking, and a real (non-stubbed) approval against the shared store.
