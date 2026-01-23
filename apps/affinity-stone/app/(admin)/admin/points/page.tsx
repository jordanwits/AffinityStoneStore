import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Button } from 'core/components/Button';
import PointsAdjustmentForm from './PointsAdjustmentForm';
import { TransactionRow } from './TransactionRow';
import { BulkPointsUpload } from './BulkPointsUpload';

export default async function AdminPointsPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let recentTransactions: any[] = [];
  
  if (!isDevMode) {
    const supabase = await createClient();

    // Get recent points transactions
    const { data } = await supabase
      .from('points_ledger')
      .select('id, delta_points, reason, order_id, created_at, profiles!points_ledger_user_id_fkey(email)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    recentTransactions = data || [];
  } else {
    // Mock data for dev mode
    recentTransactions = [
      {
        id: '1',
        delta_points: 1000,
        reason: 'Welcome bonus',
        created_at: new Date().toISOString(),
        profiles: { email: 'demo@affinity.com' },
      },
      {
        id: '2',
        delta_points: -500,
        reason: 'Order redemption',
        order_id: 'mock-order-1',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        profiles: { email: 'demo@affinity.com' },
      },
    ];
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Points</h1>
          <p className="text-gray-600 mt-1">Manage user points and transactions</p>
        </div>
        <BulkPointsUpload isDevMode={isDevMode} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Adjust User Points</h2>
        </CardHeader>
        <CardContent>
          <PointsAdjustmentForm isDevMode={isDevMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        </CardHeader>
        <CardContent>
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="overflow-x-auto" style={{ position: 'relative' }}>
              <table className="min-w-full divide-y divide-gray-200" style={{ position: 'relative' }}>
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentTransactions.map((transaction: any) => (
                    <TransactionRow key={transaction.id} transaction={transaction} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-700 text-center py-8">
              {isDevMode ? 'Mock transactions shown (configure Supabase to see real data)' : 'No transactions found'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
