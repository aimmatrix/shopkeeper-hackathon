import { NextRequest, NextResponse } from 'next/server';
import { buildExport, parseExportType, UNSUPPORTED_EXPORT_TYPE } from '@/lib/export-csv';
import { readState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const type = parseExportType(request.nextUrl.searchParams.get('type'));
  if (!type) return NextResponse.json({ error: UNSUPPORTED_EXPORT_TYPE }, { status: 400 });
  try {
    const { csv, filename, contentType } = buildExport(await readState(), type);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 503 });
  }
}
