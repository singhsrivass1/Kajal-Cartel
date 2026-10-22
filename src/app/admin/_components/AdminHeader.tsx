'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const NAV_ITEMS = [
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/vendors', label: 'Vendors' },
];

export function AdminHeader({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,8,0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid #1C1C1C' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link href="/admin" style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', letterSpacing: '0.14em', color: '#F0EBE0', textDecoration: 'none' }}>
            KAJAL CARTEL
          </Link>
          <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3A3530' }}>Admin</span>
          <nav style={{ display: 'flex', gap: '20px' }}>
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: active ? '#C9A96E' : '#5A5450', textDecoration: 'none' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#F0EBE0'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#5A5450'; }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '10px', color: '#3A3530' }}>{adminEmail}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{ background: 'none', border: 'none', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3A3530', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
