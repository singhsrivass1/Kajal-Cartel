import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import {
  uploadPortfolioImage,
  deletePortfolioImage,
  VendorAdminError,
} from '@/lib/db/controllers/VendorAdminManager';
import type { UploadPortfolioImageInput } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    return uploadPortfolioImage(params.id, body as unknown as UploadPortfolioImageInput);
  }, 'POST /api/admin/vendors/[id]/portfolio', request);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    if (typeof body.imageUrl !== 'string' || !body.imageUrl) {
      throw new VendorAdminError('imageUrl is required.');
    }
    await deletePortfolioImage(params.id, body.imageUrl);
    return { success: true };
  }, 'DELETE /api/admin/vendors/[id]/portfolio', request);
}
