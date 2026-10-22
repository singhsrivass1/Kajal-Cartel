export const DEFAULT_CALLBACK_PATH = '/journey';

const MAX_CALLBACK_LENGTH = 2048;
const PARSE_BASE = 'https://callback.invalid';
const UNSAFE_CHARACTERS = /[\u0000-\u001F\u007F\\]/;

export function toSafeCallbackPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_CALLBACK_LENGTH) return DEFAULT_CALLBACK_PATH;
  if (!raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_CALLBACK_PATH;
  if (UNSAFE_CHARACTERS.test(raw)) return DEFAULT_CALLBACK_PATH;

  let parsed: URL;
  try {
    parsed = new URL(raw, PARSE_BASE);
  } catch {
    return DEFAULT_CALLBACK_PATH;
  }

  if (parsed.origin !== PARSE_BASE) return DEFAULT_CALLBACK_PATH;
  if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) return DEFAULT_CALLBACK_PATH;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
