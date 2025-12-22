// backend/src/services/pdf.ts
import PDFDocument from 'pdfkit';
import { qrPngBuffer } from './qrcode.js';

/**
 * Lightweight PDF generator for tickets.
 * Used by the email service if PDF_ATTACHMENTS=true.
 */
export async function buildTicketsPdf(serial: string, showTitle: string) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];

  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(20).text(showTitle, { underline: true });
  doc.moveDown();
  doc.fontSize(14).text(`Ticket Serial: ${serial}`);
  doc.moveDown();

  const qr = await qrPngBuffer(`chuckl:${serial}`, 180);
  doc.text('Show this QR at the door:', { continued: false });
  doc.image(qr, 100, doc.y, { width: 140, height: 140 });

  doc.end();
  return done;
}
