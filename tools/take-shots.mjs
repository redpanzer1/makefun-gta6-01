// Ambil 4 screenshot asli Kota Senja dengan Playwright + Chromium.
// Jalankan dari root repo saat serve.ts sudah jalan di port 8080:
//   node tools/take-shots.mjs
// Menunggu window.__shotReady di tiap shot, simpan JPEG quality 85.
import { chromium } from 'playwright';
import { mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const outDir = join(repo, 'screenshots');
const BASE = process.env.GAME_URL || 'http://localhost:8080';

const SHOTS = [
  { name: '1-start.jpg', query: '?shot=start&seed=1' },
  { name: '2-steal.jpg', query: '?shot=steal&seed=1' },
  { name: '3-chase.jpg', query: '?shot=chase&seed=1' },
  { name: '4-complete.jpg', query: '?shot=complete&seed=1' },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

for (const shot of SHOTS) {
  await page.goto(`${BASE}/${shot.query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  await page.waitForTimeout(150);
  const file = join(outDir, shot.name);
  await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
  const size = statSync(file).size;
  console.log(`${shot.name}: ${size} byte${size > 262144 ? '  !! OVER 256 KiB' : ''}`);
}

await browser.close();
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
console.log('files:', readdirSync(outDir).join(', '));
