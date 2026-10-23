import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Types } from 'mongoose';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import User from '@/lib/db/models/User';
import { ArtistPageClient } from './_components/ArtistPageClient';
import type { ArtistProfile, ClientService } from '@/types/artist';
import SaveArtistButton from "@/components/SaveArtistButton";
import { getVendorReviewStats, listPublishedReviewsForVendor } from '@/lib/db/controllers/ReviewManager';
import type { PublicReview } from '@/lib/db/controllers/ReviewManager';
import { getVendorFacets } from '@/lib/db/controllers/DiscoveryManager';
import { getBookingPolicy } from '@/lib/booking/policy';
import { getSiteUrl } from '@/lib/site/config';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
  searchParams?: { service?: string };
}

function serializeArtist(v: Record<string, any>, ratings: { averageRating: number; totalReviews: number }): ArtistProfile {
  return {
    _id: v._id.toString(),
    name: v.name,
    slug: v.slug,
    tagline: v.tagline,
    bio: v.bio,
    profileImageUrl: v.profileImageUrl,
    contact: {
      phone: v.contact?.phone ?? '',
      whatsapp: v.contact?.whatsapp,
      email: v.contact?.email,
      instagram: v.contact?.instagram,
      website: v.contact?.website,
    },
    businessMeta: {
      yearsOfExperience: v.businessMeta?.yearsOfExperience ?? 0,
      teamSize: v.businessMeta?.teamSize ?? 1,
      languagesSpoken: v.businessMeta?.languagesSpoken ?? [],
      bookingLeadTimeDays: v.businessMeta?.bookingLeadTimeDays ?? 7,
      trialsOffered: v.businessMeta?.trialsOffered ?? false,
      trialDurationMinutes: v.businessMeta?.trialDurationMinutes,
    },
    location: {
      microLocation: v.location?.microLocation ?? '',
      city: v.location?.city ?? 'New Delhi',
      travelPolicy: v.location?.travelPolicy ?? 'all',
    },
    pricing: {
      tier: v.pricing?.tier ?? 'premium',
      startingFromINR: v.pricing?.startingFromINR ?? 0,
    },
    ratings,
    flags: {
      badgeType: v.flags?.badgeType ?? null,
      isVerified: v.flags?.isVerified ?? false,
      isFeatured: v.flags?.isFeatured ?? false,
    },
    aestheticProfile: {
      styleArchetypes: v.aestheticProfile?.styleArchetypes ?? [],
      makeupFinishTags: v.aestheticProfile?.makeupFinishTags ?? [],
      hairStyleTags: v.aestheticProfile?.hairStyleTags ?? [],
      occasionSpecializations: v.aestheticProfile?.occasionSpecializations ?? [],
      colorPaletteAffinity: v.aestheticProfile?.colorPaletteAffinity ?? [],
      skinToneExpertise: v.aestheticProfile?.skinToneExpertise ?? [],
      inspirationReferences: v.aestheticProfile?.inspirationReferences,
      signatureElements: v.aestheticProfile?.signatureElements,
      aestheticBio: v.aestheticProfile?.aestheticBio ?? '',
      moodKeywords: v.aestheticProfile?.moodKeywords,
      contraIndicators: v.aestheticProfile?.contraIndicators,
      contraIndicatorsNotes: v.aestheticProfile?.contraIndicatorsNotes,
    },
    portfolio: (v.portfolio ?? [])
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((p: any) => ({
        _id: p._id?.toString() ?? '',
        imageUrl: p.imageUrl ?? '',
        altText: p.altText ?? '',
        primaryOccasion: p.primaryOccasion ?? '',
        styleArchetypesShown: p.styleArchetypesShown ?? [],
        colorPaletteShown: p.colorPaletteShown ?? [],
        captionForAI: p.captionForAI ?? '',
        isHeroImage: p.isHeroImage ?? false,
        sortOrder: p.sortOrder ?? 0,
      })),
    serviceSummary: {
      serviceCount: v.serviceSummary?.serviceCount ?? 0,
      anchorServiceCount: v.serviceSummary?.anchorServiceCount ?? 0,
      priceRangeINR: v.serviceSummary?.priceRangeINR ?? { min: 0, max: 0 },
      occasionCoverage: v.serviceSummary?.occasionCoverage ?? [],
      hasTrialOffering: v.serviceSummary?.hasTrialOffering ?? false,
    },
  };
}

function serializeService(s: Record<string, any>): ClientService {
  return {
    _id: s._id.toString(),
    vendor: s.vendor?.toString() ?? '',
    name: s.name,
    slug: s.slug,
    category: s.category,
    serviceRole: s.serviceRole,
    description: s.description,
    compatibleAnchorCategories: s.compatibleAnchorCategories ?? [],
    duration: {
      baseDurationMinutes: s.duration?.baseDurationMinutes ?? 60,
      additionalPersonMinutes: s.duration?.additionalPersonMinutes ?? 0,
      bufferMinutes: s.duration?.bufferMinutes ?? 15,
      canRunConcurrentlyWithAnchor: s.duration?.canRunConcurrentlyWithAnchor ?? false,
    },
    pricing: {
      unitPriceINR: s.pricing?.unitPriceINR ?? 0,
      priceType: s.pricing?.priceType ?? 'per-service',
      minimumChargeINR: s.pricing?.minimumChargeINR,
      groupDiscountTiers: s.pricing?.groupDiscountTiers ?? [],
      travelSurchargeApplicable: s.pricing?.travelSurchargeApplicable ?? true,
      trialCreditINR: s.pricing?.trialCreditINR,
    },
    partyConfig: {
      isQuantifiable: s.partyConfig?.isQuantifiable ?? false,
      recipientType: s.partyConfig?.recipientType ?? 'any',
      quantityLabel: s.partyConfig?.quantityLabel ?? 'Person',
      minQuantity: s.partyConfig?.minQuantity ?? 1,
      maxQuantity: s.partyConfig?.maxQuantity ?? 1,
      defaultQuantity: s.partyConfig?.defaultQuantity ?? 1,
      requiresAnchorService: s.partyConfig?.requiresAnchorService ?? false,
    },
    aestheticSignals: {
      occasionTags: s.aestheticSignals?.occasionTags ?? [],
      styleArchetypeTags: s.aestheticSignals?.styleArchetypeTags ?? [],
      aiDescription: s.aestheticSignals?.aiDescription ?? '',
    },
    checkoutMeta: {
      checkoutCategory: s.checkoutMeta?.checkoutCategory ?? 'primary',
      displayPriority: s.checkoutMeta?.displayPriority ?? 0,
      estimateContribution: s.checkoutMeta?.estimateContribution ?? 'fixed',
      bundleEligible: s.checkoutMeta?.bundleEligible ?? false,
      requiresConsultation: s.checkoutMeta?.requiresConsultation ?? false,
    },
    flags: {
      isActive: s.flags?.isActive ?? true,
      isSignatureService: s.flags?.isSignatureService ?? false,
      isNewlyAdded: s.flags?.isNewlyAdded ?? false,
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    await dbConnect();
    const v = await Vendor.findOne({ slug: params.slug, 'flags.isActive': true })
      .select('name tagline profileImageUrl location.microLocation')
      .lean<Record<string, any>>();

    if (v) {
      const title = `${v.name} — Kajal Cartel`;
      const description = `${v.tagline}${v.location?.microLocation ? ` Bridal artist in ${v.location.microLocation}, New Delhi.` : ''}`;
      return {
        title,
        description,
        alternates: { canonical: `/artists/${params.slug}` },
        openGraph: {
          title,
          description,
          url: `/artists/${params.slug}`,
          type: 'profile',
          ...(v.profileImageUrl ? { images: [{ url: v.profileImageUrl, alt: v.name }] } : {}),
        },
      };
    }
  } catch (err) {
    // Falling back to a generic title is correct — metadata must never break the
    // page — but the failure still gets logged rather than silently swallowed.
    console.error(`[generateMetadata /artists/${params.slug}] Failed to load vendor:`, err);
  }

  return { title: 'Artist Profile — Kajal Cartel', robots: { index: false } };
}

function jsonLd(artist: ArtistProfile, reviews: PublicReview[]): string {
  const siteUrl = getSiteUrl();
  const absolute = (path: string) => (siteUrl ? new URL(path, siteUrl).toString() : path);
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: artist.name,
    description: artist.tagline,
    url: absolute(`/artists/${artist.slug}`),
    areaServed: `${artist.location.microLocation}, ${artist.location.city}`,
    ...(artist.profileImageUrl ? { image: absolute(artist.profileImageUrl) } : {}),
  };
  if (artist.ratings.totalReviews > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: artist.ratings.averageRating,
      reviewCount: artist.ratings.totalReviews,
      bestRating: 5,
      worstRating: 1,
    };
    data.review = reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.authorDisplayName },
      datePublished: r.createdAt.slice(0, 10),
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      reviewBody: r.body,
    }));
  }
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function ArtistPage({ params, searchParams }: PageProps) {
  await dbConnect();

  const rawVendor = await Vendor.findOne({
    slug: params.slug,
    'flags.isActive': true,
  }).lean<Record<string, any>>();

  if (!rawVendor) notFound();

  const vendorId = rawVendor._id as Types.ObjectId;
  const session = await getServerSession(authOptions);

  const [rawServices, stats, reviews, facets, savedUser] = await Promise.all([
    Service.find({
      vendor: vendorId,
      'flags.isActive': true,
    })
      .sort({ 'checkoutMeta.checkoutCategory': 1, 'checkoutMeta.displayPriority': 1 })
      .lean<Record<string, any>[]>(),
    getVendorReviewStats([vendorId]),
    listPublishedReviewsForVendor(vendorId, 30),
    getVendorFacets([vendorId]),
    session?.user?.email
      ? User.findOne({ email: session.user.email }).select('savedArtists').lean<{ savedArtists?: string[] }>()
      : Promise.resolve(null),
  ]);

  const artist = serializeArtist(rawVendor, stats.get(vendorId.toString()) ?? { averageRating: 0, totalReviews: 0 });
  const services = rawServices.map(serializeService);
  const requestedService = typeof searchParams?.service === 'string' ? searchParams.service : undefined;
  const initialServiceId = services.some((s) => s._id === requestedService && s.serviceRole === 'anchor') ? requestedService : undefined;

  return (
    <div className="relative w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(artist, reviews) }} />
      {/* This is the new overlay wrapper.
        It drops the Save button into the top right corner of the screen,
        floating beautifully above your Framer Motion UI.
      */}
      <div className="absolute top-6 right-6 md:top-10 md:right-10 z-50">
        <SaveArtistButton artistSlug={artist.slug} initialSaved={Boolean(savedUser?.savedArtists?.includes(artist.slug))} />
      </div>

      <ArtistPageClient
        artist={artist}
        services={services}
        reviews={reviews}
        policy={getBookingPolicy()}
        acceptsOnlineBooking={Boolean(facets.get(vendorId.toString())?.acceptsOnlineBooking)}
        initialServiceId={initialServiceId}
      />
    </div>
  );
}
