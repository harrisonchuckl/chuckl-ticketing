import { buildTicketsPdf } from './pdf.js';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

type VenueInfo = {
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
};

type ShowInfo = {
  id: string;
  title: string;
  date: Date;
  venue: VenueInfo | null;
};

type OrderBrief = {
  id: string;
  quantity: number;
  amountPence: number;
};

type TicketInfo = {
  serial: string;
  qrData: string;
};

const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  'Chuckl. Tickets <tickets@chuckl.co.uk>';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

function htmlBody(show: ShowInfo, order: OrderBrief, tickets: TicketInfo[]) {
  const dateStr = new Date(show.date).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const venueLines = [
    show.venue?.name,
    show.venue?.address,
    [show.venue?.city, show.venue?.postcode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('<br/>');

  const list = tickets.map(t => `<li><code>${t.serial}</code></li>`).join('');

  return `
  <div style="font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;">
    <h2>Your Chuckl. tickets</h2>
    <p>Thanks for your order <strong>${order.id}</strong>. Your tickets are attached as a PDF.</p>
    <h3>${show.title}</h3>
    <p>${dateStr}<br/>${venueLines || 'Venue TBC'}</p>
    <p>Tickets (${tickets.length}):</p>
    <ul>${list}</ul>
    <p>Show this PDF at the door. Each page contains a QR code for one ticket.</p>
  </div>
  `;
}

async function sendViaResend(to: string, subject: string, html: string, pdf?: Buffer) {
  const resend = new Resend(RESEND_API_KEY);
  const attachments = pdf
    ? [{ content: pdf.toString('base64'), filename: 'tickets.pdf' }]
    : undefined;

  const result = await resend.emails.send({
    from: EMAIL_FROM, // must be a verified sender in Resend
    to,
    subject,
    html,
    attachments,
  });
  return result;
}

async function sendViaSmtp(to: string, subject: string, html: string, pdf?: Buffer) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    attachments: pdf
      ? [{ filename: 'tickets.pdf', content: pdf, contentType: 'application/pdf' }]
      : undefined,
  });

  return { id: info.messageId };
}

/** Send tickets with attached PDF (used by webhook + admin resend) */
export async function sendTicketsEmail(args: {
  to: string;
  show: ShowInfo;
  order: OrderBrief;
  tickets: TicketInfo[];
}) {
  const { to, show, order, tickets } = args;
  const pdf = await buildTicketsPdf({ show, order, tickets });
  const subject = `Your tickets – ${show.title}`;
  const html = htmlBody(show, order, tickets);

  if (RESEND_API_KEY) return await sendViaResend(to, subject, html, pdf);
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    return await sendViaSmtp(to, subject, html, pdf);

  throw new Error('No email provider configured (RESEND_API_KEY or SMTP_* required)');
}

/** Simple connectivity test without PDF (admin/test endpoint expects this) */
export async function sendTestEmail(to: string) {
  const subject = 'Chuckl. test email';
  const html = `<div style="font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;">
    <h2>Test email</h2><p>If you can read this, your email provider is working.</p>
  </div>`;

  if (RESEND_API_KEY) return await sendViaResend(to, subject, html);
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    return await sendViaSmtp(to, subject, html);

  throw new Error('No email provider configured (RESEND_API_KEY or SMTP_* required)');
}
