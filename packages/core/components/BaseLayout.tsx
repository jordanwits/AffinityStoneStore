import React from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import { BrandingProvider, BrandingConfig } from "./BrandingProvider";
import DevModeBanner from "./DevModeBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function BaseLayout({
  children,
  branding,
}: {
  children: React.ReactNode;
  branding: BrandingConfig;
}) {
  return (
    <html 
      lang="en"
      style={{
        '--primary': branding.colors.primary,
        '--primary-foreground': branding.colors.primaryForeground,
        '--secondary': branding.colors.secondary,
        '--secondary-foreground': branding.colors.secondaryForeground,
      } as React.CSSProperties}
    >
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BrandingProvider branding={branding}>
          <DevModeBanner />
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
