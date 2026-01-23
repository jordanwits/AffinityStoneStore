'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';

type UserRole = 'user' | 'admin';

export interface UpdateUserProfileResult {
  success: boolean;
  error?: string;
}

function isDevMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );
}

export async function updateUserProfile(input: {
  userId: string;
  fullName?: string;
  role?: UserRole;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User updates require Supabase to be configured.' };
  }

  if (!input?.userId) {
    return { success: false, error: 'User ID is required' };
  }

  const { supabase, user: currentUser } = await requireAdmin();

  // Prevent locking yourself out of admin
  if (input.userId === currentUser.id && input.role && input.role !== 'admin') {
    return { success: false, error: 'You cannot remove your own admin role.' };
  }

  const updates: Record<string, any> = {};

  if (typeof input.fullName === 'string') {
    const trimmed = input.fullName.trim();
    if (trimmed.length > 200) {
      return { success: false, error: 'Full name is too long (max 200 characters).' };
    }
    updates.full_name = trimmed.length ? trimmed : null;
  }

  if (input.role) {
    if (input.role !== 'user' && input.role !== 'admin') {
      return { success: false, error: 'Invalid role' };
    }
    updates.role = input.role;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No updates provided' };
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', input.userId);
  if (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: 'Failed to update user' };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/points');

  return { success: true };
}

export async function setUserActive(input: {
  userId: string;
  active: boolean;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User updates require Supabase to be configured.' };
  }

  if (!input?.userId) {
    return { success: false, error: 'User ID is required' };
  }

  const { supabase, user: currentUser } = await requireAdmin();

  // Prevent locking yourself out
  if (input.userId === currentUser.id && input.active === false) {
    return { success: false, error: 'You cannot deactivate your own account.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ active: input.active })
    .eq('id', input.userId);

  if (error) {
    console.error('Error updating user active status:', error);
    return { success: false, error: 'Failed to update user status' };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/points');
  revalidatePath('/dashboard');

  return { success: true };
}

export async function deleteUser(input: {
  userId: string;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User deletion requires Supabase to be configured.' };
  }

  if (!input?.userId) {
    return { success: false, error: 'User ID is required' };
  }

  const { supabase, user: currentUser } = await requireAdmin();

  // Prevent deleting yourself
  if (input.userId === currentUser.id) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  // Check if user has any orders
  const { data: orders, error: checkError } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', input.userId)
    .limit(1);

  if (checkError) {
    console.error('Error checking user orders:', checkError);
    return { success: false, error: 'Failed to check user history' };
  }

  if (orders && orders.length > 0) {
    return {
      success: false,
      error: 'Cannot delete user with order history. Consider deactivating instead.',
    };
  }

  // Delete from auth.users (this will cascade to profiles via trigger)
  const { error: authError } = await supabase.auth.admin.deleteUser(input.userId);

  if (authError) {
    console.error('Error deleting user from auth:', authError);
    return { success: false, error: authError.message || 'Failed to delete user' };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/points');

  return { success: true };
}

export async function createUser(input: {
  email: string;
  fullName?: string;
  role?: UserRole;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'User creation requires Supabase to be configured.' };
  }

  if (!input?.email) {
    return { success: false, error: 'Email is required' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    return { success: false, error: 'Invalid email address' };
  }

  const { supabase } = await requireAdmin();

  // Create the auth user using admin client with invite
  // This sends an email with a link to set their password
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(input.email, {
    data: {
      full_name: input.fullName?.trim() || null,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/update-password`,
  });

  if (authError) {
    console.error('Error creating user:', authError);
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      return { success: false, error: 'A user with this email already exists' };
    }
    return { success: false, error: authError.message || 'Failed to create user' };
  }

  if (!authData.user) {
    return { success: false, error: 'Failed to create user' };
  }

  // Update the profile role if specified (default is 'user' from schema)
  if (input.role && input.role !== 'user') {
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: input.role })
      .eq('id', authData.user.id);

    if (roleError) {
      console.error('Error setting user role:', roleError);
      // Don't fail the whole operation, just log it
    }
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');

  return { success: true };
}
