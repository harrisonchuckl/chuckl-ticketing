// backend/src/services/pdf.ts
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

type ShowInfo = {
  id: string;
  title: string;
  date: string | Date;
  venue?: { name?: string; address?: string; city?: string; postcode?: string | null } | null;
};
type OrderInfo = { id: string; quantity: number; amountPence: number };
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

export async function buildTicketsPdf(args: {
  show: ShowInfo;
  order: OrderInfo;
  tickets: TicketInfo[];
}): Promise<Buffer> {
  const { show, order, tickets } = args;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc
    .fontSize(22)
    .text('Chuckl. Tickets', { continued: true })
    .fillColor('#4053ff')
    .text('  •  E-Ticket', { continued: false })
    .moveDown(0.5)
    .fillColor('#000');

  // Order block
  doc
    .fontSize(12)
    .text(`Event: ${show.title}`)
    .text(`Date: ${fmtDate(show.date)}`)
    .text(`Venue: ${show.venue?.name || ''}`)
    .text(`Order ID: ${order.id}`)
    .text(`Quantity: ${order.quantity}`)
    .text(`Total: ${money(order.amountPence)}`)
    .moveDown(1);

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const payload = t.qrData?.startsWith('chuckl:') ? t.qrData : `chuckl:${t.serial}`;
    const dataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 1 });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const img = Buffer.from(base64, 'base64');

    doc.fontSize(14).text(`Ticket ${i + 1} of ${tickets.length}`, { underline: true });
    doc.moveDown(0.25);
    const y = doc.y;

    doc.image(img, { fit: [160, 160], align: 'left' });
    doc.rect(220, y, 320, 120).stroke('#cccccc');
    doc.text(`Serial: ${t.serial}`, 230, y + 10);
    doc.text(`Present this QR at the door.`, 230, y + 28, { width: 300 });
    doc.moveDown(2);

    if (i < tickets.length - 1) doc.moveDown(0.5);
  }

  doc.end();
  return done;
}
