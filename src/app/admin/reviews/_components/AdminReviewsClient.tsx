'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminHeader } from '../../_components/AdminHeader';
import { StarRating } from '@/components/reviews/StarRating';
import type { AdminReviewRow } from '@/lib/db/controllers/ReviewManager';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

function ReviewItem({ review }: { review: AdminReviewRow }) {
  const [status, setStatus] = useState(review.status);
  const [note, setNote] = useState(review.moderationNote ?? '');
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (method: 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw new Error('Your admin session has expired. Please sign in again.');
      if (!res.ok) throw new Error(data.error ?? 'Could not update this review.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this review.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (removed) {
    return <li style={{ border: '1px solid #1A1A1A', padding: '14px 18px', fontSize: '12px', color: '#7A706A', listStyle: 'none' }}>Review deleted.</li>;
  }

  const next = status === 'published' ? 'hidden' : 'published';

  return (
    <li style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '18px 20px', listStyle: 'none', opacity: status === 'hidden' ? 0.75 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StarRating value={review.rating} size={13} />
          <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: status === 'published' ? '#5A8A5A' : '#B45A4A' }}>{status}</span>
        </div>
        <span style={{ fontSize: '11px', color: '#7A706A' }}>
          {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {review.editedAt ? ' · edited' : ''}
        </span>
      </div>
      {review.title && <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: '#F0EBE0', margin: '0 0 6px' }}>{review.title}</p>}
      <p style={{ fontSize: '13px', color: '#C8B9A8', lineHeight: 1.7, margin: '0 0 10px', whiteSpace: 'pre-line' }}>{review.body}</p>
      <p style={{ fontSize: '11px', color: '#8A8078', margin: '0 0 12px' }}>
        {review.authorDisplayName} · {review.serviceName} ·{' '}
        {review.vendorSlug ? <Link href={`/artists/${review.vendorSlug}#reviews`} style={{ color: '#C9A96E' }}>{review.vendorName}</Link> : review.vendorName} ·{' '}
        <Link href={`/admin/bookings/${review.bookingId}`} style={{ color: '#C9A96E' }}>{review.bookingRef}</Link>
      </p>
      <label htmlFor={`mod-${review.id}`} style={{ display: 'block', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '5px' }}>
        Moderation note (internal, optional)
      </label>
      <input id={`mod-${review.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={{ width: '100%', padding: '8px 10px', fontSize: '12px', background: '#080808', border: '1px solid #1C1C1C', color: '#F0EBE0', marginBottom: '10px', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={busy}
          onClick={async () => { if (await call('PATCH', { status: next, note })) setStatus(next); }}
          style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '9px 14px', border: `1px solid ${next === 'hidden' ? '#B45A4A' : '#5A8A5A'}`, color: next === 'hidden' ? '#B45A4A' : '#5A8A5A', background: 'none', cursor: busy ? 'default' : 'pointer' }}
        >
          {busy ? 'Working…' : next === 'hidden' ? 'Hide from public' : 'Publish again'}
        </button>
        {confirmDelete ? (
          <>
            <button type="button" disabled={busy} onClick={async () => { if (await call('DELETE')) setRemoved(true); }} style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '9px 14px', border: '1px solid #B45A4A', color: '#B45A4A', background: 'rgba(180,90,74,0.1)', cursor: 'pointer' }}>
              Confirm permanent delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '9px 14px', border: '1px solid #1C1C1C', color: '#8A8078', background: 'none', cursor: 'pointer' }}>Keep</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '9px 14px', border: '1px solid #3A2420', color: '#9A5A50', background: 'none', cursor: 'pointer' }}>Delete</button>
        )}
      </div>
      {error && <p role="alert" style={{ fontSize: '11px', color: 'rgba(220,80,80,0.85)', margin: '10px 0 0' }}>{error}</p>}
    </li>
  );
}

export function AdminReviewsClient({ adminEmail, reviews, status }: { adminEmail: string; reviews: AdminReviewRow[]; status: string }) {
  const tabs = [
    { value: '', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'hidden', label: 'Hidden' },
  ];
  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={adminEmail} />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 2.6rem)', color: '#F0EBE0', fontWeight: 400, margin: '0 0 10px' }}>Reviews</h1>
        <p style={{ fontSize: '13px', color: '#7A706A', margin: '0 0 24px', lineHeight: 1.6 }}>
          Reviews can only be written by the client of a completed booking and are published immediately. Hide reviews that break the rules (for example abuse or personal contact details); hidden reviews are removed from ratings and public pages. Deleting is permanent and prevents the client from posting again for that booking.
        </p>
        <nav aria-label="Review status" style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #141210', marginBottom: '24px' }}>
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={t.value ? `/admin/reviews?status=${t.value}` : '/admin/reviews'}
              aria-current={status === t.value ? 'page' : undefined}
              style={{ fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', paddingBottom: '12px', borderBottom: `2px solid ${status === t.value ? '#C9A96E' : 'transparent'}`, color: status === t.value ? '#F0EBE0' : '#8A8078', textDecoration: 'none' }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {reviews.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '56px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', fontStyle: 'italic', color: '#8A8078', margin: 0 }}>No reviews here yet.</p>
          </div>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: 0 }}>
            {reviews.map((r) => <ReviewItem key={r.id} review={r} />)}
          </ul>
        )}
      </main>
    </div>
  );
}
