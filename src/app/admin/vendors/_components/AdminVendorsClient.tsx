'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '../../_components/AdminHeader';
import {
  Field,
  TextInput,
  TextArea,
  NumberInput,
  Select,
  TagPicker,
  Button,
  Notice,
  SectionCard,
  FONT_DISPLAY,
} from '../../_components/FormControls';
import {
  STYLE_ARCHETYPES,
  MAKEUP_FINISH_TAGS,
  HAIR_STYLE_TAGS,
  OCCASION_TAGS,
  COLOR_PALETTE_TAGS,
  SKIN_TONE_TAGS,
  MICRO_LOCATIONS,
  TRAVEL_POLICY,
  PRICING_TIER,
} from '@/lib/db/enums/taxonomy';
import type { AdminVendorListRow } from '@/lib/db/controllers/VendorAdminManager';

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function CreateVendorForm({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [aestheticBio, setAestheticBio] = useState('');
  const [phone, setPhone] = useState('');
  const [microLocation, setMicroLocation] = useState<string>(MICRO_LOCATIONS[0]);
  const [travelPolicy, setTravelPolicy] = useState<string>(TRAVEL_POLICY[0]);
  const [pricingTier, setPricingTier] = useState<string>(PRICING_TIER[2]);
  const [startingFromINR, setStartingFromINR] = useState(50000);
  const [styleArchetypes, setStyleArchetypes] = useState<string[]>([]);
  const [makeupFinishTags, setMakeupFinishTags] = useState<string[]>([]);
  const [hairStyleTags, setHairStyleTags] = useState<string[]>([]);
  const [occasionSpecializations, setOccasionSpecializations] = useState<string[]>([]);
  const [colorPaletteAffinity, setColorPaletteAffinity] = useState<string[]>([]);
  const [skinToneExpertise, setSkinToneExpertise] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: effectiveSlug,
          tagline,
          aestheticBio,
          phone,
          microLocation,
          travelPolicy,
          pricingTier,
          startingFromINR,
          styleArchetypes,
          makeupFinishTags,
          hairStyleTags,
          occasionSpecializations,
          colorPaletteAffinity,
          skinToneExpertise,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create this vendor.');
      onCreated();
      router.push(`/admin/vendors/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create this vendor.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) {
    return <Button tone="primary" onClick={() => setOpen(true)}>+ New Vendor</Button>;
  }

  return (
    <SectionCard
      title="New vendor"
      action={<Button onClick={() => setOpen(false)}>Cancel</Button>}
    >
      <p style={{ fontSize: '12px', color: '#5A5450', lineHeight: 1.7, marginTop: 0, marginBottom: '22px', maxWidth: '62ch' }}>
        New vendors are created as drafts — they stay hidden from the public site and the matching AI
        until you add a profile image, at least four portfolio images, and activate them.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
        <Field label="Name">
          <TextInput value={name} onChange={handleNameChange} placeholder="Studio Noor" maxLength={150} />
        </Field>
        <Field label="Slug" hint="Used in URLs and by the matching AI. Cannot be changed later.">
          <TextInput
            value={effectiveSlug}
            onChange={(v) => { setSlugTouched(true); setSlug(v); }}
            placeholder="studio-noor"
          />
        </Field>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <Field label="Tagline">
          <TextInput value={tagline} onChange={setTagline} placeholder="Where restraint is the most radical form of luxury." maxLength={120} />
        </Field>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <Field
          label={`Aesthetic bio — ${aestheticBio.trim().length}/400`}
          hint="This is the text the matching AI reads to decide which brides to match. 80 characters minimum. Be specific about technique and signature."
        >
          <TextArea value={aestheticBio} onChange={setAestheticBio} rows={4} maxLength={400} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px', marginBottom: '18px' }}>
        <Field label="Phone">
          <TextInput value={phone} onChange={setPhone} placeholder="+91 98101 22334" />
        </Field>
        <Field label="Micro-location">
          <Select value={microLocation} onChange={setMicroLocation} options={MICRO_LOCATIONS} />
        </Field>
        <Field label="Travel policy">
          <Select value={travelPolicy} onChange={setTravelPolicy} options={TRAVEL_POLICY} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '22px' }}>
        <Field label="Pricing tier">
          <Select value={pricingTier} onChange={setPricingTier} options={PRICING_TIER} />
        </Field>
        <Field label="Starting from (INR)">
          <NumberInput value={startingFromINR} onChange={setStartingFromINR} min={0} />
        </Field>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '22px' }}>
        <Field label="Style archetypes (1–3)">
          <TagPicker value={styleArchetypes} onChange={setStyleArchetypes} options={STYLE_ARCHETYPES} max={3} />
        </Field>
        <Field label="Makeup finish tags">
          <TagPicker value={makeupFinishTags} onChange={setMakeupFinishTags} options={MAKEUP_FINISH_TAGS} />
        </Field>
        <Field label="Hair style tags">
          <TagPicker value={hairStyleTags} onChange={setHairStyleTags} options={HAIR_STYLE_TAGS} />
        </Field>
        <Field label="Occasion specializations">
          <TagPicker value={occasionSpecializations} onChange={setOccasionSpecializations} options={OCCASION_TAGS} />
        </Field>
        <Field label="Colour palette affinity">
          <TagPicker value={colorPaletteAffinity} onChange={setColorPaletteAffinity} options={COLOR_PALETTE_TAGS} />
        </Field>
        <Field label="Skin tone expertise">
          <TagPicker value={skinToneExpertise} onChange={setSkinToneExpertise} options={SKIN_TONE_TAGS} />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Button tone="primary" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Creating…' : 'Create Draft'}
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </SectionCard>
  );
}

export function AdminVendorsClient({
  adminEmail,
  initialVendors,
}: {
  adminEmail: string;
  initialVendors: AdminVendorListRow[];
}) {
  const router = useRouter();
  const activeCount = initialVendors.filter((v) => v.isActive).length;

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={adminEmail} />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 40px 96px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', marginBottom: '40px' }}>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '8px' }}>
              {initialVendors.length} Total · {activeCount} Live
            </p>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(2rem, 4vw, 2.6rem)', color: '#F0EBE0', fontWeight: 400 }}>
              Vendors
            </h1>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <CreateVendorForm onCreated={() => router.refresh()} />
        </div>

        {initialVendors.length === 0 ? (
          <div style={{ border: '1px solid #161412', padding: '72px 32px', textAlign: 'center' }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.3rem', fontStyle: 'italic', color: '#3A3530' }}>No vendors yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {initialVendors.map((v) => (
              <Link
                key={v.id}
                href={`/admin/vendors/${v.id}`}
                style={{ display: 'block', textDecoration: 'none', border: '1px solid #1A1A1A', background: '#0C0C0C', padding: '18px 22px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                    <div style={{ width: '44px', height: '44px', flexShrink: 0, background: '#141210', overflow: 'hidden' }}>
                      {v.profileImageUrl && (
                        <img src={v.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', color: '#F0EBE0', margin: '0 0 3px' }}>{v.name}</p>
                      <p style={{ fontSize: '11px', color: '#454140', margin: 0 }}>
                        {v.microLocation} · {v.pricingTier} · {v.portfolioCount} images · {v.serviceCount} services
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      padding: '3px 9px',
                      border: `1px solid ${v.isActive ? '#5A8A5A' : '#6A6460'}`,
                      color: v.isActive ? '#5A8A5A' : '#6A6460',
                    }}
                  >
                    {v.isActive ? 'Live' : 'Draft'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
