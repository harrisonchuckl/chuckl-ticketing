// TixAll seating builder – square grid, drag / rotate, per-action undo
/* global Konva */

(function () {
  // Prevent the builder from initialising twice (which caused double prompts / double elements)
  if (window.__TIXALL_SEATMAP_BUILDER_ACTIVE__) {
    // eslint-disable-next-line no-console
    console.warn("seating-builder: already initialised, skipping second run");
    return;
  }
  window.__TIXALL_SEATMAP_BUILDER_ACTIVE__ = true;

  const showId = window.__SEATMAP_SHOW_ID__;
  const initialLayoutKey = window.__SEATMAP_LAYOUT__ || "blank";

  let currentSeatMapId = null;
  let currentSeatMapName = null;

  if (!showId) {
    // eslint-disable-next-line no-console
    console.error("seating-builder: missing window.__SEATMAP_SHOW_ID__");
    return;
  }

  const container = document.getElementById("app");
  if (!container) {
    // eslint-disable-next-line no-console
    console.error("seating-builder: #app not found");
    return;
  }

function injectSeatmapStyles() {
    let style = document.getElementById("sb-seatmap-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "sb-seatmap-style";
        document.head.appendChild(style);
    }
    style.textContent = `
    /* Force the existing Right Panel to use Flexbox so we can pin the footer */
    .tb-side-panel {
        display: flex !important;
        flex-direction: column !important;
        padding: 0 !important; /* We move padding to inner containers so footer hits edges */
        overflow: hidden !important; /* Stop the whole panel scrolling, only inner content scrolls */
    }

    /* New container for the existing content (Seat Count + Inspector) */
    #sb-sidebar-scroll-container {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 24px; /* Restore the original padding here */
        min-height: 0;
    }

    /* Fixed Footer at the bottom */
    #sb-sidebar-footer {
        flex: 0 0 auto;
        padding: 16px 24px;
        background: #fff;
        border-top: 1px solid #e2e8f0;
        z-index: 20;
        box-shadow: 0 -4px 6px -1px rgba(0,0,0,0.05);
    }

    /* EXISTING STYLES... */
    .sb-validation-list {
        margin-bottom: 12px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 6px;
        padding: 10px;
    }
    .sb-validation-error {
        color: #b91c1c;
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 4px;
        display: flex;
        align-items: start;
        gap: 6px;
    }
    .sb-validation-error:last-child { margin-bottom: 0; }

    .sb-inspector-title {
        font-size: 14px; font-weight: 700; color: #0f172a;
        text-transform: uppercase; letter-spacing: 0.05em;
        margin: 24px 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;
    }
    .sb-inspector-empty {
        font-size: 13px; color: #64748b; background: #f8fafc;
        padding: 16px; border-radius: 8px; border: 1px dashed #cbd5e1; text-align: center;
    }
    .sb-field-row { margin-bottom: 12px; }
    .sb-label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: #475569; }
    
    .sb-input, .sb-select, .sb-textarea {
        width: 100%; box-sizing: border-box;
        border: 1px solid #cbd5e1; border-radius: 6px;
        padding: 10px; font-size: 13px; background: #fff;
        color: #1e293b; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    }
    .sb-input:focus, .sb-select:focus, .sb-textarea:focus {
        border-color: #08B8E8;
        box-shadow: 0 0 0 3px rgba(8, 184, 232, 0.1);
    }

    /* MODERN TICKET CARD */
    .sb-ticket-stack { display: flex; flex-direction: column; gap: 12px; }
    .sb-ticket-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .sb-ticket-card.is-active {
        border-color: #08B8E8;
        box-shadow: 0 0 0 1px #08B8E8;
    }
    .sb-ticket-card-header {
        width: 100%; padding: 16px; border: none; background: #fff;
        display: flex; align-items: center; justify-content: space-between;
        cursor: pointer; text-align: left;
    }
    .sb-ticket-card-header:hover { background: #f8fafc; }
    .sb-ticket-main-info { display: flex; align-items: center; gap: 12px; }
    .sb-ticket-color-dot { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }
    .sb-ticket-name { font-weight: 600; font-size: 14px; color: #0f172a; line-height: 1.3; }
    .sb-ticket-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
    .sb-ticket-card-body { padding: 0 16px 16px; background: #fff; border-top: 1px solid #f1f5f9; }

    /* BIG TIXALL BLUE BUTTON */
    .sb-btn-primary-large {
        width: 100%;
        background-color: #08B8E8;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 14px;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: background 0.2s, transform 0.1s;
        margin-top: 0; /* Handled by container padding */
        box-shadow: 0 4px 6px -1px rgba(8, 184, 232, 0.25);
    }
    .sb-btn-primary-large:hover { background-color: #069ac4; }
    .sb-btn-primary-large:active { transform: translateY(1px); }

    /* LOCKED STATE UI */
    .sb-locked-state {
        background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
        padding: 16px; text-align: center; margin-bottom: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .sb-lock-icon { font-size: 24px; margin-bottom: 8px; display: block; }
    .sb-locked-title { font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 14px; }
    .sb-locked-desc { font-size: 12px; color: #64748b; margin-bottom: 16px; line-height: 1.4; }
    
    .sb-btn-unlock {
        width: 100%; background: #fff; border: 1px solid #ef4444; color: #ef4444;
        font-weight: 600; font-size: 12px; padding: 8px; border-radius: 6px; cursor: pointer;
        transition: all 0.2s;
    }
    .sb-btn-unlock:hover { background: #fef2f2; }
    .sb-btn-unlock-all {
        display: block; width: 100%; margin-top: 12px;
        color: #94a3b8; text-decoration: underline; font-size: 11px;
        background: none; border: none; cursor: pointer;
    }
    .sb-btn-unlock-all:hover { color: #64748b; }

    /* Internal Tools */
    .tool-button {
        width: 100%; height: 36px; border: 1px solid #e2e8f0; border-radius: 6px;
        background: #fff; color: #334155; font-size: 12px; font-weight: 500;
        display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .tool-button:hover { background: #f8fafc; border-color: #cbd5e1; }
    .sb-ticketing-heading { margin-bottom: 24px; }
    .sb-ticketing-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .sb-ticketing-sub { font-size: 13px; color: #64748b; }
    .sb-ticketing-alert {
        background: #fff1f2; border: 1px solid #fecdd3; color: #be123c;
        padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
    }
    .sb-form-grid { display: grid; gap: 12px; margin-top: 16px; }
    
    .tb-tab.is-error::after {
        content: "  ✕ ";
        color: #ef4444;
        font-weight: bold;
        margin-left: 6px;
    }
    .tb-tab.is-complete::after {
        content: "  ✓ ";
        color: #10b981;
        font-weight: bold;
        margin-left: 6px;
    }
    `;
}
  injectSeatmapStyles();

  // ---------- Ensure sidebar DOM (seat count + inspector) ----------

    // ---------- Ensure sidebar DOM (seat count + inspector + footer) ----------
// ---------- Ensure sidebar DOM (seat count + inspector + footer) ----------
function ensureSidebarDom() {
    // 1. Find the EXISTING right sidebar from the HTML template
    // We look for the class '.tb-side-panel' which is defined in your HTML/CSS
    const sidebar = document.querySelector('.tb-side-panel');
    
    // Safety check: if the HTML template hasn't rendered yet, stop.
    if (!sidebar) {
        console.warn("Right sidebar .tb-side-panel not found yet. Waiting for DOM...");
        return;
    }

    // 2. Check if we have already restructured it
    // If the scroll container exists, we have already run this logic.
    if (document.getElementById("sb-sidebar-scroll-container")) {
        return; 
    }

    // 3. Create the Scroll Container 
    // This will hold the "Seats on map" and "Selection/Inspector" sections
    const scrollContainer = document.createElement("div");
    scrollContainer.id = "sb-sidebar-scroll-container";
    
    // Apply styles directly (or via CSS) to ensure it fills the space but scrolls
    scrollContainer.style.flex = "1 1 auto";
    scrollContainer.style.overflowY = "auto";
    scrollContainer.style.minHeight = "0";
    scrollContainer.style.padding = "24px"; // Match original panel padding

    // 4. Move ALL existing children of the sidebar into this scroll container
    // This loops through every element currently in the sidebar and moves it inside our new wrapper
    while (sidebar.firstChild) {
        scrollContainer.appendChild(sidebar.firstChild);
    }

    // 5. Append the scroll container back to the sidebar
    sidebar.appendChild(scrollContainer);

    // 6. Create and Append the Fixed Footer
    const footerDiv = document.createElement("div");
    footerDiv.id = "sb-sidebar-footer";
    // Footer styles are handled in injectSeatmapStyles, but we set structure here too
    footerDiv.style.flex = "0 0 auto"; 
    sidebar.appendChild(footerDiv);
    
    console.log("Sidebar structure updated: Scroll Container + Fixed Footer created.");
}

// CRITICAL: Run this immediately so the footer container is ready
ensureSidebarDom();
  
  // ---------- Config ----------

  const GRID_SIZE = 32;
  const STAGE_PADDING = 0;

  // Zoom config – keep things stable (no super extreme zoom-out)
  const MIN_ZOOM = 0.2;   // 20% (still see a lot, but maths stays sane)
  const MAX_ZOOM = 4;     // 400% zoom in
  const ZOOM_STEP = 0.1;  // smoother steps

  // seat + circular table geometry
  const SEAT_RADIUS = 10;
  const CIRC_DESIRED_GAP = 8;
  const CIRC_MIN_TABLE_RADIUS = 26;

   // ---------- State ----------

    let stage;
  let baseStageWidth = 0;
  let baseStageHeight = 0;

  let gridLayer;
  let mapLayer;
  let overlayLayer;
  let transformer;

  // currently selected tool in the left toolbar
  let activeTool = null;

  // --- stairs drawing state ---
  let stairsDraft = null;
  let stairsStartPos = null;
let selectedNode = null;
let copiedNodesJson = [];
let activeMainTab = "map";

// --- Holds & Allocations State ---
let activeHoldMode = null; 
let activeViewMode = false; 
  let activeAccessibilityMode = null; // "disabled" | "carer" | null
// NEW: Track which specific sub-mode we are in ('view' or 'info')
let activeViewType = null;
let viewInfoItems = []; // Stores { id, name, type: 'image'|'text', content, filename }
// ------------------------------- 
let activeHoldToolType = null; // for the specific button active state
let holdReportSettings = {
  email: "",
  day: "Monday",
  time: "09:00"
};
// We store hold status on the seat nodes as attrs: "sbHoldStatus": "hold" | "allocation"

  // --- ticketing / seat selection state ---
  let ticketSeatSelectionMode = false;
  let ticketSeatSelectionReason = "init";
  let ticketSeatContainerListenerAttached = false;
  let ticketSeatSelectionAction = "toggle"; // manual selection always toggles assignment for the active ticket
  let ticketSeatSelectionStartPos = null;
  let ticketSeatSelectionEndPos = null;
  let ticketSeatSelectionRect = null;
  let lastSeatAssignEventAt = 0;

  let ticketTypes = [];
  let ticketAssignments = new Map();
  let activeTicketSelectionId = null;
  let ticketSeatStageContentListener = null;
  let ticketAccordionOpenIds = new Set();

  let ticketFormState = {
    name: "",
    price: "",
    color: "#2563EB", // TIXL blue default
    onSale: "",
    offSale: "",
    info: "",
    minPerOrder: "1",
    maxPerOrder: "15",
  };

  let ticketFormAutoOffSale = true;

  window.__TIXALL_COMPLETION_STATUS__ = {
  map: false,
  tickets: false,
  holds: false,
  view: false
};

  // --- Validation State ---
window.__TIXALL_TAB_VALIDATION__ = {
    map: { valid: false, errors: [] },
    tickets: { valid: false, errors: [] },
    holds: { valid: true, errors: [] }, // Usually permissive
    view: { valid: true, errors: [] }   // Usually permissive
};

function validateCurrentTabLogic(tab) {
    const errors = [];
    
    // 1. MAP VALIDATION
    if (tab === 'map') {
        const stageNode = mapLayer ? mapLayer.findOne('Group[shapeType="stage"]') : null;
        if (!stageNode) {
            errors.push("There is no STAGE. Please add a stage from the left toolbar.");
        }
        
        // Check for duplicates
        refreshSeatMetadata(); // Update duplicate set
        if (duplicateSeatRefs && duplicateSeatRefs.size > 0) {
            errors.push(`Duplicate seat numbers detected (${duplicateSeatRefs.size}). Identifiers must be unique.`);
        }

        const seats = getAllSeatNodes();
        if (seats.length === 0) {
            errors.push("The map has no seats.");
        }
    }

    // 2. TICKETS VALIDATION
    if (tab === 'tickets') {
        const seats = getAllSeatNodes();
        let unassignedCount = 0;
        seats.forEach(s => {
            const tIds = s.getAttr("sbTicketIds");
            if (!tIds || tIds.length === 0) unassignedCount++;
        });

        if (unassignedCount > 0) {
            errors.push(`${unassignedCount} seats have not been allocated to a ticket type.`);
        }
        
        if (ticketTypes.length === 0) {
            errors.push("No ticket types created.");
        }
    }

    // 3. HOLDS (Permissive, but good to check)
    // 4. VIEW (Permissive)

    return { valid: errors.length === 0, errors };
}

function updateCompletionUI() {
    const s = window.__TIXALL_COMPLETION_STATUS__;
    const v = window.__TIXALL_TAB_VALIDATION__;
    const tabs = document.querySelectorAll('.tb-tab');
    
    tabs.forEach(t => {
        const key = t.getAttribute('data-tab');
        
        // 1. Reset classes first
        t.classList.remove('is-complete', 'is-error');
        
        // 2. Logic: 
        if (s[key]) {
            // Check validation status
            if (v[key] && v[key].valid) {
                t.classList.add('is-complete'); // Green Tick
            } else {
                t.classList.add('is-error');    // Red Cross
            }
        }
    });

    // Update Header Buttons
    const btnPublish = document.getElementById('tb-btn-publish');
    const btnDraft = document.getElementById('tb-btn-draft');
    
    // Allow publish ONLY if Map and Tickets are marked complete AND valid
    const mapOk = s.map && v.map && v.map.valid;
    const tixOk = s.tickets && v.tickets && v.tickets.valid;
    const canPublish = mapOk && tixOk; 
    
    if (btnPublish) {
        btnPublish.disabled = !canPublish;
        btnPublish.title = canPublish ? "Ready to go live" : "Fix errors in Map/Tickets to publish";
        if (!canPublish) btnPublish.classList.add('is-disabled');
        else btnPublish.classList.remove('is-disabled');
    }
    
    if (btnDraft) {
        btnDraft.style.display = "inline-block";
    }
} 
// Logic to navigate to a specific tab by name
function switchBuilderTab(tabName) {
  const tabBtn = document.querySelector(`.tb-tab[data-tab="${tabName}"]`);
  if(tabBtn) tabBtn.click();
}

  // -------- Ticket colour palette (editable TIXL defaults) --------
  // You can change these eight hex values to whatever brand colours you like.
  // Index 0 is the default for the first ticket.
  const DEFAULT_TICKET_COLORS = [
    "#2563EB", // TIXL blue
    "#10B981", // emerald green
    "#F97316", // modern orange
    "#EC4899", // pink
    "#A855F7", // purple
    "#FACC15", // amber / gold
    "#0EA5E9", // sky blue
    "#64748B", // slate grey
  ];

  // Helper: pick the next unused colour for a new ticket
  function getNextTicketColor() {
    const used = new Set(
      ticketTypes
        .map((t) => (t.color || "").toLowerCase())
        .filter(Boolean)
    );

    // If the current form colour is a valid hex and not used yet, prefer that.
    const formColor = (ticketFormState.color || "").toLowerCase();
    if (/^#([0-9a-f]{3}){1,2}$/.test(formColor) && !used.has(formColor)) {
      return ticketFormState.color;
    }

    // Otherwise, pick the first palette colour that isn't in use
    for (const hex of DEFAULT_TICKET_COLORS) {
      const low = hex.toLowerCase();
      if (!used.has(low)) return hex;
    }

    // If all palette colours are already used (more than 8 tickets),
    // fall back to cycling through the palette.
    if (!DEFAULT_TICKET_COLORS.length) {
      return "#2563EB";
    }
    const idx = ticketTypes.length % DEFAULT_TICKET_COLORS.length;
    return DEFAULT_TICKET_COLORS[idx];
  }

  let showMeta = null;
  let venueCurrencyCode = (window.__SEATMAP_VENUE_CURRENCY__ || "GBP")
    .toString()
    .toUpperCase();
  let isLoadingShowMeta = false;
  let seatIdCounter = 1;
  let duplicateSeatRefs = new Set();

  // track shift key for robust multi-select
  let isShiftPressed = false;

  // multi-drag state: snapshot of positions when drag starts
  let multiDragState = null;

  // Line drawing state (for the Line + Curved Line tools)
  let currentLineGroup = null;
  let currentLine = null;
  let currentLinePoints = [];
  let currentLineToolType = null;
  let currentLineUndoStack = [];

  // Freehand curve-line state
  let isCurveDrawing = false;
  let curveRawPoints = [];

  // Arrow drawing state (2-point arrows)
  let arrowDrawingGroup = null;   // Konva.Group for the arrow currently being drawn
  let arrowShape = null;          // Konva.Arrow shape inside that group
  let arrowStartPoint = null;     // { x, y } for the first click

  // history is per-mapLayer JSON
  let history = [];
  let historyIndex = -1;
  let isRestoringHistory = false;


    // table numbering counter (for all circular + rectangular tables)
  let tableCounter = 1;

  // Helper: generate the next table label ("1", "2", "3", ...)
  // It also looks at existing tables on the map so we don't accidentally
  // reuse a number when you add more tables later.
  function nextTableLabel() {
    let maxFound = 0;

    try {
      if (mapLayer && typeof mapLayer.find === "function") {
        mapLayer.find("Group").forEach((g) => {
          const t = g.getAttr("shapeType") || g.name();
          if (t !== "circular-table" && t !== "rect-table") return;

          const raw = g.getAttr("tableLabel");
          const n = parseInt(raw, 10);
          if (Number.isFinite(n) && n > maxFound) {
            maxFound = n;
          }
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[seatmap] nextTableLabel: scan error", e);
    }

    // Ensure our counter is always ahead of anything already on the map
    if (maxFound >= tableCounter) {
      tableCounter = maxFound + 1;
    }

    const label = String(tableCounter);
    tableCounter += 1;
    return label;
  }


  // global default seat label mode for *new* blocks
  // "numbers" = 1, 2, 3... by default during planning
  let globalSeatLabelMode = "numbers";

  const DEBUG_SKEW = true;

  // Sidebar DOM refs
  let seatCountEl = null;
  let inspectorEl = null;


// Update the main symbols button icon to show the currently-selected symbol
// (dark when inactive, blue when active – handled by updateToolButtonActiveState)
function updateSymbolsToolbarIcon(symbolToolNameOrType) {
  try {
    const btn =
      document.querySelector('.tb-left-item.tool-button[data-tool="symbols"]') ||
      document.querySelector('.tool-button[data-tool="symbols"]');
    if (!btn) return;

    const img = btn.querySelector("img");
    if (!img) return;

    const symbolType = normaliseSymbolTool(symbolToolNameOrType);

    // We control what the "symbols" button uses as its base icons
    const darkSrc =
      SYMBOL_ICON_DARK[symbolType] || SYMBOL_ICON_DARK.info;
    const blueSrc =
      SYMBOL_ICON_BLUE[symbolType] || SYMBOL_ICON_BLUE.info;

    img.setAttribute("data-icon-default", darkSrc);
    img.setAttribute("data-icon-active", blueSrc);

    // Respect whether the button is currently active or not
    const isActive = btn.classList.contains("is-active");
    img.src = isActive ? blueSrc : darkSrc;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("updateSymbolsToolbarIcon error", e);
  }
}

function initSymbolsToolbarDefaultIcon() {
  try {
    // Show the mixed WC icon by default
    updateSymbolsToolbarIcon("wc-mixed");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("initial symbols icon error", e);
  }
}

// NOTE:
// We don't call initSymbolsToolbarDefaultIcon() here because the symbol icon
// constants are defined further down in the file. The actual init + load
// listener are wired after SYMBOL_ICON_DARK / SYMBOL_ICON_BLUE are declared.
// initSymbolsToolbarDefaultIcon();
// window.addEventListener("load", initSymbolsToolbarDefaultIcon);


  
  // Highlight the active tool button and swap icons based on data attributes
function updateToolButtonActiveState(activeToolName) {
  try {
    const buttons = document.querySelectorAll(".tool-button[data-tool]");

    buttons.forEach((btn) => {
      const toolName = btn.getAttribute("data-tool");
      const isActive = !!activeToolName && toolName === activeToolName;

      // Toggle active class
      btn.classList.toggle("is-active", isActive);

      // Swap icon if this button has icon data
      const img = btn.querySelector("img");
      if (!img) return;

      const defaultSrc = img.getAttribute("data-icon-default");
      const activeSrc =
        img.getAttribute("data-icon-active") || defaultSrc;

      if (defaultSrc) {
        img.src = isActive ? (activeSrc || defaultSrc) : defaultSrc;
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("updateToolButtonActiveState error", err);
  }
}

// Expose so the preview HTML script can also force a refresh after fly-out changes
window.__TIXALL_UPDATE_TOOL_BUTTON_STATE__ = updateToolButtonActiveState;

  function getSeatCountElement() {
    if (!seatCountEl) seatCountEl = document.getElementById("sb-seat-count");
    return seatCountEl;
  }

    function getInspectorElement() {
    if (!inspectorEl) {
      inspectorEl = document.getElementById("sb-inspector");
    }
    return inspectorEl;
  }


  // ---------- Helpers: UI / tools ----------

            // ---------- Helpers: UI / tools ----------

    // Tools that place seats / tables onto the map
  function isPlacementTool(toolName) {
    if (!toolName) return false;
    const t = String(toolName);
    return (
      t === "row-seats" ||
      t === "single-seat" ||
      t === "circular-table" ||
      t === "rect-table"
    );
  }

  // Check if a group (row/table) has any assignments that should lock its geometry
// Check if a group (row/table) has any assignments that should lock its geometry
function isNodeLocked(node) {
  if (!node) return false;
  // Find all seat circles within this group
  const seats = node.find ? node.find("Circle").filter(n => n.getAttr("isSeat")) : [];

  for (const seat of seats) {
    // Check Tickets (Legacy & Multi)
    if (seat.getAttr("sbTicketId")) return true;
    const tIds = seat.getAttr("sbTicketIds");
    if (Array.isArray(tIds) && tIds.length > 0) return true;

    // Check Holds / Allocations
    if (seat.getAttr("sbHoldStatus")) return true;

    // Check View / Info
    if (seat.getAttr("sbViewImage") || seat.getAttr("sbInfoLabel")) return true;
  }
  return false;
}

  // Background shapes: anything structural / decorative that seats/tables sit on top of
  function isBackgroundShapeType(shapeType) {
    return (
      shapeType === "section" ||
      shapeType === "square" ||
      shapeType === "circle" ||
      shapeType === "stage" ||
      shapeType === "bar" ||
      shapeType === "exit" ||
      shapeType === "multi-shape" ||
      shapeType === "arc" ||
      shapeType === "line" ||
      shapeType === "curve-line" ||
      shapeType === "stairs" ||
      shapeType === "symbol" ||
      shapeType === "text" ||
      shapeType === "label"
    );
  }

  // When a placement tool is active, temporarily let clicks "pass through" background shapes
  // so we can place rows / tables / single seats *inside* them.
  function updateShapeInteractionForPlacementTool() {
    if (!mapLayer) return;

    const placing = isPlacementTool(activeTool);

    mapLayer.find("Group").forEach((g) => {
      const shapeType = g.getAttr("shapeType") || g.name() || "";

      // Never interfere with seat/table groups themselves
      if (
        shapeType === "row-seats" ||
        shapeType === "single-seat" ||
        shapeType === "circular-table" ||
        shapeType === "rect-table"
      ) {
        return;
      }

      if (!isBackgroundShapeType(shapeType)) return;

      if (placing) {
        // Save original listening state once
        if (!g.getAttr("__sbHadListeningBackup")) {
          g.setAttr("__sbHadListeningBackup", true);
          g.setAttr("__sbPrevListening", g.listening());
        }
        // Disable hit-testing so the stage/mapLayer click handler receives the event
        g.listening(false);
      } else {
        // Restore listening when we leave placement tools
        if (g.getAttr("__sbHadListeningBackup")) {
          const prev = g.getAttr("__sbPrevListening");
          g.listening(typeof prev === "boolean" ? prev : true);
          g.setAttr("__sbHadListeningBackup", false);
        }
      }
    });

    mapLayer.batchDraw();
  }

  
   function setActiveTool(tool, opts = {}) {
  // Normalise any alias tool names from the UI so they map onto
  // the real internal tools that the canvas click handler understands.
  if (typeof tool === "string") {
    const t = tool.toLowerCase();

    // 🔁 Any "multi" style tool in the UI should now be the MOLLE shape tool,
    // NOT a seat row block. This means clicking the map with Multi selected
    // will drop a multi-shape (polygon / rhombus / parallelogram) that you
    // can then customise in the inspector.
    if (
      t === "multi" ||
      t === "multi-tool" ||
      t === "multi-seat" ||          // legacy aliases – kept for safety
      t === "multi-block" ||
      t === "multi-seat-block" ||
      t === "multirows"
    ) {
      tool = "multi-shape";
    }
  }

  const forceClear = !!(opts && opts.force);

  // If we are leaving a line tool and something is mid-draw, finish it
  if (
    (activeTool === "line" || activeTool === "curve-line") &&
    tool !== activeTool &&
    currentLineGroup
  ) {
    if (currentLineToolType === "line") {
      const commit = currentLinePoints && currentLinePoints.length >= 4;
      finishCurrentLine(commit);
    } else if (currentLineToolType === "curve-line") {
      const commit = curveRawPoints && curveRawPoints.length >= 4;
      finishCurveLine(commit);
    }
  }

  // If we are leaving the stairs tool with a draft, cancel it
  if (activeTool === "stairs" && tool !== "stairs" && stairsDraft) {
    finishStairsDrawing(false);
  }

  // Soft clears (setActiveTool(null) with no force flag) are ignored so tools
  // stay "sticky" and allow multi-placement after each click on the canvas.
  if (tool === null && !forceClear) {
    // no-op: keep current activeTool
  } else if (activeTool === tool) {
    // Toggling the same tool off
    if (
      tool === "line" &&
      currentLineGroup &&
      currentLineToolType === "line"
    ) {
      finishCurrentLine(true);
    } else if (
      tool === "curve-line" &&
      currentLineGroup &&
      currentLineToolType === "curve-line"
    ) {
      finishCurveLine(true);
    } else if (tool === "stairs" && stairsDraft) {
      finishStairsDrawing(true);
    }
    activeTool = null;
  } else {
    activeTool = tool;
  }

  // When switching to a placement tool, automatically clear any current selection
  if (
    activeTool &&
    activeTool !== "line" &&
    activeTool !== "curve-line" &&
    activeTool !== "arrow" &&
    activeTool !== "stairs"
  ) {
    clearSelection();
  }

   if (!mapLayer || !mapLayer.getStage()) return;

  const stageRef = mapLayer.getStage();
  if (!activeTool) {
    stageRef.container().style.cursor = "grab";
  } else {
    stageRef.container().style.cursor = "crosshair";
  }

  // 👇 NEW: while placing seats / tables, let clicks pass through shapes
  updateShapeInteractionForPlacementTool();

  // 🔵 Sync left-hand button highlight + icon swap
  updateToolButtonActiveState(activeTool);
}



  function countAssignmentsForTicket(ticketId) {
    if (!ticketId) return 0;

    let count = 0;
    ticketAssignments.forEach((value) => {
      if (!value) return;

      if (value instanceof Set) {
        if (value.has(ticketId)) count += 1;
      } else if (Array.isArray(value)) {
        if (value.includes(ticketId)) count += 1;
      } else if (value === ticketId) {
        // Backwards compatibility if any legacy single-string slips through
        count += 1;
      }
    });
    return count;
  }






  function updateSeatCount() {
    if (!mapLayer || !mapLayer.find) return;

    const circles = mapLayer.find("Circle");
    let seats = 0;

    circles.forEach((node) => {
      if (node && node.getAttr("isSeat")) seats += 1;
    });

    const el = getSeatCountElement();
    if (el) el.textContent = seats === 1 ? "1 seat" : `${seats} seats`;
  }

 // [Source: 616] - Updated to draw "Infinite" Grid based on visibility
function drawSquareGrid() {
  if (!gridLayer || !stage) return;
  gridLayer.destroyChildren();

  // 1. Get Viewport Info (Physical Container Dimensions)
  const w = baseStageWidth; 
  const h = baseStageHeight;

  // 2. Get Transform Info
  const scale = stage.scaleX() || 1;
  const stageX = stage.x();
  const stageY = stage.y();

  // 3. Calculate Visible "World" Bounds (Inverse Transform)
  //    Screen (0,0)  mapped to World: -stageX / scale
  //    Screen (w,h)  mapped to World: (w - stageX) / scale
  const startX = -stageX / scale;
  const startY = -stageY / scale;
  const endX = (w - stageX) / scale;
  const endY = (h - stageY) / scale;

  // 4. Add a Buffer (Draw extra grid around edges so panning feels smooth)
  //    We add 1 full screen width/height as buffer
  const bufferX = (w / scale);
  const bufferY = (h / scale);

  const gridMinX = Math.floor((startX - bufferX) / GRID_SIZE) * GRID_SIZE;
  const gridMaxX = Math.ceil((endX + bufferX) / GRID_SIZE) * GRID_SIZE;
  const gridMinY = Math.floor((startY - bufferY) / GRID_SIZE) * GRID_SIZE;
  const gridMaxY = Math.ceil((endY + bufferY) / GRID_SIZE) * GRID_SIZE;

  // 5. Draw Vertical Lines
  for (let x = gridMinX; x <= gridMaxX; x += GRID_SIZE) {
    gridLayer.add(new Konva.Line({
      points: [x, gridMinY, x, gridMaxY],
      stroke: "rgba(148,163,184,0.25)",
      strokeWidth: x % (GRID_SIZE * 4) === 0 ? 1.1 : 0.6,
      listening: false // Optimization: ignore clicks on grid
    }));
  }

  // 6. Draw Horizontal Lines
  for (let y = gridMinY; y <= gridMaxY; y += GRID_SIZE) {
    gridLayer.add(new Konva.Line({
      points: [gridMinX, y, gridMaxX, y],
      stroke: "rgba(148,163,184,0.25)",
      strokeWidth: y % (GRID_SIZE * 4) === 0 ? 1.1 : 0.6,
      listening: false
    }));
  }

  gridLayer.batchDraw();
}
function resizeStageToContainer() {
  if (!stage) return;
  const width = container.clientWidth - STAGE_PADDING * 2;
  const height = container.clientHeight - STAGE_PADDING * 2;
  
  // Store the true physical dimensions
  baseStageWidth = width;
  baseStageHeight = height;

  // FIX: Set stage size to full container size. Do NOT divide by scale.
  stage.width(baseStageWidth);
  stage.height(baseStageHeight);

  drawSquareGrid();
}
  
  // ---------- History ----------

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");

    if (undoBtn) {
      undoBtn.disabled = historyIndex <= 0;
      undoBtn.style.opacity = historyIndex <= 0 ? 0.4 : 1;
    }
    if (redoBtn) {
      redoBtn.disabled = historyIndex >= history.length - 1;
      redoBtn.style.opacity = historyIndex >= history.length - 1 ? 0.4 : 1;
    }
  }

  function pushHistory() {
    if (isRestoringHistory || !mapLayer) return;

    const json = mapLayer.toJSON();

    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }

    history.push(json);
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
  }

function restoreHistory(toIndex) {
  if (toIndex < 0 || toIndex >= history.length) return;
  isRestoringHistory = true;
  historyIndex = toIndex;
  const json = history[historyIndex];
  const newLayer = Konva.Node.create(json);
  mapLayer.destroy();
  mapLayer = newLayer;
  mapLayer.position({ x: 0, y: 0 });
  mapLayer.scale({ x: 1, y: 1 });
  stage.add(mapLayer);
  
  // Re-attach standard behaviours (drag, hover)
  mapLayer.getChildren().forEach((node) => {
    attachNodeBehaviour(node);
  });

  // --- NEW: Re-attach Ticket Assignment Listeners if mode is active ---
  if (ticketSeatSelectionMode) {
    refreshSeatTicketListeners();
    rebuildTicketAssignmentsCache(); // Ensure our ID map matches the visual state
    renderTicketingPanel(); // Update the counts in the sidebar
  }

  mapLayer.draw();
  updateSeatCount();
  updateUndoRedoButtons();
  clearSelection();
  isRestoringHistory = false;
}

      function undo() {
    // While actively drawing a straight line, undo removes the last segment.
    if (
      currentLineToolType === "line" &&
      activeTool === "line" &&
      currentLineGroup &&
      currentLine &&
      currentLinePoints &&
      currentLinePoints.length >= 4
    ) {
      if (currentLinePoints.length > 4) {
        const removed = currentLinePoints.splice(
          currentLinePoints.length - 4,
          4
        );
        currentLineUndoStack.push(removed);

        const lx = currentLinePoints[currentLinePoints.length - 2];
        const ly = currentLinePoints[currentLinePoints.length - 1];
        currentLinePoints.push(lx, ly);

        currentLine.points(currentLinePoints);
        if (mapLayer) mapLayer.batchDraw();
      } else {
        currentLineGroup.destroy();
        currentLineGroup = null;
        currentLine = null;
        currentLinePoints = [];
        currentLineToolType = null;
        currentLineUndoStack = [];
        if (mapLayer) mapLayer.batchDraw();
      }
      return;
    }

    // Normal undo for everything else
    if (historyIndex <= 0) return;
    restoreHistory(historyIndex - 1);
    currentLineUndoStack = [];
  }


    function redo() {
    // Redo last removed segment while drawing a straight line
    if (
      currentLineToolType === "line" &&
      activeTool === "line" &&
      currentLineGroup &&
      currentLine &&
      currentLinePoints &&
      currentLineUndoStack.length > 0
    ) {
      const removed = currentLineUndoStack.pop();
      if (removed && removed.length === 4) {
        const vx = removed[0];
        const vy = removed[1];

        const pts = currentLinePoints;
        if (pts.length >= 2) {
          pts[pts.length - 2] = vx;
          pts[pts.length - 1] = vy;
          pts.push(vx, vy);
          currentLinePoints = pts;
          currentLine.points(currentLinePoints);
          if (mapLayer) mapLayer.batchDraw();
        }
      }
      return;
    }

    // Normal redo for layout history
    if (historyIndex >= history.length - 1) return;
    restoreHistory(historyIndex + 1);
  }



  // ---------- Line tool helpers (multi-point line) ----------

      function finishCurrentLine(commit) {
    if (!currentLineGroup) return;

    if (!commit || currentLinePoints.length < 4) {
      // Not enough points or cancelled – just remove
      currentLineGroup.destroy();
        } else {
      // Trim the trailing placeholder point and finalise geometry
      if (currentLinePoints.length >= 4) {
        currentLinePoints.splice(currentLinePoints.length - 2, 2);
        if (currentLine) currentLine.points(currentLinePoints);
      }
      ensureHitRect(currentLineGroup);
      buildLineHandles(currentLineGroup);
      updateLineFillShape(currentLineGroup);
      // Auto-select the finished line so you can edit it immediately
      selectNode(currentLineGroup);
    }


    currentLineGroup = null;
    currentLine = null;
    currentLinePoints = [];
    currentLineToolType = null;
    currentLineUndoStack = [];

    if (mapLayer) {
      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
    }
  }

    // ----- Curve-line freehand helpers -----

  function smoothCurvePoints(rawPoints, tolerance) {
    if (!rawPoints || rawPoints.length <= 4) {
      return rawPoints ? rawPoints.slice() : [];
    }

    const pts = [];
    for (let i = 0; i < rawPoints.length; i += 2) {
      pts.push({ x: rawPoints[i], y: rawPoints[i + 1] });
    }

    const tol = Number.isFinite(tolerance) ? tolerance : 4;
    const sqTol = tol * tol;

    function sqSegDist(p, p1, p2) {
      let x = p1.x;
      let y = p1.y;
      let dx = p2.x - x;
      let dy = p2.y - y;

      if (dx !== 0 || dy !== 0) {
        const t =
          ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          x = p2.x;
          y = p2.y;
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }

      dx = p.x - x;
      dy = p.y - y;
      return dx * dx + dy * dy;
    }

    function simplifySegment(points, first, last, sqTol, simplified) {
      let index = -1;
      let maxSqDist = sqTol;

      for (let i = first + 1; i < last; i += 1) {
        const sqDist = sqSegDist(points[i], points[first], points[last]);
        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }

      if (index !== -1) {
        if (index - first > 1) {
          simplifySegment(points, first, index, sqTol, simplified);
        }
        simplified.push(points[index]);
        if (last - index > 1) {
          simplifySegment(points, index, last, sqTol, simplified);
        }
      }
    }

    const simplified = [pts[0]];
    simplifySegment(pts, 0, pts.length - 1, sqTol, simplified);
    simplified.push(pts[pts.length - 1]);

    const out = [];
    simplified.forEach((p) => {
      out.push(p.x, p.y);
    });
    return out;
  }

  function startCurveLine(pointerPos) {
    if (!stage || !mapLayer) return;

    const x = pointerPos.x;
    const y = pointerPos.y;

    // If something else was mid-draw, drop it
    if (currentLineGroup) {
      currentLineGroup.destroy();
      currentLineGroup = null;
      currentLine = null;
      currentLinePoints = [];
    }

    isCurveDrawing = true;
    currentLineToolType = "curve-line";
    curveRawPoints = [x, y];

        currentLineGroup = new Konva.Group({
      x: 0,
      y: 0,
      draggable: true,
      name: "curve-line",
      shapeType: "curve-line",
    });

    // Default fill settings for curve-lines
    currentLineGroup.setAttr("lineFillEnabled", false);
    currentLineGroup.setAttr("lineFillColor", "#e5e7eb");

    currentLine = new Konva.Line({
      points: curveRawPoints.slice(),
      stroke: "#111827",
      strokeWidth: 2,
      lineCap: "round",
      lineJoin: "round",
      tension: 0.5,
    });


    currentLineGroup.add(currentLine);
    ensureHitRect(currentLineGroup);
    mapLayer.add(currentLineGroup);
    attachNodeBehaviour(currentLineGroup);
  }

  function updateCurveLine(pointerPos) {
    if (!isCurveDrawing || !currentLine) return;

    const x = pointerPos.x;
    const y = pointerPos.y;

    const lastX = curveRawPoints[curveRawPoints.length - 2];
    const lastY = curveRawPoints[curveRawPoints.length - 1];
    const dx = x - lastX;
    const dy = y - lastY;
        const distSq = dx * dx + dy * dy;

    // Only add a new point if we've moved at least ~6px
    // (fewer points → smoother curve + fewer edit handles)
    if (distSq < 36) return;


    curveRawPoints.push(x, y);
    currentLine.points(curveRawPoints);
    mapLayer && mapLayer.batchDraw();
  }

  function finishCurveLine(commit) {
    if (!currentLineGroup) return;

    const hasEnoughPoints = curveRawPoints && curveRawPoints.length >= 4;
    isCurveDrawing = false;

       if (!commit || !hasEnoughPoints) {
      currentLineGroup.destroy();
    } else {
      // Higher tolerance → fewer points → smoother big curves
      const smoothed = smoothCurvePoints(curveRawPoints, 10);
      currentLinePoints = smoothed.slice();

      if (currentLine) {
        currentLine.points(currentLinePoints);
        currentLine.tension(0.6); // slightly more curve
      }

      ensureHitRect(currentLineGroup);
      buildLineHandles(currentLineGroup);
      updateLineFillShape(currentLineGroup);
      selectNode(currentLineGroup);
    }


    currentLineGroup = null;
    currentLine = null;
    curveRawPoints = [];
    currentLineToolType = null;
    currentLineUndoStack = [];

    if (mapLayer) {
      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
    }
  }


  function handleLineClick(pointerPos, toolType) {
    if (!stage || !mapLayer) return;
    const x = snap(pointerPos.x);
    const y = snap(pointerPos.y);

        // First click: create a new group + line
    if (!currentLineGroup) {
      // New line = fresh undo stack for segments
      currentLineUndoStack = [];

      const shapeType =
        toolType === "curve-line" ? "curve-line" : "line";


            currentLineGroup = new Konva.Group({
        x: 0,
        y: 0,
        draggable: true,
        name: shapeType,
        shapeType,
      });

      // Default fill settings – off by default, user can enable in inspector
      currentLineGroup.setAttr("lineFillEnabled", false);
      currentLineGroup.setAttr("lineFillColor", "#e5e7eb");

      currentLineToolType = shapeType;


      currentLine = new Konva.Line({
        points: [x, y, x, y], // placeholder second point
        stroke: "#111827",
        strokeWidth: 2,
        lineCap: "round",
        lineJoin: "round",
        // tension > 0 makes it a smooth curve
        tension: shapeType === "curve-line" ? 0.5 : 0,
      });

      currentLineGroup.add(currentLine);
      ensureHitRect(currentLineGroup);
      mapLayer.add(currentLineGroup);
      attachNodeBehaviour(currentLineGroup);

      currentLinePoints = [x, y, x, y];
    } else {
      // Subsequent clicks: update last point and add a new placeholder
      currentLinePoints[currentLinePoints.length - 2] = x;
      currentLinePoints[currentLinePoints.length - 1] = y;
      currentLinePoints.push(x, y);

      if (currentLine) currentLine.points(currentLinePoints);
    }

    mapLayer.batchDraw();
  }

    // ---------- Arrow tool helpers (2-point arrow) ----------

  function handleArrowClick(pointerPos) {
    if (!stage || !mapLayer) return;
    const x = snap(pointerPos.x);
    const y = snap(pointerPos.y);

    // First click: create arrow group + arrow shape
    if (!arrowDrawingGroup) {
      arrowStartPoint = { x, y };

      arrowDrawingGroup = new Konva.Group({
        x: 0,
        y: 0,
        draggable: true,
        name: "arrow",
        shapeType: "arrow",
      });

      arrowShape = new Konva.Arrow({
        points: [x, y, x, y], // start & temporary end
        stroke: "#111827",
        strokeWidth: 2,
        fill: "#111827",
        lineCap: "round",
        lineJoin: "round",
        pointerLength: 14,
        pointerWidth: 14,
        pointerAtBeginning: false,
      });

      arrowDrawingGroup.add(arrowShape);
      ensureHitRect(arrowDrawingGroup);
      mapLayer.add(arrowDrawingGroup);
      attachNodeBehaviour(arrowDrawingGroup);

      mapLayer.batchDraw();
      return;
    }

    // Second click: set end point, add handles, finish
    if (arrowShape && arrowStartPoint) {
      arrowShape.points([
        arrowStartPoint.x,
        arrowStartPoint.y,
        x,
        y,
      ]);
      ensureHitRect(arrowDrawingGroup);
      buildArrowHandles(arrowDrawingGroup);
      selectNode(arrowDrawingGroup);
      mapLayer.batchDraw();
      pushHistory();
    }

    arrowDrawingGroup = null;
    arrowShape = null;
    arrowStartPoint = null;
  }


  function snap(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

  // Normalise angles so they always stay between 0° and 360°
  function normaliseAngle(deg) {
    let a = Number(deg);
    if (!Number.isFinite(a)) a = 0;
    a = a % 360;
    if (a < 0) a += 360;
    return a;
  }

    // ---------- Stairs drawing helpers (click + drag) ----------

  function startStairsDrawing(pointerPos) {
    if (!mapLayer) return;

    stairsStartPos = { x: pointerPos.x, y: pointerPos.y };

    stairsDraft = new Konva.Group({
      x: pointerPos.x,
      y: pointerPos.y,
      draggable: false,   // become draggable once committed
      name: "stairs",
      shapeType: "stairs",
    });

    // Initial defaults – will be updated as we drag
    stairsDraft.setAttr("stairsLength", GRID_SIZE * 4);
    stairsDraft.setAttr("stairsWidth", GRID_SIZE * 1.5);
    stairsDraft.setAttr("stairsStepCount", 8);
    stairsDraft.setAttr("stairsStrokeColor", "#111827");
    stairsDraft.setAttr("stairsStrokeWidth", 1.7);

    updateStairsGeometry(stairsDraft);
    stairsDraft.visible(false); // stay hidden until we have some length

    mapLayer.add(stairsDraft);
    mapLayer.batchDraw();
  }

  function updateStairsDrawing(pointerPos) {
    if (!stairsDraft || !stairsStartPos) return;

    const dx = pointerPos.x - stairsStartPos.x;
    const dy = pointerPos.y - stairsStartPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (!Number.isFinite(length) || length < 4) {
      stairsDraft.visible(false);
      mapLayer && mapLayer.batchDraw();
      return;
    }

    stairsDraft.visible(true);

    // Use existing step count if present, otherwise derive a sensible default
    let steps = Number(stairsDraft.getAttr("stairsStepCount"));
    if (!Number.isFinite(steps) || steps < 2) {
      steps = Math.max(3, Math.round(length / (GRID_SIZE * 0.75)));
    }

    stairsDraft.setAttr("stairsLength", length);
    stairsDraft.setAttr("stairsStepCount", steps);

    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;
    stairsDraft.rotation(angleDeg);

    updateStairsGeometry(stairsDraft);
    mapLayer && mapLayer.batchDraw();
  }

  function finishStairsDrawing(commit) {
    if (!stairsDraft) return;

    const length = Number(stairsDraft.getAttr("stairsLength")) || 0;

    if (!commit || length < GRID_SIZE) {
      stairsDraft.destroy();
    } else {
      stairsDraft.visible(true);
      stairsDraft.draggable(true);
      ensureHitRect(stairsDraft);
      attachNodeBehaviour(stairsDraft);
      selectNode(stairsDraft);
      updateSeatCount();
      pushHistory();
    }

    stairsDraft = null;
    stairsStartPos = null;

    if (mapLayer) mapLayer.batchDraw();
  }


   // ---------- Hit-rect + editable line handles ----------

  function ensureHitRect(group) {
    if (!(group instanceof Konva.Group)) return;

    const existing = group.findOne(".hit-rect");
    if (existing) existing.destroy();

    let bounds;
    try {
      bounds = group.getClientRect({ relativeTo: group });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("ensureHitRect: error in getClientRect", err);
      return;
    }

    if (
      !bounds ||
      !Number.isFinite(bounds.x) ||
      !Number.isFinite(bounds.y) ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height)
    ) {
      // eslint-disable-next-line no-console
      console.error("ensureHitRect: invalid client rect", bounds);
      return;
    }

    const padding = GRID_SIZE * 0.4;

    const hitRect = new Konva.Rect({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      fill: "rgba(0,0,0,0)",
      listening: true,
      name: "hit-rect",
    });

    group.add(hitRect);
    hitRect.moveToBottom();
  }

  // ----- Editable line handles (for line + curved line) -----

  function buildLineHandles(group) {
    if (!(group instanceof Konva.Group)) return;

    const shapeType = group.getAttr("shapeType") || group.name();
    if (shapeType !== "line" && shapeType !== "curve-line") return;

    const line = group.findOne((n) => n instanceof Konva.Line);
    if (!line) return;

    // Remove any existing handles
    group
      .find((n) => n.getAttr && n.getAttr("isLineHandle"))
      .forEach((h) => h.destroy());

    const pts = line.points() || [];
    for (let i = 0; i < pts.length; i += 2) {
      const hx = pts[i];
      const hy = pts[i + 1];

      const handle = new Konva.Circle({
        x: hx,
        y: hy,
        radius: 6,
        fill: "#ffffff",
        stroke: "#2563eb",
        strokeWidth: 1.5,
        draggable: true,
        name: "line-handle",
      });

      handle.setAttr("isLineHandle", true);
      handle.setAttr("pointIndex", i);

           handle.on("dragmove", () => {
        const p = line.points().slice();
        const idx = handle.getAttr("pointIndex");
        if (!Number.isFinite(idx)) return;

        p[idx] = handle.x();
        p[idx + 1] = handle.y();

        line.points(p);
        updateLineFillShape(group);
        ensureHitRect(group);
        mapLayer && mapLayer.batchDraw();
      });


         handle.on("dragend", () => {
        updateLineFillShape(group);
        ensureHitRect(group);
        mapLayer && mapLayer.batchDraw();
        pushHistory();
      });


      group.add(handle);
    }

    showLineHandles(group, true);
    group.draw();
  }

    // --- Fill helper for line + curve-line groups ---
  function updateLineFillShape(group) {
    if (!(group instanceof Konva.Group)) return;

    const shapeType = group.getAttr("shapeType") || group.name();
    if (shapeType !== "line" && shapeType !== "curve-line") return;

    // Remove any existing fill shape first
    group
      .find((n) => n.getAttr && n.getAttr("isLineFill"))
      .forEach((n) => n.destroy());

    const fillEnabled = !!group.getAttr("lineFillEnabled");
    const fillColor =
      group.getAttr("lineFillColor") || "#e5e7eb";

    if (!fillEnabled) {
      // No fill requested – nothing else to do
      return;
    }

    // Find the main line for this group (ignore any fill shapes)
    const mainLine = group.findOne((n) => {
      return (
        n instanceof Konva.Line &&
        !n.getAttr("isLineFill")
      );
    });

    if (!mainLine) return;

    const pts = mainLine.points() || [];
    if (!pts || pts.length < 4) return;

    // Closed polygon for the fill; stroke is disabled so the first–last edge
    // is invisible but the interior is filled.
    const fillShape = new Konva.Line({
      points: pts.slice(),
      closed: true,
      fill: fillColor,
      stroke: "rgba(0,0,0,0)",
      strokeWidth: 0,
      listening: false,
      name: "line-fill",
    });

    fillShape.setAttr("isLineFill", true);

    group.add(fillShape);

    // Make sure hit-rect remains right at the bottom for selection
    ensureHitRect(group);
  }


  function showLineHandles(group, visible) {
    if (!(group instanceof Konva.Group)) return;

    group
      .find((n) => n.getAttr && n.getAttr("isLineHandle"))
      .forEach((h) => {
        h.visible(!!visible);
      });
  }

    // ----- Editable arrow handles (start & end) -----

  function buildArrowHandles(group) {
    if (!(group instanceof Konva.Group)) return;

    const shapeType = group.getAttr("shapeType") || group.name();
    if (shapeType !== "arrow") return;

    const arrow = group.findOne((n) => n instanceof Konva.Arrow);
    if (!arrow) return;

    // Remove any existing arrow handles
    group
      .find((n) => n.getAttr && n.getAttr("isArrowHandle"))
      .forEach((h) => h.destroy());

    const pts = arrow.points() || [];
    if (!pts || pts.length < 4) return;

    const [x1, y1, x2, y2] = pts;

    function createHandle(hx, hy, endpointIndex) {
      const handle = new Konva.Circle({
        x: hx,
        y: hy,
        radius: 6,
        fill: "#ffffff",
        stroke: "#2563eb",
        strokeWidth: 1.5,
        draggable: true,
        name: "arrow-handle",
      });

      handle.setAttr("isArrowHandle", true);
      // 0 = start (points[0,1]), 1 = end (points[2,3])
      handle.setAttr("endpointIndex", endpointIndex);

      handle.on("dragmove", () => {
        const p = arrow.points().slice();
        const idx = handle.getAttr("endpointIndex");
        if (idx === 0) {
          p[0] = handle.x();
          p[1] = handle.y();
        } else if (idx === 1) {
          p[2] = handle.x();
          p[3] = handle.y();
        }
        arrow.points(p);
        ensureHitRect(group);
        mapLayer && mapLayer.batchDraw();
      });

      handle.on("dragend", () => {
        ensureHitRect(group);
        mapLayer && mapLayer.batchDraw();
        pushHistory();
      });

      group.add(handle);
    }

    createHandle(x1, y1, 0);
    createHandle(x2, y2, 1);

    showArrowHandles(group, true);
    group.draw();
  }

  function showArrowHandles(group, visible) {
    if (!(group instanceof Konva.Group)) return;

    group
      .find((n) => n.getAttr && n.getAttr("isArrowHandle"))
      .forEach((h) => {
        h.visible(!!visible);
      });
  }

  function getBodyRect(node) {
    if (!(node instanceof Konva.Group)) return null;
    const rect = node.findOne(".body-rect");
    if (rect) return rect;
    const rects = node.find("Rect");
    for (let i = 0; i < rects.length; i += 1) {
      if (rects[i].name() !== "hit-rect") return rects[i];
    }
    return null;
  }

  function makeSeatLabelText(text, x, y) {
    const label = new Konva.Text({
      x,
      y,
      text,
      fontSize: 11,
      fontFamily: "system-ui",
      fontStyle: "bold",
      fill: "#111827",
      align: "center",
      verticalAlign: "middle",
      listening: false,
      isSeatLabel: true,
    });

    label.offsetX(label.width() / 2);
    label.offsetY(label.height() / 2);
    return label;
  }

  // Excel-style row labels
  function rowLabelFromIndex(index) {
    let n = Math.max(0, Math.floor(index));
    let label = "";
    while (n >= 0) {
      label = String.fromCharCode((n % 26) + 65) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  }

  function rowIndexFromLabel(label) {
    if (!label) return 0;
    const s = String(label).toUpperCase().replace(/[^A-Z]/g, "");
    if (!s) return 0;
    let n = 0;
    for (let i = 0; i < s.length; i += 1) {
      n = n * 26 + (s.charCodeAt(i) - 64);
    }
    return Math.max(0, n - 1);
  }

  function seatLabelFromIndex(mode, index, start) {
    const base = Number.isFinite(start) ? start : 1;
    const n = base + index;

    if (mode === "letters") {
      return rowLabelFromIndex(n - 1);
    }
    return String(n);
  }

  // Inline text editing
    // Inline text editing
  function beginInlineTextEdit(textNode, onCommit) {
    if (!stage || !textNode) return;

    const oldText = textNode.text();

    const textPos = textNode.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const areaPosition = {
      x: stageBox.left + textPos.x - textNode.width() / 2,
      y: stageBox.top + textPos.y - textNode.height() / 2,
    };

    const input = document.createElement("input");
    input.type = "text";
    input.value = oldText;
    input.style.position = "absolute";
    input.style.left = `${areaPosition.x}px`;
    input.style.top = `${areaPosition.y}px`;
    input.style.zIndex = "9999";
    input.style.borderRadius = "8px";
    input.style.border = "1px solid #2563eb";
    input.style.padding = "4px 8px";
    input.style.fontSize = "13px";
    input.style.fontFamily =
      '-apple-system,BlinkMacSystemFont,"system-ui","Segoe UI",sans-serif';
    input.style.boxShadow = "0 8px 24px rgba(15,23,42,0.18)";
    input.style.background = "#ffffff";
    input.style.color = "#111827";
    input.style.outline = "none";
    input.style.minWidth = "50px";

    document.body.appendChild(input);
    input.focus();
    input.select();

    function finish(commit) {
      if (!input.parentNode) return;
      const newVal = commit ? input.value : oldText;
      onCommit(newVal);
      document.body.removeChild(input);
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener("blur", () => finish(true));
  }

     // ----- Seat kind helpers: standard / accessible / carer -----

  function applySeatKindVisualToCircle(circle) {
    if (!circle || typeof circle.getAttr !== "function") return;
    if (!circle.getAttr("isSeat")) return;

    const kind = circle.getAttr("sbSeatKind") || "standard";

    // Base styles captured on creation
    const baseFill = circle.getAttr("sbSeatBaseFill") || "#ffffff";
    const baseStroke = circle.getAttr("sbSeatBaseStroke") || "#4b5563";
    const baseStrokeWidth =
      Number(circle.getAttr("sbSeatBaseStrokeWidth")) || 1.7;

    if (kind === "accessible") {
      circle.fill("#dbeafe");          // light blue
      circle.stroke("#1d4ed8");
      circle.strokeWidth(2);
    } else if (kind === "carer") {
      circle.fill("#dcfce7");          // light green
      circle.stroke("#16a34a");
      circle.strokeWidth(2);
    } else {
      // standard
      circle.fill(baseFill);
      circle.stroke(baseStroke);
      circle.strokeWidth(baseStrokeWidth);
    }
  }

  function cycleSeatKind(circle) {
    if (!circle || typeof circle.getAttr !== "function") return;

    const current = circle.getAttr("sbSeatKind") || "standard";
    let next;
    if (current === "standard") next = "accessible";
    else if (current === "accessible") next = "carer";
    else next = "standard";

    circle.setAttr("sbSeatKind", next);
    applySeatKindVisualToCircle(circle);
  }

    // Helper: wire up seat behaviour (double-click to cycle through types)
  function attachSeatCircleBehaviour(circle) {
    if (!circle || typeof circle.on !== "function") return;
    if (!circle.getAttr("isSeat")) return;

    circle.on("dblclick", (evt) => {
      // Don't also trigger group double-clicks
      evt.cancelBubble = true;
      cycleSeatKind(circle);
      if (mapLayer) mapLayer.batchDraw();
      pushHistory();
    });
  }

     // ---------- Shape factories ----------

  // Shared styling for basic shapes (section / square / circle)
  function applyBasicShapeStyle(node) {
    if (!(node instanceof Konva.Group)) return;

    const shapeType = node.getAttr("shapeType") || node.name();
    if (
      shapeType !== "section" &&
      shapeType !== "square" &&
      shapeType !== "circle" &&
      shapeType !== "multi-shape"
    ) {
      return;
    }

    const body = getBodyRect(node);
    if (!body) return;

    // --- Fill enabled ---
    let fillEnabled = node.getAttr("shapeFillEnabled");
    if (fillEnabled === undefined || fillEnabled === null) {
      fillEnabled = true;
    }
    fillEnabled = !!fillEnabled;

    // --- Fill colour ---
    let fillColor = node.getAttr("shapeFillColor");
    if (!fillColor) {
      fillColor = body.fill() || "#ffffff";
    }

    // --- Stroke colour / width ---
    let strokeColor =
      node.getAttr("shapeStrokeColor") || body.stroke() || "#4b5563";

    let strokeWidth = node.getAttr("shapeStrokeWidth");
    if (!Number.isFinite(Number(strokeWidth))) {
      strokeWidth = body.strokeWidth() || 1.7;
    }
    strokeWidth = Number(strokeWidth);

    // --- Stroke style (solid / dashed / dotted) ---
    let strokeStyle = node.getAttr("shapeStrokeStyle");
    if (
      strokeStyle !== "solid" &&
      strokeStyle !== "dashed" &&
      strokeStyle !== "dotted"
    ) {
      strokeStyle = "solid";
    }
    node.setAttr("shapeStrokeStyle", strokeStyle);

    // Persist back on the group
    node.setAttr("shapeFillEnabled", fillEnabled);
    node.setAttr("shapeFillColor", fillColor);
    node.setAttr("shapeStrokeColor", strokeColor);
    node.setAttr("shapeStrokeWidth", strokeWidth);

    // Apply to the body shape
    if (fillEnabled) {
      body.fill(fillColor || "#ffffff");
    } else {
      body.fill("rgba(0,0,0,0)");
    }

    body.stroke(strokeColor);
    body.strokeWidth(strokeWidth);

    // Dash pattern
    if (strokeStyle === "dashed") {
      body.dash([10, 4]); // longer dash, short gap
    } else if (strokeStyle === "dotted") {
      body.dash([2, 4]); // dotty look
    } else {
      body.dash([]); // solid
    }
  }

    // ---------- Arc style helper (single line vs outline band) ----------

  function applyArcStyle(group) {
    if (!(group instanceof Konva.Group)) return;

    const type = group.getAttr("shapeType") || group.name();
    if (type !== "arc") return;

    const arc =
      group.findOne(".body-arc") ||
      group.findOne((n) => n instanceof Konva.Arc);
    if (!arc) return;

    // --- Mode: "single" (one stroked line) vs "outline" (ring/band) ---
    let mode = group.getAttr("arcMode");
    if (mode !== "single" && mode !== "outline") {
      mode = "outline";
    }
    group.setAttr("arcMode", mode);

    // --- Geometry: radius + thickness + sweep angle ---
    let radius = Number(group.getAttr("arcRadius"));
    let thickness = Number(group.getAttr("arcThickness"));
    let angle = Number(group.getAttr("arcAngle"));

    const currentInner = Number(arc.innerRadius && arc.innerRadius()) || 60;
    const currentOuter = Number(arc.outerRadius && arc.outerRadius()) || 80;

    if (!Number.isFinite(radius) || radius <= 0) {
      radius = mode === "outline" ? currentInner : currentOuter;
    }
    if (!Number.isFinite(thickness) || thickness <= 0) {
      const band = currentOuter - currentInner;
      thickness =
        mode === "outline"
          ? band > 0
            ? band
            : 20
          : Number(arc.strokeWidth && arc.strokeWidth()) || 4;
    }
    if (!Number.isFinite(angle) || angle <= 0) {
      angle = arc.angle ? arc.angle() : 180;
    }

    // Clamp angle a bit
    angle = Math.max(1, Math.min(359, angle));

    group.setAttr("arcRadius", radius);
    group.setAttr("arcThickness", thickness);
    group.setAttr("arcAngle", angle);

    // --- Stroke colour / style ---
    let strokeColor =
      group.getAttr("arcStrokeColor") || arc.stroke() || "#111827";
    group.setAttr("arcStrokeColor", strokeColor);

    let strokeStyle = group.getAttr("arcStrokeStyle");
    if (
      strokeStyle !== "solid" &&
      strokeStyle !== "dashed" &&
      strokeStyle !== "dotted"
    ) {
      const dashArr = arc.dash && arc.dash();
      if (dashArr && dashArr.length) {
        strokeStyle = dashArr[0] <= 3 ? "dotted" : "dashed";
      } else {
        strokeStyle = "solid";
      }
    }
    group.setAttr("arcStrokeStyle", strokeStyle);

    // --- Fill for outline mode ---
    let fillEnabled = group.getAttr("arcFillEnabled");
    if (fillEnabled === undefined || fillEnabled === null) {
      const f = arc.fill && arc.fill();
      fillEnabled = !!f && f !== "rgba(0,0,0,0)";
    }
    group.setAttr("arcFillEnabled", !!fillEnabled);

    let fillColor =
      group.getAttr("arcFillColor") || arc.fill() || "#ffffff";
    group.setAttr("arcFillColor", fillColor);

    // --------- Apply to Konva.Arc ----------
    // Geometry
    if (mode === "outline") {
      arc.innerRadius(radius);
      arc.outerRadius(radius + thickness);
      arc.strokeWidth(2);           // edge line width – kept small
    } else {
      // single line
      arc.innerRadius(radius);
      arc.outerRadius(radius);
      arc.strokeWidth(thickness);   // thickness IS the stroke width
    }

    arc.angle(angle);
    arc.stroke(strokeColor);

    // Fill only used in outline mode
    if (mode === "outline" && fillEnabled) {
      arc.fill(fillColor);
    } else {
      arc.fill("rgba(0,0,0,0)");
    }

    // Stroke style (solid / dashed / dotted)
    if (strokeStyle === "dashed") {
      arc.dash([12, 4]);
    } else if (strokeStyle === "dotted") {
      arc.dash([2, 4]);
    } else {
      arc.dash([]);
    }

    ensureHitRect(group);
  }

    // ---------- Stairs geometry helper (parallel tread lines) ----------

  function updateStairsGeometry(group) {
    if (!(group instanceof Konva.Group)) return;

    const type = group.getAttr("shapeType") || group.name();
    if (type !== "stairs") return;

    // ---- Read + normalise attributes ----
    let length = Number(group.getAttr("stairsLength"));
    let width = Number(group.getAttr("stairsWidth"));
    let steps = Number(group.getAttr("stairsStepCount"));
    let strokeColor =
      group.getAttr("stairsStrokeColor") || "#111827";
    let strokeWidth = Number(group.getAttr("stairsStrokeWidth"));

    if (!Number.isFinite(length) || length <= 0) {
      length = GRID_SIZE * 4; // sensible default
    }
    if (!Number.isFinite(width) || width <= GRID_SIZE * 0.75) {
      width = GRID_SIZE * 1.5;
    }
    if (!Number.isFinite(steps) || steps < 2) {
      // default steps based on length
      steps = Math.max(3, Math.round(length / (GRID_SIZE * 0.75)));
    }
    if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
      strokeWidth = 1.7;
    }

    group.setAttr("stairsLength", length);
    group.setAttr("stairsWidth", width);
    group.setAttr("stairsStepCount", steps);
    group.setAttr("stairsStrokeColor", strokeColor);
    group.setAttr("stairsStrokeWidth", strokeWidth);

    // ---- Clear old tread lines ----
    group
      .find((n) => n.getAttr && n.getAttr("isStairStep"))
      .forEach((n) => n.destroy());

    const halfWidth = width / 2;
    const gapCount = steps - 1;
    const stepSpacing = gapCount > 0 ? length / gapCount : length;

    // Group origin = start of stairs (x = 0), lines go from 0 → length
    for (let i = 0; i < steps; i += 1) {
      const x = i * stepSpacing;

      const line = new Konva.Line({
        points: [x, -halfWidth, x, halfWidth],
        stroke: strokeColor,
        strokeWidth,
        lineCap: "round",
        lineJoin: "round",
        name: "stairs-step",
      });

      line.setAttr("isStairStep", true);
      group.add(line);
    }

    ensureHitRect(group);
  }

  
  // ---------- Stage style helpers ----------

  function hexToRgb(hex) {
    const fallback = { r: 17, g: 24, b: 39 }; // #111827
    if (typeof hex !== "string") return fallback;
    let c = hex.trim();
    if (!c) return fallback;
    if (c[0] === "#") c = c.slice(1);
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    if (c.length !== 6) return fallback;
    const num = parseInt(c, 16);
    if (!Number.isFinite(num)) return fallback;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function rgbToHex(r, g, b) {
    function toHex(v) {
      const h = Math.max(0, Math.min(255, v)) .toString(16);
      return h.length === 1 ? "0" + h : h;
    }
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  function blendTwoHex(hexA, hexB) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const r = Math.round((a.r + b.r) / 2);
    const g = Math.round((a.g + b.g) / 2);
    const c = Math.round((a.b + b.b) / 2);
    return rgbToHex(r, g, c);
  }

  // Simple brightness-based contrast
  function computeContrastTextColor(bgHex) {
    const { r, g, b } = hexToRgb(bgHex);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // Lighter backgrounds → dark text, darker backgrounds → white text
    return brightness > 140 ? "#111827" : "#ffffff";
  }

  function applyStageStyle(group) {
    if (!(group instanceof Konva.Group)) return;
    const type = group.getAttr("shapeType") || group.name();
    if (type !== "stage") return;

    const body = getBodyRect(group);
    if (!body) return;
    const label = group.findOne("Text");

    // --- Fill mode: solid vs gradient ---
    let fillMode = group.getAttr("stageFillMode");
    if (fillMode !== "solid" && fillMode !== "gradient") {
      // Default to solid now
      fillMode = "solid";
    }
    group.setAttr("stageFillMode", fillMode);

    // --- Solid colour setup (default: black) ---
    let solidColor =
      group.getAttr("stageSolidColor") || body.fill() || "#000000";
    group.setAttr("stageSolidColor", solidColor);

    // --- Gradient setup (kept for backwards-compatibility / options) ---
    let startColor =
      group.getAttr("stageGradientStartColor") || "#1d4ed8"; // brand blue
    let endColor =
      group.getAttr("stageGradientEndColor") || "#22c1c3";   // brand teal
    group.setAttr("stageGradientStartColor", startColor);
    group.setAttr("stageGradientEndColor", endColor);

    let direction = group.getAttr("stageGradientDirection") || "lr";
    if (direction !== "lr" && direction !== "tb" && direction !== "diag") {
      direction = "lr";
    }
    group.setAttr("stageGradientDirection", direction);

    const width = body.width();
    const height = body.height();

    if (fillMode === "solid") {
      // Solid fill
      body.fill(solidColor);
      body.fillLinearGradientColorStops([]);
    } else {
      // Gradient fill
      let startPoint = { x: 0, y: 0 };
      let endPoint = { x: width, y: 0 }; // left → right

      if (direction === "tb") {
        endPoint = { x: 0, y: height };      // top → bottom
      } else if (direction === "diag") {
        endPoint = { x: width, y: height };  // diagonal
      }

      body.fill("");
      body.fillLinearGradientStartPoint(startPoint);
      body.fillLinearGradientEndPoint(endPoint);
      body.fillLinearGradientColorStops([
        0,
        startColor,
        1,
        endColor,
      ]);
    }

    // --- Text colour (auto vs manual) ---
    let autoText = group.getAttr("stageTextAutoColor") !== false; // default: true
    group.setAttr("stageTextAutoColor", autoText);

    let manualTextColor =
      group.getAttr("stageTextColor") ||
      (label && label.fill && label.fill()) ||
      "#ffffff";
    group.setAttr("stageTextColor", manualTextColor);

    const effectiveBg =
      fillMode === "solid"
        ? solidColor
        : blendTwoHex(startColor, endColor);

    const finalTextColor = autoText
      ? computeContrastTextColor(effectiveBg)
      : manualTextColor;

    if (label) {
      label.fill(finalTextColor);
    }
  }


    function createSectionBlock(x, y) {
    const group = new Konva.Group({
      // no snap: allow precise placement
      x: x - 80,
      y: y - 24,
      draggable: true,
      name: "section",
      shapeType: "section",
    });

    const rect = new Konva.Rect({
      width: 160,
      height: 48,
      cornerRadius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.7,
      name: "body-rect",
      fill: "#ffffff",
    });

    group.add(rect);
    applyBasicShapeStyle(group);
    ensureHitRect(group);
    return group;
  }


 function createStage(x, y) {
  const group = new Konva.Group({
    x: x - 100,
    y: y - 24,
    draggable: true,
    name: "stage",
    shapeType: "stage",
  });

  // Default stage styling attributes
  group.setAttr("stageLabel", "STAGE");

  // Default to solid black background with white text
  group.setAttr("stageFillMode", "solid");
  group.setAttr("stageSolidColor", "#000000");

  // Keep gradient options available in the inspector
  group.setAttr("stageGradientPreset", "brand");
  group.setAttr("stageGradientStartColor", "#1d4ed8");
  group.setAttr("stageGradientEndColor", "#22c1c3");
  group.setAttr("stageGradientDirection", "lr");

  group.setAttr("stageTextAutoColor", true);
  group.setAttr("stageTextColor", "#ffffff");

  const rect = new Konva.Rect({
    width: 200,
    height: 52,
    cornerRadius: 12,
    stroke: "#0f172a",
    strokeWidth: 1.8,
    name: "body-rect",
  });

  const label = new Konva.Text({
    text: group.getAttr("stageLabel"),
    name: "stage-label",
    fontSize: 18,
    fontStyle: "bold",
    fontFamily: "system-ui",
    align: "center",
    verticalAlign: "middle",
    width: rect.width(),
    height: rect.height(),
    fill: "#ffffff",
  });

  group.add(rect);
  group.add(label);

  // Inline edit stage label on double-click
  group.on("dblclick", () => {
    beginInlineTextEdit(label, (newText) => {
      const t = newText && newText.trim() ? newText : "STAGE";
      label.text(t);
      group.setAttr("stageLabel", t);
      ensureHitRect(group);
      if (mapLayer) mapLayer.batchDraw();
      pushHistory();
    });
  });

  applyStageStyle(group);
  ensureHitRect(group);
  return group;
}


function createBar(x, y) {
  const group = new Konva.Group({
    x: x - 70,
    y: y - 18,
    draggable: true,
    name: "bar",
    shapeType: "bar",
  });

  const rect = new Konva.Rect({
    width: 140,
    height: 36,
    cornerRadius: 8,
    stroke: "#4b5563",
    strokeWidth: 1.7,
    name: "body-rect",
    fill: "#ffffff",
  });

  const label = new Konva.Text({
    text: "BAR",
    name: "bar-label",
    fontSize: 14,
    fontFamily: "system-ui",
    align: "center",
    verticalAlign: "middle",
    width: rect.width(),
    height: rect.height(),
    fill: "#4b5563",
  });

  group.add(rect);
  group.add(label);
  ensureHitRect(group);

  // Inline edit bar label on double-click
  group.on("dblclick", () => {
    beginInlineTextEdit(label, (newText) => {
      const t = newText && newText.trim() ? newText : "BAR";
      label.text(t);
      ensureHitRect(group);
      if (mapLayer) mapLayer.batchDraw();
      pushHistory();
    });
  });

  return group;
}

 function createExit(x, y) {
  const group = new Konva.Group({
    x: x - 50,
    y: y - 18,
    draggable: true,
    name: "exit",
    shapeType: "exit",
  });

  const rect = new Konva.Rect({
    width: 100,
    height: 36,
    cornerRadius: 8,
    stroke: "#16a34a",
    strokeWidth: 1.8,
    name: "body-rect",
    fill: "#ffffff",
  });

  const label = new Konva.Text({
    text: "EXIT",
    name: "exit-label",
    fontSize: 14,
    fontFamily: "system-ui",
    align: "center",
    verticalAlign: "middle",
    width: rect.width(),
    height: rect.height(),
    fill: "#16a34a",
  });

  group.add(rect);
  group.add(label);
  ensureHitRect(group);

  // Inline edit exit label on double-click
  group.on("dblclick", () => {
    beginInlineTextEdit(label, (newText) => {
      const t = newText && newText.trim() ? newText : "EXIT";
      label.text(t);
      ensureHitRect(group);
      if (mapLayer) mapLayer.batchDraw();
      pushHistory();
    });
  });

  return group;
}

  // ---- Symbol tool helpers (toolbar <-> internal type + icon paths) ----

  // Canonical internal symbol types (what we store on the Konva group)
  const SYMBOL_TYPES = [
    "info",
    "bar",
    "wc-mixed",
    "wc-male",
    "wc-female",
    "disabled",
    "stairs",
    "first-aid",
    "exit-symbol",
  ];

  const SYMBOL_LABELS = {
    info: "Information",
    bar: "Bar",
    "wc-mixed": "Toilets (mixed)",
    "wc-male": "Toilets (male)",
    "wc-female": "Toilets (female)",
    disabled: "Disabled toilet",
    stairs: "Stairs",
    "first-aid": "First aid",
    "exit-symbol": "Emergency exit",
  };

  // DARK icons used on the canvas itself
  const SYMBOL_ICON_DARK = {
    bar: "/seatmap-icons/barsymbol-dark.png",
    "wc-mixed": "/seatmap-icons/mixedtoilets-dark.png",
    "wc-male": "/seatmap-icons/maletoilets-dark.png",
    "wc-female": "/seatmap-icons/femaletoilets-dark.png",
    "exit-symbol": "/seatmap-icons/emergencyexit-dark.png",
    disabled: "/seatmap-icons/disabledtoilets-dark.png",
    "first-aid": "/seatmap-icons/firstaid-dark.png",
    info: "/seatmap-icons/information-dark.png",
    stairs: "/seatmap-icons/stairssymbol-dark.png",
  };

  // BLUE icons used for the main symbols button in the left-hand toolbar
  const SYMBOL_ICON_BLUE = {
    bar: "/seatmap-icons/barsymbol-blue.png",
    "wc-mixed": "/seatmap-icons/mixedtoilets-blue.png",
    "wc-male": "/seatmap-icons/maletoilets-blue.png",
    "wc-female": "/seatmap-icons/femaletoilets-blue.png",
    "exit-symbol": "/seatmap-icons/emergencyexit-blue.png",
    disabled: "/seatmap-icons/disabledtoilets-blue.png",
    "first-aid": "/seatmap-icons/firstaid-blue.png",
    info: "/seatmap-icons/information-blue.png",
    stairs: "/seatmap-icons/stairssymbol-blue.png",
  };

    // Normalise either:
  // - a toolbar tool name (e.g. "symbol-wc-mixed", "symbol-firstaid")
  // - or an internal type (e.g. "wc-mixed", "first-aid")
  // into one of our canonical SYMBOL_TYPES.
  function normaliseSymbolTool(toolNameOrType) {
    if (!toolNameOrType) return "info";

    const rawString = String(toolNameOrType).toLowerCase();

    // Already a canonical type?
    if (SYMBOL_TYPES.indexOf(rawString) !== -1) {
      return rawString;
    }

    // Strip "symbol-" prefix if present
    let raw = rawString;
    if (raw.startsWith("symbol-")) {
      raw = raw.slice(7);
    }

    // Normalise underscores to hyphens
    raw = raw.replace(/_/g, "-");

    // Direct match after stripping prefix?
    if (SYMBOL_TYPES.indexOf(raw) !== -1) {
      return raw;
    }

    // ----- Heuristics -----
    // Non-WC symbols first
    if (raw.includes("bar")) return "bar";
    if (raw.includes("stair")) return "stairs";
    if (raw.includes("first") || raw.includes("aid") || raw.includes("medical")) return "first-aid";
    if (raw.includes("exit")) return "exit-symbol";
    if (raw.includes("disab") || raw.includes("wheelchair")) return "disabled";

    // *** WC variants – make sure male/female win over generic "mixed" / "wc" ***
    if (raw.includes("female") || raw.includes("women") || raw.includes("ladies")) {
      return "wc-female";
    }
    if (raw.includes("male") || raw.includes("men") || raw.includes("gents")) {
      return "wc-male";
    }
    if (raw.includes("mix") || raw.includes("unisex")) {
      return "wc-mixed";
    }

    if (raw.includes("wc") || raw.includes("toilet") || raw.includes("restroom")) {
      return "wc-mixed";
    }

    if (raw.includes("info") || raw.includes("help")) return "info";

    // Fallback
    return "info";
  }

  // Ensure there's a sensible default icon shown even before a symbol is picked.
  // We want the mixed WC symbol as the default.
  function initSymbolsToolbarDefaultIcon() {
    try {
      updateSymbolsToolbarIcon("wc-mixed");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("initial symbols icon error", e);
    }
  }

  // Try immediately (in case the DOM is already there)...
  initSymbolsToolbarDefaultIcon();

  // ...and also on load, in case the toolbar is rendered later.
  window.addEventListener("load", initSymbolsToolbarDefaultIcon);


  // Create a symbol node on the map (uses DARK icon variant)
  function createSymbolNode(symbolToolNameOrType, x, y) {
    // Normalise whatever the caller passes (e.g. "symbol-wc-mixed" or "wc-mixed")
    const symbolType = normaliseSymbolTool(symbolToolNameOrType);

    const group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "symbol",
      shapeType: "symbol",
    });

    group.setAttr("symbolType", symbolType);

    const imageObj = new window.Image();
    imageObj.src =
      SYMBOL_ICON_DARK[symbolType] || SYMBOL_ICON_DARK.info;

    const icon = new Konva.Image({
      image: imageObj,
      width: 36,
      height: 36,
      offsetX: 18,
      offsetY: 18,
      // we still call this "body-rect" so hit-testing & selection work nicely
      name: "body-rect",
    });

    imageObj.onload = () => {
      if (mapLayer) mapLayer.batchDraw();
    };

    group.add(icon);
    ensureHitRect(group);

    return group;
  }

  function createSquare(x, y) {
    const size = 100;

    const group = new Konva.Group({
      x: x - size / 2,
      y: y - size / 2,
      draggable: true,
      name: "square",
      shapeType: "square",
    });

    const rect = new Konva.Rect({
      width: size,
      height: size,
      cornerRadius: 4,
      stroke: "#4b5563",
      strokeWidth: 1.7,
      name: "body-rect",
      fill: "#ffffff",
    });

    group.add(rect);
    applyBasicShapeStyle(group);
    ensureHitRect(group);
    return group;
  }
  function createCircle(x, y) {
    const radius = 50;

    const group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "circle",
      shapeType: "circle",
    });

    const circle = new Konva.Circle({
      radius,
      stroke: "#4b5563",
      strokeWidth: 1.7,
      name: "body-rect",
      fill: "#ffffff",
    });

    group.add(circle);
    applyBasicShapeStyle(group);
    ensureHitRect(group);
    return group;
  }
  function createTextLabel(x, y) {
  const group = new Konva.Group({
    x: x,
    y: y,
    draggable: true,
    name: "label",
    shapeType: "text",
  });

  const text = new Konva.Text({
    text: "Label",
    fontSize: 14,
    fontFamily: "system-ui",
    fill: "#111827",
    draggable: false,
    name: "label-text",
  });

  group.add(text);
  ensureHitRect(group);

  // Inline edit using the shared helper
  group.on("dblclick", () => {
    beginInlineTextEdit(text, (newText) => {
      const t = newText && newText.trim() ? newText : "Label";
      text.text(t);
      ensureHitRect(group);
      if (mapLayer) mapLayer.batchDraw();
      pushHistory();
    });
  });

  return group;

  }

  // --- Multi-shape transform behaviour (resize + rotate) ---
function attachMultiShapeTransformBehaviour(group) {
  if (!(group instanceof Konva.Group)) return;

  const type = group.getAttr("shapeType") || group.name();
  if (type !== "multi-shape") return;

  // Avoid wiring the same listeners multiple times
  if (group.getAttr("__multiShapeTransformHooked")) return;
  group.setAttr("__multiShapeTransformHooked", true);

  // While the user is dragging corners / edges, keep the hit-rect in sync
  group.on("transform.multiShape", () => {
    ensureHitRect(group);
    if (mapLayer) mapLayer.batchDraw();
    if (overlayLayer) overlayLayer.batchDraw();
  });

  // When user finishes a transform, bake scale into width/height attrs
  group.on("transformend.multiShape", () => {
    const currentType = group.getAttr("shapeType") || group.name();
    if (currentType !== "multi-shape") return;

    // Use absolute scale so flips don't give negative sizes
    const scaleX = Math.abs(group.scaleX() || 1);
    const scaleY = Math.abs(group.scaleY() || 1);

    // If no effective size change, don't touch geometry
    if (
      Math.abs(scaleX - 1) < 0.0001 &&
      Math.abs(scaleY - 1) < 0.0001
    ) {
      return;
    }

    let width = Number(group.getAttr("multiShapeWidth"));
    let height = Number(group.getAttr("multiShapeHeight"));

    if (!Number.isFinite(width) || width <= 0) width = 120;
    if (!Number.isFinite(height) || height <= 0) height = 80;

    const newWidth = Math.max(20, width * scaleX);
    const newHeight = Math.max(20, height * scaleY);

    // Bake the scale into the logical width/height attributes
    group.setAttrs({
      multiShapeWidth: newWidth,
      multiShapeHeight: newHeight,
      scaleX: 1,
      scaleY: 1,
    });

    // Rebuild polygon/parallelogram with the new dimensions
    updateMultiShapeGeometry(group);
    ensureHitRect(group);

    if (mapLayer) mapLayer.batchDraw();
    if (overlayLayer) overlayLayer.batchDraw();
    pushHistory();
  });
}


  
           function createMultiShape(x, y) {
    const group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "multi-shape",
      shapeType: "multi-shape",
    });

    // Defaults
    group.setAttr("multiShapeVariant", "regular"); // "regular" | "rhombus" | "parallelogram"
    group.setAttr("multiShapeSides", 5);          // used when variant === "regular"
    group.setAttr("multiShapeWidth", 120);
    group.setAttr("multiShapeHeight", 80);
    group.setAttr("multiShapeSkew", 20);          // degrees – used for rhombus / parallelogram

    // Default style attrs (works with applyBasicShapeStyle)
    group.setAttr("shapeFillEnabled", true);
    group.setAttr("shapeFillColor", "#ffffff");
    group.setAttr("shapeStrokeColor", "#4b5563");
    group.setAttr("shapeStrokeWidth", 1.7);
    group.setAttr("shapeStrokeStyle", "solid");   // "solid" | "dashed" | "dotted"

    updateMultiShapeGeometry(group);
    applyBasicShapeStyle(group);
    ensureHitRect(group);

    return group;
  }



             function updateMultiShapeGeometry(group) {
    if (!(group instanceof Konva.Group)) return;
    const type = group.getAttr("shapeType") || group.name();
    if (type !== "multi-shape") return;

    // ---- Normalise attributes ----
    let variant = group.getAttr("multiShapeVariant") || "regular";

    // 🔁 Backwards-compat: treat any old "rhombus" as "parallelogram"
    if (variant === "rhombus") {
      variant = "parallelogram";
    }

    if (variant !== "regular" && variant !== "parallelogram") {
      variant = "regular";
    }
    group.setAttr("multiShapeVariant", variant);

    let sides = Number(group.getAttr("multiShapeSides"));
    if (!Number.isFinite(sides)) sides = 5;
    sides = Math.max(3, Math.min(20, Math.round(sides)));
    group.setAttr("multiShapeSides", sides);

    let width = Number(group.getAttr("multiShapeWidth"));
    let height = Number(group.getAttr("multiShapeHeight"));
    if (!Number.isFinite(width) || width <= 0) width = 120;
    if (!Number.isFinite(height) || height <= 0) height = 80;

    // Tweaked defaults per variant (only used if we didn't already have values)
    if (!group.getAttr("multiShapeWidth")) {
      if (variant === "parallelogram") {
        width = 140;
        height = 80;
      }
    }

    group.setAttr("multiShapeWidth", width);
    group.setAttr("multiShapeHeight", height);

    let skew = Number(group.getAttr("multiShapeSkew"));
    if (!Number.isFinite(skew)) skew = 20;
    skew = Math.max(-80, Math.min(80, skew));
    group.setAttr("multiShapeSkew", skew);

    // ---- Remove existing body shape (but keep hit-rect, etc.) ----
    group
      .find((n) => n.name && n.name() === "body-rect")
      .forEach((n) => n.destroy());

    let bodyShape;

    if (variant === "regular") {
      // Regular N-gon
      const radius = Math.min(width, height) / 2;
      bodyShape = new Konva.RegularPolygon({
        x: 0,
        y: 0,
        sides,
        radius,
        name: "body-rect",
        stroke: "#4b5563",
        strokeWidth: 1.7,
        fill: "#ffffff",
      });
    } else {
      // Parallelogram – 4-sided polygon with skew
      const halfW = width / 2;
      const halfH = height / 2;
      const skewRad = (skew * Math.PI) / 180;
      const skewPx = Math.tan(skewRad) * halfH;

      // Points ordered clockwise
      const points = [
        -halfW + skewPx, -halfH, // top-left
         halfW + skewPx, -halfH, // top-right
         halfW - skewPx,  halfH, // bottom-right
        -halfW - skewPx,  halfH, // bottom-left
      ];

      bodyShape = new Konva.Line({
        points,
        closed: true,
        name: "body-rect",
        stroke: "#4b5563",
        strokeWidth: 1.7,
        fill: "#ffffff",
        lineJoin: "round",
      });
    }

    group.add(bodyShape);
    applyBasicShapeStyle(group);
    ensureHitRect(group);

    // 🔁 Make sure resize via Transformer corners updates width/height attrs
    attachMultiShapeTransformBehaviour(group);
  }

  




   function createArc(x, y) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      name: "arc",
      shapeType: "arc",
    });

    // Base arc – actual styling is driven by applyArcStyle()
    const arc = new Konva.Arc({
      x: 0,
      y: 0,
      innerRadius: 60,
      outerRadius: 80,
      angle: 180,
      rotation: -90, // opens upwards
      stroke: "#111827",
      strokeWidth: 2,
      listening: true,
      name: "body-arc",
    });

    group.add(arc);

    // Default attributes for the inspector
    group.setAttr("arcMode", "outline");         // "outline" | "single"
    group.setAttr("arcRadius", 60);              // inner radius (px)
    group.setAttr("arcThickness", 20);           // band thickness (px) or line width
    group.setAttr("arcAngle", 180);              // sweep angle (deg)
    group.setAttr("arcStrokeColor", "#111827");
    group.setAttr("arcStrokeStyle", "solid");    // "solid" | "dashed" | "dotted"
    group.setAttr("arcFillEnabled", false);
    group.setAttr("arcFillColor", "#ffffff");

    applyArcStyle(group);
    ensureHitRect(group);
    return group;
  }

    function createSingleSeat(x, y) {
    const group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "single-seat",
      shapeType: "single-seat",
    });

    const mode = globalSeatLabelMode || "numbers";
    group.setAttr("seatLabelMode", mode);
    const isLabelled = mode !== "none";
    const seatFill = isLabelled ? "#ffffff" : "#111827";
    const seatStroke = isLabelled ? "#4b5563" : "#111827";

    const circle = new Konva.Circle({
      radius: SEAT_RADIUS,
      stroke: seatStroke,
      strokeWidth: 1.7,
      fill: seatFill,
      isSeat: true,
    });

    // seat kind metadata (per-seat)
    circle.setAttrs({
      sbSeatKind: circle.getAttr("sbSeatKind") || "standard",
      sbSeatBaseFill: seatFill,
      sbSeatBaseStroke: seatStroke,
      sbSeatBaseStrokeWidth: 1.7,
    });

    // allow per-seat type change on double-click
    attachSeatCircleBehaviour(circle);
    applySeatKindVisualToCircle(circle);

    group.add(circle);

    if (isLabelled) {
      const baseText = mode === "letters" ? "A" : "1";
      const label = makeSeatLabelText(baseText, 0, 0);
      group.add(label);
    }

    ensureHitRect(group);
    return group;
  }


  // ----- Table factories -----

  function createCircularTable(x, y, seatCount) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      name: "circular-table",
      shapeType: "circular-table",
    });

    // Core metadata
    const mode = globalSeatLabelMode || "numbers";
    group.setAttr("seatLabelMode", mode);
    group.setAttr("seatStart", 1);

    // Auto-label tables 1, 2, 3...
    const tableLabel = nextTableLabel();
    group.setAttr("tableLabel", tableLabel);

    // Base "table" body – actual radius is set in updateCircularTableGeometry
    const tableCircle = new Konva.Circle({
      x: 0,
      y: 0,
      radius: CIRC_MIN_TABLE_RADIUS,
      stroke: "#4b5563",
      strokeWidth: 1.7,
      fill: "#ffffff",
      name: "body-rect",
    });

    group.add(tableCircle);

    // Build seats + labels around the table
    updateCircularTableGeometry(group, seatCount);
    ensureHitRect(group);

    return group;
  }

  function createRectTable(x, y, opts) {
    const longSideSeats = Math.max(
      0,
      Math.floor((opts && opts.longSideSeats) || 0)
    );
    const shortSideSeats = Math.max(
      0,
      Math.floor((opts && opts.shortSideSeats) || 0)
    );

    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      name: "rect-table",
      shapeType: "rect-table",
    });

    const mode = globalSeatLabelMode || "numbers";
    group.setAttr("seatLabelMode", mode);
    group.setAttr("seatStart", 1);

    // Auto-label tables 1, 2, 3...
    const tableLabel = nextTableLabel();
    group.setAttr("tableLabel", tableLabel);

    group.setAttr("longSideSeats", longSideSeats);
    group.setAttr("shortSideSeats", shortSideSeats);

    // Base rectangular "table" body – actual size is set in updateRectTableGeometry
    const baseWidth = 120;
    const baseHeight = 60;

    const rect = new Konva.Rect({
      width: baseWidth,
      height: baseHeight,
      offsetX: baseWidth / 2,
      offsetY: baseHeight / 2,
      stroke: "#4b5563",
      strokeWidth: 1.7,
      fill: "#ffffff",
      name: "body-rect",
    });

    group.add(rect);

    // Build seats + labels around the table
    updateRectTableGeometry(group, longSideSeats, shortSideSeats);
    ensureHitRect(group);

    return group;
  }



        function createRowOfSeats(x, y, seatsPerRow = 10, rowCount = 1) {
    const group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "row-seats",
      shapeType: "row-seats",
    });

    // core config
    group.setAttr("seatsPerRow", seatsPerRow);
    group.setAttr("rowCount", rowCount);

    // NEW: per-row seat counts
    group.setAttr("everyRowSameSeats", true);
    group.setAttr("rowSeatCounts", null);

    const mode = globalSeatLabelMode || "numbers";
    group.setAttr("seatLabelMode", mode);
    group.setAttr("seatStart", 1);
    group.setAttr("rowLabelPrefix", "");
    group.setAttr("rowLabelStart", 0);

    // New: unified row-label position
    group.setAttr("rowLabelPosition", "left");

    // Legacy flag kept for backwards-compatibility with old layouts
    group.setAttr("rowLabelBothSides", false);

    // NEW: default seat alignment for this block ("left" | "center" | "right")
    // centre is the default (most common)
    group.setAttr("alignment", "center");

    group.setAttr("curve", 0);
    group.setAttr("rowOrder", "asc");

    updateRowGroupGeometry(group, seatsPerRow, rowCount);
    ensureHitRect(group);

    return group;
  }


  function updateRowGroupGeometry(group, seatsPerRow, rowCount) {
  if (!(group instanceof Konva.Group)) return;

  // --- Core seatsPerRow / rowCount normalisation ---
  let s = Number(seatsPerRow);
  let r = Number(rowCount);

  if (!Number.isFinite(s) || s < 1) {
    s = Number(group.getAttr("seatsPerRow")) || 1;
  }
  if (!Number.isFinite(r) || r < 1) {
    r = Number(group.getAttr("rowCount")) || 1;
  }

  s = Math.max(1, Math.floor(s));
  r = Math.max(1, Math.floor(r));

  group.setAttr("seatsPerRow", s);
  group.setAttr("rowCount", r);

  // --- Per-row seat counts support ---
  const everyRowSameRaw = group.getAttr("everyRowSameSeats");
  const everyRowSame = everyRowSameRaw !== false; // default = true

  let rowSeatCounts = group.getAttr("rowSeatCounts");
  if (!Array.isArray(rowSeatCounts)) {
    rowSeatCounts = [];
  }

  // Normalise rowSeatCounts length to rowCount, using s as default
  const normalisedRowSeatCounts = [];
  for (let i = 0; i < r; i += 1) {
    const raw = parseInt(rowSeatCounts[i], 10);
    if (Number.isFinite(raw) && raw > 0) {
      normalisedRowSeatCounts[i] = raw;
    } else {
      normalisedRowSeatCounts[i] = s;
    }
  }
  group.setAttr("rowSeatCounts", normalisedRowSeatCounts);

  const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
  const seatStartRaw = group.getAttr("seatStart");
  const seatStart = Number.isFinite(Number(seatStartRaw))
    ? Number(seatStartRaw)
    : 1;

  const rowLabelPrefix = group.getAttr("rowLabelPrefix") || "";
  const rowLabelStartRaw = group.getAttr("rowLabelStart");
  const rowLabelStart = Number.isFinite(Number(rowLabelStartRaw))
    ? Number(rowLabelStartRaw)
    : 0;

  // New: unified row-label position
  let rowLabelPosition = group.getAttr("rowLabelPosition");
  const legacyBothSides = !!group.getAttr("rowLabelBothSides");

  if (
    rowLabelPosition !== "left" &&
    rowLabelPosition !== "right" &&
    rowLabelPosition !== "both" &&
    rowLabelPosition !== "none"
  ) {
    // Fall back to legacy behaviour
    rowLabelPosition = legacyBothSides ? "both" : "left";
  }

  group.setAttr("rowLabelPosition", rowLabelPosition);
  // Keep legacy flag roughly in sync
  group.setAttr("rowLabelBothSides", rowLabelPosition === "both");

    let alignmentRaw = group.getAttr("alignment") || "center";

  // Allow both spellings just in case
  if (alignmentRaw === "centre") alignmentRaw = "center";

  const alignment =
    alignmentRaw === "left" ||
    alignmentRaw === "right" ||
    alignmentRaw === "center"
      ? alignmentRaw
      : "center";


  const rowOrderRaw = group.getAttr("rowOrder") || "asc";
  const rowOrder = rowOrderRaw === "desc" ? "desc" : "asc";
  group.setAttr("rowOrder", rowOrder);

  const curveRaw = Number(group.getAttr("curve"));
  const curve = Math.max(
    -15,
    Math.min(15, Number.isFinite(curveRaw) ? curveRaw : 0)
  );
  group.setAttr("curve", curve);

  // Clear existing seats + labels
  group
    .find((node) =>
      node.getAttr("isSeat") ||
      node.getAttr("isSeatLabel") ||
      node.getAttr("isRowLabel")
    )
    .forEach((n) => n.destroy());

  const spacing = 26;
  const seatRadius = SEAT_RADIUS;
  const rowSpacing = 28;

  const curveFactor = curve / 10;

  function computeSeatX(i, rowSeats) {
    if (alignment === "left") {
      return i * spacing;
    }
    if (alignment === "right") {
      return -(rowSeats - 1) * spacing + i * spacing;
    }
    const centerIndex = (rowSeats - 1) / 2;
    return (i - centerIndex) * spacing;
  }

  const isLabelled = seatLabelMode !== "none";
  const seatFill = isLabelled ? "#ffffff" : "#111827";
  const seatStroke = isLabelled ? "#4b5563" : "#111827";

  for (let rIdx = 0; rIdx < r; rIdx += 1) {
    const baseRowY = rIdx * rowSpacing;

    const rowSeats = everyRowSame
      ? s
      : normalisedRowSeatCounts[rIdx] || s;

    let firstSeatX = null;
    let lastSeatX = null;
    let firstSeatY = null;
    let lastSeatY = null;

    for (let i = 0; i < rowSeats; i += 1) {
      const sx = computeSeatX(i, rowSeats);

      const centerIndex = (rowSeats - 1) / 2;
      const offsetIndex = i - centerIndex;
      const curveOffset = curveFactor * offsetIndex * offsetIndex;
      const rowY = baseRowY + curveOffset;

      if (firstSeatX == null) {
        firstSeatX = sx;
        firstSeatY = rowY;
      }
      lastSeatX = sx;
      lastSeatY = rowY;

      if (!Number.isFinite(sx) || !Number.isFinite(rowY)) {
        // eslint-disable-next-line no-console
        console.error("❌ invalid seat position", {
          i,
          r: rIdx,
          sx,
          rowY,
          alignment,
          curve,
          rowSeats,
        });
        continue;
      }

            const seat = new Konva.Circle({
        x: sx,
        y: rowY,
        radius: seatRadius,
        stroke: seatStroke,
        strokeWidth: 1.7,
        fill: seatFill,
        isSeat: true,
      });

      // seat type metadata
      seat.setAttrs({
        sbSeatKind: seat.getAttr("sbSeatKind") || "standard",
        sbSeatBaseFill: seatFill,
        sbSeatBaseStroke: seatStroke,
        sbSeatBaseStrokeWidth: 1.7,
      });

      attachSeatCircleBehaviour(seat);
      applySeatKindVisualToCircle(seat);

      group.add(seat);


      if (seatLabelMode !== "none") {
        const labelText = seatLabelFromIndex(seatLabelMode, i, seatStart);
        const label = makeSeatLabelText(labelText, sx, rowY);
        group.add(label);
      }
    }

    // Row labels
    const logicalRowIdx =
      rowOrder === "desc" ? r - 1 - rIdx : rIdx;

    const rowLabelText =
      rowLabelPrefix + rowLabelFromIndex(rowLabelStart + logicalRowIdx);

    if (rowLabelText && firstSeatX != null) {
      const labelGap = seatRadius * 1.4;

      // Use the *curved* Y positions so labels hug the ends of the row
      const labelYLeft =
        firstSeatY != null ? firstSeatY : baseRowY;
      const labelYRight =
        lastSeatY != null ? lastSeatY : baseRowY;

      const showLeft =
        rowLabelPosition === "left" || rowLabelPosition === "both";
      const showRight =
        rowLabelPosition === "right" || rowLabelPosition === "both";

            // Left-hand label
      if (showLeft && firstSeatX != null) {
        const leftLabel = new Konva.Text({
          text: rowLabelText,
          fontSize: 14,
          fontFamily: "system-ui",
          fontStyle: "bold",
          fill: "#111827",
          align: "right",
          verticalAlign: "middle",
          listening: true,     // ← allow clicks on the row label
          isRowLabel: true,
        });

        leftLabel.position({
          x: firstSeatX - (seatRadius + labelGap),
          y: labelYLeft,
        });
        leftLabel.offsetX(leftLabel.width());
        leftLabel.offsetY(leftLabel.height() / 2);
        group.add(leftLabel);
      }

                  // Right-hand label
      if (showRight && lastSeatX != null) {
        const rightLabel = new Konva.Text({
          text: rowLabelText,
          fontSize: 14,
          fontFamily: "system-ui",
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          verticalAlign: "middle",
          listening: true,     // ← allow clicks on the row label
          isRowLabel: true,
        });

        rightLabel.position({
          x: lastSeatX + (seatRadius + labelGap),
          y: labelYRight,
        });
        rightLabel.offsetY(rightLabel.height() / 2);
        group.add(rightLabel);
      }
    }
  }

  ensureHitRect(group);
  keepLabelsUpright(group);
}


  function updateCircularTableGeometry(group, seatCount) {
    if (!(group instanceof Konva.Group)) return;

    seatCount = Math.max(1, Math.floor(seatCount));
    group.setAttr("seatCount", seatCount);

    const table = getBodyRect(group);
    if (!table || !(table instanceof Konva.Circle)) return;

    group
      .find(
        (node) =>
          node.getAttr("isSeat") ||
          node.getAttr("isSeatLabel") ||
          (node.getClassName && node.getClassName() === "Text")
      )
      .forEach((n) => n.destroy());

    const seatRadius = SEAT_RADIUS;
    const desiredGap = CIRC_DESIRED_GAP;

    const circumferencePerSeat = seatRadius * 2 + desiredGap;
    const ringRadiusFromCirc =
      (seatCount * circumferencePerSeat) / (2 * Math.PI);

    const minRingRadius =
      CIRC_MIN_TABLE_RADIUS + seatRadius + desiredGap;

    const seatRingRadius = Math.max(ringRadiusFromCirc, minRingRadius);
    const tableRadius = seatRingRadius - seatRadius - desiredGap;

    table.radius(tableRadius);
    table.fill("#ffffff");

    const tableLabelText = group.getAttr("tableLabel") || "";
    if (tableLabelText) {
      const centreLabel = new Konva.Text({
        text: tableLabelText,
        fontSize: 13,
        fontFamily: "system-ui",
        fontStyle: "bold",
        fill: "#111827",
        align: "center",
        verticalAlign: "middle",
        width: tableRadius * 2,
        height: tableRadius * 2,
        offsetX: tableRadius,
        offsetY: tableRadius,
        listening: false,
        name: "table-label",
      });
      group.add(centreLabel);
    }

    const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
    const seatStartRaw = group.getAttr("seatStart");
    const seatStart = Number.isFinite(Number(seatStartRaw))
      ? Number(seatStartRaw)
      : 1;

    const isLabelled = seatLabelMode !== "none";
    const seatFill = isLabelled ? "#ffffff" : "#111827";
    const seatStroke = isLabelled ? "#4b5563" : "#111827";

    for (let i = 0; i < seatCount; i += 1) {
      const angle = (i / seatCount) * Math.PI * 2;
      const sx = Math.cos(angle) * seatRingRadius;
      const sy = Math.sin(angle) * seatRingRadius;

            const seat = new Konva.Circle({
        x: sx,
        y: sy,
        radius: seatRadius,
        stroke: seatStroke,
        strokeWidth: 1.7,
        fill: seatFill,
        isSeat: true,
      });

      seat.setAttrs({
        sbSeatKind: seat.getAttr("sbSeatKind") || "standard",
        sbSeatBaseFill: seatFill,
        sbSeatBaseStroke: seatStroke,
        sbSeatBaseStrokeWidth: 1.7,
      });

      attachSeatCircleBehaviour(seat);
      applySeatKindVisualToCircle(seat);

      group.add(seat);


      if (seatLabelMode !== "none") {
        const labelText = seatLabelFromIndex(
          seatLabelMode,
          i,
          seatStart
        );
        const label = makeSeatLabelText(labelText, sx, sy);
        group.add(label);
      }
    }

    ensureHitRect(group);
  }

  function updateRectTableGeometry(group, longSideSeats, shortSideSeats) {
    if (!(group instanceof Konva.Group)) return;

    longSideSeats = Math.max(0, Math.floor(longSideSeats));
    shortSideSeats = Math.max(0, Math.floor(shortSideSeats));

    group.setAttr("longSideSeats", longSideSeats);
    group.setAttr("shortSideSeats", shortSideSeats);

    const table = getBodyRect(group);
    if (!table || !(table instanceof Konva.Rect)) return;

    group
      .find(
        (node) =>
          node.getAttr("isSeat") ||
          node.getAttr("isSeatLabel") ||
          (node.getClassName && node.getClassName() === "Text")
      )
      .forEach((n) => n.destroy());

    const seatRadius = SEAT_RADIUS;
    const seatGap = 6;

    const longSpan =
      longSideSeats > 0 ? (longSideSeats - 1) * (seatRadius * 2 + seatGap) : 0;
    const shortSpan =
      shortSideSeats > 0
        ? (shortSideSeats - 1) * (seatRadius * 2 + seatGap) : 0;

    const width = longSpan + seatRadius * 4;
    const height = shortSpan + seatRadius * 4;

    table.width(width);
    table.height(height);
    table.offsetX(width / 2);
    table.offsetY(height / 2);
    table.fill("#ffffff");

    const tableLabelText = group.getAttr("tableLabel") || "";
    if (tableLabelText) {
      const centreLabel = new Konva.Text({
        text: tableLabelText,
        fontSize: 13,
        fontFamily: "system-ui",
        fontStyle: "bold",
        fill: "#111827",
        align: "center",
        verticalAlign: "middle",
        width,
        height,
        offsetX: width / 2,
        offsetY: height / 2,
        listening: false,
        name: "table-label",
      });
      group.add(centreLabel);
    }

    const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
    const seatStartRaw = group.getAttr("seatStart");
    const seatStart = Number.isFinite(Number(seatStartRaw))
      ? Number(seatStartRaw)
      : 1;

    const isLabelled = seatLabelMode !== "none";
    const seatFill = isLabelled ? "#ffffff" : "#111827";
    const seatStroke = isLabelled ? "#4b5563" : "#111827";

    let seatIndex = 0;

    for (let i = 0; i < longSideSeats; i += 1) {
      const sx =
        -width / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

      const topY = -height / 2 - 14;
      const bottomY = height / 2 + 14;

        const topSeat = new Konva.Circle({
     x: sx,
     y: topY,
     radius: seatRadius,
     stroke: seatStroke,
     strokeWidth: 1.7,
     fill: seatFill,
     isSeat: true,
   });
   const bottomSeat = new Konva.Circle({
     x: sx,
     y: bottomY,
     radius: seatRadius,
     stroke: seatStroke,
     strokeWidth: 1.7,
     fill: seatFill,
     isSeat: true,
   });

   [topSeat, bottomSeat].forEach((seat) => {
     seat.setAttrs({
       sbSeatKind: seat.getAttr("sbSeatKind") || "standard",
       sbSeatBaseFill: seatFill,
       sbSeatBaseStroke: seatStroke,
       sbSeatBaseStrokeWidth: 1.7,
     });
     attachSeatCircleBehaviour(seat);
     applySeatKindVisualToCircle(seat);
   });

   group.add(topSeat);
   group.add(bottomSeat);


      if (seatLabelMode !== "none") {
        const topText = seatLabelFromIndex(
          seatLabelMode,
          seatIndex,
          seatStart
        );
        seatIndex += 1;
        const bottomText = seatLabelFromIndex(
          seatLabelMode,
          seatIndex,
          seatStart
        );
        seatIndex += 1;

        const topLabel = makeSeatLabelText(topText, sx, topY);
        const bottomLabel = makeSeatLabelText(bottomText, sx, bottomY);
        group.add(topLabel);
        group.add(bottomLabel);
      } else {
        seatIndex += 2;
      }
    }

    for (let i = 0; i < shortSideSeats; i += 1) {
      const sy =
        -height / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

      const leftX = -width / 2 - 14;
      const rightX = width / 2 + 14;

         const leftSeat = new Konva.Circle({
     x: leftX,
     y: sy,
     radius: seatRadius,
     stroke: seatStroke,
     strokeWidth: 1.7,
     fill: seatFill,
     isSeat: true,
   });
   const rightSeat = new Konva.Circle({
     x: rightX,
     y: sy,
     radius: seatRadius,
     stroke: seatStroke,
     strokeWidth: 1.7,
     fill: seatFill,
     isSeat: true,
   });

   [leftSeat, rightSeat].forEach((seat) => {
     seat.setAttrs({
       sbSeatKind: seat.getAttr("sbSeatKind") || "standard",
       sbSeatBaseFill: seatFill,
       sbSeatBaseStroke: seatStroke,
       sbSeatBaseStrokeWidth: 1.7,
     });
     attachSeatCircleBehaviour(seat);
     applySeatKindVisualToCircle(seat);
   });

   group.add(leftSeat);
   group.add(rightSeat);


      if (seatLabelMode !== "none") {
        const leftText = seatLabelFromIndex(
          seatLabelMode,
          seatIndex,
          seatStart
        );
        seatIndex += 1;
        const rightText = seatLabelFromIndex(
          seatLabelMode,
          seatIndex,
          seatStart
        );
        seatIndex += 1;

        const leftLabel = makeSeatLabelText(leftText, leftX, sy);
        const rightLabel = makeSeatLabelText(rightText, rightX, sy);
        group.add(leftLabel);
        group.add(rightLabel);
      } else {
        seatIndex += 2;
      }
    }

    ensureHitRect(group);
  }

  // --------------- DEBUG HELPERS ---------------

  function debugDumpRows(context) {
    if (!mapLayer || !stage) {
      // eslint-disable-next-line no-console
      console.log("debugDumpRows: no mapLayer or stage");
      return;
    }

    // eslint-disable-next-line no-console
    console.log("===== ROW DEBUG =====", context || "");

    const stageScale = stage.scaleX();
    const stageSize = { width: stage.width(), height: stage.height() };
    const stagePos = stage.position();

    const layerScale = mapLayer.scale();
    const layerPos = mapLayer.position();

    // eslint-disable-next-line no-console
    console.log("Stage:", { stageScale, stageSize, stagePos });
    // eslint-disable-next-line no-console
    console.log("mapLayer:", { layerScale, layerPos });

    mapLayer.find("Group").forEach((g, idx) => {
      const type = g.getAttr("shapeType") || g.name();
      if (type !== "row-seats") return;

      const pos = g.position();
      const absPos = g.getAbsolutePosition();
      const scale = g.scale();
      const rotation = g.rotation();

      const rectLocal = g.getClientRect({ relativeTo: g });
      const rectLayer = g.getClientRect({ relativeTo: mapLayer });
      const rectStage = g.getClientRect();

      const hit = g.findOne(".hit-rect");
      const hitInfo = hit
        ? {
            x: hit.x(),
            y: hit.y(),
            width: hit.width(),
            height: hit.height(),
            absPos: hit.getAbsolutePosition(),
          }
        : null;

      const seat = g.findOne((node) => node.getAttr && node.getAttr("isSeat"));
      let seatInfo = null;
      if (seat) {
        seatInfo = {
          localPos: { x: seat.x(), y: seat.y() },
          absPos: seat.getAbsolutePosition(),
        };
      }

      const meta = {
        seatsPerRow: g.getAttr("seatsPerRow"),
        rowCount: g.getAttr("rowCount"),
        seatLabelMode: g.getAttr("seatLabelMode"),
        seatStart: g.getAttr("seatStart"),
        rowLabelPrefix: g.getAttr("rowLabelPrefix"),
        rowLabelStart: g.getAttr("rowLabelStart"),
        alignment: g.getAttr("alignment"),
        curve: g.getAttr("curve"),
        skew: g.getAttr("skew"),
        rowLabelBothSides: g.getAttr("rowLabelBothSides"),
      };

      // eslint-disable-next-line no-console
      console.log(`Row[${idx}]`, {
        pos,
        absPos,
        scale,
        rotation,
        rectLocal,
        rectLayer,
        rectStage,
        hitInfo,
        seatInfo,
        meta,
      });
    });

    // eslint-disable-next-line no-console
    console.log("===== END ROW DEBUG =====");
  }

  window.debugDumpRows = debugDumpRows;
   // ---------- Z-ORDER: seats & tables always above, background shapes below ----------

  function sbNormalizeZOrder(node) {
    if (!node || typeof node.getLayer !== "function") return;
    const layer = node.getLayer();
    if (!layer) return;

    const shapeType = node.getAttr("shapeType") || node.name() || "";

    // Anything that *contains seats* or is a table should always float above
    const isSeatOrTableGroup =
      shapeType === "row-seats" ||
      shapeType === "rect-table" ||
      shapeType === "circular-table" ||
      shapeType === "single-seat";

    if (isSeatOrTableGroup) {
      node.moveToTop();
      layer.batchDraw();
      return;
    }

    // Background shapes: structural / decorative elements that seats live on top of
    const isBackgroundShape =
      shapeType === "section" ||
      shapeType === "square" ||
      shapeType === "circle" ||
      shapeType === "stage" ||
      shapeType === "bar" ||
      shapeType === "exit" ||
      shapeType === "multi-shape" ||
      shapeType === "arc" ||
      shapeType === "line" ||
      shapeType === "curve-line" ||
      shapeType === "stairs" ||
      shapeType === "symbol" ||
      shapeType === "text" ||
      shapeType === "label";

    if (isBackgroundShape) {
      node.moveToBottom();
      layer.batchDraw();
      return;
    }

    // Anything else keeps its natural stacking.
  }


  

  function ensureSeatIdAttr(seat) {
    if (!seat || typeof seat.getAttr !== "function") return null;
    const existing = seat.getAttr("sbSeatId");
    if (existing) return existing;

    const id = `seat-${seatIdCounter}`;
    seatIdCounter += 1;
    seat.setAttr("sbSeatId", id);
    return id;
  }

  // Helper: Get human-readable seat label (e.g. "A1" or "T1-1")
function getSeatDisplayName(seat) {
  const row = seat.getAttr("sbSeatRowLabel") || "";
  const num = seat.getAttr("sbSeatLabel") || "";
  
  // Check if it's a table seat
  const group = seat.getParent();
  const type = group ? (group.getAttr("shapeType") || group.name()) : "";
  
  if (type === "circular-table" || type === "rect-table") {
    // T{TableLabel}-{SeatNumber}
    return `T${row}-${num}`;
  }
  // Standard row: {RowLabel}{SeatNumber}
  return row ? `${row}${num}` : num;
}
  
  function buildSeatRef(rowLabelText, seatLabelText) {
    const rowPart = rowLabelText || "";
    const seatPart = seatLabelText || "";
    const combined = `${rowPart}${seatPart}`.trim();
    return combined.length ? combined : null;
  }

  function setSeatRefAttributes(seat, ref, rowLabelText, seatLabelText) {
    if (!seat) return;
    ensureSeatIdAttr(seat);

    if (ref) seat.setAttr("sbSeatRef", ref);
    seat.setAttr("sbSeatRowLabel", rowLabelText || "");
    seat.setAttr("sbSeatLabel", seatLabelText || "");
  }

  function tagRowSeatReferences(group) {
    if (!(group instanceof Konva.Group)) return;

    const seats = group.find((n) => n.getAttr && n.getAttr("isSeat"));
    if (!seats || !seats.length) return;

    const seatsPerRow = Math.max(1, parseInt(group.getAttr("seatsPerRow"), 10) || 1);
    const rowCount = Math.max(1, parseInt(group.getAttr("rowCount"), 10) || 1);
    const everyRowSame = group.getAttr("everyRowSameSeats") !== false;
    let rowSeatCounts = group.getAttr("rowSeatCounts");
    if (!Array.isArray(rowSeatCounts)) rowSeatCounts = [];

    const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
    const seatStartRaw = group.getAttr("seatStart");
    const seatStart = Number.isFinite(Number(seatStartRaw)) ? Number(seatStartRaw) : 1;

    const rowLabelPrefix = group.getAttr("rowLabelPrefix") || "";
    const rowLabelStartRaw = group.getAttr("rowLabelStart");
    const rowLabelStart = Number.isFinite(Number(rowLabelStartRaw))
      ? Number(rowLabelStartRaw)
      : 0;

    const rowOrder = group.getAttr("rowOrder") === "desc" ? "desc" : "asc";

    let seatIdx = 0;
    for (let rIdx = 0; rIdx < rowCount; rIdx += 1) {
      const logicalRowIdx = rowOrder === "desc" ? rowCount - 1 - rIdx : rIdx;
      const rowLabelText =
        rowLabelPrefix + rowLabelFromIndex(rowLabelStart + logicalRowIdx);

      const rowSeats = everyRowSame
        ? seatsPerRow
        : Math.max(1, parseInt(rowSeatCounts[rIdx], 10) || seatsPerRow);

      for (let i = 0; i < rowSeats; i += 1) {
        const seat = seats[seatIdx];
        seatIdx += 1;
        if (!seat) continue;

        const seatLabelText =
          seatLabelMode !== "none"
            ? seatLabelFromIndex(seatLabelMode, i, seatStart)
            : `${seatStart + i}`;
        const ref = buildSeatRef(rowLabelText, seatLabelText);

        setSeatRefAttributes(seat, ref, rowLabelText, seatLabelText);
      }
    }
  }

  function tagCircularTableReferences(group) {
    if (!(group instanceof Konva.Group)) return;
    const seats = group.find((n) => n.getAttr && n.getAttr("isSeat"));
    if (!seats || !seats.length) return;

    const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
    const seatStartRaw = group.getAttr("seatStart");
    const seatStart = Number.isFinite(Number(seatStartRaw)) ? Number(seatStartRaw) : 1;
    const tableLabel = group.getAttr("tableLabel") || "Table";

    seats.forEach((seat, idx) => {
      const seatLabelText =
        seatLabelMode !== "none"
          ? seatLabelFromIndex(seatLabelMode, idx, seatStart)
          : `${seatStart + idx}`;
      const ref = buildSeatRef(tableLabel, seatLabelText || `${idx + 1}`);
      setSeatRefAttributes(seat, ref, tableLabel, seatLabelText);
    });
  }

  function tagRectTableReferences(group) {
    if (!(group instanceof Konva.Group)) return;
    const seats = group.find((n) => n.getAttr && n.getAttr("isSeat"));
    if (!seats || !seats.length) return;

    const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
    const seatStartRaw = group.getAttr("seatStart");
    const seatStart = Number.isFinite(Number(seatStartRaw)) ? Number(seatStartRaw) : 1;
    const tableLabel = group.getAttr("tableLabel") || "Table";

    seats.forEach((seat, idx) => {
      const seatLabelText =
        seatLabelMode !== "none"
          ? seatLabelFromIndex(seatLabelMode, idx, seatStart)
          : `${seatStart + idx}`;
      const ref = buildSeatRef(tableLabel, seatLabelText || `${idx + 1}`);
      setSeatRefAttributes(seat, ref, tableLabel, seatLabelText);
    });
  }

  function tagSingleSeatReference(group) {
    if (!(group instanceof Konva.Group)) return;
    const seat = group.findOne((n) => n.getAttr && n.getAttr("isSeat"));
    if (!seat) return;

    const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
    const seatLabelText = seatLabelMode === "letters" ? "A" : "1";
    const ref = buildSeatRef("", seatLabelText);
    setSeatRefAttributes(seat, ref, "", seatLabelText);
  }

  function refreshSeatMetadata() {
    if (!mapLayer || typeof mapLayer.find !== "function") return;

    const groups = mapLayer.find("Group");
    groups.forEach((g) => {
      const t = g.getAttr("shapeType") || g.name();
      if (t === "row-seats") tagRowSeatReferences(g);
      if (t === "circular-table") tagCircularTableReferences(g);
      if (t === "rect-table") tagRectTableReferences(g);
      if (t === "single-seat") tagSingleSeatReference(g);
    });

    mapLayer.find((n) => n.getAttr && n.getAttr("isSeat")).forEach((seat) => {
      ensureSeatIdAttr(seat);
      if (typeof seat.listening === "function") {
        seat.listening(true);
      }
      if (!seat.getAttr("sbSeatRef")) {
        setSeatRefAttributes(seat, seat.getAttr("sbSeatRef") || null, "", "");
      }
    });

    enforceUniqueSeatIds(mapLayer.find((n) => n.getAttr && n.getAttr("isSeat")));

    duplicateSeatRefs = computeDuplicateSeatRefsFromSeats(
      mapLayer.find((n) => n.getAttr && n.getAttr("isSeat"))
    );
  }

  function getAllSeatNodes() {
    if (!mapLayer || typeof mapLayer.find !== "function") return [];
    return mapLayer.find((n) => n.getAttr && n.getAttr("isSeat"));
  }

   // Helper: generate a truly unique seat ID, avoiding anything already in `seen`
  function generateUniqueSeatId(seen, baseRef) {
    // Prefer to base it off the human-readable ref if we have one
    if (baseRef) {
      let idx = 1;
      let candidate = `${baseRef}#${idx}`;
      while (seen.has(candidate)) {
        idx += 1;
        candidate = `${baseRef}#${idx}`;
      }
      return candidate;
    }

    // Fallback: use the global seatIdCounter
    let candidate;
    do {
      candidate = `seat-${seatIdCounter++}`;
    } while (seen.has(candidate));
    return candidate;
  }

  function enforceUniqueSeatIds(seats) {
    const seen = new Set();

    seats.forEach((seat) => {
      if (!seat) return;

      let sid = seat.getAttr("sbSeatId");
      const ref = seat.getAttr("sbSeatRef") || null;

      // If there is no id yet *or* this id is already used, mint a fresh one
      if (!sid || seen.has(sid)) {
        sid = generateUniqueSeatId(seen, ref);
      }

      if (sid) {
        seen.add(sid);
        seat.setAttr("sbSeatId", sid);
      }
    });
  }


  function findSeatNodeFromTarget(target) {
    if (!target) return null;

    const isSeatNode = (node) => node && node.getAttr && node.getAttr("isSeat");

    if (isSeatNode(target)) return target;

    if (typeof target.findAncestor === "function") {
      const seatAncestor = target.findAncestor((n) => isSeatNode(n), true);
      if (seatAncestor) return seatAncestor;
    }

    const group =
      typeof target.findAncestor === "function"
        ? target.findAncestor("Group", true)
        : null;

    if (isSeatNode(group)) return group;

    if (group && typeof group.find === "function") {
      const childSeat = group.find((child) => isSeatNode(child))[0];
      if (childSeat) return childSeat;
    }

    return null;
  }

    function computeDuplicateSeatRefsFromSeats(seats) {
    const counts = new Map();
    seats.forEach((seat) => {
      const ref = seat.getAttr("sbSeatRef");
      if (!ref) return;
      counts.set(ref, (counts.get(ref) || 0) + 1);
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([ref]) => ref)
    );
  }

  function findDuplicateSeatRefs() {
    // --- Refresh and recalc seat data ---
    refreshSeatMetadata();

    duplicateSeatRefs = computeDuplicateSeatRefsFromSeats(getAllSeatNodes());

    // --- Apply current visuals (this already calls updateTicketRings internally) ---
    applySeatVisuals();

    // We deliberately STOP here.
    // All ticket-ring overlays are now handled in applySeatVisuals -> updateTicketRings.
    // The legacy manual ring-drawing below caused the "double ring" issue.

    if (mapLayer && typeof mapLayer.batchDraw === "function") {
      mapLayer.batchDraw();
    }

    return duplicateSeatRefs;
  }

  // ----- Ticket ring overlays for multi-ticket seats -----

// [Source: 3495] - Updated to ensure rings only display in the 'tickets' tab.
function updateTicketRings() {
  if (!mapLayer) return;

  // 1. Always Clean up ALL existing rings first
  const allGroups = mapLayer.find("Group");
  allGroups.forEach((group) => {
    if (!group.getChildren) return;
    const existingRings = group.getChildren().filter((child) => {
      // Uses the custom attribute to identify rings for removal
      // Also checks name for legacy compatibility
      return (
        child.getAttr("isTicketRing") === true || child.name() === "ticket-ring"
      );
    });
    existingRings.forEach((ring) => ring.destroy());
  });

  // 2. If we are NOT in the Tickets tab, stop here.
  // This hides the rings immediately when switching tabs.
  if (activeMainTab !== "tickets") {
    if (stage) stage.batchDraw();
    return;
  }

  // 3. If we ARE in Tickets tab, draw the rings based on data
  const seats = getAllSeatNodes();
  if (!seats || !seats.length) return;

  // Create a quick lookup for ticket colors
  const ticketById = new Map();
  ticketTypes.forEach((t) => {
    if (t && t.id) ticketById.set(t.id, t);
  });

  seats.forEach((seatCircle) => {
    // Basic Validation
    if (!seatCircle || !seatCircle.getAttr || !seatCircle.getAttr("isSeat")) return;

    // Get Parent Group
    const group = seatCircle.getParent && seatCircle.getParent();
    if (!group) return;

    // Get Seat ID
    const sid = ensureSeatIdAttr(seatCircle);
    if (!sid) return;

    // Work out which tickets are assigned to this seat
    const set = ticketAssignments.get(sid);
    if (!set || !set.size) return;

    const ticketIds = Array.from(set);
    if (!ticketIds.length) return;

    // Base radius from the core seat circle
    const baseRadius =
      typeof seatCircle.radius === "function"
        ? seatCircle.radius()
        : seatCircle.getAttr("radius") || 8;

    // Draw new rings (max 10 rings per seat)
    const maxRings = Math.min(ticketIds.length, 10);
    for (let i = 0; i < maxRings; i += 1) {
      const tId = ticketIds[i];
      if (!tId) continue;
      const ticket = ticketById.get(tId);
      const color = (ticket && ticket.color) || "#2563eb";

      // Calculate radius: starts just outside the seat stroke
      const radius = baseRadius + 1.5 + i * 2.5;
      
      const ring = new Konva.Circle({
        x: seatCircle.x(),
        y: seatCircle.y(),
        radius,
        stroke: color,
        strokeWidth: 1.5,
        listening: false,
        name: "ticket-ring",
      });

      // Mark attributes so we can find and remove it later
      ring.setAttr("isTicketRing", true);
      ring.setAttr("ringOwnerSeatId", sid);
      
      group.add(ring);
    }
  });

  if (stage) {
    stage.batchDraw();
  }
}

/**
 * Applies the final visual overrides for Accessibility seats (Icon/C and color).
 * @param {Konva.Circle} seatCircle The Konva shape node for the seat circle.
 * @param {Konva.Group} group The parent group node containing the seat label.
 */
/**
 * Applies the final visual overrides for Accessibility seats (Icon/C and color).
 * @param {Konva.Circle} seatCircle The Konva shape node for the seat circle.
 * @param {Konva.Group} group The parent group node containing the seat label.
 */
function applyAccessibilityVisualsOverride(seatCircle, group) {
  const accessType = seatCircle.getAttr("sbAccessibilityType"); // "disabled" | "carer"
  const holdStatus = seatCircle.getAttr("sbHoldStatus");
  const activeTab = activeMainTab; // Global variable
  
  // 1. Cleanup ALL old overlays (Text, Rects, Images, Rings)
  const children = group.getChildren().slice(); // copy to avoid mutation issues while iterating
  children.forEach(node => {
    const name = node.name() || "";
    if (name.startsWith(`access-overlay-${seatCircle._id}`) || 
        name.startsWith(`access-image-${seatCircle._id}`) || 
        name.startsWith(`access-bg-${seatCircle._id}`) ||
        name.startsWith(`access-ring-${seatCircle._id}`) ||
        name.startsWith(`access-mode-label-${seatCircle._id}`)) {
      node.destroy();
    }
  });

  // 2. Find the original text label (e.g. "A1") to toggle its visibility
  const originalLabel = group.getChildren().find(n => 
     n.getClassName() === 'Text' && 
     Math.abs(n.x() - seatCircle.x()) < 1 && 
     Math.abs(n.y() - seatCircle.y()) < 1 &&
     !n.name().startsWith('access-') && 
     !n.name().startsWith('view-mode-')
  );

  if (accessType) {
    // Hide original label (A1)
    if (originalLabel) originalLabel.visible(false);

    // --- DISABLED SEAT (Custom Image + Status Ring) ---
    if (accessType === "disabled") {
      // Make the circle invisible but KEEP it technically 'visible' for hit detection
      seatCircle.opacity(0); 
      const size = (seatCircle.radius() * 2) || 20; 
      
      // Create Image Node
      const imageNode = new Konva.Image({
        x: seatCircle.x(),
        y: seatCircle.y(),
        width: size,
        height: size,
        listening: false, // Let clicks pass through to the (invisible) seat circle
        name: `access-image-${seatCircle._id}`
      });
      
      // Center the image perfectly
      imageNode.offsetX(size / 2);
      imageNode.offsetY(size / 2);
      group.add(imageNode);
      
      // Load the specific PNG
      const imgObj = new Image();
      imgObj.onload = function() {
         imageNode.image(imgObj);
         const layer = group.getLayer();
         if (layer) layer.batchDraw();
      };
      imgObj.src = "/seatmap-icons/disabledtoilets-dark.png";

      // ** NEW: Rings for Holds/Allocation on Disabled Seats **
      if (activeTab === "holds" && holdStatus) {
         let ringColor = null;
         if (holdStatus === "hold") ringColor = "#000000"; // Black Ring for Hold
         else if (holdStatus === "allocation") ringColor = "#10B981"; // Green Ring for Promoter
         
         if (ringColor) {
             const ring = new Konva.Circle({
                 x: seatCircle.x(),
                 y: seatCircle.y(),
                 radius: seatCircle.radius() + 4, // Slightly larger than the seat/icon
                 stroke: ringColor,
                 strokeWidth: 3,
                 listening: false,
                 name: `access-ring-${seatCircle._id}`
             });
             group.add(ring);
         }
      }
    } 
    
    // --- CARER SEAT (Standard Style with 'C') ---
    else if (accessType === "carer") {
      seatCircle.opacity(1);
      seatCircle.visible(true);
      
      let textColor = "#111827"; // Default Black Text
      
      // Logic for visuals based on tab/status
      if (activeTab === "holds" && holdStatus === "hold") {
          // Held: Black Body, White 'C'
          seatCircle.fill("#000000");
          seatCircle.stroke("#000000");
          textColor = "#ffffff";
      } else if (activeTab === "holds" && holdStatus === "allocation") {
          // Allocation: Green Body, Black 'C'
          seatCircle.fill("#10B981");
          seatCircle.stroke("#10B981");
          textColor = "#000000";
      } else {
          // Default Carer Style (White body, standard stroke)
          seatCircle.fill("#ffffff");
          seatCircle.stroke("#4b5563");
      }
      
      seatCircle.strokeWidth(1.7);

      // Draw 'C'
      const text = new Konva.Text({
        x: seatCircle.x(),
        y: seatCircle.y(),
        text: "C",
        fontSize: 14, 
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontStyle: "bold",
        fill: textColor, 
        align: 'center',
        verticalAlign: 'middle',
        listening: false,
        name: `access-overlay-${seatCircle._id}`
      });
      
      // Center text
      text.offsetX(text.width() / 2);
      text.offsetY(text.height() / 2);
      group.add(text);
    }
  } else {
    // --- RESTORE STANDARD STATE ---
    seatCircle.opacity(1);
    seatCircle.visible(true);
    // The main applySeatVisuals loop will handle resetting color/stroke
    if (originalLabel) originalLabel.visible(true);
  }
}
 function applySeatVisuals() {
  refreshSeatMetadata();
  const seats = getAllSeatNodes();
  // Recalculate duplicates (mainly for the Tickets tab warning)
  duplicateSeatRefs = computeDuplicateSeatRefsFromSeats(seats);
  seats.forEach((seat) => {
    // 1. Reset to Base Styles (The "Map" tab look)
    const baseFill = seat.getAttr("sbSeatBaseFill") || "#ffffff";
    const baseStroke = seat.getAttr("sbSeatBaseStroke") || "#4b5563";
    let stroke = baseStroke;
    let fill = baseFill;
    let strokeWidth = 1.7;
    // Data Attributes
    const ref = seat.getAttr("sbSeatRef");
    const ticketId = seat.getAttr("sbTicketId") || null;
    const holdStatus = seat.getAttr("sbHoldStatus");
    const hasViewImage = !!seat.getAttr("sbViewImage");
    const hasInfo = !!seat.getAttr("sbInfoLabel");
    // 2. Apply Tab-Specific Visuals
    // --- TAB: TICKETS (Changes fill/stroke for assigned seats) ---
    if (activeMainTab === "tickets") {
      // Priority A: Duplicates (Critical Error)
      if (ref && duplicateSeatRefs.has(ref)) {
        stroke = "#ef4444";
        fill = "#fee2e2";
      }
      // Priority B: Assigned Ticket (Change stroke color)
      else if (ticketId) {
        const ticket = ticketTypes.find((t) => t.id === ticketId);
        if (ticket) {
          stroke = ticket.color || "#2563eb";
        }
      }
    }
    // --- TAB: HOLDS & ALLOCATIONS (Changes fill/stroke to solid black/green) ---
    else if (activeMainTab === "holds") {
      if (holdStatus === "hold") {
        stroke = "#000000";
        fill = "#000000";
      } else if (holdStatus === "allocation") {
        stroke = "#10B981";
        fill = "#10B981";
      }
    }
    // --- TAB: VIEW & INFO (Changes fill/stroke for seats with V/i data) ---
    else if (activeMainTab === "view") {
      if (hasViewImage || hasInfo) {
        stroke = "#000000";
        fill = "#000000";
      }
    }
    // 3. Apply the calculated styles
    seat.stroke(stroke);
    seat.fill(fill);
    seat.strokeWidth(strokeWidth);
    // 4. Handle Overlay Text (V / i)
    const parent = seat.getParent();
    if (parent) {
      // **CRITICAL CLEANUP**: Always remove old labels when applying visuals
      // We use seat._id to ensure uniqueness if seatId attr isn't set yet
      // --- CLEANUP OVERLAYS ---
      const oldLabel = parent.findOne(`.view-mode-label-${seat._id}`);
      if (oldLabel) oldLabel.destroy();
      const oldAccess = parent.findOne(`.access-mode-label-${seat._id}`);
      if (oldAccess) oldAccess.destroy();
      
      // --- VIEW MODE VISUALS (Only in View Tab) ---
      // Only draw new labels if we are strictly in the View tab
      if (activeMainTab === "view") {
        let char = "";
        let fontStyle = "bold";
        let fontFamily = "system-ui";
        let fontSize = 11;
        if (hasViewImage) {
          char = "V";
        } else if (hasInfo) {
          char = "i";
          fontFamily = '"Times New Roman", serif';
          fontStyle = "bold";
          fontSize = 14; 
        }
        // Draw the character over the black seat
        if (char) {
          const text = new Konva.Text({
            x: seat.x(),
            y: seat.y(),
            text: char,
            fontSize: fontSize,
            fontFamily: fontFamily,
            fontStyle: fontStyle,
            fill: "#ffffff",
            listening: false,
            name: `view-mode-label-${seat._id}`
          });
          // Center the text over the seat
          text.offsetX(text.width() / 2);
          text.offsetY(text.height() / 2);
          parent.add(text);
        }
      }
    }
    // --- ACCESSIBILITY VISUAL OVERRIDE (Must be the final step) ---
    // This delegates the final look (Icons, Rings, Colors for Carers) to the specific function
    const groupForAccess = seat.getParent();
    if (groupForAccess) {
        applyAccessibilityVisualsOverride(seat, groupForAccess);
    }
  });
  
  // Always call the ring function here, which handles its own show/hide logic
  updateTicketRings();
  if (mapLayer && typeof mapLayer.batchDraw === "function") {
    mapLayer.batchDraw();
  }
}
  
  function formatDateTimeLocal(date) {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return "";

    const pad = (n) => `${n}`.padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function deriveVenueCurrency() {
    const fromWindow = window.__SEATMAP_VENUE_CURRENCY__;
    const fromMeta =
      (showMeta && (showMeta.currency || (showMeta.venue && showMeta.venue.currency))) || null;
    const code = ((fromWindow || fromMeta || venueCurrencyCode || "GBP") + "").toUpperCase();
    venueCurrencyCode = code || "GBP";
  }

  function ensureTicketDefaults(ticket) {
    if (!ticket) return;

    const nowValue = formatDateTimeLocal(new Date());
    const showDateValue = showMeta && showMeta.date ? formatDateTimeLocal(showMeta.date) : nowValue;

    if (!ticket.onSale) ticket.onSale = nowValue;
    if (!ticket.offSale) ticket.offSale = showDateValue;
    if (!ticket.minPerOrder) ticket.minPerOrder = 1;
    if (!ticket.maxPerOrder) ticket.maxPerOrder = Math.max(ticket.minPerOrder, 15);
    if (!ticket.currency) ticket.currency = venueCurrencyCode;
    if (!ticket.color) ticket.color = DEFAULT_TICKET_COLORS[0] || "#2563eb";

  }

  function ensureTicketFormDefaults() {
    const nowValue = formatDateTimeLocal(new Date());
    if (!ticketFormState.onSale) {
      ticketFormState.onSale = nowValue;
    }

    const showDateValue = showMeta && showMeta.date ? formatDateTimeLocal(showMeta.date) : "";
    if (!ticketFormState.offSale) {
      ticketFormState.offSale = showDateValue || nowValue;
      ticketFormAutoOffSale = true;
    }

    if (!ticketFormState.minPerOrder) {
      ticketFormState.minPerOrder = "1";
    }

    if (!ticketFormState.maxPerOrder) {
      ticketFormState.maxPerOrder = "15";
    }
  }

  function applyShowMeta(data) {
    if (!data || !data.show) return;
    showMeta = data.show;
    deriveVenueCurrency();
    const showDateValue = showMeta && showMeta.date ? formatDateTimeLocal(showMeta.date) : "";
    if (showDateValue && (ticketFormAutoOffSale || !ticketFormState.offSale)) {
      ticketFormState.offSale = showDateValue;
      ticketFormAutoOffSale = true;
    }
    ensureTicketFormDefaults();

    if (activeMainTab === "tickets") {
      renderTicketingPanel();
    }
  }

  async function ensureShowMetaLoaded() {
    if (showMeta || isLoadingShowMeta) return;
    isLoadingShowMeta = true;

    try {
      const res = await fetch(
        `/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}`
      );

      if (!res.ok) return;
      const data = await res.json();
      applyShowMeta(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[seatmap] show meta fetch failed", err);
    } finally {
      isLoadingShowMeta = false;
    }
  }

  function formatTicketPrice(value) {
    if (!Number.isFinite(value)) return "Free";

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: venueCurrencyCode || "GBP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch (err) {
      return `${venueCurrencyCode || ""} ${value.toFixed(2)}`.trim();
    }
  }

  function getShowDateLimit() {
    if (!showMeta || !showMeta.date) return null;
    const d = new Date(showMeta.date);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function getActiveTicketIdForAssignments() {
    const exists = ticketTypes.some((t) => t.id === activeTicketSelectionId);
    if (activeTicketSelectionId && exists) return activeTicketSelectionId;
    return ticketTypes.length ? ticketTypes[0].id : null;
  }

function refreshSeatTicketListeners() {
    // 1. Cleanup old DOM listeners
    if (window.ticketSeatDomListener && stage && stage.container()) {
        stage.container().removeEventListener("pointerdown", window.ticketSeatDomListener, true);
        window.ticketSeatDomListener = null;
    }

    // 2. Helper: Hover Effects (Visual Feedback)
    const attachHoverEffect = (node, isText = true) => {
        node.off('.ticketAssignHover');
        node.on('mouseover.ticketAssignHover', () => {
            if (!ticketSeatSelectionMode) return;
            stage.container().style.cursor = "pointer";

            // Determine Hover Color
            let color = "#2563eb"; // Blue (Default/Tickets)
            
            if (activeHoldMode === 'allocation') color = "#10B981"; // Green (Promoter)
            else if (activeHoldMode === 'hold') color = "#000000"; // Black (Hold)
            else if (activeViewMode) color = "#000000"; // Black (View/Info)
            else {
                // Specific Ticket Color
                const tid = getActiveTicketIdForAssignments();
                const ticket = ticketTypes.find(t => t.id === tid);
                if (ticket && ticket.color) color = ticket.color;
            }

            // Apply Visuals
            if (isText) {
                if (!node.getAttr('__origFill')) node.setAttr('__origFill', node.fill());
                node.fill(color);
            } else {
                if (!node.getAttr('__origStroke')) node.setAttr('__origStroke', node.stroke());
                node.stroke(color);
                node.strokeWidth(3);
            }
            mapLayer.batchDraw();
        });

        node.on('mouseout.ticketAssignHover', () => {
            if (!ticketSeatSelectionMode) return;
            stage.container().style.cursor = "default";
            
            // Restore Visuals
            if (isText) {
                node.fill(node.getAttr('__origFill') || "#111827");
            } else {
                node.stroke(node.getAttr('__origStroke') || "#4b5563");
                node.strokeWidth(1.7);
            }
            mapLayer.batchDraw();
        });
    };

    // 3. Helper: Click Handler
    const attachHandler = (node) => {
        node.off('click.ticketAssign tap.ticketAssign');
        node.on("click.ticketAssign tap.ticketAssign", (evt) => {
            evt.cancelBubble = true; // IMPORTANT: Stop bubbling
            handleTicketSeatSelection(stage.getPointerPosition(), evt.target);
        });
    };

    // 4. Attach to Elements
    if (mapLayer) {
        // A. Single Seats
        getAllSeatNodes().forEach(seat => attachHandler(seat));

        // B. Groups (Row Blocks & Tables)
        const groups = mapLayer.find("Group");
        groups.forEach(group => {
            const type = group.getAttr("shapeType") || group.name();

            // --- ROW BLOCKS ---
            if (type === "row-seats") {
                // 1. Container (Hit Rect) - Send to BOTTOM
                const hitRect = group.findOne(".hit-rect");
                if (hitRect) {
                    hitRect.moveToBottom(); // <--- FIX: Ensure container is BEHIND labels
                    attachHandler(hitRect);
                    
                    // Make hollow so gaps are ignored
                    hitRect.fillEnabled(false); 
                    hitRect.fill(null);
                    
                    // Border click area
                    hitRect.stroke("rgba(0,0,0,0)");
                    hitRect.strokeWidth(15); 
                    hitRect.hitStrokeWidth(15);

                    // Container Hover
                    hitRect.off('.ticketAssignHover');
                    hitRect.on('mouseover.ticketAssignHover', () => {
                        if (!ticketSeatSelectionMode || activeViewType === 'view') return;
                        stage.container().style.cursor = "copy";
                        hitRect.stroke(activeHoldMode || activeViewMode ? '#000000' : '#2563eb');
                        hitRect.strokeWidth(2); 
                        hitRect.dash([6, 4]);
                        mapLayer.batchDraw();
                    });
                    hitRect.on('mouseout.ticketAssignHover', () => {
                        if (!ticketSeatSelectionMode) return;
                        stage.container().style.cursor = "default";
                        hitRect.stroke("rgba(0,0,0,0)"); 
                        hitRect.strokeWidth(15);
                        hitRect.dash([]);
                        mapLayer.batchDraw();
                    });
                }

                // 2. Row Labels - Bring to TOP
                const labels = group.find(n => n.getAttr("isRowLabel"));
                labels.forEach(lbl => {
                    lbl.moveToTop(); // <--- FIX: Ensure label sits ON TOP of container border
                    lbl.listening(true); // Explicitly enable listening
                    attachHandler(lbl);
                    attachHoverEffect(lbl, true);
                });
            }

            // --- TABLES ---
            if (type === "circular-table" || type === "rect-table") {
                const body = group.findOne(".body-rect");
                const label = group.findOne(".table-label");
                
                if (body) {
                    attachHandler(body);
                    if (activeViewType !== 'view') attachHoverEffect(body, false);
                }
                if (label) {
                    label.moveToTop(); // Ensure label isn't buried
                    attachHandler(label);
                    if (activeViewType !== 'view') attachHoverEffect(label, true);
                }
            }
        });
    }
}
  function addDebugStagePointerListener() {
    // Only bind the debug listener once
    if (!stage || stage._hasDebugListener) return;

    stage.on("pointerdown.debug", function (evt) {
        const target = evt.target;
        const targetName = target.name() || target.className;
        const targetType = target.getClassName();
        const seatId = target.getAttr && target.getAttr('seatId');

        // This log will fire on EVERY click on the canvas (Stage).
        // Check the 'target' and 'isSeat' properties to see what Konva is actually detecting.
        // eslint-disable-next-line no-console
        console.log("[seatmap][DEBUG-GLOBAL] STAGE POINTERDOWN: Click Target Found", {
            targetClass: targetType,
            targetName: targetName,
            targetSeatId: seatId,
            isSeat: !!seatId, // Check if the target has a seat ID
            isSelectionMode: !!window.ticketSeatSelectionMode,
            eventPhase: evt.evt ? evt.evt.eventPhase : 'N/A'
        });
    });

    stage._hasDebugListener = true;
}

  function addDebugContainerPointerListener() {
    if (!stage || !stage.container) return;
    const container = stage.container();
    if (!container || container._hasAggressiveDebugListener) return;

    const aggressiveDebugHandler = (evt) => {
        // This will fire first on ANY click inside the Konva canvas container element
        // regardless of whether Konva finds a shape or not.
        const isSeatMode = !!window.ticketSeatSelectionMode;
        
        // eslint-disable-next-line no-console
        console.log("[seatmap][DEBUG-DOM-AGGR] DOM POINTERDOWN CAPTURED", {
            eventTarget: evt.target.className || evt.target.tagName,
            isSeatMode: isSeatMode,
            isCancelled: evt.defaultPrevented,
            currentTarget: evt.currentTarget.tagName
        });
        
        // If seat assignment is active, we must try to force the event to continue down
        // to Konva's processing layer by *not* cancelling it here.
    };

    // Bind in the CAPTURE phase (true)
    container.addEventListener("pointerdown", aggressiveDebugHandler, true);
    container._hasAggressiveDebugListener = true;
}

  function addDebugDocumentPointerListener() {
    if (window._hasDocumentAggressiveDebugListener) return;

    const aggressiveDocumentHandler = (evt) => {
        // This will fire first on ANY pointerdown event in the entire browser window
        const targetClass = evt.target.className || evt.target.tagName;
        const isCanvasClick = targetClass.includes('konvajs-content');

        // This log WILL FIRE. If it doesn't, your browser console settings are wrong.
        // eslint-disable-next-line no-console
        console.log("[seatmap][DEBUG-DOCUMENT-AGGR] DOCUMENT POINTERDOWN CAPTURED", {
            eventTarget: targetClass,
            isCanvasClick: isCanvasClick,
            isCancelled: evt.defaultPrevented,
            eventPhase: evt.eventPhase
        });
        
        // If the click is on the canvas area and seat selection mode is on,
        // we can forcibly prevent any document-level defaults that might be running.
        if (isCanvasClick && window.ticketSeatSelectionMode) {
            // DO NOT stop propagation here, only prevent default
            // evt.preventDefault(); // Uncomment only if the log shows the event is stopped by an outer element
        }
    };

    // Bind to the document in the CAPTURE phase (true)
    document.addEventListener("pointerdown", aggressiveDocumentHandler, true);
    window._hasDocumentAggressiveDebugListener = true;
}
  
function setTicketSeatSelectionMode(enabled, reason = "unknown") {
const prev = ticketSeatSelectionMode;
// FIX: Sync both local and global state so all event handlers respect the mode
ticketSeatSelectionMode = !!enabled;
window.ticketSeatSelectionMode = !!enabled;
ticketSeatSelectionReason = reason || "unknown";

ticketSeatSelectionAction = "toggle";

addDebugStagePointerListener();
addDebugContainerPointerListener();
addDebugDocumentPointerListener();
// 1. Force the Layer to listen
if (mapLayer && typeof mapLayer.listening === "function") {
mapLayer.listening(true);
}
// 2. LOCK/UNLOCK DRAGGING & RESTORE STATE
if (mapLayer) {
const allGroups = mapLayer.find('Group');
allGroups.forEach(g => {
g.draggable(!enabled); // Disable drag in ticket mode

// Restore solid fill when leaving ticket mode so dragging works again
if (!enabled) {
const hr = g.findOne('.hit-rect');
if (hr) {
hr.fill("rgba(0,0,0,0)");
hr.fillEnabled(true); // Re-enable fill hit
hr.stroke(null);
hr.strokeWidth(0);
hr.hitStrokeWidth(0);
hr.off('.ticketAssignHover');
}

// Restore original colors
const labels = g.find(n => n.getAttr('isRowLabel') || n.name() === 'table-label');
labels.forEach(lbl => {
if (lbl.getAttr('__origFill')) lbl.fill(lbl.getAttr('__origFill'));
lbl.off('.ticketAssignHover');
});
const bodies = g.find('.body-rect');
bodies.forEach(b => {
if (b.getAttr('__origStroke')) b.stroke(b.getAttr('__origStroke'));
if (b.strokeWidth() === 3) b.strokeWidth(1.7);
b.off('.ticketAssignHover');
});
}
});
}
// 3. Force all seats to listen
const seats = getAllSeatNodes();
seats.forEach((seat) => {
if (typeof seat.listening === "function") seat.listening(true);
let parent = seat.getParent && seat.getParent();
while (parent) {
if (typeof parent.listening === "function") parent.listening(true);
parent = parent.getParent && parent.getParent();
}
});
// 4. Re-apply listeners
refreshSeatTicketListeners();
// eslint-disable-next-line no-console
console.log("[seatmap][tickets] seat-selection-mode", {
enabled: ticketSeatSelectionMode,
activeTicketId: activeTicketSelectionId,
seatCount: seats.length,
reason: ticketSeatSelectionReason,
});

if (!ticketSeatSelectionMode) {
clearSelection();
if (transformer && typeof transformer.nodes === "function") {
transformer.nodes([]);
}
}
if (mapLayer) mapLayer.batchDraw();
}

  
    function ensureSeatTicketSet(seat) {
    if (!seat || typeof seat.getAttr !== "function" || typeof seat.setAttr !== "function") {
      return { sid: null, set: null };
    }

    let sid = seat.getAttr("sbSeatId");
    if (!sid) {
      sid = ensureSeatIdAttr(seat);
      if (!sid) return { sid: null, set: null };
      seat.setAttr("sbSeatId", sid);
    }

    // Read existing sbTicketIds array from the node (multi-ticket)
    let arr = seat.getAttr("sbTicketIds");
    if (!Array.isArray(arr)) {
      const single = seat.getAttr("sbTicketId") || null;
      arr = single ? [single] : [];
    }

    const set = new Set(arr);
    return { sid, set };
  }


    function rebuildTicketAssignmentsCache() {
    const map = new Map();
    const seats = getAllSeatNodes();

    seats.forEach((seat) => {
      const sid = ensureSeatIdAttr(seat);
      if (!sid) return;

      // Prefer multi-ticket array if present
      let ticketIds = seat.getAttr("sbTicketIds");
      if (!Array.isArray(ticketIds)) {
        const single = seat.getAttr("sbTicketId") || null;
        ticketIds = single ? [single] : [];
      }

      if (ticketIds.length > 0) {
        map.set(sid, new Set(ticketIds));
        // Keep legacy sbTicketId in sync with the "primary" ticket
        seat.setAttr("sbTicketId", ticketIds[0]);
      } else {
        seat.setAttr("sbTicketId", null);
      }
    });

    // ticketAssignments is now Map<seatId, Set<ticketId>>
    ticketAssignments = map;
  }


  function toggleSeatTicketAssignment(seat, ticketId) {
  // --- INTERCEPT FOR VIEW / INFO TAB ---
  if (activeViewMode && activeViewType) {
    
    // 1. VIEW MODE (Image Upload - Single Seat)
    if (activeViewType === "view") {
      // Find the hidden input
      const fileInput = document.getElementById("sb-hidden-view-upload");
      if (!fileInput) return;

      // Handle file selection
      fileInput.onchange = (e) => {
        if (fileInput.files && fileInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target.result; // Base64 image
            // Save to seat attribute
            seat.setAttr("sbViewImage", result);
            seat.setAttr("sbViewInfoId", "has-image"); // Legacy/Marker
            applySeatVisuals();
            pushHistory();
          };
          reader.readAsDataURL(fileInput.files[0]);
        }
        // Reset input so change event fires again for same file
        fileInput.value = ""; 
      };

      // Check if image exists to toggle off? 
      // The prompt implies we click to upload. 
      // If they click an existing one, let's confirm removal or re-upload.
      const existing = seat.getAttr("sbViewImage");
      if (existing) {
        if (confirm("This seat already has a View image. Click OK to Remove it, or Cancel to replace it.")) {
          seat.setAttr("sbViewImage", null);
          seat.setAttr("sbViewInfoId", null);
          applySeatVisuals();
          pushHistory();
          return;
        }
      }
      
      // Trigger the file dialog
      fileInput.click();
      return; 
    }

    // 2. INFO MODE (Text - Multi Seat)
    if (activeViewType === "info") {
      const lblInput = document.getElementById("sb-info-label");
      const descInput = document.getElementById("sb-info-desc");
      const labelVal = lblInput ? lblInput.value : "";
      const descVal = descInput ? descInput.value : "";

      // Check if seat already has info
      const currentLabel = seat.getAttr("sbInfoLabel");
      
      // Logic: If clicking a seat that HAS info, remove it.
      // If clicking a seat with NO info, apply inputs.
      if (currentLabel) {
        seat.setAttr("sbInfoLabel", null);
        seat.setAttr("sbInfoDesc", null);
      } else {
        if (!labelVal && !descVal) {
          alert("Please enter a Label or Description in the right-hand panel before selecting seats.");
          return;
        }
        seat.setAttr("sbInfoLabel", labelVal);
        seat.setAttr("sbInfoDesc", descVal);
      }
      applySeatVisuals(); // Redraw
      return;
    }
  }

  // --- INTERCEPT FOR HOLDS (Existing) ---
  if (activeHoldMode) {
    const currentStatus = seat.getAttr("sbHoldStatus");
    if (currentStatus === activeHoldMode) {
      seat.setAttr("sbHoldStatus", null);
    } else {
      seat.setAttr("sbHoldStatus", activeHoldMode);
    }
    return;
  }

  // --- STANDARD TICKET LOGIC (Existing) ---
  const { sid, set } = ensureSeatTicketSet(seat);
  if (!sid || !set || !ticketId) return;
  const hadTicket = set.has(ticketId);
  if (hadTicket) {
    set.delete(ticketId);
  } else {
    set.add(ticketId);
  }
  const ids = Array.from(set);
  seat.setAttr("sbTicketIds", ids);
  seat.setAttr("sbTicketId", ids[0] || null);
  if (ids.length > 0) {
    ticketAssignments.set(sid, new Set(ids));
  } else {
    ticketAssignments.delete(sid);
  }
}
  
function handleTicketSeatSelection(pointerPos, target) {
    // -----------------------------------------------------------
    // 1. ACCESSIBILITY MODE INTERCEPT (High Priority)
    // -----------------------------------------------------------
    // This allows clicks to work on the Map tab ONLY if we are in Disabled/Carer mode
    if (activeAccessibilityMode) {
        let seat = findSeatNodeFromTarget(target);
        // Try to find seat under pointer if target wasn't direct hit
        if (!seat && stage && pointerPos) {
            const vis = target.visible();
            target.visible(false);
            const under = stage.getIntersection(pointerPos);
            target.visible(vis);
            if (under) seat = findSeatNodeFromTarget(under);
        }

        if (seat) {
            const current = seat.getAttr("sbAccessibilityType");
            const next = (current === activeAccessibilityMode) ? null : activeAccessibilityMode;
            seat.setAttr("sbAccessibilityType", next);

            const group = seat.getParent();
            if (group) applyAccessibilityVisualsOverride(seat, group);

            applySeatVisuals();
            pushHistory();
            return true;
        }
        return false;
    }

    // -----------------------------------------------------------
    // 2. TAB SAFETY GUARD
    // -----------------------------------------------------------
    // If we are NOT in accessibility mode, and we are on the MAP tab,
    // we block ticket assignments so we don't accidentally assign tickets/holds while editing.
    if (activeMainTab === "map") return false;

    // -----------------------------------------------------------
    // 3. ASSIGNMENT MODE (Tickets / Holds / Info)
    // -----------------------------------------------------------
    let activeId = null;
    if (activeHoldMode) activeId = activeHoldMode; 
    else if (activeViewMode) activeId = activeViewType;
    else activeId = getActiveTicketIdForAssignments();

    if (!activeId) return false;

    const toggleList = (seats) => {
        if (!seats || !seats.length) return;

        if (activeViewType === "view") {
            alert("View images must be assigned to individual seats.");
            return;
        }

        // A. INFO
        if (activeViewType === "info") {
            const lbl = document.getElementById("sb-info-label")?.value;
            const desc = document.getElementById("sb-info-desc")?.value;
            if (!lbl && !desc) { alert("Enter Label/Description first."); return; }
            const firstHas = !!seats[0].getAttr("sbInfoLabel");
            seats.forEach(s => {
                s.setAttr("sbInfoLabel", firstHas ? null : lbl);
                s.setAttr("sbInfoDesc", firstHas ? null : desc);
            });
        }
        // B. HOLDS
        else if (activeHoldMode) {
            const firstStatus = seats[0].getAttr("sbHoldStatus");
            const newStatus = (firstStatus === activeHoldMode) ? null : activeHoldMode;
            seats.forEach(s => {
                s.setAttr("sbHoldStatus", newStatus);
            });
        }
        // C. TICKETS
        else {
            const { set: firstSet } = ensureSeatTicketSet(seats[0]);
            const shouldAdd = !(firstSet && firstSet.has(activeId));
            seats.forEach(s => {
                const { sid, set } = ensureSeatTicketSet(s);
                if (shouldAdd) set.add(activeId);
                else set.delete(activeId);
                
                const ids = Array.from(set);
                s.setAttr("sbTicketIds", ids);
                s.setAttr("sbTicketId", ids[0] || null);
                if (ids.length) ticketAssignments.set(sid, new Set(ids));
                else ticketAssignments.delete(sid);
            });
            rebuildTicketAssignmentsCache();
        }

        applySeatVisuals();
        if (activeHoldMode) renderHoldsPanel();
        else if (!activeViewMode) renderTicketingPanel();
        pushHistory();
    };

    // -----------------------------------------------------------
    // 4. TARGET IDENTIFICATION (Group Clicks)
    // -----------------------------------------------------------

    // A. ROW LETTER CLICK
    if (target && target.getAttr("isRowLabel")) {
        const txt = target.text().trim(); 
        const group = target.getParent();
        if (group && txt) {
            const seats = group.find(n => n.getAttr("isSeat") && n.getAttr("sbSeatRowLabel") === txt);
            if (seats.length) { toggleList(seats); return true; }
        }
    }

    // B. BLOCK BORDER CLICK
    if (target && target.name() === "hit-rect") {
        const group = target.getParent();
        if (group && group.getAttr("shapeType") === "row-seats") {
            const seats = group.find(n => n.getAttr("isSeat"));
            if (seats.length) { toggleList(seats); return true; }
        }
    }

    // C. TABLE CLICK
    if (target && (target.name() === "body-rect" || target.name() === "table-label")) {
        const group = target.getParent();
        if (group && (group.name() === "circular-table" || group.name() === "rect-table")) {
            const seats = group.find(n => n.getAttr("isSeat"));
            if (seats.length) { toggleList(seats); return true; }
        }
    }

    // D. SINGLE SEAT CLICK
    let seat = findSeatNodeFromTarget(target);
    if (!seat && stage && pointerPos) {
        const vis = target.visible();
        target.visible(false);
        const under = stage.getIntersection(pointerPos);
        target.visible(vis);
        if (under) seat = findSeatNodeFromTarget(under);
    }

    if (seat) {
        toggleSeatTicketAssignment(seat, activeId);
        applySeatVisuals();
        if (activeHoldMode) renderHoldsPanel();
        else if (!activeViewMode) renderTicketingPanel();
        pushHistory();
        return true;
    }

    return false;
}
  
  function getSelectedSeatNodes() {
    const nodes =
      transformer && transformer.nodes && transformer.nodes().length
        ? transformer.nodes()
        : selectedNode
        ? [selectedNode]
        : [];

    const seats = [];

    nodes.forEach((node) => {
      if (!node) return;
      if (node.getAttr && node.getAttr("isSeat")) seats.push(node);
      if (typeof node.find === "function") {
        node
          .find((child) => child.getAttr && child.getAttr("isSeat"))
          .forEach((seat) => seats.push(seat));
      }
    });

    return seats;
  }
function renderTicketingPanel() {
  const el = getInspectorElement();
  if (!el) return;

  ensureShowMetaLoaded();
  ensureTicketFormDefaults();
  const duplicates = findDuplicateSeatRefs();
  rebuildTicketAssignmentsCache();

  el.innerHTML = "";

  // --- Header ---
  const titleWrap = document.createElement("div");
  titleWrap.className = "sb-ticketing-heading";
  titleWrap.innerHTML = `
    <div class="sb-ticketing-title">Tickets</div>
    <div class="sb-ticketing-sub">Create ticket types and assign them to seats.</div>
  `;
  el.appendChild(titleWrap);

  // --- Warning Box ---
  if (duplicates.size) {
    const warning = document.createElement("div");
    warning.className = "sb-ticketing-alert";
    warning.innerHTML = `<strong>Attention Needed:</strong><br/>You have duplicate seat references. Fix the highlighted seats before creating tickets.`;
    el.appendChild(warning);
  }

  // --- Setup Active Ticket State ---
  const ensureActiveTicket = () => {
    if (!ticketTypes.length) {
      activeTicketSelectionId = null;
      return;
    }
    const hasActive = ticketTypes.some((t) => t.id === activeTicketSelectionId);
    if (!hasActive) {
      activeTicketSelectionId = ticketTypes[0].id;
    }
  };
  ensureActiveTicket();

  // --- Ticket List Container ---
  const ticketsContainer = document.createElement("div");
  ticketsContainer.className = "sb-ticket-stack";
  el.appendChild(ticketsContainer);

  // --- Empty State ---
  if (!ticketTypes.length) {
    const empty = document.createElement("div");
    empty.className = "sb-inspector-empty";
    empty.textContent = "No tickets created yet.";
    ticketsContainer.appendChild(empty);
  }

  // --- Helper to make input fields ---
  const makeField = (labelText, inputEl, helperText) => {
    const wrapper = document.createElement("div");
    wrapper.className = "sb-field-col";
    const label = document.createElement("label");
    label.className = "sb-label";
    label.textContent = labelText;
    wrapper.appendChild(label);
    wrapper.appendChild(inputEl);
    if (helperText) {
      const helper = document.createElement("div");
      helper.className = "sb-helper";
      helper.style.fontSize = "11px";
      helper.style.color = "#94a3b8";
      helper.style.marginTop = "4px";
      helper.textContent = helperText;
      wrapper.appendChild(helper);
    }
    return wrapper;
  };

  // --- Render Each Ticket Card ---
  ticketTypes.forEach((ticket) => {
    ensureTicketDefaults(ticket);
    const assignedTotal = countAssignmentsForTicket(ticket.id);
    const isActive = activeTicketSelectionId === ticket.id;
    const isOpen = ticketAccordionOpenIds.has(ticket.id);

    const card = document.createElement("div");
    card.className = "sb-ticket-card";
    if (isActive) card.classList.add("is-active");

    // Modern Header
    const header = document.createElement("button");
    header.type = "button";
    header.className = "sb-ticket-card-header";
    header.innerHTML = `
      <div class="sb-ticket-main-info">
        <div class="sb-ticket-color-dot" style="background:${ticket.color || "#2563eb"};"></div>
        <div>
          <div class="sb-ticket-name">${(ticket.name || "Untitled ticket").slice(0, 30)}</div>
          <div class="sb-ticket-meta">${formatTicketPrice(ticket.price)} · ${assignedTotal} assigned</div>
        </div>
      </div>
      <div style="color: #cbd5e1; transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s;">
        ▼
      </div>
    `;

    header.addEventListener("click", () => {
      activeTicketSelectionId = ticket.id;
      if (ticketAccordionOpenIds.has(ticket.id)) {
        ticketAccordionOpenIds.delete(ticket.id);
      } else {
        ticketAccordionOpenIds.add(ticket.id);
      }
      renderTicketingPanel();
    });
    card.appendChild(header);

    // Card Body (Form)
    if (isOpen) {
      const body = document.createElement("div");
      body.className = "sb-ticket-card-body";
      
      const formGrid = document.createElement("div");
      formGrid.className = "sb-form-grid";

      // 1. Name Input
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "sb-input";
      nameInput.placeholder = "E.g. Standard Admission";
      nameInput.value = ticket.name || "";
      nameInput.addEventListener("input", () => { ticket.name = nameInput.value; });
      nameInput.addEventListener("blur", () => { renderTicketingPanel(); });
      nameInput.addEventListener("keydown", (ev) => { if (ev.key === "Enter") nameInput.blur(); });

      // 2. Price Input
      const priceInput = document.createElement("input");
      priceInput.type = "text";
      priceInput.inputMode = "decimal";
      priceInput.className = "sb-input";
      priceInput.placeholder = "0.00";
      priceInput.value = ticket.price === null || ticket.price === undefined ? "" : String(ticket.price);
      
      const commitPrice = () => {
        const raw = (priceInput.value || "").replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
        if (!raw) ticket.price = null;
        else {
            const p = parseFloat(raw);
            ticket.price = Number.isFinite(p) ? p : 0;
        }
        renderTicketingPanel();
      };
      priceInput.addEventListener("blur", commitPrice);
      priceInput.addEventListener("keydown", (ev) => { if(ev.key === "Enter") { ev.preventDefault(); priceInput.blur(); }});

      // 3. Color Selection
      const colorWrap = document.createElement("div");
      colorWrap.style.display = "flex";
      colorWrap.style.gap = "8px";
      colorWrap.style.alignItems = "center";
      
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.className = "sb-input";
      colorInput.style.width = "40px"; 
      colorInput.style.padding = "2px";
      colorInput.style.height = "38px";
      colorInput.value = ticket.color || "#2563EB";
      
      const hexDisplay = document.createElement("input");
      hexDisplay.type="text";
      hexDisplay.className="sb-input";
      hexDisplay.value = ticket.color || "#2563EB";
      
      const syncColor = (val) => {
        ticket.color = val;
        ticketFormState.color = val;
        applySeatVisuals();
        renderTicketingPanel();
      };
      
      colorInput.addEventListener("input", () => { syncColor(colorInput.value); });
      hexDisplay.addEventListener("change", () => { syncColor(hexDisplay.value); });
      
      colorWrap.appendChild(colorInput);
      colorWrap.appendChild(hexDisplay);

      // 4. Dates
      const onSaleInput = document.createElement("input");
      onSaleInput.type = "datetime-local";
      onSaleInput.className = "sb-input";
      onSaleInput.value = ticket.onSale || ticketFormState.onSale || formatDateTimeLocal(new Date());
      onSaleInput.addEventListener("input", () => { ticket.onSale = onSaleInput.value; });

      const offSaleInput = document.createElement("input");
      offSaleInput.type = "datetime-local";
      offSaleInput.className = "sb-input";
      offSaleInput.value = ticket.offSale || ticketFormState.offSale || formatDateTimeLocal(new Date());
      offSaleInput.addEventListener("input", () => { 
          ticket.offSale = offSaleInput.value; 
          ticketFormAutoOffSale = false; 
      });

      // 5. Min/Max
      const minInput = document.createElement("input");
      minInput.type = "number"; minInput.className = "sb-input"; minInput.value = ticket.minPerOrder || 1;
      minInput.addEventListener("change", () => { ticket.minPerOrder = parseInt(minInput.value) || 1; });

      const maxInput = document.createElement("input");
      maxInput.type = "number"; maxInput.className = "sb-input"; maxInput.value = ticket.maxPerOrder || 15;
      maxInput.addEventListener("change", () => { ticket.maxPerOrder = parseInt(maxInput.value) || 15; });

      // Append Fields to Grid
      formGrid.appendChild(makeField("Ticket Name", nameInput));
      formGrid.appendChild(makeField(`Price (${venueCurrencyCode})`, priceInput));
      formGrid.appendChild(makeField("Seat Color", colorWrap, "Color used on the map"));
      formGrid.appendChild(makeField("On Sale Time", onSaleInput));
      formGrid.appendChild(makeField("Off Sale Time", offSaleInput));
      
      const limitsRow = document.createElement("div");
      limitsRow.style.display="grid";
      limitsRow.style.gridTemplateColumns="1fr 1fr";
      limitsRow.style.gap="12px";
      
      const minWrap = makeField("Min per Order", minInput);
      const maxWrap = makeField("Max per Order", maxInput);
      limitsRow.appendChild(minWrap);
      limitsRow.appendChild(maxWrap);
      formGrid.appendChild(limitsRow);

      body.appendChild(formGrid);

      // --- Actions Section ---
      const actionsDiv = document.createElement("div");
      actionsDiv.style.marginTop = "16px";
      actionsDiv.style.borderTop = "1px solid #f1f5f9";
      actionsDiv.style.paddingTop = "16px";
      // Use flex column to stack the buttons nicely
      actionsDiv.style.display = "flex";
      actionsDiv.style.flexDirection = "column";
      actionsDiv.style.gap = "8px";
      
      // 1. Manual Assign Button
      const assignBtn = document.createElement("button");
      assignBtn.type = "button";
      assignBtn.className = "tool-button";
      
      const isSelectMode = ticketSeatSelectionMode && activeTicketSelectionId === ticket.id;
      assignBtn.textContent = isSelectMode ? "Done Selecting" : "Select Seats on Map";
      if(isSelectMode) {
          assignBtn.style.background = "#eff6ff"; 
          assignBtn.style.borderColor="#08B8E8"; 
          assignBtn.style.color="#08B8E8";
      }

      assignBtn.onclick = () => {
          activeTicketSelectionId = ticket.id;
          const enabling = !ticketSeatSelectionMode;
          setTicketSeatSelectionMode(enabling, "ticket-panel");
          renderTicketingPanel();
      };

      // 2. Assign Remaining (only empty seats)
      const assignRemBtn = document.createElement("button");
      assignRemBtn.type = "button";
      assignRemBtn.className = "tool-button";
      assignRemBtn.textContent = "Assign Remaining Empty Seats";
      assignRemBtn.onclick = () => {
          if (confirm(`Assign all currently unassigned seats to ${ticket.name}?`)) {
             const seats = getAllSeatNodes();
             seats.forEach(s => {
                 const { sid, set } = ensureSeatTicketSet(s);
                 // Only add if no other tickets exist
                 if (set.size === 0) {
                     set.add(ticket.id);
                     s.setAttr("sbTicketIds", Array.from(set));
                     s.setAttr("sbTicketId", ticket.id);
                     ticketAssignments.set(sid, set);
                 }
             });
             rebuildTicketAssignmentsCache();
             applySeatVisuals();
             renderTicketingPanel();
          }
      };

      // 3. Assign ALL Seats
      const assignAllBtn = document.createElement("button");
      assignAllBtn.type = "button";
      assignAllBtn.className = "tool-button";
      assignAllBtn.textContent = "Assign All Seats";
      assignAllBtn.onclick = () => {
          if (confirm(`Assign EVERY seat on the map to ${ticket.name}? This will add this ticket to seats that already have others assigned.`)) {
             const seats = getAllSeatNodes();
             enforceUniqueSeatIds(seats);
             
             seats.forEach(s => {
                 const { sid, set } = ensureSeatTicketSet(s);
                 if (!set) return;
                 // Add this ticket if not already there
                 if (!set.has(ticket.id)) {
                     // Check max limit just in case
                     if (set.size >= 10) return;
                     set.add(ticket.id);
                     const ids = Array.from(set);
                     s.setAttr("sbTicketIds", ids);
                     s.setAttr("sbTicketId", ids[0] || null); // Sync legacy ID
                     ticketAssignments.set(sid, set);
                 }
             });
             rebuildTicketAssignmentsCache();
             applySeatVisuals();
             renderTicketingPanel();
             pushHistory();
          }
      };

      // 4. Delete Ticket Button (NEW)
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "tool-button sb-ghost-button";
      deleteBtn.textContent = "Delete Ticket";
      deleteBtn.style.marginTop = "8px";
      deleteBtn.style.color = "#ef4444"; // Red text
      deleteBtn.style.borderColor = "#fee2e2"; // Light red border
      
      deleteBtn.onclick = () => {
          if(!confirm(`Are you sure you want to delete "${ticket.name}"?\nThis will remove it from all assigned seats.`)) return;
          
          // 1. Remove this ticket from all seats
          const seats = getAllSeatNodes();
          seats.forEach(s => {
             const { sid, set } = ensureSeatTicketSet(s);
             if (set && set.has(ticket.id)) {
                 set.delete(ticket.id);
                 const ids = Array.from(set);
                 s.setAttr("sbTicketIds", ids);
                 s.setAttr("sbTicketId", ids[0] || null);
                 if (ids.length === 0) {
                    ticketAssignments.delete(sid);
                 } else {
                    ticketAssignments.set(sid, set);
                 }
             }
          });
          
          // 2. Remove from global array
          ticketTypes = ticketTypes.filter(t => t.id !== ticket.id);
          
          // 3. Reset active state if needed
          if (activeTicketSelectionId === ticket.id) {
             activeTicketSelectionId = ticketTypes.length > 0 ? ticketTypes[0].id : null;
          }

          // 4. Refresh
          rebuildTicketAssignmentsCache();
          applySeatVisuals();
          renderTicketingPanel();
          pushHistory();
      };

      actionsDiv.appendChild(assignBtn);
      actionsDiv.appendChild(assignRemBtn);
      actionsDiv.appendChild(assignAllBtn);
      actionsDiv.appendChild(deleteBtn); // Added to end of list
      
      body.appendChild(actionsDiv);
      card.appendChild(body);
    }
    
    ticketsContainer.appendChild(card);
  });

  // --- BIG BLUE ADD BUTTON ---
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "sb-btn-primary-large";
  addBtn.innerHTML = `<span>＋</span> Add New Ticket`;
  
  addBtn.addEventListener("click", () => {
    ensureTicketFormDefaults();
    const nowValue = formatDateTimeLocal(new Date());
    const showDateValue = (showMeta && showMeta.date && formatDateTimeLocal(showMeta.date)) || nowValue;
    const colorForNewTicket = getNextTicketColor();
    
    const newTicket = {
      id: `ticket-${Date.now()}-${ticketTypes.length + 1}`,
      name: "", // Start blank
      price: 0,
      currency: venueCurrencyCode,
      color: colorForNewTicket,
      onSale: nowValue,
      offSale: showDateValue,
      minPerOrder: 1,
      maxPerOrder: 15,
    };
    
    ticketTypes.push(newTicket);
    activeTicketSelectionId = newTicket.id;
    // Auto-open the new ticket
    ticketAccordionOpenIds.clear();
    ticketAccordionOpenIds.add(newTicket.id);
    
    applySeatVisuals();
    renderTicketingPanel();
  });

  el.appendChild(addBtn);

  // Add spacer so content doesn't sit flush against footer
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);

    // CALL THE FOOTER RENDERER
    renderSidebarFooter(); 
}
  
function renderHoldsPanel() {
  const el = getInspectorElement();
  if (!el) return;

  // 1. Calculate Stats
  const seats = getAllSeatNodes();
  let holdCount = 0;
  let allocCount = 0;
  let allocSeatLabels = []; // For the email generation

  seats.forEach(seat => {
    const status = seat.getAttr("sbHoldStatus");
    if (status === "hold") holdCount++;
    if (status === "allocation") {
      allocCount++;
      // --- NEW LOGIC: Detect Table vs Row for Labeling ---
      const row = seat.getAttr("sbSeatRowLabel") || "";
      const num = seat.getAttr("sbSeatLabel") || "";
      // Get parent group to check if it's a table
      const group = seat.getParent();
      const type = group ? (group.getAttr("shapeType") || group.name()) : "";
      let label = "";
      if (type === "circular-table" || type === "rect-table") {
        label = `T${row}-${num}`;
      } else {
        label = row ? `${row}${num}` : num;
      }
      if (label) allocSeatLabels.push(label);
    }
  });

  el.innerHTML = "";

  // 2. Title
  const titleWrap = document.createElement("div");
  titleWrap.className = "sb-ticketing-heading";
  titleWrap.innerHTML = `
    <div class="sb-ticketing-title">Holds & Allocations</div>
    <div class="sb-ticketing-sub">Block seats or assign to promoters.</div>
  `;
  el.appendChild(titleWrap);

  // --- STACK CONTAINER ---
  const stack = document.createElement("div");
  stack.className = "sb-ticket-stack";
  el.appendChild(stack);

  // 3. Helper to create the Modern "Card" (Identical to Tickets Tab)
  const createStatusCard = (type, label, color, count, description) => {
    const isActive = activeHoldMode === type;
    const card = document.createElement("div");
    card.className = "sb-ticket-card";
    if (isActive) card.classList.add("is-active");

    // --- HEADER ---
    const header = document.createElement("div");
    header.className = "sb-ticket-card-header";
    header.innerHTML = `
      <div class="sb-ticket-main-info">
        <div class="sb-ticket-color-dot" style="background:${color};"></div>
        <div>
          <div class="sb-ticket-name">${label}</div>
          <div class="sb-ticket-meta">${count} seats assigned · ${description}</div>
        </div>
      </div>
      <div style="color: #cbd5e1; transform: ${isActive ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s;">
        ▼
      </div>
    `;

    // Header Click: Toggle Mode
    header.addEventListener("click", () => {
      if (isActive) {
        activeHoldMode = null; // Toggle off
        setTicketSeatSelectionMode(false, "holds-off");
      } else {
        activeHoldMode = type;
        setTicketSeatSelectionMode(true, "holds-on");
      }
      renderHoldsPanel();
    });
    card.appendChild(header);

    // --- BODY (Specific Logic for Allocation) ---
    if (isActive && type === "allocation") {
      const body = document.createElement("div");
      body.className = "sb-ticket-card-body";

      // A. Allocation Summary with Explainer
      const summaryText = allocSeatLabels.length > 0 ? allocSeatLabels.join(", ") : "No seats allocated yet.";
      const summaryHtml = `
        <p style="font-size:12px; color:#6b7280; margin-bottom:12px; line-height:1.4;">
          These tickets will be assigned to an external promoter. 
          <span style="color:#ef4444; font-weight:600;">Note: These tickets will be marked as OFF SALE on Tixall.</span>
        </p>
        <div class="sb-field-col" style="margin-bottom:12px;">
          <label class="sb-label">Allocated Seats</label>
          <textarea class="sb-input sb-textarea" readonly style="height:60px;">${summaryText}</textarea>
        </div>
        <button class="tool-button" id="btn-email-promoter" style="margin-bottom:16px;">
          Email Allocation to Promoter
        </button>
        <div style="border-top:1px solid #f1f5f9; margin-bottom:16px;"></div>
      `;
      const summaryDiv = document.createElement("div");
      summaryDiv.innerHTML = summaryHtml;
      body.appendChild(summaryDiv);

      // B. Weekly Reports Form with Explainer
      const reportsHtml = `
        <div class="sb-ticketing-title" style="font-size:13px; margin-bottom:4px;">Weekly Box Office Reports</div>
        <p style="font-size:12px; color:#6b7280; margin-bottom:12px; line-height:1.4;">
          Automatically send a summary of sales and remaining inventory to the promoter at a scheduled time.
        </p>
        <div class="sb-field-col" style="margin-bottom:8px;">
          <label class="sb-label">Recipient Email</label>
          <input type="email" class="sb-input" id="rpt-email" value="${holdReportSettings.email}" placeholder="promoter@example.com">
        </div>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <div class="sb-field-col" style="flex:1;">
            <label class="sb-label">Day</label>
            <select class="sb-select" id="rpt-day">
              <option value="Monday">Monday</option>
              <option value="Friday">Friday</option>
            </select>
          </div>
          <div class="sb-field-col" style="flex:1;">
            <label class="sb-label">Time</label>
            <input type="time" class="sb-input" id="rpt-time" value="${holdReportSettings.time}">
          </div>
        </div>
        <button class="tool-button sb-ghost-button" id="btn-save-report">
          Save Report Settings
        </button>
      `;
      const reportsDiv = document.createElement("div");
      reportsDiv.innerHTML = reportsHtml;
      body.appendChild(reportsDiv);

      card.appendChild(body);

      // Wire up Buttons inside the body (Timeout ensures DOM is ready)
      setTimeout(() => {
        // 1. Email Promoter
        const btnEmail = document.getElementById("btn-email-promoter");
        if(btnEmail) btnEmail.onclick = (e) => {
          e.stopPropagation(); // Prevent card toggle
          const subject = encodeURIComponent(`Ticket Allocation: ${showMeta ? showMeta.title : 'Event'}`);
          const b = encodeURIComponent(
            `Hi,\n\nHere are the seats allocated for ${showMeta ? showMeta.title : 'the event'} on ${showMeta ?
            new Date(showMeta.date).toLocaleDateString() : 'TBC'}.\n\nTotal Seats: ${allocCount}\nSeat Numbers: ${summaryText}\n\nVenue: ${showMeta && showMeta.venue ? showMeta.venue.name : ''}\n`
          );
          window.open(`mailto:?subject=${subject}&body=${b}`);
        };

        // 2. Save Reports
        const btnSave = document.getElementById("btn-save-report");
        const selDay = document.getElementById("rpt-day");
        if(selDay) selDay.value = holdReportSettings.day;

        if(btnSave) btnSave.onclick = async (e) => {
          e.stopPropagation(); // Prevent card toggle
          const email = document.getElementById("rpt-email").value;
          const day = document.getElementById("rpt-day").value;
          const time = document.getElementById("rpt-time").value;
          holdReportSettings = { email, day, time };

          try {
            await fetch(`/admin/seating/builder/api/holds/${encodeURIComponent(showId)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reportEmail: email, reportDay: day, reportTime: time })
            });
            alert("Weekly report settings saved.");
          } catch(err) {
            console.error(err);
            alert("Failed to save settings.");
          }
        };
        // Stop propagation on inputs so typing doesn't close the card
        const inputs = body.querySelectorAll("input, select, textarea");
        inputs.forEach(i => i.addEventListener("click", e => e.stopPropagation()));
      }, 0);
    }

    // --- BODY (Specific Logic for General Hold - Instructions only) ---
    if (isActive && type === "hold") {
       const body = document.createElement("div");
       body.className = "sb-ticket-card-body";
       body.innerHTML = `
         <div style="font-size:12px; color:#6b7280; padding-top:4px;">
           Click seats on the map to mark them as <b>General Holds</b>. These seats will be blocked from sale but not assigned to a specific promoter.
         </div>
       `;
       card.appendChild(body);
    }

    return card;
  };

  // 4. Append Cards
  stack.appendChild(createStatusCard(
    "hold",
    "General Hold",
    "#000000",
    holdCount,
    "Blocked from sale"
  ));
  stack.appendChild(createStatusCard(
    "allocation",
    "Promoter Allocation",
    "#10B981",
    allocCount,
    "External partners"
  ));
  const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);

    renderSidebarFooter();
}
  
function renderViewFromSeatsPanel() {
  const el = getInspectorElement();
  if (!el) return;
  el.innerHTML = "";

  // 1. Collect Data (Keep existing logic)
  const seats = getAllSeatNodes();
  const viewSeats = [];
  const infoGroups = {}; // Map<Label, Array<Seat>>

  seats.forEach(seat => {
    const sid = ensureSeatIdAttr(seat);
    // View Data
    const img = seat.getAttr("sbViewImage");
    if (img) {
      viewSeats.push({
        id: sid,
        node: seat,
        image: img,
        label: getSeatDisplayName(seat)
      });
    }
    // Info Data
    const infoLabel = seat.getAttr("sbInfoLabel");
    if (infoLabel) {
      if (!infoGroups[infoLabel]) infoGroups[infoLabel] = [];
      infoGroups[infoLabel].push({
        id: sid,
        node: seat,
        desc: seat.getAttr("sbInfoDesc"),
        label: getSeatDisplayName(seat)
      });
    }
  });

  // Sort seats naturally
  const sortFn = (a, b) => a.label.localeCompare(b.label, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  viewSeats.sort(sortFn);

  // 2. Header
  const titleWrap = document.createElement("div");
  titleWrap.className = "sb-ticketing-heading";
  titleWrap.innerHTML = `
    <div class="sb-ticketing-title">Seating Information</div>
    <div class="sb-ticketing-sub">Manage sightlines and seat restrictions.</div>
  `;
  el.appendChild(titleWrap);

  // Hidden File Input for "Active Mode" clicks (Preserve ID for toggleSeatTicketAssignment)
  const globalFileInput = document.createElement("input");
  globalFileInput.type = "file";
  globalFileInput.accept = "image/*";
  globalFileInput.style.display = "none";
  globalFileInput.id = "sb-hidden-view-upload";
  el.appendChild(globalFileInput);

  // 3. Stack Container
  const stack = document.createElement("div");
  stack.className = "sb-ticket-stack";
  el.appendChild(stack);

  // --- HELPER: Create Modern Card ---
  const createCard = (type, title, meta, iconContent, isActive, renderBodyContent) => {
    const card = document.createElement("div");
    card.className = "sb-ticket-card";
    if (isActive) card.classList.add("is-active");

    // Header
    const header = document.createElement("div");
    header.className = "sb-ticket-card-header";
    header.innerHTML = `
      <div class="sb-ticket-main-info">
        <div class="sb-ticket-color-dot" style="background:#111827; display:flex; align-items:center; justify-content:center; color:white; font-size:10px; font-weight:bold;">
          ${iconContent}
        </div>
        <div>
          <div class="sb-ticket-name">${title}</div>
          <div class="sb-ticket-meta">${meta}</div>
        </div>
      </div>
      <div style="color: #cbd5e1; transform: ${isActive ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s;">
        ▼
      </div>
    `;

    // Toggle Logic
    header.addEventListener("click", () => {
      if (activeViewType === type) {
        activeViewType = null;
        setTicketSeatSelectionMode(false, "view-off");
      } else {
        activeViewType = type;
        setTicketSeatSelectionMode(true, "view-on");
      }
      renderViewFromSeatsPanel();
      applySeatVisuals();
    });

    card.appendChild(header);

    // Body (only if active)
    if (isActive) {
      const body = document.createElement("div");
      body.className = "sb-ticket-card-body";
      renderBodyContent(body);
      card.appendChild(body);
    }

    return card;
  };

  // ==========================================
  // CARD 1: VIEW FROM SEATS
  // ==========================================
  const viewCount = viewSeats.length;
  const viewMeta = `${viewCount} view${viewCount !== 1 ? 's' : ''} added`;

  stack.appendChild(createCard("view", "View from Seats", viewMeta, "V", activeViewType === "view", (body) => {
    // A. Instructions
    const intro = document.createElement("div");
    intro.style.cssText = "font-size:13px; color:#64748b; margin-bottom:16px; line-height:1.4; background:#f8fafc; padding:12px; border-radius:8px; border:1px dashed #cbd5e1;";
    intro.innerHTML = `Click any seat on the map to upload a view image.`;
    body.appendChild(intro);

    // B. List of Existing Views (INSIDE CARD BODY)
    if (viewSeats.length > 0) {
      const listDiv = document.createElement("div");
      listDiv.style.display = "flex";
      listDiv.style.flexDirection = "column";
      listDiv.style.gap = "8px";

      viewSeats.forEach(item => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; gap:10px; padding:8px; border:1px solid #e2e8f0; border-radius:8px; background:white;";

        // Thumbnail
        const thumb = document.createElement("img");
        thumb.src = item.image;
        thumb.style.cssText = "width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid #f1f5f9; background:#f8fafc;";
        row.appendChild(thumb);

        // Label
        const info = document.createElement("div");
        info.style.flex = "1";
        info.innerHTML = `<div style="font-weight:600; font-size:13px; color:#334155;">${item.label}</div>`;
        row.appendChild(info);

        // Actions
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "4px";

        // Edit Button
        const btnEdit = document.createElement("button");
        btnEdit.className = "tool-button";
        btnEdit.style.cssText = "width:28px; height:28px; padding:0;";
        btnEdit.innerHTML = "✎"; // Simple pencil icon
        btnEdit.title = "Change Image";
        btnEdit.onclick = (e) => {
          e.stopPropagation();
          const tempInput = document.createElement("input");
          tempInput.type = "file";
          tempInput.accept = "image/*";
          tempInput.onchange = (ev) => {
            if (tempInput.files[0]) {
              const reader = new FileReader();
              reader.onload = (readEv) => {
                item.node.setAttr("sbViewImage", readEv.target.result);
                renderViewFromSeatsPanel();
                applySeatVisuals();
                pushHistory();
              };
              reader.readAsDataURL(tempInput.files[0]);
            }
          };
          tempInput.click();
        };
        actions.appendChild(btnEdit);

        // Delete Button
        const btnDel = document.createElement("button");
        btnDel.className = "tool-button";
        btnDel.style.cssText = "width:28px; height:28px; padding:0; color:#ef4444; border-color:#fee2e2;";
        btnDel.innerHTML = "×";
        btnDel.title = "Remove View";
        btnDel.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Remove view from ${item.label}?`)) {
            item.node.setAttr("sbViewImage", null);
            item.node.setAttr("sbViewInfoId", null);
            applySeatVisuals();
            renderViewFromSeatsPanel();
            pushHistory();
          }
        };
        actions.appendChild(btnDel);

        row.appendChild(actions);
        listDiv.appendChild(row);
      });
      body.appendChild(listDiv);
    }
  }));

  // ==========================================
  // CARD 2: INFORMATION
  // ==========================================
  const infoGroupCount = Object.keys(infoGroups).length;
  const infoMeta = `${infoGroupCount} active group${infoGroupCount !== 1 ? 's' : ''}`;

  stack.appendChild(createCard("info", "Information", infoMeta, "i", activeViewType === "info", (body) => {
    // A. Inputs Section (Must preserve IDs for global click handlers)
    const formHtml = `
      <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
        <div class="sb-field-col" style="margin-bottom:8px;">
          <label class="sb-label">Label</label>
          <input type="text" class="sb-input" id="sb-info-label" placeholder="e.g. Restricted View">
        </div>
        <div class="sb-field-col" style="margin-bottom:8px;">
          <label class="sb-label">Description</label>
          <textarea class="sb-input sb-textarea" id="sb-info-desc" placeholder="e.g. Limited legroom..."></textarea>
        </div>
        <div style="font-size:11px; color:#64748b;">
          Select seats on the map to apply this info.
        </div>
      </div>
    `;
    const formDiv = document.createElement("div");
    formDiv.innerHTML = formHtml;
    // Stop propagation on inputs so typing doesn't close card
    formDiv.querySelectorAll("input, textarea").forEach(i => i.addEventListener("click", e => e.stopPropagation()));
    body.appendChild(formDiv);

    // B. List of Existing Info (INSIDE CARD BODY)
    const labels = Object.keys(infoGroups).sort();
    if (labels.length > 0) {
      const listDiv = document.createElement("div");
      listDiv.style.display = "flex";
      listDiv.style.flexDirection = "column";
      listDiv.style.gap = "12px";

      labels.forEach(lbl => {
        // Group Header
        const grpHead = document.createElement("div");
        grpHead.style.cssText = "font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #f1f5f9; padding-bottom:4px; margin-bottom:4px;";
        grpHead.textContent = lbl;
        listDiv.appendChild(grpHead);

        // Seats in this group
        infoGroups[lbl].forEach(item => {
          const row = document.createElement("div");
          row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f8fafc;";

          const left = document.createElement("div");
          left.innerHTML = `
            <div style="font-size:13px; font-weight:500; color:#334155;">${item.label}</div>
            <div style="font-size:11px; color:#94a3b8;">${(item.desc || "").slice(0, 30)}${item.desc && item.desc.length > 30 ? '...' : ''}</div>
          `;

          const btnRem = document.createElement("button");
          btnRem.className = "sb-btn-unlock-all"; // Reuse link style button
          btnRem.style.cssText = "width:auto; margin:0; color:#ef4444; text-decoration:none; font-size:11px;";
          btnRem.textContent = "Remove";
          btnRem.onclick = (e) => {
            e.stopPropagation();
            item.node.setAttr("sbInfoLabel", null);
            item.node.setAttr("sbInfoDesc", null);
            renderViewFromSeatsPanel();
            applySeatVisuals();
            pushHistory();
          };

          row.appendChild(left);
          row.appendChild(btnRem);
          listDiv.appendChild(row);
        });
      });
      body.appendChild(listDiv);
    }
  }));

  // 4. Next Step Button
  const nextBtn = document.createElement("button");
  nextBtn.className = "sb-next-step-btn";
  nextBtn.style.cssText = "width:100%; margin-top:16px; padding:12px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;";
  nextBtn.textContent = "Mark View Step Complete";
  nextBtn.onclick = () => {
    window.__TIXALL_COMPLETION_STATUS__.view = true;
    updateCompletionUI();
    const s = window.__TIXALL_COMPLETION_STATUS__;
    if (s.map && s.tickets && s.holds && s.view) {
      alert("All steps complete! You can now Publish the show from the top bar.");
    } else {
      alert("View step marked complete.");
    }
  };
  el.appendChild(nextBtn);
const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);

    renderSidebarFooter();
  
}
function clearAssignmentsFromGroup(group) {
  if (!group || typeof group.find !== 'function') return;

  // FIX: Must use "Circle" string selector to find seats reliably in Konva
  const seats = group.find("Circle").filter(n => n.getAttr("isSeat"));

  seats.forEach(seat => {
    // Atomically clear all assignment attributes
    seat.setAttrs({
      sbTicketId: null,
      sbTicketIds: [],
      sbHoldStatus: null,
      sbAccessibilityType: null,
      sbViewImage: null,
      sbInfoLabel: null,
      sbInfoDesc: null,
      sbViewInfoId: null
    });
    
    // Remove from assignment cache
    const sid = seat.getAttr("sbSeatId");
    if(sid && ticketAssignments.has(sid)) {
      ticketAssignments.delete(sid);
    }
  });

  // Re-run standard updates
  rebuildTicketAssignmentsCache();
  refreshSeatMetadata();
  applySeatVisuals();
  updateTicketRings();
  pushHistory();
}

  // Renders the Fixed Footer with the Blue Button
function renderSidebarFooter() {
    const footer = document.getElementById("sb-sidebar-footer");
    if (!footer) return;

    footer.innerHTML = ""; // Clear previous
    const tab = activeMainTab;
    const validation = window.__TIXALL_TAB_VALIDATION__[tab];

    // 1. Render Errors (if marked complete but invalid)
    // We check if the tab has been visited/marked done (s[tab]) AND has errors
    if (window.__TIXALL_COMPLETION_STATUS__[tab] && !validation.valid && validation.errors.length > 0) {
        const errBox = document.createElement("div");
        errBox.className = "sb-validation-list";
        validation.errors.forEach(err => {
            const row = document.createElement("div");
            row.className = "sb-validation-error";
            row.innerHTML = `<span> ⚠️ </span> <span>${err}</span>`;
            errBox.appendChild(row);
        });
        footer.appendChild(errBox);
    }

    // 2. Render Button
    const btn = document.createElement("button");
    btn.className = "sb-btn-primary-large";
    btn.style.width = "100%";
    btn.style.marginTop = "0"; // Override class margin as container handles padding
    btn.textContent = "Mark This Section Complete";

    btn.onclick = () => {
        // Run Validation
        const res = validateCurrentTabLogic(tab);
        
        // Save Validation State
        window.__TIXALL_TAB_VALIDATION__[tab] = res;
        
        // Mark as "Visited/Complete" regardless of errors
        window.__TIXALL_COMPLETION_STATUS__[tab] = true;
        
        // Update UI (Top Bar Ticks/Crosses)
        updateCompletionUI();
        
        // Re-render footer to show errors if they exist now
        renderSidebarFooter();

        // Move to Next Tab Logic
        const tabOrder = ['map', 'tickets', 'holds', 'view'];
        const idx = tabOrder.indexOf(tab);
        if (idx > -1 && idx < tabOrder.length - 1) {
            const nextTab = tabOrder[idx + 1];
            // Simulate click on top bar to switch
            switchBuilderTab(nextTab); 
        } else if (idx === tabOrder.length - 1) {
            // Last tab (View)
            if (res.valid) {
               alert("All sections complete. You can now Publish.");
            } else {
               alert("Section marked complete, but please check the errors listed.");
            }
        }
    };

    footer.appendChild(btn);
}
  
function renderInspector(node) {
  const el = getInspectorElement();
  if (!el) return;

  // If we are actually in the TICKETS tab, use that panel instead
  if (activeMainTab === "tickets") {
    renderTicketingPanel();
    return;
  }

  el.innerHTML = "";

  // =========================================================
  // 1. UI HELPER FUNCTIONS
  // =========================================================
  const addTitle = (text) => {
    const h = document.createElement("h4");
    h.className = "sb-inspector-title";
    h.textContent = text;
    el.appendChild(h);
  };

  const addStaticRow = (lbl, val) => {
    const d = document.createElement("div");
    d.className = "sb-field-row sb-field-static";
    d.innerHTML = `<div class="sb-static-label">${lbl}</div><div class="sb-static-value">${val}</div>`;
    el.appendChild(d);
  };

  const addTextField = (label, value, onChange) => {
    const d = document.createElement("div");
    d.className = "sb-field-row";
    d.innerHTML = `<label class="sb-label">${label}</label>`;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sb-input";
    input.value = value || "";
    input.onchange = (e) => onChange(e.target.value);
    d.appendChild(input);
    el.appendChild(d);
  };

  const addNumberField = (label, value, min, max, step, onChange) => {
    const d = document.createElement("div");
    d.className = "sb-field-row";
    d.innerHTML = `<label class="sb-label">${label}</label>`;
    const input = document.createElement("input");
    input.type = "number";
    input.className = "sb-input";
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    input.onchange = (e) => onChange(Number(e.target.value));
    d.appendChild(input);
    el.appendChild(d);
  };

  const addSelectField = (label, value, options, onChange) => {
    const d = document.createElement("div");
    d.className = "sb-field-row";
    d.innerHTML = `<label class="sb-label">${label}</label>`;
    const sel = document.createElement("select");
    sel.className = "sb-select";
    options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = (e) => onChange(e.target.value);
    d.appendChild(sel);
    el.appendChild(d);
  };

  const addCheckboxField = (label, checked, onChange) => {
    const d = document.createElement("div");
    d.className = "sb-field-row";
    d.style.display = "flex";
    d.style.alignItems = "center";
    d.style.justifyContent = "space-between";
    const lbl = document.createElement("label");
    lbl.className = "sb-label";
    lbl.style.marginBottom = "0";
    lbl.textContent = label;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!checked;
    input.onchange = (e) => onChange(e.target.checked);
    d.appendChild(lbl);
    d.appendChild(input);
    el.appendChild(d);
  };

  const addColorField = (label, value, onChange) => {
    const d = document.createElement("div");
    d.className = "sb-field-row";
    d.innerHTML = `<label class="sb-label">${label}</label>`;
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "8px";
    const input = document.createElement("input");
    input.type = "color";
    input.className = "sb-input";
    input.style.width = "40px";
    input.style.padding = "2px";
    input.value = value;
    input.oninput = (e) => onChange(e.target.value);
    const text = document.createElement("input");
    text.type = "text";
    text.className = "sb-input";
    text.value = value;
    text.onchange = (e) => onChange(e.target.value);
    wrap.appendChild(input);
    wrap.appendChild(text);
    d.appendChild(wrap);
    el.appendChild(d);
  };

  const addRangeField = (label, value, min, max, step, onChange) => {
    const d = document.createElement("div");
    d.className = "sb-field-row";
    d.innerHTML = `<label class="sb-label">${label}</label>`;
    const input = document.createElement("input");
    input.type = "range";
    input.style.width = "100%";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.oninput = (e) => onChange(Number(e.target.value));
    d.appendChild(input);
    el.appendChild(d);
  };

  const addFlipButton = (node) => {
    const btn = document.createElement("button");
    btn.className = "tool-button";
    btn.textContent = "Flip Horizontally";
    btn.style.marginTop = "8px";
    btn.onclick = () => {
      const currentScaleX = node.scaleX();
      node.scaleX(-currentScaleX);
      if (typeof keepLabelsUpright === "function") keepLabelsUpright(node);
      if (overlayLayer) overlayLayer.batchDraw();
      if (mapLayer) mapLayer.batchDraw();
      pushHistory();
    };
    el.appendChild(btn);
  };

  // --- RESTORED DETAILED ACCESSIBILITY CONTROLS ---
  const addAccessControls = () => {
    const wrapper = document.createElement("div");
    wrapper.className = "sb-field-row";
    wrapper.style.marginTop = "12px";
    wrapper.style.borderTop = "1px solid #e5e7eb";
    wrapper.style.paddingTop = "12px";

    const title = document.createElement("div");
    title.className = "sb-inspector-title";
    title.textContent = "Accessibility";
    title.style.marginBottom = "8px";
    wrapper.appendChild(title);

    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 1fr";
    row.style.gap = "8px";

    const makeBtn = (mode, label, emoji) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tool-button";

      // Highlight if active
      if (activeAccessibilityMode === mode) {
        btn.classList.add("is-active");
        btn.style.borderColor = "#2563eb";
        btn.style.background = "#eff6ff";
      }

      btn.innerHTML = `<span style="margin-right:4px">${emoji}</span> ${label}`;
      btn.style.fontSize = "12px";
      btn.style.height = "36px";
      btn.onclick = () => {
        // Check if single seat group (Direct action)
        const shapeType = node.getAttr("shapeType") || node.name();
        if (shapeType === "single-seat") {
          const seat = node.findOne("Circle");
          if (seat) {
            const current = seat.getAttr("sbAccessibilityType");
            seat.setAttr("sbAccessibilityType", current === mode ? null : mode);
            applySeatVisuals();
            pushHistory();
            renderInspector(node); // Refresh button state
          }
          return;
        }
        // Multi-mode toggle
        if (activeAccessibilityMode === mode) {
          activeAccessibilityMode = null;
          setTicketSeatSelectionMode(false, "access-off");
        } else {
          activeAccessibilityMode = mode;
          setTicketSeatSelectionMode(true, "access-on");
          refreshSeatTicketListeners();
        }
        renderInspector(node);
      };
      return btn;
    };

    row.appendChild(makeBtn("disabled", "Disabled", "♿"));
    row.appendChild(makeBtn("carer", "Carer", "C"));
    wrapper.appendChild(row);

    const hint = document.createElement("div");
    hint.className = "sb-helper";
    hint.style.marginTop = "6px";
    hint.textContent = activeAccessibilityMode
      ? `Click seats on the map to toggle ${activeAccessibilityMode} status.`
      : "Select a type, then click seats to assign.";
    wrapper.appendChild(hint);
    el.appendChild(wrapper);
  };

  const addAlignButtonsPanel = (count) => {
    const d = document.createElement("div");
    d.className = "sb-inspector-empty";
    d.textContent = `${count} items selected.`;
    el.appendChild(d);
  };

  // =========================================================
  // 2. SELECTION CHECKS & EMPTY STATE HANDLING
  // =========================================================
  // FIX: If no node is selected, render placeholder AND footer
  if (!node) {
    const empty = document.createElement("div");
    empty.className = "sb-inspector-empty";
    empty.textContent = "Select an element on the map to edit its properties.";
    empty.style.marginTop = "20px";
    el.appendChild(empty);

    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);

    // CRITICAL: Always render the footer here so it appears on the Map tab
    if (typeof renderSidebarFooter === 'function') renderSidebarFooter();
    return;
  }

  const nodes = transformer ? transformer.nodes() : [];
  if (nodes && nodes.length > 1) {
    addAlignButtonsPanel(nodes.length);
    // Ensure footer shows even for multi-selection
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    if (typeof renderSidebarFooter === 'function') renderSidebarFooter();
    return;
  }

  const shapeType = node.getAttr("shapeType") || node.name();

  // =========================================================
  // 3. LOCK LOGIC
  // =========================================================
  const locked = isNodeLocked(node);

  if (locked) {
    const lockPanel = document.createElement("div");
    lockPanel.className = "sb-locked-state";
    lockPanel.innerHTML = `
      <span class="sb-lock-icon"> 🔒 </span>
      <div class="sb-locked-title">Structure Locked</div>
      <div class="sb-locked-desc">
        This element has tickets, holds, or view info assigned. You must remove them to edit the geometry.
      </div>
    `;

    const btnUnlock = document.createElement("button");
    btnUnlock.className = "sb-btn-unlock";
    btnUnlock.textContent = "Remove assignments from this element";
    btnUnlock.onclick = () => {
      if (confirm("Are you sure? This will remove ALL tickets, holds, and info from seats in this element.")) {
        clearAssignmentsFromGroup(node);
        // FORCE REFRESH: This line is critical to re-render the panel
        selectNode(node);
      }
    };

    const btnUnlockAll = document.createElement("button");
    btnUnlockAll.className = "sb-btn-unlock-all";
    btnUnlockAll.textContent = "Remove assignments from ENTIRE map";
    btnUnlockAll.onclick = () => {
      if (prompt("Type 'DELETE' to confirm removing ALL ticket assignments and holds from the entire map.") === "DELETE") {
        const allGroups = mapLayer.find("Group");
        allGroups.forEach(g => clearAssignmentsFromGroup(g));
        selectNode(node);
      }
    };

    lockPanel.appendChild(btnUnlock);
    lockPanel.appendChild(btnUnlockAll);
    el.appendChild(lockPanel);

    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);

    renderSidebarFooter();
  }

  // =========================================================
  // 4. SHAPE SPECIFIC CONTROLS
  // =========================================================

  // ---- Single Seat ----
  if (shapeType === "single-seat") {
    addTitle("Single Seat");
    if (locked) {
      addStaticRow("Status", "Assigned / Locked");
    } else {
      const labelMode = node.getAttr("seatLabelMode") || "numbers";
      addSelectField("Label Style", labelMode, [
        { value: "numbers", label: "Number (1)" },
        { value: "letters", label: "Letter (A)" },
        { value: "none", label: "None (Dot)" },
      ], (mode) => {
        node.setAttr("seatLabelMode", mode);
        const circle = node.findOne("Circle");
        const existingLabel = node.findOne("Text");
        if (mode === "none") {
          if (existingLabel) existingLabel.destroy();
          if (circle) { circle.fill("#111827"); circle.stroke("#111827"); }
        } else {
          const baseText = mode === "letters" ? "A" : "1";
          if (!existingLabel) node.add(makeSeatLabelText(baseText, 0, 0));
          else existingLabel.text(baseText);
          if (circle) { circle.fill("#ffffff"); circle.stroke("#4b5563"); }
        }
        mapLayer.batchDraw();
        pushHistory();
      });
      addAccessControls(); // <--- Restored Detailed Controls
    }
    // ADD FOOTER FOR SINGLE SEAT
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Row blocks ----
  if (shapeType === "row-seats") {
    const seatsPerRow = Number(node.getAttr("seatsPerRow") ?? 10);
    const rowCount = Number(node.getAttr("rowCount") ?? 1);
    const totalSeats = node.find('Circle').filter(c => c.getAttr('isSeat')).length;
    const seatStart = Number(node.getAttr("seatStart") ?? 1);
    const rowLabelPrefix = node.getAttr("rowLabelPrefix") || "";
    const rowLabelStart = Number(node.getAttr("rowLabelStart") ?? 0);
    const curve = Number(node.getAttr("curve") || 0);
    const rowOrder = node.getAttr("rowOrder") || "asc";
    const rowLabelPosition = node.getAttr("rowLabelPosition") || "left";
    const everyRowSame = node.getAttr("everyRowSameSeats") !== false;

    const rebuild = () => {
      if (typeof updateRowGroupGeometry === 'function') {
        updateRowGroupGeometry(node, node.getAttr("seatsPerRow") || seatsPerRow, node.getAttr("rowCount") || rowCount);
        mapLayer.batchDraw();
        updateSeatCount();
        refreshSeatMetadata();
        applySeatVisuals();
        pushHistory();
      }
    };

    addTitle("Seat block");

    addNumberField("Rotation (deg)", Math.round(node.rotation() || 0), -360, 360, 1, (val) => {
      node.rotation(normaliseAngle(val));
      if (typeof keepLabelsUpright === 'function') keepLabelsUpright(node);
      if (overlayLayer) overlayLayer.batchDraw();
    });
    addFlipButton(node);

    if (locked) {
      addStaticRow("Seats per row", seatsPerRow);
      addStaticRow("Number of rows", rowCount);
      addStaticRow("Total seats", totalSeats);
    } else {
      addNumberField("Seats per row", seatsPerRow, 1, 100, 1, (val) => { node.setAttr("seatsPerRow", val); rebuild(); });
      addNumberField("Number of rows", rowCount, 1, 100, 1, (val) => { node.setAttr("rowCount", val); rebuild(); });
      addStaticRow("Total seats", totalSeats);

      addNumberField("Seat numbers start at", seatStart, 1, 10000, 1, (val) => { node.setAttr("seatStart", val); rebuild(); });

      addSelectField("Seat labels", node.getAttr("seatLabelMode") || "numbers",
        [{ value: "numbers", label: "1, 2, 3..." }, { value: "letters", label: "A, B, C..." }, { value: "none", label: "None" }],
        (mode) => { node.setAttr("seatLabelMode", mode); rebuild(); }
      );

      addTextField("Row label prefix", rowLabelPrefix, (val) => { node.setAttr("rowLabelPrefix", val); rebuild(); });

      addTextField("First row label", typeof rowLabelFromIndex === 'function' ? rowLabelFromIndex(rowLabelStart) : "A", (val) => {
        if (typeof rowIndexFromLabel === 'function') node.setAttr("rowLabelStart", rowIndexFromLabel(val));
        rebuild();
      });

      addSelectField("Row order", rowOrder, [{ value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }], (v) => { node.setAttr("rowOrder", v); rebuild(); });
      addSelectField("Row labels", rowLabelPosition, [{ value: "left", label: "Left" }, { value: "right", label: "Right" }, { value: "both", label: "Both" }, { value: "none", label: "None" }], (v) => { node.setAttr("rowLabelPosition", v); rebuild(); });

      addCheckboxField("Every row same size", everyRowSame, (c) => { node.setAttr("everyRowSameSeats", c); rebuild(); renderInspector(node); });

      if (!everyRowSame) {
        const counts = node.getAttr("rowSeatCounts") || [];
        const displayStr = Array.from({ length: rowCount }).map((_, i) => counts[i] || seatsPerRow).join(", ");
        addTextField("Seats per row (csv)", displayStr, (val) => {
          const arr = val.split(',').map(n => parseInt(n) || seatsPerRow);
          node.setAttr("rowSeatCounts", arr);
          rebuild();
        });
      }
      addRangeField("Curve rows", curve, -15, 15, 1, (val) => { node.setAttr("curve", val); rebuild(); });
      addAccessControls(); // <--- Restored Detailed Controls
    }
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Circular tables ----
  if (shapeType === "circular-table") {
    const seatCount = node.getAttr("seatCount") || 8;
    const tableLabel = node.getAttr("tableLabel") || "";

    addTitle("Round table");
    addNumberField("Rotation (deg)", Math.round(node.rotation() || 0), -360, 360, 1, (val) => {
      node.rotation(val);
      if (typeof keepLabelsUpright === 'function') keepLabelsUpright(node);
      overlayLayer.batchDraw();
    });

    if (locked) {
      addStaticRow("Table label", tableLabel);
      addStaticRow("Seats", seatCount);
    } else {
      addTextField("Table label", tableLabel, (val) => {
        node.setAttr("tableLabel", val || "");
        if (typeof updateCircularTableGeometry === 'function') updateCircularTableGeometry(node, seatCount);
      });
      addNumberField("Seats around table", seatCount, 1, 50, 1, (val) => {
        if (typeof updateCircularTableGeometry === 'function') {
          updateCircularTableGeometry(node, val);
          mapLayer.batchDraw();
          updateSeatCount();
          pushHistory();
        }
      });
      addSelectField("Seat labels", node.getAttr("seatLabelMode") || "numbers", [{ value: "numbers", label: "1,2..." }, { value: "letters", label: "A,B..." }], (m) => {
        node.setAttr("seatLabelMode", m);
        if (typeof updateCircularTableGeometry === 'function') updateCircularTableGeometry(node, seatCount);
      });
      addAccessControls(); // <--- Restored Detailed Controls
    }
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Rectangular tables ----
  if (shapeType === "rect-table") {
    const longSide = node.getAttr("longSideSeats") ?? 4;
    const shortSide = node.getAttr("shortSideSeats") ?? 2;
    const tableLabel = node.getAttr("tableLabel") || "";

    addTitle("Rectangular table");
    addNumberField("Rotation", Math.round(node.rotation() || 0), -360, 360, 1, (v) => {
      node.rotation(v);
      if (typeof keepLabelsUpright === 'function') keepLabelsUpright(node);
      overlayLayer.batchDraw();
    });

    if (locked) {
      addStaticRow("Table label", tableLabel);
      addStaticRow("Long side seats", longSide);
      addStaticRow("Short side seats", shortSide);
    } else {
      addTextField("Table label", tableLabel, (val) => { node.setAttr("tableLabel", val); updateRectTableGeometry(node, longSide, shortSide); });
      addNumberField("Seats long side", longSide, 0, 50, 1, (v) => { updateRectTableGeometry(node, v, shortSide); mapLayer.batchDraw(); updateSeatCount(); pushHistory(); });
      addNumberField("Seats short side", shortSide, 0, 50, 1, (v) => { updateRectTableGeometry(node, longSide, v); mapLayer.batchDraw(); updateSeatCount(); pushHistory(); });
      addAccessControls(); // <--- Restored Detailed Controls
    }
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Stage ----
  if (shapeType === "stage") {
    addTitle("Stage");
    const labelNode = node.findOne(".stage-label") || node.findOne("Text");
    const stageLabel = node.getAttr("stageLabel") || (labelNode && labelNode.text()) || "STAGE";
    addTextField("Label", stageLabel, (v) => { node.setAttr("stageLabel", v); if (labelNode) labelNode.text(v); applyStageStyle(node); });

    const fillMode = node.getAttr("stageFillMode") || "solid";
    addSelectField("Fill mode", fillMode, [{ value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }], (m) => { node.setAttr("stageFillMode", m); applyStageStyle(node); renderInspector(node); });

    if (fillMode === "solid") {
      addColorField("Stage colour", node.getAttr("stageSolidColor") || "#000000", (v) => { node.setAttr("stageSolidColor", v); applyStageStyle(node); });
    } else {
      addColorField("Start color", node.getAttr("stageGradientStartColor") || "#1d4ed8", (v) => { node.setAttr("stageGradientStartColor", v); applyStageStyle(node); });
      addColorField("End color", node.getAttr("stageGradientEndColor") || "#22c1c3", (v) => { node.setAttr("stageGradientEndColor", v); applyStageStyle(node); });
    }
    addCheckboxField("Auto text color", node.getAttr("stageTextAutoColor") !== false, (c) => { node.setAttr("stageTextAutoColor", c); applyStageStyle(node); renderInspector(node); });
    if (node.getAttr("stageTextAutoColor") === false) {
      addColorField("Text color", node.getAttr("stageTextColor") || "#ffffff", (v) => { node.setAttr("stageTextColor", v); applyStageStyle(node); });
    }
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Bar ----
  if (shapeType === "bar") {
    addTitle("Bar");
    const labelNode = node.findOne(".bar-label") || node.findOne("Text");
    addTextField("Label", (labelNode && labelNode.text()) || "BAR", (v) => { if (labelNode) labelNode.text(v); });
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Exit ----
  if (shapeType === "exit") {
    addTitle("Exit");
    const labelNode = node.findOne(".exit-label") || node.findOne("Text");
    addTextField("Label", (labelNode && labelNode.text()) || "EXIT", (v) => { if (labelNode) labelNode.text(v); });
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Text Label ----
  if (shapeType === "text" || shapeType === "label") {
    addTitle("Text Label");
    const labelNode = node.findOne("Text");
    addTextField("Text", (labelNode && labelNode.text()) || "Label", (v) => { if (labelNode) labelNode.text(v); ensureHitRect(node); mapLayer.batchDraw(); });
    addNumberField("Font Size", (labelNode && labelNode.fontSize()) || 14, 8, 72, 1, (v) => {
      if (labelNode) labelNode.fontSize(v); ensureHitRect(node); mapLayer.batchDraw();
    });
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Other Shapes & Symbols ----
  if (["section", "square", "circle", "multi-shape", "symbol"].includes(shapeType)) {
    addTitle(shapeType.toUpperCase());
    if (shapeType === "symbol") {
      addStaticRow("Type", node.getAttr("symbolType") || "Icon");
    }
    const fillEnabled = node.getAttr("shapeFillEnabled");
    addCheckboxField("Fill", fillEnabled !== false, (c) => { node.setAttr("shapeFillEnabled", c); applyBasicShapeStyle(node); });
    if (fillEnabled !== false) {
      addColorField("Fill Color", node.getAttr("shapeFillColor") || "#ffffff", (v) => { node.setAttr("shapeFillColor", v); applyBasicShapeStyle(node); });
    }
    addColorField("Stroke Color", node.getAttr("shapeStrokeColor") || "#4b5563", (v) => { node.setAttr("shapeStrokeColor", v); applyBasicShapeStyle(node); });
    addNumberField("Stroke Width", node.getAttr("shapeStrokeWidth") || 1.7, 0, 20, 0.5, (v) => { node.setAttr("shapeStrokeWidth", v); applyBasicShapeStyle(node); });
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // ---- Line / Curve / Arrow / Stairs ----
  if (shapeType === "line" || shapeType === "curve-line") {
    addTitle("Line");
    addColorField("Color", (node.findOne("Line") && node.findOne("Line").stroke()) || "#111827", (v) => {
      node.findOne("Line").stroke(v); mapLayer.batchDraw();
    });
    addNumberField("Width", (node.findOne("Line") && node.findOne("Line").strokeWidth()) || 2, 1, 20, 1, (v) => {
      node.findOne("Line").strokeWidth(v); mapLayer.batchDraw();
    });
    const fillEnabled = node.getAttr("lineFillEnabled");
    addCheckboxField("Fill Shape", !!fillEnabled, (c) => {
      node.setAttr("lineFillEnabled", c); updateLineFillShape(node); mapLayer.batchDraw(); renderInspector(node);
    });
    if (fillEnabled) {
      addColorField("Fill Color", node.getAttr("lineFillColor") || "#e5e7eb", (v) => {
        node.setAttr("lineFillColor", v); updateLineFillShape(node); mapLayer.batchDraw();
      });
    }
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  if (shapeType === "arrow") {
    addTitle("Arrow");
    addColorField("Color", (node.findOne("Arrow") && node.findOne("Arrow").stroke()) || "#111827", (v) => {
      const arr = node.findOne("Arrow"); if (arr) { arr.stroke(v); arr.fill(v); mapLayer.batchDraw(); }
    });
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  if (shapeType === "stairs") {
    addTitle("Stairs");
    addNumberField("Steps", node.getAttr("stairsStepCount") || 8, 2, 50, 1, (v) => {
      node.setAttr("stairsStepCount", v); updateStairsGeometry(node); mapLayer.batchDraw();
    });
    // ADD FOOTER
    const spacer = document.createElement("div");
    spacer.style.height = "40px";
    el.appendChild(spacer);
    renderSidebarFooter();
    return;
  }

  // Fallback for any other node types
  const spacer = document.createElement("div");
  spacer.style.height = "40px";
  el.appendChild(spacer);
  renderSidebarFooter();
}
  function keepLabelsUpright(node) {
    const angle = node.rotation();
    const negate = -angle;

    node
      .find(
        (child) =>
          child.getAttr("isSeatLabel") ||
          child.getAttr("isRowLabel") ||
          child.name() === "table-label"
      )
      .forEach((lbl) => {
        lbl.rotation(negate);
      });
  }

       function configureTransformerForNode(node) {
    if (!transformer || !node) return;

    const shapeType = node.getAttr("shapeType") || node.name();

    // Seats / tables: rotation only, no resize
    if (
      shapeType === "row-seats" ||
      shapeType === "single-seat" ||
      shapeType === "circular-table" ||
      shapeType === "rect-table"
    ) {
      transformer.rotateEnabled(true);
      transformer.enabledAnchors([]);
      return;
    }

    // Room objects + basic shapes: resize in all directions (no rotation)
    if (
      shapeType === "stage" ||
      shapeType === "bar" ||
      shapeType === "exit" ||
      shapeType === "section" ||
      shapeType === "square" ||
      shapeType === "circle" ||
      shapeType === "multi-shape" ||
      shapeType === "symbol" 
    ) {
      transformer.rotateEnabled(false);
      transformer.enabledAnchors([
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ]);
      return;
    }

    // Arrow + line drawings + arcs + stairs: allow rotation and resize
    if (
      shapeType === "arrow" ||
      shapeType === "line" ||
      shapeType === "curve-line" ||
      shapeType === "arc" ||
      shapeType === "stairs"
    ) {
      transformer.rotateEnabled(true);
      transformer.enabledAnchors([
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ]);
      return;
    }

    // Default: no resize/rotation
    transformer.rotateEnabled(false);
    transformer.enabledAnchors([]);
  }



      function clearSelection() {
    if (selectedNode) {
      const t =
        selectedNode.getAttr("shapeType") || selectedNode.name();
      if (t === "line" || t === "curve-line") {
        showLineHandles(selectedNode, false);
      }
      if (t === "arrow") {
        showArrowHandles(selectedNode, false);
      }
    }

    selectedNode = null;
    if (transformer) {
      transformer.nodes([]);
      overlayLayer.draw();
    }
    renderInspector(null);
  }



    function selectNode(node, additive = false) {
    if (!node) {
      clearSelection();
      return;
    }

        // Hide handles on previous selection when changing selection
    if (!additive && selectedNode) {
      const prevType =
        selectedNode.getAttr("shapeType") || selectedNode.name();
      if (prevType === "line" || prevType === "curve-line") {
        showLineHandles(selectedNode, false);
      }
      if (prevType === "arrow") {
        showArrowHandles(selectedNode, false);
      }
    }


        if (!transformer) {
      selectedNode = node;
      const t = node.getAttr("shapeType") || node.name();
      if (t === "line" || t === "curve-line") {
        buildLineHandles(node);
        showLineHandles(node, true);
      }
      if (t === "arrow") {
        buildArrowHandles(node);
        showArrowHandles(node, true);
      }
      renderInspector(node);
      return;
    }


    let nodes = transformer.nodes() || [];


    if (additive) {
      const already = nodes.includes(node);
      if (already) {
        nodes = nodes.filter((n) => n !== node);
      } else {
        nodes = nodes.concat(node);
      }
    } else {
      nodes = [node];
    }

        transformer.nodes(nodes);
    overlayLayer.draw();

    selectedNode = nodes.length === 1 ? nodes[0] : null;

        if (nodes.length === 1) {
      const t = nodes[0].getAttr("shapeType") || nodes[0].name();
      if (t === "line" || t === "curve-line") {
        buildLineHandles(nodes[0]);
        showLineHandles(nodes[0], true);
      }
      if (t === "arrow") {
        buildArrowHandles(nodes[0]);
        showArrowHandles(nodes[0], true);
      }
      configureTransformerForNode(nodes[0]);
      renderInspector(nodes[0]);

    } else if (nodes.length > 1) {
      renderInspector(nodes[0]);
    } else {
      renderInspector(null);
    }
  }

  // ---------- Behaviour attachment ----------


   function baseAttachNodeBehaviour(node) {
  if (!(node instanceof Konva.Group)) return;

  // Make sure hit rect is correct for selection / dragging
  ensureHitRect(node);

  // Normalise layer ordering so seats / tables are above,
  // arcs + symbols below.
  sbNormalizeZOrder(node);


  const shapeType = node.getAttr("shapeType") || node.name();

  // Always keep selection blocks behind other elements
  if (shapeType === "section" && mapLayer && node.getLayer() === mapLayer) {
    node.moveToBottom();
    mapLayer.batchDraw();
  }

  // Hover cursor
  node.on("mouseover", () => {
    if (!stage) return;
    // If any creation / drawing tool is active, show crosshair even when hovering shapes
    if (activeTool) {
      stage.container().style.cursor = "crosshair";
    } else {
      stage.container().style.cursor = "grab";
    }
  });

  node.on("mouseout", () => {
    // Use the central helper so it stays in sync with tools
    updateDefaultCursor();
  });

  // ---- Drag behaviour (supports multi-drag with SHIFT) ----
  node.on("dragstart", () => {
    // As soon as we move any element, drop the active creation tool
    // so clicking elsewhere doesn't create another element.
    setActiveTool(null, { force: true });
    updateDefaultCursor();

    const nodes = transformer ? transformer.nodes() : [];

    // If nothing is selected yet, select this node first
    if (!nodes.length) {
      selectNode(node, false);
    }

    const activeNodes = transformer ? transformer.nodes() : [node];

    // If we’re dragging multiple nodes, snapshot their starting positions
    if (activeNodes.length > 1) {
      multiDragState = {
        dragger: node,
        basePositions: new Map(),
      };

      activeNodes.forEach((n) => {
        multiDragState.basePositions.set(n, { x: n.x(), y: n.y() });
      });
    } else {
      multiDragState = null;
    }
  });

  node.on("dragmove", () => {
    if (!multiDragState || multiDragState.dragger !== node) {
      // Single-node drag: just redraw
      mapLayer.batchDraw();
      return;
    }

    const activeNodes = transformer ? transformer.nodes() : [node];
    const base = multiDragState.basePositions.get(node);
    if (!base) return;

    const dx = node.x() - base.x;
    const dy = node.y() - base.y;

    // Move all selected nodes by the same delta, preserving their layout
    activeNodes.forEach((n) => {
      if (n === node) return; // this one is already being dragged by Konva
      const orig = multiDragState.basePositions.get(n);
      if (!orig) return;
      n.position({
        x: orig.x + dx,
        y: orig.y + dy,
      });
    });

    mapLayer.batchDraw();
  });

  node.on("dragend", () => {
    const activeNodes = transformer ? transformer.nodes() : [node];

    // IMPORTANT: no snapping here – allow pixel-perfect placement
    activeNodes.forEach((n) => {
      n.position({
        x: n.x(),
        y: n.y(),
      });
    });

    multiDragState = null;
    mapLayer.batchDraw();
    pushHistory();
  });

  // ---- Transform behaviour ----
    node.on("transformend", () => {
    const tShape = node.getAttr("shapeType") || node.name();

    if (
      tShape === "stage" ||
      tShape === "bar" ||
      tShape === "exit" ||
      tShape === "section" ||
      tShape === "square" ||
      tShape === "circle" ||
      tShape === "symbol"
    ) {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const body = getBodyRect(node);
      const label = node.findOne("Text");

      if (body) {
        if (body instanceof Konva.Circle) {
          // Keep circles as circles – uniform scale
          const radius = body.radius();
          const uniformScale = Math.max(
            Math.abs(scaleX || 1),
            Math.abs(scaleY || 1)
          );
          body.radius(radius * uniformScale);
        } else {
          // Rectangles (stage / bar / exit / section / square)
          // and symbols (Image)
          const origW = body.width();
          const origH = body.height();
          const newW = origW * scaleX;
          const newH = origH * scaleY;

          body.width(newW);
          body.height(newH);

          // For symbols we keep the icon centred on the group origin
          if (tShape === "symbol" && body instanceof Konva.Image) {
            body.offsetX(newW / 2);
            body.offsetY(newH / 2);
          }
        }
      }

      // Stage gradient / solid styling should be recalculated after resize
      if (tShape === "stage") {
        applyStageStyle(node);
      }

      if (label && body && body instanceof Konva.Rect) {
        label.width(body.width());
        label.height(body.height());
        label.x(body.x());
        label.y(body.y());
      }

      // Reset group scale so future transforms are clean
      node.scale({ x: 1, y: 1 });

    } else if (tShape === "stairs") {
      // Scale length/width attributes instead of keeping scale on the group
      const scaleX = Math.abs(node.scaleX() || 1);
      const scaleY = Math.abs(node.scaleY() || 1);

      const baseLength =
        Number(node.getAttr("stairsLength")) || GRID_SIZE * 4;
      const baseWidth =
        Number(node.getAttr("stairsWidth")) || GRID_SIZE * 1.5;

      node.setAttr("stairsLength", baseLength * scaleX);
      node.setAttr("stairsWidth", baseWidth * scaleY);

      updateStairsGeometry(node);
      node.scale({ x: 1, y: 1 });

    } else if (
      tShape !== "arrow" &&
      tShape !== "line" &&
      tShape !== "curve-line" &&
      tShape !== "arc"
    ) {
      node.scale({ x: 1, y: 1 });
    }

    if (
      tShape === "row-seats" ||
      tShape === "circular-table" ||
      tShape === "rect-table"
    ) {
      keepLabelsUpright(node);
    }

    // Resizing counts as "editing" – stop multi-placement afterwards
    setActiveTool(null, { force: true });

    ensureHitRect(node);
    mapLayer.batchDraw();
    pushHistory();

    // keep the inspector in sync (Rotation deg, etc.)
    renderInspector(node);
  });



  // ---- Inline table-label editing ----
  if (shapeType === "circular-table" || shapeType === "rect-table") {
    node.on("dblclick", (evt) => {
      const target = evt.target;
      if (!target || target.name() !== "table-label") return;

      const textNode = target;
      const group = node;

      beginInlineTextEdit(textNode, (newText) => {
        const val = (newText || "").trim();
        textNode.text(val);
        group.setAttr("tableLabel", val);
        mapLayer.batchDraw();
        pushHistory();
        renderInspector(group);
      });
    });
  }
}

function attachNodeBehaviour(node) {
    if (!node || !(node instanceof Konva.Group)) return;

    // 1) Run existing per-type hooks (styling, etc.)
    baseAttachNodeBehaviour(node);

    const type = node.getAttr("shapeType") || node.name();

    // 2) Ensure multi-shapes always have resize/rotate behaviour
    if (type === "multi-shape") {
        attachMultiShapeTransformBehaviour(node);
    }

    // 3) SELECTION BEHAVIOUR
    // Remove old listeners to avoid duplicates
    node.off("mousedown.seatmapSelect touchstart.seatmapSelect click.seatmapSelect tap.seatmapSelect");

    // A. SELECT ON MOUSE DOWN (Instant response)
    node.on("mousedown.seatmapSelect touchstart.seatmapSelect", (evt) => {
        // Safety: Don't select if we are in Ticket/View/Hold modes
        if (ticketSeatSelectionMode || window.ticketSeatSelectionMode) return;
        // Safety: Don't select if drawing a line/shape
        if (activeTool && activeTool !== 'select') return;
        // Safety: Only Left Click
        if (evt.evt && typeof evt.evt.button === 'number' && evt.evt.button !== 0) return;

        // CRITICAL: Stop event from reaching the Stage (which would Deselect this node)
        evt.cancelBubble = true;

        if (isShiftPressed && transformer) {
            // Multi-select logic
            const existing = transformer.nodes();
            const idx = existing.indexOf(node);
            if (idx === -1) {
                transformer.nodes(existing.concat(node));
            } else {
                const clone = existing.slice();
                clone.splice(idx, 1);
                transformer.nodes(clone);
            }
            // Update Inspector for multi-select
            selectedNode = transformer.nodes().length === 1 ? transformer.nodes()[0] : null;
            renderInspector(selectedNode);
        } else {
            // Standard Single Selection
            selectNode(node);
        }
        
        // Force a redraw so the selection box appears instantly
        if (overlayLayer) overlayLayer.batchDraw();
    });

    // B. BLOCK CLICK BUBBLING (Prevents "Double Fire" issues)
    // If we don't catch this, the 'click' event will bubble to the Stage 
    // immediately after 'mousedown', causing the Stage to clear the selection we just made.
    node.on("click.seatmapSelect tap.seatmapSelect", (evt) => {
        evt.cancelBubble = true;
    });
}  
    function createNodeForTool(tool, pos) {
      // default to centre if for some reason we don't have a pointer
      let pointerX = stage ? stage.width() / 2 : 0;
      let pointerY = stage ? stage.height() / 2 : 0;

      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        pointerX = pos.x;
        pointerY = pos.y;
      }

     // ---- FIXED: symbol tools ----
if (
  tool &&
  (tool.startsWith("symbol-") || tool.startsWith("symbol:"))
) {
  // Just pass the raw tool name through; createSymbolNode() will
  // call normaliseSymbolTool() and turn things like
  // "symbol-wc-male" into "wc-male", "symbol-wc-female" into "wc-female", etc.
  return createSymbolNode(tool, pointerX, pointerY);
}

      

    switch (tool) {
      case "section":
        return createSectionBlock(pointerX, pointerY);

        case "arc":
      return createArc(pointerX, pointerY);

      case "row": {
        const seatsPerRowStr = window.prompt(
          "How many seats in each row?",
          "10"
        );
        if (seatsPerRowStr == null) return null;
        const seatsPerRow = parseInt(seatsPerRowStr, 10);
        if (!Number.isFinite(seatsPerRow) || seatsPerRow <= 0) return null;

        const rowCountStr = window.prompt(
          "How many rows in this block?",
          "1"
        );
        if (rowCountStr == null) return null;
        const rowCount = parseInt(rowCountStr, 10);
        if (!Number.isFinite(rowCount) || rowCount <= 0) return null;

        const node = createRowOfSeats(
          pointerX,
          pointerY,
          seatsPerRow,
          rowCount
        );
        return node;
      }

      case "single":
        return createSingleSeat(pointerX, pointerY);

            case "circle-table": {
        const seatCountStr = window.prompt(
          "How many seats around this table?",
          "8"
        );
        if (seatCountStr == null) {
          // eslint-disable-next-line no-console
          console.log("[seatmap] circular-table: cancelled by user");
          return null;
        }

        const seatCount = parseInt(seatCountStr, 10);
        if (!Number.isFinite(seatCount) || seatCount <= 0) {
          // eslint-disable-next-line no-console
          console.warn("[seatmap] circular-table: invalid seat count", {
            seatCountStr,
            seatCount,
          });
          return null;
        }

        // eslint-disable-next-line no-console
        console.log("[seatmap] circular-table: creating", {
          x: pointerX,
          y: pointerY,
          seatCount,
        });

        try {
          const node = createCircularTable(pointerX, pointerY, seatCount);
          if (!node) {
            // eslint-disable-next-line no-console
            console.warn("[seatmap] circular-table: createCircularTable returned null");
          }
          window.__LAST_TABLE_DEBUG__ = { type: "circular", x: pointerX, y: pointerY, seatCount, node };
          return node;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[seatmap] circular-table: error creating table", err);
          window.__LAST_TABLE_ERROR__ = err;
          return null;
        }
      }


            case "rect-table": {
        const input = window.prompt(
          "Rectangular table – seats per long side, seats per short side (e.g. 4,2)",
          "4,2"
        );
        if (input == null) {
          // eslint-disable-next-line no-console
          console.log("[seatmap] rect-table: cancelled by user");
          return null;
        }

        const parts = input.split(",");
        if (parts.length !== 2) {
          // eslint-disable-next-line no-console
          console.warn("[seatmap] rect-table: invalid input format", { input });
          return null;
        }

        const longSideSeats = parseInt(parts[0].trim(), 10);
        const shortSideSeats = parseInt(parts[1].trim(), 10);

        if (
          !Number.isFinite(longSideSeats) ||
          longSideSeats < 0 ||
          !Number.isFinite(shortSideSeats) ||
          shortSideSeats < 0
        ) {
          // eslint-disable-next-line no-console
          console.warn("[seatmap] rect-table: invalid seat counts", {
            input,
            longSideSeats,
            shortSideSeats,
          });
          return null;
        }

        // eslint-disable-next-line no-console
        console.log("[seatmap] rect-table: creating", {
          x: pointerX,
          y: pointerY,
          longSideSeats,
          shortSideSeats,
        });

        try {
          const node = createRectTable(pointerX, pointerY, {
            longSideSeats,
            shortSideSeats,
          });
          if (!node) {
            // eslint-disable-next-line no-console
            console.warn("[seatmap] rect-table: createRectTable returned null");
          }
          window.__LAST_TABLE_DEBUG__ = {
            type: "rect",
            x: pointerX,
            y: pointerY,
            longSideSeats,
            shortSideSeats,
            node,
          };
          return node;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[seatmap] rect-table: error creating table", err);
          window.__LAST_TABLE_ERROR__ = err;
          return null;
        }
      }


      case "stage":
        return createStage(pointerX, pointerY);

      case "bar":
        return createBar(pointerX, pointerY);

      case "exit":
        return createExit(pointerX, pointerY);

      case "square":
        return createSquare(pointerX, pointerY);

      case "circle":
        return createCircle(pointerX, pointerY);

      case "text":
        return createTextLabel(pointerX, pointerY);

              case "symbol-bar":
        return createSymbolNode("bar", pointerX, pointerY);

      case "symbol-wc-mixed":
        return createSymbolNode("wc-mixed", pointerX, pointerY);

      case "symbol-wc-male":
        return createSymbolNode("wc-male", pointerX, pointerY);

      case "symbol-wc-female":
        return createSymbolNode("wc-female", pointerX, pointerY);

      case "symbol-exit":
        return createSymbolNode("exit-symbol", pointerX, pointerY);

      case "symbol-disabled":
        return createSymbolNode("disabled", pointerX, pointerY);

      case "symbol-first-aid":
        return createSymbolNode("first-aid", pointerX, pointerY);

      case "symbol-info":
        return createSymbolNode("info", pointerX, pointerY);


      default:
        return null;
    }
  }



  // ---------- Init Konva ----------

  function initStage() {
    const width = container.clientWidth - STAGE_PADDING * 2;
    const height = container.clientHeight - STAGE_PADDING * 2;

    baseStageWidth = width;
    baseStageHeight = height;

    stage = new Konva.Stage({
      container: "app",
      width,
      height,
    });

      // --- Multi-shape placement via Multi tool ---
  stage.on("mousedown.multi-shape", () => {
    if (activeTool !== "multi-shape") return;
    if (!mapLayer) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const g = createMultiShape(pointerPos.x, pointerPos.y);
    mapLayer.add(g);
    attachNodeBehaviour(g);
    sbNormalizeZOrder(g);

    mapLayer.batchDraw();
    updateSeatCount();
    pushHistory();
  });


    const domContainer = stage.container();
    domContainer.style.backgroundImage = "none";
    domContainer.style.backgroundColor = "#f9fafb";

    if (domContainer && !ticketSeatContainerListenerAttached) {
      domContainer.addEventListener("click", handleTicketSeatContainerClick);
      domContainer.addEventListener("pointerdown", handleTicketSeatContainerClick);
      ticketSeatContainerListenerAttached = true;
      // eslint-disable-next-line no-console
      console.log("[seatmap][tickets] seat-selection DOM listener attached (boot)");
    }

    gridLayer = new Konva.Layer({ listening: false });
    mapLayer = new Konva.Layer({
      id: "mapLayer",
      name: "map-layer",
    });
    if (typeof mapLayer.listening === "function") {
      mapLayer.listening(true);
    }
    mapLayer.position({ x: 0, y: 0 });
    mapLayer.scale({ x: 1, y: 1 });
    overlayLayer = new Konva.Layer();

    stage.add(gridLayer);
    stage.add(mapLayer);
    stage.add(overlayLayer);

    drawSquareGrid();

     transformer = new Konva.Transformer({
    rotateEnabled: true,
    enabledAnchors: [],
    anchorSize: 7,
    borderStroke: "#2563eb",
    anchorFill: "#ffffff",
    anchorStrokeWidth: 1.2,
    borderStrokeWidth: 1.2,
  });
  overlayLayer.add(transformer);

  // Ensure multi-shapes get full resize + rotate handles when selected
  mapLayer.on("click.multiShapeHandles", (evt) => {
    if (!transformer) return;

    const target = evt.target;
    if (!target) return;

    // Find the containing group for whatever we clicked
    const group = target.findAncestor("Group", true);
    if (!group) return;

    const type = group.getAttr("shapeType") || group.name();
    if (type !== "multi-shape") return;

    // Make sure the transformer shows resize anchors + rotation for multi-shapes
    transformer.rotateEnabled(true);
    transformer.enabledAnchors([
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ]);

    // Ensure our transform behaviour is wired (for older shapes / loaded layouts)
    attachMultiShapeTransformBehaviour(group);
  });
}


  // ---------- Canvas interactions ----------

  function handleStageClick(evt) {
    // 1. If in specific modes (Tickets/Holds/View), ignore standard clicks entirely.
    if (ticketSeatSelectionMode || window.ticketSeatSelectionMode) {
        clearSelection();
        return;
    }

    if (!stage || !mapLayer) return;

    // 2. Identify what was clicked
    const target = evt.target;
    
    // 3. Drawing Tools Handlers
    // If drawing a line or arrow, pass control to those specific functions
    const isHandle = target && target.getAttr && (target.getAttr("isLineHandle") || target.getAttr("isArrowHandle"));
    
    if (activeTool === "multi-shape") {
        const pos = stage.getPointerPosition();
        if (pos) {
            const g = createMultiShape(pos.x, pos.y);
            mapLayer.add(g);
            attachNodeBehaviour(g);
            sbNormalizeZOrder(g);
            selectNode(g);
            mapLayer.batchDraw();
            updateSeatCount();
            pushHistory();
        }
        return;
    }
    
    if ((activeTool === "line" || activeTool === "curve-line") && !isHandle) {
        handleLineClick(stage.getPointerPosition(), activeTool);
        return;
    }
    if (activeTool === "arrow") {
        handleArrowClick(stage.getPointerPosition());
        return;
    }

    // 4. Creation Tools (Rows, Tables, etc.)
    if (activeTool && activeTool !== 'select' && activeTool !== 'line' && activeTool !== 'curve-line' && activeTool !== 'arrow') {
        const pos = stage.getPointerPosition();
        const node = createNodeForTool(activeTool, pos);
        if (node) {
            mapLayer.add(node);
            const t = node.getAttr("shapeType") || node.name();
            if (t === "square" || t === "circle") node.moveToBottom();
            attachNodeBehaviour(node);
            mapLayer.batchDraw();
            updateSeatCount();
            selectNode(node);
            pushHistory();
            setActiveTool(null); // Stop tool after placement
            updateDefaultCursor();
        }
        return;
    }

    // 5. BACKGROUND DESELECTION LOGIC
    // Only clear selection if we explicitly clicked the Stage or GridLayer.
    // If we clicked a Group/Shape, that event should have been caught by attachNodeBehaviour.
    const isStage = target === stage;
    const isGrid = target.getLayer && target.getLayer() === gridLayer;
    
    if (isStage || isGrid) {
        clearSelection();
    }
}
    function handleKeyDown(e) {
    // track shift for robust multi-select
    if (e.key === "Shift") {
      isShiftPressed = true;
    }

    // Esc should cancel an in-progress arrow
    if (e.key === "Escape") {
      if (activeTool === "arrow" && arrowDrawingGroup) {
        arrowDrawingGroup.destroy();
        arrowDrawingGroup = null;
        arrowShape = null;
        arrowStartPoint = null;
        mapLayer && mapLayer.batchDraw();
        e.preventDefault();
        return;
      }
    }

    const nodes = transformer ? transformer.nodes() : [];


    const tag =
      document.activeElement && document.activeElement.tagName
        ? document.activeElement.tagName.toLowerCase()
        : "";
    if (tag === "input" || tag === "textarea") return;

          // Keyboard shortcuts: Undo / Redo
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      undo();
      return;
    }

    if (
      (e.metaKey || e.ctrlKey) &&
      (e.key === "y" ||
        e.key === "Y" ||
        (e.shiftKey && (e.key === "z" || e.key === "Z")))
    ) {
      e.preventDefault();
      redo();
      return;
    }


    if (e.key === "Delete" || e.key === "Backspace") {
      if (!nodes.length) return;
      nodes.forEach((n) => n.destroy());
      clearSelection();
      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
      e.preventDefault();
      return;
    }

          // Keyboard nudging with arrow keys
    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      // If no selection, do nothing (let browser scroll)
      const selected =
        nodes && nodes.length
          ? nodes
          : selectedNode
          ? [selectedNode]
          : [];

      if (!selected.length) return;

      const step = e.shiftKey ? 10 : 1; // Shift+Arrow = 10px, Arrow = 1px

      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;

      selected.forEach((n) => {
        n.position({
          x: n.x() + dx,
          y: n.y() + dy,
        });
      });

      if (mapLayer) {
        mapLayer.batchDraw();
        pushHistory();
      }

      e.preventDefault();
      return;
    }

      
    if (
      (e.key === "c" || e.key === "C") &&
      (e.metaKey || e.ctrlKey)
    ) {
      if (!nodes.length) return;
      copiedNodesJson = nodes.map((n) => n.toJSON());
      e.preventDefault();
      return;
    }

    if (
      (e.key === "v" || e.key === "V") &&
      (e.metaKey || e.ctrlKey)
    ) {
      if (!copiedNodesJson.length) return;

      const newNodes = copiedNodesJson.map((json) => {
        const node = Konva.Node.create(json);
        node.x(node.x() + GRID_SIZE);
        node.y(node.y() + GRID_SIZE);

        const type = node.getAttr("shapeType");
        if (type === "circular-table" || type === "rect-table") {
          node.setAttr("tableLabel", nextTableLabel());
          if (type === "circular-table") {
            updateCircularTableGeometry(node, node.getAttr("seatCount") || 8);
          } else {
            updateRectTableGeometry(
              node,
              node.getAttr("longSideSeats") ?? 4,
              node.getAttr("shortSideSeats") ?? 2
            );
          }
        }

        mapLayer.add(node);
        attachNodeBehaviour(node);
        return node;
      });

      mapLayer.batchDraw();
      
      pushHistory();
      transformer.nodes(newNodes);
      overlayLayer.draw();
      selectedNode = newNodes.length === 1 ? newNodes[0] : null;
      if (newNodes.length === 1) {
        renderInspector(newNodes[0]);
      } else if (newNodes.length > 1) {
        renderInspector(newNodes[0]);
      } else {
        renderInspector(null);
      }
      e.preventDefault();
    }
  }

  function handleKeyUp(e) {
    if (e.key === "Shift") {
      isShiftPressed = false;
    }
  }

  // ---------- Zoom ----------

  // [Source: 8303] - Updated setZoom to center on viewport
function setZoom(scale) {
  if (!stage) return;
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  const oldScale = stage.scaleX() || 1;
  if (Math.abs(clamped - oldScale) < 0.0001) return;

  // 1. Get viewport center
  const center = {
    x: baseStageWidth / 2,
    y: baseStageHeight / 2,
  };

  // 2. Get world point under center
  const relatedTo = {
    x: (center.x - stage.x()) / oldScale,
    y: (center.y - stage.y()) / oldScale,
  };

  // 3. Apply New Scale
  stage.scale({ x: clamped, y: clamped });

  // 4. Calculate New Position to keep focus
  const newPos = {
    x: center.x - relatedTo.x * clamped,
    y: center.y - relatedTo.y * clamped,
  };
  stage.position(newPos);

  // FIX: REMOVED stage.size() call. 
  // The stage should always remain the full width/height of the container.

  drawSquareGrid();
  stage.batchDraw();

  const label = document.getElementById("sb-zoom-reset");
  if (label) {
    label.textContent = `${Math.round(clamped * 100)}%`;
  }
}
  function hookZoomButtons() {
    const btnIn = document.getElementById("sb-zoom-in");
    const btnOut = document.getElementById("sb-zoom-out");
    const btnReset = document.getElementById("sb-zoom-reset");

    if (btnIn) {
      btnIn.addEventListener("click", () => {
        setZoom((stage.scaleX() || 1) + ZOOM_STEP);
      });
    }
    if (btnOut) {
      btnOut.addEventListener("click", () => {
        setZoom((stage.scaleX() || 1) - ZOOM_STEP);
      });
    }
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        setZoom(1);
      });
    }
  }

  // ---------- Canvas panning (hand tool behaviour) ----------

  let isPanning = false;
  let lastPanPointerPos = null;

  function updateDefaultCursor() {
    if (!stage) return;
    if (activeTool) {
      stage.container().style.cursor = "crosshair";
    } else {
      // Default "select" mode over background = open hand
      stage.container().style.cursor = "grab";
    }
  }

    function handleStageMouseDown(evt) {
  if (!stage) return;

  const pointerPos = stage.getPointerPosition();
  if (!pointerPos) return;

  // ---- Freehand curve-line: start drawing on mousedown ----
  if (activeTool === "curve-line") {
    startCurveLine(pointerPos);
    if (evt.evt) evt.evt.preventDefault();
    return;
  }

  // ---- STAIRS: click + drag to create a run of steps ----
  if (activeTool === "stairs") {
    startStairsDrawing(pointerPos);
    if (evt.evt) evt.evt.preventDefault();
    return;
  }

  // ---- No drawing tool: maybe start panning ----
  // Do not pan while any creation / drawing tool is active
  if (activeTool) return;

  const target = evt.target;
  const clickedOnEmpty =
    target === stage ||
    (target.getLayer && target.getLayer() === gridLayer);

  if (!clickedOnEmpty) return;

  isPanning = true;
  lastPanPointerPos = pointerPos;
  stage.container().style.cursor = "grabbing";
}



function handleStageMouseMove() {
  if (!stage) return;

  // While drawing a curve-line, keep extending the path
  if (activeTool === "curve-line" && isCurveDrawing && currentLine) {
    const pos = stage.getPointerPosition();
    if (!pos) return;
    updateCurveLine(pos);
    return;
  }

  // While drawing stairs, update the preview geometry
  if (activeTool === "stairs" && stairsDraft && stairsStartPos) {
    const pos = stage.getPointerPosition();
    if (!pos) return;
    updateStairsDrawing(pos);
    return;
  }

  if (!isPanning || !lastPanPointerPos) return;

  const pos = stage.getPointerPosition();
  if (!pos) return;

  const dx = pos.x - lastPanPointerPos.x;
  const dy = pos.y - lastPanPointerPos.y;

  stage.position({
    x: stage.x() + dx,
    y: stage.y() + dy,
  });

  stage.batchDraw();
  lastPanPointerPos = pos;
}


  function handleStageMouseUp() {
    if (!stage) return;

  // ---- Finish freehand curve-line on mouse up ----
  if (activeTool === "curve-line" && isCurveDrawing) {
    finishCurveLine(true);
    return;
  }

  // ---- Finish stairs on mouse up (commit the run of steps) ----
  if (activeTool === "stairs" && stairsDraft) {
    finishStairsDrawing(true);
    return;
  }

  // ---- End panning ----
  if (!isPanning) return;
    isPanning = false;
    lastPanPointerPos = null;
    updateDefaultCursor();
  }

    function handleTicketSeatContainerClick(e) {
    // In manual ticket seat assignment mode we now rely entirely on the
    // per-seat Konva listeners (see refreshSeatTicketListeners). The DOM
    // container listener stays only as a debug hook and must NOT toggle
    // seats itself, otherwise we get double-toggles and “ghost” clicks.
    if (!ticketSeatSelectionMode) return;

    // If a Konva seat handler already processed this DOM event, bail out.
    if (e && e._sbSeatAssignHandled) return;

    // Debug-only logging so we can see stray events if needed.
    // eslint-disable-next-line no-console
    console.log("[seatmap][tickets] container click (noop in manual assign mode)", {
      isSeatMode: ticketSeatSelectionMode,
      eventTarget: e && (e.target.className || e.target.tagName),
    });

    // No call to handleTicketSeatSelection here on purpose.
  }



  // ---------- Buttons ----------

  function hookClearButton() {
    const clearBtn = document.getElementById("sb-clear");
    if (!clearBtn) return;

    clearBtn.addEventListener("click", () => {
      if (!window.confirm("Clear the entire layout? This cannot be undone.")) {
        return;
      }
      resetLayoutToBlank();
    });
  }

  function resetLayoutToBlank() {
    if (!mapLayer) return;
    mapLayer.destroyChildren();
    clearSelection();
    mapLayer.batchDraw();
    updateSeatCount();
    pushHistory();
  }

  function hookUndoRedoButtons() {
    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");

    if (undoBtn) undoBtn.addEventListener("click", undo);
    if (redoBtn) redoBtn.addEventListener("click", redo);
  }

  function hookToolButtons() {
    document.querySelectorAll(".tool-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        if (!tool) return;
        setActiveTool(tool);
      });
    });
  }

  function hookSavedLayoutSelectWatcher() {
    const select = document.getElementById("tb-saved-layout-select");
    if (!select) return;

    select.addEventListener("change", () => {
      syncDeleteButtonState();
    });
  }

  function findSavedLayoutMeta(seatMapId) {
    if (!seatMapId) return null;
    const maps = Array.isArray(window.__TIXALL_SAVED_LAYOUTS__)
      ? window.__TIXALL_SAVED_LAYOUTS__
      : [];
    return maps.find((m) => m && m.id === seatMapId) || null;
  }

  function setCurrentSeatMapMeta(seatMapId, seatMapName) {
    currentSeatMapId = seatMapId || null;
    currentSeatMapName = seatMapName || null;
    syncDeleteButtonState();
  }

  function syncDeleteButtonState() {
    const deleteBtn = window.__TICKIN_DELETE_BUTTON__;
    if (!deleteBtn) return;

    const select = document.getElementById("tb-saved-layout-select");
    const selectedId = select && select.value ? select.value : null;
    const candidateId = selectedId || currentSeatMapId;

    deleteBtn.disabled = !candidateId;
    deleteBtn.classList.toggle("is-disabled", deleteBtn.disabled);
    deleteBtn.style.display = candidateId ? "" : "none";
  }

  function ensureMapNotCleared(snapshotJson) {
    if (!snapshotJson || !mapLayer || mapLayer.getChildren().length > 0) {
      return;
    }

    // eslint-disable-next-line no-console
    console.warn("[seatmap] save: map emptied after save, restoring snapshot");

    const restored = loadKonvaLayoutIntoStage(snapshotJson, {
      resetHistory: false,
      reattachBehaviours: true,
    });

    if (!restored) {
      // eslint-disable-next-line no-console
      console.error("[seatmap] save: failed to restore snapshot after save");
    }
  }

  function hookSaveButton() {
    const saveBtn = window.__TICKIN_SAVE_BUTTON__;
    if (!saveBtn) return;

    saveBtn.addEventListener("click", async () => {
      const selectionBeforeSave = selectedNode;
      const fallbackJson = mapLayer && mapLayer.toJSON ? mapLayer.toJSON() : null;
      const select = document.getElementById("tb-saved-layout-select");
      const selectedFromDropdown = select && select.value ? select.value : null;
      let seatMapIdForSave = selectedFromDropdown || currentSeatMapId || null;
      let nameForSave = currentSeatMapName || null;

      // If a saved layout is loaded, ask whether to overwrite or create a new save.
      if (seatMapIdForSave) {
        const overwrite = window.confirm(
          "You already have a saved layout selected. Click OK to overwrite it, or Cancel to save a new copy instead."
        );

        if (!overwrite) {
          seatMapIdForSave = null;
          const suggested = nameForSave ? `${nameForSave} copy` : "";
          const newName = window.prompt(
            "Enter a name for the new saved seating map (Cancel to stop saving):",
            suggested
          );

          // User cancelled the prompt – abort the save entirely.
          if (newName === null) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save layout";
            return;
          }

          nameForSave = newName.trim() || nameForSave || null;
        }
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
        const konvaJson = stage.toJSON();
        // eslint-disable-next-line no-console
        console.info("[seatmap] save: start", {
          showId,
          layoutType: initialLayoutKey,
          jsonLength: konvaJson ? konvaJson.length : 0,
          mapChildren: mapLayer ? mapLayer.getChildren().length : null,
          selectionId: selectionBeforeSave && selectionBeforeSave.id
            ? selectionBeforeSave.id()
            : null,
        });
        const body = {
          konvaJson,
          layoutType: initialLayoutKey,
          seatMapId: seatMapIdForSave,
          name: nameForSave,
        };

        const res = await fetch(
          `/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        let responseBody = null;
        try {
          const text = await res.text();
          responseBody = text ? JSON.parse(text) : null;
        } catch (parseErr) {
          // eslint-disable-next-line no-console
          console.warn("[seatmap] save: could not parse response JSON", parseErr);
        }

        // eslint-disable-next-line no-console
        console.info("[seatmap] save: response", {
          status: res.status,
          ok: res.ok,
          seatMapId:
            responseBody && responseBody.seatMap ? responseBody.seatMap.id : null,
          bodyKeys: responseBody ? Object.keys(responseBody) : null,
        });

        if (!res.ok) {
          throw new Error(`Save failed (${res.status})`);
        }

        await refreshSavedLayoutsDropdown();

        if (responseBody && responseBody.seatMap) {
          setCurrentSeatMapMeta(
            responseBody.seatMap.id,
            responseBody.seatMap.name || currentSeatMapName
          );

          const select = document.getElementById("tb-saved-layout-select");
          if (select && responseBody.seatMap.id) {
            select.value = responseBody.seatMap.id;
          }
        }

        ensureMapNotCleared(fallbackJson);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error saving seat map", err);
        window.alert("There was a problem saving this layout.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save layout";

        // Restore the previous selection if the node still exists on the map.
        if (selectionBeforeSave && selectionBeforeSave.getStage()) {
          selectNode(selectionBeforeSave);
        }

        syncDeleteButtonState();

        // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
    console.info("[seatmap] save: finished");
  }
});
}

// --- PHASE 1: DRAFT & PUBLISH HANDLERS ---
function saveShowWithStatus(status, redirectUrl) {
  const saveBtn = window.__TICKIN_SAVE_BUTTON__; // The hidden one, logic reused logic manually below
  // We manually construct the payload similar to hookSaveButton
  const konvaJson = stage.toJSON();
  const body = {
    konvaJson,
    layoutType: window.__SEATMAP_LAYOUT__ || "tables",
    seatMapId: currentSeatMapId, // Update existing map
    name: currentSeatMapName || "Draft Layout",
    // New fields for Phase 1:
    showStatus: status, // "DRAFT" or "LIVE"
    completionStatus: window.__TIXALL_COMPLETION_STATUS__
  };

  // UI Feedback
  const btnId = status === 'LIVE' ? 'tb-btn-publish' : 'tb-btn-draft';
  const btn = document.getElementById(btnId);
  const originalText = btn ? btn.textContent : '';
  if(btn) { btn.disabled = true; btn.textContent = "Processing..."; }

  fetch(`/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  .then(res => {
    if (!res.ok) throw new Error("Save failed");
    return res.json();
  })
  .then(data => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      alert("Saved successfully!");
      if(btn) { btn.disabled = false; btn.textContent = originalText; }
    }
  })
  .catch(err => {
    console.error(err);
    alert("Error saving show.");
    if(btn) { btn.disabled = false; btn.textContent = originalText; }
  });
}

function hookPhase1Buttons() {
  const btnDraft = document.getElementById('tb-btn-draft');
  const btnPublish = document.getElementById('tb-btn-publish');

  if (btnDraft) {
    btnDraft.addEventListener('click', () => {
      // Save as Draft -> Redirect to My Shows
      saveShowWithStatus('DRAFT', '/admin/shows'); 
    });
  }

  if (btnPublish) {
    btnPublish.addEventListener('click', () => {
      if (confirm("Are you sure you want to go LIVE? This will generate a public link.")) {
        // Save as Live -> Redirect to Summary
        // Assuming /admin/shows/summary/:id exists or falls back to dashboard
        saveShowWithStatus('LIVE', `/admin/shows/${showId}/summary`); 
      }
    });
  }
}

  function hookLoadButton() {
    const loadBtn = window.__TICKIN_LOAD_BUTTON__;
    if (!loadBtn) return;

    loadBtn.addEventListener("click", async () => {
      loadBtn.disabled = true;
      const originalLabel = loadBtn.textContent;
      loadBtn.textContent = "Loading…";

      try {
        const loaded = await loadExistingLayout();
        if (!loaded) {
          window.alert("No saved layout found for this show.");
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error loading seat map", err);
        window.alert("There was a problem loading the saved layout.");
      } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = originalLabel || "Load saved layout";
      }
    });
  }

  function hookDeleteButton() {
    const deleteBtn = window.__TICKIN_DELETE_BUTTON__;
    if (!deleteBtn) return;

    deleteBtn.addEventListener("click", async () => {
      const select = document.getElementById("tb-saved-layout-select");
      const seatMapId = select && select.value ? select.value : currentSeatMapId;

      if (!seatMapId) {
        window.alert("Select a saved layout to delete.");
        return;
      }

      const meta = findSavedLayoutMeta(seatMapId);
      const nameLabel = meta && meta.name ? `"${meta.name}"` : "this layout";

      if (!window.confirm(`Delete ${nameLabel}? This cannot be undone.`)) {
        return;
      }

      deleteBtn.disabled = true;
      const originalLabel = deleteBtn.textContent;
      deleteBtn.textContent = "Deleting…";

      try {
        const res = await fetch(
          `/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}/${encodeURIComponent(
            seatMapId
          )}`,
          { method: "DELETE" }
        );

        if (!res.ok) {
          throw new Error(`Delete failed (${res.status})`);
        }

        // eslint-disable-next-line no-console
        console.info("[seatmap] delete: removed", { seatMapId });

        await refreshSavedLayoutsDropdown();

        const layouts = Array.isArray(window.__TIXALL_SAVED_LAYOUTS__)
          ? window.__TIXALL_SAVED_LAYOUTS__.filter(Boolean)
          : [];
        const wasCurrent = currentSeatMapId === seatMapId;
        const wasSelected = select && select.value === seatMapId;
        const shouldClear = wasCurrent || wasSelected;

        const nextLayout = layouts.find((layout) => layout && layout.id);

        if (shouldClear) {
          resetLayoutToBlank();
          setCurrentSeatMapMeta(null, null);

          if (nextLayout) {
            const loaded = await loadSavedLayoutById(nextLayout.id);
            if (loaded && select) {
              select.value = nextLayout.id;
            }
            if (!loaded) {
              resetLayoutToBlank();
              setCurrentSeatMapMeta(null, null);
              if (select) select.value = "";
            }
          } else if (select) {
            select.value = "";
          }
        } else if (select && select.value === seatMapId) {
          select.value = nextLayout ? nextLayout.id : "";
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error deleting seat map", err);
        window.alert("There was a problem deleting this layout.");
      } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = originalLabel || "Delete layout";
        syncDeleteButtonState();
      }
    });
  }

  // ---------- Load existing layout ----------

  function initTableCounterFromExisting() {
    if (!mapLayer) return;
    let max = 0;
    mapLayer.find("Group").forEach((g) => {
      const type = g.getAttr("shapeType");
      if (type === "circular-table" || type === "rect-table") {
        const label = g.getAttr("tableLabel");
        const n = parseInt(label, 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    });
    tableCounter = max + 1;
  }

  async function loadExistingLayout() {
    try {
      // eslint-disable-next-line no-console
      console.info("[seatmap] load: fetching latest layout", { showId });

      const res = await fetch(
        `/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}`
      );
      if (!res.ok) return false;

      const data = await res.json();
      applyShowMeta(data);

      // eslint-disable-next-line no-console
      console.info("[seatmap] load: fetched", {
        status: res.status,
        ok: res.ok,
        hasActive: !!(data && data.activeSeatMap),
        previousCount: Array.isArray(data && data.previousMaps)
          ? data.previousMaps.length
          : 0,
      });
      const active = data && data.activeSeatMap;
      const konvaJson = active && active.layout && active.layout.konvaJson;

      if (!konvaJson) return false;

      // eslint-disable-next-line no-console
      console.info("[seatmap] load: attempting to load active layout", {
        id: active && active.id,
        name: active && active.name,
        jsonLength: konvaJson ? konvaJson.length : 0,
      });

      const loaded = loadKonvaLayoutIntoStage(konvaJson, {
        resetHistory: true,
        reattachBehaviours: true,
      });

      if (loaded) {
        setTicketSeatSelectionMode(false, "load-active-layout");
        setCurrentSeatMapMeta(active && active.id, active && active.name);
        initTableCounterFromExisting();
      }

      return !!loaded;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error loading existing seat map", err);
      return false;
    }
  }

  async function loadSavedLayoutById(seatMapId) {
    const maps = Array.isArray(window.__TIXALL_SAVED_LAYOUTS__)
      ? window.__TIXALL_SAVED_LAYOUTS__
      : [];

    const match = maps.find((m) => m && m.id === seatMapId);
    if (!match || !match.layout || !match.layout.konvaJson) {
      window.alert("Saved layout not found for this venue.");
      return false;
    }

    // eslint-disable-next-line no-console
    console.info("[seatmap] load: loading from dropdown/button", {
      seatMapId,
      name: match.name,
      jsonLength: match.layout.konvaJson
        ? match.layout.konvaJson.length
        : 0,
    });

    const loaded = loadKonvaLayoutIntoStage(match.layout.konvaJson, {
      resetHistory: true,
      reattachBehaviours: true,
    });

    if (loaded) {
      setTicketSeatSelectionMode(false, "load-saved-layout");
      setCurrentSeatMapMeta(match.id, match.name);
      initTableCounterFromExisting();
      const select = document.getElementById("tb-saved-layout-select");
      if (select) {
        select.value = seatMapId;
      }
    }

    return !!loaded;
  }

  async function refreshSavedLayoutsDropdown() {
    const select = document.getElementById("tb-saved-layout-select");

    try {
      const res = await fetch(
        `/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}`
      );
      if (!res.ok) return;

      const data = await res.json();
      applyShowMeta(data);
      const lists = [];

      if (data && data.activeSeatMap) {
        lists.push(data.activeSeatMap);
      }

      if (Array.isArray(data.previousMaps)) {
        data.previousMaps.forEach((m) => {
          const already = lists.some((existing) => existing.id === m.id);
          if (!already) lists.push(m);
        });
      }

      // eslint-disable-next-line no-underscore-dangle
      window.__TIXALL_SAVED_LAYOUTS__ = lists;

      if (!select) return;

      select.innerHTML = "";

      if (!lists.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = "No saved layouts for this venue";
        select.appendChild(opt);
        return;
      }

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = "Choose a saved layout…";
      select.appendChild(placeholder);

      lists.forEach((layout) => {
        const opt = document.createElement("option");
        opt.value = layout.id;
        opt.textContent = layout.name || "Layout";
        select.appendChild(opt);
      });

      if (currentSeatMapId) {
        select.value = currentSeatMapId;
      }

      // eslint-disable-next-line no-console
      console.info("[seatmap] saved layouts refreshed", {
        count: lists.length,
        ids: lists.map((l) => l.id),
      });

      syncDeleteButtonState();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[seatmap] Failed to refresh saved layouts", err);
    }
  }

  // ---------- Boot ----------

  initStage();
  updateDefaultCursor();
  hookToolButtons();
  hookZoomButtons();
  hookClearButton();
  hookUndoRedoButtons();
  hookSavedLayoutSelectWatcher();
  hookSaveButton();
  hookLoadButton();
  hookPhase1Buttons(); // Phase 1 Draft/Publish
  hookDeleteButton();
  syncDeleteButtonState();

  // Allow the top-bar dropdown (populated server-side) to trigger a layout load.
  // eslint-disable-next-line no-underscore-dangle
  window.__TIXALL_HANDLE_SAVED_LAYOUT_SELECT__ = async function (seatMapId) {
    const ok = await loadSavedLayoutById(seatMapId);
    if (!ok) {
      return;
    }

    // Reset any active tool/selection so the newly loaded layout starts fresh.
    clearSelection();
    setActiveTool("select");
  };
// [Source: ~8745] - Tab Switch Handler
window.__TIXALL_SET_TAB_MODE__ = function (tab) {
  // 1. Update the global state variable
  activeMainTab = tab || "map";

  // 2. Reset all special interaction modes to prevent conflicts
  // This ensures we don't carry over "add ticket" or "add view" clicks into other tabs
  setTicketSeatSelectionMode(false, "tab-change");

  activeAccessibilityMode = null; // <--- Critical Fix for Holds & Glitches
  
  activeHoldMode = null;
  activeViewMode = false;
  activeViewType = null; // Clear sub-mode (Info vs View)
  activeViewInfoId = null;

  // 3. Clear any selected objects (Transformer box) so we start clean
  clearSelection();

  // 4. Update the Side Panel content based on the new tab
  if (activeMainTab === "tickets") {
    findDuplicateSeatRefs();
    renderTicketingPanel();
  } 
  else if (activeMainTab === "holds") {
    // --- Toast Notification (Preserved from your code) ---
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: absolute; top: 80px; left: 50%; transform: translateX(-50%);
      background: #111827; color: white; padding: 12px 20px; border-radius: 99px;
      font-family: system-ui; font-size: 14px; font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 9999; pointer-events: none;
      animation: fadeOut 0.5s ease 4s forwards;
    `;
    toast.textContent = "Use this section to block seating or allocate to external promoters";
    document.body.appendChild(toast);
    setTimeout(() => { 
      if (toast.parentNode) toast.parentNode.removeChild(toast); 
    }, 4500);
    
    renderHoldsPanel();
  } 
  else if (activeMainTab === "view") {
    // --- View Tab Logic (Preserved from your code) ---
    activeViewMode = true; // Flag used by applySeatVisuals to show 'V'/'i'
    
    // Load items from stage attributes if they exist (persistence)
    const stored = stage.getAttr("sbViewInfoItems");
    if (stored) {
      try { viewInfoItems = JSON.parse(stored); } catch (e) {}
    }
    renderViewFromSeatsPanel();
  } 
  else {
    // Map Tab (Default)
    // We don't render panel here because we want the Inspector (which renders on selection)
    renderInspector(selectedNode);
  }

  // 5. CRITICAL: Refresh all visuals (Colors, Rings, Icons)
  // This calls updateTicketRings() internally.
  // Because we updated 'activeMainTab' at the start of this function,
  // applySeatVisuals will now know exactly which elements to Hide vs Show.
  applySeatVisuals(); 
};
  stage.on("click", handleStageClick);
  stage.on("contentClick", handleStageClick);
  stage.on("tap", handleStageClick);
    stage.on("mousedown.ticketAssign", (evt) => {
    // In manual ticket seat mode we now let the individual seat nodes handle
    // assignment themselves (refreshSeatTicketListeners attaches a Konva
    // listener directly to each seat). The stage-level handler is kept only
    // as a guard / debug hook and MUST NOT toggle seats.
    if (!ticketSeatSelectionMode || !stage) return;

    // If a seat handler has already processed this DOM event, bail out.
    if (evt && evt.evt && evt.evt._sbSeatAssignHandled) {
      return;
    }

    // Debug-only logging.
    // eslint-disable-next-line no-console
    console.log("[seatmap][tickets] stage mousedown (assign mode – noop)", {
      ticketId: getActiveTicketIdForAssignments(),
      pointer: stage.getPointerPosition(),
      targetName:
        evt.target && evt.target.name
          ? evt.target.name()
          : evt.target && evt.target.className,
    });

    // No call to handleTicketSeatSelection here on purpose.
  });

  // Canvas interactions
  stage.on("mousedown", handleStageMouseDown);
  stage.on("mousemove", handleStageMouseMove);
  stage.on("mouseup", handleStageMouseUp);
  stage.on("mouseleave", handleStageMouseUp);

  // Double-click anywhere to finish the current straight line (if any)
  stage.on("dblclick", () => {
    if (activeTool !== "line" || !currentLineGroup) {
      return;
    }
    finishCurrentLine(true);
  });

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", resizeStageToContainer);

  resizeStageToContainer();
  pushHistory();
  updateSeatCount();

  refreshSeatMetadata();
  applySeatVisuals();

  renderInspector(null);

    // ---------- Saved layout loader ----------

    // Load a saved Konva layout JSON into the existing stage/mapLayer.
    // - Supports both old full-Stage JSON and new Layer-only JSON.
    // - Never creates a Stage from JSON, so we avoid "Stage has no container" errors.
  function loadKonvaLayoutIntoStage(konvaJson, options) {
      const opts = options || {};

      if (!stage || !mapLayer) {
        // eslint-disable-next-line no-console
        console.warn("[seatmap] loadKonvaLayoutIntoStage: no stage/mapLayer yet");
        return false;
      }

      if (!konvaJson) {
        // Nothing to load – just reset history and seat count
        history = [];
        historyIndex = -1;
        updateSeatCount();
        updateUndoRedoButtons && updateUndoRedoButtons();
        // eslint-disable-next-line no-console
        console.info("[seatmap] loadKonvaLayoutIntoStage: empty layout reset");
        return;
      }

      // --- Step 1: get a plain JS object from whatever we were passed ---
      let jsonObj = null;

      try {
        if (typeof konvaJson === "string") {
          jsonObj = JSON.parse(konvaJson);
        } else {
          jsonObj = konvaJson;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          "[seatmap] loadKonvaLayoutIntoStage: invalid JSON",
          err
        );
        return;
      }

      // --- Step 2: normalise to a Layer JSON blob (handle old Stage JSON too) ---
      function pickLayerJson(obj) {
        if (!obj || typeof obj !== "object") return null;

    const cls = obj.className || obj.nodeType;

    // Already a layer
    if (cls === "Layer") {
      return obj;
    }

    // Old full-stage JSON: { className: "Stage", children: [...] }
    if (cls === "Stage" && Array.isArray(obj.children)) {
      const children = obj.children;

      // Prefer something clearly marked as the map layer
      const explicit = children.find(
        (c) =>
          c.className === "Layer" &&
          c.attrs &&
          (c.attrs.id === "mapLayer" ||
            c.attrs.name === "map-layer" ||
            c.attrs.name === "seatmap")
      );
      if (explicit) return explicit;

      // Otherwise, pick a Layer that actually listens (skips non-interactive grid)
      const interactive = children.find(
        (c) => c.className === "Layer" && (!c.attrs || c.attrs.listening !== false)
      );
      if (interactive) return interactive;

      // As a last resort, return the first Layer child
      const anyLayer = children.find((c) => c.className === "Layer");
      if (anyLayer) return anyLayer;
    }

    // If it has children but no explicit className, try to dive once
    if (Array.isArray(obj.children)) {
      const childLayer = obj.children.find((c) => c.className === "Layer");
      if (childLayer) return childLayer;
    }

    // Fallback – treat as layer-like
    return obj;
  }

  const layerJson = pickLayerJson(jsonObj);

  // eslint-disable-next-line no-console
  console.info("[seatmap] loadKonvaLayoutIntoStage: parsed JSON", {
    hasChildren: Array.isArray(jsonObj && jsonObj.children)
      ? jsonObj.children.length
      : null,
    layerFound: !!layerJson,
    layerId: layerJson && layerJson.attrs ? layerJson.attrs.id : null,
    layerName: layerJson && layerJson.attrs ? layerJson.attrs.name : null,
  });

  if (!layerJson) {
    // eslint-disable-next-line no-console
    console.warn(
      "[seatmap] loadKonvaLayoutIntoStage: no Layer found in konvaJson",
      jsonObj
    );
    return false;
  }

  // --- Step 3: actually create a Konva.Layer from the JSON (NOT a Stage) ---
  let newLayer;
  try {
    newLayer = Konva.Node.create(layerJson);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[seatmap] loadKonvaLayoutIntoStage: failed to create Konva node from JSON",
      err
    );
    return false;
  }

  if (!(newLayer instanceof Konva.Layer)) {
    // eslint-disable-next-line no-console
    console.error(
      "[seatmap] loadKonvaLayoutIntoStage: JSON did not produce a Layer, got:",
      newLayer && newLayer.getClassName
        ? newLayer.getClassName()
        : newLayer
    );
    return false;
  }

  // Ensure the layer is tagged consistently so future saves/loads can find it.
  if (!newLayer.id()) {
    newLayer.id("mapLayer");
  }
  newLayer.name((newLayer.name() || "").length ? newLayer.name() : "map-layer");

  // --- Step 4: swap the mapLayer and re-wire behaviour on all children ---
  try {
    mapLayer.destroy();
  } catch (e) {
    // ignore
  }

  mapLayer = newLayer;
  if (typeof mapLayer.listening === "function") {
    mapLayer.listening(true);
  }
  stage.add(mapLayer);
  if (gridLayer && gridLayer.getStage && gridLayer.getStage()) {
    gridLayer.moveToBottom();
  }
  if (mapLayer && mapLayer.getStage && mapLayer.getStage()) {
    mapLayer.moveToTop();
  }
  if (overlayLayer && overlayLayer.getStage && overlayLayer.getStage()) {
    overlayLayer.moveToTop();
  }

  // eslint-disable-next-line no-console
  console.info("[seatmap] loadKonvaLayoutIntoStage: layer attached", {
    children: mapLayer.getChildren().length,
    hasStage: !!mapLayer.getStage(),
  });

  // Re-attach behaviours to every group loaded from JSON
  if (opts.reattachBehaviours !== false && typeof attachNodeBehaviour === "function") {
    mapLayer.find("Group").forEach((g) => {
      attachNodeBehaviour(g);
      // normalise z-order so seat blocks / tables sit above background shapes
      sbNormalizeZOrder && sbNormalizeZOrder(g);
    });
  }

  mapLayer.draw();

  // Clear any previous selection / transformer state
  if (typeof clearSelection === "function") {
    clearSelection();
  }

  // Reset history with this loaded state as the first entry
  if (opts.resetHistory !== false) {
    history = [];
    historyIndex = -1;
    pushHistory && pushHistory();
  }

  updateSeatCount && updateSeatCount();
  updateUndoRedoButtons && updateUndoRedoButtons();

  refreshSeatMetadata();
    applySeatVisuals();
// eslint-disable-next-line no-console
console.log("[seatmap] loadKonvaLayoutIntoStage: layout loaded");
return true;
}

})();
 
 
