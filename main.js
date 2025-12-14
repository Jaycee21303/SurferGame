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
  player: '#8cf8ff',
  playerFire: '#a8f5ff',
  enemy: '#ff9c75',
  enemyFire: '#ff5d5d',
  trench: 'rgba(120,219,255,0.18)',
  trenchGlow: 'rgba(120,219,255,0.5)',
  turret: '#f3d181',
  boss: '#ffcf5a',
};

const LEVELS = [
  {
    name: 'Vanguard Run',
    duration: 45,
    cadence: { interceptor: 1.8, turret: 2.4, debris: 1.2 },
    speed: 1,
    boss: false,
  },
  {
    name: 'Hollow Corridor',
    duration: 55,
    cadence: { interceptor: 1.45, turret: 2, debris: 1 },
    speed: 1.1,
    boss: false,
  },
  {
    name: 'Core Gate',
    duration: 70,
    cadence: { interceptor: 1.3, turret: 1.6, debris: 1 },
    speed: 1.2,
    boss: true,
  },
];

const GAME_STATE = {
  mode: 'menu', // menu | running | paused | gameover | victory
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
  w: 26,
  h: 24,
  speed: 360,
  boostSpeed: 520,
  hull: 100,
  shields: 70,
  maxHull: 100,
  maxShields: 70,
  fireCooldown: 0,
  fireRate: 0.18,
  invulnerable: 0,
};

let trenchLines = [];
let particles = [];
let enemies = [];
let debris = [];
let playerShots = [];
let enemyShots = [];
let boss = null;

const input = {
  keys: new Set(),
};

function initTrench() {
  trenchLines = [];
  const columns = 16;
  for (let i = 0; i < columns; i++) {
    trenchLines.push({ x: i / (columns - 1) });
  }
}

function resetGame(practice = false) {
  GAME_STATE.practice = practice;
  GAME_STATE.mode = 'running';
  GAME_STATE.levelIndex = practice ? 0 : 0;
  GAME_STATE.elapsed = 0;
  GAME_STATE.lastTime = performance.now();
  GAME_STATE.score = 0;
  GAME_STATE.multiplier = 1;
  GAME_STATE.comboTimer = 4;
  enemies = [];
  debris = [];
  playerShots = [];
  enemyShots = [];
  boss = null;
  Object.assign(player, {
    x: canvas.width / 2,
    y: canvas.height * 0.82,
    hull: player.maxHull,
    shields: player.maxShields,
    invulnerable: 0,
  });
  initTrench();
  hideScreen();
  toast(`Launching ${practice ? 'Practice Loop' : LEVELS[GAME_STATE.levelIndex].name}`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function toast(message) {
  const note = document.createElement('div');
  note.className = 'toast';
  note.textContent = message;
  hud.overlay.innerHTML = '';
  hud.overlay.appendChild(note);
  setTimeout(() => note.remove(), 2000);
}

function hideScreen() {
  hud.screen.classList.remove('active');
}

function showScreen(contentHtml) {
  hud.screen.innerHTML = contentHtml;
  hud.screen.classList.add('active');
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

function spawnInterceptor(levelSpeed) {
  const x = randRange(canvas.width * 0.15, canvas.width * 0.85);
  enemies.push({
    type: 'interceptor',
    x,
    y: -40,
    w: 36,
    h: 30,
    speed: 90 * levelSpeed,
    hp: 18,
    fireCooldown: randRange(0.4, 1),
  });
}

function spawnTurret(levelSpeed) {
  const x = Math.random() < 0.5 ? randRange(canvas.width * 0.16, canvas.width * 0.32) : randRange(canvas.width * 0.68, canvas.width * 0.84);
  enemies.push({
    type: 'turret',
    x,
    y: randRange(-20, 0),
    w: 34,
    h: 34,
    speed: 60 * levelSpeed,
    hp: 26,
    fireCooldown: randRange(0.6, 1.3),
  });
}

function spawnDebris(levelSpeed) {
  debris.push({
    x: randRange(canvas.width * 0.1, canvas.width * 0.9),
    y: -20,
    w: randRange(18, 40),
    h: randRange(12, 22),
    speed: 120 * levelSpeed,
    rot: randRange(-0.7, 0.7),
    angle: randRange(0, Math.PI * 2),
  });
}

function spawnBoss() {
  boss = {
    type: 'boss',
    x: canvas.width / 2,
    y: -120,
    w: 120,
    h: 120,
    hp: 420,
    speed: 50,
    fireCooldown: 0.5,
    phase: 0,
  };
}

function firePlayer() {
  if (player.fireCooldown > 0) return;
  player.fireCooldown = player.fireRate;
  const spread = 12;
  playerShots.push({ x: player.x - 6, y: player.y - player.h / 2, w: 6, h: 14, vy: -520, color: COLORS.playerFire });
  playerShots.push({ x: player.x + 6, y: player.y - player.h / 2, w: 6, h: 14, vy: -520, color: COLORS.playerFire });
  playerShots.push({ x: player.x, y: player.y - player.h / 2 - 4, w: 6, h: 14, vy: -520, color: COLORS.accent });
}

function fireEnemy(enemy) {
  const baseVy = 220;
  if (enemy.type === 'interceptor') {
    enemyShots.push({ x: enemy.x, y: enemy.y + 10, w: 6, h: 14, vy: baseVy, color: COLORS.enemyFire });
  } else if (enemy.type === 'turret') {
    enemyShots.push({ x: enemy.x - 8, y: enemy.y + 14, w: 6, h: 14, vy: baseVy * 1.1, color: COLORS.enemyFire });
    enemyShots.push({ x: enemy.x + 8, y: enemy.y + 14, w: 6, h: 14, vy: baseVy * 1.1, color: COLORS.enemyFire });
  } else if (enemy.type === 'boss') {
    const spread = [-60, -20, 20, 60];
    spread.forEach((offset) => {
      enemyShots.push({ x: enemy.x + offset, y: enemy.y + 40, w: 6, h: 18, vy: baseVy * 1.2, color: COLORS.boss });
    });
  }
}

function movePlayer(dt) {
  const speed = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') ? player.boostSpeed : player.speed;
  let dx = 0;
  let dy = 0;
  if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) dx -= 1;
  if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) dx += 1;
  if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) dy -= 1;
  if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) dy += 1;
  const length = Math.hypot(dx, dy) || 1;
  player.x += (dx / length) * speed * dt;
  player.y += (dy / length) * speed * dt;
  player.x = clamp(player.x, canvas.width * 0.12, canvas.width * 0.88);
  player.y = clamp(player.y, canvas.height * 0.45, canvas.height * 0.9);
  if ((input.keys.has('Space') || input.keys.has('KeyK')) && GAME_STATE.mode === 'running') {
    firePlayer();
  }
}

function updateShots(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const shot = list[i];
    shot.y += shot.vy * dt;
    if (shot.y < -30 || shot.y > canvas.height + 30) {
      list.splice(i, 1);
    }
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
  player.invulnerable = 0.8;
  GAME_STATE.multiplier = Math.max(1, GAME_STATE.multiplier - 0.5);
  if (player.hull <= 0) {
    triggerGameOver('Hull integrity lost');
  }
}

function reward(points) {
  GAME_STATE.score += points * GAME_STATE.multiplier;
  GAME_STATE.multiplier = Math.min(9, GAME_STATE.multiplier + 0.1);
  GAME_STATE.comboTimer = 4;
}

function updateEnemies(dt, levelSpeed) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += e.speed * dt;
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0) {
      fireEnemy(e);
      e.fireCooldown = randRange(0.8, 1.6);
    }
    if (e.y > canvas.height + 80) enemies.splice(i, 1);
  }
  if (boss) {
    boss.y = clamp(boss.y + boss.speed * dt, 100, canvas.height * 0.35);
    boss.fireCooldown -= dt;
    if (boss.fireCooldown <= 0) {
      fireEnemy(boss);
      boss.fireCooldown = 1.1;
    }
    boss.phase += dt;
    boss.x = canvas.width / 2 + Math.sin(boss.phase) * 140;
  }
}

function updateDebris(dt, levelSpeed) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.y += d.speed * dt;
    d.angle += d.rot * dt;
    if (d.y > canvas.height + 40) debris.splice(i, 1);
  }
}

function handleCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = playerShots.length - 1; j >= 0; j--) {
      const s = playerShots[j];
      if (hitbox(e, s)) {
        e.hp -= 14;
        playerShots.splice(j, 1);
        if (e.hp <= 0) {
          reward(e.type === 'turret' ? 50 : 80);
          enemies.splice(i, 1);
        }
      }
    }
    if (hitbox(e, player)) {
      applyDamage(25);
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
          reward(1200);
          boss = null;
          triggerVictory();
        }
      }
    }
  }

  for (let i = debris.length - 1; i >= 0; i--) {
    if (hitbox(debris[i], player)) {
      applyDamage(12);
      debris.splice(i, 1);
    }
  }

  for (let i = enemyShots.length - 1; i >= 0; i--) {
    if (hitbox(enemyShots[i], player)) {
      applyDamage(18);
      enemyShots.splice(i, 1);
    }
  }
}

function drawTrench(time) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.strokeStyle = COLORS.trench;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  const oscillate = Math.sin(time * 0.0018) * 30;
  const baseY = h * 0.3 + oscillate;

  ctx.beginPath();
  ctx.moveTo(w * 0.16, h);
  ctx.lineTo(w * 0.32, baseY);
  ctx.moveTo(w * 0.84, h);
  ctx.lineTo(w * 0.68, baseY);
  ctx.stroke();

  const rowCount = 18;
  for (let i = 0; i < rowCount; i++) {
    const t = (i + (time * 0.08 % 1)) / rowCount;
    const y = baseY + (h - baseY) * (t * t);
    const spread = (0.5 - t) * 380;
    ctx.beginPath();
    ctx.moveTo(w * 0.5 - spread, y);
    ctx.lineTo(w * 0.5 + spread, y);
    ctx.strokeStyle = t < 0.5 ? COLORS.trench : COLORS.trenchGlow;
    ctx.stroke();
  }
  ctx.restore();
}

function drawShip(ship) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(0, -ship.h * 0.7);
  ctx.lineTo(ship.w * 0.6, ship.h * 0.6);
  ctx.lineTo(-ship.w * 0.6, ship.h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(130, 242, 255, 0.25)';
  ctx.fillRect(-ship.w * 0.3, -ship.h * 0.3, ship.w * 0.6, ship.h * 0.6);
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.type === 'turret' ? COLORS.turret : COLORS.enemy;
    ctx.beginPath();
    ctx.moveTo(0, -e.h * 0.6);
    ctx.lineTo(e.w * 0.6, e.h * 0.6);
    ctx.lineTo(-e.w * 0.6, e.h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  if (boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.fillStyle = COLORS.boss;
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
    ctx.fillStyle = COLORS.boss;
    const ratio = Math.max(0, boss.hp / 420);
    ctx.fillRect(canvas.width / 2 - barWidth / 2, 18, barWidth * ratio, 10);
  }
}

function drawShots(list) {
  list.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
  });
}

function drawDebris() {
  debris.forEach((d) => {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
    ctx.restore();
  });
}

function drawHUDMessages() {
  if (GAME_STATE.practice) return;
  ctx.save();
  ctx.font = '20px "Orbitron", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  const level = LEVELS[GAME_STATE.levelIndex];
  ctx.fillText(level.name, 24, canvas.height - 24);
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
      <h1>Core Gate Destroyed</h1>
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
      GAME_STATE.multiplier = Math.max(1, GAME_STATE.multiplier - 0.2);
      GAME_STATE.comboTimer = 2.5;
    }
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    const level = LEVELS[GAME_STATE.levelIndex];
    const cadence = level.cadence;
    level._spawnTimers = level._spawnTimers || { interceptor: 0, turret: 0, debris: 0 };
    Object.keys(level._spawnTimers).forEach((key) => level._spawnTimers[key] -= dt);
    if (level._spawnTimers.interceptor <= 0) {
      spawnInterceptor(level.speed);
      level._spawnTimers.interceptor = cadence.interceptor;
    }
    if (level._spawnTimers.turret <= 0) {
      spawnTurret(level.speed);
      level._spawnTimers.turret = cadence.turret;
    }
    if (level._spawnTimers.debris <= 0) {
      spawnDebris(level.speed);
      level._spawnTimers.debris = cadence.debris;
    }
    if (level.boss && !boss && GAME_STATE.elapsed > level.duration * 0.6) {
      spawnBoss();
      toast('Core Gate inbound');
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
    updateDebris(dt, level.speed);
    updateShots(playerShots, dt);
    updateShots(enemyShots, dt);
    handleCollisions();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTrench(time);
  drawDebris();
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
  debris = [];
  enemyShots = [];
  playerShots = [];
  boss = null;
  LEVELS[GAME_STATE.levelIndex]._spawnTimers = { interceptor: 0, turret: 0, debris: 0 };
  hud.screen.classList.remove('active');
};

window._practice = () => resetGame(true);

function setupMenu() {
  const menuHtml = `
    <div class="panel">
      <p class="tag">PRELAUNCH BRIEF</p>
      <h1>Trenchfire: Starfall Run</h1>
      <p class="lead">Dive into the star-forged trench. Evade plasma walls, shred interceptors, and deliver the core strike. Built for fast runs on desktop or mobile with gamepad-ready controls.</p>
      <div class="grid">
        <div class="card">
          <h3>Flight Controls</h3>
          <ul>
            <li><strong>Move:</strong> WASD / Arrow Keys / Left Stick</li>
            <li><strong>Fire:</strong> Space / A Button</li>
            <li><strong>Boost:</strong> Shift / Right Trigger</li>
            <li><strong>Pause:</strong> P</li>
          </ul>
        </div>
        <div class="card">
          <h3>Objective</h3>
          <p>Stay inside the trench, break through turrets and interceptors, then land the finishing shot on the Core Gate. Keep your multiplier alive for elite scores.</p>
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

window._start = () => resetGame(false);

bindInput();
setupMenu();
GAME_STATE.lastTime = performance.now();
initTrench();
requestAnimationFrame(loop);
