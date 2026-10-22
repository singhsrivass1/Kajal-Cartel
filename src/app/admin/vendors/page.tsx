import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';
import { dbConnect } from '@/lib/db/connect';
import { listVendorsForAdmin } from '@/lib/db/controllers/VendorAdminManager';
import { AdminVendorsClient } from './_components/AdminVendorsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vendors — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AdminVendorsPage() {
  const session = await getAdminSession();
  if (!session) redirect('/auth?callbackUrl=/admin');

  await dbConnect();
  const vendors = await listVendorsForAdmin();

  return <AdminVendorsClient adminEmail={session.user?.email ?? ''} initialVendors={vendors} />;
}
