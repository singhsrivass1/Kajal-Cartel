import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import { Providers } from "@/components/Providers"; // Ensure this path matches where you saved Providers.tsx
import { SiteFooter } from "@/components/site/SiteFooter";
import { getSiteUrl } from "@/lib/site/config";

export function generateMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  return {
    ...(siteUrl ? { metadataBase: siteUrl } : {}),
    title: "Kajal Cartel",
    description: "Bridal Beauty, Curated",
    openGraph: {
      siteName: "Kajal Cartel",
      type: "website",
      locale: "en_IN",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#080808] text-[#F0EBE0] antialiased">
        <Providers>
          <div id="kc-page">{children}</div>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
