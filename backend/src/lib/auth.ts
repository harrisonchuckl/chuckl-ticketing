// backend/src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = (process.env.JWT_SECRET || 'dev-secret-change-me').toString();
const SECRET = new TextEncoder().encode(JWT_SECRET);

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function signUserJwt(user: SafeUser) {
  return await new SignJWT(user)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as SafeUser;
}
