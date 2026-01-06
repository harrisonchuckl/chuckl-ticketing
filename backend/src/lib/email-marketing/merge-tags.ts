export type MergeContext = Record<string, any>;

export function resolveMergeTag(path: string, context: MergeContext): string {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  let current: any = context;
  for (const part of parts) {
    if (current == null || typeof current !== 'object' || !(part in current)) {
      return '';
    }
    current = current[part];
  }
  if (current == null) return '';
  return String(current);
}

export function renderMergeTags(template: string, context: MergeContext): string {
  if (!template) return template;
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, path) => resolveMergeTag(path, context));
}

export function buildDefaultMergeContext(options: {
  contact?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    town?: string | null;
    county?: string | null;
    tags?: string[] | null;
  };
  show?: {
    title?: string | null;
    venue?: string | null;
    date?: string | null;
    time?: string | null;
    priceFrom?: string | number | null;
    image?: string | null;
  };
  links?: {
    ticketLink?: string | null;
    managePreferencesLink?: string | null;
    unsubscribeLink?: string | null;
  };
}) {
  const contact = options.contact || {};
  const show = options.show || {};
  const links = options.links || {};

  return {
    contact: {
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      town: contact.town || '',
      county: contact.county || '',
      tags: contact.tags || [],
    },
    show: {
      title: show.title || '',
      venue: show.venue || '',
      date: show.date || '',
      time: show.time || '',
      priceFrom: show.priceFrom || '',
      image: show.image || '',
    },
    links: {
      ticketLink: links.ticketLink || '',
      managePreferencesLink: links.managePreferencesLink || '',
      unsubscribeLink: links.unsubscribeLink || '',
    },
    ticketLink: links.ticketLink || '',
    managePreferencesLink: links.managePreferencesLink || '',
    unsubscribeLink: links.unsubscribeLink || '',
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
  };
}
