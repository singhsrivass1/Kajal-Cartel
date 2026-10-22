'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Field,
  TextInput,
  TextArea,
  NumberInput,
  Select,
  TagPicker,
  Toggle,
  Button,
  Notice,
  SectionCard,
  FONT_DISPLAY,
} from '../../../_components/FormControls';
import {
  SERVICE_CATEGORY,
  SERVICE_ROLE,
  PRICE_TYPE,
  CHECKOUT_CATEGORY,
  ESTIMATE_CONTRIBUTION,
  RECIPIENT_TYPE,
  OCCASION_TAGS,
} from '@/lib/db/enums/taxonomy';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

interface ServiceFormState {
  name: string;
  description: string;
  category: string;
  serviceRole: string;
  baseDurationMinutes: number;
  bufferMinutes: number;
  unitPriceINR: number;
  priceType: string;
  checkoutCategory: string;
  estimateContribution: string;
  recipientType: string;
  occasionTags: string[];
  aiDescription: string;
  isActive: boolean;
}

function emptyForm(): ServiceFormState {
  return {
    name: '',
    description: '',
    category: SERVICE_CATEGORY[0],
    serviceRole: SERVICE_ROLE[0],
    baseDurationMinutes: 120,
    bufferMinutes: 15,
    unitPriceINR: 0,
    priceType: PRICE_TYPE[1],
    checkoutCategory: CHECKOUT_CATEGORY[0],
    estimateContribution: ESTIMATE_CONTRIBUTION[0],
    recipientType: RECIPIENT_TYPE[0],
    occasionTags: [],
    aiDescription: '',
    isActive: true,
  };
}

function fromService(s: Record<string, any>): ServiceFormState {
  return {
    name: s.name ?? '',
    description: s.description ?? '',
    category: s.category ?? SERVICE_CATEGORY[0],
    serviceRole: s.serviceRole ?? SERVICE_ROLE[0],
    baseDurationMinutes: s.duration?.baseDurationMinutes ?? 120,
    bufferMinutes: s.duration?.bufferMinutes ?? 15,
    unitPriceINR: s.pricing?.unitPriceINR ?? 0,
    priceType: s.pricing?.priceType ?? PRICE_TYPE[1],
    checkoutCategory: s.checkoutMeta?.checkoutCategory ?? CHECKOUT_CATEGORY[0],
    estimateContribution: s.checkoutMeta?.estimateContribution ?? ESTIMATE_CONTRIBUTION[0],
    recipientType: s.partyConfig?.recipientType ?? RECIPIENT_TYPE[0],
    occasionTags: s.aestheticSignals?.occasionTags ?? [],
    aiDescription: s.aestheticSignals?.aiDescription ?? '',
    isActive: s.flags?.isActive ?? true,
  };
}

function ServiceForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: ServiceFormState;
  onSubmit: (form: ServiceFormState) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<ServiceFormState>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this service.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '18px' }}>
        <Field label="Service name">
          <TextInput value={form.name} onChange={(v) => set('name', v)} maxLength={100} />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(v) => set('category', v)} options={SERVICE_CATEGORY} />
        </Field>
        <Field label="Role" hint="Anchor = main look. Trial = trial session.">
          <Select value={form.serviceRole} onChange={(v) => set('serviceRole', v)} options={SERVICE_ROLE} />
        </Field>
      </div>

      <Field label="Description">
        <TextArea value={form.description} onChange={(v) => set('description', v)} rows={2} maxLength={600} />
      </Field>

      <Field label="AI description" hint="What the matching AI reads about this service.">
        <TextInput value={form.aiDescription} onChange={(v) => set('aiDescription', v)} maxLength={200} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
        <Field label="Duration (min)" hint="Minimum 15.">
          <NumberInput value={form.baseDurationMinutes} onChange={(v) => set('baseDurationMinutes', v)} min={15} />
        </Field>
        <Field label="Buffer (min)" hint="Added after each booking.">
          <NumberInput value={form.bufferMinutes} onChange={(v) => set('bufferMinutes', v)} min={0} />
        </Field>
        <Field label="Price (INR)" hint="Bookings are priced from this field.">
          <NumberInput value={form.unitPriceINR} onChange={(v) => set('unitPriceINR', v)} min={0} />
        </Field>
        <Field label="Price type">
          <Select value={form.priceType} onChange={(v) => set('priceType', v)} options={PRICE_TYPE} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
        <Field label="Checkout category">
          <Select value={form.checkoutCategory} onChange={(v) => set('checkoutCategory', v)} options={CHECKOUT_CATEGORY} />
        </Field>
        <Field label="Estimate contribution">
          <Select value={form.estimateContribution} onChange={(v) => set('estimateContribution', v)} options={ESTIMATE_CONTRIBUTION} />
        </Field>
        <Field label="Recipient type">
          <Select value={form.recipientType} onChange={(v) => set('recipientType', v)} options={RECIPIENT_TYPE} />
        </Field>
      </div>

      <Field label="Occasion tags">
        <TagPicker value={form.occasionTags} onChange={(v) => set('occasionTags', v)} options={OCCASION_TAGS} />
      </Field>

      <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Bookable" />

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <Button tone="primary" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : submitLabel}
        </Button>
        <Button onClick={onCancel} disabled={isSaving}>Cancel</Button>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </div>
  );
}

export function ServicesTab({ vendorId, services }: { vendorId: string; services: Array<Record<string, any>> }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const submit = async (url: string, method: string, form: ServiceFormState) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not save this service.');
    setCreating(false);
    setEditingId(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this service?')) return;
    setDeletingId(id);
    setListError(null);
    try {
      const res = await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not delete this service.');
      router.refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not delete this service.');
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <SectionCard
        title={`Services — ${services.length}`}
        action={!creating && <Button tone="primary" onClick={() => setCreating(true)}>+ Add Service</Button>}
      >
        <p style={{ fontSize: '12px', color: '#5A5450', lineHeight: 1.7, margin: '0 0 20px', maxWidth: '62ch' }}>
          Price here is the single source of truth — every booking total is recalculated server-side
          from this field at the moment the booking is made, never from anything the browser sends.
          Duration and buffer feed the availability engine's slot calculation.
        </p>

        {creating && (
          <div style={{ border: '1px solid #2D2418', padding: '20px', marginBottom: '18px' }}>
            <ServiceForm
              initial={emptyForm()}
              submitLabel="Create Service"
              onCancel={() => setCreating(false)}
              onSubmit={(form) => submit(`/api/admin/vendors/${vendorId}/services`, 'POST', form)}
            />
          </div>
        )}

        {services.length === 0 && !creating ? (
          <p style={{ fontSize: '12px', color: '#3A3530', fontStyle: 'italic' }}>No services yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {services.map((s) => {
              const id = s._id?.toString?.() ?? s._id;
              const isEditing = editingId === id;
              return (
                <div key={id} style={{ border: '1px solid #1A1A1A', padding: '16px 18px', background: '#080808' }}>
                  {isEditing ? (
                    <ServiceForm
                      initial={fromService(s)}
                      submitLabel="Save Changes"
                      onCancel={() => setEditingId(null)}
                      onSubmit={(form) => submit(`/api/admin/services/${id}`, 'PATCH', form)}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                      <div>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: '#F0EBE0', margin: '0 0 4px' }}>
                          {s.name}
                          {!s.flags?.isActive && (
                            <span style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6A6460', border: '1px solid #6A6460', padding: '2px 7px', marginLeft: '10px' }}>
                              Not bookable
                            </span>
                          )}
                        </p>
                        <p style={{ fontSize: '11px', color: '#454140', margin: 0 }}>
                          {s.serviceRole} · {s.duration?.baseDurationMinutes}min +{s.duration?.bufferMinutes}min buffer · {formatINR(s.pricing?.unitPriceINR ?? 0)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <Button onClick={() => setEditingId(id)}>Edit</Button>
                        <Button tone="danger" onClick={() => handleDelete(id)} disabled={deletingId === id}>
                          {deletingId === id ? 'Deleting…' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {listError && <div style={{ marginTop: '14px' }}><Notice tone="error">{listError}</Notice></div>}
      </SectionCard>
    </div>
  );
}
