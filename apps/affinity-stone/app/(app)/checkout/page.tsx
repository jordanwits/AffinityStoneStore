import CheckoutPageClient from './CheckoutPageClient';
import { placeOrder } from './actions';

export default async function CheckoutPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  // No more heavy data fetching on server!
  // The client will fetch only the products it needs via a server action
  return (
    <CheckoutPageClient
      isDevMode={isDevMode}
      placeOrder={placeOrder}
    />
  );
}
