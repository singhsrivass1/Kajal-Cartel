const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

export interface SupportContact {
  email: string | null;
  phone: string | null;
}

export function getSupportContact(): SupportContact {
  const email = process.env.SUPPORT_EMAIL?.trim() ?? '';
  const phone = process.env.SUPPORT_PHONE?.trim() ?? '';
  return {
    email: EMAIL_RE.test(email) ? email : null,
    phone: PHONE_RE.test(phone) ? phone : null,
  };
}

export function getSiteUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || '';
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1' ? url : null;
  } catch {
    return null;
  }
}
