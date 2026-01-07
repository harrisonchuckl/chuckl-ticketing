import { ensureRecommendationsBlock, ensureShowBlock, ensureUnsubscribeFooter } from '../../lib/email-marketing/rendering.js';
import { buildDefaultMergeContext, renderMergeTags } from '../../lib/email-marketing/merge-tags.js';

export type EditorStatePayload = {
  html?: string | null;
  css?: string | null;
  projectData?: any;
};

function buildHtmlFromEditorState(state?: EditorStatePayload | null) {
  const html = String(state?.html || '').trim();
  const css = String(state?.css || '').trim();
  return { html, css };
}

function sanitizeEmailHtml(html: string) {
  const withoutScripts = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  const withoutEvents = withoutScripts.replace(/\son\w+="[^"]*"/gi, '');
  const withoutEventsSingle = withoutEvents.replace(/\son\w+='[^']*'/gi, '');
  return withoutEventsSingle.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
    const hasTarget = /target=/.test(attrs);
    const hasRel = /rel=/.test(attrs);
    const nextAttrs = attrs
      .replace(/\s+rel=\"[^\"]*\"/i, '')
      .replace(/\s+rel='[^']*'/i, '');
    const targetAttr = hasTarget ? '' : ' target=\"_blank\"';
    const relAttr = ` rel=\"noopener noreferrer\"`;
    return `<a ${nextAttrs}${targetAttr}${hasRel ? '' : relAttr}>`;
  });
}

function inlineCss(html: string, css: string) {
  if (!css.trim()) return html;
  const rules = css
    .split('}')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [selector, body] = rule.split('{');
      if (!selector || !body) return null;
      return { selector: selector.trim(), style: body.trim() };
    })
    .filter(Boolean) as Array<{ selector: string; style: string }>;

  let output = html;
  for (const rule of rules) {
    if (rule.selector.startsWith('.')) {
      const className = rule.selector.slice(1);
      const regex = new RegExp(`(<[^>]+class=\"[^\"]*${className}[^\"]*\"[^>]*)(>)`, 'gi');
      output = output.replace(regex, (match, start, end) => {
        if (/style=/.test(start)) {
          return `${start.replace(/style=\"([^\"]*)\"/i, (_m: string, existing: string) => `style=\"${existing};${rule.style}\"`)}${end}`;
        }
        return `${start} style=\"${rule.style}\"${end}`;
      });
    } else if (/^[a-z]+$/i.test(rule.selector)) {
      const tag = rule.selector.toLowerCase();
      const regex = new RegExp(`(<${tag}[^>]*)(>)`, 'gi');
      output = output.replace(regex, (match, start, end) => {
        if (/style=/.test(start)) {
          return `${start.replace(/style=\"([^\"]*)\"/i, (_m: string, existing: string) => `style=\"${existing};${rule.style}\"`)}${end}`;
        }
        return `${start} style=\"${rule.style}\"${end}`;
      });
    }
  }
  return output;
}

export function compileEditorHtml(state?: EditorStatePayload | null): {
  compiledHtml: string;
} {
  const { html, css } = buildHtmlFromEditorState(state);
  const wrapped = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  const inlined = inlineCss(wrapped, css);
  const sanitized = sanitizeEmailHtml(inlined);
  return { compiledHtml: sanitized };
}

export function renderCompiledTemplate(options: {
  compiledHtml: string;
  mergeContext: ReturnType<typeof buildDefaultMergeContext>;
  unsubscribeUrl?: string | null;
  preferencesUrl?: string | null;
  recommendedShows?: string | null;
  recommendedAddonsHtml?: string | null;
  showContext?: {
    showTitle?: string | null;
    showDate?: string | null;
    showVenue?: string | null;
    showTown?: string | null;
    showCounty?: string | null;
    showUrl?: string | null;
  };
}): string {
  const merged = renderMergeTags(options.compiledHtml, options.mergeContext);
  let html = merged;
  html = ensureRecommendationsBlock(html, options.recommendedShows || null, options.recommendedAddonsHtml || null);
  html = ensureShowBlock(html, {
    showTitle: options.showContext?.showTitle || '',
    showDate: options.showContext?.showDate || '',
    showVenue: options.showContext?.showVenue || '',
    showTown: options.showContext?.showTown || '',
    showCounty: options.showContext?.showCounty || '',
    showUrl: options.showContext?.showUrl || '',
  });
  if (options.unsubscribeUrl) {
    html = ensureUnsubscribeFooter(html, options.unsubscribeUrl, options.preferencesUrl || null);
  }
  return html;
}
