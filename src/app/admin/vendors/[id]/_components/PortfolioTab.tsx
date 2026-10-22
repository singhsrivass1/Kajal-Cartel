'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Field,
  TextInput,
  Select,
  TagPicker,
  Toggle,
  Button,
  Notice,
  SectionCard,
} from '../../../_components/FormControls';
import { OCCASION_TAGS, STYLE_ARCHETYPES, COLOR_PALETTE_TAGS } from '@/lib/db/enums/taxonomy';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

interface PortfolioItem {
  imageUrl: string;
  altText: string;
  primaryOccasion: string;
  isHeroImage?: boolean;
}

export function PortfolioTab({
  vendorId,
  vendor,
}: {
  vendorId: string;
  vendor: Record<string, any>;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const portfolio: PortfolioItem[] = vendor.portfolio ?? [];

  const [pendingFile, setPendingFile] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [altText, setAltText] = useState('');
  const [captionForAI, setCaptionForAI] = useState('');
  const [primaryOccasion, setPrimaryOccasion] = useState<string>(OCCASION_TAGS[0]);
  const [styleArchetypesShown, setStyleArchetypesShown] = useState<string[]>([]);
  const [colorPaletteShown, setColorPaletteShown] = useState<string[]>([]);
  const [useAsProfileImage, setUseAsProfileImage] = useState(portfolio.length === 0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Portfolio images must be under 2MB each.');
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.readAsDataURL(file);
    });
    setPendingFile({ base64, mimeType: file.type, previewUrl: URL.createObjectURL(file) });
  };

  const resetForm = () => {
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setAltText('');
    setCaptionForAI('');
    setStyleArchetypesShown([]);
    setColorPaletteShown([]);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: pendingFile.base64,
          mimeType: pendingFile.mimeType,
          altText,
          captionForAI,
          primaryOccasion,
          styleArchetypesShown,
          colorPaletteShown,
          useAsProfileImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not upload this image.');
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (imageUrl: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Remove this image from the portfolio?')) return;
    setDeletingUrl(imageUrl);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/portfolio`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not remove this image.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this image.');
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <SectionCard title={`Portfolio — ${portfolio.length} image${portfolio.length === 1 ? '' : 's'}`}>
        <p style={{ fontSize: '12px', color: '#5A5450', lineHeight: 1.7, margin: '0 0 20px', maxWidth: '62ch' }}>
          At least four images are required before this vendor can go live. Images are stored
          individually and served on demand, so they are never loaded in bulk on the public pages.
          Maximum 2MB each, 20 images total.
        </p>

        {portfolio.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#3A3530', fontStyle: 'italic' }}>No images yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
            {portfolio.map((item) => (
              <div key={item.imageUrl} style={{ border: '1px solid #1A1A1A', background: '#080808' }}>
                <div style={{ position: 'relative', paddingBottom: '125%', overflow: 'hidden' }}>
                  <img
                    src={item.imageUrl}
                    alt={item.altText}
                    loading="lazy"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {vendor.profileImageUrl === item.imageUrl && (
                    <span style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(8,8,8,0.8)', color: '#C9A96E', padding: '2px 6px' }}>
                      Profile
                    </span>
                  )}
                </div>
                <div style={{ padding: '10px' }}>
                  <p style={{ fontSize: '10px', color: '#5A5450', margin: '0 0 8px', lineHeight: 1.4, minHeight: '28px' }}>
                    {item.altText}
                  </p>
                  <Button tone="danger" onClick={() => handleDelete(item.imageUrl)} disabled={deletingUrl === item.imageUrl}>
                    {deletingUrl === item.imageUrl ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Add an image">
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />

        {!pendingFile ? (
          <Button onClick={() => fileInputRef.current?.click()}>Choose Image</Button>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '24px' }}>
            <div style={{ border: '1px solid #1A1A1A' }}>
              <img src={pendingFile.previewUrl} alt="" style={{ width: '100%', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="Alt text" hint="Describes the image for screen readers.">
                <TextInput value={altText} onChange={setAltText} maxLength={150} />
              </Field>
              <Field label="Caption for AI" hint="How this look should be described to the matching AI.">
                <TextInput value={captionForAI} onChange={setCaptionForAI} maxLength={200} />
              </Field>
              <Field label="Primary occasion">
                <Select value={primaryOccasion} onChange={setPrimaryOccasion} options={OCCASION_TAGS} />
              </Field>
              <Field label="Style archetypes shown">
                <TagPicker value={styleArchetypesShown} onChange={setStyleArchetypesShown} options={STYLE_ARCHETYPES} />
              </Field>
              <Field label="Colour palette shown">
                <TagPicker value={colorPaletteShown} onChange={setColorPaletteShown} options={COLOR_PALETTE_TAGS} />
              </Field>
              <Toggle checked={useAsProfileImage} onChange={setUseAsProfileImage} label="Also use as the profile image" />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Button tone="primary" onClick={handleUpload} disabled={isUploading}>
                  {isUploading ? 'Uploading…' : 'Upload'}
                </Button>
                <Button onClick={resetForm} disabled={isUploading}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ marginTop: '14px' }}><Notice tone="error">{error}</Notice></div>}
      </SectionCard>
    </div>
  );
}
