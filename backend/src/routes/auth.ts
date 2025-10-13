import { Router } from 'express';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword, issueJwt } from '../utils/security.js';
import { z } from 'zod';
export const router = Router();
const Register = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() });
router.post('/register', async (req, res) => {
  const body = Register.safeParse(req.body); if(!body.success) return res.status(400).json(body.error);
  const { email, password, name } = body.data;
  if(await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'email_exists' });
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), name } });
  const jwt = await issueJwt(user.id, user.role);
  res.json({ token: jwt, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
const Login = z.object({ email: z.string().email(), password: z.string() });
router.post('/login', async (req, res) => {
  const body = Login.safeParse(req.body); if(!body.success) return res.status(400).json(body.error);
  const { email, password } = body.data;
  const user = await prisma.user.findUnique({ where: { email } }); if(!user) return res.status(401).json({ error: 'invalid_credentials' });
  if(!await verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: 'invalid_credentials' });
  const jwt = await issueJwt(user.id, user.role);
  res.json({ token: jwt, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});