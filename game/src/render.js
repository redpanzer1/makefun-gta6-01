// Menggambar saja: state dunia + layar masuk, piksel keluar. Kanvas logis 1280x720
// diskalakan ke jendela; kamera mengikuti pemain. Gradasi senja oranye/ungu,
// bayangan panjang, papan toko Indonesia, dan HUD kontras tinggi supaya tetap
// terbaca saat screenshot dikecilkan jadi contact sheet.

import { VIEW, WORLD, PALETTE, FONT } from './config.js';
import { ROAD_X as RX, ROAD_Y as RY, ROAD_W, HARBOR_X, SEA_Y, SAND_Y } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_COMPLETE = 'complete';

const ROOF_COLORS = ['#6e3b2e', '#54423a', '#7a4a2b'];
const MINIMAP = { w: 232, h: 174 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  function cameraFor(game) {
    const p = game.player;
    let x = p.x - VIEW.width / 2;
    let y = p.y - VIEW.height / 2;
    x = Math.max(0, Math.min(WORLD.width - VIEW.width, x));
    y = Math.max(0, Math.min(WORLD.height - VIEW.height, y));
    return { x, y };
  }

  function drawGround(game) {
    const cam = game.camera;
    // Tanah dasar + air pelabuhan + laut + pasir pantai.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.harbor;
    ctx.fillRect(-cam.x, -cam.y, HARBOR_X, WORLD.height);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(-cam.x, SEA_Y - cam.y, WORLD.width, WORLD.height - SEA_Y);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(-cam.x, SAND_Y - cam.y, WORLD.width, SEA_Y - SAND_Y);
    // Garis pantai & dermaga kayu.
    ctx.fillStyle = '#8a6a42';
    for (let i = 0; i < 4; i += 1) {
      const px = 40 + i * 34;
      ctx.fillRect(px - cam.x, 420 - cam.y, 10, 260);
    }
    ctx.fillStyle = '#6b4f30';
    ctx.fillRect(20 - cam.x, 400 - cam.y, 120, 18);
    // Perahu di pelabuhan.
    ctx.fillStyle = '#d8c9a3';
    ctx.fillRect(60 - cam.x, 700 - cam.y, 60, 18);
    ctx.fillRect(70 - cam.x, 1080 - cam.y, 54, 16);
    ctx.fillStyle = '#b3473a';
    ctx.fillRect(84 - cam.x, 684 - cam.y, 8, 16);
  }

  function drawRoads(game) {
    const cam = game.camera;
    ctx.fillStyle = PALETTE.road;
    for (const rx of RX) ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD.height);
    for (const ry of RY) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD.width, ROAD_W);
    // Trotoar di tepi jalan.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of RX) {
      ctx.fillRect(rx - ROAD_W / 2 - 14 - cam.x, -cam.y, 14, WORLD.height);
      ctx.fillRect(rx + ROAD_W / 2 - cam.x, -cam.y, 14, WORLD.height);
    }
    for (const ry of RY) {
      ctx.fillRect(-cam.x, ry - ROAD_W / 2 - 14 - cam.y, WORLD.width, 14);
      ctx.fillRect(-cam.x, ry + ROAD_W / 2 - cam.y, WORLD.width, 14);
    }
    // Garis tengah kuning putus-putus.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of RX) {
      for (let y = 0; y < WORLD.height; y += 56) ctx.fillRect(rx - 3 - cam.x, y - cam.y, 6, 28);
    }
    for (const ry of RY) {
      for (let x = 0; x < WORLD.width; x += 56) ctx.fillRect(x - cam.x, ry - 3 - cam.y, 28, 6);
    }
    // Zebra cross di tiap persimpangan.
    ctx.fillStyle = '#e8e0cc';
    for (const rx of RX) {
      for (const ry of RY) {
        for (let i = -2; i <= 2; i += 1) ctx.fillRect(rx + i * 14 - 5 - cam.x, ry - ROAD_W / 2 + 8 - cam.y, 10, 18);
      }
    }
  }

  function drawBuildings(game) {
    const cam = game.camera;
    for (const b of game.city.buildings) {
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      if (sx > VIEW.width || sy > VIEW.height || sx + b.w < 0 || sy + b.h < 0) continue;
      // Bayangan panjang ke arah senja (tenggara).
      ctx.fillStyle = 'rgba(20, 8, 20, 0.35)';
      ctx.fillRect(sx + 16, sy + 20, b.w, b.h);
      ctx.fillStyle = ROOF_COLORS[b.roof];
      ctx.fillRect(sx, sy, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 1.5, sy + 1.5, b.w - 3, b.h - 3);
      // Papan nama toko (teks Indonesia) di tengah atap.
      if (b.name) {
        const size = Math.max(11, Math.min(18, Math.floor(b.w / (b.name.length * 0.58))));
        ctx.font = `bold ${size}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(20,10,8,0.55)';
        ctx.fillRect(sx + 8, sy + b.h / 2 - size * 0.75, b.w - 16, size * 1.5);
        ctx.fillStyle = b.special === 'warung' ? '#ffd94a' : '#f5ead6';
        ctx.fillText(b.name, sx + b.w / 2, sy + b.h / 2 + 1);
      }
      // Jendela berpendar senja pada bangunan istimewa.
      if (b.special) {
        ctx.fillStyle = 'rgba(255, 190, 90, 0.85)';
        for (let i = 0; i < 3; i += 1) ctx.fillRect(sx + 14 + i * 22, sy + b.h - 26, 14, 16);
      }
    }
    // Lapak Pasar Senja.
    for (const s of game.city.stalls) {
      const sx = s.x - cam.x;
      const sy = s.y - cam.y;
      ctx.fillStyle = ['#c96a3a', '#3a7ac9', '#c9a13a'][s.kind];
      ctx.fillRect(sx - 14, sy - 10, 28, 20);
      ctx.fillStyle = '#f5ead6';
      ctx.fillRect(sx - 14, sy - 16, 28, 6);
    }
    // Pohon.
    for (const t of game.city.trees) {
      const sx = t.x - cam.x;
      const sy = t.y - cam.y;
      if (sx < -20 || sy < -20 || sx > VIEW.width + 20 || sy > VIEW.height + 20) continue;
      ctx.fillStyle = '#2c4a26';
      ctx.beginPath();
      ctx.arc(sx, sy, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f5a34';
      ctx.beginPath();
      ctx.arc(sx - 3, sy - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(game, car) {
    const cam = game.camera;
    const sx = car.x - cam.x;
    const sy = car.y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(car.angle);
    // Bayangan.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, -20 + 3, -11 + 4, 42, 24, 7);
    ctx.fill();
    // Badan.
    ctx.fillStyle = car.color;
    roundRect(ctx, -21, -12, 42, 24, 7);
    ctx.fill();
    ctx.fillStyle = car.roof;
    roundRect(ctx, -8, -10, 16, 20, 4);
    ctx.fill();
    // Kaca depan & lampu.
    ctx.fillStyle = '#bfe3ea';
    ctx.fillRect(13, -9, 5, 18);
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(20, -10, 2, 5);
    ctx.fillRect(20, 5, 2, 5);
    // Lampu sirene polisi berkedip merah-biru.
    if (car.kind === 'patroli') {
      const phase = Math.floor(game.time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-4, -12, 8, 5);
      ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-4, 7, 8, 5);
    }
    // Garis kuning penanda mobil pemain.
    if (car.role === 'player') {
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2;
      roundRect(ctx, -23, -14, 46, 28, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(game, x, y, angle, shirt, isPlayer, walkPhase) {
    const cam = game.camera;
    const sx = x - cam.x;
    const sy = y - cam.y;
    const bob = Math.sin(walkPhase || 0) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + 2, sy + 4, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Badan + kepala.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(sx, sy + bob * 0.3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(angle) * 3, sy + Math.sin(angle) * 3 - 2, 6.5, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 15, 0, Math.PI * 2);
      ctx.stroke();
      // Pistol di tangan bila ada.
      if (game.player.hasPistol) {
        ctx.fillStyle = '#222';
        ctx.fillRect(sx + Math.cos(angle) * 12 - 3, sy + Math.sin(angle) * 12 - 2, 8, 4);
      }
    }
  }

  function drawWorld(game) {
    drawGround(game);
    drawRoads(game);
    drawBuildings(game);
    // Penanda misi (lingkaran berdenyut + tiang cahaya).
    const m = game.mission;
    if (m.index < 3 && m.objective.r > 0) {
      const cam = game.camera;
      const sx = m.objective.x - cam.x;
      const sy = m.objective.y - cam.y;
      const pulse = 0.5 + Math.sin(game.time * 4) * 0.25;
      ctx.fillStyle = `rgba(255, 217, 74, ${0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(sx, sy, m.objective.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 14 + Math.sin(game.time * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 34);
      ctx.lineTo(sx - 8, sy - 18);
      ctx.lineTo(sx + 8, sy - 18);
      ctx.closePath();
      ctx.fill();
    }
    // Mobil, pejalan kaki, preman, Dimas, pemain, peluru, partikel.
    for (const car of game.cars) {
      if (car.role !== 'gone') drawCar(game, car);
    }
    for (const ped of game.peds) drawPerson(game, ped.x, ped.y, ped.angle, ped.shirt, false, ped.walkPhase);
    for (const t of game.thugs) {
      if (!t.alive) continue;
      drawPerson(game, t.x, t.y, t.angle, '#8b2f2f', false, 0);
      // Bar nyawa preman.
      const cam = game.camera;
      ctx.fillStyle = '#222';
      ctx.fillRect(t.x - cam.x - 16, t.y - cam.y - 26, 32, 5);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(t.x - cam.x - 16, t.y - cam.y - 26, 32 * (t.health / 100), 5);
    }
    if (game.dimas.freed) {
      drawPerson(game, game.dimas.x, game.dimas.y, game.dimas.angle || 0, '#7ad67a', false, game.time * 6);
      const cam = game.camera;
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('DIMAS', game.dimas.x - cam.x, game.dimas.y - cam.y - 20);
    }
    const p = game.player;
    if (p.onFoot) drawPerson(game, p.x, p.y, p.angle, '#ff7a2e', true, game.time * 8);
    // Peluru.
    ctx.fillStyle = '#ffe27a';
    for (const b of game.bullets) {
      ctx.fillRect(b.x - game.camera.x - 3, b.y - game.camera.y - 1.5, 6, 3);
    }
    // Partikel.
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - game.camera.x - pt.size / 2, pt.y - game.camera.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Popup teks melayang (+$500, dsb).
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = 'center';
    for (const pop of game.popups) {
      ctx.globalAlpha = Math.min(1, pop.life);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x - game.camera.x, pop.y - game.camera.y);
    }
    ctx.globalAlpha = 1;
    // Gradasi senja: oranye di atas, ungu di bawah, tipis supaya dunia tetap jelas.
    const grad = ctx.createLinearGradient(0, 0, VIEW.width, VIEW.height);
    grad.addColorStop(0, 'rgba(255, 140, 60, 0.10)');
    grad.addColorStop(0.55, 'rgba(255, 90, 90, 0.05)');
    grad.addColorStop(1, 'rgba(90, 40, 140, 0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Kilat merah saat wanted aktif.
    if (game.wanted.level > 0) {
      const blink = 0.05 + Math.sin(game.time * 5) * 0.03;
      ctx.fillStyle = `rgba(255, 30, 30, ${blink})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawMinimap(game) {
    const mw = MINIMAP.w;
    const mh = MINIMAP.h;
    const mx = VIEW.width - mw - 14;
    const my = VIEW.height - mh - 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(12, 8, 18, 0.82)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
    // Air + pasir.
    ctx.fillStyle = '#24365e';
    ctx.fillRect(mx, my, HARBOR_X * sx, mh);
    ctx.fillStyle = '#2b3a6e';
    ctx.fillRect(mx, my + SEA_Y * sy, mw, mh - SEA_Y * sy);
    ctx.fillStyle = '#c99a5b';
    ctx.fillRect(mx, my + SAND_Y * sy, mw, (SEA_Y - SAND_Y) * sy);
    // Jalan.
    ctx.fillStyle = '#8a7f72';
    for (const rx of RX) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of RY) ctx.fillRect(mx, my + ry * sy - 2, mw, 4);
    // Bangunan.
    ctx.fillStyle = '#5a4a42';
    for (const b of game.city.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
    // Penanda misi.
    const m = game.mission;
    if (m.index < 3 && m.objective.r > 0) {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(mx + m.objective.x * sx, my + m.objective.y * sy, 5 + Math.sin(game.time * 4) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Polisi (merah-biru), pemain (kuning).
    for (const u of game.police) {
      ctx.fillStyle = '#4f7cff';
      ctx.beginPath();
      ctx.arc(mx + u.car.x * sx, my + u.car.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f5ead6';
    ctx.fillText('KOTA SENJA', mx + 2, my - 8);
  }

  function drawHUD(game) {
    const p = game.player;
    // Panel kiri atas: uang + nyawa.
    ctx.fillStyle = 'rgba(12, 8, 18, 0.78)';
    roundRect(ctx, 12, 12, 250, 64, 10);
    ctx.fill();
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.money;
    ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 26, 42);
    ctx.fillStyle = '#222';
    ctx.fillRect(26, 52, 180, 12);
    ctx.fillStyle = p.health > 40 ? PALETTE.health : PALETTE.danger;
    ctx.fillRect(26, 52, 180 * (p.health / 100), 12);
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`NYAWA ${Math.ceil(p.health)}`, 212, 62);
    // Pistol & amunisi.
    if (p.hasPistol) {
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillStyle = '#ffe27a';
      ctx.fillText(`PISTOL  ${p.ammo} peluru`, 26, 96);
    }
    // Bintang wanted kanan atas.
    ctx.fillStyle = 'rgba(12, 8, 18, 0.78)';
    roundRect(ctx, VIEW.width - 210, 12, 198, 52, 10);
    ctx.fill();
    ctx.font = `bold 27px ${FONT}`;
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < game.wanted.level ? '#ffcf3a' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', VIEW.width - 178 + i * 52, 43);
    }
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = game.wanted.level > 0 ? '#ff8a7a' : PALETTE.muted;
    ctx.fillText(game.wanted.level > 0 ? 'DICARI POLISI' : 'AMAN', VIEW.width - 111, 60);
    // Objektif misi di tengah atas + panah arah.
    const m = game.mission;
    if (m.index < 3) {
      const label = `MISI ${m.index + 1}: ${m.objective.label}`;
      ctx.font = `bold 19px ${FONT}`;
      const w = ctx.measureText(label).width + 44;
      ctx.fillStyle = 'rgba(12, 8, 18, 0.82)';
      roundRect(ctx, (VIEW.width - w) / 2, 12, w, 44, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.textAlign = 'center';
      ctx.fillText(label, VIEW.width / 2, 41);
      // Panah penunjuk arah ke objektif.
      const dx = m.objective.x - p.x;
      const dy = m.objective.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 120) {
        const ang = Math.atan2(dy, dx);
        const ax = VIEW.width / 2 + Math.cos(ang) * 130;
        const ay = 96 + Math.sin(ang) * 40;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-8, -9);
        ctx.lineTo(-8, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.font = `bold 14px ${FONT}`;
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.round(dist)} m`, VIEW.width / 2, 118);
      }
      // Timer misi 1.
      if (m.index === 0 && m.step === 1) {
        ctx.font = `bold 22px ${FONT}`;
        ctx.fillStyle = m.timer < 20 ? '#ff5a4e' : '#fff';
        ctx.fillText(`⏱ ${Math.ceil(m.timer)} dtk`, VIEW.width / 2, 146);
      }
    }
    // Kecepatan saat mengemudi.
    if (!p.onFoot && p.car) {
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.9)} km/j — ${p.car.name}`, 26, VIEW.height - 24);
    }
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = 'rgba(245, 234, 214, 0.75)';
    ctx.textAlign = 'left';
    ctx.fillText('WASD gerak · E masuk/curi mobil · Klik tembak · P jeda · M suara', 26, VIEW.height - 46);
    // Nama distrik.
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(game.city.districtAt(p.x, p.y).toUpperCase(), VIEW.width - 262, VIEW.height - 24);
    drawMinimap(game);
    // Dialog cerita di bawah.
    if (m.dialog) {
      ctx.fillStyle = 'rgba(12, 8, 18, 0.85)';
      roundRect(ctx, 300, VIEW.height - 128, 680, 72, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2;
      roundRect(ctx, 300, VIEW.height - 128, 680, 72, 10);
      ctx.stroke();
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd94a';
      ctx.fillText(m.dialog.speaker, 322, VIEW.height - 100);
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = '#fff';
      wrapText(m.dialog.text, 322, VIEW.height - 76, 636, 20);
    }
    // Banner besar (misi selesai / waktu habis / lolos).
    if (m.banner) {
      ctx.globalAlpha = Math.min(1, m.banner.time);
      ctx.font = `bold 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(12, 8, 18, 0.7)';
      const bw = ctx.measureText(m.banner.text).width + 60;
      roundRect(ctx, (VIEW.width - bw) / 2, 210, bw, 110, 14);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.fillText(m.banner.text, VIEW.width / 2, 256);
      ctx.font = `18px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(m.banner.sub, VIEW.width / 2, 292);
      ctx.globalAlpha = 1;
    }
    // Petunjuk curi mobil.
    if (game.nearCarPrompt) {
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(game.nearCarPrompt, VIEW.width / 2, VIEW.height - 150);
    }
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = word;
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }

  function panel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(10, 6, 16, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Lebar panel mengikuti baris teks terpanjang supaya tidak ada yang meluber.
    ctx.font = `17px ${FONT}`;
    let textW = ctx.measureText(title).width;
    for (const line of lines) textW = Math.max(textW, ctx.measureText(line).width);
    textW = Math.max(textW, ctx.measureText(prompt).width);
    const w = Math.min(VIEW.width - 80, Math.max(640, Math.ceil(textW) + 90));
    const h = 130 + lines.length * 30 + 70;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillStyle = 'rgba(20, 12, 26, 0.95)';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = accent || '#ffd94a';
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 16);
    ctx.stroke();
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#ffd94a';
    ctx.fillText(title, VIEW.width / 2, y + 58);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = '#f5ead6';
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, y + 104 + i * 30));
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(prompt, VIEW.width / 2, y + h - 26);
  }

  function drawTitle(game) {
    drawWorld(game);
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(40, 10, 50, 0.42)');
    grad.addColorStop(1, 'rgba(10, 6, 16, 0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillStyle = '#ffb347';
    ctx.fillText('KOTA SENJA', VIEW.width / 2, 190);
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillStyle = '#ff5a4e';
    ctx.fillText('— JALANAN PANAS —', VIEW.width / 2, 232);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = '#f5ead6';
    ctx.fillText('Open-world kriminal orisinal: curi mobil, kabur dari polisi, pulangkan Dimas.', VIEW.width / 2, 272);
    ctx.font = `bold 20px ${FONT}`;
    const hasSave = game.hasSave;
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(hasSave ? 'ENTER — Lanjutkan perjalanan Bara' : 'ENTER — Mulai perjalanan Bara', VIEW.width / 2, 350);
    ctx.fillStyle = '#fff';
    ctx.fillText('H — Bantuan & kontrol', VIEW.width / 2, 384);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = 'rgba(245, 234, 214, 0.8)';
    ctx.fillText('3 misi · 3 distrik · wanted 3 level · kota fiktif, semua konten orisinal', VIEW.width / 2, 430);
    ctx.fillText('WASD jalan / mengemudi · E curi mobil · Klik kiri tembak · P jeda · M suara', VIEW.width / 2, 458);
    ctx.fillText('Pelabuhan Tua · Pasar Senja · Jalan Pantai', VIEW.width / 2, 500);
  }

  function draw(game, screen) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    // Goyangan layar (shake) saat tabrakan / tembakan.
    const shake = game.shake || 0;
    const ox = shake > 0 ? (Math.sin(game.time * 47) * shake) : 0;
    const oy = shake > 0 ? (Math.cos(game.time * 39) * shake) : 0;
    ctx.save();
    ctx.translate(ox, oy);
    if (screen === SCREEN_TITLE) {
      drawTitle(game);
    } else {
      drawWorld(game);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_COMPLETE) {
        drawHUD(game);
      }
      if (screen === SCREEN_PAUSED) {
        panel('JEDA', ['Perjalanan Bara berhenti sejenak.', 'Progres tersimpan otomatis tiap misi selesai.'], 'P / Enter — lanjutkan', '#ffd94a');
      } else if (screen === SCREEN_HELP) {
        panel('BANTUAN — KOTA SENJA', [
          'WASD / panah: jalan & mengemudi · Space: rem tangan',
          'E: masuk / curi mobil · Klik kiri: tembak (bila ada pistol)',
          'P: jeda · M: suara hidup/mati · Enter: konfirmasi',
          'Curi mobil di depan polisi = wanted naik. Sembunyi di gang,',
          'ganti mobil, atau tunggu sampai polisi kehilangan jejak.',
        ], 'H / Enter — kembali', '#ffd94a');
      } else if (screen === SCREEN_OVER) {
        panel(game.overTitle || 'GAME OVER', game.overLines || ['Bara tumbang.'], 'Enter — coba lagi dari checkpoint misi', '#ff5a4e');
      } else if (screen === SCREEN_VICTORY) {
        panel('KOTA SENJA SELAMAT', [
          'Bara melunasi utangnya pada rentenir.',
          'Dimas pulang dengan selamat ke Rumah Aman.',
          `Total uang Bara: $${game.player.money.toLocaleString('en-US')} — kemenangan milik kalian berdua.`,
          'Terima kasih sudah bermain di Kota Senja.',
        ], 'Enter — main lagi dari awal', '#58d68d');
      } else if (screen === SCREEN_COMPLETE) {
        panel('MISI SELESAI', [
          game.completeText || '',
          game.completeReward || '',
          'Dimas pulang dengan selamat. Kota Senja selamat — terima kasih sudah bermain.',
        ], 'Enter — lanjutkan', '#58d68d');
      }
    }
    ctx.restore();
  }

  return { draw, fitCanvas };
}
