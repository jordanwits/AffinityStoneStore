'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, getAdminEmails, getSiteUrl } from '@/lib/email/resend';

export interface RequestAccessResult {
  success: boolean;
  error?: string;
  message?: string;
}

function isDevMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );
}

export async function submitAccessRequest(input: {
  email: string;
  fullName: string;
  message?: string;
}): Promise<RequestAccessResult> {
  // Validate input
  if (!input?.email || !input?.fullName) {
    return { success: false, error: 'Email and full name are required' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    return { success: false, error: 'Invalid email address' };
  }

  // Validate lengths
  if (input.fullName.trim().length > 200) {
    return { success: false, error: 'Full name is too long (max 200 characters)' };
  }

  if (input.message && input.message.trim().length > 1000) {
    return { success: false, error: 'Message is too long (max 1000 characters)' };
  }

  const trimmedEmail = input.email.trim().toLowerCase();
  const trimmedName = input.fullName.trim();
  const trimmedMessage = input.message?.trim() || null;

  // In dev mode, skip DB insert but still try to send email notification
  if (isDevMode()) {
    console.log('[Access Request] Dev mode - skipping database insert:', {
      email: trimmedEmail,
      fullName: trimmedName,
    });
    
    // Try to send admin notification even in dev mode
    await sendAdminNotification({
      email: trimmedEmail,
      fullName: trimmedName,
      message: trimmedMessage,
    });
    
    return { 
      success: true, 
      message: 'Access request submitted successfully (dev mode - no database)' 
    };
  }

  // Check if service role key is configured
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error('[Access Request] Service role key not configured:', error);
    return { 
      success: false, 
      error: 'Server configuration error. Please contact an administrator.' 
    };
  }

  // Check if user already has an account
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const userExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === trimmedEmail);
  
  if (userExists) {
    return { 
      success: false, 
      error: 'An account with this email already exists. Please use the login page.' 
    };
  }

  // Check if there's already a pending request for this email
  const { data: existingRequest } = await supabase
    .from('access_requests')
    .select('id, status')
    .eq('email', trimmedEmail)
    .single();

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      return { 
        success: false, 
        error: 'You already have a pending access request. Please wait for admin approval.' 
      };
    } else if (existingRequest.status === 'approved') {
      return { 
        success: false, 
        error: 'Your access request was already approved. Please check your email for login instructions.' 
      };
    }
    // If status is 'rejected', allow them to submit a new request
  }

  // Insert access request into database
  const { error: insertError } = await supabase
    .from('access_requests')
    .insert({
      email: trimmedEmail,
      full_name: trimmedName,
      message: trimmedMessage,
      status: 'pending',
    });

  if (insertError) {
    console.error('[Access Request] Database insert error:', insertError);
    return { 
      success: false, 
      error: 'Failed to submit access request. Please try again.' 
    };
  }

  // Send email notification to admins
  await sendAdminNotification({
    email: trimmedEmail,
    fullName: trimmedName,
    message: trimmedMessage,
  });

  return { 
    success: true, 
    message: 'Access request submitted successfully. You will receive an email once your request is approved.' 
  };
}

async function sendAdminNotification(request: {
  email: string;
  fullName: string;
  message: string | null;
}) {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    console.log('[Access Request] No admin emails configured, skipping notification');
    return;
  }

  const siteUrl = getSiteUrl();
  const subject = `New Access Request - ${request.fullName}`;
  
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
    <h1 style="color: #92400e; margin: 0 0 10px 0;">New Access Request</h1>
    <p style="font-size: 16px; margin: 0; color: #78350f;">Someone has requested access to the Affinity Stone Rewards shop.</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="font-size: 18px; margin: 0 0 15px 0;">Request Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Name:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${request.fullName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;"><strong>Email:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${request.email}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Date:</strong></td>
        <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleString()}</td>
      </tr>
    </table>
    ${request.message ? `
    <div style="margin-top: 15px; padding: 15px; background-color: #f3f4f6; border-radius: 6px;">
      <p style="margin: 0 0 5px 0; font-size: 14px; font-weight: bold; color: #666;">Message:</p>
      <p style="margin: 0; color: #333; white-space: pre-wrap;">${request.message}</p>
    </div>
    ` : ''}
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${siteUrl}/admin/users" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Go to Admin Panel</a>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px; color: #666;">
      To approve this request, go to the admin panel and create a new user account with the email address above.
    </p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: adminEmails,
    subject,
    html,
  });
}
