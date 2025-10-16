import nodemailer from 'nodemailer';
import type { Order, Show, Ticket } from '@prisma/client';

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === '1';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Chuckl. Tickets <no-reply@example.com>';

let transporter: nodemailer.Transporter | null = null;

function ensureTransport(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (!EMAIL_ENABLED) {
    throw new Error('EMAIL_ENABLED is not set to 1');
  }
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP variables are missing (SMTP_HOST/SMTP_USER/SMTP_PASS)');
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // Gmail: 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

/**
 * Sends the “your tickets” email after an order is marked PAID.
 * Provide order with show + tickets included.
 */
export async function sendOrderEmail(args: {
  order: Order & { show: Show; tickets: Ticket[] };
}) {
  if (!EMAIL_ENABLED) {
    console.log('📭 EMAIL_ENABLED != 1 → skipping email send');
    return { skipped: true };
  }

  const { order } = args;
  const tCount = order.tickets.length;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;line-height:1.55">
    <h2 style="margin:0 0 8px">Your Chuckl. tickets</h2>
    <p style="margin:0 0 12px">Thanks! Your payment has been received.</p>

    <div style="background:#f6f7fb;border:1px solid #e6e8f0;border-radius:10px;padding:12px 14px;margin:10px 0">
      <div><strong>Show:</strong> ${escapeHtml(order.show.title)}</div>
      <div><strong>Date:</strong> ${new Date(order.show.date).toLocaleString()}</div>
      <div><strong>Order ID:</strong> ${order.id}</div>
      <div><strong>Tickets:</strong> ${tCount}</div>
      <div><strong>Total:</strong> £${(order.amountPence / 100).toFixed(2)}</div>
    </div>

    <h3 style="margin:16px 0 8px">Your ticket codes</h3>
    <ul>
      ${order.tickets
        .map(
          (t) =>
            `<li><code style="background:#eef0f7;padding:2px 6px;border-radius:6px;border:1px solid #dfe3ef">${t.serial}</code></li>`
        )
        .join('')}
    </ul>

    <p style="margin-top:16px">Show this email at the venue. We’ll scan your code(s) on entry.</p>
    <p style="margin:8px 0 0;color:#5f6472;font-size:13px">Questions? Reply to this email.</p>
  </div>
  `;

  const text =
    `Your Chuckl. tickets\n\n` +
    `Show: ${order.show.title}\n` +
    `Date: ${new Date(order.show.date).toLocaleString()}\n` +
    `Order ID: ${order.id}\n` +
    `Tickets: ${tCount}\n` +
    `Total: £${(order.amountPence / 100).toFixed(2)}\n\n` +
    `Codes:\n` +
    order.tickets.map((t) => ` - ${t.serial}`).join('\n');

  const mail = {
    from: SMTP_FROM,
    to: order.email,
    subject: `Your tickets – ${order.show.title}`,
    text,
    html,
  };

  const tx = ensureTransport();
  const info = await tx.sendMail(mail);
  console.log(`📧 Ticket email sent → ${order.email} (${info.messageId})`);
  return { messageId: info.messageId };
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
