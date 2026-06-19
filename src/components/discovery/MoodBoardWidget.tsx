'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VendorGrid } from './VendorGrid';
import type { MatchResponse, StyleDNAEntry } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
const FONT_MONO = '"JetBrains Mono", "Courier New", monospace';
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const LUXURY_ERROR =
  'The Kajal Cartel AI is currently styling an unprecedented number of brides. Please try your upload again in a few moments.';

const PROCESSING_STEPS = [
  'Reading skin architecture',
  'Analysing eye construction',
  'Mapping colour theory',
  'Matching to our artists',
] as const;

type WidgetState = 'idle' | 'processing' | 'success' | 'error';


function StepItem({
  label,
  status,
  index,
}: {
  label: string;
  status: 'done' | 'active' | 'pending';
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
    >
      <div style={{ width: '10px', height: '10px', flexShrink: 0 }}>
        {status === 'done' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#C9A96E' }}
          />
        )}
        {status === 'active' && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #C9A96E' }}
          />
        )}
        {status === 'pending' && (
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #252220' }} />
        )}
      </div>
      <span
        style={{
          fontFamily: status === 'active' ? FONT_DISPLAY : undefined,
          fontStyle: status === 'active' ? 'italic' : 'normal',
          fontSize: status === 'active' ? '15px' : '12px',
          color: status === 'active' ? '#F0EBE0' : status === 'done' ? '#4A4440' : '#252220',
          transition: 'color 0.3s, font-size 0.3s',
        }}
      >
        {label}
      </span>
    </motion.div>
  );
}


function StyleDNABars({ dna, animate: doAnimate }: { dna: StyleDNAEntry[]; animate: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {dna.map(({ label, score }, i) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '11px', color: '#C8B9A8' }}>{label}</span>
            <span style={{ fontSize: '10px', color: '#C9A96E', fontFamily: FONT_MONO }}>{score}%</span>
          </div>
          <div style={{ height: '2px', background: '#1A1A1A', borderRadius: '1px', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={doAnimate ? { width: `${score}%` } : { width: `${score}%` }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #C9A96E, #8B6A1A)', borderRadius: '1px' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


function IdleView({
  isDragOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onClick,
  fileInputRef,
  onFileChange,
  error,
}: {
  isDragOver: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
}) {
  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35 }}
    >
      <div
        onClick={onClick}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          border: `1px solid ${isDragOver ? '#C9A96E' : '#1C1C1C'}`,
          background: isDragOver
            ? 'rgba(201,169,110,0.04)'
            : 'radial-gradient(ellipse at 50% 65%, #0E0C09 0%, #080808 100%)',
          boxShadow: isDragOver
            ? '0 0 56px rgba(201,169,110,0.09), inset 0 0 40px rgba(201,169,110,0.03)'
            : 'none',
          transition: 'border-color 0.3s, background 0.3s, box-shadow 0.3s',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 32px',
            textAlign: 'center',
          }}
        >
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ marginBottom: '36px' }}
          >
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <rect x="0.5" y="0.5" width="33" height="33" stroke="#2D2418" />
              <path
                d="M17 25V9M17 9L10 16M17 9L24 16"
                stroke="#C9A96E"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 'clamp(1.7rem, 4vw, 2.8rem)',
              color: '#F0EBE0',
              marginBottom: '12px',
              fontWeight: 400,
            }}
          >
            Show us what inspires you
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#5A5450',
              maxWidth: '360px',
              lineHeight: 1.7,
              marginBottom: '6px',
            }}
          >
            Upload any picture that captures the look you love, whether a celebrity wedding, a Pinterest
            save, or a magazine cut-out.
          </p>
          <p
            style={{
              fontSize: '10px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: '#252220',
              marginTop: '28px',
            }}
          >
            JPG · PNG · WEBP · Max 10MB
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: '24px',
                padding: '14px 20px',
                border: '1px solid rgba(180,60,60,0.2)',
                background: 'rgba(180,60,60,0.05)',
                maxWidth: '400px',
              }}
            >
              <p style={{ fontSize: '13px', color: 'rgba(220,100,100,0.85)', lineHeight: 1.6, margin: 0 }}>
                {error}
              </p>
            </motion.div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>
    </motion.div>
  );
}


function ProcessingView({ previewUrl, step }: { previewUrl: string | null; step: number }) {
  const pct = Math.round(((step + 1) / PROCESSING_STEPS.length) * 100);
  return (
    <motion.div
      key="processing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div style={{ border: '1px solid #1C1C1C', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr' }}>
          <div style={{ position: 'relative', background: '#080808', minHeight: '280px' }}>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Your upload"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.5,
                  display: 'block',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, transparent, rgba(8,8,8,0.4))',
              }}
            />
            <motion.div
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '1px',
                background:
                  'linear-gradient(90deg, transparent 0%, #C9A96E 30%, #C9A96E 70%, transparent 100%)',
                boxShadow: '0 0 18px 3px rgba(201,169,110,0.35)',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '36px 32px',
              background: '#0A0A0A',
              borderLeft: '1px solid #1C1C1C',
            }}
          >
            <p
              style={{
                fontSize: '10px',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: '#3A3530',
                marginBottom: '32px',
              }}
            >
              Finding your matches
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '36px' }}>
              {PROCESSING_STEPS.map((s, i) => (
                <StepItem
                  key={s}
                  label={s}
                  status={i < step ? 'done' : i === step ? 'active' : 'pending'}
                  index={i}
                />
              ))}
            </div>
            <div>
              <div
                style={{
                  height: '1px',
                  background: '#1A1A1A',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: '9px',
                }}
              >
                <motion.div
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: '#C9A96E' }}
                />
              </div>
              <p
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#3A3530',
                }}
              >
                Step {step + 1} of {PROCESSING_STEPS.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


function CompactSuccessView({
  matchData,
  previewUrl,
  onReset,
}: {
  matchData: MatchResponse;
  previewUrl: string | null;
  onReset: () => void;
}) {
  const { styleDNA, editorialAnalysis } = matchData;

  return (
    <motion.div
      key="compact-success"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      <div style={{ border: '1px solid #1C1C1C', overflow: 'hidden', background: '#0A0A0A' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: previewUrl ? '110px 1fr auto' : '1fr auto',
            alignItems: 'stretch',
          }}
        >
          {previewUrl && (
            <div style={{ position: 'relative', overflow: 'hidden', minHeight: '90px' }}>
              <img
                src={previewUrl}
                alt="Your upload"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  opacity: 0.7,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to right, transparent, rgba(10,10,10,0.88))',
                }}
              />
            </div>
          )}

          <div
            style={{
              padding: '20px 24px',
              borderLeft: previewUrl ? '1px solid #161412' : 'none',
            }}
          >
            <p
              style={{
                fontSize: '10px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: '#C9A96E',
                marginBottom: '8px',
              }}
            >
              Your Style
            </p>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '14px',
                fontStyle: 'italic',
                color: '#B0A090',
                lineHeight: 1.65,
                marginBottom: '14px',
                maxWidth: '560px',
              }}
            >
              {editorialAnalysis}
            </p>
            {styleDNA.length > 0 && (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {styleDNA.slice(0, 3).map(({ label, score }) => (
                  <div key={label} style={{ minWidth: '110px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#7A6A5A' }}>{label}</span>
                      <span style={{ fontSize: '10px', color: '#C9A96E', fontFamily: FONT_MONO }}>
                        {score}%
                      </span>
                    </div>
                    <div style={{ height: '1px', background: '#1A1A1A' }}>
                      <div
                        style={{ height: '100%', width: `${score}%`, background: '#C9A96E' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderLeft: '1px solid #161412',
              minWidth: '110px',
            }}
          >
            <button
              onClick={onReset}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '9px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#3A3530',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'right',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#C9A96E')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#3A3530')}
            >
              ← New upload
            </button>
            <motion.p
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              style={{
                fontSize: '9px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#C9A96E',
                margin: 0,
              }}
            >
              ↓ Matches below
            </motion.p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


function FullSuccessView({
  matchData,
  previewUrl,
  onReset,
}: {
  matchData: MatchResponse;
  previewUrl: string | null;
  onReset: () => void;
}) {
  const { styleDNA, editorialAnalysis, matches } = matchData;

  return (
    <motion.div
      key="full-success"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ border: '1px solid #1C1C1C', overflow: 'hidden', background: '#0A0A0A' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? '1fr 3fr' : '1fr' }}>
          {previewUrl && (
            <div style={{ position: 'relative', overflow: 'hidden', minHeight: '200px' }}>
              <img
                src={previewUrl}
                alt="Your upload"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          )}
          <div style={{ padding: '36px 40px', borderLeft: previewUrl ? '1px solid #1C1C1C' : 'none' }}>
            <p
              style={{
                fontSize: '10px',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: '#C9A96E',
                marginBottom: '12px',
              }}
            >
              Your Style Profile
            </p>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '1.15rem',
                fontStyle: 'italic',
                color: '#B8A89A',
                lineHeight: 1.7,
                marginBottom: '28px',
                maxWidth: '540px',
              }}
            >
              {editorialAnalysis}
            </p>
            {styleDNA.length > 0 && (
              <div style={{ maxWidth: '380px' }}>
                <p
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: '#3A3530',
                    marginBottom: '14px',
                  }}
                >
                  Style Breakdown
                </p>
                <StyleDNABars dna={styleDNA} animate />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <VendorGrid matches={matches} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        style={{ textAlign: 'center', paddingTop: '8px' }}
      >
        <button
          onClick={onReset}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#4A4440',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#C9A96E')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#4A4440')}
        >
          ← Try a different photo
        </button>
      </motion.div>
    </motion.div>
  );
}


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
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (widgetState === 'processing') {
      setProcessingStep(0);
      stepIntervalRef.current = setInterval(() => {
        setProcessingStep((prev) => {
          if (prev >= PROCESSING_STEPS.length - 1) {
            if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, 2200);
    } else {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    }
    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    };
  }, [widgetState]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Please upload a JPG, PNG or WEBP image.');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('Image must be under 10MB.');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setWidgetState('processing');

      try {
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error('Failed to read image file.'));
          reader.readAsDataURL(file);
        });

        const response = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType: file.type }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? LUXURY_ERROR
          );
        }

        const matchResponse = data as MatchResponse;
        setMatchData(matchResponse);
        setWidgetState('success');
        onMatchSuccess?.(matchResponse);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : LUXURY_ERROR;
        const isGoogleError =
          message.includes('GoogleGenerativeAI') ||
          message.includes('503') ||
          message.includes('500');
        setError(isGoogleError ? LUXURY_ERROR : message);
        setWidgetState('error');
      }
    },
    [onMatchSuccess]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDragEnter = useCallback(() => setIsDragOver(true), []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );
  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      e.target.value = '';
    },
    [handleFile]
  );
  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setWidgetState('idle');
    setPreviewUrl(null);
    setMatchData(null);
    setError(null);
    setProcessingStep(0);
  }, [previewUrl]);

  return (
    <section style={{ width: '100%', background: '#080808' }}>
      <AnimatePresence mode="wait">
        {(widgetState === 'idle' || widgetState === 'error') && (
          <IdleView
            key="idle"
            isDragOver={isDragOver}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            error={error}
          />
        )}
        {widgetState === 'processing' && (
          <ProcessingView key="processing" previewUrl={previewUrl} step={processingStep} />
        )}
        {widgetState === 'success' && matchData && onMatchSuccess && (
          <CompactSuccessView
            key="compact-success"
            matchData={matchData}
            previewUrl={previewUrl}
            onReset={handleReset}
          />
        )}
        {widgetState === 'success' && matchData && !onMatchSuccess && (
          <FullSuccessView
            key="full-success"
            matchData={matchData}
            previewUrl={previewUrl}
            onReset={handleReset}
          />
        )}
      </AnimatePresence>
    </section>
  );
}