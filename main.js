const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  hullBar: document.querySelector('#hullBar span'),
  shieldBar: document.querySelector('#shieldBar span'),
  score: document.getElementById('score'),
  multiplier: document.getElementById('multiplier'),
  wave: document.getElementById('wave'),
  overlay: document.getElementById('overlay'),
  screen: document.getElementById('screen'),
  pause: document.getElementById('pauseButton'),
};

const COLORS = {
  sky: '#0b0f1a',
  horizon: '#1a1f2c',
  floor: '#d4d6db',
  lane: '#bbbcc2',
  cubePalette: ['#fce46d', '#ffb449', '#ff834f'],
  player: '#6cf4ff',
  bolt: '#b7fbff',
  uiAccent: '#7addff',
};

const GAME = {
  mode: 'menu',
  practice: false,
  lastTime: 0,
  elapsed: 0,
  distance: 0,
  score: 0,
  multiplier: 1,
  spawnTimer: 0,
};

const camera = {
  focal: 520,
  height: 420,
};

const player = {
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  accel: 680,
  maxSpeed: 540,
  w: 28,
  h: 26,
  hull: 100,
  shields: 60,
  maxHull: 100,
  maxShields: 60,
  fireCooldown: 0,
  fireRate: 0.085,
  invulnerable: 0,
};

const settings = {
  laneSpacing: 80,
  laneCount: 9,
  baseSpeed: 360,
  spawnInterval: 0.95,
  wobble: 16,
};

let cubes = [];
let bolts = [];
let stars = [];

const input = { keys: new Set() };

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function randChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function resetGame(practice = false) {
  GAME.practice = practice;
  GAME.mode = 'running';
  GAME.lastTime = performance.now();
  GAME.elapsed = 0;
  GAME.distance = 0;
  GAME.score = 0;
  GAME.multiplier = 1;
  GAME.spawnTimer = 0;
  cubes = [];
  bolts = [];
  stars = createStars();
  Object.assign(player, {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    hull: player.maxHull,
    shields: player.maxShields,
    invulnerable: 0,
    fireCooldown: 0,
  });
  hud.screen.classList.remove('active');
  toast('Stay in the lane, thread the cubes, blast a path.');
}

function createStars() {
  return Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    speed: 20 + Math.random() * 60,
  }));
}

function toast(message) {
  const note = document.createElement('div');
  note.className = 'toast';
  note.textContent = message;
  hud.overlay.innerHTML = '';
  hud.overlay.appendChild(note);
  setTimeout(() => note.remove(), 2200);
}

function project(x, z) {
  const perspective = camera.focal / (camera.focal + z + 1);
  const screenX = canvas.width / 2 + x * perspective;
  const screenY = canvas.height * 0.32 + (camera.height * perspective);
  return { x: screenX, y: screenY, scale: perspective };
}

function spawnRow() {
  const lanes = settings.laneCount;
  const spacing = settings.laneSpacing;
  const gaps = new Set();
  const gapCount = Math.random() > 0.55 ? 2 : 1;
  while (gaps.size < gapCount) {
    gaps.add(Math.floor(Math.random() * lanes));
  }
  for (let i = 0; i < lanes; i++) {
    if (gaps.has(i)) continue;
    const x = (i - (lanes - 1) / 2) * spacing + (Math.random() - 0.5) * settings.wobble;
    const size = 70 + Math.random() * 20;
    cubes.push({
      x,
      z: 1400 + Math.random() * 60,
      size,
      color: randChoice(COLORS.cubePalette),
      wobble: Math.random() * Math.PI * 2,
    });
  }
}

function movePlayer(dt) {
  const left = input.keys.has('ArrowLeft') || input.keys.has('KeyA');
  const right = input.keys.has('ArrowRight') || input.keys.has('KeyD');
  const up = input.keys.has('ArrowUp') || input.keys.has('KeyW');
  const down = input.keys.has('ArrowDown') || input.keys.has('KeyS');

  const ax = (left ? -1 : 0) + (right ? 1 : 0);
  const ay = (up ? -1 : 0) + (down ? 1 : 0);
  player.vx += ax * player.accel * dt;
  player.vy += ay * player.accel * dt;

  player.vx *= 0.9;
  player.vy *= 0.88;

  const max = player.maxSpeed;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > max) {
    player.vx = (player.vx / speed) * max;
    player.vy = (player.vy / speed) * max;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const halfWidth = (settings.laneCount / 2) * settings.laneSpacing;
  player.x = clamp(player.x, -halfWidth + 40, halfWidth - 40);
  player.y = clamp(player.y, -80, 80);

  if ((input.keys.has('Space') || input.keys.has('KeyK')) && GAME.mode === 'running') {
    firePlayer();
  }
}

function firePlayer() {
  if (player.fireCooldown > 0) return;
  player.fireCooldown = player.fireRate;
  const spread = [-20, 0, 20];
  spread.forEach((offset) => {
    bolts.push({ x: player.x + offset, z: player.z + 40, speed: 1100, life: 3.5 });
  });
}

function updateBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.z += b.speed * dt;
    b.life -= dt;
    if (b.life <= 0) bolts.splice(i, 1);
  }
}

function updateCubes(dt) {
  const speed = settings.baseSpeed * (1 + GAME.elapsed * 0.03);
  for (let i = cubes.length - 1; i >= 0; i--) {
    const c = cubes[i];
    c.z -= speed * dt;
    c.wobble += dt * 1.8;
    c.x += Math.sin(c.wobble) * 6 * dt;
    if (c.z < -60) {
      cubes.splice(i, 1);
      GAME.score += 12 * GAME.multiplier;
      GAME.multiplier = Math.min(8, GAME.multiplier + 0.02);
    }
  }
  GAME.distance += speed * dt;
  GAME.score += dt * 8;
}

function handleCollisions() {
  for (let i = cubes.length - 1; i >= 0; i--) {
    const cube = cubes[i];
    // Player collision when cube reaches camera plane
    if (Math.abs(cube.x - player.x) < (cube.size * 0.5 + player.w * 0.4) && Math.abs(cube.z - player.z) < cube.size * 0.65) {
      applyDamage(34);
      cubes.splice(i, 1);
      continue;
    }
    for (let j = bolts.length - 1; j >= 0; j--) {
      const bolt = bolts[j];
      if (bolt.z >= cube.z - cube.size && bolt.z <= cube.z + cube.size && Math.abs(bolt.x - cube.x) < cube.size * 0.45) {
        bolts.splice(j, 1);
        cubes.splice(i, 1);
        GAME.score += 40 * GAME.multiplier;
        GAME.multiplier = Math.min(8, GAME.multiplier + 0.12);
        break;
      }
    }
  }
}

function applyDamage(amount) {
  if (player.invulnerable > 0) return;
  const shieldHit = Math.min(player.shields, amount * 0.7);
  player.shields -= shieldHit;
  player.hull -= (amount - shieldHit);
  player.invulnerable = 1.1;
  GAME.multiplier = Math.max(1, GAME.multiplier - 0.35);
  if (player.hull <= 0) triggerGameOver('You clipped a cube and broke apart.');
}

function updateHUD() {
  const hullRatio = player.hull / player.maxHull;
  const shieldRatio = player.shields / player.maxShields;
  hud.hullBar.style.width = `${clamp(hullRatio * 100, 0, 100)}%`;
  hud.shieldBar.style.width = `${clamp(shieldRatio * 100, 0, 100)}%`;
  hud.score.textContent = Math.floor(GAME.score).toLocaleString();
  hud.multiplier.textContent = `x${GAME.multiplier.toFixed(1)}`;
  hud.wave.textContent = `${Math.floor(GAME.distance / 1000)} km`;
}

function updateStars(dt) {
  stars.forEach((s) => {
    s.y += s.speed * dt;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  });
}

function drawStars() {
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  stars.forEach((s) => {
    ctx.fillRect(s.x, s.y, 2, 2);
  });
}

function drawFloor() {
  const w = canvas.width;
  const h = canvas.height;
  const horizon = h * 0.32;
  const gradient = ctx.createLinearGradient(0, horizon, 0, h);
  gradient.addColorStop(0, COLORS.horizon);
  gradient.addColorStop(1, COLORS.floor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.strokeStyle = '#9fa3ad';
  ctx.lineWidth = 2;
  const lanes = settings.laneCount;
  const spacing = settings.laneSpacing;
  for (let i = -lanes; i <= lanes; i++) {
    const x = i * spacing * 0.5;
    const p0 = project(x, 1200);
    const p1 = project(x, 80);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  for (let z = 200; z < 1400; z += 180) {
    const p0 = project(-settings.laneSpacing * lanes, z);
    const p1 = project(settings.laneSpacing * lanes, z);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = z % 360 === 0 ? '#c0c2c7' : '#a8acb5';
    ctx.stroke();
  }
}

function drawShip() {
  const pos = project(player.x, player.z);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  const tilt = clamp(player.vx / player.maxSpeed, -0.6, 0.6);
  ctx.rotate(tilt * 0.4);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(0, -player.h * pos.scale * 0.7);
  ctx.lineTo(player.w * pos.scale * 0.7, player.h * pos.scale * 0.8);
  ctx.lineTo(-player.w * pos.scale * 0.7, player.h * pos.scale * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCubes() {
  cubes.sort((a, b) => b.z - a.z);
  cubes.forEach((c) => {
    const pos = project(c.x, c.z);
    const size = c.size * pos.scale;
    const yOffset = size * 0.5;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.fillStyle = c.color;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-size / 2, -yOffset, size, size);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawBolts() {
  bolts.forEach((b) => {
    const pos = project(b.x, b.z);
    ctx.fillStyle = COLORS.bolt;
    ctx.fillRect(pos.x - 2, pos.y - 12, 4, 18);
  });
}

function drawBackground() {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStars();
  drawFloor();
}

function triggerGameOver(reason) {
  GAME.mode = 'gameover';
  const content = `
    <div class="panel">
      <p class="tag">Run Ended</p>
      <h1>You bailed out</h1>
      <p class="lead">${reason}</p>
      <p>Score: ${Math.floor(GAME.score).toLocaleString()} · Distance: ${Math.floor(GAME.distance / 1000)} km</p>
      <div class="actions">
        <button data-action="restart">Run it back</button>
        <button data-action="menu" class="ghost">Return to Briefing</button>
      </div>
    </div>`;
  hud.screen.innerHTML = content;
  hud.screen.classList.add('active');
}

function pauseToggle() {
  if (GAME.mode === 'running') {
    GAME.mode = 'paused';
    toast('Paused');
  } else if (GAME.mode === 'paused') {
    GAME.mode = 'running';
    GAME.lastTime = performance.now();
  }
}

function loop(time) {
  const dt = (time - GAME.lastTime) / 1000;
  GAME.lastTime = time;

  if (GAME.mode === 'running') {
    GAME.elapsed += dt;
    GAME.spawnTimer -= dt;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    movePlayer(dt);
    updateBolts(dt);
    updateCubes(dt);
    handleCollisions();
    if (GAME.spawnTimer <= 0) {
      spawnRow();
      GAME.spawnTimer = settings.spawnInterval * clamp(1 - GAME.elapsed * 0.02, 0.45, 1.1);
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawCubes();
  drawBolts();
  drawShip();
  updateHUD();
  updateStars(dt);

  requestAnimationFrame(loop);
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    input.keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyP') pauseToggle();
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
}

hud.pause.addEventListener('click', pauseToggle);

hud.screen.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === 'start') resetGame(false);
  if (action === 'practice') resetGame(true);
  if (action === 'restart') resetGame(GAME.practice);
  if (action === 'menu') setupMenu();
});

function setupMenu() {
  GAME.mode = 'menu';
  const menuHtml = `
    <div class="panel">
      <p class="tag">BRIEFING</p>
      <h1>Cube Run: Trenchfire</h1>
      <p class="lead">Fly the exhaust trench like classic cubefield, but with drift handling and unlimited lasers. Thread the gaps, shoot cubes to clear a line, and push for distance.</p>
      <div class="grid">
        <div class="card">
          <h3>Flight</h3>
          <ul>
            <li><strong>Move:</strong> WASD / Arrow Keys</li>
            <li><strong>Fire:</strong> Hold Space / K</li>
            <li><strong>Pause:</strong> P</li>
          </ul>
        </div>
        <div class="card">
          <h3>Objective</h3>
          <p>Dodge or destroy the cube walls. Your multiplier grows as you pass or blast; crashing ends the run.</p>
        </div>
      </div>
      <div class="actions">
        <button data-action="start">Launch Run</button>
        <button data-action="practice" class="ghost">Practice Loop</button>
      </div>
    </div>`;
  hud.screen.innerHTML = menuHtml;
  hud.screen.classList.add('active');
}

bindInput();
setupMenu();
GAME.lastTime = performance.now();
stars = createStars();
requestAnimationFrame(loop);
