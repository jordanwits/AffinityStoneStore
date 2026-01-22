'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';

export async function updateConversionRate(newRate: number) {
  const { supabase, profile } = await requireAdmin();
  
  // Validate the rate
  if (isNaN(newRate) || newRate <= 0) {
    return { success: false, error: 'Conversion rate must be a positive number' };
  }
  
  // Update store_settings
  const { error } = await supabase
    .from('store_settings')
    .update({
      usd_to_points_rate: newRate,
      updated_by: profile.id,
    })
    .eq('id', 1);
  
  if (error) {
    console.error('Error updating conversion rate:', error);
    return { success: false, error: 'Failed to update conversion rate' };
  }
  
  // Revalidate pages that display product prices
  revalidatePath('/admin/products');
  revalidatePath('/dashboard');
  
  return { success: true };
}
