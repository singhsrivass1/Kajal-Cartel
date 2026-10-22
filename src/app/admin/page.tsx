import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';
import { AdminHome } from './_components/AdminHome';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect('/auth?callbackUrl=/admin');

  return <AdminHome adminEmail={session.user?.email ?? ''} />;
}
