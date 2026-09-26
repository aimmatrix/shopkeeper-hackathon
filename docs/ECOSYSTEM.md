# Shopkeeper ecosystem: demand to replenishment to recovery

## Product decision
Keep one merchant operating workspace. Extend the working stock flow with WhatsApp intake and a second GrokBot responsible for sales recovery. Fleek-inspired design remains with the user's Claude session. Branding alone is not a Fleek integration.

## Roles
- **Wassist / WhatsApp:** customer-facing channel. Inbound messages, product questions and reply delivery. Its agent or our handler must read current inventory rather than answer from a stale uploaded catalogue.
- **GrokBot Stock Manager:** existing working browser handoff. Evaluates stock shortages and supplier quotes; saves a recommendation. Merchant approval creates a demo purchase.
- **GrokBot Sales & Recovery Manager:** reviews actual unfulfilled requests, matches them to available inventory, and prepares relevant follow-up drafts and next actions. Incoming inventory is not available inventory. Sends no external messages without explicit approval and channel setup.
- **Merchant:** approves spending from `/mobile` and reviews outward-facing drafts.
- **Supabase:** shared records and action history, including provenance and duplicate-event protection.
- **Tavily:** live supplier research with source evidence; discovered pages are not verified quotes.

## Main demo
1. A tester asks for a product on WhatsApp via the Wassist sandbox.
2. The request reaches the shared store; only actual available stock can be reserved.
3. Stock Manager reviews the shortage and recommends a supplier with full landed cost.
4. Merchant approves the sample restock from a phone.
5. After demo delivery is confirmed, Sales & Recovery Manager prepares a follow-up for the recorded unfulfilled request.
6. The merchant reviews the message; a sandbox reply closes the loop only after test-conversation delivery is authorized and implemented.

Steps 2–6 involving WhatsApp writes or recovery remain proposed. Wassist now answers product questions through the live catalogue; its direct reservations and recovery messaging are not implemented.

## Scope
The next priority is one working inbound WhatsApp conversation tied to the existing stock workflow. A second agent must produce a stored, reviewable recovery plan rather than duplicate the WhatsApp chatbot. Defer general-purpose marketing, refunds, accounting and multi-channel inboxes until the core loop works.

Fleek-specific sourcing can later describe bundles, condition/grade, size mixes and landed cost. Existing medium-black hoodie quotes are a sample retail scenario; they are not authentic Fleek listings. Do not imply that buying a vintage bundle guarantees interchangeable sizes or condition.

## Integration prerequisites
Wassist account/sandbox access and developer configuration. The official documentation supports a shared test number and managed-agent or signed-webhook routing. Verify the exact webhook signature and message schemas before implementing an adapter. Use event IDs for duplicate delivery, separate contact/conversation identities, and never route all WhatsApp users into Alex Morgan's guided demo identity.

Public webhooks cannot rely on a temporary Vercel browser share cookie. Provide a reachable, authenticated webhook endpoint before subscribing Wassist. Keep all service keys on the server. Do not change an existing business number's routing; use the hackathon sandbox/test conversation only.

## Current verified foundation
Supabase persistence, stock reservations, supplier comparisons, Tavily web evidence, GrokBot stock recommendation and mobile demo approvals work. Checkout, supplier orders and delivery are simulated. No real supplier communication, Instagram connection or live payments are configured.

## Official sources
- https://wassist.app/
- https://docs.wassist.app/
- https://docs.wassist.app/quickstart
- https://support.joinfleek.com/hc/en-us/articles/10147758542747-What-is-Fleek

## Setup progress
The user supplied a Wassist API key, stored only in ignored `.env.local` as `WASSIST_API_KEY`. The API returned 200; a new Shopkeeper WhatsApp Concierge was created. Its metadata is in ignored `.data/wassist-agent.json`. Do not commit keys or raw account responses.

A second GrokBot named Shopkeeper Sales & Recovery Manager is created with saved instructions to work only on this demo, prepare drafts and avoid external sending.

`GET /api/catalogue` exposes customer-safe live stock and prices, with three passing tests covering confidentiality, incoming stock and pause. `scripts/configure-wassist.mjs` verifies that endpoint is publicly accessible before configuring the Wassist concierge's read-only live-stock tool. Existing API tools are preserved.

This first Wassist slice can answer product questions from live stock and link to the sample storefront. It does not yet create reservations directly from WhatsApp, receive inbound webhooks, or send recovery campaigns. Those must not be demonstrated as completed.

## Verified public release — 26 September, 12:40 BST
The user explicitly approved the public demo after the earlier protection change. The canonical URL is https://shopkeeper-hackathon.vercel.app. Production uses the approved scoped Supabase settings and Tavily key. Vercel Standard Protection now keeps previews and generated deployment URLs protected while the production alias is public. Do not turn All Deployments protection back on without a new user request; it breaks the Wassist catalogue tool.

Wassist agent `d289040e-b827-44f4-98e9-eba4783ebd69` is configured with the active `shopkeeper_live_catalogue` GET tool. API credentials remain local; the catalogue returns only sample product facts and policies. An internal Wassist simulation successfully called the deployed endpoint and replied “1 in stock” and “£68” for the medium washed-black Everyday Hoodie, matching Supabase v13. This verifies agent → public API → database; a physical WhatsApp test remains with the user.

Phone test: https://wa.me/447424845871?text=/connect:d289040e-b827-44f4-98e9-eba4783ebd69. Send the prefilled connect message, then ask about the medium black hoodie. The agent is read-only and links to `/shop` for demo reservations. No WhatsApp contact is written into Alex Morgan’s sample order history.

Production build passed. The latest unit suite has 75 passing tests. Public dashboard verification loaded the real saved GrokBot report and stock ledger. Main frontend files were not changed by this integration slice.

The second internal simulation asked for two hoodies and next-day delivery. Wassist fetched the catalogue again, stated only one was available, declined to claim a WhatsApp reservation and did not promise tomorrow delivery. Both test turns produced successful API tool executions; neither mutated store state.
