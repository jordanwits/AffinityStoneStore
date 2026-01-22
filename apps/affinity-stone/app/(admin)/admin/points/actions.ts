'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';

export async function adjustUserPoints(userId: string, deltaPoints: number, reason: string) {
  const { supabase, profile } = await requireAdmin();
  
  // Validate inputs
  if (!userId || !reason || reason.trim() === '') {
    return { success: false, error: 'User and reason are required' };
  }
  
  if (isNaN(deltaPoints) || deltaPoints === 0) {
    return { success: false, error: 'Points adjustment must be a non-zero number' };
  }
  
  // Verify user exists
  const { data: targetUser, error: userError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .single();
  
  if (userError || !targetUser) {
    return { success: false, error: 'User not found' };
  }
  
  // Insert into points ledger
  const { error } = await supabase
    .from('points_ledger')
    .insert({
      user_id: userId,
      delta_points: deltaPoints,
      reason: reason.trim(),
      created_by: profile.id,
    });
  
  if (error) {
    console.error('Error adjusting user points:', error);
    return { success: false, error: 'Failed to adjust points' };
  }
  
  // Revalidate relevant pages
  revalidatePath('/admin/points');
  revalidatePath('/admin/users');
  revalidatePath('/dashboard');
  revalidatePath('/points-history');
  
  return { 
    success: true, 
    message: `Successfully ${deltaPoints > 0 ? 'added' : 'deducted'} ${Math.abs(deltaPoints)} points ${deltaPoints > 0 ? 'to' : 'from'} ${targetUser.email}` 
  };
}

export async function getUsers() {
  const { supabase } = await requireAdmin();
  
  // Fetch all active users including admins
  // Using service role client, so RLS is bypassed
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, active, role')
    .eq('active', true)
    .order('email');
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  console.log('Fetched users for points adjustment:', users?.length || 0);
  return users || [];
}
