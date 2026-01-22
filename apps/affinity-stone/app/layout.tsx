import type { Metadata } from "next";
import BaseLayout from "core/components/BaseLayout";
import { affinityBranding } from "../branding";
import "./globals.css";

export const metadata: Metadata = {
  title: "Affinity Stone - Rewards Merch Shop",
  description: "Redeem your Stone Credits for branded merchandise",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BaseLayout branding={affinityBranding}>
      {children}
    </BaseLayout>
  );
}
