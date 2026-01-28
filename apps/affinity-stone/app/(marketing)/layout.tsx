import Link from 'next/link';
import { BrandMark } from 'core/components/BrandMark';
import { Button } from 'core/components/Button';
import { getCurrentUser } from '@/lib/auth/get-user';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is already authenticated
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let user = null;
  if (!isDevMode) {
    user = await getCurrentUser();
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-50 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/home" className="hover:opacity-80 transition-opacity">
              <BrandMark 
                imageClassName="h-14 w-auto" 
                showText={false}
              />
            </Link>
            
            <div className="flex items-center gap-3">
              {user ? (
                <Link href="/dashboard">
                  <Button variant="primary">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="outline">Login</Button>
                  </Link>
                  <Link href="/request-access">
                    <Button variant="primary">Request Access</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center">
            <BrandMark 
              imageClassName="h-10 w-auto mb-4" 
              showText={false}
            />
            <div className="text-center text-sm text-gray-600">
              <p>&copy; {new Date().getFullYear()} Affinity Stone Rewards. All rights reserved.</p>
              <p className="mt-2">An employee rewards merch shop.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
