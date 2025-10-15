import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

type SendTicketsParams = {
  to: string;
  show: {
    id: string;
    title: string;
    date: Date;
    venue?: { name?: string; address?: string | null; city?: string | null; postcode?: string | null } | null;
  };
  order: {
    id: string;
    quantity: number;
    amountPence: number;
  };
  tickets: Array<{ serial: string; qrData: string }>;
};

function formatDate(d: Date) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}
function formatPrice(pence: number) { return `£${(pence / 100).toFixed(2)}`; }

function smtpReady() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`📭 SMTP not configured (missing: ${missing.join(', ')}). Skipping email send.`);
    return false;
  }
  return true;
}

export async function sendTicketsEmail(params: SendTicketsParams) {
  if (!smtpReady()) return;

  const { to, show, order, tickets } = params;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! }
  });

  const attachments = await Promise.all(
    tickets.map(async (t, idx) => {
      const dataUrl = await QRCode.toDataURL(t.qrData, { margin: 1, width: 300 });
      const base64 = dataUrl.split(',')[1];
      const content = Buffer.from(base64, 'base64');
      const cid = `ticket-${t.serial}@chuckl`;
      return { filename: `ticket-${idx + 1}-${t.serial}.png`, content, cid, contentType: 'image/png' };
    })
  );

  const venueLine = [show.venue?.name, show.venue?.address, show.venue?.city, show.venue?.postcode]
    .filter(Boolean).join(', ');

  const ticketListHtml = tickets.map((t, i) => `
    <li style="margin-bottom:12px;">
      <strong>Ticket ${i + 1}</strong> — Serial: <code>${t.serial}</code><br/>
      <img src="cid:ticket-${t.serial}@chuckl" alt="QR ${t.serial}" style="margin-top:6px; max-width:260px; height:auto; border:1px solid #eee; padding:4px; border-radius:6px;" />
    </li>
  `).join('');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height:1.5; color:#111;">
      <h2 style="margin:0 0 8px 0;">Your Chuckl. Tickets</h2>
      <p style="margin:0 0 16px 0;">Thanks for your purchase! Your tickets are below.</p>

      <div style="background:#f6f7f9; padding:12px 14px; border-radius:10px; margin-bottom:16px;">
        <div><strong>Show:</strong> ${show.title}</div>
        <div><strong>When:</strong> ${formatDate(show.date)}</div>
        ${venueLine ? `<div><strong>Where:</strong> ${venueLine}</div>` : ''}
        <div><strong>Order:</strong> ${order.id}</div>
        <div><strong>Total:</strong> ${formatPrice(order.amountPence)}</div>
      </div>

      <h3 style="margin:0 0 10px 0;">Tickets</h3>
      <ol style="padding-left:20px; margin:0;">
        ${ticketListHtml}
      </ol>

      <p style="margin-top:16px; color:#555;">
        Please keep your serials secure. Each QR code admits one person and will be marked used at entry.
      </p>
      <p style="margin-top:8px; color:#555;">
        Any issues? Reply to this email and we'll help.
      </p>
    </div>
  `;

  const text = [
    `Your Chuckl. Tickets`,
    ``,
    `Show: ${show.title}`,
    `When: ${formatDate(show.date)}`,
    venueLine ? `Where: ${venueLine}` : '',
    `Order: ${order.id}`,
    `Total: ${formatPrice(order.amountPence)}`,
    ``,
    `Tickets:`,
    ...tickets.map((t, i) => `  ${i + 1}) Serial: ${t.serial} | QR: ${t.qrData}`),
    ``,
    `Please keep your serials secure. Each QR code admits one person and will be marked used at entry.`,
  ].filter(Boolean).join('\n');

  const mail = await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to,
    subject: `Your Tickets – ${show.title}`,
    html,
    text,
    attachments
  });

  console.log(`📧 Email sent: ${mail.messageId} → ${to}`);
}
