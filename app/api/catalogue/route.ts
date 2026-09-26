import { NextResponse } from 'next/server';
import { customerCatalogue } from '@/lib/commerce/catalogue';
import { readState } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json(customerCatalogue(await readState()), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Current inventory is unavailable. Do not promise stock or delivery.' }, { status: 503 }); }
}
