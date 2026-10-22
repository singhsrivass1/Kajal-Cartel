'use client';

import type { CSSProperties, ReactNode } from 'react';

export const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  fontSize: '12px',
  background: '#080808',
  border: '1px solid #1C1C1C',
  color: '#F0EBE0',
  outline: 'none',
  fontFamily: 'inherit',
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '9px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#5A5450',
  marginBottom: '6px',
};

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: '10px', color: '#3A3530', margin: '5px 0 0', lineHeight: 1.5 }}>{hint}</p>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ...inputStyle, fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((o) => (
        <option key={o} value={o} style={{ background: '#0C0C0C' }}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Multi-select rendered as toggle chips — a native multi-select is unusable at this size. */
export function TagPicker({
  value,
  onChange,
  options,
  max,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: readonly string[];
  max?: number;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, opt]);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const selected = value.includes(opt);
        const atMax = Boolean(max) && !selected && value.length >= (max ?? 0);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            disabled={atMax}
            style={{
              fontSize: '10px',
              padding: '5px 10px',
              border: `1px solid ${selected ? '#C9A96E' : '#1C1C1C'}`,
              background: selected ? 'rgba(201,169,110,0.1)' : 'transparent',
              color: selected ? '#C9A96E' : atMax ? '#2A2620' : '#7A6A5A',
              cursor: atMax ? 'not-allowed' : 'pointer',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', fontSize: '12px', color: '#C8B9A8' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: '#C9A96E' }} />
      {label}
    </label>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  tone = 'default',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  type?: 'button' | 'submit';
}) {
  const color = tone === 'danger' ? '#B45A4A' : tone === 'primary' ? '#C9A96E' : '#7A6A5A';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: '9px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        padding: '10px 18px',
        border: `1px solid ${color}`,
        background: 'none',
        color,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const color = tone === 'error' ? 'rgba(220,80,80,0.85)' : '#5A8A5A';
  return (
    <p style={{ fontSize: '11.5px', color, margin: 0, lineHeight: 1.6 }}>{children}</p>
  );
}

export function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section style={{ border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '24px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', color: '#F0EBE0', fontWeight: 400, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
