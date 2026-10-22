import { NextResponse } from 'next/server';

/**
 * In-process fixed-window rate limiting.
 *
 * Deliberately has no external dependency (no Redis, no Upstash) — nothing in this
 * repo provisions that infrastructure, and adding it for a single-admin project
 * would be more operational surface than the risk warrants.
 *
 * KNOWN LIMITATION, by design: counters live in this process's memory. On a
 * serverless/multi-instance deployment each instance keeps its own counters, so the
 * effective ceiling is (limit × instances), and counters reset on cold start. That
 * makes this a real brake on casual abuse and runaway cost, but NOT a hard
 * guarantee against a determined distributed attacker. Moving to a shared store is
 * the upgrade path if this ever needs to be authoritative.
 */

export interface RateLimitRule {
  /** Maximum requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Hard ceiling on tracked keys. Without this, a flood of unique keys (spoofed
 * forwarded-for values, say) would grow the map unboundedly — turning the
 * rate limiter itself into a memory-exhaustion vector.
 */
const MAX_TRACKED_KEYS = 10_000;

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      pruneExpired(now);
      // Still full of live windows — drop the whole map rather than grow without
      // bound. Worst case this forgives some in-flight counters; that is strictly
      // preferable to unbounded memory growth.
      if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, limit: rule.limit, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= rule.limit;

  return {
    allowed,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Derives the client identity for a bucket key.
 *
 * A signed-in user id is preferred: it is server-derived from the session and
 * cannot be spoofed by a header. The IP fallback reads proxy headers, which are
 * only trustworthy when the app sits behind a proxy that sets them (Vercel and
 * most managed hosts do). Direct-to-Node deployments should not rely on the IP
 * path for anything security-critical.
 */
export function clientKey(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim();
  return `ip:${ip || 'unknown'}`;
}

export function rateLimitResponse(result: RateLimitResult, message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

/**
 * Guards a route. Returns a 429 NextResponse when the caller is over the limit,
 * or null when the request may proceed.
 */
export function enforceRateLimit(
  request: Request,
  scope: string,
  rule: RateLimitRule,
  options: { userId?: string | null; message?: string } = {}
): NextResponse | null {
  const key = `${scope}:${clientKey(request, options.userId)}`;
  const result = checkRateLimit(key, rule);
  if (result.allowed) return null;

  console.warn(`[rate-limit] blocked ${key} (limit ${rule.limit}/${rule.windowMs}ms)`);
  return rateLimitResponse(
    result,
    options.message ?? 'Too many requests. Please wait a moment and try again.'
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Per-route limits, tuned to what each route actually costs or risks rather than
 * one blanket number.
 */
export const RATE_LIMITS = {
  /** Real commitments against an artist's calendar. */
  booking: { limit: 10, windowMs: 10 * MINUTE },

  /** Vision-model Gemini call, and reachable without signing in — the largest
   *  uncontrolled spend surface in the app. */
  match: { limit: 12, windowMs: HOUR },

  /** Text-model Gemini call, one per saved-look expansion. */
  moodboardRematch: { limit: 20, windowMs: HOUR },

  /** Writes a base64 image into Mongo; storage cost as much as abuse. */
  moodboardSave: { limit: 20, windowMs: HOUR },

  /** Account creation — strict; abuse here is cheap for an attacker. */
  signup: { limit: 5, windowMs: HOUR },

  /** Sends email and reveals nothing by design, but still costs money per send. */
  passwordResetRequest: { limit: 5, windowMs: HOUR },

  /** Consumes a reset token — strict, since this is a token-guessing surface. */
  passwordResetConsume: { limit: 10, windowMs: HOUR },

  /** Already admin-gated, so this is a backstop against a leaked session rather
   *  than a primary control. Generous enough not to impede real admin work. */
  admin: { limit: 120, windowMs: 10 * MINUTE },

  /** Public, unauthenticated, and hits the DB on every call. Cheap per request,
   *  but unbounded without this. Generous — a bride legitimately re-prices a
   *  booking many times while choosing add-ons. */
  estimate: { limit: 120, windowMs: HOUR },

  /** Low-cost session-scoped writes (save an artist, delete a saved look). */
  generalWrite: { limit: 60, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;
