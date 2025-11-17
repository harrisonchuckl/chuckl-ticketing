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

  // createShell inserts ONLY an empty canvas container.
  function createShell() {
    app.innerHTML = `
      <div id="seatmap-canvas" class="seatmap-canvas"></div>
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

    if (node.hasName && node.hasName("seat")) {
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

    if (undoBtn) undoBtn.classList.toggle("is-disabled", historyIndex <= 0);
    if (redoBtn)
      redoBtn.classList.toggle(
        "is-disabled",
        historyIndex < 0 || historyIndex >= history.length - 1
      );
  }

  // ---------------------------------------------------------------------------
  // Stage setup
  // ---------------------------------------------------------------------------

  function hydrateStageFromJSON(json) {
    const container = document.getElementById("seatmap-canvas");
    if (!container) return;

    if (stage) stage.destroy();

    if (json) {
      const newStage = Konva.Node.fromJSON(json);
      newStage.container(container);
      stage = newStage;
      layer = stage.findOne("Layer") || stage.getLayers()[0];

      if (!layer) {
        layer = new Konva.Layer();
        stage.add(layer);
      }
    } else {
      const { width, height } = container.getBoundingClientRect();
      stage = new Konva.Stage({
        container,
        width: width || 900,
        height: height || 560,
      });
      layer = new Konva.Layer();
      stage.add(layer);
    }

    attachStageHandlers();

    window.addEventListener("resize", () => {
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

    stage.off("click");
    stage.off("mousedown");

    stage.on("click", function (e) {
      const clicked = e.target;

      if (clicked === stage) {
        updateSelectionSummary(null);
        return;
      }

      updateSelectionSummary(clicked);
    });
  }

  // ---------------------------------------------------------------------------
  // Shape makers
  // ---------------------------------------------------------------------------

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
      group.add(makeSeat(i * spacing, 0));
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

    group.add(
      new Konva.Rect({
        width,
        height,
        fill: "#e0f2fe",
        stroke: "#1d4ed8",
        strokeWidth: 2,
        cornerRadius: 10,
      })
    );

    group.add(
      new Konva.Text({
        text: "Section",
        fontSize: 14,
        fontStyle: "600",
        fill: "#1e293b",
        x: 10,
        y: 8,
      })
    );

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

    group.add(
      new Konva.Rect({
        width,
        height,
        fill: "#dbeafe",
        stroke: "#1d4ed8",
        strokeWidth: 2,
        cornerRadius: 8,
      })
    );

    group.add(
      new Konva.Text({
        text: "Stage",
        fontSize: 16,
        fontStyle: "600",
        fill: "#1f2937",
        align: "center",
        width,
        y: height / 2 - 10,
      })
    );

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

    group.add(
      new Konva.Rect({
        width: 120,
        height: 40,
        fill: "#f97316",
        stroke: "#c2410c",
        strokeWidth: 2,
        cornerRadius: 6,
      })
    );

    group.add(
      new Konva.Text({
        text: "Bar",
        fontSize: 13,
        fontStyle: "600",
        fill: "#ffffff",
        align: "center",
        width: 120,
        y: 12,
      })
    );

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

    group.add(
      new Konva.Rect({
        width: 80,
        height: 30,
        fill: "#22c55e",
        stroke: "#15803d",
        strokeWidth: 2,
        cornerRadius: 6,
      })
    );

    group.add(
      new Konva.Text({
        text: "Exit",
        fontSize: 12,
        fontStyle: "600",
        fill: "#ffffff",
        align: "center",
        width: 80,
        y: 8,
      })
    );

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

    group.add(
      new Konva.Circle({
        radius: 40,
        fill: "#f9fafb",
        stroke: "#64748b",
        strokeWidth: 2,
      })
    );

    const radius = 56;

    for (let i = 0; i < seats; i++) {
      const angle = (i / seats) * Math.PI * 2;
      group.add(makeSeat(radius * Math.cos(angle), radius * Math.sin(angle)));
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
      const sy = (offsetIndex - seats / 4) * spacing;
      group.add(makeSeat(sx, sy));
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

  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  async function saveLayout() {
    if (!stage || !currentData || isSaving) return;

    // Prefer the top-right "Save layout" button if present
    const btn = window.__TICKIN_SAVE_BUTTON__ || document.getElementById("sb-save");
    isSaving = true;
    if (btn) btn.classList.add("is-busy");

    try {
      const active = currentData.activeSeatMap;
      const show = currentData.show;

      const jsonString = stage.toJSON();
      const konvaJson = JSON.parse(jsonString);

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

      console.log("Seatmap saved", await res.json());
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
    // 1️⃣ Build minimal shell
    createShell();

    // 2️⃣ Hook up tool buttons from TickIn builder UI (left sidebar)
    document.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        if (!tool) return;
        setCurrentTool(tool);
      });
    });

    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");
    const clearBtn = document.getElementById("sb-clear");
    const saveBtn =
      window.__TICKIN_SAVE_BUTTON__ || document.getElementById("sb-save");

    if (undoBtn)
      undoBtn.addEventListener("click", function () {
        if (historyIndex <= 0) return;
        loadHistoryIndex(historyIndex - 1);
      });

    if (redoBtn)
      redoBtn.addEventListener("click", function () {
        if (historyIndex >= history.length - 1) return;
        loadHistoryIndex(historyIndex + 1);
      });

    if (clearBtn)
      clearBtn.addEventListener("click", function () {
        if (!layer) return;
        if (!window.confirm("Clear all items from the canvas?")) return;
        withHistorySnapshot(() => {
          layer.destroyChildren();
          layer.draw();
        });
        updateSelectionSummary(null);
      });

    if (saveBtn) saveBtn.addEventListener("click", saveLayout);

    // 3️⃣ Zoom controls (now in tabs row)
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

    if (zoomInBtn)
      zoomInBtn.addEventListener("click", () => {
        zoomLevel = Math.min(zoomLevel + 0.1, 2);
        applyZoom();
      });

    if (zoomOutBtn)
      zoomOutBtn.addEventListener("click", () => {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.4);
        applyZoom();
      });

    if (zoomResetBtn)
      zoomResetBtn.addEventListener("click", () => {
        zoomLevel = 1;
        applyZoom();
      });

    // 4️⃣ Load seatmap data
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Failed to fetch seatmap data");
      currentData = await res.json();
    } catch (err) {
      console.error("Cannot load seatmap data", err);
      currentData = null;
    }

    // 5️⃣ Fill inspector / meta info
    if (currentData && currentData.show) {
      const show = currentData.show;

      // Support both "sb-*" (older) and "tb-*" (new TickIn shell)
      const header =
        document.getElementById("sb-show-title") ||
        document.getElementById("tb-show-title");
      const showLabel =
        document.getElementById("sb-inspector-show") ||
        document.getElementById("tb-meta-show-title");
      const venueLabel =
        document.getElementById("sb-inspector-venue") ||
        document.getElementById("tb-meta-venue-name");

      if (header) {
        try {
          header.textContent = `${show.title} – ${new Date(
            show.date
          ).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}`;
        } catch {
          header.textContent = show.title || "Seat map designer";
        }
      }

      if (showLabel) showLabel.textContent = show.title || "Untitled show";

      if (venueLabel) {
        if (show.venue) {
          venueLabel.textContent = `${show.venue.name} ${
            show.venue.city ? "(" + show.venue.city + ")" : ""
          }`;
        } else {
          venueLabel.textContent = "Not linked to a venue";
        }
      }
    }

    // 6️⃣ Load existing Konva layout
    let initial = null;

    if (
      currentData &&
      currentData.activeSeatMap &&
      currentData.activeSeatMap.layout &&
      currentData.activeSeatMap.layout.konvaJson
    ) {
      initial = JSON.stringify(currentData.activeSeatMap.layout.konvaJson);
    }

    hydrateStageFromJSON(initial);

    // 7️⃣ Tool behaviour on canvas
    if (stage && layer) {
      stage.on("mousedown.addTool", function (evt) {
        if (!currentTool) return;
        if (evt.target !== stage) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        withHistorySnapshot(() => {
          const { x, y } = pos;
          let node = null;

          switch (currentTool) {
            case "single":
              node = makeSeat(x, y);
              break;
            case "row":
              node = makeRowOfSeats(x, y, 10);
              break;
            case "section":
              node = makeSectionBlock(x, y);
              break;
            case "stage":
              node = makeStageBlock(x, y);
              break;
            case "bar":
              node = makeBarBlock(x, y);
              break;
            case "exit":
              node = makeExitBlock(x, y);
              break;
            case "circle-table":
              node = makeCircularTable(x, y, 10);
              break;
            case "rect-table":
              node = makeRectTable(x, y, 8);
              break;
            case "text":
              node = makeTextLabel(x, y);
              break;
          }

          if (node) {
            layer.add(node);
            layer.draw();
            updateSelectionSummary(node);
          }
        });
      });

      layer.on("dragend", () => {
        pushHistory();
        updateSeatCount();
      });
    }

    // 8️⃣ Seed history + counters
    pushHistory();
    updateSeatCount();
    updateSelectionSummary(null);
    applyZoom();
  }

  // ---------------------------------------------------------------------------

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
