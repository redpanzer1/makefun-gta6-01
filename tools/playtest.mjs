// Play-test otomatis Kota Senja: mainkan misi 1-3 sampai layar kemenangan
// dengan autopilot keyboard (baca state lewat window.__kotaSenja, setir
// mengikuti road graph). Jalankan saat serve.ts jalan di port 8080:
//   node tools/playtest.mjs
// Keluar 0 bila layar victory tercapai tanpa error JS; 1 bila gagal/timeout.
import { chromium } from 'playwright';

const BASE = process.env.GAME_URL || 'http://localhost:8080';
const TIMEOUT_MS = 300000;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

await page.goto(`${BASE}/?seed=7`, { waitUntil: 'load' });
await page.waitForTimeout(800);

const held = new Set();
async function setKeys(want) {
  for (const key of [...held]) {
    if (!want.has(key)) { await page.keyboard.up(key); held.delete(key); }
  }
  for (const key of want) {
    if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
  }
}
async function releaseAll() { await setKeys(new Set()); }

function readState() {
  return page.evaluate(() => {
    const g = window.__kotaSenja;
    if (!g) return null;
    const p = g.player;
    const m = g.mission;
    // Waypoint: node terdekat -> Dijkstra -> node tujuan, lalu titik objektif.
    const from = g.city.nearestNode(p.x, p.y);
    const to = g.city.nearestNode(m.objective.x, m.objective.y);
    const path = g.city.shortestPath(from, to).map((id) => ({ x: g.city.nodes[id].x, y: g.city.nodes[id].y }));
    path.push({ x: m.objective.x, y: m.objective.y });
    return {
      screen: g.screen,
      px: p.x, py: p.y, angle: p.angle, onFoot: p.onFoot,
      carSpeed: p.car ? p.car.speed : 0,
      carAngle: p.car ? p.car.angle : 0,
      health: p.health, money: p.money, ammo: p.ammo, hasPistol: p.hasPistol,
      mission: m.index, step: m.step, timer: m.timer,
      objX: m.objective.x, objY: m.objective.y, objR: m.objective.r,
      wanted: g.wanted.level,
      thugs: g.thugs.map((t) => ({ x: t.x, y: t.y, alive: t.alive })),
      camX: g.camera.x, camY: g.camera.y,
      path,
    };
  });
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const start = Date.now();
let lastLog = 0;
let lastPos = null;
let stuckSince = 0;
let reversingUntil = 0;
let victory = false;
let shotFiredAt = 0;
// Waypoint yang di-cache per objektif: indeks hanya maju, tidak pernah mundur,
// supaya autopilot tidak berosilasi di node yang baru saja dilewati.
let cachedKey = '';
let cachedPath = [];
let wpIndex = 0;

async function getPath(s) {
  const key = `${s.mission}:${s.step}:${s.objX},${s.objY}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedPath = s.path;
    wpIndex = 0;
  }
  return cachedPath;
}

while (Date.now() - start < TIMEOUT_MS) {
  const s = await readState();
  if (!s) throw new Error('window.__kotaSenja tidak ada');
  const now = Date.now();

  if (now - lastLog > 5000) {
    lastLog = now;
    console.log(`[${Math.round((now - start) / 1000)}s] screen=${s.screen} misi=${s.mission + 1} step=${s.step} pos=(${Math.round(s.px)},${Math.round(s.py)}) wanted=${s.wanted} hp=${Math.round(s.health)} uang=$${s.money} timer=${Math.ceil(s.timer)}`);
  }

  if (s.screen === 'victory') { victory = true; break; }
  if (s.screen === 'title') { await releaseAll(); await page.keyboard.press('Enter'); await page.waitForTimeout(400); continue; }
  if (s.screen === 'over') { await releaseAll(); await page.keyboard.press('Enter'); await page.waitForTimeout(500); continue; }
  if (s.screen === 'paused') { await page.keyboard.press('KeyP'); await page.waitForTimeout(300); continue; }
  if (s.screen !== 'play') { await page.waitForTimeout(300); continue; }

  // Misi 3, baku tembak: tembak tiap preman hidup satu per satu.
  const aliveThugs = s.thugs.filter((t) => t.alive);
  if (s.mission === 2 && s.step === 1 && aliveThugs.length > 0) {
    if (s.onFoot === false) { await releaseAll(); await page.keyboard.press('KeyE'); await page.waitForTimeout(400); continue; }
    const t = aliveThugs[0];
    const sx = Math.round(t.x - s.camX);
    const sy = Math.round(t.y - s.camY);
    // Dekati bila terlalu jauh untuk bidikan (di luar 320 px).
    const d = Math.hypot(t.x - s.px, t.y - s.py);
    if (d > 300) {
      const keys = new Set();
      if (t.y - s.py < -12) keys.add('KeyW');
      if (t.y - s.py > 12) keys.add('KeyS');
      if (t.x - s.px < -12) keys.add('KeyA');
      if (t.x - s.px > 12) keys.add('KeyD');
      await setKeys(keys);
      await page.waitForTimeout(150);
      continue;
    }
    await releaseAll();
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // Tahan tembakan sampai preman ini mati / 2,5 detik.
    const fireStart = Date.now();
    let dead = false;
    while (Date.now() - fireStart < 2500) {
      const s2 = await readState();
      const still = s2.thugs.find((x) => Math.abs(x.x - t.x) < 2 && Math.abs(x.y - t.y) < 2);
      if (!still || !still.alive) { dead = true; break; }
      await page.mouse.move(Math.round(still.x - s2.camX), Math.round(still.y - s2.camY));
      await page.waitForTimeout(150);
    }
    await page.mouse.up();
    shotFiredAt = now;
    if (!dead) console.log('  (preman belum mati, coba lagi)');
    await page.waitForTimeout(200);
    continue;
  }

  // Curi mobil misi 2: tekan E saat dekat sedan target.
  const distObj = Math.hypot(s.objX - s.px, s.objY - s.py);
  if (s.mission === 1 && s.step === 0 && s.onFoot && distObj < 55) {
    await releaseAll();
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    continue;
  }

  // Navigasi via waypoint road graph (cache per objektif, indeks hanya maju).
  const path = await getPath(s);
  while (wpIndex < path.length && Math.hypot(path[wpIndex].x - s.px, path[wpIndex].y - s.py) < 46) wpIndex += 1;
  const target = wpIndex < path.length ? path[wpIndex] : { x: s.objX, y: s.objY };
  const dx = target.x - s.px;
  const dy = target.y - s.py;
  const dist = Math.hypot(dx, dy);

  // Deteksi macet.
  if (lastPos && Math.hypot(s.px - lastPos.x, s.py - lastPos.y) < 3) {
    if (!stuckSince) stuckSince = now;
  } else stuckSince = 0;
  lastPos = { x: s.px, y: s.py };

  if (s.onFoot) {
    const keys = new Set();
    if (dy < -12) keys.add('KeyW');
    if (dy > 12) keys.add('KeyS');
    if (dx < -12) keys.add('KeyA');
    if (dx > 12) keys.add('KeyD');
    await setKeys(keys);
  } else {
    // Mengemudi: setir ke arah waypoint.
    const wantAngle = Math.atan2(dy, dx);
    const diff = normAngle(wantAngle - s.carAngle);
    const keys = new Set();
    if (now < reversingUntil) {
      keys.add('KeyS');
      if (diff > 0) keys.add('KeyA'); else keys.add('KeyD');
    } else {
      if (Math.abs(diff) < 1.25) keys.add('KeyW');
      if (diff > 0.18) keys.add('KeyD');
      if (diff < -0.18) keys.add('KeyA');
      if (Math.abs(diff) > 2.4) keys.add('KeyS'); // putar balik
    }
    if (stuckSince && now - stuckSince > 1500 && now >= reversingUntil) {
      reversingUntil = now + 800;
      stuckSince = 0;
    }
    await setKeys(keys);
  }
  await page.waitForTimeout(150);
}

await releaseAll();
const final = await readState();
console.log('FINAL screen=', final?.screen, 'misi=', (final?.mission ?? -1) + 1, 'uang=$' + final?.money, 'hp=', Math.round(final?.health ?? 0));
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
if (!victory) { console.log('PLAYTEST GAGAL: victory tidak tercapai'); process.exit(1); }
if (errors.length) { console.log('PLAYTEST: victory tercapai TAPI ada error JS'); process.exit(2); }
console.log('PLAYTEST LOLOS: misi 1-3 selesai sampai layar kemenangan, tanpa error JS.');
