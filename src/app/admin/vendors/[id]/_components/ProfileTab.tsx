'use client';

import { useState } from 'react';
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
} from '../../../_components/FormControls';
import {
  STYLE_ARCHETYPES,
  MAKEUP_FINISH_TAGS,
  HAIR_STYLE_TAGS,
  OCCASION_TAGS,
  COLOR_PALETTE_TAGS,
  SKIN_TONE_TAGS,
  CONTRA_INDICATORS,
  MICRO_LOCATIONS,
  TRAVEL_POLICY,
  PRICING_TIER,
} from '@/lib/db/enums/taxonomy';

export function ProfileTab({ vendorId, vendor }: { vendorId: string; vendor: Record<string, any> }) {
  const ap = vendor.aestheticProfile ?? {};
  const [name, setName] = useState(vendor.name ?? '');
  const [tagline, setTagline] = useState(vendor.tagline ?? '');
  const [bio, setBio] = useState(vendor.bio ?? '');
  const [aestheticBio, setAestheticBio] = useState(ap.aestheticBio ?? '');
  const [signatureElements, setSignatureElements] = useState(ap.signatureElements ?? '');
  const [phone, setPhone] = useState(vendor.contact?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(vendor.contact?.whatsapp ?? '');
  const [instagram, setInstagram] = useState(vendor.contact?.instagram ?? '');
  const [website, setWebsite] = useState(vendor.contact?.website ?? '');
  const [microLocation, setMicroLocation] = useState(vendor.location?.microLocation ?? MICRO_LOCATIONS[0]);
  const [travelPolicy, setTravelPolicy] = useState(vendor.location?.travelPolicy ?? TRAVEL_POLICY[0]);
  const [pricingTier, setPricingTier] = useState(vendor.pricing?.tier ?? PRICING_TIER[2]);
  const [startingFromINR, setStartingFromINR] = useState(vendor.pricing?.startingFromINR ?? 0);
  const [yearsOfExperience, setYearsOfExperience] = useState(vendor.businessMeta?.yearsOfExperience ?? 0);
  const [teamSize, setTeamSize] = useState(vendor.businessMeta?.teamSize ?? 1);
  const [bookingLeadTimeDays, setBookingLeadTimeDays] = useState(vendor.businessMeta?.bookingLeadTimeDays ?? 7);
  const [trialsOffered, setTrialsOffered] = useState(Boolean(vendor.businessMeta?.trialsOffered));
  const [styleArchetypes, setStyleArchetypes] = useState<string[]>(ap.styleArchetypes ?? []);
  const [makeupFinishTags, setMakeupFinishTags] = useState<string[]>(ap.makeupFinishTags ?? []);
  const [hairStyleTags, setHairStyleTags] = useState<string[]>(ap.hairStyleTags ?? []);
  const [occasionSpecializations, setOccasionSpecializations] = useState<string[]>(ap.occasionSpecializations ?? []);
  const [colorPaletteAffinity, setColorPaletteAffinity] = useState<string[]>(ap.colorPaletteAffinity ?? []);
  const [skinToneExpertise, setSkinToneExpertise] = useState<string[]>(ap.skinToneExpertise ?? []);
  const [contraIndicators, setContraIndicators] = useState<string[]>(ap.contraIndicators ?? []);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tagline,
          bio,
          'location.microLocation': microLocation,
          'location.travelPolicy': travelPolicy,
          'contact.phone': phone,
          'contact.whatsapp': whatsapp,
          'contact.instagram': instagram,
          'contact.website': website,
          'pricing.tier': pricingTier,
          'pricing.startingFromINR': startingFromINR,
          'businessMeta.yearsOfExperience': yearsOfExperience,
          'businessMeta.teamSize': teamSize,
          'businessMeta.bookingLeadTimeDays': bookingLeadTimeDays,
          'businessMeta.trialsOffered': trialsOffered,
          'aestheticProfile.aestheticBio': aestheticBio,
          'aestheticProfile.signatureElements': signatureElements,
          'aestheticProfile.styleArchetypes': styleArchetypes,
          'aestheticProfile.makeupFinishTags': makeupFinishTags,
          'aestheticProfile.hairStyleTags': hairStyleTags,
          'aestheticProfile.occasionSpecializations': occasionSpecializations,
          'aestheticProfile.colorPaletteAffinity': colorPaletteAffinity,
          'aestheticProfile.skinToneExpertise': skinToneExpertise,
          'aestheticProfile.contraIndicators': contraIndicators,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save these changes.');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <SectionCard title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          <Field label="Name">
            <TextInput value={name} onChange={setName} maxLength={150} />
          </Field>
          <Field label="Slug" hint="Fixed — the matching AI and every saved reference use this.">
            <TextInput value={vendor.slug ?? ''} onChange={() => {}} />
          </Field>
        </div>
        <div style={{ marginBottom: '18px' }}>
          <Field label="Tagline">
            <TextInput value={tagline} onChange={setTagline} maxLength={120} />
          </Field>
        </div>
        <Field label="Bio" hint="Long-form description shown on the public profile.">
          <TextArea value={bio} onChange={setBio} rows={4} maxLength={800} />
        </Field>
      </SectionCard>

      <SectionCard title="Matching signals">
        <p style={{ fontSize: '12px', color: '#5A5450', lineHeight: 1.7, margin: '0 0 20px', maxWidth: '62ch' }}>
          These fields are what the matching AI reads. Signature elements takes precedence over the
          aesthetic bio in the roster it is given, so keep it specific and technique-led.
        </p>
        <div style={{ marginBottom: '18px' }}>
          <Field label={`Signature elements — ${signatureElements.trim().length}/300`}>
            <TextArea value={signatureElements} onChange={setSignatureElements} rows={3} maxLength={300} />
          </Field>
        </div>
        <div style={{ marginBottom: '22px' }}>
          <Field label={`Aesthetic bio — ${aestheticBio.trim().length}/400`} hint="Minimum 80 characters.">
            <TextArea value={aestheticBio} onChange={setAestheticBio} rows={4} maxLength={400} />
          </Field>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
          <Field label="Contra-indicators" hint="What this artist explicitly does not do.">
            <TagPicker value={contraIndicators} onChange={setContraIndicators} options={CONTRA_INDICATORS} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Location, contact & business">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          <Field label="Micro-location">
            <Select value={microLocation} onChange={setMicroLocation} options={MICRO_LOCATIONS} />
          </Field>
          <Field label="Travel policy">
            <Select value={travelPolicy} onChange={setTravelPolicy} options={TRAVEL_POLICY} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          <Field label="Phone"><TextInput value={phone} onChange={setPhone} /></Field>
          <Field label="WhatsApp"><TextInput value={whatsapp} onChange={setWhatsapp} /></Field>
          <Field label="Instagram"><TextInput value={instagram} onChange={setInstagram} /></Field>
          <Field label="Website"><TextInput value={website} onChange={setWebsite} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '18px' }}>
          <Field label="Pricing tier">
            <Select value={pricingTier} onChange={setPricingTier} options={PRICING_TIER} />
          </Field>
          <Field label="Starting from (INR)">
            <NumberInput value={startingFromINR} onChange={setStartingFromINR} min={0} />
          </Field>
          <Field label="Years experience">
            <NumberInput value={yearsOfExperience} onChange={setYearsOfExperience} min={0} />
          </Field>
          <Field label="Team size">
            <NumberInput value={teamSize} onChange={setTeamSize} min={1} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', alignItems: 'end' }}>
          <Field label="Booking lead time (days)">
            <NumberInput value={bookingLeadTimeDays} onChange={setBookingLeadTimeDays} min={0} />
          </Field>
          <div style={{ paddingBottom: '10px' }}>
            <Toggle checked={trialsOffered} onChange={setTrialsOffered} label="Offers trial sessions" />
          </div>
        </div>
      </SectionCard>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '20px 0' }}>
        <Button tone="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Profile'}
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
        {saved && !error && <Notice tone="success">Saved.</Notice>}
      </div>
    </div>
  );
}
