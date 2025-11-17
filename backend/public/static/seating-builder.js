// backend/public/static/seating-builder.js
// Plain JS Konva seating builder for TickIn
// - Click a tool on the left, then click on the canvas to add shapes
// - All shapes are draggable
// - Selected shape shows resize handles (Konva.Transformer)
// - Cursor changes:
//     • default on empty canvas
//     • grab / grabbing over draggable elements
//     • two-headed arrows over resize handles
// - Undo / redo / clear + zoom + save with full Konva JSON

/* global Konva */

// Read globals injected by admin-seating-builder.ts
var SHOW_ID = window.__SEATMAP_SHOW_ID__;
var INITIAL_LAYOUT = window.__SEATMAP_LAYOUT__ || "blank";
var SAVE_BUTTON = window.__TICKIN_SAVE_BUTTON__;
var BACK_BUTTON = window.__TICKIN_BACK_BUTTON__;

// Basic guard
if (!SHOW_ID) {
  console.error("seating-builder.js: missing window.__SEATMAP_SHOW_ID__");
}

(function () {
  var container = document.getElementById("app");
  if (!container) {
    console.error("seating-builder.js: #app not found");
    return;
  }

  // ---------------------------------------------------------------------------
  // Stage + layers
  // ---------------------------------------------------------------------------

  var stageWidth = container.clientWidth || 1100;
  var stageHeight = container.clientHeight || 640;

  // Resize container so it has a nice ratio
  container.style.width = "100%";
  container.style.height = "100%";

  var stage = new Konva.Stage({
    container: "app",
    width: stageWidth,
    height: stageHeight,
  });

  var gridLayer = new Konva.Layer();
  var mainLayer = new Konva.Layer();
  stage.add(gridLayer);
  stage.add(mainLayer);

  // Transformer for selection / resize
  var transformer = new Konva.Transformer({
    rotateEnabled: false,
    padding: 10,
    anchorSize: 8,
    borderStroke: "#2563eb",
    borderStrokeWidth: 1,
    anchorStroke: "#2563eb",
    anchorFill: "#ffffff",
    anchorStrokeWidth: 1,
    enabledAnchors: [
      "top-left",
      "top-center",
      "top-right",
      "middle-right",
      "bottom-right",
      "bottom-center",
      "bottom-left",
      "middle-left",
    ],
  });
  mainLayer.add(transformer);

  // ---------------------------------------------------------------------------
  // UI references
  // ---------------------------------------------------------------------------

  var toolButtons = Array.prototype.slice.call(
    document.querySelectorAll(".tool-button")
  );
  var undoBtn = document.getElementById("sb-undo");
  var redoBtn = document.getElementById("sb-redo");
  var clearBtn = document.getElementById("sb-clear");
  var zoomInBtn = document.getElementById("sb-zoom-in");
  var zoomOutBtn = document.getElementById("sb-zoom-out");
  var zoomResetBtn = document.getElementById("sb-zoom-reset");
  var seatCountLabel = document.getElementById("sb-seat-count");
  var selectionSummaryLabel = document.getElementById("sb-selection-summary");

  var containerEl = stage.container();

  // ---------------------------------------------------------------------------
  // State: current tool, history for undo / redo
  // ---------------------------------------------------------------------------

  var currentTool = null; // "section" | "row" | "single" | "circle-table" | "rect-table" | "stage" | "bar" | "exit" | "text"

  var history = [];
  var historyIndex = -1;

  function pushHistory() {
    try {
      var json = stage.toJSON();
      // If we've undone some steps, truncate future
      if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
      }
      history.push(json);
      historyIndex = history.length - 1;
      updateSeatCount();
    } catch (err) {
      console.error("Failed to push history", err);
    }
  }

  function loadHistory(index) {
    if (index < 0 || index >= history.length) return;
    try {
      var json = history[index];
      stage.destroyChildren();
      // Recreate layers from JSON
      var restored = Konva.Node.create(json, "app");

      // Note: Node.create will create a new Stage, we only want children
      // So we clear our stage and manually move layers
      stage.add(restored.findOne("Layer:nth-child(1)"));
      stage.add(restored.findOne("Layer:nth-child(2)"));

      // Rewire references
      var layers = stage.getLayers();
      gridLayer = layers[0];
      mainLayer = layers[1];

      // Add transformer back (it’s part of JSON, but we want a reference)
      transformer = mainLayer.findOne("Transformer") || transformer;
      historyIndex = index;

      // Re-attach cursors + drag handlers on shapes
      rebindNodeEvents();
      updateSeatCount();
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }

  function undo() {
    if (historyIndex <= 0) return;
    loadHistory(historyIndex - 1);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    loadHistory(historyIndex + 1);
  }

  // ---------------------------------------------------------------------------
  // Grid background
  // ---------------------------------------------------------------------------

  function drawGrid() {
    var gridSize = 40;
    var width = stage.width();
    var height = stage.height();

    gridLayer.destroyChildren();

    for (var i = 0; i < width / gridSize; i++) {
      gridLayer.add(
        new Konva.Line({
          points: [i * gridSize, 0, i * gridSize, height],
          stroke: "rgba(148,163,184,0.35)",
          strokeWidth: 0.5,
        })
      );
    }
    for (var j = 0; j < height / gridSize; j++) {
      gridLayer.add(
        new Konva.Line({
          points: [0, j * gridSize, width, j * gridSize],
          stroke: "rgba(148,163,184,0.35)",
          strokeWidth: 0.5,
        })
      );
    }

    gridLayer.batchDraw();
  }

  drawGrid();

  // ---------------------------------------------------------------------------
  // Helpers for shapes
  // ---------------------------------------------------------------------------

  var ID_COUNTER = 1;
  function nextId(prefix) {
    ID_COUNTER += 1;
    return prefix + "-" + ID_COUNTER;
  }

  function baseGroup(x, y, type) {
    var group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "sb-object",
      sbType: type,
      id: nextId(type),
    });

    // Hover cursor: hand
    group.on("mouseenter", function () {
      containerEl.style.cursor = "grab";
    });
    group.on("mouseleave", function () {
      containerEl.style.cursor = "default";
    });
    group.on("mousedown", function () {
      containerEl.style.cursor = "grabbing";
    });
    group.on("mouseup", function () {
      containerEl.style.cursor = "grab";
    });
    group.on("dragend", function () {
      pushHistory();
    });

    // Select on click
    group.on("click tap", function (e) {
      e.cancelBubble = true;
      selectNode(group);
    });

    return group;
  }

  function createSection(x, y) {
    var group = baseGroup(x - 60, y - 30, "section");

    var rect = new Konva.Rect({
      width: 120,
      height: 60,
      cornerRadius: 8,
      stroke: "#64748b",
      strokeWidth: 1.4,
      dash: [6, 4],
      fill: "rgba(148, 163, 184, 0.06)",
    });

    group.add(rect);
    mainLayer.add(group);
    return group;
  }

  function createRowOfSeats(x, y) {
    var group = baseGroup(x - 100, y - 12, "row");
    var seatRadius = 6;
    var gap = 8;
    var count = 10;

    for (var i = 0; i < count; i++) {
      var seat = new Konva.Circle({
        x: i * (seatRadius * 2 + gap),
        y: 0,
        radius: seatRadius,
        stroke: "#64748b",
        strokeWidth: 1.1,
      });
      group.add(seat);
    }

    mainLayer.add(group);
    return group;
  }

  function createSingleSeat(x, y) {
    var group = baseGroup(x, y, "single");
    var seat = new Konva.Circle({
      radius: 7,
      stroke: "#64748b",
      strokeWidth: 1.3,
    });
    group.add(seat);
    mainLayer.add(group);
    return group;
  }

  function createCircularTable(x, y) {
    var group = baseGroup(x, y, "circle-table");

    var table = new Konva.Circle({
      radius: 18,
      stroke: "#64748b",
      strokeWidth: 1.2,
    });
    group.add(table);

    var seatRadius = 6;
    var seats = 8;
    var r = 32;
    for (var i = 0; i < seats; i++) {
      var angle = (i / seats) * Math.PI * 2;
      var sx = Math.cos(angle) * r;
      var sy = Math.sin(angle) * r;
      var seat = new Konva.Circle({
        x: sx,
        y: sy,
        radius: seatRadius,
        stroke: "#64748b",
        strokeWidth: 1.1,
      });
      group.add(seat);
    }

    mainLayer.add(group);
    return group;
  }

  function createRectTable(x, y) {
    var group = baseGroup(x, y, "rect-table");

    var table = new Konva.Rect({
      width: 70,
      height: 30,
      cornerRadius: 6,
      stroke: "#64748b",
      strokeWidth: 1.2,
    });
    group.add(table);

    var seatRadius = 6;
    var sideSeats = 3;
    var shortSideSeats = 2;

    // top
    for (var i = 0; i < sideSeats; i++) {
      group.add(
        new Konva.Circle({
          x: -28 + i * 28,
          y: -22,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
    }
    // bottom
    for (var j = 0; j < sideSeats; j++) {
      group.add(
        new Konva.Circle({
          x: -28 + j * 28,
          y: 22,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
    }
    // left
    for (var k = 0; k < shortSideSeats; k++) {
      group.add(
        new Konva.Circle({
          x: -40,
          y: -10 + k * 20,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
    }
    // right
    for (var l = 0; l < shortSideSeats; l++) {
      group.add(
        new Konva.Circle({
          x: 40,
          y: -10 + l * 20,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
    }

    mainLayer.add(group);
    return group;
  }

  function createStage(x, y) {
    var group = baseGroup(x - 80, y - 30, "stage");
    group.add(
      new Konva.Rect({
        width: 160,
        height: 50,
        cornerRadius: 8,
        stroke: "#0f172a",
        strokeWidth: 1.6,
        fill: "rgba(15,23,42,0.04)",
      })
    );
    group.add(
      new Konva.Text({
        text: "STAGE",
        fontSize: 14,
        align: "center",
        width: 160,
        fill: "#0f172a",
        fontStyle: "700",
        y: 15,
      })
    );
    mainLayer.add(group);
    return group;
  }

  function createBar(x, y) {
    var group = baseGroup(x - 60, y - 20, "bar");
    group.add(
      new Konva.Rect({
        width: 120,
        height: 40,
        cornerRadius: 6,
        stroke: "#0f766e",
        strokeWidth: 1.4,
        fill: "rgba(13,148,136,0.05)",
      })
    );
    group.add(
      new Konva.Text({
        text: "Bar / kiosk",
        fontSize: 13,
        align: "center",
        width: 120,
        fill: "#0f766e",
        y: 11,
      })
    );
    mainLayer.add(group);
    return group;
  }

  function createExit(x, y) {
    var group = baseGroup(x - 30, y - 20, "exit");
    group.add(
      new Konva.Rect({
        width: 60,
        height: 32,
        cornerRadius: 5,
        stroke: "#16a34a",
        strokeWidth: 1.5,
      })
    );
    group.add(
      new Konva.Text({
        text: "EXIT",
        fontSize: 13,
        align: "center",
        width: 60,
        fill: "#16a34a",
        y: 8,
      })
    );
    mainLayer.add(group);
    return group;
  }

  function createTextLabel(x, y) {
    var group = baseGroup(x, y, "text");
    group.add(
      new Konva.Text({
        text: "Label",
        fontSize: 14,
        fill: "#111827",
      })
    );
    mainLayer.add(group);
    return group;
  }

  function createFromTool(tool, x, y) {
    switch (tool) {
      case "section":
        return createSection(x, y);
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

  // ---------------------------------------------------------------------------
  // Selection + transformer cursors
  // ---------------------------------------------------------------------------

  function selectNode(node) {
    if (!node) {
      transformer.nodes([]);
      containerEl.style.cursor = "default";
      if (selectionSummaryLabel) {
        selectionSummaryLabel.textContent =
          "Nothing selected. Click on a seat, table or object to see quick details here.";
      }
      mainLayer.draw();
      return;
    }

    transformer.nodes([node]);
    setupTransformerAnchorCursors();

    if (selectionSummaryLabel) {
      var type = node.getAttr("sbType") || "object";
      selectionSummaryLabel.textContent = "Selected " + type + ". Drag to move or resize.";
    }

    mainLayer.draw();
  }

  function setupTransformerAnchorCursors() {
    var anchors = transformer.find("Rect");
    anchors.each(function (anchor) {
      var name = anchor.name();
      var cursor = "nwse-resize";

      switch (name) {
        case "top-left":
        case "bottom-right":
          cursor = "nwse-resize";
          break;
        case "top-right":
        case "bottom-left":
          cursor = "nesw-resize";
          break;
        case "top-center":
        case "bottom-center":
          cursor = "ns-resize";
          break;
        case "middle-left":
        case "middle-right":
          cursor = "ew-resize";
          break;
      }

      anchor.on("mouseenter", function () {
        containerEl.style.cursor = cursor;
      });
      anchor.on("mouseleave", function () {
        containerEl.style.cursor = "default";
      });
    });
  }

  // Re-attach hover / drag events if we restore from history
  function rebindNodeEvents() {
    mainLayer.find(".sb-object").each(function (node) {
      node.off("mouseenter mouseleave mousedown mouseup dragend click tap");

      node.on("mouseenter", function () {
        containerEl.style.cursor = "grab";
      });
      node.on("mouseleave", function () {
        containerEl.style.cursor = "default";
      });
      node.on("mousedown", function () {
        containerEl.style.cursor = "grabbing";
      });
      node.on("mouseup", function () {
        containerEl.style.cursor = "grab";
      });
      node.on("dragend", function () {
        pushHistory();
      });
      node.on("click tap", function (e) {
        e.cancelBubble = true;
        selectNode(node);
      });
    });
  }

  // Background click = deselect
  stage.on("click tap", function (e) {
    if (e.target === stage || e.target === gridLayer || e.target.parent === gridLayer) {
      // Clicked on empty area
      selectNode(null);

      if (currentTool) {
        // Add shape on click if a tool is active
        var pos = stage.getPointerPosition();
        if (!pos) return;
        var n = createFromTool(currentTool, pos.x, pos.y);
        if (n) {
          selectNode(n);
          pushHistory();
        }
      }
    } else if (currentTool) {
      // If clicked on a shape while a tool is active, still create new
      var pos2 = stage.getPointerPosition();
      if (!pos2) return;
      var n2 = createFromTool(currentTool, pos2.x, pos2.y);
      if (n2) {
        selectNode(n2);
        pushHistory();
      }
    }
  });

  // Transform end → save new state
  transformer.on("transformend", function () {
    pushHistory();
  });

  // ---------------------------------------------------------------------------
  // Tool button handling
  // ---------------------------------------------------------------------------

  toolButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tool = btn.getAttribute("data-tool");
      if (!tool) return;

      if (currentTool === tool) {
        // toggle off
        currentTool = null;
        btn.classList.remove("is-active");
      } else {
        currentTool = tool;
        toolButtons.forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Zoom controls
  // ---------------------------------------------------------------------------

  function setZoom(scale, center) {
    var oldScale = stage.scaleX();
    var pointer = center || { x: stage.width() / 2, y: stage.height() / 2 };

    var mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    stage.scale({ x: scale, y: scale });

    var newPos = {
      x: pointer.x - mousePointTo.x * scale,
      y: pointer.y - mousePointTo.y * scale,
    };
    stage.position(newPos);
    stage.batchDraw();

    if (zoomResetBtn) {
      zoomResetBtn.textContent = Math.round(scale * 100) + "%";
    }
  }

  var currentScale = 1;

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", function () {
      currentScale = Math.min(3, currentScale + 0.1);
      setZoom(currentScale);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", function () {
      currentScale = Math.max(0.4, currentScale - 0.1);
      setZoom(currentScale);
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", function () {
      currentScale = 1;
      stage.position({ x: 0, y: 0 });
      setZoom(currentScale);
    });
  }

  // ---------------------------------------------------------------------------
  // Undo / redo / clear
  // ---------------------------------------------------------------------------

  if (undoBtn) {
    undoBtn.addEventListener("click", function () {
      undo();
    });
  }

  if (redoBtn) {
    redoBtn.addEventListener("click", function () {
      redo();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      mainLayer.destroyChildren();
      mainLayer.add(transformer);
      selectNode(null);
      pushHistory();
    });
  }

  // ---------------------------------------------------------------------------
  // Seat count + inspector
  // ---------------------------------------------------------------------------

  function updateSeatCount() {
    var total = 0;
    // seats are circles that are not part of stage / bar / exit / text etc.
    mainLayer.find(".sb-object").each(function (node) {
      var type = node.getAttr("sbType");
      if (type === "row" || type === "circle-table" || type === "rect-table" || type === "single") {
        // Count circles underneath
        node.find("Circle").each(function (c) {
          total += 1;
        });
      }
    });

    if (seatCountLabel) {
      seatCountLabel.textContent = total + " seats";
    }
  }

  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  function gatherLayoutPayload() {
    return {
      layoutType: INITIAL_LAYOUT,
      config: null,
      estimatedCapacity: null,
      konvaJson: stage.toJSON(),
    };
  }

  function saveLayout() {
    var payload = gatherLayoutPayload();

    fetch(
      "/admin/seating/builder/api/seatmaps/" + encodeURIComponent(SHOW_ID),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    )
      .then(function (res) {
        if (!res.ok) throw new Error("Save failed");
        return res.json();
      })
      .then(function () {
        if (SAVE_BUTTON) {
          var original = SAVE_BUTTON.textContent;
          SAVE_BUTTON.textContent = "Saved";
          SAVE_BUTTON.disabled = true;
          setTimeout(function () {
            SAVE_BUTTON.textContent = original || "Save layout";
            SAVE_BUTTON.disabled = false;
          }, 1500);
        }
      })
      .catch(function (err) {
        console.error("Failed to save seat map", err);
        if (SAVE_BUTTON) {
          var original2 = SAVE_BUTTON.textContent;
          SAVE_BUTTON.textContent = "Error";
          SAVE_BUTTON.disabled = false;
          setTimeout(function () {
            SAVE_BUTTON.textContent = original2 || "Save layout";
          }, 2000);
        }
      });
  }

  if (SAVE_BUTTON) {
    SAVE_BUTTON.addEventListener("click", saveLayout);
  }

  // ---------------------------------------------------------------------------
  // Initial load: if we have an existing layout with konvaJson, restore it
  // ---------------------------------------------------------------------------

  function loadExisting() {
    fetch(
      "/admin/seating/builder/api/seatmaps/" + encodeURIComponent(SHOW_ID)
    )
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.activeSeatMap || !data.activeSeatMap.layout) {
          // nothing yet – blank grid
          pushHistory();
          return;
        }

        var layout = data.activeSeatMap.layout;
        if (!layout.konvaJson) {
          pushHistory();
          return;
        }

        try {
          var json = layout.konvaJson;
          // Rebuild from JSON
          stage.destroyChildren();
          var restored = Konva.Node.create(json, "app");
          stage.add(restored.findOne("Layer:nth-child(1)"));
          stage.add(restored.findOne("Layer:nth-child(2)"));

          var layers = stage.getLayers();
          gridLayer = layers[0];
          mainLayer = layers[1];

          transformer = mainLayer.findOne("Transformer") || transformer;
          if (!transformer) {
            transformer = new Konva.Transformer({
              rotateEnabled: false,
              padding: 10,
            });
            mainLayer.add(transformer);
          }

          drawGrid();
          rebindNodeEvents();
          updateSeatCount();
          pushHistory();
        } catch (err) {
          console.error("Failed to restore layout from konvaJson", err);
          stage.destroyChildren();
          stage.add(gridLayer);
          stage.add(mainLayer);
          mainLayer.add(transformer);
          drawGrid();
          pushHistory();
        }
      })
      .catch(function (err) {
        console.error("Error loading existing seat map", err);
        pushHistory();
      });
  }

  loadExisting();
})();
