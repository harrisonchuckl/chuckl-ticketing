import { Router } from "express";
import { OrderStatus } from "@prisma/client";
import prisma from "../lib/prisma.js";
import Stripe from "stripe";

const router = Router();

// --- ROBUST STRIPE INITIALIZATION ---
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const StripeClient = (Stripe as any)?.default || Stripe;

const stripe: Stripe | null = stripeSecret
  ? new StripeClient(stripeSecret, { apiVersion: "2024-06-20" })
  : null;

// --- formatting helper (Required for List View HTML) ---
function pFmt(p: number | null | undefined) {
  return "£" + (Number(p || 0) / 100).toFixed(2);
}

function getPublicBaseUrl(req: any) {
  // Prefer env if set (best for Railway)
  const envBase =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.BASE_URL ||
    "";

  if (envBase) return envBase.replace(/\/+$/, "");

  // Fallback: build from request headers (trust proxy enabled in app.ts)
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toString();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  return `${proto}://${host}`.replace(/\/+$/, "");
}

router.post("/session", async (req, res) => {
  const DEBUG_REQ_BODY = req.body || {};
  console.debug("checkout/session request body (RAW):", DEBUG_REQ_BODY);

  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, message: "Stripe is not configured (missing STRIPE_SECRET_KEY)" });
    }

    const { showId, quantity, unitPricePence, seats, ticketTypeId, items } = DEBUG_REQ_BODY;

    const seatIds: string[] = Array.isArray(seats) ? seats.map((s: any) => String(s)) : [];
    const hasSeats = seatIds.length > 0;

    const show = await prisma.show.findUnique({
      where: { id: String(showId) },
      select: { id: true, title: true },
    });

    if (!show) {
      console.warn("checkout/session missing show", { showId });
      return res.status(404).json({ ok: false, message: "Event not found" });
    }

    const showTitle = show.title ?? "Event ticket";

    // Build line items
    let amountPence = 0;
    let totalQty = 0;

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (Array.isArray(items) && items.length > 0) {
      // Tiered / multi-band checkout
      for (const it of items) {
        const itQty = Number(it?.quantity || 0);
        const itUnit = Number(it?.unitPricePence || 0);

        if (!Number.isFinite(itQty) || !Number.isFinite(itUnit) || itQty <= 0 || itUnit <= 0) {
          return res.status(400).json({ ok: false, message: "Invalid tiered items" });
        }

        totalQty += Math.round(itQty);
        amountPence += Math.round(itUnit) * Math.round(itQty);

        lineItems.push({
          price_data: {
            currency: "gbp",
            product_data: { name: showTitle },
            unit_amount: Math.round(itUnit),
          },
          quantity: Math.round(itQty),
        });
      }

      // (Optional sanity check) seat count should match quantity in tiered mode
      if (hasSeats) {
        const seatCount = seatIds.length;
        if (seatCount !== totalQty) {
          console.warn("tiered checkout mismatch seats vs qty", { seatCount, totalQty });
          // Don’t hard fail if you sometimes don’t pass seats, but if seats are present, mismatch is usually a bug.
          return res.status(400).json({ ok: false, message: "Seat selection mismatch. Please refresh and try again." });
        }
      }
    } else {
      // GA / single-price fallback
      const qty = Number(quantity);
      const unitPence = Number(unitPricePence);

      if (!Number.isFinite(qty) || !Number.isFinite(unitPence) || qty <= 0 || unitPence <= 0) {
        console.warn("checkout/session validation failed", { showId, qty, unitPence });
        return res.status(400).json({ ok: false, message: "showId, quantity and unitPricePence are required" });
      }

      // GA checkout MUST include ticketTypeId so we can create Ticket rows later
      if (!hasSeats && !ticketTypeId) {
        console.warn("checkout/session missing ticketTypeId for GA purchase", { showId, qty });
        return res.status(400).json({
          ok: false,
          message: "ticketTypeId is required for General Admission checkout",
        });
      }

      totalQty = Math.round(qty);
      amountPence = Math.round(unitPence) * totalQty;

      lineItems = [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: showTitle },
            unit_amount: Math.round(unitPence),
          },
          quantity: totalQty,
        },
      ];
    }

    // Create Order (PENDING)
    const order = await prisma.order.create({
      data: {
        showId: show.id,
        quantity: totalQty,
        amountPence: amountPence,
        status: OrderStatus.PENDING,
      },
      select: { id: true },
    });

    const baseUrl = getPublicBaseUrl(req);

    // Pick URLs that exist in your system.
    // - success: you can point to a "thank you" page (or order lookup)
    // - cancel: send them back to the checkout page
const successUrl =
  `${baseUrl}/checkout/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`;



const cancelUrl =
  `${baseUrl}/checkout?showId=${show.id}&checkout=cancel`;

    // WARNING: Stripe metadata values have length limits.
    // If you ever sell lots of seats in one order, consider storing seatIds on the Order in DB
    // and only passing orderId/showId in metadata.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
     metadata: {
  orderId: order.id,
  showId: show.id,
  seatIds: seatIds.join(","),

  // GA purchases (no seats) still rely on ticketTypeId
  ...(ticketTypeId ? { ticketTypeId: String(ticketTypeId) } : {}),

  // Tiered seat mapping (if present)
  ...(((req as any).__seatGroups && String((req as any).__seatGroups).length)
    ? { seatGroups: String((req as any).__seatGroups) }
    : {}),
},

    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return res.json({ ok: true, url: session.url });
  } catch (err: any) {
    console.error("checkout/session CRITICAL ERROR", {
      requestBody: DEBUG_REQ_BODY,
      errorMessage: err?.message,
      errorName: err?.name,
      errorStack: err?.stack,
      rawError: err,
    });
    return res.status(500).json({ ok: false, message: "Checkout error", detail: err?.message });
  }
});

// ✅ Stripe return page (SSR) — shows order summary + status
router.get("/success", async (req, res) => {
  const orderId = String(req.query.orderId || "").trim();
  const sessionId = String(req.query.session_id || "").trim();

  if (!orderId) return res.status(400).send("Missing orderId");

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        showId: true,
        quantity: true,
        amountPence: true,
        status: true,
        stripeCheckoutSessionId: true,
      },
    });

    if (!order) return res.status(404).send("Order not found");

    const show = await prisma.show.findUnique({
      where: { id: order.showId },
      select: { id: true, title: true, date: true },
    });

    const gbp = (pence?: number | null) => `£${(((pence ?? 0) as number) / 100).toFixed(2)}`;
    const isPaid = order.status === "PAID";

    return res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Order ${isPaid ? "Confirmed" : "Received"} | Chuckl.</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#f6f7fb; margin:0; padding:24px;}
    .card{max-width:720px; margin:0 auto; background:#fff; border-radius:16px; padding:22px; box-shadow:0 10px 30px rgba(0,0,0,.08);}
    h1{margin:0 0 10px; font-size:22px;}
    .muted{color:#64748b;}
    .row{display:flex; gap:12px; flex-wrap:wrap; margin-top:14px;}
    .pill{background:#eef2ff; color:#1e3a8a; padding:8px 12px; border-radius:999px; font-weight:600;}
    a.btn{display:inline-block; margin-top:18px; background:#0074d4; color:#fff; text-decoration:none; padding:12px 16px; border-radius:12px; font-weight:700;}
  </style>
</head>
<body>
  <div class="card">
    <h1>${isPaid ? "✅ Payment confirmed" : "⏳ Payment received (processing)"} </h1>
    <div class="muted">${show?.title || "Your event"}${show?.date ? ` • ${new Date(show.date).toLocaleString("en-GB", { dateStyle: "full" })}` : ""}</div>

    <div class="row">
      <div class="pill">Order: ${order.id}</div>
      <div class="pill">Qty: ${order.quantity ?? 0}</div>
      <div class="pill">Total: ${gbp(order.amountPence)}</div>
      <div class="pill">Status: ${order.status}</div>
    </div>

    <p class="muted" style="margin-top:14px;">
      ${isPaid
        ? "Your tickets will be emailed shortly (check junk/spam just in case)."
        : "If this doesn’t update within a minute, refresh this page."}
    </p>

    <a class="btn" href="/checkout?showId=${encodeURIComponent(order.showId)}">Back to event</a>
  </div>
</body>
</html>`);
  } catch (err: any) {
    console.error("[checkout/success] error", err);
    return res.status(500).send("Server error");
  }
});

router.get('/', async (req, res) => {
  // ✅ Backwards compatible: old Stripe success URL redirects to SSR success route
  if (req.query.checkout === "success" && req.query.orderId) {
    return res.redirect(`/public/checkout/success?orderId=${encodeURIComponent(String(req.query.orderId))}`);
  }

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
                /* ZOOM CONTROLS */
.zoom-controls{
  position:absolute;
  right:16px;
  top:90px;
  z-index:4200;
  display:flex;
  flex-direction:column;
  gap:10px;
}

.zoom-btn{
  width:46px;
  height:46px;
  border-radius:14px;
  border:1px solid rgba(15,23,42,0.18);
  background:rgba(255,255,255,0.98);
  box-shadow:0 6px 18px rgba(0,0,0,0.14);
  font-size:22px;
  font-weight:800;
  line-height:1;
  color:#0F172A;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
}

.zoom-btn:active{
  transform: translateY(1px);
}

@media (max-width: 820px), (pointer: coarse), (hover: none) {
  .zoom-controls{
    top:auto;
    bottom:110px; /* keeps it above the footer */
    right:14px;
  }
}

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
const ticketTypeId = selectedOption.value;

const res = await fetch('/checkout/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ showId, quantity, unitPricePence, ticketTypeId })
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
  /* Tickets & Prices panel (below footer) */
#ticket-prices-panel{
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
#ticket-prices-panel .tpp-inner{
  padding: 12px 24px 18px 24px;
}
#ticket-prices-panel .tpp-title{
  font-family:'Outfit',sans-serif;
  font-weight:800;
  color: var(--primary);
  margin-bottom: 10px;
}
#ticket-prices-panel .tpp-tablewrap{
  width:100%;
  overflow:auto;
  border: 1px solid var(--border);
  border-radius: 12px;
}
#ticket-prices-panel .tpp-table{
  width:100%;
  border-collapse: collapse;
  min-width: 520px;
  background: #fff;
}
#ticket-prices-panel .tpp-table th,
#ticket-prices-panel .tpp-table td{
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  font-size: 0.9rem;
}
#ticket-prices-panel .tpp-table th{
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  background: rgba(243,244,246,0.8);
}
.tpp-swatch{
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1px solid rgba(15,23,42,0.25);
  display:inline-block;
  vertical-align: middle;
}

/* Make legend wrap nicely when we show multiple ticket bands */
.legend-row{
  flex-wrap: wrap;
  row-gap: 8px;
}
.legend-item{
  white-space: nowrap;
}

    :root { --bg:#F3F4F6; --surface:#FFFFFF; --primary:#0F172A; --brand:#0056D2; --text-main:#111827; --text-muted:#6B7280; --border:#E5E7EB; --success:#10B981; --blocked:#334155; }
    body { margin:0; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    
    header { background:var(--surface); border-bottom:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; z-index:4000; position:relative; }
    .header-info h1 { font-family:'Outfit',sans-serif; font-size:1.25rem; margin:0; font-weight:700; color:var(--primary); }
    .header-meta { font-size:0.9rem; color:var(--muted); margin-top:4px; }
    .btn-close { text-decoration:none; font-size:1.5rem; color:var(--muted); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
    
    #map-wrapper { flex:1; position:relative; background:#E2E8F0; overflow:hidden; width:100%; height:100%; }
#stage-container {
  width: 100%;
  height: 100%;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.3s;

  /* Critical: prevent browser pinch-zoom / scroll on the page */
  touch-action: none;
  -ms-touch-action: none;

  /* Helps avoid text selection during pan */
  user-select: none;
  -webkit-user-select: none;
}

/* Mobile-only: reserve space under the legend so it doesn't block map interactions */
@media (max-width: 820px), (pointer: coarse), (hover: none) {
  #map-wrapper { --legend-safe: 0px; }

  #stage-container{
    height: calc(100% - var(--legend-safe));
    margin-top: var(--legend-safe);
  }
}
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

    /* ZOOM CONTROLS (bottom-right, vertical) */
    .zoom-controls{
      position:absolute;
      right:16px;
      bottom:16px;
      z-index:4200;
      display:flex;
      flex-direction:column;
      gap:10px;
      pointer-events:auto;
    }

    .zoom-btn{
      width:46px;
      height:46px;
      border-radius:14px;
      border:1px solid rgba(15,23,42,0.18);
      background:rgba(255,255,255,0.98);
      box-shadow:0 6px 18px rgba(0,0,0,0.14);
      font-size:22px;
      font-weight:800;
      line-height:1;
      color:#0F172A;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
    }

    .zoom-btn:active{
      transform: translateY(1px);
    }

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
    
        /* Tooltip (desktop hover + mobile seat-view tap) */
    #tooltip{
      position:absolute;
      display:none;
      padding:12px;
      background:#1e293b;
      color:#fff;
      border-radius:10px;
      pointer-events:none;
      font-size:0.85rem;
      z-index:4500;
      box-shadow:0 10px 25px -5px rgba(0,0,0,0.30);
      max-width:260px;
      border:1px solid rgba(255,255,255,0.10);
    }

    /* Bigger tooltip on mobile */
@media (max-width: 820px), (pointer: coarse), (hover: none) {
  #tooltip{
    max-width: 340px;
    font-size: 1rem;
    padding: 14px;
    border-radius: 12px;
  }
  #tooltip img{
    max-width: 340px;
    max-height: 240px;
  }
}

    #tooltip .tt-title{ display:block; font-weight:800; margin-bottom:2px; }
    #tooltip .tt-meta{ display:block; font-size:0.75rem; color:#cbd5e1; margin-bottom:6px; }
    #tooltip .tt-info{ font-size:0.82rem; color:#e2e8f0; line-height:1.25; margin-top:6px; }
    #tooltip img{
      width:100%;
      max-width:260px;
      max-height:180px;
      object-fit:cover;
      border-radius:8px;
      margin-top:8px;
      display:block;
      border:1px solid rgba(255,255,255,0.12);
    }

    /* Mobile "seat info" line above Total */
    .basket-seatinfo{
      display:none;
      font-size:0.85rem;
      color:var(--text-main);
      line-height:1.2;
      margin-bottom:6px;
    }
    .basket-seatinfo strong{ font-weight:800; }
  </style>

</head>
<body>
  <header>
    <div class="header-info"><h1>${show.title}</h1><div class="header-meta">${dateStr} • ${timeStr} • ${venueName}</div></div>
    <a href="/public/event/${show.id}" class="btn-close">✕</a>
  </header>
 <div id="map-wrapper">
<div class="legend">
  <div class="legend-row" id="legend-main-row">
        <div class="legend-item"><div class="dot dot-avail"></div> Available</div>
        <div class="legend-item"><div class="dot dot-selected"></div> Selected</div>
        <div class="legend-item"><div class="dot dot-sold"></div> Unavailable</div>
      </div>
      <label class="view-toggle">
        <input type="checkbox" id="toggle-views" /> 
        <span>Show seat views</span>
      </label>
    </div>

    <!-- ZOOM CONTROLS -->
    <div class="zoom-controls" aria-label="Zoom controls">
      <button type="button" class="zoom-btn" id="zoom-in" aria-label="Zoom in">+</button>
      <button type="button" class="zoom-btn" id="zoom-out" aria-label="Zoom out">−</button>
    </div>

    <div id="stage-container"></div>
    <div id="tooltip"></div>
    <div id="loader"><div class="spinner"></div><div>Loading seating plan...</div></div>
  </div> <!-- /#map-wrapper -->
<footer>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;">
    <div class="basket-info">
      <div class="basket-seatinfo" id="ui-seatinfo"></div>

      <div class="basket-label">Total</div>
      <div class="basket-total" id="ui-total">£0.00</div>
      <div class="basket-detail" id="ui-count">0 tickets selected</div>
    </div>

    <div style="display:flex;gap:10px;align-items:center;">
      <button class="btn-checkout" id="btn-next">Continue</button>
    </div>
  </div>
</footer>

<!-- Tickets & Prices (tiered pricing mode only) -->
<section id="ticket-prices-panel" style="display:none;">
  <div class="tpp-inner">
    <div class="tpp-title">Tickets & Prices</div>
    <div class="tpp-tablewrap">
      <table class="tpp-table" aria-label="Tickets and prices">
        <thead>
          <tr>
            <th style="width:56px;">Colour</th>
            <th>Ticket</th>
            <th style="width:120px;">Price</th>
          </tr>
        </thead>
        <tbody id="ticket-prices-tbody"></tbody>
      </table>
    </div>
  </div>
</section>

  <script>

  const rawLayout = ${mapData};
const ticketTypes = ${ticketsData};
const showId = ${showIdStr};
const heldSeatIds = new Set(${heldSeatsArray});

/* -----------------------------
   Tiered pricing (banded seats)
------------------------------ */
const TICKET_PALETTE = [
  '#2563EB', '#16A34A', '#F97316', '#A855F7', '#DC2626',
  '#0EA5E9', '#84CC16', '#F59E0B', '#14B8A6', '#DB2777',
  '#64748B'
];

const sortedTickets = (ticketTypes || []).slice().sort((a,b) =>
  (Number(a.pricePence||0) - Number(b.pricePence||0)) || String(a.name||'').localeCompare(String(b.name||''))
);

const ticketColorById = new Map();
sortedTickets.forEach((t, idx) => ticketColorById.set(t.id, TICKET_PALETTE[idx % TICKET_PALETTE.length]));

function pFmtLocal(p) {
  return '£' + (Number(p || 0) / 100).toFixed(2);
}

function escHtml(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function getTicketColor(ticketId){
  return ticketColorById.get(ticketId) || '#64748B';
}

// Raw (seat-assigned) ticket IDs seen in the layout (used to detect banded pricing)
const __seatAssignedTicketIdsRaw = new Set();       // raw strings found in layout attrs
const __seatAssignedTicketIdsResolved = new Set();  // actual ticketType ids resolved for seats

// Tiered mode flag (computed after seats are processed)
let IS_TIERED_PRICING = false;

    
    const selectedSeats = new Set();
const seatPrices = new Map();
const seatMeta = new Map();
// rowKey -> [{ id, x, y, unavailable, node }]
const rowMap = new Map();

// rowKey -> { groupType, axis, enforce }
const rowKeyMeta = new Map();
const seatIdMap = new Map();
const seatNodeMap = new Map(); // seatInternalId -> Konva Circle (for hover cleanup)

let hoveredSeatId = null;

// When the pointer is on an embedded "i" glyph, we don't want the seat Circle's mouseleave
// to instantly hide the tooltip (moving from Circle -> Text triggers Circle mouseleave in Konva).
let hoveringInfoGlyphSeatId = null;

function resetSeatStroke(seat) {
  if (!seat) return;
  const id = seat._id;
  const meta = seatMeta.get(id);

  if (!meta) {
    seat.stroke('#64748B');
    seat.strokeWidth(1.5);
    seat.fill('#ffffff');
    return;
  }

  if (meta.unavailable) {
    seat.fill('#000000');
    seat.stroke('#000000');
    seat.strokeWidth(1);
    return;
  }

  const tc = meta.ticketColor || '#64748B';

  if (selectedSeats.has(id)) {
    // Selected styling:
    // Tiered mode -> white fill + coloured outline
    // Normal -> blue fill + blue outline
    if (IS_TIERED_PRICING) {
      seat.fill('#FFFFFF');
      seat.stroke(tc);
      seat.strokeWidth(3);
    } else {
      seat.fill('#0056D2');
      seat.stroke('#0056D2');
      seat.strokeWidth(3);
    }
    return;
  }

  // Default available styling
  if (IS_TIERED_PRICING) {
    seat.fill(tc);
    seat.stroke(tc);
    seat.strokeWidth(1.5);
  } else {
    seat.fill('#ffffff');
    seat.stroke('#64748B');
    seat.strokeWidth(1.5);
  }
}

function applyHoverStroke(seat) {
  if (!seat) return;

  const meta = seatMeta.get(seat._id);
  if (meta && meta.unavailable) return;

  // Keep hover consistent with the band colour in tiered mode
  if (IS_TIERED_PRICING && meta) {
    seat.stroke(meta.ticketColor || '#64748B');
    seat.strokeWidth(3);
    return;
  }

  // Existing behaviour
  seat.stroke('#0056D2');
  seat.strokeWidth(3);
}

function clearHoverSeat() {
  if (!hoveredSeatId) return;
  const prev = seatNodeMap.get(hoveredSeatId);
  if (prev) resetSeatStroke(prev);
  hoveredSeatId = null;
  mainLayer.batchDraw();
}

function setHoverSeat(seat) {
  if (!seat) return;

  const id = seat._id;

  // If we hover a new seat, always clear the old one first
  if (hoveredSeatId && hoveredSeatId !== id) {
    const prev = seatNodeMap.get(hoveredSeatId);
    if (prev) resetSeatStroke(prev);
  }

  hoveredSeatId = id;

  // Only apply hover ring to AVAILABLE + not selected seats
  const meta = seatMeta.get(id);
  if (meta && !meta.unavailable && !selectedSeats.has(id)) {
    applyHoverStroke(seat);
  }

  mainLayer.batchDraw();
}


    // --- SETUP STAGE ---
    const container = document.getElementById('stage-container');
   const stage = new Konva.Stage({
  container: 'stage-container',
  width: container.offsetWidth,
  height: container.offsetHeight,
  draggable: true // customer view: allow pan
});

// Make “accidental micro-drags” not steal clicks
stage.dragDistance(8);


    
    // LAYERS: Main map and UI on top
    const mainLayer = new Konva.Layer();
    const uiLayer = new Konva.Layer({ listening: true });
    stage.add(mainLayer);
    stage.add(uiLayer);
    
    const tooltip = document.getElementById('tooltip');

// ============================
// ZOOM + PAN ENGINE (buttons, wheel, pinch)
// ============================
const ZOOM_CFG = {
  minScale: 0.05,
  maxScale: 4,
  step: 1.15,
  minSeatPx: 14 // minimum “tap-safe” seat radius in screen pixels (mobile)
};

let __autoMinZoomDone = false;
let __pinching = false;
let __pinchStartDist = 0;
let __pinchStartScale = 1;

// Throttle heavy icon rebuilds to 1/frame
let __iconsRAF = 0;
function scheduleUpdateIcons() {
  if (__iconsRAF) return;
  __iconsRAF = requestAnimationFrame(() => {
    __iconsRAF = 0;
    try { updateIcons(); } catch (_) {}
  });
}

function clampScale(s) {
  return Math.max(ZOOM_CFG.minScale, Math.min(ZOOM_CFG.maxScale, s));
}

function zoomToScaleAtPoint(newScale, screenPoint) {
  clearHoverSeat();
  if (!screenPoint) screenPoint = { x: stage.width() / 2, y: stage.height() / 2 };

  const oldScale = stage.scaleX();
  const nextScale = clampScale(newScale);

  // Avoid doing work for tiny changes
  if (!Number.isFinite(nextScale) || Math.abs(nextScale - oldScale) < 0.0001) return;

  // Keep zoom anchored around the screenPoint
  const mousePointTo = {
    x: (screenPoint.x - stage.x()) / oldScale,
    y: (screenPoint.y - stage.y()) / oldScale
  };

  stage.scale({ x: nextScale, y: nextScale });

  const newPos = {
    x: screenPoint.x - mousePointTo.x * nextScale,
    y: screenPoint.y - mousePointTo.y * nextScale
  };

  stage.position(newPos);

  scheduleUpdateIcons();
  mainLayer.batchDraw();
  uiLayer.batchDraw();
}

function zoomByFactor(factor, screenPoint) {
  zoomToScaleAtPoint(stage.scaleX() * factor, screenPoint);
}

function getContainerRect() {
  const el = stage.container();
  return el ? el.getBoundingClientRect() : null;
}

function screenPointFromNativeEvent(nativeEvt) {
  const rect = getContainerRect();
  if (!rect || !nativeEvt) return null;

  // touch event
  const t = nativeEvt.touches && nativeEvt.touches[0] ? nativeEvt.touches[0] : null;
  const cx = t ? t.clientX : nativeEvt.clientX;
  const cy = t ? t.clientY : nativeEvt.clientY;

  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return { x: cx - rect.left, y: cy - rect.top };
}

function getFirstSeatRadiusWorld() {
  let r = 0;
  try {
    const circles = mainLayer.find('Circle');
    circles.each((c) => {
      if (r) return;
      if (c && c.getAttr && c.getAttr('isSeat')) {
        r = (typeof c.radius === 'function') ? c.radius() : (c.getAttr('radius') || 0);
      }
    });
  } catch (_) {}
  return Number(r) || 0;
}

/**
 * Mobile-only: on first interaction, if seats are too small to safely tap,
 * zoom in to a minimum seat size around the user’s tap point.
 * Returns true if it performed an auto-zoom (callers should STOP the click).
 */
function ensureMinSeatTapSize(nativeEvt) {
  if (!isMobileView) return false;
  if (__autoMinZoomDone) return false;

  const seatR = getFirstSeatRadiusWorld();
  if (!seatR) { __autoMinZoomDone = true; return false; }

  const currentScale = stage.scaleX();
  const seatPx = seatR * currentScale;

  // Already tap-safe
  if (seatPx >= ZOOM_CFG.minSeatPx) {
    __autoMinZoomDone = true;
    return false;
  }

  const targetScale = clampScale(currentScale * (ZOOM_CFG.minSeatPx / Math.max(0.0001, seatPx)));
  if (targetScale <= currentScale + 0.0001) {
    __autoMinZoomDone = true;
    return false;
  }

  const p = screenPointFromNativeEvent(nativeEvt) || { x: stage.width() / 2, y: stage.height() / 2 };
  zoomToScaleAtPoint(targetScale, p);

  __autoMinZoomDone = true;
  return true;
}

// Cursor feel during pan
stage.on('dragstart', () => {
  hideSeatTooltip();
  clearHoverSeat();
  stage.container().style.cursor = 'grabbing';
});
stage.on('dragend', () => {
  stage.container().style.cursor = 'grab';
});
stage.on('dragmove', () => {
  // keep overlays aligned (throttled)
  scheduleUpdateIcons();
});

// Buttons
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');

if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
  const center = { x: stage.width() / 2, y: stage.height() / 2 };
  zoomByFactor(ZOOM_CFG.step, center);
});

if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
  const center = { x: stage.width() / 2, y: stage.height() / 2 };
  zoomByFactor(1 / ZOOM_CFG.step, center);
});

// Wheel zoom (desktop trackpads/mice)
stage.on('wheel', (e) => {
  clearHoverSeat();
  e.evt.preventDefault();

  const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
  const factor = (e.evt.deltaY > 0) ? (1 / ZOOM_CFG.step) : ZOOM_CFG.step;

  zoomByFactor(factor, pointer);
});

// Pinch zoom (mobile)
stage.container().addEventListener('touchstart', (e) => {
  if (e.touches && e.touches.length === 2) {
    __pinching = true;
    __autoMinZoomDone = true; // pinch implies they can control zoom now
    stage.draggable(false);

    const rect = getContainerRect();
    const a = e.touches[0];
    const b = e.touches[1];

    const ax = a.clientX - rect.left;
    const ay = a.clientY - rect.top;
    const bx = b.clientX - rect.left;
    const by = b.clientY - rect.top;

    __pinchStartDist = Math.hypot(bx - ax, by - ay);
    __pinchStartScale = stage.scaleX();
  }
}, { passive: false });

stage.container().addEventListener('touchmove', (e) => {
  if (!__pinching) return;
  if (!(e.touches && e.touches.length === 2)) return;

  e.preventDefault();

  const rect = getContainerRect();
  const a = e.touches[0];
  const b = e.touches[1];

  const ax = a.clientX - rect.left;
  const ay = a.clientY - rect.top;
  const bx = b.clientX - rect.left;
  const by = b.clientY - rect.top;

  const dist = Math.hypot(bx - ax, by - ay);
  if (!__pinchStartDist) return;

  const center = { x: (ax + bx) / 2, y: (ay + by) / 2 };
  const scale = __pinchStartScale * (dist / __pinchStartDist);

  zoomToScaleAtPoint(scale, center);
}, { passive: false });

stage.container().addEventListener('touchend', (e) => {
  if (__pinching && (!e.touches || e.touches.length < 2)) {
    __pinching = false;
    stage.draggable(true);
    stage.container().style.cursor = 'grab';
  }
}, { passive: true });

// Mobile: first tap on the map (empty space) auto-zooms if needed
stage.container().addEventListener('pointerdown', (e) => {
  if (!isMobileView) return;

  // ignore taps on the legend / zoom buttons
  if (e.target && e.target.closest && (e.target.closest('.legend') || e.target.closest('.zoom-controls'))) return;

  // If they tapped a seat/icon, the seat handlers will deal with it (we’ll auto-zoom there too via seat click patch below)
  // But tapping empty map should also zoom
  ensureMinSeatTapSize(e);
}, { passive: true });


    function applyMobileLegendSafeArea() {
  const mw = document.getElementById('map-wrapper');
  const legend = document.querySelector('.legend');
  if (!mw || !legend) return;

  // Only apply on mobile view
  if (!isMobileView) {
    mw.style.setProperty('--legend-safe', '0px');
    return;
  }

  // Add a small gap so it feels intentional
  const gap = 12;
  const h = legend.offsetHeight || 0;

  mw.style.setProperty('--legend-safe', (h + gap) + 'px');
}


  const isMobileView =
  (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
  (window.matchMedia && window.matchMedia('(hover: none)').matches) ||
  ('ontouchstart' in window);

// --- Tooltip dismiss on mobile (tap anywhere else) ---
let __ttLastOpenAt = 0;

function hideSeatTooltip() {
  if (!tooltip) return;
  tooltip.style.display = 'none';
}

function markSeatTooltipOpened() {
  __ttLastOpenAt = Date.now();
}

// Capture taps anywhere on the page; only dismiss when:
// - mobile view
// - "Show seat views" is ON
// - tooltip is currently visible
// - and not immediately after opening (prevents "open then instantly close")
document.addEventListener('pointerdown', (e) => {
  if (!isMobileView) return;

  const viewModeEl = document.getElementById('toggle-views');
  const viewMode = !!(viewModeEl && viewModeEl.checked);
  if (!viewMode) return;

  if (!tooltip || tooltip.style.display !== 'block') return;

  // Prevent the same tap that opened the tooltip from closing it immediately
  if (Date.now() - __ttLastOpenAt < 250) return;

  // If user taps the legend area (including the checkbox), don't auto-dismiss
  const t = e.target;
  if (t && t.closest && t.closest('.legend')) return;

  hideSeatTooltip();
  clearHoverSeat();
}, { capture: true, passive: true });
// --- end tooltip dismiss ---


const toggleViews = document.getElementById('toggle-views');
const uiSeatInfo = document.getElementById('ui-seatinfo');

function setSeatInfoLine(text) {
  if (!uiSeatInfo) return;
  uiSeatInfo.textContent = '';
  if (!text) {
    uiSeatInfo.style.display = 'none';
    return;
  }
  uiSeatInfo.style.display = 'block';
  uiSeatInfo.textContent = text;
}

    stage.container().addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
  stage.container().style.cursor = 'default';
  clearHoverSeat();
});


    // ============================
// DEBUG TOOLKIT (INFO ICONS)
// ============================
const DEBUG_INFO = true; // toggle off when fixed
const dbg = (...args) => { if (DEBUG_INFO) console.log(...args); };
const dbgw = (...args) => { if (DEBUG_INFO) console.warn(...args); };

function nodeBrief(n) {
  if (!n) return null;
  const cn = (typeof n.getClassName === 'function') ? n.getClassName() : n.className;
  const name = (typeof n.name === 'function') ? n.name() : n.attrs?.name;
  const id = (typeof n.id === 'function') ? n.id() : n.attrs?.id;
  const text = (cn === 'Text' && typeof n.text === 'function') ? n.text() : undefined;
  const fill = (typeof n.fill === 'function') ? n.fill() : n.attrs?.fill;
  const opacity = (typeof n.opacity === 'function') ? n.opacity() : n.attrs?.opacity;
  const visible = (typeof n.isVisible === 'function') ? n.isVisible() : n.visible?.();
  return { cn, name, id, text, fill, opacity, visible };
}

function listInfoGlyphCandidates(root) {
  if (!root || typeof root.find !== 'function') return [];
  const out = [];
  try {
    root.find('Text').forEach(t => {
      const txt = (typeof t.text === 'function') ? t.text() : '';
      if (!txt) return;
      // Candidate matches: lowercase i, info symbols, or anything that looks like "info"
      const trimmed = String(txt).trim();
      if (trimmed === 'i' || trimmed === 'ℹ' || trimmed === 'ⓘ' || /info/i.test(trimmed)) {
        out.push(t);
      }
    });
  } catch (_) {}
  try {
    root.find('*').forEach(n => {
      const nm = (typeof n.name === 'function') ? n.name() : '';
      if (nm && /info/i.test(nm)) out.push(n);
    });
  } catch (_) {}
  return out;
}

function debugScanInfoState(tag = 'scan') {
  try {
    const allSeats = mainLayer.find('Circle').filter(s => s.getAttr && s.getAttr('isSeat'));
    const seatsWithHasInfo = allSeats.filter(s => !!s.getAttr('hasInfo'));
    const seatsWithMetaInfo = allSeats.filter(s => {
      const m = seatMeta.get(s._id);
      return !!(m && m.info && String(m.info).trim().length);
    });

dbg('[checkout][info][' + tag + '] seats', {
      totalSeats: allSeats.length,
      hasInfoAttr: seatsWithHasInfo.length,
      metaInfo: seatsWithMetaInfo.length
    });

    // Inspect first 20 seats that *should* have info
    seatsWithMetaInfo.slice(0, 20).forEach((seat, idx) => {
      const meta = seatMeta.get(seat._id);
      const stableId = seatIdMap.get(seat._id);
      const p = seat.getParent ? seat.getParent() : null;

dbg('[checkout][info][' + tag + '] seat#' + idx, {
        seatInternalId: seat._id,
        stableId,
        label: meta?.label,
        info: meta?.info,
        hasInfoAttr: !!seat.getAttr('hasInfo'),
        sbEmbeddedInfoGlyph: !!seat.getAttr('sbEmbeddedInfoGlyph'),
        seatFill: (seat.fill && seat.fill()) || seat.getAttr('fill'),
        parent: nodeBrief(p),
      });

      // What "info glyph" nodes exist near this seat?
      const candidates = []
        .concat(listInfoGlyphCandidates(p))
        .concat(listInfoGlyphCandidates(meta?.parentGroup));

dbg('[checkout][info][' + tag + '] glyph candidates', candidates.map(nodeBrief));

      // Do we have a UI overlay icon created for this seat?
      const uiIcons = uiLayer.find('.info-icon').filter(g => g.getAttr && g.getAttr('sbSeatInternalId') === seat._id);
dbg('[checkout][info][' + tag + '] ui icon groups', uiIcons.map(nodeBrief));
    });
  } catch (e) {
    dbgw('[checkout][info] debugScanInfoState failed', e);
  }
}

// Expose a couple helpers so you can run them from DevTools console
window.__checkoutDebug = {
  scan: (tag) => debugScanInfoState(tag || 'manual'),
  dumpSeat: (seatInternalId) => {
    const seat = mainLayer.find('Circle').find(s => s._id === seatInternalId);
    dbg('[checkout][info] dumpSeat seat', nodeBrief(seat));
    dbg('[checkout][info] dumpSeat meta', seatMeta.get(seatInternalId));
    if (seat) {
      const p = seat.getParent ? seat.getParent() : null;
      dbg('[checkout][info] dumpSeat parent candidates', listInfoGlyphCandidates(p).map(nodeBrief));
    }
  }
};


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

    
   // Ticket assignment can be stored on the seat Circle, the seat wrapper Group, or the row/table Group.
// It can also use slightly different attribute keys depending on builder version.
const TICKET_ATTR_KEYS = [
  'sbTicketId',
  'sbTicketTypeId',
  'ticketTypeId',
  'ticketId',
  'ticketType',
  'ticket'
];

function normaliseTicketAttrValue(v) {
  if (v === undefined || v === null) return '';

  // If it's already a string/number, use it
  if (typeof v === 'string' || typeof v === 'number') {
    const s = String(v).trim();
    return s;
  }

  // If it's an object, try common shapes
  if (typeof v === 'object') {
    // e.g. { id: "..." }
    if (v.id !== undefined && v.id !== null) {
      const s = String(v.id).trim();
      if (s) return s;
    }

    // e.g. { ticketTypeId: "..." } or { sbTicketId: "..." }
    for (const kk of TICKET_ATTR_KEYS) {
      if (v[kk] !== undefined && v[kk] !== null) {
        const s = String(v[kk]).trim();
        if (s) return s;
      }
    }

    // e.g. { value: "..." }
    if (v.value !== undefined && v.value !== null) {
      const s = String(v.value).trim();
      if (s) return s;
    }
  }

  // Avoid returning "[object Object]"
  return '';
}

function readTicketAttrFromNode(node) {
  try {
    if (!node || !node.getAttr) return '';
    for (const k of TICKET_ATTR_KEYS) {
      const v = node.getAttr(k);
      const s = normaliseTicketAttrValue(v);
      if (s) return s;
    }
  } catch (_) {}
  return '';
}

function getSeatWrapper(seatNode) {
  try {
    return (seatNode && typeof seatNode.getParent === 'function') ? seatNode.getParent() : null;
  } catch (_) {
    return null;
  }
}

function findAssignedTicketRawUpTree(node, maxDepth = 10) {
  let cur = node;
  let d = 0;

  while (cur && d < maxDepth) {
    const s = readTicketAttrFromNode(cur);
    if (s) return s;

    cur = (typeof cur.getParent === 'function') ? cur.getParent() : null;
    d++;
  }

  return '';
}

function findAssignedTicketRaw(seatNode, parentGroup) {
  // Priority: seat -> wrapper -> explicit parentGroup -> walk up the tree
  const seatRaw = readTicketAttrFromNode(seatNode);
  if (seatRaw) return seatRaw;

  const wrap = getSeatWrapper(seatNode);
  const wrapRaw = readTicketAttrFromNode(wrap);
  if (wrapRaw) return wrapRaw;

  const pgRaw = readTicketAttrFromNode(parentGroup);
  if (pgRaw) return pgRaw;

  // Walk up from wrapper (usually the right chain), then from seat as fallback
  const upFromWrap = findAssignedTicketRawUpTree(wrap, 12);
  if (upFromWrap) return upFromWrap;

  const upFromSeat = findAssignedTicketRawUpTree(seatNode, 12);
  if (upFromSeat) return upFromSeat;

  return '';
}

// Fallback map: raw layout ticket key -> actual ticketType object
// This ensures tiered maps still behave correctly even when the layout stores local ids.
const __rawTicketFallbackMap = new Map(); // raw:string -> ticketType

function tryExtractTicketIndex(r) {
  const s = String(r || '').trim();
  if (!s) return null;

  // Common patterns:
  // "ticket-123-3" => 3
  // "ticketType-2" / "ticket_type_2" / "band:2" => 2
  // "TT 1" => 1
  let m =
    s.match(/-(\d+)\s*$/) ||
    s.match(/(?:tickettype|ticket_type|ticket|band|tier|tt)\s*[:#\-_ ]\s*(\d+)\s*$/i) ||
    s.match(/\b(\d+)\s*$/);

  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n;
}

function tryExtractPrismaIdLike(r) {
  // Prisma ids in your project look like "cmj4..."/"cmi8..." (cuid-ish).
  // If the raw string contains a real id inside it, pull it out.
  const s = String(r || '').trim();
  if (!s) return null;

  const m = s.match(/\b(c[a-z0-9]{12,})\b/i);
  return m ? String(m[1]) : null;
}

function resolveTicketTypeStrict(raw) {
  const r = String(raw || '').trim();
  if (!r) return null;

  // 0) If raw looks JSON-ish, try parse and re-resolve from common shapes
  if (r.startsWith('{') && r.endsWith('}')) {
    try {
      const obj = JSON.parse(r);
      if (obj && typeof obj === 'object') {
        if (obj.id) return resolveTicketTypeStrict(String(obj.id));
        for (const k of TICKET_ATTR_KEYS) {
          if (obj[k]) return resolveTicketTypeStrict(String(obj[k]));
        }
        if (obj.value) return resolveTicketTypeStrict(String(obj.value));
      }
    } catch (_) {}
  }

  // 1) Exact id match
  let t = ticketTypes.find(tt => String(tt.id) === r);
  if (t) return t;

  // 2) Id embedded inside a longer string (e.g. "TicketType:cmj4...")
  const embeddedId = tryExtractPrismaIdLike(r);
  if (embeddedId) {
    t = ticketTypes.find(tt => String(tt.id) === embeddedId);
    if (t) return t;
  }

  // 3) Stored as name
  t = ticketTypes.find(tt => String(tt.name || '').trim().toLowerCase() === r.toLowerCase());
  if (t) return t;

  // 4) Pure index string ("0", "1", ...)
  if (/^\d+$/.test(r)) {
    const idx = Number(r);
    if (Number.isFinite(idx) && idx >= 0 && idx < ticketTypes.length) return ticketTypes[idx];
  }

  // 5) Builder-local ids like "ticket-...-3" or "ticketType-2" etc
  // Prefer 1-based mapping, but also try 0-based just in case.
  const n = tryExtractTicketIndex(r);
  if (n !== null) {
    const idx1 = n - 1; // 1-based
    if (Number.isFinite(idx1) && idx1 >= 0 && idx1 < ticketTypes.length) return ticketTypes[idx1];

    const idx0 = n; // 0-based fallback
    if (Number.isFinite(idx0) && idx0 >= 0 && idx0 < ticketTypes.length) return ticketTypes[idx0];
  }

  return null;
}

function resolveTicketType(raw) {
  const r = String(raw || '').trim();
  if (!r) return null;

  // First: strict resolution
  const strict = resolveTicketTypeStrict(r);
  if (strict) return strict;

  // Second: deterministic fallback mapping by raw value
  if (__rawTicketFallbackMap.has(r)) return __rawTicketFallbackMap.get(r);

  // If it has a usable numeric suffix, map that to ticketTypes
  const n = tryExtractTicketIndex(r);
  if (n !== null) {
    const idx1 = n - 1;
    if (idx1 >= 0 && idx1 < ticketTypes.length) {
      const tt = ticketTypes[idx1];
      __rawTicketFallbackMap.set(r, tt);
      return tt;
    }
    const idx0 = n;
    if (idx0 >= 0 && idx0 < ticketTypes.length) {
      const tt = ticketTypes[idx0];
      __rawTicketFallbackMap.set(r, tt);
      return tt;
    }
  }

  // Otherwise: assign next unused ticketType (keeps different raw values as different bands)
  const usedIds = new Set(Array.from(__rawTicketFallbackMap.values()).map(tt => String(tt.id)));
  const next = ticketTypes.find(tt => !usedIds.has(String(tt.id))) || ticketTypes[0] || null;

  if (next) __rawTicketFallbackMap.set(r, next);
  return next;
}

function getTicketType(seatNode, parentGroup) {
  const raw = findAssignedTicketRaw(seatNode, parentGroup);
  return resolveTicketType(raw) || (ticketTypes.length > 0 ? ticketTypes[0] : null);
}

function isInfoGlyphTextNode(t) {
  try {
    const txt = (typeof t.text === 'function' ? t.text() : String(t.text || '')).trim();
    return txt === 'i' || txt === 'ℹ' || txt === 'ⓘ';
  } catch (_) {
    return false;
  }
}

function extractFirstHelpfulStringAttr(node) {
  try {
    if (!node || typeof node.getAttrs !== 'function') return '';
    const attrs = node.getAttrs() || {};
    const hints = ['sbinfo', 'info', 'tooltip', 'note', 'desc', 'description', 'seatinfo'];

    for (const [k, v] of Object.entries(attrs)) {
      if (typeof v !== 'string') continue;
      const key = String(k).toLowerCase();
      if (!hints.some(h => key.includes(h))) continue;
      const s = String(v || '').trim();
      if (s) return s;
    }
  } catch (_) {}
  return '';
}

// Walk up from the glyph until we find a parent that actually contains the seat circle
function findSeatCircleForGlyph(glyph, maxDepth = 10) {
  try {
    let p = glyph && typeof glyph.getParent === 'function' ? glyph.getParent() : null;
    let depth = 0;

    while (p && depth < maxDepth) {
      if (typeof p.find === 'function') {
        const seats = p.find('Circle').filter(c => c && c.getAttr && c.getAttr('isSeat'));
        if (seats && seats.length) {
          // Use glyph centre vs seat centre and pick the closest
          const gRect = glyph.getClientRect({ relativeTo: mainLayer, skipShadow: true });
          const gx = gRect.x + gRect.width / 2;
          const gy = gRect.y + gRect.height / 2;

          let best = seats[0];
          let bestD = Infinity;

          seats.forEach((s) => {
            const r = s.getClientRect({ relativeTo: mainLayer, skipShadow: true });
            const sx = r.x + r.width / 2;
            const sy = r.y + r.height / 2;
            const dx = sx - gx;
            const dy = sy - gy;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD) { bestD = d2; best = s; }
          });

          return { seatCircle: best, seatContainer: p };
        }
      }
      p = typeof p.getParent === 'function' ? p.getParent() : null;
      depth++;
    }
  } catch (_) {}
  return { seatCircle: null, seatContainer: null };
}

// Try to pull info from the badge glyph, its badge group, or the seat container/seat itself
function extractInfoFromEmbeddedGlyph(glyph, seatCircle, seatContainer) {
  try {
    const candidates = [];

    if (glyph) candidates.push(glyph);
    const badgeGroup = glyph && typeof glyph.getParent === 'function' ? glyph.getParent() : null;
    if (badgeGroup) candidates.push(badgeGroup);

    if (seatCircle) candidates.push(seatCircle);
    if (seatContainer) candidates.push(seatContainer);

    // Try common explicit attrs first
    for (const n of candidates) {
      const raw =
        (n && n.getAttr && (n.getAttr('sbInfo') || n.getAttr('info') || n.getAttr('sbSeatInfo'))) ||
        '';
      const s = String(raw || '').trim();
      if (s) return s;
    }

    // Then fallback: scan attrs for any info-like key
    for (const n of candidates) {
      const s = extractFirstHelpfulStringAttr(n);
      if (s) return s;
    }
  } catch (_) {}
  return '';
}


function linkEmbeddedInfoGlyphs() {
  const glyphs = mainLayer.find('Text').filter(isInfoGlyphTextNode);

  dbg('[checkout][info] embedded glyph scan', { glyphCount: glyphs.length });

  let linked = 0;

  glyphs.forEach((glyph, idx) => {
    try {
      const { seatCircle, seatContainer } = findSeatCircleForGlyph(glyph, 10);
      if (!seatCircle) {
        dbg('[checkout][info] glyph found but no seatCircle up the chain', { idx, glyph: nodeBrief(glyph) });
        return;
      }

      const seatInternalId = seatCircle._id;

     // Make the glyph visible AND interactive (so tooltip works when hovering the "i")
glyph.fill('#0F172A');
glyph.opacity(1);
glyph.fontStyle('bold');
glyph.listening(true);              // ✅ must be TRUE for hover to work
glyph.name('sb-info-glyph');

// Mark seat as having info + embedded glyph
seatCircle.setAttr('hasInfo', true);
seatCircle.setAttr('sbEmbeddedInfoGlyph', true);

// Avoid double-binding if this runs more than once
glyph.off('mouseenter');
glyph.off('mousemove');
glyph.off('mouseleave');
glyph.off('click');
glyph.off('tap');

// Hovering the "i" should behave like hovering the seat
glyph.setAttr('sbSeatInternalId', seatInternalId);

glyph.on('mouseenter', (e) => {
  hoveringInfoGlyphSeatId = seatInternalId;
  stage.container().style.cursor = 'help';
  setHoverSeat(seatCircle);
  showSeatTooltip(seatInternalId, e && e.evt);
});

glyph.on('mousemove', (e) => {
  // Keep tooltip locked to cursor while moving on the "i"
  showSeatTooltip(seatInternalId, e && e.evt);
});

glyph.on('mouseleave', () => {
  if (hoveringInfoGlyphSeatId === seatInternalId) hoveringInfoGlyphSeatId = null;
  stage.container().style.cursor = 'default';
  tooltip.style.display = 'none';
  if (hoveredSeatId === seatInternalId) clearHoverSeat();
});


// Clicking the "i" should toggle the same seat (unless unavailable)
glyph.on('click tap', (e) => {
  e.cancelBubble = true;
  const meta = seatMeta.get(seatInternalId);
  if (!meta || meta.unavailable) return;
  toggleSeat(seatCircle, meta.parentGroup || null);
});

if (typeof glyph.moveToTop === 'function') glyph.moveToTop();


      // Best-effort: recover info text from badge / groups / seat attrs and store into seatMeta
      const recovered = extractInfoFromEmbeddedGlyph(glyph, seatCircle, seatContainer);
      const meta = seatMeta.get(seatInternalId);
      if (meta && recovered && !String(meta.info || '').trim()) {
        meta.info = recovered;
      }

      dbg('[checkout][info] linked embedded glyph -> seat', {
        idx,
        seatInternalId,
        stableId: seatIdMap.get(seatInternalId),
        recoveredInfo: recovered ? recovered.slice(0, 80) : '',
        glyph: nodeBrief(glyph),
        seatContainer: nodeBrief(seatContainer)
      });

      if (typeof glyph.moveToTop === 'function') glyph.moveToTop();
      linked++;
    } catch (e) {
      dbg('[checkout][info] linkEmbeddedInfoGlyphs error', { idx, err: String(e) });
    }
  });

  dbg('[checkout][info] embedded glyph linked summary', { linked });
}


function wireEmbeddedInfoGlyph(seat, seatInternalId, parentGroup) {
  try {
  dbg('[checkout][info] wireEmbeddedInfoGlyph START', {
  seatInternalId,
  stableId: seatIdMap.get(seatInternalId),
  seatHasInfoAttr: !!seat.getAttr('hasInfo'),
  seatSbInfo: seat.getAttr('sbInfo'),
  parentSbInfo: parentGroup && parentGroup.getAttr ? parentGroup.getAttr('sbInfo') : null,
  parentGroup: nodeBrief(parentGroup),
  seatParent: nodeBrief(seat.getParent ? seat.getParent() : null),
});

    // Prefer the immediate parent (usually the seat group), fall back to the logical parentGroup.
    const p = (seat && typeof seat.getParent === 'function') ? seat.getParent() : null;

    const searchRoots = [];
    if (p) searchRoots.push(p);
    if (parentGroup && parentGroup !== p) searchRoots.push(parentGroup);

    let found = false;

    for (const root of searchRoots) {
      if (!root || typeof root.find !== 'function') continue;

      // Only target lowercase "i" glyphs (avoid row letter "I")
      const glyphs = root.find('Text').filter(t => {
        try {
          return (t.text && typeof t.text === 'function' && t.text().trim() === 'i');
        } catch (_) {
          return false;
        }
      });

      dbg('[checkout][info] searching root', nodeBrief(root));
dbg('[checkout][info] glyphs found', glyphs.map(nodeBrief));

      if (!glyphs || !glyphs.length) continue;

      found = true;
      seat.setAttr('sbEmbeddedInfoGlyph', true);

      glyphs.forEach((t) => {
        // Make it visible on white seats immediately
        t.fill('#0F172A');
        t.opacity(1);
        t.fontStyle('bold');

        // Make sure it receives hover events
        t.listening(true);
        t.name('sb-info-glyph');

        // Keep it on top of the seat group
        if (typeof t.moveToTop === 'function') t.moveToTop();

        // Avoid double-binding if map reprocess happens
        t.off('mouseenter');
        t.off('mouseleave');
        t.off('click');
        t.off('tap');

          // --- DEBUG/RECOVERY: ensure seatMeta has the info text for tooltip ---
  const seatCircle = seat;          // the Circle node passed into wireEmbeddedInfoGlyph
  const seatGroup = root;           // the Group we’re currently scanning
  const glyph = t;                  // the Text("i") glyph

  const rawInfo =
    (seatCircle.getAttr && seatCircle.getAttr('sbInfo')) ||
    (seatGroup.getAttr && seatGroup.getAttr('sbInfo')) ||
    (glyph.getAttr && (glyph.getAttr('sbInfo') || glyph.getAttr('info'))) ||
    '';

  const info = String(rawInfo || '').trim();

  if (info) {
    const m = seatMeta.get(seatInternalId);
    if (m) m.info = info; // what showSeatTooltip reads
  } else {
    console.warn('[checkout][info] embedded glyph has NO info text', {
      seatInternalId,
      seatCircleAttrs: seatCircle?.getAttrs?.(),
      seatGroupAttrs: seatGroup?.getAttrs?.(),
      glyphAttrs: glyph?.getAttrs?.(),
    });
  }
  // --- end debug/recovery ---


  t.setAttr('sbSeatInternalId', seatInternalId);

t.on('mouseenter', (e) => {
  hoveringInfoGlyphSeatId = seatInternalId;
  stage.container().style.cursor = 'help';
  setHoverSeat(seat); // keep the hover ring on the correct seat
  showSeatTooltip(seatInternalId, e && e.evt);
});

t.on('mousemove', (e) => {
  showSeatTooltip(seatInternalId, e && e.evt);
});

t.on('mouseleave', () => {
  if (hoveringInfoGlyphSeatId === seatInternalId) hoveringInfoGlyphSeatId = null;
  stage.container().style.cursor = 'default';
  tooltip.style.display = 'none';
  if (hoveredSeatId === seatInternalId) clearHoverSeat();
});


        t.on('click tap', (e) => {
          e.cancelBubble = true;
          const meta = seatMeta.get(seatInternalId);
          if (!meta || meta.unavailable) return;
          toggleSeat(seat, meta.parentGroup || null);
        });
      });
    }
    dbg('[checkout][info] wireEmbeddedInfoGlyph END', {
  seatInternalId,
  found,
  sbEmbeddedInfoGlyph: !!seat.getAttr('sbEmbeddedInfoGlyph')
});


    return found;
  } catch (e) {
    console.warn('[checkout] wireEmbeddedInfoGlyph failed', e);
    return false;
  }
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

                seatNodeMap.set(seat._id, seat);

                
                const status = seat.getAttr('status') || 'AVAILABLE';
                const holdStatus = (seat.getAttr('sbHoldStatus') || '').toString().toLowerCase();
                const isBlocked = status === 'BLOCKED' || status === 'SOLD' || status === 'HELD';
                const isHeldDB = heldSeatIds.has(seat.id()) || heldSeatIds.has(seat.getAttr('sbSeatId'));
                const isHeldOrAllocated = holdStatus === 'hold' || holdStatus === 'allocation' || holdStatus === 'allocated';
                const isUnavailable = isBlocked || isHeldDB || isHeldOrAllocated;

           // Ticket assignment (raw may exist on seat Circle OR wrapper Group OR parentGroup)
const rawTicketId = findAssignedTicketRaw(seat, parentGroup);

// Track raw values we saw (useful for debugging)
if (rawTicketId) __seatAssignedTicketIdsRaw.add(rawTicketId);

// Try to resolve using the raw value (this is what decides tiered mode)
const resolvedType = resolveTicketType(rawTicketId);

// Fallback type for pricing/checkout safety (don’t break purchases if a seat has no mapping)
const tType = resolvedType || (ticketTypes.length > 0 ? ticketTypes[0] : null);

// IMPORTANT: only count as "resolved" if we truly resolved from the raw id
if (resolvedType && resolvedType.id) {
  __seatAssignedTicketIdsResolved.add(String(resolvedType.id));
}

// Use resolved id if available; otherwise fallback id (so colours/prices still render)
const ticketIdResolved =
  (resolvedType && resolvedType.id) ? String(resolvedType.id)
  : (tType && tType.id) ? String(tType.id)
  : (sortedTickets[0] ? String(sortedTickets[0].id) : '');

const ticketColor = getTicketColor(ticketIdResolved);

const price = tType ? tType.pricePence : 0;
seatPrices.set(seat._id, price);

  
               const label = seat.getAttr('label') || seat.name() || 'Seat';

// ✅ Support info stored on the seat OR its immediate wrapper OR the seat-group parent
const seatWrapper = (seat && typeof seat.getParent === 'function') ? seat.getParent() : null;

const rawInfo =
  seat.getAttr('sbInfo') ||
  (seatWrapper && seatWrapper.getAttr ? seatWrapper.getAttr('sbInfo') : null) ||
  (parentGroup && parentGroup.getAttr ? parentGroup.getAttr('sbInfo') : null);

let info = (rawInfo ?? '').toString().trim();

// ✅ Some layouts store the info text on the embedded "i" glyph instead of the seat/group
if (!info) {
  info =
    extractInfoFromEmbeddedGlyph(seatWrapper) ||
    extractInfoFromEmbeddedGlyph(parentGroup) ||
    '';
}


const viewImg =
  seat.getAttr('sbViewImage') ||
  (seatWrapper && seatWrapper.getAttr ? seatWrapper.getAttr('sbViewImage') : null) ||
  (parentGroup && parentGroup.getAttr ? parentGroup.getAttr('sbViewImage') : null);



                if (parentGroup) {
  const grpId = parentGroup._id;
  const groupType = getGroupTypeSafe(parentGroup);
  const absPos = seat.getAbsolutePosition();

  const rk = makeRowKey(grpId, groupType, label, absPos);

  if (!rowMap.has(rk.key)) rowMap.set(rk.key, []);
  rowMap.get(rk.key).push({
    id: seat._id,
    x: absPos.x,
    y: absPos.y,
    unavailable: isUnavailable,
    node: seat
  });

  if (!rowKeyMeta.has(rk.key)) {
    rowKeyMeta.set(rk.key, { groupType: rk.groupType, axis: rk.axis, enforce: rk.enforce });
  }
}


                        seatMeta.set(seat._id, {
  label,
  info,
  viewImg,
  price,
  ticketIdRaw: rawTicketId,
  ticketId: ticketIdResolved,
  ticketColor,
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
  // Default for now; we’ll repaint properly once we know if this show is tiered pricing
  seat.fill('#ffffff');
  seat.stroke('#64748B');
  seat.strokeWidth(1.5);
  seat.opacity(1);
  seat.listening(true);
}
  seat.shadowEnabled(false);
                seat.visible(true);

               // --- Tag for Icon Layer ---

if (info && info.length) {
  seat.setAttr('hasInfo', true);

  // ✅ If the layout already contains a Text("i") glyph, recolour it to black on load
  // and wire tooltip behaviour to match the seat-view tooltip style.
  wireEmbeddedInfoGlyph(seat, seat._id, parentGroup);
}

if (viewImg) seat.setAttr('hasView', true);


                // EVENTS
                seat.on('mouseenter', (e) => {
  stage.container().style.cursor = isUnavailable ? 'not-allowed' : 'pointer';
  setHoverSeat(seat);

  const hasInfo = !!seat.getAttr('hasInfo');
const hasView = !!seat.getAttr('hasView');

// ✅ Tooltip only for seats that actually have the “i”/info or a view
if (hasInfo || hasView) {
  showSeatTooltip(seat._id, e && e.evt);
} else {
  tooltip.style.display = 'none';
}

});


seat.on('mouseleave', () => {
  // If the pointer moved from the Circle onto its embedded "i" glyph, don't kill the tooltip/hover.
  if (hoveringInfoGlyphSeatId === seat._id) return;

  stage.container().style.cursor = 'default';
  tooltip.style.display = 'none';

  if (hoveredSeatId === seat._id) {
    clearHoverSeat();
  }
});

         seat.on('click tap', (e) => {
  e.cancelBubble = true;
  if (isUnavailable) return;

  // Mobile: if seats are too small, FIRST tap should zoom in (no selection yet)
  if (isMobileView) {
    const didAutoZoom = ensureMinSeatTapSize(e && e.evt ? e.evt : e);
    if (didAutoZoom) return;
  }

  // Mobile: when Show seat views is ON, disable buying/selection.
  // Instead, tapping a seat should just preview (if it has a view/info).
  const viewModeEl = document.getElementById('toggle-views');
  const viewMode = !!(isMobileView && viewModeEl && viewModeEl.checked);

  if (viewMode) {
    showSeatTooltip(seat._id, e && e.evt);
    return;
  }

  // Normal behaviour: select/deselect seat
  toggleSeat(seat, parentGroup);
});



            }

            if (node.getChildren) {
                node.getChildren().forEach(child => processNode(child, parentGroup));
            }
        }

       rowMap.forEach((seats, rowKey) => {
  if (!seats || seats.length < 2) return;

  const meta = rowKeyMeta.get(rowKey);
  const axis = meta && meta.axis ? meta.axis : 'x';

  if (axis === 'y') seats.sort((a, b) => a.y - b.y);
  else seats.sort((a, b) => a.x - b.x);
});

function showSeatTooltip(seatId, nativeEvt) {
 // Mobile: only show tooltips for seat views when "Show seat views" is enabled.
// Seat "info" (lowercase i) is handled in the footer line above Total.
if (isMobileView) {
  const viewModeEl = document.getElementById('toggle-views');
  const viewMode = !!(viewModeEl && viewModeEl.checked);
  const meta = seatMeta.get(seatId);
  if (!viewMode || !meta || !meta.viewImg) return;
}

  const meta = seatMeta.get(seatId);
  if (!meta) return;

  
  // If seat is marked as info-capable but meta.info is empty, try to recover it at hover time
if (!String(meta.info || '').trim()) {
  try {
    const seatNode = meta.seat || seatNodeMap.get(seatId);
    const wrapper = seatNode && typeof seatNode.getParent === 'function' ? seatNode.getParent() : null;
    const recovered =
      extractInfoFromEmbeddedGlyph(
        // pass a glyph if we can find one near the wrapper, otherwise null
        (wrapper && typeof wrapper.find === 'function' ? wrapper.find('Text').filter(isInfoGlyphTextNode)[0] : null),
        seatNode,
        meta.parentGroup || wrapper
      );

    if (recovered) meta.info = recovered;
  } catch (_) {}
}


  const wrapper = document.getElementById('map-wrapper');
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();

  // Prefer DOM mouse position (best for Text glyph hover + Konva events)
  let pos = null;

if (nativeEvt) {
  const touch = nativeEvt.touches && nativeEvt.touches[0] ? nativeEvt.touches[0] : null;
  const cx = touch ? touch.clientX : nativeEvt.clientX;
  const cy = touch ? touch.clientY : nativeEvt.clientY;

  if (typeof cx === 'number' && typeof cy === 'number') {
    pos = { x: cx - rect.left, y: cy - rect.top };
  }
}

if (!pos) {
    // Fallback (works for normal seat hover)
    const p = stage.getPointerPosition();
    if (!p) return;
    pos = { x: p.x, y: p.y };
  }

  const priceStr = '£' + ((meta.price || 0) / 100).toFixed(2);

  let html =
    '<span class="tt-title">' + meta.label + '</span>' +
    '<span class="tt-meta">' + meta.ticketName + ' • ' + priceStr + '</span>';

  if (meta.info) {
    html += '<div class="tt-info"><span style="font-weight:700;">Info:</span> ' + meta.info + '</div>';
  }

  const viewModeEl = document.getElementById('toggle-views');
  const viewMode = !!(viewModeEl && viewModeEl.checked);

  if (meta.viewImg && viewMode) {
    html += '<img src="' + meta.viewImg + '" />';
  } else if (meta.viewImg) {
    html += '<div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">(Show seat views to preview)</div>';
  }

    tooltip.innerHTML = html;

  // Render (hidden) so we can measure real size before positioning
  tooltip.style.display = 'block';
  // Mark as "just opened" so the global tap-to-dismiss doesn't instantly close it
markSeatTooltipOpened();

  tooltip.style.visibility = 'hidden';

  const pad = 12;
  const gap = 16; // distance from cursor
  const wrapW = wrapper.clientWidth || 0;
  const wrapH = wrapper.clientHeight || 0;

  // Measure tooltip size (includes text; image may load after)
  const measureAndPlace = () => {
    const ttW = tooltip.offsetWidth || 0;
    const ttH = tooltip.offsetHeight || 0;

    // Horizontal: prefer to the right, but flip left if it would overflow
    let left = pos.x + gap;
    const maxLeft = Math.max(pad, wrapW - pad - ttW);
    const minLeft = pad;

    if (left > maxLeft) left = pos.x - gap - ttW; // flip to left of cursor
    left = Math.min(maxLeft, Math.max(minLeft, left));

    // Vertical: prefer below, but flip above if it would overflow
    const spaceBelow = wrapH - (pos.y + gap);
    const spaceAbove = pos.y - gap;

    let top;
    if (spaceBelow >= ttH + pad) {
      // below fits
      top = pos.y + gap;
    } else if (spaceAbove >= ttH + pad) {
      // above fits
      top = pos.y - gap - ttH;
    } else {
      // neither fully fits: clamp within wrapper
      top = Math.min(Math.max(pad, pos.y + gap), Math.max(pad, wrapH - pad - ttH));
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.visibility = 'visible';
  };

  // Place now (text-only size)
  measureAndPlace();

  // If an image loads after render, re-place (prevents bottom clipping)
  const img = tooltip.querySelector('img');
  if (img) {
    img.onload = () => measureAndPlace();
  }

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
    // ✅ Fit ONLY to seats (+ stage if present). This prevents “huge rect” zoom-out.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

   const nodesToMeasure = [];

  // Seats are always the correct “content bounds”
  forEachNodeList(mainLayer.find('Circle'), (n) => {
    try {
      if (n && n.getAttr && n.getAttr('isSeat')) nodesToMeasure.push(n);
    } catch (_) {}
  });

  // ✅ Include STAGE by detecting the Text node "STAGE" and measuring its parent container
  let stageAdded = false;

  forEachNodeList(mainLayer.find('Text'), (t) => {
    try {
      const txt = (typeof t.text === 'function' ? t.text() : '').trim().toUpperCase();
      if (txt !== 'STAGE') return;

      const p = typeof t.getParent === 'function' ? t.getParent() : null;

      // measure parent if possible (usually contains the black rounded rect + the text)
      if (p) {
        nodesToMeasure.push(p);
        stageAdded = true;
      } else {
        nodesToMeasure.push(t);
        stageAdded = true;
      }
    } catch (_) {}
  });

  // Fallback 1: stage tagged explicitly (if present in some maps)
  forEachNodeList(mainLayer.find('*'), (n) => {
    try {
      if (n && n.getAttr && n.getAttr('shapeType') === 'stage') {
        nodesToMeasure.push(n);
        stageAdded = true;
      }
    } catch (_) {}
  });

  // Fallback 2: any node/group named "stage"
  if (!stageAdded) {
    forEachNodeList(mainLayer.find('*'), (n) => {
      try {
        const nm = (typeof n.name === 'function' ? n.name() : '') || '';
        if (nm.toLowerCase().includes('stage')) {
          nodesToMeasure.push(n);
          stageAdded = true;
        }
      } catch (_) {}
    });
  }


  // If for some reason we still have nothing, bail gracefully (don’t use mainLayer bounds)
  if (!nodesToMeasure.length) {
    console.warn('[checkout] no measurable nodes found for fit (seats/stage missing)');

    if (loaderEl) loaderEl.classList.add('hidden');
    if (stageEl) stageEl.classList.add('visible');

    mainLayer.batchDraw();
    uiLayer.batchDraw();
    return;
  }

  const MAX_DIM = Math.max(4000, Math.max(cw, ch) * 10);

  forEachNodeList(nodesToMeasure, (node) => {
    try {
      if (typeof node.isVisible === 'function' && !node.isVisible()) return;
      if (typeof node.opacity === 'function' && node.opacity() === 0) return;

      const rect = node.getClientRect({ relativeTo: mainLayer, skipShadow: true });
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      // ignore absurd rects
      if (rect.width > MAX_DIM || rect.height > MAX_DIM) return;
      if (Math.abs(rect.x) > MAX_DIM * 2 || Math.abs(rect.y) > MAX_DIM * 2) return;

      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    } catch (_) {}
  });

  // If still invalid, just don’t refit (don’t fallback to huge mainLayer rect)
  if (!isFinite(minX) || !isFinite(minY) || maxX <= minX || maxY <= minY) {
    console.warn('[checkout] seat/stage bounds invalid — skipping fit');

    if (loaderEl) loaderEl.classList.add('hidden');
    if (stageEl) stageEl.classList.add('visible');

    mainLayer.batchDraw();
    uiLayer.batchDraw();
    return;
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
applyMobileLegendSafeArea();

// Make sure Konva stage uses the NEW container size (after safe-area applied)
stage.width(container.offsetWidth);
stage.height(container.offsetHeight);

fitStageToContent();
// Tiered if there are multiple ticket types AND we see multiple distinct assignments
// (either resolved ids OR distinct raw keys).
IS_TIERED_PRICING =
  (sortedTickets.length > 1) &&
  (__seatAssignedTicketIdsResolved.size > 1 || __seatAssignedTicketIdsRaw.size > 1);


console.log('[checkout][tiered] tickets=', sortedTickets.length,
  'rawSeen=', __seatAssignedTicketIdsRaw.size,
  'resolvedSeen=', __seatAssignedTicketIdsResolved.size,
  'IS_TIERED_PRICING=', IS_TIERED_PRICING
);

console.log('[checkout][tiered] tickets=', sortedTickets.length,
  'rawSeen=', __seatAssignedTicketIdsRaw.size,
  'resolvedSeen=', __seatAssignedTicketIdsResolved.size,
  'IS_TIERED_PRICING=', IS_TIERED_PRICING
);

(function debugTicketAssignmentSummary(){
  try {
    const rawCounts = new Map();
    const resCounts = new Map();

    for (const m of seatMeta.values()) {
      const r = String(m.ticketIdRaw || '').trim();
      const t = String(m.ticketId || '').trim();
      if (r) rawCounts.set(r, (rawCounts.get(r) || 0) + 1);
      if (r && t) resCounts.set(t, (resCounts.get(t) || 0) + 1); // only if raw existed
    }

    const top = (map) => Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);

    console.log('[checkout][tiered][counts] rawTop=', JSON.parse(JSON.stringify(top(rawCounts))));
console.log('[checkout][tiered][counts] resolvedTop=', JSON.parse(JSON.stringify(top(resCounts))));
console.log('[checkout][tiered] rawSeenValues=', Array.from(__seatAssignedTicketIdsRaw).slice(0, 20));
console.log('[checkout][tiered] fallbackMap=', Array.from(__rawTicketFallbackMap.entries()).slice(0, 20));

    const anyObjectSmell = Array.from(__seatAssignedTicketIdsRaw).some(v => String(v).includes('[object Object]'));
    if (anyObjectSmell) console.warn('[checkout][tiered] WARNING: raw ticket ids include [object Object] — layout stores objects');
  } catch (e) {
    console.warn('[checkout][tiered] debugTicketAssignmentSummary failed', e);
  }
})();

// Repaint all seats now we know the mode
try {
  mainLayer.find('Circle').forEach(seat => {
    if (!seat.getAttr || !seat.getAttr('isSeat')) return;
    resetSeatStroke(seat);
  });
  mainLayer.batchDraw();
} catch (_) {}

// Render legend + ticket table for tiered mode (or keep default legend otherwise)
function renderLegendAndTicketTable(){
  const legendRow = document.getElementById('legend-main-row');
  const panel = document.getElementById('ticket-prices-panel');
  const tbody = document.getElementById('ticket-prices-tbody');

  if (!legendRow) return;

  if (!IS_TIERED_PRICING) {
    // Keep your existing default legend and hide the prices panel
    if (panel) panel.style.display = 'none';
    return;
  }

  // Build legend: ticket colours + prices, plus Selected + Unavailable
const usedIdSet = new Set();
for (const m of seatMeta.values()) {
  const id = String(m && m.ticketId ? m.ticketId : '').trim();
  if (id) usedIdSet.add(id);
}
const usedTickets = sortedTickets.filter(t => usedIdSet.has(String(t.id)));
  const legendBits = [];

  usedTickets.forEach(t => {
    const c = getTicketColor(t.id);
    legendBits.push(
      '<div class="legend-item">' +
        '<div class="dot" style="background:' + c + ';border-color:' + c + ';"></div>' +
        escHtml(t.name) + ' • ' + escHtml(pFmtLocal(t.pricePence)) +
      '</div>'
    );
  });

  legendBits.push(
    '<div class="legend-item">' +
      '<div class="dot" style="background:#ffffff;border-color:#0F172A;"></div>' +
      'Selected' +
    '</div>'
  );

  legendBits.push(
    '<div class="legend-item">' +
      '<div class="dot" style="background:#000000;border-color:#000000;"></div>' +
      'Unavailable' +
    '</div>'
  );

  legendRow.innerHTML = legendBits.join('');

  // Build ticket price table
  if (panel && tbody) {
    tbody.innerHTML = usedTickets.map(t => {
      const c = getTicketColor(t.id);
      return (
        '<tr>' +
          '<td><span class="tpp-swatch" style="background:' + c + ';"></span></td>' +
          '<td>' + escHtml(t.name) + '</td>' +
          '<td>' + escHtml(pFmtLocal(t.pricePence)) + '</td>' +
        '</tr>'
      );
    }).join('');

    panel.style.display = '';
  }

  // Re-apply legend safe area (mobile) because legend height changed
  try { applyMobileLegendSafeArea(); } catch(_) {}
}

renderLegendAndTicketTable();

updateIcons();



// Failsafe: never allow the loader to remain forever
setTimeout(() => {
try {
  applyMobileLegendSafeArea();
  stage.width(container.offsetWidth);
  stage.height(container.offsetHeight);


   // ✅ Make embedded "i" glyphs visible and link them to seats BEFORE rendering icons
linkEmbeddedInfoGlyphs();
fitStageToContent();
updateSeatViewsToggleVisibility();
updateIcons();

setTimeout(() => debugScanInfoState('post-timeout-50ms'), 0);


    console.log('[checkout] initial fit done', {
      w: container.offsetWidth,
      h: container.offsetHeight
    });

    setTimeout(() => debugScanInfoState('post-timeout-50ms'), 0);
  } catch (e) {
    console.error('[checkout] initial fit failed', e);
  }
}, 50);


// Failsafe: never allow the loader to remain forever
setTimeout(() => {
  const loaderEls = Array.from(document.querySelectorAll('#loader'));
  const stageEls  = Array.from(document.querySelectorAll('#stage-container'));

  // If ANY loader is still visible, hide ALL loaders and show ALL stage containers
  const anyLoaderVisible = loaderEls.some(el => !el.classList.contains('hidden'));

  if (anyLoaderVisible) {
    console.warn('[checkout] loader failsafe triggered – forcing visible stage');

    loaderEls.forEach(el => el.classList.add('hidden'));
    stageEls.forEach(el => el.classList.add('visible'));

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
  clearHoverSeat();
  applyMobileLegendSafeArea();

  stage.width(container.offsetWidth);
  stage.height(container.offsetHeight);
  fitStageToContent();
  updateIcons();
});
ro.observe(container);

// Also handle orientation changes / mobile browser UI resizing
window.addEventListener('resize', () => {
  applyMobileLegendSafeArea();
}, { passive: true });


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
// If the saved layout already has an embedded "i" glyph, we don't need the overlay badge.
if (hasInfo && !seat.getAttr('sbEmbeddedInfoGlyph')) {
   const grp = new Konva.Group({
  x: cx + radius * 0.65,
  y: cy - radius * 0.65,
  listening: true,
  name: 'info-icon',
  scaleX: inverseScale,
  scaleY: inverseScale
});

// Tag the icon so debug can link it back to the seat
grp.setAttr('sbSeatInternalId', seat._id);

dbg('[checkout][info] creating UI info-icon overlay', {
  seatInternalId: seat._id,
  stableId: seatIdMap.get(seat._id),
  label: meta?.label,
  info: meta?.info,
  seatFill: seat.fill && seat.fill(),
  inverseScale
});


   // ✅ High-contrast badge (works on white seats, blue selected seats, and black blocked seats)
   grp.add(new Konva.Circle({
     radius: 7,
     fill: '#FFFFFF',
     stroke: '#0F172A',
     strokeWidth: 1.5
   }));

   // ✅ Black “i” so it’s readable immediately
   grp.add(new Konva.Text({
     text: 'i',
     fontSize: 10,
     fill: '#0F172A',
     offsetX: 3,
     offsetY: 6,
     fontStyle: 'bold',
     fontFamily: 'Inter, sans-serif',
     listening: false
   }));

grp.on('mouseenter', (e) => { stage.container().style.cursor = 'help'; showSeatTooltip(seat._id, e && e.evt); });
   grp.on('mouseleave', () => { stage.container().style.cursor = 'default'; tooltip.style.display = 'none'; });
grp.on('click tap', (e) => {
  e.cancelBubble = true;
  // In "show seat views" mode: tapping the eye previews the view, does NOT select/deselect seats
  showSeatTooltip(seat._id, e && e.evt);
});

   uiLayer.add(grp);
   grp.moveToTop(); // ✅ ensure it never sits behind other UI icons
}

            // VIEW ICON
            if (hasView && showViews) {
               const grp = new Konva.Group({ x: cx, y: cy, listening:true, name:'view-icon', scaleX: inverseScale, scaleY: inverseScale });
               grp.add(new Konva.Circle({ radius: 10, fill: '#0056D2' }));
               const cam = new Konva.Path({ data: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5 5 2.24 5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z', fill: 'white', scaleX: 0.6, scaleY: 0.6, offsetX: 12, offsetY: 12 });
               grp.add(cam);
grp.on('mouseenter', (e) => { stage.container().style.cursor = 'zoom-in'; showSeatTooltip(seat._id, e && e.evt); });
               grp.on('mouseleave', () => { stage.container().style.cursor = 'default'; tooltip.style.display = 'none'; });
grp.on('click tap', (e) => {
  e.cancelBubble = true;

  // Mobile + Show seat views: preview only
  if (isMobileView) {
    showSeatTooltip(seat._id, e && e.evt);
    return;
  }

  // Desktop fallback (keep existing behaviour)
  if (!meta.unavailable) toggleSeat(seat, parentGroup);
});
               uiLayer.add(grp);
            }
        });

        dbg('[checkout][info] updateIcons summary', {
  uiInfoIcons: uiLayer.find('.info-icon').length,
  uiViewIcons: uiLayer.find('.view-icon').length
});


        uiLayer.batchDraw();

// After building the map, lock all NODES so customers can't drag blocks, tables, seats etc.
// But keep the STAGE draggable so customers can pan the map.
try {
  stage.draggable(true);

  stage.find('*').forEach((node) => {
    if (node && typeof node.draggable === 'function') {
      node.draggable(false);
    }
  });
} catch (lockErr) {
  console.warn('[checkout] failed to lock nodes', lockErr);
}


}


function updateSeatViewsToggleVisibility() {
  const label = document.querySelector('.view-toggle');
  const cb = document.getElementById('toggle-views');
  if (!label || !cb) return;

  // Check if ANY seat meta contains a view image
  let anyViews = false;
  for (const m of seatMeta.values()) {
    if (m && m.viewImg) { anyViews = true; break; }
  }

  if (!anyViews) {
    cb.checked = false;            // force off
    label.style.display = 'none';  // hide the whole toggle row
  } else {
    label.style.display = '';      // show as normal
  }
}

// Ensure toggle visibility is correct once we’ve built seatMeta
updateSeatViewsToggleVisibility();

document.getElementById('toggle-views').addEventListener('change', () => {
  // If they somehow toggle it (desktop / edge cases), keep UI consistent
  updateIcons();
});

   function getGroupTypeSafe(g) {
  try {
    return (g && g.getAttr && (g.getAttr('shapeType') || g.name && g.name())) || '';
  } catch (_) {
    return '';
  }
}

// Extract "D" from "D14", "AA" from "AA12", etc.
function extractRowLettersFromLabel(label) {
  const s = String(label || '').trim();

  // Common: "D14", "D 14", "D-14"
  let m = s.match(/^([A-Za-z]{1,3})\s*[- ]?\s*\d+/);
  if (m) return m[1].toUpperCase();

  // Sometimes label is like "Row D Seat 14"
  m = s.match(/row\s*([A-Za-z]{1,3})/i);
  if (m) return m[1].toUpperCase();

  return '';
}

function makeRowKey(grpId, groupType, label, absPos) {
  const gt = String(groupType || '').toLowerCase();

  // Only enforce on row seating groups (NOT tables)
  const isTable = gt.includes('table');
  const isRowSeats = gt.includes('row-seats') || gt.includes('row');

  const gid = String(grpId || '');

  if (isTable) {
    return { key: gid + '::TABLE', axis: 'x', enforce: false, groupType };
  }

  if (isRowSeats) {
    const letters = extractRowLettersFromLabel(label);
    if (letters) {
      return { key: gid + '::ROW::' + String(letters), axis: 'x', enforce: true, groupType };
    }

    // Fallback if labels don't contain row letters:
    // bucket by Y so each horizontal row becomes its own key
    const bucket = Math.round(((absPos && absPos.y) || 0) / 10); // 10px bucket works well for your layout scale
    return { key: gid + '::ROWY::' + String(bucket), axis: 'x', enforce: true, groupType };
  }

  // Everything else: don't enforce (single-seat groups etc)
  return { key: gid + '::OTHER', axis: 'x', enforce: false, groupType };
}

function shouldEnforceSingleGap(rowKey) {
  const m = rowKeyMeta.get(rowKey);
  if (!m || !m.enforce) return false;

  const gt = String(m.groupType || '').toLowerCase();
  if (gt.includes('table')) return false;
  if (gt.includes('single-seat')) return false;

  return true;
}

function rowLooksLinear(row) {
  // Avoid applying this rule to circular tables etc.
  // "Row-like" = clearly wider than tall or taller than wide.
  if (!row || row.length < 4) return false;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  row.forEach(s => {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
  });

  const w = maxX - minX;
  const h = maxY - minY;

  const big = Math.max(w, h);
  const small = Math.max(1, Math.min(w, h));
  const ratio = big / small;

  return ratio >= 1.8;
}

function median(nums) {
  const a = (nums || []).filter(n => Number.isFinite(n)).slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function splitRowIntoSegments(row, axis = 'x') {
  if (!row || row.length <= 1) return [row || []];

  const coord = (s) => (axis === 'y' ? s.y : s.x);

  const deltas = [];
  for (let i = 0; i < row.length - 1; i++) {
    deltas.push(Math.abs(coord(row[i + 1]) - coord(row[i])));
  }

  const med = median(deltas) || 0;

  // Slightly more aggressive split than before (helps catch block ends/aisles)
  const threshold = med > 0 ? (med * 1.55) : 999999;

  const segments = [];
  let cur = [row[0]];

  for (let i = 1; i < row.length; i++) {
    const d = Math.abs(coord(row[i]) - coord(row[i - 1]));
    if (d > threshold) {
      segments.push(cur);
      cur = [row[i]];
    } else {
      cur.push(row[i]);
    }
  }
  if (cur.length) segments.push(cur);

  return segments.filter(seg => seg && seg.length);
}

function isSingleGapRuleEnabled() {
  // GLOBAL rule:
  // ON if there exists ANY enforceable row with >3 available seats anywhere
  // OFF only if ALL enforceable rows are <=3 available seats (near sell-out scraps)
  let maxAvail = 0;
  let sawEnforceable = false;

  rowMap.forEach((row, rowKey) => {
    if (!row || !row.length) return;
    if (!shouldEnforceSingleGap(rowKey)) return;

    sawEnforceable = true;
    const avail = row.filter(s => !s.unavailable).length;
    if (avail > maxAvail) maxAvail = avail;
  });

  // If we couldn't detect any enforceable "rows", keep rule ON (safer than letting gaps through)
  if (!sawEnforceable) return true;

  return maxAvail > 3;
}

function findSingleGapGroups() {
  if (!isSingleGapRuleEnabled()) return [];

  const bad = [];

  rowMap.forEach((row, rowKey) => {
    if (!row || row.length < 2) return;
    if (!shouldEnforceSingleGap(rowKey)) return;

    const meta = rowKeyMeta.get(rowKey) || {};
    const axis = meta.axis || 'x';

    const segments = splitRowIntoSegments(row, axis);

    for (const seg of segments) {
      if (!seg || seg.length < 2) continue;

      // ✅ Only enforce the rule for the segment the customer is actually interacting with
      // If there are no selected seats in this segment, skip it (prevents unrelated “stranded seat” elsewhere blocking checkout)
      const segHasSelected = seg.some(s => !s.unavailable && selectedSeats.has(s.id));
      if (!segHasSelected) continue;

      // 0 = unavailable, 1 = empty available, 2 = selected
      const states = seg.map((s) => {
        if (s.unavailable) return 0;
        return selectedSeats.has(s.id) ? 2 : 1;
      });

      // Detect isolated single empty seat INCLUDING end-of-segment
      for (let i = 0; i < states.length; i++) {
        if (states[i] !== 1) continue;

        const left = (i === 0) ? 0 : states[i - 1];
        const right = (i === states.length - 1) ? 0 : states[i + 1];

        if (left !== 1 && right !== 1) {
          bad.push(rowKey);
          break;
        }
      }

      if (bad.includes(rowKey)) break;
    }
  });

  return bad;
}

// ============================
// TABLE SINGLE-GAP ENFORCEMENT
// ============================

function isTableRowKey(rowKey) {
  const meta = rowKeyMeta.get(rowKey);
  const gt = String(meta && meta.groupType ? meta.groupType : '').toLowerCase();
  return gt.includes('table') || String(rowKey).includes('::TABLE');
}

function isTableGapRuleEnabled() {
  // Mirror the row behaviour: only enforce if there exists any table
  // with "enough" availability that rules still make sense.
  let sawTable = false;
  let maxAvail = 0;

  rowMap.forEach((group, rowKey) => {
    if (!group || !group.length) return;
    if (!isTableRowKey(rowKey)) return;

    sawTable = true;
    const avail = group.filter(s => !s.unavailable).length;
    if (avail > maxAvail) maxAvail = avail;
  });

  // If there are no tables in the map, do nothing.
  if (!sawTable) return false;

  // Same style as rows: relax when everything is down to tiny scraps.
  return maxAvail > 3;
}

function sortTableSeatsByAngle(seats) {
  // seats: [{id,x,y,unavailable,node}]
  if (!seats || seats.length <= 1) return seats || [];

  let cx = 0, cy = 0;
  seats.forEach(s => { cx += s.x; cy += s.y; });
  cx /= seats.length;
  cy /= seats.length;

  const withAngle = seats.map(s => ({
    ...s,
    __ang: Math.atan2(s.y - cy, s.x - cx)
  }));

  withAngle.sort((a, b) => a.__ang - b.__ang);
  return withAngle;
}
function findTableSingleGapGroups() {
  if (!isTableGapRuleEnabled()) return [];

  const bad = [];

  rowMap.forEach((group, rowKey) => {
    if (!group || group.length < 3) return;
    if (!isTableRowKey(rowKey)) return;

    // ✅ Only enforce table gap rule for tables the customer has actually selected seats on
    const tableHasSelected = group.some(s => !s.unavailable && selectedSeats.has(s.id));
    if (!tableHasSelected) return;

    const ordered = sortTableSeatsByAngle(group);

    // 0 = unavailable, 1 = empty available, 2 = selected
    const states = ordered.map((s) => {
      if (s.unavailable) return 0;
      return selectedSeats.has(s.id) ? 2 : 1;
    });

    const n = states.length;
    if (n < 3) return;

    const firstZero = states.indexOf(0);

    // Case A: no unavailable seats on this table -> treat as a ring (wrap-around adjacency)
    if (firstZero === -1) {
      for (let i = 0; i < n; i++) {
        if (states[i] !== 1) continue;
        const left = states[(i - 1 + n) % n];
        const right = states[(i + 1) % n];

        if (left !== 1 && right !== 1) {
          bad.push(rowKey);
          return;
        }
      }
      return;
    }

    // Case B: there is at least one unavailable seat -> split into segments between 0s.
    const rot = states.slice(firstZero + 1).concat(states.slice(0, firstZero + 1));

    let i = 0;
    while (i < rot.length) {
      if (rot[i] === 0) { i++; continue; }

      const start = i;
      while (i < rot.length && rot[i] !== 0) i++;
      const end = i - 1;

      for (let j = start; j <= end; j++) {
        if (rot[j] !== 1) continue;
        const left = (j === start) ? 0 : rot[j - 1];
        const right = (j === end) ? 0 : rot[j + 1];

        if (left !== 1 && right !== 1) {
          bad.push(rowKey);
          return;
        }
      }
    }
  });

  return bad;
}
   function toggleSeat(seat, parentGroup) {
  const id = seat._id;
  const meta = seatMeta.get(id);
  const willSelect = !selectedSeats.has(id);

  if (!meta || meta.unavailable) return;

  if (willSelect) {
    selectedSeats.add(id);

    // Keep max 10 immediate (good UX)
    if (selectedSeats.size > 10) {
      selectedSeats.delete(id);
      alert("Maximum 10 tickets.");
      return;
    }

    if (IS_TIERED_PRICING) {
      // Selected -> white (as requested), with band-colour outline for clarity
      seat.fill('#FFFFFF');
      seat.stroke(meta.ticketColor || '#64748B');
      seat.strokeWidth(3);
    } else {
      seat.fill('#0056D2');
      seat.stroke('#0056D2');
      seat.strokeWidth(3);
    }

  } else {
    selectedSeats.delete(id);

    if (IS_TIERED_PRICING) {
      seat.fill(meta.ticketColor || '#64748B');
      seat.stroke(meta.ticketColor || '#64748B');
      seat.strokeWidth(1.5);
    } else {
      seat.fill('#ffffff');
      seat.stroke('#64748B');
      seat.strokeWidth(1.5);
    }
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
        // Mobile: show seat "info" (lowercase i) as a line above Total
if (isMobileView) {
  let withInfo = 0;
  const infoSet = new Set();

  selectedSeats.forEach((id) => {
    const meta = seatMeta.get(id);
    const info = (meta && meta.info ? String(meta.info).trim() : '');
    if (info) {
      withInfo++;
      infoSet.add(info);
    }
  });

  const infoList = Array.from(infoSet);
  if (!withInfo || !infoList.length) {
    setSeatInfoLine('');
  } else {
    const prefix = (withInfo === count)
      ? 'Your seats have: '
      : 'Some of your seats have: ';
    setSeatInfoLine(prefix + infoList.join(' • '));
  }
} else {
  // Desktop: keep this line hidden
  setSeatInfoLine('');
}

    }
document.getElementById('btn-next').addEventListener('click', async () => {
  const btn = document.getElementById('btn-next');
  if (!btn.classList.contains('active')) return;

  btn.innerText = 'Processing...';

  try {
    // Validate single-seat gaps ONLY at Continue time
    const badRowGroups = findSingleGapGroups();
    const badTableGroups = findTableSingleGapGroups();

    if (badRowGroups.length || badTableGroups.length) {
      if (badTableGroups.length && !badRowGroups.length) {
        alert("Almost there — that selection would leave a single isolated seat at a table. Please tweak your seats (or add the neighbouring seat) so we don’t strand one seat on its own.");
      } else if (badRowGroups.length && !badTableGroups.length) {
        alert("Almost there — those seats would leave a single isolated seat on its own in that row. Please choose a different pair (or add the neighbouring seat) so we don’t strand a lone seat.");
      } else {
        alert("Almost there — that selection would leave a single isolated seat in a row and/or at a table. Please tweak your seats (or add the neighbouring seat) so we don’t strand a lone seat.");
      }

      btn.innerText = 'Continue';
      return;
    }

    // Build grouped line-items by ticket type (band)
    const groups = new Map(); // key -> { ticketTypeId, unitPricePence, seatIds: [] }

    selectedSeats.forEach((id) => {
      const meta = seatMeta.get(id);
      const stableId = seatIdMap.get(id);
      if (!meta || !stableId) return;

      const ticketTypeId = String(meta.ticketId || '');
      const unitPricePence = Number(meta.price || 0);

      const key = ticketTypeId + '|' + unitPricePence;

      if (!groups.has(key)) {
        groups.set(key, { ticketTypeId, unitPricePence, seatIds: [] });
      }
      groups.get(key).seatIds.push(stableId);
    });

    const items = Array.from(groups.values()).map(g => ({
      ticketTypeId: g.ticketTypeId,
      unitPricePence: g.unitPricePence,
      quantity: g.seatIds.length,
      seatIds: g.seatIds
    }));

    const allSeatIds = items.flatMap(i => i.seatIds);

    const res = await fetch('/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showId,
        seats: allSeatIds,
        items
      })
    });

    const data = await res.json();

    if (data.ok && data.url) {
      window.location.href = data.url;
    } else {
      alert("Error: " + (data.message || "Unknown"));
      btn.innerText = 'Continue';
    }
  } catch (e) {
    console.error('[checkout] Continue click error', e);
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
