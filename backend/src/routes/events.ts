import { Router } from 'express';
import { prisma } from '../db.js';
export const router = Router();
router.get('/', async (_req, res) => {
  const shows = await prisma.show.findMany({ where: { status: { in: ['ON_SALE','LIVE'] } }, orderBy: { startsAtUTC: 'asc' },
    include: { venue: true, ticketTypes: { orderBy: { sort: 'asc' } } } });
  res.json(shows);
});
router.get('/:id', async (req, res) => {
  const show = await prisma.show.findUnique({ where: { id: req.params.id }, include: { venue: true, ticketTypes: { orderBy: { sort: 'asc' } } } });
  if(!show) return res.status(404).json({ error: 'not_found' }); res.json(show);
});