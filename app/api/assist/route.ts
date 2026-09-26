import { handleAssistRequest } from '@/lib/agents/sales';
import { readState } from '@/lib/store';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleAssistRequest(request, { readState });
}
