// backend/src/routes/checkout.ts
import { Router } from 'express';
import { OrderStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { calcFeesForShow } from '../services/fees.js';
import Stripe from 'stripe';

// --- ROBUST STRIPE INITIALIZATION ---
const stripeSecret = process.env.STRIPE_SECRET_KEY;

// Check for the .default property for safer ES Module interop with Stripe
const StripeClient = (Stripe as any)?.default || Stripe;

const stripe = stripeSecret
    ? new StripeClient(stripeSecret, { apiVersion: '2024-06-20' })
    : null;
// ------------------------------------
const router = Router();

// --- formatting helper (Required for List View HTML) ---
function pFmt(p: number | null | undefined) {
    return '£' + (Number(p || 0) / 100).toFixed(2);
}

router.post('/session', async (req, res) => {
    // --- DEBUG START: RAW REQUEST LOG (Moved out of try/catch to ensure logging) ---
    const DEBUG_REQ_BODY = req.body || {};
    console.debug('checkout/session request body (RAW):', DEBUG_REQ_BODY);
    // --- DEBUG END: RAW REQUEST LOG ---
  try {
    const { showId, quantity, unitPricePence, seats } = DEBUG_REQ_BODY;
    const seatIds: string[] = Array.isArray(seats) ? seats.map((s: any) => String(s)) : [];
    console.debug('checkout/session extracted data:', { showId, quantity, unitPricePence, headers: req.headers });
    const qty = Number(quantity);
    const unitPence = Number(unitPricePence);

    if (!showId || !Number.isFinite(qty) || !Number.isFinite(unitPence) || qty <= 0 || unitPence <= 0) {
      console.warn('checkout/session validation failed', { showId, qty, unitPence });
      return res.status(400).json({ ok: false, message: 'showId, quantity and unitPricePence are required' });
    }

    const show = await prisma.show.findUnique({ where: { id: String(showId) }, select: { id: true, title: true } });
    if (!show) {
      console.warn('checkout/session missing show', { showId });
      return res.status(404).json({ ok: false, message: 'Event not found' });
    }
    const showTitle = show.title ?? 'Event ticket';

  const amountPence = Math.round(unitPence) * Math.round(qty);
    console.debug('checkout/session computed totals', { qty, unitPence: Math.round(unitPence), amountPence });
    
// --- DEBUG START: FEE CALCULATION ---
console.debug('checkout/session calling calcFeesForShow with:', {
  showId: show.id,
  qty,
  amountPence,
});

let fees;
try {
  // Match the fees service signature:
  // calcFeesForShow(showId, amountPence, quantity, organiserSplitBps?)
  fees = await calcFeesForShow(
    show.id,
    amountPence,
    qty,
    null // organiserSplitBps – public checkout, so no organiser override here
  );
} catch (feeErr: any) {
  console.error('checkout/session fee calc error', {
    showId: show.id,
    qty,
    amountPence,
    feeErrorMessage: feeErr?.message,
    feeErrorStack: feeErr?.stack,
  });

  return res
    .status(500)
    .json({ ok: false, message: 'Fee calculation error', detail: feeErr?.message });
}

console.debug('checkout/session fees result:', fees);
// --- DEBUG END: FEE CALCULATION ---



    const order = await prisma.order.create({
      data: {
        showId: show.id,
        amountPence,
        quantity: qty,
        status: OrderStatus.PENDING,
        platformFeePence: fees.platformFeePence,
        organiserSharePence: fees.organiserSharePence,
        paymentFeePence: fees.paymentFeePence,
        netPayoutPence: fees.netPayoutPence,
      },
    });
    console.debug('checkout/session order created', { orderId: order.id, status: order.status, amountPence, qty });

    const candidateOrigin = process.env.PUBLIC_BASE_URL || (req.get('host') ? `${req.protocol}://${req.get('host')}` : '');
    let origin = 'http://localhost:3000';
    try {
      if (candidateOrigin) origin = new URL(candidateOrigin).origin;
    } catch (err) {
      console.warn('checkout/session origin fallback', candidateOrigin, err);
    }
    console.debug('checkout/session origin', { candidateOrigin, origin });

    if (!stripe) {
      console.error('checkout/session error: STRIPE_SECRET_KEY is not configured');
      return res.status(500).json({ ok: false, message: 'Payment processing unavailable' });
    }

    const successUrl = new URL(`/public/event/${show.id}?status=success&orderId=${order.id}`, origin).toString();
    const cancelUrl = new URL(`/public/event/${show.id}?status=cancelled`, origin).toString();
    console.debug('checkout/session redirect urls', { successUrl, cancelUrl });

    // --- DEBUG START: STRIPE SESSION CREATION ---
    const lineItems = [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: showTitle },
            unit_amount: Math.round(unitPence),
          },
          quantity: Math.round(qty),
        },
    ];
    console.debug('checkout/session Stripe line_items:', JSON.stringify(lineItems));
    
     const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId: order.id,
        showId: show.id,
        seatIds: seatIds.join(','),
      },
    });

    console.debug('checkout/session created Stripe session (ID):', session.id);
    // --- DEBUG END: STRIPE SESSION CREATION ---
    console.debug('checkout/session success: returning URL');
    return res.json({ ok: true, url: session.url });
 } catch (err: any) {
    // --- DEBUG START: FINAL CATCH LOG ---
    console.error('checkout/session CRITICAL ERROR', {
      requestBody: DEBUG_REQ_BODY, // Use the new variable for consistency
      errorMessage: err?.message,
      errorName: err?.name,
      errorStack: err?.stack,
      rawError: err,
    });
    // --- DEBUG END: FINAL CATCH LOG ---
    return res.status(500).json({ ok: false, message: 'Checkout error', detail: err?.message });
  }
});

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

    // 1. Get Active Seat Map
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

    // 2. Get Holds
    const heldSeatIds = new Set<string>();
    if (show.allocations) {
        show.allocations.forEach(alloc => {
            if (alloc.seats) alloc.seats.forEach(s => heldSeatIds.add(s.seatId));
        });
    }

    // 3. Extract Layout
    let konvaData = null;
    if (seatMap && seatMap.layout) {
        const layoutObj = seatMap.layout as any;
        if (layoutObj.konvaJson) konvaData = layoutObj.konvaJson;
        else if (layoutObj.attrs || layoutObj.className) konvaData = layoutObj;
    }

 // --- MODE A: LIST VIEW (General Admission) ---
    if (!konvaData) {
        const showIdStr = JSON.stringify(show.id);
        // NOTE: pFmt is now defined above to fix the TypeScript error.
        const ticketOptions = ticketTypes.map(t => `<option value="${t.id}" data-price="${t.pricePence}">${t.name} - ${pFmt(t.pricePence)}</option>`).join('');
        
        // Fallback HTML page with a basic form for GA purchase
        res.type('html').send(`<!doctype html>
            <html lang="en"><head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>General Admission | ${show.title}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; }
                h1 { font-size: 1.5rem; }
                form { display: flex; flex-direction: column; gap: 15px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ddd; }
                label { font-weight: bold; margin-bottom: 5px; }
                select, input[type="number"] { padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                button { padding: 10px 20px; background: #0056D2; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
                button:disabled { background: #9E9E9E; cursor: not-allowed; }
                .total { font-size: 1.2rem; font-weight: bold; margin-top: 10px; }
                .error { color: red; margin-top: 10px; }
            </style>
            </head><body>
            <h1>${show.title}</h1>
            <p>${dateStr} • ${timeStr} • ${venueName}</p>
            <h2>Select Tickets</h2>
            <form id="ga-checkout-form">
                <label for="ticketType">Ticket Type:</label>
                <select id="ticketType" name="ticketType">
                    ${ticketOptions}
                </select>
                <label for="quantity">Quantity:</label>
                <input type="number" id="quantity" name="quantity" value="1" min="1" max="10" required />
                <div class="total">Total: <span id="total-price">£0.00</span></div>
                <button type="submit" id="btn-buy">Continue to Payment</button>
                <div class="error" id="error-message"></div>
            </form>
            <script>
                const showId = ${showIdStr};
                const form = document.getElementById('ga-checkout-form');
                const ticketTypeSelect = document.getElementById('ticketType');
                const quantityInput = document.getElementById('quantity');
                const totalPriceSpan = document.getElementById('total-price');
                const buyButton = document.getElementById('btn-buy');
                const errorMessage = document.getElementById('error-message');

                function updatePrice() {
                    const selectedOption = ticketTypeSelect.options[ticketTypeSelect.selectedIndex];
                    const pricePence = Number(selectedOption.getAttribute('data-price')) || 0;
                    const quantity = Number(quantityInput.value) || 0;
                    const total = (pricePence * quantity) / 100;
                    totalPriceSpan.innerText = '£' + total.toFixed(2);
                    buyButton.disabled = quantity === 0 || pricePence === 0;
                }

                ticketTypeSelect.addEventListener('change', updatePrice);
                quantityInput.addEventListener('input', updatePrice);
                updatePrice(); // Initial calculation

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    errorMessage.innerText = '';
                    buyButton.disabled = true;
                    buyButton.innerText = 'Processing...';

                    const quantity = Number(quantityInput.value);
                    const selectedOption = ticketTypeSelect.options[ticketTypeSelect.selectedIndex];
                    const unitPricePence = Number(selectedOption.getAttribute('data-price'));

                    if (quantity <= 0 || unitPricePence <= 0) {
                        errorMessage.innerText = 'Please select a valid quantity and ticket type.';
                        buyButton.disabled = false;
                        buyButton.innerText = 'Continue to Payment';
                        return;
                    }

                    try {
                        const res = await fetch('/checkout/session', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ showId, quantity, unitPricePence })
                        });
                        const data = await res.json();

                        if (data.ok && data.url) {
                            window.location.href = data.url;
                        } else {
                            alert("Error: " + (data.message || 'Unknown checkout error.'));
                            buyButton.disabled = false;
                            buyButton.innerText = 'Continue to Payment';
                        }
                    } catch (error) {
                        alert("Connection error. Please try again.");
                        buyButton.disabled = false;
                        buyButton.innerText = 'Continue to Payment';
                    }
                });
            </script>
            </body></html>`);
        return;
    }
    // --- MODE B: MAP VIEW ---
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
    :root { --bg:#F3F4F6; --surface:#FFFFFF; --primary:#0F172A; --brand:#0056D2; --text-main:#111827; --text-muted:#6B7280; --border:#E5E7EB; --success:#10B981; --blocked:#334155; }
    body { margin:0; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    
    header { background:var(--surface); border-bottom:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; z-index:4000; position:relative; }
    .header-info h1 { font-family:'Outfit',sans-serif; font-size:1.25rem; margin:0; font-weight:700; color:var(--primary); }
    .header-meta { font-size:0.9rem; color:var(--muted); margin-top:4px; }
    .btn-close { text-decoration:none; font-size:1.5rem; color:var(--muted); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
    
    #map-wrapper { flex:1; position:relative; background:#E2E8F0; overflow:hidden; width:100%; height:100%; }
    #stage-container { width:100%; height:100%; cursor:grab; opacity:0; transition:opacity 0.3s; }
    #stage-container.visible { opacity:1; }
    
    /* LEGEND */
    .legend { 
        position:absolute; top:20px; left:20px; 
        background:rgba(255,255,255,0.98); padding:12px 16px; border-radius:12px; 
        box-shadow:0 4px 20px rgba(0,0,0,0.15); 
        display:flex; flex-direction:column; gap:12px; 
        font-size:0.75rem; font-weight:700; z-index:4000; 
    }
    .legend-row { display:flex; gap:16px; align-items:center; }
    .legend-item { display:flex; align-items:center; gap:6px; }
    .dot { width:14px; height:14px; border-radius:50%; border:1px solid rgba(0,0,0,0.1); }
    .dot-avail { background:#fff; border-color:#64748B; }
    .dot-selected { background:var(--brand); border-color:var(--brand); }
    .dot-sold { background:var(--blocked); border-color:var(--text); opacity:0.8; }
    
    .view-toggle { padding-top:10px; border-top:1px solid #e2e8f0; display:flex; align-items:center; gap:8px; cursor:pointer; }
    .view-toggle input { accent-color: var(--brand); transform:scale(1.2); cursor:pointer; }

    footer { background:var(--surface); border-top:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; box-shadow:0 -4px 10px rgba(0,0,0,0.03); z-index:4000; position:relative; }
    .basket-info { display:flex; flex-direction:column; }
    .basket-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; color:var(--muted); }
    .basket-total { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:800; color:var(--primary); }
    .basket-detail { font-size:0.85rem; color:var(--text); margin-top:2px; }
    
    .btn-checkout { background:var(--success); color:white; border:none; padding:12px 32px; border-radius:99px; font-size:1rem; font-weight:700; font-family:'Outfit',sans-serif; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; transition:all 0.2s; opacity:0.5; pointer-events:none; }
    .btn-checkout.active { opacity:1; pointer-events:auto; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3); }
    .btn-checkout:hover { background:#059669; }
    
    /* LOADER - Visible by default */
    #loader { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,1); z-index:5000; display:flex; flex-direction:column; gap:10px; align-items:center; justify-content:center; font-weight:600; color:var(--primary); transition: opacity 0.5s; }
    #loader.hidden { opacity:0; pointer-events:none; }
    .spinner { width:40px; height:40px; border:4px solid #e5e7eb; border-top-color:var(--brand); border-radius:50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    #tooltip {
      position: absolute; display: none; padding: 12px; background: #1e293b; color: #fff;
      border-radius: 8px; pointer-events: none; font-size: 0.85rem; z-index: 4500;
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
    <div id="loader"><div class="spinner"></div><div>Loading seating plan...</div></div>
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
    const seatMeta = new Map();
    const rowMap = new Map();
    const seatIdMap = new Map();

    // --- SETUP STAGE ---
    const container = document.getElementById('stage-container');
   const stage = new Konva.Stage({
  container: 'stage-container',
  width: container.offsetWidth,
  height: container.offsetHeight,
  draggable: false // customer view: whole stage is fixed
});

    
    // LAYERS: Main map and UI on top
    const mainLayer = new Konva.Layer();
    const uiLayer = new Konva.Layer({ listening: true });
    stage.add(mainLayer);
    stage.add(uiLayer);
    
    const tooltip = document.getElementById('tooltip');

    // EARLY FAILSAFE: schedule immediately so the loader can't hang if Konva JSON processing blocks later
setTimeout(() => {
  const loaderEl = document.getElementById('loader');
  const stageEl = document.getElementById('stage-container');

  if (loaderEl && !loaderEl.classList.contains('hidden')) {
    console.warn('[checkout] EARLY failsafe – forcing stage visible (map may still be loading)');
    loaderEl.classList.add('hidden');
    if (stageEl) stageEl.classList.add('visible');
  }
}, 3000);

    
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

console.log("[DEBUG] Loading Layout summary:", {
  className: layout?.className,
  hasChildren: Array.isArray(layout?.children),
  childrenCount: Array.isArray(layout?.children) ? layout.children.length : 0
});

        // --- 1. LOAD LAYER ---
        let layersToLoad = [];
        if (layout.className === 'Stage' && layout.children) {
            layersToLoad = layout.children.filter(c => c.className === 'Layer');
            if (layersToLoad.length === 0) layersToLoad = [{ className: 'Layer', children: layout.children }];
        } else if (layout.className === 'Layer') {
            layersToLoad = [layout];
        } else {
            layersToLoad = [{ className: 'Layer', children: Array.isArray(layout) ? layout : [layout] }];
        }

        layersToLoad.forEach((layerData) => {
  const tempLayer = Konva.Node.create(layerData);

  // RESET TRANSFORM to ensure clean math
  tempLayer.x(0);
  tempLayer.y(0);
  tempLayer.scale({ x: 1, y: 1 });

  const children = tempLayer.getChildren().slice();

  children.forEach((node) => {
    const cn = node.getClassName();

    // If a Layer/FastLayer got nested in here, DON'T move the layer itself.
    // Instead, move its contents into our mainLayer.
    if (cn === 'Layer' || cn === 'FastLayer') {
      const inner = node.getChildren ? node.getChildren().slice() : [];
      inner.forEach((child) => {
        child.moveTo(mainLayer);
        processNode(child, null);
      });
      node.destroy();
      return;
    }

    node.moveTo(mainLayer);
    processNode(node, null);
  });

  tempLayer.destroy();
});

        // --- 2. PROCESS NODES ---
        function processNode(node, parentGroup) {
            const nodeType = node.getClassName();
            const groupType = node.getAttr('shapeType') || node.name();
            const isSeatGroup = nodeType === 'Group' && ['row-seats', 'circular-table', 'rect-table', 'single-seat'].includes(groupType);
            
            if (isSeatGroup) {
                // CLEANUP: Hide Numbers (Digits only), keep Labels (A, B, C)
                node.find('Text').forEach(t => {
                     const txt = t.text().trim();
                     if (/^\\d+$/.test(txt)) t.destroy();
                });
                parentGroup = node;
            }

            if (nodeType === 'Circle' && node.getAttr('isSeat')) {
                const seat = node;
                
                const status = seat.getAttr('status') || 'AVAILABLE';
                const holdStatus = (seat.getAttr('sbHoldStatus') || '').toString().toLowerCase();
                const isBlocked = status === 'BLOCKED' || status === 'SOLD' || status === 'HELD';
                const isHeldDB = heldSeatIds.has(seat.id()) || heldSeatIds.has(seat.getAttr('sbSeatId'));
                const isHeldOrAllocated = holdStatus === 'hold' || holdStatus === 'allocation' || holdStatus === 'allocated';
                const isUnavailable = isBlocked || isHeldDB || isHeldOrAllocated;

                const tType = getTicketType(seat);
                const price = tType ? tType.pricePence : 0;
                seatPrices.set(seat._id, price);
                
                const label = seat.getAttr('label') || seat.name() || 'Seat';
                const info = seat.getAttr('sbInfo');
                const viewImg = seat.getAttr('sbViewImage');

                if (parentGroup) {
                    const grpId = parentGroup._id;
                    if (!rowMap.has(grpId)) rowMap.set(grpId, []);
                    const absPos = seat.getAbsolutePosition();
                    rowMap.get(grpId).push({
                        id: seat._id, x: absPos.x, y: absPos.y, unavailable: isUnavailable, node: seat
                    });
                }

                              seatMeta.set(seat._id, {
                    label,
                    info,
                    viewImg,
                    price,
                    ticketName: tType ? tType.name : 'Standard',
                    unavailable: isUnavailable,
                    seat,
                    parentGroup
                });

                // Map internal Konva id -> stable seat id used in DB (sbSeatId if present, otherwise node id)
                const stableId = seat.getAttr('sbSeatId') || seat.id();
                seatIdMap.set(seat._id, stableId);


                // VISUALS
                if (isUnavailable) {
                    seat.fill('#000000'); // Blackout for sold/held/allocated
                    seat.stroke('#000000'); seat.strokeWidth(1);
                    seat.opacity(0.85); seat.listening(true);
                } else {
                    seat.fill('#ffffff'); seat.stroke('#64748B'); seat.strokeWidth(1.5);
                    seat.opacity(1); seat.listening(true);
                }
                seat.shadowEnabled(false);
                seat.visible(true);

                // --- Tag for Icon Layer ---
                if (info) seat.setAttr('hasInfo', true);
                if (viewImg) seat.setAttr('hasView', true);

                // EVENTS
                seat.on('mouseenter', () => {
                    stage.container().style.cursor = isUnavailable ? 'not-allowed' : 'pointer';
                    if (!selectedSeats.has(seat._id) && !isUnavailable) {
                        seat.stroke('#0056D2'); seat.strokeWidth(3); mainLayer.batchDraw();
                    }
                    showSeatTooltip(seat._id);
                });
                seat.on('mouseleave', () => {
                    stage.container().style.cursor = 'default';
                    tooltip.style.display = 'none';
                    if (!selectedSeats.has(seat._id) && !isUnavailable) {
                        seat.stroke('#64748B'); seat.strokeWidth(1.5); mainLayer.batchDraw();
                    }
                });
                seat.on('click tap', (e) => {
                    e.cancelBubble = true;
                    if (isUnavailable) return;
                    toggleSeat(seat, parentGroup);
                });
            }

            if (node.getChildren) {
                node.getChildren().forEach(child => processNode(child, parentGroup));
            }
        }

        rowMap.forEach((seats) => {
             if (seats.length < 2) return;
             const minX = Math.min(...seats.map(s=>s.x)), maxX = Math.max(...seats.map(s=>s.x));
             const minY = Math.min(...seats.map(s=>s.y)), maxY = Math.max(...seats.map(s=>s.y));
             if ((maxY - minY) > (maxX - minX)) seats.sort((a, b) => a.y - b.y);
             else seats.sort((a, b) => a.x - b.x);
        });

        function showSeatTooltip(seatId) {
            const meta = seatMeta.get(seatId);
            if (!meta) return;
            const pos = stage.getPointerPosition();
            if (!pos) return;
            const priceStr = '£' + ((meta.price || 0)/100).toFixed(2);
            let html = '<span class="tt-title">' + meta.label + '</span><span class="tt-meta">' + meta.ticketName + ' • ' + priceStr + '</span>';
            if (meta.info) html += '<div class="tt-info">' + meta.info + '</div>';
            const viewMode = document.getElementById('toggle-views').checked;
            if (meta.viewImg && viewMode) html += '<img src="' + meta.viewImg + '" />';
            else if (meta.viewImg) html += '<div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">(Show seat views to preview)</div>';

            tooltip.innerHTML = html;
            tooltip.style.display = 'block';
            tooltip.style.left = (pos.x + 20) + 'px';
            tooltip.style.top = (pos.y + 20) + 'px';
        }

        // --- 4. PRECISE AUTO-FIT WITH DELAY ---

function forEachNodeList(list, fn) {
  if (!list) return;
  if (Array.isArray(list)) return list.forEach(fn);
  if (typeof list.forEach === 'function') return list.forEach(fn);
  if (typeof list.each === 'function') return list.each(fn); // Konva Collection in some builds
  if (typeof list.toArray === 'function') return list.toArray().forEach(fn);
}

      function fitStageToContent(padding = 50, zoom = 0.95) {
  const loaderEl = document.getElementById('loader');
  const stageEl = document.getElementById('stage-container');

  // Reset first so bounds are measured correctly
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });

 const cw = container.offsetWidth;
const ch = container.offsetHeight;

// Ensure stage matches container BEFORE bounds + centring maths
if (cw && ch) {
  stage.width(cw);
  stage.height(ch);
}

if (!cw || !ch) {
    console.warn('[checkout] fitStageToContent container not ready', { cw, ch });
    if (loaderEl) loaderEl.classList.add('hidden');
    if (stageEl) stageEl.classList.add('visible');
    mainLayer.batchDraw();
    uiLayer.batchDraw();
    return;
  }

  // Only include "semantic" nodes so huge/invisible shapes don't break zoom
  function isSemantic(node) {
    if (!node || !node.getClassName) return false;

    const cn = node.getClassName();

    // We only care about renderable shapes/text
    if (cn === 'Text') return true;

    // Konva Shapes (Circle/Rect/Path/Line/etc)
    if (node.getAttr && node.getAttr('isSeat')) return true;

    const type = node.getAttr ? node.getAttr('shapeType') : null;
    if (type === 'stage') return true;

    const name = (typeof node.name === 'function' ? node.name() : '') || '';
    if (name.includes('label') || name.includes('row')) return true;

    return false;
  }

  // Konva doesn't support find(fn) reliably; use find('*') and filter via .each
  const all = mainLayer.find('*');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

forEachNodeList(all, (node) => {
    try {
      if (!isSemantic(node)) return;
      if (typeof node.isVisible === 'function' && !node.isVisible()) return;
      if (typeof node.opacity === 'function' && node.opacity() === 0) return;

      const rect = node.getClientRect({ relativeTo: mainLayer, skipShadow: true });
if (!rect || rect.width <= 0 || rect.height <= 0) return;

// Ignore absurd bounds that shrink the whole map (common culprit for “tiny / zoomed out”)
const MAX_DIM = Math.max(4000, Math.max(cw, ch) * 10);
if (rect.width > MAX_DIM || rect.height > MAX_DIM) return;
if (Math.abs(rect.x) > MAX_DIM * 2 || Math.abs(rect.y) > MAX_DIM * 2) return;

minX = Math.min(minX, rect.x);
minY = Math.min(minY, rect.y);
maxX = Math.max(maxX, rect.x + rect.width);
maxY = Math.max(maxY, rect.y + rect.height);

    } catch (_) {
      // ignore individual node errors
    }
  });

  // Fallback to full layer bounds if semantic scan fails
  if (!isFinite(minX) || !isFinite(minY) || maxX <= minX || maxY <= minY) {
    console.warn('[checkout] semantic bounds failed, falling back to mainLayer bounds');
    const rect = mainLayer.getClientRect({ skipShadow: true });

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      if (loaderEl) loaderEl.classList.add('hidden');
      if (stageEl) stageEl.classList.add('visible');
      mainLayer.batchDraw();
      uiLayer.batchDraw();
      return;
    }

    minX = rect.x;
    minY = rect.y;
    maxX = rect.x + rect.width;
    maxY = rect.y + rect.height;
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  console.log('[checkout][fit] bounds', {
  minX, minY, maxX, maxY,
  contentWidth, contentHeight,
  cw, ch
});


  const availableWidth = Math.max(10, cw - padding * 2);
  const availableHeight = Math.max(10, ch - padding * 2);

  let scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

  // Your “~95%” zoom-in preference
  scale = scale * zoom;

  // Safety clamp
  scale = Math.max(0.05, Math.min(scale, 4));

  const offsetX = padding + (availableWidth - contentWidth * scale) / 2;
  const offsetY = padding + (availableHeight - contentHeight * scale) / 2;

  stage.scale({ x: scale, y: scale });
  stage.position({
    x: offsetX - minX * scale,
    y: offsetY - minY * scale,
  });

  // Remove any debug bounds if present
forEachNodeList(uiLayer.find('.debug-bounds'), (n) => n.destroy());
  uiLayer.batchDraw();

  if (loaderEl) loaderEl.classList.add('hidden');
  if (stageEl) stageEl.classList.add('visible');

  mainLayer.batchDraw();
  uiLayer.batchDraw();
}


// ✅ Initial fit (this hides loader once the map is built)
fitStageToContent();
updateIcons();

// Failsafe: never allow the loader to remain forever
setTimeout(() => {

  try {
    // Ensure stage matches container size
    stage.width(container.offsetWidth);
    stage.height(container.offsetHeight);

    // Fit + hide loader + show stage
    fitStageToContent();
    updateIcons();

    console.log('[checkout] initial fit done', {
      w: container.offsetWidth,
      h: container.offsetHeight
    });
  } catch (e) {
    console.error('[checkout] initial fit failed', e);
  }
}, 50);

// Failsafe: never allow the loader to remain forever
setTimeout(() => {
  const loaderEl = document.getElementById('loader');
  const stageEl = document.getElementById('stage-container');

  if (loaderEl && !loaderEl.classList.contains('hidden')) {
    console.warn('[checkout] loader failsafe triggered – forcing visible stage');
    loaderEl.classList.add('hidden');
    if (stageEl) stageEl.classList.add('visible');

    try {
      mainLayer.batchDraw();
      uiLayer.batchDraw();
      updateIcons();
    } catch (e) {
      console.error('[checkout] failsafe draw error', e);
    }
  }
}, 2500);

        // Watch for resizes
        const ro = new ResizeObserver(() => {
            stage.width(container.offsetWidth);
            stage.height(container.offsetHeight);
            fitStageToContent();
            updateIcons();
        });
        ro.observe(container);

    } catch (err) {
        console.error(err);
        document.getElementById('loader').innerHTML = 'Error loading map<br><small>' + err.message + '</small>';
    }

    // --- ICON RENDERER (UI Layer) ---
    function updateIcons() {
        uiLayer.find('.info-icon, .view-icon').forEach(n => n.destroy());
        const showViews = document.getElementById('toggle-views').checked;
        const scale = stage.scaleX();
        const inverseScale = scale === 0 ? 1 : 1 / scale;

        mainLayer.find('Circle').forEach(seat => {
            if (!seat.visible() || !seat.getAttr('isSeat')) return;
            const meta = seatMeta.get(seat._id);
            const hasInfo = seat.getAttr('hasInfo');
            const hasView = seat.getAttr('hasView');

            if (!meta || (!hasInfo && !hasView)) return;

            const parentGroup = meta.parentGroup || null;

            const rect = seat.getClientRect({ relativeTo: mainLayer, skipShadow: true });
            const cx = rect.x + rect.width / 2;
            const cy = rect.y + rect.height / 2;
            const radius = seat.radius();

            // INFO ICON
            if (hasInfo) {
               const grp = new Konva.Group({ x: cx + radius*0.65, y: cy - radius*0.65, listening:true, name:'info-icon', scaleX: inverseScale, scaleY: inverseScale });
               grp.add(new Konva.Circle({ radius: 6, fill: '#0F172A' }));
               grp.add(new Konva.Text({ text:'i', fontSize:9, fill:'#fff', offsetX: 3, offsetY: 5, fontStyle:'bold', fontFamily:'Inter, sans-serif', listening:false }));
               grp.on('mouseenter', () => { stage.container().style.cursor = 'help'; showSeatTooltip(seat._id); });
               grp.on('mouseleave', () => { stage.container().style.cursor = 'default'; tooltip.style.display = 'none'; });
               grp.on('click tap', (e) => { e.cancelBubble = true; if (!meta.unavailable) toggleSeat(seat, parentGroup); });
               uiLayer.add(grp);
            }

            // VIEW ICON
            if (hasView && showViews) {
               const grp = new Konva.Group({ x: cx, y: cy, listening:true, name:'view-icon', scaleX: inverseScale, scaleY: inverseScale });
               grp.add(new Konva.Circle({ radius: 10, fill: '#0056D2' }));
               const cam = new Konva.Path({ data: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5 5 2.24 5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z', fill: 'white', scaleX: 0.6, scaleY: 0.6, offsetX: 12, offsetY: 12 });
               grp.add(cam);
               grp.on('mouseenter', () => { stage.container().style.cursor = 'zoom-in'; showSeatTooltip(seat._id); });
               grp.on('mouseleave', () => { stage.container().style.cursor = 'default'; tooltip.style.display = 'none'; });
               grp.on('click tap', (e) => { e.cancelBubble = true; if (!meta.unavailable) toggleSeat(seat, parentGroup); });
               uiLayer.add(grp);
            }
        });
        uiLayer.batchDraw();

// After building the map, hard-lock all nodes so customers can't drag blocks, tables, stage, etc.
try {
  stage.draggable(false);
  stage.find('*').forEach((node) => {
    if (node && typeof node.draggable === 'function') {
      node.draggable(false);
    }
  });
} catch (lockErr) {
  console.warn('[checkout] failed to lock nodes', lockErr);
}


}

stage.on('wheel dragmove', updateIcons);
document.getElementById('toggle-views').addEventListener('change', updateIcons);

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
        updateIcons();
    });

   function leavesGap(row, seatId, willSelect) {
  // rowMap stores objects: { id, x, y, unavailable, node }
  const states = row.map((s) => {
    if (s.unavailable) return 0; // blocked/sold/held/allocated

    if (s.id === seatId) return willSelect ? 2 : 1; // simulate this click

    return selectedSeats.has(s.id) ? 2 : 1; // selected vs open
  });

  // EXCEPTION: if exactly 3 available seats remain in the row and customer takes 2 (leaving 1),
  // allow it even if it technically leaves a gap.
  if (willSelect) {
    const availableCount = row.filter((s) => !s.unavailable).length;
    if (availableCount === 3) {
      const selectedAfter = states.filter((v) => v === 2).length;
      const emptyAfter = states.filter((v) => v === 1).length;
      if (selectedAfter === 2 && emptyAfter === 1) return false;
    }
  }

  // Detect a stranded single: an empty seat with non-empty neighbours (or edge + non-empty)
  for (let i = 0; i < states.length; i++) {
    if (states[i] !== 1) continue;

    const left = i === 0 ? 0 : states[i - 1];
    const right = i === states.length - 1 ? 0 : states[i + 1];

    if (left !== 1 && right !== 1) return true;
  }

  return false;
}

    function toggleSeat(seat, parentGroup) {
        const id = seat._id;
        const willSelect = !selectedSeats.has(id);
        const row = parentGroup ? rowMap.get(parentGroup._id) : null;

        const gapInvalid = row && row.length > 0 && leavesGap(row, id, willSelect);

        if (willSelect) {
            selectedSeats.add(id);
            if (gapInvalid) {
                selectedSeats.delete(id);
                alert("Please do not leave single seat gaps.");
                return;
            }
            if (selectedSeats.size > 10) {
                selectedSeats.delete(id);
                alert("Maximum 10 tickets.");
                return;
            }
            seat.fill('#0056D2'); seat.stroke('#0056D2');
        } else {
            selectedSeats.delete(id);
            if (gapInvalid) {
                selectedSeats.add(id);
                alert("Deselecting this would leave a gap.");
                return;
            }
            seat.fill('#ffffff'); seat.stroke('#64748B');
        }
        mainLayer.batchDraw();
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
      const seatIds = [];

      selectedSeats.forEach(id => {
        totalPence += (seatPrices.get(id) || 0);
        const stableId = seatIdMap.get(id);
        if (stableId) seatIds.push(stableId);
      });

      const quantity = selectedSeats.size;
      const unitPricePence = Math.round(totalPence / quantity);

      try {
        const res = await fetch('/checkout/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId, quantity, unitPricePence, seats: seatIds })
        });
        const data = await res.json();

        if (data.ok && data.url) {
          window.location.href = data.url;
        } else {
          alert("Error: " + (data.message || "Unknown"));
          btn.innerText = 'Continue';
        }
      } catch (e) {
        alert("Connection error");
        btn.innerText = 'Continue';
      }
    });

</script>
</body>
</html>`);

  } catch (err: any) {
    console.error('checkout page error', err);
    return res.status(500).json({ ok: false, message: 'Checkout error' });
  }
});

export default router;
