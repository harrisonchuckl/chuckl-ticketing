import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
export const router = Router();
const ShowInput = z.object({ title: z.string(), startsAtUTC: z.string(), venueId: z.string(), capacity: z.number().int().min(0), description: z.string().optional(), trailerUrl: z.string().url().optional() });
router.post('/shows', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const body = ShowInput.safeParse(req.body); if(!body.success) return res.status(400).json(body.error);
  const show = await prisma.show.create({ data: { ...body.data, startsAtUTC: new Date(body.data.startsAtUTC) } }); res.json(show);
});
router.patch('/shows/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const body = ShowInput.partial().safeParse(req.body); if(!body.success) return res.status(400).json(body.error);
  const show = await prisma.show.update({ where: { id: req.params.id }, data: { ...body.data, ...(body.data.startsAtUTC? { startsAtUTC: new Date(body.data.startsAtUTC) } : {}) } }); res.json(show);
});
const TicketTypeInput = z.object({ name: z.string(), pricePence: z.number().int().min(0), allocation: z.number().int().min(0), sort: z.number().int().optional() });
router.post('/shows/:id/ticket-types', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const body = TicketTypeInput.safeParse(req.body); if(!body.success) return res.status(400).json(body.error);
  const tt = await prisma.ticketType.create({ data: { showId: req.params.id, ...body.data } }); res.json(tt);
});