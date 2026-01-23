'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';
import { sendEmail, getAdminEmails } from '@/lib/email/resend';
import { customerOrderStatusEmail, adminOrderStatusEmail } from '@/lib/email/templates';

const VALID_STATUSES = ['new', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = typeof VALID_STATUSES[number];

interface UpdateOrderStatusData {
  orderId: string;
  status: string;
  trackingNumber?: string;
  notes?: string;
}

export async function updateOrderStatus(data: UpdateOrderStatusData) {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Order status updates require Supabase to be configured.' 
    };
  }

  const { supabase } = await requireAdmin();
  
  // Validate status
  if (!VALID_STATUSES.includes(data.status as OrderStatus)) {
    return { success: false, error: 'Invalid order status' };
  }
  
  // Build update object
  const updateData: any = {
    status: data.status,
  };
  
  if (data.trackingNumber !== undefined) {
    updateData.tracking_number = data.trackingNumber || null;
  }
  
  if (data.notes !== undefined) {
    updateData.notes = data.notes || null;
  }
  
  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', data.orderId);
  
  if (error) {
    console.error('Error updating order status:', error);
    return { success: false, error: 'Failed to update order status' };
  }
  
  // Revalidate relevant pages
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${data.orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/orders/${data.orderId}`);
  
  // Send email notifications (failures should not block status update)
  try {
    // Get order details with user email
    const { data: orderDetails } = await supabase
      .from('orders')
      .select('*, profiles(email)')
      .eq('id', data.orderId)
      .single();
    
    if (orderDetails && (orderDetails as any).profiles?.email) {
      const orderNumber = data.orderId.slice(0, 8).toUpperCase();
      const emailData = {
        orderId: data.orderId,
        orderNumber,
        customerEmail: (orderDetails as any).profiles.email,
        totalPoints: orderDetails.total_points,
        itemCount: 0, // Not critical for status update
        deliveryMethod: orderDetails.delivery_method,
        createdAt: orderDetails.created_at,
        status: data.status,
        trackingNumber: data.trackingNumber,
      };
      
      // Send customer notification (don't wait)
      sendEmail({
        to: (orderDetails as any).profiles.email,
        ...customerOrderStatusEmail(emailData),
      }).catch(err => console.error('Failed to send customer status email:', err));
      
      // Send admin notification (don't wait)
      const adminEmails = getAdminEmails();
      if (adminEmails.length > 0) {
        sendEmail({
          to: adminEmails,
          ...adminOrderStatusEmail(emailData),
        }).catch(err => console.error('Failed to send admin status email:', err));
      }
    }
  } catch (emailError) {
    // Log but don't fail the status update
    console.error('Error sending status update emails:', emailError);
  }
  
  return { success: true };
}
