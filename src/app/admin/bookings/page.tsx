import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';
import { dbConnect } from '@/lib/db/connect';
import Booking from '@/lib/db/models/Booking';
import { refFromId } from '@/lib/db/controllers/BookingManager';
import { AdminBookingsClient } from './_components/AdminBookingsClient';
import type { BookingStatus } from '@/lib/db/models/Booking';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bookings — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

export interface AdminBookingRow {
  id: string;
  ref: string;
  status: BookingStatus;
  vendorName: string;
  vendorSlug: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
  depositAmount: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerNotes?: string;
  adminNotes?: string;
  createdAt: string;
}

const STATUS_SORT_ORDER: Record<BookingStatus, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  COMPLETED: 2,
  DECLINED: 3,
  CANCELLED: 4,
};

export default async function AdminBookingsPage() {
  const session = await getAdminSession();
  if (!session) redirect('/auth?callbackUrl=/admin');

  await dbConnect();
  const bookingDocs = await Booking.find({})
    .sort({ createdAt: -1 })
    .populate('vendor', 'name slug')
    .populate('service', 'name')
    .lean<Array<Record<string, any>>>();

  const bookings: AdminBookingRow[] = bookingDocs
    .filter((b) => b.vendor && b.service)
    .map((b): AdminBookingRow => ({
      id: b._id.toString(),
      ref: refFromId(b._id),
      status: b.status as BookingStatus,
      vendorName: b.vendor.name,
      vendorSlug: b.vendor.slug,
      serviceName: b.service.name,
      date: new Date(b.date).toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime,
      total: b.priceSnapshot.total,
      depositAmount: b.priceSnapshot.depositAmount,
      contactName: b.contactInfo.name,
      contactPhone: b.contactInfo.phone,
      contactEmail: b.contactInfo.email,
      customerNotes: b.customerNotes,
      adminNotes: b.adminNotes,
      createdAt: new Date(b.createdAt).toISOString(),
    }))
    .sort((a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]);

  return <AdminBookingsClient adminEmail={session.user?.email ?? ''} bookings={bookings} />;
}
