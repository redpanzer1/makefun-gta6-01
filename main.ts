// Program entri gta6-01 "Kota Senja: Jalanan Panas" (Node 22, pustaka standar saja).
// Game-nya adalah folder game/ di sebelah file ini: file statis yang dimuat
// browser secara offline (game/index.html + modul ES-nya, tanpa library dan
// tanpa network request). Program ini menyerahkan game itu: menyalin game/ dan
// screenshots/ dari repo ke /output lalu menulis /output/dossier.json, ringkasan
// yang dibaca juri, dengan library make.fun yang divendor.
//
// Di luar container grader, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Mainkan dulu secara lokal dengan `node serve.ts`, lalu buka http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Batas-batas scorer sendiri (reference/gate.json): hanya text_max_bytes yang
// membentuk byte dossier; sisanya menolak entri yang scorer akan tolak
// (lebih dari 4 screenshot atau satu di atas 256 KiB; lebih dari 993 file di
// game/ atau 48 MiB file game, atau path di bawah game/ di atas 1000 byte:
// game/ dihitung bersama batas 1000 entri /output, screenshot-nya dan dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
