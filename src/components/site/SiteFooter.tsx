import Link from 'next/link';
import { getSupportContact } from '@/lib/site/config';

const linkStyle = {
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: '#5A5450',
  textDecoration: 'none',
};

export function SiteFooter() {
  const support = getSupportContact();
  return (
    <footer style={{ borderTop: '1px solid #141210', background: '#080808', padding: '36px 20px 40px' }}>
      <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px 28px', marginBottom: '20px' }}>
        <Link href="/discover" className="kc-nav-link" style={linkStyle}>Discover</Link>
        <Link href="/services" className="kc-nav-link" style={linkStyle}>Services</Link>
        <Link href="/moodboards" className="kc-nav-link" style={linkStyle}>Moodboards</Link>
        <Link href="/policies" className="kc-nav-link" style={linkStyle}>Booking Policy</Link>
        <Link href="/help" className="kc-nav-link" style={linkStyle}>Help</Link>
        {support.email && (
          <a href={`mailto:${support.email}`} className="kc-nav-link" style={linkStyle}>Contact</a>
        )}
      </nav>
      <p style={{ fontSize: '9px', letterSpacing: '0.36em', textTransform: 'uppercase', color: '#2A2620', margin: 0, textAlign: 'center' }}>
        Kajal Cartel · New Delhi · Bridal Beauty
      </p>
    </footer>
  );
}
