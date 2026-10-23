import type { Metadata } from 'next';
import { dbConnect } from '@/lib/db/connect';
import { listPublicServices } from '@/lib/db/controllers/DiscoveryManager';
import type { PublicServiceSummary } from '@/lib/db/controllers/DiscoveryManager';
import { ServicesClient } from './_components/ServicesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bridal Beauty Services & Prices — Kajal Cartel',
  description: 'Compare bridal makeup, hair and party glam services from Delhi artists, with real prices and durations.',
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'Bridal Beauty Services & Prices — Kajal Cartel',
    description: 'Compare bridal makeup, hair and party glam services from Delhi artists, with real prices and durations.',
    url: '/services',
  },
};

export default async function ServicesPage() {
  let services: PublicServiceSummary[] = [];
  let loadError = false;
  try {
    await dbConnect();
    services = await listPublicServices();
  } catch (err) {
    loadError = true;
    console.error('[ServicesPage] Failed to load services:', err);
  }
  return <ServicesClient services={services} loadError={loadError} />;
}
