'use client';

import Link from 'next/link';
import { AdminHeader } from './AdminHeader';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

export function AdminHome({ adminEmail }: { adminEmail: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={adminEmail} />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 40px 96px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '12px' }}>
          Signed in as {adminEmail}
        </p>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#F0EBE0', fontWeight: 400, marginBottom: '32px' }}>
          Admin
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', maxWidth: '820px' }}>
          {[
            { href: '/admin/bookings', title: 'Bookings', blurb: 'Review requests, confirm or decline, track status.' },
            { href: '/admin/vendors', title: 'Vendors', blurb: 'Profiles, portfolio images, services and availability.' },
          ].map(card => (
            <Link
              key={card.href}
              href={card.href}
              style={{ display: 'block', border: '1px solid #1E1C1A', padding: '20px 24px', textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2D2418'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#1E1C1A'; }}
            >
              <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3A3530', margin: '0 0 6px' }}>Manage</p>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', color: '#F0EBE0', fontWeight: 400, margin: '0 0 4px' }}>{card.title}</h2>
              <p style={{ fontSize: '12px', color: '#5A5450', margin: 0 }}>{card.blurb}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
