import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { addBlockedDate, VendorAdminError } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    if (typeof body.startDate !== 'string' || typeof body.endDate !== 'string') {
      throw new VendorAdminError('startDate and endDate are required (YYYY-MM-DD).');
    }
    return addBlockedDate(
      params.id,
      body.startDate,
      body.endDate,
      typeof body.reason === 'string' ? body.reason : undefined
    );
  }, 'POST /api/admin/vendors/[id]/blocked-dates', request);
}
