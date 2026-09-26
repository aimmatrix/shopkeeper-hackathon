# Cursor 1 — CSV exports

Route exists and was exercised against the running demo. Dashboard buttons were **not** mounted (`components/workspace.tsx` is owned by primary Codex). This slice is **not deployed**.

## URLs for primary Codex

Same-origin GET. `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`, `Cache-Control: no-store`. Filename `north-and-form-{type}-{YYYY-MM-DD}.csv` (UTC date).

| Label suggestion | href |
| --- | --- |
| Download inventory CSV | `/api/export?type=inventory` |
| Download orders CSV | `/api/export?type=orders` |
| Download purchases CSV | `/api/export?type=purchases` |
| Download activity CSV | `/api/export?type=activity` |

Unsupported `type` → **400** `{ "error": "Unsupported export type. Use inventory, orders, purchases or activity." }`  
`readState()` failure → **503** `{ error }` (same shape as `GET /api/store`).

Prices are GBP pounds with two decimals (`6800` → `68.00`). Selected columns:

- **inventory:** Product ID, Name, Variant, SKU, Price (GBP), Cost (GBP), On hand, Reserved, Available, Demand, Daily sales, Lead days, Kind
- **orders:** Order ID, Product ID, SKU, Product, Quantity, Total (GBP), Customer, Status — no `eventId`
- **purchases:** Purchase ID, Product ID, SKU, Product, Quote ID, Supplier, Country, Quantity, Total (GBP), Status, Created at
- **activity:** Activity ID, Owner, Title, Detail, Recorded at

Not exported: `processedEvents`, `version`, `proposalReady`, `paused`, `agentReport`, messages, quote notes, `connections()`, environment values, product tone. Formula-prone text (`= + - @` tab CR) is prefixed with `'` and quoted. UTF-8 BOM included for Excel.

---

## Completion summary

### Changed files
- `lib/export-csv.ts`
- `app/api/export/route.ts`
- `tests/export-csv.test.ts`
- `docs/handoffs/cursor-1.md`

### Commands run and results
- `node --import tsx --test tests/export-csv.test.ts` — 9 passed, 0 failed (re-run on `codex/shopkeeper`)
- `npm run typecheck` — passed. Generated `.next` types already include `/api/export`; no transient type errors for primary
- Smoke on the existing port 3000 process (no new dev server): `GET /api/export?type=inventory` → 200, `filename="north-and-form-inventory-2026-09-26.csv"`, live GBP decimals (`68.00`, `22.00`). `GET /api/export?type=quotes` → 400 unsupported-type JSON

Not run: production build, deploy, database migration, git commit.

### Remaining blockers
None for this slice. Export is not wired into the main dashboard UI.

### Required environment-variable names
None new. The route only calls existing `readState()`, which already uses `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY` (and optional `SHOPKEEPER_WORKSPACE_KEY`). Missing those in development falls back to local file storage; that is existing store behaviour, not an export-specific requirement.

### Exact integration steps (primary Codex)
1. In `components/workspace.tsx`, add four same-origin `<a href>` links using the URLs above (Overview or Connections). The attachment header triggers download; no POST and no extra headers.
2. Do not reimplement CSV generation in the workspace. Import nothing from `lib/export-csv.ts` in the client unless you want labels only — the hrefs are enough.
3. Do not mount this from `/agent`. Leave production build and deploy to the primary stream.
4. No migration and no package change.
