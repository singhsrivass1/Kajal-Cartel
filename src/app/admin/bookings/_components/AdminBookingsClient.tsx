'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminHeader } from '../../_components/AdminHeader';
import { StatusBadge } from '@/components/booking/StatusBadge';
import type { AdminBookingRow, BookingSearchResult } from '@/lib/db/controllers/AdminInsightsManager';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const FONT_MONO = '"JetBrains Mono", "Courier New", monospace';

// Mirrors BOOKING_STATUS_TRANSITIONS in src/lib/db/models/Booking.ts. Redeclared here
// rather than imported, since that file pulls in mongoose (server-only) — this is a
// deliberately duplicated, client-safe copy, not a second source of truth for the
// server-side transition rule, which is still enforced by the API regardless of
// what this UI offers as buttons.
type Status = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  PENDING: ['CONFIRMED', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'COMPLETED'],
  DECLINED: [],
  CANCELLED: [],
  COMPLETED: [],
};

const STATUS_COLOR: Record<Status, string> = {
  PENDING: '#C9A96E',
  CONFIRMED: '#5A8A5A',
  DECLINED: '#B07A6A',
  CANCELLED: '#8A8078',
  COMPLETED: '#9A8AEE',
};

const ACTION_LABEL: Record<Status, string> = {
  PENDING: 'Mark Pending',
  CONFIRMED: 'Confirm',
  DECLINED: 'Decline',
  CANCELLED: 'Cancel',
  COMPLETED: 'Mark Completed',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '12px',
  background: '#080808',
  border: '1px solid #1C1C1C',
  color: '#F0EBE0',
  fontFamily: 'inherit',
} as const;

const labelStyle = { display: 'block', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#7A706A', marginBottom: '5px' };

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function BookingActions({ booking, onUpdated }: { booking: { id: string; status: Status }; onUpdated?: (status: Status) => void }) {
  const [status, setStatus] = useState<Status>(booking.status);
  const [noteDraft, setNoteDraft] = useState('');
  const [isUpdating, setIsUpdating] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<Status | null>(null);
  const availableActions = STATUS_TRANSITIONS[status];

  const handleTransition = async (nextStatus: Status) => {
    if (isUpdating) return;
    if ((nextStatus === 'CANCELLED' || nextStatus === 'DECLINED') && confirmAction !== nextStatus) {
      setConfirmAction(nextStatus);
      return;
    }
    setConfirmAction(null);
    setIsUpdating(nextStatus);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          ...(noteDraft.trim() ? { adminNotes: noteDraft.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw new Error('Your admin session has expired. Please sign in again.');
      if (!res.ok) throw new Error(data.error ?? 'Could not update this booking.');
      setStatus(nextStatus);
      setNoteDraft('');
      onUpdated?.(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this booking.');
    } finally {
      setIsUpdating(null);
    }
  };

  if (availableActions.length === 0) {
    return <p style={{ fontSize: '11px', color: '#7A706A', margin: 0 }}>No further status changes are possible.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label htmlFor={`note-${booking.id}`} className="sr-only">Admin note</label>
      <input
        id={`note-${booking.id}`}
        type="text"
        placeholder="Add an internal note (optional, saved with the action you take)"
        value={noteDraft}
        onChange={e => setNoteDraft(e.target.value)}
        maxLength={500}
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {availableActions.map(action => (
          <button
            key={action}
            type="button"
            onClick={() => handleTransition(action)}
            disabled={isUpdating !== null}
            style={{
              fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '9px 16px',
              border: `1px solid ${STATUS_COLOR[action]}`, color: STATUS_COLOR[action],
              background: confirmAction === action ? 'rgba(180,90,74,0.12)' : 'none', cursor: isUpdating !== null ? 'default' : 'pointer',
              opacity: isUpdating !== null && isUpdating !== action ? 0.4 : 1,
            }}
          >
            {isUpdating === action ? 'Updating…' : confirmAction === action ? `Confirm ${ACTION_LABEL[action].toLowerCase()}?` : ACTION_LABEL[action]}
          </button>
        ))}
      </div>
      {error && <p role="alert" style={{ fontSize: '11px', color: 'rgba(220,80,80,0.85)', margin: 0 }}>{error}</p>}
    </div>
  );
}

function BookingRow({ booking }: { booking: AdminBookingRow }) {
  const [status, setStatus] = useState<Status>(booking.status as Status);

  return (
    <li style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '20px 22px', listStyle: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
        <div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', margin: '0 0 4px' }}>
            <Link href={`/admin/bookings/${booking.id}`} className="kc-nav-link" style={{ color: 'inherit', textDecoration: 'none' }}>
              {booking.vendorName} — {booking.serviceName}
            </Link>
          </p>
          <p style={{ fontSize: '11px', color: '#7A706A', margin: 0, fontFamily: FONT_MONO }}>{booking.ref}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {booking.awaitingCompletion && status === booking.status && (
            <span style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C97A5A', border: '1px solid #5A3A2A', padding: '3px 8px' }}>Time passed</span>
          )}
          <StatusBadge status={status} label={status.charAt(0) + status.slice(1).toLowerCase()} />
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '14px', margin: '0 0 16px' }}>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5450', margin: '0 0 3px' }}>Date &amp; time</dt>
          <dd style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{formatDate(booking.date)} · {formatSlotLabel(booking.startTime)}–{formatSlotLabel(booking.endTime)}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5450', margin: '0 0 3px' }}>Client</dt>
          <dd style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{booking.contactName}</dd>
          <dd style={{ fontSize: '11px', color: '#8A8078', margin: 0, wordBreak: 'break-word' }}>{booking.contactPhone} · {booking.contactEmail}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5450', margin: '0 0 3px' }}>Total / deposit</dt>
          <dd style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{formatINR(booking.total)} / {formatINR(booking.depositAmount)}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A5450', margin: '0 0 3px' }}>Requested</dt>
          <dd style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>
            {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {booking.rescheduleCount > 0 ? ` · rescheduled ×${booking.rescheduleCount}` : ''}
          </dd>
        </div>
      </dl>

      {booking.customerNotes && (
        <p style={{ fontSize: '12px', color: '#9A8A7A', lineHeight: 1.6, marginBottom: '12px', borderLeft: '2px solid #2A2520', paddingLeft: '12px' }}>
          Client note: {booking.customerNotes}
        </p>
      )}
      {booking.adminNotes && (
        <p style={{ fontSize: '12px', color: '#9A8A7A', lineHeight: 1.6, marginBottom: '12px', borderLeft: '2px solid #2A2520', paddingLeft: '12px' }}>
          Admin note: {booking.adminNotes}
        </p>
      )}

      <div style={{ borderTop: '1px solid #141210', paddingTop: '14px' }}>
        <BookingActions booking={{ id: booking.id, status: booking.status as Status }} onUpdated={setStatus} />
      </div>
    </li>
  );
}

function pageHref(filters: BookingSearchResult['filters'], page: number): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return `/admin/bookings${qs ? `?${qs}` : ''}`;
}

export function AdminBookingsClient({ adminEmail, result }: { adminEmail: string; result: BookingSearchResult }) {
  const { rows, total, page, pageSize, filters, vendors, services } = result;
  const [vendorChoice, setVendorChoice] = useState(filters.vendor);
  const serviceOptions = vendorChoice ? services.filter((s) => s.vendorId === vendorChoice) : services;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtersActive = Object.values(filters).some(Boolean);

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={adminEmail} />

      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '8px' }}>
            {total} matching booking{total === 1 ? '' : 's'}
          </p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 2.6rem)', color: '#F0EBE0', fontWeight: 400 }}>
            Bookings
          </h1>
        </div>

        <form method="get" action="/admin/bookings" role="search" aria-label="Filter bookings" style={{ border: '1px solid #141210', background: '#0A0A0A', padding: '18px', marginBottom: '24px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '12px' }}>
            <div className="lg:col-span-2">
              <label htmlFor="f-q" style={labelStyle}>Search</label>
              <input id="f-q" name="q" defaultValue={filters.q} placeholder="Reference (KC-…), client name, email or phone" maxLength={100} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="f-status" style={labelStyle}>Status</label>
              <select id="f-status" name="status" defaultValue={filters.status} style={inputStyle}>
                <option value="">Any status</option>
                {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'DECLINED'] as Status[]).map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-view" style={labelStyle}>Timing</label>
              <select id="f-view" name="view" defaultValue={filters.view} style={inputStyle}>
                <option value="">Any time (newest requests first)</option>
                <option value="upcoming">Upcoming (soonest first)</option>
                <option value="awaiting">Past, not yet completed</option>
                <option value="past">Past appointments</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-vendor" style={labelStyle}>Artist</label>
              <select id="f-vendor" name="vendor" value={vendorChoice} onChange={(e) => setVendorChoice(e.target.value)} style={inputStyle}>
                <option value="">All artists</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-service" style={labelStyle}>Service</label>
              <select id="f-service" name="service" defaultValue={filters.service} key={vendorChoice} style={inputStyle}>
                <option value="">All services</option>
                {serviceOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-from" style={labelStyle}>Appointment from</label>
              <input id="f-from" name="from" type="date" defaultValue={filters.from} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label htmlFor="f-to" style={labelStyle}>Appointment to</label>
              <input id="f-to" name="to" type="date" defaultValue={filters.to} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '14px', alignItems: 'center' }}>
            <button type="submit" style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', padding: '10px 18px', background: '#C9A96E', color: '#080808', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Apply filters
            </button>
            {filtersActive && (
              <Link href="/admin/bookings" style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C9A96E' }}>Clear</Link>
            )}
          </div>
        </form>

        {rows.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '64px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', fontStyle: 'italic', color: '#8A8078', margin: 0 }}>
              {filtersActive ? 'No bookings match these filters.' : 'No bookings yet.'}
            </p>
          </div>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: 0 }}>
            {rows.map(b => <BookingRow key={b.id} booking={b} />)}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            {page > 1 ? <Link href={pageHref(filters, page - 1)} style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C9A96E' }}>← Previous</Link> : <span />}
            <span style={{ fontSize: '11px', color: '#7A706A' }}>Page {page} of {pages}</span>
            {page < pages ? <Link href={pageHref(filters, page + 1)} style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C9A96E' }}>Next →</Link> : <span />}
          </nav>
        )}
      </main>
    </div>
  );
}
