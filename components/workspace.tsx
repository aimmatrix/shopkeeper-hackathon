'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Montserrat } from 'next/font/google';
import type { Action, ShopState } from '@/lib/types';
import { available } from '@/lib/types';
import { Mark, type Dash, type View } from './dashboard/shared';
import { Today } from './dashboard/today';
import { StockView } from './dashboard/stock';
import { Restock } from './dashboard/restock';
import { InboxView } from './dashboard/inbox';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--sk-font', display: 'swap' });

type Connections = { database: string; tavily: boolean; grok: boolean; mode: string };
const nav: { id: View; label: string }[] = [{ id: 'today', label: 'Today' }, { id: 'inbox', label: 'Inbox' }, { id: 'stock', label: 'Stock' }, { id: 'suppliers', label: 'Suppliers' }];
const SEEN_KEY = 'shopkeeper.inbox.seen';

export default function Workspace() {
  const [state, setState] = useState<ShopState | null>(null);
  const [connections, setConnections] = useState<Connections | null>(null);
  const [view, setView] = useState<View>('today');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState('north');
  const [quantity, setQuantity] = useState(20);
  const [menu, setMenu] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const appliedReport = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/store', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(current => !current || data.state.version >= current.version ? data.state : current); setConnections(data.connections); setOffline(false);
    } catch { setOffline(true); }
  }, []);
  useEffect(() => { void refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { if (notice) { const id = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(id); } }, [notice]);
  useEffect(() => { try { setSeen(localStorage.getItem(SEEN_KEY)); } catch { /* storage unavailable: everything counts as unread */ } }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); setResetConfirm(false); } };
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setMenu(false); setResetConfirm(false); } };
    window.addEventListener('keydown', onKey); window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, []);

  async function act(action: Action, success?: string): Promise<boolean> {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data.state); setConnections(data.connections);
      if (success) setNotice(success);
      return true;
    } catch (e) { setError((e as Error).message || 'Something went wrong. Please try again.'); return false; }
    finally { setBusy(false); }
  }

  const product = state?.products[0];
  const incoming = state?.purchases.filter(p => ['ordered', 'cancellation_requested'].includes(p.status)).reduce((sum, p) => sum + p.quantity, 0) ?? 0;
  const paid = state?.orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.total, 0) ?? 0;
  const pending = state?.orders.filter(o => o.status === 'reserved') ?? [];
  const quote = state?.quotes.find(q => q.id === selected) ?? state?.quotes[0];
  const needRestock = product ? available(product) < product.dailySales * product.leadDays && incoming === 0 : true;

  // A new stock-manager recommendation (GrokBot or the handoff page) pre-selects its supplier and quantity once.
  const report = state?.agentReport;
  useEffect(() => {
    if (report && appliedReport.current !== report.at) { appliedReport.current = report.at; setSelected(report.quoteId); setQuantity(report.quantity); }
  }, [report]);

  // Unread = customer messages after the last one seen in the Inbox.
  const messages = state?.messages ?? [];
  const seenIndex = seen ? messages.findIndex(m => m.id === seen) : -1;
  const unread = messages.slice(seenIndex + 1).filter(m => m.sender === 'customer').length;
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (view === 'inbox' && lastId && lastId !== seen) { setSeen(lastId); try { localStorage.setItem(SEEN_KEY, lastId); } catch { /* ignore */ } }
  }, [view, lastId, seen]);

  function go(next: View) { setView(next); setMenu(false); window.scrollTo({ top: 0 }); }

  async function openSuppliers() {
    if (state && needRestock && !state.proposalReady && !state.paused) await act({ type: 'prepare_proposal' });
    go('suppliers');
  }
  async function approve() {
    if (!state || !quote) return;
    const units = Math.max(quantity, quote.minimum);
    if (!state.proposalReady && !(await act({ type: 'prepare_proposal' }))) return;
    await act({ type: 'approve_purchase', quoteId: quote.id, quantity: units, eventId: crypto.randomUUID() }, `Restock approved. ${units} are on the way.`);
  }
  /** Demo undo: cancel the open purchase order, with the demo supplier confirming straight away. */
  async function undo() {
    const open = state?.purchases.find(p => p.status === 'ordered' || p.status === 'cancellation_requested');
    if (!open) return;
    if (open.status === 'ordered' && !(await act({ type: 'request_cancel', purchaseId: open.id }))) return;
    await act({ type: 'confirm_cancel', purchaseId: open.id }, `${open.id} cancelled. Nothing is on the way.`);
  }
  async function reset() {
    if (await act({ type: 'reset' }, 'Sample store reset to its starting point.')) { setResetConfirm(false); setMenu(false); setSelected('north'); setQuantity(20); appliedReport.current = null; go('today'); }
  }

  const dash: Dash | null = state && product && quote ? {
    state, product, incoming, paid, pending, needRestock, quote, quantity, busy, go, act, approve, openSuppliers, undo,
    pick: id => setSelected(id),
    step: delta => setQuantity(q => Math.min(500, Math.max(5, q + delta))),
    applyReport: () => { if (state.agentReport) { setSelected(state.agentReport.quoteId); setQuantity(state.agentReport.quantity); } },
  } : null;

  return <div className={`sk ${montserrat.variable}`}>
    <div className="sk-strip"><b>DEMO STORE</b><span>Sample catalogue and suppliers. No real payments, no supplier is contacted.</span></div>

    <header className="sk-header">
      <div className="sk-header-left">
        <button className="sk-brand" onClick={() => go('today')} aria-label="Shopkeeper, go to Today"><Mark /><span>shopkeeper</span></button>
        <nav aria-label="Main" className="sk-nav">
          {nav.map(item => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} aria-label={item.id === 'inbox' && unread > 0 ? `Inbox, ${unread} unread` : undefined} className={view === item.id ? 'active' : ''} onClick={() => go(item.id)}>
            {item.label}{item.id === 'inbox' && unread > 0 && <span className="sk-badge" aria-hidden="true">{unread}</span>}
          </button>)}
        </nav>
      </div>
      <div className="sk-store" ref={menuRef}>
        {state?.paused && <span className="sk-chip coral">PAUSED</span>}
        <button className="sk-store-button" aria-haspopup="menu" aria-expanded={menu} onClick={() => { setMenu(m => !m); setResetConfirm(false); }}>
          <span className="sk-store-name">North &amp; Form</span><span className="sk-monogram">NF</span>
        </button>
        {menu && <div className="sk-menu" role="menu">
          {state && <button role="menuitem" disabled={busy} onClick={async () => { await act({ type: 'toggle_pause' }, state.paused ? 'Workflow resumed.' : 'Workflow paused. Customer replies and restocks are on hold.'); setMenu(false); }}>{state.paused ? 'Resume workflow' : 'Pause workflow'}</button>}
          {resetConfirm ? <div className="sk-menu-confirm">
            <span>Reset the sample store to its starting point?</span>
            <div><button className="sk-btn ink sm" disabled={busy} onClick={reset}>Reset</button><button className="sk-btn outline sm" onClick={() => setResetConfirm(false)}>Keep data</button></div>
          </div> : <button role="menuitem" onClick={() => setResetConfirm(true)}>Reset demo store…</button>}
          {connections && <p className="sk-menu-note">Saved to {connections.database === 'supabase' ? 'Supabase' : 'a local file'} · Supplier search {connections.tavily ? 'on' : 'off'}</p>}
        </div>}
      </div>
    </header>

    <main className="sk-main" id="main-content">
      {offline && state && <div className="sk-alert" role="status">Couldn’t reach the store. Retrying…</div>}
      {error && <div className="sk-alert error" role="alert"><span>{error}</span><button className="sk-text-link" onClick={() => setError('')}>Dismiss</button></div>}
      {!dash ? <p className="sk-loading" role="status">{offline ? 'Couldn’t reach the store. Retrying…' : 'Loading your store…'}</p> : <>
        {view === 'today' && <Today {...dash} />}
        {view === 'inbox' && <InboxView {...dash} />}
        {view === 'stock' && <StockView {...dash} />}
        {view === 'suppliers' && <Restock {...dash} />}
      </>}
    </main>

    {notice && <div className="sk-toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
  </div>;
}
