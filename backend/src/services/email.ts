// backend/src/services/email.ts
import { Resend } from 'resend';
import { prisma } from '../lib/db.js';

// OPTIONAL: if your pdf service exposes a function, we’ll try to use it.
// If it doesn’t exist or fails, we’ll still send the email without attachments.
let buildTicketPDF: undefined | ((
  args: { serial: string; showTitle: string; showDate: Date; venueName?: string | null; holderName?: string | null }
) => Promise<Buffer>);

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfSvc = await import('../services/pdf.js');
  // try a few likely export names to be compatible with your version
  buildTicketPDF =
    (pdfSvc.buildTicketPDF as typeof buildTicketPDF) ||
    (pdfSvc.createTicketPDF as typeof buildTicketPDF) ||
    (pdfSvc.generateTicketPDF as typeof buildTicketPDF);
} catch {
  // no-op – we’ll still send a plain email
}

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@chuckl.co.uk';

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

type OrderDeep = Awaited<ReturnType<typeof fetchOrderDeep>>;

async function fetchOrderDeep(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      show: {
        include: {
          venue: true,
          ticketTypes: true,
        },
      },
      tickets: true,
      user: true,
    },
  });
}

/**
 * Build a simple, branded HTML email body for tickets.
 */
function renderTicketsHtml(order: NonNullable<OrderDeep>) {
  const s = order.show;
  const v = s?.venue;
  const when = s?.date ? new Date(s.date).toLocaleString() : '—';
  const ticketsList = (order.tickets || [])
    .map(t => {
      return `<li>
        <b>Serial:</b> ${t.serial}
        ${t.holderName ? `&nbsp; &middot; <b>Name:</b> ${t.holderName}` : ''}
        &nbsp; &middot; <b>Status:</b> ${t.status}
      </li>`;
    })
    .join('');

  const ticketTypeSummary = (s?.ticketTypes || [])
    .map(tt => `${tt.name} (£${(tt.pricePence / 100).toFixed(2)})`)
    .join(' · ');

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
    <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="margin: 0 0 8px;">Your Tickets – ${s?.title ?? 'Event'}</h2>
      <p style="margin: 0 0 12px; color: #6b7280;">
        ${when}${v?.name ? ` &nbsp;&middot;&nbsp; ${v.name}` : ''}${v?.city ? `, ${v.city}` : ''}
      </p>
      ${
        ticketTypeSummary
          ? `<p style="margin: 0 0 12px;"><b>Ticket Types:</b> ${ticketTypeSummary}</p>`
          : ''
      }
      <p style="margin: 0 0 12px;">Thanks for your purchase${
        order.email ? `, ${order.email}` : ''
      }! Your tickets are below.</p>
      <ul style="margin: 0 0 12px; padding-left: 18px;">${ticketsList}</ul>

      <p style="margin: 0 0 12px; color: #6b7280;">
        If this email has attachments, each attached PDF is a single ticket. You can show the QR on your phone or print it.
      </p>
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        Chuckl. Ticketing &mdash; do not reply to this address.
      </p>
    </div>
  </div>`;
}

/**
 * Tries to build PDF attachments for each ticket (if buildTicketPDF is available).
 */
async function buildAttachments(order: NonNullable<OrderDeep>) {
  if (!buildTicketPDF) return [];

  const s = order.show;
  const v = s?.venue;
  const attachments: Array<{ filename: string; content: Buffer }> = [];

  for (const t of order.tickets || []) {
    try {
      const pdf = await buildTicketPDF({
        serial: t.serial,
        showTitle: s?.title ?? 'Event',
        showDate: s?.date ?? new Date(),
        venueName: v?.name ?? undefined,
        holderName: t.holderName ?? undefined,
      });
      attachments.push({
        filename: `ticket-${t.serial}.pdf`,
        content: pdf,
      });
    } catch {
      // ignore individual ticket errors; send whatever we can
    }
  }

  return attachments;
}

/**
 * Public API – send order tickets to the customer email.
 * Optionally override recipient with "to".
 */
export async function sendTicketsEmail(orderId: string, to?: string) {
  const order = await fetchOrderDeep(orderId);
  if (!order) throw new Error('Order not found');

  if (!resend) {
    // still return ok so you can test without keys
    return { ok: true, message: 'RESEND_API_KEY not configured – email skipped.' };
  }

  const html = renderTicketsHtml(order);
  const attachments = await buildAttachments(order);
  const recipient = (to || order.email || '').trim();
  if (!recipient) throw new Error('No recipient email on order');

  const subject =
    `Your tickets for ${order.show?.title ?? 'your event'} – ` +
    (order.show?.date ? new Date(order.show.date).toLocaleDateString() : '');

  await resend.emails.send({
    from: EMAIL_FROM,
    to: recipient,
    subject,
    html,
    attachments:
      attachments.length > 0
        ? attachments.map(a => ({
            filename: a.filename,
            content: a.content.toString('base64'),
          }))
        : undefined,
  });

  return { ok: true };
}

/**
 * Simple test email to verify connectivity
 */
export async function sendTestEmail(to: string) {
  if (!resend) return { ok: false, message: 'RESEND_API_KEY not configured' };
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Test email – Chuckl. Ticketing',
    html: `<div style="font-family:Arial,sans-serif">This is a test email from Chuckl. Ticketing.</div>`,
  });
  return { ok: true };
}
