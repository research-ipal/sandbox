// === SAME IMPORTS / SETUP (unchanged) ===
const participantIdInput = document.getElementById("participantIdInput");
const participantIdStatus = document.getElementById("participantIdStatus");
const clipLabel = document.getElementById("clipLabel");
const replayBtn = document.getElementById("replayBtn");
const video = document.getElementById("caseVideo");
const finalFrameCanvas = document.getElementById("finalFrame");
const annotationCanvas = document.getElementById("annotationCanvas");
const canvasContainer = document.getElementById("canvasContainer");
const clearLineBtn = document.getElementById("clearLineBtn");
const videoStatus = document.getElementById("videoStatus");
const annotationStatus = document.getElementById("annotationStatus");
const toastTemplate = document.getElementById("toastTemplate");
const submitAnnotationBtn = document.getElementById("submitAnnotationBtn");
const submissionStatus = document.getElementById("submissionStatus");

const overlayCtx = finalFrameCanvas.getContext("2d");
const annotationCtx = annotationCanvas.getContext("2d");

const EXPERT_ANNOTATION_BASE_URL = "expert-annotations/";

// === STATE ===
let frameCaptured = false;
let finalFrameBuffered = false; // ✅ NEW FIX
let currentClip = null;
let activeLine = null;
let expertLines = null;
let pointerDown = false;
let latestPayload = null;
let submissionInFlight = false;
let capturedFrameTimeValue = 0;

let currentClipIndex = 0;
let clips = [];

// === MOBILE-SAFE CANVAS RESIZE ===
function resizeCanvases(videoWidth, videoHeight) {
  const MAX_WIDTH = 1920;

  let width = videoWidth;
  let height = videoHeight;

  if (width > MAX_WIDTH) {
    const ratio = MAX_WIDTH / width;
    width = MAX_WIDTH;
    height = videoHeight * ratio;
  }

  finalFrameCanvas.width = width;
  finalFrameCanvas.height = height;
  annotationCanvas.width = width;
  annotationCanvas.height = height;
}

// === BUFFER FRAME (KEY FIX) ===
function bufferFrame(source) {
  if (!source.videoWidth || !source.videoHeight) return false;

  resizeCanvases(source.videoWidth, source.videoHeight);

  overlayCtx.drawImage(source, 0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

  finalFrameBuffered = true;
  return true;
}

// === REVEAL FRAME ===
function revealCapturedFrame() {
  if (!finalFrameBuffered) return;

  frameCaptured = true;
  canvasContainer.hidden = false;

  finalFrameCanvas.style.display = "block";
  finalFrameCanvas.style.position = "absolute";
  finalFrameCanvas.style.top = "0";
  finalFrameCanvas.style.left = "0";
  finalFrameCanvas.style.zIndex = "1";

  annotationCanvas.style.position = "relative";
  annotationCanvas.style.zIndex = "2";

  redrawCanvas();

  replayBtn.disabled = false;

  const numericTime = Number(((video.currentTime || 0)).toFixed(3));
  capturedFrameTimeValue = Number.isFinite(numericTime) ? numericTime : 0;
}

// === VIDEO EVENTS (FIXED) ===
function handleVideoTimeUpdate() {
  if (frameCaptured) return;

  const duration = Number.isFinite(video.duration) ? video.duration : null;
  if (!duration) return;

  const remaining = duration - video.currentTime;

  // ✅ CRITICAL FIX: capture during last second
  if (remaining <= 1.0) {
    bufferFrame(video);
  }
}

function handleVideoEnded() {
  if (frameCaptured) return;

  video.controls = true;
  video.setAttribute("controls", "");

  if (finalFrameBuffered) {
    revealCapturedFrame();
  } else {
    const target = Math.max(0, video.duration - 0.1);

    video.addEventListener(
      "seeked",
      () => {
        if (bufferFrame(video)) {
          revealCapturedFrame();
        }
      },
      { once: true }
    );

    video.currentTime = target;
  }
}

// === KEEP YOUR EXISTING LOGIC BELOW ===
// (drawing, overlays, submission, etc.)

function redrawCanvas() {
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

  if (expertLines && Array.isArray(expertLines.incisionDetails)) {
    const ctx = annotationCtx;
    const width = annotationCanvas.width;
    const height = annotationCanvas.height;

    ctx.strokeStyle = "rgba(0,255,0,0.7)";
    ctx.lineWidth = Math.max(2, width * 0.005);
    ctx.setLineDash([8, 6]);

    expertLines.incisionDetails.forEach((detail) => {
      const n = detail.normalized;

      const startX = n.start.x * width;
      const startY = n.start.y * height;
      const endX = n.end.x * width;
      const endY = n.end.y * height;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  }

  if (!activeLine) return;

  annotationCtx.strokeStyle = "#38bdf8";
  annotationCtx.lineWidth = Math.max(4, annotationCanvas.width * 0.004);
  annotationCtx.lineCap = "round";

  annotationCtx.beginPath();
  annotationCtx.moveTo(activeLine.start.x, activeLine.start.y);
  annotationCtx.lineTo(activeLine.end.x, activeLine.end.y);
  annotationCtx.stroke();
}

// === EVENTS ===
video.addEventListener("timeupdate", handleVideoTimeUpdate);
video.addEventListener("ended", handleVideoEnded);
