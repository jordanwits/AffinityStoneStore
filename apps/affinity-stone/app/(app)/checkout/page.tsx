import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import CheckoutPageClient from './CheckoutPageClient';
import { placeOrder } from './actions';

export default async function CheckoutPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let conversionRate = 100;
  let products: any[] = [];
  let variants: any[] = [];
  let pointsBalance = 0;
  
  if (isDevMode) {
    // Mock data for dev mode
    pointsBalance = 2500;
    products = [
      {
        id: '1',
        name: 'Company Logo T-Shirt',
        description: 'Premium cotton t-shirt with embroidered company logo',
        base_usd: 25.00,
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&q=80'],
        active: true,
      },
      {
        id: '2',
        name: 'Insulated Water Bottle',
        description: 'Stainless steel insulated water bottle',
        base_usd: 35.00,
        images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop&q=80'],
        active: true,
      },
      {
        id: '3',
        name: 'Laptop Backpack',
        description: 'Durable laptop backpack with padded compartment',
        base_usd: 75.00,
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop&q=80'],
        active: true,
      },
      {
        id: '4',
        name: 'Wireless Headphones',
        description: 'Noise-cancelling over-ear headphones with premium sound',
        base_usd: 85.00,
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&q=80'],
        active: true,
      },
      {
        id: '5',
        name: 'Coffee Mug',
        description: 'Ceramic coffee mug with company branding',
        base_usd: 15.00,
        images: ['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop&q=80'],
        active: true,
      },
    ];
    // Mock variants for the t-shirt
    variants = [
      { id: 'v1', product_id: '1', name: 'Small', size: 'S', price_adjustment_usd: 0, active: true },
      { id: 'v2', product_id: '1', name: 'Medium', size: 'M', price_adjustment_usd: 0, active: true },
      { id: 'v3', product_id: '1', name: 'Large', size: 'L', price_adjustment_usd: 0, active: true },
      { id: 'v4', product_id: '1', name: 'X-Large', size: 'XL', price_adjustment_usd: 5, active: true },
    ];
  } else {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) return null;

    // Get store settings for conversion rate
    const { data: settings } = await supabase
      .from('store_settings')
      .select('usd_to_points_rate')
      .single();

    conversionRate = settings?.usd_to_points_rate || 100;

    // Get all active products
    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .eq('active', true);
    
    products = prods || [];

    // Get all active variants
    const { data: vars } = await supabase
      .from('product_variants')
      .select('*')
      .eq('active', true);
    
    variants = vars || [];

    // Get user's points balance
    const { data: balance } = await supabase.rpc('get_user_points_balance', {
      p_user_id: user.id,
    });
    pointsBalance = balance || 0;
  }

  return (
    <CheckoutPageClient
      isDevMode={isDevMode}
      conversionRate={conversionRate}
      products={products}
      variants={variants}
      pointsBalance={pointsBalance}
      placeOrder={placeOrder}
    />
  );
}
