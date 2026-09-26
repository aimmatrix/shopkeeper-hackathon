# Claude 4: commerce reliability audit

Scope: `lib/types.ts`, `lib/engine.ts`, `lib/store.ts` and `app/api/store/route.ts`, audited adversarially. I made no calls to the shared Supabase database and ran no reset. The only live request was an unauthenticated POST to the local dev server, which the route rejects (403) before any storage is touched.

## Completion summary

**Changed files.** At the user's explicit request, I edited files owned by primary Codex (marked *owned*). Primary Codex: please review them before your next build.

| File | Change |
|---|---|
| `lib/store-access.ts` (new) | Access rules for `POST /api/store`: caller identification (timing-safe token compare), the agent-token restriction, per-client rate limits (40 actions/min; 3 resets per 10 min, 6 in total), and the server-set report `source`. It reuses `createRateLimiter` from `lib/agents/sales.ts`. |
| `app/api/store/route.ts` *owned* | `POST` now uses `identifyCaller`, `authorizeAction` and `clientKey`, and sends `Retry-After` with 429 responses. Everything else is unchanged. |
| `lib/types.ts` *owned* | Adds `ReportSource = 'agent_token' \| 'handoff_page'`, plus an optional `source` on `AgentReport` and on the `agent_report` action. |
| `lib/engine.ts` *owned* | `agent_report` rejects an unknown `source` and defaults to `'handoff_page'`; the activity title says which source. My earlier C4-03b change is the `enquiry` / `wantsOrder` lines. |
| `components/workspace.tsx` *owned* | Recommendation label: `· VIA GROKBOT` or `· VIA HANDOFF PAGE`. Connections row: "GrokBot report received" (green) only for `agent_token`; otherwise "Report via handoff page" (neutral). |
| `components/mobile/mobile-decision.tsx` | Kicker: "GrokBot stock manager" only for `agent_token`, otherwise "Handoff page". With no report and a token configured, it says "GrokBot endpoint ready" instead of claiming "connected". |
| `tests/commerce-audit.test.ts` | 33 tests: engine guards C4-01 to C4-19, plus API-1 and API-3 access tests. |
| `docs/handoffs/claude-4.md` | This file. |

**Commands run and results** (final state, 2026-09-26):

```bash
node --import tsx --test tests/commerce-audit.test.ts
```
- 33 tests, 33 pass, 0 fail.

```bash
node --import tsx --test tests/*.test.ts
```
- The full suite, including other agents' files: 72 tests, 72 pass, 0 fail.

```bash
npm run typecheck
```
- Exit 0.

```bash
curl -X POST http://localhost:3000/api/store
```
- With body `{"type":"reset"}` and no Origin: 403. With a wrong bearer token: 403 with the error "Use this workspace or an authorized agent connection."
- I confirmed with `lsof` that the dev server on :3000 is running from this checkout. Its compiled route includes `store-access`.

**Build and deploy** (the user asked me to run these, 2026-09-26):
- `npm test`: 72/72 pass. `node --import tsx --test components/mobile/insights.test.ts`: 4/4 pass. `npm run typecheck`: exit 0.
- `next build` in an isolated copy (in the session scratchpad, not the shared `.next`, so primary's dev server on :3000 wasn't disturbed): exit 0, all 9 routes built.
- `vercel deploy`: preview `shopkeeper-hackathon-545qyibao-muhammads-projects-6598a55c.vercel.app`, READY. It's behind Vercel Authentication, so I couldn't smoke-test it.
- `vercel deploy --prod`: `shopkeeper-hackathon-o0wfffi7p-muhammads-projects-6598a55c.vercel.app`, READY, aliased to **https://shopkeeper-hackathon.vercel.app**.
- Production smoke test:
  - `/`, `/agent`, `/mobile` and `/shop` all return 200.
  - `GET /api/store` returns state from Supabase (version 13).
  - `POST {"type":"reset"}` with no Origin returns 403; with a wrong bearer token, 403.
  - I sent no write that could succeed.

**Remaining blockers and caveats:**
1. **API-1 is mitigated, not closed.** The workspace is a public, login-free demo, so no header check can tell a scripted client from a visitor. Every visitor can already click reset. The new limits stop scripted floods and repeated resets. The real fix is merchant sign-in for merchant actions (approve, pay, reset), which is out of scope for the hackathon.
2. **The limits live in each server instance's memory.** On Vercel, each warm instance has its own budget, so the worst case is a few multiples of these numbers. Clients are keyed by `x-forwarded-for`, which Vercel sets itself.
3. **The live data is consistent. Don't reset it.** My earlier "needs a reset" note was wrong: I looked for the seed's `NF-0997` ID. Primary Codex had already reconciled the opening reservations in place (v12 → v13, see `primary-integration.md`). A read-only check of production (v13) shows every product's `reserved` exactly backed by reserved orders (hoodie 7/7, tee 6/6, tote 3/3, cap 2/2). A reset would wipe GrokBot's real recommendation (North Thread × 20, saved 11:06:38 UTC), which is demo evidence.
4. **GrokBot's real report shows as "via handoff page".** That's intended. GrokBot uses the `/agent` browser handoff by design, and `primary-integration.md` item 4 says a browser-handoff report must not be presented as an authenticated GrokBot API event. `SHOPKEEPER_AGENT_TOKEN` isn't set in any Vercel environment, so no token path exists and none is needed for the demo.
5. **File ownership.** After I edited `components/workspace.tsx`, `docs/PARALLEL_WORK.md` moved that file to the frontend redesign agent. My change there is two strings: the `VIA GROKBOT` / `VIA HANDOFF PAGE` recommendation label, and the Connections row (green only for `agentReport.source === 'agent_token'`). The redesign should keep that meaning: never label a report as GrokBot's unless `source === 'agent_token'`.
6. **Production vs preview.** `primary-integration.md` says the production alias "must not be used for the demo yet". But Supabase and Tavily variables were already set for Production, and primary had deployed production twice just before me, so my `--prod` deploy only updated it to the current code. Primary Codex: please update that line if production is now the intended demo URL.

**Required environment variables:** no new ones. `SHOPKEEPER_AGENT_TOKEN` must be set for verified agent reports. The code also reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY`, `SHOPKEEPER_WORKSPACE_KEY`, `TAVILY_API_KEY` and `VERCEL`.

**Integration steps (primary Codex):**
1. Review the diff of the *owned* files above. They're already deployed to production, so if you change them, redeploy.
2. Don't reset the live demo; the ledger is already reconciled (caveat 3).
3. Confirm whether production or preview is the demo URL, and update `primary-integration.md` (caveat 6).
4. Frontend redesign agent: keep the `agentReport.source` label semantics (caveat 5).

## Status of findings

| ID | Finding | Severity | Status |
|---|---|---|---|
| C4-01 | `don’t` (smart apostrophe) reserved stock | High | Fixed, guarded |
| C4-02 | `won't` / `dont` / `will not` reserved stock | High | Fixed, guarded |
| C4-03 | Enquiries ("want to know", "get the price", "my order arrive") reserved stock | High | Fixed, guarded |
| C4-03b | Regression: a greeting before an enquiry reserved stock again | High | Fixed (Claude 4), guarded |
| C4-04 | Grey, navy, XXL, S and XS reserved as washed black / M | High | Fixed, guarded |
| C4-05 | `1000` reserved 1 | Medium | Fixed, guarded |
| C4-06 | `2.5` became 2, `-3` became 3 | Medium | Fixed, guarded |
| C4-07 | `I'm 30` added 29 units of demand | Medium | Fixed, guarded |
| C4-08 | `four` reserved 1 | Low | Fixed, guarded |
| C4-09 | Missing or non-string `eventId` skipped deduplication | High | Fixed, guarded |
| C4-10 | Reusing an `eventId` for a different action was silently dropped | Medium | Fixed, guarded |
| C4-11 | Seeded reservations had no orders behind them | Medium | Fixed (sample opening orders), guarded. Live DB reconciled in place by primary (v13); verified consistent. |
| C4-12 | A pre-reset event replayed after reset was applied again | Low | Fixed, guarded |
| C4-13 | `agent_report` bypassed pause | Low | Fixed, guarded |
| C4-14 | An old proposal could approve a new PO | Low | Fixed, guarded |
| C4-15 | Malformed payloads crashed with a `TypeError` | Low | Fixed, guarded |
| C4-16 | Parser assumed the hoodie is `products[0]` | Low | Fixed, guarded |
| C4-17 | One message could add 99 units of demand | Medium | Fixed (cap 10), guarded |
| C4-18 | Demand never went down after stock was received | Medium | Fixed, guarded |
| C4-19 | Ordinary requests ("Can you reserve…", "Let's reserve…") reserved nothing | Medium | Fixed, guarded |
| API-1 | A forged `Origin` allowed unlimited writes and resets | High | Mitigated (Claude 4): rate limits, guarded. Real fix is merchant sign-in (see caveat 1). |
| API-2 | The agent token could reset, approve or pay | High | Fixed, now guarded by an API-1 test |
| API-3 | Agent reports didn't record who submitted them | Medium | Fixed (Claude 4): server-set `source`, honest UI labels, guarded |
| API-4 | Every error returned 400 | Low | Fixed (409 and 503) |

## Design notes

**API-1: why rate limits and not a secret.**
- A secret in the browser is visible to every visitor, and a reset password would stop the presenter and judges from using the demo.
- So the route keeps same-origin as CSRF protection, and `lib/store-access.ts` adds limits:
  - 40 actions per minute per client (400 in total per instance).
  - 3 resets per 10 minutes per client (6 in total per instance). A 429 response includes `Retry-After`.
- Normal demo pace stays well under the limits.

**API-3: why the route sets `source`.**
- The route overwrites `source` on every `agent_report`: `agent_token` only when the bearer token matched (timing-safe compare), otherwise `handoff_page`. A body claiming `agent_token` from the browser is overwritten; there's a test for this.
- The engine defaults a missing `source` to `handoff_page`, so no code path can claim GrokBot without the token.

**C4-03b: my parser change.**
- The whole message is checked for question words, and an explicit `reserve` or `buy` always counts as a request.
- Known safe trade-offs:
  - "When can I reserve a hoodie?" reserves one.
  - "…Not sure yet about colour" reserves nothing.

**D-1: how demand is counted (option B).**
- One customer message adds at most 10 units of unmet demand, which is the smallest supplier minimum.
- Received stock is subtracted from demand, never going below 0.
- Per-customer demand records were rejected because every demo reservation belongs to the one hard-coded customer.

## Low-severity items left open (no test)

- `toggle_pause` has no `eventId` in its type, so if the response is lost and the client retries, the pause flips back.
- `processedEvents` and `eventFingerprints` grow without limit inside the persisted JSON.
- Reservations never expire, and customers can't cancel them.
- Every chat reservation is for the hard-coded customer "Alex Morgan".
