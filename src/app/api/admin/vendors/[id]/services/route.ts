import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { listServicesForVendor, createService } from '@/lib/db/controllers/VendorAdminManager';
import type { ServiceInput } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const services = await listServicesForVendor(params.id);
    return { services: JSON.parse(JSON.stringify(services)) };
  }, 'GET /api/admin/vendors/[id]/services', request);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    return createService(params.id, body as unknown as ServiceInput);
  }, 'POST /api/admin/vendors/[id]/services', request);
}
