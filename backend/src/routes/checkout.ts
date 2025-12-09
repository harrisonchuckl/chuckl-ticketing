// backend/src/routes/checkout.ts
import { Router } from 'express';
import { Prisma, ShowStatus } from '@prisma/client';
import prisma from '../lib/prisma.js'; // Using your existing shared client
import { calcFeesForShow } from '../services/fees.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
const router = Router();

// --- Helper: Format Currency ---
function pFmt(p: number) {
  return '£' + (p / 100).toFixed(2);
}

/**
 * GET /checkout
 * Renders the Public Seating Map for customers to select tickets.
 */
router.get('/', async (req, res) => {
  const showId = String(req.query.showId || '');
  if (!showId) return res.status(404).send('Show ID is required');

  try {
    // 1. Fetch Event & Seating Data
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        venue: true,
        ticketTypes: { orderBy: { pricePence: 'asc' } },
        seatMaps: {
          take: 1,
          orderBy: { createdAt: 'desc' }, // Get the latest map
        }
      }
    });

    if (!show) return res.status(404).send('Event not found');

    // 2. Prepare Data for Frontend (FIX: Handle potentially null venue)
    // We cast to 'any' here to prevent the strict null check error on venue.name later
    const venue = (show.venue || {}) as any; 
    const ticketTypes = show.ticketTypes || [];
    const seatMap = show.seatMaps[0]; // The active map
    
    const dateObj = new Date(show.date);
    const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // 3. Fallback: If no map, show generic message (can be expanded later for GA)
    if (!seatMap || !seatMap.layout) {
       return res.send(`
         <div style="font-family:sans-serif; text-align:center; padding:50px;">
           <h1>General Admission</h1>
           <p>This event uses unallocated seating.</p>
           <p><a href="/public/event/${show.id}">Back to Event</a></p>
         </div>
       `);
    }

    // 4. Inject Data into Client Script
    const mapData = JSON.stringify(seatMap.layout);
    const ticketsData = JSON.stringify(ticketTypes);
    const showIdStr = JSON.stringify(show.id);

    // 5. Render The Page
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Choose Seats | ${show.title}</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
  
  <script src="https://unpkg.com/konva@9.3.3/konva.min.js"></script>

  <style>
    :root {
      --bg-page: #F9FAFB;
      --bg-surface: #FFFFFF;
      --primary: #111827;
      --brand: #0056D2;
      --brand-hover: #0044A8;
      --text-main: #111827;
      --text-muted: #6B7280;
      --border: #E5E7EB;
      --success: #10B981;
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0; font-family: 'Inter', sans-serif; background: var(--bg-page); color: var(--text-main);
      display: flex; flex-direction: column; height: 100vh; overflow: hidden;
    }

    /* --- HEADER --- */
    header {
      background: var(--bg-surface); border-bottom: 1px solid var(--border);
      padding: 16px 24px; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center;
      z-index: 10;
    }
    .header-info h1 { font-family: 'Outfit', sans-serif; font-size: 1.25rem; margin: 0; font-weight: 700; color: var(--primary); }
    .header-meta { font-size: 0.9rem; color: var(--text-muted); margin-top: 4px; }
    
    .btn-close {
      text-decoration: none; font-size: 1.5rem; color: var(--text-muted); width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s;
    }
    .btn-close:hover { background: #F3F4F6; color: var(--primary); }

    /* --- MAP AREA --- */
    #map-wrapper {
      flex: 1; position: relative; background: #E2E8F0; overflow: hidden;
      /* Subtle grid pattern */
      background-image: radial-gradient(#CBD5E1 1px, transparent 1px);
      background-size: 20px 20px;
    }
    #stage-container { width: 100%; height: 100%; cursor: grab; }
    #stage-container:active { cursor: grabbing; }

    /* --- LEGEND --- */
    .legend {
      position: absolute; top: 16px; left: 16px; pointer-events: none;
      background: rgba(255,255,255,0.9); padding: 8px 12px; border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: flex; gap: 12px; font-size: 0.75rem; font-weight: 600;
      border: 1px solid rgba(0,0,0,0.05);
    }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-avail { background: #fff; border: 2px solid #64748B; }
    .dot-selected { background: var(--brand); border: 2px solid var(--brand); }
    .dot-sold { background: #E2E8F0; border: 2px solid #CBD5E1; }

    /* --- FOOTER --- */
    footer {
      background: var(--bg-surface); border-top: 1px solid var(--border);
      padding: 16px 24px; flex-shrink: 0;
      display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 -4px 10px rgba(0,0,0,0.03); z-index: 10;
    }
    
    .basket-info { display: flex; flex-direction: column; }
    .basket-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; color: var(--text-muted); }
    .basket-total { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 800; color: var(--primary); }
    .basket-detail { font-size: 0.85rem; color: var(--text-main); margin-top: 2px; }

    .btn-checkout {
      background: var(--success); color: white; border: none;
      padding: 12px 32px; border-radius: 99px;
      font-size: 1rem; font-weight: 700; font-family: 'Outfit', sans-serif;
      text-transform: uppercase; letter-spacing: 0.05em;
      cursor: pointer; transition: all 0.2s;
      opacity: 0.5; pointer-events: none;
    }
    .btn-checkout.active { opacity: 1; pointer-events: auto; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
    .btn-checkout:hover { background: #059669; }

    /* --- LOADING SPINNER --- */
    #loader {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.8); z-index: 50;
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; color: var(--primary);
    }
  </style>
</head>
<body>

  <header>
    <div class="header-info">
      <h1>${show.title}</h1>
      <div class="header-meta">${dateStr} • ${timeStr} • ${venue.name || 'Venue TBC'}</div>
    </div>
    <a href="/public/event/${show.id}" class="btn-close">✕</a>
  </header>

  <div id="map-wrapper">
    <div class="legend">
      <div class="legend-item"><div class="dot dot-avail"></div> Available</div>
      <div class="legend-item"><div class="dot dot-selected"></div> Selected</div>
      <div class="legend-item"><div class="dot dot-sold"></div> Unavailable</div>
    </div>
    <div id="stage-container"></div>
    <div id="loader">Loading seating plan...</div>
  </div>

  <footer>
    <div class="basket-info">
      <div class="basket-label">Total</div>
      <div class="basket-total" id="ui-total">£0.00</div>
      <div class="basket-detail" id="ui-count">0 tickets selected</div>
    </div>
    <button class="btn-checkout" id="btn-next">Continue</button>
  </footer>

  <script>
    // --- SERVER DATA ---
    const rawLayout = ${mapData};
    const ticketTypes = ${ticketsData};
    const showId = ${showIdStr};

    // --- STATE ---
    const selectedSeats = new Set(); // Stores seat IDs
    const seatPrices = new Map();    // Map<seatId, priceInPence>

    // --- SETUP KONVA ---
    const width = window.innerWidth;
    const height = window.innerHeight - 160; // Approximate header+footer height

    const stage = new Konva.Stage({
      container: 'stage-container',
      width: width,
      height: height,
      draggable: true
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // --- HELPERS ---
    // Try to find a matching ticket type for a seat.
    // Logic: Look for seat.attrs.sbTicketId matching a TicketType.id.
    // Fallback: Use the first/cheapest ticket type if not explicitly assigned.
    function getPriceForSeat(seatNode) {
        const assignedId = seatNode.getAttr('sbTicketId');
        let match = ticketTypes.find(t => t.id === assignedId);
        
        // If seat has no assignment, or assignment invalid, use default (first) ticket
        if (!match && ticketTypes.length > 0) {
            match = ticketTypes[0];
        }
        return match ? match.pricePence : 0;
    }

    // --- RENDER MAP ---
    try {
        const tempNode = Konva.Node.create(rawLayout);
        const children = tempNode.getChildren().slice();
        
        children.forEach(group => {
            // Flatten hierarchy: move groups to our layer
            group.moveTo(layer);
            
            // Lock everything
            group.draggable(false);
            group.listening(false); 

            // Identify "Seat Groups" (Row blocks, tables, single seats)
            const type = group.getAttr('shapeType') || group.name();
            if (['row-seats', 'circular-table', 'rect-table', 'single-seat'].includes(type)) {
                
                // Find seats inside
                const circles = group.find('Circle');
                circles.forEach(seat => {
                    if (!seat.getAttr('isSeat')) return;

                    // Get status
                    const status = seat.getAttr('status') || 'AVAILABLE'; // Default to available if missing
                    // Note: 'sbHoldStatus' logic could go here if we wanted to block holds visually

                    const price = getPriceForSeat(seat);
                    seatPrices.set(seat._id, price); // Cache price

                    // Visual Setup
                    seat.fill('#ffffff'); // White center
                    seat.stroke('#64748B'); // Grey ring
                    seat.strokeWidth(1.5);
                    
                    // Enable Interaction
                    seat.listening(true);
                    seat.cursor('pointer');

                    // Hover
                    seat.on('mouseenter', () => {
                        if (selectedSeats.has(seat._id)) return;
                        stage.container().style.cursor = 'pointer';
                        seat.stroke('#0056D2'); // Hover Blue
                        seat.strokeWidth(3);
                    });
                    seat.on('mouseleave', () => {
                        stage.container().style.cursor = 'default';
                        if (selectedSeats.has(seat._id)) return;
                        seat.stroke('#64748B');
                        seat.strokeWidth(1.5);
                    });

                    // Click
                    seat.on('click tap', (e) => {
                        e.cancelBubble = true;
                        toggleSeat(seat);
                    });
                });
            }
        });

        // Center map
        const rect = layer.getClientRect();
        if (rect) {
            const scale = Math.min(
                (width - 40) / rect.width,
                (height - 40) / rect.height
            );
            // Limit zoom
            const finalScale = Math.min(Math.max(scale, 0.2), 1.5);
            
            stage.scale({ x: finalScale, y: finalScale });
            
            // Center
            const newRect = layer.getClientRect();
            stage.x((width - newRect.width) / 2);
            stage.y((height - newRect.height) / 2);
        }

        layer.draw();
        document.getElementById('loader').style.display = 'none';

    } catch (err) {
        console.error("Map Render Error", err);
        document.getElementById('loader').innerText = "Error loading map";
    }

    // --- ZOOM LOGIC (Wheel) ---
    stage.on('wheel', (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
    });


    // --- SELECTION LOGIC ---
    function toggleSeat(seat) {
        const id = seat._id;
        
        if (selectedSeats.has(id)) {
            // Deselect
            selectedSeats.delete(id);
            seat.fill('#ffffff');
            seat.stroke('#64748B');
        } else {
            // Select (Max 10)
            if (selectedSeats.size >= 10) {
                alert("Maximum 10 tickets per order.");
                return;
            }
            selectedSeats.add(id);
            seat.fill('#0056D2'); // Brand Blue
            seat.stroke('#0056D2');
        }
        updateBasket();
    }

    function updateBasket() {
        let totalPence = 0;
        let count = 0;
        
        selectedSeats.forEach(id => {
            totalPence += (seatPrices.get(id) || 0);
            count++;
        });

        const fmt = '£' + (totalPence / 100).toFixed(2);
        document.getElementById('ui-total').innerText = fmt;
        document.getElementById('ui-count').innerText = count + (count === 1 ? ' ticket' : ' tickets');

        const btn = document.getElementById('btn-next');
        if (count > 0) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    // --- CHECKOUT SUBMISSION ---
    document.getElementById('btn-next').addEventListener('click', async () => {
        const btn = document.getElementById('btn-next');
        if (!btn.classList.contains('active')) return;
        
        btn.innerText = 'Processing...';
        
        // Calculate totals for submission
        let totalPence = 0;
        selectedSeats.forEach(id => totalPence += (seatPrices.get(id) || 0));
        const quantity = selectedSeats.size;
        
        // Since the current backend only accepts a single unit price, we calculate the average
        // (This is a workaround until backend supports multiple line items per order)
        const unitPricePence = Math.round(totalPence / quantity);

        try {
            const res = await fetch('/checkout/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    showId: showId,
                    quantity: quantity,
                    unitPricePence: unitPricePence
                })
            });
            
            const data = await res.json();
            if (data.ok && data.url) {
                window.location.href = data.url; // Redirect to Stripe
            } else {
                alert("Checkout failed: " + (data.message || "Unknown error"));
                btn.innerText = 'Continue';
            }
        } catch (e) {
            console.error(e);
            alert("Connection error. Please try again.");
            btn.innerText = 'Continue';
        }
    });

  </script>
</body>
</html>`);

  } catch (err) {
    console.error('checkout/map error', err);
    res.status(500).send('Server error');
  }
});


/**
 * POST /checkout/session
 * (User's existing code preserved exactly)
 */
router.post('/session', async (req, res) => {
  try {
    const { showId, quantity } = req.body ?? {};
    if (!showId || !quantity || quantity < 1) {
      return res.status(400).json({ ok: false, message: 'showId and quantity are required' });
    }

    // Unit price: prefer ticket type price or fallback to provided value
    const show = await prisma.show.findFirst({
      where: { id: showId, status: ShowStatus.LIVE },
      select: {
        status: true,
        ticketTypes: { select: { pricePence: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const typedShow = show as
      | Prisma.ShowGetPayload<{
          select: {
            status: true;
            ticketTypes: { select: { pricePence: true } };
          };
        }>
      | null;

    if (!typedShow) {
      return res.status(404).json({ ok: false, message: 'Show not available' });
    }

    // Logic: If user provided a specific unitPricePence (from our frontend calc), use it.
    // Otherwise fall back to the first ticket type in DB.
    const unitPricePence =
      (typeof req.body.unitPricePence === 'number' ? req.body.unitPricePence : null) ??
      typedShow.ticketTypes?.[0]?.pricePence;

    if (!unitPricePence) {
      return res.status(400).json({ ok: false, message: 'No ticket price found' });
    }

    // Optional organiser fee split (if user logged-in and has a custom split)
    let organiserSplitBps: number | null = null;
    const userId = (req as any).userId as string | undefined;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organiserSplitBps: true },
      });
      organiserSplitBps = user?.organiserSplitBps ?? null;
    }

    const fees = await calcFeesForShow(prisma, showId, Number(quantity), Number(unitPricePence), organiserSplitBps);

    // Create a placeholder order (PENDING)
    const order = await prisma.order.create({
      data: {
        show: { connect: { id: showId } },
        quantity: Number(quantity),
        amountPence: Number(unitPricePence) * Number(quantity),
        status: 'PENDING',
        platformFeePence: fees.platformFeePence,
        organiserSharePence: fees.organiserSharePence,
        paymentFeePence: fees.paymentFeePence,
        netPayoutPence: fees.netPayoutPence,
      },
      select: { id: true },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
      line_items: [
        {
          quantity,
          price_data: {
            currency: 'gbp',
            unit_amount: unitPricePence,
            product_data: {
              name: 'Tickets',
            },
          },
        },
      ],
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
