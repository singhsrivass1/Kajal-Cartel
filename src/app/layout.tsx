import type { Metadata } from "next";
import "./globals.css";
import React from "react";

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
        <main>{children}</main>
      </body>
    </html>
  );
}