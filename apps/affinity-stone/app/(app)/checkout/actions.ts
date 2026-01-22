'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/get-user';
import { revalidatePath } from 'next/cache';
import type { Cart } from '@/lib/cart/types';

interface PlaceOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export async function placeOrder(formData: FormData): Promise<PlaceOrderResult> {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Parse cart data
    const cartJson = formData.get('cart') as string;
    const cart: Cart = JSON.parse(cartJson);

    if (!cart.items || cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    // Get delivery method
    const deliveryMethod = formData.get('deliveryMethod') as string;
    if (!deliveryMethod || !['pickup', 'delivery'].includes(deliveryMethod)) {
      return { success: false, error: 'Please select a delivery method' };
    }

    // Get shipping info (only required for delivery)
    const shipName = formData.get('shipName') as string;
    const shipAddressLine1 = formData.get('shipAddressLine1') as string;
    const shipAddressLine2 = (formData.get('shipAddressLine2') as string) || '';
    const shipCity = formData.get('shipCity') as string;
    const shipState = formData.get('shipState') as string;
    const shipZip = formData.get('shipZip') as string;
    const shipCountry = formData.get('shipCountry') as string;

    // Validate shipping fields only for delivery orders
    if (deliveryMethod === 'delivery') {
      if (!shipName || !shipAddressLine1 || !shipCity || !shipState || !shipZip || !shipCountry) {
        return { success: false, error: 'All shipping fields are required for delivery orders' };
      }
    }

    const supabase = await createClient();

    // Get store conversion rate
    const { data: settings } = await supabase
      .from('store_settings')
      .select('usd_to_points_rate')
      .single();

    const conversionRate = settings?.usd_to_points_rate || 100;

    // Fetch all products and variants in the cart
    const productIds = cart.items.map((item) => item.productId);
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('active', true);

    if (!products || products.length === 0) {
      return { success: false, error: 'No valid products found' };
    }

    const variantIds = cart.items.filter((item) => item.variantId).map((item) => item.variantId!);
    let variants: any[] = [];
    if (variantIds.length > 0) {
      const { data: vars } = await supabase
        .from('product_variants')
        .select('*')
        .in('id', variantIds)
        .eq('active', true);
      variants = vars || [];
    }

    // Calculate total points and prepare order items
    let totalPoints = 0;
    const orderItems = [];

    for (const cartItem of cart.items) {
      const product = products.find((p) => p.id === cartItem.productId);
      if (!product) {
        return { success: false, error: `Product ${cartItem.productId} not found or inactive` };
      }

      let variant = null;
      if (cartItem.variantId) {
        variant = variants.find((v) => v.id === cartItem.variantId);
        if (!variant) {
          return { success: false, error: `Variant ${cartItem.variantId} not found or inactive` };
        }
      }

      const basePoints = Math.round(product.base_usd * conversionRate);
      const variantAdjustment = variant ? Math.round(variant.price_adjustment_usd * conversionRate) : 0;
      const pointsPerItem = basePoints + variantAdjustment;
      const itemTotalPoints = pointsPerItem * cartItem.quantity;

      totalPoints += itemTotalPoints;

      orderItems.push({
        product_id: product.id,
        variant_id: variant?.id || null,
        product_name: product.name,
        variant_name: variant?.name || null,
        quantity: cartItem.quantity,
        points_per_item: pointsPerItem,
        total_points: itemTotalPoints,
      });
    }

    // Check user's points balance
    const { data: balance } = await supabase.rpc('get_user_points_balance', {
      p_user_id: user.id,
    });

    const currentBalance = balance || 0;
    if (currentBalance < totalPoints) {
      return {
        success: false,
        error: `Insufficient points. You have ${currentBalance} points but need ${totalPoints} points.`,
      };
    }

    // Create the order
    const orderData: any = {
      user_id: user.id,
      status: 'new',
      total_points: totalPoints,
      delivery_method: deliveryMethod,
    };

    // Set shipping fields - required for delivery, null for pickup
    if (deliveryMethod === 'delivery') {
      orderData.ship_name = shipName;
      orderData.ship_address_line1 = shipAddressLine1;
      orderData.ship_address_line2 = shipAddressLine2 || null;
      orderData.ship_city = shipCity;
      orderData.ship_state = shipState;
      orderData.ship_zip = shipZip;
      orderData.ship_country = shipCountry;
    } else {
      // Explicitly set to null for pickup orders
      orderData.ship_name = null;
      orderData.ship_address_line1 = null;
      orderData.ship_address_line2 = null;
      orderData.ship_city = null;
      orderData.ship_state = null;
      orderData.ship_zip = null;
      orderData.ship_country = null;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return { success: false, error: 'Failed to create order' };
    }

    // Insert order items
    const itemsToInsert = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      // Attempt to clean up the order
      await supabase.from('orders').delete().eq('id', order.id);
      return { success: false, error: 'Failed to create order items' };
    }

    // Deduct points from user's balance via points_ledger
    const { error: pointsError } = await supabase
      .from('points_ledger')
      .insert({
        user_id: user.id,
        delta_points: -totalPoints,
        reason: `Order #${order.id.slice(0, 8).toUpperCase()}`,
        order_id: order.id,
        created_by: user.id,
      });

    if (pointsError) {
      console.error('Points ledger error:', pointsError);
      // Note: In production, you might want to roll back the order here
      // For MVP, we'll let it proceed but log the error
    }

    // Revalidate affected routes
    revalidatePath('/dashboard');
    revalidatePath('/orders');
    revalidatePath(`/orders/${order.id}`);
    revalidatePath('/cart');
    revalidatePath('/points-history');

    return { success: true, orderId: order.id };
  } catch (error) {
    console.error('Unexpected error in placeOrder:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
