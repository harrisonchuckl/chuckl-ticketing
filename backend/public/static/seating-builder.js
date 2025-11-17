// backend/public/static/seating-builder.js
// TickIn seating builder – square grid, clean drag/drop, per-action undo

/* global Konva */

(function () {
  const showId = window.__SEATMAP_SHOW_ID__;
  const initialLayoutKey = window.__SEATMAP_LAYOUT__ || "blank";

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

  // ---------- Config ----------
  const GRID_SIZE = 32; // square grid, used for both X and Y
  const STAGE_PADDING = 40;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.4;
  const ZOOM_STEP = 0.1;

  // ---------- State ----------
  let stage;
  let gridLayer;
  let mapLayer;
  let overlayLayer;
  let transformer;

  let activeTool = null; // "section" | "row" | "single" | "circle-table" | ...
  let selectedNode = null;

  // history is per-mapLayer JSON so we can re-create nodes & re-attach handlers
  let history = [];
  let historyIndex = -1;
  let isRestoringHistory = false;

  // Simple seat counter (you can wire this into the inspector later)
  const seatCountEl = document.getElementById("sb-seat-count");

  // ---------- Helpers: UI / tools ----------

  function setActiveTool(tool) {
    if (activeTool === tool) {
      activeTool = null;
    } else {
      activeTool = tool;
    }

    document.querySelectorAll(".tool-button").forEach((btn) => {
      const t = btn.getAttribute("data-tool");
      if (t && t === activeTool) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });

    // cursor hint
    if (!activeTool) {
      mapLayer.getStage().container().style.cursor = "default";
    } else {
      mapLayer.getStage().container().style.cursor = "crosshair";
    }
  }

  function updateSeatCount() {
    let seats = 0;
    mapLayer.find("Circle").each((node) => {
      if (node.getAttr("isSeat")) seats += 1;
    });
    if (seatCountEl) {
      seatCountEl.textContent = seats === 1 ? "1 seat" : `${seats} seats`;
    }
  }

  // ---------- Grid ----------

  function drawSquareGrid() {
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
    if (isRestoringHistory) return;

    const json = mapLayer.toJSON();

    // cut off any "redo" entries
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

    // Re-create layer from JSON
    const newLayer = Konva.Node.create(json);
    mapLayer.destroy();
    mapLayer = newLayer;
    stage.add(mapLayer);

    // Re-attach behaviour to all top-level groups (tables, rows, etc.)
    mapLayer.getChildren().each((node) => {
      attachNodeBehaviour(node);
    });

    mapLayer.draw();
    updateSeatCount();
    updateUndoRedoButtons();
    clearSelection(); // selection no longer valid

    isRestoringHistory = false;
  }

  function undo() {
    if (historyIndex <= 0) return;
    restoreHistory(historyIndex - 1);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    restoreHistory(historyIndex + 1);
  }

  // ---------- Selection / transformer ----------

  function clearSelection() {
    selectedNode = null;
    if (transformer) {
      transformer.nodes([]);
      overlayLayer.draw();
    }
    // selection summary text can be set here if needed
  }

  function selectNode(node) {
    selectedNode = node;
    transformer.nodes([node]);
    overlayLayer.draw();
  }

  // ---------- Shape factories ----------

  function snap(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

  function createSectionBlock(x, y) {
    const group = new Konva.Group({
      x: snap(x) - 80,
      y: snap(y) - 24,
      draggable: true,
      name: "section",
      shapeType: "section",
    });

    const rect = new Konva.Rect({
      width: 160,
      height: 48,
      cornerRadius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.5,
    });

    group.add(rect);
    return group;
  }

  function createStage(x, y) {
    const group = new Konva.Group({
      x: snap(x) - 100,
      y: snap(y) - 24,
      draggable: true,
      name: "stage",
      shapeType: "stage",
    });

    const rect = new Konva.Rect({
      width: 200,
      height: 52,
      cornerRadius: 10,
      stroke: "#111827",
      strokeWidth: 1.7,
    });

    const label = new Konva.Text({
      text: "STAGE",
      fontSize: 18,
      fontStyle: "bold",
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width: rect.width(),
      height: rect.height(),
      fill: "#111827",
    });

    group.add(rect);
    group.add(label);
    return group;
  }

  function createBar(x, y) {
    const group = new Konva.Group({
      x: snap(x) - 70,
      y: snap(y) - 18,
      draggable: true,
      name: "bar",
      shapeType: "bar",
    });

    const rect = new Konva.Rect({
      width: 140,
      height: 36,
      cornerRadius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.5,
    });

    const label = new Konva.Text({
      text: "BAR",
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
    return group;
  }

  function createExit(x, y) {
    const group = new Konva.Group({
      x: snap(x) - 50,
      y: snap(y) - 18,
      draggable: true,
      name: "exit",
      shapeType: "exit",
    });

    const rect = new Konva.Rect({
      width: 100,
      height: 36,
      cornerRadius: 8,
      stroke: "#16a34a",
      strokeWidth: 1.6,
    });

    const label = new Konva.Text({
      text: "EXIT",
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
    return group;
  }

  function createTextLabel(x, y) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "label",
      shapeType: "text",
    });

    const text = new Konva.Text({
      text: "Label",
      fontSize: 14,
      fontFamily: "system-ui",
      fill: "#111827",
    });

    group.add(text);
    return group;
  }

  function createSingleSeat(x, y) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "single-seat",
      shapeType: "single-seat",
    });

    const circle = new Konva.Circle({
      radius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.4,
      isSeat: true,
    });

    group.add(circle);
    return group;
  }

  function createCircularTable(x, y) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "circular-table",
      shapeType: "circular-table",
    });

    const tableRadius = 24;
    const seatRadius = 7;
    const seats = 8;

    const table = new Konva.Circle({
      radius: tableRadius,
      stroke: "#4b5563",
      strokeWidth: 1.4,
    });

    group.add(table);

    for (let i = 0; i < seats; i++) {
      const angle = (i / seats) * Math.PI * 2;
      const sx = Math.cos(angle) * (tableRadius + 14);
      const sy = Math.sin(angle) * (tableRadius + 14);
      const seat = new Konva.Circle({
        x: sx,
        y: sy,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });
      group.add(seat);
    }

    return group;
  }

  function createRectTable(x, y) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "rect-table",
      shapeType: "rect-table",
    });

    const width = 80;
    const height = 32;
    const table = new Konva.Rect({
      width,
      height,
      cornerRadius: 6,
      stroke: "#4b5563",
      strokeWidth: 1.4,
      offsetX: width / 2,
      offsetY: height / 2,
    });

    group.add(table);

    const seatRadius = 6;
    const seatsPerSide = 4;

    // top + bottom
    for (let i = 0; i < seatsPerSide; i++) {
      const frac = (i + 1) / (seatsPerSide + 1);
      const sx = (frac - 0.5) * width;

      const topSeat = new Konva.Circle({
        x: sx,
        y: -height / 2 - 10,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      const bottomSeat = new Konva.Circle({
        x: sx,
        y: height / 2 + 10,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      group.add(topSeat);
      group.add(bottomSeat);
    }

    // left + right (2 each)
    for (let i = 0; i < 2; i++) {
      const frac = (i + 1) / 3;
      const sy = (frac - 0.5) * height;

      const leftSeat = new Konva.Circle({
        x: -width / 2 - 10,
        y: sy,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      const rightSeat = new Konva.Circle({
        x: width / 2 + 10,
        y: sy,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      group.add(leftSeat);
      group.add(rightSeat);
    }

    return group;
  }

  function createRowOfSeats(x, y) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "row-seats",
      shapeType: "row-seats",
    });

    const seats = 10;
    const spacing = 20;
    const seatRadius = 6;

    for (let i = 0; i < seats; i++) {
      const sx = (i - (seats - 1) / 2) * spacing;
      const seat = new Konva.Circle({
        x: sx,
        y: 0,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });
      group.add(seat);
    }

    return group;
  }

  // ---------- Behaviour attachment ----------

  function attachNodeBehaviour(node) {
    if (!(node instanceof Konva.Group)) return;

    node.on("mouseover", () => {
      stage.container().style.cursor = "grab";
    });

    node.on("mouseout", () => {
      stage.container().style.cursor = activeTool ? "crosshair" : "default";
    });

    node.on("mousedown", (e) => {
      // prevent background click from firing
      e.cancelBubble = true;
      selectNode(node);
    });

    node.on("dragend", () => {
      node.position({
        x: snap(node.x()),
        y: snap(node.y()),
      });
      mapLayer.batchDraw();
      pushHistory();
    });

    node.on("transformend", () => {
      mapLayer.batchDraw();
      pushHistory();
    });
  }

  function createNodeForTool(tool, pos) {
    const { x, y } = pos;
    switch (tool) {
      case "section":
        return createSectionBlock(x, y);
      case "row":
        return createRowOfSeats(x, y);
      case "single":
        return createSingleSeat(x, y);
      case "circle-table":
        return createCircularTable(x, y);
      case "rect-table":
        return createRectTable(x, y);
      case "stage":
        return createStage(x, y);
      case "bar":
        return createBar(x, y);
      case "exit":
        return createExit(x, y);
      case "text":
        return createTextLabel(x, y);
      default:
        return null;
    }
  }

  // ---------- Init Konva ----------

  function initStage() {
    const width = container.clientWidth - STAGE_PADDING * 2;
    const height = container.clientHeight - STAGE_PADDING * 2;

    stage = new Konva.Stage({
      container: "app",
      width,
      height,
    });

    gridLayer = new Konva.Layer({ listening: false });
    mapLayer = new Konva.Layer();
    overlayLayer = new Konva.Layer();

    stage.add(gridLayer);
    stage.add(mapLayer);
    stage.add(overlayLayer);

    drawSquareGrid();

    transformer = new Konva.Transformer({
      rotateEnabled: true,
      enabledAnchors: [
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      anchorSize: 7,
      borderStroke: "#2563eb",
      anchorStroke: "#2563eb",
      anchorFill: "#ffffff",
      anchorStrokeWidth: 1.2,
      borderStrokeWidth: 1.2,
    });
    overlayLayer.add(transformer);
  }

  // ---------- Canvas interactions ----------

  function handleStageClick(evt) {
    const clickedOnEmpty =
      evt.target === stage || evt.target.getParent() === gridLayer;

    if (!clickedOnEmpty) {
      return;
    }

    // If no active tool, just clear selection
    if (!activeTool) {
      clearSelection();
      return;
    }

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const node = createNodeForTool(activeTool, pos);
    if (!node) return;

    mapLayer.add(node);
    attachNodeBehaviour(node);
    mapLayer.batchDraw();
    updateSeatCount();
    selectNode(node);
    pushHistory(); // create is always a separate undo step
  }

  // keyboard shortcuts (delete)
  function handleKeyDown(e) {
    if (!selectedNode) return;

    if (e.key === "Delete" || e.key === "Backspace") {
      selectedNode.destroy();
      clearSelection();
      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
      e.preventDefault();
    }
  }

  // zoom
  function setZoom(scale) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
    const oldScale = stage.scaleX();
    if (Math.abs(clamped - oldScale) < 0.0001) return;

    const center = {
      x: stage.width() / 2,
      y: stage.height() / 2,
    };

    const mousePointTo = {
      x: (center.x - stage.x()) / oldScale,
      y: (center.y - stage.y()) / oldScale,
    };

    stage.scale({ x: clamped, y: clamped });

    const newPos = {
      x: center.x - mousePointTo.x * clamped,
      y: center.y - mousePointTo.y * clamped,
    };

    stage.position(newPos);
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
        setZoom(stage.scaleX() + ZOOM_STEP);
      });
    }
    if (btnOut) {
      btnOut.addEventListener("click", () => {
        setZoom(stage.scaleX() - ZOOM_STEP);
      });
    }
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        setZoom(1);
      });
    }
  }

  // Clear canvas
  function hookClearButton() {
    const clearBtn = document.getElementById("sb-clear");
    if (!clearBtn) return;

    clearBtn.addEventListener("click", () => {
      if (!window.confirm("Clear the entire layout? This cannot be undone.")) {
        return;
      }
      mapLayer.destroyChildren();
      clearSelection();
      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
    });
  }

  // Undo / Redo buttons
  function hookUndoRedoButtons() {
    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");

    if (undoBtn) undoBtn.addEventListener("click", undo);
    if (redoBtn) redoBtn.addEventListener("click", redo);
  }

  // Tool buttons
  function hookToolButtons() {
    document.querySelectorAll(".tool-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        if (!tool) return;
        setActiveTool(tool);
      });
    });
  }

  // Save button
  function hookSaveButton() {
    const saveBtn = window.__TICKIN_SAVE_BUTTON__;
    if (!saveBtn) return;

    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
        const konvaJson = stage.toJSON();
        const body = {
          konvaJson,
          layoutType: initialLayoutKey,
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

        if (!res.ok) {
          throw new Error(`Save failed (${res.status})`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error saving seat map", err);
        window.alert("There was a problem saving this layout.");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save layout";
      }
    });
  }

  // ---------- Load existing layout (if any) ----------

  async function loadExistingLayout() {
    try {
      const res = await fetch(
        `/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}`
      );
      if (!res.ok) return;

      const data = await res.json();
      const active = data && data.activeSeatMap;
      const konvaJson = active && active.layout && active.layout.konvaJson;

      if (!konvaJson) {
        pushHistory(); // empty base state
        updateSeatCount();
        return;
      }

      // konvaJson may be either a Stage or Layer; we expect Stage JSON
      let parsed;
      try {
        parsed =
          typeof konvaJson === "string" ? JSON.parse(konvaJson) : konvaJson;
      } catch {
        parsed = null;
      }

      if (!parsed) {
        pushHistory();
        updateSeatCount();
        return;
      }

      // Find layer with shapes inside parsed; we'll re-create only that layer.
      const tempStage = Konva.Node.create(parsed, container);
      const foundLayers = tempStage.getLayers();
      let sourceLayer = foundLayers[0];

      if (foundLayers.length > 1) {
        // attempt to pick the first layer with children
        const withChildren = foundLayers.find((l) => l.getChildren().length);
        if (withChildren) sourceLayer = withChildren;
      }

      const json = sourceLayer.toJSON();
      const restored = Konva.Node.create(json);

      mapLayer.destroy();
      mapLayer = restored;
      stage.add(mapLayer);

      mapLayer.getChildren().each((node) => attachNodeBehaviour(node));

      mapLayer.draw();
      updateSeatCount();

      // initialise history with this as base
      history = [mapLayer.toJSON()];
      historyIndex = 0;
      updateUndoRedoButtons();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error loading existing seat map", err);
      pushHistory(); // at least have initial state
      updateSeatCount();
    }
  }

  // ---------- Boot ----------

  initStage();
  hookToolButtons();
  hookZoomButtons();
  hookClearButton();
  hookUndoRedoButtons();
  hookSaveButton();

  stage.on("mousedown", handleStageClick);
  document.addEventListener("keydown", handleKeyDown);

  // first history entry + attempt to load existing
  loadExistingLayout();
})();
