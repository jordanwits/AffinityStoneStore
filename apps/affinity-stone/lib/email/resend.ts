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

  const parse = (raw: string): URL | null => {
    const trimmed = raw.trim();
    if (!trimmed.length) return null;
    try {
      // Allow passing "example.com" (no protocol) in env vars.
      return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      return null;
    }
  };

  const normalize = (url: URL): string =>
    // Remove trailing slash for consistent URL joining.
    `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');

  const isLocalHost = (url: URL): boolean =>
    url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Vercel's own hostnames sit behind deployment protection, so a customer
  // following a link to one lands on a Vercel login screen instead of the store.
  const isVercelHost = (url: URL): boolean =>
    url.hostname === 'vercel.app' || url.hostname.endsWith('.vercel.app');

  const isProd = process.env.NODE_ENV === 'production';

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    // Vercel's stable production alias — only usable once a custom domain is
    // attached to the project, which the isVercelHost check enforces.
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = parse(candidate);
    if (!url) continue;
    if (isVercelHost(url)) continue;
    if (isProd && isLocalHost(url)) continue;
    return normalize(url);
  }

  return fallback;
}
