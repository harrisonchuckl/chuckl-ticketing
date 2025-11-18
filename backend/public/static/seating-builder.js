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

  // ---------- State ----------
  let stage;
  let gridLayer;
  let mapLayer;
  let overlayLayer;
  let transformer;

  let activeTool = null; // "section" | "row" | "single" | "circle-table" | ...
  let selectedNode = null;
  let copiedNodesJson = [];

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
    if (!transformer) return;

    const shapeType = node && node.getAttr("shapeType");

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

    // Non-seating elements – only Stage + Bar/Kiosk are resizable
    if (shapeType === "stage" || shapeType === "bar") {
      transformer.rotateEnabled(false);
      transformer.enabledAnchors(["middle-left", "middle-right"]);
      return;
    }

    // Everything else (section / exit / text label): no resize, no rotate
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

  function selectNode(node, additive = false) {
    if (!transformer) return;

    let nodes = transformer.nodes();

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

    // expose "primary" node for older code
    selectedNode = nodes.length === 1 ? nodes[0] : null;

    if (typeof window.renderSeatmapInspector === "function") {
      window.renderSeatmapInspector(nodes[0] || null);
    }

    if (nodes[0]) {
      configureTransformerForNode(nodes[0]);
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
      cornerRadius: 12,
      stroke: "#0f172a",
      strokeWidth: 1.6,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 200, y: 0 },
      fillLinearGradientColorStops: [0, "#1d4ed8", 1, "#22c1c3"], // bluer fade
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
      fill: "#ffffff",
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
      draggable: false,
    });

    group.add(text);

    // allow inline editing on double-click
    group.on("dblclick", () => {
      const newText = window.prompt("Text for this label:", text.text());
      if (newText != null) {
        text.text(newText);
        mapLayer.batchDraw();
        pushHistory();
      }
    });

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
    const seatGap = 4; // gap between seats

    // radius at which seat centres sit so they don't overlap
    const centreSpacing = seatRadius * 2 + seatGap;
    const seatRingRadius = Math.max(
      32,
      (seatCount * centreSpacing) / (2 * Math.PI)
    );

    const tableRadius = Math.max(24, seatRingRadius - 14);

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
    const seatGap = 4;
    const longSpan =
      longSideSeats > 0 ? (longSideSeats - 1) * (seatRadius * 2 + seatGap) : 0;
    const shortSpan =
      shortSideSeats > 0
        ? (shortSideSeats - 1) * (seatRadius * 2 + seatGap)
        : 0;

    const width = longSpan + seatRadius * 4;
    const height = shortSpan + seatRadius * 4;

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
      const sx =
        -width / 2 +
        seatRadius * 2 +
        i * (seatRadius * 2 + seatGap);

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
      const sy =
        -height / 2 +
        seatRadius * 2 +
        i * (seatRadius * 2 + seatGap);

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

  function createRowOfSeats(x, y, seatsPerRow = 10, rowCount = 1) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "row-seats",
      shapeType: "row-seats",
    });

    group.setAttr("seatsPerRow", seatsPerRow);
    group.setAttr("rowCount", rowCount);

    const spacing = 20;
    const seatRadius = 6;
    const rowSpacing = 20;

    for (let r = 0; r < rowCount; r += 1) {
      const rowY = (r - (rowCount - 1) / 2) * rowSpacing;
      for (let i = 0; i < seatsPerRow; i += 1) {
        const sx = (i - (seatsPerRow - 1) / 2) * spacing;
        const seat = new Konva.Circle({
          x: sx,
          y: rowY,
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

  // ---------- Hit-area helper ----------

  function ensureHitRect(group) {
    if (!(group instanceof Konva.Group)) return;
    if (group.findOne(".hit-rect")) return;

    const bounds = group.getClientRect({ relativeTo: group });
    const padding = GRID_SIZE * 0.4;

    const hitRect = new Konva.Rect({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
      fill: "rgba(0,0,0,0)", // invisible but clickable
      listening: true,
      name: "hit-rect",
    });

    // send behind all other children
    group.add(hitRect);
    hitRect.moveToBottom();
  }

  // ---------- Behaviour attachment ----------

  function attachNodeBehaviour(node) {
    if (!(node instanceof Konva.Group)) return;

    // Make the whole bounding box clickable (not just the circles)
    ensureHitRect(node);

    node.on("mouseover", () => {
      stage.container().style.cursor = "grab";
    });

    node.on("mouseout", () => {
      stage.container().style.cursor = activeTool ? "crosshair" : "default";
    });

    node.on("mousedown", (e) => {
      // prevent background click from firing
      e.cancelBubble = true;
      const additive = !!(e.evt && e.evt.shiftKey);
      selectNode(node, additive);
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

      if (shapeType === "stage" || shapeType === "bar") {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        const rect = node.findOne("Rect");
        const label = node.findOne("Text");

        if (rect) {
          rect.width(rect.width() * scaleX);
          rect.height(rect.height() * scaleY);

          // keep stage gradient spanning full width
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
          label.x(rect.x());
          label.y(rect.y());
        }

        // reset group scale so text doesn't stretch
        node.scale({ x: 1, y: 1 });
      } else {
        // Seating / other elements – rotation only, no scaling
        node.scale({ x: 1, y: 1 });
      }

      mapLayer.batchDraw();
      pushHistory();
    });
  }

  function createNodeForTool(tool, pos) {
    const { x, y } = pos;

    switch (tool) {
      case "section":
        return createSectionBlock(x, y);

      case "row": {
        const seatsPerRowStr = window.prompt(
          "How many seats in each row?",
          "10"
        );
        if (seatsPerRowStr == null) return null;
        const seatsPerRow = parseInt(seatsPerRowStr, 10);
        if (!Number.isFinite(seatsPerRow) || seatsPerRow <= 0) return null;

        const rowCountStr = window.prompt(
          "How many rows in this section?",
          "1"
        );
        if (rowCountStr == null) return null;
        const rowCount = parseInt(rowCountStr, 10);
        if (!Number.isFinite(rowCount) || rowCount <= 0) return null;

        return createRowOfSeats(x, y, seatsPerRow, rowCount);
      }

      case "single":
        return createSingleSeat(x, y);

      case "circle-table": {
        const seatCountStr = window.prompt(
          "How many seats around this table?",
          "8"
        );
        if (seatCountStr == null) return null;
        const seatCount = parseInt(seatCountStr, 10);
        if (!Number.isFinite(seatCount) || seatCount <= 0) return null;
        return createCircularTable(x, y, seatCount);
      }

      case "rect-table": {
        const input = window.prompt(
          "Rectangular table – seats per long side, seats per short side (e.g. 4,2)",
          "4,2"
        );
        if (input == null) return null;
        const parts = input.split(",");
        if (parts.length !== 2) return null;
        const longSideSeats = parseInt(parts[0].trim(), 10);
        const shortSideSeats = parseInt(parts[1].trim(), 10);
        if (
          !Number.isFinite(longSideSeats) ||
          longSideSeats < 0 ||
          !Number.isFinite(shortSideSeats) ||
          shortSideSeats < 0
        ) {
          return null;
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
    const width = container.clientWidth - STAGE_PADDING * 2;
    const height = container.clientHeight - STAGE_PADDING * 2;

    stage = new Konva.Stage({
      container: "app",
      width,
      height,
    });

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

  // keyboard shortcuts (delete, copy, paste)
  function handleKeyDown(e) {
    const nodes = transformer ? transformer.nodes() : [];

    // ignore when typing in an input / textarea
    const tag =
      document.activeElement && document.activeElement.tagName
        ? document.activeElement.tagName.toLowerCase()
        : "";
    if (tag === "input" || tag === "textarea") return;

    // Delete
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

    // Copy
    if (
      (e.key === "c" || e.key === "C") &&
      (e.metaKey || e.ctrlKey)
    ) {
      if (!nodes.length) return;
      copiedNodesJson = nodes.map((n) => n.toJSON());
      e.preventDefault();
      return;
    }

    // Paste
    if (
      (e.key === "v" || e.key === "V") &&
      (e.metaKey || e.ctrlKey)
    ) {
      if (!copiedNodesJson.length) return;

      const newNodes = copiedNodesJson.map((json) => {
        const node = Konva.Node.create(json);
        node.x(node.x() + GRID_SIZE);
        node.y(node.y() + GRID_SIZE);
        mapLayer.add(node);
        attachNodeBehaviour(node);
        return node;
      });

      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
      selectNode(newNodes[0]);
      transformer.nodes(newNodes);
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

  resizeStageToContainer();
  loadExistingLayout();
})();
