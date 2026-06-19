'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookingBuilder } from '@/components/booking/BookingBuilder';
import type { ArtistProfile, ClientService } from '@/types/artist';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const BADGE_CONFIG: Record<string, { background: string; color: string }> = {
  'The Cartel Core': { background: 'linear-gradient(135deg, #C9A96E 0%, #8B6A1A 100%)', color: '#080808' },
  'Vanguard Stylist': { background: 'linear-gradient(135deg, #D0D0D0 0%, #848484 100%)', color: '#080808' },
  'Heritage Master': { background: 'linear-gradient(135deg, #6B2E3A 0%, #3D1622 100%)', color: '#C9A96E' },
};


const ARCHETYPE_LABEL: Record<string, string> = {
  'sabyasachi-minimalist': 'Minimal, understated bridal looks',
  'raw-mango-organic': 'Natural, handloom-inspired styles',
  'south-delhi-chic': 'Clean, refined finishes',
  'heavy-royal-mughlai': 'Rich Mughal-inspired traditional looks',
  'old-delhi-heritage': 'Classic Old Delhi bridal styles',
  'punjabi-grandeur': 'Vibrant, celebratory Punjabi looks',
  'manish-malhotra-shimmer': 'Glamorous Bollywood-inspired styles',
  'dark-romanticism': 'Dramatic, moody evening looks',
  'contemporary-editorial': 'Fashion-forward editorial styles',
  'glass-skin-glam': 'Dewy, photography-perfect skin',
  'indo-western-fusion': 'Modern fusion bridal looks',
  'pastel-dreamscape': 'Soft romantic pastel looks',
};

const OCCASION_LABEL: Record<string, string> = {
  'wedding-day-bridal': 'Wedding ceremony',
  'sangeet-night-glam': 'Sangeet and evening events',
  'mehendi-ceremony': 'Mehendi',
  'haldi-ceremony': 'Haldi',
  'baraat-reception': 'Reception',
  'cocktail-pre-wedding': 'Engagement and cocktail events',
  'pre-wedding-shoot': 'Pre-wedding photo shoots',
};

const CONTRA_LABEL: Record<string, string> = {
  'no-airbrush': 'Does not use airbrush',
  'no-at-home-service': 'Studio appointments only — does not travel to homes',
  'no-synthetic-extensions': 'Does not use synthetic hair extensions',
  'no-heavy-contouring': 'Does not offer heavy contouring',
};

const TRAVEL_LABEL: Record<string, string> = {
  'studio-only': 'Studio only',
  'home-visits': 'Studio and home visits',
  'venue-visits': 'Studio and venue visits',
  'all': 'Studio, home and venue visits',
};

const PORTFOLIO_ASPECTS = ['padding-bottom: 133%', 'padding-bottom: 125%', 'padding-bottom: 100%', 'padding-bottom: 125%', 'padding-bottom: 133%'];


function SiteHeader({ artist }: { artist: ArtistProfile }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 56);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: scrolled ? '1px solid #1C1C1C' : '1px solid transparent', transition: 'border-color 0.3s' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/discover" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L5 8L10 4" stroke="#C9A96E" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#454140' }}>All Artists</span>
        </Link>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: '13px', color: '#3A3530' }}>{artist.name}</span>
        {artist.contact.instagram ? (
          <a href={artist.contact.instagram} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#454140', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')} onMouseLeave={e => (e.currentTarget.style.color = '#454140')}>
            Instagram ↗
          </a>
        ) : <div style={{ width: '80px' }} />}
      </div>
    </header>
  );
}


function HeroSection({ artist }: { artist: ArtistProfile }) {
  const badge = artist.flags.badgeType ? BADGE_CONFIG[artist.flags.badgeType] : null;
  return (
    <section style={{ position: 'relative', overflow: 'hidden', height: '78vh', maxHeight: '820px', background: '#080808' }}>
      <img src={artist.profileImageUrl} alt={`${artist.name} — bridal artist, ${artist.location.microLocation}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080808 0%, rgba(8,8,8,0.5) 45%, rgba(8,8,8,0.12) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(8,8,8,0.3) 0%, transparent 55%)' }} />

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          {badge && (
            <span style={{ display: 'inline-block', padding: '3px 10px', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, background: badge.background, color: badge.color, marginBottom: '16px' }}>
              {artist.flags.badgeType}
            </span>
          )}
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(3rem, 7vw, 6rem)', color: '#F0EBE0', lineHeight: 0.95, marginBottom: '14px', fontWeight: 400 }}>{artist.name}</h1>
          <p style={{ fontSize: '14px', color: '#7A706A', marginBottom: '18px', maxWidth: '440px', lineHeight: 1.6 }}>{artist.tagline}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4A4440' }}>{artist.location.microLocation}</span>
            <span style={{ color: '#1E1A18', fontSize: '12px' }}>·</span>
            <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9A96E' }}>{artist.pricing.tier.replace(/-/g, ' ')}</span>
            <span style={{ color: '#1E1A18', fontSize: '12px' }}>·</span>
            <span style={{ fontSize: '10px', color: '#4A4440' }}>★ {artist.ratings.averageRating.toFixed(1)} <span style={{ color: '#2A2520' }}>({artist.ratings.totalReviews} reviews)</span></span>
            {artist.flags.isVerified && <><span style={{ color: '#1E1A18' }}>·</span><span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A8A5A' }}>✓ Verified</span></>}
          </div>
        </motion.div>
      </div>
    </section>
  );
}


function Divider() {
  return <div style={{ height: '1px', background: '#141210', margin: '32px 0' }} />;
}


function AboutSection({ artist }: { artist: ArtistProfile }) {
  const ap = artist.aestheticProfile;
  const bestFor = [
    ...ap.styleArchetypes.slice(0, 2).map(t => ARCHETYPE_LABEL[t]).filter(Boolean),
    ...ap.occasionSpecializations.slice(0, 3).map(t => OCCASION_LABEL[t]).filter(Boolean),
  ];
  const notFor = ap.contraIndicators?.map(t => CONTRA_LABEL[t]).filter(Boolean) ?? [];

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#454140', marginBottom: '20px' }}>About</p>
      {artist.bio && (
        <p style={{ fontSize: '14px', color: '#5A5450', lineHeight: 1.8, marginBottom: '20px', maxWidth: '560px' }}>{artist.bio}</p>
      )}
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', fontStyle: 'italic', color: '#B0A090', lineHeight: 1.7, marginBottom: '28px', maxWidth: '580px' }}>
        {ap.aestheticBio}
      </p>

      {ap.signatureElements && (
        <div style={{ borderLeft: '2px solid #C9A96E', paddingLeft: '20px', marginBottom: '28px' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', fontStyle: 'italic', color: '#6A5E54', lineHeight: 1.7 }}>{ap.signatureElements}</p>
        </div>
      )}

      <Divider />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
        {bestFor.length > 0 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#454140', marginBottom: '14px' }}>Best for</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bestFor.map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#C8B9A8', lineHeight: 1.5 }}>
                  <span style={{ color: '#5A8A5A', flexShrink: 0, marginTop: '1px' }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {notFor.length > 0 && (
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#454140', marginBottom: '14px' }}>Not ideal for</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notFor.map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#6A5A50', lineHeight: 1.5 }}>
                  <span style={{ color: '#8A5A4A', flexShrink: 0, marginTop: '1px' }}>✗</span> {item}
                </li>
              ))}
            </ul>
            {ap.contraIndicatorsNotes && (
              <p style={{ fontSize: '11px', color: '#3A3530', marginTop: '12px', lineHeight: 1.6 }}>{ap.contraIndicatorsNotes}</p>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}


function PortfolioSection({ portfolio }: { portfolio: ArtistProfile['portfolio'] }) {
  if (!portfolio.length) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#454140', marginBottom: '20px' }}>Portfolio</p>
      <div style={{ columns: 2, columnGap: '10px' }}>
        {portfolio.map((item, i) => (
          <div key={item._id} style={{ breakInside: 'avoid', marginBottom: '10px' }}>
            <div style={{ position: 'relative', overflow: 'hidden', [PORTFOLIO_ASPECTS[i % PORTFOLIO_ASPECTS.length].split(':')[0]]: PORTFOLIO_ASPECTS[i % PORTFOLIO_ASPECTS.length].split(':')[1].trim() } as any}>
              <div style={{ paddingBottom: ['133%', '125%', '100%', '125%', '133%'][i % 5], position: 'relative', overflow: 'hidden' }}>
                <img src={item.imageUrl} alt={item.altText}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
                {item.isHeroImage && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <span style={{ fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', background: 'rgba(8,8,8,0.75)', backdropFilter: 'blur(4px)', color: '#C9A96E' }}>Featured</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}


function DetailsSection({ artist }: { artist: ArtistProfile }) {
  const bm = artist.businessMeta;
  const items = [
    { label: 'Experience', value: `${bm.yearsOfExperience} years` },
    { label: 'Team', value: `${bm.teamSize} ${bm.teamSize === 1 ? 'artist' : 'artists'}` },
    { label: 'Languages', value: bm.languagesSpoken.join(', ') },
    { label: 'Advance Notice', value: `${bm.bookingLeadTimeDays} days` },
    { label: 'Service Area', value: TRAVEL_LABEL[artist.location.travelPolicy] ?? artist.location.travelPolicy },
    { label: 'Trial Sessions', value: bm.trialsOffered ? `Available (${bm.trialDurationMinutes} min)` : 'Not offered' },
  ];

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
      <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#454140', marginBottom: '20px' }}>Details</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {items.map(it => (
          <div key={it.label} style={{ border: '1px solid #141210', padding: '14px 16px' }}>
            <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2E2C2A', marginBottom: '5px' }}>{it.label}</p>
            <p style={{ fontSize: '13px', color: '#C8B9A8' }}>{it.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {artist.contact.instagram && (
          <a href={artist.contact.instagram} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1E1A18', padding: '10px 18px', color: '#4A4440', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')} onMouseLeave={e => (e.currentTarget.style.color = '#4A4440')}>
            View Instagram ↗
          </a>
        )}
        {artist.contact.website && (
          <a href={artist.contact.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1E1A18', padding: '10px 18px', color: '#4A4440', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')} onMouseLeave={e => (e.currentTarget.style.color = '#4A4440')}>
            Website ↗
          </a>
        )}
      </div>
    </motion.section>
  );
}


interface ArtistPageClientProps { artist: ArtistProfile; services: ClientService[]; }

export function ArtistPageClient({ artist, services }: ArtistPageClientProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <SiteHeader artist={artist} />
      <HeroSection artist={artist} />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 40px 96px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '64px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
            <AboutSection artist={artist} />
            <PortfolioSection portfolio={artist.portfolio} />
            <DetailsSection artist={artist} />
          </div>

          <div style={{ position: 'sticky', top: '88px' }}>
            <BookingBuilder artist={artist} services={services} />
          </div>
        </div>
      </main>

      <footer style={{ borderTop: '1px solid #141210', padding: '36px 40px', textAlign: 'center', background: '#080808' }}>
        <p style={{ fontSize: '9px', letterSpacing: '0.36em', textTransform: 'uppercase', color: '#2A2620', margin: 0 }}>
          Kajal Cartel · New Delhi · Bridal Beauty
        </p>
      </footer>
    </div>
  );
}