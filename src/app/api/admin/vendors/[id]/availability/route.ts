import type { NextResponse } from 'next/server';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { getAvailabilityForAdmin, updateWorkingHours } from '@/lib/db/controllers/VendorAdminManager';
import type { WorkingHoursInput } from '@/lib/db/controllers/VendorAdminManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(
    async () => getAvailabilityForAdmin(params.id),
    'GET /api/admin/vendors/[id]/availability',
    request
  );
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAdmin(async () => {
    const body = await readJson(request);
    await updateWorkingHours(
      params.id,
      body.workingHours as WorkingHoursInput[],
      typeof body.slotIntervalMinutes === 'number' ? body.slotIntervalMinutes : 30
    );
    return { success: true };
  }, 'PUT /api/admin/vendors/[id]/availability', request);
}
