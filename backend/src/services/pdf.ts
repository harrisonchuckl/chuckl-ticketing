// backend/src/services/pdf.ts
import PDFDocument from "pdfkit";
import { qrPngBuffer } from "./qrcode";

/**
 * Lightweight PDF generator for tickets.
 * Used by the email service if PDF_ATTACHMENTS=true.
 *
 * QR content:
 * - If QR_BASE_URL is set, encode: `${QR_BASE_URL}?serial=<serial>`
 * - Otherwise encode the raw serial string (works if your scanner expects serial-only).
 */
export async function buildTicketsPdf(serial: string, showTitle: string) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Build QR payload (keep this consistent with your scanner app expectations)
  const base = process.env.QR_BASE_URL?.trim();
  const qrData = base
    ? `${base}${base.includes("?") ? "&" : "?"}serial=${encodeURIComponent(serial)}`
    : serial;

  // Generate QR PNG (using your shared service)
  const qrPng = await qrPngBuffer(qrData, 512);

  // Header
  doc.fontSize(20).text(showTitle, { underline: true });
  doc.moveDown(0.75);

  doc.fontSize(14).text(`Ticket Serial: ${serial}`);
  doc.moveDown(0.75);

  // Draw QR image
  const qrSize = 160;
  const x = doc.x;
  const y = doc.y;

  doc.image(qrPng, x, y, { width: qrSize, height: qrSize });

  // Label under QR
  doc.fontSize(10).text("Scan at entry", x, y + qrSize + 6, {
    width: qrSize,
    align: "center",
  });

  // Continue below block
  const nextY = y + qrSize + 36;
  if (doc.y < nextY) doc.y = nextY;

  doc.moveDown(0.5);
  doc.fontSize(12).text("Please keep this ticket safe. Your QR code will be scanned on arrival.");

  doc.end();
  return done;
}
