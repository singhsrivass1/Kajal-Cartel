import mongoose, { Types } from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected.\n');

  const Vendor = (await import('../src/lib/db/models/Vendor')).default;
  const Service = (await import('../src/lib/db/models/Service')).default;
  const Booking = (await import('../src/lib/db/models/Booking')).default;
  const PortfolioImage = (await import('../src/lib/db/models/PortfolioImage')).default;
  const VendorAvailability = (await import('../src/lib/db/models/VendorAvailability')).default;
  const BlockedDate = (await import('../src/lib/db/models/BlockedDate')).default;
  const admin = await import('../src/lib/db/controllers/VendorAdminManager');
  const { getDailyAvailability } = await import('../src/lib/db/controllers/AvailabilityManager');
  const { createBooking } = await import('../src/lib/db/controllers/BookingManager');
  const { buildRosterBrief } = await import('../src/lib/ai/rosterBrief');

  const TEST_SLUG = 'zz-test-vendor-phase53';

  // Clean any leftovers from a previous run.
  const stale = await Vendor.findOne({ slug: TEST_SLUG }).select('_id').lean<{ _id: Types.ObjectId }>();
  if (stale) {
    await Booking.deleteMany({ vendor: stale._id });
    await Service.deleteMany({ vendor: stale._id });
    await PortfolioImage.deleteMany({ vendor: stale._id });
    await VendorAvailability.deleteMany({ vendor: stale._id });
    await BlockedDate.deleteMany({ vendor: stale._id });
    await Vendor.deleteOne({ _id: stale._id });
  }

  console.log('--- 5.3.1 Vendor CRUD ---');
  const { id: vendorId } = await admin.createVendorDraft({
    name: 'ZZ Test Vendor',
    slug: TEST_SLUG,
    tagline: 'A test vendor created by the Phase 5.3 verification script.',
    aestheticBio: 'This is a synthetic vendor used to verify the admin CRUD paths end to end, including the activation gate, portfolio storage, service pricing and the availability conflict guards.',
    phone: '+91 90000 00000',
    microLocation: 'Hauz Khas',
    travelPolicy: 'studio-only',
    pricingTier: 'premium',
    startingFromINR: 40000,
    styleArchetypes: ['glass-skin-glam'],
    makeupFinishTags: ['dewy-glass-skin'],
    hairStyleTags: ['structured-updo'],
    occasionSpecializations: ['wedding-day-bridal'],
    colorPaletteAffinity: ['ivory-and-gold-neutral'],
    skinToneExpertise: ['pan-spectrum-expert'],
  });
  check('createVendorDraft returns an id', Boolean(vendorId));

  const draft = await Vendor.findById(vendorId).lean<Record<string, any>>();
  check('new vendor is created as a draft (inactive)', draft?.flags?.isActive === false);

  const rosterWhileDraft = await buildRosterBrief();
  check('draft vendor is absent from the AI roster', !rosterWhileDraft.includes(TEST_SLUG));

  // Activation gate: no images, no profile image yet.
  let gateError = '';
  try { await admin.setVendorActive(vendorId, true); }
  catch (e) { gateError = (e as Error).message; }
  check('activation is blocked without portfolio images', gateError.includes('cannot go live'), gateError);

  console.log('\n--- 5.3.2 Portfolio images ---');
  // 1x1 transparent PNG.
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const uploaded: string[] = [];
  for (let i = 0; i < 4; i++) {
    const { imageUrl } = await admin.uploadPortfolioImage(vendorId, {
      data: tinyPng,
      mimeType: 'image/png',
      altText: `Test image ${i + 1}`,
      primaryOccasion: 'wedding-day-bridal',
      styleArchetypesShown: ['glass-skin-glam'],
      colorPaletteShown: ['ivory-and-gold-neutral'],
      captionForAI: `Test image ${i + 1}`,
      useAsProfileImage: i === 0,
    });
    uploaded.push(imageUrl);
  }
  check('4 portfolio images uploaded', uploaded.length === 4);
  check('image docs live in their own collection', (await PortfolioImage.countDocuments({ vendor: vendorId })) === 4);

  const withImages = await Vendor.findById(vendorId).lean<Record<string, any>>();
  check('profileImageUrl was set from the first upload', withImages?.profileImageUrl === uploaded[0]);
  const vendorDocSize = JSON.stringify(withImages).length;
  check('vendor document stays small (no image bytes inside)', vendorDocSize < 100_000, `${vendorDocSize} bytes`);

  await admin.setVendorActive(vendorId, true);
  const activated = await Vendor.findById(vendorId).select('flags').lean<Record<string, any>>();
  check('activation succeeds once requirements are met', activated?.flags?.isActive === true);

  const rosterWhenLive = await buildRosterBrief();
  check('activated vendor appears in the AI roster', rosterWhenLive.includes(TEST_SLUG));

  let deleteGuard = '';
  try { await admin.deletePortfolioImage(vendorId, uploaded[0]); }
  catch (e) { deleteGuard = (e as Error).message; }
  check('live vendor cannot drop below 4 images', deleteGuard.includes('must keep at least'), deleteGuard);

  console.log('\n--- 5.3.3 Services & pricing ---');
  const { id: serviceId } = await admin.createService(vendorId, {
    name: 'Test Bridal Look',
    category: 'bridal-beauty',
    serviceRole: 'anchor',
    baseDurationMinutes: 120,
    bufferMinutes: 30,
    unitPriceINR: 25000,
    priceType: 'per-service',
    checkoutCategory: 'primary',
    estimateContribution: 'fixed',
    recipientType: 'bride',
    occasionTags: ['wedding-day-bridal'],
    aiDescription: 'A test anchor service.',
  });
  check('service created', Boolean(serviceId));

  const svc = await Service.findById(serviceId).lean<Record<string, any>>();
  check('price written to pricing.unitPriceINR (the field bookings read)', svc?.pricing?.unitPriceINR === 25000);

  await admin.updateService(serviceId, {
    name: 'Test Bridal Look',
    category: 'bridal-beauty',
    serviceRole: 'anchor',
    baseDurationMinutes: 120,
    bufferMinutes: 30,
    unitPriceINR: 31000,
    priceType: 'per-service',
    checkoutCategory: 'primary',
    estimateContribution: 'fixed',
    recipientType: 'bride',
    occasionTags: ['wedding-day-bridal'],
    aiDescription: 'A test anchor service.',
  });
  const svcUpdated = await Service.findById(serviceId).lean<Record<string, any>>();
  check('price edit persisted', svcUpdated?.pricing?.unitPriceINR === 31000);

  console.log('\n--- 5.3.4 Availability editor ---');
  await admin.updateWorkingHours(
    vendorId,
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, isOpen: true, startTime: '10:00', endTime: '19:00' })),
    30
  );
  const avail = await VendorAvailability.findOne({ vendor: vendorId }).lean<Record<string, any>>();
  check('working hours saved', avail?.workingHours?.length === 7);
  check('maxConcurrentBookings held at 1', avail?.maxConcurrentBookings === 1);

  // REGRESSION: availability computation still works after CRUD.
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + 30);
  const dateStr = target.toISOString().slice(0, 10);

  const slots = await getDailyAvailability({ vendorSlug: TEST_SLUG, serviceId, date: dateStr });
  check('availability computes slots for the edited hours', slots.slots.length > 0, `${slots.slots.length} slots`);
  check('slot duration reflects service duration + buffer', slots.durationMinutes === 150);
  // 10:00-19:00 = 540 min; last start must leave room for 150 min => 16:30.
  check('last slot respects closing time', slots.slots[slots.slots.length - 1] === '16:30', slots.slots[slots.slots.length - 1]);

  // REGRESSION: booking creation still works against admin-managed data.
  const fakeCustomer = new Types.ObjectId().toString();
  const booking = await createBooking(fakeCustomer, {
    artistSlug: TEST_SLUG,
    anchorServiceId: serviceId,
    addOns: [],
    date: dateStr,
    slotStart: '11:00',
    contactInfo: { name: 'Regression Test', phone: '9999999999', email: 'regression@example.com' },
    idempotencyKey: 'phase53-regression-key-01',
  });
  check('booking created against admin-managed service', Boolean(booking.bookingId));
  check('booking total re-derived from the edited price', booking.total === 31000, `got ${booking.total}`);

  // Conflict guard: shrinking hours that would orphan that booking.
  let hoursConflict = '';
  try {
    await admin.updateWorkingHours(
      vendorId,
      [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, isOpen: true, startTime: '14:00', endTime: '19:00' })),
      30
    );
  } catch (e) { hoursConflict = (e as Error).message; }
  check('working-hours edit that would orphan a booking is rejected', hoursConflict.includes('outside'), hoursConflict);

  // Conflict guard: blocking a date that covers that booking.
  let blockConflict = '';
  try { await admin.addBlockedDate(vendorId, dateStr, dateStr, 'Test block'); }
  catch (e) { blockConflict = (e as Error).message; }
  check('blocked date covering a booking is rejected', blockConflict.includes('existing booking'), blockConflict);

  // A non-conflicting blocked date should succeed.
  const freeDate = new Date();
  freeDate.setUTCDate(freeDate.getUTCDate() + 60);
  const freeStr = freeDate.toISOString().slice(0, 10);
  const { id: blockId } = await admin.addBlockedDate(vendorId, freeStr, freeStr, 'Test block');
  check('non-conflicting blocked date is accepted', Boolean(blockId));

  const blockedAvail = await getDailyAvailability({ vendorSlug: TEST_SLUG, serviceId, date: freeStr });
  check('blocked date removes all slots', blockedAvail.isBlocked && blockedAvail.slots.length === 0);

  await admin.deleteBlockedDate(vendorId, blockId);
  check('blocked date removed', (await BlockedDate.countDocuments({ vendor: vendorId })) === 0);

  console.log('\n--- Deactivation ---');
  await admin.setVendorActive(vendorId, false);
  const rosterAfterDeactivate = await buildRosterBrief();
  check('deactivated vendor leaves the AI roster immediately', !rosterAfterDeactivate.includes(TEST_SLUG));

  // Cleanup.
  await Booking.deleteMany({ vendor: vendorId });
  await Service.deleteMany({ vendor: vendorId });
  await PortfolioImage.deleteMany({ vendor: vendorId });
  await VendorAvailability.deleteMany({ vendor: vendorId });
  await BlockedDate.deleteMany({ vendor: vendorId });
  await Vendor.deleteOne({ _id: vendorId });
  console.log('\nTest vendor cleaned up.');

  console.log(`\n${pass} passed, ${fail} failed.`);
  await mongoose.disconnect();
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
