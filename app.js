// ============================================================================  
// ANNOTATION TOOL - Main Application  
// ============================================================================

// ============================================================================  
// GLOBAL STATE  
// ============================================================================

let currentClipIndex = 0;  
let currentClip = null;  
let isDrawing = false;  
let startPoint = null;  
let currentLine = null;  
let userAnnotations = [];  
let capturedFrameData = null;

// ============================================================================  
// DOM ELEMENTS  
// ============================================================================

const videoElement = document.getElementById('surgeryVideo');  
const videoPoster = document.getElementById('videoPoster');  
const replayBtn = document.getElementById('replayBtn');  
const finalFrameCanvas = document.getElementById('finalFrameCanvas');  
const annotationCanvas = document.getElementById('annotationCanvas');  
const canvasStage = document.querySelector('.canvas-stage');  
const clearLineBtn = document.getElementById('clearLineBtn');  
const submitBtn = document.getElementById('submitBtn');  
const videoContainer = document.querySelector('.video-container');  
const loadingMessage = document.querySelector('.loading-message');

// ============================================================================  
// UTILITY FUNCTIONS  
// ============================================================================

/**  
 * Debounce function to limit event handler calls  
 */  
function debounce(func, wait) {  
  let timeout;  
  return function executedFunction(...args) {  
    const later = () => {  
      clearTimeout(timeout);  
      func(...args);  
    };  
    clearTimeout(timeout);  
    timeout = setTimeout(later, wait);  
  };  
}

/**  
 * Detect iOS devices  
 */  
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

/**  
 * Detect if device is mobile  
 */  
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/**  
 * Get normalized coordinates from event (mouse or touch)  
 */  
function getNormalizedCoordinates(canvas, event) {  
  const rect = canvas.getBoundingClientRect();  
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;  
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;  
    
  const x = (clientX - rect.left) / rect.width;  
  const y = (clientY - rect.top) / rect.height;  
    
  return { x, y };  
}

/**  
 * Convert normalized coordinates to canvas pixels  
 */  
function denormalizeCoordinates(canvas, normalized) {  
  return {  
    x: normalized.x * canvas.width,  
    y: normalized.y * canvas.height  
  };  
}

// ============================================================================  
// VIDEO FRAME CAPTURE - CORRECTED  
// ============================================================================

/**  
 * Calculate the actual visible region of the video within its element,  
 * accounting for object-fit: contain behavior  
 */  
function getVisibleVideoRegion(videoElement) {  
  const videoRatio = videoElement.videoWidth / videoElement.videoHeight;  
  const elementRatio = videoElement.clientWidth / videoElement.clientHeight;  
    
  let sourceX = 0, sourceY = 0;  
  let sourceWidth = videoElement.videoWidth;  
  let sourceHeight = videoElement.videoHeight;  
    
  // Video is pillarboxed (black bars on left/right)  
  if (videoRatio < elementRatio) {  
    const visibleWidth = videoElement.videoHeight * elementRatio;  
    sourceX = (videoElement.videoWidth - visibleWidth) / 2;  
    sourceWidth = visibleWidth;  
  }  
  // Video is letterboxed (black bars on top/bottom)  
  else if (videoRatio > elementRatio) {  
    const visibleHeight = videoElement.videoWidth / elementRatio;  
    sourceY = (videoElement.videoHeight - visibleHeight) / 2;  
    sourceHeight = visibleHeight;  
  }  
    
  return {  
    sourceX,  
    sourceY,  
    sourceWidth,  
    sourceHeight  
  };  
}

/**  
 * Capture the final frame from video element  
 * This version correctly handles aspect ratio and object-fit  
 */  
function captureFinalFrame(videoElement, canvas) {  
  const ctx = canvas.getContext('2d');  
  const region = getVisibleVideoRegion(videoElement);  
    
  // Store high-quality capture for resize events  
  if (!capturedFrameData) {  
    const tempCanvas = document.createElement('canvas');  
    tempCanvas.width = region.sourceWidth;  
    tempCanvas.height = region.sourceHeight;  
    const tempCtx = tempCanvas.getContext('2d');  
      
    tempCtx.drawImage(  
      videoElement,  
      region.sourceX, region.sourceY,  
      region.sourceWidth, region.sourceHeight,  
      0, 0,  
      tempCanvas.width, tempCanvas.height  
    );  
      
    capturedFrameData = tempCanvas;  
  }  
    
  // Set display canvas size to match video element  
  canvas.width = videoElement.clientWidth;  
  canvas.height = videoElement.clientHeight;  
    
  // Draw the captured frame  
  ctx.drawImage(  
    capturedFrameData,  
    0, 0,  
    capturedFrameData.width, capturedFrameData.height,  
    0, 0,  
    canvas.width, canvas.height  
  );  
}

/**  
 * Handle video end - capture frame and switch to annotation mode  
 */  
function handleVideoEnd() {  
  console.log('Video ended, capturing final frame...');  
    
  // Small delay to ensure last frame is fully rendered  
  setTimeout(() => {  
    captureFinalFrame(videoElement, finalFrameCanvas);  
      
    // Match annotation canvas size  
    annotationCanvas.width = finalFrameCanvas.width;  
    annotationCanvas.height = finalFrameCanvas.height;  
      
    // Draw expert annotations if available  
    if (currentClip.annotationType === 'gt') {  
      drawExpertAnnotations();  
    }  
      
    // Switch UI  
    videoElement.style.display = 'none';  
    if (videoPoster) videoPoster.style.display = 'none';  
    canvasStage.style.display = 'block';  
    replayBtn.style.display = 'inline-block';  
      
    console.log('Frame captured successfully');  
  }, 100);  
}

// ============================================================================  
// EXPERT ANNOTATIONS  
// ============================================================================

/**  
 * Draw expert/ground truth annotations from JSON  
 */  
function drawExpertAnnotations() {  
  if (!window.EXPERT_ANNOTATIONS || !currentClip) return;  
    
  const annotation = window.EXPERT_ANNOTATIONS[currentClip.id];  
  if (!annotation || !annotation.incisions || annotation.incisions.length === 0) {  
    console.log('No expert annotations found for clip:', currentClip.id);  
    return;  
  }  
    
  const ctx = annotationCanvas.getContext('2d');  
    
  annotation.incisions.forEach((incision, index) => {  
    const start = denormalizeCoordinates(annotationCanvas, incision.start);  
    const end = denormalizeCoordinates(annotationCanvas, incision.end);  
      
    // Draw expert line in distinctive style  
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)'; // Green  
    ctx.lineWidth = 3;  
    ctx.lineCap = 'round';  
    ctx.setLineDash([5, 5]); // Dashed line  
      
    ctx.beginPath();  
    ctx.moveTo(start.x, start.y);  
    ctx.lineTo(end.x, end.y);  
    ctx.stroke();  
      
    // Draw start and end markers  
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';  
    ctx.setLineDash([]); // Solid for markers  
      
    ctx.beginPath();  
    ctx.arc(start.x, start.y, 6, 0, 2 * Math.PI);  
    ctx.fill();  
      
    ctx.beginPath();  
    ctx.arc(end.x, end.y, 6, 0, 2 * Math.PI);  
    ctx.fill();  
  });  
    
  console.log('Drew expert annotations:', annotation.incisions.length);  
}

// ============================================================================  
// DRAWING FUNCTIONS  
// ============================================================================

/**  
 * Redraw all user annotations  
 */  
function redrawAnnotations() {  
  const ctx = annotationCanvas.getContext('2d');  
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
    
  // Redraw expert annotations first (background)  
  if (currentClip.annotationType === 'gt') {  
    drawExpertAnnotations();  
  }  
    
  // Redraw user annotations  
  userAnnotations.forEach(annotation => {  
    drawLine(  
      annotation.start,  
      annotation.end,  
      'rgba(255, 0, 0, 0.8)', // Red  
      4,  
      false  
    );  
  });  
    
  // Draw current line if drawing  
  if (isDrawing && startPoint && currentLine) {  
    drawLine(  
      startPoint,  
      currentLine,  
      'rgba(255, 165, 0, 0.8)', // Orange (preview)  
      4,  
      false  
    );  
  }  
}

/**  
 * Draw a line on the annotation canvas  
 */  
function drawLine(start, end, color = 'rgba(255, 0, 0, 0.8)', lineWidth = 4, clear = true) {  
  const ctx = annotationCanvas.getContext('2d');  
    
  if (clear) {  
    ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
    if (currentClip.annotationType === 'gt') {  
      drawExpertAnnotations();  
    }  
  }  
    
  const startPixel = denormalizeCoordinates(annotationCanvas, start);  
  const endPixel = denormalizeCoordinates(annotationCanvas, end);  
    
  ctx.strokeStyle = color;  
  ctx.lineWidth = lineWidth;  
  ctx.lineCap = 'round';  
  ctx.setLineDash([]);  
    
  ctx.beginPath();  
  ctx.moveTo(startPixel.x, startPixel.y);  
  ctx.lineTo(endPixel.x, endPixel.y);  
  ctx.stroke();  
    
  // Draw endpoint markers  
  ctx.fillStyle = color;  
    
  ctx.beginPath();  
  ctx.arc(startPixel.x, startPixel.y, 6, 0, 2 * Math.PI);  
  ctx.fill();  
    
  ctx.beginPath();  
  ctx.arc(endPixel.x, endPixel.y, 6, 0, 2 * Math.PI);  
  ctx.fill();  
}

/**  
 * Clear all user annotations  
 */  
function clearAnnotations() {  
  userAnnotations = [];  
  isDrawing = false;  
  startPoint = null;  
  currentLine = null;  
    
  const ctx = annotationCanvas.getContext('2d');  
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
    
  if (currentClip.annotationType === 'gt') {  
    drawExpertAnnotations();  
  }  
    
  updateSubmitButton();  
}

// ============================================================================  
// DRAWING EVENT HANDLERS  
// ============================================================================

/**  
 * Start drawing (mouse down / touch start)  
 */  
function startDrawing(event) {  
  event.preventDefault();  
    
  // Clear previous annotations (only allow one line at a time)  
  userAnnotations = [];  
    
  isDrawing = true;  
  startPoint = getNormalizedCoordinates(annotationCanvas, event);  
  currentLine = startPoint;  
    
  redrawAnnotations();  
}

/**  
 * Continue drawing (mouse move / touch move)  
 */  
function continueDrawing(event) {  
  if (!isDrawing) return;  
  event.preventDefault();  
    
  currentLine = getNormalizedCoordinates(annotationCanvas, event);  
  redrawAnnotations();  
}

/**  
 * Finish drawing (mouse up / touch end)  
 */  
function finishDrawing(event) {  
  if (!isDrawing) return;  
  event.preventDefault();  
    
  if (currentLine && startPoint) {  
    // Save the annotation  
    userAnnotations.push({  
      start: startPoint,  
      end: currentLine  
    });  
      
    redrawAnnotations();  
  }  
    
  isDrawing = false;  
  startPoint = null;  
  currentLine = null;  
    
  updateSubmitButton();  
}

/**  
 * Cancel drawing (mouse leave / touch cancel)  
 */  
function cancelDrawing(event) {  
  if (!isDrawing) return;  
    
  isDrawing = false;  
  startPoint = null;  
  currentLine = null;  
    
  redrawAnnotations();  
}

// ============================================================================  
// CLIP MANAGEMENT  
// ============================================================================

/**  
 * Load a clip by index  
 */  
function loadClip(index) {  
  if (!window.ANNOTATION_CLIPS || index >= window.ANNOTATION_CLIPS.length) {  
    showCompletionMessage();  
    return;  
  }  
    
  currentClipIndex = index;  
  currentClip = window.ANNOTATION_CLIPS[index];  
    
  // Reset state  
  capturedFrameData = null;  
  userAnnotations = [];  
  isDrawing = false;  
  startPoint = null;  
  currentLine = null;  
    
  // Update UI  
  document.getElementById('clipCounter').textContent =   
    `Clip ${index + 1} of ${window.ANNOTATION_CLIPS.length}`;  
    
  // Reset canvases  
  canvasStage.style.display = 'none';  
  videoElement.style.display = 'block';  
  replayBtn.style.display = 'none';  
    
  // Clear canvases  
  const finalCtx = finalFrameCanvas.getContext('2d');  
  const annotationCtx = annotationCanvas.getContext('2d');  
  finalCtx.clearRect(0, 0, finalFrameCanvas.width, finalFrameCanvas.height);  
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
    
  // Load video  
  if (loadingMessage) loadingMessage.style.display = 'block';  
    
  videoElement.src = currentClip.src;  
  if (currentClip.poster) {  
    videoPoster.src = currentClip.poster;  
    videoPoster.style.display = 'block';  
  }  
    
  videoElement.load();  
    
  updateSubmitButton();  
    
  console.log('Loaded clip:', currentClip);  
}

/**  
 * Replay current video  
 */  
function replayVideo() {  
  capturedFrameData = null;  
  canvasStage.style.display = 'none';  
  videoElement.style.display = 'block';  
  if (videoPoster) videoPoster.style.display = 'block';  
  replayBtn.style.display = 'none';  
    
  videoElement.currentTime = 0;  
  videoElement.play().catch(err => {  
    console.error('Replay failed:', err);  
  });  
    
  clearAnnotations();  
}

/**  
 * Show completion message  
 */  
function showCompletionMessage() {  
  document.querySelector('.clip-section').style.display = 'none';  
  document.querySelector('.annotation-section').style.display = 'none';  
  document.querySelector('.submit-section').style.display = 'none';  
  document.getElementById('completionMessage').style.display = 'block';  
}

// ============================================================================  
// FORM SUBMISSION  
// ============================================================================

/**  
 * Update submit button state  
 */  
function updateSubmitButton() {  
  const hasAnnotation = userAnnotations.length > 0;  
  submitBtn.disabled = !hasAnnotation;  
    
  if (hasAnnotation) {  
    submitBtn.textContent = 'Submit to Investigator and Next Clip';  
  } else {  
    submitBtn.textContent = 'Draw the incision on the frozen frame to enable submission.';  
  }  
}

/**  
 * Submit annotation  
 */  
function submitAnnotation() {  
  const email = document.getElementById('participantEmail').value.trim();  
  const alertness = document.getElementById('alertnessLevel').value;  
    
  // Validation  
  if (!email) {  
    alert('Please enter your email address.');  
    document.getElementById('participantEmail').focus();  
    return;  
  }  
    
  if (!alertness) {  
    alert('Please select how you are feeling right now.');  
    document.getElementById('alertnessLevel').focus();  
    return;  
  }  
    
  if (userAnnotations.length === 0) {  
    alert('Please draw an incision line before submitting.');  
    return;  
  }  
    
  // Prepare submission data  
  const submissionData = {  
    clipId: currentClip.id,  
    clipIndex: currentClipIndex,  
    participantEmail: email,  
    alertnessLevel: parseInt(alertness),  
    annotationType: currentClip.annotationType,  
    annotation: userAnnotations[0], // Only one line allowed  
    timestamp: new Date().toISOString(),  
    videoMetadata: {  
      src: currentClip.src,  
      videoWidth: videoElement.videoWidth,  
      videoHeight: videoElement.videoHeight,  
      displayWidth: videoElement.clientWidth,  
      displayHeight: videoElement.clientHeight  
    }  
  };  
    
  console.log('Submitting annotation:', submissionData);  
    
  // TODO: Send to backend  
  // Example:   
  // fetch('/api/annotations', {  
  //   method: 'POST',  
  //   headers: { 'Content-Type': 'application/json' },  
  //   body: JSON.stringify(submissionData)  
  // });  
    
  // Show confidence question  
  document.getElementById('confidenceSection').style.display = 'block';  
  document.getElementById('confidenceSection').scrollIntoView({ behavior: 'smooth' });  
}

/**  
 * Submit confidence rating and move to next clip  
 */  
function submitConfidence() {  
  const confidence = document.querySelector('input[name="confidence"]:checked');  
    
  if (!confidence) {  
    alert('Please select your confidence level.');  
    return;  
  }  
    
  const confidenceData = {  
    clipId: currentClip.id,  
    participantEmail: document.getElementById('participantEmail').value,  
    confidenceLevel: parseInt(confidence.value),  
    timestamp: new Date().toISOString()  
  };  
    
  console.log('Submitting confidence:', confidenceData);  
    
  // TODO: Send to backend  
    
  // Hide confidence section  
  document.getElementById('confidenceSection').style.display = 'none';  
    
  // Uncheck radio buttons  
  document.querySelectorAll('input[name="confidence"]').forEach(radio => {  
    radio.checked = false;  
  });  
    
  // Load next clip  
  loadClip(currentClipIndex + 1);  
    
  // Scroll to top  
  window.scrollTo({ top: 0, behavior: 'smooth' });  
}

// ============================================================================  
// WINDOW RESIZE HANDLER  
// ============================================================================

/**  
 * Handle window resize and orientation changes  
 */  
const handleResize = debounce(() => {  
  if (capturedFrameData && videoElement.ended) {  
    console.log('Resizing canvases...');  
      
    // Recapture with new dimensions  
    captureFinalFrame(videoElement, finalFrameCanvas);  
      
    // Resize annotation canvas  
    annotationCanvas.width = finalFrameCanvas.width;  
    annotationCanvas.height = finalFrameCanvas.height;  
      
    // Redraw all annotations  
    redrawAnnotations();  
  }  
}, 250);

// ============================================================================  
// EVENT LISTENERS  
// ============================================================================

/**  
 * Setup all event listeners  
 */  
function setupEventListeners() {  
  // Video events  
  videoElement.addEventListener('ended', handleVideoEnd);  
    
  videoElement.addEventListener('loadeddata', () => {  
    if (loadingMessage) loadingMessage.style.display = 'none';  
    if (videoPoster) videoPoster.style.display = 'none';  
      
    // iOS fix: force render cycle  
    if (isIOS) {  
      videoElement.play();  
      videoElement.pause();  
    }  
  });  
    
  videoElement.addEventListener('canplay', () => {  
    console.log('Video ready to play');  
  });  
    
  videoElement.addEventListener('error', (e) => {  
    console.error('Video error:', e);  
    if (loadingMessage) {  
      loadingMessage.textContent = 'Error loading video. Please refresh.';  
    }  
  });  
    
  // Mouse events for desktop  
  annotationCanvas.addEventListener('mousedown', startDrawing);  
  annotationCanvas.addEventListener('mousemove', continueDrawing);  
  annotationCanvas.addEventListener('mouseup', finishDrawing);  
  annotationCanvas.addEventListener('mouseleave', cancelDrawing);  
    
  // Touch events for mobile  
  annotationCanvas.addEventListener('touchstart', startDrawing, { passive: false });  
  annotationCanvas.addEventListener('touchmove', continueDrawing, { passive: false });  
  annotationCanvas.addEventListener('touchend', finishDrawing, { passive: false });  
  annotationCanvas.addEventListener('touchcancel', cancelDrawing, { passive: false });  
    
  // Prevent double-tap zoom on mobile  
  let lastTap = 0;  
  annotationCanvas.addEventListener('touchend', (e) => {  
    const currentTime = new Date().getTime();  
    const tapLength = currentTime - lastTap;  
    if (tapLength < 500 && tapLength > 0) {  
      e.preventDefault();  
    }  
    lastTap = currentTime;  
  });  
    
  // Button events  
  clearLineBtn.addEventListener('click', clearAnnotations);  
  replayBtn.addEventListener('click', replayVideo);  
  submitBtn.addEventListener('click', submitAnnotation);  
    
  document.getElementById('submitConfidence').addEventListener('click', submitConfidence);  
    
  // Window resize and orientation change  
  window.addEventListener('resize', handleResize);  
  window.addEventListener('orientationchange', () => {  
    setTimeout(handleResize, 300); // Delay for orientation change completion  
  });  
}

// ============================================================================  
// INITIALIZATION  
// ============================================================================

/**  
 * Initialize the application  
 */  
function initializeApp() {  
  console.log('Initializing annotation tool...');  
    
  // Check for required globals  
  if (!window.ANNOTATION_CLIPS || window.ANNOTATION_CLIPS.length === 0) {  
    console.error('No clips found in ANNOTATION_CLIPS');  
    if (loadingMessage) {  
      loadingMessage.textContent = 'No clips available.';  
    }  
    return;  
  }  
    
  // Setup event listeners  
  setupEventListeners();  
    
  // Load first clip  
  loadClip(0);  
    
  console.log('App initialized successfully');  
  console.log(`Loaded ${window.ANNOTATION_CLIPS.length} clips`);  
  console.log(`Expert annotations available: ${window.EXPERT_ANNOTATIONS ? 'Yes' : 'No'}`);  
}

// ============================================================================  
// START APPLICATION  
// ============================================================================

// Wait for DOM and all resources to be ready  
if (document.readyState === 'loading') {  
  document.addEventListener('DOMContentLoaded', initializeApp);  
} else {  
  initializeApp();  
}  
