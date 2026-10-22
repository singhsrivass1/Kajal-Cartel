import mongoose, { Types } from 'mongoose';
import { config } from 'dotenv';
import Vendor from './models/Vendor';
import Service from './models/Service';
import Booking from './models/Booking';
import VendorAvailability from './models/VendorAvailability';
import BlockedDate from './models/BlockedDate';
import PortfolioImage from './models/PortfolioImage';
import { vendorSeedData, buildServiceSeedData } from './seed/data';

config({ path: '.env.local' });

/**
 * Seeding upserts by natural key (Vendor.slug, Service.vendor+slug) rather than
 * wiping and re-inserting.
 *
 * The previous implementation ran deleteMany() then insertMany(), which minted a
 * fresh _id for every vendor and service on each run. Anything referencing those
 * _ids — VendorAvailability, BlockedDate, PortfolioImage, Booking — was silently
 * left pointing at documents that no longer existed, with no error and no warning.
 * That is exactly how availability "disappeared" after a re-seed.
 *
 * Upserting keeps _ids stable across runs, so those references survive. Pass
 * --fresh for the old destructive behaviour; that path now cascades to dependent
 * collections instead of orphaning them.
 */

const FRESH = process.argv.includes('--fresh');

async function computeAndUpdateServiceSummary(vendorId: Types.ObjectId): Promise<void> {
  const services = await Service.find({ vendor: vendorId, 'flags.isActive': true });
  if (!services.length) return;

  const allPrices = services.map((s) => s.pricing.unitPriceINR);
  const allOccasions = [...new Set(services.flatMap((s) => s.aestheticSignals.occasionTags))];

  await Vendor.findByIdAndUpdate(vendorId, {
    $set: {
      serviceSummary: {
        serviceCount: services.length,
        anchorServiceCount: services.filter((s) => s.serviceRole === 'anchor').length,
        priceRangeINR: { min: Math.min(...allPrices), max: Math.max(...allPrices) },
        occasionCoverage: allOccasions,
        hasTrialOffering: services.some((s) => s.serviceRole === 'trial'),
      },
    },
  });
}

async function wipeEverything(): Promise<void> {
  console.log('--fresh: wiping vendors, services, and every collection that references them.');
  const vendorIds = (await Vendor.find({}).select('_id').lean<Array<{ _id: Types.ObjectId }>>()).map(
    (v) => v._id
  );

  // Cascade deliberately: deleting vendors without these leaves dangling refs.
  await Promise.all([
    Booking.deleteMany({ vendor: { $in: vendorIds } }),
    VendorAvailability.deleteMany({ vendor: { $in: vendorIds } }),
    BlockedDate.deleteMany({ vendor: { $in: vendorIds } }),
    PortfolioImage.deleteMany({ vendor: { $in: vendorIds } }),
  ]);
  await Service.deleteMany({});
  await Vendor.deleteMany({});
  console.log('  Wiped.');
}

/** Removes PortfolioImage rows no longer referenced by any vendor's portfolio. */
async function collectUnreferencedPortfolioImages(): Promise<number> {
  const vendors = await Vendor.find({}).select('portfolio').lean<Array<Record<string, any>>>();
  const referenced = new Set<string>();
  for (const v of vendors) {
    for (const item of v.portfolio ?? []) {
      const match = String(item.imageUrl ?? '').match(/^\/api\/portfolio-images\/([a-f0-9]{24})$/i);
      if (match) referenced.add(match[1].toLowerCase());
    }
  }

  const all = await PortfolioImage.find({}).select('_id').lean<Array<{ _id: Types.ObjectId }>>();
  const unreferenced = all.filter((img) => !referenced.has(img._id.toString().toLowerCase()));
  if (unreferenced.length === 0) return 0;

  await PortfolioImage.deleteMany({ _id: { $in: unreferenced.map((i) => i._id) } });
  return unreferenced.length;
}

/** Fails loudly on any dangling reference, so drift can never be silent again. */
async function reportIntegrity(): Promise<number> {
  const vendorIds = new Set(
    (await Vendor.find({}).select('_id').lean<Array<{ _id: Types.ObjectId }>>()).map((v) =>
      v._id.toString()
    )
  );
  const serviceIds = new Set(
    (await Service.find({}).select('_id').lean<Array<{ _id: Types.ObjectId }>>()).map((s) =>
      s._id.toString()
    )
  );

  let problems = 0;
  const byVendor: Array<[string, any]> = [
    ['VendorAvailability', VendorAvailability],
    ['BlockedDate', BlockedDate],
    ['PortfolioImage', PortfolioImage],
    ['Booking', Booking],
  ];

  for (const [label, model] of byVendor) {
    const docs = await model.find({}).select('vendor').lean();
    const orphans = docs.filter((d: any) => !vendorIds.has(String(d.vendor)));
    if (orphans.length) {
      problems += orphans.length;
      console.log(`  ORPHANED  ${label}: ${orphans.length} row(s) reference a missing vendor`);
    }
  }

  const bookings = await Booking.find({}).select('service').lean<Array<{ service: Types.ObjectId }>>();
  const orphanBookings = bookings.filter((b) => !serviceIds.has(String(b.service)));
  if (orphanBookings.length) {
    problems += orphanBookings.length;
    console.log(`  ORPHANED  Booking: ${orphanBookings.length} row(s) reference a missing service`);
  }

  const missingAvailability: string[] = [];
  for (const v of await Vendor.find({ 'flags.isActive': true }).select('slug').lean<Array<Record<string, any>>>()) {
    const has = await VendorAvailability.exists({ vendor: v._id });
    if (!has) missingAvailability.push(v.slug);
  }
  if (missingAvailability.length) {
    console.log(
      `  NOTE      ${missingAvailability.length} active vendor(s) have no availability configured ` +
        `(${missingAvailability.join(', ')}) — run: npm run seed:availability`
    );
  }

  return problems;
}

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined. Add it to your .env.local file.');
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB (database: ${mongoose.connection.name}).`);

  if (FRESH) await wipeEverything();

  console.log(`\nUpserting ${vendorSeedData.length} vendors by slug...`);
  const vendorIdMap = new Map<string, Types.ObjectId>();
  let created = 0;
  let updated = 0;

  for (const raw of vendorSeedData) {
    const data = raw as Record<string, any>;
    const existing = await Vendor.findOne({ slug: data.slug }).select('_id').lean<{ _id: Types.ObjectId }>();

    const doc = await Vendor.findOneAndUpdate(
      { slug: data.slug },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    if (existing) updated++;
    else created++;
    vendorIdMap.set(data.slug, doc!._id as Types.ObjectId);
  }
  console.log(`  ${created} created, ${updated} updated in place (_ids preserved).`);

  const serviceDocs = buildServiceSeedData(vendorIdMap) as Array<Record<string, any>>;
  console.log(`\nUpserting ${serviceDocs.length} services by (vendor, slug)...`);
  let sCreated = 0;
  let sUpdated = 0;
  const seededServiceKeys = new Set<string>();

  for (const data of serviceDocs) {
    const key = `${String(data.vendor)}::${data.slug}`;
    seededServiceKeys.add(key);

    const existing = await Service.findOne({ vendor: data.vendor, slug: data.slug })
      .select('_id')
      .lean<{ _id: Types.ObjectId }>();

    await Service.findOneAndUpdate(
      { vendor: data.vendor, slug: data.slug },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    if (existing) sUpdated++;
    else sCreated++;
  }
  console.log(`  ${sCreated} created, ${sUpdated} updated in place (_ids preserved).`);

  // Services that used to be seeded but no longer are. Deactivate rather than
  // delete when a live booking points at one, so that booking stays resolvable.
  const allServices = await Service.find({})
    .select('_id vendor slug name')
    .lean<Array<Record<string, any>>>();
  const stale = allServices.filter(
    (s) => !seededServiceKeys.has(`${String(s.vendor)}::${s.slug}`)
  );

  if (stale.length) {
    console.log(`\n${stale.length} service(s) no longer in seed data:`);
    for (const s of stale) {
      const live = await Booking.countDocuments({
        service: s._id,
        status: { $in: ['PENDING', 'CONFIRMED'] },
      });
      if (live > 0) {
        await Service.updateOne({ _id: s._id }, { $set: { 'flags.isActive': false } });
        console.log(`  deactivated "${s.name}" (${live} live booking(s) still reference it)`);
      } else {
        await Service.deleteOne({ _id: s._id });
        console.log(`  deleted "${s.name}"`);
      }
    }
  }

  console.log('\nRecomputing serviceSummary...');
  for (const [slug, id] of vendorIdMap) {
    await computeAndUpdateServiceSummary(id);
    console.log(`  ${slug}`);
  }

  const collected = await collectUnreferencedPortfolioImages();
  if (collected > 0) {
    console.log(`\nGarbage-collected ${collected} unreferenced portfolio image(s).`);
  }

  console.log('\nIntegrity check:');
  const problems = await reportIntegrity();
  console.log(problems === 0 ? '  No dangling references.' : `  ${problems} dangling reference(s) found.`);

  await mongoose.disconnect();
  console.log('\nDone. The Cartel is live.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
