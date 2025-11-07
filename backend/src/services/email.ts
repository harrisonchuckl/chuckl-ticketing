// backend/src/services/email.ts
import { Resend } from 'resend';
import { prisma } from '../lib/db.js';
import PDFDocument from 'pdfkit';

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@chuckl.co.uk';
const ATTACH_PDFS = String(process.env.PDF_ATTACHMENTS || '').toLowerCase() === 'true';

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

type OrderDeep = Awaited<ReturnType<typeof fetchOrderDeep>>;

async function fetchOrderDeep(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      show: {
        include: { venue: true, ticketTypes: true },
      },
      tickets: true,
      user: true,
    },
  });
}

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

async function buildAttachments(order: NonNullable<OrderDeep>) {
  if (!ATTACH_PDFS) return [];

  const s = order.show;
  const v = s?.venue;
  const attachments: Array<{ filename: string; content: Buffer }> = [];

  for (const t of order.tickets || []) {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const done = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      doc.fontSize(18).text(s?.title ?? 'Event', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Date/Time: ${s?.date ? new Date(s.date).toLocaleString() : '—'}`);
      doc.text(`Venue: ${v?.name ?? '—'}${v?.city ? `, ${v.city}` : ''}`);
      doc.moveDown(1);

      doc.fontSize(14).text('Ticket', { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(12).text(`Serial: ${t.serial}`);
      doc.text(`Holder: ${t.holderName || '—'}`);
      doc.text(`Status: ${t.status}`);

      // Placeholder QR box (actual QR can be added later)
      doc.moveDown(1);
      doc.rect(doc.x, doc.y, 120, 120).stroke();
      doc.text('QR placeholder', doc.x + 10, doc.y + 10);

      doc.end();
      const pdf = await done;

      attachments.push({
        filename: `ticket-${t.serial}.pdf`,
        content: pdf,
      });
    } catch {
      // ignore an individual ticket error
    }
  }

  return attachments;
}

export async function sendTicketsEmail(orderId: string, to?: string) {
  const order = await fetchOrderDeep(orderId);
  if (!order) return { ok: false, message: 'Order not found' };

  if (!resend) {
    return { ok: true, message: 'RESEND_API_KEY not configured – email skipped.' };
  }

  const html = renderTicketsHtml(order);
  const attachments = await buildAttachments(order);
  const recipient = (to || order.email || '').trim();
  if (!recipient) return { ok: false, message: 'No recipient email on order' };

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
