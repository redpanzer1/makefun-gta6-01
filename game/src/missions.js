// Misi & cerita Kota Senja. Tiga misi berurutan (vertical slice):
//  1. "Paket Terakhir" — ambil paket di warung Bu Ratna, antar ke dermaga lawan timer.
//  2. "Jalanan Membara" — curi sedan Kancil, picu wanted 2, kabur ke Plaza Jalan Pantai.
//  3. "Bawa Dimas Pulang" — baku tembak singkat di gudang, selamatkan Dimas, antar ke rumah aman.
// Semua penanda misi berada di jalan / area terbuka — tidak ada NPC di dalam bangunan.

import { MISSIONS, PLACES } from './config.js';
import { raiseWanted } from './police.js';

export function createMissionState() {
  return {
    index: 0, // 0,1,2 = misi aktif; 3 = semua selesai (menang)
    step: 0,
    timer: 0,
    timerMax: 0,
    hasPackage: false,
    targetCarId: null,
    thugsSpawned: false,
    dimasFreed: false,
    objective: { x: PLACES.warung.x, y: PLACES.warung.y, r: 46, label: 'Temui Bu Ratna di warungnya' },
    dialog: null, // { speaker, text, time }
    banner: null, // { text, sub, time }
    done: false,
  };
}

export function missionName(m) {
  return m.index < 3 ? MISSIONS[m.index].name : 'Kota Senja';
}

export function setDialog(m, speaker, text, seconds) {
  m.dialog = { speaker, text, time: seconds || 4 };
}

export function setBanner(m, text, sub, seconds) {
  m.banner = { text, sub: sub || '', time: seconds || 3 };
}

/** Mulai ulang misi aktif dari langkah awal (dipakai saat ditangkap / timer habis). */
export function restartMission(game) {
  const m = game.mission;
  m.step = 0;
  m.timer = 0;
  m.hasPackage = false;
  m.thugsSpawned = false;
  m.dimasFreed = false;
  game.thugs.length = 0;
  game.dimas.freed = false;
  game.dimas.following = false;
  game.player.hasPistol = false;
  game.player.ammo = 0;
  // Misi 2: pastikan selalu ada sedan target di tempatnya (anti-softlock bila
  // mobil target sempat jadi 'parked' saat pemain ditangkap / keluar mobil).
  if (m.index === 1) {
    let target = game.cars.find((c) => c.role === 'target');
    if (!target) {
      target = game.cars.find((c) => c.kind === 'kancil' && c.role === 'parked');
      if (target) {
        target.role = 'target';
        target.x = PLACES.targetCar.x;
        target.y = PLACES.targetCar.y;
        target.angle = Math.PI / 2;
        target.speed = 0;
      }
    }
  }
  startMission(game, m.index);
}

/** Siapkan penanda & dialog awal sebuah misi. */
export function startMission(game, index) {
  const m = game.mission;
  m.index = index;
  m.step = 0;
  m.done = false;
  if (index === 0) {
    m.objective = { x: PLACES.warung.x, y: PLACES.warung.y, r: 46, label: 'Ambil paket di Warung Bu Ratna' };
    setDialog(m, 'BU RATNA', 'Bara, paket ini harus sampai ke dermaga sebelum senja habis. Jangan sampai telat, ya.', 5);
  } else if (index === 1) {
    m.objective = { x: PLACES.targetCar.x, y: PLACES.targetCar.y, r: 60, label: 'Curi sedan Kancil di Jalan Pantai' };
    setDialog(m, 'BU RATNA', 'Rentenir itu sudah keterlaluan. Ambil sedan Kancil itu — tapi hati-hati polisi.', 5);
  } else if (index === 2) {
    m.objective = { x: PLACES.gudang.x, y: PLACES.gudang.y, r: 70, label: 'Ke Gudang Pelabuhan — selamatkan Dimas' };
    setDialog(m, 'BU RATNA', 'Dimas ditahan di gudang pelabuhan. Bawa pistol ini. Pulangkan adikmu, Bara.', 5);
  }
}

function completeMission(game) {
  const m = game.mission;
  const reward = MISSIONS[m.index].reward;
  game.player.money += reward;
  game.popups.push({ x: game.player.x, y: game.player.y - 30, text: `+$${reward.toLocaleString('en-US')}`, life: 2.2, color: '#ffd94a' });
  game.audio.pickup();
  game.save();
  m.index += 1;
  if (m.index >= 3) {
    m.done = true;
    m.objective = { x: 0, y: 0, r: 0, label: '' };
    setBanner(m, 'KOTA SENJA SELAMAT', 'Bara melunasi utangnya. Dimas pulang. Senja pun reda.', 6);
    game.screen = 'victory';
  } else {
    startMission(game, m.index);
    setBanner(m, `MISI SELESAI: ${MISSIONS[m.index - 1].name}`, `+$${reward.toLocaleString('en-US')} — misi berikutnya: ${MISSIONS[m.index].name}`, 4);
  }
}

/** Update misi tiap tick. Mengembalikan 'failed' bila misi gagal dan harus diulang. */
export function updateMissions(game, dt) {
  const m = game.mission;
  const p = game.player;
  if (m.dialog) {
    m.dialog.time -= dt;
    if (m.dialog.time <= 0) m.dialog = null;
  }
  if (m.banner) {
    m.banner.time -= dt;
    if (m.banner.time <= 0) m.banner = null;
  }
  if (m.index >= 3) return null;

  const distToObjective = Math.hypot(p.x - m.objective.x, p.y - m.objective.y);

  if (m.index === 0) {
    if (m.step === 0) {
      if (distToObjective < m.objective.r) {
        m.hasPackage = true;
        m.step = 1;
        m.timerMax = 90;
        m.timer = 90;
        m.objective = { x: PLACES.pelabuhan.x, y: PLACES.pelabuhan.y, r: 56, label: 'Antar paket ke Dermaga Pelabuhan Tua' };
        setDialog(m, 'BARA', 'Paket sudah di tangan. Ke dermaga, cepat!', 3);
        game.audio.pickup();
      }
    } else if (m.step === 1) {
      m.timer -= dt;
      if (m.timer <= 0) {
        setBanner(m, 'WAKTU HABIS', 'Paket terlambat. Bu Ratna memberimu satu kesempatan lagi.', 3.5);
        restartMission(game);
        return 'failed';
      }
      if (distToObjective < m.objective.r) {
        setDialog(m, 'NELAYAN TUA', 'Paket Bu Ratna? Terima kasih, Nak. Senja ini kau menyelamatkan kami.', 4);
        completeMission(game);
      }
    }
  } else if (m.index === 1) {
    if (m.step === 0) {
      // Menunggu pemain mencuri sedan target (ditandai lewat game.events).
      if (game.events.stoleTargetCar) {
        game.events.stoleTargetCar = false;
        m.step = 1;
        m.objective = { x: PLACES.plazaPantai.x, y: PLACES.plazaPantai.y, r: 140, label: 'Kabur ke Plaza Jalan Pantai!' };
        setDialog(m, 'BARA', 'Mobilnya dapat! Sekarang kabur dari polisi!', 3);
      }
    } else if (m.step === 1) {
      // Anti-softlock: radius tujuan besar (140) di plaza terbuka; masuk saja = selesai,
      // berapa pun wanted-nya, dan polisi tidak bisa mendorong pemain keluar.
      if (distToObjective < m.objective.r) {
        setDialog(m, 'BU RATNA', 'Bagus. Sedan itu aman sekarang. Satu langkah lagi, Bara.', 4);
        completeMission(game);
      }
    }
  } else if (m.index === 2) {
    if (m.step === 0) {
      if (distToObjective < m.objective.r) {
        m.step = 1;
        m.thugsSpawned = true;
        p.hasPistol = true;
        p.ammo = 30;
        game.spawnThugs();
        setDialog(m, 'DIMAS', 'Kak Bara! Tolong! Mereka di sini!', 3);
        setBanner(m, 'BAKU TEMBAK!', 'Lumpuhkan ketiga preman rentenir itu.', 3);
        game.audio.shot();
      }
    } else if (m.step === 1) {
      if (game.thugs.every((t) => !t.alive)) {
        m.step = 2;
        m.dimasFreed = true;
        game.dimas.freed = true;
        game.dimas.following = true;
        m.objective = { x: PLACES.rumahAman.x, y: PLACES.rumahAman.y, r: 60, label: 'Antar Dimas ke Rumah Aman' };
        setDialog(m, 'DIMAS', 'Makasih, Kak. Ayo pulang sebelum mereka datang lagi.', 4);
      }
    } else if (m.step === 2) {
      if (distToObjective < m.objective.r) {
        completeMission(game);
      }
    }
  }
  return null;
}

/** Dipanggil saat pemain mencuri mobil: misi 2 menandai sedan target & memicu wanted. */
export function onCarStolen(game, car) {
  const m = game.mission;
  if (m.index === 1 && m.step === 0 && car.role === 'target') {
    game.events.stoleTargetCar = true;
    raiseWanted(game.wanted, 2);
    game.audio.siren(120); // sirene meraung: polisi sudah dekat saat mobil dicuri
  } else if (game.nearestPoliceDistance() < 180) {
    raiseWanted(game.wanted, 1);
  }
}
