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

  // ---------- NEW: Ensure sidebar DOM (seat count + inspector) ----------
  function ensureSidebarDom() {
    // If inspector already exists (from server-rendered HTML), do nothing
    if (document.getElementById("sb-inspector")) {
      return;
    }

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
    sidebarCol.style.borderLeft = "1px solid #e5e7eb";
    sidebarCol.style.padding = "12px 12px 12px 8px";
    sidebarCol.style.boxSizing = "border-box";
    sidebarCol.style.fontFamily =
      '-apple-system,BlinkMacSystemFont,"system-ui","Segoe UI",sans-serif';
    sidebarCol.style.fontSize = "13px";
    sidebarCol.style.color = "#111827";
    sidebarCol.style.backgroundColor = "#f9fafb";

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
               style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:8px;overflow:auto;height:100%;">
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
  const STAGE_PADDING = 40;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.4;
  const ZOOM_STEP = 0.1;

  // circular table geometry
  const CIRC_SEAT_RADIUS = 7;
  const CIRC_DESIRED_GAP = 8;
  const CIRC_MIN_TABLE_RADIUS = 24;

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

  // history is per-mapLayer JSON
  let history = [];
  let historyIndex = -1;
  let isRestoringHistory = false;

  // Sidebar DOM refs
  let seatCountEl = null;
  let inspectorEl = null;

  function getSeatCountElement() {
    if (!seatCountEl) {
      seatCountEl = document.getElementById("sb-seat-count");
    }
    return seatCountEl;
  }

  function getInspectorElement() {
    if (!inspectorEl) {
      inspectorEl = document.getElementById("sb-inspector");
    }
    return inspectorEl;
  }

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

    if (!mapLayer || !mapLayer.getStage()) return;

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

    circles.forEach((node) => {
      if (node && node.getAttr("isSeat")) seats += 1;
    });

    const el = getSeatCountElement();
    if (el) {
      el.textContent = seats === 1 ? "1 seat" : `${seats} seats`;
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

  function snap(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

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

  // Seat label helpers
  function makeSeatLabelText(text, x, y) {
    const label = new Konva.Text({
      x,
      y,
      text,
      fontSize: 10,
      fontFamily: "system-ui",
      fill: "#111827",
      align: "center",
      verticalAlign: "middle",
      listening: false,
      isSeatLabel: true,
    });

    // Rough centring – adjust after measuring
    label.offsetX(label.width() / 2);
    label.offsetY(label.height() / 2);
    return label;
  }

 // Excel-style row labels: 0 -> A, 25 -> Z, 26 -> AA, etc.
function rowLabelFromIndex(index) {
  let n = Math.max(0, Math.floor(index));
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

// Seat labels, with configurable start + mode
function seatLabelFromIndex(mode, index, start) {
  const base = Number.isFinite(start) ? start : 1; // e.g. 1 or 5
  const n = base + index;

  if (mode === "letters") {
    // 1 -> A, 2 -> B … using the same helper
    return rowLabelFromIndex(n - 1);
  }
  return String(n);
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
      name: "body-rect",
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
      name: "body-rect",
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
      name: "body-rect",
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

    const label = makeSeatLabelText("1", 0, 0);

    group.add(circle);
    group.add(label);
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

    const seatRadius = CIRC_SEAT_RADIUS;
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
      strokeWidth: 1.4,
      name: "body-rect",
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

      const label = makeSeatLabelText(String(i + 1), sx, sy);

      group.add(seat);
      group.add(label);
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
      name: "body-rect",
    });

    group.add(table);

    let seatIndex = 0;

    // long sides (top + bottom)
    for (let i = 0; i < longSideSeats; i += 1) {
      const sx =
        -width / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

      const topSeatY = -height / 2 - 10;
      const bottomSeatY = height / 2 + 10;

      const topSeat = new Konva.Circle({
        x: sx,
        y: topSeatY,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });
      const topLabel = makeSeatLabelText(String(++seatIndex), sx, topSeatY);

      const bottomSeat = new Konva.Circle({
        x: sx,
        y: bottomSeatY,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });
      const bottomLabel = makeSeatLabelText(
        String(++seatIndex),
        sx,
        bottomSeatY
      );

      group.add(topSeat);
      group.add(topLabel);
      group.add(bottomSeat);
      group.add(bottomLabel);
    }

    // short sides (left + right)
    for (let i = 0; i < shortSideSeats; i += 1) {
      const sy =
        -height / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

      const leftSeatX = -width / 2 - 10;
      const rightSeatX = width / 2 + 10;

      const leftSeat = new Konva.Circle({
        x: leftSeatX,
        y: sy,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });
      const leftLabel = makeSeatLabelText(
        String(++seatIndex),
        leftSeatX,
        sy
      );

      const rightSeat = new Konva.Circle({
        x: rightSeatX,
        y: sy,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });
      const rightLabel = makeSeatLabelText(
        String(++seatIndex),
        rightSeatX,
        sy
      );

      group.add(leftSeat);
      group.add(leftLabel);
      group.add(rightSeat);
      group.add(rightLabel);
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

  // Core configuration
  group.setAttr("seatsPerRow", seatsPerRow);
  group.setAttr("rowCount", rowCount);

  // Label + layout config (defaults)
  group.setAttr("seatLabelMode", "numbers");   // "numbers" | "letters"
  group.setAttr("seatStart", 1);               // seat numbers start at
  group.setAttr("rowLabelPrefix", "");         // e.g. "Row "
  group.setAttr("rowLabelStart", 0);           // 0 => A, 1 => B …

  group.setAttr("alignment", "center");        // "left" | "center" | "right"
  group.setAttr("curve", 0);                   // -10 .. 10
  group.setAttr("skew", 0);                    // -10 .. 10

  // Initial geometry build
  updateRowGroupGeometry(group, seatsPerRow, rowCount);

  return group;
}


  // ---------- Geometry updaters ----------

  function updateRowGroupGeometry(group, seatsPerRow, rowCount) {
  if (!(group instanceof Konva.Group)) return;

  seatsPerRow = Math.max(1, Math.floor(seatsPerRow));
  rowCount = Math.max(1, Math.floor(rowCount));

  group.setAttr("seatsPerRow", seatsPerRow);
  group.setAttr("rowCount", rowCount);

  const seatLabelMode = group.getAttr("seatLabelMode") || "numbers";
  const seatStart = group.getAttr("seatStart") || 1;
  const rowLabelPrefix = group.getAttr("rowLabelPrefix") || "";
  const rowLabelStart = group.getAttr("rowLabelStart") || 0;

  const alignment = group.getAttr("alignment") || "center"; // left / center / right
  const curve = group.getAttr("curve") || 0;                 // -10..10
  const skew = group.getAttr("skew") || 0;                   // -10..10

  // Wipe existing seats + labels
  group.getChildren().forEach((child) => {
    if (
      child.getAttr("isSeat") ||
      child.getAttr("isSeatLabel") ||
      child.getAttr("isRowLabel")
    ) {
      child.destroy();
    }
  });

  const spacing = 20;
  const seatRadius = 6;
  const rowSpacing = 20;

  const curveFactor = curve / 10; // -1 .. 1
  const skewFactor = skew / 10;   // -1 .. 1
  const centerIndex = (seatsPerRow - 1) / 2;

  function computeSeatX(i) {
    if (alignment === "left") {
      return i * spacing;
    }
    if (alignment === "right") {
      return -(seatsPerRow - 1) * spacing + i * spacing;
    }
    // center
    return (i - centerIndex) * spacing;
  }

  for (let r = 0; r < rowCount; r += 1) {
    const baseRowY = (r - (rowCount - 1) / 2) * rowSpacing;
    let rowMinX = Infinity;

    for (let i = 0; i < seatsPerRow; i += 1) {
      let sx = computeSeatX(i);

      // Curve: bend row into a shallow arc
      const offsetIndex = i - centerIndex;
      const curveOffset = curveFactor * offsetIndex * offsetIndex * 1.2;

      let rowY = baseRowY + curveOffset;

      // Skew: tilt block left/right based on row index
      sx += skewFactor * baseRowY;

      const seat = new Konva.Circle({
        x: sx,
        y: rowY,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      const labelText = seatLabelFromIndex(seatLabelMode, i, seatStart);
      const label = makeSeatLabelText(labelText, sx, rowY);

      group.add(seat);
      group.add(label);

      if (sx < rowMinX) rowMinX = sx;
    }

    // Row label (A, B, C…) down the left
    const rowLabelText =
      rowLabelPrefix + rowLabelFromIndex(rowLabelStart + r);

    if (rowLabelText) {
      const rowLabel = new Konva.Text({
        x: rowMinX - 18,
        y: baseRowY,
        text: rowLabelText,
        fontSize: 11,
        fontFamily: "system-ui",
        fill: "#4b5563",
        align: "right",
        verticalAlign: "middle",
        listening: false,
        isRowLabel: true,
      });

      rowLabel.offsetY(rowLabel.height() / 2);
      group.add(rowLabel);
    }
  }
}

  function updateCircularTableGeometry(group, seatCount) {
  if (!(group instanceof Konva.Group)) return;

  seatCount = Math.max(1, Math.floor(seatCount));
  group.setAttr("seatCount", seatCount);

  const table = getBodyRect(group);
  if (!table || !(table instanceof Konva.Circle)) return;

  // remove old seats + labels
  group.getChildren().forEach((child) => {
    if (child.getAttr("isSeat") || child.getAttr("isSeatLabel")) {
      child.destroy();
    }
  });

  const seatRadius = CIRC_SEAT_RADIUS;
  const desiredGap = CIRC_DESIRED_GAP;

  const circumferencePerSeat = seatRadius * 2 + desiredGap;
  const ringRadiusFromCirc =
    (seatCount * circumferencePerSeat) / (2 * Math.PI);

  const minRingRadius =
    CIRC_MIN_TABLE_RADIUS + seatRadius + desiredGap;

  const seatRingRadius = Math.max(ringRadiusFromCirc, minRingRadius);
  const tableRadius = seatRingRadius - seatRadius - desiredGap;

  table.radius(tableRadius);

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

    const label = makeSeatLabelText(String(i + 1), sx, sy);

    group.add(seat);
    group.add(label);
  }
}

function updateRectTableGeometry(group, longSideSeats, shortSideSeats) {
  if (!(group instanceof Konva.Group)) return;

  longSideSeats = Math.max(0, Math.floor(longSideSeats));
  shortSideSeats = Math.max(0, Math.floor(shortSideSeats));

  group.setAttr("longSideSeats", longSideSeats);
  group.setAttr("shortSideSeats", shortSideSeats);

  const table = getBodyRect(group);
  if (!table || !(table instanceof Konva.Rect)) return;

  // remove all current seats + labels
  group.getChildren().forEach((child) => {
    if (child.getAttr("isSeat") || child.getAttr("isSeatLabel")) {
      child.destroy();
    }
  });

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

  table.width(width);
  table.height(height);
  table.offsetX(width / 2);
  table.offsetY(height / 2);

  let seatIndex = 0;

  // long sides
  for (let i = 0; i < longSideSeats; i += 1) {
    const sx =
      -width / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

    const topY = -height / 2 - 10;
    const bottomY = height / 2 + 10;

    const topSeat = new Konva.Circle({
      x: sx,
      y: topY,
      radius: seatRadius,
      stroke: "#4b5563",
      strokeWidth: 1.3,
      isSeat: true,
    });
    const topLabel = makeSeatLabelText(String(++seatIndex), sx, topY);

    const bottomSeat = new Konva.Circle({
      x: sx,
      y: bottomY,
      radius: seatRadius,
      stroke: "#4b5563",
      strokeWidth: 1.3,
      isSeat: true,
    });
    const bottomLabel = makeSeatLabelText(String(++seatIndex), sx, bottomY);

    group.add(topSeat);
    group.add(topLabel);
    group.add(bottomSeat);
    group.add(bottomLabel);
  }

  // short sides
  for (let i = 0; i < shortSideSeats; i += 1) {
    const sy =
      -height / 2 + seatRadius * 2 + i * (seatRadius * 2 + seatGap);

    const leftX = -width / 2 - 10;
    const rightX = width / 2 + 10;

    const leftSeat = new Konva.Circle({
      x: leftX,
      y: sy,
      radius: seatRadius,
      stroke: "#4b5563",
      strokeWidth: 1.3,
      isSeat: true,
    });
    const leftLabel = makeSeatLabelText(String(++seatIndex), leftX, sy);

    const rightSeat = new Konva.Circle({
      x: rightX,
      y: sy,
      radius: seatRadius,
      stroke: "#4b5563",
      strokeWidth: 1.3,
      isSeat: true,
    });
    const rightLabel = makeSeatLabelText(String(++seatIndex), rightX, sy);

    group.add(leftSeat);
    group.add(leftLabel);
    group.add(rightSeat);
    group.add(rightLabel);
  }
}

  // ---------- Selection inspector (right-hand panel) ----------

    // ---------- Selection inspector (right-hand panel) ----------
  function renderInspector(node) {
    const el = getInspectorElement();
    if (!el) return;

    el.innerHTML = "";

    if (!node) {
      el.innerHTML =
        '<p class="sb-inspector-empty">Click a table, row or seat block to edit its settings.</p>';
      return;
    }

    const shapeType = node.getAttr("shapeType");
    const nodes = transformer ? transformer.nodes() : [];

    if (nodes && nodes.length > 1) {
      el.innerHTML = `<p class="sb-inspector-multi">${nodes.length} items selected. Drag to move them together.</p>`;
      return;
    }

    // ----- Helper builders for inspector fields -----

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

    // NEW: free-text field (for things like row label prefix, table name, etc.)
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

    // NEW: slider field (for curve / skew / etc.)
    function addRangeField(labelText, value, min, max, step, onCommit) {
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
      input.value = String(value);

      const valueLabel = document.createElement("span");
      valueLabel.style.fontSize = "11px";
      valueLabel.style.color = "#6b7280";
      valueLabel.textContent = String(value);

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


    // ---- Row blocks ----
if (shapeType === "row-seats") {
  const seatsPerRow = node.getAttr("seatsPerRow") || 10;
  const rowCount = node.getAttr("rowCount") || 1;
  const seatLabelMode = node.getAttr("seatLabelMode") || "numbers";
  const seatStart = node.getAttr("seatStart") || 1;
  const rowLabelPrefix = node.getAttr("rowLabelPrefix") || "";
  const rowLabelStart = node.getAttr("rowLabelStart") || 0;
  const alignment = node.getAttr("alignment") || "center";
  const curve = node.getAttr("curve") || 0;
  const skew = node.getAttr("skew") || 0;

  const totalSeats = seatsPerRow * rowCount;

  function rebuild() {
    const currentSeatsPerRow = node.getAttr("seatsPerRow") || seatsPerRow;
    const currentRowCount = node.getAttr("rowCount") || rowCount;
    updateRowGroupGeometry(node, currentSeatsPerRow, currentRowCount);
    mapLayer.batchDraw();
    updateSeatCount();
    pushHistory();
  }

  addTitle("Seat block");

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

  // First row letter A/B/C …
  const firstRowLetter = rowLabelFromIndex(rowLabelStart);
  const rowOptions = [];
  for (let i = 0; i < 26; i += 1) {
    rowOptions.push({
      value: String(i),
      label: rowLabelFromIndex(i),
    });
  }

  addSelectField(
    "First row letter",
    String(rowLabelStart),
    rowOptions,
    (val) => {
      const idx = parseInt(val, 10);
      node.setAttr("rowLabelStart", Number.isFinite(idx) ? idx : 0);
      rebuild();
    }
  );

  addSelectField(
    "Alignment",
    alignment,
    [
      { value: "center", label: "Centre" },
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
    (val) => {
      node.setAttr("alignment", val);
      rebuild();
    }
  );

  addRangeField("Curve rows", curve, -10, 10, 1, (val) => {
    node.setAttr("curve", val);
    rebuild();
  });

  addRangeField("Skew rows", skew, -10, 10, 1, (val) => {
    node.setAttr("skew", val);
    rebuild();
  });

  return;
}


    // ---- Circular tables ----
    if (shapeType === "circular-table") {
      const seatCount = node.getAttr("seatCount") || 8;

      addTitle("Round table");

      addNumberField("Seats around table", seatCount, 1, 1, (val) => {
        updateCircularTableGeometry(node, val);
      });

      addStaticRow(
        "Total seats at table",
        `${seatCount} seat${seatCount === 1 ? "" : "s"}`
      );

      return;
    }

    // ---- Rectangular tables ----
    if (shapeType === "rect-table") {
      const longSideSeats = node.getAttr("longSideSeats") ?? 4;
      const shortSideSeats = node.getAttr("shortSideSeats") ?? 2;
      const totalSeats = 2 * longSideSeats + 2 * shortSideSeats;

      addTitle("Rectangular table");

      addNumberField(
        "Seats on long side",
        longSideSeats,
        0,
        1,
        (val) => {
          const currentShort = node.getAttr("shortSideSeats") ?? shortSideSeats;
          updateRectTableGeometry(node, val, currentShort);
        }
      );

      addNumberField(
        "Seats on short side",
        shortSideSeats,
        0,
        1,
        (val) => {
          const currentLong = node.getAttr("longSideSeats") ?? longSideSeats;
          updateRectTableGeometry(node, currentLong, val);
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
    p.textContent = "This element has no editable settings yet.";
    el.appendChild(p);
  }

  // expose inspector hook (debugging / future)
  window.renderSeatmapInspector = renderInspector;

  // ---------- Selection / transformer ----------

  function configureTransformerForNode(node) {
    if (!transformer || !node) return;

    const shapeType = node.getAttr("shapeType");

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

    node.on("mouseover", () => {
      stage.container().style.cursor = "grab";
    });

    node.on("mouseout", () => {
      stage.container().style.cursor = activeTool ? "crosshair" : "default";
    });

    node.on("mousedown", (e) => {
      e.cancelBubble = true;

      const nodes = transformer ? transformer.nodes() : [];
      const alreadySelected = nodes.includes(node);
      const shift = !!(e.evt && e.evt.shiftKey);

      if (shift) {
        selectNode(node, true);
      } else if (!alreadySelected) {
        selectNode(node, false);
      }
    });

    node.on("dragstart", () => {
      const nodes = transformer ? transformer.nodes() : [];
      if (!nodes.length) {
        selectNode(node, false);
      }
      lastDragPos = { x: node.x(), y: node.y() };
    });

    node.on("dragmove", () => {
      const nodes = transformer ? transformer.nodes() : [];
      if (!lastDragPos) {
        lastDragPos = { x: node.x(), y: node.y() };
        return;
      }

      const dx = node.x() - lastDragPos.x;
      const dy = node.y() - lastDragPos.y;

      if (nodes.length > 1) {
        nodes.forEach((n) => {
          if (n === node) return;
          n.position({
            x: n.x() + dx,
            y: n.y() + dy,
          });
        });
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
      const shapeType = node.getAttr("shapeType");

      if (
        shapeType === "stage" ||
        shapeType === "bar" ||
        shapeType === "exit"
      ) {
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        const rect = getBodyRect(node);
        const label = node.findOne("Text");

        if (rect) {
          rect.width(rect.width() * scaleX);
          rect.height(rect.height() * scaleY);

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

        node.scale({ x: 1, y: 1 });
      } else {
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
          "How many rows in this block?",
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

    if (!clickedOnEmpty) return;

    if (!activeTool) {
      clearSelection();
      return;
    }

    // Try to use the pointer position, but fall back to centre of stage.
    let pos = mapLayer.getRelativePointerPosition();

    if (!pos && stage) {
      pos = { x: stage.width() / 2, y: stage.height() / 2 };
    }

    // For now, always create row blocks in the centre – avoids the
    // “top-right off screen” bug and makes them easy to grab.
    if (activeTool === "row" && stage) {
      pos = { x: stage.width() / 2, y: stage.height() / 2 };
    }

    if (!pos) return;

    const node = createNodeForTool(activeTool, pos);
    if (!node) return;

    mapLayer.add(node);
    attachNodeBehaviour(node);
    mapLayer.batchDraw();
    updateSeatCount();
    selectNode(node);
    pushHistory();
  }


  function handleKeyDown(e) {
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

  stage.on("mousedown", handleStageClick);
  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", resizeStageToContainer);

  resizeStageToContainer();
  loadExistingLayout();

  renderInspector(null);
})();
