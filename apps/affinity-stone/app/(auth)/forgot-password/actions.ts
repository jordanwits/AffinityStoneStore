'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, getSiteUrl } from '@/lib/email/resend';

interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export async function sendPasswordResetEmail(email: string): Promise<ResetPasswordResult> {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Check if Supabase is configured
  const isDevMode =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Password reset requires Supabase to be configured.' };
  }

  try {
    const supabase = createAdminClient();
    const siteUrl = getSiteUrl();
    const redirectTo = `${siteUrl}/update-password`;

    // Generate a password recovery link using the admin API
    const { data, error: generateError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: {
        redirectTo,
      },
    });

    if (generateError) {
      console.error('[Password Reset] Error generating link:', generateError);
      // Don't reveal whether the email exists
      return { success: true };
    }

    if (!data?.properties?.action_link) {
      console.error('[Password Reset] No action_link returned');
      // Don't reveal whether the email exists
      return { success: true };
    }

    let resetLink = data.properties.action_link;

    // Replace localhost URLs with production URL (same as invite flow)
    if (resetLink.includes('localhost')) {
      resetLink = resetLink.replace(/https?:\/\/localhost(:\d+)?/gi, siteUrl);
      resetLink = resetLink.replace(/https?%3A%2F%2Flocalhost(%3A\d+)?/gi, encodeURIComponent(siteUrl));
    }

    // Send the email via Resend
    const emailResult = await sendResetEmail({
      email: trimmedEmail,
      resetLink,
    });

    if (!emailResult.success) {
      console.error('[Password Reset] Error sending email:', emailResult.error);
      // Still return success to not reveal email existence
    }

    return { success: true };
  } catch (err) {
    console.error('[Password Reset] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

async function sendResetEmail(params: { email: string; resetLink: string }) {
  const siteUrl = getSiteUrl();
  const subject = 'Reset your password - Affinity Stone Rewards';

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
    <h1 style="color: #92400e; margin: 0 0 10px 0;">Reset Your Password</h1>
    <p style="font-size: 16px; margin: 0; color: #78350f;">We received a request to reset your password.</p>
  </div>
  
  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <p style="margin: 0 0 15px 0;">Hi,</p>
    <p style="margin: 0 0 15px 0;">
      Click the button below to reset your password. This link will expire in 24 hours.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.resetLink}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Reset Password</a>
    </div>
    
    <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 5px 0 0 0; font-size: 12px; color: #2563eb; word-break: break-all;">
      ${params.resetLink}
    </p>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px; color: #666;">
      <strong>Note:</strong> If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
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
Reset Your Password

Hi,

We received a request to reset your password. Click the link below to reset it. This link will expire in 24 hours.

${params.resetLink}

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

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
