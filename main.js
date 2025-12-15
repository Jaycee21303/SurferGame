const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  armor: document.querySelector('#armorBar span'),
  health: document.querySelector('#healthBar span'),
  score: document.getElementById('score'),
  wave: document.getElementById('wave'),
  distance: document.getElementById('distance'),
  overlay: document.getElementById('overlay'),
  screen: document.getElementById('screen'),
  pause: document.getElementById('pauseButton'),
};

const COLORS = {
  sky: '#070910',
  fog: '#0f1424',
  neon: '#00f0ff',
  mag: '#ff3f8e',
  wall: '#0b0f1a',
  reticle: '#f0f6ff',
  bolt: '#9af5ff',
};

const camera = { focal: 620, height: 520, horizon: 0.62 };

const GAME = {
  mode: 'menu',
  practice: false,
  lastTime: 0,
  distance: 0,
  score: 0,
  wave: 1,
  spawnTimer: 0,
  spawnRate: 1.35,
  difficulty: 1,
  paused: false,
};

const player = {
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  accel: 900,
  maxSpeed: 540,
  friction: 0.88,
  health: 100,
  armor: 80,
  fireCooldown: 0,
  fireRate: 0.12,
};

let rails = [];
let foes = [];
let bolts = [];
let sparks = [];

const input = { keys: new Set(), mouseDown: false, mouse: { x: canvas.width / 2, y: canvas.height / 2 } };

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function resetGame(practice = false) {
  GAME.practice = practice;
  GAME.mode = 'running';
  GAME.paused = false;
  GAME.lastTime = performance.now();
  GAME.distance = 0;
  GAME.score = 0;
  GAME.wave = 1;
  GAME.spawnTimer = 0.8;
  GAME.spawnRate = 1.3;
  GAME.difficulty = 1;
  rails = makeRails();
  foes = [];
  bolts = [];
  sparks = [];
  Object.assign(player, {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    health: 100,
    armor: 80,
    fireCooldown: 0,
  });
  hud.screen.classList.remove('active');
  toast(practice ? 'Zen fire enabled. No wave penalties.' : 'Rip through neon hell. Keep armor intact.');
}

function makeRails() {
  const segments = [];
  const step = 120;
  for (let i = 0; i < 36; i++) {
    segments.push({ z: i * step + 120 });
  }
  return segments;
}

function toast(message) {
  const note = document.createElement('div');
  note.className = 'toast';
  note.textContent = message;
  hud.overlay.innerHTML = '';
  hud.overlay.appendChild(note);
  setTimeout(() => note.remove(), 2000);
}

function project(x, y, z) {
  const perspective = camera.focal / (camera.focal + z + 1);
  const screenX = canvas.width / 2 + x * perspective;
  const screenY = canvas.height * camera.horizon - y * perspective + camera.height * perspective;
  return { x: screenX, y: screenY, scale: perspective };
}

function spawnFoe() {
  const lane = randRange(-380, 380);
  const tierRoll = Math.random();
  let hp = 2;
  let speed = 420;
  let size = 44;
  let color = COLORS.neon;
  let score = 120;

  if (tierRoll > 0.65 + GAME.wave * 0.01) {
    hp = 3;
    speed = 340;
    size = 56;
    color = COLORS.mag;
    score = 220;
  }

  foes.push({ x: lane, y: randRange(-30, 60), z: 1600, size, hp, speed, color, score });
}

function shoot() {
  if (player.fireCooldown > 0 || GAME.mode !== 'running' || GAME.paused) return;
  const dirX = input.mouse.x - canvas.width / 2;
  const dirY = input.mouse.y - canvas.height * camera.horizon;
  const len = Math.max(1, Math.hypot(dirX, dirY));
  const normX = dirX / len;
  const normY = dirY / len;
  const speed = 1600;
  bolts.push({ x: player.x, y: player.y, z: 0, vx: normX * speed, vy: normY * speed, vz: speed * 1.1, life: 0 });
  player.fireCooldown = player.fireRate;
  sparks.push({ x: player.x * 0.2, y: player.y * 0.2, z: 40, life: 0.15, color: COLORS.neon });
}

function updatePlayer(dt) {
  const left = input.keys.has('ArrowLeft') || input.keys.has('KeyA');
  const right = input.keys.has('ArrowRight') || input.keys.has('KeyD');
  const up = input.keys.has('ArrowUp') || input.keys.has('KeyW');
  const down = input.keys.has('ArrowDown') || input.keys.has('KeyS');

  const ax = (left ? -1 : 0) + (right ? 1 : 0);
  const ay = (up ? 1 : 0) + (down ? -1 : 0);
  player.vx += ax * player.accel * dt;
  player.vy += ay * player.accel * dt;
  player.vx *= player.friction;
  player.vy *= player.friction;

  player.x = clamp(player.x + player.vx * dt, -480, 480);
  player.y = clamp(player.y + player.vy * dt, -120, 120);

  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (input.mouseDown) shoot();
}

function updateRails(dt) {
  const speed = 620 + GAME.wave * 20;
  for (const seg of rails) {
    seg.z -= speed * dt;
    if (seg.z < 20) {
      seg.z += 3600;
    }
  }
}

function updateFoes(dt) {
  const survivors = [];
  for (const foe of foes) {
    foe.z -= foe.speed * dt * (0.8 + GAME.wave * 0.05);
    foe.x += Math.sin(foe.z * 0.01) * 10 * dt;
    if (foe.z < 60) {
      damagePlayer(16);
      continue;
    }
    survivors.push(foe);
  }
  foes = survivors;
}

function updateBolts(dt) {
  const shots = [];
  for (const b of bolts) {
    b.life += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.z > 2400 || b.life > 1.2) continue;
    shots.push(b);
  }
  bolts = shots;
}

function updateSparks(dt) {
  const fx = [];
  for (const s of sparks) {
    s.life -= dt;
    if (s.life <= 0) continue;
    fx.push(s);
  }
  sparks = fx;
}

function collide() {
  const remainingFoes = [];
  for (const foe of foes) {
    let hit = false;
    for (const b of bolts) {
      const dx = foe.x - b.x;
      const dy = foe.y - b.y;
      const dz = foe.z - b.z;
      if (dz < -40 || dz > 80) continue;
      if (Math.hypot(dx, dy) < foe.size * 0.7) {
        foe.hp -= 1;
        b.life = 10;
        hit = true;
        sparks.push({ x: foe.x * 0.5, y: foe.y * 0.5, z: foe.z, life: 0.4, color: foe.color });
      }
    }
    if (foe.hp <= 0) {
      GAME.score += foe.score;
      continue;
    }
    remainingFoes.push(foe);
  }
  foes = remainingFoes;
}

function damagePlayer(amount) {
  if (GAME.practice) return;
  const armorBlock = Math.min(player.armor, amount * 0.7);
  player.armor = clamp(player.armor - armorBlock, 0, 120);
  const leftover = amount - armorBlock;
  player.health = clamp(player.health - leftover, 0, 120);
  if (player.health <= 0) endRun();
  toast('Impact! Armor compromised.');
}

function endRun() {
  GAME.mode = 'ended';
  hud.screen.classList.add('active');
  hud.screen.querySelector('.panel').innerHTML = `
    <p class="tag">DEPLOYMENT FAILED</p>
    <h1>Run Shattered</h1>
    <p class="lead">Distance ${GAME.distance.toFixed(0)}m · Wave ${GAME.wave} · Score ${GAME.score}</p>
    <div class="actions">
      <button data-action="start">Retry the Corridor</button>
      <button data-action="practice" class="ghost">Zen Fire</button>
    </div>
  `;
}

function updateDifficulty(dt) {
  GAME.distance += dt * 240;
  const waveTarget = 1 + Math.floor(GAME.distance / 800);
  if (waveTarget > GAME.wave) {
    GAME.wave = waveTarget;
    GAME.spawnRate = Math.max(0.55, GAME.spawnRate - 0.05);
    toast(`Wave ${GAME.wave}: more hostiles.`);
  }
  GAME.spawnTimer -= dt;
  if (GAME.spawnTimer <= 0) {
    spawnFoe();
    GAME.spawnTimer = GAME.spawnRate * randRange(0.7, 1.2);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawRails();
  drawFoes();
  drawBolts();
  drawSparks();
  drawReticle();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, COLORS.sky);
  gradient.addColorStop(camera.horizon, COLORS.fog);
  gradient.addColorStop(1, '#060712');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 520, canvas.height * camera.horizon);
  ctx.lineTo(canvas.width / 2 - 120, canvas.height);
  ctx.moveTo(canvas.width / 2 + 520, canvas.height * camera.horizon);
  ctx.lineTo(canvas.width / 2 + 120, canvas.height);
  ctx.stroke();
}

function drawRails() {
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.lineWidth = 2;
  for (const seg of rails) {
    const near = project(-520, 0, seg.z);
    const nearRight = project(520, 0, seg.z);
    ctx.beginPath();
    ctx.moveTo(near.x, near.y);
    ctx.lineTo(nearRight.x, nearRight.y);
    ctx.stroke();
  }
}

function drawFoes() {
  for (const foe of foes) {
    const p = project(foe.x, foe.y, foe.z);
    const size = foe.size * p.scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(foe.z * 0.02));
    ctx.fillStyle = foe.color;
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = foe.color;
    ctx.shadowBlur = 28 * p.scale;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

function drawBolts() {
  ctx.strokeStyle = COLORS.bolt;
  ctx.lineWidth = 2;
  for (const b of bolts) {
    const p = project(b.x, b.y, b.z);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + 14 * p.scale);
    ctx.stroke();
  }
}

function drawSparks() {
  for (const s of sparks) {
    const p = project(s.x, s.y, s.z);
    ctx.fillStyle = s.color || COLORS.bolt;
    ctx.globalAlpha = clamp(s.life * 3, 0, 0.9);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 * p.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawReticle() {
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height * camera.horizon);
  ctx.strokeStyle = COLORS.reticle;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.moveTo(-28, 0); ctx.lineTo(-10, 0);
  ctx.moveTo(28, 0); ctx.lineTo(10, 0);
  ctx.moveTo(0, -28); ctx.lineTo(0, -10);
  ctx.moveTo(0, 28); ctx.lineTo(0, 10);
  ctx.stroke();
  ctx.restore();
}

function updateHud() {
  hud.score.textContent = Math.floor(GAME.score);
  hud.wave.textContent = GAME.wave;
  hud.distance.textContent = `${Math.floor(GAME.distance)} m`;
  hud.health.style.width = `${(player.health / 100) * 100}%`;
  hud.armor.style.width = `${(player.armor / 80) * 100}%`;
}

function gameLoop(timestamp) {
  if (GAME.mode === 'menu') return requestAnimationFrame(gameLoop);
  const dt = Math.min((timestamp - GAME.lastTime) / 1000, 0.05);
  GAME.lastTime = timestamp;

  if (!GAME.paused && GAME.mode === 'running') {
    updatePlayer(dt);
    updateRails(dt);
    updateDifficulty(dt);
    updateFoes(dt);
    updateBolts(dt);
    collide();
    updateSparks(dt);
  }

  render();
  updateHud();
  requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (GAME.mode !== 'running') return;
  GAME.paused = !GAME.paused;
  toast(GAME.paused ? 'Paused' : 'Resumed');
}

function handleKey(e, pressed) {
  if (e.code === 'Space' && pressed) {
    input.mouseDown = true;
    shoot();
  }
  if (!pressed && e.code === 'Space') input.mouseDown = false;
  if (e.code === 'KeyP') {
    if (pressed) togglePause();
    return;
  }
  input.keys[pressed ? 'add' : 'delete'](e.code);
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  input.mouse.x = e.clientX - rect.left;
  input.mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', () => { input.mouseDown = true; shoot(); });
window.addEventListener('mouseup', () => { input.mouseDown = false; });
window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

hud.pause.addEventListener('click', togglePause);

hud.screen.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (action === 'start') resetGame(false);
  if (action === 'practice') resetGame(true);
});

resetGame(true);
GAME.mode = 'menu';
hud.screen.classList.add('active');
hud.screen.querySelector('.panel').innerHTML = hud.screen.querySelector('.panel').innerHTML;

requestAnimationFrame((ts) => {
  GAME.lastTime = ts;
  requestAnimationFrame(gameLoop);
});
