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

const buttons = {
  start: document.getElementById('startButton'),
  practice: document.getElementById('practiceButton'),
};

const COLORS = {
  player: '#9ef6ff',
  playerFire: '#b7fbff',
  enemy: '#ffb38f',
  enemyFire: '#ff6d5c',
  trenchLight: 'rgba(118, 207, 255, 0.6)',
  trenchDark: 'rgba(118, 207, 255, 0.08)',
  accent: '#00f2ff',
  star: 'rgba(255,255,255,0.8)',
};

const LEVELS = [
  {
    name: 'Trench Entry',
    duration: 45,
    cadence: { interceptor: 1.6, sentry: 2.4, mine: 1.2 },
    speed: 1,
    boss: false,
  },
  {
    name: 'Exhaust Maze',
    duration: 60,
    cadence: { interceptor: 1.3, sentry: 1.9, mine: 1.1 },
    speed: 1.15,
    boss: false,
  },
  {
    name: 'Core Vent',
    duration: 70,
    cadence: { interceptor: 1, sentry: 1.5, mine: 1 },
    speed: 1.25,
    boss: true,
  },
];

const GAME_STATE = {
  mode: 'menu',
  practice: false,
  levelIndex: 0,
  elapsed: 0,
  lastTime: 0,
  score: 0,
  multiplier: 1,
  comboTimer: 0,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height * 0.82,
  w: 28,
  h: 26,
  vx: 0,
  vy: 0,
  accel: 680,
  maxSpeed: 520,
  hull: 100,
  shields: 75,
  maxHull: 100,
  maxShields: 75,
  fireCooldown: 0,
  fireRate: 0.08,
  invulnerable: 0,
};

let trenchPanels = [];
let stars = [];
let enemies = [];
let mines = [];
let playerShots = [];
let enemyShots = [];
let boss = null;

const input = { keys: new Set() };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function initStars() {
  stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    speed: randRange(40, 160),
  }));
}

function initTrench() {
  trenchPanels = [];
  const rows = 14;
  for (let i = 0; i < rows; i++) {
    trenchPanels.push({
      y: (i / rows) * canvas.height,
      wobble: Math.random() * Math.PI * 2,
    });
  }
}

function resetGame(practice = false) {
  GAME_STATE.practice = practice;
  GAME_STATE.mode = 'running';
  GAME_STATE.levelIndex = 0;
  GAME_STATE.elapsed = 0;
  GAME_STATE.lastTime = performance.now();
  GAME_STATE.score = 0;
  GAME_STATE.multiplier = 1;
  GAME_STATE.comboTimer = 4;
  enemies = [];
  mines = [];
  playerShots = [];
  enemyShots = [];
  boss = null;
  Object.assign(player, {
    x: canvas.width / 2,
    y: canvas.height * 0.82,
    vx: 0,
    vy: 0,
    hull: player.maxHull,
    shields: player.maxShields,
    invulnerable: 0,
  });
  initTrench();
  initStars();
  hud.screen.classList.remove('active');
  toast('Stay inside the trench and keep firing!');
}

function toast(message) {
  const note = document.createElement('div');
  note.className = 'toast';
  note.textContent = message;
  hud.overlay.innerHTML = '';
  hud.overlay.appendChild(note);
  setTimeout(() => note.remove(), 2200);
}

function updateBars() {
  const hullRatio = player.hull / player.maxHull;
  const shieldRatio = player.shields / player.maxShields;
  hud.hullBar.style.width = `${clamp(hullRatio * 100, 0, 100)}%`;
  hud.shieldBar.style.width = `${clamp(shieldRatio * 100, 0, 100)}%`;
  hud.score.textContent = Math.floor(GAME_STATE.score).toLocaleString();
  hud.multiplier.textContent = `x${GAME_STATE.multiplier.toFixed(1)}`;
  const totalLevels = GAME_STATE.practice ? '∞' : LEVELS.length;
  const currentLevel = GAME_STATE.practice ? 'Practice' : `${GAME_STATE.levelIndex + 1}`;
  hud.wave.textContent = `${currentLevel} / ${totalLevels}`;
}

function firePlayer() {
  if (player.fireCooldown > 0) return;
  player.fireCooldown = player.fireRate;
  const spread = [ -9, 0, 9 ];
  spread.forEach((offset) => {
    playerShots.push({ x: player.x + offset, y: player.y - player.h / 2, w: 6, h: 14, vy: -720, color: COLORS.playerFire });
  });
}

function fireEnemy(enemy) {
  const baseVy = 240;
  if (enemy.type === 'interceptor') {
    enemyShots.push({ x: enemy.x, y: enemy.y + 12, w: 6, h: 14, vy: baseVy, color: COLORS.enemyFire });
  } else if (enemy.type === 'sentry') {
    enemyShots.push({ x: enemy.x - 8, y: enemy.y + 12, w: 6, h: 14, vy: baseVy * 1.1, color: COLORS.enemyFire });
    enemyShots.push({ x: enemy.x + 8, y: enemy.y + 12, w: 6, h: 14, vy: baseVy * 1.1, color: COLORS.enemyFire });
  } else if (enemy.type === 'boss') {
    const pattern = [-70, -20, 20, 70];
    pattern.forEach((offset) => {
      enemyShots.push({ x: enemy.x + offset, y: enemy.y + 40, w: 6, h: 18, vy: baseVy * 1.25, color: COLORS.enemyFire });
    });
  }
}

function spawnInterceptor(levelSpeed) {
  const mid = canvas.width * 0.5;
  const range = canvas.width * 0.18;
  const x = randRange(mid - range, mid + range);
  enemies.push({
    type: 'interceptor',
    x,
    y: -40,
    w: 34,
    h: 28,
    speed: 120 * levelSpeed,
    hp: 24,
    fireCooldown: randRange(0.4, 0.8),
    drift: randRange(-0.7, 0.7),
  });
}

function spawnSentry(levelSpeed) {
  const leftSide = Math.random() < 0.5;
  const laneOffset = leftSide ? canvas.width * 0.18 : canvas.width * 0.82;
  enemies.push({
    type: 'sentry',
    x: laneOffset,
    y: randRange(-30, 10),
    w: 32,
    h: 32,
    speed: 80 * levelSpeed,
    hp: 34,
    fireCooldown: randRange(0.9, 1.3),
  });
}

function spawnMine(levelSpeed) {
  mines.push({
    x: randRange(canvas.width * 0.28, canvas.width * 0.72),
    y: -30,
    w: 20,
    h: 20,
    speed: 150 * levelSpeed,
    sway: randRange(-1.2, 1.2),
    phase: Math.random() * Math.PI * 2,
  });
}

function spawnBoss() {
  boss = {
    type: 'boss',
    x: canvas.width / 2,
    y: -140,
    w: 140,
    h: 110,
    hp: 520,
    speed: 60,
    fireCooldown: 0.6,
    phase: 0,
  };
  toast('Core vent exposed. Cut through!');
}

function movePlayer(dt) {
  const thrustX = (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) ? -1 : 0;
  const thrustXPos = (input.keys.has('ArrowRight') || input.keys.has('KeyD')) ? 1 : 0;
  const thrustY = (input.keys.has('ArrowUp') || input.keys.has('KeyW')) ? -1 : 0;
  const thrustYPos = (input.keys.has('ArrowDown') || input.keys.has('KeyS')) ? 1 : 0;
  const accelX = (thrustX + thrustXPos) * player.accel;
  const accelY = (thrustY + thrustYPos) * player.accel;
  player.vx += accelX * dt;
  player.vy += accelY * dt;

  // Soft drift from the asteroids-inspired handling
  player.vx *= 0.9;
  player.vy *= 0.9;

  const max = player.maxSpeed;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > max) {
    player.vx = (player.vx / speed) * max;
    player.vy = (player.vy / speed) * max;
  }
}

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const corridor = getCorridorWidth();
  player.x = clamp(player.x, corridor.min, corridor.max);
  player.y = clamp(player.y, canvas.height * 0.5, canvas.height * 0.9);

  if ((input.keys.has('Space') || input.keys.has('KeyK')) && GAME_STATE.mode === 'running') {
    firePlayer();
  }
}

function getCorridorWidth() {
  const base = canvas.width * 0.32;
  const wobble = Math.sin((GAME_STATE.elapsed + performance.now() / 1000) * 0.6) * canvas.width * 0.04;
  const mid = canvas.width * 0.5 + Math.sin(GAME_STATE.elapsed * 0.4) * canvas.width * 0.05;
  const half = (base + wobble) / 2;
  return { min: mid - half, max: mid + half };
}

function updateShots(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const shot = list[i];
    shot.y += shot.vy * dt;
    if (shot.y < -40 || shot.y > canvas.height + 40) list.splice(i, 1);
  }
}

function hitbox(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) * 0.5 &&
    Math.abs(a.y - b.y) < (a.h + b.h) * 0.5
  );
}

function applyDamage(amount) {
  if (player.invulnerable > 0) return;
  const shieldDamage = Math.min(player.shields, amount * 0.7);
  player.shields -= shieldDamage;
  player.hull -= (amount - shieldDamage);
  player.invulnerable = 0.9;
  GAME_STATE.multiplier = Math.max(1, GAME_STATE.multiplier - 0.4);
  if (player.hull <= 0) triggerGameOver('Hull integrity lost');
}

function reward(points) {
  GAME_STATE.score += points * GAME_STATE.multiplier;
  GAME_STATE.multiplier = Math.min(12, GAME_STATE.multiplier + 0.15);
  GAME_STATE.comboTimer = 4;
}

function updateEnemies(dt, levelSpeed) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += e.speed * dt;
    if (e.type === 'interceptor') {
      e.x += Math.sin((GAME_STATE.elapsed + e.drift) * 3) * 110 * dt;
    }
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) {
      fireEnemy(e);
      e.fireCooldown = randRange(0.8, 1.4);
    }
    if (e.y > canvas.height + 80) enemies.splice(i, 1);
  }

  if (boss) {
    boss.y = clamp(boss.y + boss.speed * dt, 120, canvas.height * 0.35);
    boss.fireCooldown -= dt;
    if (boss.fireCooldown <= 0) {
      fireEnemy(boss);
      boss.fireCooldown = 1.1;
    }
    boss.phase += dt * 1.5;
    boss.x = canvas.width / 2 + Math.sin(boss.phase) * 160;
  }
}

function updateMines(dt, levelSpeed) {
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.phase += dt;
    m.x += Math.sin(m.phase * 2) * 40 * dt * m.sway;
    m.y += m.speed * dt;
    if (m.y > canvas.height + 40) mines.splice(i, 1);
  }
}

function handleCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = playerShots.length - 1; j >= 0; j--) {
      const s = playerShots[j];
      if (hitbox(e, s)) {
        e.hp -= 16;
        playerShots.splice(j, 1);
        if (e.hp <= 0) {
          reward(e.type === 'sentry' ? 60 : 80);
          enemies.splice(i, 1);
        }
      }
    }
    if (hitbox(e, player)) {
      applyDamage(24);
      enemies.splice(i, 1);
    }
  }

  if (boss) {
    for (let j = playerShots.length - 1; j >= 0; j--) {
      const s = playerShots[j];
      if (hitbox(boss, s)) {
        boss.hp -= 10;
        playerShots.splice(j, 1);
        if (boss.hp <= 0) {
          reward(1400);
          boss = null;
          triggerVictory();
        }
      }
    }
  }

  for (let i = mines.length - 1; i >= 0; i--) {
    if (hitbox(mines[i], player)) {
      applyDamage(18);
      mines.splice(i, 1);
    }
  }

  for (let i = enemyShots.length - 1; i >= 0; i--) {
    if (hitbox(enemyShots[i], player)) {
      applyDamage(16);
      enemyShots.splice(i, 1);
    }
  }
}

function drawStars(dt) {
  stars.forEach((s) => {
    s.y += s.speed * dt;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
    ctx.fillStyle = COLORS.star;
    ctx.fillRect(s.x, s.y, 2, 2);
  });
}

function drawTrench(time) {
  const w = canvas.width;
  const h = canvas.height;
  const corridor = getCorridorWidth();
  ctx.save();
  const grad = ctx.createRadialGradient(w / 2, h * 0.25, 60, w / 2, h * 0.25, h * 0.9);
  grad.addColorStop(0, 'rgba(12,24,48,0.8)');
  grad.addColorStop(1, 'rgba(1,3,9,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = COLORS.trenchDark;
  ctx.lineWidth = 3;
  const rows = trenchPanels.length;
  for (let i = 0; i < rows; i++) {
    const panel = trenchPanels[i];
    panel.y += 220 * ((LEVELS[GAME_STATE.levelIndex] || LEVELS[0]).speed) * (1 / rows);
    if (panel.y > h) {
      panel.y = 0;
      panel.wobble = Math.random() * Math.PI * 2;
    }
    const t = panel.y / h;
    const depthSpread = (0.5 - t) * (canvas.width * 0.55);
    const jitter = Math.sin(panel.wobble + time * 0.001) * 14;
    const left = corridor.min - depthSpread + jitter;
    const right = corridor.max + depthSpread - jitter;
    const y = panel.y;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.strokeStyle = t < 0.5 ? COLORS.trenchLight : COLORS.trenchDark;
    ctx.stroke();
  }
  ctx.restore();
}

function drawShip(ship) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  const tilt = clamp(ship.vx / ship.maxSpeed, -0.6, 0.6);
  ctx.rotate(tilt * 0.4);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(0, -ship.h * 0.8);
  ctx.lineTo(ship.w * 0.65, ship.h * 0.7);
  ctx.lineTo(-ship.w * 0.65, ship.h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(130, 242, 255, 0.18)';
  ctx.fillRect(-ship.w * 0.35, -ship.h * 0.3, ship.w * 0.7, ship.h * 0.8);
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.type === 'sentry' ? '#ffd48d' : COLORS.enemy;
    ctx.beginPath();
    ctx.moveTo(0, -e.h * 0.6);
    ctx.lineTo(e.w * 0.6, e.h * 0.6);
    ctx.lineTo(-e.w * 0.6, e.h * 0.6);
    ctx.closePath();
    ctx.fill();
    if (e.type === 'sentry') {
      ctx.strokeStyle = COLORS.trenchLight;
      ctx.stroke();
    }
    ctx.restore();
  });

  if (boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.fillStyle = '#ffc857';
    ctx.beginPath();
    ctx.rect(-boss.w / 2, -boss.h / 2, boss.w, boss.h);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-boss.w / 2, -boss.h / 2, boss.w, boss.h);
    ctx.restore();

    const barWidth = 260;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(canvas.width / 2 - barWidth / 2, 18, barWidth, 10);
    ctx.fillStyle = COLORS.trenchLight;
    const ratio = Math.max(0, boss.hp / 520);
    ctx.fillRect(canvas.width / 2 - barWidth / 2, 18, barWidth * ratio, 10);
  }
}

function drawMines() {
  mines.forEach((m) => {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.phase * 4);
    ctx.strokeStyle = COLORS.trenchLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, m.w / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawShots(list) {
  list.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
  });
}

function drawHUDMessages() {
  if (GAME_STATE.practice) return;
  ctx.save();
  ctx.font = '20px "Orbitron", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const level = LEVELS[GAME_STATE.levelIndex];
  ctx.fillText(level ? level.name : 'Practice', 24, canvas.height - 24);
  ctx.restore();
}

function triggerGameOver(reason) {
  GAME_STATE.mode = 'gameover';
  const content = `
    <div class="panel">
      <p class="tag">Mission Lost</p>
      <h1>Trench breached</h1>
      <p class="lead">${reason}</p>
      <p>Score: ${Math.floor(GAME_STATE.score).toLocaleString()}</p>
      <div class="actions">
        <button onclick="location.reload()">Reset Build</button>
        <button onclick="window._restart()" class="ghost">Retry Level</button>
      </div>
    </div>`;
  hud.screen.innerHTML = content;
  hud.screen.classList.add('active');
}

function triggerVictory() {
  GAME_STATE.mode = 'victory';
  const content = `
    <div class="panel">
      <p class="tag">Mission Complete</p>
      <h1>Core vent neutralized</h1>
      <p class="lead">Elite run! Final score ${Math.floor(GAME_STATE.score).toLocaleString()}.</p>
      <div class="actions">
        <button onclick="location.reload()">Run Again</button>
        <button onclick="window._practice()" class="ghost">Practice Loop</button>
      </div>
    </div>`;
  hud.screen.innerHTML = content;
  hud.screen.classList.add('active');
}

function pauseToggle() {
  if (GAME_STATE.mode === 'running') {
    GAME_STATE.mode = 'paused';
    toast('Paused');
  } else if (GAME_STATE.mode === 'paused') {
    GAME_STATE.mode = 'running';
    GAME_STATE.lastTime = performance.now();
  }
}

function loop(time) {
  const dt = (time - GAME_STATE.lastTime) / 1000;
  GAME_STATE.lastTime = time;
  if (GAME_STATE.mode === 'running') {
    GAME_STATE.elapsed += dt;
    GAME_STATE.comboTimer -= dt;
    if (GAME_STATE.comboTimer <= 0) {
      GAME_STATE.multiplier = Math.max(1, GAME_STATE.multiplier - 0.25);
      GAME_STATE.comboTimer = 2.8;
    }
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);

    const level = LEVELS[GAME_STATE.levelIndex] || LEVELS[0];
    level._spawnTimers = level._spawnTimers || { interceptor: 0, sentry: 0, mine: 0 };
    Object.keys(level._spawnTimers).forEach((key) => level._spawnTimers[key] -= dt);
    if (level._spawnTimers.interceptor <= 0) {
      spawnInterceptor(level.speed);
      level._spawnTimers.interceptor = level.cadence.interceptor;
    }
    if (level._spawnTimers.sentry <= 0) {
      spawnSentry(level.speed);
      level._spawnTimers.sentry = level.cadence.sentry;
    }
    if (level._spawnTimers.mine <= 0) {
      spawnMine(level.speed);
      level._spawnTimers.mine = level.cadence.mine;
    }
    if (level.boss && !boss && GAME_STATE.elapsed > level.duration * 0.55) {
      spawnBoss();
    }
    if (!level.boss && GAME_STATE.elapsed >= level.duration) {
      GAME_STATE.levelIndex += 1;
      if (GAME_STATE.levelIndex >= LEVELS.length) {
        triggerVictory();
      } else {
        GAME_STATE.elapsed = 0;
        toast(`${LEVELS[GAME_STATE.levelIndex].name}`);
      }
    }

    movePlayer(dt);
    updateEnemies(dt, level.speed);
    updateMines(dt, level.speed);
    updateShots(playerShots, dt);
    updateShots(enemyShots, dt);
    handleCollisions();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrench(time);
  drawStars(dt);
  drawMines();
  drawShots(playerShots);
  drawEnemies();
  drawShots(enemyShots);
  drawShip(player);
  drawHUDMessages();
  updateBars();

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

buttons.start.addEventListener('click', () => resetGame(false));
buttons.practice.addEventListener('click', () => resetGame(true));
hud.pause.addEventListener('click', pauseToggle);

window._restart = () => {
  GAME_STATE.mode = 'running';
  GAME_STATE.elapsed = 0;
  GAME_STATE.score = Math.max(0, GAME_STATE.score - 200);
  enemies = [];
  mines = [];
  enemyShots = [];
  playerShots = [];
  boss = null;
  const level = LEVELS[GAME_STATE.levelIndex] || LEVELS[0];
  level._spawnTimers = { interceptor: 0, sentry: 0, mine: 0 };
  hud.screen.classList.remove('active');
};

window._practice = () => resetGame(true);
window._start = () => resetGame(false);

function setupMenu() {
  const menuHtml = `
    <div class="panel">
      <p class="tag">TRENCH BRIEF</p>
      <h1>Trenchfire: Starfall Run</h1>
      <p class="lead">Throttle through a narrow exhaust trench. Drift like our asteroid protoype, spray endless laser bolts, and break the enemy screen before the core vent seals.</p>
      <div class="grid">
        <div class="card">
          <h3>Flight Controls</h3>
          <ul>
            <li><strong>Move:</strong> WASD / Arrow Keys</li>
            <li><strong>Fire:</strong> Hold Space / K</li>
            <li><strong>Pause:</strong> P</li>
          </ul>
        </div>
        <div class="card">
          <h3>Objective</h3>
          <p>Stay centered in the trench, dodge mines, shred interceptors and wall sentries, and hammer the core vent before it cycles.</p>
        </div>
      </div>
      <div class="actions">
        <button onclick="window._start()">Launch Sortie</button>
        <button onclick="window._practice()" class="ghost">Practice Loop</button>
      </div>
    </div>`;
  hud.screen.innerHTML = menuHtml;
  hud.screen.classList.add('active');
}

bindInput();
setupMenu();
GAME_STATE.lastTime = performance.now();
initTrench();
initStars();
requestAnimationFrame(loop);
