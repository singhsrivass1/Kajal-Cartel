const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Awaiting confirmation', color: '#C9A96E' },
  CONFIRMED: { label: 'Confirmed', color: '#5A8A5A' },
  DECLINED: { label: 'Declined', color: '#B07A6A' },
  CANCELLED: { label: 'Cancelled', color: '#8A8078' },
  COMPLETED: { label: 'Completed', color: '#9A8AEE' },
};

export function statusLabel(status: string, phase?: string): string {
  if (phase === 'awaiting-completion' && (status === 'PENDING' || status === 'CONFIRMED')) {
    return status === 'PENDING' ? 'Not confirmed' : 'Awaiting completion';
  }
  return STATUS_META[status]?.label ?? status;
}

export function StatusBadge({ status, phase, label }: { status: string; phase?: string; label?: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#8A8078' };
  return (
    <span
      style={{
        fontSize: '9px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 600,
        color: meta.color,
        border: `1px solid ${meta.color}`,
        padding: '3px 9px',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? statusLabel(status, phase)}
    </span>
  );
}
