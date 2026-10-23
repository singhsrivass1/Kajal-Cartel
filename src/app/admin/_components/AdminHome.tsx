'use client';

import Link from 'next/link';
import { AdminHeader } from './AdminHeader';
import { StatusBadge } from '@/components/booking/StatusBadge';
import type { AdminBookingRow, AdminOverview } from '@/lib/db/controllers/AdminInsightsManager';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function Metric({ value, label, href, hint }: { value: string | number; label: string; href?: string; hint?: string }) {
  const content = (
    <>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.9rem', color: '#C9A96E', margin: '0 0 4px', fontWeight: 400 }}>{value}</p>
      <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8078', margin: 0 }}>{label}</p>
      {hint && <p style={{ fontSize: '10px', color: '#5A5450', margin: '6px 0 0' }}>{hint}</p>}
    </>
  );
  const style = { display: 'block', border: '1px solid #1E1C1A', padding: '18px 20px', textDecoration: 'none' } as const;
  return href ? <Link href={href} className="kc-menu-item" style={style}>{content}</Link> : <div style={style}>{content}</div>;
}

function MiniList({ title, rows, empty, href }: { title: string; rows: AdminBookingRow[]; empty: string; href: string }) {
  return (
    <section style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', color: '#F0EBE0', fontWeight: 400, margin: 0 }}>{title}</h2>
        <Link href={href} style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C9A96E' }}>View all</Link>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#7A706A', margin: 0 }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/bookings/${r.id}`} className="kc-menu-item" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 8px', textDecoration: 'none', alignItems: 'center' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', color: '#C8B9A8' }}>{formatDay(r.date)} · {r.startTime} — {r.vendorName}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: '#7A706A' }}>{r.serviceName} · {r.contactName} · {r.ref}</span>
                </span>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminHome({ adminEmail, overview }: { adminEmail: string; overview: AdminOverview }) {
  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={adminEmail} />

      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '12px' }}>
          Signed in as {adminEmail}
        </p>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#F0EBE0', fontWeight: 400, marginBottom: '28px' }}>
          Overview
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '12px', marginBottom: '14px' }}>
          <Metric value={overview.pendingRequests} label="Pending requests" href="/admin/bookings?status=PENDING" hint="Awaiting confirm or decline" />
          <Metric value={overview.upcomingConfirmed7} label="Confirmed · next 7 days" href="/admin/bookings?view=upcoming&status=CONFIRMED" />
          <Metric value={overview.upcomingConfirmed30} label="Confirmed · next 30 days" href="/admin/bookings?view=upcoming&status=CONFIRMED" />
          <Metric value={overview.awaitingCompletion} label="Past, not completed" href="/admin/bookings?view=awaiting" hint="Mark completed or cancel" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '12px', marginBottom: '14px' }}>
          <Metric value={formatINR(overview.upcomingConfirmedValueINR)} label="Upcoming confirmed value" hint="Sum of booking estimates" />
          <Metric value={formatINR(overview.completedValueINR)} label="Completed booking value" hint="Estimates — no payments are processed online" />
          <Metric value={overview.counts.COMPLETED} label="Completed bookings" href="/admin/bookings?status=COMPLETED" />
          <Metric value={overview.counts.CANCELLED + overview.counts.DECLINED} label="Cancelled or declined" href="/admin/bookings?status=CANCELLED" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '12px', marginBottom: '32px' }}>
          <Metric value={overview.activeArtists} label="Live artists" href="/admin/vendors" hint={overview.draftArtists ? `${overview.draftArtists} draft` : undefined} />
          <Metric value={overview.customers} label="Customer accounts" href="/admin/customers" />
          <Metric value={overview.reviews.published} label="Published reviews" href="/admin/reviews?status=published" />
          <Metric value={overview.reviews.hidden} label="Hidden reviews" href="/admin/reviews?status=hidden" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '16px' }}>
          <MiniList title="Next confirmed appointments" rows={overview.nextAppointments} empty="No upcoming confirmed appointments." href="/admin/bookings?view=upcoming&status=CONFIRMED" />
          <MiniList title="Oldest pending requests" rows={overview.oldestPending} empty="No pending requests — you're all caught up." href="/admin/bookings?status=PENDING" />
        </div>
      </main>
    </div>
  );
}
