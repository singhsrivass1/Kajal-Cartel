import { Resend } from 'resend';

export interface EmailDeliveryConfig {
  apiKey: string;
  from: string;
  appUrl: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
}

function senderDomain(from: string): string | null {
  const match = from.match(/<([^<>\s]+)>\s*$/) ?? from.match(/^([^<>\s]+)$/);
  const address = match?.[1];
  if (!address) return null;
  const at = address.lastIndexOf('@');
  if (at < 1 || at === address.length - 1) return null;
  return address.slice(at + 1).toLowerCase();
}

function appOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getEmailDeliveryConfig(): EmailDeliveryConfig | null {
  if (process.env.EMAIL_DELIVERY_VERIFIED !== 'true') return null;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const appUrl = appOrigin(process.env.NEXTAUTH_URL?.trim());
  if (!apiKey || !from || !appUrl) return null;

  const domain = senderDomain(from);
  if (!domain || domain === 'resend.dev' || domain.endsWith('.resend.dev')) return null;

  return { apiKey, from, appUrl };
}

export function isPasswordAuthEnabled(): boolean {
  return getEmailDeliveryConfig() !== null;
}

export const emailTransport = {
  async send(config: EmailDeliveryConfig, message: OutgoingEmail): Promise<void> {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    });
    if (error) {
      throw new Error(`Email provider rejected the message (${error.name}).`);
    }
  },
};

export async function sendEmail(config: EmailDeliveryConfig, message: OutgoingEmail): Promise<void> {
  await emailTransport.send(config, message);
}
