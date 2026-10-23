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

function requireLocal(): { uri: string; base: URL; secret: string } {
  if (process.env.CONFIRM_DISPOSABLE_TEST_DB !== 'yes') throw new Error('Refusing to run: set CONFIRM_DISPOSABLE_TEST_DB=yes.');
  const uri = process.env.TEST_MONGODB_URI ?? '';
  const parsed = new URL(uri);
  if (parsed.protocol !== 'mongodb:' || !LOCAL_HOSTS.has(parsed.hostname)) throw new Error('Refusing to run: TEST_MONGODB_URI must be a local mongodb:// URI.');
  if (!/^[a-z0-9_]+_test$/i.test(parsed.pathname.replace(/^\//, ''))) throw new Error('Refusing to run: the test database name must end in _test.');
  const base = new URL(process.env.TEST_BASE_URL ?? '');
  if (!LOCAL_HOSTS.has(base.hostname)) throw new Error('Refusing to run HTTP tests against a non-local server.');
  const secret = process.env.TEST_NEXTAUTH_SECRET ?? '';
  if (secret.length < 32) throw new Error('TEST_NEXTAUTH_SECRET must match the local test server.');
  if (process.env.MONGODB_URI && process.env.MONGODB_URI !== uri) throw new Error('Refusing to run: MONGODB_URI is set to a different database.');
  return { uri, base, secret };
}

const { uri, base, secret } = requireLocal();
process.env.MONGODB_URI = uri;

async function main() {
  const mongoose = (await import('mongoose')).default;
  const { dbConnect } = await import('../src/lib/db/connect');
  await dbConnect();
  const db = mongoose.connection.db!;
  if (!db.databaseName.endsWith('_test')) throw new Error('Unexpected database.');
  const { encode } = await import('next-auth/jwt');

  const User = (await import('../src/lib/db/models/User')).default;
  const Vendor = (await import('../src/lib/db/models/Vendor')).default;
  const Service = (await import('../src/lib/db/models/Service')).default;
  const Booking = (await import('../src/lib/db/models/Booking')).default;
  const VendorAvailability = (await import('../src/lib/db/models/VendorAvailability')).default;
  const bookings = await import('../src/lib/db/controllers/BookingManager');
  const boards = await import('../src/lib/db/controllers/BoardManager');
  const time = await import('../src/lib/db/utils/time');

  await Promise.all(
    ['users', 'accounts', 'vendors', 'services', 'bookings', 'reviews', 'vendoravailabilities', 'blockeddates', 'planningboards', 'boardimages', 'savedmoodboards'].map((n) =>
      db.collection(n).deleteMany({})
    )
  );

  const tag = randomBytes(3).toString('hex');
  const [alice, bob, artistUser, admin] = await User.insertMany([
    { email: `alice-${tag}@customers.example.test`, name: 'Alice Kapoor', role: 'customer' },
    { email: `bob-${tag}@customers.example.test`, name: 'Bob Mehra', role: 'customer' },
    { email: `artist-${tag}@artists.example.test`, name: 'Artist Person', role: 'customer' },
    { email: `admin-${tag}@admin.example.test`, name: 'Admin Person', role: 'admin' },
  ]);
  await db.collection('accounts').insertOne({ userId: admin._id, type: 'oauth', provider: 'google', providerAccountId: `google-${tag}` });

  const vendor = await Vendor.create({
    name: 'ZZ Http Vendor',
    slug: 'zz-http-vendor',
    tagline: 'A vendor for HTTP tests',
    profileImageUrl: '/images/test.png',
    location: { microLocation: 'Saket', city: 'New Delhi', travelPolicy: 'all', serviceRadius: 10 },
    contact: { phone: '+91 90000 00000' },
    businessMeta: { yearsOfExperience: 3, teamSize: 1, languagesSpoken: ['English'], bookingLeadTimeDays: 0, trialsOffered: false },
    pricing: { tier: 'premium', startingFromINR: 10000, currency: 'INR' },
    aestheticProfile: {
      styleArchetypes: ['glass-skin-glam'],
      makeupFinishTags: ['dewy-glass-skin'],
      hairStyleTags: ['structured-updo'],
      occasionSpecializations: ['wedding-day-bridal'],
      colorPaletteAffinity: ['ivory-and-gold-neutral'],
      skinToneExpertise: ['pan-spectrum-expert'],
      aestheticBio: 'A synthetic vendor used by the HTTP authorization tests to exercise customer, artist and admin access paths end to end.',
    },
    portfolio: [],
    ratings: { averageRating: 4.9, totalReviews: 47, skillScore: 5, punctualityScore: 5, communicationScore: 5, valueScore: 5 },
    flags: { isActive: true, isVerified: false, isFeatured: true, badgeType: null },
  });
  const service = await Service.create({
    vendor: vendor._id,
    name: 'Http Bridal Look',
    slug: 'http-bridal-look',
    category: 'bridal-beauty',
    serviceRole: 'anchor',
    description: 'A complete bridal look used for testing.',
    duration: { baseDurationMinutes: 60, additionalPersonMinutes: 0, bufferMinutes: 15, canRunConcurrentlyWithAnchor: false },
    pricing: { unitPriceINR: 25000, priceType: 'per-service', groupDiscountTiers: [], travelSurchargeApplicable: false },
    partyConfig: { isQuantifiable: false, recipientType: 'bride', quantityLabel: 'Person', minQuantity: 1, maxQuantity: 1, defaultQuantity: 1, requiresAnchorService: false },
    aestheticSignals: { occasionTags: ['wedding-day-bridal'], styleArchetypeTags: [], aiDescription: 'Test' },
    checkoutMeta: { checkoutCategory: 'primary', displayPriority: 0, estimateContribution: 'fixed', bundleEligible: false, requiresConsultation: false },
    flags: { isActive: true, isSignatureService: false, isNewlyAdded: false },
  });
  await VendorAvailability.create({
    vendor: vendor._id,
    workingHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, isOpen: true, startTime: '10:00', endTime: '19:00' })),
    slotIntervalMinutes: 30,
    maxConcurrentBookings: 1,
  });
  await User.updateOne({ _id: artistUser._id }, { $set: { role: 'artist', artistVendor: vendor._id } });

  const date = time.addDaysToIsoDate(time.businessTodayIso(), 14);
  const contact = (name: string, email: string) => ({ name, phone: '+91 98765 43210', email });
  const aliceBooking = await bookings.createBooking(alice._id.toString(), {
    artistSlug: 'zz-http-vendor', anchorServiceId: service._id.toString(), addOns: [], date, slotStart: '10:00', contactInfo: contact('Alice Kapoor', 'alice-contact@customers.example.test'), idempotencyKey: `alice-${tag}-booking`,
  });
  const bobBooking = await bookings.createBooking(bob._id.toString(), {
    artistSlug: 'zz-http-vendor', anchorServiceId: service._id.toString(), addOns: [], date, slotStart: '14:00', contactInfo: contact('Bob Mehra', 'bob-contact@customers.example.test'), idempotencyKey: `bob-${tag}-booking`,
  });
  const bobBoard = await boards.createBoard(bob._id.toString(), { name: 'Bob private board' });

  const cookieFor = async (claims: Record<string, unknown>, maxAge = 3600, signingSecret = secret) =>
    `next-auth.session-token=${await encode({ token: claims, secret: signingSecret, maxAge })}`;
  const claims = (u: { _id: unknown; email: string; name?: string }, extra: Record<string, unknown> = {}) => ({
    sub: String(u._id), id: String(u._id), email: u.email, name: u.name, authProvider: 'google', ...extra,
  });
  const S = {
    anon: null as string | null,
    alice: await cookieFor(claims(alice)),
    bob: await cookieFor(claims(bob)),
    artist: await cookieFor(claims(artistUser)),
    admin: await cookieFor(claims(admin)),
    aliceForgedAdmin: await cookieFor(claims(alice, { role: 'admin', isAdmin: true })),
    aliceExpired: await cookieFor(claims(alice), -60),
    forgedSecret: await cookieFor(claims(admin), 3600, randomBytes(32).toString('hex')),
  };

  const call = async (method: string, path: string, cookie: string | null, body?: unknown) => {
    const res = await fetch(new URL(path, base), {
      method,
      redirect: 'manual',
      headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), 'x-forwarded-for': `198.18.0.${Math.floor(Math.random() * 200) + 1}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, location: res.headers.get('location') ?? '', text: await res.text() };
  };
  const redirectsTo = (r: { status: number; location: string }, fragment: string) => [302, 303, 307, 308].includes(r.status) && r.location.includes(fragment);

  out('\n--- Warm-up ---');
  for (const p of ['/', '/discover', '/journey', '/admin', '/artist', '/services']) await call('GET', p, S.admin);

  out('\n--- Public pages ---');
  for (const path of ['/', '/discover', '/services', '/artists/zz-http-vendor', '/artists/zz-http-vendor/services/http-bridal-look', '/policies', '/help', '/robots.txt', '/sitemap.xml', '/auth']) {
    const r = await call('GET', path, null);
    check(`GET ${path} is public (200)`, r.status === 200, `got ${r.status}`);
  }
  const home = await call('GET', '/', null);
  check('homepage no longer shows fabricated testimonials', !home.text.includes('Ananya S.') && !home.text.includes('Kritika M.') && !home.text.includes('Priya V.'));
  const signIn = await call('GET', '/auth', null);
  check('sign-in page no longer shows a fabricated testimonial', !signIn.text.includes('Priya M.') && !signIn.text.includes('Booked Studio Noor'));
  const artistPage = await call('GET', '/artists/zz-http-vendor', null);
  check('artist page hides seeded ratings without real reviews', !artistPage.text.includes('(47') && !artistPage.text.includes('4.9') && artistPage.text.includes('No reviews yet'));
  check('artist page lists real service price', artistPage.text.includes('25,000'));
  check('artist page has canonical metadata', artistPage.text.includes('rel="canonical"'));
  check('unknown artist returns 404', (await call('GET', '/artists/zz-does-not-exist', null)).status === 404);
  check('unknown route returns 404', (await call('GET', '/definitely-not-a-page', null)).status === 404);
  const robots = await call('GET', '/robots.txt', null);
  check('robots.txt disallows private areas', robots.text.includes('Disallow: /admin') && robots.text.includes('Disallow: /journey'));
  const sitemap = await call('GET', '/sitemap.xml', null);
  check('sitemap lists artist and service pages', sitemap.text.includes('/artists/zz-http-vendor') && sitemap.text.includes('/services/http-bridal-look'));
  const policies = await call('GET', '/policies', null);
  check('policy page reflects configured cutoffs', policies.text.includes('48 hours'));
  const help = await call('GET', '/help', null);
  check('help shows configured support contact only', help.text.includes('help@kajal.example.test'));

  out('\n--- Signed out ---');
  for (const p of ['/journey', '/account', '/moodboards', `/journey/bookings/${aliceBooking.bookingId}`, `/moodboards/${bobBoard.id}`, '/admin', '/admin/bookings', '/artist']) {
    const r = await call('GET', p, null);
    check(`signed-out GET ${p} redirects to sign-in with callback`, redirectsTo(r, '/auth?callbackUrl='), `${r.status} ${r.location}`);
  }
  const anonApis: Array<[string, string, unknown?]> = [
    ['POST', `/api/user/bookings/${aliceBooking.bookingId}/cancel`, {}],
    ['POST', `/api/user/bookings/${aliceBooking.bookingId}/reschedule`, { date, slotStart: '12:00' }],
    ['GET', `/api/user/bookings/${aliceBooking.bookingId}/availability?date=${date}`],
    ['POST', `/api/user/bookings/${aliceBooking.bookingId}/review`, { rating: 5, body: 'x'.repeat(30) }],
    ['GET', '/api/user/boards'],
    ['POST', '/api/user/boards', { name: 'x' }],
    ['GET', `/api/user/boards/${bobBoard.id}`],
    ['PATCH', '/api/user/profile', { name: 'x' }],
    ['GET', '/api/user/profile'],
    ['POST', '/api/book', {}],
  ];
  for (const [m, p, b] of anonApis) {
    const r = await call(m, p, null, b);
    check(`signed-out ${m} ${p.split('?')[0]} → 401`, r.status === 401, `got ${r.status}`);
  }
  const me = await call('GET', '/api/user/me', null);
  check('signed-out /api/user/me reports signed out', me.status === 200 && JSON.parse(me.text).signedIn === false);
  check('expired session is treated as signed out', (await call('GET', '/api/user/boards', S.aliceExpired)).status === 401);
  check('token signed with a different secret is rejected', (await call('GET', '/api/admin/vendors', S.forgedSecret)).status === 403);

  out('\n--- Customer isolation ---');
  const aliceJourney = await call('GET', '/journey?tab=bookings', S.alice);
  check("customer dashboard shows the customer's own booking", aliceJourney.status === 200 && aliceJourney.text.includes(aliceBooking.ref));
  check("customer dashboard does not show another customer's booking", !aliceJourney.text.includes(bobBooking.ref));
  const ownDetail = await call('GET', `/journey/bookings/${aliceBooking.bookingId}`, S.alice);
  check('customer can open their own booking detail', ownDetail.status === 200 && ownDetail.text.includes(aliceBooking.ref));
  check("customer cannot open another customer's booking (404)", (await call('GET', `/journey/bookings/${bobBooking.bookingId}`, S.alice)).status === 404);
  check("customer cannot cancel another customer's booking", (await call('POST', `/api/user/bookings/${bobBooking.bookingId}/cancel`, S.alice, {})).status === 404);
  check("customer cannot reschedule another customer's booking", (await call('POST', `/api/user/bookings/${bobBooking.bookingId}/reschedule`, S.alice, { date, slotStart: '16:00' })).status === 404);
  check("customer cannot read another customer's reschedule slots", (await call('GET', `/api/user/bookings/${bobBooking.bookingId}/availability?date=${date}`, S.alice)).status === 404);
  check("customer cannot review another customer's booking", (await call('POST', `/api/user/bookings/${bobBooking.bookingId}/review`, S.alice, { rating: 5, body: 'Trying to review someone else.' })).status === 404);
  check("customer cannot read another customer's moodboard (API)", (await call('GET', `/api/user/boards/${bobBoard.id}`, S.alice)).status === 404);
  check("customer cannot open another customer's moodboard (page)", (await call('GET', `/moodboards/${bobBoard.id}`, S.alice)).status === 404);
  check("customer cannot delete another customer's moodboard", (await call('DELETE', `/api/user/boards/${bobBoard.id}`, S.alice)).status === 404);
  const bobStillPending = await Booking.findById(bobBooking.bookingId).lean<Record<string, any>>();
  check("the other customer's booking is unchanged", bobStillPending?.status === 'PENDING' && bobStillPending?.startTime === '14:00');

  const profilePatch = await call('PATCH', '/api/user/profile', S.alice, { name: 'Alice K', phone: '+91 99999 88888', role: 'admin', email: 'evil@example.test' });
  const aliceDoc = await User.findById(alice._id).lean<Record<string, any>>();
  check('profile update succeeds for valid fields', profilePatch.status === 200 && aliceDoc?.name === 'Alice K');
  check('profile update cannot change role or email', aliceDoc?.role === 'customer' && aliceDoc?.email === alice.email);
  check('invalid profile input returns 400', (await call('PATCH', '/api/user/profile', S.alice, { name: '' })).status === 400);
  const aliceMe = JSON.parse((await call('GET', '/api/user/me', S.alice)).text);
  check('customer /api/user/me is not admin or artist', aliceMe.isAdmin === false && aliceMe.isArtist === false);

  const slots = await call('GET', `/api/user/bookings/${aliceBooking.bookingId}/availability?date=${date}`, S.alice);
  const slotData = JSON.parse(slots.text);
  check('owner gets reschedule slots excluding other bookings', slots.status === 200 && !slotData.slots.includes('14:00') && slotData.slots.includes('10:00'));
  const moved = await call('POST', `/api/user/bookings/${aliceBooking.bookingId}/reschedule`, S.alice, { date, slotStart: '16:00' });
  check('owner can reschedule over HTTP', moved.status === 200 && JSON.parse(moved.text).booking.startTime === '16:00');
  const clash = await call('POST', `/api/user/bookings/${aliceBooking.bookingId}/reschedule`, S.alice, { date, slotStart: '14:30' });
  check('rescheduling into another booking is rejected with 409', clash.status === 409);
  const cancelled = await call('POST', `/api/user/bookings/${aliceBooking.bookingId}/cancel`, S.alice, { reason: 'Plans changed' });
  check('owner can cancel over HTTP', cancelled.status === 200 && JSON.parse(cancelled.text).booking.status === 'CANCELLED');

  out('\n--- Role enforcement ---');
  const adminApis: Array<[string, string, unknown?]> = [
    ['GET', '/api/admin/vendors'],
    ['GET', `/api/admin/vendors/${vendor._id}/artist-accounts`],
    ['POST', `/api/admin/vendors/${vendor._id}/artist-accounts`, { email: alice.email }],
    ['PATCH', `/api/admin/reviews/${'0'.repeat(24)}`, { status: 'hidden' }],
    ['DELETE', `/api/admin/reviews/${'0'.repeat(24)}`],
    ['PATCH', `/api/bookings/${bobBooking.bookingId}`, { status: 'CONFIRMED' }],
  ];
  for (const [who, cookie] of [['customer', S.alice], ['customer with forged admin claims', S.aliceForgedAdmin], ['artist', S.artist]] as const) {
    for (const [m, p, b] of adminApis) {
      const r = await call(m, p, cookie, b);
      check(`${who} ${m} ${p} → 403`, r.status === 403, `got ${r.status}`);
    }
    for (const p of ['/admin', '/admin/bookings', '/admin/reviews', '/admin/customers', `/admin/bookings/${bobBooking.bookingId}`]) {
      const r = await call('GET', p, cookie);
      check(`${who} GET ${p} → access restricted`, redirectsTo(r, '/unauthorized') && !r.text.includes('Bob Mehra'), `${r.status} ${r.location}`);
    }
  }
  check('self-service elevation through artist linking was blocked', (await User.findById(alice._id).lean<Record<string, any>>())?.role === 'customer');
  check('customer cannot open the artist portal', redirectsTo(await call('GET', '/artist', S.alice), '/unauthorized'));
  const artistPortal = await call('GET', '/artist', S.artist);
  check('artist sees their own portal', artistPortal.status === 200 && artistPortal.text.includes('ZZ Http Vendor'));
  check('artist portal hides contact details of pending requests', !artistPortal.text.includes('bob-contact@customers.example.test'));
  const artistMe = JSON.parse((await call('GET', '/api/user/me', S.artist)).text);
  check('artist /api/user/me flags artist only', artistMe.isArtist === true && artistMe.isAdmin === false);

  out('\n--- Admin ---');
  for (const p of ['/admin', '/admin/bookings', `/admin/bookings/${bobBooking.bookingId}`, '/admin/reviews', '/admin/customers', '/admin/vendors', `/admin/vendors/${vendor._id}`]) {
    const r = await call('GET', p, S.admin);
    check(`admin GET ${p} → 200`, r.status === 200, `got ${r.status}`);
  }
  const adminSearch = await call('GET', `/admin/bookings?q=${encodeURIComponent(bobBooking.ref)}`, S.admin);
  check('admin booking search by reference works', adminSearch.status === 200 && adminSearch.text.includes(bobBooking.ref));
  const confirm = await call('PATCH', `/api/bookings/${bobBooking.bookingId}`, S.admin, { status: 'CONFIRMED', adminNotes: 'Called client' });
  check('admin can confirm a booking', confirm.status === 200);
  const early = await call('PATCH', `/api/bookings/${bobBooking.bookingId}`, S.admin, { status: 'COMPLETED' });
  check('admin cannot complete a booking before its appointment', early.status === 409);
  const bobDetail = await call('GET', `/journey/bookings/${bobBooking.bookingId}`, S.bob);
  check('customer view never shows internal admin notes', bobDetail.status === 200 && !bobDetail.text.includes('Called client'));
  const link = await call('POST', `/api/admin/vendors/${vendor._id}/artist-accounts`, S.admin, { email: admin.email });
  check('admin cannot link an admin account as an artist', link.status === 409);
  check('admin /api/user/me reports admin', JSON.parse((await call('GET', '/api/user/me', S.admin)).text).isAdmin === true);

  out(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
