import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { setVendorActive, VendorAdminError } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    if (typeof body.isActive !== 'boolean') {
      throw new VendorAdminError('isActive must be a boolean.');
    }
    await setVendorActive(params.id, body.isActive);
    return { success: true, isActive: body.isActive };
  }, 'PUT /api/admin/vendors/[id]/active', request);
}
