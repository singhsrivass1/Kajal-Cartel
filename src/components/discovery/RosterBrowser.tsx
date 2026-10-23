'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RosterCard } from './RosterCard';
import { COLORS, FONT_DISPLAY, fieldStyle, labelStyle } from '@/components/site/tokens';
import {
  ARCHETYPE_SHORT_LABEL,
  OCCASION_LABEL,
  SERVICE_CATEGORY_LABEL,
  labelFor,
} from '@/lib/taxonomyLabels';
import type { DiscoverVendor } from '@/types/discovery';

type SortKey = 'featured' | 'price' | 'reviews' | 'name';

interface Filters {
  q: string;
  style: string;
  occasion: string;
  service: string;
  area: string;
  travel: string;
  maxPrice: string;
  online: boolean;
  date: string;
  sort: SortKey;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  style: '',
  occasion: '',
  service: '',
  area: '',
  travel: '',
  maxPrice: '',
  online: false,
  date: '',
  sort: 'featured',
};

const PRICE_BUCKETS = [
  { value: '25000', label: 'Up to ₹25,000' },
  { value: '50000', label: 'Up to ₹50,000' },
  { value: '100000', label: 'Up to ₹1,00,000' },
];

const TRAVEL_OPTIONS = [
  { value: 'home', label: 'Comes to your home' },
  { value: 'venue', label: 'Comes to your venue' },
  { value: 'studio', label: 'Studio appointments' },
];

function readFilters(params: URLSearchParams | null): Filters {
  if (!params) return EMPTY_FILTERS;
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    style: params.get('style') ?? '',
    occasion: params.get('occasion') ?? '',
    service: params.get('service') ?? '',
    area: params.get('area') ?? '',
    travel: params.get('travel') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    online: params.get('online') === '1',
    date: /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? (params.get('date') as string) : '',
    sort: sort === 'price' || sort === 'reviews' || sort === 'name' ? sort : 'featured',
  };
}

function writeFilters(filters: Filters) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  (Object.keys(EMPTY_FILTERS) as Array<keyof Filters>).forEach((key) => params.delete(key));
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.style) params.set('style', filters.style);
  if (filters.occasion) params.set('occasion', filters.occasion);
  if (filters.service) params.set('service', filters.service);
  if (filters.area) params.set('area', filters.area);
  if (filters.travel) params.set('travel', filters.travel);
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
  if (filters.online) params.set('online', '1');
  if (filters.date) params.set('date', filters.date);
  if (filters.sort !== 'featured') params.set('sort', filters.sort);
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

function travelMatches(policy: string, wanted: string): boolean {
  if (!wanted) return true;
  if (wanted === 'home') return policy === 'home-visits' || policy === 'all';
  if (wanted === 'venue') return policy === 'venue-visits' || policy === 'all';
  return true;
}

function todayIso(): string {
  const now = new Date(Date.now() + 330 * 60_000);
  return now.toISOString().slice(0, 10);
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, fontSize: '12px', padding: '9px 10px' }}>
        <option value="" style={{ background: COLORS.panel }}>{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: COLORS.panel }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RosterBrowser({ vendors, dimmed = false }: { vendors: DiscoverVendor[]; dimmed?: boolean }) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => readFilters(searchParams));
  const [availableSlugs, setAvailableSlugs] = useState<Set<string> | null>(null);
  const [dateState, setDateState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const searchId = useId();
  const dateId = useId();
  const sortId = useId();

  useEffect(() => {
    const handle = setTimeout(() => writeFilters(filters), 250);
    return () => clearTimeout(handle);
  }, [filters]);

  useEffect(() => {
    if (!filters.date) {
      setAvailableSlugs(null);
      setDateState({ loading: false, error: null });
      return;
    }
    let cancelled = false;
    setDateState({ loading: true, error: null });
    fetch(`/api/discover/availability?date=${encodeURIComponent(filters.date)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not check availability.');
        return data as { slugs: string[] };
      })
      .then((data) => {
        if (cancelled) return;
        setAvailableSlugs(new Set(data.slugs));
        setDateState({ loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailableSlugs(null);
        setDateState({ loading: false, error: err instanceof Error ? err.message : 'Could not check availability.' });
      });
    return () => {
      cancelled = true;
    };
  }, [filters.date]);

  const options = useMemo(() => {
    const styles = new Set<string>();
    const occasions = new Set<string>();
    const services = new Set<string>();
    const areas = new Set<string>();
    for (const v of vendors) {
      v.aestheticProfile.styleArchetypes.forEach((s) => styles.add(s));
      v.facets.occasions.forEach((o) => occasions.add(o));
      v.facets.serviceCategories.forEach((c) => services.add(c));
      if (v.location.microLocation) areas.add(v.location.microLocation);
    }
    const toOptions = (set: Set<string>, map?: Record<string, string>) =>
      [...set].map((value) => ({ value, label: map ? labelFor(map, value) : value })).sort((a, b) => a.label.localeCompare(b.label));
    return {
      styles: toOptions(styles, ARCHETYPE_SHORT_LABEL),
      occasions: toOptions(occasions, OCCASION_LABEL),
      services: toOptions(services, SERVICE_CATEGORY_LABEL),
      areas: toOptions(areas),
    };
  }, [vendors]);

  const results = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null;
    const list = vendors.filter((v) => {
      if (q) {
        const haystack = [v.name, v.tagline, v.location.microLocation, ...v.aestheticProfile.styleArchetypes.map((s) => ARCHETYPE_SHORT_LABEL[s] ?? s)]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.style && !v.aestheticProfile.styleArchetypes.includes(filters.style)) return false;
      if (filters.occasion && !v.facets.occasions.includes(filters.occasion)) return false;
      if (filters.service && !v.facets.serviceCategories.includes(filters.service)) return false;
      if (filters.area && v.location.microLocation !== filters.area) return false;
      if (!travelMatches(v.location.travelPolicy, filters.travel)) return false;
      if (maxPrice !== null && (v.facets.fromPriceINR === null || v.facets.fromPriceINR > maxPrice)) return false;
      if (filters.online && !v.facets.acceptsOnlineBooking) return false;
      if (filters.date && availableSlugs && !availableSlugs.has(v.slug)) return false;
      return true;
    });
    if (filters.sort === 'price') {
      list.sort((a, b) => (a.facets.fromPriceINR ?? Number.MAX_SAFE_INTEGER) - (b.facets.fromPriceINR ?? Number.MAX_SAFE_INTEGER));
    } else if (filters.sort === 'reviews') {
      list.sort((a, b) => b.ratings.totalReviews - a.ratings.totalReviews || b.ratings.averageRating - a.ratings.averageRating);
    } else if (filters.sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [vendors, filters, availableSlugs]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((prev) => ({ ...prev, [key]: value }));
  const activeCount = (Object.keys(EMPTY_FILTERS) as Array<keyof Filters>).filter(
    (k) => k !== 'sort' && filters[k] !== EMPTY_FILTERS[k]
  ).length;

  return (
    <div>
      <form
        role="search"
        aria-label="Filter artists"
        onSubmit={(e) => e.preventDefault()}
        style={{ border: `1px solid ${COLORS.lineSoft}`, padding: '18px', marginBottom: '28px', background: '#0A0A0A' }}
      >
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor={searchId} style={labelStyle}>Search artists</label>
          <input
            id={searchId}
            type="search"
            value={filters.q}
            onChange={(e) => update('q', e.target.value)}
            placeholder="Name, area or style — e.g. “glass skin” or “Saket”"
            style={fieldStyle}
            maxLength={80}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '12px' }}>
          <FilterSelect label="Style" value={filters.style} onChange={(v) => update('style', v)} options={options.styles} allLabel="Any style" />
          <FilterSelect label="Occasion" value={filters.occasion} onChange={(v) => update('occasion', v)} options={options.occasions} allLabel="Any occasion" />
          <FilterSelect label="Service type" value={filters.service} onChange={(v) => update('service', v)} options={options.services} allLabel="Any service" />
          <FilterSelect label="Area" value={filters.area} onChange={(v) => update('area', v)} options={options.areas} allLabel="All of Delhi NCR" />
          <FilterSelect label="Travel" value={filters.travel} onChange={(v) => update('travel', v)} options={TRAVEL_OPTIONS} allLabel="Any arrangement" />
          <FilterSelect label="Starting price" value={filters.maxPrice} onChange={(v) => update('maxPrice', v)} options={PRICE_BUCKETS} allLabel="Any budget" />
          <div>
            <label htmlFor={dateId} style={labelStyle}>Available on</label>
            <input
              id={dateId}
              type="date"
              min={todayIso()}
              value={filters.date}
              onChange={(e) => update('date', e.target.value)}
              style={{ ...fieldStyle, fontSize: '12px', padding: '8px 10px', colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label htmlFor={sortId} style={labelStyle}>Sort by</label>
            <select id={sortId} value={filters.sort} onChange={(e) => update('sort', e.target.value as SortKey)} style={{ ...fieldStyle, fontSize: '12px', padding: '9px 10px' }}>
              <option value="featured" style={{ background: COLORS.panel }}>Featured first</option>
              <option value="price" style={{ background: COLORS.panel }}>Lowest starting price</option>
              <option value="reviews" style={{ background: COLORS.panel }}>Most reviewed</option>
              <option value="name" style={{ background: COLORS.panel }}>Name (A–Z)</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', color: COLORS.textMuted, cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.online} onChange={(e) => update('online', e.target.checked)} style={{ accentColor: COLORS.gold }} />
            Only artists taking online booking requests
          </label>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
              style={{ background: 'none', border: 'none', color: COLORS.gold, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}
            >
              Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </form>

      <div aria-live="polite" style={{ marginBottom: '18px', minHeight: '18px' }}>
        {dateState.loading ? (
          <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>Checking who has open times on that date…</p>
        ) : dateState.error ? (
          <p style={{ fontSize: '12px', color: COLORS.error, margin: 0 }}>{dateState.error}</p>
        ) : (
          <p style={{ fontSize: '12px', color: COLORS.textDim, margin: 0 }}>
            {results.length === vendors.length ? `Showing all ${vendors.length} artists` : `${results.length} of ${vendors.length} artists match`}
            {filters.date && availableSlugs ? ' · with at least one open time on that date' : ''}
          </p>
        )}
      </div>

      {results.length === 0 ? (
        <div style={{ border: `1px solid ${COLORS.lineSoft}`, padding: '64px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontStyle: 'italic', color: COLORS.textDim, margin: '0 0 10px' }}>
            No artists match these filters.
          </p>
          <p style={{ fontSize: '13px', color: COLORS.textFaint, margin: '0 0 20px' }}>Try removing a filter or choosing a different date.</p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            style={{ background: 'none', border: '1px solid #2D2418', color: COLORS.gold, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', padding: '11px 22px', cursor: 'pointer' }}
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '14px', opacity: dimmed ? 0.6 : 1, transition: 'opacity 0.3s' }}>
          {results.map((v, i) => (
            <RosterCard key={v._id} vendor={v} index={i} fromPriceINR={v.facets.fromPriceINR} acceptsOnlineBooking={v.facets.acceptsOnlineBooking} />
          ))}
        </div>
      )}
    </div>
  );
}
