# Claude 2 handoff: evidence-backed supplier research

## Update: done at the user's request (outside my original file list)

- **`.env.local`**: added `TAVILY_API_KEY` (the file is gitignored). The running dev server picked it up; `/api/research` returns live results. Also added to Vercel (`shopkeeper-hackathon`) for Production, Preview and Development as an encrypted var; it takes effect on the next deployment.
- **`components/workspace.tsx`**: the old research `<section>` and results grid in the suppliers view were replaced with `<SupplierResearch />`. Removed the now-unused `SearchResult` type, the `research`/`researching` state, `findSuppliers()` and the `ExternalLink` import. No other lines touched. Primary Codex, please re-read this file before your next edit.
- Checked in the browser at 1440px (6 live cards) and at 375px (no horizontal overflow).
- The `.research-section` / `.research-results` rules in `app/globals.css` are now unused. I left them for primary Codex to delete.

## What changed

| File | Purpose |
| --- | --- |
| `app/api/research/route.ts` | Thin Next wrapper. One search client per server instance, so the cache is shared. |
| `lib/research/types.ts` | `EvidenceCard`, `ResearchResponse`, `ResearchError`, `Market`. Client-safe. |
| `lib/research/normalize.ts` | Validates untrusted Tavily output: http(s)-only links, length bounds, dedupe, verbatim term quoting. Client-safe. |
| `lib/research/search.ts` | Server-only Tavily client: presets, 12s timeout, 15-min cache, in-flight dedupe, error mapping. |
| `lib/research/handler.ts` | Framework-free request handling (origin check, body parsing) so it's testable. |
| `components/supplier-research.tsx` + `.module.css` | Reusable evidence-card UI with idle, loading, unavailable, error, empty and results states. |
| `tests/supplier-research.test.ts` | 13 tests: malformed results, unsafe URLs, bounds, verbatim terms, cache, every upstream failure path, origin, no store access. |

Verified against the official Tavily Search API docs (`POST https://api.tavily.com/search`, Bearer auth, `country` with `topic: general`, `exclude_domains`, `include_published_date`; errors 400/401/422/429/432/433/5xx). Also checked with a live key: both presets return 6 cards, and a repeat query is served from cache in 0 ms.

## API contract (backwards compatible)

`POST /api/research`. An empty body works exactly as before (the original fixed UK query). An optional body `{"market": "uk" | "europe"}` picks a preset. Free-text queries are deliberately **not** accepted (cost and abuse); unknown fields are ignored.

Success `200`:
```ts
{
  results: EvidenceCard[];   // each still has title, url, content (the legacy dashboard keeps working)
  searchedAt: string;        // ISO. Original fetch time, even when cached.
  market: 'uk' | 'europe'; query: string; cached: boolean;
  discarded: number;         // dropped for bad link or no readable text
  source: 'tavily';
}
EvidenceCard = { id, title, url, content, hostname, fetchedAt, publishedDate: string | null, relevance: number | null,
  terms: { price, minimumOrder, leadTime, stock } }   // each: { status: 'stated', excerpt } | { status: 'unknown' }
```
`excerpt` is always verbatim text from the page snippet. We never parse or infer numbers. Questions, table headers and vague marketing copy stay `unknown`.

Errors are `{ error: string, code }`. The existing `data.error` handling keeps working.

| code | HTTP | when |
| --- | --- | --- |
| `unavailable` | 503 | `TAVILY_API_KEY` not set (Tavily is never called) |
| `forbidden` | 403 | cross-origin browser request |
| `bad_request` | 400 | malformed JSON or unknown market |
| `auth` | 502 | Tavily rejected the key |
| `rate_limited` | 429 | Tavily 429/432/433 |
| `timeout` | 504 | no response in 12s |
| `upstream` / `malformed` | 502 | Tavily error or unreadable body |

Failures and empty answers are not cached (a transient empty Tavily response was once pinned for 15 min in prod). The key never appears in responses or errors.

## Environment

`TAVILY_API_KEY`: server only, already listed in `.env.example`. Set in `.env.local` and in Vercel (all environments); needs a redeploy to take effect.

## Mounting the component (primary Codex, `components/workspace.tsx`)

```tsx
import { SupplierResearch } from './supplier-research';
// in the suppliers view, replace the whole `.research-section` block and the `research && <div className="research-results">…` block with:
<SupplierResearch />
```
Then `research`, `researching`, `findSuppliers`, the `SearchResult` type and the `.research-section` / `.research-results` CSS in `globals.css` can be deleted.

Props (all optional):

| prop | type | default | notes |
| --- | --- | --- | --- |
| `defaultMarket` | `'uk' \| 'europe'` | `'uk'` | first preset selected |
| `endpoint` | `string` | `'/api/research'` | must be same-origin |
| `onResults` | `(r: ResearchResponse) => void` | none | read-only hook; never write results into quotes or orders |
| `className` | `string` | none | appended to the root `<section>` |

The component runs nothing on mount; the user clicks "Research suppliers". It has no action that changes store state. Its only outbound actions are "Open source" links (`rel="noopener noreferrer"`). A test enforces that `lib/research/**`, the route and the component never import `lib/store`, `lib/engine` or `/api/store`.

## Notes / not done

- The cache is per server instance (in memory, 15 min, 2 keys max). Enough to stop repeat clicks from burning credits; it doesn't persist across cold starts.
- Results can include how-to articles or print-on-demand services (e.g. Printful), not just wholesalers. The notice banner says every result is unverified. I didn't add a classifier that would pretend otherwise.
- `npm run typecheck` currently fails only on `app/shop/page.tsx` (missing `@/components/storefront/storefront`), another agent's in-progress work.
