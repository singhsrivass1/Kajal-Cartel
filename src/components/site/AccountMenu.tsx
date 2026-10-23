'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { COLORS, FONT_DISPLAY, initialsFor } from './tokens';
import { signInHref } from '@/lib/client/api';

interface MeResponse {
  signedIn: boolean;
  isAdmin?: boolean;
  isArtist?: boolean;
}

const menuLinkStyle = {
  display: 'block',
  padding: '10px 18px',
  fontSize: '12px',
  color: COLORS.textMuted,
  textDecoration: 'none',
} as const;

export function Avatar({ name, email, image, size = 30 }: { name?: string | null; email?: string | null; image?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', border: `1px solid ${COLORS.line}` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#14110C',
        border: '1px solid #2D2418',
        color: COLORS.gold,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        letterSpacing: '0.04em',
        fontFamily: FONT_DISPLAY,
      }}
    >
      {initialsFor(name, email)}
    </span>
  );
}

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { data: session, status } = useSession();
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<{ isAdmin: boolean; isArtist: boolean }>({ isAdmin: false, isArtist: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const signedIn = status === 'authenticated' && Boolean(session?.user);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch('/api/user/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => {
        if (!cancelled && data?.signedIn) setRoles({ isAdmin: Boolean(data.isAdmin), isArtist: Boolean(data.isArtist) });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
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
    setOpen(false);
  }, [pathname]);

  if (status === 'loading') {
    return <span aria-hidden="true" style={{ display: 'inline-block', width: 30, height: 30 }} />;
  }

  if (!signedIn) {
    return (
      <Link
        href={signInHref(pathname.startsWith('/auth') ? '/journey' : pathname)}
        className="kc-nav-link"
        style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: COLORS.text, textDecoration: 'none' }}
      >
        Sign In
      </Link>
    );
  }

  const user = session!.user!;
  const firstName = (user.name ?? '').trim().split(/\s+/)[0] || 'Account';
  const links: Array<{ href: string; label: string }> = [
    { href: '/journey', label: 'My Journey' },
    { href: '/journey?tab=bookings', label: 'My Bookings' },
    { href: '/journey?tab=artists', label: 'Saved Artists' },
    { href: '/moodboards', label: 'Moodboards' },
    { href: '/account', label: 'Profile & Settings' },
  ];
  if (roles.isArtist) links.push({ href: '/artist', label: 'Artist Portal' });
  if (roles.isAdmin) links.push({ href: '/admin', label: 'Admin' });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name || user.email || 'your account'}`}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: COLORS.text }}
      >
        <Avatar name={user.name} email={user.email} image={user.image} />
        {!compact && (
          <span className="hidden sm:inline" style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: COLORS.textMuted }}>
            {firstName}
          </span>
        )}
        <span aria-hidden="true" style={{ fontSize: '9px', color: COLORS.textDim }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 10px)',
            minWidth: '230px',
            background: '#0A0A0A',
            border: `1px solid ${COLORS.line}`,
            boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
            zIndex: 80,
            padding: '6px 0',
          }}
        >
          <div style={{ padding: '12px 18px 14px', borderBottom: `1px solid ${COLORS.lineSoft}`, marginBottom: '6px' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', color: COLORS.text, margin: '0 0 2px' }}>{user.name || 'Your account'}</p>
            {user.email && <p style={{ fontSize: '11px', color: COLORS.textFaint, margin: 0, wordBreak: 'break-all' }}>{user.email}</p>}
          </div>
          {links.map((link) => (
            <Link key={link.href} href={link.href} role="menuitem" className="kc-menu-item" style={menuLinkStyle} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div style={{ borderTop: `1px solid ${COLORS.lineSoft}`, marginTop: '6px', paddingTop: '6px' }}>
            <button
              type="button"
              role="menuitem"
              className="kc-menu-item"
              onClick={() => signOut({ callbackUrl: '/' })}
              style={{ ...menuLinkStyle, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
