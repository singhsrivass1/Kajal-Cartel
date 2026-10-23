import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/pageGuards';
import { dbConnect } from '@/lib/db/connect';
import { listReviewsForAdmin } from '@/lib/db/controllers/ReviewManager';
import { AdminReviewsClient } from './_components/AdminReviewsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reviews — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage({ searchParams }: { searchParams?: { status?: string } }) {
  const session = await requireAdminPage('/admin/reviews');
  await dbConnect();
  const status = searchParams?.status === 'published' || searchParams?.status === 'hidden' ? searchParams.status : '';
  const reviews = await listReviewsForAdmin({ status });
  return <AdminReviewsClient adminEmail={session.user?.email ?? ''} reviews={reviews} status={status} />;
}
