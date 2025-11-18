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
  const SEAT_MIN_GAP = 4; // minimum gap between seat edges

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
    const width = container.clientWidth - STAGE_PADDING * 2;
    const height = container.clientHeight - STAGE_PADDING * 2;
    stage.size({ width, height });
    drawSquareGrid();
  }

  // ---------- History ----------

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");

    if (undoBtn) {
      const canUndo = historyIndex > 0;
      undoBtn.disabled = !canUndo;
      undoBtn.style.opacity = canUndo ? 1 : 0.4;
    }
    if (redoBtn) {
      const canRedo = historyIndex < history.length - 1;
      redoBtn.disabled = !canRedo;
      redoBtn.style.opacity = canRedo ? 1 : 0.4;
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

  function reattachBehaviourToLayer(layer) {
    if (!layer) return;
    const children = layer.getChildren ? layer.getChildren() : [];
    children.forEach((node) => {
      attachNodeBehaviour(node);
    });
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
    overlayLayer.moveToTop();

    reattachBehaviourToLayer(mapLayer);

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

    // Non-seating elements – Stage, Bar/Kiosk, Exit resizable horizontally
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
    // If you have a custom inspector, call it with null:
    if (typeof window.renderSeatmapInspector === "function") {
      window.renderSeatmapInspector(null);
    }
  }

  function selectNode(node) {
    selectedNode = node;
    configureTransformerForNode(node);
    transformer.nodes(node ? [node] : []);
    overlayLayer.draw();

    // Hook for the inspector panel (existing implementation kept)
    if (typeof window.renderSeatmapInspector === "function") {
      window.renderSeatmapInspector(node || null);
    }
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
      stroke: "#0f172a",
      strokeWidth: 1.7,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 200, y: 0 },
      fillLinearGradientColorStops: [0, "#0f172a", 1, "#1d4ed8"],
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
      fill: "#f9fafb",
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

  function createCircularTable(x, y, seatCount = 8) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "circular-table",
      shapeType: "circular-table",
    });

    group.setAttr("seatCount", seatCount);

    const seatRadius = 7;
    const baseTableRadius = 24;
    const minCenterGap = 2 * seatRadius + SEAT_MIN_GAP;

    // ensure no overlap: 2R sin(pi/n) >= minCenterGap
    const angle = Math.PI / seatCount;
    const requiredR =
      angle > 0 ? minCenterGap / (2 * Math.sin(angle)) : baseTableRadius;
    const tableRadius = Math.max(baseTableRadius, requiredR);

    const table = new Konva.Circle({
      radius: tableRadius,
      stroke: "#4b5563",
      strokeWidth: 1.4,
    });

    group.add(table);

    const seatRingRadius = tableRadius + seatRadius + 4;

    for (let i = 0; i < seatCount; i += 1) {
      const a = (i / seatCount) * Math.PI * 2;
      const sx = Math.cos(a) * seatRingRadius;
      const sy = Math.sin(a) * seatRingRadius;
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

    const seatRadius = 6;
    const minGap = SEAT_MIN_GAP;

    // scale table so seats along each side don't overlap
    const baseWidth = 80;
    const baseHeight = 32;

    const width = Math.max(
      baseWidth,
      (longSideSeats + 1) * (2 * seatRadius + minGap)
    );
    const height = Math.max(
      baseHeight,
      (shortSideSeats + 1) * (2 * seatRadius + minGap)
    );

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
        y: -height / 2 - seatRadius - 4,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      const bottomSeat = new Konva.Circle({
        x: sx,
        y: height / 2 + seatRadius + 4,
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
        x: -width / 2 - seatRadius + -4,
        y: sy,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      const rightSeat = new Konva.Circle({
        x: width / 2 + seatRadius + 4,
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

    const spacing = 20;
    const rowSpacing = 24;
    const seatRadius = 6;

    for (let r = 0; r < rowCount; r += 1) {
      const ry = (r - (rowCount - 1) / 2) * rowSpacing;

      for (let i = 0; i < seatCount; i += 1) {
        const sx = (i - (seatCount - 1) / 2) * spacing;
        const seat = new Konva.Circle({
          x: sx,
          y: ry,
          radius: seatRadius,
          stroke: "#4b5563",
          strokeWidth: 1.3,
          isSeat: true,
        });
        group.add(seat);
      }
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

    // double-click text labels to edit
    node.on("dblclick dbltap", () => {
      const shapeType = node.getAttr("shapeType");
      if (shapeType !== "text") return;

      const textNode = node.findOne("Text");
      if (!textNode) return;

      const current = textNode.text();
      const next = window.prompt("Edit label text:", current);
      if (next === null) return;

      const trimmed = String(next).trim();
      if (trimmed) {
        textNode.text(trimmed);
        mapLayer.batchDraw();
        pushHistory();
      }
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
      const shapeType = node.getAttr("shapeType");

      // For Stage, Bar and Exit, convert scale into width only (keep label neat)
      if (shapeType === "stage" || shapeType === "bar" || shapeType === "exit") {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        const rect = node.findOne("Rect");
        const label = node.findOne("Text");

        if (rect) {
          rect.width(rect.width() * scaleX);
          rect.height(rect.height() * scaleY);

          // keep gradient aligned with width
          if (shapeType === "stage") {
            rect.fillLinearGradientEndPoint({
              x: rect.width(),
              y: 0,
            });
          }
        }
        if (label && rect) {
          label.width(rect.width());
          label.height(rect.height());
        }

        // reset group scale so text doesn't stretch
        node.scale({ x: 1, y: 1 });
      } else {
        // For seating / other elements, we only want rotation – never scale
        node.scale({ x: 1, y: 1 });
      }

      mapLayer.batchDraw();
      pushHistory();
    });
  }

  function createNodeForTool(tool, pos) {
    const { x, y } = pos;

    if (tool === "row") {
      const seatsInput = window.prompt(
        "How many seats in each row?",
        "10"
      );
      if (seatsInput === null) return null;
      const seatCount = Math.max(
        1,
        parseInt(seatsInput, 10) || 10
      );

      const rowsInput = window.prompt(
        "How many rows in this block?",
        "1"
      );
      if (rowsInput === null) return null;
      const rowCount = Math.max(
        1,
        parseInt(rowsInput, 10) || 1
      );

      return createRowOfSeats(x, y, seatCount, rowCount);
    }

    if (tool === "circle-table") {
      const input = window.prompt(
        "How many seats around the table?",
        "8"
      );
      if (input === null) return null;
      const seatCount = Math.max(1, parseInt(input, 10) || 8);
      return createCircularTable(x, y, seatCount);
    }

    if (tool === "rect-table") {
      const input = window.prompt(
        "How many seats on the long side and short side? (e.g. 4x2 or 4,2)",
        "4x2"
      );
      if (input === null) return null;

      let cleaned = String(input).toLowerCase().replace(" ", "");
      cleaned = cleaned.replace("x", ",");
      const parts = cleaned.split(",");

      let longSideSeats = parseInt(parts[0], 10);
      let shortSideSeats = parseInt(parts[1], 10);

      if (!Number.isFinite(longSideSeats) || longSideSeats <= 0) {
        longSideSeats = 4;
      }
      if (!Number.isFinite(shortSideSeats) || shortSideSeats <= 0) {
        shortSideSeats = 2;
      }

      return createRectTable(x, y, { longSideSeats, shortSideSeats });
    }

    switch (tool) {
      case "section":
        return createSectionBlock(x, y);
      case "single":
        return createSingleSeat(x, y);
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

    drawSquareGrid();

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
      overlayLayer.moveToTop();

      reattachBehaviourToLayer(mapLayer);

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
  window.addEventListener("resize", resizeStageToContainer);

  // initial resize + first history entry + attempt to load existing
  resizeStageToContainer();
  loadExistingLayout();
})();
