const IMAGE_MAP = {
    neutral: './faces/neutral.jpg',
    happy: './faces/happy.jpg',
    sad: './faces/sad.jpg',
    angry: './faces/angry.jpg',
    disgusted: './faces/disgusted.jpg',
    surprised: './faces/surprised.jpg'
};

function preloadImages() {
    Object.values(IMAGE_MAP).forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

preloadImages();

const CONFIDENCE_THRESHOLD = 0.5;
const UPDATE_INTERVAL = 50;
const EXPRESSION_HOLD_TIME = 300;

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let DETECTION_OPTIONS;

let video, canvas, displayTimeDimensions;
let isDetecting = false;
let detectionInterval = null;
let lastExpressionChange = 0;
let currentExpression = 'neutral';
let modelsLoaded = false;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const videoElement = document.getElementById('video');
const overlayCanvas = document.getElementById('overlay');
const expressionImage = document.getElementById('expressionImage');
const expressionName = document.getElementById('expressionName');
const currentExpressionSpan = document.getElementById('currentExpression');
const cameraStatusSpan = document.getElementById('cameraStatus');
const errorModal = document.getElementById('errorModal');
const loadingModal = document.getElementById('loadingModal');
const closeErrorModalBtn = document.getElementById('closeErrorModal');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Hamster Face Detector...');
    
    preloadImages();
    
    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    closeErrorModalBtn.addEventListener('click', closeErrorModal);
    
    if (typeof faceapi === 'undefined') {
        console.log('Waiting for face-api.js to load...');
        
        setTimeout(() => {
            if (typeof faceapi === 'undefined') {
                console.error('face-api.js failed to load');
                hideLoadingModal();
                showError('Failed to load face-api.js library. Please check your internet connection and refresh the page.');
                return;
            }
        }, 10000);
        
        const checkInterval = setInterval(() => {
            if (typeof faceapi !== 'undefined') {
                clearInterval(checkInterval);
                loadModels();
            }
        }, 100);
    } else {
        await loadModels();
    }
});

async function loadModels() {
    console.log('Loading face-api.js models...');
    updateCameraStatus('Loading models...');
    
    try {
        DETECTION_OPTIONS = new faceapi.SsdMobilenetv1Options({
            inputSize: 224,
            scoreThreshold: 0.5
        });

        const loadingTimeout = setTimeout(() => {
            console.error('Model loading timeout');
            hideLoadingModal();
            showError('Model loading timed out. You can still try to use the camera, but face detection may not work properly.');
            updateCameraStatus('Model loading failed - Camera available');
        }, 15000);

        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        console.log('Face detection model loaded');
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log('Face landmarks model loaded');
        
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        console.log('Face expression model loaded');
        
        clearTimeout(loadingTimeout);
        
        console.log('All models loaded successfully!');
        updateCameraStatus('Models loaded - Ready to start');
        modelsLoaded = true;
        hideLoadingModal();
        
    } catch (error) {
        console.error('Error loading models:', error);
        hideLoadingModal();
        
        updateCameraStatus('Models failed to load - Camera available without detection');
        showError('Face detection models failed to load. You can still use the camera, but expression detection will not work. This may be due to network issues.');
    }
}

async function startCamera() {
    console.log('Starting camera...');
    updateCameraStatus('Starting camera...');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        
        videoElement.srcObject = stream;
        updateCameraStatus('Camera active');
        
        await new Promise(resolve => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });
        
        setupCanvas();
        
        if (modelsLoaded) {
            startDetection();
            updateCameraStatus('Camera active - Detection running');
        } else {
            updateCameraStatus('Camera active - Detection unavailable (models not loaded)');
        }
        
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        
        console.log('Camera started successfully');
        
    } catch (error) {
        console.error('Camera error:', error);
        let errorMessage = 'Failed to access camera. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera found on this device.';
        } else {
            errorMessage += 'Please check your camera settings.';
        }
        
        showError(errorMessage);
        updateCameraStatus('Camera error');
    }
}

function stopCamera() {
    console.log('Stopping camera...');
    
    stopDetection();
    
    const stream = videoElement.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    
    if (overlayCanvas) {
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    updateCameraStatus('Camera stopped');
    updateExpressionDisplay('neutral', 0);
    currentExpressionSpan.textContent = 'None detected';
    
    console.log('Camera stopped');
}

function setupCanvas() {
    displayTimeDimensions = {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight
    };
    
    overlayCanvas.width = displayTimeDimensions.width;
    overlayCanvas.height = displayTimeDimensions.height;
    
    const videoRect = videoElement.getBoundingClientRect();
    overlayCanvas.style.width = videoRect.width + 'px';
    overlayCanvas.style.height = videoRect.height + 'px';
}

function startDetection() {
    if (!modelsLoaded) {
        console.warn('Cannot start detection - models not loaded');
        return;
    }
    
    isDetecting = true;
    
    detectionInterval = setInterval(async () => {
        if (!isDetecting) return;
        
        try {
            await detectExpressions();
        } catch (error) {
            console.error('Detection error:', error);
        }
    }, UPDATE_INTERVAL);
    
    console.log('Expression detection started');
}

function stopDetection() {
    isDetecting = false;
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    console.log('Expression detection stopped');
}

async function detectExpressions() {
    if (!modelsLoaded) return;
    
    try {
        const detections = await faceapi
            .detectAllFaces(videoElement, DETECTION_OPTIONS)
            .withFaceLandmarks()
            .withFaceExpressions();
        
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        if (detections.length > 0) {
            const detection = detections[0];
            
            drawDetection(ctx, detection);
            
            const expressions = detection.expressions;
            const dominantExpression = getDominantExpression(expressions);
            
            if (dominantExpression.confidence > CONFIDENCE_THRESHOLD && IMAGE_MAP[dominantExpression.expression]) {
                const now = Date.now();
                if (now - lastExpressionChange > EXPRESSION_HOLD_TIME || 
                    dominantExpression.expression !== currentExpression) {
                    
                    updateExpressionDisplay(dominantExpression.expression, dominantExpression.confidence);
                    currentExpression = dominantExpression.expression;
                    lastExpressionChange = now;
                    
                    onExpressionDetected(dominantExpression.expression, dominantExpression.confidence);
                }
            }
            
            currentExpressionSpan.textContent = dominantExpression.expression;
            
        } else {
            currentExpressionSpan.textContent = 'No face detected';
        }
    } catch (error) {
        console.error('Detection error:', error);
        currentExpressionSpan.textContent = 'Detection error';
    }
}

function getDominantExpression(expressions) {
    let maxConfidence = 0;
    let dominantExpression = 'neutral';
    
    Object.keys(expressions).forEach(expression => {
        if (expressions[expression] > maxConfidence) {
            maxConfidence = expressions[expression];
            dominantExpression = expression;
        }
    });
    
    return {
        expression: dominantExpression,
        confidence: maxConfidence
    };
}

function onExpressionDetected(expression, confidence) {
    console.log(`Expression detected: ${expression} (${Math.round(confidence * 100)}%)`);
}

function updateExpressionDisplay(expression, confidence) {
    if (IMAGE_MAP[expression]) {
        if (IMAGE_MAP[expression].startsWith('http') || IMAGE_MAP[expression].startsWith('./')) {
            expressionImage.innerHTML = `<img src="${IMAGE_MAP[expression]}" alt="${expression}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        } else if (IMAGE_MAP[expression].startsWith('<')) {
            expressionImage.innerHTML = IMAGE_MAP[expression];
        } else {
            expressionImage.innerHTML = `<div style="font-size: 4rem;">${IMAGE_MAP[expression]}</div>`;
        }
    } else {
        expressionImage.innerHTML = `<div style="font-size: 4rem;">❓</div>`;
    }
    
    expressionName.textContent = `${expression.charAt(0).toUpperCase() + expression.slice(1)}`;
}

function drawDetection(ctx, detection) {
    const box = detection.detection.box;
    ctx.strokeStyle = '#32c896';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
}

function updateCameraStatus(status) {
    cameraStatusSpan.textContent = status;
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    errorModal.classList.remove('hidden');
}

function closeErrorModal() {
    errorModal.classList.add('hidden');
}

function hideLoadingModal() {
    loadingModal.classList.add('hidden');
}

window.addEventListener('error', (event) => {
    console.error('Application error:', event.error);
    hideLoadingModal();
    showError('An unexpected error occurred. Please refresh the page.');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    hideLoadingModal();
});

console.log('Hamster Face Detector initialized');