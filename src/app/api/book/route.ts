import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { Resend } from 'resend';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dbConnect } from '@/lib/db/connect';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { createBooking, BookingValidationError } from '@/lib/db/controllers/BookingManager';
import type { CreateBookingRequest } from '@/lib/db/controllers/BookingManager';
import type { AddOnRequest } from '@/lib/db/controllers/ServiceManager';
import type { EstimateLineItem } from '@/types/artist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Types.ObjectId.isValid(value);
}

function validatePayload(body: unknown): CreateBookingRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BookingValidationError('Request body must be a JSON object.');
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.artistSlug !== 'string' || !raw.artistSlug) {
    throw new BookingValidationError('artistSlug is required.');
  }
  if (!isValidObjectId(raw.anchorServiceId)) {
    throw new BookingValidationError('anchorServiceId must be a valid service ID.');
  }
  if (raw.addOns !== undefined && !Array.isArray(raw.addOns)) {
    throw new BookingValidationError('addOns must be an array.');
  }

  const addOnsRaw = Array.isArray(raw.addOns) ? raw.addOns : [];
  if (addOnsRaw.length > 20) {
    throw new BookingValidationError('addOns cannot contain more than 20 items.');
  }

  const addOns: AddOnRequest[] = [];
  for (const [i, item] of addOnsRaw.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new BookingValidationError(`addOns[${i}] must be an object with serviceId and quantity.`);
    }
    const entry = item as Record<string, unknown>;
    if (!isValidObjectId(entry.serviceId)) {
      throw new BookingValidationError(`addOns[${i}].serviceId must be a valid service ID.`);
    }
    if (
      typeof entry.quantity !== 'number' ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > 50
    ) {
      throw new BookingValidationError(`addOns[${i}].quantity must be a positive integer between 1 and 50.`);
    }
    addOns.push({ serviceId: entry.serviceId as string, quantity: entry.quantity });
  }

  if (typeof raw.date !== 'string' || !raw.date) {
    throw new BookingValidationError('date is required (YYYY-MM-DD).');
  }
  if (typeof raw.slotStart !== 'string' || !raw.slotStart) {
    throw new BookingValidationError('slotStart is required. Please select a time slot.');
  }
  if (!raw.contactInfo || typeof raw.contactInfo !== 'object' || Array.isArray(raw.contactInfo)) {
    throw new BookingValidationError('contactInfo is required.');
  }
  const contact = raw.contactInfo as Record<string, unknown>;
  if (typeof contact.name !== 'string' || typeof contact.phone !== 'string' || typeof contact.email !== 'string') {
    throw new BookingValidationError('contactInfo.name, contactInfo.phone, and contactInfo.email are all required.');
  }
  if (typeof raw.idempotencyKey !== 'string' || !raw.idempotencyKey) {
    throw new BookingValidationError('idempotencyKey is required.');
  }

  return {
    artistSlug: raw.artistSlug,
    anchorServiceId: raw.anchorServiceId,
    addOns,
    date: raw.date,
    slotStart: raw.slotStart,
    contactInfo: { name: contact.name, phone: contact.phone, email: contact.email },
    customerNotes: typeof raw.customerNotes === 'string' ? raw.customerNotes : undefined,
    idempotencyKey: raw.idempotencyKey,
  };
}

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHTML(raw: {
  ref: string;
  vendorName: string;
  anchorServiceName: string;
  lineItems: EstimateLineItem[];
  total: number;
  depositAmount: number;
  date: string;
  startTime: string;
  endTime: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  customerNotes?: string;
}): string {
  return buildEscapedEmailHTML({
    ...raw,
    ref: escapeHtml(raw.ref),
    vendorName: escapeHtml(raw.vendorName),
    anchorServiceName: escapeHtml(raw.anchorServiceName),
    lineItems: raw.lineItems.map((item) => ({
      ...item,
      name: escapeHtml(item.name),
      discountLabel: item.discountLabel ? escapeHtml(item.discountLabel) : undefined,
    })),
    date: escapeHtml(raw.date),
    startTime: escapeHtml(raw.startTime),
    endTime: escapeHtml(raw.endTime),
    contactName: escapeHtml(raw.contactName),
    contactEmail: escapeHtml(raw.contactEmail),
    contactPhone: escapeHtml(raw.contactPhone),
    customerNotes: raw.customerNotes ? escapeHtml(raw.customerNotes) : undefined,
  });
}

function buildEscapedEmailHTML(params: {
  ref: string;
  vendorName: string;
  anchorServiceName: string;
  lineItems: EstimateLineItem[];
  total: number;
  depositAmount: number;
  date: string;
  startTime: string;
  endTime: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  customerNotes?: string;
}): string {
  const lineItemRows = params.lineItems
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
              ${params.vendorName}
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
                  ${params.ref}
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;padding-bottom:14px;">
                  Date &amp; Time
                </td>
                <td style="font-size:13px;color:#C8B9A8;text-align:right;padding-bottom:14px;">
                  ${params.date} · ${params.startTime}–${params.endTime}
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;padding-bottom:14px;">
                  Primary Look
                </td>
                <td style="font-size:13px;color:#C8B9A8;text-align:right;padding-bottom:14px;">
                  ${params.anchorServiceName}
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;padding-bottom:14px;">
                  Client
                </td>
                <td style="font-size:13px;color:#C8B9A8;text-align:right;padding-bottom:14px;">
                  ${params.contactName} · ${params.contactPhone}
                </td>
              </tr>
              <tr>
                <td style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#3A3530;">
                  Client Email
                </td>
                <td style="font-size:13px;color:#C8B9A8;text-align:right;">
                  ${params.contactEmail}
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
                <td style="font-size:15px;color:#F0EBE0;text-align:right;">${formatINR(params.total)}</td>
              </tr>
              <tr>
                <td style="font-size:11px;color:#454140;padding-top:8px;letter-spacing:0.1em;text-transform:uppercase;">
                  Deposit Required (30%)
                </td>
                <td style="font-size:13px;color:#7A6A5A;text-align:right;padding-top:8px;">${formatINR(params.depositAmount)}</td>
              </tr>
            </table>
            ${
              params.customerNotes
                ? `<p style="margin:16px 0 0;font-size:12px;color:#7A6A5A;line-height:1.6;">Note from client: ${params.customerNotes}</p>`
                : ''
            }
          </td>
        </tr>

        <tr><td style="height:32px;"></td></tr>

        <tr>
          <td style="padding:20px 24px;border:1px solid #1C1C1C;border-left:2px solid #C9A96E;">
            <p style="margin:0;font-size:13px;color:#5A5450;line-height:1.75;">
              Reply directly to the client at <a href="mailto:${params.contactEmail}" style="color:#C9A96E;text-decoration:none;">${params.contactEmail}</a> to confirm and proceed with the deposit.
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

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || !userId) {
    return NextResponse.json(
      { error: 'You must be signed in to request a booking.' },
      { status: 401 }
    );
  }

  const limited = enforceRateLimit(request, 'booking', RATE_LIMITS.booking, {
    userId,
    message: 'You have sent several booking requests in a short time. Please wait a few minutes before sending another.',
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  let payload: CreateBookingRequest;
  try {
    payload = validatePayload(body);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const result = await createBooking(userId, payload);

    if (result.created && result.vendorName && result.lineItems) {
      const resendKey = process.env.RESEND_API_KEY;
      const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@kajalcartel.in';

      if (resendKey) {
        try {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: [adminEmail],
            replyTo: payload.contactInfo.email,
            subject: `New Booking Request · ${result.vendorName} · ${result.ref}`,
            html: buildEmailHTML({
              ref: result.ref,
              vendorName: result.vendorName,
              anchorServiceName: result.anchorServiceName ?? '',
              lineItems: result.lineItems,
              total: result.total,
              depositAmount: result.depositAmount,
              date: result.date,
              startTime: result.startTime,
              endTime: result.endTime,
              contactName: payload.contactInfo.name,
              contactEmail: payload.contactInfo.email,
              contactPhone: payload.contactInfo.phone,
              customerNotes: payload.customerNotes,
            }),
          });
          console.info(`[/api/book] Booking email sent. Ref: ${result.ref}, Booking: ${result.bookingId}`);
        } catch (emailErr) {
          console.error('[/api/book] Resend email failed (booking already saved):', emailErr);
        }
      } else {
        console.warn('[/api/book] RESEND_API_KEY not set — email skipped. Ref:', result.ref);
      }
    }

    return NextResponse.json(
      {
        bookingId: result.bookingId,
        ref: result.ref,
        status: result.status,
        date: result.date,
        startTime: result.startTime,
        endTime: result.endTime,
        total: result.total,
        depositAmount: result.depositAmount,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[POST /api/book] Unhandled error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while creating the booking.' },
      { status: 500 }
    );
  }
}
