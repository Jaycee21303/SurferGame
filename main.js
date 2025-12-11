const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hud = {
  speed: document.getElementById('speed'),
  distance: document.getElementById('distance'),
  height: document.getElementById('height'),
};

let holdDive = false;
let lastTime = performance.now();
let cameraX = 0;
let elapsed = 0;

const surfer = {
  worldX: 0,
  y: 0,
  vy: 0,
  speed: 160,
  rotation: 0,
  airborne: false,
  startX: 0,
};

function resize() {
  const ratio = 16 / 9;
  const width = Math.min(1100, window.innerWidth - 32);
  canvas.width = width;
  canvas.height = width / ratio;
}

window.addEventListener('resize', resize);
resize();

function waveHeight(x) {
  const t = elapsed * 0.4;
  const base = canvas.height * 0.65;
  const gentle = Math.sin(x * 0.007 + t) * 55;
  const rolling = Math.sin(x * 0.0035 - t * 1.3) * 80;
  const ripples = Math.sin(x * 0.016 + t * 1.6) * 12;
  return base + gentle + rolling + ripples;
}

function slopeAt(x) {
  const step = 2;
  const h1 = waveHeight(x - step);
  const h2 = waveHeight(x + step);
  return (h2 - h1) / (2 * step);
}

function resetGame() {
  surfer.worldX = 0;
  surfer.startX = 0;
  surfer.speed = 170;
  surfer.y = waveHeight(0);
  surfer.vy = 0;
  surfer.rotation = 0;
  surfer.airborne = false;
  cameraX = -canvas.width * 0.2;
  elapsed = 0;
}

resetGame();

function handleInput(isDown) {
  holdDive = isDown;
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    handleInput(true);
  }
  if (event.key.toLowerCase() === 'r') {
    resetGame();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    handleInput(false);
  }
});

function bindPointerInput(target) {
  target.addEventListener('mousedown', () => handleInput(true));
  target.addEventListener('mouseup', () => handleInput(false));
  target.addEventListener('mouseleave', () => handleInput(false));
  target.addEventListener(
    'touchstart',
    (event) => {
      event.preventDefault();
      handleInput(true);
    },
    { passive: false },
  );
  target.addEventListener(
    'touchend',
    () => handleInput(false),
    { passive: true },
  );
  target.addEventListener('touchcancel', () => handleInput(false));
}

bindPointerInput(canvas);
bindPointerInput(window);
window.addEventListener('blur', () => handleInput(false));

function update(dt) {
  elapsed += dt;
  const gravity = holdDive ? 1400 : 900;
  surfer.vy += gravity * dt;

  const airDrag = surfer.airborne ? 0.995 : 0.999;
  surfer.speed = Math.max(90, Math.min(480, surfer.speed * airDrag + (holdDive ? 18 : 0) * dt));

  surfer.worldX += surfer.speed * dt;
  cameraX = surfer.worldX - canvas.width * 0.25;

  const terrainY = waveHeight(surfer.worldX);
  const slope = slopeAt(surfer.worldX);
  const angle = Math.atan(slope);

  const hoverLimit = canvas.height * 0.05;
  if (surfer.y < hoverLimit) {
    surfer.y = hoverLimit;
    if (surfer.vy < 0) surfer.vy = 0;
  }

  surfer.y += surfer.vy * dt;

  if (surfer.y >= terrainY) {
    // Touching or below the wave
    if (surfer.airborne && surfer.vy > 220) {
      surfer.speed *= 0.98; // cushion a hard landing
    }
    surfer.airborne = false;
    surfer.y = terrainY;
    if (surfer.vy > 0) surfer.vy = 0;

    // Accelerate along the slope: downhill boosts, uphill slows
    const slopeBoost = -Math.sin(angle) * 250 * dt;
    surfer.speed = Math.max(80, Math.min(520, surfer.speed + slopeBoost));

    // If the wave curves upward sharply while the player releases dive, launch
    const launchReady = slope < -0.6 && !holdDive;
    if (launchReady) {
      surfer.vy = Math.min(-500, slope * -420);
      surfer.airborne = true;
    }

    surfer.rotation += (angle - surfer.rotation) * 0.2;
  } else {
    // Airborne
    surfer.airborne = true;
    const targetAngle = Math.atan2(surfer.vy, surfer.speed);
    surfer.rotation += (targetAngle - surfer.rotation) * 0.04;
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#7cc6ff');
  sky.addColorStop(0.6, '#b8ecff');
  sky.addColorStop(1, '#e8fbff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sun
  ctx.beginPath();
  ctx.arc(canvas.width - 120, 120, 60, 0, Math.PI * 2);
  const sun = ctx.createRadialGradient(canvas.width - 120, 120, 10, canvas.width - 120, 120, 80);
  sun.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  sun.addColorStop(1, 'rgba(255, 231, 150, 0)');
  ctx.fillStyle = sun;
  ctx.fill();
}

function drawWaves() {
  const step = 6;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let screenX = 0; screenX <= canvas.width + step; screenX += step) {
    const worldX = screenX + cameraX;
    const y = waveHeight(worldX);
    ctx.lineTo(screenX, y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();

  const ocean = ctx.createLinearGradient(0, canvas.height * 0.45, 0, canvas.height);
  ocean.addColorStop(0, '#2176c7');
  ocean.addColorStop(1, '#0c2d50');
  ctx.fillStyle = ocean;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 18]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSurfer() {
  const screenX = surfer.worldX - cameraX;
  const screenY = surfer.y;

  ctx.save();
  ctx.translate(screenX, screenY - 10);
  ctx.rotate(surfer.rotation);

  // Surfboard
  ctx.save();
  ctx.translate(-12, 0);
  ctx.rotate(0.06);
  ctx.fillStyle = '#ffd166';
  ctx.strokeStyle = '#e49c2f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Body
  ctx.fillStyle = '#f4f7fb';
  ctx.strokeStyle = '#1f4b6f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(6, -10, 18, 22, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wetsuit
  ctx.fillStyle = '#1f7a9c';
  ctx.beginPath();
  ctx.ellipse(6, 4, 15, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#fefefe';
  ctx.beginPath();
  ctx.arc(22, -24, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Sunglasses
  ctx.fillStyle = '#0c1a24';
  ctx.fillRect(16, -28, 8, 6);
  ctx.fillRect(25, -28, 8, 6);
  ctx.fillRect(24, -25, 4, 3);

  // Spray
  if (!surfer.airborne) {
    ctx.save();
    ctx.translate(-10, 12);
    ctx.rotate(-0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18, Math.PI * 0.2, Math.PI * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawHUD() {
  hud.speed.textContent = `Speed: ${Math.round(surfer.speed)} km/h`;
  const distance = (surfer.worldX - surfer.startX) / 3; // rough meters
  hud.distance.textContent = `Distance: ${Math.max(0, Math.round(distance))} m`;
  const altitude = Math.max(0, Math.round((waveHeight(surfer.worldX) - surfer.y)));
  hud.height.textContent = `Height: ${altitude} m`;
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  drawBackground();
  drawWaves();
  drawSurfer();
  drawHUD();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
