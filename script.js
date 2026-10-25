document.addEventListener('DOMContentLoaded', () => {
    // --- Smooth 3D Card Tilt & Spotlight Effect ---
    const cards = document.querySelectorAll('.feature-card');
    if (cards.length > 0) {
        cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (-(y - centerY) / rect.height) * 16;
                const rotateY = ((x - centerX) / rect.width) * 16;

                // Disable transition during movement for instant, fluid tracking
                card.style.transition = 'none';
                card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });

            card.addEventListener('mouseleave', () => {
                // Re-enable smooth transition only when snapping back to flat on exit
                card.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.4s ease, box-shadow 0.4s ease';
                card.style.transform = `rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            });
        });
    }

    // --- MediaPipe DOM Protection & App Initialization ---
    const videoElement = document.getElementById('inputVideo');
    if (videoElement) {
        initApp();
    }
});

function initApp() {
    const videoElement = document.getElementById('inputVideo');
    const canvasElement = document.getElementById('outputCanvas');
    const canvasCtx = canvasElement.getContext('2d');
    const videoContainer = document.getElementById('videoContainer');
    const videoPlaceholder = document.getElementById('videoPlaceholder');

    const syncScoreEl = document.getElementById('syncScore');
    const syncBarEl = document.getElementById('syncBar');
    const dataX = document.getElementById('dataX');
    const dataY = document.getElementById('dataY');
    const dataZ = document.getElementById('dataZ');
    const dataFrame = document.getElementById('dataFrame');
    const terminal = document.getElementById('terminal');
    const globalStatusDot = document.getElementById('globalStatusDot');
    const globalStatusText = document.getElementById('globalStatusText');

    const initBtn = document.getElementById('initBtn');
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const apprenticeBtn = document.getElementById('apprenticeBtn');

    canvasElement.width = 640;
    canvasElement.height = 480;

    let mode = 'idle';
    let masterData = []; 
    let frameCount = 0;
    let isSystemActive = false;

    function logTerminal(msg, colorClass = "text-green-400/80") {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        const log = document.createElement('div');
        log.className = colorClass;
        log.innerText = `[${time}] ${msg}`;
        terminal.appendChild(log);
        terminal.scrollTop = terminal.scrollHeight;
    }

    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({
        maxNumHands: 2, 
        modelComplexity: 1,
        minDetectionConfidence: 0.9,
        minTrackingConfidence: 0.9
    });
    hands.onResults(onResults);

    initBtn.addEventListener('click', () => {
        if (isSystemActive) return;
        logTerminal("Requesting camera access...", "text-yellow-400");
        globalStatusText.innerText = "INITIALIZING";
        
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 640,
            height: 480
        });
        
        camera.start().then(() => {
            isSystemActive = true;
            videoPlaceholder.classList.add('hidden');
            initBtn.style.display = 'none';
            recordBtn.disabled = false;
            
            globalStatusDot.className = "w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]";
            globalStatusText.innerText = "SYSTEM ONLINE";
            logTerminal("Neural mesh aligned. Camera active.", "text-blue-400");
        }).catch(error => {
            logTerminal("ERR: Camera Denied.", "text-red-500");
        });
    });

    recordBtn.addEventListener('click', () => {
        mode = 'recording';
        masterData = []; 
        frameCount = 0;
        logTerminal("MASTER MODE: Recording ALL spatial coordinates...", "text-torii");
        videoContainer.className = "flex-1 relative flex items-center justify-center bg-black overflow-hidden m-2 rounded-lg border status-recording";
        recordBtn.disabled = true; stopBtn.disabled = false; apprenticeBtn.disabled = true;
    });

    stopBtn.addEventListener('click', () => {
        mode = 'idle';
        logTerminal(`STOPPED. ${masterData.length} frames saved.`, "text-white");
        videoContainer.className = "flex-1 relative flex items-center justify-center bg-black overflow-hidden m-2 rounded-lg border border-white/5";
        recordBtn.disabled = false; stopBtn.disabled = true; apprenticeBtn.disabled = masterData.length === 0; 
        syncScoreEl.innerText = "--"; syncScoreEl.className = "text-6xl font-bold font-mono text-white tracking-tighter";
        syncBarEl.style.width = "0%";
    });

    apprenticeBtn.addEventListener('click', () => {
        mode = 'apprentice';
        frameCount = 0; 
        logTerminal("APPRENTICE MODE: Match the ghost trail.", "text-jade");
        recordBtn.disabled = true; stopBtn.disabled = false; apprenticeBtn.disabled = true;
    });

    function onResults(results) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        let currentFrameHands = {};
        if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                currentFrameHands[results.multiHandedness[i].label] = results.multiHandLandmarks[i];
                if (i === 0) {
                    const indexTip = results.multiHandLandmarks[i][8];
                    dataX.innerText = indexTip.x.toFixed(4);
                    dataY.innerText = indexTip.y.toFixed(4);
                    dataZ.innerText = indexTip.z.toFixed(4);
                }
            }
        }

        if (mode === 'recording') {
            masterData.push(currentFrameHands);
            dataFrame.innerText = `${masterData.length} / REC`;
        }

        if (mode === 'apprentice') {
            dataFrame.innerText = `${Math.floor(frameCount)} / ${masterData.length}`;
            if (Math.floor(frameCount) >= masterData.length) frameCount = 0; 
            
            const currentFrameIdx = Math.floor(frameCount);
            const targetFrameHands = masterData[currentFrameIdx];
            const trailLength = 20; // Only draw the last 20 frames to avoid screen clutter
            const startIdx = Math.max(0, currentFrameIdx - trailLength);
            
            // Clean trail calculation directly from masterData
            [4, 8, 12, 16, 20].forEach(tip => {
                canvasCtx.beginPath();
                let isFirstPoint = true;
                
                for (let i = startIdx; i <= currentFrameIdx; i++) {
                    const frameHands = masterData[i];
                    const hand = frameHands ? (frameHands['Right'] || frameHands['Left']) : null;
                    
                    if (hand && hand[tip]) {
                        const x = hand[tip].x * canvasElement.width;
                        const y = hand[tip].y * canvasElement.height;
                        if (isFirstPoint) {
                            canvasCtx.moveTo(x, y);
                            isFirstPoint = false;
                        } else {
                            canvasCtx.lineTo(x, y);
                        }
                    } else {
                        // If hand vanishes for a frame, break the trail so we don't draw wild connecting lines
                        isFirstPoint = true; 
                    }
                }
                canvasCtx.strokeStyle = 'rgba(212, 175, 55, 0.4)'; 
                canvasCtx.lineWidth = 3; 
                canvasCtx.stroke();
            });

            if (targetFrameHands) {
                for (const label in targetFrameHands) {
                    drawConnectors(canvasCtx, targetFrameHands[label], HAND_CONNECTIONS, {color: 'rgba(212, 175, 55, 0.3)', lineWidth: 5});
                    drawLandmarks(canvasCtx, targetFrameHands[label], {color: 'rgba(212, 175, 55, 0.8)', lineWidth: 1, radius: 4});
                }
            }

            let totalDeviation = 0;
            let checkedJoints = 0;
            
            if (targetFrameHands) {
                for (const label in targetFrameHands) {
                    if (currentFrameHands[label]) {
                        for (let j = 0; j < 21; j++) {
                            const dx = targetFrameHands[label][j].x - currentFrameHands[label][j].x;
                            const dy = targetFrameHands[label][j].y - currentFrameHands[label][j].y;
                            totalDeviation += Math.sqrt(dx * dx + dy * dy);
                            checkedJoints++;
                        }
                    }
                }
            }

            if (targetFrameHands && Object.keys(targetFrameHands).length > 0) {
                let meanDeviation = checkedJoints > 0 ? (totalDeviation / checkedJoints) : 1;
                let rawScore = Math.max(0, Math.min(100, 100 - (meanDeviation / 0.08 * 100)));
                
                syncScoreEl.innerText = Math.round(rawScore);
                syncBarEl.style.width = `${rawScore}%`;

                if (rawScore < 40) { 
                    videoContainer.className = "flex-1 relative flex items-center justify-center bg-black overflow-hidden m-2 rounded-lg border status-deviation";
                    syncScoreEl.className = "text-6xl font-bold font-mono text-red-500 tracking-tighter";
                    syncBarEl.className = "h-full bg-red-500 transition-all duration-75";
                } else {
                    videoContainer.className = "flex-1 relative flex items-center justify-center bg-black overflow-hidden m-2 rounded-lg border status-match";
                    syncScoreEl.className = "text-6xl font-bold font-mono text-jade tracking-tighter";
                    syncBarEl.className = "h-full bg-jade transition-all duration-75";
                }
            }
            frameCount += 0.3; 
        }

        let liveConnectorColor = (mode === 'recording') ? '#D4AF37' : 'rgba(255, 255, 255, 0.5)';
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: liveConnectorColor, lineWidth: 2}); 
                drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 2}); 
            }
        }
        canvasCtx.restore();
    }
}