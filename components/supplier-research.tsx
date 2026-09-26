'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, ExternalLink, Info, LoaderCircle, PlugZap, RotateCw, Search } from 'lucide-react';
import { safeHttpUrl } from '@/lib/research/normalize';
import { TERM_FIELDS, type EvidenceCard, type Market, type ResearchErrorCode, type ResearchResponse, type TermField } from '@/lib/research/types';
import styles from './supplier-research.module.css';

export type SupplierResearchProps = {
  /** Which preset search runs first. Defaults to the dashboard's original UK query. */
  defaultMarket?: Market;
  /** Override for tests or proxies. Must be same-origin. */
  endpoint?: string;
  /** Called with each successful response. Read-only: never write these into quotes or orders. */
  onResults?: (response: ResearchResponse) => void;
  className?: string;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; code: ResearchErrorCode | 'network'; message: string }
  | { kind: 'done'; response: ResearchResponse };

const MARKET_LABELS: Record<Market, string> = { uk: 'UK', europe: 'Europe' };
const TERM_LABELS: Record<TermField, string> = { price: 'Price', minimumOrder: 'Minimum order', leadTime: 'Lead time', stock: 'Stock' };
const CLIENT_TIMEOUT_MS = 20_000;

function formatTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string | null) {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function monogram(hostname: string) {
  return hostname.split('.')[0].replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '··';
}

export function SupplierResearch({ defaultMarket = 'uk', endpoint = '/api/research', onResults, className }: SupplierResearchProps) {
  const [market, setMarket] = useState<Market>(defaultMarket);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function run(target: Market = market) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const timer = setTimeout(() => current.abort(), CLIENT_TIMEOUT_MS);
    setStatus({ kind: 'loading' });
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market: target }), signal: current.signal });
      const data = await res.json().catch(() => null);
      if (controller.current !== current) return;
      if (!res.ok || !data || !Array.isArray(data.results)) {
        setStatus({ kind: 'error', code: data?.code ?? 'upstream', message: typeof data?.error === 'string' ? data.error : 'Supplier search returned an unexpected response.' });
        return;
      }
      const response = { ...(data as ResearchResponse), results: (data.results as EvidenceCard[]).filter(r => safeHttpUrl(r?.url) && r.terms) };
      setStatus({ kind: 'done', response });
      onResults?.(response);
    } catch {
      if (controller.current !== current) return; // superseded by a newer request
      setStatus({ kind: 'error', code: 'network', message: 'Supplier search did not respond. Check your connection and try again.' });
    } finally {
      clearTimeout(timer);
    }
  }

  function chooseMarket(next: Market) {
    setMarket(next);
    if (status.kind !== 'idle') void run(next);
  }

  const loading = status.kind === 'loading';

  return (
    <section className={[styles.root, className].filter(Boolean).join(' ')} aria-labelledby="supplier-research-heading">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>LIVE WEB DISCOVERY · TAVILY</span>
          <h3 id="supplier-research-heading">Go beyond your usual suppliers.</h3>
          <p>Wholesale hoodie suppliers found on the open web, with the source for every claim.</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.segmented} role="radiogroup" aria-label="Supplier region">
            {(Object.keys(MARKET_LABELS) as Market[]).map(m => (
              <button key={m} type="button" role="radio" aria-checked={market === m} className={market === m ? styles.segmentActive : undefined} onClick={() => chooseMarket(m)} disabled={loading}>{MARKET_LABELS[m]}</button>
            ))}
          </div>
          <button type="button" className={styles.primary} onClick={() => run()} disabled={loading}>
            {loading ? <LoaderCircle className={styles.spin} size={15} /> : status.kind === 'done' ? <RotateCw size={15} /> : <Search size={15} />}
            {loading ? 'Searching…' : status.kind === 'done' ? 'Search again' : 'Research suppliers'}
          </button>
        </div>
      </div>

      <p className={styles.notice}><Info size={14} aria-hidden />Discovery only. These are unverified web pages: they never change your sample quotes or place orders. Confirm every term with the supplier.</p>

      <div aria-live="polite" aria-busy={loading}>
        {loading && <div className={styles.grid}>{[0, 1, 2].map(i => <div key={i} className={styles.skeleton} />)}</div>}

        {status.kind === 'error' && status.code === 'unavailable' && (
          <div className={styles.state}>
            <PlugZap size={18} aria-hidden />
            <div><strong>Live research is switched off</strong><p>Set <code>TAVILY_API_KEY</code> on the server to turn on supplier discovery. Your sample quotes still work.</p></div>
          </div>
        )}
        {status.kind === 'error' && status.code !== 'unavailable' && (
          <div className={`${styles.state} ${styles.stateError}`}>
            <CircleAlert size={18} aria-hidden />
            <div><strong>Search didn’t complete</strong><p>{status.message}</p></div>
            {status.code !== 'auth' && <button type="button" className={styles.secondary} onClick={() => run()}>Try again</button>}
          </div>
        )}

        {status.kind === 'done' && (
          <>
            <div className={styles.meta}>
              <span>{status.response.results.length} source{status.response.results.length === 1 ? '' : 's'} · {MARKET_LABELS[status.response.market] ?? status.response.market}</span>
              <span>Fetched {formatTime(status.response.searchedAt)}{status.response.cached ? ' · from cache' : ''}</span>
              {status.response.discarded > 0 && <span>{status.response.discarded} skipped: bad link or no readable text</span>}
            </div>
            {status.response.results.length === 0
              ? <div className={styles.state}><Search size={18} aria-hidden /><div><strong>No usable supplier pages found</strong><p>Try the other region, or search again later.</p></div></div>
              : <div className={styles.grid}>{status.response.results.map(card => <EvidenceCardView key={card.id} card={card} />)}</div>}
          </>
        )}
      </div>
    </section>
  );
}

function EvidenceCardView({ card }: { card: EvidenceCard }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.monogram} aria-hidden>{monogram(card.hostname)}</span>
        <span className={styles.host}>{card.hostname}</span>
      </div>
      <h4><a href={card.url} target="_blank" rel="noopener noreferrer">{card.title}</a></h4>
      <div className={styles.says}>
        <span className={styles.label}>The page says</span>
        <p>{card.content}</p>
      </div>
      <dl className={styles.terms}>
        {TERM_FIELDS.map(field => {
          const term = card.terms?.[field];
          return (
            <div key={field}>
              <dt>{TERM_LABELS[field]}</dt>
              {term?.status === 'stated'
                ? <dd className={styles.stated}><q>{term.excerpt}</q></dd>
                : <dd className={styles.unknown}>Unknown. Ask the supplier</dd>}
            </div>
          );
        })}
      </dl>
      <footer className={styles.footer}>
        <span>Fetched {formatTime(card.fetchedAt)} · Published {formatDate(card.publishedDate)}</span>
        <a href={card.url} target="_blank" rel="noopener noreferrer">Open source<ExternalLink size={13} aria-hidden /></a>
      </footer>
    </article>
  );
}
