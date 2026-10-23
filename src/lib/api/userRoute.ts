import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Types } from 'mongoose';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit } from '@/lib/api/rateLimit';
import type { RateLimitRule } from '@/lib/api/rateLimit';

const KNOWN_ERROR_NAMES = new Set([
  'BookingValidationError',
  'ReviewError',
  'MoodboardValidationError',
  'ProfileError',
  'BoardError',
  'VendorAdminError',
]);

export class RequestBodyError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'RequestBodyError';
  }
}

function knownErrorStatus(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  if (!KNOWN_ERROR_NAMES.has(err.name) && !(err instanceof RequestBodyError)) return null;
  const status = (err as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 600 ? status : null;
}

export interface UserContext {
  userId: string;
  email: string | null;
}

export async function getSessionUserId(): Promise<UserContext | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: unknown } | undefined)?.id;
  if (!session?.user || typeof id !== 'string' || !Types.ObjectId.isValid(id)) return null;
  return { userId: id, email: session.user.email ?? null };
}

export async function withUser<T>(
  request: Request,
  logLabel: string,
  handler: (user: UserContext) => Promise<T>,
  rateLimit?: { scope: string; rule: RateLimitRule; message?: string }
): Promise<NextResponse> {
  const user = await getSessionUserId();
  if (!user) {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  }

  if (rateLimit) {
    const limited = enforceRateLimit(request, rateLimit.scope, rateLimit.rule, {
      userId: user.userId,
      message: rateLimit.message,
    });
    if (limited) return limited;
  }

  try {
    await dbConnect();
    const result = await handler(user);
    return NextResponse.json(result ?? { success: true }, { status: 200 });
  } catch (err) {
    const status = knownErrorStatus(err);
    if (status !== null) {
      return NextResponse.json({ error: (err as Error).message }, { status });
    }
    console.error(`[${logLabel}] Unhandled error:`, err);
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new RequestBodyError('Request body must be valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestBodyError('Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}
