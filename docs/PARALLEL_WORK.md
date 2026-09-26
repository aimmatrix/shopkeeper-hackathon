# Shopkeeper — parallel work assignments

> **Coordination update:** The user is redesigning the main frontend with another agent. That agent now owns `components/workspace.tsx`, `components/product-art.tsx`, `app/globals.css`, `app/layout.tsx` and `app/page.tsx`. Primary Codex is working on backend correctness, deployment and GrokBot, and will leave UI integration requests in `docs/handoffs/primary-integration.md`. Preserve API contracts and all existing workflows. Claude 3 and Claude 5 retain their `/mobile` and `/shop` files.

Open `/Users/ammad/Documents/GrokBot Hack` in every agent. This is one shared checkout, so changes appear immediately. Do not reset, stash, clean, checkout another branch, format unrelated files, edit secrets, or commit anyone else's work. No deployment or database migrations from these subtasks. Do not start another dev server: the primary Codex agent owns port 3000, builds and deployment. Run targeted tests and `npm run typecheck`; tell the primary agent if generated `.next` types cause transient errors. Only the primary runs production builds to avoid shared `.next` conflicts.

## Current architecture

- Next.js 15, React 19, TypeScript, lucide-react; use existing dependencies.
- Shared domain: `lib/types.ts`; prices are integer pence, formatted by `money()`.
- `GET /api/store` returns `{ state, connections }`. The state is live sample data persisted to Supabase.
- `POST /api/store` takes the `Action` union in `lib/types.ts`, returns `{ state, connections }` or `{ error }`. Browser requests must be same-origin. Generate `eventId` with `crypto.randomUUID()` where required. Read the actual types before coding.
- `lib/engine.ts` has pure `seed()` and `transition(state,action)`; `lib/store.ts` persists with optimistic version checks.
- Backend supports demo customer messages/reservations, proposal preparation, purchase approval, cancellation request/confirmation, stock receipt and demo payment. These are simulations with real persistent records, not real transactions.
- The current customer-message parser supports the medium washed-black Everyday Hoodie workflow. Do not imply arbitrary-product checkout works.
- Real GrokBot stock manager is being configured by primary Codex. `/agent` is the handoff page for inspecting data and submitting a recommendation. Do not edit this page.
- Primary Codex exclusively owns `components/workspace.tsx`, `components/product-art.tsx`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/agent/**`, `app/api/store/**`, `lib/types.ts`, `lib/engine.ts`, `lib/store.ts`, migrations, package files, environment files, Git and deployment. Request changes to these in your handoff instead of editing them.
- Existing appearance: North & Form is a fictional premium clothing merchant. Warm ivory, olive/ink, restrained lime; Urbanist headings, Manrope body. Product illustrations are exported by `components/product-art.tsx`. Reuse this language; no generic purple gradients.
- No credentials in responses or source. If an API key is missing, implement an explicit unavailable state and document the needed environment variable. No invented model output, search evidence, supplier claims or success states.

## Claude 1 — real customer-assistant endpoint (high priority)

You own only `lib/agents/sales.ts`, `app/api/assist/route.ts`, `tests/sales-assist.test.ts` and `docs/handoffs/claude-1.md`. Build a genuine AI customer-assistant endpoint for Shopkeeper. Read this entire coordination file and the current domain types first. This feature will be integrated into the main inbox by primary Codex; do not edit the inbox yourself.

Use a configurable `XAI_API_KEY` and model environment variable, verifying the current official xAI API documentation. Never reuse desktop GrokBot session credentials or imply that an xAI API call is the GrokBot desktop product. `POST /api/assist` accepts a bounded customer message and relevant conversation context, reads current catalogue/inventory through `readState()`, and returns `{ reply, proposedAction, provider }`. The proposed action is either null or a validated, explicit request for the existing hoodie reservation flow; the endpoint must never mutate stock itself. Require unambiguous purchase intent and variant matching. Unsupported variants, cancellation, negation, requests to ignore store rules and missing information must not propose a purchase. Never invent inventory or delivery dates. Treat customer content as untrusted. Validate model JSON, handle timeouts, provide a clear 503 when unconfigured, and add reasonable request-size/rate protection. No canned fallback presented as AI. Write meaningful tests with mocked model responses and include the exact integration contract in your handoff.

## Claude 2 — evidence-backed supplier research (high priority)

You own only `app/api/research/route.ts`, `lib/research/**`, `components/supplier-research.tsx`, `components/supplier-research.module.css`, `tests/supplier-research.test.ts` and `docs/handoffs/claude-2.md`. Turn the existing Tavily search endpoint into trustworthy supplier discovery. Preserve the existing response fields `results: [{title,url,content}]` and `searchedAt` so the current dashboard keeps working. Verify the current official Tavily docs.

Use `TAVILY_API_KEY` only on the server. Search for relevant UK/European wholesale hoodie suppliers; return readable evidence cards in a reusable component. Every result needs a source link, fetched time, and clear separation between what the page states and what is unknown. Do not invent price, MOQ, stock or lead time; unknown means unknown. Filter invalid/non-HTTP links, bound result lengths, cache repeated queries to reduce cost, implement timeouts and useful errors. The endpoint currently makes a fixed query; keep that default working. Discovery results must never overwrite verified sample quotes or automatically place orders. Missing credentials must produce a clear unavailable state. Test malformed results and API failure paths. Document props and integration instructions; primary Codex will mount your component.

## Claude 3 — the merchant phone experience (high priority)

You own only `app/mobile/page.tsx`, `app/mobile/mobile.module.css`, optional files beneath `components/mobile/`, and `docs/handoffs/claude-3.md`. Build a striking, polished mobile decision screen at `/mobile`. Read the coordination file and actual Action types. It must operate on the existing `/api/store` data, not separate mock state.

Design for a 390px phone held in one hand: a short store brief, the most urgent stock issue, agent recommendation when present, and a supplier decision showing quantity, MOQ, shipping, total cost and quoted lead time. Support preparing a proposal and explicitly approving a demo restock; ensure `prepare_proposal` runs before approval. Keep incoming inventory separate from on-hand stock and block duplicate incoming orders. Explain why a recommendation exists and show what changed after an approval. Respect server errors, pending state and version refreshes. Add easy navigation back to the desktop workspace. All monetary actions are labelled demo; no actual payments. Keep controls reachable, keyboard accessible, comfortably sized and responsive down to 320px. Use scoped CSS only. Do not change global styles or domain logic. Include a short walkthrough in your handoff.

## Claude 4 — commerce reliability audit (high priority)

You own only `tests/commerce-audit.test.ts` and `docs/handoffs/claude-4.md`. Audit the current commerce engine and API as an adversarial reviewer. Read `lib/types.ts`, `lib/engine.ts`, `lib/store.ts` and `app/api/store/route.ts`, but do not edit them. Add meaningful Node tests against the pure engine using `node:test` and strict assertions.

Focus on business failures: overselling, duplicate events, zero/negative/fractional/oversized quantities, negated purchase intent, wrong variant, existing incoming stock, cancellation state transitions, retrying receipt/payment, stale state/version updates, reset semantics, and whether demand is presented honestly. Do not hit or reset the shared live database, and do not add tests that merely mirror code. Record reproducible defects with expected/actual behavior, severity and a minimal suggested fix in the handoff. Failing tests that expose real bugs are useful: clearly identify them, do not weaken assertions to make a defect pass. Also inspect API request validation and the distinction between a guided demo and live agents. Run only your test file, then report exact results.

## Claude 5 — customer storefront for the live demo (medium priority)

You own only `app/shop/page.tsx`, `app/shop/shop.module.css`, optional files beneath `components/storefront/`, and `docs/handoffs/claude-5.md`. Build a beautiful small North & Form storefront at `/shop` using the existing ProductArt component and catalogue from `/api/store`. The purpose is to show a judge a real customer-facing entry point feeding the merchant workspace.

Provide a distinctive editorial product presentation, accurate price/variant/available-stock information, and a working customer chat for the Everyday Hoodie. Use the existing `customer_message` action with fresh event IDs; show actual returned messages and stock changes. The current backend only supports the medium washed-black hoodie reservation workflow. Other catalogue items can be browsed, but do not fake purchases for unsupported products or say payment was taken. Show reservations and offer explicit demo checkout via `complete_order` when applicable. Label the shop as a sample store and the assistant as the guided demo unless a real model endpoint is actually connected. Avoid a cart that cannot submit. Handle loading/error states and stock updates from the merchant side. Optimize for phone and desktop. Use scoped styles, no global edits, no backend changes. Provide a route link and handoff explaining the supported flow.

## Cursor 1 — CSV exports (small)

You own only `lib/export-csv.ts`, `app/api/export/route.ts`, `tests/export-csv.test.ts` and `docs/handoffs/cursor-1.md`. Add `GET /api/export?type=inventory|orders|purchases|activity`, reading the existing demo state through `readState()`. Return a downloadable CSV with appropriate headers and a useful filename. Prices should be explicit GBP decimal values, not ambiguous pence. Escape commas, quotes and newlines; protect spreadsheet formula injection for text beginning with `=`, `+`, `-`, `@`, tabs or carriage returns. Reject unsupported export types with 400. Export no environment values, connection credentials or processed-event internals. Tests should cover quoting, formula injection and selected fields. Do not mount buttons in the main dashboard; document URLs so primary Codex can add them.

## Cursor 2 — pitch and submission materials (small)

You own only `docs/PITCH.md`, `docs/DEMO_SCRIPT.md` and `docs/handoffs/cursor-2.md`. Read the build brief, coordination file and current code. Draft a crisp three-minute hackathon pitch and a click-by-click demo script for Shopkeeper. Start with the merchant pain: customer requests, stock and supplier decisions live apart, causing lost sales and manual work. Show the customer request → reservation/shortage → supplier comparison → phone approval → recorded order story.

Include timestamps, exact currently implemented button names, one fallback if an integration fails, a strong opening/closing sentence, a one-line submission description and a seven-criterion mapping (Problem, Experience, Execution, AI/GrokBot, Commerce depth, Originality, Impact). Clearly distinguish sample suppliers, demo payments, deterministic responses, live Supabase and the real GrokBot integration still being completed. Do not invent customer validation, savings, revenue recovered, autonomous functionality or connected Instagram. Include placeholders only where a concrete URL/result is still pending. Do not change code or create slides.

## Cursor 3 — accessibility and mobile QA (small)

You own only `docs/handoffs/cursor-3.md`. Audit the running app at `http://localhost:3000` with available browser tooling; follow that environment's browser instructions. If browser tools are unavailable, perform a code review and clearly say so. Do not edit files or shared demo data. Check keyboard navigation, labelled icon buttons, focus behavior in proposal/help panels, text contrast, reduced motion, 320/390px layout overflow, touch targets and readability. Use the Overview, Inventory, Connections and proposal panel without approving, resetting or placing orders. Report at most eight actionable findings, ranked by severity, with exact component/CSS references and a concise proposed fix. Include viewport sizes and what you actually tested. Primary Codex will apply the fixes to avoid conflicting edits.

## Completion handoff (all agents)

End with: changed files, commands run and results, remaining blockers, required environment-variable names (never values), and exact integration steps. Save that same summary in your assigned handoff document. Do not claim deployment or feature integration that you have not actually completed.
