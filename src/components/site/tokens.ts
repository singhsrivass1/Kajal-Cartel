import type { CSSProperties } from 'react';

export const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';
export const FONT_MONO = '"JetBrains Mono", "Courier New", monospace';

export const COLORS = {
  bg: '#080808',
  panel: '#0C0C0C',
  line: '#1C1C1C',
  lineSoft: '#141210',
  text: '#F0EBE0',
  textMuted: '#C8B9A8',
  textDim: '#7A706A',
  textFaint: '#5A5450',
  gold: '#C9A96E',
  goldDeep: '#8B6A1A',
  success: '#5A8A5A',
  danger: '#B45A4A',
  error: 'rgba(220,80,80,0.85)',
} as const;

export const eyebrowStyle: CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: COLORS.gold,
  margin: '0 0 10px',
};

export const pageTitleStyle: CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 'clamp(2rem, 4vw, 3rem)',
  color: COLORS.text,
  fontWeight: 400,
  margin: 0,
  lineHeight: 1.1,
};

export const cardStyle: CSSProperties = {
  border: `1px solid #1A1A1A`,
  background: COLORS.panel,
};

export const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '13px',
  background: COLORS.panel,
  border: `1px solid ${COLORS.line}`,
  color: COLORS.text,
  outline: 'none',
  fontFamily: 'inherit',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '10px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: COLORS.textDim,
  marginBottom: '6px',
};

export function primaryButtonStyle(disabled = false): CSSProperties {
  return {
    padding: '13px 22px',
    fontSize: '10px',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    fontWeight: 600,
    background: disabled ? '#3A3530' : COLORS.gold,
    color: COLORS.bg,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

export function secondaryButtonStyle(tone: 'default' | 'danger' = 'default', disabled = false): CSSProperties {
  const color = tone === 'danger' ? COLORS.danger : COLORS.gold;
  return {
    padding: '12px 20px',
    fontSize: '10px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    background: 'none',
    color,
    border: `1px solid ${tone === 'danger' ? 'rgba(180,90,74,0.6)' : '#2D2418'}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function formatIsoDate(iso: string, style: 'long' | 'short' = 'long'): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: style === 'long' ? 'short' : undefined,
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function initialsFor(name: string | null | undefined, email?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (email ?? '?').charAt(0).toUpperCase();
}
