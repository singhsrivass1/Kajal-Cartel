'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/customers', label: 'Customers' },
];

export function AdminHeader({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname() ?? '';

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,8,0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid #1C1C1C' }}>
      <a href="#main-content" className="kc-skip-link">Skip to content</a>
      <div className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', minHeight: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px 24px', paddingTop: '10px', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <Link href="/" style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', letterSpacing: '0.14em', color: '#F0EBE0', textDecoration: 'none' }}>
            KAJAL CARTEL
          </Link>
          <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A706A' }}>Admin</span>
          <nav aria-label="Admin" style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            {NAV_ITEMS.map(item => {
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="kc-nav-link"
                  style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: active ? '#C9A96E' : '#8A8078', textDecoration: 'none' }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '10px', color: '#7A706A' }}>{adminEmail}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="kc-nav-link"
            style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A8078', cursor: 'pointer', padding: 0 }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
