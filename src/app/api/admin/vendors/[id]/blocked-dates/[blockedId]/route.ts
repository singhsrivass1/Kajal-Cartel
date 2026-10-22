import type { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/adminRoute';
import { deleteBlockedDate } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; blockedId: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    await deleteBlockedDate(params.id, params.blockedId);
    return { success: true };
  }, 'DELETE /api/admin/vendors/[id]/blocked-dates/[blockedId]', request);
}
