import { NextRequest, NextResponse } from 'next/server';
import { readState, mutate, connections } from '@/lib/store';
import { authorizeAction, clientKey, identifyCaller } from '@/lib/store-access';
import type { Action } from '@/lib/types';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json({ state: await readState(), connections: connections() }); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const caller = identifyCaller(request);
  if (!caller.sameOrigin && !caller.agent) return NextResponse.json({ error: 'Use this workspace or an authorized agent connection.' }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 16000) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    let action: Action;
    try { action = JSON.parse(body) as Action; }
    catch { return NextResponse.json({ error: 'Send a valid JSON action.' }, { status: 400 }); }
    const access = authorizeAction(caller, clientKey(request), action);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: access.retryAfter ? { 'Retry-After': String(access.retryAfter) } : undefined });
    return NextResponse.json({ state: await mutate(access.action), connections: connections() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process this action.';
    const status = /workspace changed/.test(message) ? 409 : /workspace is unavailable|Could not save|Connect Supabase/.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
