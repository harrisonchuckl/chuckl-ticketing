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

    // --- MODE A: LIST VIEW ---
    if (!konvaData) {
       res.type('html').send(`<!doctype html><html><body><h1>General Admission</h1><p>Please use the list view.</p></body></html>`);
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
    const uiLayer = new Konva.Layer({ listening: false }); // Pass-through clicks
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

        console.log("[DEBUG] Loading Layout...", layout);

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
                const isBlocked = status === 'BLOCKED' || status === 'SOLD' || status === 'HELD';
                const isHeldDB = heldSeatIds.has(seat.id()) || heldSeatIds.has(seat.getAttr('sbSeatId'));
                const isUnavailable = isBlocked || isHeldDB;

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

                // VISUALS
                if (isUnavailable) {
                    seat.fill('#334155'); // Dark Grey
                    seat.stroke('#1e293b'); seat.strokeWidth(1); 
                    seat.opacity(0.8); seat.listening(false);
                } else {
                    seat.fill('#ffffff'); seat.stroke('#64748B'); seat.strokeWidth(1.5);
                    seat.opacity(1); seat.listening(true); 
                }
                seat.shadowEnabled(false);
                seat.visible(true);

                // --- Tag for Icon Layer ---
                if (info && !isUnavailable) seat.setAttr('hasInfo', true);
                if (viewImg) seat.setAttr('hasView', true);

                // EVENTS
                if (!isUnavailable) {
                    seat.on('mouseenter', () => {
                        stage.container().style.cursor = 'pointer';
                        if (!selectedSeats.has(seat._id)) {
                            seat.stroke('#0056D2'); seat.strokeWidth(3); mainLayer.batchDraw();
                        }
                        const pos = stage.getPointerPosition();
                        const priceStr = '£' + (price/100).toFixed(2);
                        let html = \`<span class="tt-title">\${label}</span><span class="tt-meta">\${tType ? tType.name : 'Standard'} • \${priceStr}</span>\`;
                        if (info) html += \`<div class="tt-info">\${info}</div>\`;
                        const viewMode = document.getElementById('toggle-views').checked;
                        if (viewImg && viewMode) html += \`<img src="\${viewImg}" />\`;
                        else if (viewImg) html += \`<div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">(Show seat views to preview)</div>\`;

                        tooltip.innerHTML = html;
                        tooltip.style.display = 'block';
                        tooltip.style.left = (pos.x + 20) + 'px';
                        tooltip.style.top = (pos.y + 20) + 'px';
                    });
                    seat.on('mouseleave', () => {
                        stage.container().style.cursor = 'default';
                        tooltip.style.display = 'none';
                        if (!selectedSeats.has(seat._id)) {
                            seat.stroke('#64748B'); seat.strokeWidth(1.5); mainLayer.batchDraw();
                        }
                    });
                    seat.on('click tap', (e) => {
                        e.cancelBubble = true;
                        toggleSeat(seat, parentGroup);
                    });
                }
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

        // --- 4. PRECISE AUTO-FIT WITH DELAY ---
function fitStageToContent(padding = 50) {
            const semanticSelector = (node) => {
                if (!(node instanceof Konva.Shape)) return false;
                if (!node.isVisible() || node.opacity() === 0) return false;
                if (node.width && node.height && (node.width() > 4000 || node.height() > 4000)) return false;
                if (node.getAttr('isSeat')) return true;
                const name = node.name() || '';
                const type = node.getAttr('shapeType');
                if (type === 'stage') return true;
                if (node.getClassName() === 'Text') return true;
                if (name.includes('label') || name.includes('row')) return true;
                return false;
            };

            const semanticNodes = mainLayer.find(semanticSelector);
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            semanticNodes.forEach((node) => {
                const rect = node.getClientRect({ relativeTo: mainLayer, skipShadow: true });
                if (!rect || rect.width === 0 || rect.height === 0) return;
                minX = Math.min(minX, rect.x);
                minY = Math.min(minY, rect.y);
                maxX = Math.max(maxX, rect.x + rect.width);
                maxY = Math.max(maxY, rect.y + rect.height);
                
                });

                if (!isFinite(minX) || !isFinite(minY)) return;

            const contentWidth = maxX - minX;
            const contentHeight = maxY - minY;
            const cw = container.offsetWidth;
            const ch = container.offsetHeight;

            if (cw === 0 || ch === 0) return;

            const availableWidth = Math.max(10, cw - padding * 2);
            const availableHeight = Math.max(10, ch - padding * 2);
            const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
            stage.scale({ x: scale, y: scale });

            const offsetX = padding + (availableWidth - contentWidth * scale) / 2;
            const offsetY = padding + (availableHeight - contentHeight * scale) / 2;
            stage.position({ x: offsetX - minX * scale, y: offsetY - minY * scale });

            uiLayer.find('.debug-bounds').forEach(n => n.destroy());
            const debugRect = new Konva.Rect({
                x: minX,
                y: minY,
                width: contentWidth,
                height: contentHeight,
                stroke: 'red',
                strokeWidth: 2 / scale,
                dash: [8 / scale, 6 / scale],
                listening: false,
                name: 'debug-bounds'
            });
            uiLayer.add(debugRect);
            uiLayer.batchDraw();
document.getElementById('loader').classList.add('hidden');
            document.getElementById('stage-container').classList.add('visible');
        }
        

        // Wait for DOM layout to settle (300ms delay for safety)
        setTimeout(() => { fitStageToContent(); updateIcons(); }, 300);
        
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

        mainLayer.find('Circle').forEach(seat => {
            if (!seat.visible()) return;
            const hasInfo = seat.getAttr('hasInfo');
            const hasView = seat.getAttr('hasView');
            
            if (!hasInfo && !hasView) return;
            
            const pos = seat.getAbsolutePosition();
            const radius = seat.radius() * scale;
            
            // INFO ICON
            if (hasInfo) {
               const grp = new Konva.Group({ x: pos.x + radius*0.7, y: pos.y - radius*0.7, listening:false, name:'info-icon' });

              grp.add(new Konva.Circle({ radius: 6, fill: '#0F172A' }));
               grp.add(new Konva.Text({ text:'i', fontSize:9, fill:'#fff', x:-1.5, y:-4, fontStyle:'bold', fontFamily:'sans-serif' }));
               uiLayer.add(grp);
            }
            
            // VIEW ICON
            if (hasView && showViews) {
               const grp = new Konva.Group({ x: pos.x, y: pos.y, listening:false, name:'view-icon' });
               grp.add(new Konva.Circle({ radius: 10, fill: '#0056D2' }));
               const cam = new Konva.Path({ data: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5 5 2.24 5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z', fill: 'white', scaleX: 0.6, scaleY: 0.6, offsetX: 12, offsetY: 12 });
               grp.add(cam);
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
        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });
        const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
        stage.position(newPos);
        updateIcons();
    });

        function leavesGap(row, seatId, willSelect) {
        const states = row.map(s => {
             if (s.unavailable) return 0; // blocked/held
            if (s.id === seatId) return willSelect ? 2 : 1; // simulate new state
            return selectedSeats.has(s.id) ? 2 : 1; // 2 selected, 1 open
        });
        
        for (let i = 0; i < states.length; i++) {
          if (states[i] !== 1) continue; // only care about empty seats
            const left = i === 0 ? 0 : states[i - 1];
            const right = i === states.length - 1 ? 0 : states[i + 1];
            if (left !== 1 && right !== 1) return true; // orphaned single
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
        let totalPence = 0; selectedSeats.forEach(id => totalPence += (seatPrices.get(id) || 0));
        const quantity = selectedSeats.size; const unitPricePence = Math.round(totalPence / quantity);
        try {
            const res = await fetch('/checkout/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showId, quantity, unitPricePence }) });
            const data = await res.json();
            if (data.ok && data.url) window.location.href = data.url;
            else { alert("Error: " + (data.message || "Unknown")); btn.innerText = 'Continue'; }
        } catch (e) { alert("Connection error"); btn.innerText = 'Continue'; }
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
