import { NextRequest, NextResponse } from 'next/server';
import { authenticateWassist, stockRequestAction, WassistRequestError } from '@/lib/commerce/wassist';
import { createRateLimiter } from '@/lib/rate-limit';
import { mutate } from '@/lib/store';
import { available } from '@/lib/types';
export const dynamic = 'force-dynamic';
const limiter = createRateLimiter({ perClient: 15, total: 120 });

export async function POST(request: NextRequest) {
  try {
    const contactRef = authenticateWassist(request, process.env.WASSIST_TOOL_TOKEN);
    const limit = limiter.take(contactRef);
    if (!limit.ok) return NextResponse.json({ error: 'Please wait before submitting another request.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
    const raw = await request.text();
    if (raw.length > 2048) throw new WassistRequestError('Request is too large.', 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new WassistRequestError('Send valid JSON.'); }
    const action = stockRequestAction(body, contactRef);
    const state = await mutate(action);
    const record = state.stockRequests!.find(r => r.contactRef === contactRef && r.channel === 'whatsapp' && r.productId === action.productId)!;
    const product = state.products.find(p => p.id === record.productId)!;
    return NextResponse.json({ requestId: record.id, status: 'interest_recorded', quantity: record.quantity, product: product.name, variant: product.variant, available: available(product), reserved: 0, paymentTaken: false, message: 'Your interest is recorded for merchant review. No stock is reserved, no notification is scheduled and no delivery date is promised. This is a fictional demo store.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not record this request.';
    const status = error instanceof WassistRequestError ? error.status : /workspace changed|already exists/.test(message) ? 409 : /workspace is unavailable|Could not save|Connect Supabase/.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
