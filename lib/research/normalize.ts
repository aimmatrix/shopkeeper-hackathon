// Pure helpers that turn untrusted search output into bounded, honest evidence cards.
// Safe to import from client components (no server-only APIs).
import { TERM_FIELDS, type EvidenceCard, type StatedTerm, type TermField } from './types';

export const LIMITS = { title: 140, content: 600, excerpt: 220, url: 2048, results: 6 } as const;

/** Returns a normalised http(s) URL, or null for anything else (javascript:, data:, credentials, garbage). */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > LIMITS.url) return null;
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { return null; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.username || parsed.password || !parsed.hostname.includes('.')) return null;
  parsed.hash = '';
  return parsed.toString();
}

export function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Strips markdown/control noise from a snippet and collapses whitespace. */
export function cleanSnippet(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\[\s*(\.\.\.|…)\s*\]/g, '…')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_`]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tavily joins page chunks with "…" and sometimes repeats them; keep each chunk once. */
function dedupeChunks(text: string): string {
  const seen = new Set<string>();
  return text.split(/\s*…\s*/).filter(chunk => {
    const key = chunk.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' … ');
}

// Each pattern only decides WHICH text to quote. We never extract or parse numbers from it.
// Patterns require something concrete (a figure or an explicit "no minimum") so vague marketing copy stays unknown.
const TERM_PATTERNS: Record<TermField, RegExp> = {
  price: /(£|€|\bgbp\b|\beur\b)\s?\d|\d(\.\d+)?\s?(£|€|\bgbp\b|\beur\b)/i,
  minimumOrder: /\b(moq|min(imum|\.)?\s*(order|quantit(y|ies))s?)\b[^.]{0,60}?\d|\d[^.]{0,30}?\b(moq|minimum)\b|\bno minimums?\b|\bno moq\b/i,
  leadTime: /\blead[- ]?times?\b[^.]{0,60}?\d|\b(next|same)[- ]day (delivery|dispatch|shipping)\b|\b(dispatch(ed)?|ships?|deliver(y|ed)|turnaround)\b[^.]{0,40}?\b\d+\s*(-|to|–)?\s*\d*\s*(working |business )?(days?|weeks?)\b/i,
  stock: /\bin[- ]stock\b|\bhold stock\b|\bstock of\b|\bready to (ship|print|dispatch)\b|\bout of stock\b/i,
};

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+|\s+[•·|]\s+|\s\|\s?/).map(s => s.trim()).filter(Boolean);
}

/** Quotes the sentence, or a word-aligned window around the match when the sentence is a long run-on. */
function excerptAround(sentence: string, index: number): string {
  if (sentence.length <= LIMITS.excerpt) return sentence;
  let start = Math.max(0, index - 70);
  let end = Math.min(sentence.length, start + LIMITS.excerpt - 2);
  if (start > 0) start = sentence.indexOf(' ', start) + 1 || start;
  if (end < sentence.length) end = sentence.lastIndexOf(' ', end) > index ? sentence.lastIndexOf(' ', end) : end;
  return `${start > 0 ? '…' : ''}${sentence.slice(start, end).trim()}${end < sentence.length ? '…' : ''}`;
}

/** For each commercial term, quotes the first snippet statement that mentions it, else `unknown`. Questions never count. */
export function statedTerms(text: string): Record<TermField, StatedTerm> {
  const parts = sentences(text).filter(s => !s.endsWith('?'));
  const out = {} as Record<TermField, StatedTerm>;
  for (const field of TERM_FIELDS) {
    let found: StatedTerm = { status: 'unknown' };
    for (const part of parts) {
      const match = TERM_PATTERNS[field].exec(part);
      if (match) { found = { status: 'stated', excerpt: excerptAround(part, match.index) }; break; }
    }
    out[field] = found;
  }
  return out;
}

function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * Validates raw Tavily results. Drops entries with unsafe links, no usable text, or duplicate URLs.
 * `raw` is treated as completely untrusted.
 */
export function toEvidenceCards(raw: unknown, fetchedAt: string, limit: number = LIMITS.results): { cards: EvidenceCard[]; discarded: number } {
  const items = Array.isArray(raw) ? raw : [];
  const cards: EvidenceCard[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  for (const item of items) {
    if (cards.length >= limit) break;
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const url = safeHttpUrl(record.url);
    const text = dedupeChunks(cleanSnippet(record.content));
    if (!url || text.length < 20 || seen.has(url)) { discarded++; continue; }
    seen.add(url);
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const title = clampText(cleanSnippet(record.title) || hostname, LIMITS.title);
    const score = typeof record.score === 'number' && Number.isFinite(record.score) ? Math.round(Math.min(Math.max(record.score, 0), 1) * 100) / 100 : null;
    cards.push({
      id: url,
      title,
      url,
      content: clampText(text, LIMITS.content),
      hostname,
      fetchedAt,
      publishedDate: isoDateOrNull(record.published_date),
      relevance: score,
      terms: statedTerms(text),
    });
  }
  return { cards, discarded };
}
