// backend/src/services/pdf.ts
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { ShowInfo } from './email.js';

type TicketInfo = { serial: string; status?: 'VALID' | 'USED' };

function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (d: Buffer) => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export async function buildTicketsPdf(show: ShowInfo, tickets: TicketInfo[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const title = show.title;
  const d = new Date(show.date);
  const when = d.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const venue = show.venue ?? { name: null, address: null, city: null, postcode: null };
  const venueLine = [venue.name, venue.address, venue.city, venue.postcode].filter(Boolean).join(', ');

  // Header
  doc.fontSize(22).text('Chuckl. Tickets', { continued: false });
  doc.moveDown(0.3);
  doc.fontSize(14).fillColor('#333').text(title);
  doc.fontSize(12).fillColor('#444').text(when);
  if (venueLine) {
    doc.fontSize(12).fillColor('#444').text(venueLine);
  }
  doc.moveDown(0.8);
  doc.fillColor('#000');

  // Tickets: 3 per row (QR ~140px)
  const qrSize = 140;
  const gapX = 24;
  const gapY = 24;
  const left = doc.x;
  let x = left;
  let y = doc.y;

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];

    // Make QR PNG (data URL) with namespaced payload
    const payload = `chuckl:${t.serial}`;
    const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M' });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuf = Buffer.from(base64, 'base64');

    // Box + QR + label
    doc.roundedRect(x - 8, y - 8, qrSize + 16, qrSize + 44, 8).stroke('#888');
    doc.image(imgBuf, x, y, { fit: [qrSize, qrSize] });
    doc.fontSize(12).text(`Serial: ${t.serial}`, x, y + qrSize + 10, { width: qrSize });

    // Grid layout: 3 across
    const col = i % 3;
    if (col < 2) {
      x += qrSize + gapX + 16; // include box padding
    } else {
      x = left;
      y += qrSize + 44 + gapY + 16;
      // New page if near bottom
      if (y > doc.page.height - 160) {
        doc.addPage();
        x = left;
        y = doc.y;
      }
    }
  }

  // Footer
  doc.moveDown(1.2);
  doc.fontSize(10).fillColor('#666');
  doc.text(
    'Please bring this PDF or show your email on your phone. Each QR / serial admits one person.',
    { align: 'left' }
  );

  return docToBuffer(doc);
}
