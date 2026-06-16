'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { ClientVendor } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const BADGE_CONFIG: Record<string, { background: string; color: string }> = {
  'The Cartel Core': { background: 'linear-gradient(135deg, #C9A96E 0%, #8B6A1A 100%)', color: '#080808' },
  'Vanguard Stylist': { background: 'linear-gradient(135deg, #D0D0D0 0%, #848484 100%)', color: '#080808' },
  'Heritage Master': { background: 'linear-gradient(135deg, #6B2E3A 0%, #3D1622 100%)', color: '#C9A96E' },
};

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

interface RosterCardProps { vendor: ClientVendor; index: number; }

export function RosterCard({ vendor, index }: RosterCardProps) {
  const badge = vendor.flags.badgeType ? BADGE_CONFIG[vendor.flags.badgeType] : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      <div style={{ position: 'relative', paddingBottom: '125%', overflow: 'hidden', flexShrink: 0 }}>
        <img src={vendor.profileImageUrl} alt={`${vendor.name} — ${vendor.location.microLocation}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.6s ease' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,8,8,0.6) 0%, transparent 55%)' }} />

        {badge && (
          <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
            <span style={{ display: 'block', padding: '2px 8px', fontSize: '8px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, background: badge.background, color: badge.color }}>
              {vendor.flags.badgeType}
            </span>
          </div>
        )}

        {vendor.flags.isFeatured && !badge && (
          <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
            <span style={{ display: 'block', padding: '2px 8px', fontSize: '8px', letterSpacing: '0.14em', textTransform: 'uppercase', border: '1px solid rgba(201,169,110,0.3)', color: '#C9A96E' }}>
              Featured
            </span>
          </div>
        )}

        {vendor.flags.isVerified && (
          <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
            <span style={{ display: 'block', padding: '2px 7px', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(8,8,8,0.72)', color: '#5A8A5A', backdropFilter: 'blur(4px)' }}>✓</span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3A3530' }}>{vendor.location.microLocation}</span>
          <span style={{ color: '#1E1C1A', fontSize: '10px' }}>·</span>
          <span style={{ fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C9A96E' }}>{vendor.pricing.tier.replace(/-/g, ' ')}</span>
        </div>

        <Link href={`/artists/${vendor.slug}`} style={{ textDecoration: 'none' }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', lineHeight: 1.25, marginBottom: '6px', fontWeight: 400, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}>
            {vendor.name}
          </h3>
        </Link>

        <p style={{ fontSize: '11px', color: '#454140', lineHeight: 1.55, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {vendor.tagline}
        </p>

        <div style={{ flex: 1 }} />
        <div style={{ height: '1px', background: '#161412', marginBottom: '12px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <p style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2A2826', marginBottom: '3px' }}>From</p>
            <p style={{ fontSize: '12px', color: '#F0EBE0' }}>{formatINR(vendor.serviceSummary.priceRangeINR.min)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2A2826', marginBottom: '3px' }}>Rating</p>
            <p style={{ fontSize: '12px' }}><span style={{ color: '#C9A96E' }}>★ </span><span style={{ color: '#F0EBE0' }}>{vendor.ratings.averageRating.toFixed(1)}</span></p>
          </div>
        </div>

        <Link href={`/artists/${vendor.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{ width: '100%', padding: '10px 0', textAlign: 'center', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1E1C1A', color: '#3A3530', transition: 'color 0.2s, border-color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#C9A96E'; (e.currentTarget as HTMLDivElement).style.borderColor = '#2D2418'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#3A3530'; (e.currentTarget as HTMLDivElement).style.borderColor = '#1E1C1A'; }}>
            View Artist
          </div>
        </Link>
      </div>
    </motion.article>
  );
}