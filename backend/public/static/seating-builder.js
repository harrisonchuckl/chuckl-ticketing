// backend/public/static/seating-builder.js
// Plain browser JS – relies on global Konva and window.__SEATMAP_SHOW_ID__ / __SEATMAP_LAYOUT__

(function () {
  const showId = window.__SEATMAP_SHOW_ID__;
  const layoutType = window.__SEATMAP_LAYOUT__ || "blank";
  const API_URL = `/admin/seating/builder/api/seatmaps/${showId}`;

  if (!showId) {
    console.error("Seatbuilder: missing window.__SEATMAP_SHOW_ID__");
    return;
  }

  const app = document.getElementById("app");
  if (!app) {
    console.error("Seatbuilder: #app not found");
    return;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let stage = null;
  let layer = null;
  let currentTool = null;
  let history = [];
  let historyIndex = -1;
  let currentData = null; // GET payload
  let isSaving = false;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function createShell() {
    app.innerHTML = `
      <div class="seatbuilder-shell">
        <header class="seatbuilder-header">
          <div class="seatbuilder-header-left">
            <div class="seatbuilder-header-title">Seat designer</div>
            <div class="seatbuilder-header-show" id="sb-show-title">Loading show...</div>
          </div>
          <div class="seatbuilder-header-pill">
            <span class="seatbuilder-header-pill-dot"></span>
            Live layout preview
          </div>
        </header>

        <aside class="seatbuilder-sidebar">
          <div>
            <div class="sidebar-section-title">Tools</div>
            <div class="sidebar-description">
              Drop in sections, tables and seats. Drag to reposition, use zoom in the centre panel.
            </div>

            <div class="tool-group">
              <div class="helper-text">Seating</div>
              <div class="tool-row">
                <button class="tool-button" data-tool="section">
                  <span class="icon">S</span>
                  Section block
                </button>
                <button class="tool-button" data-tool="row">
                  <span class="icon">R</span>
                  Row of seats
                </button>
                <button class="tool-button" data-tool="single">
                  <span class="icon">•</span>
                  Single seat
                </button>
              </div>

              <div class="tool-row">
                <button class="tool-button" data-tool="circle-table">
                  <span class="icon">○</span>
                  Circular table
                </button>
                <button class="tool-button" data-tool="rect-table">
                  <span class="icon">▭</span>
                  Rectangular table
                </button>
              </div>
            </div>

            <div class="tool-group" style="margin-top:12px;">
              <div class="helper-text">Room & labelling</div>
              <div class="tool-row">
                <button class="tool-button" data-tool="stage">
                  <span class="icon">🎭</span>
                  Stage
                </button>
                <button class="tool-button" data-tool="bar">
                  <span class="icon">🍺</span>
                  Bar / kiosk
                </button>
                <button class="tool-button" data-tool="exit">
                  <span class="icon">↗</span>
                  Exit
                </button>
              </div>
              <div class="tool-row">
                <button class="tool-button" data-tool="text">
                  <span class="icon">T</span>
                  Text label
                </button>
              </div>
            </div>
          </div>

          <div>
            <div class="sidebar-section-title" style="margin-top:4px;">Actions</div>
            <div class="action-row">
              <button id="sb-undo" class="action-button is-disabled">Undo</button>
              <button id="sb-redo" class="action-button is-disabled">Redo</button>
            </div>
            <div class="action-row" style="margin-top:6px;">
              <button id="sb-clear" class="action-button">Clear canvas</button>
            </div>
          </div>
        </aside>

        <section class="seatbuilder-canvas-panel">
          <div class="canvas-toolbar">
            <div class="canvas-toolbar-left">
              <div class="canvas-pill">
                Layout type:
                <strong style="margin-left:4px;" id="sb-layout-type">${layoutType}</strong>
              </div>
              <!-- Helper text that used to sit in the centre has been removed
                   to keep the canvas area visually clean. -->
            </div>
            <div class="canvas-zoom-controls">
              <button class="canvas-zoom-button" id="sb-zoom-out">−</button>
              <button class="canvas-zoom-button" id="sb-zoom-reset">100%</button>
              <button class="canvas-zoom-button" id="sb-zoom-in">+</button>
            </div>
          </div>

          <div id="seatmap-canvas"></div>
        </section>

        <aside class="seatbuilder-inspector">
          <div class="inspector-section">
            <div class="inspector-section-header">
              <div class="inspector-title">Layout details</div>
              <span class="inspector-badge" id="sb-seat-count">0 seats</span>
            </div>
            <div class="inspector-row">
              <span class="inspector-row-label">Show</span>
              <span id="sb-inspector-show">–</span>
            </div>
            <div class="inspector-row">
              <span class="inspector-row-label">Venue</span>
              <span id="sb-inspector-venue">–</span>
            </div>
            <div class="inspector-row">
              <span class="inspector-row-label">Layout type</span>
              <span id="sb-inspector-layout">${layoutType}</span>
            </div>
            <p class="inspector-note">
              This step is just to sketch the room. You’ll map seats to ticket types in the next screen.
            </p>
            <button id="sb-save" class="primary-button">
              <span>Save layout</span>
            </button>
          </div>

          <div class="inspector-section">
            <div class="inspector-section-header">
              <div class="inspector-title">Selection</div>
            </div>
            <div class="selection-summary" id="sb-selection-summary">
              Nothing selected. Click on a seat, table or object to see quick details here.
            </div>
          </div>

          <div class="helper-text">
            Tip: you can reuse this layout for future shows at the same venue – we’ll store it as a template behind the scenes.
          </div>
        </aside>
      </div>
    `;
  }

  function setCurrentTool(toolName) {
    currentTool = toolName;
    document.querySelectorAll(".tool-button").forEach((btn) => {
      if (btn.getAttribute("data-tool") === toolName) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });
  }

  function updateSeatCount() {
    if (!layer) return;
    const seats = layer.find(".seat");
    const count = seats.length;
    const el = document.getElementById("sb-seat-count");
    if (el) {
      el.textContent = `${count} seat${count === 1 ? "" : "s"}`;
    }
  }

  function updateSelectionSummary(node) {
    const el = document.getElementById("sb-selection-summary");
    if (!el) return;

    if (!node) {
      el.innerHTML =
        "Nothing selected. Click on a seat, table or object to see quick details here.";
      return;
    }

    const type = node.getAttr("sbType") || node.getClassName();
    const label = node.getAttr("label") || node.getAttr("name") || "Item";
    const extraSeats = node.getAttr("seatCount");
    let text = `<strong>${label}</strong> (${type})`;

    if (extraSeats) {
      text += `<br/>Contains approximately <strong>${extraSeats}</strong> seats.`;
    }

    if (node.hasName("seat")) {
      text += `<br/>This is a single seat.`;
    }

    el.innerHTML = text;
  }

  function withHistorySnapshot(fn) {
    if (!stage) return;
    fn();
    pushHistory();
    updateSeatCount();
  }

  function pushHistory() {
    if (!stage) return;
    const json = stage.toJSON();
    // Trim any redo history
    history = history.slice(0, historyIndex + 1);
    history.push(json);
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }

  function loadHistoryIndex(index) {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    const json = history[historyIndex];
    hydrateStageFromJSON(json);
    updateHistoryButtons();
    updateSeatCount();
    updateSelectionSummary(null);
  }

  function updateHistoryButtons() {
    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");
    if (undoBtn) {
      undoBtn.classList.toggle("is-disabled", historyIndex <= 0);
    }
    if (redoBtn) {
      redoBtn.classList.toggle(
        "is-disabled",
        historyIndex < 0 || historyIndex >= history.length - 1
      );
    }
  }

  function hydrateStageFromJSON(json) {
    const container = document.getElementById("seatmap-canvas");
    if (!container) return;

    // Destroy any previous stage
    if (stage) {
      stage.destroy();
    }

    if (json) {
      const newStage = Konva.Node.fromJSON(json);
      newStage.container(container);
      stage = newStage;
      // Try to get the first layer, or create one if missing
      layer = stage.findOne("Layer") || stage.getLayers()[0];
      if (!layer) {
        layer = new Konva.Layer();
        stage.add(layer);
      }
    } else {
      const { width, height } = container.getBoundingClientRect();
      stage = new Konva.Stage({
        container: container,
        width: width || 900,
        height: height || 560,
      });
      layer = new Konva.Layer();
      stage.add(layer);
    }

    attachStageHandlers();

    // Keep stage responsive
    window.addEventListener("resize", function () {
      if (!stage) return;
      const rect = container.getBoundingClientRect();
      stage.size({
        width: rect.width || 900,
        height: rect.height || 560,
      });
    });
  }

  function attachStageHandlers() {
    if (!stage || !layer) return;

    // Clear previous handlers to avoid duplicates
    stage.off("click");
    stage.off("mousedown");

    stage.on("click", function (e) {
      const clicked = e.target;

      // If clicked empty canvas
      if (clicked === stage) {
        updateSelectionSummary(null);
        return;
      }

      updateSelectionSummary(clicked);
    });
  }

  function makeSeat(x, y) {
    return new Konva.Circle({
      x,
      y,
      radius: 8,
      fill: "#ffffff",
      stroke: "#2563eb",
      strokeWidth: 2,
      draggable: true,
      name: "seat",
      sbType: "Seat",
    });
  }

  function makeRowOfSeats(x, y, count) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Row of seats",
      seatCount: count,
      label: `Row (${count})`,
    });

    const spacing = 24;
    for (let i = 0; i < count; i++) {
      const seat = makeSeat(i * spacing, 0);
      group.add(seat);
    }

    return group;
  }

  function makeSectionBlock(x, y) {
    const width = 220;
    const height = 140;
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Section",
      label: "Section",
    });

    const rect = new Konva.Rect({
      width,
      height,
      fill: "#e0f2fe",
      stroke: "#1d4ed8",
      strokeWidth: 2,
      cornerRadius: 10,
    });

    const label = new Konva.Text({
      text: "Section",
      fontSize: 14,
      fontStyle: "600",
      fill: "#1e293b",
      x: 10,
      y: 8,
    });

    group.add(rect);
    group.add(label);
    return group;
  }

  function makeStageBlock(x, y) {
    const width = 360;
    const height = 60;
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Stage",
      label: "Stage",
    });

    const rect = new Konva.Rect({
      width,
      height,
      fill: "#dbeafe",
      stroke: "#1d4ed8",
      strokeWidth: 2,
      cornerRadius: 8,
    });

    const label = new Konva.Text({
      text: "Stage",
      fontSize: 16,
      fontStyle: "600",
      fill: "#1f2937",
      align: "center",
      width,
      y: height / 2 - 10,
    });

    group.add(rect);
    group.add(label);
    return group;
  }

  function makeBarBlock(x, y) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Bar",
      label: "Bar",
    });

    const rect = new Konva.Rect({
      width: 120,
      height: 40,
      fill: "#f97316",
      stroke: "#c2410c",
      strokeWidth: 2,
      cornerRadius: 6,
    });

    const label = new Konva.Text({
      text: "Bar",
      fontSize: 13,
      fontStyle: "600",
      fill: "#ffffff",
      align: "center",
      width: 120,
      y: 12,
    });

    group.add(rect);
    group.add(label);
    return group;
  }

  function makeExitBlock(x, y) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Exit",
      label: "Exit",
    });

    const rect = new Konva.Rect({
      width: 80,
      height: 30,
      fill: "#22c55e",
      stroke: "#15803d",
      strokeWidth: 2,
      cornerRadius: 6,
    });

    const label = new Konva.Text({
      text: "Exit",
      fontSize: 12,
      fontStyle: "600",
      fill: "#ffffff",
      align: "center",
      width: 80,
      y: 8,
    });

    group.add(rect);
    group.add(label);
    return group;
  }

  function makeCircularTable(x, y, seats) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Circular table",
      label: `Table (${seats})`,
      seatCount: seats,
    });

    const table = new Konva.Circle({
      radius: 40,
      fill: "#f9fafb",
      stroke: "#64748b",
      strokeWidth: 2,
    });

    group.add(table);

    const radius = 56;
    for (let i = 0; i < seats; i++) {
      const angle = (i / seats) * Math.PI * 2;
      const sx = radius * Math.cos(angle);
      const sy = radius * Math.sin(angle);
      const seat = makeSeat(sx, sy);
      group.add(seat);
    }

    return group;
  }

  function makeRectTable(x, y, seats) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Rectangular table",
      label: `Table (${seats})`,
      seatCount: seats,
    });

    const rect = new Konva.Rect({
      width: 80,
      height: 40,
      fill: "#f9fafb",
      stroke: "#64748b",
      strokeWidth: 2,
      cornerRadius: 6,
    });

    group.add(rect);

    const spacing = 20;
    for (let i = 0; i < seats; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const offsetIndex = Math.floor(i / 2);
      const sx = rect.width() / 2 + side * 16;
      const sy = (offsetIndex - (seats / 4)) * spacing;
      const seat = makeSeat(sx, sy);
      group.add(seat);
    }

    return group;
  }

  function makeTextLabel(x, y) {
    const group = new Konva.Group({
      x,
      y,
      draggable: true,
      sbType: "Text label",
      label: "Label",
    });

    const text = new Konva.Text({
      text: "Label",
      fontSize: 14,
      fill: "#0f172a",
    });

    const padding = 6;

    const bg = new Konva.Rect({
      width: text.width() + padding * 2,
      height: text.height() + padding * 2,
      fill: "#ffffff",
      stroke: "#cbd5e1",
      strokeWidth: 1,
      cornerRadius: 6,
    });

    text.x(padding);
    text.y(padding);

    group.add(bg);
    group.add(text);
    return group;
  }

  function getCanvasCenter() {
    if (!stage) return { x: 400, y: 260 };
    return {
      x: stage.width() / 2,
      y: stage.height() / 2,
    };
  }

  // ---------------------------------------------------------------------------
  // Save to backend
  // ---------------------------------------------------------------------------

  async function saveLayout() {
    if (!stage || !currentData || isSaving) return;

    const btn = document.getElementById("sb-save");
    isSaving = true;
    if (btn) btn.classList.add("is-busy");

    try {
      const active = currentData.activeSeatMap;
      const show = currentData.show;

      // Stage JSON as JS object, not string
      const jsonString = stage.toJSON();
      const konvaJson = JSON.parse(jsonString);

      // Estimate capacity as number of individual seats
      const seats = layer ? layer.find(".seat").length : 0;

      const payload = {
        seatMapId: active ? active.id : undefined,
        name: active ? active.name : `${show.title} – ${layoutType} layout`,
        layoutType,
        config: null,
        estimatedCapacity: seats || null,
        konvaJson,
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Failed to save seatmap", await res.text());
        alert("Sorry, something went wrong while saving the layout.");
        return;
      }

      const data = await res.json();
      console.log("Seatmap saved", data);
      alert("Layout saved.");
    } catch (err) {
      console.error("Error saving layout", err);
      alert("Sorry, something went wrong while saving the layout.");
    } finally {
      isSaving = false;
      if (btn) btn.classList.remove("is-busy");
    }
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  async function init() {
    createShell();

    // Wire up tool buttons
    document.querySelectorAll(".tool-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        setCurrentTool(tool);
      });
    });

    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");
    const clearBtn = document.getElementById("sb-clear");
    const saveBtn = document.getElementById("sb-save");

    undoBtn &&
      undoBtn.addEventListener("click", () => {
        if (historyIndex <= 0) return;
        loadHistoryIndex(historyIndex - 1);
      });

    redoBtn &&
      redoBtn.addEventListener("click", () => {
        if (historyIndex >= history.length - 1) return;
        loadHistoryIndex(historyIndex + 1);
      });

    clearBtn &&
      clearBtn.addEventListener("click", () => {
        if (!layer) return;
        withHistorySnapshot(() => {
          layer.destroyChildren();
          layer.draw();
        });
        updateSelectionSummary(null);
      });

    saveBtn && saveBtn.addEventListener("click", saveLayout);

    // Zoom controls
    let zoomLevel = 1;
    const zoomInBtn = document.getElementById("sb-zoom-in");
    const zoomOutBtn = document.getElementById("sb-zoom-out");
    const zoomResetBtn = document.getElementById("sb-zoom-reset");

    function applyZoom() {
      if (!stage) return;
      stage.scale({ x: zoomLevel, y: zoomLevel });
      stage.batchDraw();
      if (zoomResetBtn) {
        zoomResetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
      }
    }

    zoomInBtn &&
      zoomInBtn.addEventListener("click", () => {
        zoomLevel = Math.min(zoomLevel + 0.1, 2);
        applyZoom();
      });

    zoomOutBtn &&
      zoomOutBtn.addEventListener("click", () => {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
        applyZoom();
      });

    zoomResetBtn &&
      zoomResetBtn.addEventListener("click", () => {
        zoomLevel = 1;
        applyZoom();
      });

    // Load initial data + layout
    try {
      const res = await fetch(API_URL);
      if (!res.ok) {
        console.error("Failed to load seatmap data", await res.text());
        throw new Error("Failed to load layout");
      }
      currentData = await res.json();
    } catch (err) {
      console.error(err);
      currentData = null;
    }

    // Update header / inspector with show & venue info
    if (currentData && currentData.show) {
      const show = currentData.show;
      const headerEl = document.getElementById("sb-show-title");
      if (headerEl) {
        headerEl.textContent = `${show.title} – ${new Date(
          show.date
        ).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`;
      }
      const showLabel = document.getElementById("sb-inspector-show");
      if (showLabel) showLabel.textContent = show.title;

      const venueLabel = document.getElementById("sb-inspector-venue");
      if (venueLabel) {
        if (show.venue) {
          venueLabel.textContent = `${show.venue.name} (${show.venue.city || "TBC"})`;
        } else {
          venueLabel.textContent = "Not linked to a venue";
        }
      }
    }

    // Hydrate stage from existing layout if present
    let initialJson = null;
    if (
      currentData &&
      currentData.activeSeatMap &&
      currentData.activeSeatMap.layout &&
      currentData.activeSeatMap.layout.konvaJson
    ) {
      initialJson = JSON.stringify(
        currentData.activeSeatMap.layout.konvaJson
      );
    }

    hydrateStageFromJSON(initialJson);

    // When clicking canvas with a tool selected, add elements at pointer position
    if (stage && layer) {
      stage.on("mousedown.addTool", function (evt) {
        if (!currentTool) return;
        // Avoid placing when clicking existing shape – they can just drag it
        if (evt.target !== stage) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        withHistorySnapshot(() => {
          const { x, y } = pos;
          let node = null;
          const centre = getCanvasCenter();

          switch (currentTool) {
            case "single":
              node = makeSeat(x, y);
              break;
            case "row":
              node = makeRowOfSeats(x || centre.x - 120, y || centre.y, 10);
              break;
            case "section":
              node = makeSectionBlock(
                x || centre.x - 110,
                y || centre.y - 70
              );
              break;
            case "stage":
              node = makeStageBlock(
                x || centre.x - 180,
                y || centre.y - 30
              );
              break;
            case "bar":
              node = makeBarBlock(
                x || centre.x - 60,
                y || centre.y - 20
              );
              break;
            case "exit":
              node = makeExitBlock(
                x || centre.x - 40,
                y || centre.y - 15
              );
              break;
            case "circle-table":
              node = makeCircularTable(
                x || centre.x,
                y || centre.y,
                10
              );
              break;
            case "rect-table":
              node = makeRectTable(
                x || centre.x,
                y || centre.y,
                8
              );
              break;
            case "text":
              node = makeTextLabel(
                x || centre.x - 40,
                y || centre.y - 20
              );
              break;
            default:
              break;
          }

          if (node) {
            layer.add(node);
            layer.draw();
            updateSelectionSummary(node);
          }
        });
      });

      // When dragging ends, store new snapshot
      layer.on("dragend", function () {
        pushHistory();
        updateSeatCount();
      });
    }

    // Seed history + counters
    pushHistory();
    updateSeatCount();
    updateSelectionSummary(null);
  }

  // Kick off
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
