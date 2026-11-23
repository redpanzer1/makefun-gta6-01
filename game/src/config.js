// KOTA SENJA: Jalanan Panas — semua angka tuning dan warna dalam satu tempat.
// Dunia top-down 2560x1920, kanvas logis 1280x720 yang diskalakan ke jendela.

export const WORLD = { width: 2560, height: 1920 };
export const VIEW = { width: 1280, height: 720 };

/** Langkah simulasi tetap: 60 update per detik apa pun laju tampilannya. */
export const STEP = 1 / 60;

export const PLAYER = {
  walkSpeed: 145,
  radius: 13,
  health: 100,
  startMoney: 500,
};

export const CARS = {
  kancil: { name: 'Kancil', topSpeed: 235, accel: 260, brake: 420, reverse: 95, turn: 2.7, color: '#e8b23a', roof: '#f5d76e', size: 1, radius: 17 },
  aruna: { name: 'Aruna', topSpeed: 215, accel: 240, brake: 400, reverse: 90, turn: 2.6, color: '#2fa8a0', roof: '#7fd4cc', size: 1, radius: 17 },
  patroli: { name: 'Patroli', topSpeed: 260, accel: 300, brake: 460, reverse: 100, turn: 2.9, color: '#27408b', roof: '#dfe6f5', size: 1, radius: 17 },
  bebek: { name: 'Bebek', topSpeed: 200, accel: 220, brake: 380, reverse: 85, turn: 2.4, color: '#7a9e4b', roof: '#a8c686', size: 1, radius: 17 },
  siul: { name: 'Siul', topSpeed: 275, accel: 330, brake: 500, reverse: 60, turn: 3.4, color: '#c94f6d', roof: '#e88aa5', size: 0.62, radius: 11 },
};

export const TRAFFIC_COUNT = 9;
export const PED_COUNT = 16;

/** Aturan wanted fase 2: level 1-5, decay saat tak terlihat. */
export const WANTED = {
  max: 5,
  decaySeconds: [0, 8, 12, 18, 24, 30],
  policeCount: [0, 1, 2, 3, 4, 5],
  vision: [0, 260, 320, 380, 420, 460],
  policeSpeed: [0, 225, 245, 260, 275, 290],
  detectSteal: 180,
  detectShot: 350,
  spawnMinDistance: 300,
};

export const MISSIONS = [
  { id: 1, name: 'Paket Terakhir', reward: 500 },
  { id: 2, name: 'Jalanan Membara', reward: 1000 },
  { id: 3, name: 'Diamankan di Klinik', reward: 1500 },
  { id: 4, name: 'Tagihan Bu Ratna', reward: 2000 },
  { id: 5, name: 'Jebakan di Pelabuhan', reward: 3000 },
  { id: 6, name: 'Jalan Pulang', reward: 5000 },
];

/** Titik-titik penting di peta (semua di jalan / area terbuka, bukan di dalam bangunan). */
export const PLACES = {
  warung: { x: 1050, y: 700, label: 'Warung Bu Ratna' },
  pelabuhan: { x: 340, y: 500, label: 'Dermaga Pelabuhan Tua' },
  targetCar: { x: 1760, y: 900, label: 'Sedan Kancil' },
  plazaPantai: { x: 2100, y: 1700, label: 'Plaza Jalan Pantai' },
  gudang: { x: 420, y: 980, label: 'Gudang Pelabuhan' },
  rumahAman: { x: 2020, y: 1520, label: 'Rumah Aman' },
  kantorPolisi: { x: 1300, y: 1180, label: 'Kantor Polisi' },
  pasar: { x: 1060, y: 920, label: 'Pasar Senja' },
  klinik: { x: 2260, y: 320, label: 'Klinik Senja' },
  // Tiga titik tagihan misi 4 — semua di jalan / area terbuka.
  tagihan: [
    { x: 820, y: 720, label: 'Tagihan 1 — Warung Kopi' },
    { x: 1780, y: 1120, label: 'Tagihan 2 — Bengkel Jaya' },
    { x: 1300, y: 1520, label: 'Tagihan 3 — Pasar Ikan' },
  ],
};

export const PALETTE = {
  backdrop: '#1a1026',
  ground: '#3d2b33',
  plaza: '#54402f',
  sand: '#c99a5b',
  sea: '#2b3a6e',
  harbor: '#24365e',
  road: '#2e2a33',
  roadEdge: '#4a3f45',
  lane: '#e8c96a',
  sidewalk: '#5a4a42',
  buildingRoof: '#6e3b2e',
  buildingRoof2: '#54423a',
  buildingRoof3: '#7a4a2b',
  buildingEdge: '#2a1a16',
  park: '#3f5a34',
  text: '#f5ead6',
  muted: '#c9b8a3',
  accent: '#ffb347',
  danger: '#ff5a4e',
  police: '#4f7cff',
  money: '#ffd94a',
  health: '#58d68d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'kota-senja.save.v1';
