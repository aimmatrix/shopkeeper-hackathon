import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { recoveryView } from '@/lib/commerce/recovery';
import { createRateLimiter } from '@/lib/agents/sales';
import { identifyCaller, clientKey } from '@/lib/store-access';
import { mutate, readState } from '@/lib/store';
export const dynamic = 'force-dynamic';
const limiter = createRateLimiter({ perClient: 20, total: 100 });
export async function GET() {
  try { return NextResponse.json(recoveryView(await readState()), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'The recovery workspace is unavailable.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const caller = identifyCaller(request);
  if (!caller.sameOrigin || caller.agent) return NextResponse.json({ error: 'Use the recovery handoff page.' }, { status: 403 });
  const limit = limiter.take(clientKey(request));
  if (!limit.ok) return NextResponse.json({ error: 'Please wait before another action.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
  try {
    const raw = await request.text();
    if (raw.length > 6000) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    const a = JSON.parse(raw);
    if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error('Send a valid action.');
    // Whitelist fields and assign provenance on the server, not from form input.
    const action = a.type === 'demo_request'
      ? { type: 'record_stock_request' as const, channel: 'demo' as const, contactRef: createHash('sha256').update('shopkeeper-recovery-demo-tester').digest('hex'), productId: 'hoodie', quantity: 2 }
      : a.type === 'save_recovery_draft'
        ? { type: 'save_recovery_draft' as const, requestId: a.requestId, text: a.text, rationale: a.rationale, eventId: a.eventId }
        : a.type === 'review_recovery_draft'
          ? { type: 'review_recovery_draft' as const, requestId: a.requestId }
          : null;
    if (!action) throw new Error('Unsupported recovery action.');
    return NextResponse.json(recoveryView(await mutate(action)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save this action.';
    return NextResponse.json({ error: message }, { status: /workspace changed/.test(message) ? 409 : /workspace is unavailable|Could not save|Connect Supabase/.test(message) ? 503 : 400 });
  }
}
