import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

type VenueInfo = {
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
};

type ShowInfo = {
  id: string;
  title: string;
  date: Date;
  venue: VenueInfo | null;
};

type OrderInfo = {
  id: string;
  quantity: number;
  amountPence: number;
};

type TicketInfo = {
  serial: string;
  qrData: string;
};

async function qrPngBuffer(data: string): Promise<Buffer> {
  // QRCode.toBuffer outputs PNG by default
  return await QRCode.toBuffer(data, { margin: 1, scale: 6 });
}

/**
 * Builds a single multi-page PDF with one page per ticket.
 * Returns a Buffer you can attach to emails.
 */
export async function buildTicketsPdf(params: {
  show: ShowInfo;
  order: OrderInfo;
  tickets: TicketInfo[];
}): Promise<Buffer> {
  const { show, order, tickets } = params;
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ autoFirstPage: false });

  doc.on('data', d => chunks.push(d));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  for (const t of tickets) {
    const qr = await qrPngBuffer(t.qrData);

    doc.addPage({ size: 'A4', margins: { top: 50, left: 50, right: 50, bottom: 60 } });

    // Header / branding
    doc
      .fontSize(22)
      .fillColor('#111')
      .text('Chuckl. Tickets', { align: 'left' })
      .moveDown(0.5);

    // Show details
    doc
      .fontSize(16)
      .fillColor('#000')
      .text(show.title, { align: 'left' });

    const dateStr = new Date(show.date).toLocaleString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const venueLines = [
      show.venue?.name,
      show.venue?.address,
      [show.venue?.city, show.venue?.postcode].filter(Boolean).join(' ')
    ].filter(Boolean).join('\n');

    doc
      .fontSize(12)
      .fillColor('#333')
      .text(dateStr)
      .moveDown(0.3)
      .text(venueLines || 'Venue TBC');

    // Divider
    doc.moveDown(0.7);
    doc
      .strokeColor('#999')
      .lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();

    // QR + Serial row
    doc.moveDown(0.7);
    const leftX = doc.page.margins.left;
    const topY = doc.y;

    // QR code image
    const qrSize = 160;
    doc.image(qr, leftX, topY, { width: qrSize, height: qrSize });

    // Serial + order info
    const rightX = leftX + qrSize + 20;
    doc
      .fontSize(14)
      .fillColor('#000')
      .text('Ticket Serial', rightX, topY)
      .moveDown(0.2)
      .fontSize(20)
      .text(t.serial)
      .moveDown(0.6)
      .fontSize(12)
      .fillColor('#333')
      .text(`Order ID: ${order.id}`)
      .text(`Admits: 1`)
      .text(`Total order qty: ${order.quantity}`)
      .text(`Scan at entry. One scan per ticket.`);

    // Footer
    doc.moveDown(1.2);
    doc
      .fontSize(9)
      .fillColor('#666')
      .text('This ticket contains a unique QR code. Do not share screenshots publicly.', {
        align: 'left'
      });

    // Page border (optional styling)
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).strokeColor('#ddd').stroke();
  }

  doc.end();
  return done;
}
