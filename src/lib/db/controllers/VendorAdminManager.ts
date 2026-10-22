import { Types } from 'mongoose';
import Vendor from '@/lib/db/models/Vendor';
import Service from '@/lib/db/models/Service';
import Booking from '@/lib/db/models/Booking';
import VendorAvailability from '@/lib/db/models/VendorAvailability';
import BlockedDate from '@/lib/db/models/BlockedDate';
import PortfolioImage, {
  PORTFOLIO_IMAGE_MIME_TYPES,
  MAX_PORTFOLIO_IMAGE_BYTES,
} from '@/lib/db/models/PortfolioImage';
import { parseTimeToMinutes } from '@/lib/db/utils/time';

export class VendorAdminError extends Error {
  readonly statusCode: 400 | 404 | 409 | 422;

  constructor(message: string, statusCode: 400 | 404 | 409 | 422 = 400) {
    super(message);
    this.name = 'VendorAdminError';
    this.statusCode = statusCode;
  }
}

/** A vendor must have at least this many portfolio images before it can go live. */
export const MIN_PORTFOLIO_IMAGES_TO_ACTIVATE = 4;

function assertObjectId(id: string, label = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new VendorAdminError(`Invalid ${label}.`, 400);
  }
  return new Types.ObjectId(id);
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function formatBookingLabel(b: { date: Date; startTime: string; endTime: string }): string {
  return `${new Date(b.date).toISOString().slice(0, 10)} ${b.startTime}–${b.endTime}`;
}

/* ------------------------------------------------------------------ *
 * Vendor listing / reading
 * ------------------------------------------------------------------ */

export interface AdminVendorListRow {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  isActive: boolean;
  profileImageUrl: string;
  portfolioCount: number;
  serviceCount: number;
  microLocation: string;
  pricingTier: string;
}

export async function listVendorsForAdmin(): Promise<AdminVendorListRow[]> {
  const vendors = await Vendor.find({})
    .select('name slug tagline flags profileImageUrl portfolio location pricing')
    .sort({ name: 1 })
    .lean<Array<Record<string, any>>>();

  const counts = await Service.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { 'flags.isActive': true } },
    { $group: { _id: '$vendor', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return vendors.map((v) => ({
    id: v._id.toString(),
    name: v.name,
    slug: v.slug,
    tagline: v.tagline ?? '',
    isActive: v.flags?.isActive ?? false,
    profileImageUrl: v.profileImageUrl ?? '',
    portfolioCount: Array.isArray(v.portfolio) ? v.portfolio.length : 0,
    serviceCount: countMap.get(v._id.toString()) ?? 0,
    microLocation: v.location?.microLocation ?? '',
    pricingTier: v.pricing?.tier ?? '',
  }));
}

export async function getVendorForAdmin(vendorId: string): Promise<Record<string, any>> {
  const _id = assertObjectId(vendorId, 'vendor id');
  const vendor = await Vendor.findById(_id).lean<Record<string, any>>();
  if (!vendor) throw new VendorAdminError('Vendor not found.', 404);
  return vendor;
}

/* ------------------------------------------------------------------ *
 * Vendor create / update / activate
 * ------------------------------------------------------------------ */

export interface CreateVendorInput {
  name: string;
  slug: string;
  tagline: string;
  aestheticBio: string;
  phone: string;
  microLocation: string;
  travelPolicy: string;
  pricingTier: string;
  startingFromINR: number;
  styleArchetypes: string[];
  makeupFinishTags: string[];
  hairStyleTags: string[];
  occasionSpecializations: string[];
  colorPaletteAffinity: string[];
  skinToneExpertise: string[];
}

function requireNonEmptyArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new VendorAdminError(`${label} must contain at least one value.`);
  }
  return value.map(String);
}

export async function createVendorDraft(input: CreateVendorInput): Promise<{ id: string; slug: string }> {
  const name = input.name?.trim();
  const slug = input.slug?.trim().toLowerCase();
  const tagline = input.tagline?.trim();
  const aestheticBio = input.aestheticBio?.trim();

  if (!name) throw new VendorAdminError('Name is required.');
  if (!slug) throw new VendorAdminError('Slug is required.');
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new VendorAdminError('Slug may only contain lowercase letters, numbers, and hyphens.');
  }
  if (!tagline) throw new VendorAdminError('Tagline is required.');
  if (!aestheticBio || aestheticBio.length < 80) {
    throw new VendorAdminError('Aesthetic bio is required and must be at least 80 characters — it is the text the matching AI reads.');
  }
  if (aestheticBio.length > 400) {
    throw new VendorAdminError('Aesthetic bio cannot exceed 400 characters.');
  }
  if (!input.phone?.trim()) throw new VendorAdminError('Phone is required.');
  if (typeof input.startingFromINR !== 'number' || input.startingFromINR < 0) {
    throw new VendorAdminError('Starting price must be a non-negative number.');
  }

  const styleArchetypes = requireNonEmptyArray(input.styleArchetypes, 'Style archetypes');
  if (styleArchetypes.length > 3) {
    throw new VendorAdminError('Style archetypes must contain between 1 and 3 values.');
  }

  const existing = await Vendor.findOne({ slug }).select('_id').lean();
  if (existing) throw new VendorAdminError('A vendor with that slug already exists.', 409);

  try {
    const vendor = await Vendor.create({
      name,
      slug,
      tagline,
      profileImageUrl: '',
      location: {
        microLocation: input.microLocation,
        city: 'New Delhi',
        travelPolicy: input.travelPolicy,
        serviceRadius: 15,
      },
      contact: { phone: input.phone.trim() },
      businessMeta: {
        yearsOfExperience: 0,
        teamSize: 1,
        languagesSpoken: ['Hindi', 'English'],
        bookingLeadTimeDays: 7,
        trialsOffered: false,
      },
      pricing: {
        tier: input.pricingTier,
        startingFromINR: input.startingFromINR,
        currency: 'INR',
      },
      aestheticProfile: {
        styleArchetypes,
        makeupFinishTags: requireNonEmptyArray(input.makeupFinishTags, 'Makeup finish tags'),
        hairStyleTags: requireNonEmptyArray(input.hairStyleTags, 'Hair style tags'),
        occasionSpecializations: requireNonEmptyArray(input.occasionSpecializations, 'Occasion specializations'),
        colorPaletteAffinity: requireNonEmptyArray(input.colorPaletteAffinity, 'Colour palette affinity'),
        skinToneExpertise: requireNonEmptyArray(input.skinToneExpertise, 'Skin tone expertise'),
        aestheticBio,
      },
      portfolio: [],
      // Always created as a draft — activation is a separate, gated action.
      flags: { isActive: false, isVerified: false, isFeatured: false, badgeType: null },
    });

    return { id: (vendor._id as Types.ObjectId).toString(), slug: vendor.slug };
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw new VendorAdminError('A vendor with that slug already exists.', 409);
    }
    if (err instanceof Error && err.name === 'ValidationError') {
      throw new VendorAdminError(err.message, 422);
    }
    throw err;
  }
}

/** Fields an admin may edit on an existing vendor. Anything not listed here is ignored. */
const EDITABLE_VENDOR_PATHS = [
  'name',
  'tagline',
  'bio',
  'profileImageUrl',
  'location.microLocation',
  'location.travelPolicy',
  'location.serviceRadius',
  'contact.phone',
  'contact.whatsapp',
  'contact.email',
  'contact.instagram',
  'contact.website',
  'businessMeta.yearsOfExperience',
  'businessMeta.teamSize',
  'businessMeta.languagesSpoken',
  'businessMeta.bookingLeadTimeDays',
  'businessMeta.trialsOffered',
  'businessMeta.trialDurationMinutes',
  'pricing.tier',
  'pricing.startingFromINR',
  'pricing.travelSurchargePerKm',
  'aestheticProfile.styleArchetypes',
  'aestheticProfile.makeupFinishTags',
  'aestheticProfile.hairStyleTags',
  'aestheticProfile.occasionSpecializations',
  'aestheticProfile.colorPaletteAffinity',
  'aestheticProfile.skinToneExpertise',
  'aestheticProfile.signatureElements',
  'aestheticProfile.aestheticBio',
  'aestheticProfile.moodKeywords',
  'aestheticProfile.contraIndicators',
  'aestheticProfile.contraIndicatorsNotes',
  'flags.isVerified',
  'flags.isFeatured',
  'flags.badgeType',
] as const;

export async function updateVendorProfile(
  vendorId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const _id = assertObjectId(vendorId, 'vendor id');

  const $set: Record<string, unknown> = {};
  for (const path of EDITABLE_VENDOR_PATHS) {
    if (Object.prototype.hasOwnProperty.call(patch, path)) {
      $set[path] = patch[path];
    }
  }

  // `slug` and `flags.isActive` are intentionally excluded: the slug is the
  // identifier the AI roster and every saved reference use, and activation runs
  // through setVendorActive so it cannot skip the completeness gate.
  if (Object.keys($set).length === 0) {
    throw new VendorAdminError('No editable fields were provided.');
  }

  try {
    const result = await Vendor.updateOne({ _id }, { $set }, { runValidators: true });
    if (result.matchedCount === 0) throw new VendorAdminError('Vendor not found.', 404);
  } catch (err: unknown) {
    if (err instanceof VendorAdminError) throw err;
    if (err instanceof Error && err.name === 'ValidationError') {
      throw new VendorAdminError(err.message, 422);
    }
    throw err;
  }
}

export interface ActivationBlocker {
  reason: string;
}

export async function setVendorActive(vendorId: string, isActive: boolean): Promise<void> {
  const _id = assertObjectId(vendorId, 'vendor id');
  const vendor = await Vendor.findById(_id).select('portfolio profileImageUrl aestheticProfile flags').lean<Record<string, any>>();
  if (!vendor) throw new VendorAdminError('Vendor not found.', 404);

  if (isActive) {
    const blockers: string[] = [];
    const portfolioCount = Array.isArray(vendor.portfolio) ? vendor.portfolio.length : 0;
    if (portfolioCount < MIN_PORTFOLIO_IMAGES_TO_ACTIVATE) {
      blockers.push(
        `needs at least ${MIN_PORTFOLIO_IMAGES_TO_ACTIVATE} portfolio images (has ${portfolioCount})`
      );
    }
    if (!vendor.profileImageUrl) {
      blockers.push('needs a profile image');
    }
    const bio = vendor.aestheticProfile?.aestheticBio ?? '';
    if (bio.trim().length < 80) {
      blockers.push('needs an aesthetic bio of at least 80 characters');
    }

    if (blockers.length > 0) {
      throw new VendorAdminError(
        `This vendor cannot go live yet — it ${blockers.join(', and ')}.`,
        422
      );
    }
  }

  await Vendor.updateOne({ _id }, { $set: { 'flags.isActive': isActive } });
}

/* ------------------------------------------------------------------ *
 * Portfolio images
 * ------------------------------------------------------------------ */

export interface UploadPortfolioImageInput {
  data: string;
  mimeType: string;
  altText: string;
  primaryOccasion: string;
  styleArchetypesShown: string[];
  colorPaletteShown: string[];
  captionForAI: string;
  isHeroImage?: boolean;
  useAsProfileImage?: boolean;
}

export async function uploadPortfolioImage(
  vendorId: string,
  input: UploadPortfolioImageInput
): Promise<{ imageId: string; imageUrl: string }> {
  const _id = assertObjectId(vendorId, 'vendor id');

  if (!input.data || typeof input.data !== 'string') {
    throw new VendorAdminError('Image data is required.');
  }
  if (!PORTFOLIO_IMAGE_MIME_TYPES.includes(input.mimeType)) {
    throw new VendorAdminError(`Image type must be one of: ${PORTFOLIO_IMAGE_MIME_TYPES.join(', ')}.`);
  }
  const estimatedBytes = Math.ceil(input.data.length * 0.75);
  if (estimatedBytes > MAX_PORTFOLIO_IMAGE_BYTES) {
    throw new VendorAdminError(
      `Portfolio images must be under ${Math.round(MAX_PORTFOLIO_IMAGE_BYTES / (1024 * 1024))}MB each.`
    );
  }

  const vendor = await Vendor.findById(_id).select('portfolio').lean<Record<string, any>>();
  if (!vendor) throw new VendorAdminError('Vendor not found.', 404);
  if (Array.isArray(vendor.portfolio) && vendor.portfolio.length >= 20) {
    throw new VendorAdminError('A vendor portfolio cannot exceed 20 images.', 422);
  }

  const image = await PortfolioImage.create({
    vendor: _id,
    data: input.data,
    mimeType: input.mimeType,
  });
  const imageId = (image._id as Types.ObjectId).toString();
  const imageUrl = `/api/portfolio-images/${imageId}`;

  const sortOrder = Array.isArray(vendor.portfolio) ? vendor.portfolio.length : 0;

  try {
    await Vendor.updateOne(
      { _id },
      {
        $push: {
          portfolio: {
            imageUrl,
            altText: input.altText?.trim() || 'Bridal portfolio image',
            primaryOccasion: input.primaryOccasion,
            styleArchetypesShown: requireNonEmptyArray(input.styleArchetypesShown, 'Style archetypes shown'),
            colorPaletteShown: requireNonEmptyArray(input.colorPaletteShown, 'Colour palette shown'),
            captionForAI: input.captionForAI?.trim() || input.altText?.trim() || 'Bridal portfolio image',
            isHeroImage: false,
            sortOrder,
          },
        },
        ...(input.useAsProfileImage ? { $set: { profileImageUrl: imageUrl } } : {}),
      },
      { runValidators: true }
    );
  } catch (err) {
    // Don't leave an orphaned image document behind if the Vendor write rejects.
    await PortfolioImage.deleteOne({ _id: image._id });
    if (err instanceof Error && err.name === 'ValidationError') {
      throw new VendorAdminError(err.message, 422);
    }
    throw err;
  }

  return { imageId, imageUrl };
}

export async function deletePortfolioImage(vendorId: string, imageUrl: string): Promise<void> {
  const _id = assertObjectId(vendorId, 'vendor id');

  const vendor = await Vendor.findById(_id).select('portfolio profileImageUrl flags').lean<Record<string, any>>();
  if (!vendor) throw new VendorAdminError('Vendor not found.', 404);

  const portfolio: Array<Record<string, any>> = vendor.portfolio ?? [];
  if (!portfolio.some((p) => p.imageUrl === imageUrl)) {
    throw new VendorAdminError('That image is not part of this vendor’s portfolio.', 404);
  }

  if (vendor.flags?.isActive && portfolio.length <= MIN_PORTFOLIO_IMAGES_TO_ACTIVATE) {
    throw new VendorAdminError(
      `A live vendor must keep at least ${MIN_PORTFOLIO_IMAGES_TO_ACTIVATE} portfolio images. Deactivate the vendor first, or add another image before removing this one.`,
      409
    );
  }

  const unsetProfile = vendor.profileImageUrl === imageUrl;

  await Vendor.updateOne(
    { _id },
    {
      $pull: { portfolio: { imageUrl } },
      ...(unsetProfile ? { $set: { profileImageUrl: '' } } : {}),
    }
  );

  // Only delete the underlying bytes for images we own; seeded /images/... paths
  // are static assets and have no PortfolioImage document.
  const match = imageUrl.match(/^\/api\/portfolio-images\/([a-f0-9]{24})$/i);
  if (match) {
    await PortfolioImage.deleteOne({ _id: new Types.ObjectId(match[1]), vendor: _id });
  }
}

/* ------------------------------------------------------------------ *
 * Services
 * ------------------------------------------------------------------ */

export interface ServiceInput {
  name: string;
  description?: string;
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
  isActive?: boolean;
}

function validateServiceInput(input: ServiceInput) {
  if (!input.name?.trim()) throw new VendorAdminError('Service name is required.');
  if (typeof input.baseDurationMinutes !== 'number' || input.baseDurationMinutes < 15) {
    throw new VendorAdminError('Base duration must be at least 15 minutes.');
  }
  if (typeof input.bufferMinutes !== 'number' || input.bufferMinutes < 0) {
    throw new VendorAdminError('Buffer minutes must be zero or more.');
  }
  if (typeof input.unitPriceINR !== 'number' || input.unitPriceINR < 0) {
    throw new VendorAdminError('Price must be a non-negative number.');
  }
  requireNonEmptyArray(input.occasionTags, 'Occasion tags');
  if (!input.aiDescription?.trim()) {
    throw new VendorAdminError('AI description is required — it is what the matching AI reads for this service.');
  }
}

export async function listServicesForVendor(vendorId: string): Promise<Array<Record<string, any>>> {
  const _id = assertObjectId(vendorId, 'vendor id');
  return Service.find({ vendor: _id })
    .sort({ 'checkoutMeta.displayPriority': 1, name: 1 })
    .lean<Array<Record<string, any>>>();
}

export async function createService(vendorId: string, input: ServiceInput): Promise<{ id: string }> {
  const _id = assertObjectId(vendorId, 'vendor id');
  validateServiceInput(input);

  const vendor = await Vendor.findById(_id).select('_id').lean();
  if (!vendor) throw new VendorAdminError('Vendor not found.', 404);

  const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  try {
    const service = await Service.create({
      vendor: _id,
      name: input.name.trim(),
      slug,
      category: input.category,
      serviceRole: input.serviceRole,
      description: input.description?.trim(),
      compatibleAnchorCategories: [],
      duration: {
        baseDurationMinutes: input.baseDurationMinutes,
        additionalPersonMinutes: 0,
        bufferMinutes: input.bufferMinutes,
        canRunConcurrentlyWithAnchor: false,
      },
      // Single source of truth for price: BookingManager re-derives every booking
      // total from Service.pricing.unitPriceINR via ServiceManager, so this is the
      // same field that money is actually calculated from. No parallel price field.
      pricing: {
        unitPriceINR: input.unitPriceINR,
        priceType: input.priceType,
        groupDiscountTiers: [],
        travelSurchargeApplicable: true,
      },
      partyConfig: {
        isQuantifiable: input.serviceRole === 'add-on',
        recipientType: input.recipientType,
        quantityLabel: 'Person',
        minQuantity: 1,
        maxQuantity: input.serviceRole === 'add-on' ? 10 : 1,
        defaultQuantity: 1,
        requiresAnchorService: input.serviceRole === 'add-on',
      },
      aestheticSignals: {
        occasionTags: input.occasionTags,
        styleArchetypeTags: [],
        aiDescription: input.aiDescription.trim(),
      },
      checkoutMeta: {
        checkoutCategory: input.checkoutCategory,
        displayPriority: 0,
        estimateContribution: input.estimateContribution,
        bundleEligible: false,
        requiresConsultation: false,
      },
      flags: { isActive: input.isActive ?? true, isSignatureService: false, isNewlyAdded: false },
    });
    return { id: (service._id as Types.ObjectId).toString() };
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw new VendorAdminError('This vendor already has a service with that name.', 409);
    }
    if (err instanceof Error && err.name === 'ValidationError') {
      throw new VendorAdminError(err.message, 422);
    }
    throw err;
  }
}

export async function updateService(serviceId: string, input: ServiceInput): Promise<void> {
  const _id = assertObjectId(serviceId, 'service id');
  validateServiceInput(input);

  try {
    const result = await Service.updateOne(
      { _id },
      {
        $set: {
          name: input.name.trim(),
          description: input.description?.trim(),
          category: input.category,
          serviceRole: input.serviceRole,
          'duration.baseDurationMinutes': input.baseDurationMinutes,
          'duration.bufferMinutes': input.bufferMinutes,
          'pricing.unitPriceINR': input.unitPriceINR,
          'pricing.priceType': input.priceType,
          'aestheticSignals.occasionTags': input.occasionTags,
          'aestheticSignals.aiDescription': input.aiDescription.trim(),
          'checkoutMeta.checkoutCategory': input.checkoutCategory,
          'checkoutMeta.estimateContribution': input.estimateContribution,
          'partyConfig.recipientType': input.recipientType,
          ...(typeof input.isActive === 'boolean' ? { 'flags.isActive': input.isActive } : {}),
        },
      },
      { runValidators: true }
    );
    if (result.matchedCount === 0) throw new VendorAdminError('Service not found.', 404);
  } catch (err: unknown) {
    if (err instanceof VendorAdminError) throw err;
    if (err instanceof Error && err.name === 'ValidationError') {
      throw new VendorAdminError(err.message, 422);
    }
    throw err;
  }
}

export async function deleteService(serviceId: string): Promise<void> {
  const _id = assertObjectId(serviceId, 'service id');

  // A service referenced by a live booking is deactivated rather than removed, so
  // the booking's own record (and its price snapshot) stays resolvable.
  const liveBookings = await Booking.countDocuments({
    service: _id,
    status: { $in: ['PENDING', 'CONFIRMED'] },
  });

  if (liveBookings > 0) {
    await Service.updateOne({ _id }, { $set: { 'flags.isActive': false } });
    throw new VendorAdminError(
      `This service has ${liveBookings} active booking(s), so it was deactivated instead of deleted. It will no longer be bookable, and existing bookings are unaffected.`,
      409
    );
  }

  const result = await Service.deleteOne({ _id });
  if (result.deletedCount === 0) throw new VendorAdminError('Service not found.', 404);
}

/* ------------------------------------------------------------------ *
 * Availability — working hours + blocked dates
 * ------------------------------------------------------------------ */

export interface WorkingHoursInput {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_WORKING_HOURS: WorkingHoursInput[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek !== 0,
  startTime: '10:00',
  endTime: '19:00',
}));

export async function getAvailabilityForAdmin(vendorId: string): Promise<{
  workingHours: WorkingHoursInput[];
  slotIntervalMinutes: number;
  maxConcurrentBookings: number;
  blockedDates: Array<{ id: string; startDate: string; endDate: string; reason?: string }>;
}> {
  const _id = assertObjectId(vendorId, 'vendor id');

  const availability = await VendorAvailability.findOne({ vendor: _id }).lean<Record<string, any>>();
  const blocked = await BlockedDate.find({ vendor: _id })
    .sort({ startDate: 1 })
    .lean<Array<Record<string, any>>>();

  return {
    workingHours: availability?.workingHours ?? DEFAULT_WORKING_HOURS,
    slotIntervalMinutes: availability?.slotIntervalMinutes ?? 30,
    maxConcurrentBookings: availability?.maxConcurrentBookings ?? 1,
    blockedDates: blocked.map((b) => ({
      id: b._id.toString(),
      startDate: new Date(b.startDate).toISOString().slice(0, 10),
      endDate: new Date(b.endDate).toISOString().slice(0, 10),
      reason: b.reason,
    })),
  };
}

/**
 * Rejects a working-hours change that would leave an existing future booking
 * outside the vendor's hours, rather than silently orphaning it. Conflict
 * *resolution* (moving or cancelling the affected bookings) is deliberately not
 * built here — the admin is told exactly which bookings block the change.
 */
async function assertWorkingHoursFitExistingBookings(
  vendorId: Types.ObjectId,
  workingHours: WorkingHoursInput[]
): Promise<void> {
  const bookings = await Booking.find({
    vendor: vendorId,
    status: { $in: ['PENDING', 'CONFIRMED'] },
    date: { $gte: todayUTC() },
  })
    .select('date startTime endTime')
    .lean<Array<{ date: Date; startTime: string; endTime: string }>>();

  if (bookings.length === 0) return;

  const byDay = new Map(workingHours.map((w) => [w.dayOfWeek, w]));
  const conflicts: string[] = [];

  for (const b of bookings) {
    const cfg = byDay.get(new Date(b.date).getUTCDay());
    if (!cfg || !cfg.isOpen) {
      conflicts.push(formatBookingLabel(b));
      continue;
    }
    if (
      parseTimeToMinutes(b.startTime) < parseTimeToMinutes(cfg.startTime) ||
      parseTimeToMinutes(b.endTime) > parseTimeToMinutes(cfg.endTime)
    ) {
      conflicts.push(formatBookingLabel(b));
    }
  }

  if (conflicts.length > 0) {
    throw new VendorAdminError(
      `These hours would leave ${conflicts.length} existing booking(s) outside the vendor's working hours: ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? ', …' : ''}. Cancel or reschedule them first.`,
      409
    );
  }
}

export async function updateWorkingHours(
  vendorId: string,
  workingHours: WorkingHoursInput[],
  slotIntervalMinutes: number
): Promise<void> {
  const _id = assertObjectId(vendorId, 'vendor id');

  if (!Array.isArray(workingHours) || workingHours.length !== 7) {
    throw new VendorAdminError('Working hours must contain exactly one entry per day of the week.');
  }
  const days = new Set(workingHours.map((w) => w.dayOfWeek));
  if (days.size !== 7) {
    throw new VendorAdminError('Working hours must contain exactly one entry per day of the week.');
  }
  for (const w of workingHours) {
    if (!w.isOpen) continue;
    if (parseTimeToMinutes(w.endTime) <= parseTimeToMinutes(w.startTime)) {
      throw new VendorAdminError('Closing time must be after opening time on every open day.');
    }
  }
  if (typeof slotIntervalMinutes !== 'number' || slotIntervalMinutes < 5) {
    throw new VendorAdminError('Slot interval must be at least 5 minutes.');
  }

  await assertWorkingHoursFitExistingBookings(_id, workingHours);

  // maxConcurrentBookings is deliberately not settable here: the Phase 3 partial
  // unique index on (vendor, service, date, startTime) only enforces capacity = 1,
  // so exposing this field would silently make that guarantee wrong.
  await VendorAvailability.findOneAndUpdate(
    { vendor: _id },
    {
      $set: { workingHours, slotIntervalMinutes },
      $setOnInsert: { vendor: _id, maxConcurrentBookings: 1 },
    },
    { upsert: true, runValidators: true, new: true }
  );
}

export async function addBlockedDate(
  vendorId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<{ id: string }> {
  const _id = assertObjectId(vendorId, 'vendor id');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new VendorAdminError('Dates must be in YYYY-MM-DD format.');
  }
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  if (end.getTime() < start.getTime()) {
    throw new VendorAdminError('End date must be on or after start date.');
  }

  // Same reasoning as the working-hours guard: don't silently strand a booking
  // inside a newly blocked range.
  const conflicting = await Booking.find({
    vendor: _id,
    status: { $in: ['PENDING', 'CONFIRMED'] },
    date: { $gte: start, $lte: end },
  })
    .select('date startTime endTime')
    .lean<Array<{ date: Date; startTime: string; endTime: string }>>();

  if (conflicting.length > 0) {
    throw new VendorAdminError(
      `This range covers ${conflicting.length} existing booking(s): ${conflicting.slice(0, 5).map(formatBookingLabel).join(', ')}${conflicting.length > 5 ? ', …' : ''}. Cancel or reschedule them first.`,
      409
    );
  }

  const doc = await BlockedDate.create({
    vendor: _id,
    startDate: start,
    endDate: end,
    reason: reason?.trim() || undefined,
  });
  return { id: (doc._id as Types.ObjectId).toString() };
}

export async function deleteBlockedDate(vendorId: string, blockedDateId: string): Promise<void> {
  const vendorObjectId = assertObjectId(vendorId, 'vendor id');
  const _id = assertObjectId(blockedDateId, 'blocked date id');

  const result = await BlockedDate.deleteOne({ _id, vendor: vendorObjectId });
  if (result.deletedCount === 0) throw new VendorAdminError('Blocked date not found.', 404);
}
