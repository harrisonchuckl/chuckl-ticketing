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

  // ---------- Inject modern styles (Apple / Canva vibes) ----------

  function injectSeatmapStyles() {
    if (document.getElementById("sb-seatmap-style")) return;

    const style = document.createElement("style");
    style.id = "sb-seatmap-style";
    style.textContent = `
      .sb-layout {
        font-family: -apple-system,BlinkMacSystemFont,"system-ui","Segoe UI",sans-serif;
      }

      .sb-sidebar-col {
        background: radial-gradient(circle at top left,#eef2ff 0,#f9fafb 42%,#f3f4f6 100%);
        border-left: 1px solid #e5e7eb;
      }

      #sb-inspector {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid rgba(148,163,184,0.35);
        box-shadow: 0 14px 40px rgba(15,23,42,0.12);
        padding: 10px;
      }

      .sb-inspector-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .12em;
        color: #6b7280;
        margin: 2px 0 6px;
      }

      .sb-inspector-empty {
        font-size: 12px;
        color: #6b7280;
        padding: 8px 2px;
      }

      .sb-field-row {
        margin-bottom: 10px;
      }

      .sb-label span {
        font-size: 11px;
        color: #6b7280;
        font-weight: 500;
        text-transform: none;
      }

      .sb-input,
      .sb-select {
        width: 100%;
        box-sizing: border-box;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        padding: 6px 9px;
        font-size: 13px;
        background: #f9fafb;
        outline: none;
        transition: border-color .12s ease, box-shadow .12s ease, background .12s ease;
      }

      .sb-input:focus,
      .sb-select:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 1px rgba(37,99,235,0.25);
        background: #ffffff;
      }

      .sb-static-label {
        font-size: 11px;
        color: #6b7280;
      }

      .sb-static-value {
        font-size: 13px;
        font-weight: 500;
        color: #111827;
      }

      .sb-field-row.sb-field-static {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 2px;
        border-radius: 8px;
        background: linear-gradient(90deg,#f9fafb, #eef2ff);
      }

      .tool-button {
        width: 100%;
        height: 52px;
        box-sizing: border-box;
        border-radius: 14px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        display: flex !important;
        align-items: center;
        justify-content: center;
        margin-bottom: 6px;
        box-shadow: 0 6px 18px rgba(15,23,42,0.05);
        cursor: pointer;
        transition:
          transform .09s ease,
          box-shadow .09s ease,
          border-color .09s ease,
          background .09s ease;
      }

      .tool-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 26px rgba(15,23,42,0.12);
        border-color: rgba(148,163,184,0.7);
      }

      .tool-button.is-active {
        border-color: #2563eb;
        box-shadow: 0 0 0 1px rgba(37,99,235,0.28),0 12px 28px rgba(37,99,235,0.28);
        background: linear-gradient(135deg,#eff6ff,#e0f2fe);
      }

      .tool-button > * {
        pointer-events: none;
      }

      .tool-button svg,
      .tool-button img {
        width: 22px;
        height: 22px;
      }

      .tool-button span {
        font-size: 14px;
      }

      .sb-ticketing-heading {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
      }

      .sb-ticketing-title {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
      }

      .sb-ticketing-sub {
        font-size: 12px;
        color: #6b7280;
      }

      .sb-ticketing-alert {
        background: linear-gradient(135deg, #fef2f2, #fee2e2);
        border: 1px solid #fecaca;
        color: #b91c1c;
        padding: 8px 10px;
        border-radius: 12px;
        font-size: 12px;
        margin: 4px 0 12px;
      }

      .sb-ticket-stack {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .sb-ticket-card {
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        background: linear-gradient(145deg, #ffffff, #f8fafc);
        box-shadow: 0 10px 26px rgba(15,23,42,0.06);
        overflow: hidden;
        transition: border-color .12s ease, box-shadow .12s ease;
      }

      .sb-ticket-card.is-active {
        border-color: #2563eb;
        box-shadow: 0 16px 36px rgba(37,99,235,0.18);
      }

      .sb-ticket-card-header {
        width: 100%;
        background: transparent;
        border: none;
        padding: 12px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        gap: 8px;
      }

      .sb-ticket-card-main {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .sb-ticket-card-copy {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .sb-ticket-name {
        font-size: 14px;
        font-weight: 700;
        color: #111827;
      }

      .sb-ticket-meta {
        font-size: 12px;
        color: #6b7280;
      }

      .sb-ticket-card-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sb-ticket-swatch {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,0.06);
        box-shadow: 0 0 0 2px #fff;
      }

      .sb-ticket-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: #eef2ff;
        color: #4338ca;
        font-size: 12px;
        font-weight: 600;
      }

      .sb-ticket-caret {
        font-size: 14px;
        color: #6b7280;
      }

      .sb-ticket-card-body {
        padding: 0 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .sb-ticket-form-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .sb-field-col .sb-label {
        display: block;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 4px;
        font-weight: 600;
      }

      .sb-helper {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 2px;
      }

      .sb-field-error {
        font-size: 12px;
        color: #b91c1c;
        margin-top: -4px;
      }

      .sb-ticket-assignments {
        font-size: 13px;
        font-weight: 600;
        color: #111827;
        padding: 4px 2px;
      }

      .sb-ticket-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
      }

      .sb-input-inline {
        display: inline-block;
      }

      .sb-input-color {
        padding: 0;
        height: 40px;
      }

      .sb-textarea {
        min-height: 70px;
        resize: vertical;
      }

      .sb-ghost-button {
        background: linear-gradient(135deg,#f8fafc,#eef2ff);
      }

      .sb-ticket-add {
        margin-top: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .sb-ticket-add-icon {
        font-size: 16px;
        line-height: 1;
      }
    `;
    document.head.appendChild(style);
  }

  injectSeatmapStyles();

  // ---------- Ensure sidebar DOM (seat count + inspector) ----------

    function ensureSidebarDom() {
    const parent = container.parentNode;
    if (!parent) return;

    let wrapper = parent.querySelector(".sb-layout");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "sb-layout";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "stretch";
      wrapper.style.width = "100%";
      // 🔒 Lock the whole builder to the viewport height so the left side
      // (tabs + map) stays fixed while only the right sidebar scrolls.
      wrapper.style.height = "100vh";
      wrapper.style.boxSizing = "border-box";

      parent.insertBefore(wrapper, container);
      wrapper.appendChild(container);
    }

    let sidebarCol = wrapper.querySelector(".sb-layout-sidebar");
    if (!sidebarCol) {
      sidebarCol = document.createElement("div");
      sidebarCol.className = "sb-layout-sidebar";
      sidebarCol.style.flex = "0 0 360px";
      sidebarCol.style.maxWidth = "360px";
      sidebarCol.style.borderLeft = "1px solid #e5e7eb";
      sidebarCol.style.background = "#f9fafb";
      sidebarCol.style.display = "flex";
      sidebarCol.style.flexDirection = "column";
      sidebarCol.style.boxSizing = "border-box";

      const inspectorDiv = document.createElement("div");
      inspectorDiv.id = "sb-inspector";
      inspectorDiv.style.flex = "1 1 auto";
      inspectorDiv.style.overflowY = "auto";
      inspectorDiv.style.padding = "16px 16px 24px";
      inspectorDiv.style.boxSizing = "border-box";

      sidebarCol.appendChild(inspectorDiv);

      wrapper.appendChild(sidebarCol);
    }
  }



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

  // current selection + copy buffer
  let selectedNode = null;
  let copiedNodesJson = [];

  let activeMainTab = "map";

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

  // ---------- Grid ----------

  function drawSquareGrid() {
    if (!gridLayer || !stage) return;

    gridLayer.destroyChildren();

    const width = stage.width();
    const height = stage.height();

    for (let x = 0; x <= width; x += GRID_SIZE) {
      const line = new Konva.Line({
        points: [x, 0, x, height],
        stroke: "rgba(148,163,184,0.25)",
        strokeWidth: x % (GRID_SIZE * 4) === 0 ? 1.1 : 0.6,
      });
      gridLayer.add(line);
    }

    for (let y = 0; y <= height; y += GRID_SIZE) {
      const line = new Konva.Line({
        points: [0, y, width, y],
        stroke: "rgba(148,163,184,0.25)",
        strokeWidth: y % (GRID_SIZE * 4) === 0 ? 1.1 : 0.6,
      });
      gridLayer.add(line);
    }

    gridLayer.batchDraw();
  }

  function resizeStageToContainer() {
    if (!stage) return;

    const width = container.clientWidth - STAGE_PADDING * 2;
    const height = container.clientHeight - STAGE_PADDING * 2;

    baseStageWidth = width;
    baseStageHeight = height;

    const currentScale = stage.scaleX() || 1;

    stage.size({
      width: baseStageWidth / currentScale,
      height: baseStageHeight / currentScale,
    });

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

    mapLayer.getChildren().forEach((node) => {
      attachNodeBehaviour(node);
    });

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

function updateTicketRings() {
    if (!mapLayer) return;

    const seats = getAllSeatNodes();
    if (!seats || !seats.length) return;

    // Quick lookup from ticket id -> ticket object (for colours etc.)
    const ticketById = new Map();
    ticketTypes.forEach((t) => {
        if (t && t.id) ticketById.set(t.id, t);
    });

    seats.forEach((seatCircle) => {
        // 1. Basic Validation
        if (!seatCircle || !seatCircle.getAttr || !seatCircle.getAttr("isSeat")) {
            return;
        }

        // 2. Get Parent Group
        const group = seatCircle.getParent && seatCircle.getParent();
        if (!group || typeof group.getChildren !== "function") return;

        // 3. Get Seat ID (Needed before cleanup now)
        const sid = ensureSeatIdAttr(seatCircle);
        if (!sid) return;

        // --- FIX: TARGETED CLEANUP ---
        // If seats share a parent group (like in a row), we must ensure
        // we only destroy rings that belong to THIS specific seat ID.
        const existingRings = group.getChildren().filter((child) => {
            // A) Verify it is a ticket ring node
            const isNode = child && typeof child.getAttr === "function";
            if (!isNode) return false;
            
            const hasAttr = child.getAttr("isTicketRing");
            const hasName = child.name() === "ticket-ring";
            if (!hasAttr && !hasName) return false;

            // B) Verify ownership
            const ownerId = child.getAttr("ringOwnerSeatId");
            // Destroy if it belongs to this seat ID, OR if it's an old legacy ring marked as undefined/null
            return ownerId === sid || ownerId === undefined || ownerId === null;
        });
        
        // Safely destroy the filtered list
        existingRings.forEach((ring) => ring.destroy());

        // 4) Work out which tickets are assigned to this seat.
        const set = ticketAssignments.get(sid);
        if (!set || !set.size) return; // No tickets for this seat, we are done.

        const ticketIds = Array.from(set);
        if (!ticketIds.length) return;

        // 5) Base radius from the core seat circle.
        const baseRadius =
            typeof seatCircle.radius === "function" ?
            seatCircle.radius() :
            seatCircle.getAttr("radius") || 8;

        // 6) Draw new rings (max 10)
    const maxRings = Math.min(ticketIds.length, 10);
    for (let i = 0; i < maxRings; i += 1) {
        const tId = ticketIds[i];
        if (!tId) continue;
        const ticket = ticketById.get(tId);
        const color = (ticket && ticket.color) || "#2563eb";
        
        // --- CRITICAL FIX: Changed the starting point from `+ 3` to `+ 1.5` ---
        // The base seat has a stroke of 1.5, so the first ring should start there (i=0).
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

            // Mark as a ring
            ring.setAttr("isTicketRing", true);
            // --- CRITICAL ADDITION: Tag with owner ID ---
            // This ensures subsequent cleanups know this ring belongs to this seat.
            ring.setAttr("ringOwnerSeatId", sid);

            group.add(ring);
        }
    });

    if (stage) {
        stage.batchDraw();
    }
}



  function applySeatVisuals() {
    refreshSeatMetadata();
    const seats = getAllSeatNodes();
    duplicateSeatRefs = computeDuplicateSeatRefsFromSeats(seats);

    seats.forEach((seat) => {
        const baseFill = seat.getAttr("sbSeatBaseFill") || "#ffffff";
        const baseStroke = seat.getAttr("sbSeatBaseStroke") || "#4b5563";
        const ref = seat.getAttr("sbSeatRef");
        
        // 1. Determine if a ticket is assigned (uses the ID of the first assigned ticket)
        const ticketId = seat.getAttr("sbTicketId") || null;

        let stroke = baseStroke;
        let fill = baseFill;

        if (ref && duplicateSeatRefs.has(ref)) {
            // Keep duplicate warning colors (Red)
            stroke = "#ef4444";
            fill = "#fee2e2";
        } else if (ticketId) {
            // --- NEW: Apply the first ticket's color to the base seat stroke ---
            const ticket = ticketTypes.find((t) => t.id === ticketId);
            if (ticket) {
                // Change the default black/grey stroke to the ticket color
                stroke = ticket.color || "#2563eb"; 
            }
        }
        // --- END NEW LOGIC ---

        seat.stroke(stroke);
        seat.fill(fill);
    });

    refreshSeatTicketListeners();

    // The updateTicketRings function (which we fixed previously) handles the rest of the stacked rings.
    updateTicketRings();

    if (mapLayer && typeof mapLayer.draw === "function") {
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
  const seats = getAllSeatNodes();
  let boundCount = 0;

  // 0. AGGRESSIVE DOM LISTENER CLEANUP
  // We must ensure the element holding the listener is cleaned up.
  if (window.ticketSeatDomListener && stage && stage.container && stage.container()) {
    // Remove the listener in the capture phase (if it was added there)
    stage.container().removeEventListener("pointerdown", window.ticketSeatDomListener, true);
    // Also try to remove it in the bubble phase
    stage.container().removeEventListener("pointerdown", window.ticketSeatDomListener, false);
    window.ticketSeatDomListener = null;
  }

  seats.forEach((seat) => {
    // 1. Clean up old Konva listeners
    if (typeof seat.off === "function") {
      seat.off(".ticketAssign");
    }

    // 2. Ensure seat is interactive
    if (typeof seat.listening === "function") {
      seat.listening(true);
    }

    // 3. Define the handler that does the actual assignment
      const seatHandler = (evt) => {
        const ticketId = getActiveTicketIdForAssignments();
        const seatNode = findSeatNodeFromTarget(evt.target) || seat;

      // START DIAGNOSTICS: This MUST show up if the click hits the seat shape
      // eslint-disable-next-line no-console
console.log("[seatmap][DEBUG-SEAT] SEAT CLICKED - Checkpoint 2: Konva Handler Fired", {
    // Keep the current check for context
    seatId_CurrentCheck: seatNode.id(), 
    // ADD THIS NEW LINE: Dumps all attributes
    ALL_NODE_ATTRIBUTES: seatNode.attrs, 
    ticketId,
    mode: ticketSeatSelectionMode
});

if (!ticketSeatSelectionMode || !ticketId || !seatNode) {
    return;
}

      // 4. CRITICAL: Stop the event here so it doesn't bubble up to Stage
      if (evt.evt) {
        evt.evt.stopPropagation();
        evt.evt.preventDefault();
        evt.evt._sbSeatAssignHandled = true;
      }
      evt.cancelBubble = true;

      lastSeatAssignEventAt = Date.now();

      // 5. Execute the toggle logic
      toggleSeatTicketAssignment(seatNode, ticketId);
      applySeatVisuals();
      renderTicketingPanel(); 
      pushHistory();
    };

    // 6. Bind to the earliest events: pointerdown, click, and tap
    seat.on("pointerdown.ticketAssign click.ticketAssign tap.ticketAssign", seatHandler);
    boundCount++;
  });
  
  // eslint-disable-next-line no-console
  console.log(`[seatmap][DEBUG-BIND] ${boundCount} seat assignment listeners re-bound.`);

  // 7. Clean up any lingering layer listeners
  if (mapLayer && typeof mapLayer.off === "function") {
    mapLayer.off(".ticketAssign");
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
  ticketSeatSelectionMode = !!enabled;
  ticketSeatSelectionReason = reason || "unknown";

  if (!ticketSeatSelectionMode) {
    ticketSeatSelectionAction = "toggle";
  } else {
    ticketSeatSelectionAction = "toggle";
  }
  
  // Ensure all debug listeners are active
  addDebugStagePointerListener(); 
  addDebugContainerPointerListener();
  addDebugDocumentPointerListener(); // <--- NEW CALL

  // 1. Force the Layer to listen.
  if (mapLayer && typeof mapLayer.listening === "function") {
    mapLayer.listening(true);
  }

  // 2. Force all seats and their groups to listen
  const seats = getAllSeatNodes();
  seats.forEach((seat) => {
    // Force seat to listen
    if (typeof seat.listening === "function") {
      seat.listening(true);
    }
    // Walk up the tree and force all parents to listen
    let parent = seat.getParent && seat.getParent();
    while (parent) {
      if (typeof parent.listening === "function") {
        parent.listening(true);
      }
      parent = parent.getParent && parent.getParent();
    }
  });

  // 3. Re-apply the listeners 
  refreshSeatTicketListeners();

  // eslint-disable-next-line no-console
  console.log("[seatmap][tickets] seat-selection-mode", {
    enabled: ticketSeatSelectionMode,
    activeTicketId: activeTicketSelectionId,
    seatCount: seats.length,
    reason: ticketSeatSelectionReason,
    action: ticketSeatSelectionAction,
    prev,
  });
  
  if (!ticketSeatSelectionMode) {
    clearSelection();
    if (transformer && typeof transformer.nodes === "function") {
      transformer.nodes([]);
    }
  }

  // 4. Force a redraw to ensure the Konva Hit Graph is updated
  if (mapLayer) {
    mapLayer.batchDraw();
  }
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
    const { sid, set } = ensureSeatTicketSet(seat);
    if (!sid || !set || !ticketId) return;

    const hadTicket = set.has(ticketId);

    // eslint-disable-next-line no-console
    console.debug("[seatmap][tickets] toggleSeatTicketAssignment", {
      seatId: sid,
      existingTickets: Array.from(set),
      ticketId,
      action: "toggle",
    });

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

    // eslint-disable-next-line no-console
    console.debug("[seatmap][tickets] seat state", {
      seatId: sid,
      nowAssignedTo: ids,
    });
  }


    function handleTicketSeatSelection(pointerPos, target) {
    const ticketId = getActiveTicketIdForAssignments();
    let seatNode = findSeatNodeFromTarget(target);

    // eslint-disable-next-line no-console
    console.log("[seatmap][tickets] seat-selection handler", {
      pointer: pointerPos,
      ticketId,
      targetName:
        target && target.name
          ? target.name()
          : target && target.className,
      selectionModeOn: ticketSeatSelectionMode,
      action: ticketSeatSelectionAction,
    });

    // -------- FULL-ROW SELECTION VIA ROW LABEL --------
    if (
      !seatNode &&
      target &&
      typeof target.getAttr === "function" &&
      target.getAttr("isRowLabel")
    ) {
      const rowLabelText =
        (typeof target.text === "function" && target.text()) ||
        target.getAttr("text") ||
        "";

      if (!ticketId) {
        // eslint-disable-next-line no-console
        console.warn(
          "[seatmap][tickets] row-label click ignored (no active ticket)",
          { rowLabelText }
        );
        return false;
      }

      if (rowLabelText) {
        const allSeats = getAllSeatNodes().filter(
          (seat) =>
            seat &&
            typeof seat.getAttr === "function" &&
            (seat.getAttr("sbSeatRowLabel") || "") === rowLabelText
        );

        if (allSeats.length) {
          allSeats.forEach((seat) => {
            toggleSeatTicketAssignment(seat, ticketId);
          });

          applySeatVisuals();
          renderTicketingPanel();
          pushHistory();

          // eslint-disable-next-line no-console
          console.log("[seatmap][tickets] row-label selection", {
            rowLabelText,
            seatCount: allSeats.length,
            ticketId,
          });

          return true;
        }
      }
    }

    // -------- FULL-TABLE SELECTION VIA TABLE BODY --------
    if (
      !seatNode &&
      target &&
      typeof target.findAncestor === "function"
    ) {
      const tableGroup = target.findAncestor(
        (n) =>
          n &&
          typeof n.getAttr === "function" &&
          (n.getAttr("shapeType") === "circular-table" ||
            n.getAttr("shapeType") === "rect-table"),
        true
      );

      if (tableGroup && typeof tableGroup.find === "function") {
        const tableSeats = tableGroup.find(
          (n) => n.getAttr && n.getAttr("isSeat")
        );

        if (tableSeats && tableSeats.length) {
          if (!ticketId) {
            // eslint-disable-next-line no-console
            console.warn(
              "[seatmap][tickets] table click ignored (no active ticket)"
            );
            return false;
          }

          tableSeats.forEach((seat) => {
            toggleSeatTicketAssignment(seat, ticketId);
          });

          applySeatVisuals();
          renderTicketingPanel();
          pushHistory();

          // eslint-disable-next-line no-console
          console.log("[seatmap][tickets] table selection", {
            tableShapeType: tableGroup.getAttr("shapeType"),
            seatCount: tableSeats.length,
            ticketId,
          });

          return true;
        }
      }
    }

    // -------- FALL BACK TO SINGLE-SEAT DETECTION (existing behaviour) --------
    if (
      !seatNode &&
      stage &&
      typeof stage.getAllIntersections === "function" &&
      pointerPos
    ) {
      const hits = stage.getAllIntersections(pointerPos) || [];
      // eslint-disable-next-line no-console
      console.debug("[seatmap][tickets] intersections", {
        hitCount: hits.length,
        hitNames: hits.map((h) =>
          h.name ? h.name() : h.className
        ),
      });
      seatNode =
        hits
          .map((h) => findSeatNodeFromTarget(h))
          .find(Boolean) || seatNode;
    }

    if (
      !seatNode &&
      mapLayer &&
      typeof mapLayer.getIntersection === "function" &&
      pointerPos
    ) {
      const hit = mapLayer.getIntersection(pointerPos);
      if (hit) {
        seatNode = findSeatNodeFromTarget(hit);
      }
    }

    if (!seatNode && pointerPos) {
      seatNode = findSeatNodeAtPosition(pointerPos) || seatNode;
    }

    // eslint-disable-next-line no-console
    console.log("[seatmap][tickets] click", {
      ticketId,
      seatFound: Boolean(seatNode),
      targetName:
        target && target.name
          ? target.name()
          : target && target.className,
      selectionModeOn: ticketSeatSelectionMode,
      action: ticketSeatSelectionAction,
      pointer: pointerPos,
    });

    if (seatNode && ticketId) {
      toggleSeatTicketAssignment(seatNode, ticketId);
      applySeatVisuals();
      renderTicketingPanel();
      pushHistory();
      return true;
    }

    // eslint-disable-next-line no-console
    console.warn("[seatmap][tickets] click ignored", {
      reason: seatNode ? "no-ticket-id" : "no-seat-detected",
      selectionModeOn: ticketSeatSelectionMode,
    });
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

    const titleWrap = document.createElement("div");
    titleWrap.className = "sb-ticketing-heading";
    titleWrap.innerHTML = `
      <div class="sb-ticketing-title">Tickets</div>
      <div class="sb-ticketing-sub">Create ticket types, configure rules, and assign seats.</div>
    `;
    el.appendChild(titleWrap);

    if (duplicates.size) {
      const warning = document.createElement("div");
      warning.className = "sb-ticketing-alert";
      warning.textContent =
        "You have duplicate seat references. Fix the highlighted seats before creating tickets.";
      el.appendChild(warning);
    }

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

    const ticketsContainer = document.createElement("div");
    ticketsContainer.className = "sb-ticket-stack";
    el.appendChild(ticketsContainer);

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
        helper.textContent = helperText;
        wrapper.appendChild(helper);
      }

      return wrapper;
    };

    if (!ticketTypes.length) {
      const empty = document.createElement("div");
      empty.className = "sb-inspector-empty";
      // disable pointer events on the empty state message
      empty.style.pointerEvents = "none";
      empty.style.margin = "8px 0 16px";
      empty.textContent = "No tickets yet. Add one to start assigning seats.";
      el.appendChild(empty);
    }

    ticketTypes.forEach((ticket) => {
      ensureTicketDefaults(ticket);

      const assignedTotal = countAssignmentsForTicket(ticket.id);
      const isActive = activeTicketSelectionId === ticket.id;
      // 🔽 Only use the accordion set to decide open/closed
      const isOpen = ticketAccordionOpenIds.has(ticket.id);

      const card = document.createElement("div");
      card.className = "sb-ticket-card";
      if (isActive) card.classList.add("is-active");

      const header = document.createElement("button");
      header.type = "button";
      header.className = "sb-ticket-card-header";
      header.innerHTML = `
        <div class="sb-ticket-card-main">
          <span class="sb-ticket-swatch" style="background:${ticket.color || "#2563eb"};"></span>
          <div class="sb-ticket-card-copy">
            <div class="sb-ticket-name">${(ticket.name || "Untitled ticket").slice(0, 60)}</div>
            <div class="sb-ticket-meta">${formatTicketPrice(ticket.price)} • ${assignedTotal} assigned</div>
          </div>
        </div>
        <div class="sb-ticket-card-actions">
          <span class="sb-ticket-chip">${ticket.currency || venueCurrencyCode}</span>
          <span class="sb-ticket-caret">${isOpen ? "▴" : "▾"}</span>
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

      if (isOpen) {
        const body = document.createElement("div");
        body.className = "sb-ticket-card-body";

                const formGrid = document.createElement("div");
        formGrid.className = "sb-ticket-form-grid";

                // --- Ticket name: editable without killing focus on each keypress ---

               // --- Ticket name: editable without killing focus on each keypress ---



        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "sb-input";
        nameInput.placeholder = "Ticket name";
        nameInput.value = ticket.name || "";

        // As the user types, just keep the in-memory ticket name in sync.
        // DO NOT re-render here or the input will be destroyed each time.
        nameInput.addEventListener("input", () => {
          ticket.name = nameInput.value;
        });

        // Commit + re-render when the user finishes editing
        const commitNameChange = () => {
          const trimmed = (nameInput.value || "").trim();
          ticket.name = trimmed || "Untitled ticket";
          renderTicketingPanel();
        };

        // Blur = done editing
        nameInput.addEventListener("blur", commitNameChange);

        // Hitting Enter also commits and exits the field
        nameInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            nameInput.blur();
          }
        });



        // --- Ticket price: allow decimals, no re-render on every keypress ---



        const priceInput = document.createElement("input");
        priceInput.type = "text";
        priceInput.inputMode = "decimal";
        priceInput.className = "sb-input sb-input-inline";
        priceInput.placeholder = `Price (${venueCurrencyCode})`;
        priceInput.value =
          ticket.price === null || ticket.price === undefined
            ? ""
            : String(ticket.price);

        // Live update in memory as the user types, but DON'T re-render yet
        priceInput.addEventListener("input", () => {
          const raw = (priceInput.value || "")
            .replace(/[^0-9.,-]/g, "")
            .replace(/,/g, ".");

          if (!raw) {
            // Allow the user to temporarily clear the field while typing
            ticket.price = null;
            return;
          }

          const parsed = parseFloat(raw);
          if (Number.isFinite(parsed)) {
            ticket.price = parsed; // supports decimals, e.g. 22.5 or 2250
          }
        });

        const commitPriceChange = () => {
          const raw = (priceInput.value || "").trim();

          if (!raw) {
            ticket.price = null;
          } else {
            const cleaned = raw
              .replace(/[^0-9.,-]/g, "")
              .replace(/,/g, ".");
            const parsed = parseFloat(cleaned);
            ticket.price = Number.isFinite(parsed) ? parsed : 0;
          }

          // Now re-render once, after the user has finished editing
          renderTicketingPanel();
        };

        // Commit on blur
        priceInput.addEventListener("blur", commitPriceChange);

        // Commit on Enter key
        priceInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            priceInput.blur();
          }
        });



        // --- Ticket colour: preset chips + colour picker + hex input ---


        // --- Ticket colour: preset chips + colour picker + hex input ---

        const colorFieldWrap = document.createElement("div");


        const swatchRow = document.createElement("div");
        swatchRow.style.display = "flex";
        swatchRow.style.flexWrap = "wrap";
        swatchRow.style.gap = "4px";
        swatchRow.style.marginBottom = "6px";

        const normalisedCurrent =
          (ticket.color ||
            ticketFormState.color ||
            DEFAULT_TICKET_COLORS[0] ||
            "#2563EB").toString();
        const currentColor = normalisedCurrent.toLowerCase();

        const normaliseHexValue = (raw) => {
          if (!raw) return "";
          let v = String(raw).trim();
          if (!v) return "";
          if (!v.startsWith("#")) v = `#${v}`;
          v = v.toUpperCase();
          if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(v)) return "";
          return v;
        };

        DEFAULT_TICKET_COLORS.forEach((hex) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "tool-button sb-ghost-button";
          chip.style.minWidth = "22px";
          chip.style.width = "22px";
          chip.style.height = "22px";
          chip.style.borderRadius = "999px";
          chip.style.border =
            hex.toLowerCase() === currentColor
              ? "2px solid #111827"
              : "1px solid #e5e7eb";
          chip.style.padding = "0";
          chip.style.cursor = "pointer";
          chip.style.background = hex;
          chip.style.boxSizing = "border-box";
          chip.setAttribute("aria-label", `Use colour ${hex}`);

          chip.addEventListener("click", () => {
            ticket.color = hex;
            ticketFormState.color = hex;
            applySeatVisuals();
            renderTicketingPanel();
          });

          swatchRow.appendChild(chip);
        });

        const hexInput = document.createElement("input");
        hexInput.type = "text";
        hexInput.className = "sb-input";
        hexInput.placeholder = "#2563EB";
        hexInput.value =
          normaliseHexValue(currentColor) ||
          DEFAULT_TICKET_COLORS[0] ||
          "#2563EB";
        hexInput.style.marginTop = "4px";

        hexInput.addEventListener("change", () => {
          const hex = normaliseHexValue(hexInput.value);
          if (!hex) {
            // eslint-disable-next-line no-console
            console.warn("[seatmap][tickets] invalid hex colour entered", {
              raw: hexInput.value,
            });
            hexInput.value =
              ticket.color ||
              ticketFormState.color ||
              DEFAULT_TICKET_COLORS[0] ||
              "#2563EB";
            return;
          }

          ticket.color = hex;
          ticketFormState.color = hex;
          applySeatVisuals();
          renderTicketingPanel();
        });

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "sb-input sb-input-color";
        colorInput.value =
          normaliseHexValue(currentColor) ||
          DEFAULT_TICKET_COLORS[0] ||
          "#2563EB";
        colorInput.addEventListener("input", () => {
          const value =
            colorInput.value ||
            DEFAULT_TICKET_COLORS[0] ||
            "#2563EB";
          ticket.color = value;
          ticketFormState.color = value;
          hexInput.value = value.toUpperCase();
          applySeatVisuals();
          renderTicketingPanel();
        });

        colorFieldWrap.appendChild(swatchRow);
        colorFieldWrap.appendChild(colorInput);
        colorFieldWrap.appendChild(hexInput);

        const onSaleInput = document.createElement("input");
        onSaleInput.type = "datetime-local";
        onSaleInput.className = "sb-input";
        onSaleInput.value =
          ticket.onSale ||
          ticketFormState.onSale ||
          formatDateTimeLocal(new Date());
        onSaleInput.addEventListener("input", () => {
          ticket.onSale = onSaleInput.value;
        });

        const offSaleInput = document.createElement("input");
        offSaleInput.type = "datetime-local";
        offSaleInput.className = "sb-input";
        offSaleInput.value =
          ticket.offSale ||
          ticketFormState.offSale ||
          formatDateTimeLocal(new Date());
        offSaleInput.addEventListener("input", () => {
          ticket.offSale = offSaleInput.value;
          ticketFormAutoOffSale = false;
          renderTicketingPanel();
        });

        const offSaleError = document.createElement("div");
        offSaleError.className = "sb-field-error";
        const updateOffSaleValidation = () => {
          const showDateLimit = getShowDateLimit();
          const offDate = offSaleInput.value ? new Date(offSaleInput.value) : null;
          const invalid =
            !!(
              showDateLimit &&
              offDate &&
              !Number.isNaN(offDate.getTime()) &&
              offDate > showDateLimit
            );

          offSaleError.textContent = invalid
            ? "Ticket off-sale date/time must be on or before the event time."
            : "";
          return invalid;
        };

        updateOffSaleValidation();

        const minInput = document.createElement("input");
        minInput.type = "number";
        minInput.min = "1";
        minInput.step = "1";
        minInput.className = "sb-input";
        minInput.value = ticket.minPerOrder || 1;
        minInput.addEventListener("input", () => {
          const parsed = Math.max(1, parseInt(minInput.value || "1", 10) || 1);
          ticket.minPerOrder = parsed;
          if ((ticket.maxPerOrder || parsed) < parsed) {
            ticket.maxPerOrder = parsed;
          }
          renderTicketingPanel();
        });

        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.min = "1";
        maxInput.step = "1";
        maxInput.className = "sb-input";
        maxInput.value = ticket.maxPerOrder || 15;
        maxInput.addEventListener("input", () => {
          const parsed = Math.max(
            ticket.minPerOrder || 1,
            parseInt(maxInput.value || "15", 10) ||
              ticket.minPerOrder ||
              1
          );
          ticket.maxPerOrder = parsed;
          renderTicketingPanel();
        });

        const infoInput = document.createElement("textarea");
        infoInput.placeholder = "Additional information";
        infoInput.className = "sb-input sb-textarea";
        infoInput.value = ticket.info || "";
        infoInput.addEventListener("input", () => {
          ticket.info = infoInput.value;
        });

        formGrid.appendChild(
          makeField("Ticket name", nameInput, "Shown to buyers")
        );
        formGrid.appendChild(
          makeField(
            `Price (${venueCurrencyCode})`,
            priceInput,
            "Text input – no arrows"
          )
        );
        formGrid.appendChild(
          makeField(
            "Color",
            colorFieldWrap,
            "Used to highlight assigned seats"
          )
        );
        formGrid.appendChild(
          makeField(
            "Tickets on sale date and time",
            onSaleInput,
            "Defaults to now"
          )
        );

        formGrid.appendChild(
          makeField(
            "Tickets off sale date and time (auto-set to event time)",
            offSaleInput
          )
        );
        if (offSaleError.textContent) {
          const errWrap = document.createElement("div");
          errWrap.appendChild(offSaleError);
          formGrid.appendChild(errWrap);
        }
        formGrid.appendChild(makeField("Min tickets per order", minInput));
        formGrid.appendChild(makeField("Max tickets per order", maxInput));
        formGrid.appendChild(makeField("Additional information", infoInput));

        body.appendChild(formGrid);

        const assignments = document.createElement("div");
        assignments.className = "sb-ticket-assignments";
        assignments.textContent = `${assignedTotal} seat${
          assignedTotal === 1 ? "" : "s"
        } assigned to this ticket`;
        body.appendChild(assignments);

        const actionsRow = document.createElement("div");
        actionsRow.className = "sb-ticket-actions";

        const assignSelectedBtn = document.createElement("button");
        assignSelectedBtn.type = "button";
        assignSelectedBtn.className = "tool-button sb-ghost-button";
        const manualSelectionLabel =
          window.__SEATMAP_MANUAL_BUTTON_LABEL__ ||
          "Manually select seats for allocation/unallocation";
        const manualSelectionActiveLabel =
          window.__SEATMAP_MANUAL_BUTTON_ACTIVE_LABEL__ ||
          "Finish manual allocation/unallocation";

        assignSelectedBtn.textContent = ticketSeatSelectionMode
          ? manualSelectionActiveLabel
          : manualSelectionLabel;
        assignSelectedBtn.disabled =
          duplicates.size > 0 || updateOffSaleValidation();
        assignSelectedBtn.addEventListener("click", () => {
          if (duplicates.size > 0) {
            window.alert(
              "Resolve duplicate seat references before assigning tickets."
            );
            return;
          }
          if (updateOffSaleValidation()) {
            window.alert(
              "Tickets must go off sale on or before the event time. Please adjust the off-sale date."
            );
            return;
          }

          activeTicketSelectionId = ticket.id;
          ticketSeatSelectionAction = "toggle";

          const enabling = !ticketSeatSelectionMode;

          // eslint-disable-next-line no-console
          console.log("[seatmap][tickets] toggle manual seat selection", {
            ticketId: ticket.id,
            nowEnabling: enabling,
            action: ticketSeatSelectionAction,
          });

          if (enabling) {
            setTicketSeatSelectionMode(true, "assign-seats-button");
            window.alert(
              "Tap seats (or a whole row label / table) to allocate them to this ticket. Tap seats already on this ticket to unallocate them."
            );
          } else {
            setTicketSeatSelectionMode(false, "assign-seats-finish");
          }

          applySeatVisuals();
          renderTicketingPanel();
        });

        const assignRemainingBtn = document.createElement("button");
        assignRemainingBtn.type = "button";
        assignRemainingBtn.className = "tool-button";
        assignRemainingBtn.textContent = "Assign all remaining seats";
        assignRemainingBtn.disabled =
          duplicates.size > 0 || updateOffSaleValidation();
        assignRemainingBtn.addEventListener("click", () => {
          if (duplicates.size > 0) {
            window.alert(
              "Resolve duplicate seat references before assigning tickets."
            );
            return;
          }
          if (updateOffSaleValidation()) {
            window.alert(
              "Tickets must go off sale on or before the event time. Please adjust the off-sale date."
            );
            return;
          }

          const seats = getAllSeatNodes();
          enforceUniqueSeatIds(seats);

          let skippedAssignedSeats = 0;
          seats.forEach((seat) => {
            const { sid, set } = ensureSeatTicketSet(seat);
            if (!sid || !set) return;

            const hasOtherTickets = Array.from(set).some(
              (tId) => tId && tId !== ticket.id
            );
            if (hasOtherTickets) {
              skippedAssignedSeats += 1;
              return;
            }

            set.add(ticket.id);

            const ids = Array.from(set);
            seat.setAttr("sbTicketIds", ids);
            seat.setAttr("sbTicketId", ids[0] || null);
            ticketAssignments.set(sid, new Set(ids));
          });

          rebuildTicketAssignmentsCache();
          const assignedCount = countAssignmentsForTicket(ticket.id);
          const assignableSeatTotal = seats.filter((seat) => {
            const info = ensureSeatTicketSet(seat);
            const set = info.set;
            if (!set || set.size === 0) return true;
            return !Array.from(set).some((tId) => tId && tId !== ticket.id);
          }).length;

          // eslint-disable-next-line no-console
          console.log("[seatmap][tickets] assign remaining", {
            ticketId: ticket.id,
            assignedCount,
            assignableSeatTotal,
            skippedAssignedSeats,
          });

          if (assignedCount !== assignableSeatTotal) {
            // eslint-disable-next-line no-console
            console.warn("[seatmap][tickets] assign remaining mismatch", {
              expected: assignableSeatTotal,
              actual: assignedCount,
            });
          }

          applySeatVisuals();
          renderTicketingPanel();
          setTicketSeatSelectionMode(false, "assign-all-remaining");
        });

        // 🔵 NEW: "Assign all seats" – allows overlaps / multi-ticket per seat
        const assignAllSeatsBtn = document.createElement("button");
        assignAllSeatsBtn.type = "button";
        assignAllSeatsBtn.className = "tool-button";
        assignAllSeatsBtn.textContent = "Assign all seats";
        assignAllSeatsBtn.disabled =
          duplicates.size > 0 || updateOffSaleValidation();
        assignAllSeatsBtn.addEventListener("click", () => {
          if (duplicates.size > 0) {
            window.alert(
              "Resolve duplicate seat references before assigning tickets."
            );
            return;
          }
          if (updateOffSaleValidation()) {
            window.alert(
              "Tickets must go off sale on or before the event time. Please adjust the off-sale date."
            );
            return;
          }

          const seats = getAllSeatNodes();
          enforceUniqueSeatIds(seats);

          seats.forEach((seat) => {
            const { sid, set } = ensureSeatTicketSet(seat);
            if (!sid || !set) return;

            set.add(ticket.id);

            const ids = Array.from(set);
            seat.setAttr("sbTicketIds", ids);
            seat.setAttr("sbTicketId", ids[0] || null);
            ticketAssignments.set(sid, new Set(ids));
          });

          rebuildTicketAssignmentsCache();

          // eslint-disable-next-line no-console
          console.log("[seatmap][tickets] assign all seats (multi-ticket allowed)", {
            ticketId: ticket.id,
            assignedCount: countAssignmentsForTicket(ticket.id),
            totalSeats: getAllSeatNodes().length,
          });

          applySeatVisuals();
          renderTicketingPanel();
          pushHistory();
        });

        actionsRow.appendChild(assignSelectedBtn);
        actionsRow.appendChild(assignRemainingBtn);
        actionsRow.appendChild(assignAllSeatsBtn);
        body.appendChild(actionsRow);

        card.appendChild(body);
      }

      ticketsContainer.appendChild(card);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "tool-button sb-ticket-add";
    addBtn.innerHTML = '<span class="sb-ticket-add-icon">＋</span> Add ticket';
    addBtn.addEventListener("click", () => {
      ensureTicketFormDefaults();

      const nowValue = formatDateTimeLocal(new Date());
      const showDateValue =
        (showMeta && showMeta.date && formatDateTimeLocal(showMeta.date)) ||
        nowValue;

      const colorForNewTicket = getNextTicketColor();

      const ticket = {
        id: `ticket-${Date.now()}-${ticketTypes.length + 1}`,
        name: ticketFormState.name || `Ticket ${ticketTypes.length + 1}`,
        price:
          parseFloat(
            (ticketFormState.price || "")
              .replace(/[^0-9.,-]/g, "")
              .replace(/,/g, ".")
          ) || 0,
        currency: venueCurrencyCode,
        color: colorForNewTicket,
        onSale: ticketFormState.onSale || nowValue,
        offSale: ticketFormState.offSale || showDateValue,
        info: ticketFormState.info || "",
        minPerOrder:
          parseInt(ticketFormState.minPerOrder || "1", 10) || 1,
        maxPerOrder:
          parseInt(ticketFormState.maxPerOrder || "15", 10) || 15,
      };

      ticketTypes = ticketTypes.concat(ticket);
      activeTicketSelectionId = ticket.id;

      // 🔒 New behaviour: when adding a ticket, keep all tickets collapsed
      // so the list stays clean. User can expand any ticket via the caret.
      ticketAccordionOpenIds.clear();

      ticketFormState = {
        ...ticketFormState,
        name: "",
        price: "",
        info: "",
        color: colorForNewTicket,
      };

      applySeatVisuals();
      renderTicketingPanel();
    });

    el.appendChild(addBtn);
  }

    // ---------- Selection inspector (right-hand panel) ----------

  function renderInspector(node) {
    const el = getInspectorElement();
    if (!el) return;

    if (activeMainTab === "tickets") {
      renderTicketingPanel();
      return;
    }

    el.innerHTML = "";

    // ---- Small DOM helpers ----
    function addTitle(text) {
      const h = document.createElement("h4");
      h.className = "sb-inspector-title";
      h.textContent = text;
      el.appendChild(h);
    }

        function addSelectField(labelText, value, options, onCommit) {
      const wrapper = document.createElement("div");
      wrapper.className = "sb-field-row";

      const label = document.createElement("label");
      label.className = "sb-label";

      const span = document.createElement("span");
      span.textContent = labelText;
      span.style.display = "block";
      span.style.marginBottom = "2px";

      const select = document.createElement("select");
      select.className = "sb-select";

      options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === value) o.selected = true;
        select.appendChild(o);
      });

      select.addEventListener("change", () => {
        onCommit(select.value);
        setActiveTool(null, { force: true });
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      });

      label.appendChild(span);
      label.appendChild(select);
      wrapper.appendChild(label);
      el.appendChild(wrapper);
    }

    function addStaticRow(labelText, valueText) {
      const wrapper = document.createElement("div");
      wrapper.className = "sb-field-row sb-field-static";

      const label = document.createElement("div");
      label.className = "sb-static-label";
      label.textContent = labelText;

      const value = document.createElement("div");
      value.className = "sb-static-value";
      value.textContent = valueText;

      wrapper.appendChild(label);
      wrapper.appendChild(value);
      el.appendChild(wrapper);
    }
        function addTextField(labelText, value, onCommit) {
      const wrapper = document.createElement("div");
      wrapper.className = "sb-field-row";

      const label = document.createElement("label");
      label.className = "sb-label";

      const span = document.createElement("span");
      span.textContent = labelText;
      span.style.display = "block";
      span.style.marginBottom = "2px";

      const input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
      input.className = "sb-input";

      function commit() {
        onCommit(input.value || "");
        setActiveTool(null, { force: true });
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      }

      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          input.blur();
        }
      });

      label.appendChild(span);
      label.appendChild(input);
      wrapper.appendChild(label);
      el.appendChild(wrapper);
    }

function addNumberField(labelText, value, min, step, onCommit) {
  const wrapper = document.createElement("div");
  wrapper.className = "sb-field-row";

  const label = document.createElement("label");
  label.className = "sb-label";

  const span = document.createElement("span");
  span.textContent = labelText;
  span.style.display = "block";
  span.style.marginBottom = "2px";

  const input = document.createElement("input");
  input.type = "number";
  input.value = value;
  input.min = String(min);
  input.step = String(step || 1);
  input.className = "sb-input";

  function commit() {
    const parsed = parseFloat(input.value);
    if (!Number.isFinite(parsed)) return;
    onCommit(parsed);
    setActiveTool(null, { force: true });
    mapLayer.batchDraw();
    updateSeatCount();
    pushHistory();
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      input.blur();
    }
  });

  label.appendChild(span);
  label.appendChild(input);
  wrapper.appendChild(label);
  el.appendChild(wrapper);
}

        function addRangeField(labelText, value, min, max, step, onCommit) {
      const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;

      const wrapper = document.createElement("div");
      wrapper.className = "sb-field-row";

      const label = document.createElement("label");
      label.className = "sb-label";

      const span = document.createElement("span");
      span.textContent = labelText;
      span.style.display = "block";
      span.style.marginBottom = "2px";

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step || 1);
      input.value = String(safeValue);

      const valueLabel = document.createElement("span");
      valueLabel.style.fontSize = "11px";
      valueLabel.style.color = "#6b7280";
      valueLabel.textContent = String(safeValue);

      function commit() {
        const parsed = parseInt(input.value, 10);
        if (!Number.isFinite(parsed)) return;
        valueLabel.textContent = String(parsed);
        onCommit(parsed);
        setActiveTool(null, { force: true });
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      }

      input.addEventListener("input", () => {
        valueLabel.textContent = input.value;
      });
      input.addEventListener("change", commit);
      input.addEventListener("mouseup", commit);
      input.addEventListener("touchend", commit);

      row.appendChild(input);
      row.appendChild(valueLabel);

      label.appendChild(span);
      label.appendChild(row);
      wrapper.appendChild(label);
      el.appendChild(wrapper);
    }

    function addCheckboxField(labelText, checked, onCommit) {
      const wrapper = document.createElement("div");
      wrapper.className = "sb-field-row";

      const label = document.createElement("label");
      label.className = "sb-label";
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "6px";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!checked;

      const span = document.createElement("span");
      span.textContent = labelText;

      input.addEventListener("change", () => {
        onCommit(input.checked);
        setActiveTool(null, { force: true });
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      });

      label.appendChild(input);
      label.appendChild(span);
      wrapper.appendChild(label);
      el.appendChild(wrapper);
    }
    function addColorField(labelText, value, onCommit) {
      const wrapper = document.createElement("div");
      wrapper.className = "sb-field-row";

      const label = document.createElement("label");
      label.className = "sb-label";

      const span = document.createElement("span");
      span.textContent = labelText;
      span.style.display = "block";
      span.style.marginBottom = "2px";

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";

      const colorInput = document.createElement("input");
      colorInput.type = "color";

      const initialHex =
        typeof value === "string" &&
        /^#([0-9a-fA-F]{3}){1,2}$/.test(value)
          ? value
          : "#ffffff";

      colorInput.value = initialHex;

      const textInput = document.createElement("input");
      textInput.type = "text";
      textInput.value = value || initialHex;
      textInput.className = "sb-input";

      function commit(val) {
        onCommit(val);
        setActiveTool(null, { force: true });
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      }

      colorInput.addEventListener("change", () => {
        textInput.value = colorInput.value;
        commit(colorInput.value);
      });

      textInput.addEventListener("blur", () => {
        commit(textInput.value || "");
      });

      textInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(textInput.value || "");
          textInput.blur();
        }
      });

      row.appendChild(colorInput);
      row.appendChild(textInput);
      label.appendChild(span);
      label.appendChild(row);
      wrapper.appendChild(label);
      el.appendChild(wrapper);
    }


                 function addFlipButton(node) {
  const wrapper = document.createElement("div");
  wrapper.className = "sb-field-row";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Mirror angle";
  btn.style.width = "100%";
  btn.style.fontSize = "11px";
  btn.style.padding = "6px 8px";
  btn.style.borderRadius = "8px";
  btn.style.border = "1px solid #e5e7eb";
  btn.style.background = "#ffffff";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 1px 3px rgba(15,23,42,0.08)";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!node) return;

    // 1) Reset any negative scales so we don’t double-flip
    const sx = Math.abs(node.scaleX() || 1);
    const sy = Math.abs(node.scaleY() || 1);
    node.scale({ x: sx, y: sy });

    // 2) Flip the angle: 20° → −20°, −35° → 35°, etc.
    const current = node.rotation() || 0;
    node.rotation(-current);

    // 3) Keep seat / row / table labels upright
    keepLabelsUpright(node);

    if (mapLayer) {
      mapLayer.batchDraw();
    }
    if (overlayLayer) {
      overlayLayer.batchDraw();
    }

    pushHistory();
    // Refresh inspector so Rotation (deg) reflects the new value
    renderInspector(node);
  });

  wrapper.appendChild(btn);
  el.appendChild(wrapper);
}





    // ---- Multi-selection helpers (alignment & distribution) ----

    function getMultiSelectionNodes() {
      if (!transformer || !transformer.nodes) return [];
      return transformer
        .nodes()
        .filter(
          (n) =>
            n &&
            n.getLayer &&
            n.getLayer() === mapLayer &&
            n instanceof Konva.Group
        );
    }

    function alignOrDistributeSelection(action) {
      if (!mapLayer) return;

      const nodes = getMultiSelectionNodes();
      if (!nodes || nodes.length < 2) return;

      const items = nodes
        .map((n) => {
          let rect;
          try {
            rect = n.getClientRect({ relativeTo: mapLayer });
          } catch (err) {
            rect = null;
          }
          return { node: n, rect };
        })
        .filter(
          ({ rect }) =>
            rect &&
            Number.isFinite(rect.x) &&
            Number.isFinite(rect.y) &&
            Number.isFinite(rect.width) &&
            Number.isFinite(rect.height)
        );

      if (items.length < 2) return;

      const xs = items.map((it) => it.rect.x);
      const ys = items.map((it) => it.rect.y);
      const rights = items.map((it) => it.rect.x + it.rect.width);
      const bottoms = items.map((it) => it.rect.y + it.rect.height);

      const minX = Math.min(...xs);
      const maxX = Math.max(...rights);
      const minY = Math.min(...ys);
      const maxY = Math.max(...bottoms);

      const targetCenterX = (minX + maxX) / 2;
      const targetCenterY = (minY + maxY) / 2;

      // ----- Alignments -----
      if (action === "align-top") {
        items.forEach(({ node, rect }) => {
          const dy = minY - rect.y;
          node.y(snap(node.y() + dy));
        });
      } else if (action === "align-middle") {
        items.forEach(({ node, rect }) => {
          const center = rect.y + rect.height / 2;
          const dy = targetCenterY - center;
          node.y(snap(node.y() + dy));
        });
      } else if (action === "align-bottom") {
        items.forEach(({ node, rect }) => {
          const bottom = rect.y + rect.height;
          const dy = maxY - bottom;
          node.y(snap(node.y() + dy));
        });
      } else if (action === "align-left") {
        items.forEach(({ node, rect }) => {
          const dx = minX - rect.x;
          node.x(snap(node.x() + dx));
        });
      } else if (action === "align-center") {
        items.forEach(({ node, rect }) => {
          const center = rect.x + rect.width / 2;
          const dx = targetCenterX - center;
          node.x(snap(node.x() + dx));
        });
      } else if (action === "align-right") {
        items.forEach(({ node, rect }) => {
          const right = rect.x + rect.width;
          const dx = maxX - right;
          node.x(snap(node.x() + dx));
        });
      }

      // ----- Distribution (keep first & last fixed) -----
      if (action === "distribute-horizontal" && items.length > 2) {
        const sorted = items.slice().sort((a, b) => a.rect.x - b.rect.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        const outerSpan =
          (last.rect.x + last.rect.width) - first.rect.x;
        const totalWidth = sorted.reduce(
          (sum, it) => sum + it.rect.width,
          0
        );
        const gaps = sorted.length - 1;
        const gapSize =
          gaps > 0 ? (outerSpan - totalWidth) / gaps : 0;

        let cursor = first.rect.x + first.rect.width;

        for (let i = 1; i < sorted.length - 1; i += 1) {
          const it = sorted[i];
          const targetX = cursor + gapSize;
          const dx = targetX - it.rect.x;
          it.node.x(snap(it.node.x() + dx));
          cursor = targetX + it.rect.width;
        }
      }

      if (action === "distribute-vertical" && items.length > 2) {
        const sorted = items.slice().sort((a, b) => a.rect.y - b.rect.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        const outerSpan =
          (last.rect.y + last.rect.height) - first.rect.y;
        const totalHeight = sorted.reduce(
          (sum, it) => sum + it.rect.height,
          0
        );
        const gaps = sorted.length - 1;
        const gapSize =
          gaps > 0 ? (outerSpan - totalHeight) / gaps : 0;

        let cursor = first.rect.y + first.rect.height;

        for (let i = 1; i < sorted.length - 1; i += 1) {
          const it = sorted[i];
          const targetY = cursor + gapSize;
          const dy = targetY - it.rect.y;
          it.node.y(snap(it.node.y() + dy));
          cursor = targetY + it.rect.height;
        }
      }

      mapLayer.batchDraw();
      if (overlayLayer) overlayLayer.batchDraw();
      pushHistory();
    }

    function addAlignButtonsPanel(selectedCount) {
      addTitle("Multiple selection");
      addStaticRow(
        "Items selected",
        `${selectedCount} object${selectedCount === 1 ? "" : "s"}`
      );

      const hint = document.createElement("p");
      hint.className = "sb-inspector-empty";
      hint.style.marginTop = "4px";
      hint.textContent =
        "Hold Shift and click to add/remove items. Use the buttons below to align or distribute.";
      el.appendChild(hint);

      function makeMiniButton(label, title, action) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.title = title;
        btn.style.fontSize = "11px";
        btn.style.padding = "4px 6px";
        btn.style.borderRadius = "8px";
        btn.style.border = "1px solid #e5e7eb";
        btn.style.background = "#ffffff";
        btn.style.cursor = "pointer";
        btn.style.boxShadow = "0 1px 3px rgba(15,23,42,0.08)";
        btn.style.whiteSpace = "nowrap";

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          alignOrDistributeSelection(action);
        });

        return btn;
      }

      // Align (vertical)
      const alignLabel = document.createElement("div");
      alignLabel.className = "sb-static-label";
      alignLabel.style.marginTop = "8px";
      alignLabel.textContent = "Align";
      el.appendChild(alignLabel);

      const gridAlign = document.createElement("div");
      gridAlign.style.display = "grid";
      gridAlign.style.gridTemplateColumns = "repeat(3,minmax(0,1fr))";
      gridAlign.style.gap = "4px";
      gridAlign.style.marginTop = "4px";

      gridAlign.appendChild(
        makeMiniButton("Top", "Align tops", "align-top")
      );
      gridAlign.appendChild(
        makeMiniButton("Middle", "Align centres vertically", "align-middle")
      );
      gridAlign.appendChild(
        makeMiniButton("Bottom", "Align bottoms", "align-bottom")
      );

      const gridAlign2 = document.createElement("div");
      gridAlign2.style.display = "grid";
      gridAlign2.style.gridTemplateColumns = "repeat(3,minmax(0,1fr))";
      gridAlign2.style.gap = "4px";
      gridAlign2.style.marginTop = "4px";

      gridAlign2.appendChild(
        makeMiniButton("Left", "Align left edges", "align-left")
      );
      gridAlign2.appendChild(
        makeMiniButton("Centre", "Align centres horizontally", "align-center")
      );
      gridAlign2.appendChild(
        makeMiniButton("Right", "Align right edges", "align-right")
      );

      el.appendChild(gridAlign);
      el.appendChild(gridAlign2);

      // Distribute
      const distLabel = document.createElement("div");
      distLabel.className = "sb-static-label";
      distLabel.style.marginTop = "10px";
      distLabel.textContent = "Distribute";
      el.appendChild(distLabel);

      const distRow = document.createElement("div");
      distRow.style.display = "grid";
      distRow.style.gridTemplateColumns = "repeat(2,minmax(0,1fr))";
      distRow.style.gap = "6px";
      distRow.style.marginTop = "4px";

      distRow.appendChild(
        makeMiniButton(
          "Horizontally",
          "Distribute with equal gaps horizontally",
          "distribute-horizontal"
        )
      );
      distRow.appendChild(
        makeMiniButton(
          "Vertically",
          "Distribute with equal gaps vertically",
          "distribute-vertical"
        )
      );

      el.appendChild(distRow);
    }

    // ----- Global layout defaults (no selection) -----
    if (!node) {
      addTitle("Layout defaults");

      addSelectField(
        "Default seat labels for new blocks",
        globalSeatLabelMode,
        [
          { value: "none", label: "No seat labels (dots)" },
          { value: "numbers", label: "1, 2, 3..." },
          { value: "letters", label: "A, B, C..." },
        ],
        (mode) => {
          globalSeatLabelMode = mode;

          if (mapLayer) {
            mapLayer.find("Group").forEach((g) => {
              const type = g.getAttr("shapeType") || g.name();

              if (
                type === "row-seats" ||
                type === "single-seat" ||
                type === "circular-table" ||
                type === "rect-table"
              ) {
                g.setAttr("seatLabelMode", mode);

                if (type === "row-seats") {
                  const spr = g.getAttr("seatsPerRow") || 10;
                  const rc = g.getAttr("rowCount") || 1;
                  updateRowGroupGeometry(g, spr, rc);
                } else if (type === "circular-table") {
                  const sc = g.getAttr("seatCount") || 8;
                  updateCircularTableGeometry(g, sc);
                } else if (type === "rect-table") {
                  const ls = g.getAttr("longSideSeats") ?? 4;
                  const ss = g.getAttr("shortSideSeats") ?? 2;
                  updateRectTableGeometry(g, ls, ss);
                } else if (type === "single-seat") {
                  const circle = g.findOne("Circle");
                  const existingLabel = g.findOne((n) =>
                    n.getAttr && n.getAttr("isSeatLabel")
                  );
                  if (circle) {
                    if (mode === "none") {
                      circle.fill("#111827");
                      circle.stroke("#111827");
                      if (existingLabel) existingLabel.destroy();
                    } else {
                      circle.fill("#ffffff");
                      circle.stroke("#4b5563");
                      let labelNode = existingLabel;
                      const baseText = mode === "letters" ? "A" : "1";
                      if (!labelNode) {
                        labelNode = makeSeatLabelText(baseText, 0, 0);
                        g.add(labelNode);
                      }
                      labelNode.text(baseText);
                    }
                  }
                }
              }
            });
          }
        }
      );

      addStaticRow(
        "Tip",
        "These defaults also update existing rows/tables and apply to new blocks."
      );

      return;
    }

    const nodes = transformer ? transformer.nodes() : [];

    // ----- Multiple selection panel -----
    if (nodes && nodes.length > 1) {
      addAlignButtonsPanel(nodes.length);
      return;
    }

    const shapeType = node.getAttr("shapeType") || node.name();

    // ---- Row blocks ----
    if (shapeType === "row-seats") {
      const seatsPerRow = Number(node.getAttr("seatsPerRow") ?? 10);
      const rowCount = Number(node.getAttr("rowCount") ?? 1);
      const seatLabelMode = node.getAttr("seatLabelMode") || "numbers";
      const seatStart = Number(node.getAttr("seatStart") ?? 1);
      const rowLabelPrefix = node.getAttr("rowLabelPrefix") || "";
      const rowLabelStart = Number(node.getAttr("rowLabelStart") ?? 0);
      const curve = Number.isFinite(Number(node.getAttr("curve")))
        ? Number(node.getAttr("curve"))
        : 0;
      const rowOrder = node.getAttr("rowOrder") || "asc";

      // New: unified row-label position
      let rowLabelPosition = node.getAttr("rowLabelPosition");
      const legacyBothSidesInspector = !!node.getAttr("rowLabelBothSides");
      if (
        rowLabelPosition !== "left" &&
        rowLabelPosition !== "right" &&
        rowLabelPosition !== "both" &&
        rowLabelPosition !== "none"
      ) {
        rowLabelPosition = legacyBothSidesInspector ? "both" : "left";
      }

      const everyRowSameRaw = node.getAttr("everyRowSameSeats");
      const everyRowSame = everyRowSameRaw !== false; // default true
      let rowSeatCounts = node.getAttr("rowSeatCounts");
      if (!Array.isArray(rowSeatCounts)) {
        rowSeatCounts = [];
      }

      // Total seats depends on mode
      let totalSeats;
      if (everyRowSame) {
        totalSeats = seatsPerRow * rowCount;
      } else {
        totalSeats = 0;
        for (let i = 0; i < rowCount; i += 1) {
          const raw = parseInt(rowSeatCounts[i], 10);
          totalSeats += Number.isFinite(raw) && raw > 0 ? raw : seatsPerRow;
        }
      }

      function rebuild() {
        const currentSeatsPerRow =
          node.getAttr("seatsPerRow") || seatsPerRow;
        const currentRowCount =
          node.getAttr("rowCount") || rowCount;
        updateRowGroupGeometry(node, currentSeatsPerRow, currentRowCount);
        mapLayer.batchDraw();
        updateSeatCount();
        refreshSeatMetadata();
        applySeatVisuals();
        if (activeMainTab === "tickets") {
          renderTicketingPanel();
        }
        pushHistory();
      }

      addTitle("Seat block");

      // Rotation
      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          const angle = normaliseAngle(val);
          node.rotation(angle);
          keepLabelsUpright(node);
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );


            // Quick flip (180° rotation shortcut)
      addFlipButton(node);


      // Seats per row (default)
      addNumberField("Seats per row", seatsPerRow, 1, 1, (val) => {
        node.setAttr("seatsPerRow", val);
        rebuild();
      });

      addNumberField("Number of rows", rowCount, 1, 1, (val) => {
        node.setAttr("rowCount", val);
        rebuild();
      });

      addStaticRow(
        "Total seats in block",
        `${totalSeats} seat${totalSeats === 1 ? "" : "s"}`
      );

      addNumberField("Seat numbers start at", seatStart, 1, 1, (val) => {
        node.setAttr("seatStart", val);
        rebuild();
      });

      addSelectField(
        "Seat labels",
        seatLabelMode,
        [
          { value: "numbers", label: "1, 2, 3..." },
          { value: "letters", label: "A, B, C..." },
          { value: "none", label: "No seat labels" },
        ],
        (mode) => {
          node.setAttr("seatLabelMode", mode);
          rebuild();
        }
      );

      addTextField("Row label prefix", rowLabelPrefix, (val) => {
        node.setAttr("rowLabelPrefix", val);
        rebuild();
      });

      const firstRowLabelText = rowLabelFromIndex(rowLabelStart);

      addTextField("First row label", firstRowLabelText, (val) => {
        const idx = rowIndexFromLabel(val);
        node.setAttr("rowLabelStart", idx);
        rebuild();
      });

           addSelectField(
        "Row order",
        rowOrder,
        [
          {
            value: "asc",
            label: "Rows ascending (front to back)",
          },
          {
            value: "desc",
            label: "Rows descending (back to front)",
          },
        ],
        (val) => {
          node.setAttr("rowOrder", val === "desc" ? "desc" : "asc");
          rebuild();
        }
      );

      // NEW: Seat alignment (left / centre / right)
      const currentAlignment =
        (node.getAttr("alignment") === "left" ||
          node.getAttr("alignment") === "right" ||
          node.getAttr("alignment") === "center")
          ? node.getAttr("alignment")
          : "center";

      addSelectField(
        "Seat alignment",
        currentAlignment,
        [
          { value: "left", label: "Left (align left edge)" },
          { value: "center", label: "Centre (symmetrical)" },
          { value: "right", label: "Right (align right edge)" },
        ],
        (val) => {
          let safe = "center";
          if (val === "left" || val === "right" || val === "center") {
            safe = val;
          }
          node.setAttr("alignment", safe);
          rebuild();
        }
      );

      // Row label position selector
      addSelectField(
        "Row label position",
        rowLabelPosition,
        [
          { value: "left", label: "Left side only" },
          { value: "right", label: "Right side only" },
          { value: "both", label: "Both sides" },
          { value: "none", label: "No row labels" },
        ],
        (val) => {
          const allowed = ["left", "right", "both", "none"];
          const safe = allowed.includes(val) ? val : "left";
          node.setAttr("rowLabelPosition", safe);
          // keep legacy flag roughly aligned
          node.setAttr("rowLabelBothSides", safe === "both");
          rebuild();
        }
      );

      // NEW: Row label position selector
      addSelectField(
        "Row label position",
        rowLabelPosition,
        [
          { value: "left", label: "Left side only" },
          { value: "right", label: "Right side only" },
          { value: "both", label: "Both sides" },
          { value: "none", label: "No row labels" },
        ],
        (val) => {
          const allowed = ["left", "right", "both", "none"];
          const safe = allowed.includes(val) ? val : "left";
          node.setAttr("rowLabelPosition", safe);
          // keep legacy flag roughly aligned
          node.setAttr("rowLabelBothSides", safe === "both");
          rebuild();
        }
      );

      // NEW: toggle per-row seat counts
      addCheckboxField(
        "Every row has the same number of seats",
        everyRowSame,
        (checked) => {
          node.setAttr("everyRowSameSeats", checked);
          rebuild();
          // Rerender to show/hide the per-row field
          renderInspector(node);
        }
      );

      // When custom mode is on, show comma-separated seat counts
      if (!everyRowSame) {
        // Build a sensible default string for current rows
        const rowsForDisplay = [];
        for (let i = 0; i < rowCount; i += 1) {
          const raw = parseInt(rowSeatCounts[i], 10);
          if (Number.isFinite(raw) && raw > 0) {
            rowsForDisplay[i] = raw;
          } else {
            rowsForDisplay[i] = seatsPerRow;
          }
        }

        addTextField(
          "Seats per row (comma-separated)",
          rowsForDisplay.join(", "),
          (val) => {
            const parts = String(val || "").split(",");
            const result = [];
            for (let i = 0; i < rowCount; i += 1) {
              const raw = parseInt((parts[i] || "").trim(), 10);
              result[i] =
                Number.isFinite(raw) && raw > 0 ? raw : seatsPerRow;
            }
            node.setAttr("rowSeatCounts", result);
            // Also update seatsPerRow to something sensible (max), used as fallback
            const maxSeats = result.reduce(
              (m, n) => (n > m ? n : m),
              1
            );
            node.setAttr("seatsPerRow", maxSeats);
            rebuild();
          }
        );
      }

      addRangeField("Curve rows", curve, -15, 15, 1, (val) => {
        node.setAttr("curve", val);
        rebuild();
      });

      return;
    }

        // ---- Straight + curved lines ----
    if (shapeType === "line" || shapeType === "curve-line") {
      addTitle(shapeType === "line" ? "Line" : "Curved line");

      // Rotation
      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          const angle = normaliseAngle(val);
          node.rotation(angle);
          if (mapLayer) mapLayer.batchDraw();
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );

      const lineFillEnabled = !!node.getAttr("lineFillEnabled");
      const lineFillColor =
        node.getAttr("lineFillColor") || "#e5e7eb";

      addCheckboxField(
        "Fill enclosed shape",
        lineFillEnabled,
        (checked) => {
          node.setAttr("lineFillEnabled", checked);
          updateLineFillShape(node);
        }
      );

      addColorField("Fill colour", lineFillColor, (val) => {
        node.setAttr("lineFillColor", val || "#e5e7eb");
        updateLineFillShape(node);
      });

      return;
    }



    // ---- Circular tables ----
    if (shapeType === "circular-table") {
      const seatCount = node.getAttr("seatCount") || 8;
      const seatLabelMode = node.getAttr("seatLabelMode") || "numbers";
      const tableLabel = node.getAttr("tableLabel") || "";

      addTitle("Round table");

      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          node.rotation(val);
          keepLabelsUpright(node);
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );

      addTextField("Table label", tableLabel, (val) => {
        node.setAttr("tableLabel", val || "");
        updateCircularTableGeometry(
          node,
          node.getAttr("seatCount") || seatCount
        );
      });

      addNumberField("Seats around table", seatCount, 1, 1, (val) => {
        updateCircularTableGeometry(node, val);
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      });

      addSelectField(
        "Seat labels",
        seatLabelMode,
        [
          { value: "numbers", label: "1, 2, 3..." },
          { value: "letters", label: "A, B, C..." },
          { value: "none", label: "No seat labels" },
        ],
        (mode) => {
          node.setAttr("seatLabelMode", mode);
          updateCircularTableGeometry(
            node,
            node.getAttr("seatCount") || seatCount
          );
        }
      );

      addStaticRow(
        "Total seats at table",
        `${seatCount} seat${seatCount === 1 ? "" : "s"}`
      );

      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
      return;
    }

    // ---- Rectangular tables ----
    if (shapeType === "rect-table") {
      const longSideSeats = node.getAttr("longSideSeats") ?? 4;
      const shortSideSeats = node.getAttr("shortSideSeats") ?? 2;
      const seatLabelMode = node.getAttr("seatLabelMode") || "numbers";
      const tableLabel = node.getAttr("tableLabel") || "";

      const totalSeats = 2 * longSideSeats + 2 * shortSideSeats;

      addTitle("Rectangular table");

      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          node.rotation(val);
          keepLabelsUpright(node);
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );

      addTextField("Table label", tableLabel, (val) => {
        node.setAttr("tableLabel", val || "");
        updateRectTableGeometry(
          node,
          node.getAttr("longSideSeats") ?? longSideSeats,
          node.getAttr("shortSideSeats") ?? shortSideSeats
        );
      });

      addNumberField(
        "Seats on long side",
        longSideSeats,
        0,
        1,
        (val) => {
          const currentShort =
            node.getAttr("shortSideSeats") ?? shortSideSeats;
          updateRectTableGeometry(node, val, currentShort);
          mapLayer.batchDraw();
          updateSeatCount();
          pushHistory();
        }
      );

      addNumberField(
        "Seats on short side",
        shortSideSeats,
        0,
        1,
        (val) => {
          const currentLong =
            node.getAttr("longSideSeats") ?? longSideSeats;
          updateRectTableGeometry(node, currentLong, val);
          mapLayer.batchDraw();
          updateSeatCount();
          pushHistory();
        }
      );

      addSelectField(
        "Seat labels",
        seatLabelMode,
        [
          { value: "numbers", label: "1, 2, 3..." },
          { value: "letters", label: "A, B, C..." },
          { value: "none", label: "No seat labels" },
        ],
        (mode) => {
          node.setAttr("seatLabelMode", mode);
          updateRectTableGeometry(
            node,
            node.getAttr("longSideSeats") ?? longSideSeats,
            node.getAttr("shortSideSeats") ?? shortSideSeats
          );
        }
      );

      addStaticRow(
        "Total seats at table",
        `${totalSeats} seat${totalSeats === 1 ? "" : "s"}`
      );

      return;
    }

        // ---- Stairs ----
    if (shapeType === "stairs") {
      const length =
        Number(node.getAttr("stairsLength")) || GRID_SIZE * 4;
      const width =
        Number(node.getAttr("stairsWidth")) || GRID_SIZE * 1.5;
      const rawSteps = Number(node.getAttr("stairsStepCount"));
      const steps =
        Number.isFinite(rawSteps) && rawSteps >= 2 ? rawSteps : 8;
      const strokeColor =
        node.getAttr("stairsStrokeColor") || "#111827";
      const strokeWidth =
        Number(node.getAttr("stairsStrokeWidth")) || 1.7;

      addTitle("Stairs");

      // Rotation
      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          const angle = normaliseAngle(val);
          node.rotation(angle);
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );

      // Quick flip (mirror around its centre)
      addFlipButton(node);

      addNumberField(
        "Stair length (px)",
        Math.round(length),
        10,
        1,
        (val) => {
          const v = Math.max(10, val);
          node.setAttr("stairsLength", v);
          updateStairsGeometry(node);
        }
      );

      addNumberField(
        "Stair width (px)",
        Math.round(width),
        4,
        1,
        (val) => {
          const v = Math.max(4, val);
          node.setAttr("stairsWidth", v);
          updateStairsGeometry(node);
        }
      );

      addNumberField(
        "Number of steps",
        steps,
        2,
        1,
        (val) => {
          const s = Math.max(2, Math.round(val));
          node.setAttr("stairsStepCount", s);
          updateStairsGeometry(node);
        }
      );

      addColorField("Line colour", strokeColor, (val) => {
        node.setAttr("stairsStrokeColor", val || "#111827");
        updateStairsGeometry(node);
      });

      addNumberField(
        "Line thickness (px)",
        strokeWidth,
        0.5,
        0.5,
        (val) => {
          node.setAttr("stairsStrokeWidth", val);
          updateStairsGeometry(node);
        }
      );

      return;
    }

       

    // ---- Arrow ----
    if (shapeType === "arrow") {
      const arrow = node.findOne((n) => n instanceof Konva.Arrow);

      addTitle("Arrow");

      if (!arrow) {
        const p = document.createElement("p");
        p.className = "sb-inspector-empty";
        p.textContent = "This arrow has no editable geometry.";
        el.appendChild(p);
        return;
      }

      const strokeColor =
        arrow.stroke && arrow.stroke() ? arrow.stroke() : "#111827";
      const strokeWidth =
        Number(arrow.strokeWidth && arrow.strokeWidth()) || 2;
      const pointerLength =
        Number(arrow.pointerLength && arrow.pointerLength()) || 14;
      const pointerWidth =
        Number(arrow.pointerWidth && arrow.pointerWidth()) || 14;
      const doubleEnded = !!arrow.pointerAtBeginning();

      // Rotation at group level
      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          const angle = normaliseAngle(val);
          node.rotation(angle);
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );

      // Quick flip
      addFlipButton(node);

      addColorField("Stroke colour", strokeColor, (val) => {
        const v = val || "#111827";
        arrow.stroke(v);
        arrow.fill(v);
      });

      addNumberField(
        "Stroke thickness (px)",
        strokeWidth,
        0.5,
        0.5,
        (val) => {
          arrow.strokeWidth(val);
          ensureHitRect(node);
        }
      );

      addNumberField(
        "Arrowhead size (px)",
        Math.round((pointerLength + pointerWidth) / 2),
        4,
        1,
        (val) => {
          const size = Math.max(4, val);
          arrow.pointerLength(size);
          arrow.pointerWidth(size);
          ensureHitRect(node);
        }
      );

      addCheckboxField(
        "Arrowheads at both ends",
        doubleEnded,
        (checked) => {
          arrow.pointerAtBeginning(!!checked);
        }
      );

      return;
    }

    // ---- Arc ----
    if (shapeType === "arc") {
      const arcShape = node.findOne((n) => n instanceof Konva.Arc);

      addTitle("Arc");

      if (!arcShape) {
        const p = document.createElement("p");
        p.className = "sb-inspector-empty";
        p.textContent = "This arc has no editable geometry.";
        el.appendChild(p);
        return;
      }

      // Normalise attrs
      let mode = node.getAttr("arcMode");
      if (mode !== "single" && mode !== "outline") {
        mode = "outline";
      }
      node.setAttr("arcMode", mode);

      const currentInner =
        Number(arcShape.innerRadius && arcShape.innerRadius()) || 60;
      const currentOuter =
        Number(arcShape.outerRadius && arcShape.outerRadius()) || 80;

      let radius = Number(node.getAttr("arcRadius"));
      let thickness = Number(node.getAttr("arcThickness"));
      let angle = Number(node.getAttr("arcAngle"));

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
            : Number(arcShape.strokeWidth && arcShape.strokeWidth()) || 4;
      }

      if (!Number.isFinite(angle) || angle <= 0) {
        angle = arcShape.angle ? arcShape.angle() : 180;
      }
      angle = Math.max(1, Math.min(359, angle));

      node.setAttr("arcRadius", radius);
      node.setAttr("arcThickness", thickness);
      node.setAttr("arcAngle", angle);

      let strokeColor =
        node.getAttr("arcStrokeColor") || arcShape.stroke() || "#111827";
      node.setAttr("arcStrokeColor", strokeColor);

      let strokeStyle = node.getAttr("arcStrokeStyle");
      if (
        strokeStyle !== "solid" &&
        strokeStyle !== "dashed" &&
        strokeStyle !== "dotted"
      ) {
        const dashArr = arcShape.dash && arcShape.dash();
        if (dashArr && dashArr.length) {
          strokeStyle = dashArr[0] <= 3 ? "dotted" : "dashed";
        } else {
          strokeStyle = "solid";
        }
      }
      node.setAttr("arcStrokeStyle", strokeStyle);

      let fillEnabled = node.getAttr("arcFillEnabled");
      if (fillEnabled === undefined || fillEnabled === null) {
        const f = arcShape.fill && arcShape.fill();
        fillEnabled = !!f && f !== "rgba(0,0,0,0)";
      }
      node.setAttr("arcFillEnabled", !!fillEnabled);

      let fillColor =
        node.getAttr("arcFillColor") || arcShape.fill() || "#ffffff";
      node.setAttr("arcFillColor", fillColor);

      // Make sure visuals match attrs
      applyArcStyle(node);

      // Rotation
      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          const a = normaliseAngle(val);
          node.rotation(a);
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );

      // Type
      addSelectField(
        "Arc type",
        mode,
        [
          { value: "single", label: "Single line" },
          { value: "outline", label: "Outline band" },
        ],
        (val) => {
          const safe = val === "single" ? "single" : "outline";
          node.setAttr("arcMode", safe);
          applyArcStyle(node);
          renderInspector(node); // refresh to show/hide fill controls
        }
      );

      // Radius
      addNumberField(
        mode === "single" ? "Radius (px)" : "Inner radius (px)",
        radius,
        5,
        1,
        (val) => {
          node.setAttr("arcRadius", val);
          applyArcStyle(node);
        }
      );

      // Thickness
      addNumberField(
        mode === "single"
          ? "Line thickness (px)"
          : "Band thickness (px)",
        thickness,
        1,
        1,
        (val) => {
          node.setAttr("arcThickness", val);
          applyArcStyle(node);
        }
      );

      // Sweep angle
      addNumberField(
        "Sweep angle (deg)",
        angle,
        1,
        1,
        (val) => {
          node.setAttr("arcAngle", val);
          applyArcStyle(node);
        }
      );

      // Stroke colour
      addColorField("Stroke colour", strokeColor, (val) => {
        node.setAttr("arcStrokeColor", val || "#111827");
        applyArcStyle(node);
      });

      // Fill (outline mode only)
      if (mode === "outline") {
        addCheckboxField("Fill band", fillEnabled, (checked) => {
          node.setAttr("arcFillEnabled", !!checked);
          applyArcStyle(node);
        });

        addColorField("Fill colour", fillColor, (val) => {
          node.setAttr("arcFillColor", val || "#ffffff");
          applyArcStyle(node);
        });
      }

      // Stroke style
      addSelectField(
        "Stroke style",
        strokeStyle,
        [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashes" },
          { value: "dotted", label: "Dots" },
        ],
        (val) => {
          const safe =
            val === "dashed" || val === "dotted" ? val : "solid";
          node.setAttr("arcStrokeStyle", safe);
          applyArcStyle(node);
        }
      );

      return;
    }

        // ---- Text labels ----
    if (shapeType === "text" || shapeType === "label") {
      const textNode = node.findOne("Text");
      if (!textNode) {
        addTitle("Text label");
        const p = document.createElement("p");
        p.className = "sb-inspector-empty";
        p.textContent = "This text label has no editable content.";
        el.appendChild(p);
        return;
      }

      addTitle("Text label");

      // Text content
      addTextField("Text", textNode.text(), (val) => {
        textNode.text(val || "");
        ensureHitRect(node);
      });

      // Font size
      const initialFontSize = Number(textNode.fontSize()) || 14;
      addNumberField("Font size", initialFontSize, 6, 1, (val) => {
        textNode.fontSize(val);
        ensureHitRect(node);
      });

      // 🔵 NEW: text colour (colour picker + hex)
      const initialColor =
        (typeof textNode.fill === "function" && textNode.fill()) ||
        "#111827";

      addColorField("Text colour", initialColor, (val) => {
        const safe = val || "#111827";
        if (typeof textNode.fill === "function") {
          textNode.fill(safe);
        }
        ensureHitRect(node);
      });

      // Style state
      const style = String(textNode.fontStyle() || "").toLowerCase();
      let bold = style.includes("bold");
      let italic = style.includes("italic");

      const deco =
        typeof textNode.textDecoration === "function"
          ? String(textNode.textDecoration() || "").toLowerCase()
          : "";
      let underline = deco.includes("underline");

      function applyTextStyles() {
        const parts = [];
        if (bold) parts.push("bold");
        if (italic) parts.push("italic");
        textNode.fontStyle(parts.join(" ") || "normal");

        if (typeof textNode.textDecoration === "function") {
          textNode.textDecoration(underline ? "underline" : "");
        } else {
          textNode.underline(underline);
        }

        ensureHitRect(node);
      }

      addCheckboxField("Bold", bold, (checked) => {
        bold = checked;
        applyTextStyles();
      });

      addCheckboxField("Italic", italic, (checked) => {
        italic = checked;
        applyTextStyles();
      });

      addCheckboxField("Underline", underline, (checked) => {
        underline = checked;
        applyTextStyles();
      });

      applyTextStyles();
      if (mapLayer) mapLayer.batchDraw();
      return;
    }

    // ---- Symbols ----
    if (shapeType === "symbol") {
      const currentType = normaliseSymbolTool(
        node.getAttr("symbolType") || "info"
      );
      node.setAttr("symbolType", currentType);

      addTitle("Symbol");

      // Preview bubble
      const previewWrapper = document.createElement("div");
      previewWrapper.className = "sb-field-row";

      const previewInner = document.createElement("div");
      previewInner.style.display = "flex";
      previewInner.style.alignItems = "center";
      previewInner.style.gap = "8px";

      const previewImg = document.createElement("img");
      previewImg.alt = "Selected symbol";
      previewImg.style.width = "32px";
      previewImg.style.height = "32px";

      const previewLabel = document.createElement("div");
      previewLabel.className = "sb-static-value";

      function refreshPreview(type) {
        const t = normaliseSymbolTool(type);
        const src =
          SYMBOL_ICON_BLUE[t] || SYMBOL_ICON_BLUE.info;
        const label = SYMBOL_LABELS[t] || "Symbol";

        previewImg.src = src;
        previewLabel.textContent = label;
      }

      refreshPreview(currentType);

      previewInner.appendChild(previewImg);
      previewInner.appendChild(previewLabel);
      previewWrapper.appendChild(previewInner);
      el.appendChild(previewWrapper);

      const options = SYMBOL_TYPES.map((t) => ({
        value: t,
        label: SYMBOL_LABELS[t] || t,
      }));

      addSelectField(
        "Symbol type",
        currentType,
        options,
        (val) => {
          const newType = normaliseSymbolTool(val);
          node.setAttr("symbolType", newType);

          const iconNode = node.findOne("Image");
          const srcDark =
            SYMBOL_ICON_DARK[newType] || SYMBOL_ICON_DARK.info;

          if (iconNode) {
            const img = new window.Image();
            img.src = srcDark;
            img.onload = () => {
              iconNode.image(img);
              if (mapLayer) mapLayer.batchDraw();
            };
          } else if (mapLayer) {
            mapLayer.batchDraw();
          }

          updateSymbolsToolbarIcon(newType);
          refreshPreview(newType);
        }
      );

      return;
    }

    // ---- Stage block ----
    if (shapeType === "stage") {
      const body = getBodyRect(node);
      const labelNode =
        node.findOne(".stage-label") || node.findOne("Text");

      addTitle("Stage");

      const stageLabel = node.getAttr("stageLabel") || (labelNode && labelNode.text()) || "STAGE";

      addTextField("Label", stageLabel, (val) => {
        const t = val && val.trim() ? val : "STAGE";
        node.setAttr("stageLabel", t);
        if (labelNode) labelNode.text(t);
        applyStageStyle(node);
        ensureHitRect(node);
      });

      const fillMode = node.getAttr("stageFillMode") || "solid";
      addSelectField(
        "Fill mode",
        fillMode,
        [
          { value: "solid", label: "Solid colour" },
          { value: "gradient", label: "Gradient" },
        ],
        (mode) => {
          node.setAttr("stageFillMode", mode === "gradient" ? "gradient" : "solid");
          applyStageStyle(node);
          renderInspector(node); // refresh controls
        }
      );

      if (fillMode === "solid") {
        const solidColor =
          node.getAttr("stageSolidColor") || body.fill() || "#000000";
        addColorField("Stage colour", solidColor, (val) => {
          node.setAttr("stageSolidColor", val || "#000000");
          applyStageStyle(node);
        });
      } else {
        const startColor =
          node.getAttr("stageGradientStartColor") || "#1d4ed8";
        const endColor =
          node.getAttr("stageGradientEndColor") || "#22c1c3";

        addColorField("Gradient start", startColor, (val) => {
          node.setAttr("stageGradientStartColor", val || "#1d4ed8");
          applyStageStyle(node);
        });

        addColorField("Gradient end", endColor, (val) => {
          node.setAttr("stageGradientEndColor", val || "#22c1c3");
          applyStageStyle(node);
        });

        const dir = node.getAttr("stageGradientDirection") || "lr";
        addSelectField(
          "Gradient direction",
          dir,
          [
            { value: "lr", label: "Left \u2192 Right" },
            { value: "tb", label: "Top \u2193 Bottom" },
            { value: "diag", label: "Diagonal" },
          ],
          (val) => {
            const safe = ["lr", "tb", "diag"].includes(val) ? val : "lr";
            node.setAttr("stageGradientDirection", safe);
            applyStageStyle(node);
          }
        );
      }

      const autoText =
        node.getAttr("stageTextAutoColor") !== false;
      addCheckboxField(
        "Automatic text colour",
        autoText,
        (checked) => {
          node.setAttr("stageTextAutoColor", !!checked);
          applyStageStyle(node);
          renderInspector(node);
        }
      );

      if (!autoText) {
        const textColor =
          node.getAttr("stageTextColor") ||
          (labelNode && labelNode.fill && labelNode.fill()) ||
          "#ffffff";
        addColorField("Text colour", textColor, (val) => {
          node.setAttr("stageTextColor", val || "#ffffff");
          applyStageStyle(node);
        });
      }

      return;
    }

    // ---- Bar block ----
    if (shapeType === "bar") {
      const labelNode =
        node.findOne(".bar-label") || node.findOne("Text");

      addTitle("Bar");

      const text = labelNode ? labelNode.text() : "BAR";

      addTextField("Label", text, (val) => {
        const t = val && val.trim() ? val : "BAR";
        if (labelNode) labelNode.text(t);
        ensureHitRect(node);
      });

      return;
    }

    // ---- Exit block ----
    if (shapeType === "exit") {
      const labelNode =
        node.findOne(".exit-label") || node.findOne("Text");

      addTitle("Exit");

      const text = labelNode ? labelNode.text() : "EXIT";

      addTextField("Label", text, (val) => {
        const t = val && val.trim() ? val : "EXIT";
        if (labelNode) labelNode.text(t);
        ensureHitRect(node);
      });

      return;
    }

    // ---- Basic blocks (section / square / circle) ----
    if (
      shapeType === "section" ||
      shapeType === "square" ||
      shapeType === "circle"
    ) {
      addTitle("Block");

      const fillEnabledRaw = node.getAttr("shapeFillEnabled");
      const fillEnabled =
        fillEnabledRaw === undefined || fillEnabledRaw === null
          ? true
          : !!fillEnabledRaw;

      const fillColor =
        node.getAttr("shapeFillColor") ||
        (getBodyRect(node) && getBodyRect(node).fill && getBodyRect(node).fill()) ||
        "#ffffff";

      const strokeColor =
        node.getAttr("shapeStrokeColor") ||
        (getBodyRect(node) && getBodyRect(node).stroke && getBodyRect(node).stroke()) ||
        "#4b5563";

      const strokeWidth =
        Number(node.getAttr("shapeStrokeWidth")) ||
        (getBodyRect(node) &&
          Number(getBodyRect(node).strokeWidth && getBodyRect(node).strokeWidth())) ||
        1.7;

      let strokeStyle = node.getAttr("shapeStrokeStyle") || "solid";
      if (
        strokeStyle !== "solid" &&
        strokeStyle !== "dashed" &&
        strokeStyle !== "dotted"
      ) {
        strokeStyle = "solid";
      }

      addCheckboxField("Fill enabled", fillEnabled, (checked) => {
        node.setAttr("shapeFillEnabled", !!checked);
        applyBasicShapeStyle(node);
      });

      addColorField("Fill colour", fillColor, (val) => {
        node.setAttr("shapeFillColor", val || "#ffffff");
        applyBasicShapeStyle(node);
      });

      addColorField("Border colour", strokeColor, (val) => {
        node.setAttr("shapeStrokeColor", val || "#4b5563");
        applyBasicShapeStyle(node);
      });

      addNumberField(
        "Border width (px)",
        strokeWidth,
        0.5,
        0.5,
        (val) => {
          node.setAttr("shapeStrokeWidth", val);
          applyBasicShapeStyle(node);
        }
      );

      addSelectField(
        "Border style",
        strokeStyle,
        [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ],
        (val) => {
          const safe =
            val === "dashed" || val === "dotted" ? val : "solid";
          node.setAttr("shapeStrokeStyle", safe);
          applyBasicShapeStyle(node);
        }
      );

      return;
    }
    
           // ---- Multi-shape (multi-tool) ----
    if (shapeType === "multi-shape") {
      // Geometry
      let variantRaw = node.getAttr("multiShapeVariant") || "regular";
      if (variantRaw === "rhombus") {
        variantRaw = "parallelogram"; // legacy → new behaviour
        node.setAttr("multiShapeVariant", "parallelogram");
      }
      let variant =
        variantRaw === "parallelogram" ? "parallelogram" : "regular";

      let sides = Number(node.getAttr("multiShapeSides"));
      if (!Number.isFinite(sides)) sides = 5;

      let width = Number(node.getAttr("multiShapeWidth"));
      if (!Number.isFinite(width) || width <= 0) width = 120;

      let height = Number(node.getAttr("multiShapeHeight"));
      if (!Number.isFinite(height) || height <= 0) height = 80;

      let skew = Number(node.getAttr("multiShapeSkew"));
      if (!Number.isFinite(skew)) skew = 20;

      // Styling
      let fillEnabled = node.getAttr("shapeFillEnabled");
      if (fillEnabled === undefined || fillEnabled === null) {
        fillEnabled = true;
      } else {
        fillEnabled = !!fillEnabled;
      }

      let fillColor = node.getAttr("shapeFillColor") || "#ffffff";
      let strokeColor =
        node.getAttr("shapeStrokeColor") || "#4b5563";

      let strokeWidth = Number(node.getAttr("shapeStrokeWidth"));
      if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
        strokeWidth = 1.7;
      }

      let strokeStyle = node.getAttr("shapeStrokeStyle") || "solid";
      if (
        strokeStyle !== "solid" &&
        strokeStyle !== "dashed" &&
        strokeStyle !== "dotted"
      ) {
        strokeStyle = "solid";
      }

      // Make sure current attributes are reflected visually
      node.setAttr("shapeFillEnabled", fillEnabled);
      node.setAttr("shapeFillColor", fillColor);
      node.setAttr("shapeStrokeColor", strokeColor);
      node.setAttr("shapeStrokeWidth", strokeWidth);
      node.setAttr("shapeStrokeStyle", strokeStyle);
      applyBasicShapeStyle(node);

      // --- On-map grow / rotate support (drag handles + rotate dot) ---
      // This relies on your global Konva.Transformer.
      // We convert scaleX/scaleY from the drag into new width/height attrs
      // and then reset scale back to 1, so repeated drags don't compound.
      if (!node._multiShapeTransformHooked) {
        node._multiShapeTransformHooked = true;

        // While transforming (esp. rotating), keep angle normalised + labels upright
        node.on("transform.multiShape", () => {
          const angle = normaliseAngle(node.rotation() || 0);
          node.rotation(angle);
          keepLabelsUpright(node);
          if (overlayLayer) overlayLayer.batchDraw();
        });

        // When the user releases the mouse after resizing / rotating
        node.on("transformend.multiShape", () => {
          const currentType = node.getAttr("shapeType");
          if (currentType && currentType !== "multi-shape") return;

          // Base logical size from attrs (what inspector works with)
          let baseWidth = Number(node.getAttr("multiShapeWidth"));
          if (!Number.isFinite(baseWidth) || baseWidth <= 0) baseWidth = 120;

          let baseHeight = Number(node.getAttr("multiShapeHeight"));
          if (!Number.isFinite(baseHeight) || baseHeight <= 0)
            baseHeight = 80;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          const factorX = Math.max(0.1, Math.abs(scaleX || 1));
          const factorY = Math.max(0.1, Math.abs(scaleY || 1));

          const newWidth = Math.max(10, baseWidth * factorX);
          const newHeight = Math.max(10, baseHeight * factorY);

          // Commit new geometry and reset scale
          node.setAttrs({
            multiShapeWidth: newWidth,
            multiShapeHeight: newHeight,
            scaleX: 1,
            scaleY: 1,
          });

          // Make sure the polygon / parallelogram is rebuilt to match
          updateMultiShapeGeometry(node);

          // Keep hit-area and text in a good state
          ensureHitRect(node);
          keepLabelsUpright(node);

          if (overlayLayer) overlayLayer.batchDraw();
        });
      }

      addTitle("Multi-shape");

      // Rotation (numeric field)
      addNumberField(
        "Rotation (deg)",
        Math.round(node.rotation() || 0),
        -360,
        1,
        (val) => {
          const angle = normaliseAngle(val);
          node.rotation(angle);
          // Just in case anything inside needs to stay upright
          keepLabelsUpright(node);
          if (overlayLayer) overlayLayer.batchDraw();
        }
      );

      // Shape type
      addSelectField(
        "Shape type",
        variant,
        [
          { value: "regular", label: "Regular polygon" },
          { value: "parallelogram", label: "Parallelogram" },
        ],
        (val) => {
          const safe =
            val === "parallelogram" ? "parallelogram" : "regular";
          node.setAttr("multiShapeVariant", safe);
          updateMultiShapeGeometry(node);
        }
      );

      // Regular polygon sides
      addNumberField(
        "Number of sides (regular)",
        sides,
        3,
        1,
        (val) => {
          node.setAttr("multiShapeSides", val);
          updateMultiShapeGeometry(node);
        }
      );

      // Width / Height (for both variants)
      addNumberField("Width (px)", width, 10, 1, (val) => {
        node.setAttr("multiShapeWidth", val);
        updateMultiShapeGeometry(node);
      });

      addNumberField("Height (px)", height, 10, 1, (val) => {
        node.setAttr("multiShapeHeight", val);
        updateMultiShapeGeometry(node);
      });

      // Skew only really affects parallelogram, but safe always
      addNumberField(
        "Skew angle (deg)",
        skew,
        -80,
        1,
        (val) => {
          node.setAttr("multiShapeSkew", val);
          updateMultiShapeGeometry(node);
        }
      );

      // --- Styling controls ---

      addCheckboxField(
        "Fill enabled",
        fillEnabled,
        (checked) => {
          node.setAttr("shapeFillEnabled", checked);
          applyBasicShapeStyle(node);
          ensureHitRect(node);
        }
      );

      addColorField("Fill colour", fillColor, (val) => {
        node.setAttr("shapeFillColor", val);
        applyBasicShapeStyle(node);
        ensureHitRect(node);
      });

      addColorField("Border colour", strokeColor, (val) => {
        node.setAttr("shapeStrokeColor", val);
        applyBasicShapeStyle(node);
        ensureHitRect(node);
      });

      addNumberField(
        "Border thickness",
        strokeWidth,
        0.5,
        0.5,
        (val) => {
          node.setAttr("shapeStrokeWidth", val);
          applyBasicShapeStyle(node);
          ensureHitRect(node);
        }
      );

      addSelectField(
        "Border style",
        strokeStyle,
        [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ],
        (val) => {
          const allowed = ["solid", "dashed", "dotted"];
          const safe = allowed.includes(val) ? val : "solid";
          node.setAttr("shapeStrokeStyle", safe);
          applyBasicShapeStyle(node);
          ensureHitRect(node);
        }
      );

      return;
    }


    // ---- Fallback for unknown shapes ----
    addTitle("Selection");
    addStaticRow("Type", shapeType || "Unknown");
    {
      const p = document.createElement("p");
      p.className = "sb-inspector-empty";
      p.textContent = "No specific controls for this object type yet.";
      el.appendChild(p);
    }
  } // end of renderInspector


  // expose for external callers if needed
  window.renderSeatmapInspector = renderInspector;


  // ---------- Selection / transformer ----------

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

// Wrapper that extends the original behaviour with multi-shape transform
// and Shift-based multi-selection.
function attachNodeBehaviour(node) {
  if (!node || !(node instanceof Konva.Group)) return;

  // 1) Run all of your existing per-type hooks / drag logic etc.
  baseAttachNodeBehaviour(node);

  const type = node.getAttr("shapeType") || node.name();

  // 2) Ensure multi-shapes always have resize/rotate transform behaviour
  if (type === "multi-shape") {
    attachMultiShapeTransformBehaviour(node);
  }

  // 3) Selection behaviour (single + Shift multi-select)
  //    Remove any previous selection handlers so we don't stack listeners.
  node.off("click.seatmapSelect tap.seatmapSelect");

  node.on("click.seatmapSelect tap.seatmapSelect", (evt) => {
    evt.cancelBubble = true;

    if (isShiftPressed && transformer) {
      // Multi-select: add/remove this node from the Transformer selection
      const existing = transformer.nodes();
      const idx = existing.indexOf(node);

      if (idx === -1) {
        // Add node
        transformer.nodes(existing.concat(node));
      } else {
        // Remove node
        const clone = existing.slice();
        clone.splice(idx, 1);
        transformer.nodes(clone);
      }

      // If exactly one node selected, keep inspector in "single" mode
      selectedNode =
        transformer.nodes().length === 1 ? transformer.nodes()[0] : null;

      renderInspector(selectedNode);

      if (mapLayer) mapLayer.batchDraw();
      if (overlayLayer) overlayLayer.batchDraw();
    } else {
      // Normal single selection (clears previous selection)
      selectNode(node);
    }
  });

  // NOTE:
  // We are *not* touching any of your existing drag / hover handlers,
  // because those are all still inside baseAttachNodeBehaviour(node).
}

  // ---------- Node creation based on active tool ----------

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

      // ---------- Canvas interactions: click / selection / placement ----------
function handleStageClick(evt) {
    // 🛑 CRITICAL FIX: If we are in seat assignment mode, we must EXIT immediately.
    // This stops the general stage logic (like selection/deselection or tool placement)
    // from consuming the click event, allowing it to propagate to the seat's Konva handler.
    if (window.ticketSeatSelectionMode) {
        // eslint-disable-next-line no-console
        console.log("[seatmap][tickets] STAGE CLICK BLOCKED: Ticket assignment mode is active. Allowing seat listener to run.");
        return;
    }
    
    // --- START ORIGINAL LOGIC ---
    if (!stage || !mapLayer) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;
    const pos = pointerPos;

    // eslint-disable-next-line no-console
    console.log("[seatmap] stage click", {
        selectionModeOn: ticketSeatSelectionMode,
        targetName: evt.target && evt.target.name ? evt.target.name() : evt.target && evt.target.className,
        pointer: pointerPos,
    });

    const target = evt.target;
    const isHandle =
        target &&
        target.getAttr &&
        (target.getAttr("isLineHandle") || target.getAttr("isArrowHandle"));

    // Stairs uses click+drag, not click-to-place.
    // The actual creation is driven by mousedown / mousemove / mouseup.
    if (activeTool === "stairs") {
        return;
    }

    // --- Multi-shape tool (N-sided polygons, rhombus, parallelogram) ---
    if (activeTool === "multi-shape") {
        const g = createMultiShape(pos.x, pos.y);
        mapLayer.add(g);
        attachNodeBehaviour(g);
        sbNormalizeZOrder(g);
        selectNode(g);
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
        return;
    }

    // 1) LINE TOOL (click-to-add points)
    // Only fire on normal canvas clicks – NOT when clicking a handle.
    if ((activeTool === "line" || activeTool === "curve-line") && !isHandle) {
        handleLineClick(pointerPos, activeTool);
        return;
    }

    // 1b) ARROW TOOL (click start, click end)
    if (activeTool === "arrow") {
        handleArrowClick(pointerPos);
        return;
    }

    // 2) Placement tools (rows, single seats, tables, shapes, text, etc.)
    // If a placement tool is active, ALWAYS create at the click position,
    // even if we clicked on top of another shape (inside a VIP box, etc.).
    if (
        activeTool &&
        activeTool !== "line" &&
        activeTool !== "curve-line" &&
        activeTool !== "arrow"
    ) {
        const node = createNodeForTool(activeTool, pointerPos);
        if (!node) return;

        mapLayer.add(node);

        // NEW: send basic shapes to the back (background layers)
        const t = node.getAttr("shapeType") || node.name();
        if (t === "square" || t === "circle") {
            node.moveToBottom();
        }

        attachNodeBehaviour(node);
        mapLayer.batchDraw();
        updateSeatCount();
        selectNode(node);
        pushHistory();

        // Drop the tool after placing so next click doesn't create another
        setActiveTool(null);
        updateDefaultCursor();
        return;
    }

    // 3) No active placement tool → standard selection behaviour
    let group = null;
    if (target && typeof target.findAncestor === "function") {
        group = target.findAncestor("Group", true);
    }

    // Clicked on an existing object → select it
    if (group && group.getLayer && group.getLayer() === mapLayer) {
        const e = evt.evt || evt;
        const additive =
            isShiftPressed || !!(e && (e.shiftKey || e.metaKey || e.ctrlKey));

        selectNode(group, additive);
        return;
    }

    // 4) Clicked on empty canvas → clear selection
    const clickedOnEmpty =
        target === stage || (target.getLayer && target.getLayer() === gridLayer);

    if (clickedOnEmpty) {
        clearSelection();
    }
    // --- END ORIGINAL LOGIC ---
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
      updateSeatCount();
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

  function setZoom(scale) {
    if (!stage) return;

    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
    const oldScale = stage.scaleX() || 1;
    if (Math.abs(clamped - oldScale) < 0.0001) return;

    stage.scale({ x: clamped, y: clamped });

    stage.size({
      width: baseStageWidth / clamped,
      height: baseStageHeight / clamped,
    });

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
        console.info("[seatmap] save: finished");
      }
    });
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

  window.__TIXALL_SET_TAB_MODE__ = function (tab) {
    activeMainTab = tab || "map";

    setTicketSeatSelectionMode(false, "tab-change");
    clearSelection();

    if (activeMainTab === "tickets") {
      findDuplicateSeatRefs();
      renderTicketingPanel();
    } else {
      applySeatVisuals();
      renderInspector(selectedNode);
    }
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
