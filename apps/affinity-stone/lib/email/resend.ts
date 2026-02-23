interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // Check for required env vars
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  
  // Dev mode or missing config - skip sending
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode || !apiKey || !fromEmail) {
    console.log('[Email] Skipped sending (dev mode or missing config):', {
      to: params.to,
      subject: params.subject,
      reason: isDevMode ? 'dev mode' : 'missing config',
    });
    return { success: true, skipped: true };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text || stripHtml(params.html),
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] Failed to send:', error);
      return { 
        success: false, 
        error: `Failed to send email: ${response.status}` 
      };
    }
    
    const data = await response.json();
    console.log('[Email] Sent successfully:', {
      to: params.to,
      subject: params.subject,
      id: data.id,
    });
    
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Simple HTML stripper for text fallback
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_NOTIFICATION_EMAILS;
  if (!emails) return [];
  return emails.split(',').map(e => e.trim()).filter(e => e.length > 0);
}

export function getSiteUrl(): string {
  const fallback = 'https://affinitystonestore.com';

  const normalize = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed.length) return '';

    // Allow passing "example.com" (no protocol) in env vars.
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    const url = new URL(withProtocol);
    // Remove trailing slash for consistent URL joining.
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  };

  const isLocalHostUrl = (raw: string): boolean => {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  };

  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  const isProd = process.env.NODE_ENV === 'production';

  // If we're on Vercel and the explicit site URL is localhost (common after duplicating),
  // ignore it and use the actual deployed domain instead.
  if (vercelUrl && explicit && isLocalHostUrl(explicit)) {
    const normalized = normalize(vercelUrl);
    if (normalized) return normalized;
  }

  if (explicit && !(isProd && isLocalHostUrl(explicit))) {
    const normalized = normalize(explicit);
    if (normalized) return normalized;
  }

  if (vercelUrl) {
    const normalized = normalize(vercelUrl);
    if (normalized) return normalized;
  }

  return fallback;
}
