'use client';

import {
  useState, useRef, useEffect, useCallback,
  type DragEvent, type ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VendorGrid } from './VendorGrid';
import type { MatchResponse, ImageProfile } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const PROCESSING_STEPS = [
  'Reading your image',
  'Comparing against our artists',
  'Preparing your matches',
] as const;

type WidgetState = 'idle' | 'processing' | 'success' | 'error';

/* ── Style DNA computation ─────────────────────────────────── */
interface DNADimension { label: string; score: number; }

const ARCHETYPE_DIM: Record<string, string> = {
  'sabyasachi-minimalist': 'Quiet Luxury',
  'raw-mango-organic': 'Quiet Luxury',
  'south-delhi-chic': 'Quiet Luxury',
  'heavy-royal-mughlai': 'Heritage Indian',
  'old-delhi-heritage': 'Heritage Indian',
  'punjabi-grandeur': 'Celebratory Glam',
  'manish-malhotra-shimmer': 'Bollywood Glam',
  'dark-romanticism': 'Moody Romance',
  'contemporary-editorial': 'Fashion Forward',
  'glass-skin-glam': 'Natural Glow',
  'indo-western-fusion': 'Modern Classic',
  'pastel-dreamscape': 'Soft Romance',
};

const FINISH_DIM: Record<string, string> = {
  'dewy-glass-skin': 'Natural Glow',
  'no-makeup-makeup': 'Quiet Luxury',
  'satin-glow': 'Quiet Luxury',
  'matte-velvet': 'Heritage Indian',
  'smoky-kohl-eye': 'Heritage Indian',
  'airbrush-finish': 'Celebratory Glam',
  'dramatic-cut-crease': 'Bollywood Glam',
  'glitter-foil-statement': 'Celebratory Glam',
  'hd-matte-flash': 'Fashion Forward',
};

const PALETTE_DIM: Record<string, string> = {
  'ivory-and-gold-neutral': 'Quiet Luxury',
  'champagne-and-blush-soft': 'Soft Romance',
  'earth-and-terracotta-organic': 'Quiet Luxury',
  'jewel-tone-maximalist': 'Heritage Indian',
  'saffron-and-vermillion-traditional': 'Heritage Indian',
  'deep-burgundy-and-plum-moody': 'Moody Romance',
  'monochrome-editorial': 'Fashion Forward',
  'pastel-multicolor': 'Soft Romance',
};

function computeStyleDNA(profile: ImageProfile): DNADimension[] {
  const scores: Record<string, number> = {};
  profile.styleArchetypes.forEach(t => { const d = ARCHETYPE_DIM[t]; if (d) scores[d] = (scores[d] || 0) + 40; });
  profile.makeupFinishTags.forEach(t => { const d = FINISH_DIM[t]; if (d) scores[d] = (scores[d] || 0) + 20; });
  profile.colorPaletteAffinity.forEach(t => { const d = PALETTE_DIM[t]; if (d) scores[d] = (scores[d] || 0) + 15; });
  const maxScore = Math.max(...Object.values(scores), 1);
  return Object.entries(scores)
    .map(([label, s]) => ({ label, score: Math.round((s / maxScore) * 100) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

/* ── Step indicator ────────────────────────────────────────── */
function StepItem({ label, status, index }: { label: string; status: 'done' | 'active' | 'pending'; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: index * 0.14 }}
      style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '12px', height: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {status === 'done' && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#C9A96E' }} />
        )}
        {status === 'active' && (
          <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
            style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #C9A96E' }} />
        )}
        {status === 'pending' && (
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #2D2520' }} />
        )}
      </div>
      <span style={{
        fontFamily: status === 'active' ? FONT_DISPLAY : undefined,
        fontSize: status === 'active' ? '15px' : '13px',
        fontStyle: status === 'active' ? 'italic' : 'normal',
        color: status === 'active' ? '#F0EBE0' : status === 'done' ? '#5A5450' : '#2D2520',
      }}>{label}</span>
    </motion.div>
  );
}

/* ── IDLE VIEW ─────────────────────────────────────────────── */
function IdleView({ isDragOver, onDragOver, onDragEnter, onDragLeave, onDrop, onClick, fileInputRef, onFileChange, error }: {
  isDragOver: boolean; onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void; onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onClick: () => void; fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void; error: string | null;
}) {
  return (
    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
      <div
        onClick={onClick} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop}
        style={{
          position: 'relative', cursor: 'pointer', userSelect: 'none',
          border: `1px solid ${isDragOver ? '#C9A96E' : '#1C1C1C'}`,
          background: isDragOver ? 'rgba(201,169,110,0.04)' : 'radial-gradient(ellipse at 50% 60%, #0E0C09 0%, #080808 100%)',
          transition: 'border-color 0.3s, background 0.3s, box-shadow 0.3s',
          boxShadow: isDragOver ? '0 0 60px rgba(201,169,110,0.1), inset 0 0 40px rgba(201,169,110,0.03)' : 'none',
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center' }}>
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} style={{ marginBottom: '36px' }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="0.5" y="0.5" width="35" height="35" stroke="#2D2418" />
              <path d="M18 26V10M18 10L11 17M18 10L25 17" stroke="#C9A96E" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>

          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: '#F0EBE0', marginBottom: '14px', fontWeight: 400 }}>
            Show us what inspires you
          </h2>
          <p style={{ fontSize: '14px', color: '#5A5450', maxWidth: '380px', lineHeight: 1.7, marginBottom: '6px' }}>
            Upload any photo that captures the look you love, maybe a celebrity wedding, a Pinterest save, or a magazine cut-out.
          </p>
          <p style={{ fontSize: '11px', color: '#2D2520', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '28px' }}>
            JPG · PNG · WEBP · Max 10MB
          </p>

          {error && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '20px', fontSize: '13px', color: 'rgba(220,80,80,0.8)' }}>
              {error}
            </motion.p>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={ALLOWED_TYPES.join(',')} style={{ display: 'none' }} onChange={onFileChange} />
      </div>
    </motion.div>
  );
}

/* ── PROCESSING VIEW ───────────────────────────────────────── */
function ProcessingView({ previewUrl, step }: { previewUrl: string | null; step: number }) {
  const progressPct = ((step + 1) / PROCESSING_STEPS.length) * 100;
  return (
    <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <div style={{ border: '1px solid #1C1C1C', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr' }}>
          <div style={{ position: 'relative', background: '#080808', minHeight: '320px' }}>
            {previewUrl && (
              <img src={previewUrl} alt="Your upload" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55, display: 'block' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(8,8,8,0.45))' }} />
            <motion.div
              animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, #C9A96E 30%, #C9A96E 70%, transparent 100%)', boxShadow: '0 0 20px 4px rgba(201,169,110,0.3)', pointerEvents: 'none' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 36px', background: '#0A0A0A', borderLeft: '1px solid #1C1C1C' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#3A3530', marginBottom: '36px' }}>Finding your matches</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '40px' }}>
              {PROCESSING_STEPS.map((s, i) => (
                <StepItem key={s} label={s} status={i < step ? 'done' : i === step ? 'active' : 'pending'} index={i} />
              ))}
            </div>
            <div>
              <div style={{ height: '1px', background: '#1A1A1A', position: 'relative', overflow: 'hidden' }}>
                <motion.div animate={{ width: `${progressPct}%` }} transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: '#C9A96E' }} />
              </div>
              <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3A3530', marginTop: '10px' }}>
                Step {step + 1} of {PROCESSING_STEPS.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── COMPACT SUCCESS VIEW (used when page owns the results) ── */
function CompactSuccessView({ matchData, previewUrl, onReset }: { matchData: MatchResponse; previewUrl: string | null; onReset: () => void }) {
  const { imageProfile } = matchData;
  const dna = computeStyleDNA(imageProfile);

  return (
    <motion.div key="compact-success" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
      <div style={{ border: '1px solid #1C1C1C', overflow: 'hidden', background: '#0A0A0A' }}>
        <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? '120px 1fr auto' : '1fr auto', alignItems: 'stretch' }}>
          {previewUrl && (
            <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100px' }}>
              <img src={previewUrl} alt="Your upload" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.75 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent, rgba(10,10,10,0.9))' }} />
            </div>
          )}

          <div style={{ padding: '24px 28px', borderLeft: previewUrl ? '1px solid #161412' : 'none' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '12px' }}>Your Style</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '15px', fontStyle: 'italic', color: '#B0A090', lineHeight: 1.6, marginBottom: '16px', maxWidth: '600px' }}>
              {imageProfile.visualNarrative}
            </p>
            {dna.length > 0 && (
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {dna.slice(0, 3).map(({ label, score }) => (
                  <div key={label} style={{ minWidth: '120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#7A6A5A' }}>{label}</span>
                      <span style={{ fontSize: '10px', color: '#C9A96E', fontFamily: '"JetBrains Mono", monospace' }}>{score}%</span>
                    </div>
                    <div style={{ height: '1px', background: '#1A1A1A' }}>
                      <div style={{ height: '100%', width: `${score}%`, background: '#C9A96E' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 24px', borderLeft: '1px solid #161412', minWidth: '120px' }}>
            <button onClick={onReset} style={{ background: 'none', border: 'none', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3A3530', cursor: 'pointer', padding: 0, textAlign: 'right' }}>← Reset</button>
            <motion.p animate={{ y: [0, 4, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A96E', margin: 0 }}>
              ↓ Matches below
            </motion.p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── FULL SUCCESS VIEW (standalone use) ─────────────────────── */
function FullSuccessView({ matchData, previewUrl, onReset }: { matchData: MatchResponse; previewUrl: string | null; onReset: () => void }) {
  const { imageProfile, matches } = matchData;
  const dna = computeStyleDNA(imageProfile);

  return (
    <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ border: '1px solid #1C1C1C', overflow: 'hidden', background: '#0A0A0A' }}>
        <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? '1fr 3fr' : '1fr' }}>
          {previewUrl && (
            <div style={{ position: 'relative', overflow: 'hidden', minHeight: '200px' }}>
              <img src={previewUrl} alt="Your upload" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          <div style={{ padding: '36px 40px', borderLeft: previewUrl ? '1px solid #1C1C1C' : 'none' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '16px' }}>Your Style Profile</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', fontStyle: 'italic', color: '#B8A89A', lineHeight: 1.7, marginBottom: '24px', maxWidth: '560px' }}>
              {imageProfile.visualNarrative}
            </p>

            {dna.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
                <p style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3A3530', marginBottom: '4px' }}>Style Breakdown</p>
                {dna.map(({ label, score }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: '#C8B9A8' }}>{label}</span>
                      <span style={{ fontSize: '11px', color: '#5A5450', fontFamily: '"JetBrains Mono", monospace' }}>{score}%</span>
                    </div>
                    <div style={{ height: '2px', background: '#1A1A1A', borderRadius: '1px' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{ height: '100%', background: 'linear-gradient(90deg, #C9A96E, #8B6A1A)', borderRadius: '1px' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}>
        <VendorGrid matches={matches} />
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ textAlign: 'center', paddingTop: '8px' }}>
        <button onClick={onReset} style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#4A4440', cursor: 'pointer', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#C9A96E')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4A4440')}>
          ← Try a different photo
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ── WIDGET SHELL ──────────────────────────────────────────── */
interface MoodBoardWidgetProps {
  onMatchSuccess?: (data: MatchResponse) => void;
}

export function MoodBoardWidget({ onMatchSuccess }: MoodBoardWidgetProps) {
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (widgetState !== 'processing') return;
    setProcessingStep(0);
    const interval = setInterval(() => {
      setProcessingStep(prev => { if (prev >= PROCESSING_STEPS.length - 1) { clearInterval(interval); return prev; } return prev + 1; });
    }, 2400);
    return () => clearInterval(interval);
  }, [widgetState]);

  useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) { setError('Please upload a JPG, PNG or WEBP image.'); return; }
    if (file.size > MAX_BYTES) { setError('Image must be under 10MB.'); return; }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setWidgetState('processing');

    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });

      const data: MatchResponse = await response.json();
      if (!response.ok) throw new Error((data as any).error ?? 'Something went wrong. Please try again.');

      setMatchData(data);
      setWidgetState('success');
      onMatchSuccess?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setWidgetState('error');
    }
  }, [onMatchSuccess]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = useCallback(() => setIsDragOver(true), []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }, [handleFile]);
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }, [handleFile]);
  const handleReset = useCallback(() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setWidgetState('idle'); setPreviewUrl(null); setMatchData(null); setError(null); setProcessingStep(0); }, [previewUrl]);

  return (
    <section style={{ width: '100%', background: '#080808' }}>
      <AnimatePresence mode="wait">
        {(widgetState === 'idle' || widgetState === 'error') && (
          <IdleView key="idle" isDragOver={isDragOver} onDragOver={handleDragOver} onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef} onFileChange={handleFileChange} error={error} />
        )}
        {widgetState === 'processing' && <ProcessingView key="processing" previewUrl={previewUrl} step={processingStep} />}
        {widgetState === 'success' && matchData && onMatchSuccess && (
          <CompactSuccessView key="success" matchData={matchData} previewUrl={previewUrl} onReset={handleReset} />
        )}
        {widgetState === 'success' && matchData && !onMatchSuccess && (
          <FullSuccessView key="success" matchData={matchData} previewUrl={previewUrl} onReset={handleReset} />
        )}
      </AnimatePresence>
    </section>
  );
}