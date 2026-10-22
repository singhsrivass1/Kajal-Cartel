import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { Types } from 'mongoose';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import User from '@/lib/db/models/User';

export const ADMIN_AUTH_PROVIDER = 'google';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export async function isAuthorizedAdmin(userId: unknown, authProvider: unknown): Promise<boolean> {
  if (authProvider !== ADMIN_AUTH_PROVIDER) return false;
  if (typeof userId !== 'string' || !OBJECT_ID_RE.test(userId)) return false;

  try {
    const db = (await dbConnect()).connection.db;
    if (!db) return false;

    const _id = new Types.ObjectId(userId);
    const [user, googleAccount] = await Promise.all([
      User.findById(_id).select('role').lean<{ role?: unknown }>(),
      db.collection('accounts').findOne(
        { userId: _id, provider: ADMIN_AUTH_PROVIDER },
        { projection: { _id: 1 } }
      ),
    ]);

    return user?.role === 'admin' && googleAccount !== null;
  } catch (err) {
    console.error('[admin-auth] Authorization lookup failed:', err instanceof Error ? err.name : 'unknown error');
    return false;
  }
}

export async function getAdminSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: unknown; authProvider?: unknown } | undefined;
  if (!session || !user) return null;

  return (await isAuthorizedAdmin(user.id, user.authProvider)) ? session : null;
}
