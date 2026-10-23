import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/api/userRoute';
import { dbConnect } from '@/lib/db/connect';
import { getCustomerBookingDetail } from '@/lib/db/controllers/BookingViews';
import { getSupportContact } from '@/lib/site/config';
import { BookingDetailClient } from './_components/BookingDetailClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Booking Details — Kajal Cartel',
  robots: { index: false, follow: false },
};

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUserId();
  if (!user) {
    redirect(`/auth?callbackUrl=${encodeURIComponent(`/journey/bookings/${params.id}`)}`);
  }

  await dbConnect();
  const booking = await getCustomerBookingDetail(user.userId, params.id);
  if (!booking) notFound();

  return <BookingDetailClient booking={booking} supportEmail={getSupportContact().email} />;
}
