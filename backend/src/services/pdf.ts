import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

type VenueLite = { name: string; address?: string | null; city?: string | null; postcode?: string | null };
type ShowLite  = { title: string; date: Date; venue: VenueLite };
type OrderLite = { id: string; quantity: number; amountPence: number };
type TicketLite = { serial: string; qrData: string };

export async function createTicketsPdf(show: ShowLite, order: OrderLite, tickets: TicketLite[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];
  doc.on('data', (d: Buffer) => chunks.push(d));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Header
  doc.fontSize(20).text('Chuckl. Tickets', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Your tickets for ${show.title}`, { continued: false });

  const when = new Date(show.date);
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#333')
     .text(`${when.toUTCString()}`)
     .text(`${show.venue.name}${show.venue.address ? ', ' + show.venue.address : ''}${show.venue.city ? ', ' + show.venue.city : ''}${show.venue.postcode ? ', ' + show.venue.postcode : ''}`);
  doc.moveDown(0.5);
  doc.text(`Order ${order.id} · Quantity ${order.quantity} · Total £${(order.amountPence/100).toFixed(2)}`);
  doc.moveDown(1);

  // Tickets grid (2 per row)
  const colW = 250;
  const rowH = 260;
  const startX = 36;
  let x = startX;
  let y = doc.y;

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];

    // Box
    doc.roundedRect(x, y, colW, rowH, 10).stroke('#ddd');

    // QR
    const png = await QRCode.toBuffer(t.qrData, { errorCorrectionLevel: 'M', scale: 8, margin: 1 });
    const imgSize = 180;
    doc.image(png, x + (colW - imgSize) / 2, y + 24, { width: imgSize, height: imgSize });

    // Serial
    doc.fontSize(10).fillColor('#000').text(t.serial, x, y + 24 + imgSize + 10, { align: 'center', width: colW });

    // Next position
    if ((i % 2) === 1) { // new row
      x = startX;
      y += rowH + 16;
    } else {
      x += colW + 16;
    }
  }

  doc.end();
  return done;
}
