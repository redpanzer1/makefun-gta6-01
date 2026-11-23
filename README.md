# Kota Senja: Jalanan Panas

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/redpanzer1/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/redpanzer1/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Game open-world kriminal orisinal untuk bounty [make.fun gta6-01 "Make GTA 6"](https://make.fun/bounty/gta6-01) — dibangun dari nol dengan Canvas 2D murni, tanpa library dan tanpa network request.

## Cerita

**Bara** (27), mantan kurir yang berutang pada rentenir, bekerja untuk **Bu Ratna** demi melunasi utang dan mencari tahu siapa yang menjebak adiknya, **Dimas**. Kota fiktif **Kota Senja** — kota pesisir Indonesia di waktu senja: Pelabuhan Tua, Pasar Senja, Jalan Pantai, Menara, dan Kampung Gang.

## Misi

1. **Paket Terakhir** — ambil paket di Warung Bu Ratna, antar ke Dermaga Pelabuhan Tua sebelum timer 90 detik habis.
2. **Jalanan Membara** — curi sedan Kancil, picu wanted level 2, kabur dari kejaran polisi ke Plaza Jalan Pantai.
3. **Diamankan di Klinik** — baku tembak di Gudang Pelabuhan, selamatkan Dimas, antar dia ke Klinik Senja di Menara.
4. **Tagihan Bu Ratna** — ambil uang dari 3 titik; tiap titik menaikkan wanted +1.
5. **Jebakan di Pelabuhan** — baku tembak 2 gelombang preman rentenir di Gudang Pelabuhan, lindungi Dimas.
6. **Jalan Pulang** — antar Dimas ke Rumah Aman — lalu layar kemenangan.

## Cara main

Buka `game/index.html` di desktop Chrome (atau jalankan `node serve.ts` lalu buka http://localhost:8080). Game berjalan offline sepenuhnya dari file statis.

| Kontrol | Fungsi |
|---|---|
| WASD / panah | Jalan kaki & mengemudi |
| E | Masuk / keluar mobil, curi mobil |
| Space | Rem tangan |
| Klik kiri | Tembak pistol (bila ada) |
| F | Tinju jarak dekat (lawan preman) |
| P / Esc | Jeda |
| M | Suara hidup / mati |
| H | Bantuan |
| Enter | Konfirmasi |

## Sistem

- Kota dijelajahi jalan kaki dan mobil, dengan lalu lintas AI dan pejalan kaki
- Curi mobil (E di dekat mobil) — sopir kabur, polisi bisa melihat
- Wanted level 1–5: polisi mobil mengejar dengan road graph + Dijkstra, memotong jalan, dan kehilangan jejak di gang; polisi jalan kaki mengejar saat pemain jalan kaki; tertangkap = ditahan, uang dipotong 25%
- Combat pistol + tinju, HUD + minimap, start screen + save otomatis (localStorage) + continue
- Suara sintetis WebAudio (mesin, sirene, tembakan, musik senja) + mute
- 5 distrik, 5 kendaraan (sedan Kancil, taksi Aruna, mobil polisi Patroli, pikap Bebek, motor Siul), efek juice: screen shake, popup uang, kilat merah saat wanted

## Struktur source

- `game/src/main.js` — boot + loop fixed-step + layar
- `game/src/config.js` — konstanta, warna, tuning
- `game/src/random.js` — RNG berseed
- `game/src/input.js` — keyboard + mouse
- `game/src/world.js` — kota, road graph, tabrakan, garis pandang
- `game/src/vehicles.js` — fisika mobil, lalu lintas, curi mobil
- `game/src/police.js` — wanted + AI polisi
- `game/src/missions.js` — 6 misi + cerita
- `game/src/combat.js` — pistol, tinju, preman, pejalan kaki
- `game/src/audio.js` — suara sintetis WebAudio
- `game/src/render.js` — gambar kota, HUD, minimap, menu
- `game/src/shots.js` — staging screenshot deterministik

## Lisensi

MIT — lihat `LICENSE`.
