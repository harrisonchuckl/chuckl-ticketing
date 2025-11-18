// TickIn seating builder – square grid, drag / rotate, per-action undo
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
  const GRID_SIZE = 32; // perfect square grid
  const STAGE_PADDING = 40;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.4;
  const ZOOM_STEP = 0.1;
  const SEAT_RADIUS = 6;
  const SEAT_GAP = 4; // minimum clear gap between seats

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
    if (!mapLayer || !mapLayer.find) return;

    const circles = mapLayer.find("Circle");
    let seats = 0;

    for (let i = 0; i < circles.length; i += 1) {
      const node = circles[i];
      if (node && node.getAttr("isSeat")) seats += 1;
    }

    if (seatCountEl) {
      seatCountEl.textContent = seats === 1 ? "1 seat" : `${seats} seats`;
    }
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
    const rect = container.getBoundingClientRect();
    const usableWidth = Math.max(200, rect.width - STAGE_PADDING * 2);
    const usableHeight = Math.max(200, rect.height - STAGE_PADDING * 2);

    const currentScale = stage.scaleX() || 1;

    // Make the *scaled* stage fill the usable area so the grid always fills
    stage.width(usableWidth / currentScale);
    stage.height(usableHeight / currentScale);

    stage.position({
      x: STAGE_PADDING,
      y: STAGE_PADDING,
    });

    drawSquareGrid();
    stage.batchDraw();
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
    mapLayer.getChildren().forEach((node) => {
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

  function configureTransformerForNode(node) {
    if (!transformer || !node) return;

    const shapeType = node.getAttr("shapeType");

    // Seating elements: rotate only, no resize
    if (
      shapeType === "row-seats" ||
      shapeType === "single-seat" ||
      shapeType === "circular-table" ||
      shapeType === "rect-table"
    ) {
      transformer.rotateEnabled(true);
      transformer.enabledAnchors([]); // rotation handle only
      return;
    }

    // Non-seating elements – Stage / Bar / Exit are resizable horizontally
    if (shapeType === "stage" || shapeType === "bar" || shapeType === "exit") {
      transformer.rotateEnabled(false);
      transformer.enabledAnchors(["middle-left", "middle-right"]);
      return;
    }

    // Everything else (section / text label): no resize, no rotate
    transformer.rotateEnabled(false);
    transformer.enabledAnchors([]);
  }

  function clearSelection() {
    selectedNode = null;
    if (transformer) {
      transformer.nodes([]);
      overlayLayer.draw();
    }
    if (typeof window.renderSeatmapInspector === "function") {
      window.renderSeatmapInspector(null);
    }
  }

  function selectNode(node) {
    selectedNode = node;
    configureTransformerForNode(node);
    transformer.nodes([node]);
    overlayLayer.draw();

    if (typeof window.renderSeatmapInspector === "function") {
      window.renderSeatmapInspector(node);
    }
  }

  // ---------- Shape helpers ----------

  function snap(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

  // Dynamic circular table geometry so seats never overlap
  function buildCircularTableContent(group) {
    const seatCount = group.getAttr("seatCount") || 8;

    group.destroyChildren();

    const seatRadius = SEAT_RADIUS;
    const minTableRadius = 18;
    const seatRingOffset = 12;

    const minArc = 2 * seatRadius + SEAT_GAP;
    const requiredCircumference = minArc * seatCount;
    const requiredRadius = requiredCircumference / (2 * Math.PI);
    const tableRadius = Math.max(minTableRadius, requiredRadius - seatRingOffset);
    const seatRingRadius = tableRadius + seatRingOffset;

    const table = new Konva.Circle({
      radius: tableRadius,
      stroke: "#4b5563",
      strokeWidth: 1.4,
    });
    group.add(table);

    for (let i = 0; i < seatCount; i += 1) {
      const angle = (i / seatCount) * Math.PI * 2;
      const sx = Math.cos(angle) * seatRingRadius;
      const sy = Math.sin(angle) * seatRingRadius;
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
  }

  // Dynamic rectangular table geometry so seats don't squash / overlap
  function buildRectTableContent(group) {
    const longSideSeats = group.getAttr("longSideSeats") || 4;
    const shortSideSeats = group.getAttr("shortSideSeats") || 2;

    group.destroyChildren();

    const seatRadius = SEAT_RADIUS;
    const seatSpacing = 2 * seatRadius + SEAT_GAP;

    const baseWidth = 80;
    const baseHeight = 32;

    const width = Math.max(baseWidth, seatSpacing * (longSideSeats + 1));
    const height = Math.max(baseHeight, seatSpacing * (shortSideSeats + 1));

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

    // long sides (top + bottom)
    for (let i = 0; i < longSideSeats; i += 1) {
      const frac = (i + 1) / (longSideSeats + 1);
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

    // short sides (left + right)
    for (let i = 0; i < shortSideSeats; i += 1) {
      const frac = (i + 1) / (shortSideSeats + 1);
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
  }

  // Dynamic row-of-seats geometry (supports multiple rows)
  function buildRowOfSeatsContent(group) {
    const seatCount = group.getAttr("rowSeatCount") || 10;
    const rowCount = group.getAttr("rowCount") || 1;

    group.destroyChildren();

    const seatRadius = SEAT_RADIUS;
    const seatSpacing = 2 * seatRadius + SEAT_GAP;
    const rowSpacing = seatSpacing + 6;

    for (let row = 0; row < rowCount; row += 1) {
      const y = (row - (rowCount - 1) / 2) * rowSpacing;

      for (let i = 0; i < seatCount; i += 1) {
        const x = (i - (seatCount - 1) / 2) * seatSpacing;
        const seat = new Konva.Circle({
          x,
          y,
          radius: seatRadius,
          stroke: "#4b5563",
          strokeWidth: 1.3,
          isSeat: true,
        });
        group.add(seat);
      }
    }
  }

  // ---------- Shape factories ----------

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
      x: snap(x) - 120,
      y: snap(y) - 26,
      draggable: true,
      name: "stage",
      shapeType: "stage",
    });

    const width = 240;
    const height = 52;

    const rect = new Konva.Rect({
      width,
      height,
      cornerRadius: 12,
      stroke: "#111827",
      strokeWidth: 1.7,
      fillLinearGradientStartPoint: { x: -width / 2, y: 0 },
      fillLinearGradientEndPoint: { x: width / 2, y: 0 },
      fillLinearGradientColorStops: [0, "#0f6fff", 1, "#22c1c3"], // simple on-brand gradient
      offsetX: width / 2,
      offsetY: height / 2,
    });

    const label = new Konva.Text({
      text: "STAGE",
      fontSize: 18,
      fontStyle: "bold",
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width,
      height,
      fill: "#ffffff",
      offsetX: width / 2,
      offsetY: height / 2,
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

    const width = 140;
    const height = 36;

    const rect = new Konva.Rect({
      width,
      height,
      cornerRadius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.5,
      offsetX: width / 2,
      offsetY: height / 2,
    });

    const label = new Konva.Text({
      text: "BAR",
      fontSize: 14,
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width,
      height,
      fill: "#4b5563",
      offsetX: width / 2,
      offsetY: height / 2,
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

    const width = 100;
    const height = 36;

    const rect = new Konva.Rect({
      width,
      height,
      cornerRadius: 8,
      stroke: "#16a34a",
      strokeWidth: 1.6,
      offsetX: width / 2,
      offsetY: height / 2,
    });

    const label = new Konva.Text({
      text: "EXIT",
      fontSize: 14,
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width,
      height,
      fill: "#16a34a",
      offsetX: width / 2,
      offsetY: height / 2,
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
      radius: SEAT_RADIUS,
      stroke: "#4b5563",
      strokeWidth: 1.4,
      isSeat: true,
    });

    group.add(circle);
    return group;
  }

  function createCircularTable(x, y, seatCount = 8) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "circular-table",
      shapeType: "circular-table",
    });

    group.setAttr("seatCount", seatCount);
    buildCircularTableContent(group);
    return group;
  }

  function createRectTable(
    x,
    y,
    config = { longSideSeats: 4, shortSideSeats: 2 }
  ) {
    const { longSideSeats, shortSideSeats } = config;

    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "rect-table",
      shapeType: "rect-table",
    });

    group.setAttr("longSideSeats", longSideSeats);
    group.setAttr("shortSideSeats", shortSideSeats);

    buildRectTableContent(group);

    return group;
  }

  function createRowOfSeats(x, y, seatCount = 10, rowCount = 1) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "row-seats",
      shapeType: "row-seats",
    });

    group.setAttr("rowSeatCount", seatCount);
    group.setAttr("rowCount", rowCount);

    buildRowOfSeatsContent(group);

    return group;
  }

  // ---------- Behaviour attachment ----------

  function attachNodeBehaviour(node) {
    if (!(node instanceof Konva.Group)) return;

    const shapeType = node.getAttr("shapeType");

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
      const st = node.getAttr("shapeType");

      if (st === "stage" || st === "bar" || st === "exit") {
        const scaleX = node.scaleX();
        const rect = node.findOne("Rect");
        const label = node.findOne("Text");

        if (rect) {
          rect.width(rect.width() * scaleX);
        }
        if (label && rect) {
          label.width(rect.width());
          label.offsetX(rect.width() / 2);
        }

        node.scale({ x: 1, y: 1 });
      } else {
        // seating / other elements: we only want rotation – never scale
        node.scale({ x: 1, y: 1 });
      }

      mapLayer.batchDraw();
      pushHistory();
    });

    // Text label inline edit (double-click)
    if (shapeType === "text") {
      node.on("dblclick", () => {
        const textNode = node.findOne("Text");
        if (!textNode) return;
        const current = textNode.text();
        const next = window.prompt("Label text", current);
        if (next !== null) {
          textNode.text(next);
          mapLayer.batchDraw();
          pushHistory();
        }
      });
    }
  }

  function createNodeForTool(tool, pos) {
    const { x, y } = pos;

    switch (tool) {
      case "section":
        return createSectionBlock(x, y);

      case "row": {
        const seatRaw = window.prompt("How many seats in each row?", "10");
        if (seatRaw === null) return null;
        const seatCount = Math.max(1, Number.parseInt(seatRaw, 10) || 10);

        const rowRaw = window.prompt("How many rows in this section?", "1");
        if (rowRaw === null) return null;
        const rowCount = Math.max(1, Number.parseInt(rowRaw, 10) || 1);

        return createRowOfSeats(x, y, seatCount, rowCount);
      }

      case "single":
        return createSingleSeat(x, y);

      case "circle-table": {
        const raw = window.prompt(
          "How many seats around this table?",
          "8"
        );
        if (raw === null) return null;
        const seatCount = Math.max(1, Number.parseInt(raw, 10) || 8);
        return createCircularTable(x, y, seatCount);
      }

      case "rect-table": {
        const raw = window.prompt(
          "How many seats on the long and short sides? (e.g. 4x2)",
          "4x2"
        );
        if (raw === null) return null;

        let longSideSeats = 4;
        let shortSideSeats = 2;

        const cleaned = String(raw).toLowerCase().replace(/\s+/g, "");
        const parts = cleaned.split(/x|,|:/);
        if (parts.length >= 2) {
          longSideSeats = Math.max(0, Number.parseInt(parts[0], 10) || 4);
          shortSideSeats = Math.max(0, Number.parseInt(parts[1], 10) || 2);
        }

        return createRectTable(x, y, { longSideSeats, shortSideSeats });
      }

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
    // initial size – will be adjusted by resizeStageToContainer()
    stage = new Konva.Stage({
      container: "app",
      width: 800,
      height: 600,
    });

    // Clean base background – remove any CSS grid image underneath
    const domContainer = stage.container();
    domContainer.style.backgroundImage = "none";
    domContainer.style.backgroundColor = "#f9fafb";

    gridLayer = new Konva.Layer({ listening: false });
    mapLayer = new Konva.Layer();
    overlayLayer = new Konva.Layer();

    stage.add(gridLayer);
    stage.add(mapLayer);
    stage.add(overlayLayer);

    transformer = new Konva.Transformer({
      rotateEnabled: true,
      enabledAnchors: [],
      anchorSize: 7,
      borderStroke: "#2563eb",
      anchorStroke: "#2563eb",
      anchorFill: "#ffffff",
      anchorStrokeWidth: 1.2,
      borderStrokeWidth: 1.2,
    });
    overlayLayer.add(transformer);

    resizeStageToContainer();
  }

  // ---------- Canvas interactions ----------

  function handleStageClick(evt) {
    const clickedOnEmpty =
      evt.target === stage || evt.target.getParent() === gridLayer;

    // If clicked on existing node, let the node's own handlers deal with it
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

    stage.scale({ x: clamped, y: clamped });

    // Ensure the scaled stage still fills the container, then redraw grid
    resizeStageToContainer();

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
      if (!res.ok) {
        pushHistory(); // empty base
        updateSeatCount();
        return;
      }

      const data = await res.json();
      const active = data && data.activeSeatMap;
      const konvaJson = active && active.layout && active.layout.konvaJson;

      if (!konvaJson) {
        pushHistory(); // empty base state
        updateSeatCount();
        return;
      }

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

      const tempStage = Konva.Node.create(parsed, container);
      const foundLayers = tempStage.getLayers();
      let sourceLayer = foundLayers[0];

      if (foundLayers.length > 1) {
        const withChildren = foundLayers.find((l) => l.getChildren().length);
        if (withChildren) sourceLayer = withChildren;
      }

      const json = sourceLayer.toJSON();
      const restored = Konva.Node.create(json);

      mapLayer.destroy();
      mapLayer = restored;
      stage.add(mapLayer);

      mapLayer.getChildren().forEach((node) => attachNodeBehaviour(node));

      mapLayer.draw();
      updateSeatCount();

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
  window.addEventListener("resize", resizeStageToContainer);

  // first history entry + attempt to load existing
  loadExistingLayout();
})();
