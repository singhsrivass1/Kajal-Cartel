'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/site/SiteHeader';
import { BOARD_EVENT_OPTIONS, eventLabel } from '@/components/boards/boardLabels';
import { apiRequest, SessionExpiredError, signInHref } from '@/lib/client/api';
import {
  COLORS,
  FONT_DISPLAY,
  cardStyle,
  eyebrowStyle,
  fieldStyle,
  formatIsoDate,
  labelStyle,
  pageTitleStyle,
  primaryButtonStyle,
} from '@/components/site/tokens';
import type { BoardSummary } from '@/lib/db/controllers/BoardManager';

export function BoardsClient({ boards, maxBoards }: { boards: BoardSummary[]; maxBoards: number }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('wedding');
  const [eventDate, setEventDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<{ text: string; expired: boolean } | null>(null);
  const nameId = useId();
  const typeId = useId();
  const dateId = useId();
  const atLimit = boards.length >= maxBoards;

  const create = async () => {
    if (!name.trim()) {
      setError({ text: 'Give your moodboard a name.', expired: false });
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { board } = await apiRequest<{ board: BoardSummary }>('/api/user/boards', {
        method: 'POST',
        body: { name: name.trim(), eventType, eventDate: eventDate || undefined },
      });
      router.push(`/moodboards/${board.id}?created=1`);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : 'Could not create the moodboard.', expired: err instanceof SessionExpiredError });
      setCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={eyebrowStyle}>Bridal planning</p>
        <h1 style={{ ...pageTitleStyle, marginBottom: '12px' }}>Moodboards</h1>
        <p style={{ fontSize: '14px', color: COLORS.textDim, maxWidth: '620px', lineHeight: 1.7, margin: '0 0 36px' }}>
          Keep a private board for each event — collect saved looks, portfolio images from our artists, your own inspiration photos, and the artists and services you are considering.
        </p>

        <section aria-labelledby="create-heading" style={{ ...cardStyle, padding: '22px 24px', marginBottom: '40px' }}>
          <h2 id="create-heading" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', color: COLORS.text, fontWeight: 400, margin: '0 0 16px' }}>
            Start a new moodboard
          </h2>
          {atLimit ? (
            <p style={{ fontSize: '13px', color: COLORS.textDim, margin: 0 }}>
              You have {maxBoards} moodboards, which is the maximum. Delete one to start another.
            </p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void create(); }} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto]" style={{ gap: '12px', alignItems: 'end' }}>
                <div>
                  <label htmlFor={nameId} style={labelStyle}>Name</label>
                  <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Wedding day — soft glam" style={fieldStyle} />
                </div>
                <div>
                  <label htmlFor={typeId} style={labelStyle}>Event</label>
                  <select id={typeId} value={eventType} onChange={(e) => setEventType(e.target.value)} style={fieldStyle}>
                    {BOARD_EVENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} style={{ background: COLORS.panel }}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={dateId} style={labelStyle}>Event date (optional)</label>
                  <input id={dateId} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ ...fieldStyle, colorScheme: 'dark' }} />
                </div>
                <button type="submit" disabled={creating} style={{ ...primaryButtonStyle(creating), height: '42px' }}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
              {error && (
                <p role="alert" style={{ fontSize: '12px', color: COLORS.error, margin: '12px 0 0' }}>
                  {error.text}{' '}
                  {error.expired && <Link href={signInHref('/moodboards')} style={{ color: COLORS.gold }}>Sign in again</Link>}
                </p>
              )}
            </form>
          )}
        </section>

        {boards.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '56px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: '#8A8078', margin: '0 0 10px' }}>No moodboards yet.</p>
            <p style={{ fontSize: '13px', color: COLORS.textDim, margin: '0 0 22px' }}>
              Create your first board above, or save images straight from any <Link href="/discover#roster" style={{ color: COLORS.gold }}>artist&apos;s portfolio</Link>.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 16px', fontWeight: 400 }}>
              Your moodboards · {boards.length}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '16px', listStyle: 'none', padding: 0, margin: 0 }}>
              {boards.map((b) => (
                <li key={b.id}>
                  <Link href={`/moodboards/${b.id}`} className="group" style={{ display: 'block', ...cardStyle, textDecoration: 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '100px 100px', gap: '2px', background: '#0A0A0A' }}>
                      {[0, 1, 2, 3].map((i) =>
                        b.coverImages[i] ? (
                          <img key={i} src={b.coverImages[i]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div key={i} style={{ background: '#111' }} />
                        )
                      )}
                    </div>
                    <div style={{ padding: '14px 16px 16px' }}>
                      <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.gold, margin: '0 0 4px' }}>
                        {eventLabel(b.eventType)}{b.eventDate ? ` · ${formatIsoDate(b.eventDate, 'short')}` : ''}
                      </p>
                      <p className="group-hover:text-[#C9A96E] transition-colors" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.15rem', color: COLORS.text, margin: '0 0 2px' }}>{b.name}</p>
                      <p style={{ fontSize: '11px', color: COLORS.textDim, margin: 0 }}>
                        {b.itemCount} item{b.itemCount === 1 ? '' : 's'} · updated {new Date(b.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
