# Primary Codex integration handoff

## Latest release — public demo approved, 12:40 BST
The user explicitly approved making the fictional demo public after the earlier All Deployments protection change. Current production: https://shopkeeper-hackathon.vercel.app, deployment `dpl_4Qq8a39qmAUucjMpdzjUDQ3Xb1ka`. Standard Protection (`prod_deployment_urls_and_all_previews`) leaves this production alias public and protects preview/generated URLs. Keep this setting: Wassist needs the public catalogue. This supersedes the older protected-production status below.

Wassist now calls `/api/catalogue` and returned the correct live hoodie stock (1) and price (£68) in an internal simulation. Phone testing is requested from the user. No WhatsApp reservation writes or recovery sending exist yet. The second GrokBot is created and scoped; it has not yet saved a recovery plan. See `docs/ECOSYSTEM.md`. Production build and 75 unit tests passed.


## Ownership
The user is redesigning the main frontend. That agent owns the dashboard, product art, global CSS, layout and homepage. Primary Codex owns backend integration and deployment. `/mobile` and `/shop` stay with their original agents. Do not overwrite concurrent work.

## Backend changes completed
- Runtime validation rejects malformed actions and missing/non-string event IDs.
- An event reused with a different payload fails instead of returning false success. Reset preserves processed-event history.
- Negation, enquiries, unsupported variants and invalid quantities have regression coverage; quantities are matched near the product name.
- Catalogue ordering no longer decides which item gets reserved or reordered.
- Agent reports and approvals respect pause; approval consumes its proposal. Incoming stock continues to block duplicate purchases, including pending cancellations.
- One message adds at most ten units to the demo shortage counter. Receiving stock reduces that counter, without treating the interest as paid sales.
- Opening reservations now have four explicit sample order records in a freshly seeded/reset store. Existing shared data is not reset by deployment. Its missing opening reservation records were reconciled once with a version check (v12 → v13); the GrokBot report and all purchases were preserved. The storefront reservation tray filters to Alex Morgan so other sample reservations do not appear as the customer's own.
- Agent bearer credentials can submit recommendations only, even if the caller supplies a matching Origin header. Browser access is an intentionally shared sample demo, not merchant authentication.
- Store API returns 409 for optimistic-write conflicts, 503 for persistence failures and 400 for malformed JSON. Requests are bounded to 16 KB.
- All 35 engine/audit checks pass as hard assertions; no TODO exemptions. The broader suite currently has 67 passing tests; all four mobile decision tests also pass.

## Frontend integration requests
1. Preserve `GET/POST /api/store`, the Action union, pending/error states and event IDs. Keep purchase approval explicit and labelled as a demo.
2. Add links to `/shop`, `/mobile`, and `/api/export?type=inventory|orders|purchases|activity`.
3. Preserve the mounted `SupplierResearch` component. It distinguishes live web evidence from sample supplier quotes.
4. Preserve `state.agentReport` display and its supplier/quantity selection in the approval flow. The `/agent` page saves recommendations only. A report submitted through this browser handoff does not cryptographically prove which person or agent filled it in; do not present it as an authenticated GrokBot API event.
5. Preserve actual incoming/on-hand/reserved distinctions. A purchase approval adds incoming stock only.
6. Read `docs/handoffs/cursor-3.md`: fix 320px hero overlap, dialog focus containment, small text/contrast and inventory action visibility while redesigning.
7. The unused xAI assistant endpoint (`/api/assist`) was deleted on 2026-09-26; its rate limiter now lives in `lib/rate-limit.ts`. The guided customer chat is not live AI; do not relabel it.
8. `proposalReady` now becomes false on approval. After receiving/cancelling, prepare a new proposal before approving another purchase.

## Deployment
The Vercel preview project is `shopkeeper-hackathon`; its Supabase URL, publishable key and scoped workspace key are configured as sensitive preview variables. Preview deployments currently require Vercel authentication or a temporary sharing link. Do not put temporary sharing tokens in source or docs.

**Production update (Claude 4, added at the user's request, 2026-09-26 12:24 BST).** The production alias is no longer an older shell:
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SHOPKEEPER_WORKSPACE_KEY` and `TAVILY_API_KEY` are set for Production as well as Preview. `SHOPKEEPER_AGENT_TOKEN` isn't set in any environment.
- Claude 4 ran `vercel deploy --prod` from this checkout. The deployment is `shopkeeper-hackathon-o0wfffi7p-muhammads-projects-6598a55c.vercel.app` (Ready), aliased to https://shopkeeper-hackathon.vercel.app. Before deploying, `npm test` (72/72), the mobile insights tests (4/4), `npm run typecheck` and an isolated `next build` all passed.
- The deployment includes the store API access rules (`lib/store-access.ts`: per-client rate limits, with resets capped at 3 per 10 minutes per client) and the server-set `agentReport.source` label.
- **It's no longer public.** At the user's request, Claude 4 changed the project's Deployment Protection from Standard (`ssoProtection.deploymentType: "all_except_custom_domains"`, which left the production domain open) to **All Deployments** (`"all"`) on 2026-09-26. The Vercel API accepted it on the Hobby plan.
  - `/`, `/agent`, `/mobile`, `/shop` and `GET /api/store` on https://shopkeeper-hackathon.vercel.app now redirect to Vercel sign-in (302).
  - A POST that copied the production Origin returned 401 and changed nothing.
  - Viewers now need Vercel sign-in or a temporary sharing link, the same as previews. GrokBot's browser handoff (`/agent`) needs one too.
- **It reads and writes the same Supabase store as the preview.** A read-only check showed v13 with the GrokBot report and a consistent reservation ledger. Don't reset the shared store: that would delete the GrokBot report.
- **To make it public again for judging:** set Deployment Protection back to Standard in Project Settings. Or keep it protected and hand out a temporary sharing link. Either way, choose production or preview as the single demo URL.

GrokBot Stock Manager received the approved temporary preview link and saved its recommendation to Supabase at 2026-09-26 11:06:38 UTC: North Thread, 20 hoodies, GBP452 including shipping, GBP48 below the budget. Database version 12 first contained the report and no purchase orders; version 13 additionally reconciles the sample opening reservation ledger. GrokBot compared East London and Porto and separated interest from paid demand. This verifies the browser handoff writing to the live sample database, without approving a purchase. The user approved the Tavily credential transfer. TAVILY_API_KEY is now stored as a sensitive server-only variable in the Vercel preview environment; the deployment containing it passed its build. Hosted verification succeeded through the real Suppliers & orders → Research suppliers UI at 12:17 London time: six live Tavily source cards appeared, including source links, fetched timestamps, stated terms and explicit unknown values.

## Demo boundaries
All catalogue/customer records, supplier quotes, purchase orders and checkout are fictional sample data. Supabase persistence is real. Tavily research is real when configured. Instagram, supplier emails and actual payments are not connected. Avoid claiming measured savings, recovered revenue, or full autonomy.

The report was also verified visibly in both the merchant Overview and `/mobile`. Mobile selects North Thread and quantity 20, with GBP452 shown before approval. The live sample still has no purchase order, ready for the merchant approval moment.

Latest verified preview build: https://shopkeeper-hackathon-fmzj6vt1f-muhammads-projects-6598a55c.vercel.app (2026-09-26). Vercel build, type checking, all routes passed. Sign-in or a temporary share link is required. The GrokBot handoff used an earlier preview against the same Supabase store, so its report is visible in this deployment too.

Hosted Tavily verification completed on preview fmzj6vt1f. The CLI verification attempt timed out in automatic approval review; verification was completed through the supported browser UI using a temporary Vercel share link. No additional approval is pending for this integration.

## Recovery slice (primary Codex, current work)
Added `/recovery`, `/api/recovery`, `/api/wassist/requests`, `lib/commerce/recovery.ts` and `lib/commerce/wassist.ts`. Shared types/engine now support separate stock requests and saved recovery drafts. The generic store API rejects these new actions; their dedicated routes assign channel/provenance. No customer transcript, phone number or Wassist ID is stored—only a keyed contact reference. Repeated contact/product requests are idempotent and do not increase shortage twice. Draft review checks live availability and rejects stale drafts. No outbound sends or reservations occur through this tool.

83 tests and typecheck passed. Production build `dpl_86WAj884NTvYsjFJH5dx2DSFgx5S` passed. Generated `WASSIST_TOOL_TOKEN` is configured server-only for this endpoint and the corresponding Wassist API tool. Never expose it to the frontend or reuse the Supabase workspace key for tool authentication.

**Frontend agent:** please add a prominent link to `/recovery` in the redesigned merchant workspace. Primary Codex has not modified your main frontend files. Preserve the existing `/agent`, `/mobile`, `/shop` routes. The new recovery page has its own scoped CSS.


### Recovery release verified (26 September, 13:05 BST)
Latest production `dpl_Bud28y6V2nCTeFmD6enSGs7tWuEY`, public alias unchanged. Build passed. Wassist internal simulation successfully recorded request `7546f60725349ba3f3516952`, which appeared in `/recovery`. An unauthenticated POST returned 401. GrokBot Sales & Recovery Manager opened the page, saved a draft, then corrected an invented sample customer name after review. The final persisted draft begins “Hi there” and explains no identity is known. This verifies both GrokBots' separate browser handoffs. No messages were sent, stock reserved, or purchases approved during this recovery slice. A separate clearly labelled sample request `059aa66b…` also remains for rehearsal.

The endpoint and managed agent are connected; physical WhatsApp testing is still awaiting the user's confirmation. No automatic bot-to-bot trigger or outbound recovery sending is implemented.
