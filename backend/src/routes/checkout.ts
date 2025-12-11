// backend/src/routes/checkout.ts
import { Router } from 'express';
import { OrderStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { calcFeesForShow } from '../services/fees.js';
import Stripe from 'stripe';

// Standard Stripe initialization
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-06-20' }) : null;
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
    const { showId, quantity, unitPricePence } = DEBUG_REQ_BODY;
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

    if (!Number.isSafeInteger(amountPence)) {
      console.error('checkout/session invalid amountPence', { amountPence, qty, unitPence });
      return res.status(400).json({ ok: false, message: 'Invalid amount calculation' });
    }
    console.debug('checkout/session computed totals', { qty, unitPence: Math.round(unitPence), amountPence });

    // --- DEBUG START: FEE CALCULATION ---
    console.debug('checkout/session calling calcFeesForShow with:', { showId: show.id, amountPence, qty });
    let fees;
    try {
      fees = await calcFeesForShow(show.id, amountPence, qty);
    } catch (feeError: any) {
      console.error('checkout/session fee calculation error', {
        showId: show.id,
        amountPence,
        qty,
        errorMessage: feeError?.message,
        errorName: feeError?.name,
        errorStack: feeError?.stack,
      });
      throw feeError;
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
      metadata: { orderId: order.id, showId: show.id },
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
        allocations: { include: { seats: true } },
      },
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
        orderBy: { updatedAt: 'desc' },
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
      show.allocations.forEach((alloc) => {
        if (alloc.seats) alloc.seats.forEach((s) => heldSeatIds.add(s.seatId));
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
      const ticketOptions = ticketTypes
        .map((t) => `<option value="${t.id}" data-price="${t.pricePence}">${t.name} - ${pFmt(t.pricePence)}</option>`)
        .join('');

      // Fallback HTML page with a basic form for GA purchase
      const generalAdmissionHtml = `<!doctype html>
            <html lang="en"><head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>General Admission | ${show.title}</title>
            <style>
                body { font-family: sans-serif;
                padding: 20px; max-width: 600px; margin: auto; }
                h1 { font-size: 1.5rem;
                }
                form { display: flex;
                flex-direction: column; gap: 15px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ddd; }
                label { font-weight: bold;
                margin-bottom: 5px; }
                select, input[type="number"] { padding: 10px;
                border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                button { padding: 10px 20px;
                background: #0056D2; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
                button:disabled { background: #9E9E9E;
                cursor: not-allowed; }
                .total { font-size: 1.2rem;
                font-weight: bold; margin-top: 10px; }
                .error { color: red;
                margin-top: 10px; }
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
                    const pricePence = Number(selectedOption.getAttribute('data-price')) ||
                    0;
                    const quantity = Number(quantityInput.value) ||
                    0;
                    const total = (pricePence * quantity) / 100;
                    totalPriceSpan.innerText = '£' + total.toFixed(2);
                    buyButton.disabled = quantity === 0 ||
                    pricePence === 0;
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
            </body></html>`;

      res.type('html').send(generalAdmissionHtml);
      return;
    }

    // --- MODE B: MAP VIEW ---
    const mapData = JSON.stringify(konvaData);
    const ticketsData = JSON.stringify(ticketTypes);
    const showIdStr = JSON.stringify(show.id);
    const heldSeatsArray = JSON.stringify(Array.from(heldSeatIds));

    const mapViewHtml = `<!doctype html>
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

    .btn-checkout { background:var(--success); color:white; border:none; padding:12px 32px; border-radius:99px; font-size:1rem;font-weight:700; font-family:'Outfit',sans-serif; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; transition:all 0.2s; opacity:0.5;
    pointer-events:none; }
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
      box-shadow:0 10px 25px -5px rgba(0,0,0,0.3); max-width: 240px; border:1px solid rgba(255,255,255,0.1);
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
<a href="/public/event/${show.id}" class="btn-close"> ✕ </a>
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

// --- SETUP STAGE ---
const container = document.getElementById('stage-container');
    const stage = new Konva.Stage({
        container: 'stage-container',
        width: container.offsetWidth,
        height: container.offsetHeight,
        draggable: true
});

// LAYERS: Main map and UI on top
const mainLayer = new Konva.Layer();
const uiLayer = new Konva.Layer({ listening: true });
stage.add(mainLayer);
stage.add(uiLayer);

const tooltip = document.getElementById('tooltip');

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

        console.log('[DEBUG] Loading Layout...', layout);

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
tempLayer.x(0); tempLayer.y(0); tempLayer.scale({x:1, y:1});
const children = tempLayer.getChildren().slice();
children.forEach(node => {
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

// VISUALS
if (isUnavailable) {
seat.fill('#000000'); // Blackout for sold/held/allocated
seat.stroke('#000000'); seat.strokeWidth(1);
seat.opacity(0.85); seat.listening(true);
} else {
seat.fill('#ffffff'); seat.stroke('#64748B'); seat.strokeWidth(1.5);
                    seat.on('mouseenter', () => { stage.container().style.cursor = 'pointer'; showSeatTooltip(seat._id); });
                    seat.on('mouseleave', () => { stage.container().style.cursor = 'default'; tooltip.style.display = 'none'; });
                    seat.on('click tap', () => toggleSeat(seat, parentGroup));
}

                return;
}

            if (node.children && node.children.length > 0) {
node.getChildren().forEach(child => processNode(child, parentGroup));
}
}

        function showSeatTooltip(id) {
            const meta = seatMeta.get(id);
if (!meta) return;
            const seat = meta.seat;
            const pos = seat.getAbsolutePosition();
            const stagePos = stage.container().getBoundingClientRect();
            tooltip.style.left = (pos.x * stage.scaleX() + stage.x() + stagePos.left + 12) + 'px';
            tooltip.style.top = (pos.y * stage.scaleY() + stage.y() + stagePos.top - 12) + 'px';

            const infoHtml = meta.info ?
'<div class="tt-info">' + meta.info + '</div>' : '';
            const viewHtml = meta.viewImg ?
'<img src="' + meta.viewImg + '" alt="Seat view" />' : '';
            const priceStr = '£' + ((meta.price || 0) / 100).toFixed(2);
            tooltip.innerHTML =
              '<span class="tt-title">' + (meta.label || 'Seat') + '</span>' +
              '<span class="tt-meta">' + meta.ticketName + ' • ' + priceStr + '</span>' +
              infoHtml +
              viewHtml;
tooltip.style.display = 'block';
}

        // --- 3. ADD UI ICONS ---
        const uiIcons = [];
        function updateIcons() {
            const inverseScale = 1 / stage.scaleX();
            const showViews = document.getElementById('toggle-views').checked;

            uiLayer.destroyChildren();
            uiIcons.length = 0;

            seatMeta.forEach((meta, seatId) => {
                const seat = meta.seat;
                const parentGroup = meta.parentGroup;
                if (!seat || !parentGroup) return;

                const hasInfo = !!meta.info;
                const hasView = !!meta.viewImg;

                const groupScale = parentGroup ?
parentGroup.getAbsoluteScale().x : 1;
                const rect = seat.getClientRect({ relativeTo: parentGroup });
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
                   const cam = new Konva.Path({ data: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5 2.24 5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z', fill: 'white', scaleX: 0.6, scaleY: 0.6, offsetX: 12, offsetY: 12 });
                   grp.add(cam);
                   grp.on('mouseenter', () => { stage.container().style.cursor = 'zoom-in'; showSeatTooltip(seat._id); });
                   grp.on('mouseleave', () => { stage.container().style.cursor = 'default'; tooltip.style.display = 'none'; });
                   grp.on('click tap', (e) => { e.cancelBubble = true; if (!meta.unavailable) toggleSeat(seat, parentGroup); });
                   uiLayer.add(grp);
                }
            });
uiLayer.batchDraw();
}

        stage.on('wheel dragmove', updateIcons);
        document.getElementById('toggle-views').addEventListener('change', updateIcons);

        stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
            const newScale = e.evt.deltaY > 0 ?
oldScale / scaleBy : oldScale * scaleBy;
            stage.scale({ x: newScale, y: newScale });
            const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
            stage.position(newPos);
updateIcons();
});

        function leavesGap(row, seatId, willSelect) {
            const states = row.map(s => {
                if (s.unavailable) return 0;
// blocked/held
                if (s.id === seatId) return willSelect ?
2 : 1; // simulate new state
                return selectedSeats.has(s.id) ?
2 : 1; // 2 selected, 1 open
            });

            for (let i = 0; i < states.length; i++) {
                if (states[i] !== 1) continue;
// only care about empty seats
                const left = i === 0 ?
0 : states[i - 1];
                const right = i === states.length - 1 ?
0 : states[i + 1];
                if (left !== 1 && right !== 1) return true;
// orphaned single
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
                    alert('Please do not leave single seat gaps.');
                    return;
                }
                if (selectedSeats.size > 10) {
                    selectedSeats.delete(id);
                    alert('Maximum 10 tickets.');
                    return;
                }
                seat.fill('#0056D2'); seat.stroke('#0056D2');
            } else {
                selectedSeats.delete(id);
                if (gapInvalid) {
                    selectedSeats.add(id);
                    alert('Deselecting this would leave a gap.');
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
selectedSeats.forEach(id => totalPence += (seatPrices.get(id) || 0));
            const quantity = selectedSeats.size;
const unitPricePence = Math.round(totalPence / quantity);
            try {
                const res = await fetch('/checkout/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showId, quantity, unitPricePence }) });
                const data = await res.json();
                if (data.ok && data.url) window.location.href = data.url;
                else { alert('Error: ' + (data.message || 'Unknown'));
btn.innerText = 'Continue'; }
            } catch (e) { alert('Connection error');
btn.innerText = 'Continue'; }
        });
  </script>
</body>
</html>`;

    res.type('html').send(mapViewHtml);
  } catch (err: any) {
    console.error('checkout page error', err);
    return res.status(500).json({ ok: false, message: 'Checkout error' });
  }
});

export default router;
