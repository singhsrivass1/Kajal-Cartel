'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookingBuilder } from '@/components/booking/BookingBuilder';
import { SiteHeader } from '@/components/site/SiteHeader';
import { AddToBoardButton } from '@/components/boards/AddToBoardButton';
import { RatingSummary, StarRating } from '@/components/reviews/StarRating';
import { ARCHETYPE_LABEL, OCCASION_LABEL, PRICE_TYPE_LABEL, SERVICE_ROLE_LABEL, TRAVEL_LABEL, labelFor } from '@/lib/taxonomyLabels';
import { formatDuration, formatINR } from '@/components/site/tokens';
import type { ArtistProfile, ClientService } from '@/types/artist';
import type { PublicReview } from '@/lib/db/controllers/ReviewManager';
import type { BookingPolicyView } from '@/lib/booking/rules';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const BADGE_CONFIG: Record<string, { background: string; color: string }> = {
  'The Cartel Core': { background: 'linear-gradient(135deg, #C9A96E 0%, #8B6A1A 100%)', color: '#080808' },
  'Vanguard Stylist': { background: 'linear-gradient(135deg, #D0D0D0 0%, #848484 100%)', color: '#080808' },
  'Heritage Master': { background: 'linear-gradient(135deg, #6B2E3A 0%, #3D1622 100%)', color: '#C9A96E' },
};

const CONTRA_LABEL: Record<string, string> = {
  'no-airbrush': 'Does not use airbrush',
  'no-at-home-service': 'Studio appointments only — does not travel to homes',
  'no-synthetic-extensions': 'Does not use synthetic hair extensions',
  'no-heavy-contouring': 'Does not offer heavy contouring',
};

const PUBLIC_ROLES = ['anchor', 'standalone', 'trial'];

const sectionLabelStyle = { fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: '#7A706A', marginBottom: '20px' };


function HeroSection({ artist }: { artist: ArtistProfile }) {
  const badge = artist.flags.badgeType ? BADGE_CONFIG[artist.flags.badgeType] : null;
  return (
    <section style={{ position: 'relative', overflow: 'hidden', height: '78vh', minHeight: '520px', maxHeight: '820px', background: '#080808' }}>
      <img src={artist.profileImageUrl} alt={`${artist.name} — bridal artist, ${artist.location.microLocation}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080808 0%, rgba(8,8,8,0.5) 45%, rgba(8,8,8,0.12) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(8,8,8,0.3) 0%, transparent 55%)' }} />

      <div className="px-5 md:px-10" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: '56px', maxWidth: '1280px', margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          {badge && (
            <span style={{ display: 'inline-block', padding: '3px 10px', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, background: badge.background, color: badge.color, marginBottom: '16px' }}>
              {artist.flags.badgeType}
            </span>
          )}
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(3rem, 7vw, 6rem)', color: '#F0EBE0', lineHeight: 0.95, marginBottom: '14px', fontWeight: 400 }}>{artist.name}</h1>
          <p style={{ fontSize: '14px', color: '#9A8E86', marginBottom: '18px', maxWidth: '440px', lineHeight: 1.6 }}>{artist.tagline}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 16px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8A8078' }}>{artist.location.microLocation}</span>
            <span aria-hidden="true" style={{ color: '#3A3530', fontSize: '12px' }}>·</span>
            <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9A96E' }}>{artist.pricing.tier.replace(/-/g, ' ')}</span>
            <span aria-hidden="true" style={{ color: '#3A3530', fontSize: '12px' }}>·</span>
            <a href="#reviews" style={{ textDecoration: 'none' }}>
              <RatingSummary averageRating={artist.ratings.averageRating} totalReviews={artist.ratings.totalReviews} size={11} emptyLabel="No reviews yet" />
            </a>
            {artist.flags.isVerified && <><span aria-hidden="true" style={{ color: '#3A3530' }}>·</span><span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A8A5A' }}>✓ Verified by Kajal Cartel</span></>}
          </div>
          <div style={{ marginTop: '20px' }}>
            <AddToBoardButton item={{ kind: 'artist', vendorSlug: artist.slug }} label="Add artist to moodboard" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}


function Divider() {
  return <div style={{ height: '1px', background: '#141210', margin: '32px 0' }} />;
}


function AboutSection({ artist }: { artist: ArtistProfile }) {
  const ap = artist.aestheticProfile;
  const bestFor = [
    ...ap.styleArchetypes.slice(0, 2).map(t => ARCHETYPE_LABEL[t]).filter(Boolean),
    ...ap.occasionSpecializations.slice(0, 3).map(t => OCCASION_LABEL[t]).filter(Boolean),
  ];
  const notFor = ap.contraIndicators?.map(t => CONTRA_LABEL[t]).filter(Boolean) ?? [];

  return (
    <motion.section aria-labelledby="about-heading" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
      <h2 id="about-heading" style={sectionLabelStyle}>About</h2>
      {artist.bio && (
        <p style={{ fontSize: '14px', color: '#8A8078', lineHeight: 1.8, marginBottom: '20px', maxWidth: '560px' }}>{artist.bio}</p>
      )}
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', fontStyle: 'italic', color: '#B0A090', lineHeight: 1.7, marginBottom: '28px', maxWidth: '580px' }}>
        {ap.aestheticBio}
      </p>

      {ap.signatureElements && (
        <div style={{ borderLeft: '2px solid #C9A96E', paddingLeft: '20px', marginBottom: '28px' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1rem', fontStyle: 'italic', color: '#8A7E74', lineHeight: 1.7 }}>{ap.signatureElements}</p>
        </div>
      )}

      <Divider />

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '28px' }}>
        {bestFor.length > 0 && (
          <div>
            <h3 style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '14px', fontWeight: 400 }}>Best for</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bestFor.map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#C8B9A8', lineHeight: 1.5 }}>
                  <span aria-hidden="true" style={{ color: '#5A8A5A', flexShrink: 0, marginTop: '1px' }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {notFor.length > 0 && (
          <div>
            <h3 style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '14px', fontWeight: 400 }}>Not ideal for</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notFor.map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#8A7A70', lineHeight: 1.5 }}>
                  <span aria-hidden="true" style={{ color: '#8A5A4A', flexShrink: 0, marginTop: '1px' }}>✗</span> {item}
                </li>
              ))}
            </ul>
            {ap.contraIndicatorsNotes && (
              <p style={{ fontSize: '11px', color: '#6A625C', marginTop: '12px', lineHeight: 1.6 }}>{ap.contraIndicatorsNotes}</p>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}


function ServicesSection({
  artist,
  services,
  acceptsOnlineBooking,
  onBook,
}: {
  artist: ArtistProfile;
  services: ClientService[];
  acceptsOnlineBooking: boolean;
  onBook: (serviceId: string) => void;
}) {
  const listed = services
    .filter((s) => PUBLIC_ROLES.includes(s.serviceRole) && s.flags.isActive)
    .sort((a, b) => a.checkoutMeta.displayPriority - b.checkoutMeta.displayPriority || a.pricing.unitPriceINR - b.pricing.unitPriceINR);
  const addOns = services.filter((s) => s.serviceRole === 'add-on' && s.flags.isActive);
  if (listed.length === 0) return null;

  return (
    <section id="services" aria-labelledby="services-heading" style={{ scrollMarginTop: '80px' }}>
      <h2 id="services-heading" style={sectionLabelStyle}>Services &amp; Pricing</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {listed.map((s) => (
          <li key={s._id} style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '16px 18px' }}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between" style={{ gap: '10px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A706A', margin: '0 0 4px' }}>
                  {labelFor(SERVICE_ROLE_LABEL, s.serviceRole)}
                  {s.flags.isSignatureService ? ' · Signature' : ''}
                </p>
                <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.1rem', color: '#F0EBE0', fontWeight: 400, margin: '0 0 4px' }}>
                  <Link href={`/artists/${artist.slug}/services/${s.slug}`} className="kc-nav-link" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {s.name}
                  </Link>
                </h3>
                {s.description && (
                  <p style={{ fontSize: '12px', color: '#8A8078', lineHeight: 1.6, margin: '0 0 6px', maxWidth: '520px' }}>{s.description}</p>
                )}
                <p style={{ fontSize: '11px', color: '#7A706A', margin: 0 }}>
                  {formatDuration(s.duration.baseDurationMinutes)}
                  {s.aestheticSignals.occasionTags.length > 0 && ` · ${s.aestheticSignals.occasionTags.slice(0, 2).map((t) => labelFor(OCCASION_LABEL, t)).join(', ')}`}
                  {s.checkoutMeta.requiresConsultation && ' · Consultation required'}
                </p>
              </div>
              <div className="sm:text-right" style={{ flexShrink: 0 }}>
                <p style={{ fontSize: '14px', color: '#F0EBE0', margin: '0 0 2px' }}>{formatINR(s.pricing.unitPriceINR)}</p>
                <p style={{ fontSize: '10px', color: '#7A706A', margin: '0 0 10px' }}>{labelFor(PRICE_TYPE_LABEL, s.pricing.priceType)}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="sm:justify-end">
                  <Link href={`/artists/${artist.slug}/services/${s.slug}`} style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8078', textDecoration: 'none', border: '1px solid #1E1C1A', padding: '7px 10px' }}>
                    Details
                  </Link>
                  {s.serviceRole === 'anchor' && acceptsOnlineBooking && (
                    <button
                      type="button"
                      onClick={() => onBook(s._id)}
                      style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#080808', background: '#C9A96E', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
                    >
                      Book this
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {addOns.length > 0 && (
        <p style={{ fontSize: '12px', color: '#7A706A', marginTop: '14px', lineHeight: 1.6 }}>
          Add-ons for your party: {addOns.map((a) => `${a.name} (${formatINR(a.pricing.unitPriceINR)} per ${a.partyConfig.quantityLabel.toLowerCase()})`).join(' · ')}
        </p>
      )}
      {!acceptsOnlineBooking && (
        <p style={{ fontSize: '12px', color: '#8A8078', marginTop: '14px', lineHeight: 1.6 }}>
          This artist hasn&apos;t opened online scheduling yet. Prices shown are their listed rates.
        </p>
      )}
    </section>
  );
}


function PortfolioSection({ artist }: { artist: ArtistProfile }) {
  const portfolio = artist.portfolio;
  if (!portfolio.length) return null;
  return (
    <motion.section aria-labelledby="portfolio-heading" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
      <h2 id="portfolio-heading" style={sectionLabelStyle}>Portfolio</h2>
      <div className="columns-1 sm:columns-2" style={{ columnGap: '10px' }}>
        {portfolio.map((item, i) => (
          <figure key={item._id} style={{ breakInside: 'avoid', margin: '0 0 10px' }}>
            <div style={{ paddingBottom: ['133%', '125%', '100%', '125%', '133%'][i % 5], position: 'relative', overflow: 'hidden', background: '#0C0C0C' }}>
              <img src={item.imageUrl} alt={item.altText || `Portfolio image by ${artist.name}`} loading="lazy"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s ease' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
              {item.isHeroImage && (
                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                  <span style={{ fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', background: 'rgba(8,8,8,0.75)', backdropFilter: 'blur(4px)', color: '#C9A96E' }}>Featured</span>
                </div>
              )}
              <div style={{ position: 'absolute', left: '8px', bottom: '8px' }}>
                <AddToBoardButton item={{ kind: 'portfolio', vendorSlug: artist.slug, imageUrl: item.imageUrl }} label="Save" variant="chip" />
              </div>
            </div>
          </figure>
        ))}
      </div>
    </motion.section>
  );
}


function ReviewsSection({ artist, reviews }: { artist: ArtistProfile; reviews: PublicReview[] }) {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" style={{ scrollMarginTop: '80px' }}>
      <h2 id="reviews-heading" style={sectionLabelStyle}>Client Reviews</h2>
      {reviews.length === 0 ? (
        <div style={{ border: '1px solid #141210', padding: '28px 22px' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.15rem', fontStyle: 'italic', color: '#9A8E86', margin: '0 0 6px' }}>No reviews yet.</p>
          <p style={{ fontSize: '12px', color: '#7A706A', margin: 0, lineHeight: 1.6 }}>
            Reviews can only be written by clients after a completed booking with {artist.name}, so every review here comes from a real appointment.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '2.2rem', color: '#F0EBE0', lineHeight: 1 }}>{artist.ratings.averageRating.toFixed(1)}</span>
            <div>
              <StarRating value={artist.ratings.averageRating} size={14} />
              <p style={{ fontSize: '11px', color: '#7A706A', margin: '4px 0 0' }}>
                {artist.ratings.totalReviews} review{artist.ratings.totalReviews === 1 ? '' : 's'} from completed bookings
              </p>
            </div>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reviews.map((r) => (
              <li key={r.id} style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <StarRating value={r.rating} size={12} />
                  <span style={{ fontSize: '10px', color: '#7A706A' }}>
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    {r.editedAt ? ' · edited' : ''}
                  </span>
                </div>
                {r.title && <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: '#F0EBE0', margin: '0 0 6px' }}>{r.title}</p>}
                <p style={{ fontSize: '13px', color: '#B0A498', lineHeight: 1.7, margin: '0 0 10px', whiteSpace: 'pre-line' }}>{r.body}</p>
                <p style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8A8078', margin: 0 }}>
                  {r.authorDisplayName} · {r.serviceName} · <span style={{ color: '#5A8A5A' }}>Verified booking</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}


function DetailsSection({ artist }: { artist: ArtistProfile }) {
  const bm = artist.businessMeta;
  const items = [
    { label: 'Experience', value: `${bm.yearsOfExperience} years` },
    { label: 'Team', value: `${bm.teamSize} ${bm.teamSize === 1 ? 'artist' : 'artists'}` },
    { label: 'Languages', value: bm.languagesSpoken.join(', ') || 'Not listed' },
    { label: 'Advance Notice', value: bm.bookingLeadTimeDays > 0 ? `${bm.bookingLeadTimeDays} day${bm.bookingLeadTimeDays === 1 ? '' : 's'}` : 'Same-day requests possible' },
    { label: 'Service Area', value: TRAVEL_LABEL[artist.location.travelPolicy] ?? artist.location.travelPolicy },
    { label: 'Trial Sessions', value: bm.trialsOffered ? (bm.trialDurationMinutes ? `Available (${bm.trialDurationMinutes} min)` : 'Available') : 'Not offered' },
  ];

  return (
    <motion.section aria-labelledby="details-heading" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
      <h2 id="details-heading" style={sectionLabelStyle}>Details</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '10px', marginBottom: '24px' }}>
        {items.map(it => (
          <div key={it.label} style={{ border: '1px solid #141210', padding: '14px 16px' }}>
            <dt style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '5px' }}>{it.label}</dt>
            <dd style={{ fontSize: '13px', color: '#C8B9A8', margin: 0 }}>{it.value}</dd>
          </div>
        ))}
      </dl>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {artist.contact.instagram && (
          <a href={artist.contact.instagram} target="_blank" rel="noopener noreferrer" className="kc-nav-link" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1E1A18', padding: '10px 18px', color: '#8A8078', textDecoration: 'none' }}>
            View Instagram ↗
          </a>
        )}
        {artist.contact.website && (
          <a href={artist.contact.website} target="_blank" rel="noopener noreferrer" className="kc-nav-link" style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid #1E1A18', padding: '10px 18px', color: '#8A8078', textDecoration: 'none' }}>
            Website ↗
          </a>
        )}
      </div>
    </motion.section>
  );
}


interface ArtistPageClientProps {
  artist: ArtistProfile;
  services: ClientService[];
  reviews: PublicReview[];
  policy: BookingPolicyView;
  acceptsOnlineBooking: boolean;
  initialServiceId?: string;
}

export function ArtistPageClient({ artist, services, reviews, policy, acceptsOnlineBooking, initialServiceId }: ArtistPageClientProps) {
  const [preselect, setPreselect] = useState<{ id?: string; nonce: number }>({ id: initialServiceId, nonce: 0 });

  const handleBook = (serviceId: string) => {
    setPreselect((prev) => ({ id: serviceId, nonce: prev.nonce + 1 }));
    requestAnimationFrame(() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <SiteHeader position="fixed" />
      <HeroSection artist={artist} />

      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '32px' }}>
          <Link href="/discover#roster" className="kc-nav-link" style={{ fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8A8078', textDecoration: 'none' }}>
            ← All artists
          </Link>
        </nav>
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12 lg:gap-16" style={{ alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '64px', minWidth: 0 }}>
            <AboutSection artist={artist} />
            <ServicesSection artist={artist} services={services} acceptsOnlineBooking={acceptsOnlineBooking} onBook={handleBook} />
            <PortfolioSection artist={artist} />
            <ReviewsSection artist={artist} reviews={reviews} />
            <DetailsSection artist={artist} />
          </div>

          <div id="book" className="lg:sticky lg:top-[88px]" style={{ scrollMarginTop: '80px' }}>
            <BookingBuilder
              key={preselect.nonce}
              artist={artist}
              services={services}
              policy={policy}
              initialAnchorId={preselect.id}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
