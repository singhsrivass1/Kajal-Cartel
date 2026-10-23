import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/pageGuards';
import { dbConnect } from '@/lib/db/connect';
import { searchBookingsForAdmin } from '@/lib/db/controllers/AdminInsightsManager';
import type { BookingSearchFilters } from '@/lib/db/controllers/AdminInsightsManager';
import { AdminBookingsClient } from './_components/AdminBookingsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bookings — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AdminBookingsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const session = await requireAdminPage('/admin/bookings');
  await dbConnect();

  const pick = (key: keyof BookingSearchFilters) => {
    const value = searchParams?.[key];
    return typeof value === 'string' ? value : undefined;
  };
  const result = await searchBookingsForAdmin({
    q: pick('q'),
    status: pick('status'),
    vendor: pick('vendor'),
    service: pick('service'),
    from: pick('from'),
    to: pick('to'),
    view: pick('view'),
    page: pick('page'),
  });

  return <AdminBookingsClient adminEmail={session.user?.email ?? ''} result={result} />;
}
