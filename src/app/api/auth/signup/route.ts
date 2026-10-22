import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getEmailDeliveryConfig } from '@/lib/email/delivery';
import {
  requestPasswordSignup,
  readSignupInitiator,
  generateToken,
  EmailDeliveryError,
  SIGNUP_INITIATOR_COOKIE,
  VERIFICATION_TOKEN_TTL_MS,
} from '@/lib/auth/passwordSignup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SIGNUP_UNAVAILABLE_MESSAGE = 'Email sign-up is not available right now. Please continue with Google.';
const SIGNUP_ACCEPTED_MESSAGE = 'If this email can be used, a confirmation link is on its way. Open it to finish signing up.';

interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

function validatePayload(body: unknown): SignupPayload {
  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  const password = typeof raw.password === 'string' ? raw.password : '';

  if (!name || name.length > 150) throw new Error('Please enter your name.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  return { name, email, password };
}

export async function POST(request: Request): Promise<NextResponse> {
  const limited = enforceRateLimit(request, 'signup', RATE_LIMITS.signup, {
    message: 'Too many sign-up attempts from this location. Please wait a while and try again.',
  });
  if (limited) return limited;

  const delivery = getEmailDeliveryConfig();
  if (!delivery) {
    return NextResponse.json({ error: SIGNUP_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  let payload: SignupPayload;
  try {
    payload = validatePayload(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid payload.' },
      { status: 400 }
    );
  }

  const initiator = readSignupInitiator(request.headers.get('cookie')) ?? generateToken();

  try {
    await dbConnect();
    await requestPasswordSignup(delivery, payload, initiator);
    const response = NextResponse.json({ success: true, message: SIGNUP_ACCEPTED_MESSAGE }, { status: 202 });
    response.cookies.set(SIGNUP_INITIATOR_COOKIE, initiator, {
      httpOnly: true,
      sameSite: 'lax',
      secure: delivery.appUrl.startsWith('https://'),
      path: '/api/auth',
      maxAge: Math.floor(VERIFICATION_TOKEN_TTL_MS / 1000),
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof EmailDeliveryError) {
      return NextResponse.json(
        { error: 'We could not send a confirmation email right now. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('[/api/auth/signup] Failed to start sign-up:', err instanceof Error ? err.name : 'unknown error');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
