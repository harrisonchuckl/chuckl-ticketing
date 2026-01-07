const DEFAULT_SECTION_STYLE = 'margin:16px 0 0 0;';
const CARD_STYLE = 'border:1px solid #e5e7eb;border-radius:10px;padding:12px;';
const TITLE_STYLE = 'font-size:15px;font-weight:600;margin:0 0 6px 0;color:#111827;';
const META_STYLE = 'font-size:13px;color:#6b7280;margin:0;';

export type RecommendedShow = {
  title: string;
  date?: Date | string | null;
  venueName?: string | null;
  town?: string | null;
  county?: string | null;
  bookingUrl?: string | null;
  imageUrl?: string | null;
  reason?: string | null;
};

export type RecommendedAddon = {
  title: string;
  description?: string | null;
  price?: string | null;
  url?: string | null;
  imageUrl?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatShowDate(date?: Date | string | null) {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }
  return String(date);
}

function renderLink(url: string | null | undefined, content: string) {
  if (!url) return content;
  return `<a href="${url}" style="text-decoration:none;color:inherit;">${content}</a>`;
}

export function buildRecommendedShowsHtml(recs: RecommendedShow[] = []): string {
  if (!recs.length) return '';

  const rows = recs
    .map((show) => {
      const dateLabel = formatShowDate(show.date);
      const venueBits = [show.venueName, show.town, show.county].filter(Boolean).join(' • ');
      const meta = [dateLabel, venueBits].filter(Boolean).join(' • ');
      const imageCell = show.imageUrl
        ? `
          <td style="padding:0 12px 0 0;width:96px;vertical-align:top;">
            ${renderLink(
              show.bookingUrl,
              `<img src="${show.imageUrl}" alt="" width="96" style="display:block;border-radius:8px;max-width:96px;height:auto;" />`
            )}
          </td>
        `
        : '';
      const body = `
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="${CARD_STYLE}">
          <tr>
            ${imageCell}
            <td style="vertical-align:top;">
              <p style="${TITLE_STYLE}">${escapeHtml(show.title || 'Untitled show')}</p>
              ${meta ? `<p style="${META_STYLE}">${escapeHtml(meta)}</p>` : ''}
              ${show.reason ? `<p style="${META_STYLE}">${escapeHtml(show.reason)}</p>` : ''}
            </td>
          </tr>
        </table>
      `;
      return `
        <tr>
          <td style="padding:0 0 12px 0;">
            ${renderLink(show.bookingUrl, body)}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="${DEFAULT_SECTION_STYLE}">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}

export function buildRecommendedAddonsHtml(recs: RecommendedAddon[] = []): string {
  if (!recs.length) return '';

  const rows = recs
    .map((addon) => {
      const title = escapeHtml(addon.title || 'Recommended add-on');
      const desc = addon.description ? escapeHtml(addon.description) : '';
      const price = addon.price ? escapeHtml(addon.price) : '';
      const imageCell = addon.imageUrl
        ? `
          <td style="padding:0 12px 0 0;width:80px;vertical-align:top;">
            ${renderLink(
              addon.url,
              `<img src="${addon.imageUrl}" alt="" width="80" style="display:block;border-radius:8px;max-width:80px;height:auto;" />`
            )}
          </td>
        `
        : '';
      const body = `
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="${CARD_STYLE}">
          <tr>
            ${imageCell}
            <td style="vertical-align:top;">
              <p style="${TITLE_STYLE}">${title}</p>
              ${desc ? `<p style="${META_STYLE}">${desc}</p>` : ''}
              ${price ? `<p style="${META_STYLE}">${price}</p>` : ''}
            </td>
          </tr>
        </table>
      `;
      return `
        <tr>
          <td style="padding:0 0 12px 0;">
            ${renderLink(addon.url, body)}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="${DEFAULT_SECTION_STYLE}">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}
