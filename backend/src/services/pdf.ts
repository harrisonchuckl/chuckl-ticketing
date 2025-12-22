// backend/src/services/pdf.ts
import PDFDocument from "pdfkit";
import fs from "node:fs/promises";
import path from "node:path";
import { qrPngBuffer } from "./qrcode.js";

const TIXALL_BLUE = "#0f9cdf";
const LOGO_FILENAME = "TixAll on White Background.png";

export type TicketPdfItem = {
  serial: string;
  ticketType?: string;        // e.g. "General Admission"
  price?: string;             // e.g. "£22.50"
  seatLabel?: string;         // e.g. "T21" or "Row A Seat 12"
};

export type OrderPdfMeta = {
  orderRef?: string;          // e.g. "13948344183" or your internal order id
  showTitle: string;          // required
  venueName?: string;
  venueAddress?: string;
  dateText?: string;          // e.g. "Saturday 14th March 2026"
  timeText?: string;          // e.g. "7:30PM"
  doorsOpenText?: string;     // e.g. "6:30PM"
  bookedBy?: string;          // optional (customer name)
  bookedAtText?: string;      // e.g. "Monday 22nd December 2025"
  additionalInfoLines?: string[]; // optional extra lines under venue/date
  includeSummaryPage?: boolean;   // optional
  summary?: {
    ticketsLine?: string;     // e.g. "4 x Standard"
    subtotal?: string;        // e.g. "£90.00"
    fees?: string;            // e.g. "£6.30"
    total?: string;           // e.g. "£96.30"
    statusLine?: string;      // e.g. "CONFIRMED"
  };
};

/**
 * NEW: Build ONE PDF containing multiple tickets (1 page per ticket).
 * This is what the email service should attach.
 */
export async function buildOrderTicketsPdf(meta: OrderPdfMeta, tickets: TicketPdfItem[]) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const logo = await tryLoadTixAllLogo();

  for (let i = 0; i < tickets.length; i++) {
    if (i > 0) doc.addPage();

    const t = tickets[i];

    // QR payload: keep consistent with your scanner expectations
    const base = process.env.QR_BASE_URL?.trim();
    const qrData = base
      ? `${base}${base.includes("?") ? "&" : "?"}serial=${encodeURIComponent(t.serial)}`
      : t.serial;

    const qrPng = await qrPngBuffer(qrData, 512);

    drawTicketPage(doc, { meta, ticket: t, qrPng, logo, index: i + 1, total: tickets.length });
  }

  // Optional summary page at the end (similar idea to TicketSource page 5)
  if (meta.includeSummaryPage && meta.summary) {
    doc.addPage();
    drawSummaryPage(doc, { meta, ticketsCount: tickets.length, logo });
  }

  doc.end();
  return done;
}

/**
 * Backwards-compatible wrapper (single ticket).
 * Keeps your existing email code working while you upgrade it to multi-ticket PDFs.
 */
export async function buildTicketsPdf(serial: string, showTitle: string) {
  const meta: OrderPdfMeta = { showTitle };
  return buildOrderTicketsPdf(meta, [{ serial }]);
}

/* ----------------------------- Drawing helpers ---------------------------- */

function drawTicketPage(
doc: InstanceType<typeof PDFDocument>,
  args: {
    meta: OrderPdfMeta;
    ticket: TicketPdfItem;
    qrPng: Buffer;
    logo?: Buffer | null;
    index: number;
    total: number;
  }
) {
  const { meta, ticket, qrPng, logo, index, total } = args;

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Header bar
  const headerH = 72;
  doc.save();
  doc.rect(0, 0, pageWidth, headerH).fill(TIXALL_BLUE);
  doc.restore();

  // Logo (top-left)
  const paddingX = 36;
  const paddingY = 18;

  if (logo) {
    // Keep it tidy in the header bar
    doc.image(logo, paddingX, paddingY, { height: 36 });
  } else {
    doc.fillColor("white").fontSize(20).text("TixAll", paddingX, paddingY);
  }

  // Order ref (top-right)
  if (meta.orderRef) {
    doc
      .fillColor("white")
      .fontSize(11)
      .text(`Order #${meta.orderRef}`, paddingX, 22, {
        align: "right",
        width: pageWidth - paddingX * 2,
      });
  }

  // Card container
  const cardX = 36;
  const cardY = headerH + 24;
  const cardW = pageWidth - 72;
  const cardH = 380;

  doc.save();
  doc.roundedRect(cardX, cardY, cardW, cardH, 10).lineWidth(1).stroke("#D9D9D9");
  doc.restore();

  // Left content area
  const leftX = cardX + 24;
  let y = cardY + 22;

  // Title
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(20).text(meta.showTitle, leftX, y, {
    width: cardW - 24 - 220,
  });
  y += 30;

  // Ticket type + price line
  const tt = ticket.ticketType ?? "Ticket";
  const price = ticket.price ? ` – ${ticket.price}` : "";
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(13).text(`${tt}${price}`, leftX, y, {
    width: cardW - 24 - 220,
  });
  y += 22;

  // Venue + date/time lines
  doc.fillColor("#222").font("Helvetica").fontSize(11);

  if (meta.venueName || meta.venueAddress) {
    const venueLine = [meta.venueName, meta.venueAddress].filter(Boolean).join(", ");
    doc.text(venueLine, leftX, y, { width: cardW - 24 - 220 });
    y += 16;
  }

  const dateBits = [meta.dateText, meta.timeText].filter(Boolean).join(" at ");
  if (dateBits) {
    doc.text(dateBits, leftX, y, { width: cardW - 24 - 220 });
    y += 16;
  }

  if (meta.doorsOpenText) {
    doc.text(`Doors open: ${meta.doorsOpenText}`, leftX, y, { width: cardW - 24 - 220 });
    y += 16;
  }

  if (meta.additionalInfoLines?.length) {
    for (const line of meta.additionalInfoLines) {
      doc.text(line, leftX, y, { width: cardW - 24 - 220 });
      y += 16;
    }
  }

  // Booking line (optional)
  if (meta.bookedBy || meta.bookedAtText) {
    y += 10;
    const booked = [meta.bookedBy ? `Booked by ${meta.bookedBy}` : null, meta.bookedAtText ? `on ${meta.bookedAtText}` : null]
      .filter(Boolean)
      .join(" ");
    doc.fillColor("#666").fontSize(9).text(booked, leftX, y, { width: cardW - 24 - 220 });
    doc.fillColor("#222").fontSize(11);
    y += 16;
  }

  // Ticket details strip
  y = cardY + cardH - 86;
  doc.save();
  doc.rect(cardX, y, cardW, 86).fill("#F7F9FB");
  doc.restore();

  const stripX = cardX + 24;
  const stripY = y + 16;

  doc.fillColor("#111").font("Helvetica-Bold").fontSize(10).text("Ticket", stripX, stripY);
  doc.fillColor("#111").font("Helvetica").fontSize(10).text(`${index} of ${total}`, stripX, stripY + 14);

  doc.fillColor("#111").font("Helvetica-Bold").fontSize(10).text("Serial", stripX + 160, stripY);
  doc.fillColor("#111").font("Helvetica").fontSize(10).text(ticket.serial, stripX + 160, stripY + 14);

  if (ticket.seatLabel) {
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(10).text("Seat", stripX + 360, stripY);
    doc.fillColor("#111").font("Helvetica").fontSize(10).text(ticket.seatLabel, stripX + 360, stripY + 14);
  }

  // QR area (right side of card)
  const qrBoxSize = 160;
  const qrX = cardX + cardW - qrBoxSize - 24;
  const qrY = cardY + 100;

  doc.image(qrPng, qrX, qrY, { width: qrBoxSize, height: qrBoxSize });

  // Serial under QR (like Eventbrite/TicketSource style)
  doc
    .fillColor("#111")
    .font("Helvetica")
    .fontSize(9)
    .text(ticket.serial, qrX, qrY + qrBoxSize + 8, {
      width: qrBoxSize,
      align: "center",
    });

  // Footer note (short + original, not copied from others)
  const footerY = pageHeight - 72;
  doc.fillColor("#666").fontSize(8).text(
    "Entry is by QR e-ticket. Keep this PDF safe — each QR code is unique and may be invalidated if duplicated.",
    36,
    footerY,
    { width: pageWidth - 72, align: "left" }
  );
}

function drawSummaryPage(
doc: InstanceType<typeof PDFDocument>,
  args: { meta: OrderPdfMeta; ticketsCount: number; logo?: Buffer | null }
) {
  const { meta, ticketsCount, logo } = args;

  const pageWidth = doc.page.width;

  // Header
  doc.save();
  doc.rect(0, 0, pageWidth, 72).fill(TIXALL_BLUE);
  doc.restore();

  if (logo) doc.image(logo, 36, 18, { height: 36 });
  else doc.fillColor("white").fontSize(20).text("TixAll", 36, 18);

  doc.fillColor("#111").font("Helvetica-Bold").fontSize(18).text("Booking Summary", 36, 110);

  doc.fillColor("#222").font("Helvetica").fontSize(11);
  doc.text(`Show: ${meta.showTitle}`, 36, 145);

  if (meta.orderRef) doc.text(`Order: #${meta.orderRef}`, 36, 162);
  doc.text(`Tickets: ${ticketsCount}`, 36, 179);

  if (meta.summary) {
    const { ticketsLine, subtotal, fees, total, statusLine } = meta.summary;
    let y = 220;

    doc.roundedRect(36, y, pageWidth - 72, 160, 10).stroke("#D9D9D9");
    y += 18;

    if (ticketsLine) doc.text(`Tickets: ${ticketsLine}`, 56, y), (y += 18);
    if (subtotal) doc.text(`Subtotal: ${subtotal}`, 56, y), (y += 18);
    if (fees) doc.text(`Fees: ${fees}`, 56, y), (y += 18);
    if (total) doc.font("Helvetica-Bold").text(`Total: ${total}`, 56, y), (y += 22), doc.font("Helvetica");
    if (statusLine) doc.text(`Status: ${statusLine}`, 56, y), (y += 18);
  }

  doc.fillColor("#666").fontSize(8).text(
    "Need help? Reply to your confirmation email and our team will get back to you.",
    36,
    doc.page.height - 72,
    { width: pageWidth - 72 }
  );
}

/* ----------------------------- Asset loading ----------------------------- */

async function tryLoadTixAllLogo(): Promise<Buffer | null> {
  // You said it lives here in repo:
  // backend/public/TixAll on White Background.png
  // On Railway, cwd is usually backend/ when starting, but we’ll try a couple of safe paths.
  const candidates = [
    path.join(process.cwd(), "public", LOGO_FILENAME),
    path.join(process.cwd(), "backend", "public", LOGO_FILENAME),
    path.join(process.cwd(), "src", "public", LOGO_FILENAME), // just in case
  ];

  for (const p of candidates) {
    try {
      return await fs.readFile(p);
    } catch {
      // try next
    }
  }
  return null;
}
