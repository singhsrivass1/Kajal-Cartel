'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/site/SiteHeader';
import { BOARD_EVENT_OPTIONS, eventLabel } from '@/components/boards/boardLabels';
import { apiRequest, SessionExpiredError, signInHref } from '@/lib/client/api';
import { resizeImageFile } from '@/lib/client/resizeImage';
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
  secondaryButtonStyle,
} from '@/components/site/tokens';
import type { BoardDetail, BoardItemView } from '@/lib/db/controllers/BoardManager';

interface Feedback {
  tone: 'success' | 'error';
  text: string;
  expired?: boolean;
}

function FeedbackLine({ feedback, callback }: { feedback: Feedback | null; callback: string }) {
  if (!feedback) return null;
  return (
    <p role={feedback.tone === 'error' ? 'alert' : 'status'} style={{ fontSize: '12px', margin: '10px 0 0', color: feedback.tone === 'success' ? COLORS.success : COLORS.error }}>
      {feedback.text}{' '}
      {feedback.expired && <Link href={signInHref(callback)} style={{ color: COLORS.gold }}>Sign in again</Link>}
    </p>
  );
}

function toFeedback(err: unknown, fallback: string): Feedback {
  return { tone: 'error', text: err instanceof Error ? err.message : fallback, expired: err instanceof SessionExpiredError };
}

function DetailsEditor({ board, onSaved, onCancel }: { board: BoardDetail; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(board.name);
  const [eventType, setEventType] = useState<string>(board.eventType);
  const [eventDate, setEventDate] = useState(board.eventDate ?? '');
  const [notes, setNotes] = useState(board.notes);
  const [styles, setStyles] = useState<string[]>(board.stylePreferences);
  const [styleDraft, setStyleDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const id = useId();

  const addStyle = () => {
    const value = styleDraft.trim();
    if (!value) return;
    if (styles.length >= 12) {
      setFeedback({ tone: 'error', text: 'You can add up to 12 style preferences.' });
      return;
    }
    if (!styles.some((s) => s.toLowerCase() === value.toLowerCase())) setStyles([...styles, value.slice(0, 40)]);
    setStyleDraft('');
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/user/boards/${board.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), eventType, eventDate: eventDate || null, notes, stylePreferences: styles },
      });
      onSaved();
    } catch (err) {
      setFeedback(toFeedback(err, 'Could not save the moodboard.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate style={{ ...cardStyle, padding: '22px 24px', marginBottom: '28px' }}>
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '14px', marginBottom: '14px' }}>
        <div>
          <label htmlFor={`${id}-name`} style={labelStyle}>Name</label>
          <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={fieldStyle} />
        </div>
        <div>
          <label htmlFor={`${id}-type`} style={labelStyle}>Event</label>
          <select id={`${id}-type`} value={eventType} onChange={(e) => setEventType(e.target.value)} style={fieldStyle}>
            {BOARD_EVENT_OPTIONS.map((o) => <option key={o.value} value={o.value} style={{ background: COLORS.panel }}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-date`} style={labelStyle}>Event date (optional)</label>
          <input id={`${id}-date`} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ ...fieldStyle, colorScheme: 'dark' }} />
        </div>
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label htmlFor={`${id}-notes`} style={labelStyle}>Notes (optional)</label>
        <textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={4} placeholder="Outfit colours, jewellery, timings, anything you want to remember…" style={{ ...fieldStyle, resize: 'vertical' }} />
      </div>
      <div style={{ marginBottom: '18px' }}>
        <label htmlFor={`${id}-style`} style={labelStyle}>Style preferences (optional)</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            id={`${id}-style`}
            value={styleDraft}
            onChange={(e) => setStyleDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStyle(); } }}
            maxLength={40}
            placeholder="e.g. dewy skin, soft pink lips"
            style={fieldStyle}
          />
          <button type="button" onClick={addStyle} style={{ ...secondaryButtonStyle(), flexShrink: 0 }}>Add</button>
        </div>
        {styles.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {styles.map((s) => (
              <li key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #2D2418', padding: '4px 8px', fontSize: '11px', color: COLORS.textMuted }}>
                {s}
                <button type="button" aria-label={`Remove ${s}`} onClick={() => setStyles(styles.filter((x) => x !== s))} style={{ background: 'none', border: 'none', color: COLORS.textDim, cursor: 'pointer', padding: 0 }}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="submit" disabled={saving} style={primaryButtonStyle(saving)}>{saving ? 'Saving…' : 'Save details'}</button>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle()}>Cancel</button>
      </div>
      <FeedbackLine feedback={feedback} callback={`/moodboards/${board.id}`} />
    </form>
  );
}

function ItemCard({ boardId, item, onChanged }: { boardId: string; item: BoardItemView; onChanged: (message: string) => void }) {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(item.note ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const noteId = useId();
  const isImage = Boolean(item.imageUrl) && (item.kind === 'look' || item.kind === 'portfolio' || item.kind === 'upload');

  const saveNote = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/user/boards/${boardId}/items/${item.id}`, { method: 'PATCH', body: { note } });
      setEditingNote(false);
      onChanged('Note saved.');
    } catch (err) {
      setFeedback(toFeedback(err, 'Could not save the note.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await apiRequest(`/api/user/boards/${boardId}/items/${item.id}`, { method: 'DELETE' });
      onChanged('Removed from this moodboard.');
    } catch (err) {
      setFeedback(toFeedback(err, 'Could not remove this item.'));
      setBusy(false);
    }
  };

  const kindLabel: Record<string, string> = { look: 'Saved look', portfolio: 'Portfolio', upload: 'Your upload', artist: 'Artist', service: 'Service' };

  return (
    <li style={{ ...cardStyle, display: 'flex', flexDirection: 'column', opacity: item.available ? 1 : 0.7, breakInside: 'avoid', marginBottom: '14px' }}>
      {isImage && item.available && (
        <img src={item.imageUrl} alt={item.imageAlt ?? item.title} loading="lazy" style={{ width: '100%', display: 'block', background: '#111' }} />
      )}
      {!isImage && item.available && item.imageUrl && (
        <img src={item.imageUrl} alt={item.imageAlt ?? item.title} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '14px 16px 16px' }}>
        <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.gold, margin: '0 0 4px' }}>{kindLabel[item.kind] ?? item.kind}</p>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: COLORS.text, margin: '0 0 2px', wordBreak: 'break-word' }}>
          {item.href && item.available ? <Link href={item.href} style={{ color: 'inherit' }}>{item.title}</Link> : item.title}
        </p>
        {item.subtitle && <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '0 0 8px' }}>{item.subtitle}</p>}

        {editingNote ? (
          <div style={{ marginTop: '8px' }}>
            <label htmlFor={noteId} className="sr-only">Note</label>
            <textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} style={{ ...fieldStyle, resize: 'vertical', fontSize: '12px' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={saveNote} disabled={busy} style={{ ...secondaryButtonStyle('default', busy), padding: '8px 12px' }}>{busy ? 'Saving…' : 'Save note'}</button>
              <button type="button" onClick={() => { setEditingNote(false); setNote(item.note ?? ''); }} style={{ ...secondaryButtonStyle(), padding: '8px 12px', color: COLORS.textDim }}>Cancel</button>
            </div>
          </div>
        ) : item.note ? (
          <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: '6px 0 0', borderLeft: '2px solid #2A2520', paddingLeft: '10px', whiteSpace: 'pre-line' }}>{item.note}</p>
        ) : null}

        <div style={{ display: 'flex', gap: '14px', marginTop: '12px', flexWrap: 'wrap' }}>
          {!editingNote && (
            <button type="button" onClick={() => setEditingNote(true)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8078', cursor: 'pointer' }}>
              {item.note ? 'Edit note' : 'Add note'}
            </button>
          )}
          {confirmRemove ? (
            <>
              <button type="button" onClick={remove} disabled={busy} style={{ background: 'none', border: 'none', padding: 0, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.danger, cursor: 'pointer' }}>
                {busy ? 'Removing…' : 'Confirm remove'}
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8078', cursor: 'pointer' }}>Keep</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#9A5A50', cursor: 'pointer' }}>
              Remove
            </button>
          )}
        </div>
        <FeedbackLine feedback={feedback} callback={`/moodboards/${boardId}`} />
      </div>
    </li>
  );
}

function AddPanel({
  board,
  savedLooks,
  savedArtists,
  onAdded,
}: {
  board: BoardDetail;
  savedLooks: Array<{ id: string; label: string }>;
  savedArtists: Array<{ slug: string; name: string }>;
  onAdded: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const onBoardLooks = new Set(board.items.filter((i) => i.kind === 'look').map((i) => i.imageUrl));
  const onBoardArtists = new Set(board.items.filter((i) => i.kind === 'artist' && i.href).map((i) => i.href));
  const availableLooks = savedLooks.filter((l) => !onBoardLooks.has(`/api/user/moodboards/${l.id}/image`));
  const availableArtists = savedArtists.filter((a) => !onBoardArtists.has(`/artists/${a.slug}`));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const resized = await resizeImageFile(file);
      await apiRequest(`/api/user/boards/${board.id}/items?upload=1`, {
        method: 'POST',
        body: { data: resized.base64, mimeType: resized.mimeType, caption: caption.trim() || undefined },
      });
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      onAdded('Image added to your moodboard.');
    } catch (err) {
      setFeedback(toFeedback(err, 'Could not upload this image.'));
    } finally {
      setUploading(false);
    }
  };

  const addReference = async (key: string, body: Record<string, string>, message: string) => {
    setBusy(key);
    setFeedback(null);
    try {
      await apiRequest(`/api/user/boards/${board.id}/items`, { method: 'POST', body });
      onAdded(message);
    } catch (err) {
      setFeedback(toFeedback(err, 'Could not add this to your moodboard.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} style={{ ...cardStyle, padding: '22px 24px', marginBottom: '32px' }}>
      <h2 id={`${id}-heading`} style={{ fontFamily: FONT_DISPLAY, fontSize: '1.25rem', color: COLORS.text, fontWeight: 400, margin: '0 0 16px' }}>Add inspiration</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '22px' }}>
        <div>
          <p style={labelStyle}>Upload an image</p>
          <label htmlFor={`${id}-caption`} className="sr-only">Caption</label>
          <input id={`${id}-caption`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={150} placeholder="Caption (optional)" style={{ ...fieldStyle, marginBottom: '8px' }} />
          <label htmlFor={`${id}-file`} className="sr-only">Choose an image to upload</label>
          <input
            id={`${id}-file`}
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => void upload(e.target.files?.[0])}
            style={{ fontSize: '12px', color: COLORS.textMuted, width: '100%' }}
          />
          <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '8px 0 0', lineHeight: 1.6 }}>
            {uploading ? 'Resizing and uploading…' : 'JPEG, PNG or WebP. Images are resized in your browser and stored privately — only you can see them.'}
          </p>
        </div>
        <div>
          <p style={labelStyle}>From your saved looks</p>
          {availableLooks.length === 0 ? (
            <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>
              {savedLooks.length === 0 ? <>No saved looks yet. <Link href="/discover" style={{ color: COLORS.gold }}>Match a look</Link> to save one.</> : 'All your saved looks are already on this board.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {availableLooks.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => addReference(`look-${l.id}`, { kind: 'look', savedLookId: l.id }, `“${l.label}” added.`)}
                    className="kc-menu-item"
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: `1px solid ${COLORS.line}`, color: COLORS.textMuted, fontSize: '12px', padding: '8px 10px', cursor: 'pointer' }}
                  >
                    {busy === `look-${l.id}` ? 'Adding…' : `+ ${l.label}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p style={labelStyle}>From your saved artists</p>
          {availableArtists.length === 0 ? (
            <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>
              {savedArtists.length === 0 ? <>No saved artists yet. <Link href="/discover#roster" style={{ color: COLORS.gold }}>Browse artists</Link>.</> : 'All your saved artists are already on this board.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {availableArtists.map((a) => (
                <li key={a.slug}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => addReference(`artist-${a.slug}`, { kind: 'artist', vendorSlug: a.slug }, `${a.name} added.`)}
                    className="kc-menu-item"
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: `1px solid ${COLORS.line}`, color: COLORS.textMuted, fontSize: '12px', padding: '8px 10px', cursor: 'pointer' }}
                  >
                    {busy === `artist-${a.slug}` ? 'Adding…' : `+ ${a.name}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '16px 0 0' }}>
        Tip: on any artist profile, use “Save” on portfolio images or a service to add them here.
      </p>
      <FeedbackLine feedback={feedback} callback={`/moodboards/${board.id}`} />
    </section>
  );
}

export function BoardDetailClient({
  board,
  justCreated,
  savedLooks,
  savedArtists,
}: {
  board: BoardDetail;
  justCreated: boolean;
  savedLooks: Array<{ id: string; label: string }>;
  savedArtists: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string | null>(justCreated ? 'Moodboard created. Start adding inspiration below.' : null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<Feedback | null>(null);

  const refresh = (message: string) => {
    setStatus(message);
    router.refresh();
  };

  const deleteBoard = async () => {
    setDeleting(true);
    setDeleteFeedback(null);
    try {
      await apiRequest(`/api/user/boards/${board.id}`, { method: 'DELETE' });
      router.push('/moodboards');
      router.refresh();
    } catch (err) {
      setDeleteFeedback(toFeedback(err, 'Could not delete this moodboard.'));
      setDeleting(false);
    }
  };

  const imageItems = board.items.filter((i) => i.kind === 'look' || i.kind === 'portfolio' || i.kind === 'upload');
  const referenceItems = board.items.filter((i) => i.kind === 'artist' || i.kind === 'service');

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '40px', paddingBottom: '96px' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '22px' }}>
          <Link href="/moodboards" className="kc-nav-link" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A8078', textDecoration: 'none' }}>
            ← All moodboards
          </Link>
        </nav>

        <div aria-live="polite">
          {status && (
            <div role="status" style={{ border: '1px solid rgba(90,138,90,0.45)', background: 'rgba(90,138,90,0.08)', padding: '12px 16px', marginBottom: '22px' }}>
              <p style={{ fontSize: '13px', color: '#9CC29C', margin: 0 }}>✓ {status}</p>
            </div>
          )}
        </div>

        {editing ? (
          <DetailsEditor board={board} onSaved={() => { setEditing(false); refresh('Moodboard details saved.'); }} onCancel={() => setEditing(false)} />
        ) : (
          <header style={{ marginBottom: '28px' }}>
            <p style={eyebrowStyle}>
              {eventLabel(board.eventType)}{board.eventDate ? ` · ${formatIsoDate(board.eventDate)}` : ''}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <h1 style={{ ...pageTitleStyle, wordBreak: 'break-word' }}>{board.name}</h1>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setEditing(true)} style={secondaryButtonStyle()}>Edit details</button>
                {confirmDelete ? (
                  <>
                    <button type="button" onClick={deleteBoard} disabled={deleting} style={secondaryButtonStyle('danger', deleting)}>
                      {deleting ? 'Deleting…' : 'Yes, delete board'}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} style={secondaryButtonStyle()}>Keep it</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} style={secondaryButtonStyle('danger')}>Delete board</button>
                )}
              </div>
            </div>
            {confirmDelete && (
              <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '10px 0 0' }}>
                This removes the board and any images you uploaded to it. Your saved looks and saved artists are not affected.
              </p>
            )}
            <FeedbackLine feedback={deleteFeedback} callback={`/moodboards/${board.id}`} />
            {board.notes && (
              <p style={{ fontSize: '14px', color: COLORS.textMuted, lineHeight: 1.7, margin: '18px 0 0', maxWidth: '760px', whiteSpace: 'pre-line' }}>{board.notes}</p>
            )}
            {board.stylePreferences.length > 0 && (
              <ul aria-label="Style preferences" style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {board.stylePreferences.map((s) => (
                  <li key={s} style={{ border: '1px solid #2D2418', padding: '4px 10px', fontSize: '11px', color: COLORS.gold }}>{s}</li>
                ))}
              </ul>
            )}
          </header>
        )}

        <AddPanel board={board} savedLooks={savedLooks} savedArtists={savedArtists} onAdded={refresh} />

        {board.items.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '56px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: '#8A8078', margin: '0 0 10px' }}>This moodboard is empty.</p>
            <p style={{ fontSize: '13px', color: COLORS.textDim, margin: 0 }}>Upload an image, add a saved look, or save images from an artist&apos;s portfolio.</p>
          </div>
        ) : (
          <>
            {imageItems.length > 0 && (
              <section aria-labelledby="images-heading" style={{ marginBottom: '36px' }}>
                <h2 id="images-heading" style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 16px', fontWeight: 400 }}>
                  Images · {imageItems.length}
                </h2>
                <ul className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4" style={{ columnGap: '14px', listStyle: 'none', padding: 0, margin: 0 }}>
                  {imageItems.map((item) => <ItemCard key={item.id} boardId={board.id} item={item} onChanged={refresh} />)}
                </ul>
              </section>
            )}
            {referenceItems.length > 0 && (
              <section aria-labelledby="refs-heading">
                <h2 id="refs-heading" style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 16px', fontWeight: 400 }}>
                  Artists &amp; services · {referenceItems.length}
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '14px', listStyle: 'none', padding: 0, margin: 0 }}>
                  {referenceItems.map((item) => <ItemCard key={item.id} boardId={board.id} item={item} onChanged={refresh} />)}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
