// backend/src/services/email.ts
import { buildTicketsPdf } from './pdf.js';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

/** Exported so other modules (e.g. webhook.ts) can import the shared type */
export type VenueInfo = {
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
};

/** Exported type used by pdf + webhook */
export type ShowInfo = {
  id: string;
  title: string;
  date: Date;
  venue: VenueInfo | null;
};

type TicketInfo = { id?: string; serial: string; status?: 'VALID' | 'USED' };

/** Utility to render a nice one-line show descriptor */
function formatShowLine(show: ShowInfo): string {
  const d = new Date(show.date);
  const when = d.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const v = show.venue ?? { name: null, address: null, city: null, postcode: null };
  const venueBits = [v.name, v.address, v.city, v.postcode].filter(Boolean).join(', ');
  return `${show.title} – ${when}${venueBits ? ' @ ' + venueBits : ''}`;
}

/** Choose email transport: RESEND if available, else SMTP via SMTP_URL, else console fallback */
function getEmailProvider() {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    return {
      name: 'resend',
      async send(opts: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }) {
        const attachments = (opts.attachments || []).map(a => ({
          filename: a.filename,
          content: a.content.toString('base64'),
          encoding: 'base64'
        }));
        const r = await resend.emails.send({
          from: process.env.EMAIL_FROM ?? 'tickets@chuckl.co.uk',
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          attachments
        });
        return r;
      }
    };
  }

  const smtpUrl = process.env.SMTP_URL;
  if (smtpUrl) {
    const tx = nodemailer.createTransport(smtpUrl);
    return {
      name: 'smtp',
      async send(opts: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }) {
        return tx.sendMail({
          from: process.env.EMAIL_FROM ?? 'tickets@chuckl.co.uk',
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments
        });
      }
    };
  }

  // Fallback: log only
  return {
    name: 'console',
    async send(opts: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }) {
      /* eslint-disable no-console */
      console.log('EMAIL(FALLBACK):', {
        to: opts.to,
        subject: opts.subject,
        htmlPreview: opts.html?.slice(0, 200) + '…',
        attachments: (opts.attachments || []).map(a => a.filename)
      });
      return { ok: true };
    }
  };
}

/** Generic email helper (reused by password reset + other transactional emails) */
export async function sendEmail(opts: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }) {
  const provider = getEmailProvider();
  const result = await provider.send(opts);
  return { ok: true, provider: provider.name, result };
}

/** Sends a simple test email (used by /admin/email/test) */
export async function sendTestEmail(to: string) {
  const subject = 'Chuckl. Tickets – Test Email';
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;">
    <h2>Test email from Chuckl. backend</h2>
    <p>Provider: <code>${getEmailProvider().name}</code></p>
    <p>If you received this, email is configured 👍</p>
  </div>`;
  return sendEmail({ to, subject, html });
}

/** Sends order confirmation with optional PDF tickets attachment (enabled by EMAIL_ATTACH_PDF=1) */
export async function sendTicketsEmail(to: string, show: ShowInfo, tickets: TicketInfo[]) {
  const subject = `Your Chuckl. Tickets – ${show.title}`;
  const intro = formatShowLine(show);
  const list = tickets.map(t => `<li><code>${t.serial}</code> (${t.status ?? 'VALID'})</li>`).join('');

  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;">
    <h2>Thanks – your order is confirmed 🎉</h2>
    <p>${intro}</p>
    <p>Ticket serials:</p>
    <ul>${list}</ul>
    <p>Show this email or the attached PDF at the door. Each serial is a unique entry code.</p>
    <p style="color:#888">If you didn’t expect this email, contact support.</p>
  </div>`;

  let attachments: { filename: string; content: Buffer }[] = [];
  if (process.env.EMAIL_ATTACH_PDF === '1') {
    const pdf = await buildTicketsPdf(show, tickets);
    attachments.push({ filename: `tickets-${show.id}.pdf`, content: pdf });
  }

  return sendEmail({ to, subject, html, attachments });
}

/** 🔐 Password reset email */
export async function sendPasswordResetEmail(email: string, name: string | null, link: string) {
  const safeName = name || 'there';
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;">
      <p>Hi ${safeName},</p>
      <p>We received a request to reset your password for your organiser account.</p>
      <p><a href="${link}" style="color:#2563eb;">Click here to reset your password</a>.</p>
      <p>This link expires in 30 minutes.</p>
      <p>If you didn’t request this, you can safely ignore the message.</p>
    </div>
  `;
  return sendEmail({ to: email, subject: 'Reset your password', html });
}
