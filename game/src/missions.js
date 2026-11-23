// Misi & cerita Kota Senja. Enam misi berurutan (fase 2):
//  1. "Paket Terakhir" — ambil paket di warung Bu Ratna, antar ke dermaga lawan timer.
//  2. "Jalanan Membara" — curi sedan Kancil, picu wanted 2, kabur ke Plaza Jalan Pantai.
//  3. "Diamankan di Klinik" — baku tembak di gudang, selamatkan Dimas, antar ke Klinik Senja.
//  4. "Tagihan Bu Ratna" — ambil uang dari 3 titik, tiap titik menaikkan wanted +1.
//  5. "Jebakan di Pelabuhan" — baku tembak 2 gelombang di gudang, Dimas ikut.
//  6. "Jalan Pulang" — antar Dimas ke Rumah Aman; akhir cerita + layar kemenangan.
// Semua penanda misi berada di jalan / area terbuka — tidak ada NPC di dalam bangunan.

import { MISSIONS, PLACES } from './config.js';
import { raiseWanted } from './police.js';

export function createMissionState() {
  return {
    index: 0, // 0..5 = misi aktif; 6 = semua selesai (menang)
    step: 0,
    timer: 0,
    timerMax: 0,
    hasPackage: false,
    targetCarId: null,
    thugsSpawned: false,
    dimasFreed: false,
    collected: 0, // misi 4: titik tagihan yang sudah diambil
    wave: 0, // misi 5: gelombang preman
    objective: { x: PLACES.warung.x, y: PLACES.warung.y, r: 46, label: 'Temui Bu Ratna di warungnya' },
    dialog: null, // { speaker, text, time }
    banner: null, // { text, sub, time }
    done: false,
  };
}

export function missionName(m) {
  return m.index < MISSIONS.length ? MISSIONS[m.index].name : 'Kota Senja';
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
  m.collected = 0;
  m.wave = 0;
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
  m.collected = 0;
  m.wave = 0;
  if (index === 0) {
    m.objective = { x: PLACES.warung.x, y: PLACES.warung.y, r: 46, label: 'Ambil paket di Warung Bu Ratna' };
    setDialog(m, 'BU RATNA', 'Bara, paket ini harus sampai ke dermaga sebelum senja habis. Jangan sampai telat, ya.', 5);
  } else if (index === 1) {
    m.objective = { x: PLACES.targetCar.x, y: PLACES.targetCar.y, r: 60, label: 'Curi sedan Kancil di Jalan Pantai' };
    setDialog(m, 'BU RATNA', 'Rentenir itu sudah keterlaluan. Ambil sedan Kancil itu — tapi hati-hati polisi.', 5);
  } else if (index === 2) {
    m.objective = { x: PLACES.gudang.x, y: PLACES.gudang.y, r: 70, label: 'Ke Gudang Pelabuhan — selamatkan Dimas' };
    setDialog(m, 'BU RATNA', 'Dimas ditahan di gudang pelabuhan. Bawa pistol ini. Pulangkan adikmu, Bara.', 5);
  } else if (index === 3) {
    const t = PLACES.tagihan[0];
    m.objective = { x: t.x, y: t.y, r: 46, label: `Tagihan 0/3 — ${t.label}` };
    setDialog(m, 'BU RATNA', 'Tagihan dari tiga langganan belum dibayar. Ambil semuanya — cepat, sebelum polisi menciummu.', 5);
  } else if (index === 4) {
    m.objective = { x: PLACES.gudang.x, y: PLACES.gudang.y, r: 70, label: 'Ke Gudang Pelabuhan — jebakan rentenir!' };
    setDialog(m, 'DIMAS', 'Kak, ini jebakan! Preman rentenir sudah menunggu di gudang!', 5);
  } else if (index === 5) {
    m.objective = { x: PLACES.rumahAman.x, y: PLACES.rumahAman.y, r: 60, label: 'Antar Dimas ke Rumah Aman' };
    game.dimas.freed = true;
    game.dimas.following = true;
    setDialog(m, 'DIMAS', 'Kak, ayo pulang. Aku sudah tidak tahan lagi di kota ini.', 5);
  }
}

function completeMission(game) {
  const m = game.mission;
  const reward = MISSIONS[m.index].reward;
  const finishedName = MISSIONS[m.index].name;
  game.player.money += reward;
  game.popups.push({ x: game.player.x, y: game.player.y - 30, text: `+$${reward.toLocaleString('en-US')}`, life: 2.2, color: '#ffd94a' });
  game.audio.pickup();
  m.index += 1;
  // Simpan SETELAH index naik: "continue" harus lanjut ke misi berikutnya,
  // bukan mengulang misi yang baru saja selesai.
  game.save();
  if (m.index >= MISSIONS.length) {
    m.done = true;
    m.objective = { x: 0, y: 0, r: 0, label: '' };
    setBanner(m, 'KOTA SENJA SELAMAT', 'Bara melunasi utangnya. Dimas pulang. Senja pun reda.', 6);
    game.screen = 'victory';
  } else {
    startMission(game, m.index);
    if (m.index === 3) {
      setBanner(m, 'BABAK 2 — BALAS DENDAM', `+$${reward.toLocaleString('en-US')} — misi berikutnya: ${MISSIONS[m.index].name}`, 4);
    } else {
      setBanner(m, `MISI SELESAI: ${finishedName}`, `+$${reward.toLocaleString('en-US')} — misi berikutnya: ${MISSIONS[m.index].name}`, 4);
    }
  }
}

function spawnThugWave(game, spots) {
  for (const s of spots) {
    game.thugs.push({ x: s.x, y: s.y, health: 100, alive: true, shootTimer: 1 + game.random() * 1.5, angle: 0 });
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
  if (m.index >= MISSIONS.length) return null;

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
        // Misi 3 bukan final lagi: Dimas diamankan dulu ke Klinik Senja (Menara).
        m.objective = { x: PLACES.klinik.x, y: PLACES.klinik.y, r: 60, label: 'Antar Dimas ke Klinik Senja' };
        setDialog(m, 'DIMAS', 'Makasih, Kak. Aku terluka... bawa aku ke klinik dulu.', 4);
      }
    } else if (m.step === 2) {
      if (distToObjective < m.objective.r) {
        setDialog(m, 'PERAWAT', 'Dimas aman di sini. Istirahat dulu, Nak.', 4);
        completeMission(game);
      }
    }
  } else if (m.index === 3) {
    // Misi 4 "Tagihan Bu Ratna": ambil uang dari 3 titik berurutan.
    if (distToObjective < m.objective.r) {
      const point = PLACES.tagihan[m.collected];
      m.collected += 1;
      game.player.money += 300;
      raiseWanted(game.wanted, 1);
      game.popups.push({ x: p.x, y: p.y - 30, text: '+$300 — TAGIHAN DIBAYAR', life: 1.8, color: '#ffd94a' });
      game.audio.pickup();
      if (m.collected >= PLACES.tagihan.length) {
        setDialog(m, 'BU RATNA', 'Semua tagihan lunas. Kau makin dekat dengan kebebasan, Bara.', 4);
        completeMission(game);
      } else {
        const next = PLACES.tagihan[m.collected];
        m.objective = { x: next.x, y: next.y, r: 46, label: `Tagihan ${m.collected}/3 — ${next.label}` };
        setDialog(m, 'BARA', `Tagihan ${m.collected}/3 beres. Lanjut ke titik berikutnya — polisi makin dekat!`, 3);
      }
    }
  } else if (m.index === 4) {
    // Misi 5 "Jebakan di Pelabuhan": 2 gelombang preman di halaman gudang.
    if (m.step === 0) {
      if (distToObjective < m.objective.r) {
        m.step = 1;
        m.wave = 1;
        p.hasPistol = true;
        p.ammo = 60;
        game.dimas.freed = true;
        game.dimas.following = true;
        spawnThugWave(game, [
          { x: 380, y: 940 }, { x: 470, y: 1010 }, { x: 560, y: 950 },
        ]);
        setDialog(m, 'DIMAS', 'Kak, mereka datang! Lindungi aku!', 3);
        setBanner(m, 'JEBAKAN!', 'Gelombang 1: lumpuhkan para preman rentenir.', 3);
        game.audio.shot();
      }
    } else if (m.step === 1) {
      if (game.thugs.every((t) => !t.alive)) {
        if (m.wave === 1) {
          m.wave = 2;
          spawnThugWave(game, [
            { x: 400, y: 860 }, { x: 600, y: 1020 }, { x: 700, y: 900 },
          ]);
          setBanner(m, 'GELOMBANG 2!', 'Mereka datang lagi — habisi semuanya!', 3);
          game.audio.shot();
        } else {
          setDialog(m, 'DIMAS', 'Mereka semua tumbang, Kak. Kita selamat... untuk sekarang.', 4);
          completeMission(game);
        }
      }
    }
  } else if (m.index === 5) {
    // Misi 6 "Jalan Pulang": antar Dimas ke Rumah Aman — akhir cerita.
    if (distToObjective < m.objective.r) {
      completeMission(game);
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
