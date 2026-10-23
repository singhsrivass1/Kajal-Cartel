export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiRequestError('We could not reach the server. Check your connection and try again.', 0);
  }

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    throw new SessionExpiredError(typeof data.error === 'string' ? data.error : undefined);
  }
  if (!response.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : response.status === 429
        ? 'Too many requests. Please wait a moment and try again.'
        : 'Something went wrong. Please try again.';
    throw new ApiRequestError(message, response.status);
  }
  return data as T;
}

export function signInHref(callbackPath: string): string {
  return `/auth?callbackUrl=${encodeURIComponent(callbackPath)}`;
}
