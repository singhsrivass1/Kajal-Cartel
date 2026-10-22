import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { getVendorForAdmin, updateVendorProfile } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const vendor = await getVendorForAdmin(params.id);
    return { vendor: JSON.parse(JSON.stringify(vendor)) };
  }, 'GET /api/admin/vendors/[id]', request);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    await updateVendorProfile(params.id, body);
    return { success: true };
  }, 'PATCH /api/admin/vendors/[id]', request);
}
