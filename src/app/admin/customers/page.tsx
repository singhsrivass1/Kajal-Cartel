import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/pageGuards';
import { dbConnect } from '@/lib/db/connect';
import { listCustomersForAdmin } from '@/lib/db/controllers/AdminInsightsManager';
import { AdminHeader } from '../_components/AdminHeader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customers — Admin — Kajal Cartel',
  robots: { index: false, follow: false },
};

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

export default async function AdminCustomersPage({ searchParams }: { searchParams?: { q?: string; page?: string } }) {
  const session = await requireAdminPage('/admin/customers');
  await dbConnect();
  const result = await listCustomersForAdmin(searchParams?.q, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (page: number) => `/admin/customers?${new URLSearchParams({ ...(result.q ? { q: result.q } : {}), ...(page > 1 ? { page: String(page) } : {}) }).toString()}`;

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={session.user?.email ?? ''} />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '8px' }}>{result.total} accounts</p>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 2.6rem)', color: '#F0EBE0', fontWeight: 400, margin: '0 0 10px' }}>Customers</h1>
        <p style={{ fontSize: '12px', color: '#7A706A', margin: '0 0 20px', maxWidth: '680px', lineHeight: 1.6 }}>
          Contact details shown here are for managing bookings only. Passwords, sign-in tokens and saved images are never displayed. Admin accounts are not listed.
        </p>
        <form method="get" action="/admin/customers" role="search" style={{ display: 'flex', gap: '10px', marginBottom: '20px', maxWidth: '560px' }}>
          <label htmlFor="c-q" className="sr-only">Search customers</label>
          <input id="c-q" name="q" defaultValue={result.q} maxLength={100} placeholder="Name, email or phone" style={{ flex: 1, padding: '9px 11px', fontSize: '12px', background: '#080808', border: '1px solid #1C1C1C', color: '#F0EBE0', fontFamily: 'inherit' }} />
          <button type="submit" style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', padding: '0 16px', background: '#C9A96E', color: '#080808', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Search</button>
        </form>

        {result.rows.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '56px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', fontStyle: 'italic', color: '#8A8078', margin: 0 }}>No accounts found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #1A1A1A' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '760px' }}>
              <caption className="sr-only">Customer accounts</caption>
              <thead>
                <tr style={{ background: '#0C0C0C' }}>
                  {['Name', 'Email', 'Phone', 'Joined', 'Bookings', 'Active', 'Last request', 'Role', ''].map((h) => (
                    <th key={h} scope="col" style={{ textAlign: 'left', padding: '10px 12px', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A706A', fontWeight: 400, borderBottom: '1px solid #1A1A1A' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #141210' }}>
                    <td style={{ padding: '10px 12px', color: '#F0EBE0' }}>{r.name || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#C8B9A8', wordBreak: 'break-all' }}>{r.email}</td>
                    <td style={{ padding: '10px 12px', color: '#C8B9A8' }}>{r.phone || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#8A8078' }}>{new Date(r.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '10px 12px', color: '#C8B9A8' }}>{r.bookingCount}</td>
                    <td style={{ padding: '10px 12px', color: '#C8B9A8' }}>{r.activeBookingCount}</td>
                    <td style={{ padding: '10px 12px', color: '#8A8078' }}>{r.lastBookingAt ? new Date(r.lastBookingAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td style={{ padding: '10px 12px', color: r.role === 'artist' ? '#C9A96E' : '#8A8078' }}>{r.role === 'artist' ? `Artist${r.linkedArtist ? ` · ${r.linkedArtist}` : ''}` : 'Customer'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.bookingCount > 0 && (
                        <Link href={`/admin/bookings?q=${encodeURIComponent(r.email)}`} style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C9A96E', whiteSpace: 'nowrap' }}>Bookings</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: '11px', color: '#5A5450', margin: '10px 0 0' }}>Booking search matches the contact email given on each booking.</p>

        {pages > 1 && (
          <nav aria-label="Pagination" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            {result.page > 1 ? <Link href={href(result.page - 1)} style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C9A96E' }}>← Previous</Link> : <span />}
            <span style={{ fontSize: '11px', color: '#7A706A' }}>Page {result.page} of {pages}</span>
            {result.page < pages ? <Link href={href(result.page + 1)} style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C9A96E' }}>Next →</Link> : <span />}
          </nav>
        )}
      </main>
    </div>
  );
}
