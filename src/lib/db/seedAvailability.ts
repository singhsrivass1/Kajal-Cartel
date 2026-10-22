import mongoose from 'mongoose';
import { config } from 'dotenv';
import Vendor from './models/Vendor';
import VendorAvailability from './models/VendorAvailability';
import BlockedDate from './models/BlockedDate';

config({ path: '.env.local' });

const DEFAULT_WORKING_HOURS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek !== 0, // closed Sundays
  startTime: '10:00',
  endTime: '19:00',
}));

async function seedAvailability(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined. Add it to your .env.local file.');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const vendors = await Vendor.find({}).select('_id slug name').lean();
  if (!vendors.length) {
    console.log('No vendors found — run `npm run seed` first.');
    await mongoose.disconnect();
    return;
  }

  for (const vendor of vendors) {
    await VendorAvailability.findOneAndUpdate(
      { vendor: vendor._id },
      {
        $setOnInsert: {
          vendor: vendor._id,
          workingHours: DEFAULT_WORKING_HOURS,
          slotIntervalMinutes: 30,
          maxConcurrentBookings: 1,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`  Working hours set: ${vendor.name} (Mon–Sat, 10:00–19:00)`);
  }

  // One example blocked date, 10 days out, on the first vendor — for manual testing only.
  const testVendor = vendors[0];
  const blockStart = new Date();
  blockStart.setUTCDate(blockStart.getUTCDate() + 10);
  const blockStartUTC = new Date(Date.UTC(blockStart.getUTCFullYear(), blockStart.getUTCMonth(), blockStart.getUTCDate()));

  await BlockedDate.findOneAndUpdate(
    { vendor: testVendor._id, startDate: blockStartUTC },
    {
      $setOnInsert: {
        vendor: testVendor._id,
        startDate: blockStartUTC,
        endDate: blockStartUTC,
        reason: 'Out of town for a destination wedding',
      },
    },
    { upsert: true, new: true }
  );
  console.log(`  Example blocked date set: ${testVendor.name} on ${blockStartUTC.toISOString().slice(0, 10)}`);

  await mongoose.disconnect();
  console.log('Done seeding availability.');
}

seedAvailability()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Availability seed failed:', err);
    process.exit(1);
  });
