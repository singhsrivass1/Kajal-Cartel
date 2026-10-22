import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { listVendorsForAdmin, createVendorDraft } from '@/lib/db/controllers/VendorAdminManager';
import type { CreateVendorInput } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  return withAdmin(async () => ({ vendors: await listVendorsForAdmin() }), 'GET /api/admin/vendors', request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    return createVendorDraft(body as unknown as CreateVendorInput);
  }, 'POST /api/admin/vendors', request);
}
