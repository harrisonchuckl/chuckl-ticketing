export type PersonalisationContext = {
  contact?: {
    firstName?: string | null;
    lastName?: string | null;
    town?: string | null;
  } | null;
  lastShowAttended?: string | null;
  favouriteVenue?: string | null;
  topCategory?: string | null;
  groupBuyerScore?: boolean | null;
  groupBuyerLabel?: string | null;
};

export type PersonalisationTokens = Record<string, string>;

export function resolvePersonalisationTokens(context: PersonalisationContext | undefined): PersonalisationTokens {
  const tokens: PersonalisationTokens = {};
  const safe = context || {};

  tokens.firstName = String(safe.contact?.firstName || "");
  tokens.town = String(safe.contact?.town || "");
  tokens.lastShowAttended = String(safe.lastShowAttended || "");
  tokens.favouriteVenue = String(safe.favouriteVenue || "");
  tokens.topCategory = String(safe.topCategory || "");

  if (safe.groupBuyerLabel) {
    tokens.groupBuyerLabel = String(safe.groupBuyerLabel);
  } else if (safe.groupBuyerScore === true) {
    tokens.groupBuyerLabel = "Group buyer";
  } else if (safe.groupBuyerScore === false) {
    tokens.groupBuyerLabel = "Solo buyer";
  } else {
    tokens.groupBuyerLabel = "";
  }

  return tokens;
}

export function applyPersonalisationTokens(text: string, tokens: PersonalisationTokens): string {
  if (!text) return "";
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(tokens, key)) return match;
    const value = tokens[key];
    return value ?? "";
  });
}

export function buildPreviewPersonalisationContext(input?: {
  showTitle?: string | null;
  venueName?: string | null;
  topCategory?: string | null;
}): PersonalisationContext {
  return {
    contact: {
      firstName: "Alex",
      lastName: "Morgan",
      town: "Brighton",
    },
    lastShowAttended: input?.showTitle || "Late Night Laughs",
    favouriteVenue: input?.venueName || "The Grand Theatre",
    topCategory: input?.topCategory || "Comedy",
    groupBuyerScore: true,
    groupBuyerLabel: "Group buyer",
  };
}
