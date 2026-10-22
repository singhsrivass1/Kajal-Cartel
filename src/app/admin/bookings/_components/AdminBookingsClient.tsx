'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminHeader } from '../../_components/AdminHeader';
import type { AdminBookingRow } from '../page';

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

const STATUS_LABEL: Record<Status, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#C9A96E' },
  CONFIRMED: { label: 'Confirmed', color: '#5A8A5A' },
  DECLINED: { label: 'Declined', color: '#8A5A4A' },
  CANCELLED: { label: 'Cancelled', color: '#6A6460' },
  COMPLETED: { label: 'Completed', color: '#7A6ADE' },
};

const ACTION_LABEL: Record<Status, string> = {
  PENDING: 'Mark Pending',
  CONFIRMED: 'Confirm',
  DECLINED: 'Decline',
  CANCELLED: 'Cancel',
  COMPLETED: 'Mark Completed',
};

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function BookingRow({ booking }: { booking: AdminBookingRow }) {
  const [status, setStatus] = useState<Status>(booking.status);
  const [adminNotes, setAdminNotes] = useState(booking.adminNotes ?? '');
  const [noteDraft, setNoteDraft] = useState('');
  const [isUpdating, setIsUpdating] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableActions = STATUS_TRANSITIONS[status];
  const statusMeta = STATUS_LABEL[status];

  const handleTransition = async (nextStatus: Status) => {
    if (isUpdating) return;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not update this booking.');
      setStatus(nextStatus);
      if (noteDraft.trim()) {
        setAdminNotes(noteDraft.trim());
        setNoteDraft('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this booking.');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
        <div>
          <Link href={`/artists/${booking.vendorSlug}`} style={{ textDecoration: 'none' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', margin: '0 0 4px' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
              onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}>
              {booking.vendorName}
            </p>
          </Link>
          <p style={{ fontSize: '12px', color: '#454140', margin: 0 }}>{booking.serviceName}</p>
        </div>
        <span style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: statusMeta.color, border: `1px solid ${statusMeta.color}`, padding: '3px 9px', flexShrink: 0 }}>
          {statusMeta.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '16px' }}>
        <div>
          <p style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2E2C2A', margin: '0 0 3px' }}>Date &amp; time</p>
          <p style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{formatDate(booking.date)} · {formatSlotLabel(booking.startTime)}–{formatSlotLabel(booking.endTime)}</p>
        </div>
        <div>
          <p style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2E2C2A', margin: '0 0 3px' }}>Client</p>
          <p style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{booking.contactName}</p>
          <p style={{ fontSize: '11px', color: '#5A5450', margin: 0 }}>{booking.contactPhone} · {booking.contactEmail}</p>
        </div>
        <div>
          <p style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2E2C2A', margin: '0 0 3px' }}>Total / deposit</p>
          <p style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{formatINR(booking.total)} / {formatINR(booking.depositAmount)}</p>
        </div>
        <div>
          <p style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2E2C2A', margin: '0 0 3px' }}>Reference</p>
          <p style={{ fontSize: '12px', color: '#C8B9A8', margin: 0, fontFamily: FONT_MONO }}>{booking.ref}</p>
        </div>
      </div>

      {booking.customerNotes && (
        <p style={{ fontSize: '12px', color: '#7A6A5A', lineHeight: 1.6, marginBottom: '12px', borderLeft: '2px solid #2A2520', paddingLeft: '12px' }}>
          Client note: {booking.customerNotes}
        </p>
      )}
      {adminNotes && (
        <p style={{ fontSize: '12px', color: '#7A6A5A', lineHeight: 1.6, marginBottom: '12px', borderLeft: '2px solid #2A2520', paddingLeft: '12px' }}>
          Admin note: {adminNotes}
        </p>
      )}

      {availableActions.length > 0 && (
        <div style={{ borderTop: '1px solid #141210', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="Add a note (optional, attached to whichever action you take)"
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            maxLength={500}
            style={{ width: '100%', padding: '8px 10px', fontSize: '11px', background: '#080808', border: '1px solid #1C1C1C', color: '#F0EBE0', outline: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {availableActions.map(action => (
              <button
                key={action}
                onClick={() => handleTransition(action)}
                disabled={isUpdating !== null}
                style={{
                  fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '9px 16px',
                  border: `1px solid ${STATUS_LABEL[action].color}`, color: STATUS_LABEL[action].color,
                  background: 'none', cursor: isUpdating !== null ? 'default' : 'pointer',
                  opacity: isUpdating !== null && isUpdating !== action ? 0.4 : 1,
                }}
              >
                {isUpdating === action ? 'Updating…' : ACTION_LABEL[action]}
              </button>
            ))}
          </div>
          {error && <p style={{ fontSize: '11px', color: 'rgba(220,80,80,0.75)', margin: 0 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export function AdminBookingsClient({ adminEmail, bookings }: { adminEmail: string; bookings: AdminBookingRow[] }) {
  const pendingCount = bookings.filter(b => b.status === 'PENDING').length;

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={adminEmail} />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 40px 96px' }}>
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '8px' }}>
            {bookings.length} Total · {pendingCount} Pending
          </p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 2.6rem)', color: '#F0EBE0', fontWeight: 400 }}>
            Bookings
          </h1>
        </div>

        {bookings.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '72px 32px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', fontStyle: 'italic', color: '#3A3530' }}>No bookings yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bookings.map(b => <BookingRow key={b.id} booking={b} />)}
          </div>
        )}
      </main>
    </div>
  );
}
