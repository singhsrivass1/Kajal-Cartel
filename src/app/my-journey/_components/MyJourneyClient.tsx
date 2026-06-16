'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import type { MatchResult } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

interface SavedArtist {
  _id: string;
  name: string;
  slug: string;
  tagline: string;
  profileImageUrl: string;
  location: { microLocation: string };
  pricing: { tier: string; startingFromINR: number };
  ratings: { averageRating: number };
  flags: { badgeType: string | null };
  savedAt: string;
}

interface SavedMatch {
  id: string;
  previewUrl: string | null;
  narrative: string;
  styleDNA: Array<{ label: string; score: number }>;
  matches: MatchResult[];
  savedAt: string;
}

const BADGE_CONFIG: Record<string, { background: string; color: string }> = {
  'The Cartel Core': { background: 'linear-gradient(135deg, #C9A96E 0%, #8B6A1A 100%)', color: '#080808' },
  'Vanguard Stylist': { background: 'linear-gradient(135deg, #D0D0D0 0%, #848484 100%)', color: '#080808' },
  'Heritage Master': { background: 'linear-gradient(135deg, #6B2E3A 0%, #3D1622 100%)', color: '#C9A96E' },
};

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

type Tab = 'artists' | 'matches';

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}
      style={{ border: '1px solid #161412', padding: '72px 32px', textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: '#4A4440', marginBottom: '12px' }}>
        {tab === 'artists' ? 'No saved artists yet.' : 'No saved matches yet.'}
      </p>
      <p style={{ fontSize: '13px', color: '#2E2C2A', marginBottom: '28px', lineHeight: 1.6 }}>
        {tab === 'artists'
          ? 'Browse artist profiles and save the ones you like.'
          : 'Upload a photo on the Discover page to get your style matches.'}
      </p>
      <Link href={tab === 'artists' ? '/discover#roster' : '/discover'}
        style={{ display: 'inline-block', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', border: '1px solid #2D2418', padding: '12px 24px', color: '#C9A96E', textDecoration: 'none' }}>
        {tab === 'artists' ? 'Browse Artists' : 'Find My Artist'}
      </Link>
    </motion.div>
  );
}

function SavedArtistCard({ artist, onRemove }: { artist: SavedArtist; onRemove: (id: string) => void }) {
  const badge = artist.flags.badgeType ? BADGE_CONFIG[artist.flags.badgeType] : null;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} layout
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', paddingBottom: '125%', overflow: 'hidden', flexShrink: 0 }}>
        <img src={artist.profileImageUrl} alt={artist.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,8,8,0.65) 0%, transparent 55%)' }} />
        {badge && (
          <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
            <span style={{ display: 'block', padding: '2px 8px', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, background: badge.background, color: badge.color }}>
              {artist.flags.badgeType}
            </span>
          </div>
        )}
        <button onClick={() => onRemove(artist._id)}
          style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(8,8,8,0.75)', border: 'none', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5A5450', fontSize: '14px', backdropFilter: 'blur(4px)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#5A5450')}
          title="Remove from saved">×</button>
      </div>
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3A3530', marginBottom: '5px' }}>{artist.location.microLocation}</p>
        <Link href={`/artists/${artist.slug}`} style={{ textDecoration: 'none' }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', lineHeight: 1.2, marginBottom: '6px', fontWeight: 400 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}>
            {artist.name}
          </h3>
        </Link>
        <p style={{ fontSize: '11px', color: '#454140', lineHeight: 1.5, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{artist.tagline}</p>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', color: '#9A8A78' }}>from {formatINR(artist.pricing.startingFromINR)}</span>
          <span style={{ fontSize: '11px', color: '#C9A96E' }}>★ {artist.ratings.averageRating.toFixed(1)}</span>
        </div>
        <p style={{ fontSize: '10px', color: '#2A2620', marginBottom: '12px' }}>Saved {formatDate(artist.savedAt)}</p>
        <Link href={`/artists/${artist.slug}`}
          style={{ display: 'block', textAlign: 'center', padding: '10px 0', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1E1C1A', color: '#3A3530', textDecoration: 'none' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2D2418'; (e.currentTarget as HTMLAnchorElement).style.color = '#C9A96E'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#1E1C1A'; (e.currentTarget as HTMLAnchorElement).style.color = '#3A3530'; }}>
          View Artist
        </Link>
      </div>
    </motion.div>
  );
}

function SavedMatchCard({ match, onRemove }: { match: SavedMatch; onRemove: (id: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} layout
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: match.previewUrl ? '100px 1fr' : '1fr' }}>
        {match.previewUrl && (
          <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100px' }}>
            <img src={match.previewUrl} alt="Style match" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.7 }} />
          </div>
        )}
        <div style={{ padding: '18px 20px', borderLeft: match.previewUrl ? '1px solid #161412' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '14px', fontStyle: 'italic', color: '#B0A090', lineHeight: 1.6, flex: 1 }}>
              {match.narrative.length > 120 ? match.narrative.slice(0, 117) + '…' : match.narrative}
            </p>
            <button onClick={() => onRemove(match.id)}
              style={{ background: 'none', border: 'none', color: '#3A3530', fontSize: '16px', cursor: 'pointer', flexShrink: 0, padding: '0 0 0 8px' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}>×</button>
          </div>

          {match.styleDNA.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              {match.styleDNA.slice(0, 3).map(({ label, score }) => (
                <div key={label} style={{ minWidth: '110px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '10px', color: '#6A5A50' }}>{label}</span>
                    <span style={{ fontSize: '10px', color: '#C9A96E', fontFamily: '"JetBrains Mono", monospace' }}>{score}%</span>
                  </div>
                  <div style={{ height: '1px', background: '#1A1A1A' }}>
                    <div style={{ height: '100%', width: `${score}%`, background: '#C9A96E' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {match.matches.slice(0, 3).map((m, i) => (
              <Link key={m.vendor._id} href={`/artists/${m.vendor.slug}`}
                style={{ fontSize: '11px', color: '#5A5450', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
                onMouseLeave={e => (e.currentTarget.style.color = '#5A5450')}>
                <span style={{ color: '#2E2C2A', fontFamily: '"JetBrains Mono", monospace', fontSize: '9px' }}>0{i + 1}</span>
                {m.vendor.name}
              </Link>
            ))}
          </div>
          <p style={{ fontSize: '10px', color: '#2A2620' }}>Saved {formatDate(match.savedAt)}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function MyJourneyClient() {
  const [activeTab, setActiveTab] = useState<Tab>('artists');
  const [savedArtists, setSavedArtists] = useState<SavedArtist[]>([]);
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const a = localStorage.getItem('kc_saved_artists');
      const m = localStorage.getItem('kc_saved_matches');
      if (a) setSavedArtists(JSON.parse(a));
      if (m) setSavedMatches(JSON.parse(m));
    } catch {}
    setLoaded(true);
  }, []);

  const removeArtist = (id: string) => {
    const updated = savedArtists.filter(a => a._id !== id);
    setSavedArtists(updated);
    try { localStorage.setItem('kc_saved_artists', JSON.stringify(updated)); } catch {}
  };

  const removeMatch = (id: string) => {
    const updated = savedMatches.filter(m => m.id !== id);
    setSavedMatches(updated);
    try { localStorage.setItem('kc_saved_matches', JSON.stringify(updated)); } catch {}
  };

  const clearAll = () => {
    if (activeTab === 'artists') { setSavedArtists([]); try { localStorage.removeItem('kc_saved_artists'); } catch {} }
    else { setSavedMatches([]); try { localStorage.removeItem('kc_saved_matches'); } catch {} }
  };

  if (!loaded) return null;

  const count = activeTab === 'artists' ? savedArtists.length : savedMatches.length;

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid #1C1C1C' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', letterSpacing: '0.14em', color: '#F0EBE0', textDecoration: 'none' }}>KAJAL CARTEL</Link>
          <nav style={{ display: 'flex', gap: '24px' }}>
            <Link href="/discover" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#454140', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#454140')}>Discover</Link>
            <Link href="/auth" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A96E', textDecoration: 'none' }}>Sign In</Link>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 40px 96px' }}>
        <div style={{ marginBottom: '56px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#454140', marginBottom: '14px' }}>Your Planning</p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2.4rem, 5vw, 4rem)', color: '#F0EBE0', fontWeight: 400, marginBottom: '12px' }}>My Bridal Journey</h1>
          <p style={{ fontSize: '14px', color: '#5A5450', lineHeight: 1.7, maxWidth: '440px' }}>
            Keep track of the artists you love and revisit your style matches whenever you're ready.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px', borderBottom: '1px solid #141210', paddingBottom: '0' }}>
          <div style={{ display: 'flex', gap: '0' }}>
            {(['artists', 'matches'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#C9A96E' : 'transparent'}`, padding: '0 0 16px', marginRight: '32px', fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: activeTab === tab ? '#F0EBE0' : '#454140', cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s' }}>
                {tab === 'artists' ? 'Saved Artists' : 'Style Matches'}
                {(tab === 'artists' ? savedArtists : savedMatches).length > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#C9A96E', fontFamily: '"JetBrains Mono", monospace' }}>
                    {(tab === 'artists' ? savedArtists : savedMatches).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {count > 0 && (
            <button onClick={clearAll}
              style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3A3530', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}>
              Clear all
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'artists' ? (
            <motion.div key="artists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {savedArtists.length === 0 ? (
                <EmptyState tab="artists" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {savedArtists.map(a => <SavedArtistCard key={a._id} artist={a} onRemove={removeArtist} />)}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="matches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {savedMatches.length === 0 ? (
                <EmptyState tab="matches" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {savedMatches.map(m => <SavedMatchCard key={m.id} match={m} onRemove={removeMatch} />)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {count === 0 && (
          <div style={{ marginTop: '56px', padding: '28px', border: '1px solid #141210', background: '#0A0A0A' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#3A3530', marginBottom: '12px' }}>How to save</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {[
                { step: '01', title: 'Find your matches', body: "Upload a photo on the Discover page to get your personalised artist matches." },
                { step: '02', title: 'Save artists you love', body: "Click the save button on any artist profile to add them here." },
                { step: '03', title: 'Come back anytime', body: "Your saved artists and matches stay here so you can revisit them when you're ready." },
              ].map(s => (
                <div key={s.step}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: '1.6rem', color: '#2E2C2A', display: 'block', marginBottom: '8px' }}>{s.step}</span>
                  <p style={{ fontSize: '12px', color: '#4A4440', marginBottom: '5px' }}>{s.title}</p>
                  <p style={{ fontSize: '12px', color: '#2E2C2A', lineHeight: 1.6 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #141210', padding: '36px 40px', textAlign: 'center', background: '#080808' }}>
        <p style={{ fontSize: '9px', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#2A2620', margin: 0 }}>
          Kajal Cartel · New Delhi · Bridal Beauty
        </p>
      </footer>
    </div>
  );
}