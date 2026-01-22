import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from 'core/components/Card';
import { Badge } from 'core/components/Badge';
import { BackButton } from 'core/components/BackButton';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AddToCartButton from './AddToCartButton';
import ImageGallery from './ImageGallery';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  let conversionRate = 100;
  let product: any = null;
  let variants: any[] = [];
  
  if (isDevMode) {
    // Mock data for dev mode
    const mockProducts = [
      {
        id: '1',
        name: 'Company Logo T-Shirt',
        description: 'Premium cotton t-shirt with embroidered company logo. Made from 100% organic cotton for comfort and durability. Available in multiple sizes.',
        base_usd: 25.00,
        images: ['/ChrisCrossBlackCottonT-Shirt.webp'],
        active: true,
      },
      {
        id: '2',
        name: 'Insulated Water Bottle',
        description: 'Keep your drinks cold for 24 hours or hot for 12 hours with this premium stainless steel insulated water bottle. Features the company logo.',
        base_usd: 35.00,
        images: ['/KiyoUVC-Bottle_Studio_Fullsize-500ml_Black_C2_4480x.jpg'],
        active: true,
      },
      {
        id: '3',
        name: 'Laptop Backpack',
        description: 'Durable laptop backpack with padded compartment for devices up to 15". Multiple pockets for organization and comfort straps.',
        base_usd: 75.00,
        images: ['/1200W-18684-Black-0-NKDH7709BlackBagFront3.jpg'],
        active: true,
      },
      {
        id: '4',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with company branding. Includes USB receiver and batteries.',
        base_usd: 45.00,
        images: ['/b43457a0-76b6-11f0-9faf-5258f188704a.png'],
        active: true,
      },
      {
        id: '5',
        name: 'Notebook Set',
        description: 'Set of 3 premium notebooks with company logo. Lined pages, elastic closure.',
        base_usd: 20.00,
        images: ['/moleskine-classic-hardcover-notebook-black.webp'],
        active: true,
      },
    ];
    
    product = mockProducts.find((p) => p.id === id);
    
    // Mock variants for the t-shirt (sizes and colors)
    if (id === '1') {
      variants = [
        { id: 'v1', product_id: '1', name: 'Small - Black', size: 'S', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v2', product_id: '1', name: 'Medium - Black', size: 'M', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v3', product_id: '1', name: 'Large - Black', size: 'L', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v4', product_id: '1', name: 'X-Large - Black', size: 'XL', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v5', product_id: '1', name: 'Small - Blue', size: 'S', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v6', product_id: '1', name: 'Medium - Blue', size: 'M', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v7', product_id: '1', name: 'Large - Blue', size: 'L', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v8', product_id: '1', name: 'X-Large - Blue', size: 'XL', color: 'Blue', price_adjustment_usd: 0, active: true },
      ];
    }
    // Mock variants for water bottle (colors only)
    if (id === '2') {
      variants = [
        { id: 'v9', product_id: '2', name: 'Black', color: 'Black', price_adjustment_usd: 0, active: true },
        { id: 'v10', product_id: '2', name: 'Blue', color: 'Blue', price_adjustment_usd: 0, active: true },
        { id: 'v11', product_id: '2', name: 'Silver', color: 'Silver', price_adjustment_usd: 0, active: true },
      ];
    }
  } else {
    const supabase = await createClient();

    // Get store settings for conversion rate
    const { data: settings } = await supabase
      .from('store_settings')
      .select('usd_to_points_rate')
      .single();

    conversionRate = settings?.usd_to_points_rate || 100;

    // Get product details
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    product = prod;

    // Get product variants
    const { data: vars } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', id)
      .eq('active', true);

    variants = vars || [];
  }

  if (!product) {
    notFound();
  }

  const basePoints = Math.round(product.base_usd * conversionRate);

  return (
    <div>
      {/* Back Button and Breadcrumb */}
      <div className="mb-6 space-y-3">
        <BackButton href="/dashboard" label="Back to Shop" />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">
            Shop
          </Link>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium truncate">{product.name}</span>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Product Image Gallery */}
        <ImageGallery images={product.images || []} productName={product.name} />

        {/* Product Info & Purchase Panel */}
        <div className="flex flex-col">
          <div className="mb-6">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{product.name}</h1>
            
            <div className="flex items-baseline gap-3 mb-4">
              <p className="text-4xl font-bold text-primary">{basePoints.toLocaleString()}</p>
              <span className="text-lg text-gray-600">points</span>
              <Badge variant="info" size="sm" className="ml-2">
                ${product.base_usd.toFixed(2)} value
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="success">In Stock</Badge>
              <span className="text-sm text-gray-600">• Usually ships within 3-5 business days</span>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Product Details
              </h2>
              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </CardContent>
          </Card>

          <div className="mt-auto">
            <AddToCartButton
              productId={product.id}
              productName={product.name}
              variants={variants}
              basePoints={basePoints}
              conversionRate={conversionRate}
            />
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t">
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-gray-600 font-medium">Quality Guaranteed</p>
            </div>
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto text-blue-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-xs text-gray-600 font-medium">Points Only</p>
            </div>
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto text-purple-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              <p className="text-xs text-gray-600 font-medium">Fast Shipping</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
