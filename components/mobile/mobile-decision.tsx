'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, CircleAlert, Clock, Loader2, Minus, PackageCheck, Plus, RefreshCw, Truck } from 'lucide-react';
import ProductArt from '@/components/product-art';
import { available, money, type Action, type ShopState } from '@/lib/types';
import styles from '@/app/mobile/mobile.module.css';
import { MAX_QUANTITY, approvalChange, assess, mostUrgent, openPurchase, quantityError, suggestedQuantity, totalCost, type ApprovalChange, type Urgency } from './insights';

type Connections = { database: string; tavily: boolean; grok: boolean; mode: string };
type Busy = 'prepare' | 'approve' | 'resume' | null;
type QtySource = 'agent' | 'suggested' | 'custom';

const levelLabel: Record<Urgency, string> = { out: 'Out of stock', critical: 'Restock now', watch: 'Watch', healthy: 'Healthy' };
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
const units = (n: number) => `${n} unit${n === 1 ? '' : 's'}`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function MobileDecision() {
  const [state, setState] = useState<ShopState | null>(null);
  const [connections, setConnections] = useState<Connections | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [quoteId, setQuoteId] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [qtySource, setQtySource] = useState<QtySource>('suggested');
  const [confirming, setConfirming] = useState(false);
  const [change, setChange] = useState<ApprovalChange | null>(null);
  const eventId = useRef('');
  const confirmingRef = useRef(false);
  const version = useRef(-1);
  const seededFor = useRef<string | null>(null);
  const decisionHeading = useRef<HTMLHeadingElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const changeHeading = useRef<HTMLHeadingElement>(null);

  const [focusDecision, setFocusDecision] = useState(0);
  useEffect(() => { confirmingRef.current = confirming; if (confirming) confirmButton.current?.focus(); }, [confirming]);
  useEffect(() => { if (change) changeHeading.current?.focus(); }, [change]);
  useEffect(() => { if (focusDecision) decisionHeading.current?.focus(); }, [focusDecision]);

  // Only ever move forward: a slow poll must not overwrite a newer action result.
  const accept = useCallback((next: ShopState, conns: Connections) => {
    if (next.version < version.current) return;
    if (version.current >= 0 && next.version > version.current && confirmingRef.current) {
      // Someone else changed the store mid-review: make the merchant look again before approving.
      setConfirming(false); eventId.current = '';
      setNotice('The store changed while you were reviewing. Check the numbers before approving.');
    }
    version.current = next.version;
    setState(next); setConnections(conns);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/store', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      accept(data.state, data.connections); setLoadError('');
    } catch (e) { setLoadError((e as Error).message || 'Could not load your store.'); }
  }, [accept]);

  useEffect(() => {
    void refresh();
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const id = setInterval(visible, 5000);
    document.addEventListener('visibilitychange', visible); // phones resume from background often
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useEffect(() => { if (notice) { const id = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(id); } }, [notice]);

  const product = state?.products[0]; // approve_purchase restocks the first catalogue product only.
  const report = state?.agentReport;
  const quote = state?.quotes.find(q => q.id === quoteId);
  const qtyError = quote ? quantityError(quote, qtyText) : 'Choose a supplier.';
  const quantity = Number(qtyText) || 0;

  // Pick the supplier and quantity once per recommendation: the agent's if present, else the store default.
  useEffect(() => {
    if (!state || !product) return;
    const key = report?.at ?? 'none';
    if (seededFor.current === key) return;
    seededFor.current = key;
    const agentQuote = report && state.quotes.find(q => q.id === report.quoteId);
    const quote = agentQuote ?? state.quotes.find(q => q.recommended) ?? state.quotes[0];
    if (!quote) return;
    setQuoteId(quote.id);
    setQtyText(String(agentQuote ? report.quantity : suggestedQuantity(product, quote)));
    setQtySource(agentQuote ? 'agent' : 'suggested');
  }, [state, product, report]);

  async function act(action: Action, kind: Exclude<Busy, null>): Promise<ShopState | null> {
    setBusy(kind); setError('');
    try {
      const res = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The store could not complete that action.');
      confirmingRef.current = false;
      accept(data.state, data.connections);
      return data.state as ShopState;
    } catch (e) {
      const message = (e as Error).message || 'Something went wrong. Please retry.';
      setError(message);
      if (/changed|refresh/i.test(message)) void refresh();
      return null;
    } finally { setBusy(null); }
  }

  async function prepare() {
    if (await act({ type: 'prepare_proposal' }, 'prepare')) {
      setNotice('Proposal ready. Compare suppliers, then approve.');
      setFocusDecision(n => n + 1);
    }
  }
  async function resume() { if (await act({ type: 'toggle_pause' }, 'resume')) setNotice('Demo workflow resumed.'); }

  function chooseQuote(id: string) {
    const quote = state?.quotes.find(q => q.id === id);
    if (!quote || !product) return;
    setQuoteId(id); setConfirming(false);
    const fromAgent = report?.quoteId === id;
    setQtyText(String(fromAgent ? report.quantity : suggestedQuantity(product, quote)));
    setQtySource(fromAgent ? 'agent' : 'suggested');
  }
  function editQuantity(text: string) { setQtyText(text); setQtySource('custom'); setConfirming(false); }
  function step(delta: number) {
    editQuantity(String(Math.max(quote?.minimum ?? 1, Math.min(MAX_QUANTITY, quantity + delta))));
  }

  function review() {
    setError(''); eventId.current = crypto.randomUUID(); setConfirming(true);
  }
  async function approve() {
    if (!state || !product || !quote || qtyError) return;
    const before = state;
    const after = await act({ type: 'approve_purchase', quoteId: quote.id, quantity: Number(qtyText), eventId: eventId.current || crypto.randomUUID() }, 'approve');
    setConfirming(false); eventId.current = '';
    if (!after) return;
    const diff = approvalChange(before, after, product.id);
    setChange(diff);
    setNotice(diff ? `${diff.purchase.id} recorded as a demo restock.` : 'This approval was already recorded.');
  }

  if (!state || !product) {
    return <main className={styles.screen}><div className={styles.phone}>
      <TopBar />
      {loadError
        ? <section className={styles.card} role="alert"><CircleAlert aria-hidden /><h1 className={styles.cardTitle}>Store unavailable</h1><p className={styles.muted}>{loadError}</p><button className={styles.secondary} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden /> Try again</button></section>
        : <div className={styles.skeleton} aria-busy="true" aria-label="Loading your store"><span /><span /><span /></div>}
    </div></main>;
  }

  const total = quote && !qtyError ? totalCost(quote, quantity) : null;
  const urgent = mostUrgent(state);
  const mine = assess(state, product);
  const open = openPurchase(state, product.id);
  const openQuote = open && state.quotes.find(q => q.id === open.quoteId);
  const paid = state.orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.total, 0);
  const waiting = state.orders.filter(o => o.status === 'reserved');
  const incomingAll = state.products.reduce((sum, p) => sum + assess(state, p).incoming, 0);
  const agentQuote = report && state.quotes.find(q => q.id === report.quoteId);
  const phase = open ? 'incoming' : state.proposalReady ? 'decide' : 'prepare';
  const leftAfter = quote && !qtyError && product.dailySales > 0 ? (Math.max(mine.free, 0) + quantity - product.demand) / product.dailySales : null;
  const headline = open ? 'Restock on its way' : urgent && urgent.level !== 'healthy' ? `${urgent.product.name} needs you` : 'Stock looks healthy';
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());

  return <main className={styles.screen}>
    <div className={styles.phone}>
      <TopBar version={state.version} />

      <div className={styles.live} aria-live="polite">{notice && <p className={styles.notice}><Check size={16} aria-hidden />{notice}</p>}</div>
      {error && <p className={styles.error} role="alert"><CircleAlert size={16} aria-hidden /><span>{error}</span></p>}

      <section className={styles.brief} aria-labelledby="brief-title">
        <p className={styles.eyebrow}>North & Form · {today}</p>
        <h1 id="brief-title" className={styles.headline}>{headline}</h1>
        <dl className={styles.stats}>
          <div><dt>Demo sales</dt><dd>{money(paid)}</dd></div>
          <div><dt>Reservations</dt><dd>{waiting.length}</dd></div>
          <div><dt>Incoming</dt><dd>{units(incomingAll)}</dd></div>
        </dl>
      </section>

      {urgent && <section className={`${styles.hero} ${styles[urgent.level]}`} aria-labelledby="urgent-title">
        <div className={styles.heroTop}>
          <span className={styles.badge}>{levelLabel[urgent.level]}</span>
          <span className={styles.heroSku}>{urgent.product.sku}</span>
        </div>
        <div className={styles.heroBody}>
          <div>
            <h2 id="urgent-title" className={styles.heroTitle}>{urgent.product.name}</h2>
            <p className={styles.heroVariant}>{urgent.product.variant}</p>
            <p className={styles.heroFigure}><strong>{Math.max(urgent.free, 0)}</strong> left to sell</p>
          </div>
          <ProductArt kind={urgent.product.kind} className={styles.heroArt} />
        </div>
        <dl className={styles.ledger}>
          <div><dt>On hand</dt><dd>{urgent.product.onHand}</dd></div>
          <div><dt>Reserved</dt><dd>{urgent.product.reserved}</dd></div>
          <div className={styles.incomingCell}><dt>Incoming</dt><dd>{urgent.incoming}</dd></div>
          <div><dt>Unmet</dt><dd>{urgent.product.demand}</dd></div>
        </dl>
        {Number.isFinite(urgent.cover) && <CoverBar cover={urgent.cover} lead={urgent.product.leadDays} />}
        {urgent.incoming > 0 && <p className={styles.heroNote}><Truck size={14} aria-hidden /> Incoming stock isn’t counted as on hand until it’s received.</p>}
      </section>}

      <section className={styles.card} aria-labelledby="why-title">
        <h2 id="why-title" className={styles.cardTitle}>Why this restock</h2>
        <p className={styles.kicker}>Calculated from live store records for {product.name}</p>
        <ul className={styles.reasons}>
          <li><strong>{units(Math.max(mine.free, 0))} available to sell</strong><span>{product.onHand} on hand, {product.reserved} held for customer reservations.</span></li>
          {product.demand > 0 && <li><strong>{units(product.demand)} of unmet demand</strong><span>Customer requests the store couldn’t fill, recorded separately from sales.</span></li>}
          {Number.isFinite(mine.cover) && <li><strong>{mine.cover < 1 ? 'Under a day' : `About ${days(Math.floor(mine.cover))}`} of cover</strong><span>At ~{product.dailySales}/day, {mine.cover < product.leadDays ? `it sells out before a ${product.leadDays}-day restock lands.` : `it should last beyond a ${product.leadDays}-day restock.`}</span></li>}
          {mine.incoming > 0 && <li><strong>{units(mine.incoming)} already incoming</strong><span>Tracked apart from on-hand stock, so it can’t be sold or double-ordered.</span></li>}
        </ul>
      </section>

      <section className={`${styles.card} ${styles.agent}`} aria-labelledby="agent-title">
        <div className={styles.agentHead}><span className={styles.agentIcon}><Bot size={18} aria-hidden /></span>
          <div><h2 id="agent-title" className={styles.cardTitle}>Agent recommendation</h2>
            <p className={styles.kicker}>{report ? `${report.source === 'agent_token' ? 'GrokBot stock manager' : 'Handoff page'} · ${clock(report.at)}` : connections?.grok ? 'GrokBot endpoint ready' : 'GrokBot stock manager not connected'}</p></div>
        </div>
        {report ? <>
          <p className={styles.agentSummary}>{report.summary}</p>
          <p className={styles.agentPick}>{agentQuote ? agentQuote.supplier : 'Unknown supplier'} · {units(report.quantity)}{agentQuote && ` · ${money(totalCost(agentQuote, report.quantity))} total`}</p>
          <details className={styles.details}><summary>Agent’s reasoning</summary><p>{report.rationale}</p></details>
        </> : <p className={styles.muted}>{connections?.grok ? 'No recommendation submitted yet. The figures above come from store data only.' : 'No agent recommendation is available. The figures above come from store data only; nothing here is model-generated.'}</p>}
      </section>

      <section className={styles.card} aria-labelledby="decision-title" aria-busy={busy !== null}>
        <ol className={styles.steps} aria-label="Restock steps">
          {(['Prepare', 'Choose', 'Approve'] as const).map((label, i) => {
            const at = phase === 'prepare' ? 0 : phase === 'decide' ? (confirming ? 2 : 1) : 3;
            return <li key={label} className={i < at ? styles.stepDone : i === at ? styles.stepNow : ''} aria-current={i === at ? 'step' : undefined}>{i < at ? <Check size={12} aria-hidden /> : i + 1}<span>{label}</span></li>;
          })}
        </ol>
        <h2 id="decision-title" ref={decisionHeading} tabIndex={-1} className={styles.cardTitle}>Supplier decision</h2>
        {urgent && urgent.product.id !== product.id && <p className={styles.kicker}>Mobile restocks support {product.name} in this demo.</p>}

        {change ? <ChangeCard change={change} headingRef={changeHeading} name={product.name} /> : open ? <div className={styles.openOrder}>
          <p className={styles.openTitle}><Truck size={18} aria-hidden /> {open.id} · {open.status === 'ordered' ? 'Ordered' : 'Cancellation requested'}</p>
          <p>{units(open.quantity)} from {openQuote?.supplier ?? 'supplier'} · {money(open.total)} demo total{openQuote && ` · quoted ${days(openQuote.leadDays)}`}</p>
          <p className={styles.muted}>A second restock is blocked while this one is open. Receive or cancel it from the desktop workspace.</p>
        </div> : phase === 'prepare' ? <div className={styles.prepare}>
          <p>{state.quotes.length} supplier quotes are on file. Prepare a proposal to compare quantity, minimums, shipping, total cost and lead time side by side.</p>
          {state.paused && <p className={styles.muted}>The demo workflow is paused, so proposals can’t be prepared until it resumes.</p>}
        </div> : <>
          <fieldset className={styles.quotes} disabled={busy !== null}>
            <legend className={styles.legend}>Supplier</legend>
            {state.quotes.map(q => <label key={q.id} className={`${styles.quote} ${q.id === quoteId ? styles.quoteOn : ''}`}>
              <input type="radio" name="quote" value={q.id} checked={q.id === quoteId} onChange={() => chooseQuote(q.id)} className={styles.radio} />
              <span className={styles.quoteMain}>
                <span className={styles.quoteName}>{q.supplier}{report?.quoteId === q.id ? <em className={styles.chipAgent}>Agent pick</em> : q.recommended && <em className={styles.chip}>Store default</em>}</span>
                <span className={styles.quoteMeta}>{q.country} · {q.note}</span>
                <span className={styles.quoteFacts}><span>{money(q.unitCost)}/unit</span><span>MOQ {q.minimum}</span><span>{money(q.shipping)} ship</span><span><Clock size={12} aria-hidden /> {days(q.leadDays)}</span></span>
              </span>
            </label>)}
          </fieldset>

          {quote && <div className={styles.qty}>
            <label htmlFor="qty" className={styles.legend}>Quantity</label>
            <div className={styles.stepper}>
              <button type="button" onClick={() => step(-1)} disabled={busy !== null || quantity <= quote.minimum} aria-label="One fewer unit"><Minus size={18} aria-hidden /></button>
              <input id="qty" inputMode="numeric" pattern="[0-9]*" value={qtyText} onChange={e => editQuantity(e.target.value)} aria-invalid={Boolean(qtyError)} aria-describedby="qty-hint" disabled={busy !== null} />
              <button type="button" onClick={() => step(1)} disabled={busy !== null || quantity >= MAX_QUANTITY} aria-label="One more unit"><Plus size={18} aria-hidden /></button>
            </div>
            <p id="qty-hint" className={qtyError ? styles.fieldError : styles.hint}>{qtyError || (qtySource === 'agent' ? 'Quantity recommended by the agent.' : qtySource === 'suggested' ? `Suggested: ${product.demand} unmet + ${product.dailySales}/day × ${days(quote.leadDays)} lead − ${Math.max(mine.free, 0)} available, at least the MOQ.` : leftAfter !== null ? `After filling unmet demand, leaves about ${days(Math.max(0, Math.floor(leftAfter)))} of sales.` : 'Custom quantity.')}</p>
          </div>}

          {quote && <dl className={styles.summary}>
            <div><dt>Quantity</dt><dd>{qtyError ? '—' : units(quantity)}</dd></div>
            <div><dt>Minimum order</dt><dd>{units(quote.minimum)}</dd></div>
            <div><dt>Goods</dt><dd>{qtyError ? '—' : `${quantity} × ${money(quote.unitCost)}`}</dd></div>
            <div><dt>Shipping</dt><dd>{money(quote.shipping)}</dd></div>
            <div className={styles.totalRow}><dt>Total <small>demo</small></dt><dd>{total !== null ? money(total) : '—'}</dd></div>
            <div><dt>Lead time</dt><dd>{days(quote.leadDays)} quoted, not confirmed</dd></div>
          </dl>}
        </>}
      </section>

      <section className={styles.card} aria-labelledby="recent-title">
        <h2 id="recent-title" className={styles.cardTitle}>Latest in the store</h2>
        <ul className={styles.activity}>
          {state.activities.slice(0, 3).map(a => <li key={a.id}><div><span className={styles.activityOwner}>{a.owner}</span><strong>{a.title}</strong><p>{a.detail}</p></div><time dateTime={a.at}>{clock(a.at)}</time></li>)}
        </ul>
      </section>

      <p className={styles.footnote}>Demo workspace. Approvals write demo records only: no payment is taken and no supplier order is sent.</p>

      <div className={styles.dock}>
        {confirming && quote && total !== null ? <div className={styles.confirm} role="group" aria-labelledby="confirm-text" onKeyDown={e => { if (e.key === 'Escape' && busy === null) { setConfirming(false); eventId.current = ''; } }}>
          <p id="confirm-text">Approve <strong>{units(quantity)}</strong> from {quote.supplier} for <strong>{money(total)}</strong>? Demo only — no payment, no real order.</p>
          <div className={styles.confirmRow}>
            <button type="button" className={styles.secondary} onClick={() => { setConfirming(false); eventId.current = ''; }} disabled={busy !== null}>Back</button>
            <button type="button" ref={confirmButton} className={styles.primary} onClick={() => void approve()} disabled={busy !== null}>
              {busy === 'approve' ? <><Loader2 size={18} className={styles.spin} aria-hidden /> Approving…</> : <><Check size={18} aria-hidden /> Confirm demo restock</>}
            </button>
          </div>
        </div>
        : change || open ? <Link href="/" className={styles.primary}>Manage incoming order on desktop <ArrowRight size={18} aria-hidden /></Link>
        : phase === 'prepare' ? state.paused
          ? <button type="button" className={styles.primary} onClick={() => void resume()} disabled={busy !== null}>{busy === 'resume' ? <><Loader2 size={18} className={styles.spin} aria-hidden /> Resuming…</> : 'Resume demo workflow'}</button>
          : <button type="button" className={styles.primary} onClick={() => void prepare()} disabled={busy !== null}>{busy === 'prepare' ? <><Loader2 size={18} className={styles.spin} aria-hidden /> Preparing…</> : <>Prepare restock proposal <ArrowRight size={18} aria-hidden /></>}</button>
        : <button type="button" className={styles.primary} onClick={review} disabled={busy !== null || Boolean(qtyError)}>
          {total !== null ? <>Review demo restock · {money(total)}</> : 'Fix quantity to continue'}
        </button>}
      </div>
    </div>
  </main>;
}

function TopBar({ version }: { version?: number }) {
  return <header className={styles.top}>
    <Link href="/" className={styles.back}><ArrowLeft size={18} aria-hidden /><span>Desktop</span></Link>
    <span className={styles.brand}>Shopkeeper<span aria-hidden>.</span></span>
    <span className={styles.sync} title="Refreshes every 5 seconds">{version === undefined ? 'Connecting' : <><i aria-hidden /> Live · v{version}</>}</span>
  </header>;
}

function CoverBar({ cover, lead }: { cover: number; lead: number }) {
  const span = lead * 2;
  return <div className={styles.cover}>
    <div className={styles.coverTrack} role="img" aria-label={`${cover.toFixed(1)} days of stock against a ${lead}-day restock`}>
      <span className={styles.coverFill} style={{ width: `${Math.min(cover / span, 1) * 100}%` }} />
      <span className={styles.coverMark} style={{ left: '50%' }} />
    </div>
    <p><span>{cover.toFixed(1)} days of stock</span><span>Restock takes {days(lead)}</span></p>
  </div>;
}

function ChangeCard({ change, headingRef, name }: { change: ApprovalChange; headingRef: React.RefObject<HTMLHeadingElement | null>; name: string }) {
  const rows: [string, [number, number], string][] = [
    ['On hand', change.onHand, 'Unchanged until received'],
    ['Incoming', change.incoming, 'Owed by the supplier'],
    ['Available to sell', change.free, 'Not sellable until received'],
  ];
  return <div className={styles.change}>
    <h3 ref={headingRef} tabIndex={-1} className={styles.changeTitle}><PackageCheck size={20} aria-hidden /> {change.purchase.id} approved · demo</h3>
    <p>{units(change.purchase.quantity)} of {name} from {change.quote?.supplier ?? 'supplier'} · {money(change.purchase.total)}{change.quote && ` · quoted ${days(change.quote.leadDays)}, not a confirmed date`}</p>
    <dl className={styles.diff}>
      {rows.map(([label, [from, to], note]) => <div key={label}><dt>{label}<small>{note}</small></dt><dd>{from}<ArrowRight size={14} aria-label="to" />{to !== from ? <strong>{to}</strong> : to}</dd></div>)}
    </dl>
  </div>;
}
