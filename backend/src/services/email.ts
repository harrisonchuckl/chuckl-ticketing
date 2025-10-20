import nodemailer from 'nodemailer';

/**
 * Minimal shapes so this module can be imported anywhere without dragging Prisma types in.
 */
type Venue = {
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
};

type Show = {
  id: string;
  title: string;
  date: Date | string;
  venue: Venue | null;
};

type OrderBrief = {
  id: string;
  quantity: number;
  amountPence: number;
};

type TicketBrief = {
  serial: string;
  qrData: string;
};

/**
 * Convert various env representations to boolean.
 */
function isEnabled(v: any) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

/**
 * Create a reusable SMTP transport from env vars.
 * Works with Gmail App Passwords (SMTP_HOST=smtp.gmail.com, SMTP_PORT=587).
 */
export function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      `SMTP not configured. Missing one of SMTP_HOST/SMTP_USER/SMTP_PASS (got HOST=${host}, USER=${user}, PASS=${pass ? '***' : 'missing'})`
    );
  }

  // PORT 587 -> STARTTLS (secure: false). If you set 465, secure should be true.
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Simple currency formatter (GBP).
 */
function formatGBP(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

/**
 * Build the HTML for the tickets email.
 */
function buildTicketsHtml(args: {
  show: Show;
  order: OrderBrief;
  tickets: TicketBrief[];
}) {
  const { show, order, tickets } = args;

  const when =
    typeof show.date === 'string'
      ? new Date(show.date)
      : show.date;

  const dateStr = when ? new Date(when).toLocaleString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }) : 'TBA';

  const venueLines = [
    show.venue?.name,
    show.venue?.address,
    [show.venue?.city, show.venue?.postcode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('<br/>');

  const ticketRows = tickets
    .map(
      (t, i) => `
        <tr>
          <td style="padding:8px;border:1px solid #eee;">${i + 1}</td>
          <td style="padding:8px;border:1px solid #eee;font-family:monospace;">${t.serial}</td>
          <td style="padding:8px;border:1px solid #eee;">${t.qrData}</td>
        </tr>`
    )
    .join('');

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:auto;">
    <h2 style="margin:0 0 12px">Your Chuckl. tickets</h2>
    <p style="margin:0 0 16px">Order <strong>${order.id}</strong> — ${formatGBP(order.amountPence)}</p>

    <div style="padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:16px;">
      <div style="font-size:18px;font-weight:600;">${show.title}</div>
      <div style="color:#333;margin-top:4px;">${dateStr}</div>
      <div style="color:#555;margin-top:8px;line-height:1.35">${venueLines || ''}</div>
    </div>

    <p>Show this email at the door. Each ticket has a unique code:</p>
    <table style="border-collapse:collapse;width:100%;margin-top:8px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border:1px solid #eee;background:#fafafa;">#</th>
          <th style="text-align:left;padding:8px;border:1px solid #eee;background:#fafafa;">Serial</th>
          <th style="text-align:left;padding:8px;border:1px solid #eee;background:#fafafa;">QR payload</th>
        </tr>
      </thead>
      <tbody>${ticketRows}</tbody>
    </table>

    <p style="margin-top:16px;color:#666;font-size:12px">If you have questions, reply to this email.</p>
  </div>`;
}

/**
 * Send the real tickets email (used by webhook + admin resend).
 */
export async function sendTicketsEmail(args: {
  to: string;
  show: Show;
  order: OrderBrief;
  tickets: TicketBrief[];
}) {
  if (!isEnabled(process.env.EMAIL_ENABLED)) {
    throw new Error('EMAIL_DISABLED');
  }

  const transporter = getTransport();

  const from = process.env.SMTP_FROM || `Chuckl. Tickets <${process.env.SMTP_USER}>`;
  const subject = `Your tickets: ${args.show.title}`;
  const html = buildTicketsHtml(args);

  await transporter.sendMail({
    from,
    to: args.to,
    subject,
    html,
    text: `Your tickets for ${args.show.title}\n\nOrder: ${args.order.id}\nTotal: ${formatGBP(
      args.order.amountPence
    )}\n\nTickets:\n${args.tickets.map((t, i) => `${i + 1}. ${t.serial} (${t.qrData})`).join('\n')}`,
  });
}

/**
 * Minimal “ping” email so you can test SMTP without creating an order.
 */
export async function sendTestEmail(to: string) {
  if (!isEnabled(process.env.EMAIL_ENABLED)) {
    throw new Error('EMAIL_DISABLED');
  }
  const transporter = getTransport();
  const from = process.env.SMTP_FROM || `Chuckl. Tickets <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject: 'Chuckl. test email',
    text: 'If you can read this, SMTP is working. 🎉',
  });
}
