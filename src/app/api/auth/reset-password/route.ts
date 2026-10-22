import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getEmailDeliveryConfig } from '@/lib/email/delivery';
import { hashToken, isWellFormedToken } from '@/lib/auth/passwordSignup';
import User from '@/lib/db/models/User';

const INVALID_RESET_LINK_MESSAGE = 'This reset link is invalid or has expired. Please request a new one.';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  // Token-guessing surface: an unlimited caller could brute-force reset tokens.
  const limited = enforceRateLimit(request, 'reset-password', RATE_LIMITS.passwordResetConsume, {
    message: 'Too many password reset attempts. Please wait a while and try again.',
  });
  if (limited) return limited;

  if (!getEmailDeliveryConfig()) {
    return NextResponse.json(
      { error: 'Password reset is not available right now. Please continue with Google.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const token = typeof raw.token === 'string' ? raw.token : '';
  const password = typeof raw.password === 'string' ? raw.password : '';

  if (!token) {
    return NextResponse.json({ error: 'Reset token is missing.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!isWellFormedToken(token)) {
    return NextResponse.json({ error: INVALID_RESET_LINK_MESSAGE }, { status: 400 });
  }

  try {
    await dbConnect();

    const passwordHash = await bcrypt.hash(password, 12);
    const consumed = await User.findOneAndUpdate(
      {
        resetPasswordTokenHash: hashToken(token),
        resetPasswordExpires: { $gt: new Date() },
      },
      {
        $set: { passwordHash, credentialsVerifiedAt: new Date() },
        $unset: { resetPasswordTokenHash: 1, resetPasswordExpires: 1 },
      }
    )
      .select('_id')
      .lean();

    if (!consumed) {
      return NextResponse.json({ error: INVALID_RESET_LINK_MESSAGE }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[/api/auth/reset-password] Failed:', err instanceof Error ? err.name : 'unknown error');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
