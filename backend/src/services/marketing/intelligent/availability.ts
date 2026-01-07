import { OrderStatus } from '@prisma/client';
import prisma from '../../../lib/prisma.js';
import { computeCapacity } from '../../smart-shows-analytics.js';

export async function getRemainingTickets(showId: string): Promise<number | null> {
  if (!showId) return null;

  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      showCapacity: true,
      ticketTypes: { select: { available: true } },
    },
  });

  if (!show) return null;

  const capacity = computeCapacity({
    showCapacity: show.showCapacity,
    ticketTypes: show.ticketTypes,
  });

  if (capacity === null) return null;

  const soldAgg = await prisma.ticket.aggregate({
    where: {
      showId: show.id,
      order: { status: OrderStatus.PAID },
    },
    _sum: { quantity: true },
  });

  const soldCount = Number(soldAgg._sum.quantity || 0);
  const remaining = Math.max(0, capacity - soldCount);
  return Number.isFinite(remaining) ? remaining : null;
}
