import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import { Providers } from "@/components/Providers"; // Ensure this path matches where you saved Providers.tsx

export const metadata: Metadata = {
  title: "Kajal Cartel",
  description: "AI-Powered Bridal Discovery Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#080808] text-[#F0EBE0] antialiased">
        <Providers>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}