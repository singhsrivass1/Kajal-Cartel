import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/pageGuards';
import { dbConnect } from '@/lib/db/connect';
import { listVendorsForAdmin } from '@/lib/db/controllers/VendorAdminManager';
import { AdminVendorsClient } from './_components/AdminVendorsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vendors — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AdminVendorsPage() {
  const session = await requireAdminPage('/admin/vendors');

  await dbConnect();
  const vendors = await listVendorsForAdmin();

  return <AdminVendorsClient adminEmail={session.user?.email ?? ''} initialVendors={vendors} />;
}
