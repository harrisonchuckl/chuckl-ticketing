export type MarketingTemplateVariables = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  tenantName?: string | null;
  unsubscribeUrl?: string | null;
};

export function interpolateTemplate(template: string, variables: MarketingTemplateVariables): string {
  let output = template;
  const entries = Object.entries(variables);
  for (const [key, value] of entries) {
    const safeValue = value == null ? '' : String(value);
    output = output.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), safeValue);
  }
  return output;
}

export function ensureUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  if (html.includes(unsubscribeUrl)) {
    return html;
  }

  const footer = `
    <div style="margin-top:24px;font-size:12px;color:#6b7280;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <p style="margin:0 0 8px 0;">You are receiving this email because you opted in to marketing updates.</p>
      <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#2563eb;">Unsubscribe</a></p>
    </div>
  `;

  return `${html}${footer}`;
}

export function renderMarketingTemplate(
  mjmlBody: string,
  variables: MarketingTemplateVariables
): { html: string; errors: string[] } {
  const mjmlWithVars = interpolateTemplate(mjmlBody, variables);
  const compiled = compileMjml(mjmlWithVars);
  let html = compiled.html;
  html = interpolateTemplate(html, variables);

  if (variables.unsubscribeUrl) {
    html = ensureUnsubscribeFooter(html, variables.unsubscribeUrl);
  }

  return { html, errors: compiled.errors };
}

function compileMjml(mjmlBody: string): { html: string; errors: string[] } {
  let html = mjmlBody;
  html = html.replace(/<mjml[^>]*>/gi, '<html>');
  html = html.replace(/<\/mjml>/gi, '</html>');
  html = html.replace(/<mj-head[^>]*>[\\s\\S]*?<\\/mj-head>/gi, '');
  html = html.replace(/<mj-body[^>]*>/gi, '<body>');
  html = html.replace(/<\/mj-body>/gi, '</body>');
  html = html.replace(/<mj-section[^>]*>/gi, '<div>');
  html = html.replace(/<\/mj-section>/gi, '</div>');
  html = html.replace(/<mj-column[^>]*>/gi, '<div>');
  html = html.replace(/<\/mj-column>/gi, '</div>');
  html = html.replace(/<mj-text[^>]*>/gi, '<div>');
  html = html.replace(/<\/mj-text>/gi, '</div>');

  return { html, errors: [] };
}
