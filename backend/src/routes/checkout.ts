// backend/src/routes/checkout.ts
import { Router } from 'express';
import { Prisma, ShowStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
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
 * INTELLIGENT ROUTER:
 * 1. Checks show.activeSeatMapId
 * 2. If valid map -> Renders Interactive Map (Extracts konvaJson correctly)
 * 3. If null/invalid -> Renders Ticket List (General Admission)
 */
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

    // 1. Check for linked Seat Map
    let seatMap = null;
    // @ts-ignore
    if (show.activeSeatMapId) {
        seatMap = await prisma.seatMap.findUnique({ 
            // @ts-ignore
            where: { id: show.activeSeatMapId } 
        });
    }

    // 2. Fallback: If legacy show (no link yet), find the newest map
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

    // --- EXTRACT KONVA DATA ---
    let konvaData = null;
    if (seatMap && seatMap.layout) {
        const layoutObj = seatMap.layout as any;
        konvaData = layoutObj.konvaJson || null;
        // Legacy fallback
        if (!konvaData && layoutObj.attrs) {
            konvaData = layoutObj;
        }
    }

    // ============================================================
    // MODE A: TICKET LIST (Unallocated / GA / No Map Data)
    // ============================================================
    if (!konvaData) {
       const ticketsJson = JSON.stringify(ticketTypes);
       
       res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Select Tickets | ${show.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --bg:#F3F4F6; --surface:#FFFFFF; --primary:#0F172A; --brand:#0056D2; --text:#1F2937; --muted:#6B7280; --border:#E5E7EB; }
    body { margin:0; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; min-height:100vh; }
    
    header { background:var(--surface); padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
    h1 { font-family:'Outfit',sans-serif; font-size:1.25rem; margin:0; font-weight:700; color:var(--primary); }
    .meta { font-size:0.9rem; color:var(--muted); margin-top:4px; }
    .close { text-decoration:none; font-size:1.5rem; color:var(--muted); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; }
    .close:hover { background:#F3F4F6; color:var(--primary); }

    main { flex:1; max-width:600px; margin:40px auto; width:100%; padding:0 20px; }
    .card { background:var(--surface); border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); border:1px solid var(--border); overflow:hidden; }
    .card-header { padding:24px; border-bottom:1px solid var(--border); background:#fff; }
    .card-title { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:700; margin-bottom:4px; }
    
    .ticket-list { padding:0; margin:0; list-style:none; }
    .ticket-item { padding:20px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
    .ticket-item:last-child { border-bottom:none; }
    
    .t-info h3 { margin:0 0 4px 0; font-size:1rem; font-weight:600; color:var(--primary); }
    .t-price { font-size:1.1rem; font-weight:700; color:var(--brand); }
    
    .qty-ctrl { display:flex; align-items:center; gap:12px; }
    .btn-qty { width:32px; height:32px; border:1px solid var(--border); background:#fff; border-radius:6px; cursor:pointer; font-size:1.2rem; color:var(--primary); display:flex; align-items:center; justify-content:center; transition:all 0.2s; }
    .btn-qty:hover { border-color:var(--brand); color:var(--brand); }
    .btn-qty:disabled { opacity:0.3; cursor:not-allowed; }
    .qty-val { font-weight:600; width:20px; text-align:center; font-size:1.1rem; }

    .footer { padding:24px; background:#F9FAFB; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
    .total-lbl { font-size:0.85rem; color:var(--muted); text-transform:uppercase; font-weight:600; letter-spacing:0.05em; }
    .total-val { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:700; color:var(--primary); }
    .btn-checkout { background:var(--brand); color:white; border:none; padding:12px 32px; border-radius:8px; font-weight:700; font-size:1rem; cursor:pointer; opacity:0.5; pointer-events:none; transition:all 0.2s; }
    .btn-checkout.active { opacity:1; pointer-events:auto; }
    .btn-checkout:hover { background:#0044A8; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${show.title}</h1>
      <div class="meta">${dateStr} • ${timeStr}</div>
    </div>
    <a href="/public/event/${show.id}" class="close">✕</a>
  </header>

  <main>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Select Tickets</div>
        <div style="color:var(--muted)">${venueName}</div>
      </div>
      <ul class="ticket-list" id="list"></ul>
      <div class="footer">
        <div>
          <div class="total-lbl">Total</div>
          <div class="total-val" id="total">£0.00</div>
        </div>
        <button class="btn-checkout" id="btn-next">Checkout</button>
      </div>
    </div>
  </main>

  <script>
    const ticketTypes = ${ticketsJson};
    const showId = "${show.id}";
    const state = {}; 

    function render() {
      const list = document.getElementById('list');
      list.innerHTML = ticketTypes.map(t => {
        const qty = state[t.id] || 0;
        const price = (t.pricePence / 100).toFixed(2);
        return \`
          <li class="ticket-item">
            <div class="t-info">
              <h3>\${t.name}</h3>
              <div class="t-price">£\${price}</div>
            </div>
            <div class="qty-ctrl">
              <button class="btn-qty" onclick="update('\${t.id}', -1)" \${qty === 0 ? 'disabled' : ''}>−</button>
              <div class="qty-val">\${qty}</div>
              <button class="btn-qty" onclick="update('\${t.id}', 1)" \${qty >= 10 ? 'disabled' : ''}>+</button>
            </div>
          </li>
        \`;
      }).join('');
      calcTotal();
    }

    window.update = (id, delta) => {
      const current = state[id] || 0;
      const next = Math.max(0, current + delta);
      // Logic: Allow multiple types
      state[id] = next;
      render();
    };

    function calcTotal() {
      let totalPence = 0;
      let count = 0;
      let activeId = null;

      ticketTypes.forEach(t => {
        const qty = state[t.id] || 0;
        if (qty > 0) {
           totalPence += (t.pricePence * qty);
           count += qty;
           activeId = t.id;
        }
      });

      document.getElementById('total').innerText = '£' + (totalPence / 100).toFixed(2);
      const btn = document.getElementById('btn-next');
      
      if (count > 0) {
        btn.classList.add('active');
        btn.onclick = () => doCheckout(activeId, count);
      } else {
        btn.classList.remove('active');
      }
    }

    async function doCheckout(ticketTypeId, quantity) {
       const btn = document.getElementById('btn-next');
       btn.innerText = 'Processing...';
       
       const unitPricePence = Math.round(totalPence / quantity);
       
       try {
         const res = await fetch('/checkout/session', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ showId, quantity, unitPricePence, ticketTypeId })
         });
         const data = await res.json();
         if (data.ok && data.url) window.location.href = data.url;
         else alert('Error: ' + (data.message || 'Unknown'));
       } catch (e) {
         alert('Connection error');
       }
       btn.innerText = 'Checkout';
    }

    render();
  </script>
</body>
</html>`);
       return; 
    }

    // ============================================================
    // MODE B: ALLOCATED SEATING (Konva Map Found)
    // ============================================================
    
    // Use the extracted konvaData
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
    :root { --bg:#F3F4F6; --surface:#FFFFFF; --primary:#0F172A; --brand:#0056D2; --text:#1F2937; --muted:#6B7280; --border:#E5E7EB; --success:#10B981; }
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
    #loader { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.8); z-index:50; display:flex; align-items:center; justify-content:center; font-weight:600; color:var(--primary); }
  </style>
</head>
<body>
  <header>
    <div class="header-info">
      <h1>${show.title}</h1>
      <div class="header-meta">${dateStr} • ${timeStr} • ${venueName}</div>
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
    const rawLayout = ${mapData};
    const ticketTypes = ${ticketsData};
    const showId = ${showIdStr};
    const selectedSeats = new Set(); 
    const seatPrices = new Map();    
    const width = window.innerWidth;
    const height = window.innerHeight - 160;
    const stage = new Konva.Stage({ container: 'stage-container', width: width, height: height, draggable: true });
    const layer = new Konva.Layer();
    stage.add(layer);

    function getPriceForSeat(seatNode) {
        const assignedId = seatNode.getAttr('sbTicketId');
        let match = ticketTypes.find(t => t.id === assignedId);
        if (!match && ticketTypes.length > 0) match = ticketTypes[0];
        return match ? match.pricePence : 0;
    }

    try {
        // --- FIX: Robust Layout Loading ---
        // 1. Handle potential JSON string
        let layout = rawLayout;
        if (typeof layout === 'string') {
            try { layout = JSON.parse(layout); } catch(e) { console.error('Parse error', e); }
        }
        
        // 2. Ensure className exists on root
        if (layout && !layout.className) {
            // If it looks like a Stage/Layer structure, assume Stage
            if (layout.attrs || layout.children) {
                layout.className = 'Stage';
            }
        }

        const tempNode = Konva.Node.create(layout);
        
        // 3. Extract children to move to our main layer
        let nodesToMove = [];
        if (tempNode.getClassName() === 'Stage') {
             // Find the layer inside the stage
             const tempLayer = tempNode.findOne('Layer') || tempNode.getChildren()[0];
             if (tempLayer) nodesToMove = tempLayer.getChildren().slice();
        } else if (tempNode.getClassName() === 'Layer') {
             nodesToMove = tempNode.getChildren().slice();
        } else {
             // If it's a raw Group or Shape
             nodesToMove = [tempNode];
        }

        nodesToMove.forEach(node => {
            node.moveTo(layer);
            
            // Lock everything
            node.draggable(false);
            node.listening(false);
            node.find('*').forEach(n => { n.draggable(false); n.listening(false); });

            // Identify "Seat Groups"
            const groups = node.find('Group').concat(node.nodeType === 'Group' ? [node] : []);
            
            groups.forEach(group => {
                const type = group.getAttr('shapeType') || group.name();
                if (['row-seats', 'circular-table', 'rect-table', 'single-seat'].includes(type)) {
                    const circles = group.find('Circle');
                    circles.forEach(seat => {
                        if (!seat.getAttr('isSeat')) return;
                        const price = getPriceForSeat(seat);
                        seatPrices.set(seat._id, price);
                        
                        // Base style
                        seat.fill('#ffffff'); 
                        seat.stroke('#64748B'); 
                        seat.strokeWidth(1.5);
                        seat.listening(true);
                        seat.cursor('pointer');

                        seat.on('mouseenter', () => {
                            if (selectedSeats.has(seat._id)) return;
                            stage.container().style.cursor = 'pointer';
                            seat.stroke('#0056D2');
                            seat.strokeWidth(3);
                        });
                        seat.on('mouseleave', () => {
                            stage.container().style.cursor = 'default';
                            if (selectedSeats.has(seat._id)) return;
                            seat.stroke('#64748B');
                            seat.strokeWidth(1.5);
                        });
                        seat.on('click tap', (e) => {
                            e.cancelBubble = true;
                            toggleSeat(seat);
                        });
                    });
                }
            });
        });

        // Auto-center logic
        const rect = layer.getClientRect();
        if (rect && rect.width > 0) {
            const scale = Math.min((width - 40) / rect.width, (height - 40) / rect.height);
            const finalScale = Math.min(Math.max(scale, 0.2), 1.5);
            stage.scale({ x: finalScale, y: finalScale });
            const newRect = layer.getClientRect();
            stage.x((width - newRect.width) / 2);
            stage.y((height - newRect.height) / 2);
        }
        layer.draw();
        document.getElementById('loader').style.display = 'none';
    } catch (err) {
        console.error(err);
        document.getElementById('loader').innerText = "Error loading map";
    }

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

    function toggleSeat(seat) {
        const id = seat._id;
        if (selectedSeats.has(id)) {
            selectedSeats.delete(id);
            seat.fill('#ffffff');
            seat.stroke('#64748B');
        } else {
            if (selectedSeats.size >= 10) { alert("Maximum 10 tickets per order."); return; }
            selectedSeats.add(id);
            seat.fill('#0056D2');
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

export default router;
