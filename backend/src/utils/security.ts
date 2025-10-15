import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || process.env.JOSE_SECRET || '';
if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set. Set it in Railway → Variables for proper auth.');
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Create a compact JWT with HS256
export async function createJwt(payload: Record<string, any>, expiresInSeconds = 60 * 60 * 24) {
  const secret = new TextEncoder().encode(JWT_SECRET || 'dev-secret-only');
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secret);
}

export async function verifyJwt<T = any>(token: string): Promise<T | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET || 'dev-secret-only');
    const { payload } = await jwtVerify(token, secret);
    return payload as T;
  } catch {
    return null;
  }
}
