/******************************************************************************************
 * TickIn — Konva-Based Seating Designer
 * Full Eventbrite-style drag & drop seating map editor
 * 
 * This file is intentionally large. It contains:
 *  - Full Konva canvas builder
 *  - Tools: add tables, seats, rows, sections, stage, misc objects
 *  - Object inspector
 *  - Save/load from backend
 *  - Export/import Konva JSON
 *  - Automatic table seat generation (circular + rectangular)
 *  - Undo/Redo stack
 ******************************************************************************************/

/* -----------------------------------------------------
   GLOBAL STATE
----------------------------------------------------- */
const SHOW_ID = window.__SEATMAP_SHOW_ID__;
const DEFAULT_LAYOUT = window.__SEATMAP_LAYOUT__;

const API_URL = `/admin/seating/builder/api/seatmaps/${SHOW_ID}`;

let stage, layer;
let selectionRect;
let tr; // transformer
let history = [];
let historyIndex = -1;

let seatMapId = null;     // saved record ID (for updates)
let loadedKonvaJson = null;

/* -----------------------------------------------------
   UI ELEMENTS
----------------------------------------------------- */
const container = document.getElementById("app");

/* Build the UI root */
container.innerHTML = `
  <div id="sb-root">
    <div id="sb-toolbar-left">
      <div class="tool-section-title">Add Elements</div>

      <button class="tool-btn" data-tool="table-circle">◯ Circular Table</button>
      <button class="tool-btn" data-tool="table-rect">▭ Rectangular Table</button>

      <button class="tool-btn" data-tool="row">≡ Row of Seats</button>
      <button class="tool-btn" data-tool="section">▦ Section Block</button>

      <button class="tool-btn" data-tool="seat">• Single Seat</button>
      <button class="tool-btn" data-tool="stage">🎭 Stage</button>

      <hr>

      <button class="tool-btn" data-tool="label">🅣 Text Label</button>
      <button class="tool-btn" data-tool="exit">🚪 Exit</button>
      <button class="tool-btn" data-tool="bar">🍺 Bar</button>

      <hr>

      <button class="tool-btn" id="undo-btn">↶ Undo</button>
      <button class="tool-btn" id="redo-btn">↷ Redo</button>
      <button class="tool-btn" id="clear-btn">🧹 Clear Canvas</button>
    </div>

    <div id="sb-canvas-container">
      <div id="sb-canvas"></div>
    </div>

    <div id="sb-sidebar-right">
      <div id="sb-inspector">
        <h3>Inspector</h3>
        <div id="inspector-content">Select an object to edit.</div>
      </div>

      <hr>

      <div id="sb-actions">
        <button class="action-btn" id="save-btn">💾 Save Layout</button>
        <button class="action-btn" id="export-json-btn">⬇️ Export JSON</button>
        <button class="action-btn" id="import-json-btn">⬆️ Import JSON</button>
      </div>
    </div>
  </div>
`;

/* -----------------------------------------------------
   INITIALISE KONVA STAGE
----------------------------------------------------- */
function initStage() {
  stage = new Konva.Stage({
    container: "sb-canvas",
    width: document.getElementById("sb-canvas-container").clientWidth,
    height: window.innerHeight - 20,
  });

  layer = new Konva.Layer();
  stage.add(layer);

  tr = new Konva.Transformer({
    rotateEnabled: true,
    ignoreStroke: true,
    enabledAnchors: [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
      "middle-left",
      "middle-right",
      "top-center",
      "bottom-center",
    ],
  });

  layer.add(tr);
  layer.draw();

  setupSelectionBox();
  setupStageListeners();
  setupCanvasResize();
}

/* -----------------------------------------------------
   SELECTION + MULTISELECT
----------------------------------------------------- */
function setupSelectionBox() {
  selectionRect = new Konva.Rect({
    fill: "rgba(0, 120, 255, 0.2)",
    visible: false,
  });
  layer.add(selectionRect);
}

function setupStageListeners() {
  stage.on("mousedown", (e) => {
    if (e.target === stage) {
      tr.nodes([]);
      updateInspector(null);

      selectionRect.visible(true);
      selectionRect.width(0);
      selectionRect.height(0);
      selectionRect.x(stage.getPointerPosition().x);
      selectionRect.y(stage.getPointerPosition().y);
    }
  });

  stage.on("mousemove", (e) => {
    if (!selectionRect.visible()) return;

    const pos = stage.getPointerPosition();
    selectionRect.width(pos.x - selectionRect.x());
    selectionRect.height(pos.y - selectionRect.y());
    layer.batchDraw();
  });

  stage.on("mouseup", () => {
    if (!selectionRect.visible()) return;

    const selBox = selectionRect.getClientRect();
    const selected = [];

    layer.find(".sb-object").each((node) => {
      if (Konva.Util.haveIntersection(selBox, node.getClientRect())) {
        selected.push(node);
      }
    });

    tr.nodes(selected);
    updateInspector(selected.length === 1 ? selected[0] : null);

    selectionRect.visible(false);
    layer.draw();
  });
}

/* -----------------------------------------------------
   UNDO / REDO
----------------------------------------------------- */
function pushHistory() {
  const json = stage.toJSON();
  history.splice(historyIndex + 1);
  history.push(json);
  historyIndex = history.length - 1;
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  loadKonvaJSON(history[historyIndex]);
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  loadKonvaJSON(history[historyIndex]);
}

/* -----------------------------------------------------
   LOAD KONVA JSON
----------------------------------------------------- */
function loadKonvaJSON(json) {
  try {
    const obj = typeof json === "string" ? JSON.parse(json) : json;
    stage.destroy();

    // rebuild stage
    stage = Konva.Node.create(obj, "sb-canvas");
    layer = stage.findOne("Layer");

    setupSelectionBox();
    setupStageListeners();
    layer.add(tr);

    layer.draw();
  } catch (err) {
    console.error("Invalid JSON", err);
    alert("Unable to import JSON.");
  }
}

/* -----------------------------------------------------
   OBJECT CREATION HELPERS
----------------------------------------------------- */

// single seat
function createSeat(x, y) {
  const circle = new Konva.Circle({
    x, y,
    radius: 10,
    fill: "#2d6cdf",
    stroke: "#0d47a1",
    strokeWidth: 1,
    draggable: true,
    name: "sb-object seat",
  });
  registerObject(circle);
  return circle;
}

// circular table with auto seats
function createCircularTable({ x, y, radius, seatCount }) {
  const group = new Konva.Group({
    x, y,
    draggable: true,
    name: "sb-object table-circle",
  });

  const table = new Konva.Circle({
    radius,
    fill: "#fff7dc",
    stroke: "#8b6e39",
    strokeWidth: 2,
  });

  group.add(table);

  const angleStep = (Math.PI * 2) / seatCount;
  for (let i = 0; i < seatCount; i++) {
    const angle = i * angleStep;
    const sx = Math.cos(angle) * (radius + 24);
    const sy = Math.sin(angle) * (radius + 24);
    const seat = createSeat(sx, sy);
    group.add(seat);
  }

  registerObject(group);
  return group;
}

// rectangular table with seats per side
function createRectTable({ x, y, width, height, topSeats, bottomSeats, leftSeats, rightSeats }) {
  const group = new Konva.Group({
    x, y,
    draggable: true,
    name: "sb-object table-rect",
  });

  const table = new Konva.Rect({
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    fill: "#fff7dc",
    stroke: "#8b6e39",
    strokeWidth: 2,
  });
  group.add(table);

  // Top side
  const tGap = width / (topSeats + 1);
  for (let i = 1; i <= topSeats; i++) {
    group.add(createSeat(-width / 2 + tGap * i, -height / 2 - 20));
  }

  // Bottom side
  const bGap = width / (bottomSeats + 1);
  for (let i = 1; i <= bottomSeats; i++) {
    group.add(createSeat(-width / 2 + bGap * i, height / 2 + 20));
  }

  // Left side
  const lGap = height / (leftSeats + 1);
  for (let i = 1; i <= leftSeats; i++) {
    group.add(createSeat(-width / 2 - 20, -height / 2 + lGap * i));
  }

  // Right side
  const rGap = height / (rightSeats + 1);
  for (let i = 1; i <= rightSeats; i++) {
    group.add(createSeat(width / 2 + 20, -height / 2 + rGap * i));
  }

  registerObject(group);
  return group;
}

/* -----------------------------------------------------
   UTIL: register object click/drag/remove
----------------------------------------------------- */
function registerObject(node) {
  node.on("click", (e) => {
    tr.nodes([node]);
    updateInspector(node);
    e.cancelBubble = true;
  });

  node.on("dragend", () => pushHistory());

  layer.add(node);
  layer.draw();

  pushHistory();
}

/* -----------------------------------------------------
   ELEMENT TOOLBAR ACTIONS
----------------------------------------------------- */
document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool;

    switch (tool) {
      case "seat":
        createSeat(200, 200);
        break;

      case "table-circle":
        openCircularTableModal();
        break;

      case "table-rect":
        openRectTableModal();
        break;

      case "row":
        createRowOfSeats();
        break;

      case "section":
        createSection();
        break;

      case "stage":
        createStage();
        break;

      case "label":
        createLabel();
        break;

      case "exit":
        createExit();
        break;

      case "bar":
        createBar();
        break;
    }
  });
});

/* -----------------------------------------------------
   TABLE MODALS
----------------------------------------------------- */
function openCircularTableModal() {
  const count = prompt("How many seats around this circular table?");
  const radius = prompt("Table radius (default: 40)?") || 40;

  if (!count) return;

  createCircularTable({
    x: 300,
    y: 250,
    radius: Number(radius),
    seatCount: Number(count),
  });
}

function openRectTableModal() {
  const width = Number(prompt("Table width?", "120"));
  const height = Number(prompt("Table height?", "60"));
  const topSeats = Number(prompt("Seats on top side?", "2"));
  const bottomSeats = Number(prompt("Seats on bottom side?", "2"));
  const leftSeats = Number(prompt("Seats on left side?", "1"));
  const rightSeats = Number(prompt("Seats on right side?", "1"));

  createRectTable({
    x: 300,
    y: 300,
    width,
    height,
    topSeats,
    bottomSeats,
    leftSeats,
    rightSeats,
  });
}

/* -----------------------------------------------------
   OTHER ELEMENT CREATORS
----------------------------------------------------- */
function createRowOfSeats() {
  const count = Number(prompt("How many seats in the row?", "10"));
  const group = new Konva.Group({ x: 200, y: 200, draggable: true, name: "sb-object row" });

  for (let i = 0; i < count; i++) {
    group.add(createSeat(i * 28, 0));
  }

  registerObject(group);
}

function createSection() {
  const w = Number(prompt("Section width?", "200"));
  const h = Number(prompt("Section height?", "120"));

  const rect = new Konva.Rect({
    x: 200,
    y: 200,
    width: w,
    height: h,
    fill: "rgba(200,200,200,0.2)",
    stroke: "#888",
    strokeWidth: 2,
    draggable: true,
    name: "sb-object section",
  });

  registerObject(rect);
}

function createStage() {
  const stageBlock = new Konva.Rect({
    x: 150,
    y: 50,
    width: 300,
    height: 80,
    fill: "#111",
    stroke: "#444",
    strokeWidth: 2,
    draggable: true,
    name: "sb-object stage",
  });

  registerObject(stageBlock);
}

function createLabel() {
  const text = new Konva.Text({
    x: 200,
    y: 200,
    text: "Label",
    fontSize: 20,
    fontFamily: "Arial",
    fill: "#222",
    draggable: true,
    name: "sb-object label",
  });

  registerObject(text);
}

function createExit() {
  const exit = new Konva.Text({
    x: 100,
    y: 100,
    text: "EXIT",
    fontSize: 26,
    fill: "red",
    draggable: true,
    name: "sb-object exit",
  });

  registerObject(exit);
}

function createBar() {
  const bar = new Konva.Rect({
    x: 120,
    y: 120,
    width: 150,
    height: 40,
    fill: "#ffd27f",
    stroke: "#aa7500",
    strokeWidth: 2,
    draggable: true,
    name: "sb-object bar",
  });

  registerObject(bar);
}

/* -----------------------------------------------------
   INSPECTOR PANEL
----------------------------------------------------- */
function updateInspector(node) {
  const panel = document.getElementById("inspector-content");

  if (!node) {
    panel.innerHTML = "Select an object to edit.";
    return;
  }

  const x = node.x();
  const y = node.y();
  const rot = node.rotation();

  panel.innerHTML = `
    <div class="ins-field">
      <label>X:</label>
      <input id="ins-x" type="number" value="${x}">
    </div>
    <div class="ins-field">
      <label>Y:</label>
      <input id="ins-y" type="number" value="${y}">
    </div>
    <div class="ins-field">
      <label>Rotation:</label>
      <input id="ins-rot" type="number" value="${rot}">
    </div>
  `;

  document.getElementById("ins-x").addEventListener("input", (e) => {
    node.x(Number(e.target.value));
    layer.draw();
    pushHistory();
  });

  document.getElementById("ins-y").addEventListener("input", (e) => {
    node.y(Number(e.target.value));
    layer.draw();
    pushHistory();
  });

  document.getElementById("ins-rot").addEventListener("input", (e) => {
    node.rotation(Number(e.target.value));
    layer.draw();
    pushHistory();
  });
}

/* -----------------------------------------------------
   SAVE LAYOUT → BACKEND
----------------------------------------------------- */
document.getElementById("save-btn").addEventListener("click", async () => {
  const json = stage.toJSON();

  const body = {
    konvaJson: JSON.parse(json),
    seatMapId,
    name: "Seating Layout",
    saveAsTemplate: false,
    layoutType: null,
    config: null,
    estimatedCapacity: null,
  };

  const res = await fetch(API_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.ok) {
    alert("Layout saved.");
    seatMapId = data.seatMap.id;
  } else {
    alert("Error saving layout.");
  }
});

/* -----------------------------------------------------
   EXPORT / IMPORT JSON
----------------------------------------------------- */
document.getElementById("export-json-btn").addEventListener("click", () => {
  const json = stage.toJSON();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `seating-${SHOW_ID}.json`;
  a.click();
});

document.getElementById("import-json-btn").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => loadKonvaJSON(evt.target.result);
    reader.readAsText(file);
  };
  input.click();
});

/* -----------------------------------------------------
   CLEAR CANVAS
----------------------------------------------------- */
document.getElementById("clear-btn").addEventListener("click", () => {
  if (!confirm("Clear entire canvas?")) return;
  stage.destroy();

  initStage();
  pushHistory();
});

/* -----------------------------------------------------
   UNDO / REDO BUTTONS
----------------------------------------------------- */
document.getElementById("undo-btn").addEventListener("click", undo);
document.getElementById("redo-btn").addEventListener("click", redo);

/* -----------------------------------------------------
   SETUP CANVAS RESIZE
----------------------------------------------------- */
function setupCanvasResize() {
  window.addEventListener("resize", () => {
    const w = document.getElementById("sb-canvas-container").clientWidth;
    stage.width(w);
    stage.height(window.innerHeight - 20);
    stage.draw();
  });
}

/* -----------------------------------------------------
   LOAD EXISTING MAP IF PRESENT
----------------------------------------------------- */
async function loadExistingMap() {
  const res = await fetch(API_URL, { credentials: "include" });
  const data = await res.json();

  if (data.activeSeatMap && data.activeSeatMap.layout && data.activeSeatMap.layout.konvaJson) {
    const json = data.activeSeatMap.layout.konvaJson;
    seatMapId = data.activeSeatMap.id;

    loadKonvaJSON(json);
    pushHistory();
  } else {
    pushHistory();
  }
}

/* -----------------------------------------------------
   INITIALISE EDITOR
----------------------------------------------------- */
initStage();
loadExistingMap();
