'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app-error]', error.digest ?? error.name);
  }, [error]);

  return (
    <main id="main-content" style={{ minHeight: '70vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
      <div style={{ maxWidth: '560px', textAlign: 'center' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#C9A96E', margin: '0 0 14px' }}>Something went wrong</p>
        <h1 style={{ fontFamily: '"Cormorant Garamond", "Cormorant", Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: '#F0EBE0', fontWeight: 400, margin: '0 0 14px' }}>
          We couldn&apos;t load this page.
        </h1>
        <p style={{ fontSize: '14px', color: '#7A706A', lineHeight: 1.7, margin: '0 0 28px' }}>
          This is usually temporary. Please try again.
          {error.digest ? ` (Reference ${error.digest})` : ''}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={reset} style={{ padding: '13px 22px', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, background: '#C9A96E', color: '#080808', border: 'none', cursor: 'pointer' }}>
            Try again
          </button>
          <Link href="/" style={{ padding: '12px 20px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #2D2418', color: '#C9A96E', textDecoration: 'none' }}>
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
