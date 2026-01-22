'use client';

import React, { createContext, useContext } from 'react';

export interface BrandingConfig {
  appName: string;
  logoText: string;
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
  };
  domain?: string;
}

const BrandingContext = createContext<BrandingConfig | null>(null);

export function BrandingProvider({
  children,
  branding,
}: {
  children: React.ReactNode;
  branding: BrandingConfig;
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
