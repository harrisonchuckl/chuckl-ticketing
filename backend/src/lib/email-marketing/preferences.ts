const SECRET = process.env.MARKETING_PREFERENCES_SECRET || process.env.MARKETING_UNSUBSCRIBE_SECRET || 'dev-preferences-secret';
const DEFAULT_EXP_DAYS = Number(process.env.MARKETING_PREFERENCES_EXP_DAYS || 90);

export type PreferencesPayload = {
  tenantId: string;
  email: string;
  exp: number;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signature(body: string) {
  return base64UrlEncode(
    require('crypto').createHmac('sha256', SECRET).update(body).digest('hex')
  );
}

export function createPreferencesToken(payload: Omit<PreferencesPayload, 'exp'> & { exp?: number }): string {
  const exp = payload.exp ?? Math.floor(Date.now() / 1000) + DEFAULT_EXP_DAYS * 24 * 60 * 60;
  const body: PreferencesPayload = { tenantId: payload.tenantId, email: payload.email, exp };
  const encoded = base64UrlEncode(JSON.stringify(body));
  const sig = signature(encoded);
  return `${encoded}.${sig}`;
}

export function verifyPreferencesToken(token: string): PreferencesPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (signature(encoded) !== sig) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as PreferencesPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
