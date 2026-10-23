'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { VendorCard } from '@/components/discovery/VendorCard';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Avatar } from '@/components/site/AccountMenu';
import { AddToBoardButton } from '@/components/boards/AddToBoardButton';
import { StatusBadge } from '@/components/booking/StatusBadge';
import { apiRequest } from '@/lib/client/api';
import { COLORS, FONT_DISPLAY, FONT_MONO, formatDuration, formatINR, formatIsoDate, formatSlotLabel } from '@/components/site/tokens';
import type { MatchResult } from '@/types/match';
import type { CustomerBookingSummary } from '@/lib/db/controllers/BookingViews';
import type { BoardSummary } from '@/lib/db/controllers/BoardManager';
import type { JourneyData, JourneyTab, SavedMoodboardSummary, SavedVendorView } from '../types';

const BADGE_CONFIG: Record<string, { background: string; color: string }> = {
  'The Cartel Core': { background: 'linear-gradient(135deg, #C9A96E 0%, #8B6A1A 100%)', color: '#080808' },
  'Vanguard Stylist': { background: 'linear-gradient(135deg, #D0D0D0 0%, #848484 100%)', color: '#080808' },
  'Heritage Master': { background: 'linear-gradient(135deg, #6B2E3A 0%, #3D1622 100%)', color: '#C9A96E' },
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function BookingCard({ booking, index }: { booking: CustomerBookingSummary; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.06 }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '20px 22px', listStyle: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: COLORS.text, margin: '0 0 4px' }}>{booking.serviceName}</p>
          <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>
            with{' '}
            {booking.vendorSlug ? (
              <Link href={`/artists/${booking.vendorSlug}`} className="kc-nav-link" style={{ color: COLORS.textMuted, textDecoration: 'none' }}>
                {booking.vendorName}
              </Link>
            ) : (
              booking.vendorName
            )}
          </p>
        </div>
        <StatusBadge status={booking.status} phase={booking.phase} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '14px', margin: '0 0 14px' }}>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textFaint, margin: '0 0 3px' }}>Date</dt>
          <dd style={{ fontSize: '12px', color: COLORS.textMuted, margin: 0 }}>{formatIsoDate(booking.date, 'short')}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textFaint, margin: '0 0 3px' }}>Time</dt>
          <dd style={{ fontSize: '12px', color: COLORS.textMuted, margin: 0 }}>{formatSlotLabel(booking.startTime)}–{formatSlotLabel(booking.endTime)}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textFaint, margin: '0 0 3px' }}>Duration</dt>
          <dd style={{ fontSize: '12px', color: COLORS.textMuted, margin: 0 }}>{formatDuration(booking.durationMinutes)}</dd>
        </div>
        <div>
          <dt style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textFaint, margin: '0 0 3px' }}>Estimate</dt>
          <dd style={{ fontSize: '12px', color: COLORS.textMuted, margin: 0 }}>{formatINR(booking.total)}</dd>
        </div>
      </dl>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <p style={{ fontSize: '10px', color: COLORS.textFaint, margin: 0 }}>
          Ref <span style={{ fontFamily: FONT_MONO, color: COLORS.textDim }}>{booking.ref}</span>
          {booking.canReview.allowed && <span style={{ color: COLORS.gold }}> · Ready for your review</span>}
        </p>
        <Link
          href={`/journey/bookings/${booking.id}`}
          aria-label={`View details for booking ${booking.ref}`}
          style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: COLORS.gold, textDecoration: 'none', border: '1px solid #2D2418', padding: '8px 14px' }}
        >
          View details →
        </Link>
      </div>
    </motion.li>
  );
}

const BOOKING_GROUPS: Array<{ phase: CustomerBookingSummary['phase']; title: string; hint: string }> = [
  { phase: 'upcoming', title: 'Upcoming', hint: 'Requests and confirmed appointments that are still ahead.' },
  { phase: 'awaiting-completion', title: 'Past — awaiting completion', hint: 'Appointments whose time has passed and have not yet been marked complete.' },
  { phase: 'completed', title: 'Completed', hint: 'Finished appointments. You can review each one once.' },
  { phase: 'cancelled', title: 'Cancelled & declined', hint: 'Requests that were cancelled or could not be accommodated.' },
];

function BookingsPanel({ bookings }: { bookings: CustomerBookingSummary[] }) {
  if (bookings.length === 0) return <EmptyState tab="bookings" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      {BOOKING_GROUPS.map((group) => {
        const items = bookings
          .filter((b) => b.phase === group.phase)
          .sort((a, b) =>
            group.phase === 'upcoming'
              ? `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
              : `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)
          );
        if (items.length === 0) return null;
        return (
          <section key={group.phase} aria-labelledby={`group-${group.phase}`}>
            <h2 id={`group-${group.phase}`} style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', color: COLORS.text, fontWeight: 400, margin: '0 0 4px' }}>
              {group.title} <span style={{ fontSize: '0.8rem', color: COLORS.gold, fontFamily: FONT_MONO }}>{items.length}</span>
            </h2>
            <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '0 0 14px' }}>{group.hint}</p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: 0 }}>
              {items.map((b, i) => <BookingCard key={b.id} booking={b} index={i} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ArtistCard({ vendor, index, onRemoved }: { vendor: SavedVendorView; index: number; onRemoved: (slug: string) => void }) {
  const badge = vendor.badgeType ? BADGE_CONFIG[vendor.badgeType] : null;
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setIsRemoving(true);
    setError(null);
    try {
      await apiRequest(`/api/user/save-artist?artistSlug=${encodeURIComponent(vendor.slug)}`, { method: 'DELETE' });
      onRemoved(vendor.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this artist.');
      setIsRemoving(false);
      setConfirming(false);
    }
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden', display: 'flex', flexDirection: 'column', listStyle: 'none' }}
    >
      <div style={{ position: 'relative', paddingBottom: '120%', overflow: 'hidden', flexShrink: 0 }}>
        <img
          src={vendor.profileImageUrl}
          alt={vendor.name}
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,8,8,0.65) 0%, transparent 55%)' }} />
        {badge && (
          <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
            <span style={{ display: 'block', padding: '2px 8px', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, background: badge.background, color: badge.color }}>
              {vendor.badgeType}
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.textFaint, marginBottom: '5px' }}>{vendor.microLocation}</p>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', lineHeight: 1.2, marginBottom: '6px', fontWeight: 400 }}>
          <Link href={`/artists/${vendor.slug}`} className="kc-nav-link" style={{ color: COLORS.text, textDecoration: 'none' }}>{vendor.name}</Link>
        </h3>
        <p style={{ fontSize: '11px', color: COLORS.textDim, lineHeight: 1.55, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{vendor.tagline}</p>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9A8A78' }}>{vendor.fromPriceINR ? `from ${formatINR(vendor.fromPriceINR)}` : 'Prices on profile'}</span>
          <span style={{ fontSize: '11px', color: vendor.totalReviews > 0 ? COLORS.gold : COLORS.textFaint }}>
            {vendor.totalReviews > 0 ? `★ ${vendor.averageRating.toFixed(1)} (${vendor.totalReviews})` : 'No reviews yet'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            href={`/artists/${vendor.slug}`}
            style={{ flex: 1, display: 'block', textAlign: 'center', padding: '10px 0', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #2D2418', color: COLORS.gold, textDecoration: 'none' }}
          >
            View &amp; Book
          </Link>
          {confirming ? (
            <button type="button" onClick={remove} disabled={isRemoving}
              style={{ padding: '10px 10px', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', border: '1px solid rgba(180,90,74,0.6)', color: COLORS.danger, background: 'none', cursor: 'pointer' }}>
              {isRemoving ? '…' : 'Confirm'}
            </button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} aria-label={`Remove ${vendor.name} from saved artists`}
              style={{ padding: '10px 10px', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', border: '1px solid #1E1C1A', color: COLORS.textDim, background: 'none', cursor: 'pointer' }}>
              Remove
            </button>
          )}
        </div>
        {error && <p role="alert" style={{ fontSize: '11px', color: COLORS.error, margin: '8px 0 0' }}>{error}</p>}
      </div>
    </motion.li>
  );
}

function SavedLookCard({
  board,
  index,
  onDeleted,
  onRenamed,
}: {
  board: SavedMoodboardSummary;
  index: number;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, label: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [labelDraft, setLabelDraft] = useState(board.label);
  const [isSavingLabel, setIsSavingLabel] = useState(false);

  const handleToggleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (matches || isLoadingMatches) return;
    setIsLoadingMatches(true);
    setMatchesError(null);
    try {
      const data = await apiRequest<{ matches: MatchResult[] }>(`/api/user/moodboards/${board.id}/matches`, { method: 'POST' });
      setMatches(data.matches);
    } catch (err) {
      setMatchesError(err instanceof Error ? err.message : 'Could not load matches. Please try again.');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest(`/api/user/moodboards/${board.id}`, { method: 'DELETE' });
      onDeleted(board.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this look. Please try again.');
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleRename = async () => {
    const label = labelDraft.trim();
    if (!label) {
      setError('Please enter a name for this look.');
      return;
    }
    setIsSavingLabel(true);
    setError(null);
    try {
      await apiRequest(`/api/user/moodboards/${board.id}`, { method: 'PATCH', body: { label } });
      onRenamed(board.id, label);
      setIsRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename this look.');
    } finally {
      setIsSavingLabel(false);
    }
  };

  const smallButton = { background: 'none', border: 'none', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#8A8078', cursor: 'pointer', padding: 0 };

  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.06 }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden', listStyle: 'none' }}
    >
      <div className="grid grid-cols-[72px_1fr] sm:grid-cols-[96px_1fr_auto]" style={{ gap: '18px', padding: '20px 22px' }}>
        <div className="w-[72px] h-[72px] sm:w-[96px] sm:h-[96px]" style={{ overflow: 'hidden', flexShrink: 0, background: '#141210' }}>
          <img
            src={`/api/user/moodboards/${board.id}/image`}
            alt={board.label}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          {isRenaming ? (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <label htmlFor={`rename-${board.id}`} className="sr-only">Look name</label>
              <input
                id={`rename-${board.id}`}
                value={labelDraft}
                maxLength={80}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                style={{ flex: 1, minWidth: '160px', padding: '7px 9px', fontSize: '12px', background: '#080808', border: '1px solid #2D2418', color: COLORS.text, fontFamily: 'inherit' }}
                autoFocus
              />
              <button type="button" onClick={handleRename} disabled={isSavingLabel} style={{ ...smallButton, color: COLORS.gold }}>{isSavingLabel ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => { setIsRenaming(false); setLabelDraft(board.label); }} style={smallButton}>Cancel</button>
            </div>
          ) : (
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: COLORS.text, margin: '0 0 6px' }}>{board.label}</p>
          )}
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '13px', fontStyle: 'italic', color: '#B0A090', lineHeight: 1.6, marginBottom: '10px' }}>
            &ldquo;{board.editorialAnalysis.length > 130 ? board.editorialAnalysis.slice(0, 127) + '…' : board.editorialAnalysis}&rdquo;
          </p>
          {board.styleDNA.length > 0 && (
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              {board.styleDNA.slice(0, 3).map(({ label, score }) => (
                <div key={label} style={{ minWidth: '100px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '10px', color: '#8A7A70' }}>{label}</span>
                    <span style={{ fontSize: '10px', color: COLORS.gold, fontFamily: FONT_MONO }}>{score}%</span>
                  </div>
                  <div style={{ height: '1px', background: '#1A1A1A' }}>
                    <div style={{ height: '100%', width: `${score}%`, background: COLORS.gold }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1 flex flex-row flex-wrap sm:flex-col sm:items-end" style={{ gap: '12px' }}>
          <p style={{ fontSize: '10px', color: COLORS.textFaint, margin: 0 }}>{formatDate(board.savedAt)}</p>
          <button type="button" onClick={handleToggleExpand} aria-expanded={expanded} style={smallButton}>
            {expanded ? 'Hide matches ↑' : 'View matches ↓'}
          </button>
          {!isRenaming && (
            <button type="button" onClick={() => setIsRenaming(true)} style={smallButton}>Rename</button>
          )}
          <AddToBoardButton item={{ kind: 'look', savedLookId: board.id }} label="Add to moodboard" variant="chip" align="right" />
          {confirmingDelete ? (
            <span style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={handleDelete} disabled={isDeleting} style={{ ...smallButton, color: COLORS.danger }}>
                {isDeleting ? 'Removing…' : 'Confirm delete'}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} style={smallButton}>Keep</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} style={{ ...smallButton, color: '#9A5A50' }}>Delete</button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: '11px', color: COLORS.error, padding: '0 22px 16px', margin: 0 }}>{error}</p>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid #141210', padding: '20px 22px' }} aria-live="polite">
              {isLoadingMatches ? (
                <p style={{ fontSize: '12px', color: COLORS.textDim }}>Finding your matches…</p>
              ) : matchesError ? (
                <p role="alert" style={{ fontSize: '12px', color: COLORS.error }}>{matchesError}</p>
              ) : matches && matches.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '16px' }}>
                  {matches.map((m, i) => (
                    <VendorCard key={m.vendor._id} match={m} rank={i + 1} index={i} showScore={false} showTags={false} />
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

const EVENT_LABEL: Record<string, string> = {
  wedding: 'Wedding',
  engagement: 'Engagement',
  sangeet: 'Sangeet',
  mehendi: 'Mehendi',
  haldi: 'Haldi',
  reception: 'Reception',
  cocktail: 'Cocktail',
  party: 'Party',
  'pre-wedding-shoot': 'Pre-wedding shoot',
  other: 'Other',
};

function BoardCard({ board, index }: { board: BoardSummary; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05 }}
      style={{ listStyle: 'none' }}
    >
      <Link href={`/moodboards/${board.id}`} style={{ display: 'block', border: '1px solid #1A1A1A', background: '#0C0C0C', textDecoration: 'none' }} className="group">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '90px 90px', gap: '2px', background: '#0A0A0A' }}>
          {[0, 1, 2, 3].map((i) =>
            board.coverImages[i] ? (
              <img key={i} src={board.coverImages[i]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div key={i} style={{ background: '#111' }} />
            )
          )}
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.gold, margin: '0 0 4px' }}>
            {EVENT_LABEL[board.eventType] ?? board.eventType}
            {board.eventDate ? ` · ${formatIsoDate(board.eventDate, 'short')}` : ''}
          </p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: COLORS.text, margin: '0 0 2px' }} className="group-hover:text-[#C9A96E] transition-colors">{board.name}</p>
          <p style={{ fontSize: '11px', color: COLORS.textDim, margin: 0 }}>{board.itemCount} item{board.itemCount === 1 ? '' : 's'}</p>
        </div>
      </Link>
    </motion.li>
  );
}

function EmptyState({ tab }: { tab: JourneyTab }) {
  const copy: Record<JourneyTab, { title: string; body: string; cta: string; href: string }> = {
    artists: {
      title: 'No saved artists yet.',
      body: 'Visit an artist profile and save the ones who speak to your aesthetic.',
      cta: 'Browse Artists',
      href: '/discover#roster',
    },
    looks: {
      title: 'No saved looks yet.',
      body: 'Upload a photo on the Discover page and save your favourite matches to see them here.',
      cta: 'Find My Artist',
      href: '/discover',
    },
    bookings: {
      title: 'No booking requests yet.',
      body: 'When you request to book an artist, it will show up here with its status, and you can reschedule or cancel it.',
      cta: 'Browse Artists',
      href: '/discover#roster',
    },
    boards: {
      title: 'No moodboards yet.',
      body: 'Collect looks, portfolio images, artists and services for each of your events in one place.',
      cta: 'Create a Moodboard',
      href: '/moodboards',
    },
  };
  const { title, body, cta, href } = copy[tab];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ border: '1px solid #161412', padding: '64px 24px', textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: '#8A8078', marginBottom: '12px' }}>
        {title}
      </p>
      <p style={{ fontSize: '13px', color: COLORS.textDim, lineHeight: 1.7, marginBottom: '28px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
        {body}
      </p>
      <Link
        href={href}
        style={{ display: 'inline-block', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', border: '1px solid #2D2418', padding: '12px 24px', color: COLORS.gold, textDecoration: 'none' }}
      >
        {cta}
      </Link>
    </motion.div>
  );
}


const TAB_LABEL: Record<JourneyTab, string> = {
  bookings: 'Bookings',
  artists: 'Saved Artists',
  looks: 'Saved Looks',
  boards: 'Moodboards',
};
const TAB_ORDER: JourneyTab[] = ['bookings', 'artists', 'looks', 'boards'];

export function JourneyClient({ data, initialTab }: { data: JourneyData; initialTab: JourneyTab }) {
  const [activeTab, setActiveTab] = useState<JourneyTab>(initialTab);
  const { user, bookings, boards } = data;
  const [savedVendors, setSavedVendors] = useState<SavedVendorView[]>(data.savedVendors);
  const [savedMoodboards, setSavedMoodboards] = useState<SavedMoodboardSummary[]>(data.savedMoodboards);
  const [notice, setNotice] = useState<string | null>(null);
  const tabRefs = useRef<Record<JourneyTab, HTMLButtonElement | null>>({ bookings: null, artists: null, looks: null, boards: null });

  const selectTab = useCallback((tab: JourneyTab, focus = false) => {
    setActiveTab(tab);
    if (focus) tabRefs.current[tab]?.focus();
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const tab = new URLSearchParams(window.location.search).get('tab') as JourneyTab | null;
      if (tab && TAB_ORDER.includes(tab)) setActiveTab(tab);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tab: JourneyTab) => {
    const idx = TAB_ORDER.indexOf(tab);
    if (e.key === 'ArrowRight') { e.preventDefault(); selectTab(TAB_ORDER[(idx + 1) % TAB_ORDER.length], true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); selectTab(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length], true); }
    if (e.key === 'Home') { e.preventDefault(); selectTab(TAB_ORDER[0], true); }
    if (e.key === 'End') { e.preventDefault(); selectTab(TAB_ORDER[TAB_ORDER.length - 1], true); }
  };

  const upcoming = bookings.filter((b) => b.phase === 'upcoming').length;
  const countFor = (tab: JourneyTab) =>
    tab === 'artists' ? savedVendors.length : tab === 'looks' ? savedMoodboards.length : tab === 'boards' ? boards.length : bookings.length;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />

      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '56px', paddingBottom: '96px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <Avatar name={user.name} email={user.email} image={user.image} size={52} />
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: COLORS.textDim, marginBottom: '5px' }}>
                Welcome back
              </p>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 3rem)', color: COLORS.text, fontWeight: 400, margin: 0 }}>
                {user.name.split(' ')[0]}&apos;s Bridal Journey
              </h1>
            </div>
            <Link href="/account" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: COLORS.gold, textDecoration: 'none', border: '1px solid #2D2418', padding: '10px 16px' }}>
              Profile &amp; Settings
            </Link>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '14px', maxWidth: '760px', margin: 0 }}>
            {[
              { v: upcoming, l: 'Upcoming Bookings' },
              { v: savedVendors.length, l: 'Saved Artists' },
              { v: savedMoodboards.length, l: 'Saved Looks' },
              { v: boards.length, l: 'Moodboards' },
            ].map(s => (
              <div key={s.l} style={{ border: '1px solid #161412', padding: '16px' }}>
                <dd style={{ fontFamily: FONT_DISPLAY, fontSize: '1.6rem', color: COLORS.gold, margin: '0 0 5px', fontWeight: 400 }}>{s.v}</dd>
                <dt style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.textDim, margin: 0 }}>{s.l}</dt>
              </div>
            ))}
          </dl>
        </motion.div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: '1px solid #141210', marginBottom: '40px', gap: '12px' }}>
          <div role="tablist" aria-label="My journey sections" style={{ display: 'flex', overflowX: 'auto' }}>
            {TAB_ORDER.map(tab => (
              <button
                key={tab}
                ref={(el) => { tabRefs.current[tab] = el; }}
                id={`tab-${tab}`}
                role="tab"
                type="button"
                aria-selected={activeTab === tab}
                aria-controls={`panel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => selectTab(tab)}
                onKeyDown={(e) => onTabKeyDown(e, tab)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? COLORS.gold : 'transparent'}`, padding: '0 0 16px', marginRight: '28px', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: activeTab === tab ? COLORS.text : '#8A8078', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.2s, border-color 0.2s' }}>
                {TAB_LABEL[tab]}
                {countFor(tab) > 0 && (
                  <span style={{ marginLeft: '7px', fontSize: '10px', color: activeTab === tab ? COLORS.gold : COLORS.textFaint, fontFamily: FONT_MONO }}>
                    {countFor(tab)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '18px', paddingBottom: '16px' }}>
            <Link href="/discover" className="kc-nav-link" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A8078', textDecoration: 'none' }}>
              + New Match
            </Link>
            <Link href="/moodboards" className="kc-nav-link" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A8078', textDecoration: 'none' }}>
              + New Moodboard
            </Link>
          </div>
        </div>

        <div aria-live="polite">
          {notice && <p style={{ fontSize: '12px', color: COLORS.success, margin: '-20px 0 20px' }}>{notice}</p>}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'bookings' && <BookingsPanel bookings={bookings} />}
            {activeTab === 'artists' && (
              savedVendors.length === 0 ? (
                <EmptyState tab="artists" />
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '16px', padding: 0, margin: 0 }}>
                  {savedVendors.map((v, i) => (
                    <ArtistCard
                      key={v.slug}
                      vendor={v}
                      index={i}
                      onRemoved={(slug) => {
                        setSavedVendors((prev) => prev.filter((x) => x.slug !== slug));
                        setNotice(`${v.name} was removed from your saved artists.`);
                      }}
                    />
                  ))}
                </ul>
              )
            )}
            {activeTab === 'looks' && (
              savedMoodboards.length === 0 ? (
                <EmptyState tab="looks" />
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: 0 }}>
                  {savedMoodboards.map((board, i) => (
                    <SavedLookCard
                      key={board.id}
                      board={board}
                      index={i}
                      onDeleted={(id) => {
                        setSavedMoodboards((prev) => prev.filter((b) => b.id !== id));
                        setNotice('Saved look deleted.');
                      }}
                      onRenamed={(id, label) => setSavedMoodboards((prev) => prev.map((b) => (b.id === id ? { ...b, label } : b)))}
                    />
                  ))}
                </ul>
              )
            )}
            {activeTab === 'boards' && (
              boards.length === 0 ? (
                <EmptyState tab="boards" />
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '16px', padding: 0, margin: 0 }}>
                  {boards.map((b, i) => <BoardCard key={b.id} board={b} index={i} />)}
                </ul>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

