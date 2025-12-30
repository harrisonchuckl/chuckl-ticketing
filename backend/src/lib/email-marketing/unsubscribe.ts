import crypto from 'crypto';

const SECRET = process.env.MARKETING_UNSUBSCRIBE_SECRET || 'dev-unsubscribe-secret';
const DEFAULT_EXP_DAYS = Number(process.env.MARKETING_UNSUBSCRIBE_EXP_DAYS || 90);

export type UnsubscribePayload = {
  tenantId: string;
  email: string;
  exp: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

export function createUnsubscribeToken(payload: Omit<UnsubscribePayload, 'exp'> & { exp?: number }): string {
  const exp = payload.exp ?? Math.floor(Date.now() / 1000 + DEFAULT_EXP_DAYS * 24 * 60 * 60);
  const body: UnsubscribePayload = { tenantId: payload.tenantId, email: payload.email, exp };
  const encoded = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as UnsubscribePayload;
    if (!payload?.tenantId || !payload?.email || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
