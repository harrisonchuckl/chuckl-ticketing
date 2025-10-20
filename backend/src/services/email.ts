// backend/src/services/email.ts
// Sends emails via Resend HTTP API (preferred) or falls back to SMTP (nodemailer) if RESEND_API_KEY is missing.

import nodemailer from 'nodemailer';

type ShowVenue = { name: string; address?: string | null; city?: string | null; postcode?: string | null };
type ShowInfo = { id: string; title: string; date: Date; venue: ShowVenue };
type OrderInfo = { id: string; quantity: number; amountPence: number };

export type TicketRow = { serial: string; qrData: string };

export type SendTicketsArgs = {
  to: string;
  show: ShowInfo;
  order: OrderInfo;
  tickets: TicketRow[];
};

const FROM = process.env.SMTP_FROM || 'Tickets <no-reply@example.com>';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

function formatGBP(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format((pence || 0) / 100);
}

function renderTicketHtml(args: SendTicketsArgs) {
  const { show, order, tickets } = args;
  const when = new Date(show.date).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const venueLine = [show.venue?.name, show.venue?.address, show.venue?.city, show.venue?.postcode].filter(Boolean).join(', ');

  const rows = tickets.map((t, i) => {
    return `
      <tr>
        <td style="padding:8px;border:1px solid #eee;">${i + 1}</td>
        <td style="padding:8px;border:1px solid #eee;font-family:monospace">${t.serial}</td>
        <td style="padding:8px;border:1px solid #eee;">${t.qrData}</td>
      </tr>`;
  }).join('');

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111">
    <h2 style="margin:0 0 8px">Your tickets for <em>${show.title}</em></h2>
    <p style="margin:0 0 10px">${when}${venueLine ? ' — ' + venueLine : ''}</p>
    <p style="margin:0 0 12px">
      Order <strong>${order.id}</strong> • Quantity: <strong>${order.quantity}</strong> • Total: <strong>${formatGBP(order.amountPence)}</strong>
    </p>

    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;width:100%;max-width:640px">
      <thead>
        <tr style="background:#fafafa">
          <th style="text-align:left;padding:8px;border:1px solid #eee;">#</th>
          <th style="text-align:left;padding:8px;border:1px solid #eee;">Serial</th>
          <th style="text-align:left;padding:8px;border:1px solid #eee;">QR data</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="color:#666;margin-top:14px">Show this email at the door. We’ll scan your ticket(s) on entry.</p>
  </div>`;
}

// ---- Resend HTTP API ----
async function sendViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM, to, subject, html })
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Resend API error ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json().catch(() => ({}));
}

// ---- SMTP fallback (only used if no RESEND_API_KEY or Resend fails) ----
function buildSmtpTransport() {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration incomplete (SMTP_HOST/SMTP_USER/SMTP_PASS required)');
  }
  const secure = port === 465; // SMTPS on 465, STARTTLS on 587
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(secure ? {} : { requireTLS: true })
  });
}

// ---- Public helpers used by routes/webhooks ----
export async function sendTestEmail(to: string) {
  const subject = 'Chuckl. test email';
  const html = `<p>Hello! If you received this, your email transport is working ✅</p>`;
  // Prefer Resend
  if (RESEND_API_KEY) return sendViaResend(to, subject, html);
  // Fallback to SMTP
  const tx = buildSmtpTransport();
  return tx.sendMail({ from: FROM, to, subject, html });
}

export async function sendTicketsEmail(args: SendTicketsArgs) {
  const subject = `Your tickets for ${args.show.title}`;
  const html = renderTicketHtml(args);
  if (RESEND_API_KEY) return sendViaResend(args.to, subject, html);
  const tx = buildSmtpTransport();
  return tx.sendMail({ from: FROM, to: args.to, subject, html });
}
