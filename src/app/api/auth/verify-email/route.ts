import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getEmailDeliveryConfig } from '@/lib/email/delivery';
import { completePasswordSignup, readSignupInitiator, SIGNUP_INITIATOR_COOKIE } from '@/lib/auth/passwordSignup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function redirectTo(path: string, base: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, base), 303);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, 'verify-email', RATE_LIMITS.passwordResetConsume, {
    message: 'Too many confirmation attempts. Please wait a while and try again.',
  });
  if (limited) return limited;

  const delivery = getEmailDeliveryConfig();
  if (!delivery) {
    return redirectTo('/auth?verification=unavailable', request.url);
  }

  const token = new URL(request.url).searchParams.get('token');
  const initiator = readSignupInitiator(request.headers.get('cookie'));

  try {
    await dbConnect();
    const outcome = await completePasswordSignup(token, initiator);
    if (outcome !== 'verified') return redirectTo('/auth?verification=failed', delivery.appUrl);

    const response = redirectTo('/auth?verified=1', delivery.appUrl);
    response.cookies.set(SIGNUP_INITIATOR_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/api/auth', maxAge: 0 });
    return response;
  } catch (err) {
    console.error('[/api/auth/verify-email] Verification failed:', err instanceof Error ? err.name : 'unknown error');
    return redirectTo('/auth?verification=failed', delivery.appUrl);
  }
}
