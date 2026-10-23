import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin';
import { dbConnect } from '@/lib/db/connect';
import { VendorAdminError } from '@/lib/db/controllers/VendorAdminManager';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';

/**
 * Wraps an admin-only handler: enforces the database-backed admin role check, applies a
 * backstop rate limit, connects to the DB, and maps VendorAdminError to its own
 * status code. Authorization is enforced here on the server for every admin route —
 * the admin UI's own guards are convenience only and are never the security boundary.
 *
 * `request` is optional only so that no-argument handlers (route GETs that take no
 * Request) stay ergonomic; when omitted the rate limit keys on the admin session id
 * alone, which is still a stable per-identity key.
 */
export async function withAdmin<T>(
  handler: () => Promise<T>,
  logLabel: string,
  request?: Request
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const adminId = (session.user as { id?: string } | undefined)?.id ?? session.user?.email ?? 'admin';
  const limited = enforceRateLimit(
    request ?? new Request('http://internal/admin'),
    'admin',
    RATE_LIMITS.admin,
    { userId: adminId }
  );
  if (limited) return limited;

  try {
    await dbConnect();
    const result = await handler();
    return NextResponse.json(result ?? { success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof VendorAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof Error && (err.name === 'ReviewError' || err.name === 'BookingValidationError')) {
      const status = (err as { statusCode?: unknown }).statusCode;
      if (typeof status === 'number' && status >= 400 && status < 600) {
        return NextResponse.json({ error: err.message }, { status });
      }
    }
    console.error(`[${logLabel}] Unhandled error:`, err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new VendorAdminError('Request body must be a JSON object.');
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof VendorAdminError) throw err;
    throw new VendorAdminError('Request body must be valid JSON.');
  }
}
