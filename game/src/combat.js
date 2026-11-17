// Combat: pistol pemain, peluru, dan preman rentenir di misi 3.
// Pejalan kaki juga tinggal di sini: berjalan di trotoar, lari saat ada tembakan.

import { PED_COUNT, PLAYER } from './config.js';

export function createBullet(x, y, angle, speed, from) {
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, from, life: 0.9 };
}

/** Tembakan pemain ke arah kursor (koordinat dunia). */
export function playerShoot(game, targetX, targetY) {
  const p = game.player;
  if (!p.hasPistol || p.ammo <= 0 || p.shootCooldown > 0) return false;
  p.ammo -= 1;
  p.shootCooldown = 0.22;
  const angle = Math.atan2(targetY - p.y, targetX - p.x);
  game.bullets.push(createBullet(p.x, p.y, angle, 640, 'player'));
  game.audio.shot();
  game.shake = Math.max(game.shake, 5);
  // Tembakan terdengar polisi dalam radius 350.
  if (game.nearestPoliceDistance() < 350) {
    game.wanted.level = Math.min(3, game.wanted.level + 1);
  }
  return true;
}

export function updateBullets(game, dt) {
  const city = game.city;
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Kena bangunan?
      const fixed = city.resolveCircle(b.x, b.y, 2);
      if (fixed.x !== b.x || fixed.y !== b.y) dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const t of game.thugs) {
        if (t.alive && Math.hypot(t.x - b.x, t.y - b.y) < 16) {
          t.health -= 34;
          game.particles.push({ x: b.x, y: b.y, vx: 0, vy: -20, life: 0.4, color: '#ff5a4e', size: 5 });
          if (t.health <= 0) {
            t.alive = false;
            game.popups.push({ x: t.x, y: t.y - 24, text: 'PREMAN LUMPUH', life: 1.6, color: '#ffb347' });
            game.audio.pickup();
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'thug') {
      const p = game.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        hurtPlayer(game, 8);
        dead = true;
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
}

export function hurtPlayer(game, amount) {
  const p = game.player;
  if (p.invuln > 0) return;
  p.health -= amount;
  p.invuln = 0.4;
  game.shake = Math.max(game.shake, 4);
  game.audio.hit();
  if (p.health <= 0) {
    p.health = 0;
    game.overTitle = 'BARA TUMBANG';
    game.overLines = ['Bara tumbang dalam baku tembak.', 'Bangun lagi di Warung Bu Ratna — misi diulang dari awal.'];
    game.overResume = 'death';
    game.screen = 'over';
    game.audio.gameOver();
  }
}

/** Preman misi 3: berdiri di halaman gudang (area terbuka), menembak bila pemain dekat & terlihat. */
export function spawnThugs(game) {
  const spots = [
    { x: 380, y: 940 }, { x: 470, y: 1010 }, { x: 560, y: 950 },
  ];
  for (const s of spots) {
    game.thugs.push({ x: s.x, y: s.y, health: 100, alive: true, shootTimer: 1 + game.random() * 1.5, angle: 0 });
  }
}

export function updateThugs(game, dt) {
  const p = game.player;
  for (const t of game.thugs) {
    if (!t.alive) continue;
    const d = Math.hypot(p.x - t.x, p.y - t.y);
    t.angle = Math.atan2(p.y - t.y, p.x - t.x);
    if (d < 340 && game.city.hasLineOfSight(t.x, t.y, p.x, p.y)) {
      t.shootTimer -= dt;
      if (t.shootTimer <= 0) {
        t.shootTimer = 1.4 + game.random() * 0.8;
        const spread = (game.random() - 0.5) * 0.35;
        game.bullets.push(createBullet(t.x, t.y, t.angle + spread, 420, 'thug'));
        game.audio.enemyShot();
      }
    } else {
      t.shootTimer = Math.max(t.shootTimer, 0.4);
    }
  }
}

/** Pejalan kaki: berjalan di trotoar sepanjang jalan, lari saat ada tembakan di dekatnya. */
export function spawnPeds(city, random) {
  const peds = [];
  const shirts = ['#e86a5a', '#5a8de8', '#e8c95a', '#7ad67a', '#c97ad6', '#e8e8e8'];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const node = city.nodes[Math.floor(random() * city.nodes.length)];
    peds.push({
      x: node.x + (random() - 0.5) * 200,
      y: node.y + (random() - 0.5) * 200,
      angle: random() * Math.PI * 2,
      speed: 30 + random() * 25,
      shirt: shirts[i % shirts.length],
      flee: 0,
      targetX: node.x,
      targetY: node.y,
      walkPhase: random() * Math.PI * 2,
    });
  }
  return peds;
}

export function updatePeds(game, dt) {
  const city = game.city;
  const p = game.player;
  for (const ped of game.peds) {
    ped.walkPhase += dt * 6;
    // Lari bila tembakan baru saja terjadi di dekatnya.
    if (game.events.shotFired && Math.hypot(ped.x - p.x, ped.y - p.y) < 300) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 130 * dt;
      ped.y += Math.sin(away) * 130 * dt;
    } else {
      const dx = ped.targetX - ped.x;
      const dy = ped.targetY - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 20) {
        const node = city.nodes[Math.floor(game.random() * city.nodes.length)];
        ped.targetX = node.x + (game.random() - 0.5) * 160;
        ped.targetY = node.y + (game.random() - 0.5) * 160;
      } else {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    const fixed = city.resolveCircle(ped.x, ped.y, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
}

/** Tabrakan mobil pemain dengan pejalan kaki: warga jatuh & lari, wanted naik bila terlihat. */
export function checkPedHits(game) {
  const p = game.player;
  if (p.onFoot) return;
  const car = p.car;
  if (!car || Math.abs(car.speed) < 40) return;
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
      ped.flee = 4;
      ped.x += Math.cos(car.angle) * 30;
      ped.y += Math.sin(car.angle) * 30;
      if (game.nearestPoliceDistance() < 320) {
        game.wanted.level = Math.min(3, game.wanted.level + 1);
        game.popups.push({ x: ped.x, y: ped.y - 20, text: 'WARGA TERTABRAK!', life: 1.5, color: '#ff5a4e' });
      }
      game.shake = Math.max(game.shake, 6);
      game.audio.hit();
      car.speed *= 0.7;
    }
  }
}
