'use server';

import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';
import { sendEmail, getSiteUrl } from '@/lib/email/resend';
import {
  normalizeNanpInputToE164,
  PHONE_LOGIN_DOMAIN,
  reservedPhoneLoginDomainMessage,
  syntheticEmailFromE164,
} from '@/lib/auth/phone';
import { MUST_CHANGE_PASSWORD_KEY } from '@/lib/auth/must-change-password';
import { stripPhoneDigits } from 'core/lib/phone-format';

type UserRole = 'user' | 'admin';

export interface UpdateUserProfileResult {
  success: boolean;
  error?: string;
}

export type CreateUserResult =
  | { success: true; mode: 'invite' }
  | { success: true; mode: 'phone'; temporaryPassword: string }
  | { success: false; error: string };

function generateTemporaryPassword(): string {
  return `${randomBytes(18).toString('base64url')}aA1`;
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

  // Get user's email before deletion (for resetting access requests)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', input.userId)
    .single();

  const userEmail = profile?.email;

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

  // Reset any access requests for this email so they can request again
  if (userEmail) {
    const trimmedEmail = userEmail.trim().toLowerCase();
    const { error: requestError } = await supabase
      .from('access_requests')
      .update({
        status: 'rejected',
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('email', trimmedEmail)
      .in('status', ['pending', 'approved']); // Only update pending or approved requests

    if (requestError) {
      console.error('Error resetting access requests:', requestError);
      // Don't fail the operation, just log it
    } else {
      console.log(`[Delete User] Reset access requests for ${trimmedEmail}`);
    }
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/points');

  return { success: true };
}

export async function declineAccessRequest(input: {
  requestId: string;
}): Promise<UpdateUserProfileResult> {
  if (isDevMode()) {
    return { success: false, error: 'Declining requests requires Supabase to be configured.' };
  }

  if (!input?.requestId) {
    return { success: false, error: 'Request ID is required' };
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from('access_requests')
    .delete()
    .eq('id', input.requestId);

  if (error) {
    console.error('Error declining access request:', error);
    return { success: false, error: error.message || 'Failed to decline request' };
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');

  return { success: true };
}

export async function createUser(
  input:
    | { mode?: 'invite'; email: string; fullName?: string; role?: UserRole }
    | { mode: 'phone'; phoneDigits: string; fullName?: string; role?: UserRole }
): Promise<CreateUserResult> {
  if (isDevMode()) {
    return { success: false, error: 'User creation requires Supabase to be configured.' };
  }

  const { supabase, user: currentAdmin } = await requireAdmin();

  if (input.mode === 'phone') {
    const e164 = normalizeNanpInputToE164(stripPhoneDigits(input.phoneDigits));
    if (!e164) {
      return {
        success: false,
        error: 'Enter a complete US phone number (10 digits, or 11 starting with 1).',
      };
    }

    const { data: existingPhone } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', e164)
      .maybeSingle();

    if (existingPhone) {
      return { success: false, error: 'A user with this phone number already exists.' };
    }

    const syntheticEmail = syntheticEmailFromE164(e164);
    const temporaryPassword = generateTemporaryPassword();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        phone_e164: e164,
        full_name: input.fullName?.trim() || null,
        [MUST_CHANGE_PASSWORD_KEY]: true,
      },
    });

    if (authError) {
      console.error('Error creating phone user:', authError);
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return { success: false, error: 'An account for this phone may already exist.' };
      }
      if (authError.message.includes('Database error creating new user')) {
        return {
          success: false,
          error:
            'Database rejected signup. Apply migration 027_profile_signup_policy_auth_lookup.sql (and ensure 024–026 ran). If it still fails, open Postgres logs and search for ERROR right after a signup attempt.',
        };
      }
      return { success: false, error: authError.message || 'Failed to create user' };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' };
    }

    if (input.role && input.role !== 'user') {
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: input.role })
        .eq('id', authData.user.id);

      if (roleError) {
        console.error('Error setting user role:', roleError);
      }
    }

    revalidatePath('/admin/users');
    revalidatePath('/admin');

    return { success: true, mode: 'phone', temporaryPassword };
  }

  if (!input.email?.trim()) {
    return { success: false, error: 'Email is required' };
  }

  const trimmedEmail = input.email.trim();
  if (trimmedEmail.toLowerCase().endsWith(`@${PHONE_LOGIN_DOMAIN}`)) {
    return { success: false, error: reservedPhoneLoginDomainMessage() };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { success: false, error: 'Invalid email address' };
  }

  // Create the user first (unconfirmed, they'll confirm via the invite link)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: trimmedEmail,
    email_confirm: false, // Don't confirm - they'll confirm via invite link
    user_metadata: {
      full_name: input.fullName?.trim() || null,
    },
  });

  if (authError) {
    console.error('Error creating user:', authError);
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      return { success: false, error: 'A user with this email already exists' };
    }
    if (authError.message.includes('Database error creating new user')) {
      return {
        success: false,
        error:
          'Database rejected signup. Apply migration 027_profile_signup_policy_auth_lookup.sql (and ensure 024–026 ran). Check Postgres logs for the underlying ERROR.',
      };
    }
    return { success: false, error: authError.message || 'Failed to create user' };
  }

  if (!authData.user) {
    return { success: false, error: 'Failed to create user' };
  }

  // Generate invite link for the newly created user
  let siteUrl = getSiteUrl();
  
  // CRITICAL: Never use localhost for invite links - force production URL
  if (siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1')) {
    console.error('[Invite Link] CRITICAL: siteUrl is localhost, forcing production URL');
    siteUrl = 'https://affinitystonestore.com';
  }
  
  const redirectTo = new URL('/update-password', siteUrl).toString();
  
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: trimmedEmail,
    options: {
      redirectTo,
    },
  });

  if (linkError) {
    console.error('Error generating invite link:', linkError);
    console.error('Link error details:', JSON.stringify(linkError, null, 2));
    // If link generation fails, try to delete the user and return error
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: `Failed to generate invite link: ${linkError.message || 'Please try again.'}` };
  }

  if (!linkData?.properties?.action_link) {
    console.error('Link data missing action_link:', linkData);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: 'Failed to generate invite link. Please try again.' };
  }

  // Replace any localhost URLs in the generated link with the production site URL
  // Supabase generates links using its configured site URL, which might be localhost
  // This can appear in the base URL or in query parameters like redirect_to
  let inviteLink = linkData.properties.action_link;
  const originalLink = inviteLink;
  
  // AGGRESSIVE REPLACEMENT: Replace ALL localhost URLs anywhere in the link string
  // This handles base URLs, query parameters, hash fragments, etc.
  const localhostPatterns = [
    /https?:\/\/localhost(:\d+)?/gi,  // http://localhost or http://localhost:3000
    /https?%3A%2F%2Flocalhost(%3A\d+)?/gi,  // URL-encoded localhost
  ];
  
  for (const pattern of localhostPatterns) {
    if (pattern.test(inviteLink)) {
      inviteLink = inviteLink.replace(pattern, (match) => {
        // If the match includes a path/query/hash, preserve it
        // Otherwise just replace with siteUrl
        const urlMatch = match.match(/^(https?:\/\/localhost(?::\d+)?)(.*)$/i) || 
                        match.match(/^(https?%3A%2F%2Flocalhost(?:%3A\d+)?)(.*)$/i);
        if (urlMatch && urlMatch[2]) {
          // Has additional path/query/hash - preserve it
          return siteUrl + urlMatch[2];
        }
        return siteUrl;
      });
    }
  }
  
  // Also handle URL-encoded localhost in query parameters
  try {
    const url = new URL(inviteLink);
    const searchParams = url.searchParams;
    let paramsChanged = false;
    
    for (const [key, value] of searchParams.entries()) {
      // Decode and check for localhost
      const decoded = decodeURIComponent(value);
      if (decoded.includes('localhost')) {
        // Replace localhost URLs in the decoded value
        const updated = decoded.replace(/https?:\/\/localhost(:\d+)?/gi, siteUrl);
        if (updated !== decoded) {
          searchParams.set(key, updated);
          paramsChanged = true;
        }
      }
    }
    
    if (paramsChanged) {
      inviteLink = url.toString();
    }
  } catch (error) {
    // If URL parsing fails, the regex replacement above should have caught it
    console.error('[Invite Link] Error parsing URL for query param replacement:', error);
  }
  
  // Final safety check: if link still contains localhost, do one more aggressive replacement
  if (inviteLink.includes('localhost')) {
    console.warn('[Invite Link] Still contains localhost after replacement, doing final cleanup');
    inviteLink = inviteLink.replace(/https?:\/\/localhost(:\d+)?/gi, siteUrl);
    inviteLink = inviteLink.replace(/https?%3A%2F%2Flocalhost(%3A\d+)?/gi, encodeURIComponent(siteUrl));
  }
  
  if (inviteLink !== originalLink) {
    console.log('[Invite Link] Replaced localhost URLs with production URL');
    console.log('[Invite Link] Original:', originalLink);
    console.log('[Invite Link] Updated:', inviteLink);
  } else {
    console.warn('[Invite Link] No localhost URLs found to replace - this might be an issue');
    console.log('[Invite Link] Site URL being used:', siteUrl);
    console.log('[Invite Link] Generated link:', inviteLink);
  }

  // Send invite email via Resend (using verified domain)
  const emailResult = await sendInviteEmail({
    email: trimmedEmail,
    fullName: input.fullName?.trim() || null,
    inviteLink,
  });

  if (!emailResult.success) {
    console.error('Error sending invite email:', emailResult.error);
    // User is created but email failed - log it but don't fail the operation
    // Admin can manually resend the invite if needed
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

  // Mark any pending access request for this email as approved
  const trimmedEmailLower = trimmedEmail.toLowerCase();
  const { error: requestError } = await supabase
    .from('access_requests')
    .update({
      status: 'approved',
      reviewed_by: currentAdmin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('email', trimmedEmailLower)
    .eq('status', 'pending');

  if (requestError) {
    console.error('Error updating access request status:', requestError);
    // Don't fail the whole operation, just log it
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin');

  return { success: true, mode: 'invite' };
}

async function sendInviteEmail(params: {
  email: string;
  fullName: string | null;
  inviteLink: string;
}) {
  const siteUrl = getSiteUrl();

  const displayName = params.fullName || 'there';
  const subject = 'Welcome to Affinity Stone Rewards - Set Your Password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #92400e; margin: 0 0 10px 0;">Welcome to Affinity Stone Rewards!</h1>
    <p style="font-size: 16px; margin: 0; color: #78350f;">Your account has been created. Please set your password to get started.</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <p style="margin: 0 0 15px 0;">Hi ${displayName},</p>
    <p style="margin: 0 0 15px 0;">
      Your account has been created for the Affinity Stone Rewards platform. To get started, please click the button below to set your password.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.inviteLink}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Set Your Password</a>
    </div>
    
    <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 5px 0 0 0; font-size: 12px; color: #2563eb; word-break: break-all;">
      ${params.inviteLink}
    </p>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px; color: #666;">
      <strong>Note:</strong> This link will expire in 24 hours. If you didn't request this account, you can safely ignore this email.
    </p>
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">
      Affinity Stone Rewards<br>
      <a href="${siteUrl}" style="color: #2563eb; text-decoration: none;">${siteUrl}</a>
    </p>
  </div>
</body>
</html>
  `;

  const text = `
Welcome to Affinity Stone Rewards!

Hi ${displayName},

Your account has been created for the Affinity Stone Rewards platform. To get started, please visit the link below to set your password.

${params.inviteLink}

Note: This link will expire in 24 hours. If you didn't request this account, you can safely ignore this email.

Affinity Stone Rewards
${siteUrl}
  `.trim();

  return await sendEmail({
    to: params.email,
    subject,
    html,
    text,
  });
}
