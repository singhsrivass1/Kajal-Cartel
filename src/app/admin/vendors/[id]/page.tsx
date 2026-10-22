import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';
import { dbConnect } from '@/lib/db/connect';
import {
  getVendorForAdmin,
  listServicesForVendor,
  getAvailabilityForAdmin,
  VendorAdminError,
} from '@/lib/db/controllers/VendorAdminManager';
import { VendorEditorClient } from './_components/VendorEditorClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Vendor — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AdminVendorEditPage({ params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) redirect('/auth?callbackUrl=/admin');

  await dbConnect();

  try {
    const [vendor, services, availability] = await Promise.all([
      getVendorForAdmin(params.id),
      listServicesForVendor(params.id),
      getAvailabilityForAdmin(params.id),
    ]);

    return (
      <VendorEditorClient
        adminEmail={session.user?.email ?? ''}
        vendorId={params.id}
        vendor={JSON.parse(JSON.stringify(vendor))}
        services={JSON.parse(JSON.stringify(services))}
        availability={availability}
      />
    );
  } catch (err) {
    if (err instanceof VendorAdminError && err.statusCode === 404) notFound();
    throw err;
  }
}
