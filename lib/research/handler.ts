// Framework-free request handling for POST /api/research, so it can be tested without Next.
import { createSupplierSearch, ResearchFailure } from './search';
import { MARKETS, type Market, type ResearchError, type ResearchResponse } from './types';

type Search = ReturnType<typeof createSupplierSearch>;
type Result = { status: number; body: ResearchResponse | ResearchError };

/** Browser calls must be same-origin; server-to-server calls without an Origin header are allowed. */
export function isAllowedOrigin(origin: string | null, host: string | null, selfOrigin: string): boolean {
  if (!origin) return true;
  try { return origin === selfOrigin || new URL(origin).host === host; } catch { return false; }
}

/** Body is optional. `{}` or no body → the default UK preset. */
export async function parseMarket(readBody: () => Promise<string>): Promise<Market | null> {
  let text = '';
  try { text = (await readBody()).slice(0, 2_000); } catch { return null; }
  if (!text.trim()) return 'uk';
  let body: unknown;
  try { body = JSON.parse(text); } catch { return null; }
  if (!body || typeof body !== 'object') return null;
  const market = (body as { market?: unknown }).market;
  if (market === undefined) return 'uk';
  return MARKETS.includes(market as Market) ? (market as Market) : null;
}

export async function handleResearch(search: Search, input: { origin: string | null; host: string | null; selfOrigin: string; readBody: () => Promise<string> }): Promise<Result> {
  if (!isAllowedOrigin(input.origin, input.host, input.selfOrigin)) return { status: 403, body: { error: 'Supplier research is only available from this workspace.', code: 'forbidden' } };
  const market = await parseMarket(input.readBody);
  if (!market) return { status: 400, body: { error: `Unknown research request. Send {"market": ${MARKETS.map(m => `"${m}"`).join(' | ')}} or an empty body.`, code: 'bad_request' } };
  try {
    return { status: 200, body: await search(market) };
  } catch (error) {
    if (error instanceof ResearchFailure) return { status: error.status, body: error.toBody() };
    return { status: 502, body: { error: 'Supplier search failed unexpectedly. Your sample quotes are unaffected.', code: 'upstream' } };
  }
}
