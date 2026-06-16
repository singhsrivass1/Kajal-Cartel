import mongoose, { Types } from 'mongoose';
import { config } from 'dotenv';
import Vendor from './models/Vendor';
import Service from './models/Service';
import { vendorSeedData, buildServiceSeedData } from './seed/data';

config({ path: '.env.local' });

async function computeAndUpdateServiceSummary(vendorId: Types.ObjectId): Promise<void> {
  const services = await Service.find({ vendor: vendorId, 'flags.isActive': true });

  if (!services.length) return;

  const allPrices = services.map((s) => s.pricing.unitPriceINR);
  const allOccasions = [
    ...new Set(services.flatMap((s) => s.aestheticSignals.occasionTags)),
  ];

  await Vendor.findByIdAndUpdate(
    vendorId,
    {
      $set: {
        serviceSummary: {
          serviceCount: services.length,
          anchorServiceCount: services.filter((s) => s.serviceRole === 'anchor').length,
          priceRangeINR: {
            min: Math.min(...allPrices),
            max: Math.max(...allPrices),
          },
          occasionCoverage: allOccasions,
          hasTrialOffering: services.some((s) => s.serviceRole === 'trial'),
        },
      },
    },
    { new: true }
  );
}

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined. Add it to your .env.local file.');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  await Vendor.deleteMany({});
  await Service.deleteMany({});
  console.log('Vendor and Service collections wiped.');

  const insertedVendors = await Vendor.insertMany(vendorSeedData as Parameters<typeof Vendor.insertMany>[0]);
  console.log(`Inserted ${insertedVendors.length} vendors.`);

  const vendorIdMap = new Map<string, Types.ObjectId>(
    insertedVendors.map((v) => [v.slug, v._id as Types.ObjectId])
  );

  const serviceDocs = buildServiceSeedData(vendorIdMap);
  const insertedServices = await Service.insertMany(serviceDocs as Parameters<typeof Service.insertMany>[0]);
  console.log(`Inserted ${insertedServices.length} services.`);

  console.log('Computing and patching serviceSummary on each vendor...');
  for (const vendor of insertedVendors) {
    await computeAndUpdateServiceSummary(vendor._id as Types.ObjectId);
    console.log(`  Patched: ${vendor.name}`);
  }

  await mongoose.disconnect();
  console.log('Done. The Cartel is live.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
