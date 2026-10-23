'use client';

import { Suspense, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MoodBoardWidget } from '@/components/discovery/MoodBoardWidget';
import { VendorGrid } from '@/components/discovery/VendorGrid';
import { RosterBrowser } from '@/components/discovery/RosterBrowser';
import { SiteHeader } from '@/components/site/SiteHeader';
import type { MatchResponse } from '@/types/match';
import type { DiscoverVendor } from '@/types/discovery';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';


function SaveMoodboardButton({
  requiresSignIn,
  isSaving,
  isSaved,
  saveError,
  isPromptOpen,
  labelValue,
  onLabelChange,
  onOpenPrompt,
  onCancelPrompt,
  onConfirmSave,
}: {
  requiresSignIn: boolean;
  isSaving: boolean;
  isSaved: boolean;
  saveError: string | null;
  isPromptOpen: boolean;
  labelValue: string;
  onLabelChange: (v: string) => void;
  onOpenPrompt: () => void;
  onCancelPrompt: () => void;
  onConfirmSave: () => void;
}) {
  if (isPromptOpen) {
    return (
      <div style={{ textAlign: 'right' }}>
        <label htmlFor="kc-look-label" className="sr-only">Name this look</label>
        <input
          id="kc-look-label"
          type="text"
          placeholder="Name this look (optional)"
          value={labelValue}
          onChange={e => onLabelChange(e.target.value)}
          maxLength={80}
          autoFocus
          style={{
            width: '220px', maxWidth: '100%', padding: '8px 10px', fontSize: '11px',
            background: '#0C0C0C', border: '1px solid #2D2418', color: '#F0EBE0',
            outline: 'none', marginBottom: '8px', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancelPrompt}
            disabled={isSaving}
            style={{ background: 'none', border: 'none', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A706A', cursor: isSaving ? 'default' : 'pointer', padding: '9px 10px' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirmSave}
            disabled={isSaving}
            style={{ background: 'none', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '9px 16px', border: '1px solid #2D2418', color: '#C9A96E', cursor: isSaving ? 'default' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving ? 'Saving…' : 'Confirm Save'}
          </button>
        </div>
        {saveError && (
          <p role="alert" style={{ fontSize: '10px', color: 'rgba(220,80,80,0.75)', marginTop: '8px', maxWidth: '220px', marginLeft: 'auto' }}>{saveError}</p>
        )}
      </div>
    );
  }

  const label = isSaved ? 'Saved ✓' : requiresSignIn ? 'Sign In to Save' : 'Save This Look';
  return (
    <div style={{ textAlign: 'right' }}>
      <button
        onClick={onOpenPrompt}
        disabled={isSaved}
        style={{
          background: isSaved ? 'rgba(90,138,90,0.1)' : 'none',
          fontSize: '10px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          padding: '9px 18px',
          border: `1px solid ${isSaved ? 'rgba(90,138,90,0.4)' : '#2D2418'}`,
          color: isSaved ? '#5A8A5A' : '#C9A96E',
          cursor: isSaved ? 'default' : 'pointer',
          transition: 'background 0.2s, color 0.2s',
        }}
        onMouseEnter={e => { if (!isSaved) { (e.currentTarget as HTMLButtonElement).style.background = '#C9A96E'; (e.currentTarget as HTMLButtonElement).style.color = '#080808'; } }}
        onMouseLeave={e => { if (!isSaved) { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#C9A96E'; } }}
      >
        {label}
      </button>
      {isSaved && (
        <p style={{ fontSize: '10px', color: '#7A706A', marginTop: '8px' }}>
          Find it under <a href="/journey?tab=looks" style={{ color: '#C9A96E' }}>Saved Looks</a>.
        </p>
      )}
      {saveError && (
        <p role="alert" style={{ fontSize: '10px', color: 'rgba(220,80,80,0.75)', marginTop: '8px', maxWidth: '220px', marginLeft: 'auto' }}>{saveError}</p>
      )}
    </div>
  );
}

interface DiscoverPageClientProps { vendors: DiscoverVendor[]; loadError?: boolean; }

export function DiscoverPageClient({ vendors, loadError = false }: DiscoverPageClientProps) {
  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const router = useRouter();

  const [isSavingMoodboard, setIsSavingMoodboard] = useState(false);
  const [isMoodboardSaved, setIsMoodboardSaved] = useState(false);
  const [moodboardSaveError, setMoodboardSaveError] = useState<string | null>(null);
  const [isLabelPromptOpen, setIsLabelPromptOpen] = useState(false);
  const [moodboardLabel, setMoodboardLabel] = useState('');

  const handleMatchSuccess = useCallback((data: MatchResponse, image: { base64: string; mimeType: string }) => {
    setMatchData(data);
    setUploadedImage(image);
    setIsMoodboardSaved(false);
    setMoodboardSaveError(null);
    setIsLabelPromptOpen(false);
    setMoodboardLabel('');
    setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 420);
  }, []);

  const handleOpenSavePrompt = useCallback(() => {
    if (!session) {
      router.push('/auth?callbackUrl=/discover');
      return;
    }
    setIsLabelPromptOpen(true);
  }, [session, router]);

  const handleCancelSavePrompt = useCallback(() => {
    setIsLabelPromptOpen(false);
    setMoodboardSaveError(null);
  }, []);

  const handleConfirmSaveMoodboard = useCallback(async () => {
    if (!matchData || !uploadedImage || isSavingMoodboard) return;
    setIsSavingMoodboard(true);
    setMoodboardSaveError(null);
    try {
      const res = await fetch('/api/user/save-moodboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: moodboardLabel.trim() || undefined,
          image: { data: uploadedImage.base64, mimeType: uploadedImage.mimeType },
          imageProfile: matchData.imageProfile,
          styleDNA: matchData.styleDNA,
          editorialAnalysis: matchData.editorialAnalysis,
        }),
      });
      const data = await res.json();
      if (res.status === 401) throw new Error('Your session has expired. Please sign in again to save this look.');
      if (!res.ok) throw new Error(data.error ?? 'Could not save this look. Please try again.');
      setIsMoodboardSaved(true);
      setIsLabelPromptOpen(false);
    } catch (err) {
      setMoodboardSaveError(err instanceof Error ? err.message : 'Could not save this look. Please try again.');
    } finally {
      setIsSavingMoodboard(false);
    }
  }, [matchData, uploadedImage, isSavingMoodboard, moodboardLabel]);

  const scrollToWidget = useCallback(() => { widgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);
  const scrollToRoster = useCallback(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <SiteHeader position="fixed" />

      <main id="main-content">
        <section style={{ paddingTop: '120px', paddingBottom: '72px' }}>
          <div className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: '44px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.36em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '16px' }}>
                Style Matching · New Delhi
              </p>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(3rem, 8vw, 7rem)', color: '#F0EBE0', lineHeight: 0.95, marginBottom: '20px', fontWeight: 400 }}>
                Find Your<br />Artist.
              </h1>
              <p style={{ fontSize: '14px', color: '#7A706A', maxWidth: '380px', lineHeight: 1.7, marginBottom: '22px' }}>
                Upload a photo of any look you love. We'll show you which of our artists would be the best fit for your style.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <button
                  type="button"
                  onClick={scrollToWidget}
                  style={{ background: 'none', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', padding: '10px 18px', border: '1px solid #2D2418', color: '#C9A96E', cursor: 'pointer' }}
                >
                  Style Matching
                </button>
                <button
                  type="button"
                  onClick={scrollToRoster}
                  style={{ background: 'none', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', padding: '10px 18px', border: '1px solid #1C1C1C', color: '#8A8078', cursor: 'pointer' }}
                >
                  Browse &amp; Filter All Artists
                </button>
              </div>
            </motion.div>

            <motion.div ref={widgetRef} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
              <MoodBoardWidget onMatchSuccess={handleMatchSuccess} />
            </motion.div>
          </div>
        </section>

        <div style={{ height: '1px', maxWidth: '1280px', margin: '0 auto', background: 'linear-gradient(90deg, transparent, #1C1C1C 20%, #1C1C1C 80%, transparent)' }} />

        <section id="roster" ref={resultsRef} aria-labelledby="roster-heading" style={{ paddingBottom: '96px', paddingTop: '64px', scrollMarginTop: '72px' }}>
          <div className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <AnimatePresence mode="wait">
              {matchData && (
                <motion.div key="with-match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }} style={{ marginBottom: '64px' }}>
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between" style={{ marginBottom: '36px', gap: '20px' }}>
                    <div>
                      <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '8px' }}>
                        Your Matches · {matchData.matches.length} Artists
                      </p>
                      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#F0EBE0', fontWeight: 400 }}>
                        {matchData.matches.length === 1 ? 'Your best match' : 'Your best matches'}
                      </h2>
                    </div>
                    <SaveMoodboardButton
                      requiresSignIn={!session}
                      isSaving={isSavingMoodboard}
                      isSaved={isMoodboardSaved}
                      saveError={moodboardSaveError}
                      isPromptOpen={isLabelPromptOpen}
                      labelValue={moodboardLabel}
                      onLabelChange={setMoodboardLabel}
                      onOpenPrompt={handleOpenSavePrompt}
                      onCancelPrompt={handleCancelSavePrompt}
                      onConfirmSave={handleConfirmSaveMoodboard}
                    />
                  </div>
                  <VendorGrid matches={matchData.matches} />
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '8px' }}>
                {vendors.length} Artists · New Delhi
              </p>
              <h2 id="roster-heading" style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#F0EBE0', fontWeight: 400, marginBottom: '10px' }}>
                {matchData ? 'All artists' : 'All our artists'}
              </h2>
              <p style={{ fontSize: '13px', color: '#7A706A', maxWidth: '520px', lineHeight: 1.7 }}>
                Search and filter the full roster by style, occasion, service, budget and open dates — or upload a photo above to find your best matches.
              </p>
            </div>

            {loadError ? (
              <div role="alert" style={{ border: '1px solid #2A1A18', padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', color: '#C8B9A8', margin: '0 0 8px' }}>We couldn&apos;t load the artist roster.</p>
                <p style={{ fontSize: '13px', color: '#7A706A', margin: 0 }}>Please refresh the page in a moment.</p>
              </div>
            ) : vendors.length === 0 ? (
              <div style={{ border: '1px solid #161412', padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', color: '#C8B9A8', margin: 0 }}>Our roster is being updated. Please check back soon.</p>
              </div>
            ) : (
              <Suspense fallback={null}>
                <RosterBrowser vendors={vendors} dimmed={Boolean(matchData)} />
              </Suspense>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
