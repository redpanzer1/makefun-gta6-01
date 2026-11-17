// Suara sintetis WebAudio — tanpa aset eksternal. Mesin (osilator sawtooth yang
// nadanya ikut kecepatan), sirene dua nada, tembakan (noise burst), pickup,
// dan loop musik senja sederhana (bass + pad). Semua diam bila muted (tombol M).

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Mesin: sawtooth rendah + lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Sirene: dua nada bergantian via osilator sinus.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  // Loop musik: bass pelan bernada minor + pad. Satu langkah tiap 0,42 detik.
  const BASS = [110, 0, 98, 0, 87.3, 0, 98, 0, 110, 0, 130.8, 0, 98, 0, 87.3, 0];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx || ctx.state !== 'running') return;
      const note = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (note === 0) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.42);
    }, 420);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Nada mesin mengikuti kecepatan mobil pemain (0 = diam, nyaris sunyi). */
    engine(speed, driving) {
      if (!ctx || muted) return;
      if (!Number.isFinite(speed)) speed = 0;
      const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 2400) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.45, ctx.currentTime, 0.08);
    },
    /** Sirene: makin dekat polisi makin keras; dua nada bergantian. */
    siren(distance) {
      if (!ctx || muted) return;
      if (distance === null || !Number.isFinite(distance) || distance > 700) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      const vol = Math.max(0, 0.09 * (1 - distance / 700));
      sirenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
      const phase = (Date.now() / 450) % 2 < 1 ? 700 : 950;
      sirenOsc.frequency.setTargetAtTime(phase, ctx.currentTime, 0.05);
    },
    shot() { noiseBurst(0.14, 0.35, 2600); blip(160, 0.1, 'square', 0.12, 60); },
    enemyShot() { noiseBurst(0.1, 0.16, 1800); },
    hit() { noiseBurst(0.12, 0.25, 500); blip(90, 0.18, 'sawtooth', 0.14, 45); },
    pickup() { blip(660, 0.09, 'square', 0.12); window.setTimeout(() => blip(990, 0.14, 'square', 0.12), 90); },
    gameOver() { blip(220, 0.5, 'sawtooth', 0.16, 55); },
    click() { blip(440, 0.05, 'square', 0.08); },
  };
}
