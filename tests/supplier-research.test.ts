import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cleanSnippet, LIMITS, safeHttpUrl, statedTerms, toEvidenceCards } from '../lib/research/normalize';
import { createSupplierSearch, MARKET_QUERIES } from '../lib/research/search';
import { handleResearch, isAllowedOrigin, parseMarket } from '../lib/research/handler';

const NOW = Date.parse('2026-09-26T10:00:00Z');
const good = (n: number, extra: Record<string, unknown> = {}) => ({ title: `Supplier ${n}`, url: `https://supplier${n}.co.uk/hoodies`, content: `Wholesale blank hoodies for brands and printers, supplier ${n}.`, score: 0.5, ...extra });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeFetch(respond: (init: RequestInit) => Response | Promise<Response>) {
  const calls: RequestInit[] = [];
  const impl = (async (_url: string | URL | Request, init?: RequestInit) => { calls.push(init ?? {}); return respond(init ?? {}); }) as typeof fetch;
  return { impl, calls };
}
const input = (over: Partial<Parameters<typeof handleResearch>[1]> = {}) => ({ origin: 'http://localhost:3000', host: 'localhost:3000', selfOrigin: 'http://localhost:3000', readBody: async () => '', ...over });

test('only http(s) links without credentials survive', () => {
  assert.equal(safeHttpUrl('https://a.co.uk/x#frag'), 'https://a.co.uk/x');
  assert.equal(safeHttpUrl('http://a.com'), 'http://a.com/');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://a.com/f', 'https://user:pw@a.com', 'https://localhost/', 'not a url', '', 42, null, `https://a.com/${'x'.repeat(3000)}`]) {
    assert.equal(safeHttpUrl(bad), null, String(bad).slice(0, 40));
  }
});

test('malformed and duplicate results are discarded, not repaired', () => {
  const raw = [good(1), null, 'string', { title: 'No url', content: 'x'.repeat(50) }, { url: 'javascript:alert(1)', title: 't', content: 'x'.repeat(50) }, { url: 'https://empty.com', title: 'Empty', content: '   ' }, good(1), good(2, { title: 42 })];
  const { cards, discarded } = toEvidenceCards(raw, '2026-09-26T10:00:00.000Z');
  assert.deepEqual(cards.map(c => c.url), ['https://supplier1.co.uk/hoodies', 'https://supplier2.co.uk/hoodies']);
  assert.equal(discarded, 6);
  assert.equal(cards[1].title, 'supplier2.co.uk', 'non-string title falls back to hostname');
  assert.equal(toEvidenceCards({ not: 'an array' }, 'x').cards.length, 0);
});

test('lengths are bounded and markdown noise stripped', () => {
  const { cards } = toEvidenceCards([good(1, { title: 'T'.repeat(500), content: `### Heading\n**bold** [link](https://x.com) ${'word '.repeat(400)}` })], 'x');
  assert.ok(cards[0].title.length <= LIMITS.title);
  assert.ok(cards[0].content.length <= LIMITS.content);
  assert.ok(cards[0].content.startsWith('Heading bold link word'));
  assert.equal(cleanSnippet(undefined), '');
  const repeated = 'Our minimum order is 10 pieces for every style. … Our minimum order is 10 pieces for every style. … Next day dispatch.';
  assert.equal(toEvidenceCards([good(9, { content: repeated })], 'x').cards[0].content, 'Our minimum order is 10 pieces for every style. … Next day dispatch.');
  assert.equal(toEvidenceCards(Array.from({ length: 20 }, (_, i) => good(i)), 'x').cards.length, LIMITS.results);
});

test('commercial terms are quoted verbatim or marked unknown — never invented', () => {
  const terms = statedTerms('Premium hoodies for brands. Our low minimum order quantity of 10 pieces helps startups. Next day delivery anywhere in the UK.');
  assert.deepEqual(terms.minimumOrder, { status: 'stated', excerpt: 'Our low minimum order quantity of 10 pieces helps startups.' });
  assert.deepEqual(terms.leadTime, { status: 'stated', excerpt: 'Next day delivery anywhere in the UK.' });
  assert.deepEqual(terms.price, { status: 'unknown' });
  assert.deepEqual(terms.stock, { status: 'unknown' });
  assert.equal(statedTerms('No minimum order & save on bulk, low as £17.50 GBP').price.status, 'stated');
  const faq = statedTerms('Do you have a minimum order quantity? | Minimum order | Many UK factories offer low MOQs. Available in 480 GSM with price on request.');
  assert.ok(Object.values(faq).every(t => t.status === 'unknown'), 'questions, headers, vague claims and GSM figures are not terms');
  const blob = statedTerms(`${'Black Navy Olive Salmon Small Medium Large '.repeat(12)}all colours in stock now ${'XL XXL '.repeat(30)}`);
  assert.equal(blob.stock.status, 'stated');
  assert.ok(blob.stock.status === 'stated' && blob.stock.excerpt.includes('in stock') && blob.stock.excerpt.length <= LIMITS.excerpt + 2);
  assert.equal(statedTerms('Custom orders: MOQ 300 pcs/design').minimumOrder.status, 'stated');
  assert.equal(statedTerms('Orders are dispatched within 3-5 working days.').leadTime.status, 'stated');
  const nothing = statedTerms('We make lovely clothing for everyone.');
  assert.ok(Object.values(nothing).every(t => t.status === 'unknown'));
});

test('published date is kept only when parseable', () => {
  const { cards } = toEvidenceCards([good(1, { published_date: 'Thu, 25 Jun 2026 00:00:00 GMT' }), good(2, { published_date: 'yesterday-ish' }), good(3, { score: 'high' })], 'x');
  assert.equal(cards[0].publishedDate, '2026-06-25T00:00:00.000Z');
  assert.equal(cards[1].publishedDate, null);
  assert.equal(cards[2].relevance, null);
});

test('missing key gives an explicit unavailable state without calling Tavily', async () => {
  const { impl, calls } = fakeFetch(() => json({ results: [] }));
  const result = await handleResearch(createSupplierSearch({ apiKey: undefined, fetchImpl: impl }), input());
  assert.equal(result.status, 503);
  assert.equal((result.body as { code: string }).code, 'unavailable');
  assert.match((result.body as { error: string }).error, /TAVILY_API_KEY/);
  assert.equal(calls.length, 0);
});

test('default request keeps the original fixed UK query and legacy fields', async () => {
  const { impl, calls } = fakeFetch(() => json({ results: [good(1), good(2)] }));
  const result = await handleResearch(createSupplierSearch({ apiKey: 'test-key', fetchImpl: impl, now: () => NOW }), input());
  assert.equal(result.status, 200);
  const body = result.body as { results: { title: string; url: string; content: string }[]; searchedAt: string };
  assert.equal(body.searchedAt, '2026-09-26T10:00:00.000Z');
  for (const r of body.results) for (const field of ['title', 'url', 'content'] as const) assert.equal(typeof r[field], 'string', field);
  const sent = JSON.parse(String(calls[0].body));
  assert.equal(sent.query, 'UK wholesale heavyweight black hoodies minimum order quantity supplier');
  assert.equal(sent.country, 'united kingdom');
  assert.equal((calls[0].headers as Record<string, string>).Authorization, 'Bearer test-key');
});

test('repeat and concurrent queries are served from one upstream call until the cache expires', async () => {
  let clock = NOW;
  const { impl, calls } = fakeFetch(() => json({ results: [good(1)] }));
  const search = createSupplierSearch({ apiKey: 'k', fetchImpl: impl, now: () => clock, cacheTtlMs: 60_000 });
  const [a, b] = await Promise.all([search('uk'), search('uk')]);
  assert.equal(calls.length, 1);
  assert.equal(a.cached, false); assert.equal(b.cached, false);
  const c = await search('uk');
  assert.equal(c.cached, true);
  assert.equal(c.searchedAt, a.searchedAt, 'cached result reports the original fetch time');
  await search('europe');
  assert.equal(calls.length, 2, 'markets are cached separately');
  assert.equal(JSON.parse(String(calls[1].body)).query, MARKET_QUERIES.europe.query);
  clock += 61_000;
  await search('uk');
  assert.equal(calls.length, 3);
});

test('empty answers are not cached', async () => {
  let results: unknown[] = [];
  const { impl, calls } = fakeFetch(() => json({ results }));
  const search = createSupplierSearch({ apiKey: 'k', fetchImpl: impl });
  assert.equal((await search('uk')).results.length, 0);
  results = [good(1)];
  const next = await search('uk');
  assert.equal(next.results.length, 1);
  assert.equal(next.cached, false);
  assert.equal(calls.length, 2);
});

test('failures are not cached', async () => {
  let fail = true;
  const { impl, calls } = fakeFetch(() => (fail ? json({ detail: 'boom' }, 500) : json({ results: [good(1)] })));
  const search = createSupplierSearch({ apiKey: 'k', fetchImpl: impl });
  await assert.rejects(search('uk'));
  fail = false;
  assert.equal((await search('uk')).results.length, 1);
  assert.equal(calls.length, 2);
});

test('upstream failures map to useful errors', async () => {
  const cases: [() => Response | Promise<Response>, number, string][] = [
    [() => json({}, 401), 502, 'auth'],
    [() => json({}, 429), 429, 'rate_limited'],
    [() => json({}, 432), 429, 'rate_limited'],
    [() => json({}, 422), 502, 'upstream'],
    [() => json({}, 500), 502, 'upstream'],
    [() => new Response('<html>not json</html>', { status: 200 }), 502, 'malformed'],
    [() => json({ results: 'nope' }), 502, 'malformed'],
    [() => json(null), 502, 'malformed'],
    [() => { throw new TypeError('fetch failed'); }, 502, 'upstream'],
    [() => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); }, 504, 'timeout'],
  ];
  for (const [respond, status, code] of cases) {
    const { impl } = fakeFetch(respond);
    const result = await handleResearch(createSupplierSearch({ apiKey: 'secret-key', fetchImpl: impl }), input());
    assert.equal(result.status, status, code);
    assert.equal((result.body as { code: string }).code, code);
    assert.doesNotMatch(JSON.stringify(result.body), /secret-key/, 'key never leaks into errors');
  }
});

test('a real timeout aborts the request', async () => {
  const impl = ((_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
  const keepAlive = setTimeout(() => {}, 5_000); // AbortSignal.timeout does not hold the event loop open
  const result = await handleResearch(createSupplierSearch({ apiKey: 'k', fetchImpl: impl, timeoutMs: 20 }), input());
  clearTimeout(keepAlive);
  assert.equal(result.status, 504);
  assert.equal((result.body as { code: string }).code, 'timeout');
});

test('request validation: origin and market', async () => {
  assert.equal(isAllowedOrigin(null, 'a', 'http://a'), true);
  assert.equal(isAllowedOrigin('https://evil.com', 'localhost:3000', 'http://localhost:3000'), false);
  assert.equal(isAllowedOrigin('garbage', 'localhost:3000', 'http://localhost:3000'), false);
  assert.equal(await parseMarket(async () => ''), 'uk');
  assert.equal(await parseMarket(async () => '{}'), 'uk');
  assert.equal(await parseMarket(async () => '{"market":"europe"}'), 'europe');
  assert.equal(await parseMarket(async () => '{"market":"mars"}'), null);
  assert.equal(await parseMarket(async () => '{"query":"anything"}'), 'uk', 'free-text queries are ignored');
  assert.equal(await parseMarket(async () => '{bad'), null);
  const { impl, calls } = fakeFetch(() => json({ results: [] }));
  const search = createSupplierSearch({ apiKey: 'k', fetchImpl: impl });
  assert.equal((await handleResearch(search, input({ origin: 'https://evil.com' }))).status, 403);
  assert.equal((await handleResearch(search, input({ readBody: async () => '{"market":1}' }))).status, 400);
  assert.equal(calls.length, 0);
});

test('discovery code cannot touch quotes, purchases or the store', () => {
  const files = [...readdirSync('lib/research').map(f => `lib/research/${f}`), 'app/api/research/route.ts', 'components/supplier-research.tsx'];
  for (const file of files) assert.doesNotMatch(readFileSync(file, 'utf8'), /lib\/(store|engine)|api\/store/, file);
});
