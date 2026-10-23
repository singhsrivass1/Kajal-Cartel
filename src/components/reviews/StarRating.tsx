'use client';

import { useId } from 'react';

export function StarRating({ value, size = 13, label }: { value: number; size?: number; label?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span role="img" aria-label={label ?? `${value.toFixed(1)} out of 5 stars`} style={{ display: 'inline-flex', gap: '2px', lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rounded >= n ? 1 : rounded >= n - 0.5 ? 0.5 : 0;
        return (
          <span key={n} aria-hidden="true" style={{ position: 'relative', fontSize: size, color: '#2A2520' }}>
            ★
            {fill > 0 && (
              <span style={{ position: 'absolute', left: 0, top: 0, width: fill === 1 ? '100%' : '50%', overflow: 'hidden', color: '#C9A96E' }}>★</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function RatingSummary({
  averageRating,
  totalReviews,
  size = 12,
  emptyLabel = 'No reviews yet',
  showEmpty = true,
}: {
  averageRating: number;
  totalReviews: number;
  size?: number;
  emptyLabel?: string;
  showEmpty?: boolean;
}) {
  if (totalReviews <= 0) {
    return showEmpty ? <span style={{ fontSize: size - 1, color: '#4A4440' }}>{emptyLabel}</span> : null;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: size }}>
      <span aria-hidden="true" style={{ color: '#C9A96E' }}>★</span>
      <span style={{ color: '#F0EBE0' }}>{averageRating.toFixed(1)}</span>
      <span style={{ color: '#5A5450' }}>
        ({totalReviews} verified review{totalReviews === 1 ? '' : 's'})
      </span>
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  legend = 'Your rating',
}: {
  value: number;
  onChange: (rating: number) => void;
  legend?: string;
}) {
  const name = useId();
  const labels = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A706A', marginBottom: '8px' }}>{legend}</legend>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="kc-star-option" style={{ cursor: 'pointer', fontSize: '26px', lineHeight: 1, color: value >= n ? '#C9A96E' : '#2A2520', padding: '2px' }}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              aria-label={`${n} star${n === 1 ? '' : 's'} — ${labels[n - 1]}`}
            />
            <span aria-hidden="true">★</span>
          </label>
        ))}
        <span style={{ fontSize: '11px', color: '#7A706A', marginLeft: '10px' }}>{value > 0 ? labels[value - 1] : 'Choose a rating'}</span>
      </div>
    </fieldset>
  );
}
