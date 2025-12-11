const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hud = {
  speed: document.getElementById('speed'),
  distance: document.getElementById('distance'),
  height: document.getElementById('height'),
};

let lastTime = performance.now();
let cameraX = 0;
let elapsed = 0;

const controls = {
  holding: false,
  charge: 0,
};

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

function isSpace(event) {
  return event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar' || event.key === 'Space';
}

function handleSpaceDown(event) {
  if (!isSpace(event)) return;
  event.preventDefault();
  if (!controls.holding) {
    controls.charge = 0;
    controls.holding = true;
  }
}

function handleSpaceUp(event) {
  if (!isSpace(event)) return;
  event.preventDefault();
  controls.holding = false;

  if (!surfer.airborne) {
    const slope = slopeAt(surfer.worldX);
    const slopeLift = Math.max(0, -slope) * 160;
    const speedLift = Math.min(surfer.speed, 520) * 0.28;
    const stored = Math.min(320, controls.charge * 360);
    const jumpVelocity = -260 - slopeLift - speedLift - stored;
    surfer.vy = jumpVelocity;
    surfer.airborne = true;
    surfer.rotation = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan(slope) - 0.15));
    controls.charge = 0;
  }
}

window.addEventListener('keydown', (event) => {
  if (event.key && event.key.toLowerCase() === 'r') {
    resetGame();
    return;
  }
  handleSpaceDown(event);
});

window.addEventListener('keyup', handleSpaceUp, { passive: false });
window.addEventListener('keypress', handleSpaceDown, { passive: false });
window.addEventListener('blur', () => {
  controls.holding = false;
  controls.charge = 0;
});
setTimeout(() => canvas.focus(), 50);

function update(dt) {
  elapsed += dt;
  let gravity = 1050;

  const terrainY = waveHeight(surfer.worldX);
  const slope = slopeAt(surfer.worldX);
  const angle = Math.atan(slope);

  if (controls.holding) {
    if (!surfer.airborne) {
      controls.charge = Math.min(1.2, controls.charge + dt);
    }
    gravity += 650;
  } else if (!surfer.airborne) {
    controls.charge = Math.max(0, controls.charge - dt * 0.5);
  }

  surfer.vy += gravity * dt;

  const drag = surfer.airborne ? 0.996 : 0.999;
  surfer.speed = Math.max(80, Math.min(520, surfer.speed * drag));

  // Dive acceleration along the slope when grounded
  if (!surfer.airborne) {
    const downhill = Math.max(0, -Math.sin(angle));
    const drive = controls.holding ? 360 : 220;
    surfer.speed += downhill * drive * dt;
    if (controls.holding) {
      surfer.speed += 45 * dt;
    }
  }

  surfer.worldX += surfer.speed * dt;
  cameraX = surfer.worldX - canvas.width * 0.25;

  const hoverLimit = canvas.height * 0.05;
  if (surfer.y < hoverLimit) {
    surfer.y = hoverLimit;
    if (surfer.vy < 0) surfer.vy = 0;
  }

  surfer.y += surfer.vy * dt;

  if (surfer.y >= terrainY) {
    const hardLanding = surfer.airborne && surfer.vy > 220;
    surfer.airborne = false;
    surfer.y = terrainY;
    if (surfer.vy > 0) surfer.vy = 0;

    if (hardLanding) {
      surfer.speed *= 0.97;
    }

    // Re-align to the water surface
    surfer.rotation += (angle - surfer.rotation) * 0.25;
  } else {
    surfer.airborne = true;
    const targetAngle = Math.atan2(surfer.vy, surfer.speed);
    surfer.rotation += (targetAngle - surfer.rotation) * 0.05;
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
  ctx.translate(-10, 0);
  ctx.rotate(0.06);
  ctx.fillStyle = '#ffd166';
  ctx.strokeStyle = '#e49c2f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Body
  ctx.fillStyle = '#e9f1fb';
  ctx.strokeStyle = '#1f4b6f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(8, -8, 12, 26, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wetsuit
  ctx.fillStyle = '#1f7a9c';
  ctx.beginPath();
  ctx.ellipse(8, 6, 10, 16, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  ctx.strokeStyle = '#1f4b6f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(16, -10);
  ctx.moveTo(-4, 6);
  ctx.lineTo(18, 2);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#fefefe';
  ctx.beginPath();
  ctx.arc(20, -26, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Sunglasses
  ctx.fillStyle = '#0c1a24';
  ctx.fillRect(14, -31, 7, 5);
  ctx.fillRect(23, -31, 7, 5);
  ctx.fillRect(21, -28, 4, 3);

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
