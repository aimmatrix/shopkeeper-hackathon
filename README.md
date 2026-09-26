# Shopkeeper

A merchant workspace connecting customer requests, inventory shortages, supplier research and restock approval from a phone. Built for the Merchant Tooling hackathon track.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

With blank connection variables, local development uses a sample JSON store under `.data/`. To use the already provisioned hackathon Supabase store, retain the existing `.env.local`; do not overwrite it. Hosted deployments require Supabase and the scoped workspace key. Never expose these values in client code or commit environment files.

## Routes

- `/` — merchant workspace
- `/shop` — sample storefront and guided customer chat
- `/mobile` — merchant restock decisions
- `/agent` — GrokBot browser handoff: inspect records and save a recommendation
- `/api/store` — sample state and commerce actions
- `/api/research` — Tavily supplier evidence, requiring `TAVILY_API_KEY`
- `/api/export?type=inventory` — CSV exports; also `orders`, `purchases`, `activity`

## Verification

```sh
npm run typecheck
npm test
node --import tsx --test components/mobile/insights.test.ts
npm run build
```

While several agents share this checkout, only the primary agent runs builds or deployment. File ownership is in `docs/PARALLEL_WORK.md`. Feature contracts, tests and remaining integration work are in `docs/handoffs/`.

## What the demo does

Reservations reduce available inventory immediately without changing on-hand units. Explicit merchant approval records an incoming purchase including shipping and respecting minimum order quantities. Cancellation remains pending until supplier confirmation is simulated; delivery adds stock exactly once. Demo checkout records a sample sale and releases its reservation. Customer interest is separate from paid sales.

Supplier quotes, customer history, purchases and payments are simulated. Supabase persistence and configured Tavily searches are live. GrokBot uses the browser handoff pages (`/agent`, `/recovery`) to save recommendations and drafts; it never approves a purchase. No Instagram account, supplier messaging or real payment processor is connected.

The hosted app is a shared fictional demo, not a production multitenant merchant service. Origin checks protect browser request boundaries, not user identity. A real deployment would additionally require merchant sessions, customer ownership checks, durable rate limits and tenant isolation.

See `docs/PITCH.md` and `docs/DEMO_SCRIPT.md` for presentation materials. Their numbers assume a freshly reset store; a reset affects the shared sample workspace.
