'use client';

import { useState, useEffect, useCallback, useId, useMemo, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ArtistProfile, ClientService, EstimateResult } from '@/types/artist';
import type { BookingPolicyView } from '@/lib/booking/rules';
import { DEPOSIT_PERCENT } from '@/lib/booking/rules';
import { addDaysToIsoDate, businessTodayIso } from '@/lib/db/utils/time';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATES_PER_PAGE = 21;

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type UnavailableReason = 'not-configured' | 'lead-time' | 'beyond-window' | 'closed' | 'blocked' | 'fully-booked';

interface DailyAvailability {
  vendorSlug: string;
  serviceId: string;
  date: string;
  configured: boolean;
  isOpen: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  slots: string[];
  leadTimeDays?: number;
  earliestBookableDate?: string;
  latestBookableDate?: string;
  unavailableReason?: UnavailableReason | null;
}

interface UpcomingDate {
  iso: string;
  weekday: string;
  day: string;
  month: string;
  label: string;
}

function datesFrom(startIso: string, count: number, lastIso: string): UpcomingDate[] {
  const dates: UpcomingDate[] = [];
  for (let i = 0; i < count; i++) {
    const iso = addDaysToIsoDate(startIso, i);
    if (iso > lastIso) break;
    const d = new Date(`${iso}T00:00:00Z`);
    dates.push({
      iso,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      day: String(d.getUTCDate()),
      month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      label: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    });
  }
  return dates;
}

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function unavailableCopy(availability: DailyAvailability, serviceName: string): string {
  switch (availability.unavailableReason) {
    case 'not-configured':
      return "This artist hasn't set up online scheduling yet — booking isn't available right now.";
    case 'lead-time':
      return `This artist needs at least ${availability.leadTimeDays ?? 0} days' notice. Please choose a later date.`;
    case 'beyond-window':
      return 'This date is too far ahead to request yet. Please choose an earlier date.';
    case 'blocked':
      return `Not taking bookings on this date${availability.blockedReason ? ` — ${availability.blockedReason}` : ''}.`;
    case 'closed':
      return 'Closed on this date.';
    case 'fully-booked':
      return `No open times long enough for ${serviceName} on this date.`;
    default:
      if (!availability.configured) return "This artist hasn't set up online scheduling yet — booking isn't available right now.";
      if (availability.isBlocked) return 'Not taking bookings on this date.';
      if (!availability.isOpen) return 'Closed on this date.';
      return `No open times long enough for ${serviceName} on this date.`;
  }
}

function DateSlotPicker({
  service,
  dates,
  canPageBack,
  canPageForward,
  onPage,
  selectedDate,
  onSelectDate,
  availability,
  isLoading,
  error,
  selectedSlot,
  onSelectSlot,
  leadTimeDays,
}: {
  service: ClientService;
  dates: UpcomingDate[];
  canPageBack: boolean;
  canPageForward: boolean;
  onPage: (direction: -1 | 1) => void;
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
  availability: DailyAvailability | null;
  isLoading: boolean;
  error: string | null;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  leadTimeDays: number;
}) {
  const pagerStyle = (enabled: boolean): CSSProperties => ({
    background: 'none',
    border: '1px solid #1C1C1C',
    color: enabled ? '#C9A96E' : '#3A3530',
    fontSize: '10px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    padding: '6px 10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
  });

  return (
    <div style={{ padding: '20px', borderTop: '1px solid #1C1C1C' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
        <p id="kc-date-heading" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A706A', margin: 0 }}>
          Choose a date &amp; time
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={() => onPage(-1)} disabled={!canPageBack} aria-label="Earlier dates" style={pagerStyle(canPageBack)}>←</button>
          <button type="button" onClick={() => onPage(1)} disabled={!canPageForward} aria-label="Later dates" style={pagerStyle(canPageForward)}>→</button>
        </div>
      </div>
      {leadTimeDays > 0 && (
        <p style={{ fontSize: '11px', color: '#7A706A', margin: '0 0 10px' }}>
          This artist needs {leadTimeDays} day{leadTimeDays === 1 ? '' : 's'} notice, so the earliest dates are not shown.
        </p>
      )}
      <div role="group" aria-labelledby="kc-date-heading" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
        {dates.map((d) => {
          const isSelected = d.iso === selectedDate;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onSelectDate(d.iso)}
              aria-pressed={isSelected}
              aria-label={d.label}
              style={{
                flexShrink: 0,
                width: '50px',
                padding: '8px 0',
                textAlign: 'center',
                border: `1px solid ${isSelected ? '#C9A96E' : '#1C1C1C'}`,
                background: isSelected ? '#0D0B08' : 'transparent',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <span style={{ display: 'block', fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '3px' }}>{d.weekday}</span>
              <span style={{ display: 'block', fontSize: '13px', color: isSelected ? '#C9A96E' : '#F0EBE0' }}>{d.day}</span>
              <span style={{ display: 'block', fontSize: '8px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5450', marginTop: '2px' }}>{d.month}</span>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div aria-live="polite">
          {isLoading ? (
            <p style={{ fontSize: '11px', color: '#7A706A' }}>Checking availability…</p>
          ) : error ? (
            <p role="alert" style={{ fontSize: '11px', color: 'rgba(220,80,80,0.85)' }}>{error}</p>
          ) : !availability ? null : availability.slots.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#8A8078', lineHeight: 1.6 }}>{unavailableCopy(availability, service.name)}</p>
          ) : (
            <div role="group" aria-label="Available start times" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availability.slots.map((slot) => {
                const isSelected = slot === selectedSlot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onSelectSlot(slot)}
                    aria-pressed={isSelected}
                    style={{
                      padding: '8px 12px',
                      fontSize: '11px',
                      border: `1px solid ${isSelected ? '#C9A96E' : '#1C1C1C'}`,
                      background: isSelected ? '#C9A96E' : 'transparent',
                      color: isSelected ? '#080808' : '#C8B9A8',
                      cursor: 'pointer',
                      transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                    }}
                  >
                    {formatSlotLabel(slot)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnchorCard({ service, isSelected, onSelect }: { service: ClientService; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: `1px solid ${isSelected ? '#C9A96E' : '#1C1C1C'}`, padding: '16px', background: isSelected ? '#0D0B08' : 'transparent', transition: 'border-color 0.2s, background 0.2s', color: 'inherit', font: 'inherit' }}
    >
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span aria-hidden="true" style={{ width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0, marginTop: '4px', border: `1px solid ${isSelected ? '#C9A96E' : '#3A3530'}`, background: isSelected ? '#C9A96E' : 'transparent', transition: 'background 0.2s, border-color 0.2s' }} />
        <span style={{ flex: 1, display: 'block' }}>
          <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
            <span>
              <span style={{ display: 'block', fontFamily: FONT_DISPLAY, fontSize: '1rem', color: '#F0EBE0', margin: '0 0 2px' }}>{service.name}</span>
              {service.flags.isSignatureService && <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C9A96E' }}>Signature</span>}
            </span>
            <span style={{ fontSize: '13px', color: '#F0EBE0', flexShrink: 0 }}>{formatINR(service.pricing.unitPriceINR)}</span>
          </span>
          {service.description && <span style={{ display: '-webkit-box', fontSize: '12px', color: '#7A706A', lineHeight: 1.6, marginBottom: '8px', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{service.description}</span>}
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#7A706A' }}>{formatDuration(service.duration.baseDurationMinutes)}</span>
            {service.checkoutMeta.requiresConsultation && (
              <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid #2A1A08', color: '#8B6A2A', padding: '1px 7px' }}>Consultation required</span>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

function AddOnCard({ service, quantity, onQuantityChange }: { service: ClientService; quantity: number; onQuantityChange: (delta: number) => void }) {
  const activeTier = [...service.pricing.groupDiscountTiers].filter(t => quantity >= t.minQuantity).sort((a, b) => b.discountPercent - a.discountPercent)[0];
  const effectiveUnit = activeTier && service.checkoutMeta.estimateContribution === 'tiered'
    ? Math.round(service.pricing.unitPriceINR * (1 - activeTier.discountPercent / 100))
    : service.pricing.unitPriceINR;
  const subtotal = effectiveUnit * quantity;
  const nextTier = service.pricing.groupDiscountTiers.filter(t => quantity < t.minQuantity).sort((a, b) => a.minQuantity - b.minQuantity)[0];
  const unitLabel = service.partyConfig.quantityLabel.toLowerCase().replace(/s$/, '');

  return (
    <div style={{ border: '1px solid #1A1A1A', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', color: '#F0EBE0', margin: '0 0 3px' }}>{service.name}</p>
          <p style={{ fontSize: '11px', color: '#7A706A', margin: 0 }}>{formatINR(service.pricing.unitPriceINR)} per {unitLabel}</p>
          {service.pricing.groupDiscountTiers.length > 0 && (
            <p style={{ fontSize: '10px', color: '#6A625C', marginTop: '2px' }}>
              {service.pricing.groupDiscountTiers.map(t => `${t.discountPercent}% off ${t.minQuantity}+`).join(' · ')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button type="button" onClick={() => onQuantityChange(-1)} disabled={quantity <= service.partyConfig.minQuantity} aria-label={`Fewer ${service.name}`}
            style={{ width: '28px', height: '28px', border: '1px solid #2A2520', background: 'none', color: '#C9A96E', cursor: quantity <= service.partyConfig.minQuantity ? 'not-allowed' : 'pointer', opacity: quantity <= service.partyConfig.minQuantity ? 0.2 : 1, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <span aria-live="polite" aria-label={`${quantity} ${unitLabel}${quantity === 1 ? '' : 's'}`} style={{ fontSize: '13px', color: '#F0EBE0', width: '20px', textAlign: 'center' }}>{quantity}</span>
          <button type="button" onClick={() => onQuantityChange(1)} disabled={quantity >= service.partyConfig.maxQuantity} aria-label={`More ${service.name}`}
            style={{ width: '28px', height: '28px', border: '1px solid #2A2520', background: 'none', color: '#C9A96E', cursor: quantity >= service.partyConfig.maxQuantity ? 'not-allowed' : 'pointer', opacity: quantity >= service.partyConfig.maxQuantity ? 0.2 : 1, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #141210' }}>
        <div>
          {activeTier ? (
            <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
              style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(201,169,110,0.22)', color: '#C9A96E', padding: '2px 8px' }}>
              {activeTier.tierLabel} · {activeTier.discountPercent}% off
            </motion.span>
          ) : nextTier ? (
            <span style={{ fontSize: '10px', color: '#6A625C' }}>Add {nextTier.minQuantity - quantity} more for {nextTier.discountPercent}% off</span>
          ) : <span />}
        </div>
        <p style={{ fontSize: '13px', color: '#F0EBE0', margin: 0 }}>{formatINR(subtotal)}</p>
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '12px',
  background: '#0C0C0C',
  border: '1px solid #1C1C1C',
  color: '#F0EBE0',
  outline: 'none',
  fontFamily: 'inherit',
};

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '9px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#7A706A',
  marginBottom: '5px',
};

function ContactDetailsForm({
  contactName,
  onContactNameChange,
  contactPhone,
  onContactPhoneChange,
  contactEmail,
  onContactEmailChange,
  customerNotes,
  onCustomerNotesChange,
}: {
  contactName: string;
  onContactNameChange: (v: string) => void;
  contactPhone: string;
  onContactPhoneChange: (v: string) => void;
  contactEmail: string;
  onContactEmailChange: (v: string) => void;
  customerNotes: string;
  onCustomerNotesChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <fieldset style={{ marginBottom: '20px', border: 'none', padding: 0 }}>
      <legend style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '12px' }}>Your Details</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label htmlFor={`${id}-name`} style={fieldLabelStyle}>Full name</label>
          <input id={`${id}-name`} type="text" autoComplete="name" maxLength={100} value={contactName} onChange={(e) => onContactNameChange(e.target.value)} style={fieldStyle} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '10px' }}>
          <div>
            <label htmlFor={`${id}-phone`} style={fieldLabelStyle}>Phone</label>
            <input id={`${id}-phone`} type="tel" autoComplete="tel" maxLength={20} value={contactPhone} onChange={(e) => onContactPhoneChange(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label htmlFor={`${id}-email`} style={fieldLabelStyle}>Email</label>
            <input id={`${id}-email`} type="email" autoComplete="email" value={contactEmail} onChange={(e) => onContactEmailChange(e.target.value)} style={fieldStyle} />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-notes`} style={fieldLabelStyle}>Anything the artist should know? (optional)</label>
          <textarea
            id={`${id}-notes`}
            maxLength={500}
            value={customerNotes}
            onChange={(e) => onCustomerNotesChange(e.target.value)}
            rows={2}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </div>
      </div>
    </fieldset>
  );
}

function EstimateBreakdown({
  estimate,
  onRequestBook,
  isBooking,
  contactName,
  onContactNameChange,
  contactPhone,
  onContactPhoneChange,
  contactEmail,
  onContactEmailChange,
  customerNotes,
  onCustomerNotesChange,
  requiresSignIn,
  canSubmit,
  submitHint,
  submitError,
  sessionExpired,
  signInPath,
  policy,
  isVerified,
}: {
  estimate: EstimateResult;
  onRequestBook: () => void;
  isBooking?: boolean;
  contactName: string;
  onContactNameChange: (v: string) => void;
  contactPhone: string;
  onContactPhoneChange: (v: string) => void;
  contactEmail: string;
  onContactEmailChange: (v: string) => void;
  customerNotes: string;
  onCustomerNotesChange: (v: string) => void;
  requiresSignIn: boolean;
  canSubmit: boolean;
  submitHint: string | null;
  submitError: string | null;
  sessionExpired: boolean;
  signInPath: string;
  policy: BookingPolicyView;
  isVerified: boolean;
}) {
  const disabled = Boolean(isBooking) || (!requiresSignIn && !canSubmit);
  const assurances = [
    ...(isVerified ? ['Artist verified by Kajal Cartel'] : []),
    'Your appointment is confirmed only after Kajal Cartel confirms your request',
    `Cancel online up to ${policy.cancellationCutoffHours} hours before a confirmed appointment`,
    'No payment is taken on this website',
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '18px' }}>Estimate</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {estimate.lineItems.map((item, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: '14px', color: '#C8B9A8' }}>{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}</span>
              <span style={{ fontSize: '13px', color: '#F0EBE0', flexShrink: 0 }}>{formatINR(item.subtotalINR)}</span>
            </div>
            {item.discountLabel && <p style={{ fontSize: '10px', color: '#C9A96E', margin: '2px 0 0' }}>↳ {item.discountLabel} applied</p>}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0' }}>Total estimate</span>
          <span style={{ fontSize: '1.1rem', color: '#F0EBE0' }}>{formatINR(estimate.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A706A' }}>To confirm ({DEPOSIT_PERCENT}% deposit)</span>
          <span style={{ fontSize: '13px', color: '#9A8E86' }}>{formatINR(estimate.depositAmount)}</span>
        </div>
      </div>

      {!requiresSignIn && (
        <ContactDetailsForm
          contactName={contactName}
          onContactNameChange={onContactNameChange}
          contactPhone={contactPhone}
          onContactPhoneChange={onContactPhoneChange}
          contactEmail={contactEmail}
          onContactEmailChange={onContactEmailChange}
          customerNotes={customerNotes}
          onCustomerNotesChange={onCustomerNotesChange}
        />
      )}

      <div style={{ background: '#0C0C0C', border: '1px solid #161412', padding: '12px 14px', marginBottom: '16px' }}>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', listStyle: 'none', margin: 0, padding: 0 }}>
          {assurances.map((text) => (
            <li key={text} style={{ fontSize: '11px', color: '#8A8078', margin: 0 }}>
              <span aria-hidden="true" style={{ color: '#5A8A5A', marginRight: '6px' }}>✓</span>{text}
            </li>
          ))}
        </ul>
        <Link href="/policies" style={{ display: 'inline-block', marginTop: '8px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C9A96E' }}>
          Read the booking &amp; cancellation policy
        </Link>
      </div>

      <p style={{ fontSize: '10px', color: '#6A625C', lineHeight: 1.6, marginBottom: '16px' }}>
        This is an indicative estimate. The final price will be confirmed by the artist before your booking is locked in.
      </p>

      <button
        type="button"
        onClick={onRequestBook}
        disabled={disabled}
        style={{ width: '100%', padding: '15px 0', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, background: disabled && !requiresSignIn ? '#3A3530' : isBooking ? '#8B6A1A' : '#C9A96E', color: '#080808', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: disabled && !requiresSignIn ? 0.5 : isBooking ? 0.75 : 1 }}
        onMouseEnter={e => !disabled && (e.currentTarget.style.background = '#B8943F')}
        onMouseLeave={e => !disabled && (e.currentTarget.style.background = isBooking ? '#8B6A1A' : '#C9A96E')}>
        {isBooking ? 'Sending request…' : requiresSignIn ? 'Sign In to Book' : 'Request to Book'}
      </button>

      {!requiresSignIn && submitHint && !isBooking && (
        <p style={{ textAlign: 'center', fontSize: '10px', color: '#7A706A', marginTop: '10px' }}>{submitHint}</p>
      )}

      <AnimatePresence>
        {submitError && (
          <motion.p key="submit-err" role="alert" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(220,80,80,0.85)', marginTop: '10px' }}>
            {submitError}{' '}
            {sessionExpired && <Link href={signInPath} style={{ color: '#C9A96E' }}>Sign in again</Link>}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BookingConfirmation({
  artist,
  estimate,
  anchorName,
  bookingRef,
  bookingId,
  date,
  slot,
  onClose,
}: {
  artist: ArtistProfile;
  estimate: EstimateResult;
  anchorName: string;
  bookingRef: string;
  bookingId: string;
  date: string;
  slot: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      key="confirmation"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div role="status" style={{ borderTop: '1px solid #1C1C1C', padding: '24px 20px', background: '#0A0D09' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
            style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2A4A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}
          >
            <span aria-hidden="true" style={{ color: '#5A8A5A', fontSize: '14px' }}>✓</span>
          </motion.div>
          <div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', marginBottom: '4px', fontWeight: 400 }}>
              Booking request sent
            </p>
            <p style={{ fontSize: '11px', color: '#7A706A' }}>
              Reference <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#C9A96E' }}>{bookingRef}</span>
            </p>
          </div>
        </div>

        <dl style={{ background: '#0C0C0C', border: '1px solid #161412', padding: '14px 16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['Artist', artist.name],
            ['Service', anchorName],
            ['Requested time', `${new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · ${formatSlotLabel(slot)}`],
            ['Deposit due on confirmation', formatINR(estimate.depositAmount)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <dt style={{ fontSize: '11px', color: '#7A706A' }}>{label}</dt>
              <dd style={{ fontSize: '12px', color: '#C8B9A8', margin: 0, textAlign: 'right' }}>{value}</dd>
            </div>
          ))}
        </dl>

        <p style={{ fontSize: '12px', color: '#8A8078', lineHeight: 1.7, marginBottom: '18px' }}>
          Your request is now <span style={{ color: '#C9A96E' }}>pending</span>. It is held for you while Kajal Cartel confirms it with {artist.name}. You can follow its status — or reschedule or cancel it — from your bookings.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href={`/journey/bookings/${bookingId}`}
            style={{ flex: 1, display: 'block', padding: '11px 0', textAlign: 'center', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', background: '#C9A96E', color: '#080808', textDecoration: 'none', fontWeight: 600 }}>
            View Booking
          </Link>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: '11px 0', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', background: 'none', border: '1px solid #1C1C1C', color: '#8A8078', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8A8078')}>
            Book Another
          </button>
        </div>
      </div>
    </motion.div>
  );
}

interface BookingBuilderProps {
  artist: ArtistProfile;
  services: ClientService[];
  policy: BookingPolicyView;
  initialAnchorId?: string;
}

export function BookingBuilder({ artist, services, policy, initialAnchorId }: BookingBuilderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const signInPath = `/auth?callbackUrl=${encodeURIComponent(`/artists/${artist.slug}`)}`;

  const anchorServices = useMemo(
    () => services.filter(s => s.serviceRole === 'anchor' && s.flags.isActive).sort((a, b) => a.checkoutMeta.displayPriority - b.checkoutMeta.displayPriority),
    [services]
  );

  const [selectedAnchor, setSelectedAnchor] = useState<ClientService | null>(
    () => anchorServices.find(s => s._id === initialAnchorId) ?? null
  );
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingRef, setBookingRef] = useState<string>('');
  const [bookingId, setBookingId] = useState<string>('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSubmitError, setBookingSubmitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DailyAvailability | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [datePage, setDatePage] = useState(0);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const idempotencyRef = useRef<{ key: string; signature: string } | null>(null);
  const availabilityRequestRef = useRef(0);

  useEffect(() => {
    if (!session?.user) return;
    setContactName(prev => prev || session.user?.name || '');
    setContactEmail(prev => prev || session.user?.email || '');
    let cancelled = false;
    fetch('/api/user/profile', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { profile?: { phone?: string } } | null) => {
        if (!cancelled && data?.profile?.phone) setContactPhone(prev => prev || data.profile!.phone!);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const leadTimeDays = Math.max(0, artist.businessMeta.bookingLeadTimeDays || 0);
  const firstBookable = useMemo(() => addDaysToIsoDate(businessTodayIso(), leadTimeDays), [leadTimeDays]);
  const lastBookable = useMemo(() => addDaysToIsoDate(businessTodayIso(), policy.bookingWindowDays), [policy.bookingWindowDays]);
  const pageStart = addDaysToIsoDate(firstBookable, datePage * DATES_PER_PAGE);
  const upcomingDates = useMemo(() => datesFrom(pageStart, DATES_PER_PAGE, lastBookable), [pageStart, lastBookable]);
  const canPageForward = addDaysToIsoDate(pageStart, DATES_PER_PAGE) <= lastBookable;

  const addOnServices = services.filter(s => {
    if (s.serviceRole !== 'add-on' || !s.flags.isActive || !selectedAnchor) return false;
    if (!s.compatibleAnchorCategories.length) return true;
    return s.compatibleAnchorCategories.includes(selectedAnchor.category);
  }).sort((a, b) => a.checkoutMeta.displayPriority - b.checkoutMeta.displayPriority);

  useEffect(() => {
    if (!selectedAnchor) return;
    setAddOnQuantities(prev => {
      const updated = { ...prev };
      addOnServices.forEach(s => { if (updated[s._id] === undefined) updated[s._id] = s.partyConfig.defaultQuantity; });
      return updated;
    });
  }, [selectedAnchor?._id]);

  const handleAnchorSelect = useCallback((service: ClientService) => {
    setSelectedAnchor(service);
    setEstimate(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setAvailability(null);
    setAvailabilityError(null);
    setBookingSubmitError(null);
  }, []);

  const handleQuantityChange = useCallback((serviceId: string, delta: number, service: ClientService) => {
    setAddOnQuantities(prev => ({ ...prev, [serviceId]: Math.min(service.partyConfig.maxQuantity, Math.max(service.partyConfig.minQuantity, (prev[serviceId] ?? service.partyConfig.defaultQuantity) + delta)) }));
    setEstimate(null);
  }, []);

  const handleSelectDate = useCallback(async (iso: string) => {
    if (!selectedAnchor) return;
    const requestId = ++availabilityRequestRef.current;
    setSelectedDate(iso);
    setSelectedSlot(null);
    setAvailability(null);
    setBookingSubmitError(null);
    setIsLoadingAvailability(true);
    setAvailabilityError(null);
    try {
      const res = await fetch(`/api/vendors/${artist.slug}/availability?date=${iso}&serviceId=${selectedAnchor._id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not check availability.');
      if (requestId === availabilityRequestRef.current) setAvailability(data as DailyAvailability);
    } catch (err) {
      if (requestId === availabilityRequestRef.current) setAvailabilityError(err instanceof Error ? err.message : 'Could not check availability.');
    } finally {
      if (requestId === availabilityRequestRef.current) setIsLoadingAvailability(false);
    }
  }, [artist.slug, selectedAnchor]);

  const handleSelectSlot = useCallback((slot: string) => {
    setSelectedSlot(slot);
    setBookingSubmitError(null);
  }, []);

  const buildAddOnsPayload = useCallback(
    () =>
      addOnServices
        .filter(s => (addOnQuantities[s._id] ?? 0) > 0)
        .map(s => ({ serviceId: s._id, quantity: addOnQuantities[s._id] ?? s.partyConfig.defaultQuantity })),
    [addOnServices, addOnQuantities]
  );

  const handleCalculate = useCallback(async () => {
    if (!selectedAnchor) return;
    setIsCalculating(true); setEstimate(null); setEstimateError(null);
    try {
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anchorServiceId: selectedAnchor._id,
          addOns: buildAddOnsPayload(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
      setEstimate(data as EstimateResult);
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  }, [selectedAnchor, buildAddOnsPayload]);

  const getIdempotencyKey = useCallback((signature: string): string => {
    if (idempotencyRef.current && idempotencyRef.current.signature === signature) {
      return idempotencyRef.current.key;
    }
    const key = crypto.randomUUID();
    idempotencyRef.current = { key, signature };
    return key;
  }, []);

  const trimmedName = contactName.trim();
  const trimmedPhone = contactPhone.trim();
  const trimmedEmail = contactEmail.trim();
  const hasValidSlot = Boolean(selectedDate && selectedSlot && availability?.configured && availability.isOpen && !availability.isBlocked && availability.slots.includes(selectedSlot));
  const canSubmit = hasValidSlot && Boolean(trimmedName) && Boolean(trimmedPhone) && EMAIL_RE.test(trimmedEmail);

  const submitHint = !selectedDate
    ? 'Choose a date above to continue.'
    : availability && availability.slots.length === 0
    ? 'Choose a different date — this one is unavailable.'
    : !selectedSlot
    ? 'Select a time above to continue.'
    : (!trimmedName || !trimmedPhone || !EMAIL_RE.test(trimmedEmail))
    ? 'Fill in your name, phone, and email to continue.'
    : null;

  const handleRequestBook = useCallback(async () => {
    if (!session) {
      router.push(signInPath);
      return;
    }
    if (!selectedAnchor || !estimate || isBooking) return;
    if (!selectedDate || !selectedSlot) {
      setBookingSubmitError('Please select a date and time above before requesting to book.');
      return;
    }
    if (!trimmedName || !trimmedPhone || !EMAIL_RE.test(trimmedEmail)) {
      setBookingSubmitError('Please fill in your name, phone, and a valid email to continue.');
      return;
    }

    const addOnsPayload = buildAddOnsPayload();
    const signature = JSON.stringify({ anchor: selectedAnchor._id, addOns: addOnsPayload, date: selectedDate, slot: selectedSlot });
    const idempotencyKey = getIdempotencyKey(signature);

    setIsBooking(true);
    setBookingSubmitError(null);
    setSessionExpired(false);
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistSlug: artist.slug,
          anchorServiceId: selectedAnchor._id,
          addOns: addOnsPayload,
          date: selectedDate,
          slotStart: selectedSlot,
          contactInfo: { name: trimmedName, phone: trimmedPhone, email: trimmedEmail },
          customerNotes: customerNotes.trim() || undefined,
          idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setSessionExpired(true);
        throw new Error('Your session has expired. Please sign in again to send this request.');
      }
      if (res.status === 409) {
        void handleSelectDate(selectedDate);
      }
      if (!res.ok || !data.bookingId) {
        throw new Error(data.error ?? 'Something went wrong. Please try again.');
      }
      setBookingRef(data.ref);
      setBookingId(data.bookingId);
      setBookingConfirmed(true);
    } catch (err) {
      setBookingSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsBooking(false);
    }
  }, [session, router, signInPath, artist.slug, selectedAnchor, estimate, isBooking, selectedDate, selectedSlot, trimmedName, trimmedPhone, trimmedEmail, customerNotes, buildAddOnsPayload, getIdempotencyKey, handleSelectDate]);

  return (
    <div style={{ border: '1px solid #1C1C1C', overflow: 'hidden', background: '#0A0A0A' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #1C1C1C' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '4px' }}>Book</p>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', color: '#F0EBE0', margin: '0 0 4px', fontWeight: 400 }}>{artist.name}</h2>
        <p style={{ fontSize: '10px', color: '#7A706A', margin: 0 }}>
          {artist.businessMeta.teamSize} artist{artist.businessMeta.teamSize > 1 ? 's' : ''} · Requests are confirmed by Kajal Cartel
        </p>
      </div>

      {anchorServices.length === 0 ? (
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '12px', color: '#8A8078', lineHeight: 1.6, margin: 0 }}>
            This artist has no services open for online booking right now.
          </p>
        </div>
      ) : (
        <div style={{ padding: '20px' }}>
          <p id="kc-look-heading" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '12px' }}>
            {selectedAnchor ? 'Selected look' : 'Choose a look'}
          </p>
          <div role="group" aria-labelledby="kc-look-heading" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {anchorServices.map(s => <AnchorCard key={s._id} service={s} isSelected={selectedAnchor?._id === s._id} onSelect={() => handleAnchorSelect(s)} />)}
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedAnchor && addOnServices.length > 0 && (
          <motion.div key="addons" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderTop: '1px solid #1C1C1C' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '12px' }}>Add party members</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {addOnServices.map(s => <AddOnCard key={s._id} service={s} quantity={addOnQuantities[s._id] ?? s.partyConfig.defaultQuantity} onQuantityChange={d => handleQuantityChange(s._id, d, s)} />)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAnchor && (
          <motion.div key="date-picker" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }} style={{ overflow: 'hidden' }}>
            <DateSlotPicker
              service={selectedAnchor}
              dates={upcomingDates}
              canPageBack={datePage > 0}
              canPageForward={canPageForward}
              onPage={(direction) => setDatePage((p) => Math.max(0, p + direction))}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              availability={availability}
              isLoading={isLoadingAvailability}
              error={availabilityError}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              leadTimeDays={leadTimeDays}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {anchorServices.length > 0 && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1C1C1C' }}>
          <button type="button" onClick={handleCalculate} disabled={!selectedAnchor || isCalculating}
            style={{ width: '100%', padding: '14px 0', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', border: `1px solid ${selectedAnchor ? '#C9A96E' : '#1C1C1C'}`, color: selectedAnchor ? '#C9A96E' : '#5A5450', background: 'none', cursor: selectedAnchor ? 'pointer' : 'not-allowed', transition: 'border-color 0.2s, color 0.2s' }}>
            {isCalculating ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} aria-label="Calculating estimate">
                {[0, 1, 2].map(i => (
                  <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.22 }}
                    style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: '#C9A96E' }} />
                ))}
              </span>
            ) : estimate ? 'Update estimate' : 'Get estimate'}
          </button>

          {!selectedAnchor && <p style={{ textAlign: 'center', fontSize: '10px', color: '#6A625C', marginTop: '10px' }}>Choose a look above to get started</p>}

          <AnimatePresence>
            {estimateError && (
              <motion.p key="err" role="alert" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(220,80,80,0.85)', marginTop: '10px' }}>
                {estimateError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {estimate && !bookingConfirmed && (
          <motion.div key="estimate" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.45 }} style={{ overflow: 'hidden' }}>
            <div style={{ borderTop: '1px solid #1C1C1C', padding: '20px', background: '#0D0B09' }}>
              <EstimateBreakdown
                estimate={estimate}
                isBooking={isBooking}
                onRequestBook={handleRequestBook}
                contactName={contactName}
                onContactNameChange={setContactName}
                contactPhone={contactPhone}
                onContactPhoneChange={setContactPhone}
                contactEmail={contactEmail}
                onContactEmailChange={setContactEmail}
                customerNotes={customerNotes}
                onCustomerNotesChange={setCustomerNotes}
                requiresSignIn={!session}
                canSubmit={canSubmit}
                submitHint={submitHint}
                submitError={bookingSubmitError}
                sessionExpired={sessionExpired}
                signInPath={signInPath}
                policy={policy}
                isVerified={artist.flags.isVerified}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingConfirmed && estimate && selectedAnchor && selectedDate && selectedSlot && (
          <BookingConfirmation
            key="booking-confirmation"
            artist={artist}
            estimate={estimate}
            bookingRef={bookingRef}
            bookingId={bookingId}
            date={selectedDate}
            slot={selectedSlot}
            anchorName={selectedAnchor.name}
            onClose={() => {
              setBookingConfirmed(false);
              setEstimate(null);
              setSelectedAnchor(null);
              setAddOnQuantities({});
              setSelectedDate(null);
              setSelectedSlot(null);
              setAvailability(null);
              setAvailabilityError(null);
              setBookingSubmitError(null);
              setBookingRef('');
              setBookingId('');
              idempotencyRef.current = null;
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
