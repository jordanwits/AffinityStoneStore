import type { Metadata } from "next";
import BaseLayout from "core/components/BaseLayout";
import { affinityBranding } from "../branding";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: `${affinityBranding.appName} - Rewards Merch Shop`,
  description: `Redeem your points for branded merchandise at ${affinityBranding.appName}`,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BaseLayout branding={affinityBranding}>
      {children}
      <SpeedInsights />
    </BaseLayout>
  );
}
