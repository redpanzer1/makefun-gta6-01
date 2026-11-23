// Boot + loop utama Kota Senja. Input dibaca tiap frame, dunia maju dalam langkah
// tetap 1/60 detik, renderer menggambar apa yang ada. Layar: title, play, paused,
// help, over, victory, complete.
//
// ?seed=N menetapkan seed dunia. ?shot=start|steal|chase|complete (dengan &seed=N)
// men-stage adegan itu, menggambarnya dua kali, lalu menyalakan window.__shotReady.
import { STEP, PLAYER, PLACES, SAVE_KEY } from './config.js';
import { createRandom, seedFromName } from './random.js';
import { createCity } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_SHOOT, ACTION_PUNCH } from './input.js';
import { createWanted, syncPolice, updatePolice, clearWanted, syncFootPolice, updateFootPolice } from './police.js';
import { createMissionState, startMission, updateMissions, restartMission, onCarStolen } from './missions.js';
import { makeCar, driveCar, separateCars, updateTraffic, spawnCityCars, nearestCar } from './vehicles.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_HELP, SCREEN_OVER, SCREEN_VICTORY, SCREEN_COMPLETE } from './render.js';
import { playerShoot, playerPunch, updateBullets, updateThugs, spawnPeds, updatePeds, checkPedHits, hurtPlayer } from './combat.js';
import { stageShot, shotSeed } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam)
  ? seedParam
  : (shot ? shotSeed(shot) : (Date.now() % 2147483647));

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const audio = createAudio();
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.mission !== 'number' || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function createGame() {
  const cars = spawnCityCars(city, random);
  // Sedan target misi 2: parkir di Jalan Pantai, ditandai sebagai target.
  const targetCar = makeCar('kancil', PLACES.targetCar.x, PLACES.targetCar.y, Math.PI / 2, 'target');
  targetCar.driver = false;
  cars.push(targetCar);

  const game = {
    city,
    random,
    audio,
    time: 0,
    tick: 0,
    screen: SCREEN_TITLE,
    shotMode: false,
    cars,
    peds: spawnPeds(city, random),
    police: [],
    footPolice: [],
    wanted: createWanted(),
    mission: createMissionState(),
    thugs: [],
    dimas: { x: PLACES.gudang.x + 60, y: PLACES.gudang.y + 20, angle: 0, freed: false, following: false },
    bullets: [],
    particles: [],
    popups: [],
    events: { stoleTargetCar: false, shotFired: false },
    shake: 0,
    camera: { x: 0, y: 0 },
    hasSave: !!readSave(),
    overTitle: '',
    overLines: [],
    overResume: null,
    completeText: '',
    completeReward: '',
    nearCarPrompt: '',
    player: {
      x: PLACES.warung.x, y: PLACES.warung.y + 40, angle: -Math.PI / 2,
      vx: 0, vy: 0, onFoot: true, health: PLAYER.health,
      money: PLAYER.startMoney, car: null, hasPistol: false, ammo: 0, shootCooldown: 0, punchCooldown: 0, invuln: 0,
    },
  };
  game.spawnThugs = () => {
    const spots = [
      { x: 380, y: 940 }, { x: 470, y: 1010 }, { x: 560, y: 950 },
    ];
    for (const s of spots) {
      game.thugs.push({ x: s.x, y: s.y, health: 100, alive: true, shootTimer: 1 + random() * 1.5, angle: 0 });
    }
  };
  game.save = () => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        mission: Math.min(game.mission.index, 5),
        money: game.player.money,
        health: game.player.health,
      }));
      game.hasSave = true;
    } catch {
      // Penyimpanan bisa mati (jendela privat): progres hanya bertahan kunjungan ini.
    }
  };
  game.nearestPoliceDistance = () => {
    let best = Infinity;
    for (const u of game.police) {
      const d = Math.hypot(u.car.x - game.player.x, u.car.y - game.player.y);
      if (d < best) best = d;
    }
    return best;
  };
  return game;
}

const game = createGame();
window.__kotaSenja = game; // pegangan debug untuk play-test otomatis (bukan bagian gameplay).
startMission(game, 0);

function announce(message) {
  status.textContent = message;
}

function resetRun(fromSave) {
  const save = fromSave ? readSave() : null;
  game.player.x = PLACES.warung.x;
  game.player.y = PLACES.warung.y + 40;
  game.player.angle = -Math.PI / 2;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.onFoot = true;
  game.player.car = null;
  game.player.health = PLAYER.health;
  game.player.hasPistol = false;
  game.player.ammo = 0;
  game.player.punchCooldown = 0;
  game.player.money = save ? save.money : PLAYER.startMoney;
  game.bullets.length = 0;
  game.particles.length = 0;
  game.popups.length = 0;
  game.thugs.length = 0;
  game.police.length = 0;
  game.footPolice.length = 0;
  game.dimas.freed = false;
  game.dimas.following = false;
  game.dimas.x = PLACES.gudang.x + 60;
  game.dimas.y = PLACES.gudang.y + 20;
  clearWanted(game.wanted);
  game.overResume = null;
  game.mission = createMissionState();
  startMission(game, save ? Math.min(save.mission, 5) : 0);
  game.screen = SCREEN_PLAY;
  announce(`Bermain. Misi ${game.mission.index + 1}: ${game.mission.objective.label}.`);
}

function arrestPlayer() {
  const p = game.player;
  const lost = Math.max(100, Math.floor(p.money * 0.25));
  p.money -= lost;
  clearWanted(game.wanted);
  game.police.length = 0;
  game.footPolice.length = 0;
  if (p.car) {
    p.car.role = p.car.role === 'target' ? 'target' : 'parked';
    p.car.speed = 0;
    p.car = null;
  }
  p.onFoot = true;
  p.x = PLACES.kantorPolisi.x;
  p.y = PLACES.kantorPolisi.y;
  p.health = PLAYER.health;
  game.overTitle = 'DITAHAN POLISI';
  game.overLines = [
    `Bara ditahan. Uang dipotong $${lost.toLocaleString('en-US')} (25%).`,
    'Bara dibebaskan di Kantor Polisi — misi diulang dari awal.',
  ];
  game.overResume = 'arrest';
  game.screen = SCREEN_OVER;
  audio.gameOver();
  restartMission(game);
  announce('Ditahan polisi. Uang dipotong. Misi diulang.');
}

function updateCamera() {
  const p = game.player;
  let x = p.x - 640;
  let y = p.y - 360;
  x = Math.max(0, Math.min(2560 - 1280, x));
  y = Math.max(0, Math.min(1920 - 720, y));
  game.camera.x = x;
  game.camera.y = y;
}

function stepPlay(input, dt) {
  const p = game.player;
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    game.popups.push({ x: p.x, y: p.y - 30, text: muted ? 'SUARA MATI' : 'SUARA HIDUP', life: 1.2, color: '#fff' });
  }
  if (actions & ACTION_PAUSE) {
    game.screen = SCREEN_PAUSED;
    announce('Jeda.');
    return;
  }

  // --- Gerak pemain: jalan kaki atau mengemudi ---
  const move = input.move();
  if (p.onFoot) {
    const len = Math.hypot(move.x, move.y) || 1;
    const speed = PLAYER.walkSpeed;
    p.vx = (move.x / len) * speed * (move.x || move.y ? 1 : 0);
    p.vy = (move.y / len) * speed * (move.x || move.y ? 1 : 0);
    if (move.x || move.y) p.angle = Math.atan2(move.y, move.x);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const fixed = city.resolveCircle(p.x, p.y, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    // Petunjuk masuk mobil terdekat.
    const near = nearestCar(game.cars, p.x, p.y, 46);
    game.nearCarPrompt = near ? `Tekan E — ${near.role === 'target' ? 'curi' : 'naik'} ${near.name}` : '';
    if ((actions & ACTION_ENTER_CAR) && near) enterCar(near);
    // Tembak ke arah kursor.
    if ((actions & ACTION_SHOOT) || input.mouse().down) {
      const mouse = input.mouse();
      const wx = mouse.x + game.camera.x;
      const wy = mouse.y + game.camera.y;
      if (playerShoot(game, wx, wy)) game.events.shotFired = true;
    }
    // Tinju (F): pukulan jarak dekat ke preman.
    if (actions & ACTION_PUNCH) playerPunch(game);
  } else if (p.car) {
    const drive = input.drive();
    driveCar(p.car, drive.gas, drive.brake, drive.steer, input.handbrake(), dt);
    const fixed = city.resolveCircle(p.car.x, p.car.y, p.car.radius || 17);
    if (fixed.x !== p.car.x || fixed.y !== p.car.y) {
      if (Math.abs(p.car.speed) > 120) {
        game.shake = Math.max(game.shake, 7);
        audio.hit();
        game.particles.push({ x: p.car.x, y: p.car.y, vx: 0, vy: 0, life: 0.5, color: '#ffb347', size: 8 });
      }
      p.car.x = fixed.x;
      p.car.y = fixed.y;
      p.car.speed *= 0.45;
    }
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.vx = Math.cos(p.car.angle) * p.car.speed;
    p.vy = Math.sin(p.car.angle) * p.car.speed;
    game.nearCarPrompt = 'Tekan E — keluar dari mobil';
    if (actions & ACTION_ENTER_CAR) exitCar();
  }

  // --- Lalu lintas & pejalan kaki ---
  for (const car of game.cars) {
    if (car.role === 'traffic') updateTraffic(car, city, game.cars, random, dt);
  }
  separateCars(game.cars);
  updatePeds(game, dt);
  checkPedHits(game);

  // --- Polisi & wanted ---
  syncPolice(game.police, city, random, p, game.wanted);
  const policeResult = updatePolice(game.police, city, p, game.wanted, dt, game.tick);
  if (policeResult === 'arrested') arrestPlayer();
  else if (policeResult === 'escaped') {
    game.mission.banner = { text: 'LOLOS!', sub: 'Polisi kehilangan jejak. WANTED HILANG · KOTA SENJA', time: 3 };
  }
  // Polisi jalan kaki (fase 2): hanya saat pemain jalan kaki & wanted >= 2.
  syncFootPolice(game.footPolice, city, random, p, game.wanted);
  if (updateFootPolice(game.footPolice, city, p, dt) === 'arrested') arrestPlayer();

  // --- Combat & misi ---
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  updateBullets(game, dt);
  updateThugs(game, dt);
  updateMissions(game, dt);
  game.events.shotFired = false;

  // --- Dimas mengikuti pemain setelah dibebaskan ---
  if (game.dimas.following) {
    const d = game.dimas;
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    // Anti-frustrasi escort: bila Dimas tertinggal jauh (pemain naik mobil),
    // ia "mengejar" dan muncul di dekat pemain — escort tidak pernah macet.
    if (dist > 420) {
      d.x = p.x - Math.cos(p.angle) * 40;
      d.y = p.y - Math.sin(p.angle) * 40;
      const fixed = city.resolveCircle(d.x, d.y, 11);
      d.x = fixed.x;
      d.y = fixed.y;
    } else if (dist > 70) {
      const ang = Math.atan2(p.y - d.y, p.x - d.x);
      d.angle = ang;
      d.x += Math.cos(ang) * 135 * dt;
      d.y += Math.sin(ang) * 135 * dt;
      const fixed = city.resolveCircle(d.x, d.y, 11);
      d.x = fixed.x;
      d.y = fixed.y;
    }
  }

  // --- Partikel & popup ---
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const pt = game.particles[i];
    pt.life -= dt * 1.6;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.popups.length - 1; i >= 0; i -= 1) {
    const pop = game.popups[i];
    pop.life -= dt;
    pop.y -= 24 * dt;
    if (pop.life <= 0) game.popups.splice(i, 1);
  }
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 22);

  // --- Audio mengikuti keadaan ---
  const nearestCop = game.nearestPoliceDistance();
  audio.engine(p.car ? p.car.speed : 0, !p.onFoot);
  audio.siren(game.wanted.level > 0 ? nearestCop : null);

  updateCamera();
}

function enterCar(car) {
  const p = game.player;
  if (car.role === 'traffic' && car.driver) {
    // Sopir kabur jadi pejalan kaki yang lari.
    game.peds.push({
      x: car.x + 30, y: car.y, angle: 0, speed: 130, shirt: '#e8c95a',
      flee: 4, targetX: car.x + 200, targetY: car.y, walkPhase: 0,
    });
    car.driver = false;
  }
  const wasTarget = car.role === 'target';
  car.role = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  audio.unlock();
  audio.click();
  onCarStolen(game, wasTarget ? { ...car, role: 'target' } : car);
  game.nearCarPrompt = '';
}

function exitCar() {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.role = car.name === 'Kancil' && game.mission.index === 1 && game.mission.step === 0 ? 'target' : 'parked';
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  const fixed = city.resolveCircle(p.x, p.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
}

function runShot(name) {
  const screen = stageShot(name, game);
  updateCamera();
  if (name === 'start' || name === 'complete') {
    // Kamera statis sesuai staging; jangan ikut pemain.
    if (name === 'start') game.camera = { x: 1460, y: 140 };
    if (name === 'complete') game.camera = { x: 1280, y: 1160 };
  }
  let painted = 0;
  function paint() {
    renderer.draw(game, screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  // Font sistem sudah tersedia; tidak ada aset async — gambar dua frame lalu siap.
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function handleTitleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      resetRun(false);
    } else if (actions & ACTION_MUTE) {
      audio.toggleMute();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (game.screen === SCREEN_TITLE) {
      handleTitleActions();
      // Kota hidup di belakang title: lalu lintas berjalan pelan.
      while (accumulator >= STEP) {
        for (const car of game.cars) {
          if (car.role === 'traffic') updateTraffic(car, city, game.cars, random, STEP);
        }
        separateCars(game.cars);
        game.time += STEP;
        accumulator -= STEP;
      }
      updateCamera();
    } else if (game.screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        game.tick += 1;
        game.time += STEP;
        stepPlay(input, STEP);
        accumulator -= STEP;
        if (game.screen !== SCREEN_PLAY) break;
      }
    } else if (game.screen === SCREEN_PAUSED) {
      const actions = input.takeActions();
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        game.screen = SCREEN_PLAY;
        announce('Bermain.');
      }
      accumulator = 0;
    } else if (game.screen === SCREEN_HELP) {
      const actions = input.takeActions();
      if (actions & (ACTION_CONFIRM | ACTION_PAUSE)) {
        game.screen = game.helpReturn || SCREEN_TITLE;
        announce(game.screen === SCREEN_TITLE ? 'Kota Senja.' : 'Bermain.');
      }
      accumulator = 0;
    } else if (game.screen === SCREEN_OVER) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (game.overResume === 'arrest') {
          // Lanjut dari Kantor Polisi; misi sudah diulang dari awal oleh arrestPlayer.
          game.overResume = null;
          game.screen = SCREEN_PLAY;
          announce('Bebas. Lanjutkan misi.');
        } else if (game.overResume === 'death') {
          game.overResume = null;
          game.player.health = PLAYER.health;
          game.player.x = PLACES.warung.x;
          game.player.y = PLACES.warung.y + 40;
          restartMission(game);
          game.screen = SCREEN_PLAY;
          announce('Bara pulih. Misi diulang dari awal.');
        } else {
          resetRun(false);
        }
      }
      accumulator = 0;
    } else if (game.screen === SCREEN_VICTORY || game.screen === SCREEN_COMPLETE) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (game.screen === SCREEN_COMPLETE) {
          game.screen = SCREEN_PLAY;
        } else {
          resetRun(false);
        }
      }
      accumulator = 0;
    }

    // Tombol H di mana saja membuka bantuan (kecuali saat mengetik — tidak ada input teks).
    renderer.draw(game, game.screen);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyH' && !event.repeat) {
      if (game.screen === SCREEN_PLAY || game.screen === SCREEN_TITLE) {
        game.helpReturn = game.screen;
        game.screen = SCREEN_HELP;
      } else if (game.screen === SCREEN_HELP) {
        game.screen = game.helpReturn || SCREEN_TITLE;
      }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) {
      game.screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Kota Senja: Jalanan Panas. Tekan Enter untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
