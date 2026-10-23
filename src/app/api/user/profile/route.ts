import { withUser, readJsonObject } from '@/lib/api/userRoute';
import { RATE_LIMITS } from '@/lib/api/rateLimit';
import { getProfile, updateProfile } from '@/lib/db/controllers/ProfileManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withUser(request, 'GET /api/user/profile', async ({ userId }) => ({ profile: await getProfile(userId) }));
}

export async function PATCH(request: Request) {
  return withUser(
    request,
    'PATCH /api/user/profile',
    async ({ userId }) => {
      const body = await readJsonObject(request);
      return { profile: await updateProfile(userId, body) };
    },
    { scope: 'profile', rule: RATE_LIMITS.profile }
  );
}
