import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface BookingPayload {
  artistSlug: string;
  artistName: string;
  anchorServiceName: string;
  lineItems: Array<{
    name: string;
    quantity: number;
    subtotalINR: number;
    discountLabel?: string;
  }>;
  totalINR: number;
  depositINR: number;
}

function generateRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'KC-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function buildEmailHTML(payload: BookingPayload, ref: string, userEmail: string): string {
  const lineItemRows = payload.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1C1C1C;font-size:13px;color:#C8B9A8;">
          ${item.quantity > 1 ? `${item.quantity}× ` : ''}${item.name}
          ${item.discountLabel ? `<br><span style="font-size:11px;color:#C9A96E;">↳ ${item.discountLabel}</span>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #1C1C1C;font-size:13px;color:#F0EBE0;text-align:right;">
          ${formatINR(item.subtotalINR)}
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kajal Cartel — Booking Request</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;min-height:100vh;">
  <tr>
    <td align="center" style="padding:48px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <tr>
          <td style="padding-bottom:40px;border-bottom:1px solid #1C1C1C;">
            <p style="margin:0;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#C9A96E;">
              KAJAL CARTEL
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 0 24px;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#454140;">
              New Booking Request
            </p>
            <h1 style="margin:0;font-size:32px;font-weight:400;color:#F0EBE0;line-height:1.15;">
              ${payload.artistName}
            </h1>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 24px;background:#0C0C0C;border:1px solid #1C1C1C;margin-bottom:24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;padding-bottom:14px;">
                  Reference
                </td>
                <td style="font-size:14px;color:#C9A96E;text-align:right;font-family:'Courier New',monospace;padding-bottom:14px;letter-spacing:0.1em;">
                  ${ref}
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;padding-bottom:14px;">
                  Artist Slug
                </td>
                <td style="font-size:13px;color:#C8B9A8;text-align:right;padding-bottom:14px;">
                  ${payload.artistSlug}
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;padding-bottom:14px;">
                  Primary Look
                </td>
                <td style="font-size:13px;color:#C8B9A8;text-align:right;padding-bottom:14px;">
                  ${payload.anchorServiceName}
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;">
                  Client Email
                </td>
                <td style="font-size:13px;color:#C8B9A8;text-align:right;">
                  ${userEmail}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:20px;"></td></tr>

        <tr>
          <td style="padding:20px 24px;background:#0C0C0C;border:1px solid #1C1C1C;">
            <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#3A3530;">
              Booking Summary
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${lineItemRows}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #2A2520;padding-top:16px;">
              <tr>
                <td style="font-size:15px;color:#F0EBE0;font-weight:400;">Total Estimate</td>
                <td style="font-size:15px;color:#F0EBE0;text-align:right;">${formatINR(payload.totalINR)}</td>
              </tr>
              <tr>
                <td style="font-size:11px;color:#454140;padding-top:8px;letter-spacing:0.1em;text-transform:uppercase;">
                  Deposit Required (30%)
                </td>
                <td style="font-size:13px;color:#7A6A5A;text-align:right;padding-top:8px;">${formatINR(payload.depositINR)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:32px;"></td></tr>

        <tr>
          <td style="padding:20px 24px;border:1px solid #1C1C1C;border-left:2px solid #C9A96E;">
            <p style="margin:0;font-size:13px;color:#5A5450;line-height:1.75;">
              Reply directly to the client at <a href="mailto:${userEmail}" style="color:#C9A96E;text-decoration:none;">${userEmail}</a> to confirm availability and proceed with the deposit. The client has been informed that the artist typically responds within 24 hours.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 0 0;border-top:1px solid #1C1C1C;margin-top:40px;">
            <p style="margin:0;font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:#2A2620;text-align:center;">
              Kajal Cartel · New Delhi · Bridal Beauty Platform
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

function validatePayload(body: unknown): BookingPayload {
  const raw = body as Record<string, unknown>;
  if (!raw.artistSlug || typeof raw.artistSlug !== 'string') throw new Error('artistSlug required');
  if (!raw.artistName || typeof raw.artistName !== 'string') throw new Error('artistName required');
  if (!raw.anchorServiceName || typeof raw.anchorServiceName !== 'string') throw new Error('anchorServiceName required');
  if (!Array.isArray(raw.lineItems) || raw.lineItems.length === 0) throw new Error('lineItems required');
  if (typeof raw.totalINR !== 'number' || raw.totalINR <= 0) throw new Error('totalINR required');
  if (typeof raw.depositINR !== 'number' || raw.depositINR <= 0) throw new Error('depositINR required');
  return raw as unknown as BookingPayload;
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userEmail = (session?.user as { email?: string })?.email ?? 'guest@kajalcartel.in';

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  let payload: BookingPayload;
  try {
    payload = validatePayload(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid payload.' },
      { status: 400 }
    );
  }

  const ref = generateRef();

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@kajalcartel.in';
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [adminEmail],
        replyTo: userEmail,
        subject: `New Booking Request · ${payload.artistName} · ${ref}`,
        html: buildEmailHTML(payload, ref, userEmail),
      });
      console.info(`[/api/book] Booking email sent. Ref: ${ref}, Artist: ${payload.artistSlug}`);
    } catch (emailErr) {
      console.error('[/api/book] Resend email failed:', emailErr);
    }
  } else {
    console.warn('[/api/book] RESEND_API_KEY not set — email skipped. Ref:', ref);
  }

  if (session?.user) {
    try {
      await dbConnect();
      const User = (await import('@/lib/db/models/User')).default;
      await User.findOneAndUpdate(
        { email: userEmail },
        {
          $push: {
            matchHistory: {
              $each: [],
            },
          },
        },
        { upsert: false }
      );
    } catch (dbErr) {
      console.error('[/api/book] DB update failed:', dbErr);
    }
  }

  return NextResponse.json({ ref, success: true }, { status: 200 });
}