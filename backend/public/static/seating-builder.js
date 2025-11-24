// TixAll seating builder – square grid, drag / rotate, per-action undo
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
    `;
    document.head.appendChild(style);
  }

  injectSeatmapStyles();

  // ---------- Ensure sidebar DOM (seat count + inspector) ----------

  function ensureSidebarDom() {
    if (document.getElementById("sb-inspector")) return;

    const parent = container.parentNode;
    if (!parent) return;

    const wrapper = document.createElement("div");
    wrapper.className = "sb-layout";
    wrapper.style.display = "flex";
    wrapper.style.gap = "16px";
    wrapper.style.height = "100%";
    wrapper.style.boxSizing = "border-box";

    parent.replaceChild(wrapper, container);

    const canvasCol = document.createElement("div");
    canvasCol.className = "sb-canvas-col";
    canvasCol.style.flex = "1 1 auto";
    canvasCol.style.minWidth = "0";
    canvasCol.appendChild(container);

    const sidebarCol = document.createElement("aside");
    sidebarCol.className = "sb-sidebar-col";
    sidebarCol.style.width = "260px";
    sidebarCol.style.flex = "0 0 260px";
    sidebarCol.style.padding = "12px 12px 12px 8px";
    sidebarCol.style.boxSizing = "border-box";

    sidebarCol.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:100%;">
        <div>
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px;">
            Total seats
          </div>
          <div id="sb-seat-count" style="font-size:14px;font-weight:600;color:#111827;">
            0 seats
          </div>
        </div>

        <div style="flex:1 1 auto;min-height:0;">
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px;">
            Selection
          </div>
          <div id="sb-inspector"
               style="overflow:auto;height:100%;">
          </div>
        </div>
      </div>
    `;

    wrapper.appendChild(canvasCol);
    wrapper.appendChild(sidebarCol);
  }

  ensureSidebarDom();

  // ---------- Config ----------

  const GRID_SIZE = 32;
  const STAGE_PADDING = 0;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.4;
  const ZOOM_STEP = 0.1;

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

  let activeTool = null;
  let selectedNode = null;
  let copiedNodesJson = [];

  let lastDragPos = null;

  // Line drawing state (for the new Line tool)
  let currentLineGroup = null;    // Konva.Group that contains the line + hit rect
  let currentLine = null;         // Konva.Line inside the group
  let currentLinePoints = [];     // [x1, y1, x2, y2, ...]

  // history is per-mapLayer JSON
  let history = [];
  let historyIndex = -1;
  let isRestoringHistory = false;

  // table numbering counter (for all circular + rectangular tables)
  let tableCounter = 1;

  // global default seat label mode for *new* blocks
  let globalSeatLabelMode = "none";

  // track shift key for robust multi-select
  let isShiftPressed = false;

  // prevent recursive dragmove events when multi-dragging
  let isSyncDragging = false;

  const DEBUG_SKEW = true;

  // Sidebar DOM refs
  let seatCountEl = null;
  let inspectorEl = null;

  function getSeatCountElement() {
    if (!seatCountEl) seatCountEl = document.getElementById("sb-seat-count");
    return seatCountEl;
  }

  function getInspectorElement() {
    if (!inspectorEl) inspectorEl = document.getElementById("sb-inspector");
    return inspectorEl;
  }

  // ---------- Helpers: UI / tools ----------

    function setActiveTool(tool) {
    // If we are leaving line mode and a line is mid-draw, finish it
    if (activeTool === "line" && tool !== "line" && currentLineGroup) {
      const commit = currentLinePoints && currentLinePoints.length >= 4;
      finishCurrentLine(commit);
    }

    if (activeTool === tool) {
      // Toggling the same tool off
      if (tool === "line" && currentLineGroup) {
        finishCurrentLine(true);
      }
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

    if (!mapLayer || !mapLayer.getStage()) return;

    if (!activeTool) {
      mapLayer.getStage().container().style.cursor = "default";
    } else {
      mapLayer.getStage().container().style.cursor =
        activeTool === "line" ? "crosshair" : "crosshair";
    }
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
    if (historyIndex <= 0) return;
    restoreHistory(historyIndex - 1);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    restoreHistory(historyIndex + 1);
  }

  // ---------- Shape helpers ----------

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
    }

    currentLineGroup = null;
    currentLine = null;
    currentLinePoints = [];

    if (mapLayer) {
      mapLayer.batchDraw();
      updateSeatCount();
      pushHistory();
    }
  }

  function handleLineClick(pointerPos) {
    if (!stage || !mapLayer) return;
    const x = snap(pointerPos.x);
    const y = snap(pointerPos.y);

    // First click: create a new group + line
    if (!currentLineGroup) {
      currentLineGroup = new Konva.Group({
        x: 0,
        y: 0,
        draggable: true,
        name: "line",
        shapeType: "line",
      });

      currentLine = new Konva.Line({
        points: [x, y, x, y], // placeholder second point
        stroke: "#111827",
        strokeWidth: 2,
        lineCap: "round",
        lineJoin: "round",
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

  function snap(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

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
      strokeWidth: 1.7,
      name: "body-rect",
      fill: "#ffffff",
    });

    group.add(rect);
    ensureHitRect(group);
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
      strokeWidth: 1.8,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 200, y: 0 },
      fillLinearGradientColorStops: [0, "#1d4ed8", 1, "#22c1c3"],
      name: "body-rect",
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
    ensureHitRect(group);
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
      strokeWidth: 1.7,
      name: "body-rect",
      fill: "#ffffff",
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
    ensureHitRect(group);
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
      strokeWidth: 1.8,
      name: "body-rect",
      fill: "#ffffff",
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
    ensureHitRect(group);
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
    ensureHitRect(group);

    group.on("dblclick", () => {
      const newText = window.prompt("Text for this label:", text.text());
      if (newText != null) {
        text.text(newText);
        ensureHitRect(group);
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

    group.add(circle);

    if (isLabelled) {
      const baseText = mode === "letters" ? "A" : "1";
      const label = makeSeatLabelText(baseText, 0, 0);
      group.add(label);
    }

    ensureHitRect(group);
    return group;
  }

  function nextTableLabel() {
    const label = String(tableCounter);
    tableCounter += 1;
    return label;
  }

  function createCircularTable(x, y, seatCount = 8) {
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "circular-table",
      shapeType: "circular-table",
    });

    const mode = globalSeatLabelMode || "numbers";

    group.setAttr("seatCount", seatCount);
    group.setAttr("seatLabelMode", mode);
    group.setAttr("seatStart", 1);
    group.setAttr("tableLabel", nextTableLabel());

    const seatRadius = SEAT_RADIUS;
    const desiredGap = CIRC_DESIRED_GAP;

    const circumferencePerSeat = seatRadius * 2 + desiredGap;
    const ringRadiusFromCirc =
      (seatCount * circumferencePerSeat) / (2 * Math.PI);

    const minRingRadius =
      CIRC_MIN_TABLE_RADIUS + seatRadius + desiredGap;

    const seatRingRadius = Math.max(ringRadiusFromCirc, minRingRadius);
    const tableRadius = seatRingRadius - seatRadius - desiredGap;

    const table = new Konva.Circle({
      radius: tableRadius,
      stroke: "#4b5563",
      strokeWidth: 1.8,
      fill: "#ffffff",
      name: "body-rect",
    });

    group.add(table);

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
        strokeWidth: 1.6,
        fill: seatFill,
        isSeat: true,
      });

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

    const mode = globalSeatLabelMode || "numbers";

    group.setAttr("longSideSeats", longSideSeats);
    group.setAttr("shortSideSeats", shortSideSeats);
    group.setAttr("seatLabelMode", mode);
    group.setAttr("seatStart", 1);
    group.setAttr("tableLabel", nextTableLabel());

    const seatRadius = SEAT_RADIUS;
    const seatGap = 6;

    const longSpan =
      longSideSeats > 0 ? (longSideSeats - 1) * (seatRadius * 2 + seatGap) : 0;
    const shortSpan =
      shortSideSeats > 0
        ? (shortSideSeats - 1) * (seatRadius * 2 + seatGap) : 0;

    const width = longSpan + seatRadius * 4;
    const height = shortSpan + seatRadius * 4;

    const table = new Konva.Rect({
      width,
      height,
      cornerRadius: 6,
      stroke: "#4b5563",
      strokeWidth: 1.8,
      fill: "#ffffff",
      offsetX: width / 2,
      offsetY: height / 2,
      name: "body-rect",
    });

    group.add(table);

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

    // long sides (top + bottom)
    for (let i = 0; i < longSideSeats; i += 1) {
      const sx =
        -width / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

      const topSeatY = -height / 2 - 14;
      const bottomSeatY = height / 2 + 14;

      const topSeat = new Konva.Circle({
        x: sx,
        y: topSeatY,
        radius: seatRadius,
        stroke: seatStroke,
        strokeWidth: 1.7,
        fill: seatFill,
        isSeat: true,
      });

      const bottomSeat = new Konva.Circle({
        x: sx,
        y: bottomSeatY,
        radius: seatRadius,
        stroke: seatStroke,
        strokeWidth: 1.7,
        fill: seatFill,
        isSeat: true,
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

        const topLabel = makeSeatLabelText(topText, sx, topSeatY);
        const bottomLabel = makeSeatLabelText(bottomText, sx, bottomSeatY);
        group.add(topLabel);
        group.add(bottomLabel);
      } else {
        seatIndex += 2;
      }
    }

    // short sides (left + right)
    for (let i = 0; i < shortSideSeats; i += 1) {
      const sy =
        -height / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

      const leftSeatX = -width / 2 - 14;
      const rightSeatX = width / 2 + 14;

      const leftSeat = new Konva.Circle({
        x: leftSeatX,
        y: sy,
        radius: seatRadius,
        stroke: seatStroke,
        strokeWidth: 1.7,
        fill: seatFill,
        isSeat: true,
      });
      const rightSeat = new Konva.Circle({
        x: rightSeatX,
        y: sy,
        radius: seatRadius,
        stroke: seatStroke,
        strokeWidth: 1.7,
        fill: seatFill,
        isSeat: true,
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

        const leftLabel = makeSeatLabelText(leftText, leftSeatX, sy);
        const rightLabel = makeSeatLabelText(rightText, rightSeatX, sy);
        group.add(leftLabel);
        group.add(rightLabel);
      } else {
        seatIndex += 2;
      }
    }

    ensureHitRect(group);
    return group;
  }

  // -------- Row of seats --------

  function createRowOfSeats(x, y, seatsPerRow = 10, rowCount = 1) {
    const snappedX = snap(x);
    const snappedY = snap(y);

    const group = new Konva.Group({
      x: snappedX,
      y: snappedY,
      draggable: true,
      name: "row-seats",
      shapeType: "row-seats",
    });

    // core config
    group.setAttr("seatsPerRow", seatsPerRow);
    group.setAttr("rowCount", rowCount);

    const mode = globalSeatLabelMode || "numbers";
    group.setAttr("seatLabelMode", mode);
    group.setAttr("seatStart", 1);
    group.setAttr("rowLabelPrefix", "");
    group.setAttr("rowLabelStart", 0);
    group.setAttr("rowLabelBothSides", false);

    group.setAttr("curve", 0);

    group.setAttr("rowOrder", "asc");

    updateRowGroupGeometry(group, seatsPerRow, rowCount);
    ensureHitRect(group);

    return group;
  }

  function updateRowGroupGeometry(group, seatsPerRow, rowCount) {
  if (!(group instanceof Konva.Group)) return;

  let s = Number(seatsPerRow);
  let r = Number(rowCount);
  if (!Number.isFinite(s) || s < 1) s = 1;
  if (!Number.isFinite(r) || r < 1) r = 1;

  seatsPerRow = Math.floor(s);
  rowCount = Math.floor(r);

  group.setAttr("seatsPerRow", seatsPerRow);
  group.setAttr("rowCount", rowCount);

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

  const rowLabelBothSides = !!group.getAttr("rowLabelBothSides");

  const alignmentRaw = group.getAttr("alignment") || "center";
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

  // clear existing seats + labels
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
  const centerIndex = (seatsPerRow - 1) / 2;

  function computeSeatX(i) {
    if (alignment === "left") {
      return i * spacing;
    }
    if (alignment === "right") {
      return -(seatsPerRow - 1) * spacing + i * spacing;
    }
    return (i - centerIndex) * spacing;
  }

  const isLabelled = seatLabelMode !== "none";
  const seatFill = isLabelled ? "#ffffff" : "#111827";
  const seatStroke = isLabelled ? "#4b5563" : "#111827";

  for (let rIdx = 0; rIdx < rowCount; rIdx += 1) {
    const baseRowY = rIdx * rowSpacing;

    let firstSeatX = null;
    let lastSeatX = null;

    for (let i = 0; i < seatsPerRow; i += 1) {
      let sx = computeSeatX(i);

      const offsetIndex = i - centerIndex;
      const curveOffset = curveFactor * offsetIndex * offsetIndex;
      const rowY = baseRowY + curveOffset;

      if (firstSeatX == null) {
        firstSeatX = sx;
      }
      lastSeatX = sx;

      if (!Number.isFinite(sx) || !Number.isFinite(rowY)) {
        // eslint-disable-next-line no-console
        console.error("❌ invalid seat position", {
          i,
          r: rIdx,
          sx,
          rowY,
          alignment,
          curve,
          centerIndex,
          seatsPerRow,
          rowCount,
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

      let labelText = "";
      if (seatLabelMode !== "none") {
        labelText = seatLabelFromIndex(seatLabelMode, i, seatStart);
      }

      group.add(seat);
      if (labelText) {
        const label = makeSeatLabelText(labelText, sx, rowY);
        group.add(label);
      }
    }

    const logicalRowIdx =
      rowOrder === "desc" ? rowCount - 1 - rIdx : rIdx;

    const rowLabelText =
      rowLabelPrefix + rowLabelFromIndex(rowLabelStart + logicalRowIdx);

    if (rowLabelText && firstSeatX != null) {
      const labelGap = seatRadius * 1.4;
      // 🔥 Use the *centre* of the row (baseRowY) instead of first seat Y
      const labelY = baseRowY;

      // left-hand label
      const leftLabel = new Konva.Text({
        text: rowLabelText,
        fontSize: 14,
        fontFamily: "system-ui",
        fontStyle: "bold",
        fill: "#111827",
        align: "right",
        verticalAlign: "middle",
        listening: false,
        isRowLabel: true,
      });

      leftLabel.position({
        x: firstSeatX - (seatRadius + labelGap),
        y: labelY,
      });
      leftLabel.offsetX(leftLabel.width());
      leftLabel.offsetY(leftLabel.height() / 2);
      group.add(leftLabel);

      if (rowLabelBothSides && lastSeatX != null) {
        const rightLabel = new Konva.Text({
          text: rowLabelText,
          fontSize: 14,
          fontFamily: "system-ui",
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          verticalAlign: "middle",
          listening: false,
          isRowLabel: true,
        });

        rightLabel.position({
          x: lastSeatX + (seatRadius + labelGap),
          y: labelY,
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

  // ---------- Selection inspector (right-hand panel) ----------

  function renderInspector(node) {
    const el = getInspectorElement();
    if (!el) return;

    el.innerHTML = "";

    function addTitle(text) {
      const h = document.createElement("h4");
      h.className = "sb-inspector-title";
      h.textContent = text;
      el.appendChild(h);
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
      input.min = String(min);
      input.step = String(step || 1);
      input.value = String(value);
      input.className = "sb-input";

      function commit() {
        const parsed = parseInt(input.value, 10);
        if (!Number.isFinite(parsed) || parsed < min) return;
        onCommit(parsed);
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      }

      input.addEventListener("change", commit);
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
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      });

      label.appendChild(span);
      label.appendChild(select);
      wrapper.appendChild(label);
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
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      });

      label.appendChild(input);
      label.appendChild(span);
      wrapper.appendChild(label);
      el.appendChild(wrapper);
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

    const shapeType = node.getAttr("shapeType") || node.name();

    const nodes = transformer ? transformer.nodes() : [];

    if (nodes && nodes.length > 1) {
      el.innerHTML = `<p class="sb-inspector-empty">${nodes.length} items selected. Drag to move them together.</p>`;
      return;
    }

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
      const rowLabelBothSides = !!node.getAttr("rowLabelBothSides");
      const rowOrder = node.getAttr("rowOrder") || "asc";

      const totalSeats = seatsPerRow * rowCount;

      function rebuild() {
        const currentSeatsPerRow =
          node.getAttr("seatsPerRow") || seatsPerRow;
        const currentRowCount = node.getAttr("rowCount") || rowCount;
        updateRowGroupGeometry(node, currentSeatsPerRow, currentRowCount);
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      }

      addTitle("Seat block");

      // rotation control (will now be kept in sync on transformend)
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

      addCheckboxField(
        "Row labels both sides",
        rowLabelBothSides,
        (checked) => {
          node.setAttr("rowLabelBothSides", checked);
          rebuild();
        }
      );

      addRangeField("Curve rows", curve, -15, 15, 1, (val) => {
        node.setAttr("curve", val);
        rebuild();
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

    // Fallback
    addTitle("Selection");
    const p = document.createElement("p");
    p.className = "sb-inspector-empty";
    p.textContent = "This element has no editable settings yet.";
    el.appendChild(p);
  }

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

    if (shapeType === "stage" || shapeType === "bar" || shapeType === "exit") {
      transformer.rotateEnabled(false);
      transformer.enabledAnchors(["middle-left", "middle-right"]);
      return;
    }

    transformer.rotateEnabled(false);
    transformer.enabledAnchors([]);
  }

  function clearSelection() {
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

    if (!transformer) {
      selectedNode = node;
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
      configureTransformerForNode(nodes[0]);
      renderInspector(nodes[0]);
    } else if (nodes.length > 1) {
      renderInspector(nodes[0]);
    } else {
      renderInspector(null);
    }
  }

  // ---------- Behaviour attachment ----------

  function attachNodeBehaviour(node) {
    if (!(node instanceof Konva.Group)) return;

    ensureHitRect(node);

    const shapeType = node.getAttr("shapeType") || node.name();
    node.on("click", (evt) => {
      const e = evt.evt || evt;
      const additive =
        isShiftPressed ||
        !!(e.shiftKey || e.metaKey || e.ctrlKey);

      // clicking a canvas element drops the left-hand tool
      activeTool = null;
      document
        .querySelectorAll(".tool-button")
        .forEach((btn) => btn.classList.remove("is-active"));
      stage.container().style.cursor = "default";

      selectNode(node, additive);
    });

    node.on("mouseover", () => {
      stage.container().style.cursor = "grab";
    });

    node.on("mouseout", () => {
      stage.container().style.cursor = activeTool ? "crosshair" : "default";
    });

    node.on("dragstart", () => {
      const nodes = transformer ? transformer.nodes() : [];
      if (!nodes.length) selectNode(node, false);
      lastDragPos = { x: node.x(), y: node.y() };
    });

        node.on("dragmove", () => {
      // avoid recursive dragmove calls when we move other nodes programmatically
      if (isSyncDragging) return;

      const nodes = transformer ? transformer.nodes() : [];
      if (!lastDragPos) {
        lastDragPos = { x: node.x(), y: node.y() };
        return;
      }

      const dx = node.x() - lastDragPos.x;
      const dy = node.y() - lastDragPos.y;

      if (nodes.length > 1) {
        isSyncDragging = true;
        nodes.forEach((n) => {
          if (n !== node) {
            n.position({ x: n.x() + dx, y: n.y() + dy });
          }
        });
        isSyncDragging = false;
      }

      lastDragPos = { x: node.x(), y: node.y() };
      mapLayer.batchDraw();
    });

        node.on("dragend", () => {
      const nodes = transformer ? transformer.nodes() : [node];
      nodes.forEach((n) => {
        n.position({
          x: snap(n.x()),
          y: snap(n.y()),
        });
      });

      lastDragPos = null;
      mapLayer.batchDraw();
      pushHistory();
    });

    node.on("transformend", () => {
      const tShape = node.getAttr("shapeType") || node.name();

      if (
        tShape === "stage" ||
        tShape === "bar" ||
        tShape === "exit"
      ) {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const rect = getBodyRect(node);
        const label = node.findOne("Text");

        if (rect) {
          rect.width(rect.width() * scaleX);
          rect.height(rect.height() * scaleY);

          if (tShape === "stage") {
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

        node.scale({ x: 1, y: 1 });
      } else {
        node.scale({ x: 1, y: 1 });
      }

      if (
        tShape === "row-seats" ||
        tShape === "circular-table" ||
        tShape === "rect-table"
      ) {
        keepLabelsUpright(node);
      }

      ensureHitRect(node);
      mapLayer.batchDraw();
      pushHistory();

      // keep the inspector in sync (Rotation deg, etc.)
      renderInspector(node);
    });

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

  // ---------- Node creation based on active tool ----------

  function createNodeForTool(tool, pos) {
    let pointerX = stage ? stage.width() / 2 : 0;
    let pointerY = stage ? stage.height() / 2 : 0;

    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      pointerX = pos.x;
      pointerY = pos.y;
    }

    switch (tool) {
      case "section":
        return createSectionBlock(pointerX, pointerY);

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
        if (seatCountStr == null) return null;
        const seatCount = parseInt(seatCountStr, 10);
        if (!Number.isFinite(seatCount) || seatCount <= 0) return null;
        return createCircularTable(pointerX, pointerY, seatCount);
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
        return createRectTable(pointerX, pointerY, {
          longSideSeats,
          shortSideSeats,
        });
      }

      case "stage":
        return createStage(pointerX, pointerY);

      case "bar":
        return createBar(pointerX, pointerY);

      case "exit":
        return createExit(pointerX, pointerY);

      case "text":
        return createTextLabel(pointerX, pointerY);

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

    const domContainer = stage.container();
    domContainer.style.backgroundImage = "none";
    domContainer.style.backgroundColor = "#f9fafb";

    gridLayer = new Konva.Layer({ listening: false });
    mapLayer = new Konva.Layer();
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
      anchorStroke: "#2563eb",
      anchorFill: "#ffffff",
      anchorStrokeWidth: 1.2,
      borderStrokeWidth: 1.2,
    });
    overlayLayer.add(transformer);
  }

  // ---------- Canvas interactions ----------

  function handleStageClick(evt) {
  if (!stage || !mapLayer) return;

  const target = evt.target;

  // Did we hit a group (seat block, table, stage, etc.) in the map layer?
  let group = null;
  if (target && typeof target.findAncestor === "function") {
    group = target.findAncestor("Group", true);
  }
  if (group && group.getLayer && group.getLayer() === mapLayer) {
    // Clicked a real object, so select it (and support shift / cmd multi-select)
    const e = evt.evt || evt;
    const additive =
      isShiftPressed || !!(e && (e.shiftKey || e.metaKey || e.ctrlKey));

    selectNode(group, additive);

    // Drop any placement tool so we don't accidentally place new stuff on click
    if (activeTool && activeTool !== "line") {
      setActiveTool(null);
    }

    return;
  }

  // Otherwise, did we click empty canvas?
  const clickedOnEmpty =
    target === stage || (target.getLayer && target.getLayer() === gridLayer);

  if (!clickedOnEmpty) return;

  // No tool active → just clear the selection
  if (!activeTool) {
    clearSelection();
    return;
  }

  const pointerPos = stage.getPointerPosition();
  if (!pointerPos) return;

  // Line tool has its own multi-click behaviour
  if (activeTool === "line") {
    handleLineClick(pointerPos);
    return;
  }

  // Any other tool = create a node at the click
  const node = createNodeForTool(activeTool, pointerPos);
  if (!node) return;

  mapLayer.add(node);
  attachNodeBehaviour(node);
  mapLayer.batchDraw();
  updateSeatCount();
  selectNode(node);
  pushHistory();
}


  function handleKeyDown(e) {
    // track shift for robust multi-select
    if (e.key === "Shift") {
      isShiftPressed = true;
    }

    const nodes = transformer ? transformer.nodes() : [];

    const tag =
      document.activeElement && document.activeElement.tagName
        ? document.activeElement.tagName.toLowerCase()
        : "";
    if (tag === "input" || tag === "textarea") return;

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

  // ---------- Buttons ----------

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
      const res = await fetch(
        `/admin/seating/builder/api/seatmaps/${encodeURIComponent(showId)}`
      );
      if (!res.ok) {
        pushHistory();
        updateSeatCount();
        return;
      }

      const data = await res.json();
      const active = data && data.activeSeatMap;
      const konvaJson = active && active.layout && active.layout.konvaJson;

      if (!konvaJson) {
        pushHistory();
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
      mapLayer.position({ x: 0, y: 0 });
      mapLayer.scale({ x: 1, y: 1 });
      stage.add(mapLayer);

      mapLayer.getChildren().forEach((node) => attachNodeBehaviour(node));

      mapLayer.draw();
      updateSeatCount();

      history = [mapLayer.toJSON()];
      historyIndex = 0;
      updateUndoRedoButtons();

      initTableCounterFromExisting();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error loading existing seat map", err);
      pushHistory();
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

stage.on("click", handleStageClick);

  // Double-click empty canvas to finish the current line
  stage.on("dblclick", (evt) => {
    if (activeTool !== "line" || !currentLineGroup) return;

    const target = evt.target;
    const clickedOnEmpty =
      target === stage || (target.getLayer && target.getLayer() === gridLayer);

    if (!clickedOnEmpty) return;

    finishCurrentLine(true);
  });

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", resizeStageToContainer);

  resizeStageToContainer();
  loadExistingLayout();

  renderInspector(null);
})();
