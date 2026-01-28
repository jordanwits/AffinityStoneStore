import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { EmptyState } from 'core/components/EmptyState';
import { Badge } from 'core/components/Badge';
import { Button } from 'core/components/Button';
import Link from 'next/link';

// Cache points history for 2 minutes (points are user-specific and update frequently)
export const revalidate = 120;

interface PointsHistoryPageProps {
  searchParams: Promise<{
    days?: string;
    page?: string;
  }>;
}

export default async function PointsHistoryPage({ searchParams }: PointsHistoryPageProps) {
  const params = await searchParams;
  const daysFilter = parseInt(params.days || '90', 10); // Default to last 90 days
  const currentPage = parseInt(params.page || '1', 10);
  const itemsPerPage = 50;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let pointsBalance = 0;
  let history: any[] = [];
  let totalEarned = 0;
  let totalSpent = 0;
  let totalCount = 0;
  let hasMore = false;
  
  if (isDevMode) {
    // Mock data for dev mode
    pointsBalance = 2500;
    history = [
      {
        id: '1',
        reason: 'Welcome bonus',
        delta_points: 1000,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        reason: 'Monthly reward',
        delta_points: 1500,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        reason: 'Order #ABCD1234',
        delta_points: -500,
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: '4',
        reason: 'Performance bonus',
        delta_points: 500,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
    ];
    totalEarned = 3000;
    totalSpent = 500;
    totalCount = 4;
  } else {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) return null;

    // Calculate date cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysFilter);
    const cutoffISO = cutoffDate.toISOString();

    // Run all queries in parallel for faster loading
    const [balanceResult, countResult, historyResult] = await Promise.all([
      supabase.rpc('get_user_points_balance', { p_user_id: user.id }),
      supabase
        .from('points_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', cutoffISO),
      supabase
        .from('points_ledger')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', cutoffISO)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1),
    ]);

    pointsBalance = balanceResult.data || 0;
    totalCount = countResult.count || 0;
    hasMore = totalCount > currentPage * itemsPerPage;
    history = historyResult.data || [];

    // Calculate totals for the filtered period
    totalEarned = history
      ?.filter((entry) => entry.delta_points > 0)
      .reduce((sum, entry) => sum + entry.delta_points, 0) || 0;

    totalSpent = Math.abs(
      history
        ?.filter((entry) => entry.delta_points < 0)
        .reduce((sum, entry) => sum + entry.delta_points, 0) || 0
    );
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div>
      <PageHeader 
        title="Points History" 
        subtitle={`Track your earnings and redemptions (last ${daysFilter} days)`}
      />

      {/* Date filter controls */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={`/points-history?days=30&page=1`}>
          <Button variant={daysFilter === 30 ? 'primary' : 'outline'} size="sm">
            Last 30 days
          </Button>
        </Link>
        <Link href={`/points-history?days=90&page=1`}>
          <Button variant={daysFilter === 90 ? 'primary' : 'outline'} size="sm">
            Last 90 days
          </Button>
        </Link>
        <Link href={`/points-history?days=180&page=1`}>
          <Button variant={daysFilter === 180 ? 'primary' : 'outline'} size="sm">
            Last 6 months
          </Button>
        </Link>
        <Link href={`/points-history?days=365&page=1`}>
          <Button variant={daysFilter === 365 ? 'primary' : 'outline'} size="sm">
            Last year
          </Button>
        </Link>
        <Link href={`/points-history?days=9999&page=1`}>
          <Button variant={daysFilter === 9999 ? 'primary' : 'outline'} size="sm">
            All time
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2">Current Balance</p>
              <p className="text-4xl font-bold text-secondary">{pointsBalance.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary/20 text-secondary mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2">Total Earned</p>
              <p className="text-4xl font-bold text-secondary">{totalEarned.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2">Total Redeemed</p>
              <p className="text-4xl font-bold text-primary">{totalSpent.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            <Badge variant="default">{totalCount} in period</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <>
              <div className="divide-y">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between py-4 first:pt-0 last:pb-0 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {entry.delta_points > 0 ? (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" transform="rotate(180 10 10)" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{entry.reason}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(entry.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p
                      className={`text-2xl font-bold ${
                        entry.delta_points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {entry.delta_points > 0 ? '+' : ''}
                      {entry.delta_points.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">points</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 pt-6 border-t">
                {currentPage > 1 && (
                  <Link href={`/points-history?days=${daysFilter}&page=${currentPage - 1}`}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                {hasMore && (
                  <Link href={`/points-history?days=${daysFilter}&page=${currentPage + 1}`}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
          ) : (
            <EmptyState
              icon={
                <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="No points activity yet"
              description="Your points transactions will appear here once you start earning and redeeming"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
