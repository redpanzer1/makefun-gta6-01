// Wanted & polisi. Arsitektur mengikuti desain: road graph + Dijkstra saat
// target berubah (cache rute), interception dengan prediksi posisi 1,8 detik,
// line-of-sight vs bangunan, state machine CHASE / SEARCH / RETURN, decay
// wanted saat tak terlihat, dan aturan tertangkap (bukan sekadar sentuhan).

import { WANTED } from './config.js';
import { makeCar, driveCar } from './vehicles.js';

export function createWanted() {
  return { level: 0, decayTimer: 0, seenTimer: 0, escapedShown: false };
}

/** Naikkan wanted, maksimal 3. Mengembalikan level baru. */
export function raiseWanted(wanted, amount) {
  wanted.level = Math.min(WANTED.max, wanted.level + amount);
  wanted.decayTimer = 0;
  wanted.escapedShown = false;
  return wanted.level;
}

export function clearWanted(wanted) {
  wanted.level = 0;
  wanted.decayTimer = 0;
}

export function createPoliceUnit(city, random, player, level, role) {
  // Spawn di node jalan yang masuk akal, di luar layar, >=300 px dari pemain.
  let node = null;
  for (let tries = 0; tries < 40; tries += 1) {
    const candidate = city.nodes[Math.floor(random() * city.nodes.length)];
    const d = Math.hypot(candidate.x - player.x, candidate.y - player.y);
    if (d >= WANTED.spawnMinDistance) { node = candidate; break; }
  }
  if (!node) node = city.nodes[0];
  const car = makeCar('patroli', node.x, node.y, random() * Math.PI * 2, 'police');
  car.topSpeed = WANTED.policeSpeed[level];
  return {
    car,
    state: 'CHASE',
    role, // 'chase' | 'cutoff' | 'block'
    lastSeen: { x: player.x, y: player.y },
    lostTime: 0,
    route: [],
    routeIndex: 0,
    repathIn: 0,
    stuckTime: 0,
    arrestTimer: 0,
    sirenPhase: random() * Math.PI * 2,
  };
}

/** Polisi jalan kaki (fase 2): mengejar pemain yang jalan kaki saat wanted >= 2.
 * Satu unit = { x, y, angle, arrestTimer }. Bergerak 150 px/dtk, menangkap
 * bila menempel <= 26 px selama 1,2 dtk. Despawn saat pemain masuk mobil. */
export function createFootPolice(x, y) {
  return { x, y, angle: 0, arrestTimer: 0, walkPhase: 0 };
}

export function syncFootPolice(units, city, random, player, wanted) {
  const want = !player.onFoot || wanted.level < 2 ? 0 : Math.min(2, wanted.level - 1);
  while (units.length < want) {
    // Spawn di node jalan acak (seeded, bukan Math.random — aman untuk staging).
    const node = city.nodes[Math.floor(random() * city.nodes.length)];
    units.push(createFootPolice(node.x, node.y));
  }
  while (units.length > want) units.pop();
  return units;
}

export function updateFootPolice(units, city, player, dt) {
  for (const u of units) {
    const d = Math.hypot(player.x - u.x, player.y - u.y);
    u.angle = Math.atan2(player.y - u.y, player.x - u.x);
    u.walkPhase += dt * 8;
    if (d > 26) {
      u.x += Math.cos(u.angle) * 150 * dt;
      u.y += Math.sin(u.angle) * 150 * dt;
      const fixed = city.resolveCircle(u.x, u.y, 11);
      u.x = fixed.x;
      u.y = fixed.y;
      u.arrestTimer = Math.max(0, u.arrestTimer - dt);
    } else {
      u.arrestTimer += dt;
      if (u.arrestTimer >= 1.2) return 'arrested';
    }
  }
  return null;
}

/** Pastikan jumlah polisi aktif sesuai wanted; kembalikan daftar unit aktif. */
export function syncPolice(units, city, random, player, wanted) {
  const want = WANTED.policeCount[wanted.level] || 0;
  while (units.length < want) {
    const roles = ['chase', 'cutoff', 'block'];
    units.push(createPoliceUnit(city, random, player, wanted.level, roles[units.length] || 'chase'));
  }
  while (units.length > want) {
    const unit = units.pop();
    unit.car.role = 'gone';
  }
  return units;
}

function seesPlayer(unit, city, player, wanted) {
  const d = Math.hypot(unit.car.x - player.x, unit.car.y - player.y);
  if (d > WANTED.vision[wanted.level]) return false;
  // Cone pandang 120 derajat di depan mobil polisi (longgar saat sangat dekat).
  if (d > 90) {
    const toPlayer = Math.atan2(player.y - unit.car.y, player.x - unit.car.x);
    let diff = toPlayer - unit.car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > (120 * Math.PI) / 360) return false;
  }
  return city.hasLineOfSight(unit.car.x, unit.car.y, player.x, player.y);
}

function pickTargetNode(unit, city, player, wanted) {
  // Prediksi posisi pemain 1,8 detik ke depan, dibatasi 120-160 px.
  const pvx = player.vx || 0;
  const pvy = player.vy || 0;
  let px = player.x + pvx * 1.8;
  let py = player.y + pvy * 1.8;
  const over = Math.hypot(px - player.x, py - player.y);
  if (over > 150) {
    px = player.x + ((px - player.x) / over) * 150;
    py = player.y + ((py - player.y) / over) * 150;
  }
  if (unit.role === 'cutoff') return city.nearestNode(px, py);
  if (unit.role === 'block') {
    // Jaga persimpangan di depan pemain: node terdekat dari posisi prediksi + satu ruas.
    return city.nearestNode(px, py);
  }
  return city.nearestNode(player.x, player.y);
}

/** Satu langkah AI polisi (dipanggil tiap tick; logika rute dihitung tiap 3 tick). */
export function updatePolice(units, city, player, wanted, dt, tick) {
  for (const unit of units) {
    const car = unit.car;
    unit.sirenPhase += dt * 6;

    const sees = seesPlayer(unit, city, player, wanted);
    if (sees) {
      unit.state = 'CHASE';
      unit.lastSeen = { x: player.x, y: player.y };
      unit.lostTime = 0;
      wanted.seenTimer = 0;
      wanted.decayTimer = 0;
    } else {
      unit.lostTime += dt;
      if (unit.state === 'CHASE' && unit.lostTime > 0.5) unit.state = 'SEARCH';
    }

    // Hitung ulang rute tiap ~0,7 detik atau saat target berubah.
    unit.repathIn -= dt;
    if (tick % 3 === 0 && unit.repathIn <= 0) {
      unit.repathIn = 0.7;
      const from = city.nearestNode(car.x, car.y);
      let target;
      if (unit.state === 'CHASE') target = pickTargetNode(unit, city, player, wanted);
      else if (unit.state === 'SEARCH') target = city.nearestNode(unit.lastSeen.x, unit.lastSeen.y);
      else target = from; // RETURN: patroli di tempat, tidak mengejar lagi
      // Polisi boleh salah belok: 15% pilih node tetangga acak dari target.
      if (unit.state === 'CHASE' && target !== from) {
        const node = city.nodes[target];
        if (node.neighbors.length > 0 && unit.role !== 'chase') {
          const alt = node.neighbors[Math.floor(node.neighbors.length * 0.5)];
          if (alt) target = alt.to;
        }
      }
      const path = city.shortestPath(from, target);
      unit.route = path;
      unit.routeIndex = 0;
    }

    // Ikuti waypoint.
    let steer = 0;
    let gas = 1;
    if (unit.routeIndex < unit.route.length) {
      const node = city.nodes[unit.route[unit.routeIndex]];
      const dx = node.x - car.x;
      const dy = node.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        unit.routeIndex += 1;
      } else {
        const wantAngle = Math.atan2(dy, dx);
        let diff = wantAngle - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        steer = Math.max(-1, Math.min(1, diff * 2.4));
        // Di gang (bukan jalan utama) polisi melambat — tapi graph kami hanya jalan utama.
        if (Math.abs(diff) > 1.2) gas = 0.4;
      }
    } else if (unit.state === 'SEARCH') {
      // Menyisir sekitar posisi terakhir terlihat: putar pelan mencari.
      steer = 0.5;
      gas = 0.35;
      if (unit.lostTime > 10 + wanted.level * 2) unit.state = 'RETURN';
    } else {
      gas = 0;
    }

    // Menempel pemain saat sangat dekat (ramming) di mode CHASE.
    const distPlayer = Math.hypot(player.x - car.x, player.y - car.y);
    if (unit.state === 'CHASE' && distPlayer < 90) {
      const wantAngle = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      steer = Math.max(-1, Math.min(1, diff * 2.4));
      gas = 1;
    }

    driveCar(car, gas, 0, steer, false, dt);
    const fixed = city.resolveCircle(car.x, car.y, 17);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      car.x = fixed.x;
      car.y = fixed.y;
      car.speed *= 0.4;
    }

    // Macet: bila nyaris diam 2 detik, mundur sebentar lalu repath.
    if (Math.abs(car.speed) < 8) unit.stuckTime += dt;
    else unit.stuckTime = 0;
    if (unit.stuckTime > 2) {
      unit.stuckTime = 0;
      unit.repathIn = 0;
      car.angle += Math.PI / 2;
      car.speed = -30;
    }

    // ---- Aturan tertangkap (bukan sentuhan) ----
    const playerSpeed = Math.hypot(player.vx || 0, player.vy || 0);
    let arresting = false;
    if (wanted.level >= 1 && player.onFoot && distPlayer <= 28) arresting = true;
    if (wanted.level >= 2 && !player.onFoot && playerSpeed < 25 && distPlayer <= 65) {
      const near = units.filter((u) => Math.hypot(u.car.x - player.x, u.car.y - player.y) <= 65).length;
      if (near >= 2) arresting = true;
    }
    if (wanted.level >= 2 && !player.onFoot && playerSpeed < 15 && distPlayer <= 65) {
      const near = units.filter((u) => Math.hypot(u.car.x - player.x, u.car.y - player.y) <= 65).length;
      if (near >= 2) arresting = true;
    }
    if (arresting) unit.arrestTimer += dt;
    else unit.arrestTimer = Math.max(0, unit.arrestTimer - dt);
    if (unit.arrestTimer >= 1.2 && player.onFoot) return 'arrested';
    if (unit.arrestTimer >= 2.0 && !player.onFoot) return 'arrested';
  }

  // ---- Decay wanted saat tidak ada polisi yang melihat ----
  const anySees = units.some((u) => seesPlayer(u, city, player, wanted));
  if (wanted.level > 0 && !anySees) {
    wanted.decayTimer += dt;
    const need = WANTED.decaySeconds[wanted.level];
    if (wanted.decayTimer >= need) {
      wanted.level -= 1;
      wanted.decayTimer = 0;
      if (wanted.level === 0 && !wanted.escapedShown) {
        wanted.escapedShown = true;
        return 'escaped';
      }
    }
  }
  return null;
}
