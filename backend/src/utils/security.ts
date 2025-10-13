import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev');
export async function hashPassword(pw: string){ return bcrypt.hash(pw, 10); }
export async function verifyPassword(pw: string, hash: string){ return bcrypt.compare(pw, hash); }
export async function issueJwt(sub: string, role: string){
  const iat = Math.floor(Date.now()/1000);
  return await new SignJWT({ role }).setProtectedHeader({ alg: 'HS256' })
   .setIssuedAt(iat).setIssuer(process.env.JWT_ISSUER||'chuckl').setAudience(process.env.JWT_AUDIENCE||'chuckl-users')
   .setExpirationTime('1h').setSubject(sub).sign(secret);
}
export async function verifyJwt(token: string){
  const { payload } = await jwtVerify(token, secret, { issuer: process.env.JWT_ISSUER||'chuckl', audience: process.env.JWT_AUDIENCE||'chuckl-users' });
  return payload;
}