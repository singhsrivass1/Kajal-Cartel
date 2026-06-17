'use client';

import { useState, useEffect, useCallback, useRef } from 'react';import { motion, AnimatePresence } from 'framer-motion';
import { MoodBoardWidget } from '@/components/discovery/MoodBoardWidget';
import { VendorGrid } from '@/components/discovery/VendorGrid';
import { RosterCard } from '@/components/discovery/RosterCard';
import type { ClientVendor, MatchResponse } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

/* ── HEADER ─────────────────────────────────────────────────── */
function Header({ onScrollToMatcher, onScrollToRoster }: { onScrollToMatcher: () => void; onScrollToRoster: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderBottom: scrolled ? '1px solid #1C1C1C' : '1px solid transparent', transition: 'border-color 0.3s',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: FONT_DISPLAY, fontSize: '17px', letterSpacing: '0.14em', color: '#F0EBE0', textDecoration: 'none' }}>KAJAL CARTEL</a>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <button onClick={onScrollToMatcher} style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#454140', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#454140')}>
            Find My Artist
          </button>
          <button onClick={onScrollToRoster} style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#454140', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#454140')}>
            Browse All
          </button>
          <button onClick={onScrollToMatcher} style={{ background: 'none', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', padding: '9px 18px', border: '1px solid #2D2418', color: '#C9A96E', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#C9A96E'; (e.currentTarget as HTMLButtonElement).style.color = '#080808'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#C9A96E'; }}>
            Style Matching
          </button>
        </nav>
      </div>
    </header>
  );
}

/* ── BROWSE SECTION ──────────────────────────────────────────── */
function BrowseSection({ vendors, matchData }: { vendors: ClientVendor[]; matchData: MatchResponse | null }) {
  return (
    <AnimatePresence mode="wait">
      {matchData ? (
        <motion.div key="with-match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }} style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginBottom: '36px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '8px' }}>
                Your Matches · {matchData.matches.length} Artists
              </p>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#F0EBE0', fontWeight: 400 }}>
                {matchData.matches.length === 1 ? 'Your best match' : 'Your best matches'}
              </h2>
            </motion.div>
            <VendorGrid matches={matchData.matches} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, #1A1A1A)' }} />
              <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2E2A28', flexShrink: 0 }}>All Artists</p>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(270deg, transparent, #1A1A1A)' }} />
            </div>
            <div style={{ opacity: 0.45, transition: 'opacity 0.3s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                {vendors.map((v, i) => <RosterCard key={v._id} vendor={v} index={i} />)}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginBottom: '36px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#454140', marginBottom: '8px' }}>
              {vendors.length} Artists · New Delhi
            </p>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#F0EBE0', fontWeight: 400, marginBottom: '10px' }}>All our artists</h2>
            <p style={{ fontSize: '13px', color: '#454140', maxWidth: '480px', lineHeight: 1.7 }}>
              Upload a photo above to find your best matches, or browse the full roster below.
            </p>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {vendors.map((v, i) => <RosterCard key={v._id} vendor={v} index={i} />)}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── PAGE CLIENT ─────────────────────────────────────────────── */
interface DiscoverPageClientProps { vendors: ClientVendor[]; }

export function DiscoverPageClient({ vendors }: DiscoverPageClientProps) {
  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleMatchSuccess = useCallback((data: MatchResponse) => {
    setMatchData(data);
    setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 420);
  }, []);

  const scrollToWidget = useCallback(() => { widgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);
  const scrollToRoster = useCallback(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <Header onScrollToMatcher={scrollToWidget} onScrollToRoster={scrollToRoster} />

      <section style={{ paddingTop: '120px', paddingBottom: '72px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: '44px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.36em', textTransform: 'uppercase', color: '#454140', marginBottom: '16px' }}>
              Style Matching · New Delhi
            </p>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(3rem, 8vw, 7rem)', color: '#F0EBE0', lineHeight: 0.95, marginBottom: '20px', fontWeight: 400 }}>
              Find Your<br />Artist.
            </h1>
            <p style={{ fontSize: '14px', color: '#454140', maxWidth: '380px', lineHeight: 1.7 }}>
              Upload a photo of any look you love. We'll show you which of our artists would be the best fit for your style.
            </p>
          </motion.div>

          <motion.div ref={widgetRef} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
            <MoodBoardWidget onMatchSuccess={handleMatchSuccess} />
          </motion.div>
        </div>
      </section>

      <div style={{ height: '1px', maxWidth: '1280px', margin: '0 auto', background: 'linear-gradient(90deg, transparent, #1C1C1C 20%, #1C1C1C 80%, transparent)' }} />

      <section id="roster" ref={resultsRef} style={{ paddingBottom: '96px', paddingTop: '64px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px' }}>
          <BrowseSection vendors={vendors} matchData={matchData} />
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #141210', padding: '36px 40px', textAlign: 'center', background: '#080808' }}>
        <p style={{ fontSize: '9px', letterSpacing: '0.36em', textTransform: 'uppercase', color: '#2A2620', margin: 0 }}>
          Kajal Cartel · New Delhi · Bridal Beauty
        </p>
      </footer>
    </div>
  );
}