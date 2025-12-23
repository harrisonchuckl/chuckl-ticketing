// backend/src/services/email.ts
import { Resend } from "resend";
import { prisma } from "../lib/db.js";
import { buildOrderTicketsPdf } from "./pdf.js";

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@chuckl.co.uk";
// Default ON (so you always get PDF attachments unless you explicitly disable them)
const ATTACH_PDFS = String(process.env.PDF_ATTACHMENTS ?? "true").toLowerCase() === "true";

// Branding / links
const BRAND_COLOR = process.env.EMAIL_BRAND_COLOR || "#0f9cdf";
const LOGO_URL = (process.env.EMAIL_LOGO_URL || "").trim(); // must be absolute https URL
const MY_TICKETS_URL_BASE = (process.env.MY_TICKETS_URL_BASE || "").trim(); // optional, e.g. https://chuckl.club/my-tickets?order=

const INCLUDE_SUMMARY_PAGE =
  String(process.env.PDF_INCLUDE_SUMMARY_PAGE || "").toLowerCase() === "true";

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

type OrderDeep = Awaited<ReturnType<typeof fetchOrderDeep>>;

async function fetchOrderDeep(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      show: {
        include: { venue: true, ticketTypes: true },
      },
      tickets: true,
      user: true,
    },
  });
}

function formatDateTimeUK(d?: Date | string | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateUK(d?: Date | string | null) {
  if (!d) return undefined;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeUK(d?: Date | string | null) {
  if (!d) return undefined;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s: string | null | undefined) {
  const safe = s ?? "";
  return safe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildMyTicketsUrl(orderRef: string) {
  if (!MY_TICKETS_URL_BASE) return "";
  // if base already has ?, append with &
  const sep = MY_TICKETS_URL_BASE.includes("?") ? "&" : "?";
  return `${MY_TICKETS_URL_BASE}${sep}order=${encodeURIComponent(orderRef)}`;
}

function pickShowImageUrl(order: NonNullable<OrderDeep>) {
  // optional, only if your Show model has an image field somewhere
  const anyShow = order.show as any;
  return (
    (anyShow?.imageUrl as string | undefined) ||
    (anyShow?.posterUrl as string | undefined) ||
    (anyShow?.artworkUrl as string | undefined) ||
    (anyShow?.heroImageUrl as string | undefined) ||
    ""
  );
}

function renderTicketsHtml(order: NonNullable<OrderDeep>) {
  const s = order.show;
  const v = s?.venue;

  const orderRef =
    ((order as any).publicId as string | undefined) ||
    ((order as any).reference as string | undefined) ||
    order.id;

  const showTitle = s?.title ?? "Your event";
  const whenFull = formatDateTimeUK(s?.date ?? null);
  const venueLine = [v?.name, v?.city].filter(Boolean).join(", ");

  const ticketCount = (order.tickets || []).length;
  const customerName =
    ((order as any).customerName as string | undefined) ||
    (order.user as any)?.name ||
    "";

  const ticketRows = (order.tickets || [])
    .map((t) => {
      const anyT = t as any;
      const seat =
        (anyT.seatLabel as string | undefined) ||
        (anyT.seatCode as string | undefined) ||
        (anyT.seatName as string | undefined) ||
        "";

      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a;">
            <div style="font-weight:600;">${escapeHtml(t.serial)}</div>
            ${t.holderName ? `<div style="color:#64748b;font-size:12px;margin-top:2px;">${escapeHtml(t.holderName)}</div>` : ""}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#0f172a; text-align:right;">
            ${seat ? `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#f1f5f9;color:#0f172a;font-size:12px;">${escapeHtml(seat)}</span>` : `<span style="color:#94a3b8;font-size:12px;">—</span>`}
          </td>
        </tr>
      `;
    })
    .join("");

  const ticketTypeSummary = (s?.ticketTypes || [])
    .map((tt) => `${tt.name} (£${(tt.pricePence / 100).toFixed(2)})`)
    .join(" · ");

  const preheader = `Your TixAll e-tickets for ${showTitle} are ready.`;
  const showImageUrl = pickShowImageUrl(order);
  const myTicketsUrl = buildMyTicketsUrl(orderRef);

  return `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(preheader)}
  </div>

  <div style="margin:0;padding:0;background:#f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"
       style="width:100%;max-width:640px;margin:0 auto;">
            <!-- Header bar -->
            <tr>
              <td style="background:${BRAND_COLOR};border-radius:14px 14px 0 0;padding:18px 18px 16px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      ${
                        LOGO_URL
                          ? `<img src="${escapeHtml(LOGO_URL)}" alt="TixAll" height="34" style="display:block;height:34px;max-width:220px;">`
                          : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;">TixAll</div>`
                      }
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#e6f6ff;">
                        Order <span style="font-weight:700;color:#ffffff;">#${escapeHtml(orderRef)}</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main card -->
            <tr>
              <td style="background:#ffffff;border-radius:0 0 14px 14px;padding:22px 18px;border:1px solid #e5e7eb;border-top:none;">
                <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
                  <div style="font-size:22px;font-weight:800;line-height:1.2;margin:0 0 6px;">
                    ${customerName ? `${escapeHtml(customerName)}, ` : ""}you’ve got tickets!
                  </div>
                  <div style="font-size:14px;color:#64748b;margin:0 0 18px;">
                    Keep your tickets handy — your e-tickets are attached as a PDF (one page per ticket).
                  </div>

                  ${
                    myTicketsUrl
                      ? `
                    <div style="margin:0 0 18px;">
                      <a href="${escapeHtml(myTicketsUrl)}"
                         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:700;
                                padding:12px 16px;border-radius:10px;font-size:14px;">
                        Go to My Tickets
                      </a>
                    </div>
                    `
                      : ""
                  }

                  <!-- Event block -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                    ${
                      showImageUrl
                        ? `
                      <tr>
                        <td style="background:#0b1220;">
                          <img src="${escapeHtml(showImageUrl)}" alt="${escapeHtml(showTitle)}"
                               style="display:block;width:100%;max-width:640px;height:auto;">
                        </td>
                      </tr>
                      `
                        : ""
                    }
                    <tr>
                      <td style="padding:16px 16px 12px 16px;">
                        <div style="font-size:18px;font-weight:800;margin:0 0 6px;">${escapeHtml(showTitle)}</div>
                        <div style="font-size:14px;color:#0f172a;margin:0 0 6px;">
                          <span style="font-weight:700;">${escapeHtml(formatDateUK(s?.date ?? null) || "—")}</span>
                          ${formatTimeUK(s?.date ?? null) ? ` at <span style="font-weight:700;">${escapeHtml(formatTimeUK(s?.date ?? null)!)}</span>` : ""}
                        </div>
                        ${
                          venueLine
                            ? `<div style="font-size:14px;color:#64748b;margin:0 0 10px;">${escapeHtml(venueLine)}</div>`
                            : ""
                        }

                     <div style="margin-top:10px;">
  <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#1e3a8a;font-size:12px;font-weight:700;margin:0 8px 8px 0;">
    ${ticketCount} × Ticket${ticketCount === 1 ? "" : "s"}
  </span>
  ${
    ticketTypeSummary
      ? `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#0f172a;font-size:12px;margin:0 8px 8px 0;">
           ${escapeHtml(ticketTypeSummary)}
         </span>`
      : ""
  }
</div>

                        </div>
                      </td>
                    </tr>

                    <!-- Ticket list -->
                    <tr>
                      <td style="padding:0 16px 16px 16px;">
                        <div style="font-size:13px;font-weight:800;margin:10px 0 8px;color:#0f172a;">Your ticket serials</div>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                               style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                          <tr>
                            <th align="left" style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:12px;color:#64748b;font-weight:700;">
                              Serial / Name
                            </th>
                            <th align="right" style="padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:12px;color:#64748b;font-weight:700;">
                              Seat
                            </th>
                          </tr>
                          ${ticketRows || ""}
                        </table>

                        <div style="font-size:12px;color:#64748b;margin-top:12px;line-height:1.5;">
                          On arrival, our staff will scan the QR code on each ticket page.
                          If you’ve printed the PDF, bring it with you — otherwise you can show it on your phone.
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- Footer -->
                  <div style="font-size:12px;color:#94a3b8;margin-top:16px;line-height:1.5;">
                    This is an automated email from TixAll. If you need help, reply to the organiser or contact support via our site.
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#9ca3af;font-size:11px;">
                © ${new Date().getFullYear()} TixAll
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}

function formatGBPFromPence(pence?: number | null) {
  if (typeof pence !== "number") return undefined;
  return `£${(pence / 100).toFixed(2)}`;
}

async function buildAttachments(order: NonNullable<OrderDeep>) {
  if (!ATTACH_PDFS) return [];
    console.log("[email] PDF_ATTACHMENTS enabled?", { ATTACH_PDFS });

  const s = order.show;
  const v = s?.venue;

  // Map ticketTypeId -> ticketType (if your Ticket model has ticketTypeId)
  const ticketTypes = s?.ticketTypes || [];

    const rawCount = (order.tickets || []).length;
  const nullSerialCount = (order.tickets || []).filter(t => !t.serial).length;

  console.log("[email] ticket rows for order", {
    orderId: order.id,
    rawTicketRows: rawCount,
    nullSerialCount,
  });


const tickets = (order.tickets || []).filter(t => !!t.serial).map((t) => {

  const anyT = t as any;

    const ticketTypeId = anyT.ticketTypeId as string | undefined;
    const linkedType = ticketTypeId
      ? ticketTypes.find((tt) => tt.id === ticketTypeId)
      : undefined;

    const ticketTypeName =
      linkedType?.name ?? (anyT.ticketTypeName as string | undefined) ?? undefined;

    const ticketPrice =
      linkedType?.pricePence != null ? formatGBPFromPence(linkedType.pricePence) : undefined;

    const seatLabel =
      (anyT.seatLabel as string | undefined) ||
      (anyT.seatCode as string | undefined) ||
      (anyT.seatName as string | undefined) ||
      undefined;

    return {
serial: t.serial!,
      ticketType: ticketTypeName,
      price: ticketPrice,
      seatLabel,
    };
  });

   console.log("[email] tickets going into PDF", {
    pdfTicketCount: tickets.length,
    exampleSerial: tickets[0]?.serial,
  });
  
  if (tickets.length === 0) return [];

  const anyShow = s as any;
  const doorsOpenText =
    (anyShow.doorsOpenTime as string | undefined) ||
    (anyShow.doorsOpen as string | undefined) ||
    undefined;

  const orderRef =
    ((order as any).publicId as string | undefined) ||
    ((order as any).reference as string | undefined) ||
    order.id;

  const meta = {
    orderRef,
    showTitle: s?.title ?? "Event",
    venueName: v?.name ?? undefined,
    venueAddress: v?.city ?? undefined,
    dateText: formatDateUK(s?.date ?? null),
    timeText: formatTimeUK(s?.date ?? null),
    doorsOpenText,
    bookedBy: ((order as any).customerName as string | undefined) ?? undefined,
    bookedAtText: order.createdAt ? formatDateUK(order.createdAt) : undefined,
    includeSummaryPage: INCLUDE_SUMMARY_PAGE,
  };

 try {
  const pdf = await buildOrderTicketsPdf(meta, tickets);

  console.log("[email] pdf built", { bytes: pdf.length });

  return [
    { filename: `tixall-tickets-${orderRef}.pdf`, content: pdf },
  ];
} catch (err) {
  console.error("[email] pdf build failed", err);
  return [];
}

}

export async function sendTicketsEmail(orderId: string, to?: string) {
  const order = await fetchOrderDeep(orderId);
  if (!order) return { ok: false, message: "Order not found" };

  if (!resend) {
    return { ok: true, message: "RESEND_API_KEY not configured – email skipped." };
  }

  const html = renderTicketsHtml(order);
  const attachments = await buildAttachments(order);

  const recipient = (to || order.email || "").trim();
  if (!recipient) return { ok: false, message: "No recipient email on order" };

  const subject =
    `Your tickets for ${order.show?.title ?? "your event"} – ` +
    (order.show?.date ? new Date(order.show.date).toLocaleDateString("en-GB") : "");

  console.log("[email] sendTicketsEmail", {
  orderId,
  recipient,
  attachPdfs: ATTACH_PDFS,
  tickets: order.tickets?.length ?? 0,
  attachments: attachments.length,
});

  await resend.emails.send({
    from: EMAIL_FROM,
    to: recipient,
    subject,
    html,
  attachments:
  attachments.length > 0
    ? attachments.map((a) => ({
        filename: a.filename,
        content: a.content, // Buffer (supported by Resend)
      }))
    : undefined,

  });

  return { ok: true };
}

export async function sendTestEmail(to: string) {
  if (!resend) return { ok: false, message: "RESEND_API_KEY not configured" };
  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Test email – TixAll",
    html: `<div style="font-family:Arial,sans-serif">This is a test email from TixAll.</div>`,
  });
  return { ok: true };
}
