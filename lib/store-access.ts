import { timingSafeEqual } from 'node:crypto';
import { createRateLimiter, type RateLimiter } from './agents/sales';
import type { Action } from './types';

// A matching Origin is CSRF protection, not authentication: the demo workspace is public and login-free, so a
// scripted client can send any Origin. Until the merchant signs in, per-client limits bound what such a caller
// can do, and a reset (which wipes the shared workspace) has its own much tighter budget.
export const actionLimiter = createRateLimiter({ perClient: 40, total: 400, windowMs: 60_000 });
export const resetLimiter = createRateLimiter({ perClient: 3, total: 6, windowMs: 10 * 60_000 });

export type Caller = { agent: boolean; sameOrigin: boolean };
export type Access = { ok: true; action: Action } | { ok: false; status: number; error: string; retryAfter?: number };

export function identifyCaller(request: Request, token = process.env.SHOPKEEPER_AGENT_TOKEN): Caller {
  let agent = false;
  const auth = request.headers.get('authorization');
  if (token && auth) {
    const given = Buffer.from(auth), expected = Buffer.from(`Bearer ${token}`);
    agent = given.length === expected.length && timingSafeEqual(given, expected);
  }
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin && (new URL(origin).origin === new URL(request.url).origin || new URL(origin).host === request.headers.get('host'))); } catch { /* Invalid origins are unauthorized. */ }
  return { agent, sameOrigin };
}

export function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}

export function authorizeAction(caller: Caller, client: string, action: Action, limits: { actions: RateLimiter; resets: RateLimiter } = { actions: actionLimiter, resets: resetLimiter }): Access {
  if (!caller.sameOrigin && !caller.agent) return { ok: false, status: 403, error: 'Use this workspace or an authorized agent connection.' };
  if (['record_stock_request', 'save_recovery_draft', 'review_recovery_draft'].includes(action?.type)) return { ok: false, status: 403, error: 'Use the dedicated recovery workspace or authenticated WhatsApp tool.' };
  // An agent credential only grants recommendation access, even with a forged Origin.
  if (caller.agent && action?.type !== 'agent_report') return { ok: false, status: 403, error: 'Agent access can submit recommendations only. A merchant must approve purchases.' };
  const general = limits.actions.take(client);
  if (!general.ok) return { ok: false, status: 429, error: `Too many actions. Try again in ${general.retryAfter} seconds.`, retryAfter: general.retryAfter };
  if (action?.type === 'reset') {
    const reset = limits.resets.take(client);
    if (!reset.ok) return { ok: false, status: 429, error: `The demo was reset recently. Try again in ${reset.retryAfter} seconds.`, retryAfter: reset.retryAfter };
  }
  // The server, not the request body, decides where a recommendation came from.
  if (action?.type === 'agent_report') return { ok: true, action: { ...action, source: caller.agent ? 'agent_token' : 'handoff_page' } };
  return { ok: true, action };
}
