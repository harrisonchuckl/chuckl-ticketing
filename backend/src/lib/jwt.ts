// backend/src/lib/jwt.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type UserTokenPayload = {
  id: string;
  email: string;
  name: string | null;
};

const rawSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
const secretKey = new TextEncoder().encode(rawSecret);

/**
 * Create a signed JWT for the organiser user.
 * Default expiry: 7 days.
 */
export async function signUserJwt(
  payload: UserTokenPayload,
  expiresIn: string = '7d'
): Promise<string> {
  return await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/**
 * Verify a JWT (string) and return the typed payload.
 * Throws if invalid/expired.
 */
export async function verifyUserJwt(token: string): Promise<UserTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey);
  return {
    id: String(payload.id),
    email: String(payload.email),
    name: (payload.name ?? null) as string | null,
  };
}
