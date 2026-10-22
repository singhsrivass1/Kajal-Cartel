import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import PendingSignup from '@/lib/db/models/PendingSignup';
import User from '@/lib/db/models/User';
import { sendEmail } from '@/lib/email/delivery';
import type { EmailDeliveryConfig } from '@/lib/email/delivery';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const SIGNUP_INITIATOR_COOKIE = 'kc_signup_initiator';

const TOKEN_RE = /^[a-f0-9]{64}$/;

export class EmailDeliveryError extends Error {
  constructor() {
    super('The verification email could not be sent.');
    this.name = 'EmailDeliveryError';
  }
}

export interface PasswordSignupInput {
  name: string;
  email: string;
  password: string;
}

export type VerificationOutcome = 'verified' | 'invalid';

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

export function readSignupInitiator(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SIGNUP_INITIATOR_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return isWellFormedToken(value) ? value : null;
  }
  return null;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

function buildVerificationEmailHTML(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kajal Cartel — Confirm Your Email</title>
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
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;color:#F0EBE0;">Confirm your email</h1>
            <p style="margin:0;font-size:13px;color:#7A6A5A;line-height:1.7;">
              Confirm this address to finish setting up password sign-in for Kajal Cartel. This link expires in 24 hours and can be used once.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0 32px;">
            <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:#C9A96E;color:#080808;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;font-weight:600;">
              Confirm Email
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;border-top:1px solid #1C1C1C;">
            <p style="margin:0;font-size:11px;color:#3A3530;line-height:1.7;">
              If you didn't request this, you can safely ignore this email — nothing will change.
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

export async function requestPasswordSignup(
  config: EmailDeliveryConfig,
  input: PasswordSignupInput,
  initiator: string
): Promise<void> {
  if (!isWellFormedToken(initiator)) throw new Error('A well-formed signup initiator is required.');
  const passwordHash = await bcrypt.hash(input.password, 12);
  const now = new Date();

  const recent = await PendingSignup.exists({
    email: input.email,
    issuedAt: { $gt: new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS) },
  });
  if (recent) return;

  const token = generateToken();
  const tokenHash = hashToken(token);

  try {
    await PendingSignup.findOneAndUpdate(
      { email: input.email },
      {
        $set: {
          name: input.name,
          passwordHash,
          tokenHash,
          initiatorHash: hashToken(initiator),
          issuedAt: now,
          expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
        },
      },
      { upsert: true, runValidators: true }
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) return;
    throw err;
  }

  try {
    await sendEmail(config, {
      to: input.email,
      subject: 'Confirm your Kajal Cartel email',
      html: buildVerificationEmailHTML(`${config.appUrl}/api/auth/verify-email?token=${token}`),
    });
  } catch {
    await PendingSignup.deleteOne({ email: input.email, tokenHash });
    throw new EmailDeliveryError();
  }
}

async function attachVerifiedPassword(email: string, passwordHash: string, verifiedAt: Date): Promise<boolean> {
  const result = await User.updateOne(
    {
      email,
      $or: [{ passwordHash: { $exists: false } }, { credentialsVerifiedAt: { $exists: false } }],
    },
    { $set: { passwordHash, credentialsVerifiedAt: verifiedAt } }
  );
  return result.matchedCount > 0;
}

async function applyVerifiedSignup(pending: { email: string; name: string; passwordHash: string }): Promise<void> {
  const verifiedAt = new Date();

  if (await attachVerifiedPassword(pending.email, pending.passwordHash, verifiedAt)) return;
  if (await User.exists({ email: pending.email })) return;

  try {
    await User.create({
      name: pending.name,
      email: pending.email,
      emailVerified: verifiedAt,
      passwordHash: pending.passwordHash,
      credentialsVerifiedAt: verifiedAt,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    await attachVerifiedPassword(pending.email, pending.passwordHash, verifiedAt);
  }
}

export async function completePasswordSignup(token: unknown, initiator: unknown): Promise<VerificationOutcome> {
  if (!isWellFormedToken(token) || !isWellFormedToken(initiator)) return 'invalid';

  const pending = await PendingSignup.findOneAndDelete({
    tokenHash: hashToken(token),
    initiatorHash: hashToken(initiator),
    expiresAt: { $gt: new Date() },
  })
    .select('+passwordHash')
    .lean<{ email: string; name: string; passwordHash: string }>();

  if (!pending) return 'invalid';

  await applyVerifiedSignup(pending);
  return 'verified';
}
