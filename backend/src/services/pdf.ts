// backend/src/services/pdf.ts
import PDFDocument from 'pdfkit';

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
  doc.rect(100, doc.y, 120, 120).stroke();
  doc.text('QR Placeholder', 110, doc.y + 50);

  doc.end();
  return done;
}
