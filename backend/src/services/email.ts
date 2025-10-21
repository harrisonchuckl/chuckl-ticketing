import { Resend } from 'resend';
import QRCode from 'qrcode';

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === '1';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.SMTP_FROM || 'Chuckl. Tickets <onboarding@resend.dev>';

type ShowInfo = {
  id: string;
  title: string;
  date: Date | string;
  venue?: { name?: string | null; address?: string | null; city?: string | null; postcode?: string | null } | null;
};

type OrderInfo = {
  id: string;
  quantity: number;
  amountPence: number;
};

type TicketInfo = {
  serial: string;
  qrData?: string;
};

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function formatGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

/** Builds the HTML for the ticket email (with inline QR images via data URLs). */
async function buildEmailHTML(args: {
  to: string;
  show: ShowInfo;
  order: OrderInfo;
  tickets: TicketInfo[];
}) {
  const { show, order, tickets } = args;

  // Ensure we have a usable QR payload per ticket: "chuckl:<SERIAL>"
  const enriched = await Promise.all(
    tickets.map(async (t) => {
      const text = t.qrData && t.qrData.trim().length > 0 ? t.qrData : `chuckl:${t.serial}`;
      const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 220 });
      return { ...t, qrText: text, qrPng: dataUrl };
    })
  );

  const when =
    typeof show.date === 'string'
      ? new Date(show.date)
      : (show.date as Date);

  const showLine = [
    when.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    show.venue?.name ? ` — ${show.venue.name}` : '',
    show.venue?.address ? `, ${show.venue.address}` : '',
    show.venue?.city ? `, ${show.venue.city}` : '',
    show.venue?.postcode ? `, ${show.venue.postcode}` : ''
  ].join('');

  // Basic, clean dark card
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Your tickets for ${escapeHtml(show.title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:0;padding:28px;background:#0b0b10;color:#f6f7fb}
    .card{max-width:720px;margin:0 auto;background:#151823;border:1px solid #24283a;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    h1{margin:0 0 10px;font-weight:700;font-size:22px}
    h2{margin:12px 0 8px;font-size:16px;color:#c6c8d1}
    p{margin:6px 0;color:#c6c8d1;line-height:1.55}
    .muted{color:#9ba0af}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px}
    .ticket{background:#0f1320;border:1px solid #20253a;border-radius:12px;padding:12px;text-align:center}
    .serial{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
    .foot{margin-top:14px;font-size:13px;color:#9ba0af}
    a.btn{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none}
    table.meta{margin-top:8px;border-collapse:collapse}
    table.meta td{padding:2px 8px;color:#c6c8d1}
    table.meta td.k{color:#9ba0af}
  </style>
</head>
<body>
  <div class="card">
    <h1>Your tickets for <em>${escapeHtml(show.title)}</em></h1>
    <p class="muted">${escapeHtml(showLine)}</p>
    <table class="meta">
      <tr><td class="k">Order</td><td><span class="serial">${escapeHtml(order.id)}</span></td></tr>
      <tr><td class="k">Quantity</td><td>${order.quantity}</td></tr>
      <tr><td class="k">Total</td><td>${formatGBP(order.amountPence)}</td></tr>
    </table>

    <h2>Tickets</h2>
    <div class="grid">
      ${enriched
        .map(
          (t, idx) => `
        <div class="ticket">
          <div class="muted">#${idx + 1}</div>
          <img src="${t.qrPng}" alt="QR for ${escapeHtml(t.serial)}" width="220" height="220" />
          <div class="serial" style="margin-top:8px">${escapeHtml(t.serial)}</div>
        </div>`
        )
        .join('')}
    </div>

    <p class="foot">
      Show this email at the door. We’ll scan your QR (or type the serial if needed).
    </p>
    <a class="btn" href="https://chuckl-ticketing-production.up.railway.app">Back to site</a>
  </div>
</body>
</html>`;

  const text = [
    `Your tickets for ${show.title}`,
    showLine,
    '',
    `Order: ${order.id}`,
    `Quantity: ${order.quantity}`,
    `Total: ${formatGBP(order.amountPence)}`,
    '',
    'Serials:',
    ...enriched.map((t, i) => `#${i + 1} ${t.serial}  (${t.qrText})`)
  ].join('\n');

  return { html, text };
}

/** Utility to escape HTML text nodes */
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function sendTicketsEmail(args: {
  to: string;
  show: ShowInfo;
  order: OrderInfo;
  tickets: TicketInfo[];
}) {
  if (!EMAIL_ENABLED) {
    console.log('📭 EMAIL_ENABLED != 1 → skipping email send');
    return { ok: false, skipped: true as const, reason: 'email_disabled' };
  }
  if (!resend || !RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not set');
  }

  const { to, show, order, tickets } = args;
  const { html, text } = await buildEmailHTML({ to, show, order, tickets });

  const sent = await resend.emails.send({
    from: FROM,            // e.g. 'Chuckl. Tickets <tickets@chuckl.co.uk>'
    to,
    subject: `Your tickets – ${show.title}`,
    html,
    text
  });

  return { ok: true as const, provider: 'resend', result: sent };
}

/** Simple admin test email */
export async function sendTestEmail(to: string) {
  if (!EMAIL_ENABLED) {
    console.log('📭 EMAIL_ENABLED != 1 → skipping email send');
    return { ok: false, skipped: true as const, reason: 'email_disabled' };
  }
  if (!resend || !RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not set');
  }

  const html = `<div style="font-family:system-ui;padding:20px">
    <h1>Chuckl. Tickets – Test</h1>
    <p>This is a test message from the API.</p>
  </div>`;
  const text = 'Chuckl. Tickets – Test\nThis is a test message from the API.';

  const sent = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Test email',
    html,
    text
  });

  return { ok: true as const, provider: 'resend', result: sent };
}
