// Shared shapes for supplier discovery. Safe to import from client components.

export const MARKETS = ['uk', 'europe'] as const;
export type Market = (typeof MARKETS)[number];

export const TERM_FIELDS = ['price', 'minimumOrder', 'leadTime', 'stock'] as const;
export type TermField = (typeof TERM_FIELDS)[number];

/**
 * What the page snippet says about one commercial term.
 * `stated` carries a verbatim excerpt from the search snippet — never a parsed or inferred value.
 */
export type StatedTerm = { status: 'stated'; excerpt: string } | { status: 'unknown' };

export type EvidenceCard = {
  // Legacy fields: the current dashboard reads only these three.
  title: string;
  url: string;
  content: string;
  id: string;
  hostname: string;
  /** When ShpKpr fetched this result from Tavily (ISO). */
  fetchedAt: string;
  /** Publication date if the search index reported one, otherwise null (unknown). */
  publishedDate: string | null;
  /** Tavily relevance score 0–1, rounded. Not a quality or trust rating. */
  relevance: number | null;
  terms: Record<TermField, StatedTerm>;
};

export type ResearchResponse = {
  results: EvidenceCard[];
  searchedAt: string;
  market: Market;
  query: string;
  /** True when served from the short-lived server cache; `searchedAt` is still the original fetch time. */
  cached: boolean;
  /** Results dropped because the link was invalid or the page returned no usable text. */
  discarded: number;
  source: 'tavily';
};

export type ResearchErrorCode = 'unavailable' | 'bad_request' | 'forbidden' | 'auth' | 'rate_limited' | 'timeout' | 'upstream' | 'malformed';
export type ResearchError = { error: string; code: ResearchErrorCode };
