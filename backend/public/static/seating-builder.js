// backend/public/static/seating-builder.js
// TickIn Konva seating builder
//
// - Click a tool on the left, then click on the canvas to add shapes
// - Shapes are draggable, resizable (via Transformer)
// - Cursor changes to hand over shapes, two-headed arrows over resize handles
// - Delete / Backspace removes the selected shape
// - Undo / redo one action at a time
//
// IMPORTANT: history + saved JSON store ONLY the main drawing layer,
// not the grid layer, so the grid always stays clean.

(function () {
  /* global Konva */

  var SHOW_ID = window.__SEATMAP_SHOW_ID__;
  var INITIAL_LAYOUT = window.__SEATMAP_LAYOUT__ || "blank";
  var SAVE_BUTTON = window.__TICKIN_SAVE_BUTTON__;

  if (!SHOW_ID) {
    console.error("seating-builder.js: missing window.__SEATMAP_SHOW_ID__");
  }

  var container = document.getElementById("app");
  if (!container) {
    console.error("seating-builder.js: #app not found");
    return;
  }

  // ---------------------------------------------------------------------------
  // Stage + layers
  // ---------------------------------------------------------------------------

  container.style.width = "100%";
  container.style.height = "100%";

  var stageWidth = container.clientWidth || 1100;
  var stageHeight = container.clientHeight || 640;

  var stage = new Konva.Stage({
    container: "app",
    width: stageWidth,
    height: stageHeight,
  });

  // Separate grid & main drawing layers
  var gridLayer = new Konva.Layer({ listening: false });
  var mainLayer = new Konva.Layer();

  stage.add(gridLayer);
  stage.add(mainLayer);

  // Transformer (for selection + resize)
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
  // State: current tool, history, flags
  // ---------------------------------------------------------------------------

  var currentTool = null; // "section" | "row" | "single" | etc.
  var history = [];
  var historyIndex = -1;

  // If true, the *next* background click will NOT create a new item,
  // it will just deselect (used after drag / resize).
  var suppressNextClickAdd = false;

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  function drawGrid() {
    var gridSize = 40; // 40px squares
    var width = stage.width();
    var height = stage.height();

    gridLayer.destroyChildren();

    for (var x = 0; x <= width; x += gridSize) {
      gridLayer.add(
        new Konva.Line({
          points: [x, 0, x, height],
          stroke: "rgba(148,163,184,0.28)",
          strokeWidth: 0.5,
        })
      );
    }

    for (var y = 0; y <= height; y += gridSize) {
      gridLayer.add(
        new Konva.Line({
          points: [0, y, width, y],
          stroke: "rgba(148,163,184,0.28)",
          strokeWidth: 0.5,
        })
      );
    }

    gridLayer.draw();
  }

  drawGrid();

  // ---------------------------------------------------------------------------
  // History helpers (only serialise mainLayer)
  // ---------------------------------------------------------------------------

  function snapshotMainLayer() {
    try {
      return mainLayer.toJSON();
    } catch (err) {
      console.error("snapshotMainLayer failed", err);
      return null;
    }
  }

  function restoreMainLayerFromJSON(json) {
    try {
      var restored = Konva.Node.create(json);
      if (!(restored instanceof Konva.Layer)) {
        console.error("Expected a Layer JSON but got", restored);
        return;
      }

      stage.remove(mainLayer);
      mainLayer.destroy();

      mainLayer = restored;
      stage.add(mainLayer);

      // Get transformer or recreate it
      transformer = mainLayer.findOne("Transformer");
      if (!transformer) {
        transformer = new Konva.Transformer({
          rotateEnabled: false,
          padding: 10,
          anchorSize: 8,
          borderStroke: "#2563eb",
          borderStrokeWidth: 1,
          anchorStroke: "#2563eb",
          anchorFill: "#ffffff",
          anchorStrokeWidth: 1,
        });
        mainLayer.add(transformer);
      }

      rebindNodeEvents();
      setupTransformerAnchorCursors();
      mainLayer.draw();
      updateSeatCount();
    } catch (err) {
      console.error("restoreMainLayerFromJSON failed", err);
    }
  }

  function pushHistory() {
    var json = snapshotMainLayer();
    if (!json) return;

    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    history.push(json);
    historyIndex = history.length - 1;

    updateSeatCount();
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    restoreMainLayerFromJSON(history[historyIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    restoreMainLayerFromJSON(history[historyIndex]);
  }

  // ---------------------------------------------------------------------------
  // Shape helpers
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

    // Hand cursor behaviour
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
      suppressNextClickAdd = true; // next background click is just deselect
      pushHistory();
    });

    group.on("click tap", function (e) {
      e.cancelBubble = true;
      selectNode(group);
    });

    return group;
  }

  function createSection(x, y) {
    var group = baseGroup(x - 60, y - 30, "section");
    group.add(
      new Konva.Rect({
        width: 120,
        height: 60,
        cornerRadius: 8,
        stroke: "#64748b",
        strokeWidth: 1.4,
        dash: [6, 4],
        fill: "rgba(148,163,184,0.06)",
      })
    );
    mainLayer.add(group);
    return group;
  }

  function createRowOfSeats(x, y) {
    var group = baseGroup(x - 100, y - 12, "row");
    var seatRadius = 6;
    var gap = 8;
    var count = 10;

    for (var i = 0; i < count; i++) {
      group.add(
        new Konva.Circle({
          x: i * (seatRadius * 2 + gap),
          y: 0,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
    }

    mainLayer.add(group);
    return group;
  }

  function createSingleSeat(x, y) {
    var group = baseGroup(x, y, "single");
    group.add(
      new Konva.Circle({
        radius: 7,
        stroke: "#64748b",
        strokeWidth: 1.3,
      })
    );
    mainLayer.add(group);
    return group;
  }

  function createCircularTable(x, y) {
    var group = baseGroup(x, y, "circle-table");

    group.add(
      new Konva.Circle({
        radius: 18,
        stroke: "#64748b",
        strokeWidth: 1.2,
      })
    );

    var seatRadius = 6;
    var seats = 8;
    var r = 32;
    for (var i = 0; i < seats; i++) {
      var angle = (i / seats) * Math.PI * 2;
      var sx = Math.cos(angle) * r;
      var sy = Math.sin(angle) * r;
      group.add(
        new Konva.Circle({
          x: sx,
          y: sy,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
    }

    mainLayer.add(group);
    return group;
  }

  function createRectTable(x, y) {
    var group = baseGroup(x, y, "rect-table");

    group.add(
      new Konva.Rect({
        width: 70,
        height: 30,
        cornerRadius: 6,
        stroke: "#64748b",
        strokeWidth: 1.2,
      })
    );

    var seatRadius = 6;
    var sideSeats = 3;
    var shortSideSeats = 2;

    // top & bottom
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
      group.add(
        new Konva.Circle({
          x: -28 + i * 28,
          y: 22,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
    }

    // sides
    for (var j = 0; j < shortSideSeats; j++) {
      group.add(
        new Konva.Circle({
          x: -40,
          y: -10 + j * 20,
          radius: seatRadius,
          stroke: "#64748b",
          strokeWidth: 1.1,
        })
      );
      group.add(
        new Konva.Circle({
          x: 40,
          y: -10 + j * 20,
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
      selectionSummaryLabel.textContent =
        "Selected " + type + ". Drag to move or resize.";
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

  // Rebind events after restoring from history / backend
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
        suppressNextClickAdd = true;
        pushHistory();
      });
      node.on("click tap", function (e) {
        e.cancelBubble = true;
        selectNode(node);
      });
    });
  }

  transformer.on("transformend", function () {
    suppressNextClickAdd = true;
    pushHistory();
  });

  // ---------------------------------------------------------------------------
  // Stage click behaviour
  // ---------------------------------------------------------------------------

  stage.on("click tap", function (e) {
    var pos = stage.getPointerPosition();
    if (!pos) return;

    var clickedEmpty =
      e.target === stage ||
      e.target.getLayer() === gridLayer ||
      e.target.parent === gridLayer;

    if (clickedEmpty) {
      // If a tool is active & we haven't just dragged/resized, drop a new item
      if (currentTool && !suppressNextClickAdd) {
        var node = createFromTool(currentTool, pos.x, pos.y);
        if (node) {
          selectNode(node);
          pushHistory();
        }
      } else {
        // Just deselect
        selectNode(null);
      }

      // Reset suppression after the first empty click post-drag/resize
      suppressNextClickAdd = false;
    }
    // If clicked on a shape, selection is handled by the group click handler.
    // We don't auto-add another element in that case.
  });

  // ---------------------------------------------------------------------------
  // Tool buttons
  // ---------------------------------------------------------------------------

  toolButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tool = btn.getAttribute("data-tool");
      if (!tool) return;

      if (currentTool === tool) {
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
  // Zoom
  // ---------------------------------------------------------------------------

  var currentScale = 1;

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
    undoBtn.addEventListener("click", undo);
  }

  if (redoBtn) {
    redoBtn.addEventListener("click", redo);
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
  // Delete selected element with Backspace / Delete
  // ---------------------------------------------------------------------------

  document.addEventListener("keydown", function (e) {
    if (e.key === "Delete" || e.key === "Backspace") {
      var nodes = transformer.nodes();
      if (nodes && nodes.length > 0) {
        e.preventDefault();
        nodes.forEach(function (n) {
          n.destroy();
        });
        transformer.nodes([]);
        mainLayer.draw();
        updateSeatCount();
        if (selectionSummaryLabel) {
          selectionSummaryLabel.textContent =
            "Nothing selected. Click on a seat, table or object to see quick details here.";
        }
        pushHistory();
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Seat count
  // ---------------------------------------------------------------------------

  function updateSeatCount() {
    var total = 0;

    mainLayer.find(".sb-object").each(function (node) {
      var type = node.getAttr("sbType");
      if (
        type === "row" ||
        type === "circle-table" ||
        type === "rect-table" ||
        type === "single"
      ) {
        node.find("Circle").each(function () {
          total += 1;
        });
      }
    });

    if (seatCountLabel) {
      seatCountLabel.textContent = total + " seats";
    }
  }

  // ---------------------------------------------------------------------------
  // Save to backend
  // ---------------------------------------------------------------------------

  function gatherLayoutPayload() {
    return {
      layoutType: INITIAL_LAYOUT,
      config: null,
      estimatedCapacity: null,
      konvaJson: snapshotMainLayer(),
    };
  }

  function saveLayout() {
    var payload = gatherLayoutPayload();

    fetch(
      "/admin/seating/builder/api/seatmaps/" + encodeURIComponent(SHOW_ID),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
      .then(function (res) {
        if (!res.ok) throw new Error("Save failed");
        return res.json();
      })
      .then(function () {
        if (!SAVE_BUTTON) return;
        var original = SAVE_BUTTON.textContent;
        SAVE_BUTTON.textContent = "Saved";
        SAVE_BUTTON.disabled = true;
        setTimeout(function () {
          SAVE_BUTTON.textContent = original || "Save layout";
          SAVE_BUTTON.disabled = false;
        }, 1500);
      })
      .catch(function (err) {
        console.error("Failed to save seat map", err);
        if (!SAVE_BUTTON) return;
        var original2 = SAVE_BUTTON.textContent;
        SAVE_BUTTON.textContent = "Error";
        setTimeout(function () {
          SAVE_BUTTON.textContent = original2 || "Save layout";
        }, 2000);
      });
  }

  if (SAVE_BUTTON) {
    SAVE_BUTTON.addEventListener("click", saveLayout);
  }

  // ---------------------------------------------------------------------------
  // Initial load: restore main layer from backend if present
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
          pushHistory();
          return;
        }

        var layout = data.activeSeatMap.layout;
        if (!layout.konvaJson) {
          pushHistory();
          return;
        }

        restoreMainLayerFromJSON(layout.konvaJson);
        pushHistory();
      })
      .catch(function (err) {
        console.error("Error loading existing seat map", err);
        pushHistory();
      });
  }

  loadExisting();
})();
