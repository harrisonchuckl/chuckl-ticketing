// backend/public/static/seating-builder.js
// TickIn seating builder – square grid, per-action undo/redo,
// configurable tools and simple inspector.

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

  const GRID_SIZE = 32; // square grid cell size
  const STAGE_PADDING = 40;
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.4;
  const ZOOM_STEP = 0.1;

  // Tool configuration schema (for pop-up + inspector)
  const TOOL_CONFIG_DEFS = {
    row: {
      title: "Rows of seats",
      fields: [
        {
          key: "rowCount",
          label: "Number of rows",
          type: "number",
          min: 1,
          max: 50,
          default: 3,
        },
        {
          key: "seatsPerRow",
          label: "Seats per row",
          type: "number",
          min: 1,
          max: 60,
          default: 10,
        },
      ],
    },
    "circle-table": {
      title: "Circular table",
      fields: [
        {
          key: "seats",
          label: "Seats around table",
          type: "number",
          min: 1,
          max: 24,
          default: 8,
        },
      ],
    },
    "rect-table": {
      title: "Rectangular table",
      fields: [
        {
          key: "seatsLong",
          label: "Seats on each long side",
          type: "number",
          min: 0,
          max: 20,
          default: 4,
        },
        {
          key: "seatsShort",
          label: "Seats on each short side",
          type: "number",
          min: 0,
          max: 10,
          default: 2,
        },
      ],
    },
    stage: {
      title: "Stage",
      fields: [
        {
          key: "label",
          label: "Label",
          type: "text",
          default: "STAGE",
        },
      ],
    },
    bar: {
      title: "Bar / kiosk",
      fields: [
        {
          key: "label",
          label: "Label",
          type: "text",
          default: "BAR",
        },
      ],
    },
    exit: {
      title: "Exit",
      fields: [
        {
          key: "label",
          label: "Label",
          type: "text",
          default: "EXIT",
        },
      ],
    },
  };

  // ---------- State ----------

  let stage;
  let gridLayer;
  let mapLayer;
  let overlayLayer;
  let transformer;

  let activeTool = null; // "section" | "row" | ...
  let selectedNode = null;

  // Per-tool last-used settings (for popup + creation)
  const toolSettings = {};

  // history is per-mapLayer JSON so we can re-create nodes & handlers
  let history = [];
  let historyIndex = -1;
  let isRestoringHistory = false;

  // Simple seat counter (for right-hand summary)
  const seatCountEl = document.getElementById("sb-seat-count");

  // Selection inspector element
  const selectionPanel = document.getElementById("sb-selection-summary");

  // ---------- Helpers ----------

  function snap(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

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

    if (!stage) return;
    const cursor = activeTool ? "crosshair" : "default";
    stage.container().style.cursor = cursor;
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
      gridLayer.add(
        new Konva.Line({
          points: [x, 0, x, height],
          stroke: "rgba(148,163,184,0.18)",
          strokeWidth: 0.7,
        })
      );
    }

    for (let y = 0; y <= height; y += GRID_SIZE) {
      gridLayer.add(
        new Konva.Line({
          points: [0, y, width, y],
          stroke: "rgba(148,163,184,0.18)",
          strokeWidth: 0.7,
        })
      );
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

    // Remove any existing mapLayer references from stage and re-add in correct order
    gridLayer.remove();
    overlayLayer.remove();
    stage.add(gridLayer);
    stage.add(mapLayer);
    stage.add(overlayLayer);

    // Re-attach behaviour to all top-level groups
    mapLayer.getChildren().each((node) => {
      attachNodeBehaviour(node);
    });

    mapLayer.draw();
    updateSeatCount();
    clearSelection();
    updateUndoRedoButtons();

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

  // ---------- Selection / inspector ----------

  function renderInspector(node) {
    if (!selectionPanel) return;

    if (!node) {
      selectionPanel.innerHTML =
        "Nothing selected. Click on a seat, table or object to see quick details here.";
      return;
    }

    const shapeType = node.getAttr("shapeType") || node.name() || "object";
    const def = TOOL_CONFIG_DEFS[shapeType];

    // Seats summary
    let localSeats = 0;
    node.find("Circle").each((c) => {
      if (c.getAttr("isSeat")) localSeats += 1;
    });

    if (!def) {
      selectionPanel.innerHTML =
        "<strong>" +
        shapeType.replace("-", " ") +
        "</strong><br />" +
        (localSeats
          ? `${localSeats} seats in this block.`
          : "Drag, resize or rotate this object on the map.");
      return;
    }

    const cfg = node.getAttr("config") || {};
    const title = def.title || "Object";

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">${title}</div>`;

    if (localSeats) {
      const seatInfo = document.createElement("div");
      seatInfo.style.fontSize = "12px";
      seatInfo.style.color = "#6b7280";
      seatInfo.style.marginBottom = "8px";
      seatInfo.textContent = `${localSeats} seats in this block.`;
      wrapper.appendChild(seatInfo);
    }

    const form = document.createElement("div");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "6px";

    def.fields.forEach((field) => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.fontSize = "12px";
      row.style.gap = "6px";

      const span = document.createElement("span");
      span.textContent = field.label;

      let input;
      if (field.type === "text") {
        input = document.createElement("input");
        input.type = "text";
      } else {
        input = document.createElement("input");
        input.type = "number";
        if (field.min != null) input.min = String(field.min);
        if (field.max != null) input.max = String(field.max);
      }

      input.style.flex = "0 0 70px";
      input.style.fontSize = "12px";
      input.style.padding = "3px 6px";
      input.style.borderRadius = "6px";
      input.style.border = "1px solid #d1d5db";

      const currentValue =
        cfg[field.key] != null ? cfg[field.key] : field.default;
      input.value = currentValue != null ? String(currentValue) : "";

      input.addEventListener("change", () => {
        let val =
          field.type === "number" ? parseInt(input.value || "0", 10) : input.value;

        if (field.type === "number") {
          if (isNaN(val)) val = field.default;
          if (field.min != null && val < field.min) val = field.min;
          if (field.max != null && val > field.max) val = field.max;
          input.value = String(val);
        }

        const newCfg = { ...(node.getAttr("config") || {}) };
        newCfg[field.key] = val;
        node.setAttr("config", newCfg);
        rebuildShapeFromConfig(node);
        mapLayer.batchDraw();
        updateSeatCount();
        pushHistory();
      });

      row.appendChild(span);
      row.appendChild(input);
      form.appendChild(row);
    });

    wrapper.appendChild(form);
    selectionPanel.innerHTML = "";
    selectionPanel.appendChild(wrapper);
  }

  function clearSelection() {
    selectedNode = null;
    if (transformer) {
      transformer.nodes([]);
      overlayLayer.draw();
    }
    renderInspector(null);
  }

  function selectNode(node) {
    selectedNode = node;
    transformer.nodes([node]);
    overlayLayer.draw();
    renderInspector(node);
  }

  // ---------- Shape builders (use config on group) ----------

  function applyDefaultConfig(shapeType, existingConfig) {
    const def = TOOL_CONFIG_DEFS[shapeType];
    const base = {};
    if (def && def.fields) {
      def.fields.forEach((f) => {
        base[f.key] = f.default;
      });
    }
    return { ...base, ...(existingConfig || {}) };
  }

  function buildStageFromConfig(group) {
    const cfg = applyDefaultConfig("stage", group.getAttr("config"));
    group.destroyChildren();

    const width = 200;
    const height = 52;

    const rect = new Konva.Rect({
      width,
      height,
      cornerRadius: 10,
      stroke: "#111827",
      strokeWidth: 1.7,
    });

    const label = new Konva.Text({
      text: cfg.label || "STAGE",
      fontSize: 18,
      fontStyle: "bold",
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width,
      height,
      fill: "#111827",
    });

    group.add(rect);
    group.add(label);
  }

  function buildBarFromConfig(group) {
    const cfg = applyDefaultConfig("bar", group.getAttr("config"));
    group.destroyChildren();

    const width = 140;
    const height = 36;

    const rect = new Konva.Rect({
      width,
      height,
      cornerRadius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.5,
    });

    const label = new Konva.Text({
      text: cfg.label || "BAR",
      fontSize: 14,
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width,
      height,
      fill: "#4b5563",
    });

    group.add(rect);
    group.add(label);
  }

  function buildExitFromConfig(group) {
    const cfg = applyDefaultConfig("exit", group.getAttr("config"));
    group.destroyChildren();

    const width = 100;
    const height = 36;

    const rect = new Konva.Rect({
      width,
      height,
      cornerRadius: 8,
      stroke: "#16a34a",
      strokeWidth: 1.6,
    });

    const label = new Konva.Text({
      text: cfg.label || "EXIT",
      fontSize: 14,
      fontFamily: "system-ui",
      align: "center",
      verticalAlign: "middle",
      width,
      height,
      fill: "#16a34a",
    });

    group.add(rect);
    group.add(label);
  }

  function buildCircularTableFromConfig(group) {
    const cfg = applyDefaultConfig("circle-table", group.getAttr("config"));
    group.destroyChildren();

    const tableRadius = 24;
    const seatRadius = 7;
    const seats = Math.max(1, cfg.seats || 8);
    const distance = tableRadius + 14;

    const table = new Konva.Circle({
      radius: tableRadius,
      stroke: "#4b5563",
      strokeWidth: 1.4,
    });
    group.add(table);

    for (let i = 0; i < seats; i++) {
      const angle = (i / seats) * Math.PI * 2;
      const sx = Math.cos(angle) * distance;
      const sy = Math.sin(angle) * distance;
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

  function buildRectTableFromConfig(group) {
    const cfg = applyDefaultConfig("rect-table", group.getAttr("config"));
    group.destroyChildren();

    const width = 80;
    const height = 32;
    const seatsLong = Math.max(0, cfg.seatsLong || 4);
    const seatsShort = Math.max(0, cfg.seatsShort || 2);
    const seatRadius = 6;
    const offset = 10;

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

    // top/bottom
    for (let i = 0; i < seatsLong; i++) {
      const frac = (i + 1) / (seatsLong + 1);
      const sx = (frac - 0.5) * width;

      const topSeat = new Konva.Circle({
        x: sx,
        y: -height / 2 - offset,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      const bottomSeat = new Konva.Circle({
        x: sx,
        y: height / 2 + offset,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      group.add(topSeat);
      group.add(bottomSeat);
    }

    // left/right
    for (let i = 0; i < seatsShort; i++) {
      const frac = (i + 1) / (seatsShort + 1);
      const sy = (frac - 0.5) * height;

      const leftSeat = new Konva.Circle({
        x: -width / 2 - offset,
        y: sy,
        radius: seatRadius,
        stroke: "#4b5563",
        strokeWidth: 1.3,
        isSeat: true,
      });

      const rightSeat = new Konva.Circle({
        x: width / 2 + offset,
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

  function buildRowSeatsFromConfig(group) {
    const cfg = applyDefaultConfig("row", group.getAttr("config"));
    group.destroyChildren();

    const rowCount = Math.max(1, cfg.rowCount || 1);
    const seatsPerRow = Math.max(1, cfg.seatsPerRow || 10);
    const spacing = 20;
    const rowSpacing = 20;
    const seatRadius = 6;

    const startY = -((rowCount - 1) * rowSpacing) / 2;

    for (let r = 0; r < rowCount; r++) {
      const y = startY + r * rowSpacing;
      for (let i = 0; i < seatsPerRow; i++) {
        const sx = (i - (seatsPerRow - 1) / 2) * spacing;
        const seat = new Konva.Circle({
          x: sx,
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

  function rebuildShapeFromConfig(group) {
    const type = group.getAttr("shapeType");
    switch (type) {
      case "stage":
        buildStageFromConfig(group);
        break;
      case "bar":
        buildBarFromConfig(group);
        break;
      case "exit":
        buildExitFromConfig(group);
        break;
      case "circular-table":
        buildCircularTableFromConfig(group);
        break;
      case "rect-table":
        buildRectTableFromConfig(group);
        break;
      case "row-seats":
      case "row":
        buildRowSeatsFromConfig(group);
        break;
      default:
        break;
    }
  }

  // ---------- Shape factories (create groups) ----------

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
    const cfg = toolSettings.stage || {};
    const group = new Konva.Group({
      x: snap(x) - 100,
      y: snap(y) - 24,
      draggable: true,
      name: "stage",
      shapeType: "stage",
      config: cfg,
    });
    buildStageFromConfig(group);
    return group;
  }

  function createBar(x, y) {
    const cfg = toolSettings.bar || {};
    const group = new Konva.Group({
      x: snap(x) - 70,
      y: snap(y) - 18,
      draggable: true,
      name: "bar",
      shapeType: "bar",
      config: cfg,
    });
    buildBarFromConfig(group);
    return group;
  }

  function createExit(x, y) {
    const cfg = toolSettings.exit || {};
    const group = new Konva.Group({
      x: snap(x) - 50,
      y: snap(y) - 18,
      draggable: true,
      name: "exit",
      shapeType: "exit",
      config: cfg,
    });
    buildExitFromConfig(group);
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
    const cfg = toolSettings["circle-table"] || {};
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "circular-table",
      shapeType: "circular-table",
      config: cfg,
    });
    buildCircularTableFromConfig(group);
    return group;
  }

  function createRectTable(x, y) {
    const cfg = toolSettings["rect-table"] || {};
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "rect-table",
      shapeType: "rect-table",
      config: cfg,
    });
    buildRectTableFromConfig(group);
    return group;
  }

  function createRowOfSeats(x, y) {
    const cfg = toolSettings.row || {};
    const group = new Konva.Group({
      x: snap(x),
      y: snap(y),
      draggable: true,
      name: "row-seats",
      shapeType: "row",
      config: cfg,
    });
    buildRowSeatsFromConfig(group);
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

  // ---------- Tool config pop-up ----------

  function openToolConfig(tool) {
    const def = TOOL_CONFIG_DEFS[tool];
    if (!def) {
      setActiveTool(tool);
      return;
    }

    // If already active, toggle off
    if (activeTool === tool) {
      setActiveTool(null);
      return;
    }

    const existing = toolSettings[tool] || {};
    const values = {};
    def.fields.forEach((f) => {
      values[f.key] =
        existing[f.key] != null ? existing[f.key] : f.default;
    });

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.style.position = "fixed";
    backdrop.style.inset = "0";
    backdrop.style.background = "rgba(15,23,42,0.25)";
    backdrop.style.display = "flex";
    backdrop.style.alignItems = "center";
    backdrop.style.justifyContent = "center";
    backdrop.style.zIndex = "9999";

    // Modal
    const modal = document.createElement("div");
    modal.style.background = "#ffffff";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 24px 60px rgba(15,23,42,0.25)";
    modal.style.padding = "18px 20px 16px";
    modal.style.minWidth = "260px";
    modal.style.maxWidth = "320px";
    modal.style.fontFamily =
      'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    modal.style.fontSize = "13px";

    const title = document.createElement("div");
    title.textContent = def.title || "Options";
    title.style.fontWeight = "600";
    title.style.marginBottom = "6px";

    const hint = document.createElement("div");
    hint.textContent = "Set options, then click Apply to drop this shape.";
    hint.style.fontSize = "11px";
    hint.style.color = "#6b7280";
    hint.style.marginBottom = "10px";

    const form = document.createElement("form");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "8px";

    const inputs = {};

    def.fields.forEach((field) => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "8px";

      const span = document.createElement("span");
      span.textContent = field.label;

      let input;
      if (field.type === "text") {
        input = document.createElement("input");
        input.type = "text";
      } else {
        input = document.createElement("input");
        input.type = "number";
        if (field.min != null) input.min = String(field.min);
        if (field.max != null) input.max = String(field.max);
      }

      input.style.flex = "0 0 80px";
      input.style.fontSize = "12px";
      input.style.padding = "4px 6px";
      input.style.borderRadius = "8px";
      input.style.border = "1px solid #d1d5db";
      input.value =
        values[field.key] != null ? String(values[field.key]) : "";

      inputs[field.key] = { input, field };

      row.appendChild(span);
      row.appendChild(input);
      form.appendChild(row);
    });

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.justifyContent = "flex-end";
    buttonRow.style.gap = "8px";
    buttonRow.style.marginTop = "12px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.border = "1px solid #d1d5db";
    cancelBtn.style.background = "#ffffff";
    cancelBtn.style.borderRadius = "999px";
    cancelBtn.style.fontSize = "12px";
    cancelBtn.style.padding = "4px 10px";
    cancelBtn.style.cursor = "pointer";

    const applyBtn = document.createElement("button");
    applyBtn.type = "submit";
    applyBtn.textContent = "Apply";
    applyBtn.style.border = "none";
    applyBtn.style.background =
      "linear-gradient(135deg,#2563eb,#4f46e5)";
    applyBtn.style.color = "#ffffff";
    applyBtn.style.borderRadius = "999px";
    applyBtn.style.fontSize = "12px";
    applyBtn.style.padding = "4px 14px";
    applyBtn.style.cursor = "pointer";
    applyBtn.style.boxShadow = "0 8px 18px rgba(37,99,235,0.35)";

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(applyBtn);

    form.appendChild(buttonRow);

    modal.appendChild(title);
    modal.appendChild(hint);
    modal.appendChild(form);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function closeModal() {
      document.body.removeChild(backdrop);
    }

    cancelBtn.addEventListener("click", () => {
      closeModal();
    });

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const newCfg = {};
      def.fields.forEach((field) => {
        const { input } = inputs[field.key];
        let val =
          field.type === "number"
            ? parseInt(input.value || "0", 10)
            : input.value;

        if (field.type === "number") {
          if (isNaN(val)) val = field.default;
          if (field.min != null && val < field.min) val = field.min;
          if (field.max != null && val > field.max) val = field.max;
        }

        newCfg[field.key] = val;
      });

      toolSettings[tool] = newCfg;
      closeModal();
      setActiveTool(tool);
    });
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
    pushHistory(); // creation is its own undo step
  }

  // keyboard delete
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
        openToolConfig(tool);
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
        // initialise empty history
        history = [mapLayer.toJSON()];
        historyIndex = 0;
        updateUndoRedoButtons();
        updateSeatCount();
        return;
      }

      const data = await res.json();
      const active = data && data.activeSeatMap;
      const konvaJson = active && active.layout && active.layout.konvaJson;

      if (!konvaJson) {
        history = [mapLayer.toJSON()];
        historyIndex = 0;
        updateUndoRedoButtons();
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
        history = [mapLayer.toJSON()];
        historyIndex = 0;
        updateUndoRedoButtons();
        updateSeatCount();
        return;
      }

      const tempStage = Konva.Node.create(parsed, container);
      const foundLayers = tempStage.getLayers();
      let sourceLayer = foundLayers[0];

      if (foundLayers.length > 1) {
        const withChildren = foundLayers.find(
          (l) => l.getChildren().length
        );
        if (withChildren) sourceLayer = withChildren;
      }

      const json = sourceLayer.toJSON();
      const restored = Konva.Node.create(json);

      mapLayer.destroy();
      mapLayer = restored;

      gridLayer.remove();
      overlayLayer.remove();
      stage.add(gridLayer);
      stage.add(mapLayer);
      stage.add(overlayLayer);

      mapLayer.getChildren().each((node) => attachNodeBehaviour(node));

      mapLayer.draw();
      updateSeatCount();

      history = [mapLayer.toJSON()];
      historyIndex = 0;
      updateUndoRedoButtons();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error loading existing seat map", err);
      history = [mapLayer.toJSON()];
      historyIndex = 0;
      updateUndoRedoButtons();
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

  loadExistingLayout();
})();
