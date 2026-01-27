import Link from 'next/link';
import { getCurrentUser, getUserProfile } from '@/lib/auth/get-user';
import { redirect } from 'next/navigation';
import CartIcon from './layout/CartIcon';
import NavLink from './layout/NavLink';
import MobileMenu from './layout/MobileMenu';
import { BrandMark } from 'core/components/BrandMark';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let user = null;
  let profile = null;
  
  if (!isDevMode) {
    user = await getCurrentUser();
    profile = await getUserProfile();
    
    if (!user) {
      redirect('/login');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-300 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-3 lg:px-4">
          <div className="flex justify-between h-20">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
                <BrandMark showText={false} imageClassName="h-14 w-auto" />
              </Link>
              <div className="hidden md:flex space-x-1">
                <NavLink href="/dashboard">Shop</NavLink>
                <NavLink href="/orders">Orders</NavLink>
                <NavLink href="/points-history">Points</NavLink>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CartIcon />
              <div className="hidden sm:flex items-center gap-3 border-l pl-3 ml-3">
                {isDevMode ? (
                  <>
                    <span className="text-sm text-gray-600 truncate max-w-[150px]">demo@affinity.com</span>
                    <Link
                      href="/admin"
                      className="text-sm font-medium text-primary hover:underline underline-offset-2"
                    >
                      Admin
                    </Link>
                    <Link
                      href="/login"
                      className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Login
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-600 truncate max-w-[150px]">{user?.email}</span>
                    {profile?.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="text-sm font-medium text-primary hover:underline underline-offset-2"
                      >
                        Admin
                      </Link>
                    )}
                    <form action="/logout" method="POST">
                      <button
                        type="submit"
                        className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        Logout
                      </button>
                    </form>
                  </>
                )}
              </div>
              <MobileMenu 
                userEmail={isDevMode ? 'demo@affinity.com' : user?.email || ''} 
                isAdmin={profile?.role === 'admin'}
                isDevMode={isDevMode}
              />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-[1600px] mx-auto py-20 px-3 lg:px-4">
        {children}
      </main>
    </div>
  );
}
