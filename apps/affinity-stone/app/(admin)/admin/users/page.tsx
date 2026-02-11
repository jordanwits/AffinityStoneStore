import { UsersPageClient } from './UsersPageClient';
import { requireAdmin } from '@/lib/auth/require-admin';

export default async function AdminUsersPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let users: any[] = [];
  let accessRequests: any[] = [];
  let currentAdminId: string | undefined;
  
  if (!isDevMode) {
    const { supabase, user } = await requireAdmin();
    currentAdminId = user.id;

    // Get all users with their points balance
    const { data } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,active,created_at')
      .order('created_at', { ascending: false });
    
    users = data || [];

    // Get pending access requests
    const { data: requests } = await supabase
      .from('access_requests')
      .select('id,email,full_name,message,status,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    accessRequests = requests || [];
  } else {
    // Mock data for dev mode
    users = [
      {
        id: '1',
        email: 'admin@affinity.com',
        full_name: 'Admin User',
        role: 'admin',
        active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        email: 'user@affinity.com',
        full_name: 'Test User',
        role: 'user',
        active: true,
        created_at: new Date().toISOString(),
      },
    ];
    // Mock access requests for dev mode
    accessRequests = [
      {
        id: 'req-1',
        email: 'newuser@example.com',
        full_name: 'New User Request',
        message: 'I would like access to the rewards platform.',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ];
  }

  return <UsersPageClient isDevMode={isDevMode} users={users} accessRequests={accessRequests} currentAdminId={currentAdminId} />;
}
