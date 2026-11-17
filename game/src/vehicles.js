// Kendaraan: fisika arcade (gas, rem, setir, selip), lalu lintas yang mengikuti
// road graph, dan aturan curi mobil. Satu mobil = satu objek dengan posisi,
// sudut, kecepatan sepanjang badan, dan peran (pemain / lalu lintas / polisi / parkir).

import { CARS, TRAFFIC_COUNT } from './config.js';

let nextCarId = 1;

export function makeCar(kind, x, y, angle, role) {
  const spec = CARS[kind];
  return {
    id: nextCarId,
    kind,
    name: spec.name,
    x, y, angle,
    speed: 0,
    role, // 'player' | 'traffic' | 'police' | 'parked' | 'target'
    color: spec.color,
    roof: spec.roof,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    brake: spec.brake,
    reverse: spec.reverse,
    turn: spec.turn,
    route: [],
    routeIndex: 0,
    wait: 0,
    driver: role === 'traffic',
    crashed: 0,
  };
}

/** Satu langkah fisika arcade untuk mobil yang dikemudikan. */
export function driveCar(car, gas, brake, steer, handbrake, dt) {
  const spec = car;
  if (gas > 0) car.speed += spec.accel * dt;
  if (brake > 0) {
    if (car.speed > 5) car.speed -= spec.brake * dt;
    else car.speed -= spec.accel * 0.6 * dt; // mundur
  }
  if (!gas && !brake) car.speed -= Math.sign(car.speed) * 60 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 500 * dt;
  if (Math.abs(car.speed) < 4 && !gas && !brake) car.speed = 0;
  if (car.speed > spec.topSpeed) car.speed = spec.topSpeed;
  if (car.speed < -spec.reverse) car.speed = -spec.reverse;

  const speedFactor = Math.min(1, Math.abs(car.speed) / 90);
  const grip = handbrake ? 0.55 : 1;
  car.angle += steer * car.turn * speedFactor * grip * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/** Tabrakan lingkaran antar mobil: dorong berpisah, kurangi kecepatan. */
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = 36;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        a.speed *= 0.92;
        b.speed *= 0.92;
        a.crashed = 0.25;
        b.crashed = 0.25;
      }
    }
  }
}

/**
 * Lalu lintas: tiap mobil mengikuti rute node demi node. Di persimpangan ia
 * memilih node tujuan baru secara acak. Berhenti sebentar bila mobil di depan
 * terlalu dekat, supaya tidak menumpuk.
 */
export function updateTraffic(car, city, cars, random, dt) {
  if (car.wait > 0) {
    car.wait -= dt;
    car.speed = Math.max(0, car.speed - 300 * dt);
    return;
  }
  if (car.routeIndex >= car.route.length) {
    const from = city.nearestNode(car.x, car.y);
    let to = Math.floor(random() * city.nodes.length);
    if (to === from) to = (to + 7) % city.nodes.length;
    car.route = city.shortestPath(from, to);
    car.routeIndex = 0;
  }
  const node = city.nodes[car.route[car.routeIndex]];
  const dx = node.x - car.x;
  const dy = node.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    car.routeIndex += 1;
    return;
  }
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Mobil di depan? pelan.
  let aheadClear = true;
  for (const other of cars) {
    if (other === car) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const along = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (along > 0 && along < 70 && side < 26) { aheadClear = false; break; }
  }
  const cruise = 120 + (car.id % 3) * 12;
  if (!aheadClear) {
    car.speed = Math.max(0, car.speed - 320 * dt);
  } else if (car.speed < cruise) {
    car.speed += 170 * dt;
  } else if (car.speed > cruise) {
    car.speed -= 120 * dt;
  }
  driveCar(car, 0, 0, steer, false, dt);
  // Koreksi kecil supaya mobil lalu lintas tetap di jalan, bukan menabrak toko.
  const fixed = city.resolveCircle(car.x, car.y, 17);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    car.x = fixed.x;
    car.y = fixed.y;
    car.speed *= 0.5;
    car.routeIndex += 1; // lewati waypoint yang macet
  }
}

/** Spawn lalu lintas + mobil parkir di jalan-jalan kota. */
export function spawnCityCars(city, random) {
  const cars = [];
  const kinds = ['kancil', 'aruna', 'kancil', 'aruna'];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const node = city.nodes[Math.floor(random() * city.nodes.length)];
    const jitterX = (random() - 0.5) * 60;
    const jitterY = (random() - 0.5) * 60;
    const car = makeCar(kinds[i % kinds.length], node.x + jitterX, node.y + jitterY, random() * Math.PI * 2, 'traffic');
    cars.push(car);
  }
  // Mobil parkir di tepi jalan (bisa dicuri).
  const parkedSpots = [
    { kind: 'kancil', x: 760, y: 330 }, { kind: 'aruna', x: 1360, y: 730 },
    { kind: 'kancil', x: 1840, y: 1130 }, { kind: 'aruna', x: 2200, y: 1530 },
    { kind: 'kancil', x: 340, y: 1130 }, { kind: 'aruna', x: 820, y: 1530 },
  ];
  for (const spot of parkedSpots) {
    const car = makeCar(spot.kind, spot.x, spot.y, Math.PI / 2, 'parked');
    car.driver = false;
    cars.push(car);
  }
  return cars;
}

/** Mobil terdekat dari (x, y) dalam radius — dipakai untuk masuk/curi mobil. */
export function nearestCar(cars, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const car of cars) {
    if (car.role === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
