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
  const STAGE_PADDING = 40; // kept for future use if needed
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

  // history now uses undo / redo stacks of mapLayer JSON
  let undoStack = [];
  let redoStack = [];
  let isRestoringHistory = false;

  // Simple seat counter (you can wire this into the inspector later)
  const seatCountEl = document.getElementById("sb-seat-count");

  // Selection (inspector) panel
  let selectionPanelEl = document.getElementById("sb-selection-panel");

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

    // optional soft background
    const bg = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: "#ffffff",
    });
    gridLayer.add(bg);

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
    const width = container.clientWidth;
    const height = container.clientHeight;
    stage.size({ width, height });
    drawSquareGrid();
  }

  // ---------- History (undo / redo) ----------

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById("sb-undo");
    const redoBtn = document.getElementById("sb-redo");

    if (undoBtn) {
      undoBtn.disabled = undoStack.length === 0;
      undoBtn.style.opacity = undoStack.length === 0 ? 0.4 : 1;
    }
    if (redoBtn) {
      redoBtn.disabled = redoStack.length === 0;
      redoBtn.style.opacity = redoStack.length === 0 ? 0.4 : 1;
    }
  }

  function getSnapshot() {
    if (!mapLayer) return null;
    return mapLayer.toJSON();
  }

  function restoreSnapshot(json) {
    if (!json || !stage) return;

    isRestoringHistory = true;

    const restored = Konva.Node.create(json);
    if (mapLayer) {
      mapLayer.destroy();
    }
    mapLayer = restored;
    stage.add(mapLayer);

    // Re-attach behaviour to all top-level groups (tables, rows, etc.)
    mapLayer.getChildren().each((node) => {
      attachNodeBehaviour(node);
    });

    mapLayer.draw();
    updateSeatCount();
    clearSelection();

    isRestoringHistory = false;
  }

  function pushHistory() {
    if (isRestoringHistory || !mapLayer) return;

    const snapshot = getSnapshot();
    if (!snapshot) return;

    undoStack.push(snapshot);
    // any new action clears the redo stack
    redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;

    const current = getSnapshot();
    const prev = undoStack.pop();
    if (!prev) return;

    if (current) {
      redoStack.push(current);
    }

    restoreSnapshot(prev);
    updateUndoRedoButtons();
  }

  function redo() {
    if (redoStack.length === 0) return;

    const current = getSnapshot();
    const next = redoStack.pop();
    if (!next) return;

    if (current) {
      undoStack.push(current);
    }

    restoreSnapshot(next);
    updateUndoRedoButtons();
  }

  // ---------- Selection / transformer & inspector ----------

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

    // Non-seating elements – Stage, Bar and Exit are resizable
    if (
      shapeType === "stage" ||
      shapeType === "bar" ||
      shapeType === "exit"
    ) {
      transformer.rotateEnabled(false);
      transformer.enabledAnchors(["middle-left", "middle-right"]);
      return;
    }

    // Text / section and anything else: no resize, no rotate
    transformer.rotateEnabled(false);
    transformer.enabledAnchors([]);
  }

  function renderSeatmapInspector(node) {
    // element-specific inspector on the right-hand side
    if (!selectionPanelEl) {
      selectionPanelEl = document.getElementById("sb-selection-panel");
    }
    if (!selectionPanelEl) {
      return; // silently do nothing if the panel doesn't exist
    }

    if (!node) {
      selectionPanelEl.innerHTML =
        '<p class="sb-selection-empty">Nothing selected. Click on a seat, table or object to see details here.</p>';
      return;
    }

    const shapeType = node.getAttr("shapeType") || "unknown";

    // TEXT LABEL
    if (shapeType === "text") {
      const textNode = node.findOne("Text");
      if (!textNode) {
        selectionPanelEl.innerHTML =
          "<p>Text label selected, but no text node found.</p>";
        return;
      }

      const text = textNode.text();
      const fontSize = textNode.fontSize();
      const isBold = /bold|700/.test(textNode.fontStyle());
      const isItalic = /italic/.test(textNode.fontStyle());

      selectionPanelEl.innerHTML = `
        <div class="sb-field">
          <label>Text</label>
          <input id="sb-label-text" type="text" value="${text.replace(
            /"/g,
            "&quot;"
          )}" />
        </div>
        <div class="sb-field">
          <label>Font size</label>
          <input id="sb-label-size" type="number" min="8" max="64" value="${fontSize}" />
        </div>
        <div class="sb-field-row">
          <label>Style</label>
          <div class="sb-toggle-group">
            <button id="sb-label-bold" class="${
              isBold ? "active" : ""
            }"><b>B</b></button>
            <button id="sb-label-italic" class="${
              isItalic ? "active" : ""
            }"><i>I</i></button>
          </div>
        </div>
      `;

      const textInput = document.getElementById("sb-label-text");
      const sizeInput = document.getElementById("sb-label-size");
      const boldBtn = document.getElementById("sb-label-bold");
      const italicBtn = document.getElementById("sb-label-italic");

      if (textInput) {
        textInput.addEventListener("input", () => {
          textNode.text(textInput.value);
          mapLayer.batchDraw();
          pushHistory();
        });
      }

      if (sizeInput) {
        sizeInput.addEventListener("change", () => {
          const v = parseInt(sizeInput.value, 10) || fontSize;
          textNode.fontSize(v);
          mapLayer.batchDraw();
          pushHistory();
        });
      }

      if (boldBtn) {
        boldBtn.addEventListener("click", () => {
          const currentlyBold = /bold|700/.test(textNode.fontStyle());
          const italic = /italic/.test(textNode.fontStyle());
          textNode.fontStyle(
            `${currentlyBold ? "" : "bold"}${italic ? " italic" : ""}`.trim()
          );
          mapLayer.batchDraw();
          pushHistory();
          renderSeatmapInspector(node); // refresh button state
        });
      }

      if (italicBtn) {
        italicBtn.addEventListener("click", () => {
          const bold = /bold|700/.test(textNode.fontStyle());
          const currentlyItalic = /italic/.test(textNode.fontStyle());
          textNode.fontStyle(
            `${bold ? "bold" : ""} ${currentlyItalic ? "" : "italic"}`.trim()
          );
          mapLayer.batchDraw();
          pushHistory();
          renderSeatmapInspector(node);
        });
      }

      return;
    }

    // STAGE / EXIT – simple summary
    if (shapeType === "stage" || shapeType === "exit") {
      const rect = node.findOne("Rect");
      const width = rect ? rect.width() : 0;
      const height = rect ? rect.height() : 0;

      selectionPanelEl.innerHTML = `
        <p><strong>${
          shapeType === "stage" ? "Stage" : "Exit"
        }</strong></p>
        <p>Width: ${Math.round(width)}px<br/>Height: ${Math.round(
        height
      )}px</p>
        <p>Drag the side handles on the canvas to resize.</p>
      `;
      return;
    }

    // Seating groups – show seat count within the group
    if (
      shapeType === "row-seats" ||
      shapeType === "circular-table" ||
      shapeType === "rect-table"
    ) {
      const seats = node.find("Circle").filter((c) => c.getAttr("isSeat"))
        .length;
      selectionPanelEl.innerHTML = `
        <p><strong>${
          shapeType === "row-seats"
            ? "Row of seats"
            : shapeType === "circular-table"
            ? "Circular table"
            : "Rectangular table"
        }</strong></p>
        <p>Seats in this group: ${seats}</p>
        <p>Seat-count editing will live here in a later step.</p>
      `;
      return;
    }

    // Default / fallback
    selectionPanelEl.innerHTML = `
      <p><strong>Object type:</strong> ${shapeType}</p>
      <p>No additional controls for this element yet.</p>
    `;
  }

  function clearSelection() {
    selectedNode = null;
    if (transformer) {
      transformer.nodes([]);
      overlayLayer.draw();
    }
    renderSeatmapInspector(null);
  }

  function selectNode(node) {
    selectedNode = node;
    configureTransformerForNode(node);
    transformer.nodes([node]);
    overlayLayer.draw();
    renderSeatmapInspector(node);
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
      x: snap(x) - 120,
      y: snap(y) - 28,
      draggable: true,
      name: "stage",
      shapeType: "stage",
    });

    const rectWidth = 240;
    const rectHeight = 56;

    const rect = new Konva.Rect({
      name: "body",
      width: rectWidth,
      height: rectHeight,
      cornerRadius: 12,
      // modern gradient fill matching UI
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: rectWidth, y: 0 },
      fillLinearGradientColorStops: [
        0,
        "#0f172a",
        1,
        "#2563eb",
      ],
      stroke: "#0f172a",
      strokeWidth: 1.6,
    });

    const label = new Konva.Text({
      name: "label",
      text: "STAGE",
      fontSize: 18,
      fontStyle: "700",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      align: "center",
      verticalAlign: "middle",
      width: rectWidth,
      height: rectHeight,
      fill: "#ffffff",
      listening: false,
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
      name: "body",
      width: 140,
      height: 36,
      cornerRadius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.5,
    });

    const label = new Konva.Text({
      name: "label",
      text: "BAR",
      fontSize: 14,
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width: rect.width(),
      height: rect.height(),
      fill: "#4b5563",
      listening: false,
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

    const rectWidth = 100;
    const rectHeight = 36;

    const rect = new Konva.Rect({
      name: "body",
      width: rectWidth,
      height: rectHeight,
      cornerRadius: 8,
      stroke: "#16a34a",
      strokeWidth: 1.6,
    });

    const label = new Konva.Text({
      name: "label",
      text: "EXIT",
      fontSize: 14,
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width: rectWidth,
      height: rectHeight,
      fill: "#16a34a",
      listening: false,
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
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
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

    const tableRadius = 24;
    const seatRadius = 7;

    const table = new Konva.Circle({
      radius: tableRadius,
      stroke: "#4b5563",
      strokeWidth: 1.4,
    });

    group.add(table);

    for (let i = 0; i < seatCount; i += 1) {
      const angle = (i / seatCount) * Math.PI * 2;
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

    return group;
  }

  function createRowOfSeats(x, y, seatCount = 10) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "row-seats",
      shapeType: "row-seats",
    });

    group.setAttr("rowSeatCount", seatCount);

    const spacing = 20;
    const seatRadius = 6;

    for (let i = 0; i < seatCount; i += 1) {
      const sx = (i - (seatCount - 1) / 2) * spacing;
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

    // Double-click to edit text labels
    if (shapeType === "text") {
      node.on("dblclick dbltap", () => {
        const textNode = node.findOne("Text");
        if (!textNode) return;
        const currentText = textNode.text();
        const next = window.prompt("Edit label text:", currentText);
        if (next !== null) {
          textNode.text(next);
          mapLayer.batchDraw();
          pushHistory();
          renderSeatmapInspector(node);
        }
      });
    }

    node.on("transformend", () => {
      const st = node.getAttr("shapeType");

      // For Stage, Bar and Exit, convert scale into width/height only (keep label neat)
      if (st === "stage" || st === "bar" || st === "exit") {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        const rect = node.findOne("Rect[name=body]") || node.findOne("Rect");
        const label =
          node.findOne("Text[name=label]") || node.findOne("Text");

        if (rect) {
          rect.width(rect.width() * scaleX);
          rect.height(rect.height() * scaleY);
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
      renderSeatmapInspector(node);
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
    const width = container.clientWidth;
    const height = container.clientHeight;

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

    // keep grid responsive to window size
    window.addEventListener("resize", resizeStageToContainer);
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

    updateUndoRedoButtons();
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
        // no existing layout – just start with empty map
        undoStack = [];
        redoStack = [];
        pushHistory(); // base empty state
        updateSeatCount();
        return;
      }

      const data = await res.json();
      const active = data && data.activeSeatMap;
      const konvaJson = active && active.layout && active.layout.konvaJson;

      if (!konvaJson) {
        undoStack = [];
        redoStack = [];
        pushHistory(); // base empty state
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
        undoStack = [];
        redoStack = [];
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

      mapLayer.getChildren().each((node) => attachNodeBehaviour(node));

      mapLayer.draw();
      updateSeatCount();

      // initialise history with this as base
      undoStack = [];
      redoStack = [];
      pushHistory();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error loading existing seat map", err);
      undoStack = [];
      redoStack = [];
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

  // initial responsive resize
  resizeStageToContainer();

  // load existing (and set first history entry)
  loadExistingLayout();
})();
