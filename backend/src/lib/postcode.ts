export type PostcodeLookupResult = {
  postcode: string;
  city: string | null;
  county: string | null;
};

export function normalizePostcode(postcode: string) {
  return postcode.replace(/\s+/g, " ").trim().toUpperCase();
}

function cleanLocationValue(value: unknown): string | null {
  if (!value) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export async function lookupPostcode(postcode: string): Promise<PostcodeLookupResult | null> {
  const normalized = normalizePostcode(postcode);
  if (!normalized) return null;

  const response = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(normalized)}`,
    {
      headers: { accept: "application/json" },
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    status?: number;
    result?: Record<string, unknown> | null;
  };

  if (payload?.status !== 200 || !payload?.result) {
    return null;
  }

  const result = payload.result;
  const city =
    cleanLocationValue(result.post_town) ||
    cleanLocationValue(result.admin_district) ||
    cleanLocationValue(result.parish) ||
    cleanLocationValue(result.admin_ward) ||
    null;
  const county =
    cleanLocationValue(result.admin_county) ||
    cleanLocationValue(result.region) ||
    null;

  return {
    postcode: normalized,
    city,
    county,
  };
}
