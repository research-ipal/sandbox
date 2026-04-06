diff --git a/app.js b/app.js
index 2ecdccb980bc10a27cd1a04c22c4a7df363d4a18..efb8505ad05488e6bc06c3658de37610d6772b9c 100644
--- a/app.js
+++ b/app.js
@@ -28,50 +28,52 @@ const annotationSections = [
 ];
 
 const submissionConfig = window.ANNOTATION_SUBMISSION || {};
 const baseAdditionalFields = { ...(submissionConfig.additionalFields || {}) };
 delete baseAdditionalFields.studyId;
 delete baseAdditionalFields.participantId;
 delete baseAdditionalFields.filenameHint;
 let participantIdValue = "";
 
 const overlayCtx = finalFrameCanvas.getContext("2d");
 const annotationCtx = annotationCanvas.getContext("2d");
 
 const EXPERT_ANNOTATION_BASE_URL = "expert-annotations/";
 
 // STATE VARIABLES
 let frameCaptured = false;
 let currentClip = null;
 let activeLine = null;
 let expertLines = null;
 let pointerDown = false;
 let latestPayload = null;
 let submissionInFlight = false;
 let capturedFrameTimeValue = 0;
 let helperVideo = null;
 let helperSeekAttempted = false;
 let finalFrameBuffered = false;
 let bufferedFrameTimeValue = 0;
 
 // Sequential Navigation State
 let currentClipIndex = 0;
 let clips = [];
 
 function showToast(message) {
   const toast = toastTemplate.content.firstElementChild.cloneNode(true);
   toast.textContent = message;
   document.body.appendChild(toast);
   requestAnimationFrame(() => {
     toast.classList.add("toast--visible");
   });
   setTimeout(() => toast.remove(), 2800);
 }
 
 function getClips() {
   const clipsList = Array.isArray(window.ANNOTATION_CLIPS) ? [...window.ANNOTATION_CLIPS] : [];
   const params = new URLSearchParams(window.location.search);
   const videoParam = params.get("video");
   if (videoParam) {
     clipsList.unshift({
       id: "survey-param",
       label: "Embedded Clip",
       src: videoParam,
       poster: "",
@@ -174,50 +176,52 @@ function looksLikeGithubBlob(value) {
   const lower = value.toLowerCase();
   return lower.includes("github.com") && lower.includes("/blob/");
 }
 
 function handleVideoError() {
   let message = "Clip failed to load. Check that the src URL is correct and publicly accessible.";
   if (currentClip?.src) {
     message += ` (Configured source: ${currentClip.src})`;
     if (looksLikeLocalPath(currentClip.src)) {
       message +=
         " — this looks like a local file path. Upload the video to your hosting provider (e.g., GitHub Pages, CDN) and reference the hosted HTTPS URL instead.";
     } else if (looksLikeGithubBlob(currentClip.src)) {
       message +=
         " — this points to the GitHub repository viewer. Use the GitHub Pages URL or the raw file URL (https://raw.githubusercontent.com/…) so the browser can load the actual video.";
     }
   }
   videoStatus.textContent = message;
   showToast(message);
   replayBtn.disabled = true;
   teardownHelperVideo();
 }
 
 function resetAnnotationState() {
   teardownHelperVideo();
   frameCaptured = false;
   finalFrameBuffered = false;
   bufferedFrameTimeValue = 0;
   activeLine = null;
   expertLines = null; 
   pointerDown = false;
   latestPayload = null;
   submissionInFlight = false;
   annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
   overlayCtx.clearRect(0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
   annotationCanvas.style.backgroundImage = "";
   annotationStatus.textContent =
     "Final frame will appear below shortly. You can keep watching the clip while it prepares.";
   clearLineBtn.disabled = true;
   submitAnnotationBtn.disabled = true;
   submitAnnotationBtn.textContent = "Submit to Investigator and Next Clip";
   
   if (submissionConfig.endpoint) {
     submissionStatus.textContent = participantIdValue
       ? "Draw the incision on the frozen frame to enable submission."
       : "Enter your participant ID above before submitting.";
   } else {
     submissionStatus.textContent =
       "Investigator submission endpoint not configured. Update clip-config.js.";
   }
   capturedFrameTimeValue = 0;
 }
 
@@ -290,162 +294,173 @@ function helperFinalizeCapture() {
     teardownHelperVideo();
   } else {
     handleHelperError();
   }
 }
 
 function handleHelperSeeked() {
   helperFinalizeCapture();
 }
 
 function handleHelperTimeUpdate() {
   if (!helperSeekAttempted || frameCaptured) {
     return;
   }
   helperFinalizeCapture();
 }
 
 function handleHelperError() {
   teardownHelperVideo();
   if (!frameCaptured) {
     annotationStatus.textContent =
       "Final frame will appear below once the clip finishes playing. If it does not, replay the clip.";
   }
 }
 
 function captureFrameImage(source, frameTimeValue, revealNow = true) {
   if (!source.videoWidth || !source.videoHeight) {
     return false;
   }
 
   const firstCapture = !frameCaptured;
   const frameTime = Number(((frameTimeValue ?? source.currentTime ?? 0) || 0).toFixed(3));
   resizeCanvases(source.videoWidth, source.videoHeight);
   try {
     overlayCtx.clearRect(0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
     overlayCtx.drawImage(source, 0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
   } catch (error) {
     showToast("Unable to capture frame. Replay the clip and try again.");
     return false;
   }
 
   finalFrameBuffered = true;
   bufferedFrameTimeValue = Number.isFinite(frameTime) ? frameTime : 0;
   if (!revealNow) {
     return true;
   }
 
   annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
   frameCaptured = true;
   canvasContainer.hidden = false;
   
   annotationStatus.textContent = expertLines
     ? "Final frame ready. Draw your incision line on top of the safety corridor." 
     : "Final frame ready. Review the clip above and draw your incision when ready.";
 
   if (firstCapture) {
     if (video.paused) {
       videoStatus.textContent = "Final frame captured. Replay the clip if you need another look.";
     } else {
       videoStatus.textContent =
         "Final frame captured below. You can keep watching or replay the clip when ready.";
     }
   }
   replayBtn.disabled = false;
   capturedFrameTimeValue = bufferedFrameTimeValue;
   
   redrawCanvas();
   return true;
 }
 
 function revealBufferedFrame() {
   if (!finalFrameBuffered) {
     return false;
   }
   frameCaptured = true;
   capturedFrameTimeValue = bufferedFrameTimeValue;
   canvasContainer.hidden = false;
   redrawCanvas();
   videoStatus.textContent =
     "Clip complete. The frozen frame below is ready for annotation. Use Replay to review again.";
   annotationStatus.textContent = expertLines
     ? "Final frame ready. Draw your incision line on top of the safety corridor."
     : "Final frame ready. Review the clip above and draw your incision when ready.";
   replayBtn.disabled = false;
   return true;
 }
 
 function handleVideoLoaded() {
   videoStatus.textContent = "Clip loaded. Tap play to begin.";
   video.controls = true;
   video.setAttribute("controls", "");
   video.play().catch(() => {
     try {
       video.pause();
     } catch (error) {
       // ignore pause failures
     }
     videoStatus.textContent = "Clip loaded. Press play to begin.";
   });
 }
 
 function handleVideoPlay() {
   videoStatus.textContent = frameCaptured
     ? "Replaying clip. The final frame remains available below."
     : "Watching clip…";
 }
 
 function handleVideoEnded() {
   video.controls = true;
   video.setAttribute("controls", "");
   if (revealBufferedFrame()) {
     return;
   }
 
   const duration = Number.isFinite(video.duration) ? video.duration : null;
   if (!duration) {
     videoStatus.textContent = "Clip complete. Replay if the final frame is missing.";
     return;
   }
 
   const target = Math.max(duration - 0.1, 0);
   const onSeeked = () => {
     const buffered = captureFrameImage(video, target, false);
     if (!buffered || !revealBufferedFrame()) {
       videoStatus.textContent = "Could not capture final frame. Please replay the clip.";
     }
   };
   video.addEventListener("seeked", onSeeked, { once: true });
   try {
     video.currentTime = target;
   } catch (error) {
     videoStatus.textContent = "Could not capture final frame. Please replay the clip.";
   }
 }
 
 function handleVideoTimeUpdate() {
   if (frameCaptured) {
     return;
   }
 
   const duration = Number.isFinite(video.duration) ? video.duration : null;
   if (!duration) {
     return;
   }
 
   const remaining = duration - video.currentTime;
   if (remaining <= 1.0) {
     captureFrameImage(video, video.currentTime, false);
   }
 }
 
 function handleReplay() {
   if (!currentClip) return;
   annotationStatus.textContent =
     "Final frame remains below. Review the clip again and adjust your line if needed.";
   activeLine = null;
   redrawCanvas(); 
   clearLineBtn.disabled = true;
   submitAnnotationBtn.disabled = true;
   if (submissionConfig.endpoint) {
     submissionStatus.textContent = participantIdValue
       ? "Draw the incision on the frozen frame to enable submission."
       : "Enter your participant ID above before submitting.";
   } else {
     submissionStatus.textContent =
       "Investigator submission endpoint not configured. Update clip-config.js.";
   }
   updateSubmissionPayload();
   try {
     video.pause();
   } catch (error) {
     // ignore pause issues on replay
   }
@@ -470,50 +485,58 @@ function getPointerPosition(evt) {
   const clientY = evt.clientY ?? touch?.clientY ?? 0;
   const x = ((clientX - rect.left) / rect.width) * annotationCanvas.width;
   const y = ((clientY - rect.top) / rect.height) * annotationCanvas.height;
   return { x, y };
 }
 
 function normalizeFromPixels(pixels, referenceSize) {
   const width = referenceSize ? referenceSize.width : annotationCanvas.width;
   const height = referenceSize ? referenceSize.height : annotationCanvas.height;
 
   return {
     start: {
       x: pixels.start.x / width,
       y: pixels.start.y / height,
     },
     end: {
       x: pixels.end.x / width,
       y: pixels.end.y / height,
     },
   };
 }
 
 function redrawCanvas() {
   annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
 
   if (frameCaptured && finalFrameCanvas.width && finalFrameCanvas.height) {
     annotationCtx.drawImage(finalFrameCanvas, 0, 0, annotationCanvas.width, annotationCanvas.height);
   }
 
   drawOverlayLines();
 }
 
 function drawOverlayLines() {
   if (expertLines && Array.isArray(expertLines.incisionDetails)) {
       const ctx = annotationCtx;
       const width = annotationCanvas.width;
       const height = annotationCanvas.height;
 
       ctx.strokeStyle = "rgba(0, 255, 0, 0.7)"; 
       ctx.lineWidth = Math.max(2, width * 0.005);
       ctx.setLineDash([8, 6]); 
 
       expertLines.incisionDetails.forEach(detail => {
           const normalizedLine = detail.normalized ?? 
                                  normalizeFromPixels(detail.pixels, expertLines.canvasSize);          
           const startX = normalizedLine.start.x * width;
           const startY = normalizedLine.start.y * height;
           const endX = normalizedLine.end.x * width;
           const endY = normalizedLine.end.y * height;
           
           ctx.beginPath();
           ctx.moveTo(startX, startY);
           ctx.lineTo(endX, endY);
           ctx.stroke();
       });
 
       ctx.setLineDash([]); 
   }
