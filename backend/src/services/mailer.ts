// backend/src/services/mailer.ts
import prisma from '../lib/db.js';

type SendOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Lazy import Resend only if key present
async function sendWithResend(opts: SendOptions) {
  const { Resend } = await import('resend'); // dynamic import to avoid hard dep if unused
  const client = new Resend(RESEND_API_KEY!);
  await client.emails.send({
    from: process.env.MAIL_FROM || 'tickets@chuckl.club',
    to: opts.to,
    subject: opts.subject,
    html: opts.html || undefined,
    text: opts.text || undefined,
  });
}

/**
 * sendOrderEmail:
 * Sends a simple order confirmation / ticket email (resend flow).
 * Falls back to console log if no provider is configured.
 */
export async function sendOrderEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      show: { include: { venue: true } },
      tickets: true,
    },
  });
  if (!order) throw new Error('Order not found');
  if (!order.email) throw new Error('Order has no email address');

  const venueLine = order.show?.venue ? `${order.show.venue.name}, ${order.show.venue.city ?? ''}`.trim() : '';
  const showWhen = order.show ? new Date(order.show.date).toLocaleString() : '';
  const ticketList = (order.tickets || [])
    .map(t => `<li>${t.serial}${t.holderName ? ` — ${t.holderName}` : ''}</li>`)
    .join('');

  const subject = `Your Chuckl. tickets — Order ${order.id}`;
  const html = `
    <div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a">
      <h2 style="margin:0 0 8px;">Thanks for your order</h2>
      <p style="margin:0 0 12px">Order ID: <b>${order.id}</b></p>
      ${order.show ? `<p style="margin:0 0 4px"><b>${order.show.title}</b></p>` : ''}
      ${venueLine ? `<p style="margin:0 0 4px">${venueLine}</p>` : ''}
      ${showWhen ? `<p style="margin:0 0 12px">${showWhen}</p>` : ''}

      <p style="margin:0 0 8px"><b>Tickets</b></p>
      <ul>${ticketList}</ul>

      <p style="margin:16px 0 0">If you need assistance, reply to this email.</p>
    </div>
  `;
  const text = `Thanks for your order ${order.id}
${order.show ? order.show.title : ''}
${venueLine}
${showWhen}

Tickets:
${(order.tickets || []).map(t => `- ${t.serial}${t.holderName ? ` — ${t.holderName}` : ''}`).join('\n')}
`;

  if (RESEND_API_KEY) {
    await sendWithResend({ to: order.email, subject, html, text });
    return { ok: true, provider: 'resend' as const };
  }

  // Fallback (dev)
  // eslint-disable-next-line no-console
  console.log('[mailer] (dry-run) Would send email to', order.email, { subject });
  return { ok: true, provider: 'console' as const };
}
