// Server-side Tavily client for supplier discovery. Never import from client components.
import { LIMITS, toEvidenceCards } from './normalize';
import type { Market, ResearchError, ResearchErrorCode, ResearchResponse } from './types';

const TAVILY_URL = 'https://api.tavily.com/search';

// The UK preset is the dashboard's original fixed query; keep it stable.
export const MARKET_QUERIES: Record<Market, { query: string; country?: string }> = {
  uk: { query: 'UK wholesale heavyweight black hoodies minimum order quantity supplier', country: 'united kingdom' },
  europe: { query: 'European wholesale blank heavyweight black hoodies supplier minimum order quantity EU' },
};

// Marketplaces and social sites are not suppliers; skip them to save result slots.
const EXCLUDED_DOMAINS = ['amazon.co.uk', 'amazon.com', 'ebay.co.uk', 'ebay.com', 'etsy.com', 'pinterest.com', 'pinterest.co.uk', 'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'reddit.com'];

export class ResearchFailure extends Error {
  constructor(public code: ResearchErrorCode, message: string, public status: number) { super(message); }
  toBody(): ResearchError { return { error: this.message, code: this.code }; }
}

type Options = {
  apiKey: string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
};

type CacheEntry = { expires: number; value: ResearchResponse };

export function createSupplierSearch({ apiKey, fetchImpl = fetch, now = Date.now, timeoutMs = 12_000, cacheTtlMs = 15 * 60_000 }: Options) {
  const cache = new Map<Market, CacheEntry>();
  const inflight = new Map<Market, Promise<ResearchResponse>>();

  async function fetchFresh(market: Market): Promise<ResearchResponse> {
    if (!apiKey) throw new ResearchFailure('unavailable', 'Live supplier research is not configured (TAVILY_API_KEY is missing). Your sample quotes are unaffected.', 503);
    const preset = MARKET_QUERIES[market];
    let response: Response;
    try {
      response = await fetchImpl(TAVILY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query: preset.query,
          topic: 'general',
          search_depth: 'basic',
          max_results: LIMITS.results + 2, // headroom for results we discard
          include_published_date: true,
          exclude_domains: EXCLUDED_DOMAINS,
          ...(preset.country ? { country: preset.country } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
    } catch (error) {
      const name = (error as Error)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new ResearchFailure('timeout', `Supplier search timed out after ${Math.round(timeoutMs / 1000)}s. Try again in a moment.`, 504);
      throw new ResearchFailure('upstream', 'Could not reach the supplier search service. Check the connection and try again.', 502);
    }
    if (!response.ok) throw failureForStatus(response.status);
    let data: unknown;
    try { data = await response.json(); } catch { throw new ResearchFailure('malformed', 'Supplier search returned an unreadable response. Try again shortly.', 502); }
    if (!data || typeof data !== 'object' || !Array.isArray((data as { results?: unknown }).results)) {
      throw new ResearchFailure('malformed', 'Supplier search returned an unexpected response. Try again shortly.', 502);
    }
    const searchedAt = new Date(now()).toISOString();
    const { cards, discarded } = toEvidenceCards((data as { results: unknown[] }).results, searchedAt);
    return { results: cards, searchedAt, market, query: preset.query, cached: false, discarded, source: 'tavily' };
  }

  return async function search(market: Market): Promise<ResearchResponse> {
    const hit = cache.get(market);
    if (hit && hit.expires > now()) return { ...hit.value, cached: true };
    const pending = inflight.get(market);
    if (pending) return pending;
    const request = fetchFresh(market)
      .then(value => {
        // Empty answers are often transient upstream blips; don't pin them for the whole TTL.
        if (value.results.length) cache.set(market, { expires: now() + cacheTtlMs, value });
        return value;
      })
      .finally(() => inflight.delete(market));
    inflight.set(market, request);
    return request;
  };
}

function failureForStatus(status: number): ResearchFailure {
  if (status === 401 || status === 403) return new ResearchFailure('auth', 'The supplier search service rejected the configured API key. Check TAVILY_API_KEY.', 502);
  if (status === 429 || status === 432 || status === 433) return new ResearchFailure('rate_limited', 'Supplier search usage limit reached. Try again later; your sample quotes are unaffected.', 429);
  if (status === 400 || status === 422) return new ResearchFailure('upstream', 'The supplier search service rejected the request.', 502);
  return new ResearchFailure('upstream', `Supplier search is temporarily unavailable (status ${status}). Your sample quotes are unaffected.`, 502);
}
