import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getEmailDeliveryConfig, sendEmail } from '@/lib/email/delivery';
import { generateToken, hashToken } from '@/lib/auth/passwordSignup';
import User from '@/lib/db/models/User';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function buildEmailHTML(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kajal Cartel — Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;min-height:100vh;">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr>
          <td style="padding-bottom:40px;border-bottom:1px solid #1C1C1C;">
            <p style="margin:0;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#C9A96E;">KAJAL CARTEL</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 0 20px;">
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;color:#F0EBE0;">Reset your password</h1>
            <p style="margin:0;font-size:13px;color:#7A6A5A;line-height:1.7;">
              We received a request to reset the password for your Kajal Cartel account. This link expires in 30 minutes.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0 32px;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#C9A96E;color:#080808;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;font-weight:600;">
              Reset Password
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;border-top:1px solid #1C1C1C;">
            <p style="margin:0;font-size:11px;color:#3A3530;line-height:1.7;">
              If you didn't request this, you can safely ignore this email — your password will not be changed.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export async function POST(request: Request): Promise<NextResponse> {
  // This route deliberately returns the same response whether or not the account
  // exists, so it leaks nothing — but each call still sends an email, which costs
  // money and can be used to spam a third party's inbox.
  const limited = enforceRateLimit(request, 'forgot-password', RATE_LIMITS.passwordResetRequest, {
    message: 'Too many password reset requests from this location. Please wait a while and try again.',
  });
  if (limited) return limited;

  const delivery = getEmailDeliveryConfig();
  if (!delivery) {
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
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // Always respond with the same success message, regardless of whether the
  // account exists, to avoid leaking which emails are registered.
  const genericResponse = NextResponse.json(
    { success: true, message: 'If an account exists for that email, a reset link is on its way.' },
    { status: 200 }
  );

  try {
    await dbConnect();
    const user = await User.findOne({ email }).select('_id email').lean<{ _id: unknown; email: string }>();

    if (user) {
      const token = generateToken();

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            resetPasswordTokenHash: hashToken(token),
            resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        }
      );

      try {
        await sendEmail(delivery, {
          to: user.email,
          subject: 'Reset your Kajal Cartel password',
          html: buildEmailHTML(`${delivery.appUrl}/auth/reset-password?token=${token}`),
        });
      } catch (emailErr) {
        console.error(
          '[/api/auth/forgot-password] Reset email failed:',
          emailErr instanceof Error ? emailErr.name : 'unknown error'
        );
      }
    }
  } catch (err) {
    console.error('[/api/auth/forgot-password] Failed:', err instanceof Error ? err.name : 'unknown error');
  }

  return genericResponse;
}
