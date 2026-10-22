'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ArtistProfile, ClientService, EstimateResult } from '@/types/artist';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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
}

interface UpcomingDate {
  iso: string;
  weekday: string;
  day: string;
}

function nextNDatesUTC(n: number): UpcomingDate[] {
  const now = new Date();
  const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dates: UpcomingDate[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(startMs + i * 86400000);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    dates.push({
      iso,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      day: String(d.getUTCDate()),
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

function DateSlotPicker({
  service,
  dates,
  selectedDate,
  onSelectDate,
  availability,
  isLoading,
  error,
  selectedSlot,
  onSelectSlot,
}: {
  service: ClientService;
  dates: UpcomingDate[];
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
  availability: DailyAvailability | null;
  isLoading: boolean;
  error: string | null;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}) {
  return (
    <div style={{ padding: '20px', borderTop: '1px solid #1C1C1C' }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#454140', marginBottom: '12px' }}>
        Choose a date &amp; time
      </p>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
        {dates.map((d) => {
          const isSelected = d.iso === selectedDate;
          return (
            <button
              key={d.iso}
              onClick={() => onSelectDate(d.iso)}
              style={{
                flexShrink: 0,
                width: '46px',
                padding: '10px 0',
                textAlign: 'center',
                border: `1px solid ${isSelected ? '#C9A96E' : '#1C1C1C'}`,
                background: isSelected ? '#0D0B08' : 'transparent',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <p style={{ fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3A3530', margin: '0 0 4px' }}>{d.weekday}</p>
              <p style={{ fontSize: '13px', color: isSelected ? '#C9A96E' : '#F0EBE0', margin: 0 }}>{d.day}</p>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div>
          {isLoading ? (
            <p style={{ fontSize: '11px', color: '#3A3530' }}>Checking availability…</p>
          ) : error ? (
            <p style={{ fontSize: '11px', color: 'rgba(220,80,80,0.75)' }}>{error}</p>
          ) : !availability ? null : !availability.configured ? (
            <p style={{ fontSize: '11px', color: '#3A3530', lineHeight: 1.6 }}>
              This artist hasn't set up online scheduling yet — booking isn't available right now.
            </p>
          ) : availability.isBlocked ? (
            <p style={{ fontSize: '11px', color: '#3A3530', lineHeight: 1.6 }}>
              Not taking bookings on this date{availability.blockedReason ? ` — ${availability.blockedReason}` : ''}.
            </p>
          ) : !availability.isOpen ? (
            <p style={{ fontSize: '11px', color: '#3A3530' }}>Closed on this date.</p>
          ) : availability.slots.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#3A3530' }}>No slots long enough for {service.name} on this date.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availability.slots.map((slot) => {
                const isSelected = slot === selectedSlot;
                return (
                  <button
                    key={slot}
                    onClick={() => onSelectSlot(slot)}
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
    <div onClick={onSelect} style={{ cursor: 'pointer', border: `1px solid ${isSelected ? '#C9A96E' : '#1C1C1C'}`, padding: '16px', background: isSelected ? '#0D0B08' : 'transparent', transition: 'border-color 0.2s, background 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0, marginTop: '4px', border: `1px solid ${isSelected ? '#C9A96E' : '#3A3530'}`, background: isSelected ? '#C9A96E' : 'transparent', transition: 'background 0.2s, border-color 0.2s' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
            <div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', color: '#F0EBE0', margin: '0 0 2px' }}>{service.name}</p>
              {service.flags.isSignatureService && <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C9A96E' }}>Signature</span>}
            </div>
            <span style={{ fontSize: '13px', color: '#F0EBE0', flexShrink: 0 }}>{formatINR(service.pricing.unitPriceINR)}</span>
          </div>
          {service.description && <p style={{ fontSize: '12px', color: '#454140', lineHeight: 1.6, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{service.description}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#3A3530' }}>{formatDuration(service.duration.baseDurationMinutes)}</span>
            {service.checkoutMeta.requiresConsultation && (
              <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid #2A1A08', color: '#8B6A2A', padding: '1px 7px' }}>Consultation required</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddOnCard({ service, quantity, onQuantityChange }: { service: ClientService; quantity: number; onQuantityChange: (delta: number) => void }) {
  const activeTier = [...service.pricing.groupDiscountTiers].filter(t => quantity >= t.minQuantity).sort((a, b) => b.discountPercent - a.discountPercent)[0];
  const effectiveUnit = activeTier && service.checkoutMeta.estimateContribution === 'tiered'
    ? Math.round(service.pricing.unitPriceINR * (1 - activeTier.discountPercent / 100))
    : service.pricing.unitPriceINR;
  const subtotal = effectiveUnit * quantity;
  const nextTier = service.pricing.groupDiscountTiers.filter(t => quantity < t.minQuantity).sort((a, b) => a.minQuantity - b.minQuantity)[0];

  return (
    <div style={{ border: '1px solid #1A1A1A', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', color: '#F0EBE0', margin: '0 0 3px' }}>{service.name}</p>
          <p style={{ fontSize: '11px', color: '#454140', margin: 0 }}>{formatINR(service.pricing.unitPriceINR)} per {service.partyConfig.quantityLabel.toLowerCase().replace(/s$/, '')}</p>
          {service.pricing.groupDiscountTiers.length > 0 && (
            <p style={{ fontSize: '10px', color: '#3A3530', marginTop: '2px' }}>
              {service.pricing.groupDiscountTiers.map(t => `${t.discountPercent}% off ${t.minQuantity}+`).join(' · ')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button onClick={() => onQuantityChange(-1)} disabled={quantity <= service.partyConfig.minQuantity}
            style={{ width: '28px', height: '28px', border: '1px solid #2A2520', background: 'none', color: '#C9A96E', cursor: quantity <= service.partyConfig.minQuantity ? 'not-allowed' : 'pointer', opacity: quantity <= service.partyConfig.minQuantity ? 0.2 : 1, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <span style={{ fontSize: '13px', color: '#F0EBE0', width: '20px', textAlign: 'center' }}>{quantity}</span>
          <button onClick={() => onQuantityChange(1)} disabled={quantity >= service.partyConfig.maxQuantity}
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
            <span style={{ fontSize: '10px', color: '#3A3530' }}>Add {nextTier.minQuantity - quantity} more for {nextTier.discountPercent}% off</span>
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
  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '12px' }}>Your Details</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="text"
          placeholder="Full name"
          value={contactName}
          onChange={(e) => onContactNameChange(e.target.value)}
          style={fieldStyle}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="tel"
            placeholder="Phone number"
            value={contactPhone}
            onChange={(e) => onContactPhoneChange(e.target.value)}
            style={fieldStyle}
          />
          <input
            type="email"
            placeholder="Email"
            value={contactEmail}
            onChange={(e) => onContactEmailChange(e.target.value)}
            style={fieldStyle}
          />
        </div>
        <textarea
          placeholder="Anything the artist should know? (optional)"
          value={customerNotes}
          onChange={(e) => onCustomerNotesChange(e.target.value)}
          rows={2}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </div>
    </div>
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
}) {
  const disabled = Boolean(isBooking) || (!requiresSignIn && !canSubmit);

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
          <span style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3A3530' }}>To confirm (30% deposit)</span>
          <span style={{ fontSize: '13px', color: '#6A6460' }}>{formatINR(estimate.depositAmount)}</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { icon: '✓', text: 'Verified artist · Portfolio confirmed' },
            { icon: '✓', text: 'Secure booking · Deposit protected' },
            { icon: '✓', text: 'Free cancellation within 48 hours' },
          ].map(({ icon, text }) => (
            <p key={text} style={{ fontSize: '11px', color: '#4A4440', margin: 0 }}>
              <span style={{ color: '#5A8A5A', marginRight: '6px' }}>{icon}</span>{text}
            </p>
          ))}
        </div>
      </div>

      <p style={{ fontSize: '10px', color: '#2E2C2A', lineHeight: 1.6, marginBottom: '16px' }}>
        This is an indicative estimate. The final price will be confirmed by the artist before your booking is locked in.
      </p>

      <button
        onClick={onRequestBook}
        disabled={disabled}
        style={{ width: '100%', padding: '15px 0', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 600, background: disabled && !requiresSignIn ? '#3A3530' : isBooking ? '#8B6A1A' : '#C9A96E', color: '#080808', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: disabled && !requiresSignIn ? 0.5 : isBooking ? 0.75 : 1 }}
        onMouseEnter={e => !disabled && (e.currentTarget.style.background = '#B8943F')}
        onMouseLeave={e => !disabled && (e.currentTarget.style.background = isBooking ? '#8B6A1A' : '#C9A96E')}>
        {isBooking ? 'Sending request…' : requiresSignIn ? 'Sign In to Book' : 'Request to Book'}
      </button>

      {!requiresSignIn && submitHint && !isBooking && (
        <p style={{ textAlign: 'center', fontSize: '10px', color: '#3A3530', marginTop: '10px' }}>{submitHint}</p>
      )}

      <AnimatePresence>
        {submitError && (
          <motion.p key="submit-err" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(220,80,80,0.75)', marginTop: '10px' }}>
            {submitError}
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
  onClose,
}: {
  artist: ArtistProfile;
  estimate: EstimateResult;
  anchorName: string;
  bookingRef: string;
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
      <div style={{ borderTop: '1px solid #1C1C1C', padding: '24px 20px', background: '#0A0D09' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
            style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2A4A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}
          >
            <span style={{ color: '#5A8A5A', fontSize: '14px' }}>✓</span>
          </motion.div>
          <div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', marginBottom: '4px', fontWeight: 400 }}>
              Booking request sent
            </p>
            <p style={{ fontSize: '11px', color: '#3A3530' }}>
              Reference <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#C9A96E' }}>{bookingRef}</span>
            </p>
          </div>
        </div>

        <div style={{ background: '#0C0C0C', border: '1px solid #161412', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#4A4440' }}>Artist</span>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: '13px', color: '#C8B9A8' }}>{artist.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#4A4440' }}>Service</span>
              <span style={{ fontSize: '12px', color: '#C8B9A8' }}>{anchorName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#4A4440' }}>Deposit due on confirmation</span>
              <span style={{ fontSize: '12px', color: '#F0EBE0' }}>{formatINR(estimate.depositAmount)}</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#5A5450', lineHeight: 1.7, marginBottom: '18px' }}>
          <span style={{ color: '#C8B9A8' }}>{artist.name}</span> has been notified and typically responds within 24 hours. Check <span style={{ color: '#C9A96E' }}>My Journey</span> for updates.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/journey"
            style={{ flex: 1, display: 'block', padding: '11px 0', textAlign: 'center', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', background: '#C9A96E', color: '#080808', textDecoration: 'none', fontWeight: 600 }}>
            My Journey
          </a>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px 0', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', background: 'none', border: '1px solid #1C1C1C', color: '#4A4440', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4A4440')}>
            Browse More
          </button>
        </div>
      </div>
    </motion.div>
  );
}

interface BookingBuilderProps { artist: ArtistProfile; services: ClientService[]; }

export function BookingBuilder({ artist, services }: BookingBuilderProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [selectedAnchor, setSelectedAnchor] = useState<ClientService | null>(null);
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingRef, setBookingRef] = useState<string>('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSubmitError, setBookingSubmitError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DailyAvailability | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const idempotencyRef = useRef<{ key: string; signature: string } | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    setContactName(prev => prev || session.user?.name || '');
    setContactEmail(prev => prev || session.user?.email || '');
  }, [session?.user]);

  const upcomingDates = useMemo(() => nextNDatesUTC(14), []);

  const anchorServices = services.filter(s => s.serviceRole === 'anchor' && s.flags.isActive).sort((a, b) => a.checkoutMeta.displayPriority - b.checkoutMeta.displayPriority);

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
    setSelectedDate(iso);
    setSelectedSlot(null);
    setAvailability(null);
    setBookingSubmitError(null);
    setIsLoadingAvailability(true);
    setAvailabilityError(null);
    try {
      const res = await fetch(`/api/vendors/${artist.slug}/availability?date=${iso}&serviceId=${selectedAnchor._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not check availability.');
      setAvailability(data as DailyAvailability);
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : 'Could not check availability.');
    } finally {
      setIsLoadingAvailability(false);
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
  const hasValidSlot = Boolean(selectedDate && selectedSlot && availability?.configured && availability.isOpen && !availability.isBlocked);
  const canSubmit = hasValidSlot && Boolean(trimmedName) && Boolean(trimmedPhone) && EMAIL_RE.test(trimmedEmail);

  const submitHint = !selectedDate
    ? 'Choose a date above to continue.'
    : availability && !availability.configured
    ? "This artist hasn't set up online scheduling yet — booking isn't available right now."
    : availability && (availability.isBlocked || !availability.isOpen)
    ? 'Choose a different date — this one is unavailable.'
    : !selectedSlot
    ? 'Select a time above to continue.'
    : (!trimmedName || !trimmedPhone || !EMAIL_RE.test(trimmedEmail))
    ? 'Fill in your name, phone, and email to continue.'
    : null;

  const handleRequestBook = useCallback(async () => {
    if (!session) {
      router.push(`/auth?callbackUrl=/artists/${artist.slug}`);
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
      const data = await res.json();
      if (!res.ok || !data.bookingId) {
        throw new Error(data.error ?? 'Something went wrong. Please try again.');
      }
      setBookingRef(data.ref);
      setBookingConfirmed(true);
    } catch (err) {
      setBookingSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsBooking(false);
    }
  }, [session, router, artist.slug, selectedAnchor, estimate, isBooking, selectedDate, selectedSlot, trimmedName, trimmedPhone, trimmedEmail, customerNotes, buildAddOnsPayload, getIdempotencyKey]);

  return (
    <div style={{ border: '1px solid #1C1C1C', overflow: 'hidden', background: '#0A0A0A' }}>
      <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #1C1C1C', paddingBottom: '20px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '4px' }}>Book</p>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', color: '#F0EBE0', margin: '0 0 4px', fontWeight: 400 }}>{artist.name}</h3>
        <p style={{ fontSize: '10px', color: '#3A3530', margin: 0 }}>
          {artist.businessMeta.teamSize} artist{artist.businessMeta.teamSize > 1 ? 's' : ''} · Typically responds within 24 hours
        </p>
      </div>

      <div style={{ padding: '20px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#454140', marginBottom: '12px' }}>
          {selectedAnchor ? 'Selected look' : 'Choose a look'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {anchorServices.map(s => <AnchorCard key={s._id} service={s} isSelected={selectedAnchor?._id === s._id} onSelect={() => handleAnchorSelect(s)} />)}
        </div>
      </div>

      <AnimatePresence>
        {selectedAnchor && addOnServices.length > 0 && (
          <motion.div key="addons" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderTop: '1px solid #1C1C1C' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#454140', marginBottom: '12px' }}>Add party members</p>
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
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              availability={availability}
              isLoading={isLoadingAvailability}
              error={availabilityError}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding: '16px 20px', borderTop: '1px solid #1C1C1C' }}>
        <button onClick={handleCalculate} disabled={!selectedAnchor || isCalculating}
          style={{ width: '100%', padding: '14px 0', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', border: `1px solid ${selectedAnchor ? '#C9A96E' : '#1C1C1C'}`, color: selectedAnchor ? '#C9A96E' : '#3A3530', background: 'none', cursor: selectedAnchor ? 'pointer' : 'not-allowed', transition: 'border-color 0.2s, color 0.2s' }}>
          {isCalculating ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {[0, 1, 2].map(i => (
                <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.22 }}
                  style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: '#C9A96E' }} />
              ))}
            </span>
          ) : estimate ? 'Update estimate' : 'Get estimate'}
        </button>

        {!selectedAnchor && <p style={{ textAlign: 'center', fontSize: '10px', color: '#2E2C2A', marginTop: '10px' }}>Choose a look above to get started</p>}

        <AnimatePresence>
          {estimateError && (
            <motion.p key="err" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(220,80,80,0.75)', marginTop: '10px' }}>
              {estimateError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {estimate && (
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
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingConfirmed && estimate && selectedAnchor && (
          <BookingConfirmation
            key="booking-confirmation"
            artist={artist}
            estimate={estimate}
            bookingRef={bookingRef}
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
              idempotencyRef.current = null;
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
