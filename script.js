const eye = document.querySelector(".eye");
const pupilEl = document.querySelector(".pupil");

let player;
let musicPlaying = false;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("ytplayer");
}

function toggleVideo() {
  const icon = document.getElementById("music-icon");

  if (!musicPlaying) {
    player.playVideo();
    icon.textContent = "🎵";
    icon.classList.add("active-music");
  } else {
    player.pauseVideo();
    icon.textContent = "🔇";
    icon.classList.remove("active-music");
  }

  musicPlaying = !musicPlaying;
}

// === MEDIAPIPE HAND CONTROL ===
const video = document.getElementById("input-video");

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});

hands.onResults((results) => {
  const eyeBg = document.querySelector(".eye-bg");

  // === Overlay Canvas Setup ===
  const canvasElement = document.getElementById("overlay-canvas");
  const canvasCtx = canvasElement.getContext("2d");

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#0ff",
        lineWidth: 2,
      });
      drawLandmarks(canvasCtx, landmarks, {
        color: "#f00",
        lineWidth: 1,
      });
    }
  }

  canvasCtx.restore();

  // === NO HAND DETECTED ===
  if (!results.multiHandLandmarks.length) {
    pupilEl.style.display = "none";
    eyeBg.src = "assets/closed-eye.png";
    return;
  }

  // === HAND DETECTED ===
  pupilEl.style.display = "block";
  eyeBg.src = "assets/eye.png";

  const hand = results.multiHandLandmarks[0];
  const wrist = hand[0];

  // Estimate palm size (wrist to base of middle finger)
  const palmBase = hand[9]; // base of middle finger
  const palmSize = Math.hypot(palmBase.x - wrist.x, palmBase.y - wrist.y);

  // Adjusted threshold based on palm size
  const fistThreshold = palmSize * 1.1;

  const isFist = [8, 12, 16, 20].every((id) => {
    const tip = hand[id];
    const dist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    return dist < fistThreshold;
  });

  if (isFist) {
    pupilEl.style.display = "none";
    eyeBg.src = "assets/closed-eye.png";
    return;
  }

  // === FINGER EXTENSION HELPER ===
  const isFingerExtended = (id) => {
    const tip = hand[id];
    const base = hand[id - 2];
    return tip.y < base.y;
  };

  // === POINTING GESTURE (Index Only) ===
  const pointingGesture =
    isFingerExtended(8) &&
    !isFingerExtended(12) &&
    !isFingerExtended(16) &&
    !isFingerExtended(20);

  if (pointingGesture) {
    pupilEl.src = "assets/red-pupil.png";
  } else {
    pupilEl.src = "assets/pupil.png";
  }

  // === PUPIL TRACKING ===
  const eyeRect = eye.getBoundingClientRect();
  const centerX = eyeRect.left + eyeRect.width / 2;
  const centerY = eyeRect.top + eyeRect.height / 2;

  const x = (1 - wrist.x) * window.innerWidth;
  const y = wrist.y * window.innerHeight;

  const angle = Math.atan2(y - centerY, x - centerX);
  const distance = Math.min(
    eyeRect.width / 4,
    Math.hypot(x - centerX, y - centerY) / 5
  );

  const pupilX = Math.cos(angle) * distance;
  const pupilY = Math.sin(angle) * distance;

  pupilEl.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
});

const startCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  video.addEventListener("loadedmetadata", () => {
    const canvas = document.getElementById("overlay-canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  });

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera.start();
};

startCamera();

// === GESTURE GUIDE TOGGLE ===
document.getElementById("toggle-gesture").addEventListener("click", () => {
  const box = document.getElementById("gestureBox");
  box.classList.toggle("show");
});
