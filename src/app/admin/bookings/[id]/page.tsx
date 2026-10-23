import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/pageGuards';
import { dbConnect } from '@/lib/db/connect';
import { getBookingForAdmin } from '@/lib/db/controllers/AdminInsightsManager';
import { AdminHeader } from '../../_components/AdminHeader';
import { BookingActions } from '../_components/AdminBookingsClient';
import { StatusBadge } from '@/components/booking/StatusBadge';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Booking — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatStamp(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

const card = { border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '20px 22px' } as const;
const h2 = { fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: '#7A706A', margin: '0 0 14px', fontWeight: 400 };

export default async function AdminBookingDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdminPage(`/admin/bookings/${params.id}`);
  await dbConnect();
  const b = await getBookingForAdmin(params.id);
  if (!b) notFound();

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={session.user?.email ?? ''} />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1100px', margin: '0 auto', paddingTop: '40px', paddingBottom: '96px' }}>
        <Link href="/admin/bookings" style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8A8078', textDecoration: 'none' }}>← All bookings</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', margin: '18px 0 24px' }}>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#C9A96E', margin: '0 0 6px', fontFamily: '"JetBrains Mono", monospace' }}>{b.ref}</p>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', color: '#F0EBE0', fontWeight: 400, margin: 0 }}>
              {b.serviceName} · {b.vendorName}
            </h1>
          </div>
          <StatusBadge status={b.status} label={b.status.charAt(0) + b.status.slice(1).toLowerCase()} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr]" style={{ gap: '16px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <section style={card}>
              <h2 style={h2}>Appointment</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px', margin: 0, fontSize: '13px' }}>
                <div><dt style={{ color: '#5A5450', fontSize: '10px' }}>Date</dt><dd style={{ margin: 0, color: '#C8B9A8' }}>{b.date}</dd></div>
                <div><dt style={{ color: '#5A5450', fontSize: '10px' }}>Time</dt><dd style={{ margin: 0, color: '#C8B9A8' }}>{b.startTime}–{b.endTime} IST</dd></div>
                <div><dt style={{ color: '#5A5450', fontSize: '10px' }}>Requested</dt><dd style={{ margin: 0, color: '#C8B9A8' }}>{formatStamp(b.createdAt)}</dd></div>
                <div><dt style={{ color: '#5A5450', fontSize: '10px' }}>Reschedules</dt><dd style={{ margin: 0, color: '#C8B9A8' }}>{b.rescheduleCount}</dd></div>
              </dl>
              {b.awaitingCompletion && (
                <p style={{ fontSize: '12px', color: '#C97A5A', margin: '14px 0 0' }}>The appointment time has passed. Mark it completed (which lets the client review) or cancel it.</p>
              )}
              {b.cancellationReason && <p style={{ fontSize: '12px', color: '#9A8A7A', margin: '14px 0 0' }}>Cancellation reason: {b.cancellationReason}</p>}
            </section>

            <section style={card}>
              <h2 style={h2}>Estimate</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {b.lineItems.map((li, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#C8B9A8' }}>
                    <span>{li.quantity > 1 ? `${li.quantity}× ` : ''}{li.name}{li.discountLabel ? ` (${li.discountLabel})` : ''}</span>
                    <span>{formatINR(li.subtotalINR)}</span>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: '13px', color: '#F0EBE0', margin: '12px 0 0', borderTop: '1px solid #1C1C1C', paddingTop: '10px' }}>
                Total {formatINR(b.total)} · deposit {formatINR(b.depositAmount)}
              </p>
            </section>

            <section style={card}>
              <h2 style={h2}>History (internal)</h2>
              {b.history.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#7A706A', margin: 0 }}>No recorded history (this booking predates history tracking).</p>
              ) : (
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {b.history.map((h, i) => (
                    <li key={i} style={{ fontSize: '12px', color: '#C8B9A8' }}>
                      <span style={{ color: '#7A706A' }}>{formatStamp(h.at)} · {h.actor}</span>{' '}
                      {h.action === 'created' ? 'created the request' : h.action === 'rescheduled' ? `rescheduled (${h.detail ?? ''})` : `${h.fromStatus} → ${h.toStatus}`}
                      {h.note && <span style={{ display: 'block', color: '#9A8A7A', marginTop: '2px' }}>Note: {h.note}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <section style={card}>
              <h2 style={h2}>Update status</h2>
              <BookingActions booking={{ id: b.id, status: b.status }} />
            </section>
            <section style={card}>
              <h2 style={h2}>Client</h2>
              <p style={{ fontSize: '13px', color: '#F0EBE0', margin: '0 0 4px' }}>{b.contactName}</p>
              <p style={{ fontSize: '12px', color: '#C8B9A8', margin: '0 0 2px' }}><a href={`tel:${b.contactPhone.replace(/[^\d+]/g, '')}`} style={{ color: '#C9A96E' }}>{b.contactPhone}</a></p>
              <p style={{ fontSize: '12px', color: '#C8B9A8', margin: '0 0 10px', wordBreak: 'break-all' }}><a href={`mailto:${b.contactEmail}?subject=${encodeURIComponent(`Your booking ${b.ref}`)}`} style={{ color: '#C9A96E' }}>{b.contactEmail}</a></p>
              {b.customerAccountEmail && b.customerAccountEmail !== b.contactEmail && (
                <p style={{ fontSize: '11px', color: '#7A706A', margin: '0 0 10px' }}>Account email: {b.customerAccountEmail}</p>
              )}
              {b.customerNotes && <p style={{ fontSize: '12px', color: '#9A8A7A', margin: '0 0 10px', borderLeft: '2px solid #2A2520', paddingLeft: '10px' }}>{b.customerNotes}</p>}
              <Link href={`/admin/bookings?q=${encodeURIComponent(b.contactEmail)}`} style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C9A96E' }}>Other bookings from this client</Link>
            </section>
            {b.review && (
              <section style={card}>
                <h2 style={h2}>Review</h2>
                <p style={{ fontSize: '13px', color: '#C8B9A8', margin: '0 0 8px' }}>{b.review.rating}★ · {b.review.status}</p>
                <Link href="/admin/reviews" style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C9A96E' }}>Moderate reviews</Link>
              </section>
            )}
            {b.vendorSlug && (
              <Link href={`/artists/${b.vendorSlug}`} style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8078' }}>View public artist page ↗</Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
