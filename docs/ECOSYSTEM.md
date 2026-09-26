# Shopkeeper ecosystem

## Current product
One shared merchant workspace connects customer interest, inventory, a stock recommendation and a recovery draft. The user's Claude session owns the Fleek-inspired main frontend; primary Codex owns these integrations. Branding alone is not a Fleek integration.

Public demo: https://shopkeeper-hackathon.vercel.app  
Recovery Desk: https://shopkeeper-hackathon.vercel.app/recovery  
Phone approval: https://shopkeeper-hackathon.vercel.app/mobile

## Roles and verified behavior
- **Wassist WhatsApp Concierge:** calls the live catalogue before factual stock/price answers. With explicit permission, its second tool records an exact product and quantity in the shared database. This records interest, not a reservation or notification subscription.
- **GrokBot Stock Manager:** uses `/agent` to compare sample suppliers and save a recommendation. Its verified recommendation is 20 hoodies from North Thread for £452 including shipping. Only the merchant approves the demo purchase.
- **GrokBot Sales & Recovery Manager:** reads `/recovery`, chooses an actual request, and saves a follow-up draft plus rationale through the browser handoff. The form does not authenticate authorship; proof that GrokBot performed the action comes from the observed bot session and matching saved record.
- **Merchant:** approves sample spending on `/mobile`; reviews recovery drafts when inventory permits. “Reviewed” does not mean “sent.”
- **Supabase:** shared inventory, requests, drafts and action history, with optimistic version writes.
- **Tavily:** live supplier discovery with source evidence. Discovered pages are not verified offers.

## Verified walkthrough
1. Wassist internal test #2 asked to record interest in two medium washed-black Everyday Hoodies.
2. The managed agent called the live catalogue, then `shopkeeper_record_interest`. It saved request `7546f60725349ba3f3516952`. The deployed Recovery Desk showed 1 available, 0 incoming and £136 potential value. No payment or reservation occurred.
3. The second GrokBot read the public recovery page and saved a draft and rationale. The page confirmed persistence and showed “Awaiting merchant review · not sent.” Review caught an invented customer name, which was corrected and re-saved through GrokBot. The verified draft now starts “Hi there”; its rationale explicitly says customer identity is unspecified. GrokBot also saved the standing rule not to infer names from other records.
4. A separate request starting `059aa66b` was created using **Add sample request** to verify the clearly labelled rehearsal fallback. It is not a real customer or a Wassist call.

The Wassist tests were internal simulated conversations. They prove managed agent → authenticated endpoint → Supabase → merchant view. Physical WhatsApp testing remains with the user; do not claim an actual customer or phone test until confirmed.

## Try it on a phone
Open https://wa.me/447424845871?text=/connect:d289040e-b827-44f4-98e9-eba4783ebd69 and send the prefilled connection message. Ask for live stock, then explicitly say: “Please record my interest in two Everyday Hoodies in washed black, medium, for merchant review.” The request should appear at `/recovery` within five seconds.

## Technical boundaries
- `GET /api/catalogue` returns customer-safe product facts and policies, without messages, orders, supplier costs or channel identities.
- `POST /api/wassist/requests` requires a dedicated server-held bearer token plus Wassist's injected contact/conversation headers. The language model does not choose contact identity. IDs are HMAC-pseudonymised before persistence; no phone numbers or message transcripts are stored.
- Repeating the same contact/product/quantity returns the existing request without increasing demand. A different quantity on an existing request requires merchant review rather than silently inflating demand.
- Recovery data lives in the existing approved demo state; no new Supabase tables were needed. Old states without `stockRequests` remain compatible.
- The generic store endpoint rejects recovery actions; dedicated routes assign identity and provenance.
- Draft review requires sufficient current stock and rejects changes since drafting. Incoming stock is excluded. Multiple requests may refer to the same available units because they are expressions of interest, not allocations; future sending/reservation must recheck inventory.
- The public merchant demo is intentionally shared and login-free. Same-origin checks are CSRF protection, not merchant authentication. Do not use it for real customer data.
- `WASSIST_API_KEY` stays in ignored `.env.local`. The generated `WASSIST_TOOL_TOKEN` is configured in the existing Vercel project and the scoped Wassist tool. Neither is a frontend variable. Agent metadata is ignored under `.data/`.
- The user explicitly approved the public demo after the earlier protection change. Vercel Standard Protection leaves the production alias public and protects previews/generated deployment URLs. All Deployments protection would break the catalogue and request tools.

## What remains unimplemented
Direct WhatsApp reservations, live payments, supplier communication, Instagram, scheduled recovery sending and automatic triggering between GrokBots are not connected. Checkout, purchases and receipt are simulated. The next product decision is whether to add an explicit merchant-approved reply to the tester's sandbox conversation; this requires confirmed phone routing and a separate sending action.

Fleek-specific sourcing can later describe bundles, grades, size mixes and landed cost. Existing medium-black hoodie quotes are samples, not authentic Fleek listings.

## Checks
83 tests passed, including identity separation, duplicate requests, quantity bounds, pause, incoming inventory, draft persistence, stale review and authentication. Typecheck and production build passed. Live testing verified both Wassist tools, public recovery rendering, saved GrokBot draft and 401 rejection of an unauthenticated tool write.

## Official references
- https://docs.wassist.app/quickstart
- https://docs.wassist.app/guides/configure-tools
- https://support.joinfleek.com/hc/en-us/articles/10147758542747-What-is-Fleek
