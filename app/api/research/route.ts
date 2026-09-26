import { NextResponse, type NextRequest } from 'next/server';
import { handleResearch } from '@/lib/research/handler';
import { createSupplierSearch } from '@/lib/research/search';

// One client per server instance so repeated queries hit the in-memory cache.
// Discovery only: this route never reads or writes the store, quotes or purchases.
let search: ReturnType<typeof createSupplierSearch> | null = null;
let searchKey: string | undefined;

function getSearch() {
  const key = process.env.TAVILY_API_KEY || undefined;
  if (!search || key !== searchKey) { search = createSupplierSearch({ apiKey: key }); searchKey = key; }
  return search;
}

export async function POST(request: NextRequest) {
  const { status, body } = await handleResearch(getSearch(), {
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    selfOrigin: request.nextUrl.origin,
    readBody: () => request.text(),
  });
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
