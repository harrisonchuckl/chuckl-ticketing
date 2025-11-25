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

  let activeTool = null;
  let selectedNode = null;
  let copiedNodesJson = [];

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

  // global default seat label mode for *new* blocks
  // "numbers" = 1, 2, 3... by default during planning
  let globalSeatLabelMode = "numbers";

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

    const previousTool = activeTool;

    if (activeTool === tool) {
      // Toggling the same tool off
      if (tool === "line" && currentLineGroup && currentLineToolType === "line") {
        finishCurrentLine(true);
      } else if (
        tool === "curve-line" &&
        currentLineGroup &&
        currentLineToolType === "curve-line"
      ) {
        finishCurveLine(true);
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
      activeTool !== "arrow"
    ) {
      clearSelection();
    }

    if (!mapLayer || !mapLayer.getStage()) return;

    if (!activeTool) {
      mapLayer.getStage().container().style.cursor = "grab";
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

    // Only add a new point if we've moved at least ~3px
    if (distSq < 9) return;

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
      const smoothed = smoothCurvePoints(curveRawPoints, 4);
      currentLinePoints = smoothed.slice();

      if (currentLine) {
        currentLine.points(currentLinePoints);
        currentLine.tension(0.5);
      }

      ensureHitRect(currentLineGroup);
      buildLineHandles(currentLineGroup);
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

    showLineHandles(group, true);
    group.draw();
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

  // Shared styling for basic shapes (section / square / circle)
  function applyBasicShapeStyle(node) {
    if (!(node instanceof Konva.Group)) return;

    const shapeType = node.getAttr("shapeType") || node.name();
    if (
      shapeType !== "section" &&
      shapeType !== "square" &&
      shapeType !== "circle"
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
    // no snap: allow precise placement
    x: x - 100,
    y: y - 24,
    draggable: true,
    name: "stage",
    shapeType: "stage",
  });

  // Default stage styling attributes
  group.setAttr("stageLabel", "STAGE");

  // NEW DEFAULT: solid black background with white text
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

  function createSymbolNode(symbolType, x, y) {
  const group = new Konva.Group({
    x: x - 18,
    y: y - 18,
    draggable: true,
    name: "symbol",
    shapeType: "symbol",
  });

  group.setAttr("symbolType", symbolType);

  // Base icon background
  const rect = new Konva.Rect({
    width: 36,
    height: 36,
    cornerRadius: 8,
    name: "body-rect",
    fill: "#111827",
    stroke: "#0f172a",
    strokeWidth: 1.4,
  });

  // Choose a simple pictogram / text per symbolType
  const SYMBOL_LABELS = {
    "bar": "🍺",
    "wc-mixed": "WC",
    "wc-male": "M",
    "wc-female": "F",
    "exit-symbol": "⬅",
    "disabled": "♿",
    "first-aid": "✚",
    "info": "i",
  };

  const SYMBOL_FONT_SIZES = {
    "bar": 18,
    "wc-mixed": 13,
    "wc-male": 16,
    "wc-female": 16,
    "exit-symbol": 18,
    "disabled": 18,
    "first-aid": 18,
    "info": 18,
  };

  const text = SYMBOL_LABELS[symbolType] || "?";
  const fontSize = SYMBOL_FONT_SIZES[symbolType] || 16;

  const label = new Konva.Text({
    text,
    fontSize,
    fontFamily: "system-ui",
    fontStyle: "bold",
    fill: "#ffffff",
    align: "center",
    verticalAlign: "middle",
    width: rect.width(),
    height: rect.height(),
    listening: false,
    name: "symbol-label",
  });

  group.add(rect);
  group.add(label);
  ensureHitRect(group);

  // Inline edit of symbol text on double-click (so you can rename / tweak)
  group.on("dblclick", () => {
    beginInlineTextEdit(label, (newText) => {
      label.text(newText || label.text());
      ensureHitRect(group);
      if (mapLayer) mapLayer.batchDraw();
      pushHistory();
    });
  });

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
            listening: false,
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
            listening: false,
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

    // ---- Small DOM helpers ----
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
  btn.textContent = "Flip 180°";
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

    // 1) Normalise current rotation so it never runs away
    const currentRot = normaliseAngle(node.rotation() || 0);
    node.rotation(currentRot);

    // 2) Flip horizontally (mirror across the Y-axis)
    const sx = Number(node.scaleX() || 1);
    node.scaleX(sx * -1);

    // 3) Keep labels readable / upright where needed
    keepLabelsUpright(node);

    if (mapLayer) {
      mapLayer.batchDraw();
    }
    if (overlayLayer) {
      overlayLayer.batchDraw();
    }

    pushHistory();
    // Refresh inspector so Rotation (deg) value shows the normalised value
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

    // ---- Line / Curved line ----
    if (shapeType === "line" || shapeType === "curve-line") {
      const lineShape = node.findOne((n) => n instanceof Konva.Line);

      addTitle(shapeType === "curve-line" ? "Curved line" : "Line");

      if (!lineShape) {
        const p = document.createElement("p");
        p.className = "sb-inspector-empty";
        p.textContent = "This line has no editable geometry.";
        el.appendChild(p);
        return;
      }

            const strokeColor =
        lineShape.stroke && lineShape.stroke()
          ? lineShape.stroke()
          : "#111827";
      const strokeWidth =
        Number(lineShape.strokeWidth && lineShape.strokeWidth()) || 2;
      const dashArr = lineShape.dash && lineShape.dash();
      const lineStyle =
        dashArr && dashArr.length ? "dashed" : "solid";

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

      // Flip helper (180°)
      addFlipButton(node);

      addColorField("Stroke colour", strokeColor, (val) => {
        const v = val || "#111827";
        lineShape.stroke(v);
        if (mapLayer) {
          mapLayer.batchDraw();
          pushHistory();
        }
      });

      addNumberField(
        "Stroke thickness (px)",
        strokeWidth,
        0.5,
        0.5,
        (val) => {
          lineShape.strokeWidth(val);
          ensureHitRect(node);
          if (mapLayer) {
            mapLayer.batchDraw();
            pushHistory();
          }
        }
      );

      addSelectField(
        "Line style",
        lineStyle,
        [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
        ],
        (style) => {
          if (style === "dashed") {
            lineShape.dash([12, 4]);
          } else {
            lineShape.dash([]);
          }
          if (mapLayer) {
            mapLayer.batchDraw();
            pushHistory();
          }
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

      // Flip helper (180°)
      addFlipButton(node);

      addColorField("Stroke colour", strokeColor, (val) => {
        const v = val || "#111827";
        arrow.stroke(v);
        arrow.fill(v);
        if (mapLayer) {
          mapLayer.batchDraw();
          pushHistory();
        }
      });

      addNumberField(
        "Stroke thickness (px)",
        strokeWidth,
        0.5,
        0.5,
        (val) => {
          arrow.strokeWidth(val);
          ensureHitRect(node);
          if (mapLayer) {
            mapLayer.batchDraw();
            pushHistory();
          }
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
          if (mapLayer) {
            mapLayer.batchDraw();
            pushHistory();
          }
        }
      );

      addCheckboxField(
        "Arrowheads at both ends",
        doubleEnded,
        (checked) => {
          arrow.pointerAtBeginning(!!checked);
          if (mapLayer) {
            mapLayer.batchDraw();
            pushHistory();
          }
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

  // Font style toggles
  let bold = !!String(textNode.fontStyle())
    .toLowerCase()
    .includes("bold");
  let italic = !!String(textNode.fontStyle())
    .toLowerCase()
    .includes("italic");
  let underline = !!textNode.underline();

  function applyTextStyles() {
    const parts = [];
    if (bold) parts.push("bold");
    if (italic) parts.push("italic");
    textNode.fontStyle(parts.join(" ") || "normal");
    textNode.underline(underline);
    ensureHitRect(node);
    mapLayer.batchDraw();
    pushHistory();
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

  mapLayer.batchDraw();
  return;
}


    // ---- Stage block ----
    if (shapeType === "stage") {
      const body = getBodyRect(node);
      const labelNode = node.findOne("Text");

      addTitle("Stage");

      // Initialise attributes from existing visuals if missing (for old layouts)
      let stageLabel = node.getAttr("stageLabel") || (labelNode && labelNode.text()) || "STAGE";
      node.setAttr("stageLabel", stageLabel);

      let fillMode = node.getAttr("stageFillMode");
      if (fillMode !== "solid" && fillMode !== "gradient") {
        // Infer from whether a gradient is present
        const stops =
          body && body.fillLinearGradientColorStops
            ? body.fillLinearGradientColorStops()
            : null;
        fillMode = stops && stops.length >= 4 ? "gradient" : "solid";
      }
      node.setAttr("stageFillMode", fillMode);

      // Gradient defaults
      let startColor =
        node.getAttr("stageGradientStartColor") || "#1d4ed8";
      let endColor =
        node.getAttr("stageGradientEndColor") || "#22c1c3";
      node.setAttr("stageGradientStartColor", startColor);
      node.setAttr("stageGradientEndColor", endColor);

      let gradientPreset =
        node.getAttr("stageGradientPreset") || "brand";
      node.setAttr("stageGradientPreset", gradientPreset);

      let direction = node.getAttr("stageGradientDirection") || "lr";
      if (direction !== "lr" && direction !== "tb" && direction !== "diag") {
        direction = "lr";
      }
      node.setAttr("stageGradientDirection", direction);

      // Solid colour default
      let solidColor =
        node.getAttr("stageSolidColor") ||
        (body && body.fill && body.fill()) ||
        "#111827";
      node.setAttr("stageSolidColor", solidColor);

      // Text colour / auto
      let autoText =
        node.getAttr("stageTextAutoColor") !== false; // default true
      node.setAttr("stageTextAutoColor", autoText);

      let textColor =
        node.getAttr("stageTextColor") ||
        (labelNode && labelNode.fill && labelNode.fill()) ||
        "#ffffff";
      node.setAttr("stageTextColor", textColor);

      // Commit initial styling normalisation
      applyStageStyle(node);

      // --- Label field ---
      addTextField("Label", stageLabel, (val) => {
        const value = (val || "").trim() || "STAGE";
        node.setAttr("stageLabel", value);
        if (labelNode) {
          labelNode.text(value);
        }
        ensureHitRect(node);
      });

      // --- Fill mode toggle ---
      addSelectField(
        "Fill mode",
        fillMode,
        [
          { value: "solid", label: "Solid colour" },
          { value: "gradient", label: "Gradient" },
        ],
        (mode) => {
          const safeMode = mode === "solid" ? "solid" : "gradient";
          node.setAttr("stageFillMode", safeMode);
          applyStageStyle(node);
          renderInspector(node); // refresh visible options
        }
      );

      if (fillMode === "solid") {
        // Solid background colour picker
        addColorField("Background colour", solidColor, (val) => {
          const v = val || "#111827";
          node.setAttr("stageSolidColor", v);
          applyStageStyle(node);
        });
      } else {
        // Gradient options
        addSelectField(
          "Gradient preset",
          gradientPreset,
          [
            { value: "brand", label: "Brand blue → teal" },
            { value: "purple-pink", label: "Purple → pink" },
            { value: "orange-red", label: "Orange → red" },
            { value: "custom", label: "Custom" },
          ],
          (preset) => {
            let p = preset;
            if (
              p !== "brand" &&
              p !== "purple-pink" &&
              p !== "orange-red" &&
              p !== "custom"
            ) {
              p = "brand";
            }
            node.setAttr("stageGradientPreset", p);

            if (p === "brand") {
              node.setAttr("stageGradientStartColor", "#1d4ed8");
              node.setAttr("stageGradientEndColor", "#22c1c3");
            } else if (p === "purple-pink") {
              node.setAttr("stageGradientStartColor", "#7e22ce");
              node.setAttr("stageGradientEndColor", "#ec4899");
            } else if (p === "orange-red") {
              node.setAttr("stageGradientStartColor", "#fb923c");
              node.setAttr("stageGradientEndColor", "#ef4444");
            }
            applyStageStyle(node);
            renderInspector(node); // show / hide custom fields
          }
        );

        // If custom, show start/end colour pickers
        if (gradientPreset === "custom") {
          addColorField("Gradient start colour", startColor, (val) => {
            node.setAttr(
              "stageGradientStartColor",
              val || "#1d4ed8"
            );
            applyStageStyle(node);
          });

          addColorField("Gradient end colour", endColor, (val) => {
            node.setAttr("stageGradientEndColor", val || "#22c1c3");
            applyStageStyle(node);
          });
        }

        // Gradient direction
        addSelectField(
          "Gradient direction",
          direction,
          [
            { value: "lr", label: "Left → Right" },
            { value: "tb", label: "Top → Bottom" },
            { value: "diag", label: "Diagonal" },
          ],
          (val) => {
            const safe =
              val === "tb" || val === "diag" ? val : "lr";
            node.setAttr("stageGradientDirection", safe);
            applyStageStyle(node);
          }
        );
      }

      // --- Text colour controls ---
      addCheckboxField(
        "Auto text colour for contrast",
        autoText,
        (checked) => {
          node.setAttr("stageTextAutoColor", !!checked);
          applyStageStyle(node);
        }
      );

      addColorField("Text colour", textColor, (val) => {
        const v = val || "#ffffff";
        node.setAttr("stageTextColor", v);
        node.setAttr("stageTextAutoColor", false);
        applyStageStyle(node);
        renderInspector(node); // sync checkbox state
      });

      return;
    }

    // ---- Basic shapes: section block / square / circle ----
 if (
      shapeType === "section" ||
      shapeType === "square" ||
      shapeType === "circle" ||
      shapeType === "symbol"
    ) {
      const body = getBodyRect(node);

      addTitle(
        shapeType === "section" ? "Selection block" : "Shape"
      );

      if (!body) {
        const p = document.createElement("p");
        p.className = "sb-inspector-empty";
        p.textContent = "This shape has no editable geometry.";
        el.appendChild(p);
        return;
      }

      const fillEnabled =
        node.getAttr("shapeFillEnabled") !== false;

      const rawFill = node.getAttr("shapeFillColor") || body.fill();
      const fillColor =
        rawFill && rawFill !== "rgba(0,0,0,0)"
          ? rawFill
          : "#ffffff";

      const strokeColor =
        node.getAttr("shapeStrokeColor") ||
        body.stroke() ||
        "#4b5563";

      const strokeWidthRaw = node.getAttr("shapeStrokeWidth");
      const strokeWidth =
        Number.isFinite(Number(strokeWidthRaw))
          ? Number(strokeWidthRaw)
          : body.strokeWidth() || 1.7;

      // Determine current stroke style from attr or dash pattern
      let strokeStyleAttr = node.getAttr("shapeStrokeStyle");
      let strokeStyle;
      if (
        strokeStyleAttr === "solid" ||
        strokeStyleAttr === "dashed" ||
        strokeStyleAttr === "dotted"
      ) {
        strokeStyle = strokeStyleAttr;
      } else {
        const dashArr = body.dash && body.dash();
        if (dashArr && dashArr.length) {
          strokeStyle = dashArr[0] <= 3 ? "dotted" : "dashed";
        } else {
          strokeStyle = "solid";
        }
        node.setAttr("shapeStrokeStyle", strokeStyle);
      }

      addCheckboxField("Fill background", fillEnabled, (checked) => {
        node.setAttr("shapeFillEnabled", checked);
        applyBasicShapeStyle(node);
      });

      addColorField("Fill colour", fillColor, (val) => {
        node.setAttr("shapeFillColor", val || "#ffffff");
        applyBasicShapeStyle(node);
      });

      // Slider 0–10px for outline thickness
      addRangeField(
        "Outline thickness (px)",
        strokeWidth,
        0,
        10,
        0.5,
        (val) => {
          node.setAttr("shapeStrokeWidth", val);
          applyBasicShapeStyle(node);
        }
      );

      addColorField("Outline colour", strokeColor, (val) => {
        node.setAttr("shapeStrokeColor", val || "#4b5563");
        applyBasicShapeStyle(node);
      });

      // Outline style: solid / dotted / dashed
      addSelectField(
        "Outline style",
        strokeStyle,
        [
          { value: "solid", label: "Solid" },
          { value: "dotted", label: "Dots" },
          { value: "dashed", label: "Dashes" },
        ],
        (val) => {
          const safe =
            val === "dotted" || val === "dashed" ? val : "solid";
          node.setAttr("shapeStrokeStyle", safe);
          applyBasicShapeStyle(node);
        }
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

    // Arrow: allow rotation and diagonal resize
    if (shapeType === "arrow") {
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

   function attachNodeBehaviour(node) {
  if (!(node instanceof Konva.Group)) return;

  ensureHitRect(node);

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
    setActiveTool(null);
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
      tShape === "circle"
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
          body.width(body.width() * scaleX);
          body.height(body.height() * scaleY);
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
    } else if (tShape !== "arrow") {
      // For most other shapes we bake the transform into geometry and reset scale
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



  // ---------- Node creation based on active tool ----------

    function createNodeForTool(tool, pos) {
    // default to centre if for some reason we don't have a pointer
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

      // ---------- Canvas interactions: click / selection / placement ----------

    function handleStageClick(evt) {
    if (!stage || !mapLayer) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const target = evt.target;
    const isHandle =
      target &&
      target.getAttr &&
      (target.getAttr("isLineHandle") || target.getAttr("isArrowHandle"));

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

    // Freehand curve-line drawing
    if (activeTool === "curve-line") {
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
      startCurveLine(pointerPos);
      if (evt.evt) evt.evt.preventDefault();
      return;
    }

    // Do not pan while another drawing tool is active
    if (activeTool) return;

    const target = evt.target;
    const clickedOnEmpty =
      target === stage ||
      (target.getLayer && target.getLayer() === gridLayer);

    if (!clickedOnEmpty) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

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

    // Finish freehand curve-line on mouse up
    if (activeTool === "curve-line" && isCurveDrawing) {
      finishCurveLine(true);
      return;
    }

    if (!isPanning) return;
    isPanning = false;
    lastPanPointerPos = null;
    updateDefaultCursor();
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

    // ---------- Boot ----------

  initStage();
  updateDefaultCursor();
  hookToolButtons();
  hookZoomButtons();
  hookClearButton();
  hookUndoRedoButtons();
  hookSaveButton();

  stage.on("click", handleStageClick);

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
  loadExistingLayout();

  renderInspector(null);
})();
