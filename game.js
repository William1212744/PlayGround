const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOver');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const finalScore = document.getElementById('finalScore');

const healthValue = document.getElementById('healthValue');
const waveValue = document.getElementById('waveValue');
const scoreValue = document.getElementById('scoreValue');

const joystickBase = document.getElementById('joystickBase');
const joystickStick = document.getElementById('joystickStick');
const fireButton = document.getElementById('fireButton');

const world = {
  width: 0,
  height: 0,
  score: 0,
  wave: 1,
  kills: 0,
  started: false,
  over: false,
  enemies: [],
  bullets: [],
  particles: [],
  pickups: [],
  spawnTimer: 0,
  cameraShake: 0,
  keys: Object.create(null),
  pointer: { x: 0, y: 0, worldX: 0, worldY: 0, down: false },
  touch: { active: false, dx: 0, dy: 0, fire: false },
};

const player = {
  x: 0,
  y: 0,
  radius: 18,
  speed: 260,
  health: 100,
  angle: 0,
  fireCooldown: 0,
  recoil: 0,
};

let lastTimestamp = 0;
const pickupColors = ['#7ef0b7', '#69d1ff', '#ffc074'];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function dist(aX, aY, bX, bY) {
  return Math.hypot(bX - aX, bY - aY);
}

function setCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  world.width = rect.width;
  world.height = rect.height;

  if (!world.started || world.over) {
    player.x = rect.width * 0.5;
    player.y = rect.height * 0.5;
  }
}

function updateHud() {
  healthValue.textContent = Math.max(0, Math.ceil(player.health));
  waveValue.textContent = world.wave;
  scoreValue.textContent = world.score;
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    world.particles.push({
      x,
      y,
      vx: rand(-80, 80),
      vy: rand(-80, 80),
      life: rand(0.3, 0.8),
      size: rand(2, 5),
      color,
    });
  }
}

function createPickup(x, y) {
  const color = pickupColors[Math.floor(Math.random() * pickupColors.length)];
  world.pickups.push({ x, y, radius: 9, color, pulse: Math.random() * Math.PI * 2, value: 10 });
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const pad = 32;

  if (edge === 0) {
    x = rand(-pad, world.width + pad);
    y = -pad;
  } else if (edge === 1) {
    x = world.width + pad;
    y = rand(-pad, world.height + pad);
  } else if (edge === 2) {
    x = rand(-pad, world.width + pad);
    y = world.height + pad;
  } else {
    x = -pad;
    y = rand(-pad, world.height + pad);
  }

  const speed = 46 + world.wave * 9 + Math.random() * 22;
  const radius = 18 + Math.random() * 9;
  const hp = 1 + Math.floor(world.wave / 3);

  world.enemies.push({ x, y, radius, speed, hp, maxHp: hp, damage: 12 + world.wave * 1.3 });
}

function createBullet(originX, originY, angle, speed, color = '#ffd285') {
  world.bullets.push({
    x: originX,
    y: originY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.1,
    radius: 4,
    color,
    damage: 1,
  });
}

function fireWeapon() {
  if (!world.started || world.over) return;
  if (player.fireCooldown > 0) return;

  const muzzle = 24;
  const angle = player.angle;
  const x = player.x + Math.cos(angle) * muzzle;
  const y = player.y + Math.sin(angle) * muzzle;
  createBullet(x, y, angle, 600);
  player.fireCooldown = 0.13;
  player.recoil = 0.14;
  world.cameraShake = 4;
  createParticles(x, y, '#ffd285', 6);
}

function resetGame() {
  world.score = 0;
  world.wave = 1;
  world.kills = 0;
  world.over = false;
  world.started = true;
  world.enemies = [];
  world.bullets = [];
  world.particles = [];
  world.pickups = [];
  world.spawnTimer = 0;
  world.cameraShake = 0;
  player.x = world.width * 0.5;
  player.y = world.height * 0.5;
  player.health = 100;
  player.angle = -Math.PI / 2;
  player.fireCooldown = 0;
  player.recoil = 0;
  updateHud();
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
}

function endGame() {
  world.over = true;
  world.started = false;
  finalScore.textContent = `Score: ${world.score}`;
  gameOverScreen.classList.remove('hidden');
}

function handleWaveProgression() {
  const requiredKills = world.wave * 8;
  if (world.kills >= requiredKills) {
    world.wave += 1;
    world.kills = 0;
    world.score += 50;
    createParticles(player.x, player.y, '#7ef0b7', 18);
  }
}

function update(dt) {
  if (!world.started || world.over) {
    return;
  }

  world.cameraShake = Math.max(0, world.cameraShake - dt * 20);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.recoil = Math.max(0, player.recoil - dt * 2.5);

  let moveX = 0;
  let moveY = 0;
  const keyboardX = (world.keys.KeyD || world.keys.ArrowRight ? 1 : 0) - (world.keys.KeyA || world.keys.ArrowLeft ? 1 : 0);
  const keyboardY = (world.keys.KeyS || world.keys.ArrowDown ? 1 : 0) - (world.keys.KeyW || world.keys.ArrowUp ? 1 : 0);

  moveX += keyboardX;
  moveY += keyboardY;

  if (world.touch.active) {
    moveX += world.touch.dx;
    moveY += world.touch.dy;
  }

  if (moveX || moveY) {
    const length = Math.hypot(moveX, moveY) || 1;
    const speed = player.speed * dt;
    player.x += (moveX / length) * speed;
    player.y += (moveY / length) * speed;
  }

  player.x = clamp(player.x, player.radius, world.width - player.radius);
  player.y = clamp(player.y, player.radius, world.height - player.radius);

  const pointerX = world.pointer.worldX;
  const pointerY = world.pointer.worldY;
  if (pointerX !== undefined && pointerY !== undefined) {
    player.angle = Math.atan2(pointerY - player.y, pointerX - player.x);
  }

  if (world.pointer.down || world.touch.fire || world.keys.Space) {
    fireWeapon();
  }

  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0) {
    const perWave = Math.min(2 + world.wave, 7);
    const spawnCount = Math.min(2, Math.ceil(world.wave / 2));
    for (let i = 0; i < spawnCount; i += 1) {
      if (Math.random() < 0.9) {
        spawnEnemy();
      }
    }
    world.spawnTimer = Math.max(0.7, 1.2 - world.wave * 0.07) * (perWave > 0 ? 1 : 1);
  }

  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = world.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < -20 ||
      bullet.x > world.width + 20 ||
      bullet.y < -20 ||
      bullet.y > world.height + 20
    ) {
      world.bullets.splice(i, 1);
      continue;
    }

    for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
      const enemy = world.enemies[j];
      const hit = dist(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.radius + bullet.radius;
      if (hit) {
        enemy.hp -= bullet.damage;
        world.bullets.splice(i, 1);
        createParticles(bullet.x, bullet.y, '#ffb466', 8);
        if (enemy.hp <= 0) {
          world.enemies.splice(j, 1);
          world.kills += 1;
          world.score += 25;
          createParticles(enemy.x, enemy.y, '#ff6d5f', 16);
          if (Math.random() < 0.16) {
            createPickup(enemy.x, enemy.y);
          }
        }
        break;
      }
    }
  }

  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / len) * enemy.speed * dt;
    enemy.y += (dy / len) * enemy.speed * dt;

    if (dist(enemy.x, enemy.y, player.x, player.y) < enemy.radius + player.radius) {
      player.health -= enemy.damage * dt;
      world.cameraShake = 5;
      createParticles(enemy.x, enemy.y, '#ff8c7c', 2);
      if (player.health <= 0) {
        player.health = 0;
        endGame();
        updateHud();
        return;
      }
    }
  }

  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    pickup.pulse += dt * 4;
    if (dist(pickup.x, pickup.y, player.x, player.y) < pickup.radius + player.radius + 10) {
      player.health = clamp(player.health + pickup.value, 0, 100);
      world.score += 50;
      createParticles(pickup.x, pickup.y, pickup.color, 20);
      world.pickups.splice(i, 1);
    }
  }

  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const particle = world.particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    if (particle.life <= 0) {
      world.particles.splice(i, 1);
    }
  }

  handleWaveProgression();
  updateHud();
}

function drawBackground() {
  ctx.fillStyle = '#09131e';
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.save();
  ctx.translate(rand(-world.cameraShake, world.cameraShake), rand(-world.cameraShake, world.cameraShake));

  const grid = 30;
  ctx.strokeStyle = 'rgba(142, 203, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 0; y <= world.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }

  const skylineHeight = Math.min(160, world.height * 0.26);
  for (let i = 0; i < 20; i += 1) {
    const w = 32 + (i % 4) * 16;
    const h = 50 + ((i * 17) % 90);
    const x = (i * 45) % world.width;
    const y = world.height - skylineHeight + (skylineHeight - h);
    ctx.fillStyle = i % 2 === 0 ? '#0e1a2b' : '#111f2f';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(251, 176, 93, 0.18)';
    for (let wy = 0; wy < h; wy += 9) {
      for (let wx = 0; wx < w; wx += 8) {
        if ((wy + wx) % 17 === 0) {
          ctx.fillRect(x + wx + 3, y + wy + 3, 3, 5);
        }
      }
    }
  }

  const orangeGlow = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 220);
  orangeGlow.addColorStop(0, 'rgba(255, 170, 95, 0.18)');
  orangeGlow.addColorStop(1, 'rgba(17, 32, 42, 0)');
  ctx.fillStyle = orangeGlow;
  ctx.fillRect(player.x - 220, player.y - 220, 440, 440);

  ctx.restore();
}

function drawOperator(x, y, angle, uniform, helmet, facing = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Soft ground shadow, tactical pack, armor and a forward-facing rifle.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#202b30';
  ctx.fillRect(-12, -9, 12, 18);
  ctx.fillStyle = uniform;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c2a887';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = helmet;
  ctx.beginPath();
  ctx.arc(4, 0, 6, -Math.PI * 0.82, Math.PI * 0.82);
  ctx.fill();

  // Carbine silhouette and a small muzzle highlight.
  ctx.fillStyle = '#11191b';
  ctx.fillRect(7, -3, 23 * facing, 6);
  ctx.fillStyle = '#7a7b6e';
  ctx.fillRect(20, -1, 13 * facing, 2);
  ctx.fillStyle = '#d7e8d9';
  ctx.fillRect(32 * facing, -1, 2, 2);
  ctx.restore();
}

function drawPlayer() {
  drawOperator(player.x, player.y, player.angle, '#586f66', '#384a44');

  const healthBarWidth = 48;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fillRect(player.x - healthBarWidth / 2, player.y - 31, healthBarWidth, 5);
  ctx.fillStyle = '#7ef0b7';
  ctx.fillRect(player.x - healthBarWidth / 2, player.y - 31, (player.health / 100) * healthBarWidth, 5);
}

function drawEnemies() {
  for (const enemy of world.enemies) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    drawOperator(enemy.x, enemy.y, angle, '#70574c', '#513d38');

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 11, 36, 4);
    ctx.fillStyle = '#ef6b5b';
    ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 11, (enemy.hp / enemy.maxHp) * 36, 4);
  }
}

function drawBullets() {
  for (const bullet of world.bullets) {
    ctx.beginPath();
    ctx.fillStyle = bullet.color;
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups() {
  for (const pickup of world.pickups) {
    const shimmer = Math.sin(pickup.pulse) * 2;
    ctx.beginPath();
    ctx.fillStyle = pickup.color;
    ctx.arc(pickup.x, pickup.y, pickup.radius + shimmer, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawParticles() {
  for (const particle of world.particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life * 1.5);
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.clearRect(0, 0, world.width, world.height);
  drawBackground();
  drawPickups();
  drawBullets();
  drawEnemies();
  drawParticles();
  drawPlayer();

  if (!world.started && !world.over) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = '600 18px sans-serif';
    ctx.fillText('Press Deploy to begin the strike', 24, world.height - 24);
  }
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTimestamp) / 1000 || 0.016);
  lastTimestamp = timestamp;

  update(dt);
  render();
  requestAnimationFrame(loop);
}

function syncPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  world.pointer.x = x;
  world.pointer.y = y;
  world.pointer.worldX = x;
  world.pointer.worldY = y;
}

canvas.addEventListener('pointermove', (event) => {
  syncPointerFromEvent(event);
});

canvas.addEventListener('pointerdown', (event) => {
  syncPointerFromEvent(event);
  world.pointer.down = true;
});

canvas.addEventListener('pointerup', () => {
  world.pointer.down = false;
});

canvas.addEventListener('pointerleave', () => {
  world.pointer.down = false;
});

window.addEventListener('keydown', (event) => {
  world.keys[event.code] = true;
  if (event.code === 'Space') {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  world.keys[event.code] = false;
});

startButton.addEventListener('click', () => {
  resetGame();
});

restartButton.addEventListener('click', () => {
  resetGame();
});

function updateJoystickFromEvent(clientX, clientY) {
  const rect = joystickBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const distance = Math.min(42, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const stickX = Math.cos(angle) * distance;
  const stickY = Math.sin(angle) * distance;

  joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
  world.touch.dx = clamp(stickX / 42, -1, 1);
  world.touch.dy = clamp(stickY / 42, -1, 1);
}

joystickBase.addEventListener('pointerdown', (event) => {
  world.touch.active = true;
  updateJoystickFromEvent(event.clientX, event.clientY);
});

window.addEventListener('pointermove', (event) => {
  if (world.touch.active) {
    updateJoystickFromEvent(event.clientX, event.clientY);
  }
});

window.addEventListener('pointerup', () => {
  world.pointer.down = false;
  world.touch.active = false;
  world.touch.dx = 0;
  world.touch.dy = 0;
  joystickStick.style.transform = 'translate(-50%, -50%)';
  world.touch.fire = false;
});

fireButton.addEventListener('pointerdown', () => {
  world.touch.fire = true;
});

fireButton.addEventListener('pointerup', () => {
  world.touch.fire = false;
});

fireButton.addEventListener('pointerleave', () => {
  world.touch.fire = false;
});

window.addEventListener('resize', setCanvasSize);

setCanvasSize();
updateHud();
requestAnimationFrame(loop);
