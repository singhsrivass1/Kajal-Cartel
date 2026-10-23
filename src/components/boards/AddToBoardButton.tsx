'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { apiRequest, SessionExpiredError, signInHref } from '@/lib/client/api';
import { COLORS, fieldStyle } from '@/components/site/tokens';

export type BoardItemPayload =
  | { kind: 'portfolio'; vendorSlug: string; imageUrl: string }
  | { kind: 'artist'; vendorSlug: string }
  | { kind: 'service'; vendorSlug: string; serviceId: string }
  | { kind: 'look'; savedLookId: string };

interface BoardOption {
  id: string;
  name: string;
  itemCount: number;
}

export function AddToBoardButton({
  item,
  label = 'Save to moodboard',
  variant = 'button',
  align = 'left',
}: {
  item: BoardItemPayload;
  label?: string;
  variant?: 'button' | 'chip';
  align?: 'left' | 'right';
}) {
  const { status } = useSession();
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<BoardOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyBoard, setBusyBoard] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string; boardId?: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const newNameId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || boards !== null) return;
    apiRequest<{ boards: BoardOption[] }>('/api/user/boards')
      .then((data) => setBoards(data.boards))
      .catch((err) => {
        if (err instanceof SessionExpiredError) setSessionExpired(true);
        setLoadError(err instanceof Error ? err.message : 'Could not load your moodboards.');
      });
  }, [open, boards]);

  const triggerStyle =
    variant === 'chip'
      ? {
          fontSize: '9px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          padding: '4px 9px',
          background: 'rgba(8,8,8,0.78)',
          border: '1px solid rgba(201,169,110,0.35)',
          color: COLORS.gold,
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
        }
      : {
          fontSize: '10px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
          padding: '10px 16px',
          background: 'none',
          border: '1px solid #2D2418',
          color: COLORS.gold,
          cursor: 'pointer',
        };

  if (status !== 'authenticated') {
    return (
      <Link href={signInHref(pathname)} style={{ ...triggerStyle, textDecoration: 'none', display: 'inline-block' }}>
        {label}
      </Link>
    );
  }

  const addToBoard = async (boardId: string, boardName: string) => {
    setBusyBoard(boardId);
    setMessage(null);
    try {
      await apiRequest(`/api/user/boards/${boardId}/items`, { method: 'POST', body: item });
      setMessage({ tone: 'success', text: `Saved to “${boardName}”.`, boardId });
      setBoards((prev) => prev?.map((b) => (b.id === boardId ? { ...b, itemCount: b.itemCount + 1 } : b)) ?? prev);
    } catch (err) {
      if (err instanceof SessionExpiredError) setSessionExpired(true);
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save this item.' });
    } finally {
      setBusyBoard(null);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) {
      setMessage({ tone: 'error', text: 'Give your new moodboard a name.' });
      return;
    }
    setBusyBoard('new');
    setMessage(null);
    try {
      const { board } = await apiRequest<{ board: BoardOption }>('/api/user/boards', { method: 'POST', body: { name } });
      setBoards((prev) => [{ ...board, itemCount: 0 }, ...(prev ?? [])]);
      setNewName('');
      await addToBoard(board.id, board.name);
    } catch (err) {
      if (err instanceof SessionExpiredError) setSessionExpired(true);
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Could not create the moodboard.' });
      setBusyBoard(null);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle}
      >
        {label}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Save to a moodboard"
          style={{
            position: 'absolute',
            [align === 'right' ? 'right' : 'left']: 0,
            top: 'calc(100% + 8px)',
            width: '270px',
            maxWidth: '80vw',
            background: '#0A0A0A',
            border: `1px solid ${COLORS.line}`,
            boxShadow: '0 18px 48px rgba(0,0,0,0.6)',
            zIndex: 70,
            padding: '14px',
            textAlign: 'left',
          }}
        >
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 10px' }}>Your moodboards</p>
          {sessionExpired ? (
            <p style={{ fontSize: '12px', color: COLORS.error, margin: 0 }}>
              Your session has expired. <Link href={signInHref(pathname)} style={{ color: COLORS.gold }}>Sign in again</Link>.
            </p>
          ) : loadError ? (
            <p style={{ fontSize: '12px', color: COLORS.error, margin: 0 }}>{loadError}</p>
          ) : boards === null ? (
            <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>Loading…</p>
          ) : (
            <>
              {boards.length === 0 ? (
                <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '0 0 10px' }}>You don&apos;t have a moodboard yet. Create one below.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, maxHeight: '190px', overflowY: 'auto' }}>
                  {boards.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="kc-menu-item"
                        disabled={busyBoard !== null}
                        onClick={() => addToBoard(b.id, b.name)}
                        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '9px 8px', color: COLORS.textMuted, fontSize: '12px', cursor: busyBoard ? 'default' : 'pointer', display: 'flex', justifyContent: 'space-between', gap: '8px' }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                        <span style={{ color: COLORS.textFaint, flexShrink: 0 }}>{busyBoard === b.id ? 'Saving…' : `${b.itemCount}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label htmlFor={newNameId} style={{ display: 'block', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textDim, marginBottom: '6px' }}>
                New moodboard
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  id={newNameId}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void createAndAdd();
                    }
                  }}
                  maxLength={80}
                  placeholder="e.g. Reception look"
                  style={{ ...fieldStyle, fontSize: '12px', padding: '8px 10px' }}
                />
                <button
                  type="button"
                  onClick={createAndAdd}
                  disabled={busyBoard !== null}
                  style={{ flexShrink: 0, background: COLORS.gold, color: COLORS.bg, border: 'none', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '0 12px', cursor: busyBoard ? 'default' : 'pointer', opacity: busyBoard ? 0.6 : 1 }}
                >
                  {busyBoard === 'new' ? '…' : 'Add'}
                </button>
              </div>
            </>
          )}
          <div aria-live="polite">
            {message && (
              <p style={{ fontSize: '12px', margin: '10px 0 0', color: message.tone === 'success' ? COLORS.success : COLORS.error }}>
                {message.text}{' '}
                {message.tone === 'success' && message.boardId && (
                  <Link href={`/moodboards/${message.boardId}`} style={{ color: COLORS.gold }}>View board</Link>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
