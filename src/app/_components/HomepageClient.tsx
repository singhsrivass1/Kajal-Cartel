'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import type { ClientVendor } from '@/types/match';

const FONT_DISPLAY = '"Cormorant Garamond", "Cormorant", Georgia, serif';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] } },
};

// 1. SINGLE, CLEAN CORNER NAVIGATION (Logo Removed)
function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-6 lg:px-12 py-8 flex justify-end items-center">
      {/* Unified top-right navigation */}
      <nav className="flex gap-6 text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-[#F0EBE0]">
        <Link href="/discover" className="hover:text-[#C9A96E] transition-colors">Discover</Link>
        <Link href="/discover#roster" className="hover:text-[#C9A96E] transition-colors">Roster</Link>
        <Link href="/my-journey" className="hover:text-[#C9A96E] transition-colors">My Journey</Link>
        <Link href="/auth" className="hover:text-[#C9A96E] transition-colors">Sign In</Link>
      </nav>
    </header>
  );
}

// 2. HIGH-CONTRAST HERO (Only Bridal Image)
function HeroSection() {
  return (
    <section className="relative h-screen min-h-[640px] w-full flex items-center justify-center overflow-hidden bg-[#080808]">
      <Header />
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-01.png"
          alt="Luxury Bridal Beauty"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {/* Heavy gradient ensures perfect text legibility */}
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
        <Link href="/discover">
          <button className="px-10 py-4 text-[10px] tracking-[0.25em] uppercase bg-[#C9A96E] text-[#080808] font-semibold hover:bg-[#F0EBE0] transition-colors duration-300">
            Start Matching
          </button>
        </Link>
      </motion.div>
    </section>
  );
}

// 3. INTERIOR IMAGES + CASUAL INDIAN REVIEWS
function ExperienceAndReviews() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const reviews = [
    {
      name: "Ananya S.",
      text: "I was so scared of getting that typical cakey bridal makeup. I uploaded a picture of Alia Bhatt's wedding look, and the AI matched me with an artist who actually understood what 'glass skin' meant. Obsessed."
    },
    {
      name: "Kritika M.",
      text: "Such a lifesaver. Dropped my Pinterest board in here and found someone who perfectly nailed the soft-glam look for my Sangeet. Didn't have to scroll through 100 random Instagram pages."
    },
    {
      name: "Priya V.",
      text: "The pricing transparency is everything. I got matched, saw the exact estimate for my location, and booked my trial. Zero hassle."
    }
  ];

  return (
    <section ref={ref} className="py-32 px-6 lg:px-12 bg-[#080808]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        
        {/* Left Side: Interior Image */}
        <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} className="relative aspect-[4/5] overflow-hidden bg-[#0E0E0E]">
           <Image 
             src="/images/interior-01.png" 
             alt="Luxury Bridal Studio Interior" 
             fill 
             className="object-cover opacity-90"
             sizes="(max-width: 1024px) 100vw, 50vw"
           />
        </motion.div>

        {/* Right Side: Reviews on solid black for perfect reading */}
        <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} className="flex flex-col justify-center">
          <h2 style={{ fontFamily: FONT_DISPLAY }} className="text-3xl lg:text-4xl text-[#F0EBE0] mb-12">
            The standard of Delhi bridal beauty.
          </h2>
          
          <div className="space-y-10">
            {reviews.map((review, idx) => (
              <div key={idx} className="border-l border-[#C9A96E] pl-6">
                <p className="text-sm text-[#A09890] leading-relaxed mb-3 font-light italic">
                  "{review.text}"
                </p>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#F0EBE0]">
                  — {review.name}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}

// 4. CLEAN ROSTER GRID
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
                <Image src={vendor.profileImageUrl} alt={vendor.name} fill className="object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
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

function Footer() {
  return (
    <footer className="border-t border-[#141210] py-12 bg-[#0A0A0A] flex items-center justify-center">
      <p className="text-[8px] tracking-[0.3em] uppercase text-[#454140]">AI-Powered Bridal Discovery · New Delhi</p>
    </footer>
  );
}

export function HomepageClient({ featuredVendors }: { featuredVendors: ClientVendor[] }) {
  return (
    <main className="min-h-screen bg-[#080808]">
      <HeroSection />
      <ExperienceAndReviews />
      <RosterSection vendors={featuredVendors} />
      <Footer />
    </main>
  );
}