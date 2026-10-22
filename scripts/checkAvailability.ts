import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const Vendor = (await import('../src/lib/db/models/Vendor')).default;
  const Service = (await import('../src/lib/db/models/Service')).default;
  const { getDailyAvailability } = await import('../src/lib/db/controllers/AvailabilityManager');

  const vendors = await Vendor.find({ 'flags.isActive': true }).select('slug').lean<any[]>();
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 14);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  const date = d.toISOString().slice(0, 10);

  console.log(`Checking ${date} for ${vendors.length} active vendors:\n`);
  let bad = 0;
  for (const v of vendors) {
    const svc = await Service.findOne({
      vendor: v._id,
      serviceRole: 'anchor',
      'flags.isActive': true,
    })
      .select('_id')
      .lean<any>();
    if (!svc) {
      console.log(`  ${String(v.slug).padEnd(26)} no anchor service`);
      continue;
    }
    const r = await getDailyAvailability({
      vendorSlug: v.slug,
      serviceId: String(svc._id),
      date,
    });
    const range = r.slots.length ? ` ${r.slots[0]}..${r.slots[r.slots.length - 1]}` : '';
    console.log(
      `  ${String(v.slug).padEnd(26)} configured=${r.configured} open=${r.isOpen} slots=${r.slots.length}${range}`
    );
    if (!r.configured) bad++;
  }
  console.log(bad === 0 ? '\nAll vendors configured.' : `\n${bad} vendor(s) still unconfigured.`);
  await mongoose.disconnect();
  if (bad > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
