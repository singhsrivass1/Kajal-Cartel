import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/pageGuards';

export const metadata: Metadata = {
  title: 'Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage('/admin');

  return <>{children}</>;
}
