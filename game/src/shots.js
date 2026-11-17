// Adegan screenshot deterministik ?shot=start|steal|chase|complete.
// Aturan emas: window.__shotReady hanya true SETELAH satu frame render penuh.
// Di mode shot: seed tetap per nama shot, posisi entitas hardcoded, fisika
// dimatikan (dt = 0), dan Math.random tidak pernah dipakai.

import { PLACES } from './config.js';
import { seedFromName } from './random.js';
import { makeCar } from './vehicles.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_COMPLETE } from './render.js';

export function shotSeed(name) {
  return seedFromName(`kota-senja-shot-${name}`);
}

/**
 * Siapkan `game` untuk shot bernama `name` dan kembalikan layar yang digambar.
 * Semua entitas diletakkan di posisi statis yang sudah dihitung — tidak ada
 * simulasi berjalan di mode ini.
 */
export function stageShot(name, game) {
  const g = game;
  g.shotMode = true;

  if (name === 'start') {
    // Title di atas Pasar Senja: kamera di tengah pasar, lalu lintas lewat.
    g.player.x = 1060;
    g.player.y = 920;
    g.player.onFoot = true;
    g.player.angle = 0;
    g.camera = { x: 1060 - 640, y: 920 - 360 };
    g.screen = SCREEN_TITLE;
    return SCREEN_TITLE;
  }

  if (name === 'steal') {
    // Bara jalan kaki persis di pintu pengemudi sedan Kancil; HUD + minimap penuh.
    const car = makeCar('kancil', 1780, 900, Math.PI / 2, 'target');
    g.cars.length = 0;
    g.cars.push(car);
    g.player.x = 1744;
    g.player.y = 900;
    g.player.angle = 0;
    g.player.onFoot = true;
    g.player.car = null;
    g.player.money = 1250;
    g.nearCarPrompt = 'Tekan E untuk mencuri sedan Kancil';
    g.mission.index = 1;
    g.mission.step = 0;
    g.mission.objective = { x: PLACES.targetCar.x, y: PLACES.targetCar.y, r: 60, label: 'Curi sedan Kancil di Jalan Pantai' };
    g.mission.dialog = { speaker: 'BU RATNA', text: 'Ambil sedan Kancil itu — tapi hati-hati polisi.', time: 99 };
    g.screen = SCREEN_PLAY;
    return SCREEN_PLAY;
  }

  if (name === 'chase') {
    // Bara mengemudi dikejar 2 mobil polisi, wanted 3, objektif kabur tampil.
    g.cars.length = 0;
    const playerCar = makeCar('kancil', 1300, 1120, 0, 'player');
    playerCar.speed = 200;
    g.cars.push(playerCar);
    g.player.car = playerCar;
    g.player.onFoot = false;
    g.player.x = 1300;
    g.player.y = 1120;
    g.player.vx = 200;
    g.player.vy = 0;
    g.player.money = 2300;
    const cop1 = makeCar('patroli', 1190, 1120, 0, 'police');
    cop1.speed = 210;
    const cop2 = makeCar('patroli', 1230, 1160, 0, 'police');
    cop2.speed = 205;
    g.police.length = 0;
    g.police.push({ car: cop1, state: 'CHASE', role: 'chase', lastSeen: { x: 1300, y: 1120 }, lostTime: 0, route: [], routeIndex: 0, repathIn: 0, stuckTime: 0, arrestTimer: 0, sirenPhase: 0 });
    g.police.push({ car: cop2, state: 'CHASE', role: 'cutoff', lastSeen: { x: 1300, y: 1120 }, lostTime: 0, route: [], routeIndex: 0, repathIn: 0, stuckTime: 0, arrestTimer: 0, sirenPhase: 1.5 });
    g.cars.push(cop1, cop2);
    g.wanted.level = 3;
    g.mission.index = 1;
    g.mission.step = 1;
    g.mission.objective = { x: PLACES.plazaPantai.x, y: PLACES.plazaPantai.y, r: 140, label: 'Kabur dari Kepungan!' };
    g.mission.dialog = null;
    g.screen = SCREEN_PLAY;
    return SCREEN_PLAY;
  }

  if (name === 'complete') {
    // Layar Mission Complete di atas Pelabuhan Tua, semua entitas pause.
    g.player.x = 340;
    g.player.y = 500;
    g.player.onFoot = true;
    g.player.money = 6750;
    g.camera = { x: 0, y: 140 };
    g.mission.index = 3;
    g.mission.dialog = null;
    g.mission.banner = null;
    g.mission.objective = { x: 0, y: 0, r: 0, label: '' };
    g.nearCarPrompt = '';
    g.completeText = 'Misi 3 selesai: "Bawa Dimas Pulang"';
    g.completeReward = 'Hadiah misi: +$5,000 — Dimas selamat sampai Rumah Aman';
    g.screen = SCREEN_COMPLETE;
    return SCREEN_COMPLETE;
  }

  return stageShot('start', game);
}
