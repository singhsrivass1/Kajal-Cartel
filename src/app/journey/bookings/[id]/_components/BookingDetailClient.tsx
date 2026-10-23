'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/site/SiteHeader';
import { StatusBadge } from '@/components/booking/StatusBadge';
import { StarRating, StarRatingInput } from '@/components/reviews/StarRating';
import { apiRequest, SessionExpiredError, signInHref } from '@/lib/client/api';
import { addDaysToIsoDate, businessTodayIso } from '@/lib/db/utils/time';
import {
  COLORS,
  FONT_DISPLAY,
  FONT_MONO,
  cardStyle,
  fieldStyle,
  formatDuration,
  formatINR,
  formatIsoDate,
  formatSlotLabel,
  formatTimestamp,
  labelStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '@/components/site/tokens';
import type { CustomerBookingDetail } from '@/lib/db/controllers/BookingViews';

const DATES_PER_PAGE = 14;

interface SlotResponse {
  slots: string[];
  unavailableReason?: string | null;
  blockedReason?: string;
  leadTimeDays?: number;
}

function ErrorText({ message, expired, callback }: { message: string; expired: boolean; callback: string }) {
  return (
    <p role="alert" style={{ fontSize: '12px', color: COLORS.error, margin: '12px 0 0' }}>
      {message}{' '}
      {expired && <Link href={signInHref(callback)} style={{ color: COLORS.gold }}>Sign in again</Link>}
    </p>
  );
}

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-heading`} style={{ ...cardStyle, padding: '22px 24px' }}>
      <h2 id={`${id ?? title}-heading`} style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 16px', fontWeight: 400 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function slotMessage(data: SlotResponse): string {
  switch (data.unavailableReason) {
    case 'lead-time':
      return `This artist needs at least ${data.leadTimeDays ?? 0} days' notice. Please choose a later date.`;
    case 'beyond-window':
      return 'This date is too far ahead. Please choose an earlier date.';
    case 'blocked':
      return `The artist is not taking bookings on this date${data.blockedReason ? ` — ${data.blockedReason}` : ''}.`;
    case 'closed':
      return 'The artist is closed on this date.';
    case 'not-configured':
      return 'This artist is not taking online bookings right now.';
    default:
      return 'No open times on this date. Please try another day.';
  }
}

function ReschedulePanel({ booking, onDone, onCancel }: { booking: CustomerBookingDetail; onDone: (summary: string) => void; onCancel: () => void }) {
  const firstBookable = useMemo(() => addDaysToIsoDate(businessTodayIso(), Math.max(0, booking.leadTimeDays)), [booking.leadTimeDays]);
  const lastBookable = useMemo(() => addDaysToIsoDate(businessTodayIso(), booking.policy.bookingWindowDays), [booking.policy.bookingWindowDays]);
  const [page, setPage] = useState(0);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotResponse | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; expired: boolean } | null>(null);
  const requestRef = useRef(0);
  const groupId = useId();

  const pageStart = addDaysToIsoDate(firstBookable, page * DATES_PER_PAGE);
  const dates: string[] = [];
  for (let i = 0; i < DATES_PER_PAGE; i++) {
    const iso = addDaysToIsoDate(pageStart, i);
    if (iso > lastBookable) break;
    dates.push(iso);
  }

  const loadSlots = useCallback(async (iso: string) => {
    const requestId = ++requestRef.current;
    setDate(iso);
    setSlot(null);
    setSlots(null);
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<SlotResponse>(`/api/user/bookings/${booking.id}/availability?date=${iso}`);
      if (requestId === requestRef.current) setSlots(data);
    } catch (err) {
      if (requestId === requestRef.current) {
        setError({ message: err instanceof Error ? err.message : 'Could not load availability.', expired: err instanceof SessionExpiredError });
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [booking.id]);

  const submit = async () => {
    if (!date || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/user/bookings/${booking.id}/reschedule`, { method: 'POST', body: { date, slotStart: slot } });
      onDone(`Your booking was moved to ${formatIsoDate(date)} at ${formatSlotLabel(slot)}. It is now awaiting confirmation again.`);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not reschedule this booking.', expired: err instanceof SessionExpiredError });
      if (!(err instanceof SessionExpiredError)) void loadSlots(date);
    } finally {
      setSubmitting(false);
    }
  };

  const pager = (enabled: boolean) => ({ ...secondaryButtonStyle('default', !enabled), padding: '6px 10px' });

  return (
    <div style={{ borderTop: `1px solid ${COLORS.lineSoft}`, marginTop: '18px', paddingTop: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <p id={groupId} style={{ fontSize: '11px', color: COLORS.textMuted, margin: 0 }}>Choose a new date</p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" aria-label="Earlier dates" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={pager(page > 0)}>←</button>
          <button type="button" aria-label="Later dates" disabled={addDaysToIsoDate(pageStart, DATES_PER_PAGE) > lastBookable} onClick={() => setPage((p) => p + 1)} style={pager(addDaysToIsoDate(pageStart, DATES_PER_PAGE) <= lastBookable)}>→</button>
        </div>
      </div>
      <div role="group" aria-labelledby={groupId} style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px' }}>
        {dates.map((iso) => {
          const d = new Date(`${iso}T00:00:00Z`);
          const selected = iso === date;
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={selected}
              aria-label={formatIsoDate(iso)}
              onClick={() => loadSlots(iso)}
              style={{ flexShrink: 0, width: '50px', padding: '8px 0', textAlign: 'center', border: `1px solid ${selected ? COLORS.gold : COLORS.line}`, background: selected ? '#0D0B08' : 'transparent', cursor: 'pointer' }}
            >
              <span style={{ display: 'block', fontSize: '8px', textTransform: 'uppercase', color: COLORS.textDim }}>{d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</span>
              <span style={{ display: 'block', fontSize: '13px', color: selected ? COLORS.gold : COLORS.text }}>{d.getUTCDate()}</span>
              <span style={{ display: 'block', fontSize: '8px', textTransform: 'uppercase', color: COLORS.textFaint }}>{d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" style={{ minHeight: '24px' }}>
        {loading ? (
          <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>Checking open times…</p>
        ) : slots && slots.slots.length === 0 ? (
          <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>{slotMessage(slots)}</p>
        ) : slots ? (
          <div role="group" aria-label="Open start times" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {slots.slots.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
                style={{ padding: '8px 12px', fontSize: '11px', border: `1px solid ${slot === s ? COLORS.gold : COLORS.line}`, background: slot === s ? COLORS.gold : 'transparent', color: slot === s ? COLORS.bg : COLORS.textMuted, cursor: 'pointer' }}
              >
                {formatSlotLabel(s)}
              </button>
            ))}
          </div>
        ) : !date ? (
          <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>Pick a date to see the artist&apos;s open times.</p>
        ) : null}
      </div>

      <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '14px 0' }}>
        Rescheduling returns the booking to “awaiting confirmation”. You have {booking.policy.maxReschedules - booking.rescheduleCount} reschedule{booking.policy.maxReschedules - booking.rescheduleCount === 1 ? '' : 's'} left for this booking.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={submit} disabled={!date || !slot || submitting} style={primaryButtonStyle(!date || !slot || submitting)}>
          {submitting ? 'Moving booking…' : slot && date ? `Move to ${formatIsoDate(date, 'short')}, ${formatSlotLabel(slot)}` : 'Choose a time'}
        </button>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle()}>Keep current time</button>
      </div>
      {error && <ErrorText message={error.message} expired={error.expired} callback={`/journey/bookings/${booking.id}`} />}
    </div>
  );
}

function CancelPanel({ booking, onDone, onCancel }: { booking: CustomerBookingDetail; onDone: (summary: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; expired: boolean } | null>(null);
  const reasonId = useId();

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/user/bookings/${booking.id}/cancel`, { method: 'POST', body: { reason: reason.trim() || undefined } });
      onDone(booking.status === 'PENDING' ? 'Your booking request was withdrawn. The time is now free for others.' : 'Your booking was cancelled. The time is now free for others.');
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not cancel this booking.', expired: err instanceof SessionExpiredError });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ borderTop: `1px solid ${COLORS.lineSoft}`, marginTop: '18px', paddingTop: '18px' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: COLORS.text, margin: '0 0 8px' }}>
        {booking.status === 'PENDING' ? 'Withdraw this booking request?' : 'Cancel this booking?'}
      </p>
      <p style={{ fontSize: '12px', color: COLORS.textDim, lineHeight: 1.6, margin: '0 0 14px' }}>
        {formatIsoDate(booking.date)} at {formatSlotLabel(booking.startTime)} with {booking.vendorName}. This cannot be undone — you would need to send a new request.
      </p>
      <label htmlFor={reasonId} style={labelStyle}>Reason (optional)</label>
      <textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} style={{ ...fieldStyle, resize: 'vertical', marginBottom: '14px' }} />
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={submit} disabled={submitting} style={{ ...secondaryButtonStyle('danger', submitting), background: 'rgba(180,90,74,0.08)' }}>
          {submitting ? 'Cancelling…' : booking.status === 'PENDING' ? 'Yes, withdraw request' : 'Yes, cancel booking'}
        </button>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle()}>Keep my booking</button>
      </div>
      {error && <ErrorText message={error.message} expired={error.expired} callback={`/journey/bookings/${booking.id}`} />}
    </div>
  );
}

function ReviewForm({
  bookingId,
  existing,
  onSaved,
  onCancel,
}: {
  bookingId: string;
  existing?: { id: string; rating: number; title?: string; body: string };
  onSaved: (message: string) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; expired: boolean } | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const bodyHintId = useId();
  const trimmedLength = body.trim().length;
  const valid = rating >= 1 && trimmedLength >= 20 && trimmedLength <= 2000 && title.trim().length <= 100;

  const submit = async () => {
    if (!valid) {
      setError({ message: rating < 1 ? 'Please choose a star rating.' : 'Your review must be between 20 and 2,000 characters.', expired: false });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = { rating, title: title.trim() || undefined, body: body.trim() };
      if (existing) {
        await apiRequest(`/api/user/reviews/${existing.id}`, { method: 'PATCH', body: payload });
        onSaved('Your review was updated.');
      } else {
        await apiRequest(`/api/user/bookings/${bookingId}/review`, { method: 'POST', body: payload });
        onSaved('Thank you — your review is now published on the artist’s profile.');
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Could not save your review.', expired: err instanceof SessionExpiredError });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      <div style={{ marginBottom: '16px' }}>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label htmlFor={titleId} style={labelStyle}>Headline (optional)</label>
        <input id={titleId} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} style={fieldStyle} />
      </div>
      <div style={{ marginBottom: '6px' }}>
        <label htmlFor={bodyId} style={labelStyle}>Your review</label>
        <textarea id={bodyId} aria-describedby={bodyHintId} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} style={{ ...fieldStyle, resize: 'vertical' }} />
      </div>
      <p id={bodyHintId} style={{ fontSize: '11px', color: trimmedLength > 0 && trimmedLength < 20 ? COLORS.error : COLORS.textDim, margin: '0 0 14px' }}>
        {trimmedLength}/2000 characters · at least 20. Your first name and last initial will be shown. Please don&apos;t include phone numbers or other private details.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={submitting} style={primaryButtonStyle(submitting)}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Publish review'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={secondaryButtonStyle()}>Cancel</button>}
      </div>
      {error && <ErrorText message={error.message} expired={error.expired} callback={`/journey/bookings/${bookingId}`} />}
    </form>
  );
}

export function BookingDetailClient({ booking, supportEmail }: { booking: CustomerBookingDetail; supportEmail: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'cancel' | 'edit-review'>('idle');
  const [success, setSuccess] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [deletingReview, setDeletingReview] = useState(false);
  const [confirmDeleteReview, setConfirmDeleteReview] = useState(false);

  const finish = (message: string) => {
    setMode('idle');
    setSuccess(message);
    router.refresh();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteReview = async () => {
    if (!booking.review) return;
    setDeletingReview(true);
    setReviewError(null);
    try {
      await apiRequest(`/api/user/reviews/${booking.review.id}`, { method: 'DELETE' });
      finish('Your review was deleted.');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not delete your review.');
    } finally {
      setDeletingReview(false);
      setConfirmDeleteReview(false);
    }
  };

  const helpLine = supportEmail ? (
    <>Need help? Email <a href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Booking ${booking.ref}`)}`} style={{ color: COLORS.gold }}>{supportEmail}</a> and quote {booking.ref}.</>
  ) : (
    <>For changes that can&apos;t be made online, see <Link href="/help" style={{ color: COLORS.gold }}>Help</Link> and quote {booking.ref}.</>
  );

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '960px', margin: '0 auto', paddingTop: '40px', paddingBottom: '96px' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '24px' }}>
          <Link href="/journey?tab=bookings" className="kc-nav-link" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A8078', textDecoration: 'none' }}>
            ← My bookings
          </Link>
        </nav>

        {success && (
          <div role="status" style={{ border: '1px solid rgba(90,138,90,0.45)', background: 'rgba(90,138,90,0.08)', padding: '14px 18px', marginBottom: '24px' }}>
            <p style={{ fontSize: '13px', color: '#9CC29C', margin: 0 }}>✓ {success}</p>
          </div>
        )}

        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: COLORS.gold, margin: '0 0 8px' }}>
              Booking <span style={{ fontFamily: FONT_MONO }}>{booking.ref}</span>
            </p>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: COLORS.text, fontWeight: 400, margin: '0 0 6px', lineHeight: 1.1 }}>
              {booking.serviceName}
            </h1>
            <p style={{ fontSize: '13px', color: COLORS.textDim, margin: 0 }}>
              with{' '}
              {booking.vendorSlug ? (
                <Link href={`/artists/${booking.vendorSlug}`} style={{ color: COLORS.textMuted }}>{booking.vendorName}</Link>
              ) : (
                booking.vendorName
              )}
            </p>
          </div>
          <StatusBadge status={booking.status} phase={booking.phase} />
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Section title="Appointment" id="appointment">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '16px', margin: 0 }}>
              {[
                ['Date', formatIsoDate(booking.date)],
                ['Time', `${formatSlotLabel(booking.startTime)} – ${formatSlotLabel(booking.endTime)}`],
                ['Duration', `${formatDuration(booking.durationMinutes)} (incl. preparation)`],
                ['Requested', formatTimestamp(booking.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textFaint, marginBottom: '4px' }}>{label}</dt>
                  <dd style={{ fontSize: '13px', color: COLORS.textMuted, margin: 0 }}>{value}</dd>
                </div>
              ))}
            </dl>
            {booking.rescheduleCount > 0 && (
              <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '14px 0 0' }}>Rescheduled {booking.rescheduleCount} time{booking.rescheduleCount === 1 ? '' : 's'}.</p>
            )}
            {booking.status === 'CANCELLED' && booking.cancelledAt && (
              <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '14px 0 0' }}>
                Cancelled by {booking.cancelledBy === 'customer' ? 'you' : 'Kajal Cartel'} on {formatTimestamp(booking.cancelledAt)}
                {booking.cancellationReason ? ` — “${booking.cancellationReason}”` : ''}.
              </p>
            )}
            {booking.status === 'DECLINED' && (
              <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '14px 0 0' }}>
                This request could not be accommodated. You&apos;re welcome to request another date.
              </p>
            )}
          </Section>

          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
            <Section title="Manage booking" id="manage">
              {booking.phase === 'upcoming' ? (
                <>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => { setSuccess(null); setMode(mode === 'reschedule' ? 'idle' : 'reschedule'); }}
                      disabled={!booking.canReschedule.allowed}
                      aria-expanded={mode === 'reschedule'}
                      style={secondaryButtonStyle('default', !booking.canReschedule.allowed)}
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSuccess(null); setMode(mode === 'cancel' ? 'idle' : 'cancel'); }}
                      disabled={!booking.canCancel.allowed}
                      aria-expanded={mode === 'cancel'}
                      style={secondaryButtonStyle('danger', !booking.canCancel.allowed)}
                    >
                      {booking.status === 'PENDING' ? 'Withdraw request' : 'Cancel booking'}
                    </button>
                  </div>
                  <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {!booking.canReschedule.allowed && booking.canReschedule.reason && (
                      <li style={{ fontSize: '12px', color: COLORS.textDim }}>Rescheduling: {booking.canReschedule.reason}</li>
                    )}
                    {!booking.canCancel.allowed && booking.canCancel.reason && (
                      <li style={{ fontSize: '12px', color: COLORS.textDim }}>Cancellation: {booking.canCancel.reason}</li>
                    )}
                  </ul>
                  {mode === 'reschedule' && <ReschedulePanel booking={booking} onDone={finish} onCancel={() => setMode('idle')} />}
                  {mode === 'cancel' && <CancelPanel booking={booking} onDone={finish} onCancel={() => setMode('idle')} />}
                </>
              ) : (
                <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>
                  This appointment time has passed. It will be marked as completed once Kajal Cartel has confirmed it took place.
                </p>
              )}
              <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '16px 0 0', lineHeight: 1.6 }}>
                {helpLine} <Link href="/policies" style={{ color: COLORS.gold }}>Booking policy</Link>.
              </p>
            </Section>
          )}

          <Section title="Price estimate" id="price">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {booking.lineItems.map((li, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: COLORS.textMuted }}>
                  <span>{li.quantity > 1 ? `${li.quantity}× ` : ''}{li.name}{li.discountLabel ? <span style={{ color: COLORS.gold, fontSize: '11px' }}> · {li.discountLabel}</span> : null}</span>
                  <span style={{ color: COLORS.text }}>{formatINR(li.subtotalINR)}</span>
                </li>
              ))}
            </ul>
            <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: '14px', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: COLORS.text }}>Total estimate</span>
                <span style={{ color: COLORS.text }}>{formatINR(booking.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: COLORS.textDim }}>
                <span>Deposit due on confirmation</span>
                <span>{formatINR(booking.depositAmount)}</span>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: COLORS.textFaint, margin: '12px 0 0' }}>No payment is taken on this website. The artist confirms the final price before your booking is locked in.</p>
          </Section>

          {(booking.status === 'COMPLETED' || booking.review) && (
            <Section title="Your review" id="review">
              {booking.review && mode !== 'edit-review' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <StarRating value={booking.review.rating} size={14} />
                    {booking.review.status === 'hidden' && (
                      <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.danger }}>Hidden by moderation</span>
                    )}
                  </div>
                  {booking.review.title && <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: COLORS.text, margin: '0 0 6px' }}>{booking.review.title}</p>}
                  <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.7, margin: '0 0 12px', whiteSpace: 'pre-line' }}>{booking.review.body}</p>
                  <p style={{ fontSize: '11px', color: COLORS.textFaint, margin: '0 0 14px' }}>
                    Posted {formatTimestamp(booking.review.createdAt)}{booking.review.editedAt ? ` · edited ${formatTimestamp(booking.review.editedAt)}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setMode('edit-review')} style={secondaryButtonStyle()}>Edit review</button>
                    {confirmDeleteReview ? (
                      <>
                        <button type="button" onClick={deleteReview} disabled={deletingReview} style={secondaryButtonStyle('danger', deletingReview)}>
                          {deletingReview ? 'Deleting…' : 'Yes, delete it'}
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteReview(false)} style={secondaryButtonStyle()}>Keep it</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteReview(true)} style={secondaryButtonStyle('danger')}>Delete review</button>
                    )}
                  </div>
                  {reviewError && <p role="alert" style={{ fontSize: '12px', color: COLORS.error, margin: '10px 0 0' }}>{reviewError}</p>}
                </div>
              ) : booking.review && mode === 'edit-review' ? (
                <ReviewForm bookingId={booking.id} existing={booking.review} onSaved={finish} onCancel={() => setMode('idle')} />
              ) : booking.canReview.allowed ? (
                <>
                  <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '0 0 16px', lineHeight: 1.6 }}>
                    How was your appointment with {booking.vendorName}? Your review is labelled as a verified booking.
                  </p>
                  <ReviewForm bookingId={booking.id} onSaved={finish} />
                </>
              ) : (
                <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>{booking.canReview.reason}</p>
              )}
            </Section>
          )}

          <Section title="Contact details on this booking" id="contact">
            <dl className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '14px', margin: 0 }}>
              {[
                ['Name', booking.contactInfo.name],
                ['Phone', booking.contactInfo.phone],
                ['Email', booking.contactInfo.email],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textFaint, marginBottom: '4px' }}>{label}</dt>
                  <dd style={{ fontSize: '13px', color: COLORS.textMuted, margin: 0, wordBreak: 'break-word' }}>{value}</dd>
                </div>
              ))}
            </dl>
            {booking.customerNotes && (
              <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '14px 0 0', borderLeft: '2px solid #2A2520', paddingLeft: '12px' }}>
                Your note: {booking.customerNotes}
              </p>
            )}
          </Section>

          <Section title="History" id="history">
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {booking.timeline.map((entry, i) => (
                <li key={`${entry.at}-${i}`} style={{ display: 'flex', gap: '14px', fontSize: '12px' }}>
                  <span style={{ color: COLORS.textFaint, flexShrink: 0, minWidth: '150px' }}>{formatTimestamp(entry.at)}</span>
                  <span style={{ color: COLORS.textMuted }}>{entry.label}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </main>
    </div>
  );
}
