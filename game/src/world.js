// Kota Senja: jalan grid, bangunan, distrik, road graph untuk AI, dan semua
// pertanyaan geometri (tabrakan, garis pandang, jalur terpendek). Tidak ada
// gambar dan tidak ada browser di sini — hanya data dan aturan.

import { WORLD } from './config.js';

// Sumbu jalan: vertikal (x) dan horizontal (y). Lebar jalan 120.
export const ROAD_X = [340, 820, 1300, 1780, 2260];
export const ROAD_Y = [320, 720, 1120, 1520, 1700];
export const ROAD_W = 120;
export const HARBOR_X = 140; // air pelabuhan di barat x < 140
export const SEA_Y = 1840; // laut di selatan y > 1840
export const SAND_Y = 1760; // pasir pantai 1760..1840

const SHOP_NAMES = [
  'WARUNG KOPI', 'TOKO KELONTONG', 'BENGKEL JAYA', 'APOTEK SEHAT', 'TOKO BUAH',
  'WARUNG NASI', 'TOKO PULSA', 'LAUNDRY KILAT', 'TOKO BATIK', 'WARUNG SATE',
  'TOKO ELEKTRONIK', 'FOTOKOPI 24 JAM', 'WARUNG TEH', 'TOKO MAINAN', 'SALON CANTIK',
  'TOKO SEPEDA', 'WARUNG GORENGAN', 'TOKO EMAS', 'KEDAI MIE', 'TOKO BANGUNAN',
];

function segmentHitsRect(x1, y1, x2, y2, r) {
  // Uji potong ruas garis dengan persegi (uji slab): true bila garis menyentuh bangunan.
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const stalls = [];
  const lamps = [];

  // Blok di antara jalan: x dari tepi jalan ke tepi jalan berikutnya.
  const blockX = [[HARBOR_X, 280], [400, 760], [880, 1240], [1360, 1720], [1840, 2200], [2320, WORLD.width]];
  const blockY = [[0, 260], [380, 660], [780, 1060], [1180, 1460]];

  function addBuilding(x, y, w, h, name, roof, special) {
    buildings.push({ x, y, w, h, name: name || '', roof: roof || 0, special: special || '' });
  }

  // Bangunan istimewa dengan posisi tetap (dipakai misi & cerita).
  addBuilding(900, 400, 280, 220, 'WARUNG BU RATNA', 2, 'warung');
  addBuilding(1400, 820, 280, 200, 'KANTOR POLISI', 1, 'polisi');
  addBuilding(420, 800, 320, 100, 'GUDANG PELABUHAN', 0, 'gudang');
  addBuilding(1400, 400, 280, 220, 'MASJID AL-SENJA', 1, 'masjid');
  addBuilding(1880, 820, 280, 200, 'BENGKEL JAYA', 0, 'bengkel');
  addBuilding(1880, 1220, 280, 200, 'RUMAH AMAN', 2, 'rumah');
  addBuilding(2360, 400, 180, 200, 'WARUNG PANTAI', 2, 'warungPantai');
  addBuilding(420, 1220, 280, 200, 'PASAR IKAN', 0, 'pasarIkan');

  // Isi blok lain dengan bangunan acak berseed; blok pasar (880..1240, 780..1060)
  // dibiarkan terbuka sebagai alun-alun Pasar Senja dengan lapak-lapak.
  let shopIndex = 0;
  for (let bx = 0; bx < blockX.length; bx += 1) {
    for (let by = 0; by < blockY.length; by += 1) {
      const [x0, x1] = blockX[bx];
      const [y0, y1] = blockY[by];
      const isMarket = bx === 2 && by === 2;
      const isWarehouseYard = bx === 1 && by === 2; // halaman gudang: terbuka
      if (isMarket) {
        for (let s = 0; s < 10; s += 1) {
          stalls.push({
            x: x0 + 30 + random() * (x1 - x0 - 90),
            y: y0 + 30 + random() * (y1 - y0 - 90),
            kind: Math.floor(random() * 3),
          });
        }
        continue;
      }
      if (isWarehouseYard) continue; // halaman terbuka untuk misi 3
      // Satu atau dua bangunan per blok, dengan gang di antaranya.
      const split = random() < 0.5;
      if (split) {
        const mid = x0 + (x1 - x0) * (0.45 + random() * 0.1);
        addBuilding(x0 + 12, y0 + 12, mid - x0 - 24, y1 - y0 - 24, SHOP_NAMES[shopIndex % SHOP_NAMES.length], Math.floor(random() * 3));
        shopIndex += 1;
        addBuilding(mid + 12, y0 + 12, x1 - mid - 24, y1 - y0 - 24, SHOP_NAMES[shopIndex % SHOP_NAMES.length], Math.floor(random() * 3));
        shopIndex += 1;
      } else {
        addBuilding(x0 + 14, y0 + 14, x1 - x0 - 28, y1 - y0 - 28, SHOP_NAMES[shopIndex % SHOP_NAMES.length], Math.floor(random() * 3));
        shopIndex += 1;
      }
    }
  }

  // Pohon di trotoar dan taman kecil, plus lampu jalan di persimpangan.
  for (let i = 0; i < 90; i += 1) {
    const x = 160 + random() * (WORLD.width - 320);
    const y = 40 + random() * (WORLD.height - 240);
    if (onRoad(x, y)) continue;
    if (insideBuilding(x, y)) continue;
    trees.push({ x, y, r: 10 + random() * 8 });
  }
  for (const nx of ROAD_X) {
    for (const ny of ROAD_Y) lamps.push({ x: nx + 70, y: ny - 70 });
  }

  function insideBuilding(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
    return false;
  }

  function onRoad(x, y) {
    for (const rx of ROAD_X) if (Math.abs(x - rx) < ROAD_W / 2 + 14) return true;
    for (const ry of ROAD_Y) if (Math.abs(y - ry) < ROAD_W / 2 + 14) return true;
    return false;
  }

  // ---- Road graph: node = persimpangan, edge = ruas jalan ----
  const nodes = [];
  const nodeByKey = new Map();
  for (const ny of ROAD_Y) {
    for (const nx of ROAD_X) {
      const id = nodes.length;
      const roadType = ny === 1700 ? 'coastal' : 'main';
      nodes.push({ id, x: nx, y: ny, roadType, neighbors: [] });
      nodeByKey.set(`${nx},${ny}`, id);
    }
  }
  function link(a, b, weight) {
    nodes[a].neighbors.push({ to: b, weight });
    nodes[b].neighbors.push({ to: a, weight });
  }
  for (let row = 0; row < ROAD_Y.length; row += 1) {
    for (let col = 0; col < ROAD_X.length; col += 1) {
      const id = row * ROAD_X.length + col;
      if (col + 1 < ROAD_X.length) {
        const w = ROAD_Y[row] === 1700 ? 1.15 : 1.0;
        link(id, id + 1, w);
      }
      if (row + 1 < ROAD_Y.length) link(id, id + ROAD_X.length, 1.0);
    }
  }

  /** Jalur terpendek Dijkstra dari node `from` ke node `to`; daftar id node. */
  function shortestPath(from, to) {
    if (from === to) return [from];
    const dist = new Array(nodes.length).fill(Infinity);
    const prev = new Array(nodes.length).fill(-1);
    const done = new Array(nodes.length).fill(false);
    dist[from] = 0;
    for (let iter = 0; iter < nodes.length; iter += 1) {
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < nodes.length; i += 1) {
        if (!done[i] && dist[i] < bestDist) { bestDist = dist[i]; best = i; }
      }
      if (best === -1) break;
      if (best === to) break;
      done[best] = true;
      for (const edge of nodes[best].neighbors) {
        const nd = dist[best] + edge.weight;
        if (nd < dist[edge.to]) { dist[edge.to] = nd; prev[edge.to] = best; }
      }
    }
    if (prev[to] === -1 && from !== to) return [to];
    const path = [];
    let cur = to;
    while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
    return path;
  }

  function nearestNode(x, y) {
    let best = 0;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  }

  /** True bila garis pandang bersih dari bangunan (dipakai AI polisi). */
  function hasLineOfSight(x1, y1, x2, y2) {
    for (const b of buildings) {
      if (segmentHitsRect(x1, y1, x2, y2, b)) return false;
    }
    return true;
  }

  /** Dorong lingkaran (x, y, r) keluar dari bangunan & air & tepi dunia. Mengembalikan posisi baru. */
  function resolveCircle(x, y, r) {
    let nx = x;
    let ny = y;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
      const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
      const dx = nx - cx;
      const dy = ny - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) { ny = b.y - r; continue; }
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      }
    }
    if (nx < HARBOR_X + r) nx = HARBOR_X + r;
    if (ny > SEA_Y - r) ny = SEA_Y - r;
    if (nx > WORLD.width - r) nx = WORLD.width - r;
    if (ny < r) ny = r;
    if (nx < r) nx = r;
    return { x: nx, y: ny };
  }

  /** True bila titik berada di air (pelabuhan / laut) — tidak bisa dilewati. */
  function inWater(x, y) {
    return x < HARBOR_X || y > SEA_Y;
  }

  /** Nama distrik untuk posisi — dipakai HUD dan dialog. */
  function districtAt(x, y) {
    if (y >= 1580) return 'Jalan Pantai';
    if (x < 700) return 'Pelabuhan Tua';
    if (x >= 700 && x < 1900) return 'Pasar Senja';
    return 'Jalan Pantai';
  }

  return {
    buildings, trees, stalls, lamps, nodes,
    shortestPath, nearestNode, hasLineOfSight, resolveCircle, inWater, districtAt, onRoad,
  };
}
