'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Field,
  TextInput,
  NumberInput,
  Button,
  Notice,
  SectionCard,
  inputStyle,
} from '../../../_components/FormControls';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface WorkingHours {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

interface BlockedDateRow {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface AvailabilityData {
  workingHours: WorkingHours[];
  slotIntervalMinutes: number;
  maxConcurrentBookings: number;
  blockedDates: BlockedDateRow[];
}

export function AvailabilityTab({
  vendorId,
  availability,
}: {
  vendorId: string;
  availability: AvailabilityData;
}) {
  const router = useRouter();

  const [hours, setHours] = useState<WorkingHours[]>(
    [...availability.workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  );
  const [slotInterval, setSlotInterval] = useState(availability.slotIntervalMinutes);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursSaved, setHoursSaved] = useState(false);

  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);

  const updateDay = (dayOfWeek: number, patch: Partial<WorkingHours>) => {
    setHours((prev) => prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)));
    setHoursSaved(false);
  };

  const handleSaveHours = async () => {
    setIsSavingHours(true);
    setHoursError(null);
    setHoursSaved(false);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingHours: hours, slotIntervalMinutes: slotInterval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save these hours.');
      setHoursSaved(true);
      router.refresh();
    } catch (err) {
      setHoursError(err instanceof Error ? err.message : 'Could not save these hours.');
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleAddBlock = async () => {
    setIsAddingBlock(true);
    setBlockError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/blocked-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: blockStart, endDate: blockEnd || blockStart, reason: blockReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not add this blocked date.');
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      router.refresh();
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Could not add this blocked date.');
    } finally {
      setIsAddingBlock(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    setDeletingBlockId(id);
    setBlockError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/blocked-dates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not remove this blocked date.');
      router.refresh();
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Could not remove this blocked date.');
    } finally {
      setDeletingBlockId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <SectionCard title="Working hours">
        <p style={{ fontSize: '12px', color: '#5A5450', lineHeight: 1.7, margin: '0 0 20px', maxWidth: '62ch' }}>
          These hours drive the slots offered to brides. A change that would leave an existing
          confirmed or pending booking outside the new hours is rejected — you will be told exactly
          which bookings block it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' }}>
          {hours.map((h) => (
            <div
              key={h.dayOfWeek}
              style={{ display: 'grid', gridTemplateColumns: '130px 90px 1fr 1fr', gap: '14px', alignItems: 'center' }}
            >
              <span style={{ fontSize: '12px', color: h.isOpen ? '#C8B9A8' : '#3A3530' }}>{DAY_NAMES[h.dayOfWeek]}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#7A6A5A', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={h.isOpen}
                  onChange={(e) => updateDay(h.dayOfWeek, { isOpen: e.target.checked })}
                  style={{ accentColor: '#C9A96E' }}
                />
                Open
              </label>
              <input
                type="time"
                value={h.startTime}
                disabled={!h.isOpen}
                onChange={(e) => updateDay(h.dayOfWeek, { startTime: e.target.value })}
                style={{ ...inputStyle, opacity: h.isOpen ? 1 : 0.35 }}
              />
              <input
                type="time"
                value={h.endTime}
                disabled={!h.isOpen}
                onChange={(e) => updateDay(h.dayOfWeek, { endTime: e.target.value })}
                style={{ ...inputStyle, opacity: h.isOpen ? 1 : 0.35 }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '18px', alignItems: 'end', marginBottom: '20px' }}>
          <Field label="Slot interval (min)" hint="How far apart offered start times are.">
            <NumberInput value={slotInterval} onChange={(v) => { setSlotInterval(v); setHoursSaved(false); }} min={5} />
          </Field>
          <p style={{ fontSize: '11px', color: '#3A3530', lineHeight: 1.6, margin: '0 0 10px' }}>
            Concurrent bookings per slot is fixed at {availability.maxConcurrentBookings}. Raising it
            would require replacing the database-level double-booking guard, so it is not editable here.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Button tone="primary" onClick={handleSaveHours} disabled={isSavingHours}>
            {isSavingHours ? 'Saving…' : 'Save Hours'}
          </Button>
          {hoursError && <Notice tone="error">{hoursError}</Notice>}
          {hoursSaved && !hoursError && <Notice tone="success">Saved.</Notice>}
        </div>
      </SectionCard>

      <SectionCard title={`Blocked dates — ${availability.blockedDates.length}`}>
        <p style={{ fontSize: '12px', color: '#5A5450', lineHeight: 1.7, margin: '0 0 20px', maxWidth: '62ch' }}>
          Dates the artist is unavailable regardless of working hours. A range covering an existing
          booking is rejected rather than silently stranding it.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '14px', alignItems: 'end', marginBottom: '22px' }}>
          <Field label="From">
            <input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="To" hint="Leave blank for a single day.">
            <input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Reason (optional)">
            <TextInput value={blockReason} onChange={setBlockReason} maxLength={200} />
          </Field>
          <div style={{ paddingBottom: '2px' }}>
            <Button tone="primary" onClick={handleAddBlock} disabled={isAddingBlock || !blockStart}>
              {isAddingBlock ? 'Adding…' : 'Block'}
            </Button>
          </div>
        </div>

        {availability.blockedDates.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#3A3530', fontStyle: 'italic' }}>No blocked dates.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availability.blockedDates.map((b) => (
              <div
                key={b.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', border: '1px solid #1A1A1A', padding: '12px 14px', background: '#080808' }}
              >
                <div>
                  <p style={{ fontSize: '12px', color: '#C8B9A8', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {b.startDate}{b.endDate !== b.startDate ? ` → ${b.endDate}` : ''}
                  </p>
                  {b.reason && <p style={{ fontSize: '11px', color: '#5A5450', margin: '3px 0 0' }}>{b.reason}</p>}
                </div>
                <Button tone="danger" onClick={() => handleDeleteBlock(b.id)} disabled={deletingBlockId === b.id}>
                  {deletingBlockId === b.id ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {blockError && <div style={{ marginTop: '14px' }}><Notice tone="error">{blockError}</Notice></div>}
      </SectionCard>
    </div>
  );
}
