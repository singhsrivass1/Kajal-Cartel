import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getBookingPolicy } from '@/lib/booking/policy';
import { getSupportContact } from '@/lib/site/config';
import { SiteHeader } from '@/components/site/SiteHeader';
import { COLORS, FONT_DISPLAY, cardStyle, eyebrowStyle, pageTitleStyle } from '@/components/site/tokens';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Help — Kajal Cartel',
  description: 'Answers about finding an artist, requesting a booking, rescheduling, cancelling, reviews and moodboards.',
  alternates: { canonical: '/help' },
};

export default function HelpPage() {
  const policy = getBookingPolicy();
  const support = getSupportContact();

  const faqs: Array<{ q: string; a: ReactNode }> = [
    {
      q: 'How do I find the right artist?',
      a: (
        <>
          Upload a photo of a look you love on <Link href="/discover" style={{ color: COLORS.gold }}>Discover</Link> to see the artists whose work best fits it, or browse and filter the full roster by style, occasion, service, budget, area and open dates. You can also compare <Link href="/services" style={{ color: COLORS.gold }}>services and prices</Link> across artists.
        </>
      ),
    },
    {
      q: 'Does sending a booking request confirm my appointment?',
      a: 'No. A request holds the time for you while Kajal Cartel confirms it with the artist. Its status changes to Confirmed once that happens, and you can follow it in My Journey.',
    },
    {
      q: 'Do I pay online?',
      a: 'No payment is taken on this website. Estimates show the deposit that becomes due once a booking is confirmed.',
    },
    {
      q: 'How do I reschedule or cancel?',
      a: (
        <>
          Open the booking from <Link href="/journey?tab=bookings" style={{ color: COLORS.gold }}>My Journey → Bookings</Link>. Confirmed bookings can be cancelled online up to {policy.cancellationCutoffHours} hours before the appointment, and bookings can be rescheduled up to {policy.rescheduleCutoffHours} hours before (at most {policy.maxReschedules} time{policy.maxReschedules === 1 ? '' : 's'}). Full rules are in the <Link href="/policies" style={{ color: COLORS.gold }}>booking policy</Link>.
        </>
      ),
    },
    {
      q: 'Who can write reviews?',
      a: `Only clients whose booking was marked as completed, once per booking, within ${policy.reviewWindowDays} days. Reviews show the client's first name and last initial and are labelled as verified bookings.`,
    },
    {
      q: 'What are moodboards?',
      a: (
        <>
          Private boards for each event — wedding, sangeet, reception and so on — where you can collect saved looks, portfolio images, your own photos, and the artists and services you are considering. Start one from <Link href="/moodboards" style={{ color: COLORS.gold }}>Moodboards</Link>.
        </>
      ),
    },
    {
      q: 'I signed in but a page says my session expired.',
      a: 'For your security, sessions end after a period of time. Sign in again and you will be returned to the page you were on.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '820px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={eyebrowStyle}>Help</p>
        <h1 style={{ ...pageTitleStyle, marginBottom: '32px' }}>How Kajal Cartel works</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {faqs.map(({ q, a }) => (
            <details key={q} style={{ ...cardStyle, padding: '18px 22px' }}>
              <summary style={{ fontFamily: FONT_DISPLAY, fontSize: '1.15rem', color: COLORS.text, cursor: 'pointer' }}>{q}</summary>
              <div style={{ fontSize: '14px', color: COLORS.textMuted, lineHeight: 1.7, marginTop: '12px' }}>{a}</div>
            </details>
          ))}
        </div>

        <section aria-labelledby="contact-heading" style={{ ...cardStyle, padding: '22px 24px' }}>
          <h2 id="contact-heading" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', color: COLORS.text, fontWeight: 400, margin: '0 0 10px' }}>Still need help?</h2>
          {support.email || support.phone ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: COLORS.textMuted }}>
              {support.email && (
                <li>Email: <a href={`mailto:${support.email}`} style={{ color: COLORS.gold }}>{support.email}</a></li>
              )}
              {support.phone && (
                <li>Phone: <a href={`tel:${support.phone.replace(/[^\d+]/g, '')}`} style={{ color: COLORS.gold }}>{support.phone}</a></li>
              )}
              <li style={{ fontSize: '12px', color: COLORS.textDim }}>Please include your booking reference (for example KC-1A2B3C) if your question is about a booking.</li>
            </ul>
          ) : (
            <p style={{ fontSize: '14px', color: COLORS.textMuted, margin: 0, lineHeight: 1.7 }}>
              Most changes can be made yourself from <Link href="/journey" style={{ color: COLORS.gold }}>My Journey</Link>. Each artist&apos;s profile also lists the Instagram or website they share publicly.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
