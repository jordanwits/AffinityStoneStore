'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from 'core/components/Card';
import { PageHeader } from 'core/components/PageHeader';
import { Alert } from 'core/components/Alert';
import { Badge } from 'core/components/Badge';
import { Skeleton } from 'core/components/Skeleton';
import { BackButton } from 'core/components/BackButton';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, clearCart } from '@/lib/cart/storage';
import type { CartItemWithDetails } from '@/lib/cart/types';
import Image from 'next/image';

interface CheckoutPageClientProps {
  isDevMode: boolean;
  conversionRate: number;
  products: any[];
  variants: any[];
  pointsBalance: number;
  placeOrder: (formData: FormData) => Promise<{ success: boolean; orderId?: string; error?: string }>;
}

export default function CheckoutPageClient({
  isDevMode,
  conversionRate,
  products,
  variants,
  pointsBalance,
  placeOrder,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItemWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('delivery');
  const [shipName, setShipName] = useState('');
  const [shipAddressLine1, setShipAddressLine1] = useState('');
  const [shipAddressLine2, setShipAddressLine2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');
  const [shipCountry, setShipCountry] = useState('US');

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    const cart = getCart();
    
    if (cart.items.length === 0) {
      router.push('/cart');
      return;
    }

    // Enrich cart items with product/variant details
    const enriched: CartItemWithDetails[] = cart.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const variant = item.variantId
        ? variants.find((v) => v.id === item.variantId)
        : undefined;

      if (!product) {
        return {
          ...item,
          productName: 'Unknown Product',
          pointsPerItem: 0,
          totalPoints: 0,
        };
      }

      const basePoints = Math.round(product.base_usd * conversionRate);
      const variantAdjustment = variant
        ? Math.round(variant.price_adjustment_usd * conversionRate)
        : 0;
      const pointsPerItem = basePoints + variantAdjustment;

      return {
        ...item,
        productName: product.name,
        variantName: variant?.name,
        pointsPerItem,
        totalPoints: pointsPerItem * item.quantity,
        imageUrl: product.images?.[0],
      };
    });

    setCartItems(enriched);
    setIsLoading(false);
  };

  const totalPoints = cartItems.reduce((sum, item) => sum + item.totalPoints, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasInsufficientPoints = totalPoints > pointsBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isDevMode) {
      setError('Order placement requires Supabase to be configured. Please set up your Supabase project and credentials.');
      return;
    }

    if (hasInsufficientPoints) {
      setError('Insufficient points balance for this order.');
      return;
    }

    setIsSubmitting(true);

    // Validate shipping fields if delivery is selected
    if (deliveryMethod === 'delivery') {
      if (!shipName || !shipAddressLine1 || !shipCity || !shipState || !shipZip || !shipCountry) {
        setError('All shipping fields are required for delivery orders.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('cart', JSON.stringify(getCart()));
      formData.append('deliveryMethod', deliveryMethod);
      formData.append('shipName', shipName);
      formData.append('shipAddressLine1', shipAddressLine1);
      formData.append('shipAddressLine2', shipAddressLine2);
      formData.append('shipCity', shipCity);
      formData.append('shipState', shipState);
      formData.append('shipZip', shipZip);
      formData.append('shipCountry', shipCountry);

      const result = await placeOrder(formData);

      if (result.success && result.orderId) {
        // Clear cart and redirect to order page
        clearCart();
        router.push(`/orders/${result.orderId}`);
      } else {
        setError(result.error || 'Failed to place order. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Checkout" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton height={300} />
            <Skeleton height={200} />
          </div>
          <div>
            <Skeleton height={400} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackButton href="/cart" label="Back to Cart" className="mb-4" />
      <PageHeader 
        title="Checkout" 
        subtitle="Complete your order and redeem your points"
      />

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white font-bold">
              1
            </div>
            <span className="ml-2 text-sm font-medium text-gray-900">Delivery Options</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300" />
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-bold">
              2
            </div>
            <span className="ml-2 text-sm font-medium text-gray-500">Review</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300" />
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-600 font-bold">
              3
            </div>
            <span className="ml-2 text-sm font-medium text-gray-500">Complete</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Delivery Method Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900">Delivery Method</h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('pickup')}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        deliveryMethod === 'pickup'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          deliveryMethod === 'pickup'
                            ? 'border-primary bg-primary'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'pickup' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h3 className="font-semibold text-gray-900">Pickup</h3>
                          </div>
                          <p className="text-sm text-gray-600">Pick up your order at our location</p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('delivery')}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        deliveryMethod === 'delivery'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          deliveryMethod === 'delivery'
                            ? 'border-primary bg-primary'
                            : 'border-gray-300'
                        }`}>
                          {deliveryMethod === 'delivery' && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <h3 className="font-semibold text-gray-900">Delivery</h3>
                          </div>
                          <p className="text-sm text-gray-600">Ship to your address</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Information - Only show for delivery */}
            {deliveryMethod === 'delivery' && (
              <Card>
                <CardHeader className="bg-gray-50">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-gray-900">Shipping Information</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="shipName" className="block text-sm font-medium text-gray-900 mb-1">
                        Full Name *
                      </label>
                      <Input
                        id="shipName"
                        type="text"
                        required={deliveryMethod === 'delivery'}
                        value={shipName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label htmlFor="shipAddressLine1" className="block text-sm font-medium text-gray-900 mb-1">
                        Address Line 1 *
                      </label>
                      <Input
                        id="shipAddressLine1"
                        type="text"
                        required={deliveryMethod === 'delivery'}
                        value={shipAddressLine1}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipAddressLine1(e.target.value)}
                        placeholder="123 Main St"
                      />
                    </div>

                    <div>
                      <label htmlFor="shipAddressLine2" className="block text-sm font-medium text-gray-900 mb-1">
                        Address Line 2
                      </label>
                      <Input
                        id="shipAddressLine2"
                        type="text"
                        value={shipAddressLine2}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipAddressLine2(e.target.value)}
                        placeholder="Apt 4B"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipCity" className="block text-sm font-medium text-gray-900 mb-1">
                          City *
                        </label>
                        <Input
                          id="shipCity"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipCity}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipCity(e.target.value)}
                          placeholder="New York"
                        />
                      </div>

                      <div>
                        <label htmlFor="shipState" className="block text-sm font-medium text-gray-900 mb-1">
                          State *
                        </label>
                        <Input
                          id="shipState"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipState}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipState(e.target.value)}
                          placeholder="NY"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipZip" className="block text-sm font-medium text-gray-900 mb-1">
                          ZIP Code *
                        </label>
                        <Input
                          id="shipZip"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipZip}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipZip(e.target.value)}
                          placeholder="10001"
                        />
                      </div>

                      <div>
                        <label htmlFor="shipCountry" className="block text-sm font-medium text-gray-900 mb-1">
                          Country *
                        </label>
                        <Input
                          id="shipCountry"
                          type="text"
                          required={deliveryMethod === 'delivery'}
                          value={shipCountry}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShipCountry(e.target.value)}
                          placeholder="US"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Items */}
            <Card>
              <CardHeader className="bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900">Order Items ({totalItems})</h2>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={`${item.productId}-${item.variantId || 'default'}`}
                      className="flex gap-3 py-3 border-b last:border-0"
                    >
                      <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                        {item.variantName && (
                          <p className="text-sm text-gray-600">{item.variantName}</p>
                        )}
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{item.totalPoints} pts</p>
                        <p className="text-xs text-gray-500">{item.pointsPerItem} pts each</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader className="bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Points Balance Card */}
                <div className={`p-4 rounded-lg border-2 ${
                  hasInsufficientPoints 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Your Balance</span>
                    <span className="text-xl font-bold text-gray-900">
                      {pointsBalance.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Order Total</span>
                    <span className="text-xl font-bold text-primary">
                      {totalPoints.toLocaleString()} pts
                    </span>
                  </div>
                  {hasInsufficientPoints && (
                    <div className="mt-3 pt-3 border-t border-red-300">
                      <p className="text-sm font-semibold text-red-800">Insufficient Points</p>
                      <p className="text-xs text-red-700 mt-1">
                        You need {(totalPoints - pointsBalance).toLocaleString()} more points to complete this order
                      </p>
                    </div>
                  )}
                  {!hasInsufficientPoints && (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">After Purchase</span>
                        <span className="text-lg font-bold text-green-600">
                          {(pointsBalance - totalPoints).toLocaleString()} pts
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Breakdown */}
                <div className="space-y-2 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Items ({totalItems})</span>
                    <span className="font-medium">{totalPoints.toLocaleString()} pts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <Badge variant="success" size="sm">FREE</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">N/A</span>
                  </div>
                </div>

                {error && (
                  <Alert variant="error" className="mb-4">
                    {error}
                  </Alert>
                )}

                {isDevMode && (
                  <Alert variant="warning" className="mb-4">
                    <p className="text-xs">
                      <strong>Dev Mode:</strong> Order placement requires Supabase configuration
                    </p>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 pt-4 border-t">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-12 text-base font-semibold"
                    disabled={isSubmitting || hasInsufficientPoints || isDevMode}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Place Order ({totalPoints.toLocaleString()} pts)
                      </span>
                    )}
                  </Button>

                  <Link href="/cart" className="block">
                    <Button variant="outline" className="w-full">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to Cart
                    </Button>
                  </Link>
                </div>

                {/* Trust Badges */}
                <div className="pt-4 border-t space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Secure checkout
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    No payment required
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
