import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { updateService, deleteService } from '@/lib/db/controllers/VendorAdminManager';
import type { ServiceInput } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: { serviceId: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    await updateService(params.serviceId, body as unknown as ServiceInput);
    return { success: true };
  }, 'PATCH /api/admin/services/[serviceId]', request);
}

export async function DELETE(
  request: Request,
  { params }: { params: { serviceId: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    await deleteService(params.serviceId);
    return { success: true };
  }, 'DELETE /api/admin/services/[serviceId]', request);
}
