'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { MatchResult } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const BADGE_CONFIG: Record<string, { background: string; color: string }> = {
  'The Cartel Core': { background: 'linear-gradient(135deg, #C9A96E 0%, #8B6A1A 100%)', color: '#080808' },
  'Vanguard Stylist': { background: 'linear-gradient(135deg, #D0D0D0 0%, #848484 100%)', color: '#080808' },
  'Heritage Master': { background: 'linear-gradient(135deg, #6B2E3A 0%, #3D1622 100%)', color: '#C9A96E' },
};

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatTag(t: string) {
  return t.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function matchLabel(score: number): { label: string; color: string } {
  if (score >= 0.9) return { label: 'Excellent Match', color: '#C9A96E' };
  if (score >= 0.75) return { label: 'Strong Match', color: '#A8906A' };
  if (score >= 0.60) return { label: 'Good Match', color: '#8A7456' };
  return { label: 'Match', color: '#6A5A46' };
}

interface VendorCardProps { match: MatchResult; rank: number; index: number; }

export function VendorCard({ match, rank, index }: VendorCardProps) {
  const { vendor, matchedTags, confidenceScore, matchRationale } = match;
  const badge = vendor.flags.badgeType ? BADGE_CONFIG[vendor.flags.badgeType] : null;
  const isTop = rank === 1;
  const { label: mLabel, color: mColor } = matchLabel(confidenceScore);
  const pct = Math.round(confidenceScore * 100);

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.13, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        background: '#0E0E0E', border: `1px solid ${isTop ? 'rgba(201,169,110,0.22)' : '#1C1C1C'}`,
        boxShadow: isTop ? '0 0 0 1px rgba(201,169,110,0.14), 0 20px 48px rgba(0,0,0,0.45)' : '0 6px 32px rgba(0,0,0,0.35)',
      }}>
      {isTop && <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, #C9A96E 30%, #C9A96E 70%, transparent)' }} />}

      <div style={{ position: 'relative', paddingBottom: '125%', overflow: 'hidden' }}>
        <img src={vendor.profileImageUrl} alt={`${vendor.name} — bridal artist, ${vendor.location.microLocation}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.65s ease' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,8,8,0.65) 0%, rgba(8,8,8,0.08) 55%, transparent 100%)' }} />

        {badge && (
          <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
            <span style={{ display: 'block', padding: '3px 9px', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, background: badge.background, color: badge.color }}>
              {vendor.flags.badgeType}
            </span>
          </div>
        )}

        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <span style={{ display: 'block', padding: '4px 10px', fontSize: '10px', color: mColor, background: 'rgba(8,8,8,0.75)', backdropFilter: 'blur(6px)', letterSpacing: '0.04em', fontFamily: '"JetBrains Mono", monospace' }}>
            {pct}%
          </span>
        </div>

        {isTop && (
          <div style={{ position: 'absolute', bottom: '10px', left: '14px' }}>
            <span style={{ fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#C9A96E' }}>Top Match</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4A4440' }}>{vendor.location.microLocation}</span>
          <span style={{ color: '#1E1C1A', fontSize: '10px' }}>·</span>
          <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: mColor }}>{mLabel}</span>
        </div>

        <Link href={`/artists/${vendor.slug}`} style={{ textDecoration: 'none' }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', color: '#F0EBE0', lineHeight: 1.2, marginBottom: '6px', fontWeight: 400 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}>
            {vendor.name}
          </h3>
        </Link>
        <p style={{ fontSize: '12px', color: '#5A5450', marginBottom: '16px', lineHeight: 1.55 }}>{vendor.tagline}</p>

        <div style={{ height: '1px', background: '#1A1A1A', marginBottom: '16px' }} />

        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '14px', fontStyle: 'italic', color: '#9A8A7A', lineHeight: 1.65, marginBottom: '16px', borderLeft: '2px solid #C9A96E', paddingLeft: '14px' }}>
          {matchRationale}
        </p>

        {matchedTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {matchedTags.slice(0, 3).map(tag => (
              <span key={tag} style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3A3530', border: '1px solid #1C1C1C', padding: '2px 8px' }}>
                {formatTag(tag)}
              </span>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ height: '1px', background: '#1A1A1A', marginBottom: '16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2E2A28', marginBottom: '3px' }}>From</p>
            <p style={{ fontSize: '13px', color: '#F0EBE0' }}>{formatINR(vendor.serviceSummary.priceRangeINR.min)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2E2A28', marginBottom: '3px' }}>Rating</p>
            <p style={{ fontSize: '13px' }}><span style={{ color: '#C9A96E' }}>★ </span><span style={{ color: '#F0EBE0' }}>{vendor.ratings.averageRating.toFixed(1)}</span><span style={{ fontSize: '11px', color: '#2E2A28' }}> ({vendor.ratings.totalReviews})</span></p>
          </div>
        </div>

        {vendor.serviceSummary.hasTrialOffering && (
          <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4A4440', marginBottom: '14px' }}>Trial sessions available</p>
        )}

        <Link href={`/artists/${vendor.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{ width: '100%', padding: '13px 0', textAlign: 'center', fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', border: '1px solid #2A2520', color: '#C9A96E', transition: 'background 0.2s, color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#C9A96E'; (e.currentTarget as HTMLDivElement).style.color = '#080808'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.color = '#C9A96E'; }}>
            View Artist
          </div>
        </Link>
      </div>
    </motion.article>
  );
}