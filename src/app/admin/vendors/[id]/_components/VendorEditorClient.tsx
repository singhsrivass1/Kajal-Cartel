'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '../../../_components/AdminHeader';
import { Button, Notice, FONT_DISPLAY } from '../../../_components/FormControls';
import { ProfileTab } from './ProfileTab';
import { PortfolioTab } from './PortfolioTab';
import { ServicesTab } from './ServicesTab';
import { AvailabilityTab } from './AvailabilityTab';
import { ArtistAccountsTab } from './ArtistAccountsTab';
import type { AvailabilityData } from './AvailabilityTab';

type Tab = 'profile' | 'portfolio' | 'services' | 'availability' | 'accounts';

const TAB_LABELS: Record<Tab, string> = {
  profile: 'Profile',
  portfolio: 'Portfolio',
  services: 'Services',
  availability: 'Availability',
  accounts: 'Artist Accounts',
};

export function VendorEditorClient({
  adminEmail,
  vendorId,
  vendor,
  services,
  availability,
}: {
  adminEmail: string;
  vendorId: string;
  vendor: Record<string, any>;
  services: Array<Record<string, any>>;
  availability: AvailabilityData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('profile');
  const [isToggling, setIsToggling] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const isActive = Boolean(vendor.flags?.isActive);
  const portfolioCount = Array.isArray(vendor.portfolio) ? vendor.portfolio.length : 0;

  const handleToggleActive = async () => {
    setIsToggling(true);
    setActivationError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not change this vendor’s status.');
      router.refresh();
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Could not change this vendor’s status.');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <AdminHeader adminEmail={adminEmail} />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 40px 96px' }}>
        <Link
          href="/admin/vendors"
          style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#454140', textDecoration: 'none' }}
        >
          ← All vendors
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', margin: '20px 0 8px' }}>
          <div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', color: '#F0EBE0', fontWeight: 400, margin: '0 0 6px' }}>
              {vendor.name}
            </h1>
            <p style={{ fontSize: '11px', color: '#454140', margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
              {vendor.slug}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            <span
              style={{
                fontSize: '9px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
                padding: '4px 10px',
                border: `1px solid ${isActive ? '#5A8A5A' : '#6A6460'}`,
                color: isActive ? '#5A8A5A' : '#6A6460',
              }}
            >
              {isActive ? 'Live' : 'Draft'}
            </span>
            <Button tone={isActive ? 'danger' : 'primary'} onClick={handleToggleActive} disabled={isToggling}>
              {isToggling ? 'Working…' : isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>

        <p style={{ fontSize: '11.5px', color: '#3A3530', margin: '0 0 12px', lineHeight: 1.6, maxWidth: '68ch' }}>
          {isActive
            ? 'This vendor is visible on the public site and included in the matching AI’s roster. Deactivating removes them from both immediately.'
            : `Draft — hidden from the public site and the matching AI. Needs a profile image and at least 4 portfolio images to go live (currently ${portfolioCount}).`}
        </p>

        {activationError && (
          <div style={{ marginBottom: '20px' }}>
            <Notice tone="error">{activationError}</Notice>
          </div>
        )}

        <div style={{ display: 'flex', borderBottom: '1px solid #141210', marginBottom: '28px', marginTop: '28px' }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${tab === t ? '#C9A96E' : 'transparent'}`,
                padding: '0 0 14px',
                marginRight: '28px',
                fontSize: '11px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: tab === t ? '#F0EBE0' : '#454140',
                cursor: 'pointer',
              }}
            >
              {TAB_LABELS[t]}
              {t === 'portfolio' && portfolioCount > 0 && (
                <span style={{ marginLeft: '7px', fontSize: '10px', color: tab === t ? '#C9A96E' : '#2A2620' }}>{portfolioCount}</span>
              )}
              {t === 'services' && services.length > 0 && (
                <span style={{ marginLeft: '7px', fontSize: '10px', color: tab === t ? '#C9A96E' : '#2A2620' }}>{services.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'profile' && <ProfileTab vendorId={vendorId} vendor={vendor} />}
        {tab === 'portfolio' && <PortfolioTab vendorId={vendorId} vendor={vendor} />}
        {tab === 'services' && <ServicesTab vendorId={vendorId} services={services} />}
        {tab === 'availability' && <AvailabilityTab vendorId={vendorId} availability={availability} />}
        {tab === 'accounts' && <ArtistAccountsTab vendorId={vendorId} />}
      </main>
    </div>
  );
}
