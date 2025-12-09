// backend/src/routes/checkout.ts
import { Router } from 'express';
import { Prisma, ShowStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { calcFeesForShow } from '../services/fees.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
const router = Router();

function pFmt(p: number) {
  return '£' + (p / 100).toFixed(2);
}

router.get('/', async (req, res) => {
  const showId = String(req.query.showId || '');
  if (!showId) return res.status(404).send('Show ID is required');

  try {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: true,
        ticketTypes: { orderBy: { pricePence: 'asc' } }
      }
    });

    if (!show) return res.status(404).send('Event not found');

    let seatMap = null;
    // @ts-ignore
    if (show.activeSeatMapId) {
        // @ts-ignore
        seatMap = await prisma.seatMap.findUnique({ where: { id: show.activeSeatMapId } });
    }
    if (!seatMap) {
        seatMap = await prisma.seatMap.findFirst({
            where: { showId: show.id },
            orderBy: { updatedAt: 'desc' }
        });
    }

    const venue = show.venue;
    const venueName = venue?.name || 'Venue TBC';
    const ticketTypes = show.ticketTypes || [];
    
    const dateObj = new Date(show.date);
    const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // --- DATA EXTRACTION ---
    let konvaData = null;
    if (seatMap && seatMap.layout) {
        const layoutObj = seatMap.layout as any;
        if (layoutObj.konvaJson) {
            konvaData = layoutObj.konvaJson;
        } else if (layoutObj.attrs || layoutObj.className) {
            konvaData = layoutObj;
        }
    }

    if (!konvaData) {
       const ticketsJson = JSON.stringify(ticketTypes);
       res.type('html').send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${show.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@700&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif;background:#F3F4F6;display:flex;justify-content:center;align-items:center;height:100vh;margin:0} .card{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);text-align:center;max-width:400px;width:100%} h1{font-family:'Outfit',sans-serif;margin-bottom:10px} .btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#0056D2;color:white;text-decoration:none;border-radius:8px;font-weight:700}</style>
</head>
<body>
<div class="card">
  <h1>Select Tickets</h1>
  <p>General Admission - Unallocated Seating</p>
  <div style="text-align:left;margin-top:20px;border-top:1px solid #eee;padding-top:20px">
    ${ticketTypes.map(t => `<div style="display:flex;justify-content:space-between;margin-bottom:10px"><span>${t.name}</span><strong>£${(t.pricePence/100).toFixed(2)}</strong></div>`).join('')}
  </div>
  <a href="/public/event/${show.id}" class="btn">Back to Event</a>
</div>
</body></html>`);
       return; 
    }

    const mapData = JSON.stringify(konvaData);
    const ticketsData = JSON.stringify(ticketTypes);
    const showIdStr = JSON.stringify(show.id);

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Select Seats | ${show.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/konva@9.3.3/konva.min.js"></script>

  <style>
    :root { --bg:#F3F4F6; --surface:#FFFFFF; --primary:#0F172A; --brand:#0056D2; --text-main:#111827; --text-muted:#6B7280; --border:#E5E7EB; --success:#10B981; }
    body { margin:0; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    header { background:var(--surface); border-bottom:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; z-index:10; }
    .header-info h1 { font-family:'Outfit',sans-serif; font-size:1.25rem; margin:0; font-weight:700; color:var(--primary); }
    .header-meta { font-size:0.9rem; color:var(--muted); margin-top:4px; }
    .btn-close { text-decoration:none; font-size:1.5rem; color:var(--muted); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:background 0.2s; }
    .btn-close:hover { background:#F3F4F6; color:var(--primary); }
    #map-wrapper { flex:1; position:relative; background:#E2E8F0; overflow:hidden; background-image:radial-gradient(#CBD5E1 1px, transparent 1px); background-size:20px 20px; }
    #stage-container { width:100%; height:100%; cursor:grab; }
    #stage-container:active { cursor:grabbing; }
    .legend { position:absolute; top:16px; left:16px; pointer-events:none; background:rgba(255,255,255,0.9); padding:8px 12px; border-radius:8px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); display:flex; gap:12px; font-size:0.75rem; font-weight:600; border:1px solid rgba(0,0,0,0.05); }
    .legend-item { display:flex; align-items:center; gap:6px; }
    .dot { width:12px; height:12px; border-radius:50%; }
    .dot-avail { background:#fff; border:2px solid #64748B; }
    .dot-selected { background:var(--brand); border:2px solid var(--brand); }
    .dot-sold { background:#E2E8F0; border:2px solid #CBD5E1; }
    footer { background:var(--surface); border-top:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; box-shadow:0 -4px 10px rgba(0,0,0,0.03); z-index:10; }
    .basket-info { display:flex; flex-direction:column; }
    .basket-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; color:var(--muted); }
    .basket-total { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:800; color:var(--primary); }
    .basket-detail { font-size:0.85rem; color:var(--text-main); margin-top:2px; }
    .btn-checkout { background:var(--success); color:white; border:none; padding:12px 32px; border-radius:99px; font-size:1rem; font-weight:700; font-family:'Outfit',sans-serif; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; transition:all 0.2s; opacity:0.5; pointer-events:none; }
    .btn-checkout.active { opacity:1; pointer-events:auto; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3); }
    .btn-checkout:hover { background:#059669; }
    #loader { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.95); z-index:50; display:flex; flex-direction:column; gap:10px; align-items:center; justify-content:center; font-weight:600; color:var(--primary); }
    #debug-msg { font-size:0.8rem; color:#ef4444; font-family:monospace; max-width:80%; text-align:center;}
  </style>
</head>
<body>
  <header>
    <div class="header-info"><h1>${show.title}</h1><div class="header-meta">${dateStr} • ${timeStr} • ${venueName}</div></div>
    <a href="/public/event/${show.id}" class="btn-close">✕</a>
  </header>
  <div id="map-wrapper">
    <div class="legend">
      <div class="legend-item"><div class="dot dot-avail"></div> Available</div>
      <div class="legend-item"><div class="dot dot-selected"></div> Selected</div>
      <div class="legend-item"><div class="dot dot-sold"></div> Unavailable</div>
    </div>
    <div id="stage-container"></div>
    <div id="loader">
        <div>Loading seating plan...</div>
        <div id="debug-msg"></div>
    </div>
  </div>
  <footer>
    <div class="basket-info"><div class="basket-label">Total</div><div class="basket-total" id="ui-total">£0.00</div><div class="basket-detail" id="ui-count">0 tickets selected</div></div>
    <button class="btn-checkout" id="btn-next">Continue</button>
  </footer>
  <script>
    const rawLayout = ${mapData};
    const ticketTypes = ${ticketsTypesJson};
    const showId = ${showIdStr};
    const selectedSeats = new Set(); const seatPrices = new Map();
    const width = window.innerWidth; const height = window.innerHeight - 160;
    
    // 1. Create Main Stage
    const stage = new Konva.Stage({ container: 'stage-container', width: width, height: height, draggable: true });
    
    function getPriceForSeat(seatNode) {
        const assignedId = seatNode.getAttr('sbTicketId');
        let match = ticketTypes.find(t => t.id === assignedId);
        if (!match && ticketTypes.length > 0) match = ticketTypes[0];
        return match ? match.pricePence : 0;
    }

    try {
        let layout = rawLayout;
        if (typeof layout === 'string') {
            try { layout = JSON.parse(layout); } catch(e) { console.error("JSON parse error", e); }
        }
        if (layout.konvaJson) {
             layout = layout.konvaJson;
             if (typeof layout === 'string') layout = JSON.parse(layout);
        }

        console.log("[DEBUG] Loading Layout...", layout);

        // --- NEW STRATEGY: Load WHOLE Layer (Preserves hierarchy) ---
        // Instead of picking children, find the main Layer object and instantiate it.
        
        let layerData = null;

        if (layout.className === 'Stage' && layout.children) {
            // Find the first Layer
            layerData = layout.children.find(c => c.className === 'Layer');
        } else if (layout.className === 'Layer') {
            layerData = layout;
        }

        if (!layerData) {
            throw new Error("Could not find a valid Layer in the saved map data.");
        }

        // Create the Layer from data (this creates all children/groups recursively!)
        const layer = Konva.Node.create(layerData);
        stage.add(layer);

        // Now traverse the *created* nodes to attach logic
        // We look for 'Group' nodes that have our special shape types
        const groups = layer.find('Group');
        
        groups.forEach(group => {
            // Lock movement
            group.draggable(false);
            group.listening(false);

            const type = group.getAttr('shapeType') || group.name();
            if (['row-seats', 'circular-table', 'rect-table', 'single-seat'].includes(type)) {
                
                const circles = group.find('Circle');
                circles.forEach(seat => {
                    if (!seat.getAttr('isSeat')) return;
                    
                    const price = getPriceForSeat(seat);
                    seatPrices.set(seat._id, price);
                    
                    // Reset Visuals (in case saved state was weird)
                    seat.fill('#ffffff'); 
                    seat.stroke('#64748B'); 
                    seat.strokeWidth(1.5);
                    seat.shadowEnabled(false);
                    
                    // Enable Interaction
                    seat.listening(true); 
                    seat.cursor('pointer');

                    // Events
                    seat.on('mouseenter', () => { 
                        if (selectedSeats.has(seat._id)) return; 
                        stage.container().style.cursor = 'pointer'; 
                        seat.stroke('#0056D2'); seat.strokeWidth(3); 
                    });
                    seat.on('mouseleave', () => { 
                        stage.container().style.cursor = 'default'; 
                        if (selectedSeats.has(seat._id)) return; 
                        seat.stroke('#64748B'); seat.strokeWidth(1.5); 
                    });
                    seat.on('click tap', (e) => { 
                        e.cancelBubble = true; 
                        toggleSeat(seat); 
                    });
                });
            }
        });

        // Center Content
        const rect = layer.getClientRect();
        if (rect && rect.width > 0) {
            const scale = Math.min((width - 40) / rect.width, (height - 40) / rect.height);
            const finalScale = Math.min(Math.max(scale, 0.2), 1.5);
            
            // Calculate center offset
            const newX = (width - rect.width * finalScale) / 2 - (rect.x * finalScale);
            const newY = (height - rect.height * finalScale) / 2 - (rect.y * finalScale);

            stage.position({ x: newX, y: newY });
            stage.scale({ x: finalScale, y: finalScale });
        }
        
        layer.batchDraw();
        document.getElementById('loader').style.display = 'none';

    } catch (err) {
        console.error("[DEBUG] RENDER ERROR:", err);
        document.getElementById('loader').innerHTML = '<div>Error loading map</div><div id="debug-msg">' + err.message + '</div>';
    }

    // Zoom Logic
    stage.on('wheel', (e) => {
        e.evt.preventDefault(); const scaleBy = 1.1; const oldScale = stage.scaleX(); const pointer = stage.getPointerPosition();
        const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });
        const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
        stage.position(newPos);
    });

    function toggleSeat(seat) {
        const id = seat._id;
        if (selectedSeats.has(id)) { selectedSeats.delete(id); seat.fill('#ffffff'); seat.stroke('#64748B'); }
        else { if (selectedSeats.size >= 10) { alert("Maximum 10 tickets per order."); return; } selectedSeats.add(id); seat.fill('#0056D2'); seat.stroke('#0056D2'); }
        updateBasket();
    }

    function updateBasket() {
        let totalPence = 0; let count = 0;
        selectedSeats.forEach(id => { totalPence += (seatPrices.get(id) || 0); count++; });
        document.getElementById('ui-total').innerText = '£' + (totalPence / 100).toFixed(2);
        document.getElementById('ui-count').innerText = count + (count === 1 ? ' ticket' : ' tickets');
        const btn = document.getElementById('btn-next');
        if (count > 0) btn.classList.add('active'); else btn.classList.remove('active');
    }

    document.getElementById('btn-next').addEventListener('click', async () => {
        const btn = document.getElementById('btn-next'); if (!btn.classList.contains('active')) return;
        btn.innerText = 'Processing...';
        let totalPence = 0; selectedSeats.forEach(id => totalPence += (seatPrices.get(id) || 0));
        const quantity = selectedSeats.size; const unitPricePence = Math.round(totalPence / quantity);
        try {
            const res = await fetch('/checkout/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showId, quantity, unitPricePence }) });
            const data = await res.json();
            if (data.ok && data.url) window.location.href = data.url;
            else { alert("Checkout failed: " + (data.message || "Unknown error")); btn.innerText = 'Continue'; }
        } catch (e) { alert("Connection error. Please try again."); btn.innerText = 'Continue'; }
    });
  </script>
</body>
</html>`);

  } catch (err: any) {
    console.error('checkout/session error', err);
    return res.status(500).json({ ok: false, message: 'Checkout error' });
  }
});

router.post('/session', async (req, res) => {
  try {
    const { showId, quantity, ticketTypeId, unitPricePence } = req.body ?? {};
    if (!showId || !quantity || quantity < 1) return res.status(400).json({ ok: false, message: 'showId and quantity are required' });

    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { status: true, ticketTypes: { select: { id: true, pricePence: true }, orderBy: { createdAt: 'asc' } } },
    });

    if (!show) return res.status(404).json({ ok: false, message: 'Show not found' });

    let finalPrice = 0;
    if (unitPricePence) finalPrice = Number(unitPricePence);
    else if (ticketTypeId) {
        const match = show.ticketTypes.find(t => t.id === ticketTypeId);
        if (!match) return res.status(400).json({ ok: false, message: 'Invalid ticket type' });
        finalPrice = match.pricePence;
    } else finalPrice = show.ticketTypes[0]?.pricePence || 0;

    let organiserSplitBps: number | null = null;
    const userId = (req as any).userId as string | undefined;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { organiserSplitBps: true } });
      organiserSplitBps = user?.organiserSplitBps ?? null;
    }

    const fees = await calcFeesForShow(prisma, showId, Number(quantity), finalPrice, organiserSplitBps);
    const order = await prisma.order.create({
      data: {
        show: { connect: { id: showId } }, quantity: Number(quantity), amountPence: finalPrice * Number(quantity), status: 'PENDING',
        platformFeePence: fees.platformFeePence, organiserSharePence: fees.organiserSharePence, paymentFeePence: fees.paymentFeePence, netPayoutPence: fees.netPayoutPence,
        ticketType: ticketTypeId ? { connect: { id: ticketTypeId } } : undefined
      },
      select: { id: true },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment', currency: 'gbp',
      line_items: [{ quantity, price_data: { currency: 'gbp', unit_amount: finalPrice, product_data: { name: 'Tickets' } } }],
      metadata: { orderId: order.id, showId },
      success_url: `${process.env.PUBLIC_BASE_URL}/success?order=${order.id}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/cancel?order=${order.id}`,
    });

    return res.json({ ok: true, url: session.url });
  } catch (err: any) {
    console.error('checkout/session error', err);
    return res.status(500).json({ ok: false, message: 'Checkout error' });
  }
});

export default router;
