'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Root page that handles auth callbacks and redirects
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if there are auth tokens in the hash (from Supabase invite/recovery)
    const hash = window.location.hash;
    
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const tokenType = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      
      // If this is an invite or recovery token, redirect to update-password
      if (accessToken && (tokenType === 'invite' || tokenType === 'recovery')) {
        // Preserve the hash when redirecting
        router.replace('/update-password' + hash);
        return;
      }
    }
    
    // No auth tokens, redirect to home page
    router.replace('/home');
  }, [router]);

  // Show loading while we determine where to redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
