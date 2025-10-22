// backend/src/services/email.ts
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { buildTicketsPdf } from './pdf.js';

type VenueInfo = {
  name: string;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
};

type ShowInfo = {
  id: string;
  title: string;
  date: Date | string;
  venue: VenueInfo;
};

type TicketLite = {
  serial: string;
  qrData: string;
};

type OrderLite = {
  id: string;
  quantity: number;
  amountPence: number;
};

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === '1';
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  'Chuckl. Tickets <tickets@chuckl.co.uk>'; // must be a verified sender for Resend
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();

// ============== RESEND ==============
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  try {
    return new Resend(key);
  } catch {
    return null;
  }
}

async function sendWithResend(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const resend = getResend();
  if (!resend) throw new Error('RESEND_API_KEY missing');

  const res = await resend.emails.send({
    from: EMAIL_FROM, // must match a verified domain or on-behalf-of policy
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: (opts.attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content, // Buffer supported
      contentType: a.contentType || 'application/octet-stream',
    })),
  });

  if ((res as any).error) {
    throw new Error(`Resend API error: ${(res as any).error?.message || 'unknown'}`);
  }
  return res;
}

// ============== SMTP (fallback) ==============
function getSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendWithSmtp(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const t = getSmtpTransport();
  if (!t) throw new Error('SMTP not configured');

  const info = await t.sendMail({
    from: EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: (opts.attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || 'application/octet-stream',
    })),
  });
  return info;
}

// ============== PUBLIC API ==============
export async function sendTicketsEmail(opts: {
  to: string;
  show: ShowInfo;
  order: OrderLite;
  tickets: { serial: string; qrData: string }[];
}) {
  if (!EMAIL_ENABLED) {
    console.log('📭 EMAIL_ENABLED != 1 → skipping email send');
    return { ok: false, skipped: true };
  }

  const { to, show, order, tickets } = opts;

  // Build the PDF (one page per ticket)
  const pdfBuffer = await buildTicketsPdf({
    show,
    tickets,
    order,
    brand: {
      brandName: 'Chuckl. Tickets',
      primaryHex: '#4f46e5',
      accentHex: '#151823',
      textHex: '#0b0b10',
    },
  });

  const subject = `Your tickets for ${show.title}`;
  const currencyFmt = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });

  const showDate =
    typeof show.date === 'string' ? new Date(show.date) : show.date;
  const showDateStr = showDate.toLocaleString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;color:#111">
    <h2 style="margin:0 0 6px">Your tickets for <strong>${escapeHtml(
      show.title
    )}</strong></h2>
    <p style="margin:0 0 4px">${escapeHtml(show.venue.name)}</p>
    <p style="margin:0 0 4px">${escapeHtml(showDateStr)}</p>
    <p style="margin:0 0 10px">Order <code>${escapeHtml(order.id)}</code> • ${
    order.quantity
  } ticket${order.quantity > 1 ? 's' : ''} • ${currencyFmt.format(
    order.amountPence / 100
  )}</p>

    <p style="margin:16px 0 10px">Your PDF ticket(s) are attached—one page per ticket with a scannable QR code.</p>
    <p style="margin:0;color:#666">Tip: You can print them or show them on your phone at the door.</p>
  </div>`.trim();

  const attachments = [
    { filename: `tickets-${order.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
  ];

  if (EMAIL_PROVIDER === 'resend') {
    return await sendWithResend({ to, subject, html, attachments });
  }
  return await sendWithSmtp({ to, subject, html, attachments });
}

export async function sendTestEmail(to: string) {
  if (!EMAIL_ENABLED) {
    console.log('📭 EMAIL_ENABLED != 1 → skipping test email');
    return { ok: false, skipped: true };
  }
  // Small 1-page dummy PDF to prove the attachment path
  const pdf = await buildTicketsPdf({
    show: {
      id: 'test',
      title: 'Chuckl. Test Show',
      date: new Date(Date.now() + 7 * 86400000),
      venue: { name: 'Test Venue', address: '123 High Street', city: 'Littleport', postcode: 'CB6 1RA' },
    },
    order: { id: 'order_test', quantity: 1, amountPence: 1000 },
    tickets: [{ serial: 'TESTSERIAL1234', qrData: 'chuckl:TESTSERIAL1234' }],
  });

  const html = `<p>Test email from Chuckl. Ticketing.</p><p>PDF ticket attached.</p>`;

  const attachments = [{ filename: 'test-ticket.pdf', content: pdf, contentType: 'application/pdf' }];

  if (EMAIL_PROVIDER === 'resend') {
    return await sendWithResend({
      to,
      subject: 'Test – Chuckl. Ticketing',
      html,
      attachments,
    });
  }
  return await sendWithSmtp({
    to,
    subject: 'Test – Chuckl. Ticketing',
    html,
    attachments,
  });
}

// ——— utils ———
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
