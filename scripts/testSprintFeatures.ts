import { randomBytes } from 'crypto';

let pass = 0;
let fail = 0;
const out = (line: string) => process.stdout.write(line + '\n');
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    out(`  PASS  ${label}`);
  } else {
    fail++;
    out(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function requireDisposableDatabase(): string {
  if (process.env.CONFIRM_DISPOSABLE_TEST_DB !== 'yes') {
    throw new Error('Refusing to run: set CONFIRM_DISPOSABLE_TEST_DB=yes to confirm the target database is disposable.');
  }
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) throw new Error('Refusing to run: TEST_MONGODB_URI is not set.');
  const parsed = new URL(uri);
  if (parsed.protocol !== 'mongodb:') throw new Error('Refusing to run: only mongodb:// URIs to a local server are allowed.');
  if (!LOCAL_HOSTS.has(parsed.hostname)) throw new Error('Refusing to run: the test database host must be localhost.');
  if (!/^[a-z0-9_]+_test$/i.test(parsed.pathname.replace(/^\//, ''))) throw new Error('Refusing to run: the test database name must end in _test.');
  if (process.env.MONGODB_URI && process.env.MONGODB_URI !== uri) throw new Error('Refusing to run: MONGODB_URI is set to a different database.');
  return uri;
}

process.env.MONGODB_URI = requireDisposableDatabase();

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  const mongoose = (await import('mongoose')).default;
  const { Types } = mongoose;
  const { dbConnect } = await import('../src/lib/db/connect');
  await dbConnect();
  const db = mongoose.connection.db!;
  if (!db.databaseName.endsWith('_test')) throw new Error('Connected to an unexpected database.');

  const User = (await import('../src/lib/db/models/User')).default;
  const Vendor = (await import('../src/lib/db/models/Vendor')).default;
  const Service = (await import('../src/lib/db/models/Service')).default;
  const Booking = (await import('../src/lib/db/models/Booking')).default;
  const VendorAvailability = (await import('../src/lib/db/models/VendorAvailability')).default;
  const SavedMoodboard = (await import('../src/lib/db/models/SavedMoodboard')).default;
  const PlanningBoard = (await import('../src/lib/db/models/PlanningBoard')).default;
  const BoardImage = (await import('../src/lib/db/models/BoardImage')).default;
  const profile = await import('../src/lib/db/controllers/ProfileManager');
  const boards = await import('../src/lib/db/controllers/BoardManager');
  const moodboards = await import('../src/lib/db/controllers/MoodboardManager');
  const discovery = await import('../src/lib/db/controllers/DiscoveryManager');
  const insights = await import('../src/lib/db/controllers/AdminInsightsManager');
  const bookingsLib = await import('../src/lib/db/controllers/BookingManager');
  const portal = await import('../src/lib/db/controllers/ArtistPortalManager');
  const artistAuth = await import('../src/lib/auth/artist');
  const ratings = await import('../src/lib/db/serializers/verifiedRatings');
  const time = await import('../src/lib/db/utils/time');

  await Promise.all(
    ['users', 'vendors', 'services', 'bookings', 'reviews', 'vendoravailabilities', 'blockeddates', 'savedmoodboards', 'planningboards', 'boardimages'].map((n) =>
      db.collection(n).deleteMany({})
    )
  );
  await Promise.all([PlanningBoard.init(), BoardImage.init(), Booking.init(), User.init(), Vendor.init(), Service.init()]);

  const expectStatus = async (label: string, fn: () => Promise<unknown>, status: number) => {
    try {
      await fn();
      check(label, false, 'succeeded unexpectedly');
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      check(label, code === status, `got ${code ?? (err as Error).message}`);
    }
  };

  const [alice, bob, adminUser] = await User.insertMany([
    { email: `alice-${randomBytes(3).toString('hex')}@customers.example.test`, name: 'Alice Kapoor', role: 'customer' },
    { email: `bob-${randomBytes(3).toString('hex')}@customers.example.test`, name: 'Bob Mehra', role: 'customer' },
    { email: `admin-${randomBytes(3).toString('hex')}@admin.example.test`, name: 'Admin', role: 'admin' },
  ]);
  const aliceId = alice._id.toString();
  const bobId = bob._id.toString();

  out('\n--- Profile ---');
  await expectStatus('profile requires a name', () => profile.updateProfile(aliceId, { name: '   ' }), 400);
  await expectStatus('profile rejects markup characters in names', () => profile.updateProfile(aliceId, { name: '<script>' }), 400);
  await expectStatus('profile rejects letters in phone numbers', () => profile.updateProfile(aliceId, { name: 'Alice', phone: 'call me' }), 400);
  await expectStatus('profile rejects too few digits', () => profile.updateProfile(aliceId, { name: 'Alice', phone: '12345' }), 400);
  const updated = await profile.updateProfile(aliceId, { name: '  Alice   Kapoor  ', phone: '+91 98765 43210' });
  check('profile update normalises and persists', updated.name === 'Alice Kapoor' && updated.phone === '+91 98765 43210');
  const cleared = await profile.updateProfile(aliceId, { name: 'Alice Kapoor', phone: '' });
  check('clearing the phone removes it', cleared.phone === '');
  const unchangedRole = await User.findById(alice._id).lean<Record<string, any>>();
  check('profile update cannot change role or email', unchangedRole?.role === 'customer' && unchangedRole?.email === alice.email);
  await profile.updateProfile(aliceId, { name: 'Alice Kapoor', role: 'admin', email: 'x@y.test' } as any);
  check('extra fields such as role are ignored', (await User.findById(alice._id).lean<Record<string, any>>())?.role === 'customer');

  out('\n--- Vendors, services and discovery facets ---');
  const vendorBase = {
    tagline: 'Test vendor',
    profileImageUrl: '/images/test.png',
    contact: { phone: '+91 90000 00000' },
    pricing: { tier: 'premium', startingFromINR: 10000, currency: 'INR' },
    aestheticProfile: {
      styleArchetypes: ['glass-skin-glam'],
      makeupFinishTags: ['dewy-glass-skin'],
      hairStyleTags: ['structured-updo'],
      occasionSpecializations: ['wedding-day-bridal'],
      colorPaletteAffinity: ['ivory-and-gold-neutral'],
      skinToneExpertise: ['pan-spectrum-expert'],
      aestheticBio: 'A synthetic vendor used only by the sprint feature test suite to exercise discovery, boards and admin tools.',
    },
    businessMeta: { yearsOfExperience: 3, teamSize: 1, languagesSpoken: ['English'], bookingLeadTimeDays: 0, trialsOffered: false },
    portfolio: [
      { imageUrl: '/images/p1.png', altText: 'Portfolio one', primaryOccasion: 'wedding-day-bridal', styleArchetypesShown: ['glass-skin-glam'], colorPaletteShown: ['ivory-and-gold-neutral'], captionForAI: 'x', isHeroImage: false, sortOrder: 0 },
    ],
    ratings: { averageRating: 4.9, totalReviews: 47, skillScore: 5, punctualityScore: 5, communicationScore: 5, valueScore: 5 },
  };
  const open = await Vendor.create({ ...vendorBase, name: 'ZZ Open', slug: 'zz-open', location: { microLocation: 'Saket', city: 'New Delhi', travelPolicy: 'all', serviceRadius: 10 }, flags: { isActive: true, isVerified: false, isFeatured: false, badgeType: null } });
  const blockedVendor = await Vendor.create({ ...vendorBase, name: 'ZZ Blocked', slug: 'zz-blocked', location: { microLocation: 'Saket', city: 'New Delhi', travelPolicy: 'studio-only', serviceRadius: 10 }, flags: { isActive: true, isVerified: false, isFeatured: false, badgeType: null } });
  const draft = await Vendor.create({ ...vendorBase, name: 'ZZ Draft', slug: 'zz-draft', location: { microLocation: 'Saket', city: 'New Delhi', travelPolicy: 'all', serviceRadius: 10 }, flags: { isActive: false, isVerified: false, isFeatured: false, badgeType: null } });
  const svc = (vendor: any, name: string, role: string, price: number, active = true) => ({
    vendor: vendor._id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    category: role === 'add-on' ? 'hair-styling' : 'bridal-beauty',
    serviceRole: role,
    duration: { baseDurationMinutes: 60, additionalPersonMinutes: 0, bufferMinutes: 0, canRunConcurrentlyWithAnchor: false },
    pricing: { unitPriceINR: price, priceType: 'per-service', groupDiscountTiers: [], travelSurchargeApplicable: false },
    partyConfig: { isQuantifiable: role === 'add-on', recipientType: 'bride', quantityLabel: 'Person', minQuantity: 1, maxQuantity: role === 'add-on' ? 5 : 1, defaultQuantity: 1, requiresAnchorService: role === 'add-on' },
    aestheticSignals: { occasionTags: ['wedding-day-bridal', 'baraat-reception'], styleArchetypeTags: [], aiDescription: 'Test' },
    checkoutMeta: { checkoutCategory: 'primary', displayPriority: 0, estimateContribution: 'fixed', bundleEligible: false, requiresConsultation: false },
    flags: { isActive: active, isSignatureService: false, isNewlyAdded: false },
  });
  const [openAnchor, , , inactiveSvc] = await Service.create([
    svc(open, 'Open Bridal', 'anchor', 30000),
    svc(open, 'Open Engagement', 'anchor', 15000),
    svc(open, 'Open Hair Add-on', 'add-on', 5000),
    svc(open, 'Open Retired', 'anchor', 1000, false),
    svc(blockedVendor, 'Blocked Bridal', 'anchor', 20000),
    svc(draft, 'Draft Bridal', 'anchor', 9000),
  ]);
  const allDays = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, isOpen: true, startTime: '10:00', endTime: '12:00' }));
  await VendorAvailability.create([
    { vendor: open._id, workingHours: allDays, slotIntervalMinutes: 60, maxConcurrentBookings: 1 },
    { vendor: blockedVendor._id, workingHours: allDays, slotIntervalMinutes: 60, maxConcurrentBookings: 1 },
  ]);

  const facets = await discovery.getVendorFacets([open._id as any, blockedVendor._id as any]);
  const openFacet = facets.get(open._id.toString())!;
  check('from-price comes from the cheapest active main service', openFacet.fromPriceINR === 15000, String(openFacet.fromPriceINR));
  check('inactive services are excluded from facets', openFacet.bookableServiceCount === 2);
  check('facets list real service categories and occasions', openFacet.serviceCategories.includes('hair-styling') && openFacet.occasions.includes('baraat-reception'));
  check('vendors with hours and services accept online booking', openFacet.acceptsOnlineBooking);

  const serialized = await ratings.serializeVendorsWithVerifiedRatings([await Vendor.findById(open._id).lean<Record<string, any>>() as Record<string, any>]);
  check('seeded vendor ratings are ignored without real reviews', serialized[0].ratings.totalReviews === 0 && serialized[0].ratings.averageRating === 0);

  const today = time.businessTodayIso();
  const target = time.addDaysToIsoDate(today, 9);
  const BlockedDate = (await import('../src/lib/db/models/BlockedDate')).default;
  await BlockedDate.create({ vendor: blockedVendor._id, startDate: time.isoDateToUtcMidnight(target), endDate: time.isoDateToUtcMidnight(target) });
  let available = await discovery.findVendorSlugsAvailableOn(target);
  check('date filter includes artists with open slots', available.includes('zz-open'));
  check('date filter excludes artists who blocked the date', !available.includes('zz-blocked'));
  check('date filter excludes inactive artists', !available.includes('zz-draft'));
  await bookingsLib.createBooking(aliceId, { artistSlug: 'zz-open', anchorServiceId: openAnchor._id.toString(), addOns: [], date: target, slotStart: '10:00', contactInfo: { name: 'Alice', phone: '+91 98765 43210', email: 'alice@customers.example.test' }, idempotencyKey: 'discovery-key-1' });
  await bookingsLib.createBooking(bobId, { artistSlug: 'zz-open', anchorServiceId: openAnchor._id.toString(), addOns: [], date: target, slotStart: '11:00', contactInfo: { name: 'Bob', phone: '+91 98765 43211', email: 'bob@customers.example.test' }, idempotencyKey: 'discovery-key-2' });
  available = await discovery.findVendorSlugsAvailableOn(target);
  check('date filter excludes fully booked artists', !available.includes('zz-open'));
  await expectStatus('date filter rejects past dates', () => discovery.findVendorSlugsAvailableOn(time.addDaysToIsoDate(today, -1)), 400);

  const services = await discovery.listPublicServices();
  check('public services list excludes add-ons, inactive services and draft artists',
    services.every((s) => s.serviceRole !== 'add-on' && s.name !== 'Open Retired' && s.vendor.slug !== 'zz-draft') && services.length === 3, services.map((s) => s.name).join(','));
  const detail = await discovery.getPublicServiceDetail('zz-open', 'open-bridal');
  check('service detail shows real price, duration and add-ons', detail?.priceINR === 30000 && detail.durationMinutes === 60 && detail.addOns.length === 1);
  check('inactive services have no detail page', (await discovery.getPublicServiceDetail('zz-open', 'open-retired')) === null);
  check('draft artists have no service pages', (await discovery.getPublicServiceDetail('zz-draft', 'draft-bridal')) === null);
  check('service detail rejects malformed slugs', (await discovery.getPublicServiceDetail('zz-open', '../x')) === null);
  void inactiveSvc;

  out('\n--- Moodboards: ownership, validation and caps ---');
  const board = await boards.createBoard(aliceId, { name: 'Wedding day', eventType: 'wedding', eventDate: time.addDaysToIsoDate(today, 120), stylePreferences: ['dewy skin', 'Dewy Skin', 'soft pink'] });
  check('board is created with de-duplicated style preferences', board.name === 'Wedding day' && (await PlanningBoard.findById(board.id).lean<Record<string, any>>())?.stylePreferences.length === 2);
  await expectStatus('board name is required', () => boards.createBoard(aliceId, { name: '' }), 400);
  await expectStatus('event type must be known', () => boards.createBoard(aliceId, { name: 'X', eventType: 'funeral' }), 400);
  await expectStatus('event date must be valid', () => boards.createBoard(aliceId, { name: 'X', eventDate: '2031-02-31' }), 400);
  check('another user cannot read the board', (await boards.getBoard(bobId, board.id)) === null);
  await expectStatus('another user cannot rename the board', () => boards.updateBoard(bobId, board.id, { name: 'Hijacked' }), 404);
  await expectStatus('another user cannot delete the board', () => boards.deleteBoard(bobId, board.id), 404);
  await expectStatus('another user cannot add to the board', () => boards.addItem(bobId, board.id, { kind: 'artist', vendorSlug: 'zz-open' }), 404);

  const aliceLook = await SavedMoodboard.create({ user: alice._id, label: 'Alice look', image: { data: PNG_1PX, mimeType: 'image/png' }, imageProfile: { styleArchetypes: [], makeupFinishTags: [], colorPaletteAffinity: [], occasionSignals: [], skinToneSignals: [], visualNarrative: '' }, styleDNA: [], editorialAnalysis: 'x' });
  const bobLook = await SavedMoodboard.create({ user: bob._id, label: 'Bob look', image: { data: PNG_1PX, mimeType: 'image/png' }, imageProfile: { styleArchetypes: [], makeupFinishTags: [], colorPaletteAffinity: [], occasionSignals: [], skinToneSignals: [], visualNarrative: '' }, styleDNA: [], editorialAnalysis: 'x' });
  await boards.addItem(aliceId, board.id, { kind: 'look', savedLookId: aliceLook._id.toString() });
  await expectStatus("cannot add someone else's saved look", () => boards.addItem(aliceId, board.id, { kind: 'look', savedLookId: bobLook._id.toString() }), 404);
  await expectStatus('duplicate items are rejected', () => boards.addItem(aliceId, board.id, { kind: 'look', savedLookId: aliceLook._id.toString() }), 409);
  await boards.addItem(aliceId, board.id, { kind: 'portfolio', vendorSlug: 'zz-open', imageUrl: '/images/p1.png' });
  await expectStatus('portfolio images must belong to the artist', () => boards.addItem(aliceId, board.id, { kind: 'portfolio', vendorSlug: 'zz-open', imageUrl: 'https://evil.example/x.png' }), 404);
  await expectStatus('inactive artists cannot be added', () => boards.addItem(aliceId, board.id, { kind: 'artist', vendorSlug: 'zz-draft' }), 404);
  await boards.addItem(aliceId, board.id, { kind: 'service', vendorSlug: 'zz-open', serviceId: openAnchor._id.toString() });
  await expectStatus('services must belong to the named artist', () => boards.addItem(aliceId, board.id, { kind: 'service', vendorSlug: 'zz-blocked', serviceId: openAnchor._id.toString() }), 404);
  await expectStatus('uploads must be an allowed image type', () => boards.uploadBoardImage(aliceId, board.id, { data: PNG_1PX, mimeType: 'image/gif' }), 400);
  await expectStatus('uploads must be valid base64', () => boards.uploadBoardImage(aliceId, board.id, { data: 'not base64!!', mimeType: 'image/png' }), 400);
  await expectStatus('oversized uploads are rejected', () => boards.uploadBoardImage(aliceId, board.id, { data: 'A'.repeat(2_100_000), mimeType: 'image/png' }), 400);
  const uploaded = await boards.uploadBoardImage(aliceId, board.id, { data: PNG_1PX, mimeType: 'image/png', caption: 'My lehenga' });
  const detailBoard = await boards.getBoard(aliceId, board.id);
  const uploadItem = detailBoard?.items.find((i) => i.kind === 'upload');
  check('board detail resolves every item kind', detailBoard?.items.length === 4 && detailBoard.items.every((i) => i.available));
  check('uploads are labelled as private user images, not licensed content', uploadItem?.subtitle === 'Uploaded by you · private');
  const imageId = uploadItem!.imageUrl!.split('/').pop()!;
  check('owner can load their uploaded image', (await boards.getBoardImage(aliceId, imageId)) !== null);
  check('other users cannot load an uploaded image', (await boards.getBoardImage(bobId, imageId)) === null);
  await boards.updateItemNote(aliceId, board.id, uploaded.itemId, 'Bring the dupatta');
  await expectStatus('another user cannot edit item notes', () => boards.updateItemNote(bobId, board.id, uploaded.itemId, 'x'), 404);
  await boards.removeItem(aliceId, board.id, uploaded.itemId);
  check('removing an upload deletes its stored image', (await BoardImage.countDocuments({ _id: imageId })) === 0);

  const capBoard = await boards.createBoard(aliceId, { name: 'Cap test' });
  await PlanningBoard.updateOne(
    { _id: capBoard.id },
    { $set: { items: Array.from({ length: 59 }, (_, i) => ({ kind: 'artist', vendorSlug: `fake-${i}`, addedAt: new Date() })) } }
  );
  const capRace = await Promise.allSettled([
    boards.addItem(aliceId, capBoard.id, { kind: 'artist', vendorSlug: 'zz-open' }),
    boards.addItem(aliceId, capBoard.id, { kind: 'service', vendorSlug: 'zz-open', serviceId: openAnchor._id.toString() }),
    boards.addItem(aliceId, capBoard.id, { kind: 'look', savedLookId: aliceLook._id.toString() }),
  ]);
  const capCount = (await PlanningBoard.findById(capBoard.id).lean<Record<string, any>>())?.items.length;
  check('concurrent adds never exceed the 60-item cap', capCount === 60 && capRace.filter((r) => r.status === 'fulfilled').length === 1, `items=${capCount}`);

  for (let i = 0; i < 18; i++) await boards.createBoard(aliceId, { name: `Board ${i}` });
  await expectStatus('the per-user board limit is enforced', () => boards.createBoard(aliceId, { name: 'One too many' }), 422);

  await moodboards.renameMoodboard(aliceId, aliceLook._id.toString(), 'Renamed look');
  check('saved looks can be renamed by their owner', (await SavedMoodboard.findById(aliceLook._id).lean<Record<string, any>>())?.label === 'Renamed look');
  await expectStatus('saved looks cannot be renamed by others', () => moodboards.renameMoodboard(bobId, aliceLook._id.toString(), 'x'), 404);
  await moodboards.deleteMoodboard(aliceId, aliceLook._id.toString());
  const afterLookDelete = await boards.getBoard(aliceId, board.id);
  check('deleting a saved look removes it from boards', !afterLookDelete?.items.some((i) => i.kind === 'look'));
  const boardForDelete = await boards.createBoard(bobId, { name: 'Bob board' });
  await boards.uploadBoardImage(bobId, boardForDelete.id, { data: PNG_1PX, mimeType: 'image/png' });
  await boards.deleteBoard(bobId, boardForDelete.id);
  check('deleting a board deletes its uploads', (await BoardImage.countDocuments({ board: boardForDelete.id })) === 0);

  out('\n--- Admin insights, search and customer privacy ---');
  const overview = await insights.getAdminOverview();
  check('overview counts real bookings', overview.pendingRequests === 2 && overview.counts.PENDING === 2);
  check('overview excludes admins from customer counts', overview.customers === 2);
  const firstBooking = await Booking.findOne({ idempotencyKey: 'discovery-key-1' }).lean<Record<string, any>>();
  const ref = bookingsLib.refFromId(firstBooking!._id);
  const byRef = await insights.searchBookingsForAdmin({ q: ref });
  check('admin search finds a booking by reference', byRef.total === 1 && byRef.rows[0].ref === ref);
  const byEmail = await insights.searchBookingsForAdmin({ q: 'bob@customers' });
  check('admin search finds bookings by client email', byEmail.total === 1);
  const regexSafe = await insights.searchBookingsForAdmin({ q: '.*' });
  check('admin search treats input literally (no regex injection)', regexSafe.total === 0);
  const byVendor = await insights.searchBookingsForAdmin({ vendor: blockedVendor._id.toString() });
  check('admin filter by artist', byVendor.total === 0);
  const upcoming = await insights.searchBookingsForAdmin({ view: 'upcoming' });
  check('admin upcoming view returns future active bookings soonest first', upcoming.total === 2 && upcoming.rows[0].startTime === '10:00');
  const customers = await insights.listCustomersForAdmin(undefined);
  check('customer list excludes admin accounts', customers.rows.every((r) => r.role !== 'admin') && customers.total === 2);
  check('customer list never exposes sensitive fields', customers.rows.every((r) => !('passwordHash' in r) && !('resetPasswordTokenHash' in r)));
  const adminDetail = await insights.getBookingForAdmin(firstBooking!._id.toString());
  check('admin booking detail includes history and allowed transitions', adminDetail !== null && adminDetail.history.length === 1 && adminDetail.allowedTransitions.includes('CONFIRMED'));

  out('\n--- Artist accounts ---');
  await expectStatus('admins cannot be linked as artists', () => insights.linkArtistAccount(open._id.toString(), adminUser.email, 'someone'), 409);
  await expectStatus('unknown accounts cannot be linked', () => insights.linkArtistAccount(open._id.toString(), 'nobody@customers.example.test', 'someone'), 404);
  await insights.linkArtistAccount(open._id.toString(), bob.email, adminUser._id.toString());
  const bobAfter = await User.findById(bob._id).lean<Record<string, any>>();
  check('linking sets the artist role and vendor', bobAfter?.role === 'artist' && bobAfter?.artistVendor?.toString() === open._id.toString());
  await expectStatus('an artist account cannot be linked to a second vendor', () => insights.linkArtistAccount(blockedVendor._id.toString(), bob.email, 'someone'), 409);
  const ctx = await artistAuth.getArtistContext(bobId);
  check('artist context resolves to the linked vendor only', ctx?.vendorSlug === 'zz-open');
  check('customers have no artist context', (await artistAuth.getArtistContext(aliceId)) === null);
  check('artist role never grants admin', !(await (await import('../src/lib/auth/admin')).isAuthorizedAdmin(bobId, 'google')));
  const schedule = await portal.getArtistSchedule(ctx!.vendorId);
  check('artist schedule lists only their own appointments', schedule.upcoming.length === 2);
  check('pending requests hide client contact details from artists', schedule.upcoming.every((a) => a.status !== 'PENDING' || (a.clientPhone === null && a.clientEmail === null)));
  await bookingsLib.updateBookingStatus({ bookingId: firstBooking!._id.toString(), status: 'CONFIRMED' });
  const schedule2 = await portal.getArtistSchedule(ctx!.vendorId);
  check('confirmed bookings show client contact details to the artist', schedule2.upcoming.some((a) => a.status === 'CONFIRMED' && a.clientPhone === '+91 98765 43210'));
  const blockedSchedule = await portal.getArtistSchedule(blockedVendor._id.toString());
  check("another vendor's schedule does not include these bookings", blockedSchedule.upcoming.length === 0);
  await insights.unlinkArtistAccount(open._id.toString(), bobId, adminUser._id.toString());
  check('unlinking returns the account to customer', (await User.findById(bob._id).lean<Record<string, any>>())?.role === 'customer' && (await artistAuth.getArtistContext(bobId)) === null);

  out(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
