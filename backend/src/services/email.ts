// backend/src/services/email.ts
import { Resend } from 'resend';
import QRCode from 'qrcode';
import { buildTicketsPdf } from './pdf.js';

const resendApiKey = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Chuckl. Tickets <tickets@chuckl.co.uk>';

const BRAND_NAME = process.env.BRAND_NAME || 'Chuckl. Tickets';
const BRAND_PRIMARY = process.env.BRAND_PRIMARY || '#4053ff';
const BRAND_BG = '#0b0b10';
const BRAND_CARD = '#141724';
const BRAND_BORDER = '#22263a';
const BRAND_TEXT = '#e8ebf7';
const BRAND_MUTED = '#9aa0b5';
const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL || ''; // e.g. https://.../logo.png

const USE_PDF = process.env.EMAIL_ATTACH_PDF === '1';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Allow nulls in venue fields (matches DB)
export type ShowInfo = {
  id: string;
  title: string;
  date: string | Date;
  venue?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    postcode?: string | null;
  } | null;
};

type OrderInfo = {
  id: string;
  quantity: number;
  amountPence: number;
};

type TicketInfo = { serial: string; qrData: string };

function money(pence: number) {
  return '£' + (Number(pence || 0) / 100).toFixed(2);
}

function fmtDate(d: string | Date) {
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString();
  } catch {
    return String(d);
  }
}

function headerHtml() {
  const logoHtml = BRAND_LOGO_URL
    ? `<img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" style="height:28px;vertical-align:middle"/>`
    : `<strong style="font-weight:800;color:${BRAND_TEXT}">${BRAND_NAME}</strong>`;
  return `
  <div style="padding:22px 20px;border-bottom:1px solid ${BRAND_BORDER};display:flex;align-items:center;gap:12px">
    ${logoHtml}
  </div>`;
}

function ticketRowHtml(serial: string, dataUrl?: string) {
  return `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND_BORDER}">
      <div style="display:flex;gap:14px;align-items:center">
        ${dataUrl ? `<img src="${dataUrl}" alt="QR ${serial}" style="width:88px;height:88px;border-radius:8px;border:1px solid ${BRAND_BORDER};background:#000" />` : ''}
        <div>
          <div style="font-weight:700;letter-spacing:0.3px">Serial: ${serial}</div>
          <div style="color:${BRAND_MUTED};font-size:13px">Present this QR at the door.</div>
        </div>
      </div>
    </td>
  </tr>`;
}

function baseHtml(bodyInner: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="color-scheme" content="dark light"/>
    <meta name="supported-color-schemes" content="dark light"/>
    <title>${BRAND_NAME}</title>
  </head>
  <body style="margin:0;background:${BRAND_BG};color:${BRAND_TEXT};font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif">
    <div style="max-width:720px;margin:0 auto;padding:20px">
      <div style="background:${BRAND_CARD};border:1px solid ${BRAND_BORDER};border-radius:16px;overflow:hidden">
        ${headerHtml()}
        <div style="padding:20px">
          ${bodyInner}
        </div>
        <div style="padding:14px 20px;border-top:1px solid ${BRAND_BORDER};color:${BRAND_MUTED};font-size:12px">
          Sent by ${BRAND_NAME}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendTicketsEmail(args: {
  to: string;
  show: ShowInfo;
  order: OrderInfo;
  tickets: TicketInfo[];
}) {
  if (!resend) throw new Error('Resend not configured (RESEND_API_KEY missing)');

  const { to, show, order, tickets } = args;

  // Generate inline QR images (Data URLs)
  const qrDataUrls: Record<string, string> = {};
  for (const t of tickets) {
    try {
      const payload = t.qrData?.startsWith('chuckl:') ? t.qrData : `chuckl:${t.serial}`;
      qrDataUrls[t.serial] = await QRCode.toDataURL(payload, { width: 220, margin: 1 });
    } catch {
      // if generation fails, we’ll just omit the image
    }
  }

  const venueBits = [
    show.venue?.name || '',
    show.venue?.address || '',
    show.venue?.city || '',
    show.venue?.postcode || ''
  ].filter(Boolean).join(', ');

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px">Your tickets for <span style="color:${BRAND_PRIMARY}">${show.title}</span></h1>
    <p style="margin:0 0 8px;color:${BRAND_MUTED}">${fmtDate(show.date)}${venueBits ? ' · ' + venueBits : ''}</p>

    <div style="margin:12px 0;padding:12px;border:1px solid ${BRAND_BORDER};border-radius:10px;background:#0f1220">
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <div><strong>Order ID:</strong> ${order.id}</div>
        <div><strong>Quantity:</strong> ${order.quantity}</div>
        <div><strong>Total:</strong> ${money(order.amountPence)}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:8px">
      <tbody>
        ${tickets.map(t => ticketRowHtml(t.serial, qrDataUrls[t.serial])).join('')}
      </tbody>
    </table>

    <p style="margin-top:14px">
      <a href="https://chuckl.co.uk" style="display:inline-block;padding:10px 14px;background:${BRAND_PRIMARY};color:#fff;border-radius:10px;text-decoration:none">View event</a>
    </p>
  `;

  const html = baseHtml(body);

  const attachments: { filename: string; content: Buffer }[] = [];
  if (USE_PDF) {
    try {
      const pdf = await buildTicketsPdf({ show, order, tickets });
      attachments.push({ filename: `tickets-${order.id}.pdf`, content: pdf });
    } catch (e) {
      console.error('PDF build failed (continuing without attachment):', (e as any)?.message || e);
    }
  }

  const subject = `Your tickets – ${show.title}`;

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    attachments: attachments.length ? attachments : undefined
  });

  return result;
}

// Simple test helper for /admin/email/test
export async function sendTestEmail(to: string) {
  if (!resend) throw new Error('Resend not configured');
  const html = baseHtml(`
    <h1 style="margin:0 0 8px">Test email</h1>
    <p>This is a test from <strong>${BRAND_NAME}</strong>.</p>
  `);
  return await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Test – ${BRAND_NAME}`,
    html
  });
}
