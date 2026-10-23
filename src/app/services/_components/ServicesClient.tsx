'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';
import { RatingSummary } from '@/components/reviews/StarRating';
import { OCCASION_LABEL, PRICE_TYPE_LABEL, SERVICE_CATEGORY_LABEL, SERVICE_ROLE_LABEL, labelFor } from '@/lib/taxonomyLabels';
import { COLORS, FONT_DISPLAY, cardStyle, eyebrowStyle, fieldStyle, formatDuration, formatINR, labelStyle, pageTitleStyle } from '@/components/site/tokens';
import type { PublicServiceSummary } from '@/lib/db/controllers/DiscoveryManager';

type Sort = 'price-asc' | 'price-desc' | 'duration' | 'name';

export function ServicesClient({ services, loadError }: { services: PublicServiceSummary[]; loadError: boolean }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [occasion, setOccasion] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<Sort>('price-asc');
  const id = useId();

  const categories = useMemo(() => [...new Set(services.map((s) => s.category))].sort(), [services]);
  const occasions = useMemo(() => [...new Set(services.flatMap((s) => s.occasions))].sort(), [services]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const limit = maxPrice ? Number(maxPrice) : null;
    const list = services.filter((s) => {
      if (query && !`${s.name} ${s.description ?? ''} ${s.vendor.name} ${s.vendor.microLocation}`.toLowerCase().includes(query)) return false;
      if (category && s.category !== category) return false;
      if (occasion && !s.occasions.includes(occasion)) return false;
      if (limit !== null && s.priceINR > limit) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === 'price-desc') return b.priceINR - a.priceINR;
      if (sort === 'duration') return a.durationMinutes - b.durationMinutes;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return a.priceINR - b.priceINR;
    });
    return list;
  }, [services, q, category, occasion, maxPrice, sort]);

  const filtersActive = Boolean(q || category || occasion || maxPrice);

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <SiteHeader />
      <main id="main-content" className="px-5 md:px-10" style={{ maxWidth: '1280px', margin: '0 auto', paddingTop: '48px', paddingBottom: '96px' }}>
        <p style={eyebrowStyle}>Services · New Delhi</p>
        <h1 style={{ ...pageTitleStyle, marginBottom: '12px' }}>Services &amp; prices</h1>
        <p style={{ fontSize: '14px', color: COLORS.textDim, maxWidth: '620px', lineHeight: 1.7, margin: '0 0 32px' }}>
          Every service our artists offer, with the price and time they list. Open a service for full details, add-ons and availability.
        </p>

        <form role="search" aria-label="Filter services" onSubmit={(e) => e.preventDefault()} style={{ border: `1px solid ${COLORS.lineSoft}`, background: '#0A0A0A', padding: '18px', marginBottom: '24px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" style={{ gap: '12px' }}>
            <div className="lg:col-span-2">
              <label htmlFor={`${id}-q`} style={labelStyle}>Search</label>
              <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} placeholder="Service, artist or area" style={fieldStyle} />
            </div>
            <div>
              <label htmlFor={`${id}-cat`} style={labelStyle}>Service type</label>
              <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
                <option value="" style={{ background: COLORS.panel }}>All types</option>
                {categories.map((c) => <option key={c} value={c} style={{ background: COLORS.panel }}>{labelFor(SERVICE_CATEGORY_LABEL, c)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-occ`} style={labelStyle}>Occasion</label>
              <select id={`${id}-occ`} value={occasion} onChange={(e) => setOccasion(e.target.value)} style={fieldStyle}>
                <option value="" style={{ background: COLORS.panel }}>Any occasion</option>
                {occasions.map((o) => <option key={o} value={o} style={{ background: COLORS.panel }}>{labelFor(OCCASION_LABEL, o)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-price`} style={labelStyle}>Budget</label>
              <select id={`${id}-price`} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={fieldStyle}>
                <option value="" style={{ background: COLORS.panel }}>Any price</option>
                <option value="10000" style={{ background: COLORS.panel }}>Up to ₹10,000</option>
                <option value="25000" style={{ background: COLORS.panel }}>Up to ₹25,000</option>
                <option value="50000" style={{ background: COLORS.panel }}>Up to ₹50,000</option>
                <option value="100000" style={{ background: COLORS.panel }}>Up to ₹1,00,000</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor={`${id}-sort`} style={{ ...labelStyle, margin: 0 }}>Sort</label>
              <select id={`${id}-sort`} value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ ...fieldStyle, width: 'auto', padding: '7px 10px', fontSize: '12px' }}>
                <option value="price-asc" style={{ background: COLORS.panel }}>Price: low to high</option>
                <option value="price-desc" style={{ background: COLORS.panel }}>Price: high to low</option>
                <option value="duration" style={{ background: COLORS.panel }}>Shortest first</option>
                <option value="name" style={{ background: COLORS.panel }}>Name (A–Z)</option>
              </select>
            </div>
            {filtersActive && (
              <button type="button" onClick={() => { setQ(''); setCategory(''); setOccasion(''); setMaxPrice(''); }} style={{ background: 'none', border: 'none', color: COLORS.gold, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
                Clear filters
              </button>
            )}
          </div>
        </form>

        <p aria-live="polite" style={{ fontSize: '12px', color: COLORS.textDim, margin: '0 0 18px' }}>
          {loadError ? '' : `${results.length} of ${services.length} services`}
        </p>

        {loadError ? (
          <div role="alert" style={{ border: '1px solid #2A1A18', padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', color: COLORS.textMuted, margin: '0 0 8px' }}>We couldn&apos;t load services right now.</p>
            <p style={{ fontSize: '13px', color: COLORS.textDim, margin: 0 }}>Please refresh the page in a moment.</p>
          </div>
        ) : results.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '56px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', fontStyle: 'italic', color: '#8A8078', margin: '0 0 8px' }}>
              {services.length === 0 ? 'No services are listed yet.' : 'No services match these filters.'}
            </p>
            {services.length > 0 && <p style={{ fontSize: '13px', color: COLORS.textDim, margin: 0 }}>Try a different type, occasion or budget.</p>}
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: '14px', listStyle: 'none', padding: 0, margin: 0 }}>
            {results.map((s) => (
              <li key={s.id} style={{ ...cardStyle, padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: COLORS.gold, margin: '0 0 6px' }}>
                  {labelFor(SERVICE_CATEGORY_LABEL, s.category)} · {labelFor(SERVICE_ROLE_LABEL, s.serviceRole)}
                </p>
                <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', color: COLORS.text, fontWeight: 400, margin: '0 0 4px' }}>
                  <Link href={`/artists/${s.vendor.slug}/services/${s.slug}`} className="kc-nav-link" style={{ color: 'inherit', textDecoration: 'none' }}>{s.name}</Link>
                </h2>
                <p style={{ fontSize: '12px', color: COLORS.textDim, margin: '0 0 10px' }}>
                  by <Link href={`/artists/${s.vendor.slug}`} style={{ color: COLORS.textMuted }}>{s.vendor.name}</Link>
                  {s.vendor.microLocation ? ` · ${s.vendor.microLocation}` : ''}
                </p>
                {s.description && (
                  <p style={{ fontSize: '12px', color: COLORS.textDim, lineHeight: 1.6, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</p>
                )}
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10px', borderTop: `1px solid ${COLORS.lineSoft}`, paddingTop: '12px' }}>
                  <div>
                    <p style={{ fontSize: '15px', color: COLORS.text, margin: '0 0 2px' }}>{formatINR(s.priceINR)}</p>
                    <p style={{ fontSize: '10px', color: COLORS.textDim, margin: 0 }}>{labelFor(PRICE_TYPE_LABEL, s.priceType)} · {formatDuration(s.durationMinutes)}</p>
                  </div>
                  <RatingSummary averageRating={s.vendor.ratings.averageRating} totalReviews={s.vendor.ratings.totalReviews} size={11} showEmpty={false} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
