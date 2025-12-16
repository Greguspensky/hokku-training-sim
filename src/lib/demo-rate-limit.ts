import { createClient } from '@supabase/supabase-js';

// Supabase client with service role for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Rate limiting configuration for demo sessions
 */
const RATE_LIMIT_CONFIG = {
  maxSessionsPerHour: 1000, // Increased for testing
  timeWindowMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Check if an IP address has exceeded the rate limit for demo sessions
 *
 * @param ip - Client IP address
 * @returns true if allowed, false if rate limit exceeded
 */
export async function checkDemoRateLimit(ip: string): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_CONFIG.timeWindowMs);

    // Count sessions from this IP in the last hour
    const { count, error } = await supabaseAdmin
      .from('demo_training_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gt('created_at', oneHourAgo.toISOString());

    if (error) {
      console.error('❌ Error checking rate limit:', error);
      // On error, allow the request (fail open for better UX)
      return true;
    }

    const sessionCount = count || 0;
    const isAllowed = sessionCount < RATE_LIMIT_CONFIG.maxSessionsPerHour;

    if (!isAllowed) {
      console.warn(`⚠️ Rate limit exceeded for IP ${ip}: ${sessionCount} sessions in last hour`);
    }

    return isAllowed;
  } catch (err) {
    console.error('❌ Unexpected error in rate limit check:', err);
    // Fail open to avoid blocking legitimate users on unexpected errors
    return true;
  }
}

/**
 * Extract client IP address from Next.js request headers
 * Handles various proxy/CDN scenarios (Vercel, Cloudflare, etc.)
 *
 * @param headers - Request headers
 * @returns Client IP address or 'unknown'
 */
export function extractClientIP(headers: Headers): string {
  // Check various headers for client IP (in order of preference)
  const ipHeaders = [
    'x-real-ip',           // Nginx
    'x-forwarded-for',     // Standard proxy header
    'cf-connecting-ip',    // Cloudflare
    'x-vercel-forwarded-for', // Vercel
    'x-client-ip',         // General
  ];

  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2)
      // Take the first one (original client)
      const ip = value.split(',')[0].trim();
      if (ip && ip !== 'unknown') {
        return ip;
      }
    }
  }

  return 'unknown';
}

/**
 * Get remaining sessions allowed for an IP address
 * Useful for providing feedback to users
 *
 * @param ip - Client IP address
 * @returns Number of sessions remaining (0 if rate limited)
 */
export async function getRemainingDemoSessions(ip: string): Promise<number> {
  try {
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_CONFIG.timeWindowMs);

    const { count, error } = await supabaseAdmin
      .from('demo_training_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gt('created_at', oneHourAgo.toISOString());

    if (error) {
      console.error('❌ Error getting remaining sessions:', error);
      return RATE_LIMIT_CONFIG.maxSessionsPerHour; // Return max on error
    }

    const sessionCount = count || 0;
    const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxSessionsPerHour - sessionCount);

    return remaining;
  } catch (err) {
    console.error('❌ Unexpected error getting remaining sessions:', err);
    return RATE_LIMIT_CONFIG.maxSessionsPerHour; // Return max on error
  }
}

/**
 * Extract user agent from request headers
 *
 * @param headers - Request headers
 * @returns User agent string or 'unknown'
 */
export function extractUserAgent(headers: Headers): string {
  return headers.get('user-agent') || 'unknown';
}

/**
 * Detect device type from user agent
 *
 * @param userAgent - User agent string
 * @returns 'mobile', 'tablet', or 'desktop'
 */
export function detectDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }

  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
    return 'mobile';
  }

  return 'desktop';
}
