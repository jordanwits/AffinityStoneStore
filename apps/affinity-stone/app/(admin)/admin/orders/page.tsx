import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { ClickableTableRow } from './ClickableTableRow';

export default async function AdminOrdersPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let orders: any[] = [];
  
  if (!isDevMode) {
    const supabase = await createClient();

    // Get all orders with user info
    const { data } = await supabase
      .from('orders')
      .select('*, profiles(email)')
      .order('created_at', { ascending: false });
    
    orders = data || [];
  } else {
    // Mock data for dev mode
    orders = [];
  }

  // Calculate stats
  const stats = {
    new: orders?.filter((o) => o.status === 'new').length || 0,
    processing: orders?.filter((o) => o.status === 'processing').length || 0,
    shipped: orders?.filter((o) => o.status === 'shipped').length || 0,
    delivered: orders?.filter((o) => o.status === 'delivered').length || 0,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600 mt-1">Manage and fulfill customer orders</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">New Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.new}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Processing</p>
                <p className="text-3xl font-bold text-gray-900">{stats.processing}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Shipped</p>
                <p className="text-3xl font-bold text-gray-900">{stats.shipped}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Delivered</p>
                <p className="text-3xl font-bold text-gray-900">{stats.delivered}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">All Orders</h2>
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Order ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Delivery Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Ship To
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order: any) => (
                    <ClickableTableRow key={order.id} href={`/admin/orders/${order.id}`}>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        <span className="text-primary font-semibold">
                          {order.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.profiles?.email || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.delivery_method === 'pickup'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {order.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {order.delivery_method === 'pickup' ? (
                          <span className="text-gray-500 italic">N/A</span>
                        ) : (
                          order.ship_name || 'N/A'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{order.total_points}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'delivered'
                              ? 'bg-green-100 text-green-900'
                              : order.status === 'shipped'
                              ? 'bg-purple-100 text-purple-900'
                              : order.status === 'processing'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-yellow-100 text-yellow-900'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-primary font-medium hover:underline">
                          View
                        </span>
                      </td>
                    </ClickableTableRow>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-700 text-center py-8">
              {isDevMode ? 'Configure Supabase to see real data' : 'No orders found'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
