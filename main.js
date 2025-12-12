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
  airTime: 0,
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
    const uphill = Math.max(0, -slope);
    const speedLift = Math.min(surfer.speed, 520) * 0.25;
    const chargeRatio = Math.min(1, controls.charge / 1.05);
    const stored = 220 * (chargeRatio * (2 - chargeRatio)); // ease-out charge
    const jumpVelocity = -220 - stored - uphill * 140 - speedLift;
    surfer.vy = jumpVelocity;
    surfer.airborne = true;
    surfer.rotation = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, Math.atan(slope) * 0.75 - 0.1));
    surfer.airTime = 0;
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

  surfer.airTime = surfer.airborne ? surfer.airTime + dt : 0;

  if (controls.holding) {
    if (!surfer.airborne) {
      controls.charge = Math.min(1.2, controls.charge + dt);
    }
    gravity += 650;
  } else if (!surfer.airborne) {
    controls.charge = Math.max(0, controls.charge - dt * 0.5);
  }

  if (surfer.airborne && surfer.airTime < 0.45) {
    gravity *= 0.75; // softer initial arc for smoother launches
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
    surfer.rotation += (targetAngle - surfer.rotation) * 0.06;
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

  // Surfboard base
  ctx.save();
  ctx.translate(-12, 2);
  ctx.rotate(0.08);
  ctx.fillStyle = '#ffd166';
  ctx.strokeStyle = '#e49c2f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-16, -3, 24, 6);
  ctx.restore();

  // Rear foot
  ctx.fillStyle = '#0f1d2c';
  ctx.beginPath();
  ctx.ellipse(-2, 6, 6, 3, 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Front foot
  ctx.beginPath();
  ctx.ellipse(20, 4, 7, 3.5, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Legs and torso (slim human form)
  ctx.strokeStyle = '#10334b';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#1b6b8c';
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(4, -14);
  ctx.lineTo(10, -18);
  ctx.lineTo(18, -16);
  ctx.lineTo(26, -4);
  ctx.quadraticCurveTo(30, 6, 22, 10);
  ctx.quadraticCurveTo(10, 12, 4, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hip/short detail
  ctx.fillStyle = '#0f4f6a';
  ctx.beginPath();
  ctx.ellipse(10, -8, 13, 8, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Back arm
  ctx.strokeStyle = '#f4d9c6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, -18);
  ctx.quadraticCurveTo(-8, -20, -12, -8);
  ctx.stroke();

  // Torso highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(13, -14, 6, 12, -0.1, -Math.PI * 0.6, Math.PI * 0.6);
  ctx.fill();

  // Chest/shoulder line
  ctx.strokeStyle = '#0f4f6a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(6, -19);
  ctx.lineTo(18, -20);
  ctx.stroke();

  // Front arm
  ctx.strokeStyle = '#f4d9c6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, -20);
  ctx.quadraticCurveTo(32, -22, 34, -10);
  ctx.stroke();

  // Neck
  ctx.strokeStyle = '#f4d9c6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, -22);
  ctx.lineTo(18, -28);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#f8e6d4';
  ctx.strokeStyle = '#0f1d2c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(18, -33, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.arc(16, -36, 9, Math.PI * 1.1, Math.PI * 1.9);
  ctx.lineTo(25, -37);
  ctx.quadraticCurveTo(20, -42, 14, -39);
  ctx.fill();

  // Facial line
  ctx.strokeStyle = '#0f1d2c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(14, -32);
  ctx.quadraticCurveTo(18, -31, 20, -32);
  ctx.stroke();

  // Spray
  if (!surfer.airborne) {
    ctx.save();
    ctx.translate(-14, 10);
    ctx.rotate(-0.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, Math.PI * 0.2, Math.PI * 0.9);
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
