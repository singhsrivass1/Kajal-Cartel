import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';
import { COLORS, FONT_DISPLAY } from '@/components/site/tokens';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: COLORS.gold, margin: '0 0 14px' }}>404</p>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', color: COLORS.text, fontWeight: 400, margin: '0 0 14px' }}>
          We couldn&apos;t find that page.
        </h1>
        <p style={{ fontSize: '14px', color: COLORS.textDim, lineHeight: 1.7, margin: '0 0 32px' }}>
          The link may be out of date, the artist may no longer be listed, or the page may belong to another account.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/discover" style={{ padding: '13px 22px', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, background: COLORS.gold, color: COLORS.bg, textDecoration: 'none' }}>
            Browse Artists
          </Link>
          <Link href="/journey" style={{ padding: '12px 20px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #2D2418', color: COLORS.gold, textDecoration: 'none' }}>
            My Journey
          </Link>
          <Link href="/" style={{ padding: '12px 20px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1C1C1C', color: '#8A8078', textDecoration: 'none' }}>
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
