(() => {
  "use strict";

  const STORAGE_KEY = "simple-whiteboard-v1";
  const canvas = document.querySelector("#board");
  const context = canvas.getContext("2d");
  const penButton = document.querySelector("#penButton");
  const eraserButton = document.querySelector("#eraserButton");
  const undoButton = document.querySelector("#undoButton");
  const redoButton = document.querySelector("#redoButton");
  const clearButton = document.querySelector("#clearButton");
  const colorInput = document.querySelector("#colorInput");
  const sizeInput = document.querySelector("#sizeInput");
  const sizeOutput = document.querySelector("#sizeOutput");
  const saveStatus = document.querySelector("#saveStatus");

  let strokes = loadStrokes();
  let undoStack = [];
  let redoStack = [];
  let activeStroke = null;
  let tool = "pen";

  function loadStrokes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved?.strokes) ? saved.strokes : [];
    } catch {
      return [];
    }
  }

  function cloneStrokes(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, strokes }));
      saveStatus.textContent = "保存しました";
    } catch {
      saveStatus.textContent = "保存できませんでした";
    }
  }

  function updateButtons() {
    undoButton.disabled = undoStack.length === 0;
    redoButton.disabled = redoStack.length === 0;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }

  function drawStroke(stroke) {
    if (!stroke.points.length) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.save();
    context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    const first = stroke.points[0];
    context.moveTo(first.x * width, first.y * height);
    for (let index = 1; index < stroke.points.length; index += 1) {
      const point = stroke.points[index];
      context.lineTo(point.x * width, point.y * height);
    }
    if (stroke.points.length === 1) {
      context.arc(first.x * width, first.y * height, stroke.size / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.stroke();
    }
    context.restore();
  }

  function render() {
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    strokes.forEach(drawStroke);
    if (activeStroke) drawStroke(activeStroke);
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }

  function startDrawing(event) {
    if (activeStroke || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    activeStroke = {
      tool,
      color: colorInput.value,
      size: tool === "eraser" ? Number(sizeInput.value) * 2 : Number(sizeInput.value),
      points: [pointFromEvent(event)]
    };
    render();
  }

  function continueDrawing(event) {
    if (!activeStroke || !canvas.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const events = event.getCoalescedEvents?.() ?? [event];
    events.forEach((coalescedEvent) => activeStroke.points.push(pointFromEvent(coalescedEvent)));
    render();
  }

  function finishDrawing(event) {
    if (!activeStroke) return;
    event.preventDefault();
    undoStack.push(cloneStrokes(strokes));
    strokes.push(activeStroke);
    activeStroke = null;
    redoStack = [];
    save();
    updateButtons();
    render();
  }

  function setTool(nextTool) {
    tool = nextTool;
    const usingPen = tool === "pen";
    penButton.classList.toggle("is-active", usingPen);
    eraserButton.classList.toggle("is-active", !usingPen);
    penButton.setAttribute("aria-pressed", String(usingPen));
    eraserButton.setAttribute("aria-pressed", String(!usingPen));
  }

  function restore(next, destination) {
    destination.push(cloneStrokes(strokes));
    strokes = next.pop();
    save();
    updateButtons();
    render();
  }

  penButton.addEventListener("click", () => setTool("pen"));
  eraserButton.addEventListener("click", () => setTool("eraser"));
  undoButton.addEventListener("click", () => restore(undoStack, redoStack));
  redoButton.addEventListener("click", () => restore(redoStack, undoStack));
  clearButton.addEventListener("click", () => {
    if (strokes.length === 0 || !window.confirm("描画をすべて消去しますか？")) return;
    undoStack.push(cloneStrokes(strokes));
    strokes = [];
    redoStack = [];
    save();
    updateButtons();
    render();
  });
  sizeInput.addEventListener("input", () => { sizeOutput.value = sizeInput.value; });
  canvas.addEventListener("pointerdown", startDrawing);
  canvas.addEventListener("pointermove", continueDrawing);
  canvas.addEventListener("pointerup", finishDrawing);
  canvas.addEventListener("pointercancel", finishDrawing);
  window.addEventListener("resize", resizeCanvas);

  new ResizeObserver(resizeCanvas).observe(canvas);
  updateButtons();
  resizeCanvas();
})();
