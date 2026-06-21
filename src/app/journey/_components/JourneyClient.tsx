'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MatchHistoryEntry } from '@/lib/db/models/User';

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

type Tab = 'artists' | 'history';

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

interface JourneyData {
  user: { name: string; email: string; image: string };
  savedVendors: SerializedVendor[];
  matchHistory: MatchHistoryEntry[];
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


function MatchCard({ entry, index }: { entry: MatchHistoryEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const topMatch = entry.matches[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden' }}
    >
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '14px', fontStyle: 'italic', color: '#B0A090', lineHeight: 1.65, marginBottom: '10px' }}>
              "{entry.editorialAnalysis.length > 130 ? entry.editorialAnalysis.slice(0, 127) + '…' : entry.editorialAnalysis}"
            </p>
            {entry.styleDNA.length > 0 && (
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {entry.styleDNA.slice(0, 3).map(({ label, score }) => (
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
            {topMatch && (
              <p style={{ fontSize: '11px', color: '#454140' }}>
                Top match: <Link href={`/artists/${topMatch.artistSlug}`} style={{ color: '#C9A96E', textDecoration: 'none' }}>{topMatch.artistName}</Link>
                <span style={{ fontFamily: FONT_MONO, color: '#3A3530', marginLeft: '8px' }}>{Math.round(topMatch.confidenceScore * 100)}%</span>
              </p>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '10px', color: '#2A2620', marginBottom: '8px' }}>{formatDate(entry.savedAt)}</p>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ background: 'none', border: 'none', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3A3530', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
              onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}
            >
              {expanded ? 'Less ↑' : 'All matches ↓'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && entry.matches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ borderTop: '1px solid #141210', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {entry.matches.map((m, i) => (
                  <div key={m.artistSlug} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '10px', color: '#2A2620', width: '18px' }}>0{i + 1}</span>
                    {m.profileImageUrl && (
                      <div style={{ width: '36px', height: '36px', overflow: 'hidden', flexShrink: 0, borderRadius: '0' }}>
                        <img src={m.profileImageUrl} alt={m.artistName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <Link href={`/artists/${m.artistSlug}`} style={{ textDecoration: 'none' }}>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '13px', color: '#F0EBE0', margin: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}>
                          {m.artistName}
                        </p>
                      </Link>
                      <p style={{ fontSize: '11px', color: '#454140', margin: 0, lineHeight: 1.5 }}>{m.rationale}</p>
                    </div>
                    <span style={{ fontFamily: FONT_MONO, fontSize: '11px', color: '#C9A96E', flexShrink: 0 }}>
                      {Math.round(m.confidenceScore * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}


function EmptyState({ tab }: { tab: Tab }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ border: '1px solid #161412', padding: '72px 32px', textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: '#3A3530', marginBottom: '12px' }}>
        {tab === 'artists' ? 'No saved artists yet.' : 'No style matches yet.'}
      </p>
      <p style={{ fontSize: '13px', color: '#2E2C2A', lineHeight: 1.7, marginBottom: '28px' }}>
        {tab === 'artists'
          ? 'Visit an artist profile and save the ones who speak to your aesthetic.'
          : 'Upload a photo on the Discover page to receive your personalised style matches.'}
      </p>
      <Link
        href={tab === 'artists' ? '/discover#roster' : '/discover'}
        style={{ display: 'inline-block', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', border: '1px solid #2D2418', padding: '12px 24px', color: '#C9A96E', textDecoration: 'none' }}
      >
        {tab === 'artists' ? 'Browse Artists' : 'Find My Artist'}
      </Link>
    </motion.div>
  );
}


export function JourneyClient({ data }: { data: JourneyData }) {
  const [activeTab, setActiveTab] = useState<Tab>('artists');
  const { user, savedVendors, matchHistory } = data;

  const count = activeTab === 'artists' ? savedVendors.length : matchHistory.length;

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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', maxWidth: '560px' }}>
            {[
              { v: savedVendors.length.toString(), l: 'Saved Artists' },
              { v: matchHistory.length.toString(), l: 'Style Matches' },
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
            {(['artists', 'history'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#C9A96E' : 'transparent'}`, padding: '0 0 16px', marginRight: '32px', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: activeTab === tab ? '#F0EBE0' : '#454140', cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s' }}>
                {tab === 'artists' ? 'Saved Artists' : 'Style Matches'}
                {(tab === 'artists' ? savedVendors : matchHistory).length > 0 && (
                  <span style={{ marginLeft: '7px', fontSize: '10px', color: activeTab === tab ? '#C9A96E' : '#2A2620', fontFamily: FONT_MONO }}>
                    {(tab === 'artists' ? savedVendors : matchHistory).length}
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
          ) : (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {matchHistory.length === 0 ? (
                <EmptyState tab="history" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[...matchHistory].reverse().map((entry, i) => (
                    <MatchCard key={entry.id} entry={entry} index={i} />
                  ))}
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