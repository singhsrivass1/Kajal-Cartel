'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountMenu } from './AccountMenu';
import { COLORS, FONT_DISPLAY } from './tokens';

export const PRIMARY_NAV: Array<{ href: string; label: string }> = [
  { href: '/discover', label: 'Discover' },
  { href: '/services', label: 'Services' },
  { href: '/moodboards', label: 'Moodboards' },
  { href: '/help', label: 'Help' },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({
  variant = 'solid',
  position = 'sticky',
  leading,
  label,
}: {
  variant?: 'solid' | 'overlay';
  position?: 'sticky' | 'fixed' | 'absolute';
  leading?: ReactNode;
  label?: string;
}) {
  const pathname = usePathname() ?? '/';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const overlay = variant === 'overlay' && !scrolled && !mobileOpen;

  return (
    <header
      style={{
        position,
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: overlay ? 'transparent' : 'rgba(8,8,8,0.94)',
        backdropFilter: overlay ? undefined : 'blur(24px)',
        WebkitBackdropFilter: overlay ? undefined : 'blur(24px)',
        borderBottom: `1px solid ${overlay || !scrolled && position !== 'sticky' ? 'transparent' : COLORS.line}`,
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      <a href="#main-content" className="kc-skip-link">
        Skip to content
      </a>
      <div className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px', minWidth: 0 }}>
          <Link href="/" style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', letterSpacing: '0.14em', color: COLORS.text, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            KAJAL CARTEL
          </Link>
          {label && (
            <span className="hidden sm:inline" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: COLORS.textFaint }}>
              {label}
            </span>
          )}
          {leading}
        </div>

        <nav aria-label="Main" className="hidden md:flex" style={{ alignItems: 'center', gap: '26px' }}>
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="kc-nav-link"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: active ? COLORS.gold : overlay ? COLORS.text : '#8A8078',
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <AccountMenu />
        </nav>

        <div className="flex md:hidden" style={{ alignItems: 'center', gap: '14px' }}>
          <AccountMenu compact />
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="kc-mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((v) => !v)}
            style={{ background: 'none', border: `1px solid ${COLORS.line}`, color: COLORS.text, width: 38, height: 34, cursor: 'pointer', fontSize: '15px' }}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="kc-mobile-nav" aria-label="Main" className="md:hidden" style={{ borderTop: `1px solid ${COLORS.line}`, background: '#080808', padding: '8px 20px 16px' }}>
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              style={{
                display: 'block',
                padding: '12px 0',
                fontSize: '11px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: isActive(pathname, item.href) ? COLORS.gold : COLORS.text,
                textDecoration: 'none',
                borderBottom: `1px solid ${COLORS.lineSoft}`,
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/journey" style={{ display: 'block', padding: '12px 0', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: COLORS.text, textDecoration: 'none' }}>
            My Journey
          </Link>
        </nav>
      )}
    </header>
  );
}
