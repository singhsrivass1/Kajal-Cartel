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
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Refusing to run: TEST_MONGODB_URI must be a single-host mongodb:// URI.');
  }
  if (parsed.protocol !== 'mongodb:') throw new Error('Refusing to run: only mongodb:// URIs to a local server are allowed.');
  if (!LOCAL_HOSTS.has(parsed.hostname)) throw new Error('Refusing to run: the test database host must be localhost.');
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+_test$/i.test(dbName)) throw new Error('Refusing to run: the test database name must end in _test.');
  if (process.env.MONGODB_URI && process.env.MONGODB_URI !== uri) {
    throw new Error('Refusing to run: MONGODB_URI is set to a different database.');
  }
  return uri;
}

const TEST_URI = requireDisposableDatabase();
process.env.MONGODB_URI = TEST_URI;
for (const key of [
  'BOOKING_CANCELLATION_CUTOFF_HOURS',
  'BOOKING_RESCHEDULE_CUTOFF_HOURS',
  'BOOKING_MAX_RESCHEDULES',
  'BOOKING_WINDOW_DAYS',
  'REVIEW_WINDOW_DAYS',
]) {
  delete process.env[key];
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
  const Review = (await import('../src/lib/db/models/Review')).default;
  const VendorAvailability = (await import('../src/lib/db/models/VendorAvailability')).default;
  const BlockedDate = (await import('../src/lib/db/models/BlockedDate')).default;
  const bookings = await import('../src/lib/db/controllers/BookingManager');
  const views = await import('../src/lib/db/controllers/BookingViews');
  const reviews = await import('../src/lib/db/controllers/ReviewManager');
  const availabilityLib = await import('../src/lib/db/controllers/AvailabilityManager');
  const vendorAdmin = await import('../src/lib/db/controllers/VendorAdminManager');
  const time = await import('../src/lib/db/utils/time');

  await Promise.all(
    ['users', 'vendors', 'services', 'bookings', 'reviews', 'vendoravailabilities', 'blockeddates'].map((name) =>
      db.collection(name).deleteMany({})
    )
  );
  await Promise.all([Booking.init(), Review.init(), Vendor.init(), Service.init(), VendorAvailability.init(), User.init()]);

  const realNow = new Date();
  const today = time.businessTodayIso(realNow);
  const dayPlus = (n: number) => time.addDaysToIsoDate(today, n);

  const customers = await User.insertMany(
    Array.from({ length: 12 }, (_, i) => ({
      email: `customer${i}-${randomBytes(3).toString('hex')}@customers.example.test`,
      name: i === 0 ? 'Ananya Sharma' : `Customer ${i}`,
      role: 'customer',
    }))
  );
  const customerIds = customers.map((c) => (c._id as InstanceType<typeof Types.ObjectId>).toString());
  const [alice, bob] = customerIds;

  const vendorBase = {
    tagline: 'Test vendor',
    profileImageUrl: '/images/test.png',
    location: { microLocation: 'Hauz Khas', city: 'New Delhi', travelPolicy: 'studio-only', serviceRadius: 10 },
    contact: { phone: '+91 90000 00000' },
    pricing: { tier: 'premium', startingFromINR: 10000, currency: 'INR' },
    aestheticProfile: {
      styleArchetypes: ['glass-skin-glam'],
      makeupFinishTags: ['dewy-glass-skin'],
      hairStyleTags: ['structured-updo'],
      occasionSpecializations: ['wedding-day-bridal'],
      colorPaletteAffinity: ['ivory-and-gold-neutral'],
      skinToneExpertise: ['pan-spectrum-expert'],
      aestheticBio: 'A synthetic vendor used only by the booking integrity test suite to exercise scheduling, cancellation and review rules.',
    },
    portfolio: [],
    flags: { isActive: true, isVerified: false, isFeatured: false, badgeType: null },
  };

  const vendor = await Vendor.create({
    ...vendorBase,
    name: 'ZZ Integrity Vendor',
    slug: 'zz-integrity-vendor',
    businessMeta: { yearsOfExperience: 3, teamSize: 1, languagesSpoken: ['English'], bookingLeadTimeDays: 0, trialsOffered: false },
  });
  const noticeVendor = await Vendor.create({
    ...vendorBase,
    name: 'ZZ Notice Vendor',
    slug: 'zz-notice-vendor',
    businessMeta: { yearsOfExperience: 3, teamSize: 1, languagesSpoken: ['English'], bookingLeadTimeDays: 5, trialsOffered: false },
  });

  const serviceBase = {
    category: 'bridal-beauty',
    serviceRole: 'anchor',
    pricing: { unitPriceINR: 20000, priceType: 'per-service', groupDiscountTiers: [], travelSurchargeApplicable: false },
    partyConfig: { isQuantifiable: false, recipientType: 'bride', quantityLabel: 'Person', minQuantity: 1, maxQuantity: 1, defaultQuantity: 1, requiresAnchorService: false },
    aestheticSignals: { occasionTags: ['wedding-day-bridal'], styleArchetypeTags: [], aiDescription: 'Test bridal service' },
    checkoutMeta: { checkoutCategory: 'primary', displayPriority: 0, estimateContribution: 'fixed', bundleEligible: false, requiresConsultation: false },
    flags: { isActive: true, isSignatureService: false, isNewlyAdded: false },
  };
  const service = await Service.create({
    ...serviceBase,
    vendor: vendor._id,
    name: 'Integrity Bridal Look',
    slug: 'integrity-bridal-look',
    duration: { baseDurationMinutes: 60, additionalPersonMinutes: 0, bufferMinutes: 15, canRunConcurrentlyWithAnchor: false },
  });
  const otherService = await Service.create({
    ...serviceBase,
    vendor: vendor._id,
    name: 'Integrity Party Look',
    slug: 'integrity-party-look',
    duration: { baseDurationMinutes: 45, additionalPersonMinutes: 0, bufferMinutes: 15, canRunConcurrentlyWithAnchor: false },
  });
  const noticeService = await Service.create({
    ...serviceBase,
    vendor: noticeVendor._id,
    name: 'Notice Bridal Look',
    slug: 'notice-bridal-look',
    duration: { baseDurationMinutes: 60, additionalPersonMinutes: 0, bufferMinutes: 0, canRunConcurrentlyWithAnchor: false },
  });

  const allDays = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, isOpen: true, startTime: '10:00', endTime: '19:00' }));
  await VendorAvailability.create([
    { vendor: vendor._id, workingHours: allDays, slotIntervalMinutes: 30, maxConcurrentBookings: 1 },
    { vendor: noticeVendor._id, workingHours: allDays, slotIntervalMinutes: 30, maxConcurrentBookings: 1 },
  ]);

  const serviceId = (service._id as InstanceType<typeof Types.ObjectId>).toString();
  const otherServiceId = (otherService._id as InstanceType<typeof Types.ObjectId>).toString();
  const contact = { name: 'Test Client', phone: '+91 98765 43210', email: 'client@customers.example.test' };
  const request = (overrides: Partial<Parameters<typeof bookings.createBooking>[1]> = {}) => ({
    artistSlug: 'zz-integrity-vendor',
    anchorServiceId: serviceId,
    addOns: [],
    date: dayPlus(10),
    slotStart: '10:00',
    contactInfo: contact,
    idempotencyKey: `key-${randomBytes(8).toString('hex')}`,
    ...overrides,
  });
  const settle = async <T>(promises: Promise<T>[]) => Promise.allSettled(promises);
  const errorStatus = (r: PromiseSettledResult<unknown>) =>
    r.status === 'rejected' ? (r.reason as { statusCode?: number }).statusCode ?? 'thrown' : 'ok';
  const expectStatus = async (label: string, fn: () => Promise<unknown>, status: number) => {
    try {
      await fn();
      check(label, false, 'succeeded unexpectedly');
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      check(label, code === status, `got ${code ?? (err as Error).message}`);
    }
  };

  out('\n--- Creation, idempotency and validation ---');
  const first = await bookings.createBooking(alice, request({ idempotencyKey: 'alice-first-booking' }));
  check('booking is created and persisted', first.created && (await Booking.countDocuments({ _id: first.bookingId })) === 1);
  const stored = await Booking.findById(first.bookingId).lean<Record<string, any>>();
  check('booking starts PENDING with server-computed end time', stored?.status === 'PENDING' && stored?.endTime === '11:15');
  check('booking history records creation', stored?.history?.length === 1 && stored.history[0].action === 'created');
  const replay = await bookings.createBooking(alice, request({ idempotencyKey: 'alice-first-booking', slotStart: '15:00' }));
  check('idempotent replay returns the same booking without creating another', !replay.created && replay.bookingId === first.bookingId);
  check('only one booking exists for the replayed key', (await Booking.countDocuments({ idempotencyKey: 'alice-first-booking' })) === 1);
  await expectStatus('past date is rejected', () => bookings.createBooking(alice, request({ date: dayPlus(-1) })), 400);
  await expectStatus('invalid calendar date is rejected', () => bookings.createBooking(alice, request({ date: '2031-02-30' })), 400);
  await expectStatus('slot outside working hours is rejected', () => bookings.createBooking(alice, request({ slotStart: '18:30' })), 409);
  await expectStatus('malformed slot is rejected', () => bookings.createBooking(alice, request({ slotStart: '9am' })), 400);
  await expectStatus('service from another artist is rejected', () =>
    bookings.createBooking(alice, request({ anchorServiceId: (noticeService._id as InstanceType<typeof Types.ObjectId>).toString() })), 404);
  await expectStatus('date beyond the booking window is rejected', () => bookings.createBooking(alice, request({ date: dayPlus(400) })), 409);
  await expectStatus('artist minimum notice is enforced', () =>
    bookings.createBooking(alice, request({ artistSlug: 'zz-notice-vendor', anchorServiceId: (noticeService._id as InstanceType<typeof Types.ObjectId>).toString(), date: dayPlus(2) })), 409);
  const noticeOk = await bookings.createBooking(alice, request({ artistSlug: 'zz-notice-vendor', anchorServiceId: (noticeService._id as InstanceType<typeof Types.ObjectId>).toString(), date: dayPlus(5) }));
  check('booking at exactly the minimum notice succeeds', noticeOk.created);

  const sameDayMorning = new Date(time.appointmentStartInstant(today, '11:05').getTime());
  const todaySlots = await availabilityLib.getDailyAvailability({ vendorSlug: 'zz-integrity-vendor', serviceId, date: today, now: sameDayMorning });
  check('same-day slots that have already started are not offered',
    todaySlots.slots.length > 0 && todaySlots.slots[0] === '11:30' && todaySlots.slots.every((s) => time.parseTimeToMinutes(s) > 11 * 60 + 5),
    todaySlots.slots.slice(0, 3).join(','));

  const txLib = await import('../src/lib/db/transaction');
  await Vendor.updateOne({ _id: noticeVendor._id }, { $set: { 'flags.isActive': false } });
  const lockedInactive = await txLib.runTransaction((session) =>
    txLib.lockVendorSchedule(noticeVendor._id as InstanceType<typeof Types.ObjectId>, session, { requireActive: true })
  );
  check('the booking lock refuses an artist deactivated before the lock is taken', lockedInactive === false);
  await Vendor.updateOne({ _id: noticeVendor._id }, { $set: { 'flags.isActive': true } });

  out('\n--- Concurrency: double-booking prevention ---');
  const sameSlot = await settle(customerIds.slice(1, 11).map((id) => bookings.createBooking(id, request({ date: dayPlus(11), slotStart: '12:00' }))));
  const sameSlotOk = sameSlot.filter((r) => r.status === 'fulfilled').length;
  check('10 concurrent requests for one slot produce exactly one booking', sameSlotOk === 1, `succeeded ${sameSlotOk}`);
  check('the other concurrent requests are rejected with 409', sameSlot.filter((r) => errorStatus(r) === 409).length === 9, sameSlot.map(errorStatus).join(','));
  check('database holds exactly one active booking for that slot',
    (await Booking.countDocuments({ vendor: vendor._id, date: time.isoDateToUtcMidnight(dayPlus(11)), status: { $in: ['PENDING', 'CONFIRMED'] } })) === 1);

  const overlapping = await settle([
    bookings.createBooking(customerIds[1], request({ date: dayPlus(12), slotStart: '10:00' })),
    bookings.createBooking(customerIds[2], request({ date: dayPlus(12), slotStart: '10:30' })),
    bookings.createBooking(customerIds[3], request({ date: dayPlus(12), slotStart: '11:00' })),
    bookings.createBooking(customerIds[4], request({ date: dayPlus(12), slotStart: '10:30', anchorServiceId: otherServiceId })),
  ]);
  check('concurrent overlapping requests with different start times and services produce one booking',
    overlapping.filter((r) => r.status === 'fulfilled').length === 1, overlapping.map(errorStatus).join(','));

  const dupKey = await settle(Array.from({ length: 6 }, () => bookings.createBooking(bob, request({ date: dayPlus(13), slotStart: '14:00', idempotencyKey: 'bob-double-click' }))));
  const dupIds = new Set(dupKey.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bookings.createBooking>>> => r.status === 'fulfilled').map((r) => r.value.bookingId));
  check('concurrent duplicate submissions all resolve to one booking', dupKey.every((r) => r.status === 'fulfilled') && dupIds.size === 1, dupKey.map(errorStatus).join(','));
  check('exactly one booking stored for the duplicated key', (await Booking.countDocuments({ idempotencyKey: 'bob-double-click' })) === 1);

  const nonOverlap = await settle([
    bookings.createBooking(customerIds[5], request({ date: dayPlus(14), slotStart: '10:00' })),
    bookings.createBooking(customerIds[6], request({ date: dayPlus(14), slotStart: '11:30' })),
  ]);
  check('adjacent non-overlapping bookings can both succeed', nonOverlap.every((r) => r.status === 'fulfilled'), nonOverlap.map(errorStatus).join(','));

  out('\n--- Ownership ---');
  await expectStatus('another customer cannot cancel the booking', () => bookings.cancelBookingAsCustomer(bob, first.bookingId), 404);
  await expectStatus('another customer cannot reschedule the booking', () => bookings.rescheduleBookingAsCustomer(bob, first.bookingId, { date: dayPlus(15), slotStart: '10:00' }), 404);
  await expectStatus('another customer cannot read reschedule availability', () => bookings.getRescheduleAvailability(bob, first.bookingId, dayPlus(15)), 404);
  check('another customer cannot view booking detail', (await views.getCustomerBookingDetail(bob, first.bookingId)) === null);
  const bobList = await views.listCustomerBookings(bob);
  check("a customer's dashboard lists only their own bookings", bobList.length > 0 && bobList.every((b) => b.id !== first.bookingId));
  const aliceDetail = await views.getCustomerBookingDetail(alice, first.bookingId);
  check('owner sees booking detail with policy decisions', aliceDetail !== null && aliceDetail.canCancel.allowed && aliceDetail.canReschedule.allowed);
  check('customer detail does not expose admin notes or idempotency key', aliceDetail !== null && !('adminNotes' in aliceDetail) && !('idempotencyKey' in aliceDetail));

  out('\n--- Rescheduling ---');
  const toMove = await bookings.createBooking(alice, request({ date: dayPlus(20), slotStart: '10:00' }));
  const blocker = await bookings.createBooking(customerIds[7], request({ date: dayPlus(20), slotStart: '13:00' }));
  await expectStatus('rescheduling into an occupied slot is rejected', () =>
    bookings.rescheduleBookingAsCustomer(alice, toMove.bookingId, { date: dayPlus(20), slotStart: '13:30' }), 409);
  const unchanged = await Booking.findById(toMove.bookingId).lean<Record<string, any>>();
  check('a rejected reschedule leaves the booking untouched', unchanged?.startTime === '10:00' && (unchanged?.rescheduleCount ?? 0) === 0);
  await bookings.updateBookingStatus({ bookingId: toMove.bookingId, status: 'CONFIRMED' });
  const moved = await bookings.rescheduleBookingAsCustomer(alice, toMove.bookingId, { date: dayPlus(21), slotStart: '15:00' });
  const movedDoc = await Booking.findById(toMove.bookingId).lean<Record<string, any>>();
  check('reschedule moves the booking and returns it to PENDING', moved.date === dayPlus(21) && movedDoc?.status === 'PENDING' && movedDoc?.startTime === '15:00');
  check('reschedule increments the count and records history', movedDoc?.rescheduleCount === 1 && movedDoc?.history?.some((h: any) => h.action === 'rescheduled'));
  const freed = await bookings.createBooking(customerIds[8], request({ date: dayPlus(20), slotStart: '10:00' }));
  check('the original slot is released after rescheduling', freed.created);
  await expectStatus('the new slot is protected after rescheduling', () =>
    bookings.createBooking(customerIds[9], request({ date: dayPlus(21), slotStart: '15:30' })), 409);
  const sameDayShift = await bookings.rescheduleBookingAsCustomer(alice, toMove.bookingId, { date: dayPlus(21), slotStart: '15:30' });
  check('a booking can move within its own day without conflicting with itself', sameDayShift.startTime === '15:30');
  await expectStatus('the maximum number of reschedules is enforced', () =>
    bookings.rescheduleBookingAsCustomer(alice, toMove.bookingId, { date: dayPlus(22), slotStart: '10:00' }), 409);

  const r1 = await bookings.createBooking(customerIds[10], request({ date: dayPlus(25), slotStart: '10:00' }));
  const r2 = await bookings.createBooking(customerIds[11], request({ date: dayPlus(25), slotStart: '16:00' }));
  const raceMoves = await settle([
    bookings.rescheduleBookingAsCustomer(customerIds[10], r1.bookingId, { date: dayPlus(26), slotStart: '12:00' }),
    bookings.rescheduleBookingAsCustomer(customerIds[11], r2.bookingId, { date: dayPlus(26), slotStart: '12:30' }),
  ]);
  check('two concurrent reschedules into overlapping slots: exactly one succeeds', raceMoves.filter((r) => r.status === 'fulfilled').length === 1, raceMoves.map(errorStatus).join(','));
  const loserId = raceMoves[0].status === 'fulfilled' ? r2.bookingId : r1.bookingId;
  const loserDoc = await Booking.findById(loserId).lean<Record<string, any>>();
  check('the losing reschedule left its booking on the original date', time.utcMidnightToIsoDate(loserDoc?.date) === dayPlus(25));

  const lateBooking = await bookings.createBooking(bob, request({ date: dayPlus(3), slotStart: '10:00' }));
  const nearStart = new Date(time.appointmentStartInstant(dayPlus(3), '10:00').getTime() - 24 * HOUR);
  await expectStatus('rescheduling inside the cutoff is rejected', () =>
    bookings.rescheduleBookingAsCustomer(bob, lateBooking.bookingId, { date: dayPlus(4), slotStart: '10:00' }, nearStart), 409);

  out('\n--- Cancellation ---');
  await bookings.updateBookingStatus({ bookingId: lateBooking.bookingId, status: 'CONFIRMED' });
  await expectStatus('confirmed booking cannot be cancelled online inside the cutoff', () =>
    bookings.cancelBookingAsCustomer(bob, lateBooking.bookingId, undefined, nearStart), 409);
  const cancelled = await bookings.cancelBookingAsCustomer(bob, lateBooking.bookingId, 'Change of plans');
  const cancelledDoc = await Booking.findById(lateBooking.bookingId).lean<Record<string, any>>();
  check('confirmed booking can be cancelled before the cutoff', cancelled.status === 'CANCELLED' && cancelledDoc?.cancelledBy === 'customer');
  check('cancellation reason is stored', cancelledDoc?.cancellationReason === 'Change of plans');
  const retaken = await bookings.createBooking(customerIds[3], request({ date: dayPlus(3), slotStart: '10:00' }));
  check('a cancelled booking releases its slot', retaken.created);
  await expectStatus('a cancelled booking cannot be cancelled again', () => bookings.cancelBookingAsCustomer(bob, lateBooking.bookingId), 409);
  await expectStatus('an overlong cancellation reason is rejected', () => bookings.cancelBookingAsCustomer(customerIds[3], retaken.bookingId, 'x'.repeat(301)), 400);
  const pendingNearStart = await bookings.createBooking(customerIds[4], request({ date: dayPlus(2), slotStart: '15:00' }));
  const minutesBefore = new Date(time.appointmentStartInstant(dayPlus(2), '15:00').getTime() - 30 * 60 * 1000);
  const withdrawn = await bookings.cancelBookingAsCustomer(customerIds[4], pendingNearStart.bookingId, undefined, minutesBefore);
  check('a pending request can be withdrawn until the appointment starts', withdrawn.status === 'CANCELLED');

  out('\n--- Admin status transitions ---');
  await expectStatus('a PENDING booking cannot jump straight to COMPLETED', () => bookings.updateBookingStatus({ bookingId: first.bookingId, status: 'COMPLETED' }), 409);
  await bookings.updateBookingStatus({ bookingId: first.bookingId, status: 'CONFIRMED', adminNotes: 'Internal note' });
  await expectStatus('a confirmed booking cannot be marked completed before its appointment', () => bookings.updateBookingStatus({ bookingId: first.bookingId, status: 'COMPLETED' }), 409);
  await expectStatus('a confirmed booking cannot return to PENDING', () => bookings.updateBookingStatus({ bookingId: first.bookingId, status: 'PENDING' }), 409);
  const afterAppointment = new Date(time.appointmentStartInstant(dayPlus(10), '10:00').getTime() + 3 * HOUR);
  await bookings.updateBookingStatus({ bookingId: first.bookingId, status: 'COMPLETED' }, afterAppointment);
  const completedDoc = await Booking.findById(first.bookingId).lean<Record<string, any>>();
  check('completion is allowed after the appointment and timestamped', completedDoc?.status === 'COMPLETED' && Boolean(completedDoc?.completedAt));
  const aliceView = await views.getCustomerBookingDetail(alice, first.bookingId, afterAppointment);
  check('customer timeline does not include internal admin notes', aliceView !== null && !JSON.stringify(aliceView).includes('Internal note'));

  out('\n--- Blocked dates and working hours serialize with bookings ---');
  await expectStatus('blocking a date that has a booking is rejected', () => vendorAdmin.addBlockedDate((vendor._id as InstanceType<typeof Types.ObjectId>).toString(), dayPlus(11), dayPlus(11), 'Holiday'), 409);
  const raceDay = dayPlus(30);
  const blockRace = await settle<unknown>([
    vendorAdmin.addBlockedDate((vendor._id as InstanceType<typeof Types.ObjectId>).toString(), raceDay, raceDay, 'Event'),
    bookings.createBooking(customerIds[5], request({ date: raceDay, slotStart: '11:00' })),
  ]);
  const blockedCount = await BlockedDate.countDocuments({ vendor: vendor._id, startDate: time.isoDateToUtcMidnight(raceDay) });
  const raceBookingCount = await Booking.countDocuments({ vendor: vendor._id, date: time.isoDateToUtcMidnight(raceDay), status: { $in: ['PENDING', 'CONFIRMED'] } });
  check('a concurrent block and booking never both succeed', blockedCount + raceBookingCount === 1, `blocked=${blockedCount} bookings=${raceBookingCount} ${blockRace.map(errorStatus).join(',')}`);
  await expectStatus('working hours that would strand a booking are rejected', () =>
    vendorAdmin.updateWorkingHours(
      (vendor._id as InstanceType<typeof Types.ObjectId>).toString(),
      allDays.map((d) => ({ ...d, startTime: '13:00' })),
      30
    ), 409);

  out('\n--- Reviews ---');
  await expectStatus('a non-completed booking cannot be reviewed', () =>
    reviews.createReview(customerIds[3], retaken.bookingId, { rating: 5, body: 'Lovely experience overall, thank you!' }), 403);
  await expectStatus('another customer cannot review this booking', () =>
    reviews.createReview(bob, first.bookingId, { rating: 5, body: 'Lovely experience overall, thank you!' }), 404);
  for (const [label, input] of [
    ['rating 0', { rating: 0, body: 'A long enough review body here.' }],
    ['rating 6', { rating: 6, body: 'A long enough review body here.' }],
    ['fractional rating', { rating: 3.5, body: 'A long enough review body here.' }],
    ['short body', { rating: 4, body: 'Too short' }],
    ['overlong body', { rating: 4, body: 'x'.repeat(2001) }],
    ['overlong title', { rating: 4, title: 't'.repeat(101), body: 'A long enough review body here.' }],
  ] as const) {
    await expectStatus(`review validation rejects ${label}`, () => reviews.createReview(alice, first.bookingId, input as any), 400);
  }
  const reviewRace = await settle(Array.from({ length: 5 }, () =>
    reviews.createReview(alice, first.bookingId, { rating: 4, title: 'Wonderful', body: 'Beautiful, long-lasting makeup and a calm, punctual artist.' })));
  check('concurrent review submissions create exactly one review', reviewRace.filter((r) => r.status === 'fulfilled').length === 1, reviewRace.map(errorStatus).join(','));
  check('exactly one review stored for the booking', (await Review.countDocuments({ booking: first.bookingId })) === 1);
  const storedReview = await Review.findOne({ booking: first.bookingId }).lean<Record<string, any>>();
  check('review author name is privacy-reduced', storedReview?.authorDisplayName === 'Ananya S.');
  await expectStatus('a second review for the same booking is rejected', () =>
    reviews.createReview(alice, first.bookingId, { rating: 5, body: 'Trying to post a second review here.' }), 409);
  const stats = await reviews.getVendorReviewStats([vendor._id as InstanceType<typeof Types.ObjectId>]);
  check('vendor rating stats come from real reviews', stats.get(vendor._id!.toString())?.totalReviews === 1 && stats.get(vendor._id!.toString())?.averageRating === 4);
  const noStats = await reviews.getVendorReviewStats([noticeVendor._id as InstanceType<typeof Types.ObjectId>]);
  check('vendors without reviews have no rating', !noStats.has(noticeVendor._id!.toString()));
  await expectStatus('another customer cannot edit the review', () =>
    reviews.updateOwnReview(bob, storedReview!._id.toString(), { rating: 1, body: 'Hijacking someone else review.' }), 404);
  await expectStatus('another customer cannot delete the review', () => reviews.deleteOwnReview(bob, storedReview!._id.toString()), 404);
  await reviews.updateOwnReview(alice, storedReview!._id.toString(), { rating: 5, body: 'Edited: beautiful, long-lasting makeup and a calm artist.' });
  check('owner can edit their review', (await Review.findById(storedReview!._id).lean<Record<string, any>>())?.rating === 5);
  await reviews.moderateReview('000000000000000000000000', storedReview!._id.toString(), 'hidden', 'Contains a phone number');
  check('hidden reviews are excluded from public stats', !(await reviews.getVendorReviewStats([vendor._id as InstanceType<typeof Types.ObjectId>])).has(vendor._id!.toString()));
  check('hidden reviews are excluded from public listings', (await reviews.listPublishedReviewsForVendor(vendor._id as InstanceType<typeof Types.ObjectId>)).length === 0);
  await reviews.deleteOwnReview(alice, storedReview!._id.toString());
  await expectStatus('deleting a moderated review does not allow a fresh review', () =>
    reviews.createReview(alice, first.bookingId, { rating: 5, body: 'Reposting after my review was hidden.' }), 409);

  const second = await bookings.createBooking(bob, request({ date: dayPlus(40), slotStart: '10:00' }));
  await bookings.updateBookingStatus({ bookingId: second.bookingId, status: 'CONFIRMED' });
  const secondDone = new Date(time.appointmentStartInstant(dayPlus(40), '10:00').getTime() + HOUR);
  await bookings.updateBookingStatus({ bookingId: second.bookingId, status: 'COMPLETED' }, secondDone);
  await expectStatus('reviews close after the review window', () =>
    reviews.createReview(bob, second.bookingId, { rating: 3, body: 'Writing this review far too late.' }, new Date(secondDone.getTime() + 181 * DAY)), 409);
  const okReview = await reviews.createReview(bob, second.bookingId, { rating: 3, body: 'Good work, slightly late start but lovely result.' }, new Date(secondDone.getTime() + DAY));
  check('review inside the window succeeds', Boolean(okReview.reviewId));
  await reviews.deleteOwnReview(bob, okReview.reviewId);
  const again = await reviews.createReview(bob, second.bookingId, { rating: 4, body: 'Re-posting my review after deleting it myself.' }, new Date(secondDone.getTime() + 2 * DAY));
  check('deleting your own published review allows posting again within the window', Boolean(again.reviewId));
  await reviews.deleteReviewAsAdmin(again.reviewId);
  await expectStatus('admin removal blocks re-posting', () =>
    reviews.createReview(bob, second.bookingId, { rating: 4, body: 'Trying again after an admin removed it.' }, new Date(secondDone.getTime() + 3 * DAY)), 409);

  out(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  try {
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect();
  } catch {}
});
