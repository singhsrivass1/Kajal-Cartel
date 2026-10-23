import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSessionUserId } from '@/lib/api/userRoute';
import { dbConnect } from '@/lib/db/connect';
import { getProfile } from '@/lib/db/controllers/ProfileManager';
import { AccountClient } from './_components/AccountClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile & Settings — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getSessionUserId();
  if (!user) redirect('/auth?callbackUrl=/account');

  await dbConnect();
  let profile;
  try {
    profile = await getProfile(user.userId);
  } catch {
    redirect('/auth?callbackUrl=/account');
  }

  const session = await getServerSession(authOptions);
  const provider = (session?.user as { authProvider?: unknown } | undefined)?.authProvider;

  return <AccountClient profile={profile} signInMethod={provider === 'google' ? 'Google' : provider === 'credentials' ? 'Email and password' : 'Your sign-in provider'} />;
}
