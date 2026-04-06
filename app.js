const overlayCtx = finalFrameCanvas.getContext("2d");
const annotationCtx = annotationCanvas.getContext("2d");

// --- STATE VARIABLES ---
let frameCaptured = false;
let finalFrameBuffered = false; // NEW: From reference code
let currentClip = null;
let activeLine = null;
let pointerDown = false;
let latestPayload = null;
let submissionInFlight = false;
let capturedFrameTimeValue = 0;
let currentClipIndex = 0; // Track current index


// --- UTILITY ---


function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
@@ -48,6 +48,8 @@ function showToast(message) {
  setTimeout(() => toast.remove(), 2800);
}

// --- CLIP MANAGEMENT ---

function getClips() {
  const clips = Array.isArray(window.ANNOTATION_CLIPS) ? [...window.ANNOTATION_CLIPS] : [];
  const params = new URLSearchParams(window.location.search);
@@ -63,7 +65,6 @@ function getClips() {
  return clips;
}


function loadClipByIndex(index) {
  const clips = getClips();

@@ -79,7 +80,7 @@ function loadClipByIndex(index) {
    clipProgress.textContent = `(Clip ${index + 1} of ${clips.length})`;
  }

  // Update Button Text
  if (index === clips.length - 1) {
    submitAnnotationBtn.textContent = "Submit & Finish";
  } else {
@@ -105,7 +106,10 @@ function loadClipByIndex(index) {
  video.removeAttribute("controls");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  
  // OPTIMIZATION: Set crossOrigin BEFORE src to avoid tainted canvas
  video.crossOrigin = "anonymous";
  
  if (currentClip.poster) {
    video.setAttribute("poster", currentClip.poster);
  } else {
@@ -116,17 +120,44 @@ function loadClipByIndex(index) {
  video.load();
  videoStatus.textContent = "Loading clip…";
  replayBtn.disabled = true;

}

function handleAllClipsCompleted() {

  document.querySelectorAll('.card:not(#confidenceSection)').forEach(el => el.hidden = true);


  document.getElementById("confidenceSection").hidden = false;
}

function resetAnnotationState() {
  frameCaptured = false;
  finalFrameBuffered = false;
  activeLine = null;
  pointerDown = false;
  latestPayload = null;
  submissionInFlight = false;
  
  // Clear both canvases
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  overlayCtx.clearRect(0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
  
  // OPTIMIZATION: Ensure background image is gone so we don't double-render
  annotationCanvas.style.backgroundImage = "";
  
  annotationStatus.textContent =
    "Final frame will appear below shortly. You can keep watching the clip while it prepares.";
  clearLineBtn.disabled = true;
  submitAnnotationBtn.disabled = true;
  
  if (submissionConfig.endpoint) {
    submissionStatus.textContent = participantIdValue
      ? "Draw the incision on the frozen frame to enable submission."
      : "Enter your email above before submitting.";
  } else {
    submissionStatus.textContent =
      "Investigator submission endpoint not configured. Update clip-config.js.";
  }
  capturedFrameTimeValue = 0;
}

function looksLikeLocalPath(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
@@ -145,211 +176,147 @@ function looksLikeGithubBlob(value) {
}

function handleVideoError() {
  let message = "Clip failed to load. ";
  if (currentClip?.src) {

    if (looksLikeLocalPath(currentClip.src)) {
      message += "Local file path detected (use HTTPS).";

    } else if (looksLikeGithubBlob(currentClip.src)) {
      message += "GitHub blob detected (use raw or pages URL).";
    } else {
      message += "Check URL.";
    }
  }
  videoStatus.textContent = message;
  showToast(message);
  replayBtn.disabled = true;

}

// --- OPTIMIZED CAPTURE LOGIC (FROM REFERENCE) ---

function resizeCanvases(videoWidth, videoHeight) {
  // OPTIMIZATION: Cap max width to 1920px to prevent mobile memory crashes
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

// Draws pixels directly; doesn't change UI state
function bufferFrame(source) {
  if (!source.videoWidth || !source.videoHeight) return false;















  resizeCanvases(source.videoWidth, source.videoHeight);
  
  // Draw directly to the bottom canvas (finalFrame)
  overlayCtx.drawImage(source, 0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
  
  // Clear top canvas to ensure transparency
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  
  // Mobile safety: ensure no background image
  annotationCanvas.style.backgroundImage = "";

  finalFrameBuffered = true;
  return true;










}

// Reveals the drawn canvas to the user
function revealCapturedFrame() {
  if (!finalFrameBuffered) return;












  frameCaptured = true;
  canvasContainer.hidden = false;
  
  // CSS FIX: Ensure the finalFrame is visible behind the annotation canvas
  finalFrameCanvas.style.display = "block";
  finalFrameCanvas.style.position = "absolute";
  finalFrameCanvas.style.top = "0";
  finalFrameCanvas.style.left = "0";
  finalFrameCanvas.style.zIndex = "1";
  
  annotationCanvas.style.position = "relative";
  annotationCanvas.style.zIndex = "2";
  
  annotationStatus.textContent =
    "Final frame ready. Review the clip above and draw your incision when ready.";
  
  if (video.paused) {
    videoStatus.textContent = "Clip complete. The frozen frame below is ready for annotation.";
  } else {
    videoStatus.textContent = "Final frame captured below. You can keep watching or replay.";
  }
  
  replayBtn.disabled = false;
  
  // Lock in the time
  const numericTime = Number(((video.currentTime || 0)).toFixed(3));
  capturedFrameTimeValue = Number.isFinite(numericTime) ? numericTime : 0;
}

function handleVideoTimeUpdate() {
  if (frameCaptured) return;
  
  const duration = Number.isFinite(video.duration) ? video.duration : null;
  if (!duration) return;

  const remaining = duration - video.currentTime;






  // ROLLING CAPTURE STRATEGY:
  // Capture continuously in the last 1 second to ensure we don't miss the frame
  // or capture a black screen at the very end.
  if (remaining <= 1.0) {
     const success = bufferFrame(video);
     if (success && remaining <= 0.25) {
        // Optional: Reveal it slightly before end if you want, 
        // or wait for 'ended'. Current logic waits for 'ended' or explicit pause.
        // We will just buffer here and reveal in handleVideoEnded.
     }
  }
}

function handleVideoEnded() {
  if (frameCaptured) return;



  video.controls = true;
  video.setAttribute("controls", "");



  // If rolling capture worked, show it.
  if (finalFrameBuffered) {
    revealCapturedFrame();
  } else {
    // Fallback: Seek back slightly to avoid black frame
    const target = Math.max(0, video.duration - 0.1);
    videoStatus.textContent = "Capturing final frame...";
    
    const onSeeked = () => {
      if (bufferFrame(video)) {
        revealCapturedFrame();
      } else {
        videoStatus.textContent = "Could not capture frame. Please press Replay.";
      }
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = target;









  }


























}

function handleVideoLoaded() {
  videoStatus.textContent = "Clip loaded. Tap play to begin.";
  video.controls = true;
  video.setAttribute("controls", "");
  video.play().catch(() => {
    try { video.pause(); } catch (e) {}




    videoStatus.textContent = "Clip loaded. Press play to begin.";
  });
}
@@ -360,74 +327,40 @@ function handleVideoPlay() {
    : "Watching clip…";
}




























function handleReplay() {
  if (!currentClip) return;
  annotationStatus.textContent =
    "Final frame remains below. Review the clip again and adjust your line if needed.";
  
  activeLine = null;
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  clearLineBtn.disabled = true;
  submitAnnotationBtn.disabled = true;
  
  if (submissionConfig.endpoint) {
    submissionStatus.textContent = participantIdValue
      ? "Draw the incision on the frozen frame to enable submission."
      : "Enter your email above before submitting.";



  }
  
  updateSubmissionPayload();
  




  video.currentTime = 0;
  video.controls = true;
  video.setAttribute("controls", "");
  video.play().catch(() => {
    videoStatus.textContent = "Clip reset. Press play to watch again.";
  });






}

// --- DRAWING LOGIC ---

function getPointerPosition(evt) {
  const rect = annotationCanvas.getBoundingClientRect();
  const touch = evt.touches?.[0] ?? evt.changedTouches?.[0] ?? null;
  const clientX = evt.clientX ?? touch?.clientX ?? 0;
  const clientY = evt.clientY ?? touch?.clientY ?? 0;
  
  const x = ((clientX - rect.left) / rect.width) * annotationCanvas.width;
  const y = ((clientY - rect.top) / rect.height) * annotationCanvas.height;
  return { x, y };
@@ -539,7 +472,6 @@ function handlePointerDown(evt) {
    showToast("Final frame still loading. Please wait a moment before drawing.");
    return;
  }

  evt.preventDefault();
  pointerDown = true;
  const start = getPointerPosition(evt);
@@ -579,7 +511,8 @@ function clearLine() {
  updateSubmissionPayload();
}

// --- SUBMISSION LOGIC ---

async function submitAnnotation() {
  if (!latestPayload) {
    showToast("Draw the incision before submitting.");
@@ -625,39 +558,29 @@ async function submitAnnotation() {
    bodyWrapper = { ...additionalFields, [key]: latestPayload };
  }














  try {
    const response = await fetch(submissionConfig.endpoint, {
      method,
      headers,
      body: JSON.stringify(bodyWrapper),
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    submissionStatus.textContent = "Annotation submitted.";
    showToast("Annotation sent.");
    return true; 
  } catch (error) {
    submissionStatus.textContent = "Submission failed. Please try again.";
    submitAnnotationBtn.disabled = false;
    showToast("Unable to submit. Check connection.");
    console.error(error);
    return false; 
  } finally {
    submissionInFlight = false;
  }
}


async function handleSubmitAndNext() {
  const success = await submitAnnotation();
  if (success) {
@@ -688,8 +611,9 @@ function getFilenameHint() {

function buildAdditionalFields(filenameHint) {
  const fields = { ...baseAdditionalFields };

  const participantId = participantIdInput.value.trim();
  
  // Collect other form fields
  const age = document.getElementById("ageInput")?.value.trim();
  const gender = document.getElementById("genderInput")?.value;
  const level_of_training = document.getElementById("levelInput")?.value;
@@ -716,92 +640,64 @@ function buildAdditionalFields(filenameHint) {
  return fields;
}

// --- INITIAL SURVEY SUBMISSION ---
async function submitInitialSurveyAsCSV() {
  const endpoint = submissionConfig.endpoint;
  if (!endpoint) return;





  const participantId = document.getElementById("participantIdInput")?.value.trim() || "";







  const timestamp = new Date().toISOString();
  
  // Headers match form fields
  const header = [
    "participantId", "age", "gender", "level_of_training", 
    "specialty", "years_of_practice", "familiarity", "fatigue", "generatedAt"







  ];

  const row = [
    participantId,
    document.getElementById("ageInput")?.value.trim() || "",
    document.getElementById("genderInput")?.value || "",
    document.getElementById("levelInput")?.value || "",
    document.getElementById("specialtyInput")?.value.trim() || "",
    document.getElementById("yearsPracticeInput")?.value.trim() || "",
    document.getElementById("familiarityInput")?.value || "",
    document.getElementById("fatigueInput")?.value || "",
    timestamp
  ];

  const csvString = header.join(",") + "\n" + row.join(",");

  const filename = `survey_${participantId || "anon"}_${timestamp}.csv`;






  try {
    await fetch(endpoint, {
      method: submissionConfig.method || "POST",
      headers: submissionConfig.headers || { "Content-Type": "application/json" },
      body: JSON.stringify({ annotation: { filename: filename, csv: csvString } }) 
    });




  } catch (err) {
    console.error("Initial survey CSV failed", err);

  }
}

// --- EVENT LISTENERS ---


replayBtn.addEventListener("click", handleReplay);
video.addEventListener("loadeddata", handleVideoLoaded);
video.addEventListener("error", handleVideoError);
video.addEventListener("play", handleVideoPlay);
video.addEventListener("timeupdate", handleVideoTimeUpdate);
video.addEventListener("ended", handleVideoEnded);
clearLineBtn.addEventListener("click", clearLine);


submitAnnotationBtn.addEventListener("click", handleSubmitAndNext);

participantIdInput.addEventListener("input", (event) => {
  applyParticipantId(event.target.value);
});

// Enforce touch-action none
annotationCanvas.style.touchAction = "none";

if (window.PointerEvent) {
  annotationCanvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  annotationCanvas.addEventListener("pointermove", handlePointerMove, { passive: false });
@@ -821,11 +717,10 @@ if (window.PointerEvent) {

// INITIALIZATION
const availableClips = getClips();
submitInitialSurveyAsCSV(); 
loadClipByIndex(0); 
applyParticipantId(participantIdInput.value);


// Confidence submission handler
document.getElementById("submitConfidenceBtn").addEventListener("click", async () => {
  const confidenceInput = document.getElementById("confidenceInput").value;
@@ -836,7 +731,6 @@ document.getElementById("submitConfidenceBtn").addEventListener("click", async (
  }

  const participantId = participantIdInput.value.trim();

  const body = {
    participantId: participantId,
    confidenceFinal: confidenceInput,
@@ -847,19 +741,13 @@ document.getElementById("submitConfidenceBtn").addEventListener("click", async (
    const response = await fetch(submissionConfig.endpoint, {
      method: submissionConfig.method || "POST",
      headers: submissionConfig.headers || { "Content-Type": "application/json" },
      body: JSON.stringify({ annotation: body }),


    });

    if (!response.ok) throw new Error("Submission failed");

    showToast("Confidence submitted. Thank you!");


    document.getElementById("confidenceSection").hidden = true;
    completionCard.hidden = false;

  } catch (err) {
    showToast("Could not submit. Try again.");
    console.error(err);
