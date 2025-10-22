// backend/src/services/pdf.ts
import PDFDocument from 'pdfkit';
import { qrPngBuffer } from './qrcode.js';

type VenueInfo = {
  name: string;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
};

type ShowInfo = {
  id: string;
  title: string;
  date: Date | string;
  venue: VenueInfo;
};

type TicketLite = {
  serial: string;
  qrData: string;
};

type OrderLite = {
  id: string;
  quantity: number;
  amountPence: number;
};

type BrandOpts = {
  brandName?: string;
  primaryHex?: string;   // e.g. "#4f46e5"
  accentHex?: string;    // e.g. "#151823"
  textHex?: string;      // e.g. "#0b0b10"
};

export async function buildTicketsPdf(opts: {
  show: ShowInfo;
  tickets: TicketLite[];
  order: OrderLite;
  brand?: BrandOpts;
}): Promise<Buffer> {
  const {
    show,
    tickets,
    order,
    brand = {
      brandName: 'Chuckl. Tickets',
      primaryHex: '#4f46e5',
      accentHex: '#151823',
      textHex: '#0b0b10',
    },
  } = opts;

  const buffers: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  doc.on('data', (d) => buffers.push(d));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });

  const showDate =
    typeof show.date === 'string' ? new Date(show.date) : show.date;
  const showDateStr = showDate.toLocaleString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const qrBuf = await qrPngBuffer(t.qrData, 480);

    if (i > 0) doc.addPage();

    // Header bar
    doc
      .rect(36, 36, doc.page.width - 72, 40)
      .fill(brand.accentHex || '#151823');

    doc
      .fill('#ffffff')
      .fontSize(16)
      .text(brand.brandName || 'Chuckl. Tickets', 46, 48);

    // Show title
    doc
      .fill('#000000')
      .fontSize(22)
      .text(show.title, 36, 96, { width: doc.page.width - 72, align: 'left' });

    // Venue / when
    const v = show.venue;
    const venueLine = [v.name, v.address, v.city, v.postcode]
      .filter(Boolean)
      .join(', ');
    doc
      .fontSize(12)
      .fill('#333333')
      .moveDown(0.4)
      .text(venueLine)
      .moveDown(0.2)
      .text(showDateStr);

    // Order meta
    doc.moveDown(0.5).fontSize(11).fill('#555555');
    doc.text(`Order ID: ${order.id}`);
    doc.text(`Ticket: ${i + 1} of ${order.quantity}`);
    doc.text(`Face value: £${(order.amountPence / 100).toFixed(2)}`);

    // QR + serial block
    const qrX = 36;
    const qrY = 200;
    doc.image(qrBuf, qrX, qrY, { width: 260, height: 260 });

    doc
      .fontSize(14)
      .fill('#000000')
      .text('Present this code at the door', qrX + 280, qrY + 6);
    doc
      .fontSize(18)
      .fill(brand.primaryHex || '#4f46e5')
      .text(`Serial: ${t.serial}`, qrX + 280, qrY + 40);

    doc
      .fontSize(10)
      .fill('#666666')
      .text(
        'Scanning this QR marks the ticket as USED. Each ticket can be scanned once.',
        qrX + 280,
        qrY + 70,
        { width: 230 }
      );

    // Footer
    const footerY = doc.page.height - 60;
    doc
      .moveTo(36, footerY - 10)
      .lineTo(doc.page.width - 36, footerY - 10)
      .strokeColor('#e5e7eb')
      .stroke();

    doc
      .fontSize(9)
      .fill('#666666')
      .text('Need help? Contact tickets@chuckl.co.uk', 36, footerY);
  }

  doc.end();
  return done;
}
