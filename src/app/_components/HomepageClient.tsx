'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { SiteHeader } from '@/components/site/SiteHeader';
import { StarRating } from '@/components/reviews/StarRating';
import type { ClientVendor } from '@/types/match';
import type { RecentReview } from '@/lib/db/controllers/ReviewManager';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] } },
};

const HOW_IT_WORKS = [
  {
    title: 'Show us the look you love',
    text: 'Upload a reference photo on Discover. We read its style signals and suggest the artists on our roster whose work fits it best.',
  },
  {
    title: 'Compare real services and prices',
    text: 'Every artist profile lists their actual services, durations and prices, with an itemised estimate before you request anything.',
  },
  {
    title: 'Request your date',
    text: 'Choose an open time from the artist’s live calendar. Manage, reschedule or cancel your request from your account.',
  },
];

function HeroSection() {
  return (
    <section className="relative h-screen min-h-[640px] w-full flex items-center justify-center overflow-hidden bg-[#080808]">
      <SiteHeader variant="overlay" position="absolute" />
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-01.png"
          alt="Luxury Bridal Beauty"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/70 via-[#080808]/40 to-[#080808]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.2 }}
        className="relative z-10 text-center flex flex-col items-center px-4"
      >
        <h1 style={{ fontFamily: FONT_DISPLAY }} className="text-5xl md:text-7xl lg:text-[6rem] text-[#F0EBE0] leading-none mb-6 drop-shadow-xl">
          Find Your Artist.
        </h1>
        <p className="text-sm md:text-base text-[#D0C8C0] max-w-lg mb-10 font-light drop-shadow-md">
          Upload your mood board. Let our AI match your aesthetic with Delhi's most elite bridal artists.
        </p>
        <Link
          href="/discover"
          className="inline-block px-10 py-4 text-[10px] tracking-[0.25em] uppercase bg-[#C9A96E] text-[#080808] font-semibold hover:bg-[#F0EBE0] transition-colors duration-300"
        >
          Start Matching
        </Link>
      </motion.div>
    </section>
  );
}


function ExperienceAndReviews({ reviews }: { reviews: RecentReview[] }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-32 px-6 lg:px-12 bg-[#080808]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {}
        <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} className="relative aspect-[4/5] overflow-hidden bg-[#0E0E0E]">
           <Image
             src="/images/interior-01.png"
             alt="Luxury Bridal Studio Interior"
             fill
             className="object-cover opacity-90"
             sizes="(max-width: 1024px) 100vw, 50vw"
           />
        </motion.div>

        {}
        <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} className="flex flex-col justify-center">
          <h2 style={{ fontFamily: FONT_DISPLAY }} className="text-3xl lg:text-4xl text-[#F0EBE0] mb-12">
            The standard of Delhi bridal beauty.
          </h2>

          {reviews.length > 0 ? (
            <div className="space-y-10">
              <p className="text-[10px] tracking-[0.24em] uppercase text-[#C9A96E] -mt-6">Reviews from completed bookings</p>
              {reviews.map((review) => (
                <figure key={review.id} className="border-l border-[#C9A96E] pl-6 m-0">
                  <StarRating value={review.rating} size={12} />
                  <blockquote className="text-sm text-[#A09890] leading-relaxed my-3 font-light italic">
                    &ldquo;{review.body.length > 280 ? `${review.body.slice(0, 277)}…` : review.body}&rdquo;
                  </blockquote>
                  <figcaption className="text-[10px] tracking-[0.2em] uppercase text-[#F0EBE0]">
                    — {review.authorDisplayName} ·{' '}
                    <Link href={`/artists/${review.vendorSlug}#reviews`} className="text-[#C9A96E] hover:text-[#F0EBE0] transition-colors">
                      {review.vendorName}
                    </Link>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <ol className="space-y-10 list-none p-0 m-0">
              {HOW_IT_WORKS.map((step, idx) => (
                <li key={step.title} className="border-l border-[#C9A96E] pl-6">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Step {idx + 1}</p>
                  <p style={{ fontFamily: FONT_DISPLAY }} className="text-xl text-[#F0EBE0] mb-2">{step.title}</p>
                  <p className="text-sm text-[#A09890] leading-relaxed font-light">{step.text}</p>
                </li>
              ))}
            </ol>
          )}
        </motion.div>

      </div>
    </section>
  );
}


function RosterSection({ vendors }: { vendors: ClientVendor[] }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  if (!vendors.length) return null;

  return (
    <section ref={ref} className="py-24 px-6 lg:px-12 bg-[#080808] border-t border-[#141210]">
      <div className="max-w-7xl mx-auto">
        <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} className="mb-12 flex justify-between items-end">
          <h2 style={{ fontFamily: FONT_DISPLAY }} className="text-3xl text-[#F0EBE0]">Featured Artists</h2>
          <Link href="/discover#roster" className="text-[9px] tracking-[0.2em] uppercase text-[#C9A96E] hover:text-[#F0EBE0] transition-colors">
            View All Roster →
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {vendors.map((vendor) => (
            <Link href={`/artists/${vendor.slug}`} key={vendor._id} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden bg-[#0E0E0E] mb-4">
                <Image src={vendor.profileImageUrl} alt={vendor.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
              </div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#5A5450] mb-1">{vendor.location.microLocation}</p>
              <h3 style={{ fontFamily: FONT_DISPLAY }} className="text-lg text-[#F0EBE0] group-hover:text-[#C9A96E] transition-colors">{vendor.name}</h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomepageClient({ featuredVendors, reviews }: { featuredVendors: ClientVendor[]; reviews: RecentReview[] }) {
  return (
    <main id="main-content" className="min-h-screen bg-[#080808]">
      <HeroSection />
      <ExperienceAndReviews reviews={reviews} />
      <RosterSection vendors={featuredVendors} />
    </main>
  );
}
