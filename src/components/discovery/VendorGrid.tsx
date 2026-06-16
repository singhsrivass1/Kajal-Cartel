'use client';

import { motion } from 'framer-motion';
import { VendorCard } from './VendorCard';
import type { MatchResult } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

interface VendorGridProps { matches: MatchResult[]; }

export function VendorGrid({ matches }: VendorGridProps) {
  if (!matches.length) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}
        style={{ border: '1px solid #1C1C1C', padding: '64px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: '#5A5450', marginBottom: '10px' }}>
          We couldn't find a close match for this image.
        </p>
        <p style={{ fontSize: '13px', color: '#3A3530' }}>Try uploading a different photo with stronger style signals.</p>
      </motion.div>
    );
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#454140', marginBottom: '6px' }}>Your Matches</p>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', color: '#F0EBE0', fontWeight: 400 }}>
            {matches.length === 1 ? '1 artist selected for your style' : `${matches.length} artists selected for your style`}
          </h2>
        </div>
        <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2E2A28' }}>Ranked by fit</p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {matches.map((match, index) => (
          <VendorCard key={match.vendor._id} match={match} rank={index + 1} index={index} />
        ))}
      </div>
    </div>
  );
}