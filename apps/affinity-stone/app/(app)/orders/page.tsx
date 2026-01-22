import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { Card, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { Badge } from 'core/components/Badge';
import { EmptyState } from 'core/components/EmptyState';
import { Button } from 'core/components/Button';
import Link from 'next/link';

export default async function OrdersPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let orders: any[] = [];
  
  if (isDevMode) {
    // Mock data for dev mode
    orders = [
      {
        id: 'mock-order-1',
        total_points: 10000,
        status: 'processing',
        fulfillment_type: 'shipping',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        ship_name: 'Demo User',
      },
      {
        id: 'mock-order-2',
        total_points: 2500,
        status: 'ready',
        fulfillment_type: 'pickup',
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        ship_name: 'Demo User',
      },
      {
        id: 'mock-order-3',
        total_points: 1500,
        status: 'completed',
        fulfillment_type: 'shipping',
        created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        ship_name: 'Demo User',
      },
    ];
  } else {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) return null;

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    orders = data || [];
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'ready': return 'info';
      case 'processing': return 'warning';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  return (
    <div>
      <PageHeader 
        title="My Orders" 
        subtitle={orders.length > 0 ? `${orders.length} ${orders.length === 1 ? 'order' : 'orders'} total` : 'Track your redemptions'}
      />

      {orders && orders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="group hover:shadow-xl transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-primary/20">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={getStatusVariant(order.status)}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      
                      <p className="text-2xl font-bold text-gray-900 mb-2">
                        {order.total_points.toLocaleString()} <span className="text-base font-normal text-gray-600">points</span>
                      </p>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Placed {new Date(order.created_at).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          {order.fulfillment_type === 'shipping' ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                              <span>Shipping to: {order.ship_name}</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span>Pickup by: {order.ship_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
                      <span>View Details</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={
                <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              }
              title="No orders yet"
              description="Start shopping and redeem your points for exclusive merchandise"
              action={
                <Link href="/dashboard">
                  <Button variant="primary" size="lg">
                    Browse Shop
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
