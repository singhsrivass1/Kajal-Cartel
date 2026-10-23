import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dbConnect } from '@/lib/db/connect';
import { getPublicServiceDetail } from '@/lib/db/controllers/DiscoveryManager';
import { getBookingPolicy } from '@/lib/booking/policy';
import { SiteHeader } from '@/components/site/SiteHeader';
import { AddToBoardButton } from '@/components/boards/AddToBoardButton';
import { RatingSummary } from '@/components/reviews/StarRating';
import { OCCASION_LABEL, PRICE_TYPE_LABEL, SERVICE_CATEGORY_LABEL, SERVICE_ROLE_LABEL, labelFor } from '@/lib/taxonomyLabels';
import { COLORS, FONT_DISPLAY, cardStyle, eyebrowStyle, formatDuration, formatINR } from '@/components/site/tokens';
import { getSiteUrl } from '@/lib/site/config';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string; serviceSlug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    await dbConnect();
    const service = await getPublicServiceDetail(params.slug, params.serviceSlug);
    if (service) {
      const title = `${service.name} by ${service.vendor.name} — Kajal Cartel`;
      const description = `${service.description ?? `${labelFor(SERVICE_CATEGORY_LABEL, service.category)} by ${service.vendor.name}.`} ${formatINR(service.priceINR)} ${labelFor(PRICE_TYPE_LABEL, service.priceType)}, about ${formatDuration(service.durationMinutes)}.`.slice(0, 300);
      return {
        title,
        description,
        alternates: { canonical: `/artists/${params.slug}/services/${params.serviceSlug}` },
        openGraph: {
          title,
          description,
          url: `/artists/${params.slug}/services/${params.serviceSlug}`,
          ...(service.vendor.profileImageUrl ? { images: [{ url: service.vendor.profileImageUrl, alt: service.vendor.name }] } : {}),
        },
      };
    }
  } catch (err) {
    console.error(`[generateMetadata service ${params.slug}/${params.serviceSlug}]`, err);
  }
  return { title: 'Service — Kajal Cartel', robots: { index: false } };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  await dbConnect();
  const service = await getPublicServiceDetail(params.slug, params.serviceSlug);
  if (!service) notFound();
  const policy = getBookingPolicy();
  const siteUrl = getSiteUrl();
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: labelFor(SERVICE_CATEGORY_LABEL, service.category),
    description: service.description,
    provider: {
      '@type': 'BeautySalon',
      name: service.vendor.name,
      url: siteUrl ? new URL(`/artists/${service.vendor.slug}`, siteUrl).toString() : `/artists/${service.vendor.slug}`,
    },
    areaServed: `${service.vendor.microLocation}, New Delhi`,
    offers: { '@type': 'Offer', price: service.priceINR, priceCurrency: 'INR' },
  }).replace(/</g, '\\u003c');

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1040px', margin: '0 auto', paddingTop: '40px', paddingBottom: '96px' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '24px', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          <Link href="/services" className="kc-nav-link" style={{ color: '#8A8078', textDecoration: 'none' }}>Services</Link>
          <span aria-hidden="true" style={{ color: '#3A3530', margin: '0 8px' }}>/</span>
          <Link href={`/artists/${service.vendor.slug}`} className="kc-nav-link" style={{ color: '#8A8078', textDecoration: 'none' }}>{service.vendor.name}</Link>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr]" style={{ gap: '32px', alignItems: 'start' }}>
          <div>
            <p style={eyebrowStyle}>
              {labelFor(SERVICE_CATEGORY_LABEL, service.category)} · {labelFor(SERVICE_ROLE_LABEL, service.serviceRole)}
              {service.isSignature ? ' · Signature' : ''}
            </p>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: COLORS.text, fontWeight: 400, lineHeight: 1.05, margin: '0 0 12px' }}>
              {service.name}
            </h1>
            <p style={{ fontSize: '14px', color: COLORS.textDim, margin: '0 0 22px' }}>
              by <Link href={`/artists/${service.vendor.slug}`} style={{ color: COLORS.textMuted }}>{service.vendor.name}</Link>
              {service.vendor.microLocation ? ` · ${service.vendor.microLocation}` : ''} ·{' '}
              <RatingSummary averageRating={service.vendor.ratings.averageRating} totalReviews={service.vendor.ratings.totalReviews} size={12} />
            </p>
            {service.description ? (
              <p style={{ fontSize: '15px', color: COLORS.textMuted, lineHeight: 1.8, margin: '0 0 28px', maxWidth: '620px' }}>{service.description}</p>
            ) : (
              <p style={{ fontSize: '14px', color: COLORS.textDim, margin: '0 0 28px' }}>The artist hasn&apos;t added a description for this service yet.</p>
            )}

            {service.occasions.length > 0 && (
              <section aria-labelledby="occasions-heading" style={{ marginBottom: '28px' }}>
                <h2 id="occasions-heading" style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 10px', fontWeight: 400 }}>Suited to</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {service.occasions.map((o) => (
                    <li key={o} style={{ border: '1px solid #2D2418', padding: '5px 10px', fontSize: '12px', color: COLORS.textMuted }}>{labelFor(OCCASION_LABEL, o)}</li>
                  ))}
                </ul>
              </section>
            )}

            {service.addOns.length > 0 && (
              <section aria-labelledby="addons-heading" style={{ marginBottom: '28px' }}>
                <h2 id="addons-heading" style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 10px', fontWeight: 400 }}>Optional add-ons for your party</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {service.addOns.map((a) => (
                    <li key={a.id} style={{ ...cardStyle, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: COLORS.textMuted }}>
                      <span>{a.name}</span>
                      <span style={{ color: COLORS.text }}>{formatINR(a.priceINR)} per {a.quantityLabel.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {service.otherServices.length > 0 && (
              <section aria-labelledby="other-heading">
                <h2 id="other-heading" style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: COLORS.textDim, margin: '0 0 10px', fontWeight: 400 }}>More from {service.vendor.name}</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {service.otherServices.map((o) => (
                    <li key={o.id}>
                      <Link href={`/artists/${service.vendor.slug}/services/${o.slug}`} className="kc-menu-item" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', border: `1px solid ${COLORS.line}`, fontSize: '13px', color: COLORS.textMuted, textDecoration: 'none' }}>
                        <span>{o.name}</span>
                        <span>{formatINR(o.priceINR)} · {formatDuration(o.durationMinutes)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside aria-label="Price and booking" className="md:sticky md:top-[88px]" style={{ ...cardStyle, padding: '22px' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '2rem', color: COLORS.text, margin: '0 0 2px' }}>{formatINR(service.priceINR)}</p>
            <p style={{ fontSize: '11px', color: COLORS.textDim, margin: '0 0 18px' }}>{labelFor(PRICE_TYPE_LABEL, service.priceType)}</p>
            <dl style={{ margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                ['Duration', formatDuration(service.durationMinutes)],
                ...(service.bufferMinutes > 0 ? [['Preparation time', `${service.bufferMinutes} min reserved after`]] : []),
                ['Advance notice', service.leadTimeDays > 0 ? `${service.leadTimeDays} day${service.leadTimeDays === 1 ? '' : 's'}` : 'Same-day requests possible'],
                ...(service.requiresConsultation ? [['Consultation', 'Required before confirmation']] : []),
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }}>
                  <dt style={{ color: COLORS.textDim }}>{label}</dt>
                  <dd style={{ color: COLORS.textMuted, margin: 0, textAlign: 'right' }}>{value}</dd>
                </div>
              ))}
            </dl>
            {service.acceptsOnlineBooking ? (
              <Link
                href={`/artists/${service.vendor.slug}?service=${service.id}#book`}
                style={{ display: 'block', textAlign: 'center', padding: '14px 0', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, background: COLORS.gold, color: COLORS.bg, textDecoration: 'none', marginBottom: '10px' }}
              >
                Request this service
              </Link>
            ) : (
              <p style={{ fontSize: '12px', color: COLORS.textDim, lineHeight: 1.6, margin: '0 0 12px' }}>
                {service.serviceRole === 'anchor'
                  ? 'This artist has not opened online scheduling yet.'
                  : 'This service cannot be requested online yet.'}{' '}
                <Link href={`/artists/${service.vendor.slug}`} style={{ color: COLORS.gold }}>View the artist</Link>.
              </p>
            )}
            <AddToBoardButton item={{ kind: 'service', vendorSlug: service.vendor.slug, serviceId: service.id }} label="Save to moodboard" />
            <p style={{ fontSize: '11px', color: COLORS.textDim, lineHeight: 1.6, margin: '16px 0 0' }}>
              Requests are confirmed by Kajal Cartel. Confirmed bookings can be cancelled online up to {policy.cancellationCutoffHours} hours before the appointment.{' '}
              <Link href="/policies" style={{ color: COLORS.gold }}>Booking policy</Link>
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
