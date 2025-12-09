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
        ticketTypes: { orderBy: { pricePence: 'asc' } },
        allocations: {
          include: { seats: { include: { seat: true } } }
        }
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

    // Extract Blocked/Held Seat IDs
    const heldSeatIds = new Set<string>();
    if (show.allocations) {
        show.allocations.forEach(alloc => {
            if (alloc.seats) {
                alloc.seats.forEach(allocSeat => {
                    if (allocSeat.seatId) heldSeatIds.add(allocSeat.seatId);
                });
            }
        });
    }

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

    // ============================================================
    // MODE A: TICKET LIST (No Map)
    // ============================================================
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

    // ============================================================
    // MODE B: INTERACTIVE MAP
    // ============================================================
    
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
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/konva@9.3.3/konva.min.js"></script>

  <style>
    :root { --bg:#F3F4F6; --surface:#FFFFFF; --primary:#0F172A; --brand:#0056D2; --text-main:#111827; --text-muted:#6B7280; --border:#E5E7EB; --success:#10B981; --blocked:#94a3b8; }
    body { margin:0; font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    
    header { background:var(--surface); border-bottom:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; z-index:10; }
    .header-info h1 { font-family:'Outfit',sans-serif; font-size:1.25rem; margin:0; font-weight:700; color:var(--primary); }
    .header-meta { font-size:0.9rem; color:var(--muted); margin-top:4px; }
    
    .btn-close { text-decoration:none; font-size:1.5rem; color:var(--muted); width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:background 0.2s; }
    .btn-close:hover { background:#F3F4F6; color:var(--primary); }
    
    #map-wrapper { flex:1; position:relative; background:#E2E8F0; overflow:hidden; background-image:radial-gradient(#CBD5E1 1px, transparent 1px); background-size:20px 20px; }
    #stage-container { width:100%; height:100%; cursor:grab; }
    #stage-container:active { cursor:grabbing; }
    
    /* LEGEND - Z-Index Boost */
    .legend { 
        position:absolute; top:20px; left:20px; 
        background:rgba(255,255,255,0.98); padding:12px 16px; border-radius:12px; 
        box-shadow:0 10px 25px -5px rgba(0,0,0,0.15); border:1px solid rgba(0,0,0,0.05);
        display:flex; flex-direction:column; gap:12px; 
        font-size:0.75rem; font-weight:600; 
        z-index: 3000; /* Ensure on top of everything */
    }
    .legend-row { display:flex; gap:16px; flex-wrap:wrap; }
    .legend-item { display:flex; align-items:center; gap:6px; }
    .dot { width:14px; height:14px; border-radius:50%; border:1px solid rgba(0,0,0,0.1); }
    .dot-avail { background:#fff; border-color:#64748B; }
    .dot-selected { background:var(--brand); border-color:var(--brand); }
    .dot-sold { background:var(--blocked); border-color:var(--text); opacity:0.3; }
    
    .view-toggle { padding-top:10px; border-top:1px solid #e2e8f0; display:flex; align-items:center; gap:8px; cursor:pointer; }
    .view-toggle input { accent-color: var(--brand); transform:scale(1.2); cursor:pointer; }

    footer { background:var(--surface); border-top:1px solid var(--border); padding:16px 24px; flex-shrink:0; display:flex; justify-content:space-between; align-items:center; box-shadow:0 -4px 10px rgba(0,0,0,0.03); z-index:3000; }
    .basket-info { display:flex; flex-direction:column; }
    .basket-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; color:var(--muted); }
    .basket-total { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:800; color:var(--primary); }
    .basket-detail { font-size:0.85rem; color:var(--text-main); margin-top:2px; }
    
    .btn-checkout { background:var(--success); color:white; border:none; padding:12px 32px; border-radius:99px; font-size:1rem; font-weight:700; font-family:'Outfit',sans-serif; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; transition:all 0.2s; opacity:0.5; pointer-events:none; }
    .btn-checkout.active { opacity:1; pointer-events:auto; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3); }
    .btn-checkout:hover { background:#059669; }
    
    #loader { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.95); z-index:4000; display:flex; flex-direction:column; gap:10px; align-items:center; justify-content:center; font-weight:600; color:var(--primary); }
    
    #tooltip {
      position: absolute; display: none; padding: 12px; background: #1e293b; color: #fff;
      border-radius: 8px; pointer-events: none; font-size: 0.85rem; z-index: 3500;
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
    // For gap logic: Map<groupId, Array<SeatObject>>
    const rowMap = new Map(); 

    const width = window.innerWidth; 
    const height = window.innerHeight - 160;
    
    const stage = new Konva.Stage({ container: 'stage-container', width: width, height: height, draggable: true });
    // We will load content into this layer
    const mainLayer = new Konva.Layer();
    stage.add(mainLayer);
    
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

        console.log("[DEBUG] Loading Layout...", layout);

        // --- 1. LOAD LAYER IN-PLACE ---
        
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

        // Create the Layer from data (this creates all children/groups recursively!)
        const loadedLayer = Konva.Node.create(layerData);
        
        // Move children to our main layer to flatten structure for easy management
        // Note: Using a single layer lets us control zoom/pan easily
        const children = loadedLayer.getChildren().slice();
        children.forEach(node => {
            node.moveTo(mainLayer);
            processNode(node, null);
        });
        // We don't need the loaded shell anymore
        loadedLayer.destroy();

        // RECURSIVE NODE PROCESSOR
        function processNode(node, parentGroup) {
            // Identify Groups (Rows/Tables)
            const nodeType = node.getClassName();
            const groupType = node.getAttr('shapeType') || node.name();
            const isSeatGroup = nodeType === 'Group' && ['row-seats', 'circular-table', 'rect-table', 'single-seat'].includes(groupType);
            
            if (isSeatGroup) {
                // Remove text numbers inside seat groups (Visual Cleanup)
                const texts = node.find('Text');
                texts.forEach(t => t.destroy()); // Destroy completely
                
                parentGroup = node; // Track for gap logic
            }

            // Identify Seats
            if (nodeType === 'Circle' && node.getAttr('isSeat')) {
                const seat = node;
                
                // --- STATUS CHECK ---
                const status = seat.getAttr('status') || 'AVAILABLE';
                const isBlocked = status === 'BLOCKED' || status === 'SOLD' || status === 'HELD';
                const isHeldDB = heldSeatIds.has(seat.id()) || heldSeatIds.has(seat.getAttr('sbSeatId'));
                const isUnavailable = isBlocked || isHeldDB;

                // --- DATA PREP ---
                const tType = getTicketType(seat);
                const price = tType ? tType.pricePence : 0;
                seatPrices.set(seat._id, price);
                
                const label = seat.getAttr('label') || seat.name() || 'Seat';
                const info = seat.getAttr('sbInfo');
                const viewImg = seat.getAttr('sbViewImage');

                // Register for gap detection
                if (parentGroup) {
                    const grpId = parentGroup._id;
                    if (!rowMap.has(grpId)) rowMap.set(grpId, []);
                    // We need GLOBAL coordinates for accurate sorting bounds
                    const absPos = seat.getAbsolutePosition();
                    rowMap.get(grpId).push({
                        id: seat._id,
                        x: absPos.x,
                        y: absPos.y, 
                        unavailable: isUnavailable,
                        node: seat
                    });
                }

                // --- VISUALS ---
                if (isUnavailable) {
                    seat.fill('#e2e8f0'); // Light grey
                    seat.stroke('#cbd5e1'); 
                    seat.strokeWidth(1);
                    seat.listening(false);
                } else {
                    seat.fill('#ffffff'); // White
                    seat.stroke('#64748B'); // Dark Grey Border
                    seat.strokeWidth(1.5);
                    seat.listening(true);
                    // Cursor is handled by stage container events below
                }
                seat.shadowEnabled(false);
                seat.opacity(1);
                seat.visible(true);

                // --- ICONS ---
                // Info 'i' (Black dot)
                if (info && !isUnavailable) {
                    // Create a little group for the icon so it moves with the seat
                    // Add it to the seat's parent group to keep structure
                    const iGroup = new Konva.Group({ 
                        x: seat.x(), 
                        y: seat.y(),
                        listening: false 
                    });
                    const offset = seat.radius();
                    // Small black circle top-right
                    const iDot = new Konva.Circle({ x: offset * 0.7, y: -offset * 0.7, radius: 5, fill: '#0F172A' });
                    const iTxt = new Konva.Text({ x: (offset * 0.7)-1.5, y: (-offset * 0.7)-2.5, text:'i', fontSize:6, fill:'#fff', fontStyle:'bold' });
                    iGroup.add(iDot); iGroup.add(iTxt);
                    if (seat.parent) seat.parent.add(iGroup);
                }

                // View Icon (Camera) - Hidden by default
                if (viewImg) {
                    const vGroup = new Konva.Group({ 
                        x: seat.x(), y: seat.y(), 
                        visible: false, 
                        name: 'view-icon-group',
                        listening: false 
                    });
                    const bg = new Konva.Circle({ radius: 10, fill: '#0056D2' });
                    // Simple camera icon path
                    const icon = new Konva.Path({
                        data: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5 5 2.24 5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
                        fill: 'white', scaleX: 0.6, scaleY: 0.6, offsetX: 12, offsetY: 12
                    });
                    vGroup.add(bg); vGroup.add(icon);
                    if (seat.parent) seat.parent.add(vGroup);
                }

                // --- EVENTS ---
                if (!isUnavailable) {
                    seat.on('mouseenter', () => {
                        stage.container().style.cursor = 'pointer';
                        if (!selectedSeats.has(seat._id)) {
                            seat.stroke('#0056D2'); seat.strokeWidth(3); 
                            mainLayer.batchDraw();
                        }
                        
                        // Tooltip content
                        const pos = stage.getPointerPosition();
                        const priceStr = '£' + (price/100).toFixed(2);
                        let html = \`<span class="tt-title">\${label}</span><span class="tt-meta">\${tType ? tType.name : 'Standard'} • \${priceStr}</span>\`;
                        if (info) html += \`<div class="tt-info">\${info}</div>\`;
                        
                        const viewMode = document.getElementById('toggle-views').checked;
                        if (viewImg && viewMode) {
                            html += \`<img src="\${viewImg}" />\`;
                        } else if (viewImg) {
                            html += \`<div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">(Enable 'Show seat views' to see preview)</div>\`;
                        }

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
            }

            if (node.getChildren) {
                node.getChildren().forEach(child => processNode(child, node.nodeType === 'Group' ? node : parentGroup));
            }
        }

        // --- 3. SORT ROWS (For Gap Logic) ---
        // Sort by X coordinate so we know neighbours
        rowMap.forEach((seats) => seats.sort((a, b) => a.x - b.x));

        // --- 4. MANUAL BOUNDS CALCULATION (Fixes Zoom) ---
        // We calculate bounds manually based on seat positions to guarantee correctness
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let seatCount = 0;

        rowMap.forEach((seats) => {
            seats.forEach(s => {
                seatCount++;
                const r = 25; // Approximate radius buffer
                if (s.x - r < minX) minX = s.x - r;
                if (s.x + r > maxX) maxX = s.x + r;
                if (s.y - r < minY) minY = s.y - r;
                if (s.y + r > maxY) maxY = s.y + r;
            });
        });

        console.log(\`[DEBUG] Manual Bounds: Seats=\${seatCount}, X=\${minX} to \${maxX}, Y=\${minY} to \${maxY}\`);

        if (seatCount > 0 && maxX > minX) {
            const mapW = maxX - minX;
            const mapH = maxY - minY;
            const padding = 60;
            const availW = width - padding;
            const availH = height - padding;

            const scale = Math.min(availW / mapW, availH / mapH) * 0.95; // 95% fit
            
            const cx = minX + mapW / 2;
            const cy = minY + mapH / 2;

            const newX = (width / 2) - (cx * scale);
            const newY = (height / 2) - (cy * scale);

            stage.x(newX);
            stage.y(newY);
            stage.scale({ x: scale, y: scale });
            mainLayer.batchDraw();
        } else {
            console.warn("Could not calculate bounds. Centering default.");
            stage.x(width/2); stage.y(height/2);
        }

        document.getElementById('loader').style.display = 'none';

    } catch (err) {
        console.error(err);
        document.getElementById('loader').innerHTML = 'Error loading map';
    }

    // --- TOGGLE VIEWS ---
    document.getElementById('toggle-views').addEventListener('change', (e) => {
        const show = e.target.checked;
        const icons = stage.find('.view-icon-group');
        icons.forEach(icon => icon.visible(show));
        mainLayer.batchDraw();
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

    // --- GAP CHECKER ---
    function checkGap(seat, rowGroup) {
        if (!rowGroup) return true;
        const row = rowMap.get(rowGroup._id);
        if (!row || row.length < 3) return true;

        // Build status array based on X-order
        const states = row.map(s => {
            if (s.unavailable) return 0; // Blocked/Sold
            if (s.id === seat._id) return selectedSeats.has(s.id) ? 2 : 1; // Toggle simulation
            if (selectedSeats.has(s.id)) return 1; // Selected
            return 2; // Free
        });

        // 0=Taken/Blocked, 1=MySelection, 2=Free
        // Invalid pattern: [0 or 1] [2] [0 or 1] -> Single free seat flanked by taken
        
        for (let i = 0; i < states.length; i++) {
            if (states[i] === 2) { // If seat is free
                const left = (i === 0) ? 0 : states[i-1];
                const right = (i === states.length - 1) ? 0 : states[i+1];
                
                // If flanked by 'occupied' things (0 or 1)
                if (left !== 2 && right !== 2) {
                    return false; // GAP DETECTED
                }
            }
        }
        return true;
    }

    function toggleSeat(seat, parentGroup) {
        const id = seat._id;
        const willSelect = !selectedSeats.has(id);

        if (willSelect) {
            // Apply Gap Check BEFORE selecting
            selectedSeats.add(id);
            if (!checkGap(seat, parentGroup)) {
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
            // Deselect
            selectedSeats.delete(id);
            if (!checkGap(seat, parentGroup)) {
                selectedSeats.add(id); // Revert
                alert("Deselecting this would leave a gap.");
                return;
            }
            seat.fill('#ffffff'); seat.stroke('#64748B');
        }
        mainLayer.batchDraw();
        updateBasket();
    }

    // --- BASKET & SUBMIT ---
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
