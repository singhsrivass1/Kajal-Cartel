import { getAdminSession } from '@/lib/auth/admin';
import { withAdmin, readJson } from '@/lib/api/adminRoute';
import { linkArtistAccount, listArtistAccounts, unlinkArtistAccount } from '@/lib/db/controllers/AdminInsightsManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function adminUserId(): Promise<string> {
  const session = await getAdminSession();
  return (session?.user as { id?: string } | undefined)?.id ?? '';
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return withAdmin(async () => ({ accounts: await listArtistAccounts(params.id) }), 'GET /api/admin/vendors/[id]/artist-accounts', request);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withAdmin(
    async () => {
      const body = await readJson(request);
      return { account: await linkArtistAccount(params.id, body.email, await adminUserId()) };
    },
    'POST /api/admin/vendors/[id]/artist-accounts',
    request
  );
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return withAdmin(
    async () => {
      const userId = new URL(request.url).searchParams.get('userId');
      await unlinkArtistAccount(params.id, userId, await adminUserId());
      return { success: true };
    },
    'DELETE /api/admin/vendors/[id]/artist-accounts',
    request
  );
}
