// backend/public/static/seating-builder.js
// Plain browser JS – Konva-based seating builder for TickIn

(function () {
  // ---------------------------------------------------------------------------
  // Bootstrap & globals
  // ---------------------------------------------------------------------------
  var showId = window.__SEATMAP_SHOW_ID__;
  var initialLayoutType = window.__SEATMAP_LAYOUT__ || "tables";

  var saveButton = window.__TICKIN_SAVE_BUTTON__;
  var backButton = window.__TICKIN_BACK_BUTTON__;

  var toolButtons = Array.prototype.slice.call(
    document.querySelectorAll(".tool-button")
  );
  var undoBtn = document.getElementById("sb-undo");
  var redoBtn = document.getElementById("sb-redo");
  var clearBtn = document.getElementById("sb-clear");

  var zoomInBtn = document.getElementById("sb-zoom-in");
  var zoomOutBtn = document.getElementById("sb-zoom-out");
  var zoomResetBtn = document.getElementById("sb-zoom-reset");
  var zoomLabel = document.getElementById("sb-zoom-reset");

  var selectionSummaryEl = document.getElementById("sb-selection-summary");
  var seatCountEl = document.getElementById("sb-seat-count");

  var appContainer = document.getElementById("app");

  if (!appContainer) {
    console.error("[seating-builder] #app container not found");
    return;
  }

  // Konva stage + layers
  var stage = null;
  var mainLayer = null;
  var transformer = null;

  // current tool ("section", "row", etc) or null for selection
  var currentTool = null;

  // seatMap id if we are editing an existing record
  var currentSeatMapId = null;

  // history
  var undoStack = [];
  var redoStack = [];

  // zoom
  var currentZoom = 1;

  // ---------------------------------------------------------------------------
  // Stage / layer initialisation
  // ---------------------------------------------------------------------------
  function createStage() {
    var rect = appContainer.getBoundingClientRect();
    var width = Math.max(200, rect.width);
    var height = Math.max(200, rect.height);

    stage = new Konva.Stage({
      container: appContainer,
      width: width,
      height: height,
    });

    mainLayer = new Konva.Layer();
    stage.add(mainLayer);

    transformer = new Konva.Transformer({
      rotateEnabled: true,
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
      boundBoxFunc: function (oldBox, newBox) {
        // Avoid shapes going negative size
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox;
        }
        return newBox;
      },
    });

    mainLayer.add(transformer);
    mainLayer.draw();

    wireStageEvents();
    snapshot("initial");
  }

  function resizeStage() {
    if (!stage) return;
    var rect = appContainer.getBoundingClientRect();
    var width = Math.max(200, rect.width);
    var height = Math.max(200, rect.height);
    stage.size({ width: width, height: height });
    stage.draw();
  }

  window.addEventListener("resize", resizeStage);

  // ---------------------------------------------------------------------------
  // History helpers
  // ---------------------------------------------------------------------------

  function snapshot(reason) {
    if (!stage) return;
    try {
      var json = stage.toJSON();
      undoStack.push(json);
      // limit memory
      if (undoStack.length > 50) {
        undoStack.shift();
      }
      redoStack.length = 0;
    } catch (e) {
      console.warn("[seating-builder] snapshot error", reason, e);
    }
  }

  function loadFromJSON(json) {
    if (!json) return;
    try {
      // Destroy old stage & rebuild
      stage.destroy();
      var rect = appContainer.getBoundingClientRect();
      var width = Math.max(200, rect.width);
      var height = Math.max(200, rect.height);

      var newStage = Konva.Node.create(json, appContainer);
      // Ensure container + size are correct
      newStage.container(appContainer);
      newStage.size({ width: width, height: height });

      stage = newStage;
      // mainLayer: first non-transformer layer
      mainLayer = stage.children[0];
      if (!(mainLayer instanceof Konva.Layer)) {
        mainLayer = new Konva.Layer();
        stage.add(mainLayer);
      }

      // Find transformer if exists, else create
      transformer = null;
      stage.find("Transformer").each(function (tr) {
        if (!transformer) transformer = tr;
        else tr.destroy();
      });
      if (!transformer) {
        transformer = new Konva.Transformer({
          rotateEnabled: true,
        });
        mainLayer.add(transformer);
      }

      attachShapeHandlers();
      stage.draw();
      updateSeatCount();
      updateSelectionSummary(null);
    } catch (err) {
      console.error("[seating-builder] loadFromJSON error", err);
    }
  }

  function undo() {
    if (undoStack.length <= 1) return;
    var current = undoStack.pop();
    redoStack.push(current);
    var prev = undoStack[undoStack.length - 1];
    loadFromJSON(prev);
  }

  function redo() {
    if (!redoStack.length) return;
    var next = redoStack.pop();
    undoStack.push(next);
    loadFromJSON(next);
  }

  // ---------------------------------------------------------------------------
  // Shape creation helpers
  // ---------------------------------------------------------------------------

  function createSeatCircle(x, y) {
    return new Konva.Circle({
      x: x,
      y: y,
      radius: 7,
      stroke: "#4b5563",
      strokeWidth: 1,
      fill: "#ffffff",
      draggable: true,
      name: "seat",
      seatType: "single",
      isSeat: true,
    });
  }

  function createSectionBlock(x, y) {
    return new Konva.Rect({
      x: x - 60,
      y: y - 40,
      width: 120,
      height: 80,
      cornerRadius: 8,
      stroke: "#4b5563",
      strokeWidth: 1.2,
      fill: "#ffffff",
      draggable: true,
      name: "section",
    });
  }

  function createRowOfSeats(x, y) {
    var group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "row",
    });

    var seatCount = 8;
    var spacing = 20;

    for (var i = 0; i < seatCount; i++) {
      var seat = createSeatCircle(i * spacing, 0);
      seat.setAttrs({
        seatType: "row",
        isSeat: true,
      });
      group.add(seat);
    }

    return group;
  }

  function createCircularTable(x, y) {
    var group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "table-circle",
    });

    var table = new Konva.Circle({
      x: 0,
      y: 0,
      radius: 30,
      stroke: "#4b5563",
      strokeWidth: 1.4,
      fill: "#ffffff",
    });
    group.add(table);

    var seats = 8;
    var radius = 46;
    for (var i = 0; i < seats; i++) {
      var angle = (i / seats) * Math.PI * 2;
      var sx = Math.cos(angle) * radius;
      var sy = Math.sin(angle) * radius;
      var seat = createSeatCircle(sx, sy);
      seat.setAttrs({
        seatType: "table-circle",
        isSeat: true,
      });
      group.add(seat);
    }

    return group;
  }

  function createRectTable(x, y) {
    var group = new Konva.Group({
      x: x,
      y: y,
      draggable: true,
      name: "table-rect",
    });

    var table = new Konva.Rect({
      x: -40,
      y: -22,
      width: 80,
      height: 44,
      cornerRadius: 6,
      stroke: "#4b5563",
      strokeWidth: 1.4,
      fill: "#ffffff",
    });
    group.add(table);

    var seatsPerSide = 3;
    var spacing = 22;
    var offsetX = -((seatsPerSide - 1) * spacing) / 2;

    // top
    for (var i = 0; i < seatsPerSide; i++) {
      var seatTop = createSeatCircle(offsetX + i * spacing, -36);
      seatTop.setAttrs({ seatType: "table-rect", isSeat: true });
      group.add(seatTop);
    }

    // bottom
    for (var j = 0; j < seatsPerSide; j++) {
      var seatBottom = createSeatCircle(offsetX + j * spacing, 36);
      seatBottom.setAttrs({ seatType: "table-rect", isSeat: true });
      group.add(seatBottom);
    }

    return group;
  }

  function createStageBlock(x, y) {
    return new Konva.Rect({
      x: x - 80,
      y: y - 20,
      width: 160,
      height: 40,
      cornerRadius: 6,
      stroke: "#4b5563",
      strokeWidth: 1.4,
      fill: "#e5e7eb",
      name: "stage",
      draggable: true,
    });
  }

  function createBarBlock(x, y) {
    return new Konva.Rect({
      x: x - 50,
      y: y - 18,
      width: 100,
      height: 36,
      cornerRadius: 6,
      stroke: "#4b5563",
      strokeWidth: 1.4,
      fill: "#f9fafb",
      name: "bar",
      draggable: true,
    });
  }

  function createExitBlock(x, y) {
    return new Konva.Rect({
      x: x - 30,
      y: y - 16,
      width: 60,
      height: 32,
      cornerRadius: 4,
      stroke: "#16a34a",
      strokeWidth: 1.4,
      fill: "#ecfdf3",
      name: "exit",
      draggable: true,
    });
  }

  function createTextLabel(x, y) {
    return new Konva.Text({
      x: x,
      y: y,
      text: "Label",
      fontSize: 14,
      fontFamily: "system-ui",
      fill: "#374151",
      draggable: true,
      name: "label",
    });
  }

  // ---------------------------------------------------------------------------
  // Selection + interaction
  // ---------------------------------------------------------------------------

  function clearSelection() {
    transformer.nodes([]);
    mainLayer.draw();
    updateSelectionSummary(null);
  }

  function selectNode(node) {
    if (!node) {
      clearSelection();
      return;
    }

    transformer.nodes([node]);
    mainLayer.draw();
    updateSelectionSummary(node);
  }

  function nodeIsSelectable(node) {
    if (!node) return false;
    // Only seats / tables / blocks / labels, not the transformer, etc.
    var name = node.name();
    if (!name) return false;
    if (name === "transformer") return false;
    return true;
  }

  function updateSelectionSummary(node) {
    if (!selectionSummaryEl) return;

    if (!node || !nodeIsSelectable(node)) {
      selectionSummaryEl.textContent =
        "Nothing selected. Click on a seat, table or object to see quick details here.";
      return;
    }

    var name = node.name() || "";
    var seats = 0;

    if (node.getAttr("isSeat")) {
      seats = 1;
    } else if (node instanceof Konva.Group) {
      node.find(function (n) {
        if (n.getAttr("isSeat")) seats++;
      });
    }

    var summaryParts = [];

    if (name === "section") summaryParts.push("Section block");
    else if (name === "row") summaryParts.push("Row of seats");
    else if (name === "table-circle") summaryParts.push("Circular table");
    else if (name === "table-rect") summaryParts.push("Rectangular table");
    else if (name === "stage") summaryParts.push("Stage");
    else if (name === "bar") summaryParts.push("Bar / kiosk");
    else if (name === "exit") summaryParts.push("Exit");
    else if (name === "label") summaryParts.push("Text label");
    else summaryParts.push("Object");

    if (seats > 0) {
      summaryParts.push("Contains " + seats + " seat" + (seats === 1 ? "" : "s"));
    }

    selectionSummaryEl.textContent = summaryParts.join(" · ");
  }

  function updateSeatCount() {
    if (!seatCountEl) return;
    if (!stage) {
      seatCountEl.textContent = "0 seats";
      return;
    }

    var count = 0;
    stage.find(function (node) {
      if (node.getAttr && node.getAttr("isSeat")) count++;
    });

    seatCountEl.textContent = count + " seat" + (count === 1 ? "" : "s");
  }

  function attachShapeHandlers() {
    if (!stage) return;

    stage.find("Circle, Rect, Text, Group").each(function (node) {
      if (!nodeIsSelectable(node)) return;

      node.on("mousedown touchstart", function (e) {
        // prevent stage click from also firing
        e.cancelBubble = true;
        selectNode(node);
      });

      node.on("dragend transformend", function () {
        updateSeatCount();
        snapshot("move/transform");
      });

      node.on("dblclick dbltap", function () {
        // quick text edit for labels
        if (node.name() === "label") {
          var newText = window.prompt("Edit label text:", node.text());
          if (typeof newText === "string") {
            node.text(newText);
            mainLayer.draw();
            snapshot("edit-label");
          }
        }
      });
    });
  }

  function wireStageEvents() {
    if (!stage) return;

    // Click on empty space = clear selection
    stage.on("mousedown", function (e) {
      // only fire when clicking stage (not on a shape)
      if (e.target === stage) {
        clearSelection();
      } else if (!currentTool) {
        // selection mode: select shape
        if (nodeIsSelectable(e.target)) {
          selectNode(e.target);
        }
      }
    });

    // Click-to-place tool
    stage.on("mouseup touchend", function (e) {
      if (!currentTool) return;
      if (e.target !== stage) return; // avoid placing on top of shapes
      var pos = stage.getPointerPosition();
      if (!pos) return;

      var shape = null;

      switch (currentTool) {
        case "section":
          shape = createSectionBlock(pos.x, pos.y);
          break;
        case "row":
          shape = createRowOfSeats(pos.x, pos.y);
          break;
        case "single":
          shape = createSeatCircle(pos.x, pos.y);
          break;
        case "circle-table":
          shape = createCircularTable(pos.x, pos.y);
          break;
        case "rect-table":
          shape = createRectTable(pos.x, pos.y);
          break;
        case "stage":
          shape = createStageBlock(pos.x, pos.y);
          break;
        case "bar":
          shape = createBarBlock(pos.x, pos.y);
          break;
        case "exit":
          shape = createExitBlock(pos.x, pos.y);
          break;
        case "text":
          shape = createTextLabel(pos.x, pos.y);
          break;
        default:
          break;
      }

      if (shape) {
        mainLayer.add(shape);
        attachShapeHandlers(); // ensure handlers bound
        mainLayer.draw();
        updateSeatCount();
        snapshot("place-" + currentTool);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Toolbar wiring
  // ---------------------------------------------------------------------------

  function setTool(toolName) {
    currentTool = toolName;

    toolButtons.forEach(function (btn) {
      btn.classList.remove("is-active");
      var t = btn.getAttribute("data-tool");
      if (t === toolName) {
        btn.classList.add("is-active");
      }
    });

    if (!toolName) {
      document.body.style.cursor = "default";
    } else {
      document.body.style.cursor = "crosshair";
    }
  }

  function wireToolbar() {
    toolButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var toolName = btn.getAttribute("data-tool");
        if (!toolName) return;
        if (currentTool === toolName) {
          // toggle off
          setTool(null);
        } else {
          setTool(toolName);
        }
      });
    });

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
        if (!stage) return;
        var ok = window.confirm(
          "Clear the entire canvas? This cannot be undone except via Undo."
        );
        if (!ok) return;

        // Remove all children except the transformer
        mainLayer.destroyChildren();
        mainLayer.add(transformer);
        mainLayer.draw();
        updateSeatCount();
        clearSelection();
        snapshot("clear");
      });
    }

    // Zoom
    function setZoom(factor) {
      if (!stage) return;
      currentZoom = Math.max(0.25, Math.min(4, factor));
      stage.scale({ x: currentZoom, y: currentZoom });

      // keep centre roughly fixed
      var rect = appContainer.getBoundingClientRect();
      stage.position({ x: 0, y: 0 });
      stage.draw();

      if (zoomLabel) {
        zoomLabel.textContent = Math.round(currentZoom * 100) + "%";
      }
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", function () {
        setZoom(currentZoom * 1.1);
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", function () {
        setZoom(currentZoom / 1.1);
      });
    }

    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", function () {
        setZoom(1);
      });
    }

    // default: selection mode
    setTool(null);
    setZoom(1);
  }

  // ---------------------------------------------------------------------------
  // Save / load from backend
  // ---------------------------------------------------------------------------

  function loadExistingSeatMap() {
    if (!showId) return Promise.resolve();

    return fetch("/admin/seating/builder/api/seatmaps/" + showId)
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.activeSeatMap) return;
        currentSeatMapId = data.activeSeatMap.id || null;

        var layout = data.activeSeatMap.layout || {};
        if (layout && layout.konvaJson) {
          loadFromJSON(layout.konvaJson);
          // After load, take new snapshot baseline
          snapshot("loaded-from-server");
        }
      })
      .catch(function (err) {
        console.error("[seating-builder] Failed to load existing seat map", err);
      });
  }

  function gatherLayoutPayload() {
    if (!stage) return null;

    var konvaJson = stage.toJSON();

    // optional: estimate seats quickly
    var estimatedCapacity = 0;
    stage.find(function (node) {
      if (node.getAttr && node.getAttr("isSeat")) estimatedCapacity++;
    });

    return {
      seatMapId: currentSeatMapId || undefined,
      saveAsTemplate: false,
      name: null, // let backend auto-name
      layoutType: initialLayoutType || null,
      config: null,
      estimatedCapacity: estimatedCapacity || null,
      konvaJson: konvaJson,
    };
  }

  function wireSaveButton() {
    if (!saveButton) return;

    saveButton.addEventListener("click", function () {
      if (!showId) {
        window.alert("Cannot save: show id missing.");
        return;
      }
      if (!stage) {
        window.alert("Canvas not ready yet.");
        return;
      }

      var payload = gatherLayoutPayload();
      if (!payload) return;

      saveButton.disabled = true;
      saveButton.textContent = "Saving…";

      fetch("/admin/seating/builder/api/seatmaps/" + showId, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed with " + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data && data.seatMap && data.seatMap.id) {
            currentSeatMapId = data.seatMap.id;
          }
          saveButton.textContent = "Saved";
          setTimeout(function () {
            saveButton.textContent = "Save layout";
          }, 1200);
        })
        .catch(function (err) {
          console.error("[seating-builder] Save failed", err);
          window.alert(
            "Sorry, we couldn't save this layout. Please try again in a moment."
          );
          saveButton.textContent = "Save layout";
        })
        .finally(function () {
          saveButton.disabled = false;
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    createStage();
    wireToolbar();
    wireSaveButton();

    // load any existing layout
    loadExistingSeatMap().then(function () {
      // ensure seat count & selection summary are correct even if no layout
      updateSeatCount();
      updateSelectionSummary(null);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
