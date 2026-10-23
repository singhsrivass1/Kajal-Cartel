import type { Metadata } from 'next';
import Link from 'next/link';
import { requireArtistPage } from '@/lib/auth/pageGuards';
import { dbConnect } from '@/lib/db/connect';
import { getArtistSchedule } from '@/lib/db/controllers/ArtistPortalManager';
import type { ArtistAppointment } from '@/lib/db/controllers/ArtistPortalManager';
import { SiteHeader } from '@/components/site/SiteHeader';
import { StatusBadge } from '@/components/booking/StatusBadge';
import { COLORS, FONT_DISPLAY, cardStyle, eyebrowStyle, formatIsoDate, formatSlotLabel, pageTitleStyle } from '@/components/site/tokens';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Artist Portal — Kajal Cartel',
  robots: { index: false, follow: false },
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function AppointmentCard({ a }: { a: ArtistAppointment }) {
  return (
    <li style={{ ...cardStyle, padding: '16px 18px', listStyle: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: COLORS.text, margin: '0 0 2px' }}>
            {formatIsoDate(a.date)} · {formatSlotLabel(a.startTime)}–{formatSlotLabel(a.endTime)}
          </p>
          <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>{a.serviceName}{a.partySummary ? ` · ${a.partySummary}` : ''} · {a.ref}</p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: 0 }}>
        Client: {a.clientName}
        {a.clientPhone ? <> · <a href={`tel:${a.clientPhone.replace(/[^\d+]/g, '')}`} style={{ color: COLORS.gold }}>{a.clientPhone}</a></> : null}
        {a.clientEmail ? <> · {a.clientEmail}</> : null}
      </p>
      {!a.clientPhone && a.status === 'PENDING' && (
        <p style={{ fontSize: '11px', color: COLORS.textFaint, margin: '4px 0 0' }}>Contact details appear once Kajal Cartel confirms this request.</p>
      )}
      {a.customerNotes && (
        <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '8px 0 0', borderLeft: '2px solid #2A2520', paddingLeft: '10px' }}>Note: {a.customerNotes}</p>
      )}
    </li>
  );
}

export default async function ArtistPortalPage() {
  const { artist } = await requireArtistPage('/artist');
  await dbConnect();
  const schedule = await getArtistSchedule(artist.vendorId);
  const confirmedCount = schedule.upcoming.filter((a) => a.status === 'CONFIRMED').length;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader label="Artist portal" />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1180px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={eyebrowStyle}>Artist portal</p>
        <h1 style={{ ...pageTitleStyle, marginBottom: '10px' }}>{artist.vendorName}</h1>
        <p style={{ fontSize: '13px', color: COLORS.textDim, margin: '0 0 28px', lineHeight: 1.6, maxWidth: '680px' }}>
          Your appointments and schedule as held by Kajal Cartel. This view is read-only — to change hours, block dates, or update a booking, contact the Kajal Cartel team.{' '}
          <Link href={`/artists/${artist.vendorSlug}`} style={{ color: COLORS.gold }}>View your public profile</Link>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: '12px', marginBottom: '32px', maxWidth: '640px' }}>
          {[
            [schedule.upcoming.length, 'Upcoming'],
            [confirmedCount, 'Confirmed'],
            [schedule.upcoming.length - confirmedCount, 'Awaiting confirmation'],
          ].map(([v, l]) => (
            <div key={String(l)} style={{ border: '1px solid #1E1C1A', padding: '14px 16px' }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.7rem', color: COLORS.gold, margin: '0 0 2px' }}>{v}</p>
              <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.textDim, margin: 0 }}>{l}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr]" style={{ gap: '24px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <section aria-labelledby="upcoming-heading">
              <h2 id="upcoming-heading" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', color: COLORS.text, fontWeight: 400, margin: '0 0 14px' }}>Upcoming appointments</h2>
              {schedule.upcoming.length === 0 ? (
                <p style={{ fontSize: '13px', color: COLORS.textDim, border: '1px solid #161412', padding: '28px', margin: 0 }}>No upcoming appointments.</p>
              ) : (
                <ul style={{ padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {schedule.upcoming.map((a) => <AppointmentCard key={a.id} a={a} />)}
                </ul>
              )}
            </section>
            <section aria-labelledby="recent-heading">
              <h2 id="recent-heading" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', color: COLORS.text, fontWeight: 400, margin: '0 0 14px' }}>Last 30 days</h2>
              {schedule.recent.length === 0 ? (
                <p style={{ fontSize: '13px', color: COLORS.textDim, border: '1px solid #161412', padding: '28px', margin: 0 }}>No appointments in the last 30 days.</p>
              ) : (
                <ul style={{ padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {schedule.recent.map((a) => <AppointmentCard key={a.id} a={a} />)}
                </ul>
              )}
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <section aria-labelledby="hours-heading" style={{ ...cardStyle, padding: '18px 20px' }}>
              <h2 id="hours-heading" style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 12px', fontWeight: 400 }}>Working hours (IST)</h2>
              {schedule.workingHours.length === 0 ? (
                <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>Online scheduling is not set up yet.</p>
              ) : (
                <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[...schedule.workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((w) => (
                    <div key={w.dayOfWeek} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <dt style={{ color: COLORS.textDim }}>{DAYS[w.dayOfWeek]}</dt>
                      <dd style={{ color: w.isOpen ? COLORS.textMuted : COLORS.textFaint, margin: 0 }}>{w.isOpen ? `${formatSlotLabel(w.startTime)} – ${formatSlotLabel(w.endTime)}` : 'Closed'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
            <section aria-labelledby="blocked-heading" style={{ ...cardStyle, padding: '18px 20px' }}>
              <h2 id="blocked-heading" style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 12px', fontWeight: 400 }}>Time off</h2>
              {schedule.blockedDates.length === 0 ? (
                <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>No upcoming blocked dates.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {schedule.blockedDates.map((b) => (
                    <li key={`${b.startDate}-${b.endDate}`} style={{ fontSize: '12px', color: COLORS.textMuted }}>
                      {formatIsoDate(b.startDate, 'short')}{b.endDate !== b.startDate ? ` – ${formatIsoDate(b.endDate, 'short')}` : ''}
                      {b.reason ? <span style={{ color: COLORS.textDim }}> · {b.reason}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
