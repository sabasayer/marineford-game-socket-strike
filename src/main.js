import {
  SHAPES,
  cloneMatrix,
  matrixCells,
  randomShapeKey,
  rotateMatrix
} from './tetromino.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('preview');
const previewCtx = previewCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const statusEl = document.getElementById('status');

const CELL = 20;
const GRID_W = 32;
const GRID_H = 40;
const PLAYER_Y = GRID_H - 3;

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
  socket: '#ff6b9d',
  socketFilled: '#3dffb0',
  hull: '#4a6a9a',
  player: '#7ee8ff'
};

const keys = new Set();

document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});

document.addEventListener('keyup', (e) => keys.delete(e.code));

function makeEnemy(type, x, y) {
  const patterns = {
    scout: [
      [0, 1, 1, 0],
      [1, 0, 0, 1],
      [0, 1, 1, 0]
    ],
    cruiser: [
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 1, 1, 0],
      [1, 0, 0, 0, 1]
    ],
    boss: [
      [0, 1, 1, 1, 0],
      [1, 0, 1, 0, 1],
      [1, 1, 0, 1, 1],
      [0, 1, 1, 1, 0]
    ]
  };
  const sockets = patterns[type].map((row) => row.map((v) => (v ? 1 : 0)));
  const socketCount = sockets.flat().filter(Boolean).length;
  return {
    type,
    x,
    y,
    w: sockets[0].length,
    h: sockets.length,
    sockets,
    filled: sockets.map((row) => row.map(() => 0)),
    hp: socketCount * 2,
    maxHp: socketCount * 2,
    speed: type === 'scout' ? 0.35 : type === 'cruiser' ? 0.22 : 0.12
  };
}

function freshState() {
  return {
    score: 0,
    wave: 1,
    playerX: GRID_W / 2,
    nextKey: randomShapeKey(),
    nextMatrix: cloneMatrix(SHAPES[randomShapeKey()]),
    bullets: [],
    enemies: [],
    particles: [],
    spawnTimer: 0,
    status: 'Align tetromino bullets with glowing sockets.',
    gameOver: false,
    winPulse: 0
  };
}

let state = freshState();

function resetGame() {
  state = freshState();
  spawnWave();
}

function spawnWave() {
  state.enemies = [];
  const types = state.wave % 3 === 0 ? ['boss'] : state.wave % 2 === 0 ? ['cruiser', 'scout'] : ['scout', 'scout'];
  let offset = 4;
  for (const type of types) {
    state.enemies.push(makeEnemy(type, offset, 2));
    offset += type === 'boss' ? 10 : 8;
  }
  state.status = `Wave ${state.wave}: match piece shapes to pink sockets.`;
}

function rotateNext(dir) {
  state.nextMatrix = rotateMatrix(state.nextMatrix, dir);
}

function fire() {
  const cells = matrixCells(state.nextMatrix);
  if (!cells.length) return;
  const minC = Math.min(...cells.map((c) => c.c));
  const maxC = Math.max(...cells.map((c) => c.c));
  const width = maxC - minC + 1;
  const x = state.playerX - width / 2;
  state.bullets.push({
    key: state.nextKey,
    matrix: cloneMatrix(state.nextMatrix),
    x,
    y: PLAYER_Y - 2,
    vx: 0,
    vy: -0.55,
    locked: false
  });
  state.nextKey = randomShapeKey();
  state.nextMatrix = cloneMatrix(SHAPES[state.nextKey]);
}

function socketOverlap(enemy, bullet) {
  const cells = matrixCells(bullet.matrix);
  let hits = 0;
  const newFills = [];
  for (const cell of cells) {
    const gx = Math.round(bullet.x + cell.c);
    const gy = Math.round(bullet.y + cell.r);
    const lx = gx - Math.round(enemy.x);
    const ly = gy - Math.round(enemy.y);
    if (lx < 0 || ly < 0 || lx >= enemy.w || ly >= enemy.h) continue;
    if (!enemy.sockets[ly][lx] || enemy.filled[ly][lx]) continue;
    hits++;
    newFills.push({ lx, ly });
  }
  return { hits, newFills };
}

function applyFit(enemy, bullet, overlap) {
  if (overlap.hits === 0) return false;
  const totalSockets = enemy.sockets.flat().filter(Boolean).length;
  const fitRatio = overlap.hits / totalSockets;
  const pieceRatio = overlap.hits / matrixCells(bullet.matrix).length;
  if (overlap.hits < 2 && fitRatio < 0.4) return false;

  for (const { lx, ly } of overlap.newFills) {
    enemy.filled[ly][lx] = 1;
  }
  const damage = Math.round(overlap.hits * (1 + pieceRatio) * 2);
  enemy.hp -= damage;
  state.score += damage * 10;
  spawnParticles(
    enemy.x + enemy.w / 2,
    enemy.y + enemy.h / 2,
    COLORS[bullet.key],
    12 + overlap.hits * 3
  );
  state.status = `Fit! ${overlap.hits} socket${overlap.hits > 1 ? 's' : ''} locked — ${damage} damage.`;
  bullet.locked = true;
  return true;
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 1.2;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      color
    });
  }
}

function updateBullets() {
  for (const bullet of state.bullets) {
    if (bullet.locked) continue;
    bullet.y += bullet.vy;
    if (bullet.y < -4) {
      bullet.dead = true;
      continue;
    }
    for (const enemy of state.enemies) {
      const overlap = socketOverlap(enemy, bullet);
      if (overlap.hits > 0 && applyFit(enemy, bullet, overlap)) break;
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead && !b.locked);
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.y += enemy.speed * dt;
    if (enemy.y > PLAYER_Y - 1) {
      state.gameOver = true;
      state.status = 'Enemy breached — press R to retry.';
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  if (!state.gameOver && state.enemies.length === 0) {
    state.wave++;
    spawnWave();
    state.winPulse = 60;
    state.status = `Wave cleared! Starting wave ${state.wave}.`;
  }
}

function updateParticles() {
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function handleInput() {
  if (state.gameOver) {
    if (keys.has('KeyR')) resetGame();
    return;
  }
  if (keys.has('ArrowLeft')) state.playerX = Math.max(2, state.playerX - 0.45);
  if (keys.has('ArrowRight')) state.playerX = Math.min(GRID_W - 2, state.playerX + 0.45);
  if (keys.has('KeyQ')) {
    rotateNext(-1);
    keys.delete('KeyQ');
  }
  if (keys.has('KeyE')) {
    rotateNext(1);
    keys.delete('KeyE');
  }
  if (keys.has('Space')) {
    fire();
    keys.delete('Space');
  }
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(60, 100, 160, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= GRID_W; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= GRID_H; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(canvas.width, y * CELL);
    ctx.stroke();
  }
}

function drawStars(t) {
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 97) % GRID_W) * CELL;
    const sy = (((i * 53 + t * 0.02) % GRID_H) * CELL);
    ctx.fillRect(sx, sy, 2, 2);
  }
}

function drawEnemy(enemy) {
  const px = enemy.x * CELL;
  const py = enemy.y * CELL;
  ctx.fillStyle = COLORS.hull;
  ctx.fillRect(px - 4, py - 4, enemy.w * CELL + 8, enemy.h * CELL + 8);
  for (let r = 0; r < enemy.h; r++) {
    for (let c = 0; c < enemy.w; c++) {
      const x = px + c * CELL;
      const y = py + r * CELL;
      if (enemy.sockets[r][c]) {
        ctx.fillStyle = enemy.filled[r][c] ? COLORS.socketFilled : COLORS.socket;
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
        if (!enemy.filled[r][c]) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);
        }
      } else {
        ctx.fillStyle = '#2a3f66';
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    }
  }
  const barW = enemy.w * CELL;
  const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(px, py - 10, barW, 6);
  ctx.fillStyle = hpRatio > 0.4 ? '#3dffb0' : '#ff5577';
  ctx.fillRect(px, py - 10, barW * hpRatio, 6);
}

function drawBullet(bullet) {
  const cells = matrixCells(bullet.matrix);
  const color = COLORS[bullet.key] || '#fff';
  for (const cell of cells) {
    const x = (bullet.x + cell.c) * CELL;
    const y = (bullet.y + cell.r) * CELL;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
  }
}

function drawPlayer() {
  const x = state.playerX * CELL;
  const y = PLAYER_Y * CELL;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(x, y - CELL);
  ctx.lineTo(x - CELL, y + CELL);
  ctx.lineTo(x + CELL, y + CELL);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(126, 232, 255, 0.35)';
  ctx.fillRect(x - CELL * 1.5, y + CELL, CELL * 3, CELL * 0.4);
}

function drawPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const cells = matrixCells(state.nextMatrix);
  if (!cells.length) return;
  const minR = Math.min(...cells.map((c) => c.r));
  const minC = Math.min(...cells.map((c) => c.c));
  const size = 18;
  const offsetX = (previewCanvas.width - state.nextMatrix[0].length * size) / 2;
  const offsetY = (previewCanvas.height - state.nextMatrix.length * size) / 2;
  previewCtx.fillStyle = COLORS[state.nextKey];
  for (const cell of cells) {
    previewCtx.fillRect(
      offsetX + (cell.c - minC) * size,
      offsetY + (cell.r - minR) * size,
      size - 2,
      size - 2
    );
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x * CELL, p.y * CELL, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff8899';
    ctx.font = 'bold 32px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('BREACHED', canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#d8e8ff';
    ctx.font = '16px system-ui';
    ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 36);
    ctx.textAlign = 'left';
  }
  if (state.winPulse > 0) {
    ctx.fillStyle = `rgba(61, 255, 176, ${state.winPulse / 80})`;
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Wave ${state.wave - 1} cleared!`, canvas.width / 2, 48);
    ctx.textAlign = 'left';
    state.winPulse--;
  }
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(3, (now - last) / 16);
  last = now;
  handleInput();
  if (!state.gameOver) {
    updateBullets();
    updateEnemies(dt);
    updateParticles();
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars(now);
  drawGrid();
  for (const enemy of state.enemies) drawEnemy(enemy);
  for (const bullet of state.bullets) drawBullet(bullet);
  drawPlayer();
  drawParticles();
  drawOverlay();
  drawPreview();
  scoreEl.textContent = state.score;
  waveEl.textContent = state.wave;
  statusEl.textContent = state.status;
  requestAnimationFrame(frame);
}

spawnWave();
requestAnimationFrame(frame);
