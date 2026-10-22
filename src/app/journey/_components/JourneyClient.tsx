'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { VendorCard } from '@/components/discovery/VendorCard';
import type { MatchResult } from '@/types/match';

interface SavedMoodboardSummary {
  id: string;
  label: string;
  styleDNA: Array<{ label: string; score: number }>;
  editorialAnalysis: string;
  savedAt: string;
}

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const FONT_MONO = '"JetBrains Mono", "Courier New", monospace';

const BADGE_CONFIG: Record<string, { background: string; color: string }> = {
  'The Cartel Core': { background: 'linear-gradient(135deg, #C9A96E 0%, #8B6A1A 100%)', color: '#080808' },
  'Vanguard Stylist': { background: 'linear-gradient(135deg, #D0D0D0 0%, #848484 100%)', color: '#080808' },
  'Heritage Master': { background: 'linear-gradient(135deg, #6B2E3A 0%, #3D1622 100%)', color: '#C9A96E' },
};

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

type Tab = 'artists' | 'history' | 'bookings';

interface SerializedVendor {
  slug: string;
  name: string;
  tagline: string;
  profileImageUrl: string;
  microLocation: string;
  tier: string;
  startingFromINR: number;
  averageRating: number;
  badgeType: string | null;
}

interface SerializedBooking {
  id: string;
  ref: string;
  vendorName: string;
  vendorSlug: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  total: number;
  depositAmount: number;
  createdAt: string;
}

interface JourneyData {
  user: { name: string; email: string; image: string };
  savedVendors: SerializedVendor[];
  savedMoodboards: SavedMoodboardSummary[];
  bookings: SerializedBooking[];
}

const BOOKING_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Awaiting response', color: '#C9A96E' },
  CONFIRMED: { label: 'Confirmed', color: '#5A8A5A' },
  DECLINED: { label: 'Declined', color: '#8A5A4A' },
  CANCELLED: { label: 'Cancelled', color: '#6A6460' },
  COMPLETED: { label: 'Completed', color: '#7A6ADE' },
};

function BookingCard({ booking, index }: { booking: SerializedBooking; index: number }) {
  const status = BOOKING_STATUS_LABEL[booking.status] ?? { label: booking.status, color: '#6A6460' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '20px 22px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '12px' }}>
        <div>
          <Link href={`/artists/${booking.vendorSlug}`} style={{ textDecoration: 'none' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: '#F0EBE0', margin: '0 0 4px' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
              onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}>
              {booking.vendorName}
            </p>
          </Link>
          <p style={{ fontSize: '12px', color: '#454140', margin: 0 }}>{booking.serviceName}</p>
        </div>
        <span style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: status.color, border: `1px solid ${status.color}`, padding: '3px 9px', flexShrink: 0 }}>
          {status.label}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2E2C2A', margin: '0 0 3px' }}>Date &amp; time</p>
          <p style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{formatDate(booking.date)} · {formatSlotLabel(booking.startTime)}–{formatSlotLabel(booking.endTime)}</p>
        </div>
        <div>
          <p style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2E2C2A', margin: '0 0 3px' }}>Total estimate</p>
          <p style={{ fontSize: '12px', color: '#C8B9A8', margin: 0 }}>{formatINR(booking.total)}</p>
        </div>
      </div>

      <p style={{ fontSize: '10px', color: '#2A2620', margin: 0 }}>
        Ref <span style={{ fontFamily: FONT_MONO, color: '#3A3530' }}>{booking.ref}</span> · Requested {formatDate(booking.createdAt)}
      </p>
    </motion.div>
  );
}


function ArtistCard({ vendor, index }: { vendor: SerializedVendor; index: number }) {
  const badge = vendor.badgeType ? BADGE_CONFIG[vendor.badgeType] : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ position: 'relative', paddingBottom: '120%', overflow: 'hidden', flexShrink: 0 }}>
        <img
          src={vendor.profileImageUrl}
          alt={vendor.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.55s ease' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
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
        <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3A3530', marginBottom: '5px' }}>{vendor.microLocation}</p>
        <Link href={`/artists/${vendor.slug}`} style={{ textDecoration: 'none' }}>
          <h3
            style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', lineHeight: 1.2, marginBottom: '6px', fontWeight: 400 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}
          >
            {vendor.name}
          </h3>
        </Link>
        <p style={{ fontSize: '11px', color: '#454140', lineHeight: 1.55, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{vendor.tagline}</p>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '11px', color: '#9A8A78' }}>from {formatINR(vendor.startingFromINR)}</span>
          <span style={{ fontSize: '11px', color: '#C9A96E' }}>★ {vendor.averageRating.toFixed(1)}</span>
        </div>
        <Link
          href={`/artists/${vendor.slug}`}
          style={{ display: 'block', textAlign: 'center', padding: '10px 0', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1E1C1A', color: '#3A3530', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2D2418'; (e.currentTarget as HTMLAnchorElement).style.color = '#C9A96E'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#1E1C1A'; (e.currentTarget as HTMLAnchorElement).style.color = '#3A3530'; }}
        >
          View Artist
        </Link>
      </div>
    </motion.div>
  );
}


function SavedLookCard({
  board,
  index,
  onDeleted,
}: {
  board: SavedMoodboardSummary;
  index: number;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      const res = await fetch(`/api/user/moodboards/${board.id}/matches`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load matches. Please try again.');
      setMatches(data.matches as MatchResult[]);
    } catch (err) {
      setMatchesError(err instanceof Error ? err.message : 'Could not load matches. Please try again.');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (typeof window !== 'undefined' && !window.confirm(`Remove "${board.label}" from your saved looks?`)) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/user/moodboards/${board.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not delete this look. Please try again.');
      }
      onDeleted(board.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this look. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: '18px', padding: '20px 22px' }}>
        <div style={{ width: '96px', height: '96px', overflow: 'hidden', flexShrink: 0, background: '#141210' }}>
          <img
            src={`/api/user/moodboards/${board.id}/image`}
            alt={board.label}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: '#F0EBE0', margin: '0 0 6px' }}>{board.label}</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '13px', fontStyle: 'italic', color: '#B0A090', lineHeight: 1.6, marginBottom: '10px' }}>
            "{board.editorialAnalysis.length > 130 ? board.editorialAnalysis.slice(0, 127) + '…' : board.editorialAnalysis}"
          </p>
          {board.styleDNA.length > 0 && (
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              {board.styleDNA.slice(0, 3).map(({ label, score }) => (
                <div key={label} style={{ minWidth: '100px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '10px', color: '#6A5A50' }}>{label}</span>
                    <span style={{ fontSize: '10px', color: '#C9A96E', fontFamily: FONT_MONO }}>{score}%</span>
                  </div>
                  <div style={{ height: '1px', background: '#1A1A1A' }}>
                    <div style={{ height: '100%', width: `${score}%`, background: '#C9A96E' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
          <p style={{ fontSize: '10px', color: '#2A2620', margin: 0 }}>{formatDate(board.savedAt)}</p>
          <button
            onClick={handleToggleExpand}
            style={{ background: 'none', border: 'none', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3A3530', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}
          >
            {expanded ? 'Hide matches ↑' : 'View matches ↓'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            style={{ background: 'none', border: 'none', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5A3A34', cursor: isDeleting ? 'default' : 'pointer', padding: 0 }}
            onMouseEnter={e => { if (!isDeleting) e.currentTarget.style.color = '#B45A4A'; }}
            onMouseLeave={e => { if (!isDeleting) e.currentTarget.style.color = '#5A3A34'; }}
          >
            {isDeleting ? 'Removing…' : 'Delete'}
          </button>
        </div>
      </div>

      {deleteError && (
        <p style={{ fontSize: '10px', color: 'rgba(220,80,80,0.75)', padding: '0 22px 16px', margin: 0 }}>{deleteError}</p>
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
            <div style={{ borderTop: '1px solid #141210', padding: '20px 22px' }}>
              {isLoadingMatches ? (
                <p style={{ fontSize: '12px', color: '#3A3530' }}>Finding your matches…</p>
              ) : matchesError ? (
                <p style={{ fontSize: '12px', color: 'rgba(220,80,80,0.75)' }}>{matchesError}</p>
              ) : matches && matches.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {matches.map((m, i) => (
                    <VendorCard key={m.vendor._id} match={m} rank={i + 1} index={i} showScore={false} showTags={false} />
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


function EmptyState({ tab }: { tab: Tab }) {
  const copy: Record<Tab, { title: string; body: string; cta: string; href: string }> = {
    artists: {
      title: 'No saved artists yet.',
      body: 'Visit an artist profile and save the ones who speak to your aesthetic.',
      cta: 'Browse Artists',
      href: '/discover#roster',
    },
    history: {
      title: 'No saved looks yet.',
      body: 'Upload a photo on the Discover page and save your favourite matches to see them here.',
      cta: 'Find My Artist',
      href: '/discover',
    },
    bookings: {
      title: 'No booking requests yet.',
      body: 'When you request to book an artist, it will show up here with its status.',
      cta: 'Browse Artists',
      href: '/discover#roster',
    },
  };
  const { title, body, cta, href } = copy[tab];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ border: '1px solid #161412', padding: '72px 32px', textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: '#3A3530', marginBottom: '12px' }}>
        {title}
      </p>
      <p style={{ fontSize: '13px', color: '#2E2C2A', lineHeight: 1.7, marginBottom: '28px' }}>
        {body}
      </p>
      <Link
        href={href}
        style={{ display: 'inline-block', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', border: '1px solid #2D2418', padding: '12px 24px', color: '#C9A96E', textDecoration: 'none' }}
      >
        {cta}
      </Link>
    </motion.div>
  );
}


const TAB_LABEL: Record<Tab, string> = {
  artists: 'Saved Artists',
  history: 'Saved Looks',
  bookings: 'Bookings',
};

export function JourneyClient({ data }: { data: JourneyData }) {
  const [activeTab, setActiveTab] = useState<Tab>('artists');
  const { user, savedVendors, bookings } = data;
  const [savedMoodboards, setSavedMoodboards] = useState<SavedMoodboardSummary[]>(data.savedMoodboards);

  const handleMoodboardDeleted = (id: string) => {
    setSavedMoodboards(prev => prev.filter(b => b.id !== id));
  };

  const countFor = (tab: Tab) => (tab === 'artists' ? savedVendors.length : tab === 'history' ? savedMoodboards.length : bookings.length);

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,8,0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid #1C1C1C' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', letterSpacing: '0.14em', color: '#F0EBE0', textDecoration: 'none' }}>
            KAJAL CARTEL
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link href="/discover" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#454140', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#454140')}>
              Discover
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3A3530', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 40px 96px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px' }}>
            {user.image && (
              <div style={{ width: '52px', height: '52px', overflow: 'hidden', border: '1px solid #1C1C1C', flexShrink: 0 }}>
                <img src={user.image} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#454140', marginBottom: '5px' }}>
                Welcome back
              </p>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#F0EBE0', fontWeight: 400 }}>
                {user.name.split(' ')[0]}'s Bridal Journey
              </h1>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', maxWidth: '720px' }}>
            {[
              { v: savedVendors.length.toString(), l: 'Saved Artists' },
              { v: savedMoodboards.length.toString(), l: 'Saved Looks' },
              { v: bookings.length.toString(), l: 'Bookings' },
              { v: user.email.split('@')[0], l: 'Account' },
            ].map(s => (
              <div key={s.l} style={{ border: '1px solid #161412', padding: '16px' }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.6rem', color: '#C9A96E', margin: '0 0 5px', fontWeight: 400 }}>{s.v}</p>
                <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3A3530', margin: 0 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #141210', marginBottom: '40px' }}>
          <div style={{ display: 'flex' }}>
            {(['artists', 'history', 'bookings'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#C9A96E' : 'transparent'}`, padding: '0 0 16px', marginRight: '32px', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: activeTab === tab ? '#F0EBE0' : '#454140', cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s' }}>
                {TAB_LABEL[tab]}
                {countFor(tab) > 0 && (
                  <span style={{ marginLeft: '7px', fontSize: '10px', color: activeTab === tab ? '#C9A96E' : '#2A2620', fontFamily: FONT_MONO }}>
                    {countFor(tab)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Link href="/discover" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2A2620', textDecoration: 'none', paddingBottom: '16px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#2A2620')}>
            + New Match
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'artists' ? (
            <motion.div key="artists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {savedVendors.length === 0 ? (
                <EmptyState tab="artists" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {savedVendors.map((v, i) => <ArtistCard key={v.slug} vendor={v} index={i} />)}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'history' ? (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {savedMoodboards.length === 0 ? (
                <EmptyState tab="history" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {savedMoodboards.map((board, i) => (
                    <SavedLookCard key={board.id} board={board} index={i} onDeleted={handleMoodboardDeleted} />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {bookings.length === 0 ? (
                <EmptyState tab="bookings" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bookings.map((b, i) => <BookingCard key={b.id} booking={b} index={i} />)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer style={{ borderTop: '1px solid #141210', padding: '32px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#2A2620', margin: 0 }}>
          Kajal Cartel · New Delhi · Bridal Beauty
        </p>
      </footer>
    </div>
  );
}