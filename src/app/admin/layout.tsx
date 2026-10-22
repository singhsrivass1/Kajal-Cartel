import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/auth?callbackUrl=/admin');
  }

  return <>{children}</>;
}
