import {
  applyPersonalisationTokens,
  resolvePersonalisationTokens,
  type PersonalisationContext,
  type PersonalisationTokens,
} from "../../services/marketing/personalisation.js";

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
  eventCategory?: string | null;
  ticketsRemaining?: number | null;
};

export type EmailRenderOptions = {
  show?: EmailRenderShow | null;
  upcomingShows?: EmailRenderShow[];
  baseUrl?: string;
  personalisation?: PersonalisationContext;
};

function escapeHtml(input: string) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeVideoUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function getVideoEmbedInfo(rawUrl: string) {
  const safeUrl = normalizeVideoUrl(rawUrl);
  if (!safeUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(safeUrl);
  } catch (error) {
    return null;
  }
  const hostname = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname;
  if (hostname === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0];
    if (id) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (hostname.endsWith("youtube.com")) {
    const id = parsed.searchParams.get("v") || path.split("/").filter(Boolean).pop();
    if (id) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (hostname.endsWith("vimeo.com")) {
    const id = path.split("/").filter(Boolean).pop();
    if (id) return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
  }
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(path)) {
    return { type: "video", src: safeUrl };
  }
  return { type: "iframe", src: safeUrl };
}

function renderVideoEmbed(rawUrl: string, label = "Video") {
  const info = getVideoEmbedInfo(rawUrl);
  if (!info) return "";
  if (info.type === "video") {
    return `
      <div style="position:relative;padding-top:56.25%;background:#0f172a;border-radius:12px;overflow:hidden;">
        <video controls src="${escapeHtml(info.src)}" aria-label="${escapeHtml(label)}" style="position:absolute;inset:0;width:100%;height:100%;"></video>
      </div>
    `;
  }
  return `
    <div style="position:relative;padding-top:56.25%;background:#0f172a;border-radius:12px;overflow:hidden;">
      <iframe
        src="${escapeHtml(info.src)}"
        title="${escapeHtml(label)}"
        style="position:absolute;inset:0;width:100%;height:100%;border:0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  `;
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

function resolveText(input: string, tokens: PersonalisationTokens) {
  return applyPersonalisationTokens(String(input || ""), tokens);
}

function renderShowList(params: {
  shows: EmailRenderShow[];
  color: string;
  baseUrl: string;
}) {
  const { shows, color, baseUrl } = params;
  return shows
    .map((show) => {
      const url = resolveShowUrl(show, baseUrl);
      return `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <a href="${escapeHtml(url)}" style="text-decoration:none;color:${color};font-weight:700;">${escapeHtml(
            show.title || "Untitled show"
          )}</a>
          <div style="font-size:12px;color:#6b7280;">${escapeHtml(formatDate(show.date || ""))}${
        show.venue?.name ? ` · ${escapeHtml(show.venue.name || "")}` : ""
      }</div>
        </td>
      </tr>`;
    })
    .join("");
}

function pickRecommendedShows(
  upcoming: EmailRenderShow[],
  affinity: { category?: string; venue?: string }
) {
  const category = String(affinity.category || "").toLowerCase();
  const venue = String(affinity.venue || "").toLowerCase();
  const scored = upcoming
    .map((show) => {
      let score = 0;
      if (category && show.eventCategory && show.eventCategory.toLowerCase() === category) score += 2;
      if (venue && show.venue?.name && show.venue.name.toLowerCase() === venue) score += 1;
      return { show, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.map((item) => item.show);
}

function renderBlock(block: EmailBlock, options: EmailRenderOptions, tokens: PersonalisationTokens) {
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
    const text = resolveText(content.text || "", tokens);
    return `<tr><td style="${cellStyle}"><div style="font-size:${withPx((style.fontSize || 24) + 6, 30)};font-weight:800;">${escapeHtml(text)}</div></td></tr>`;
  }

  if (block.type === "Text") {
    const text = escapeHtml(resolveText(content.text || "", tokens)).replace(/\n/g, "<br/>");
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
    const label = resolveText(content.text || "Call to action", tokens);
    const url = resolveText(content.linkUrl || "#", tokens);
    return `<tr><td style="${cellStyle}">${renderButton(label, url, style)}</td></tr>`;
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
    const text = escapeHtml(resolveText(content.text || "", tokens)).replace(/\n/g, "<br/>");
    return `<tr><td style="${cellStyle}"><div style="font-size:${fontSize};line-height:1.5;">${text}</div></td></tr>`;
  }

  if (block.type === "Video" || block.type === "video") {
    const videoUrl = resolveText(content.url || content.linkUrl || "", tokens);
    if (!videoUrl) return "";
    const embed = renderVideoEmbed(videoUrl, content.title || "Video");
    if (!embed) return "";
    return `<tr><td style="${cellStyle}">${embed}</td></tr>`;
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
    const label = resolveText(content.text || "Get tickets", tokens);
    const url = resolveText(content.linkUrl || showUrl, tokens);
    return `<tr><td style="${cellStyle}">${renderButton(label, url, style)}</td></tr>`;
  }

  if (block.type === "ShowLineup") {
    const tags = options.show?.tags || [];
    if (!tags.length) return "";
    const title = escapeHtml(resolveText(content.title || "Lineup", tokens));
    const items = tags.map((tag) => `<span style="display:inline-block;padding:6px 10px;border:1px solid #e5e7eb;border-radius:999px;margin:4px;font-size:12px;">${escapeHtml(tag)}</span>`).join("");
    return `<tr><td style="${cellStyle}"><div style="font-weight:700;margin-bottom:6px;">${title}</div><div>${items}</div></td></tr>`;
  }

  if (block.type === "UpcomingShowsList") {
    const upcoming = options.upcomingShows || [];
    const title = escapeHtml(resolveText(content.title || "Upcoming shows", tokens));
    const listItems = upcoming.length
      ? renderShowList({ shows: upcoming.slice(0, 4), color, baseUrl: options.baseUrl || "" })
      : `<tr><td style="padding:8px 0;color:#6b7280;font-size:12px;">No upcoming shows yet.</td></tr>`;
    return `<tr><td style="${cellStyle}"><div style="font-weight:700;margin-bottom:6px;">${title}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listItems}</table></td></tr>`;
  }

  if (block.type === "RecommendedForYou") {
    const upcoming = options.upcomingShows || [];
    const picks = pickRecommendedShows(upcoming, {
      category: tokens.topCategory,
      venue: tokens.favouriteVenue,
    }).slice(0, 4);
    const title = escapeHtml(resolveText(content.title || "Recommended for you", tokens));
    const listItems = picks.length
      ? renderShowList({ shows: picks, color, baseUrl: options.baseUrl || "" })
      : `<tr><td style="padding:8px 0;color:#6b7280;font-size:12px;">No recommendations yet.</td></tr>`;
    return `<tr><td style="${cellStyle}"><div style="font-weight:700;margin-bottom:6px;">${title}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listItems}</table></td></tr>`;
  }

  if (block.type === "BecauseYouLiked") {
    const upcoming = options.upcomingShows || [];
    const affinityLabel = tokens.topCategory || tokens.favouriteVenue;
    if (!affinityLabel) return "";
    const matches = pickRecommendedShows(upcoming, {
      category: tokens.topCategory,
      venue: tokens.favouriteVenue,
    }).filter((show) => {
      if (tokens.topCategory && show.eventCategory) {
        if (show.eventCategory.toLowerCase() === tokens.topCategory.toLowerCase()) return true;
      }
      if (tokens.favouriteVenue && show.venue?.name) {
        if (show.venue.name.toLowerCase() === tokens.favouriteVenue.toLowerCase()) return true;
      }
      return false;
    });
    const list = (matches.length ? matches : upcoming).slice(0, 4);
    const fallbackTitle = `Because you liked ${affinityLabel}`;
    const title = escapeHtml(resolveText(content.title || fallbackTitle, tokens));
    const listItems = list.length
      ? renderShowList({ shows: list, color, baseUrl: options.baseUrl || "" })
      : `<tr><td style="padding:8px 0;color:#6b7280;font-size:12px;">More shows coming soon.</td></tr>`;
    return `<tr><td style="${cellStyle}"><div style="font-weight:700;margin-bottom:6px;">${title}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listItems}</table></td></tr>`;
  }

  if (block.type === "BringTheGroup") {
    const isGroupBuyer = options.personalisation?.groupBuyerScore === true;
    const defaultCopy =
      content.defaultCopy || "Make it a night out — invite friends and save seats together.";
    const groupCopy =
      content.groupCopy || "Bring the whole crew back. Lock in seats for the group before they go.";
    const copy = isGroupBuyer ? groupCopy : defaultCopy;
    const resolved = escapeHtml(resolveText(copy, tokens)).replace(/\n/g, "<br/>");
    return `<tr><td style="${cellStyle}"><div style="background:#f1f5f9;border-radius:12px;padding:16px;font-weight:600;line-height:1.5;">${resolved}</div></td></tr>`;
  }

  if (block.type === "UrgencyBanner") {
    const remaining = options.show?.ticketsRemaining ?? null;
    const threshold = Number(content.threshold ?? 20);
    if (!Number.isFinite(remaining) || remaining === null || remaining > threshold) return "";
    const showTitle = options.show?.title || "this show";
    const rawText =
      content.text || `Hurry — only ${Math.max(0, remaining)} tickets left for ${showTitle}.`;
    const message = escapeHtml(resolveText(rawText, tokens))
      .replace(/\{remaining\}/g, String(Math.max(0, Number(remaining))))
      .replace(/\{showTitle\}/g, escapeHtml(showTitle));
    return `<tr><td style="${cellStyle}"><div style="background:#fee2e2;border-radius:12px;padding:12px;text-align:center;font-weight:700;color:#991b1b;">${message}</div></td></tr>`;
  }

  return "";
}

export function renderEmailDocument(document: EmailDocument, options: EmailRenderOptions = {}) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const tokens = resolvePersonalisationTokens(options.personalisation);
  const rows = blocks.map((block) => renderBlock(block, options, tokens)).filter(Boolean).join("");
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
