import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';

export const router = Router();
router.get('/', requireAuth, async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id:true, email:true, name:true, role:true } });
  res.json(user);
});
router.get('/tickets', requireAuth, async (req: any, res) => {
  const tickets = await prisma.ticket.findMany({ where: { userId: req.user.sub }, include: { show: true } });
  res.json(tickets);
});
router.post('/export', requireAuth, async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, include: { orders: { include: { items: true } }, tickets: true } });
  await sendEmail(user!.email, 'Your Chuckl data export', `<pre>${JSON.stringify(user, null, 2)}</pre>`);
  res.json({ ok: true });
});
router.post('/delete', requireAuth, async (req: any, res) => {
  await prisma.user.update({ where: { id: req.user.sub }, data: { deletedAt: new Date() } });
  res.json({ ok: true });
});