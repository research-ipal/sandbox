// ============================================================================  
// ANNOTATION TOOL - Main Application  
// ============================================================================

console.log('=== APP.JS STARTED ===');

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

let videoElement;  
let replayBtn;  
let finalFrameCanvas;  
let annotationCanvas;  
let canvasContainer;  
let clearLineBtn;  
let submitBtn;  
let videoStatus;  
let clipLabel;  
let participantIdInput;  
let fatigueInput;  
let confidenceSection;  
let confidenceInput;  
let submitConfidenceBtn;  
let completionCard;  
let annotationStatus;  
let submissionStatus;

// ============================================================================  
// UTILITY FUNCTIONS  
// ============================================================================

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

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;  
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function getNormalizedCoordinates(canvas, event) {  
  const rect = canvas.getBoundingClientRect();  
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;  
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;  
    
  const x = (clientX - rect.left) / rect.width;  
  const y = (clientY - rect.top) / rect.height;  
    
  return { x, y };  
}

function denormalizeCoordinates(canvas, normalized) {  
  return {  
    x: normalized.x * canvas.width,  
    y: normalized.y * canvas.height  
  };  
}

function showToast(message, duration = 3000) {  
  console.log('Toast:', message);  
  const template = document.getElementById('toastTemplate');  
  if (!template) {  
    console.warn('Toast template not found');  
    return;  
  }  
  const toast = template.content.cloneNode(true).querySelector('.toast');  
  toast.textContent = message;  
  document.body.appendChild(toast);  
    
  setTimeout(() => toast.classList.add('toast--visible'), 10);  
  setTimeout(() => {  
    toast.classList.remove('toast--visible');  
    setTimeout(() => toast.remove(), 200);  
  }, duration);  
}

// ============================================================================  
// VIDEO FRAME CAPTURE  
// ============================================================================

function getVisibleVideoRegion(videoElement) {  
  const videoRatio = videoElement.videoWidth / videoElement.videoHeight;  
  const elementRatio = videoElement.clientWidth / videoElement.clientHeight;  
    
  let sourceX = 0, sourceY = 0;  
  let sourceWidth = videoElement.videoWidth;  
  let sourceHeight = videoElement.videoHeight;  
    
  if (videoRatio < elementRatio) {  
    const visibleWidth = videoElement.videoHeight * elementRatio;  
    sourceX = (videoElement.videoWidth - visibleWidth) / 2;  
    sourceWidth = visibleWidth;  
  } else if (videoRatio > elementRatio) {  
    const visibleHeight = videoElement.videoWidth / elementRatio;  
    sourceY = (videoElement.videoHeight - visibleHeight) / 2;  
    sourceHeight = visibleHeight;  
  }  
    
  return { sourceX, sourceY, sourceWidth, sourceHeight };  
}

function captureFinalFrame(videoElement, canvas) {  
  const ctx = canvas.getContext('2d');  
  const region = getVisibleVideoRegion(videoElement);  
    
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
    
  // Set canvas to match video display size  
  const rect = videoElement.getBoundingClientRect();  
  canvas.width = rect.width;  
  canvas.height = rect.height;  
    
  ctx.drawImage(  
    capturedFrameData,  
    0, 0,  
    capturedFrameData.width, capturedFrameData.height,  
    0, 0,  
    canvas.width, canvas.height  
  );  
}

function handleVideoEnd() {  
  console.log('Video ended, capturing final frame...');  
    
  if (videoStatus) videoStatus.textContent = 'Video ended. Capturing final frame...';  
    
  setTimeout(() => {  
    try {  
      captureFinalFrame(videoElement, finalFrameCanvas);  
        
      // Set annotation canvas to match  
      annotationCanvas.width = finalFrameCanvas.width;  
      annotationCanvas.height = finalFrameCanvas.height;  
        
      if (currentClip && currentClip.annotationType === 'gt') {  
        drawExpertAnnotations();  
      }  
        
      // Show canvas, hide video  
      videoElement.style.display = 'none';  
      canvasContainer.hidden = false;  
      replayBtn.disabled = false;  
      clearLineBtn.disabled = false;  
        
      if (videoStatus) videoStatus.textContent = 'Frame captured successfully.';  
      if (annotationStatus) annotationStatus.textContent = 'Tap or click to place the start of the incision, drag, and release to finish.';  
        
      console.log('Frame captured successfully');  
    } catch (error) {  
      console.error('Error capturing frame:', error);  
      if (videoStatus) videoStatus.textContent = 'Error capturing frame. Please replay.';  
    }  
  }, 150);  
}

// ============================================================================  
// EXPERT ANNOTATIONS  
// ============================================================================

function drawExpertAnnotations() {  
  if (!window.EXPERT_ANNOTATIONS || !currentClip) return;  
    
  const annotation = window.EXPERT_ANNOTATIONS[currentClip.id];  
  if (!annotation || !annotation.incisions || annotation.incisions.length === 0) {  
    console.log('No expert annotations found for clip:', currentClip.id);  
    return;  
  }  
    
  const ctx = annotationCanvas.getContext('2d');  
    
  annotation.incisions.forEach((incision) => {  
    const start = denormalizeCoordinates(annotationCanvas, incision.start);  
    const end = denormalizeCoordinates(annotationCanvas, incision.end);  
      
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';  
    ctx.lineWidth = 3;  
    ctx.lineCap = 'round';  
    ctx.setLineDash([5, 5]);  
      
    ctx.beginPath();  
    ctx.moveTo(start.x, start.y);  
    ctx.lineTo(end.x, end.y);  
    ctx.stroke();  
      
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';  
    ctx.setLineDash([]);  
      
    ctx.beginPath();  
    ctx.arc(start.x, start.y, 6, 0, 2 * Math.PI);  
    ctx.fill();  
      
    ctx.beginPath();  
    ctx.arc(end.x, end.y, 6, 0, 2 * Math.PI);  
    ctx.fill();  
  });  
    
  console.log('Drew expert annotations');  
}

// ============================================================================  
// DRAWING FUNCTIONS  
// ============================================================================

function redrawAnnotations() {  
  const ctx = annotationCanvas.getContext('2d');  
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
    
  if (currentClip && currentClip.annotationType === 'gt') {  
    drawExpertAnnotations();  
  }  
    
  userAnnotations.forEach(annotation => {  
    drawLine(annotation.start, annotation.end, 'rgba(255, 0, 0, 0.8)', 4, false);  
  });  
    
  if (isDrawing && startPoint && currentLine) {  
    drawLine(startPoint, currentLine, 'rgba(255, 165, 0, 0.8)', 4, false);  
  }  
}

function drawLine(start, end, color = 'rgba(255, 0, 0, 0.8)', lineWidth = 4, clear = true) {  
  const ctx = annotationCanvas.getContext('2d');  
    
  if (clear) {  
    ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
    if (currentClip && currentClip.annotationType === 'gt') {  
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
    
  ctx.fillStyle = color;  
    
  ctx.beginPath();  
  ctx.arc(startPixel.x, startPixel.y, 6, 0, 2 * Math.PI);  
  ctx.fill();  
    
  ctx.beginPath();  
  ctx.arc(endPixel.x, endPixel.y, 6, 0, 2 * Math.PI);  
  ctx.fill();  
}

function clearAnnotations() {  
  userAnnotations = [];  
  isDrawing = false;  
  startPoint = null;  
  currentLine = null;  
    
  const ctx = annotationCanvas.getContext('2d');  
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
    
  if (currentClip && currentClip.annotationType === 'gt') {  
    drawExpertAnnotations();  
  }  
    
  updateSubmitButton();  
  showToast('Annotation cleared');  
}

// ============================================================================  
// DRAWING EVENT HANDLERS  
// ============================================================================

function startDrawing(event) {  
  event.preventDefault();  
  userAnnotations = [];  
  isDrawing = true;  
  startPoint = getNormalizedCoordinates(annotationCanvas, event);  
  currentLine = startPoint;  
  redrawAnnotations();  
}

function continueDrawing(event) {  
  if (!isDrawing) return;  
  event.preventDefault();  
  currentLine = getNormalizedCoordinates(annotationCanvas, event);  
  redrawAnnotations();  
}

function finishDrawing(event) {  
  if (!isDrawing) return;  
  event.preventDefault();  
    
  if (currentLine && startPoint) {  
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

function loadClip(index) {  
  console.log('loadClip called with index:', index);  
  console.log('Total clips:', window.ANNOTATION_CLIPS ? window.ANNOTATION_CLIPS.length : 0);  
    
  if (!window.ANNOTATION_CLIPS || index >= window.ANNOTATION_CLIPS.length) {  
    console.log('No more clips, showing completion');  
    showCompletionMessage();  
    return;  
  }  
    
  currentClipIndex = index;  
  currentClip = window.ANNOTATION_CLIPS[index];  
    
  console.log('Loading clip:', currentClip);  
    
  // Reset state  
  capturedFrameData = null;  
  userAnnotations = [];  
  isDrawing = false;  
  startPoint = null;  
  currentLine = null;  
    
  // Update UI  
  if (clipLabel) {  
    clipLabel.textContent = `2. Review Clip (${index + 1} of ${window.ANNOTATION_CLIPS.length})`;  
  }  
    
  // Reset UI state  
  canvasContainer.hidden = true;  
  videoElement.style.display = 'block';  
  replayBtn.disabled = true;  
  clearLineBtn.disabled = true;  
  if (confidenceSection) confidenceSection.hidden = true;  
    
  // Clear canvases  
  if (finalFrameCanvas && annotationCanvas) {  
    const finalCtx = finalFrameCanvas.getContext('2d');  
    const annotationCtx = annotationCanvas.getContext('2d');  
    finalCtx.clearRect(0, 0, finalFrameCanvas.width, finalFrameCanvas.height);  
    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);  
  }  
    
  // Load video  
  if (videoStatus) videoStatus.textContent = 'Loading clip...';  
    
  console.log('Setting video src to:', currentClip.src);  
    
  // Add controls attribute for user to play video  
  videoElement.controls = true;  
  videoElement.src = currentClip.src;  
  videoElement.load();  
    
  updateSubmitButton();  
    
  console.log('Clip load initiated');  
}

function replayVideo() {  
  console.log('Replay video clicked');  
  capturedFrameData = null;  
  canvasContainer.hidden = true;  
  videoElement.style.display = 'block';  
  replayBtn.disabled = true;  
  clearLineBtn.disabled = true;  
    
  videoElement.currentTime = 0;  
  videoElement.play().catch(err => {  
    console.error('Replay failed:', err);  
    showToast('Failed to replay video');  
  });  
    
  clearAnnotations();  
  if (videoStatus) videoStatus.textContent = 'Replaying clip...';  
}

function showCompletionMessage() {  
  console.log('Showing completion message');  
  const participantCard = document.getElementById('participantCard');  
  const videoCard = document.getElementById('videoCard');  
  const canvasCard = document.getElementById('canvasCard');  
  const submitCard = document.getElementById('submitCard');  
    
  if (participantCard) participantCard.style.display = 'none';  
  if (videoCard) videoCard.style.display = 'none';  
  if (canvasCard) canvasCard.style.display = 'none';  
  if (submitCard) submitCard.style.display = 'none';  
  if (confidenceSection) confidenceSection.hidden = true;  
  if (completionCard) completionCard.hidden = false;  
}

// ============================================================================  
// FORM SUBMISSION  
// ============================================================================

function updateSubmitButton() {  
  const hasAnnotation = userAnnotations.length > 0;  
  submitBtn.disabled = !hasAnnotation;  
    
  if (submissionStatus) {  
    if (hasAnnotation) {  
      submissionStatus.textContent = 'Ready to submit!';  
    } else {  
      submissionStatus.textContent = 'Draw the incision on the frozen frame to enable submission.';  
    }  
  }  
}

async function submitAnnotation() {  
  console.log('Submit annotation clicked');  
    
  const email = participantIdInput.value.trim();  
  const alertness = fatigueInput.value;  
    
  if (!email) {  
    alert('Please enter your email address.');  
    participantIdInput.focus();  
    return;  
  }  
    
  if (!alertness) {  
    alert('Please select how you are feeling right now.');  
    fatigueInput.focus();  
    return;  
  }  
    
  if (userAnnotations.length === 0) {  
    alert('Please draw an incision line before submitting.');  
    return;  
  }  
    
  const submissionData = {  
    clipId: currentClip.id,  
    clipLabel: currentClip.label,  
    clipIndex: currentClipIndex,  
    participantEmail: email,  
    alertnessLevel: parseInt(alertness),  
    annotationType: currentClip.annotationType,  
    annotation: userAnnotations[0],  
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
    
  // Submit to Formspree  
  if (window.ANNOTATION_SUBMISSION && window.ANNOTATION_SUBMISSION.endpoint) {  
    try {  
      const response = await fetch(window.ANNOTATION_SUBMISSION.endpoint, {  
        method: window.ANNOTATION_SUBMISSION.method || 'POST',  
        headers: window.ANNOTATION_SUBMISSION.headers || {  
          'Content-Type': 'application/json'  
        },  
        body: JSON.stringify(submissionData)  
      });  
        
      if (response.ok) {  
        console.log('Submission successful');  
        showToast('Annotation submitted successfully!');  
      } else {  
        console.error('Submission failed:', response.status);  
        showToast('Submission failed. Data logged to console.');  
      }  
    } catch (error) {  
      console.error('Submission error:', error);  
      showToast('Submission error. Data logged to console.');  
    }  
  }  
    
  if (confidenceSection) {  
    confidenceSection.hidden = false;  
    confidenceSection.scrollIntoView({ behavior: 'smooth' });  
  }  
}

async function submitConfidence() {  
  console.log('Submit confidence clicked');  
    
  const confidence = confidenceInput.value;  
    
  if (!confidence) {  
    alert('Please select your confidence level.');  
    return;  
  }  
    
  const confidenceData = {  
    clipId: currentClip.id,  
    clipLabel: currentClip.label,  
    participantEmail: participantIdInput.value,  
    confidenceLevel: parseInt(confidence),  
    timestamp: new Date().toISOString()  
  };  
    
  console.log('Submitting confidence:', confidenceData);  
    
  // Submit confidence to Formspree  
  if (window.ANNOTATION_SUBMISSION && window.ANNOTATION_SUBMISSION.endpoint) {  
    try {  
      const response = await fetch(window.ANNOTATION_SUBMISSION.endpoint, {  
        method: window.ANNOTATION_SUBMISSION.method || 'POST',  
        headers: window.ANNOTATION_SUBMISSION.headers || {  
          'Content-Type': 'application/json'  
        },  
        body: JSON.stringify({ confidence: confidenceData })  
      });  
        
      if (response.ok) {  
        console.log('Confidence submitted successfully');  
      }  
    } catch (error) {  
      console.error('Confidence submission error:', error);  
    }  
  }  
    
  showToast('Moving to next clip...');  
    
  confidenceInput.value = '';  
  if (confidenceSection) confidenceSection.hidden = true;  
    
  loadClip(currentClipIndex + 1);  
    
  window.scrollTo({ top: 0, behavior: 'smooth' });  
}

// ============================================================================  
// WINDOW RESIZE HANDLER  
// ============================================================================

const handleResize = debounce(() => {  
  if (capturedFrameData && !canvasContainer.hidden) {  
    console.log('Resizing canvases...');  
    captureFinalFrame(videoElement, finalFrameCanvas);  
    annotationCanvas.width = finalFrameCanvas.width;  
    annotationCanvas.height = finalFrameCanvas.height;  
    redrawAnnotations();  
  }  
}, 250);

// ============================================================================  
// EVENT LISTENERS  
// ============================================================================

function setupEventListeners() {  
  console.log('Setting up event listeners...');  
    
  // Video events  
  videoElement.addEventListener('loadstart', () => {  
    console.log('Video loadstart');  
    if (videoStatus) videoStatus.textContent = 'Starting to load video...';  
  });  
    
  videoElement.addEventListener('loadedmetadata', () => {  
    console.log('Video metadata loaded');  
    console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);  
    if (videoStatus) videoStatus.textContent = 'Video ready. Use controls to play.';  
  });  
    
  videoElement.addEventListener('loadeddata', () => {  
    console.log('Video data loaded');  
    if (videoStatus) videoStatus.textContent = 'Video loaded. Click play to begin.';  
  });  
    
  videoElement.addEventListener('canplay', () => {  
    console.log('Video can play');  
  });  
    
  videoElement.addEventListener('play', () => {  
    console.log('Video playing');  
    if (videoStatus) videoStatus.textContent = 'Video playing...';  
  });  
    
  videoElement.addEventListener('ended', handleVideoEnd);  
    
  videoElement.addEventListener('error', (e) => {  
    console.error('Video error:', e);  
    console.error('Video error code:', videoElement.error ? videoElement.error.code : 'unknown');  
    console.error('Video error message:', videoElement.error ? videoElement.error.message : 'unknown');  
    if (videoStatus) videoStatus.textContent = 'Error loading video. Trying next clip...';  
      
    // Auto-skip problematic videos after 3 seconds  
    setTimeout(() => {  
      if (currentClipIndex < window.ANNOTATION_CLIPS.length - 1) {  
        showToast('Skipping problematic clip...');  
        loadClip(currentClipIndex + 1);  
      }  
    }, 3000);  
  });  
    
  // Mouse events  
  annotationCanvas.addEventListener('mousedown', startDrawing);  
  annotationCanvas.addEventListener('mousemove', continueDrawing);  
  annotationCanvas.addEventListener('mouseup', finishDrawing);  
  annotationCanvas.addEventListener('mouseleave', cancelDrawing);  
    
  // Touch events  
  annotationCanvas.addEventListener('touchstart', startDrawing, { passive: false });  
  annotationCanvas.addEventListener('touchmove', continueDrawing, { passive: false });  
  annotationCanvas.addEventListener('touchend', finishDrawing, { passive: false });  
  annotationCanvas.addEventListener('touchcancel', cancelDrawing, { passive: false });  
    
  // Button events  
  clearLineBtn.addEventListener('click', clearAnnotations);  
  replayBtn.addEventListener('click', replayVideo);  
  submitBtn.addEventListener('click', submitAnnotation);  
  submitConfidenceBtn.addEventListener('click', submitConfidence);  
    
  // Window events  
  window.addEventListener('resize', handleResize);  
  window.addEventListener('orientationchange', () => {  
    setTimeout(handleResize, 300);  
  });  
    
  console.log('Event listeners set up');  
}

// ============================================================================  
// INITIALIZATION  
// ============================================================================

function initializeApp() {  
  console.log('=== INITIALIZING APP ===');  
    
  // Get DOM elements  
  videoElement = document.getElementById('caseVideo');  
  replayBtn = document.getElementById('replayBtn');  
  finalFrameCanvas = document.getElementById('finalFrame');  
  annotationCanvas = document.getElementById('annotationCanvas');  
  canvasContainer = document.getElementById('canvasContainer');  
  clearLineBtn = document.getElementById('clearLineBtn');  
  submitBtn = document.getElementById('submitAnnotationBtn');  
  videoStatus = document.getElementById('videoStatus');  
  clipLabel = document.getElementById('clipLabel');  
  participantIdInput = document.getElementById('participantIdInput');  
  fatigueInput = document.getElementById('fatigueInput');  
  confidenceSection = document.getElementById('confidenceSection');  
  confidenceInput = document.getElementById('confidenceInput');  
  submitConfidenceBtn = document.getElementById('submitConfidenceBtn');  
  completionCard = document.getElementById('completionCard');  
  annotationStatus = document.getElementById('annotationStatus');  
  submissionStatus = document.getElementById('submissionStatus');  
    
  // Check required elements  
  console.log('Video element found:', !!videoElement);  
  console.log('Canvas elements found:', !!finalFrameCanvas, !!annotationCanvas);  
  console.log('Button elements found:', !!submitBtn, !!clearLineBtn, !!replayBtn);  
    
  if (!videoElement) {  
    console.error('CRITICAL: Video element not found!');  
    return;  
  }  
    
  if (!window.ANNOTATION_CLIPS || window.ANNOTATION_CLIPS.length === 0) {  
    console.error('No clips found in ANNOTATION_CLIPS');  
    if (videoStatus) videoStatus.textContent = 'No clips available. Please check configuration.';  
    return;  
  }  
    
  console.log('Found', window.ANNOTATION_CLIPS.length, 'clips');  
  console.log('Submission endpoint:', window.ANNOTATION_SUBMISSION?.endpoint);  
    
  setupEventListeners();  
  loadClip(0);  
    
  console.log('=== APP INITIALIZED ===');  
}

// ============================================================================  
// START APPLICATION  
// ============================================================================

if (document.readyState === 'loading') {  
  console.log('Waiting for DOMContentLoaded...');  
  document.addEventListener('DOMContentLoaded', initializeApp);  
} else {  
  console.log('DOM already loaded, initializing immediately');  
  initializeApp();  
}  
