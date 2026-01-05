export type EmailBlock = {
  id: string;
  type: string;
  content?: Record<string, any>;
  style?: Record<string, any>;
  settings?: Record<string, any>;
};

export type EmailDocument = {
  meta?: {
    showId?: string;
  };
  blocks?: EmailBlock[];
};

export type EmailRenderShow = {
  id: string;
  title?: string | null;
  date?: Date | string | null;
  imageUrl?: string | null;
  externalTicketUrl?: string | null;
  usesExternalTicketing?: boolean | null;
  slug?: string | null;
  venue?: { name?: string | null } | null;
  tags?: string[] | null;
};

export type EmailRenderOptions = {
  show?: EmailRenderShow | null;
  upcomingShows?: EmailRenderShow[];
  baseUrl?: string;
};

function escapeHtml(input: string) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function withPx(value: any, fallback: number) {
  if (value === null || value === undefined || value === "") return `${fallback}px`;
  const num = Number(value);
  if (Number.isFinite(num)) return `${num}px`;
  return `${fallback}px`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function resolveShowUrl(show: EmailRenderShow | null | undefined, baseUrl: string) {
  if (!show) return baseUrl;
  if (show.usesExternalTicketing && show.externalTicketUrl) return show.externalTicketUrl;
  const slug = show.slug || show.id;
  return `${baseUrl}/public/event/${encodeURIComponent(slug)}`;
}

function inlineStyle(parts: string[]) {
  return parts.filter(Boolean).join(" ");
}

function renderButton(label: string, url: string, style: Record<string, any>) {
  const bg = style.buttonColor || "#2563eb";
  const color = style.buttonTextColor || "#ffffff";
  const radius = withPx(style.borderRadius ?? 6, 6);
  const align = style.align || "center";
  const buttonHtml =
    `<a href="${escapeHtml(url || "#")}" style="display:inline-block;padding:12px 22px;background:${bg};color:${color};text-decoration:none;border-radius:${radius};font-weight:700;font-size:${withPx(style.fontSize || 16, 16)};">` +
    `${escapeHtml(label || "View")}` +
    `</a>`;
  return `<div style="text-align:${align};">${buttonHtml}</div>`;
}

function renderBlock(block: EmailBlock, options: EmailRenderOptions) {
  const content = block.content || {};
  const style = block.style || {};
  const padding = withPx(style.padding ?? 18, 18);
  const fontSize = withPx(style.fontSize ?? 16, 16);
  const color = style.color || "#111827";
  const background = style.backgroundColor || "#ffffff";
  const align = style.align || "left";
  const stackAttr = block.settings?.mobileStack ? " data-stack=\"1\"" : "";
  const cellStyle = inlineStyle([
    `padding:${padding};`,
    `text-align:${align};`,
    `background:${background};`,
    `color:${color};`,
    `font-size:${fontSize};`,
    "font-family:Arial,Helvetica,sans-serif;",
  ]);

  if (block.type === "Header") {
    return `<tr><td style="${cellStyle}"><div style="font-size:${withPx((style.fontSize || 24) + 6, 30)};font-weight:800;">${escapeHtml(content.text || "")}</div></td></tr>`;
  }

  if (block.type === "Text") {
    const text = escapeHtml(content.text || "").replace(/\n/g, "<br/>");
    return `<tr><td style="${cellStyle}"><div style="line-height:1.6;">${text}</div></td></tr>`;
  }

  if (block.type === "Image") {
    const img = content.url
      ? `<img src="${escapeHtml(content.url)}" alt="${escapeHtml(content.alt || "")}" style="display:block;width:100%;max-width:100%;border:0;" />`
      : `<div style="padding:24px;border:1px dashed #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">Image placeholder</div>`;
    const linked = content.linkUrl ? `<a href="${escapeHtml(content.linkUrl)}" style="text-decoration:none;">${img}</a>` : img;
    return `<tr><td style="${cellStyle}">${linked}</td></tr>`;
  }

  if (block.type === "Button") {
    return `<tr><td style="${cellStyle}">${renderButton(content.text || "Call to action", content.linkUrl || "#", style)}</td></tr>`;
  }

  if (block.type === "Divider") {
    const borderColor = style.borderColor || "#e5e7eb";
    return `<tr><td style="${cellStyle}"><div style="border-top:1px solid ${borderColor};"></div></td></tr>`;
  }

  if (block.type === "Spacer") {
    const height = withPx(style.height ?? 24, 24);
    return `<tr><td style="padding:0;background:${background};"><div style="height:${height};line-height:${height};">&nbsp;</div></td></tr>`;
  }

  if (block.type === "Social") {
    const links = Array.isArray(content.links) ? content.links : [];
    const linkHtml = links
      .filter((link: any) => link && (link.label || link.url))
      .map((link: any) => {
        const label = escapeHtml(link.label || link.url || "Link");
        const url = escapeHtml(link.url || "#");
        return `<a href="${url}" style="color:${color};text-decoration:none;margin-right:12px;">${label}</a>`;
      })
      .join("");
    return `<tr><td style="${cellStyle}"${stackAttr}><div style="text-align:${align};">${linkHtml || "<span style=\"color:#6b7280;font-size:12px;\">Add social links</span>"}</div></td></tr>`;
  }

  if (block.type === "Footer") {
    const text = escapeHtml(content.text || "").replace(/\n/g, "<br/>");
    return `<tr><td style="${cellStyle}"><div style="font-size:${fontSize};line-height:1.5;">${text}</div></td></tr>`;
  }

  if (block.type === "ShowHero") {
    const show = options.show;
    const showTitle = escapeHtml(show?.title || "Featured show");
    const showDate = formatDate(show?.date || "");
    const venueName = escapeHtml(show?.venue?.name || "");
    const image = show?.imageUrl
      ? `<img src="${escapeHtml(show.imageUrl)}" alt="${showTitle}" style="display:block;width:100%;max-width:100%;border-radius:8px;" />`
      : `<div style="height:160px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:12px;">Show image</div>`;
    const info = `
      <div style="font-weight:700;font-size:18px;margin-bottom:6px;">${showTitle}</div>
      <div style="color:#6b7280;font-size:13px;margin-bottom:4px;">${escapeHtml(showDate)}</div>
      <div style="color:#6b7280;font-size:13px;">${venueName}</div>
    `;
    const html =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"${stackAttr}>
        <tr>
          <td class="stack-col" style="width:50%;padding-right:10px;vertical-align:top;">${image}</td>
          <td class="stack-col" style="width:50%;vertical-align:top;">${info}</td>
        </tr>
      </table>`;
    return `<tr><td style="${cellStyle}">${html}</td></tr>`;
  }

  if (block.type === "ShowCTA") {
    const showUrl = resolveShowUrl(options.show || null, options.baseUrl || "");
    return `<tr><td style="${cellStyle}">${renderButton(content.text || "Get tickets", content.linkUrl || showUrl, style)}</td></tr>`;
  }

  if (block.type === "ShowLineup") {
    const tags = options.show?.tags || [];
    if (!tags.length) return "";
    const title = escapeHtml(content.title || "Lineup");
    const items = tags.map((tag) => `<span style="display:inline-block;padding:6px 10px;border:1px solid #e5e7eb;border-radius:999px;margin:4px;font-size:12px;">${escapeHtml(tag)}</span>`).join("");
    return `<tr><td style="${cellStyle}"><div style="font-weight:700;margin-bottom:6px;">${title}</div><div>${items}</div></td></tr>`;
  }

  if (block.type === "UpcomingShowsList") {
    const upcoming = options.upcomingShows || [];
    const title = escapeHtml(content.title || "Upcoming shows");
    const listItems = upcoming.length
      ? upcoming
          .slice(0, 4)
          .map((show) => {
            const url = resolveShowUrl(show, options.baseUrl || "");
            return `<tr>
              <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                <a href="${escapeHtml(url)}" style="text-decoration:none;color:${color};font-weight:700;">${escapeHtml(show.title || "Untitled show")}</a>
                <div style="font-size:12px;color:#6b7280;">${escapeHtml(formatDate(show.date || ""))}${show.venue?.name ? ` · ${escapeHtml(show.venue.name || "")}` : ""}</div>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td style="padding:8px 0;color:#6b7280;font-size:12px;">No upcoming shows yet.</td></tr>`;
    return `<tr><td style="${cellStyle}"><div style="font-weight:700;margin-bottom:6px;">${title}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listItems}</table></td></tr>`;
  }

  return "";
}

export function renderEmailDocument(document: EmailDocument, options: EmailRenderOptions = {}) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const rows = blocks.map((block) => renderBlock(block, options)).filter(Boolean).join("");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Email preview</title>
    <style>
      @media only screen and (max-width: 620px){
        [data-stack="1"] .stack-col{display:block !important;width:100% !important;padding-right:0 !important;}
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { html };
}
