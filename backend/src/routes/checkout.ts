import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db.js';
import { z } from 'zod';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
export const router = Router();
const CheckoutReq = z.object({ showId: z.string(), items: z.array(z.object({ ticketTypeId: z.string(), quantity: z.number().int().min(1).max(10) })), email: z.string().email() });
router.post('/create', async (req, res) => {
  const body = CheckoutReq.safeParse(req.body); if(!body.success) return res.status(400).json(body.error);
  const { showId, items, email } = body.data;
  const show = await prisma.show.findUnique({ where: { id: showId }, include: { ticketTypes: true } });
  if(!show) return res.status(404).json({ error: 'show_not_found' });
  let amount = 0; for(const it of items){ const tt = show.ticketTypes.find(t=>t.id===it.ticketTypeId);
    if(!tt) return res.status(400).json({ error: 'ticket_type_invalid' });
    if(tt.sold + it.quantity > tt.allocation) return res.status(400).json({ error: 'sold_out' });
    amount += it.quantity * tt.pricePence; }
  const order = await prisma.order.create({ data: { email, showId, amountPence: amount, quantity: items.reduce((a,b)=>a+b.quantity,0), status:'PENDING',
    items: { create: items.map(i => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity, unitPence: show.ticketTypes.find(t=>t.id===i.ticketTypeId)!.pricePence })) } } });
  const session = await stripe.checkout.sessions.create({ mode:'payment', customer_email: email,
    line_items: items.map(i=>{ const tt=show.ticketTypes.find(t=>t.id===i.ticketTypeId)!; return { price_data:{ currency: process.env.STRIPE_CURRENCY||'gbp', product_data:{ name: `${show.title} — ${tt.name}`}, unit_amount: tt.pricePence }, quantity: i.quantity }; }),
    metadata: { orderId: order.id, showId: show.id }, success_url: `${process.env.PUBLIC_BASE_URL}/success?orderId=${order.id}`, cancel_url: `${process.env.PUBLIC_BASE_URL}/events/${show.id}` });
  await prisma.order.update({ where: { id: order.id }, data: { stripeId: session.id } });
  res.json({ checkoutUrl: session.url, orderId: order.id });
});