// backend/src/routes/checkout.ts
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { calcFeesForShow } from '../services/fees.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
const router = Router();

router.get('/', async (req, res) => {
  const showId = String(req.query.showId || '');
  if (!showId) return res.status(404).send('Show ID is required');

  try {
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: true,
        ticketTypes: { orderBy: { pricePence: 'asc' } },
        allocations: { include: { seats: true } }
      }
    });

    if (!show) return res.status(404).send('Event not found');

    // --- 1. GET MAP ---
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

    const venueName = show.venue?.name || 'Venue TBC';
    const ticketTypes = show.ticketTypes || [];
    
    const dateObj = new Date(show.date);
    const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // --- 2. GET HOLDS ---
    const heldSeatIds = new Set<string>();
    if (show.allocations) {
        show.allocations.forEach(alloc => {
            if (alloc.seats) alloc.seats.forEach(s => heldSeatIds.add(s.seatId));
        });
    }

    // --- 3. EXTRACT KONVA ---
    let konvaData = null;
    if (seatMap && seatMap.layout) {
        const layoutObj = seatMap.layout as any;
        if (layoutObj.konvaJson) konvaData = layoutObj.konvaJson;
        else if (layoutObj.attrs || layoutObj.className) konvaData = layoutObj;
    }

    // --- MODE A: LIST ---
    if (!konvaData) {
       res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${show.title}</title></head><body><h1>General Admission</h1><p>Please use the previous list view.</p></body></html>`);
       return; 
    }

    // --- MODE B: MAP ---
    const mapData = JSON.stringify(konvaData);
    const ticketsData = JSON.stringify(ticketTypes);
    const showIdStr = JSON.stringify(show.id);
    const heldSeatsArray = JSON.stringify(Array.from(heldSeatIds)); 

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Select Seats | ${show.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/konva@9.3.3/konva.min.js"></script>

  <style>
    :root { --bg:#F3F4F6; --surface:#FFFFFF; --primary:#0F172A; --brand:#0056D2; --text:#1F2937; --muted:#6B7280; --border:#E5E7EB; --success:#10B981; --blocked:#94a3b8; }
    body { margin:0; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    
    header { background:var(--surface); border-bottom:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; z-index:10; }
    .header-info h1 { font-family:'Outfit',sans-serif; font-size:1.25rem; margin:0; font-weight:700; color:var(--primary); }
    .header-meta { font-size:0.9rem; color:var(--muted); margin-top:4px; }
    .btn-close { text-decoration:none; font-size:1.5rem; color:var(--muted); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
    .btn-close:hover { background:#F3F4F6; color:var(--primary); }
    
    #map-wrapper { flex:1; position:relative; background:#E2E8F0; overflow:hidden; }
    #stage-container { width:100%; height:100%; cursor:grab; }
    #stage-container:active { cursor:grabbing; }
    
    .legend { 
        position:absolute; top:20px; left:20px; 
        background:rgba(255,255,255,0.98); padding:12px 16px; border-radius:12px; 
        box-shadow:0 4px 20px rgba(0,0,0,0.15); 
        display:flex; flex-direction:column; gap:10px; 
        font-size:0.75rem; font-weight:700; z-index:1000; 
    }
    .legend-row { display:flex; gap:16px; }
    .legend-item { display:flex; align-items:center; gap:6px; }
    .dot { width:14px; height:14px; border-radius:50%; border:1px solid rgba(0,0,0,0.1); }
    .dot-avail { background:#fff; border-color:#64748B; }
    .dot-selected { background:var(--brand); border-color:var(--brand); }
    .dot-sold { background:var(--blocked); border-color:var(--text); opacity:0.3; }
    
    .view-toggle { padding-top:10px; border-top:1px solid #e2e8f0; display:flex; align-items:center; gap:8px; cursor:pointer; }
    .view-toggle input { accent-color: var(--brand); transform:scale(1.2); cursor:pointer; }

    footer { background:var(--surface); border-top:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; box-shadow:0 -4px 10px rgba(0,0,0,0.03); z-index:10; }
    .basket-info { display:flex; flex-direction:column; }
    .basket-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; color:var(--muted); }
    .basket-total { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:800; color:var(--primary); }
    .basket-detail { font-size:0.85rem; color:var(--text); margin-top:2px; }
    
    .btn-checkout { background:var(--success); color:white; border:none; padding:12px 32px; border-radius:99px; font-size:1rem; font-weight:700; font-family:'Outfit',sans-serif; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; transition:all 0.2s; opacity:0.5; pointer-events:none; }
    .btn-checkout.active { opacity:1; pointer-events:auto; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3); }
    .btn-checkout:hover { background:#059669; }
    
    #loader { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.95); z-index:2000; display:flex; flex-direction:column; gap:10px; align-items:center; justify-content:center; font-weight:600; color:var(--primary); }
    
    #tooltip {
      position: absolute; display: none; padding: 12px; background: #1e293b; color: #fff;
      border-radius: 8px; pointer-events: none; font-size: 0.85rem; z-index: 1500;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); max-width: 240px; border:1px solid rgba(255,255,255,0.1);
    }
    #tooltip img { width: 100%; border-radius: 4px; margin-top: 8px; display: block; }
    #tooltip .tt-title { font-weight: 700; margin-bottom: 2px; display:block; font-size:0.95rem; }
    #tooltip .tt-meta { color: #94a3b8; font-size: 0.75rem; display:block; margin-bottom: 6px; }
    #tooltip .tt-info { padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); font-style: italic; color: #e2e8f0; line-height:1.4; }
  </style>
</head>
<body>
  <header>
    <div class="header-info"><h1>${show.title}</h1><div class="header-meta">${dateStr} • ${timeStr} • ${venueName}</div></div>
    <a href="/public/event/${show.id}" class="btn-close">✕</a>
  </header>
  <div id="map-wrapper">
    <div class="legend">
      <div class="legend-row">
        <div class="legend-item"><div class="dot dot-avail"></div> Available</div>
        <div class="legend-item"><div class="dot dot-selected"></div> Selected</div>
        <div class="legend-item"><div class="dot dot-sold"></div> Unavailable</div>
      </div>
      <label class="view-toggle">
        <input type="checkbox" id="toggle-views" /> 
        <span>Show seat views</span>
      </label>
    </div>
    <div id="stage-container"></div>
    <div id="tooltip"></div>
    <div id="loader"><div>Loading seating plan...</div></div>
  </div>
  <footer>
    <div class="basket-info"><div class="basket-label">Total</div><div class="basket-total" id="ui-total">£0.00</div><div class="basket-detail" id="ui-count">0 tickets selected</div></div>
    <button class="btn-checkout" id="btn-next">Continue</button>
  </footer>
  <script>
    const rawLayout = ${mapData};
    const ticketTypes = ${ticketsData};
    const showId = ${showIdStr};
    const heldSeatIds = new Set(${heldSeatsArray});
    
    const selectedSeats = new Set(); 
    const seatPrices = new Map();
    // For gap detection: Map<groupId, Array<SeatObject>>
    const rowMap = new Map(); 

    const width = window.innerWidth; 
    const height = window.innerHeight - 160;
    
    // Create Stage & Layer
    const stage = new Konva.Stage({ container: 'stage-container', width: width, height: height, draggable: true });
    // Note: We will load the layer from JSON, so we don't create one yet.
    
    const tooltip = document.getElementById('tooltip');
    
    // Helper: Pricing
    function getTicketType(seatNode) {
        const assignedId = seatNode.getAttr('sbTicketId');
        let match = ticketTypes.find(t => t.id === assignedId);
        if (!match && ticketTypes.length > 0) match = ticketTypes[0];
        return match;
    }

    try {
        let layout = rawLayout;
        if (typeof layout === 'string') { try { layout = JSON.parse(layout); } catch(e) {} }
        if (layout.konvaJson) { layout = layout.konvaJson; if (typeof layout === 'string') layout = JSON.parse(layout); }

        console.log("[DEBUG] Loading Layout...", layout);

        // --- 1. LOAD LAYER IN-PLACE ---
        let layerNode = null;
        
        // Find layer data in JSON
        let layerData = null;
        if (layout.className === 'Stage' && layout.children) {
            layerData = layout.children.find(c => c.className === 'Layer');
        } else if (layout.className === 'Layer') {
            layerData = layout;
        }

        if (!layerData) {
            // Fallback: Wrap simple content
            layerData = { className: 'Layer', children: Array.isArray(layout) ? layout : [layout] };
        }

        // Create Layer
        const mainLayer = Konva.Node.create(layerData);
        stage.add(mainLayer);
        
        // Separate layer for "View Icons" so they float on top
        const iconLayer = new Konva.Layer({ listening: false }); 
        stage.add(iconLayer);
        iconLayer.visible(false);

        // --- 2. PROCESS SEATS (Deep Find) ---
        // We use .find() to locate seats deep inside groups without moving them
        const seats = mainLayer.find('Circle');
        
        seats.forEach(seat => {
            if (!seat.getAttr('isSeat')) return;

            const parentGroup = seat.getParent(); // This is the Row/Table
            
            // --- A. Status & Availability ---
            const status = seat.getAttr('status') || 'AVAILABLE';
            const isBlocked = status === 'BLOCKED' || status === 'SOLD' || status === 'HELD';
            const isHeldDB = heldSeatIds.has(seat.id()) || heldSeatIds.has(seat.getAttr('sbSeatId'));
            const isUnavailable = isBlocked || isHeldDB;

            // --- B. Remove Old Numbers ---
            // If the user added text numbers in builder, hide them for clean look
            if (parentGroup) {
               const texts = parentGroup.find('Text');
               texts.forEach(t => t.visible(false)); 
            }

            // --- C. Register for Gap Logic ---
            if (parentGroup) {
                const grpId = parentGroup._id;
                if (!rowMap.has(grpId)) rowMap.set(grpId, []);
                // Store seat data for row analysis
                // Note: We use absolute position relative to Group to sort
                rowMap.get(grpId).push({
                    id: seat._id,
                    x: seat.x(), // Relative X inside the row
                    unavailable: isUnavailable,
                    node: seat
                });
            }

            // --- D. Visuals ---
            if (isUnavailable) {
                seat.fill('#cbd5e1'); // Light Grey
                seat.stroke('transparent'); 
                seat.opacity(0.5);
                seat.listening(false);
            } else {
                seat.fill('#ffffff'); // White
                seat.stroke('#64748B'); // Slate
                seat.strokeWidth(1.5);
                seat.opacity(1);
                seat.listening(true);
                seat.cursor('pointer'); // Hand cursor
            }
            
            // --- E. Info Icon (Small 'i' dot) ---
            const info = seat.getAttr('sbInfo');
            if (info && !isUnavailable) {
                const iDot = new Konva.Circle({
                    x: seat.getAbsolutePosition().x + 8, // Offset slightly
                    y: seat.getAbsolutePosition().y - 8,
                    radius: 3,
                    fill: '#0F172A',
                    listening: false
                });
                // We add to iconLayer to keep it on top, but need to track position
                // Actually, safer to add to parent group so it moves with zoom
                parentGroup.add(iDot);
                iDot.position({ x: seat.x() + 6, y: seat.y() - 6 }); 
            }

            // --- F. View Icon (Camera) ---
            const viewImg = seat.getAttr('sbViewImage');
            if (viewImg) {
                // Add a marker to the toggleable layer
                // We need global coords for this separate layer
                const absPos = seat.getAbsolutePosition();
                const camIcon = new Konva.Circle({
                    x: 0, y: 0, radius: 6, fill: '#0056D2',
                    listening: false
                });
                // To make it track correctly with zoom, simpler to add to parent group 
                // but toggle visibility based on global state class? 
                // Let's stick to the iconLayer approach but we need to update it on zoom.
                // EASIER: Add to parent, toggle opacity.
                
                const camGroup = new Konva.Group({ x: seat.x(), y: seat.y(), visible: false, name: 'view-icon-group' });
                const bg = new Konva.Circle({ radius: 8, fill: '#0056D2' });
                // Simple 'V' shape
                const v = new Konva.Line({ points: [-3,-1, 0,2, 3,-1], stroke:'white', strokeWidth:1.5 });
                camGroup.add(bg); camGroup.add(v);
                parentGroup.add(camGroup);
            }

            // --- G. Metadata & Events ---
            const tType = getTicketType(seat);
            const price = tType ? tType.pricePence : 0;
            seatPrices.set(seat._id, price);
            const label = seat.getAttr('label') || seat.name() || 'Seat';

            if (!isUnavailable) {
                seat.on('mouseenter', () => {
                    stage.container().style.cursor = 'pointer';
                    if (!selectedSeats.has(seat._id)) {
                        seat.stroke('#0056D2'); seat.strokeWidth(3); 
                        mainLayer.batchDraw();
                    }
                    // Tooltip
                    const pos = stage.getPointerPosition();
                    const priceStr = '£' + (price/100).toFixed(2);
                    let html = \`<span class="tt-title">\${label}</span><span class="tt-meta">\${tType ? tType.name : 'Standard'} • \${priceStr}</span>\`;
                    if (info) html += \`<div class="tt-info">\${info}</div>\`;
                    
                    // Show view image if exists (on hover)
                    if (viewImg) html += \`<img src="\${viewImg}" />\`;

                    tooltip.innerHTML = html;
                    tooltip.style.display = 'block';
                    tooltip.style.left = (pos.x + 20) + 'px';
                    tooltip.style.top = (pos.y + 20) + 'px';
                });

                seat.on('mouseleave', () => {
                    stage.container().style.cursor = 'default';
                    tooltip.style.display = 'none';
                    if (!selectedSeats.has(seat._id)) {
                        seat.stroke('#64748B'); seat.strokeWidth(1.5); 
                        mainLayer.batchDraw();
                    }
                });

                seat.on('click tap', (e) => {
                    e.cancelBubble = true;
                    toggleSeat(seat, parentGroup);
                });
            }
        });

        // --- 3. SORT ROWS (For Gap Logic) ---
        rowMap.forEach((seats) => seats.sort((a, b) => a.x - b.x));

        // --- 4. AUTO ZOOM (Fit to Screen) ---
        // We get the rect of the main layer content
        const box = mainLayer.getClientRect({ skipTransform: true });
        
        if (box.width > 0) {
            const padding = 60;
            const availW = width - padding;
            const availH = height - padding;
            const scale = Math.min(availW / box.width, availH / box.height);
            
            // Center it
            const cx = (width - box.width * scale) / 2 - box.x * scale;
            const cy = (height - box.height * scale) / 2 - box.y * scale;

            stage.x(cx); stage.y(cy);
            stage.scale({ x: scale, y: scale });
            mainLayer.batchDraw();
        }

        document.getElementById('loader').style.display = 'none';

    } catch (err) {
        console.error(err);
        document.getElementById('loader').innerHTML = 'Error loading map';
    }

    // --- VIEW TOGGLE ---
    document.getElementById('toggle-views').addEventListener('change', (e) => {
        const show = e.target.checked;
        const icons = stage.find('.view-icon-group');
        icons.forEach(icon => icon.visible(show));
        // We might need to hide seats if we want ONLY icons? 
        // User said "shows you all the Vs... click it to see video"
        // For now, we overlay the V icon on top of the seat.
    });

    // --- ZOOM ---
    stage.on('wheel', (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });
        const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
        stage.position(newPos);
    });

    // --- GAP LOGIC ---
    function checkGap(seat, rowGroup) {
        if (!rowGroup) return true;
        const row = rowMap.get(rowGroup._id);
        if (!row || row.length < 3) return true;

        // Simulate new state
        const isSelecting = !selectedSeats.has(seat._id);
        
        // Build array of states: 0=Unavailable, 1=Selected, 2=Free
        const states = row.map(s => {
            if (s.unavailable) return 0;
            if (s.id === seat._id) return isSelecting ? 1 : 2;
            if (selectedSeats.has(s.id)) return 1;
            return 2;
        });

        // Scan for pattern: 2 flanked by 0s or 1s (Orphan)
        // e.g. 1 2 1  or  0 2 1  or 1 2 0
        for (let i = 0; i < states.length; i++) {
            if (states[i] === 2) { // Empty seat
                const left = (i === 0) ? 0 : states[i-1];
                const right = (i === states.length - 1) ? 0 : states[i+1];
                
                // If both sides are Occupied/Selected/Wall -> We have a gap of 1
                if (left !== 2 && right !== 2) {
                    return false; // GAP DETECTED
                }
            }
        }
        return true;
    }

    function toggleSeat(seat, parentGroup) {
        const id = seat._id;
        
        // 1. GAP CHECK
        if (!checkGap(seat, parentGroup)) {
            alert("Please do not leave single seat gaps.");
            return;
        }

        if (selectedSeats.has(id)) {
            selectedSeats.delete(id);
            seat.fill('#ffffff');
            seat.stroke('#64748B');
        } else {
            if (selectedSeats.size >= 10) { alert("Maximum 10 tickets."); return; }
            selectedSeats.add(id);
            seat.fill('#0056D2');
            seat.stroke('#0056D2');
        }
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
        const btn = document.getElementById('btn-next');
        if (!btn.classList.contains('active')) return;
        btn.innerText = 'Processing...';
        
        let totalPence = 0;
        selectedSeats.forEach(id => totalPence += (seatPrices.get(id) || 0));
        const quantity = selectedSeats.size;
        const unitPricePence = Math.round(totalPence / quantity);

        try {
            const res = await fetch('/checkout/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ showId, quantity, unitPricePence })
            });
            const data = await res.json();
            if (data.ok && data.url) window.location.href = data.url;
            else { alert("Error: " + (data.message || "Unknown")); btn.innerText = 'Continue'; }
        } catch (e) { alert("Connection error"); btn.innerText = 'Continue'; }
    });
  </script>
</body>
</html>`);

  } catch (err: any) {
    console.error('checkout/map error', err);
    res.status(500).send('Server error');
  }
});

router.post('/session', async (req, res) => {
  // ... (POST logic unchanged)
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
