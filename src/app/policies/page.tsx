import type { Metadata } from 'next';
import Link from 'next/link';
import { getBookingPolicy } from '@/lib/booking/policy';
import { describeBookingPolicy } from '@/lib/booking/rules';
import { getSupportContact } from '@/lib/site/config';
import { SiteHeader } from '@/components/site/SiteHeader';
import { COLORS, cardStyle, eyebrowStyle, pageTitleStyle } from '@/components/site/tokens';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Booking & Cancellation Policy — Kajal Cartel',
  description: 'How booking requests, confirmation, rescheduling, cancellation and reviews work on Kajal Cartel.',
  alternates: { canonical: '/policies' },
};

export default function PoliciesPage() {
  const policy = getBookingPolicy();
  const lines = describeBookingPolicy(policy);
  const support = getSupportContact();

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '820px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={eyebrowStyle}>Policies</p>
        <h1 style={{ ...pageTitleStyle, marginBottom: '14px' }}>Booking &amp; cancellation policy</h1>
        <p style={{ fontSize: '14px', color: COLORS.textDim, lineHeight: 1.7, margin: '0 0 32px' }}>
          These rules are applied automatically when you request, reschedule or cancel a booking on this website.
        </p>

        <section aria-labelledby="rules-heading" style={{ ...cardStyle, padding: '24px 26px', marginBottom: '20px' }}>
          <h2 id="rules-heading" style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 16px', fontWeight: 400 }}>The rules</h2>
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lines.map((line) => (
              <li key={line} style={{ fontSize: '14px', color: COLORS.textMuted, lineHeight: 1.7 }}>{line}</li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="statuses-heading" style={{ ...cardStyle, padding: '24px 26px', marginBottom: '20px' }}>
          <h2 id="statuses-heading" style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 16px', fontWeight: 400 }}>What each status means</h2>
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ['Awaiting confirmation', 'Your request has been received and the time is held for you while it is reviewed.'],
              ['Confirmed', 'Kajal Cartel has confirmed the appointment with the artist.'],
              ['Declined', 'The request could not be accommodated. The time is released.'],
              ['Cancelled', 'The booking was cancelled by you or by Kajal Cartel. The time is released.'],
              ['Completed', 'The appointment took place. You can now leave a review.'],
            ].map(([term, desc]) => (
              <div key={term}>
                <dt style={{ fontSize: '13px', color: COLORS.text }}>{term}</dt>
                <dd style={{ fontSize: '13px', color: COLORS.textDim, margin: '2px 0 0', lineHeight: 1.6 }}>{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p style={{ fontSize: '13px', color: COLORS.textDim, lineHeight: 1.7 }}>
          All times are in India Standard Time. Manage your bookings from <Link href="/journey?tab=bookings" style={{ color: COLORS.gold }}>My Journey</Link>.
          {support.email ? (
            <> For anything that can&apos;t be done online, email <a href={`mailto:${support.email}`} style={{ color: COLORS.gold }}>{support.email}</a>.</>
          ) : (
            <> See <Link href="/help" style={{ color: COLORS.gold }}>Help</Link> for more.</>
          )}
        </p>
      </main>
    </div>
  );
}
