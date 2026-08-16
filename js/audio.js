/* ============================================================
   MEAT PROTOCOL - procedural audio. No files, all synthesis.
   ============================================================ */
const A = (() => {
  let ac = null, master = null, droneGain = null, droneNodes = [], on = false, muted = false;
  let noise = null, musicBus = null;

  function makeNoise() {
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0.45;
    master.connect(ac.destination);
    noise = makeNoise();
    on = true;
    startDrone();
    // The score gets its own bus under master, so muting and SFX ducking
    // both still apply to it.
    musicBus = ac.createGain();
    musicBus.gain.value = 0.85;
    musicBus.connect(master);
    if (typeof MUSIC !== 'undefined') MUSIC.attach(ac, musicBus);
  }

  const now = () => ac.currentTime;

  function env(node, vol, atk, dec, t0) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
    node.connect(g); g.connect(master);
    return g;
  }

  function tone(type, f0, f1, vol, dur, t0, detune) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    if (detune) o.detune.value = detune;
    env(o, vol, 0.006, dur, t0);
    o.start(t0); o.stop(t0 + dur + 0.06);
    return o;
  }

  function burst(vol, dur, t0, filterType, f0, f1, q) {
    const s = ac.createBufferSource();
    s.buffer = noise; s.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = filterType || 'lowpass';
    bp.frequency.setValueAtTime(f0, t0);
    if (f1) bp.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + dur);
    if (q) bp.Q.value = q;
    s.connect(bp);
    env(bp, vol, 0.004, dur, t0);
    s.start(t0); s.stop(t0 + dur + 0.08);
  }

  /* -------- ambient dread drone -------- */
  function startDrone() {
    droneGain = ac.createGain();
    droneGain.gain.value = 0.0;
    droneGain.connect(master);
    droneGain.gain.linearRampToValueAtTime(0.07, now() + 4);   // sits under the score now

    [36.7, 55, 73.4].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      const g = ac.createGain(); g.gain.value = i === 0 ? 0.5 : 0.16;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      // slow detune wobble = unease
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + i * 0.031;
      const lg = ac.createGain(); lg.gain.value = 6 + i * 4;
      lfo.connect(lg); lg.connect(o.detune); lfo.start();
      o.connect(g); g.connect(lp); lp.connect(droneGain); o.start();
      droneNodes.push(o);
    });

    // breathing room-tone
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 190; f.Q.value = 0.7;
    const g = ac.createGain(); g.gain.value = 0.05;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.19;
    const lg = ac.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(droneGain); s.start();
  }

  function setDread(v) { // 0..1 -> drone intensity
    if (!on) return;
    droneGain.gain.setTargetAtTime(0.05 + v * 0.11, now(), 1.2);
  }

  /* -------- SFX -------- */
  const api = {
    init,
    ready: () => on && !muted,
    toggleMute() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.45, now(), 0.05); return muted; },
    isMuted: () => muted,
    setDread,
    music: (typeof MUSIC !== 'undefined') ? MUSIC : null,
    /* Ducks the score under a big moment (boss roar, explosion) and lets it back up. */
    duck(amount, seconds) {
      if (!on || !musicBus) return;
      const t = now();
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(0.85 * (1 - (amount === undefined ? 0.5 : amount)), t + 0.05);
      musicBus.gain.linearRampToValueAtTime(0.85, t + 0.05 + (seconds || 0.7));
    },

    shoot(pitch) {
      if (!on) return; const t = now();
      burst(0.55, 0.075, t, 'lowpass', 2600 * (pitch || 1), 300, 1);
      burst(0.22, 0.16, t, 'highpass', 1800, 900);
      tone('square', 150 * (pitch || 1), 44, 0.28, 0.09, t);
    },
    godshoot() {
      if (!on) return; const t = now();
      tone('sawtooth', 900, 120, 0.2, 0.1, t);
      tone('square', 1400, 200, 0.12, 0.09, t, 12);
      burst(0.3, 0.09, t, 'bandpass', 3200, 700, 2);
    },
    shell() { if (!on) return; const t = now() + 0.14 + Math.random() * 0.05; burst(0.12, 0.05, t, 'bandpass', 5200 + Math.random() * 1800, 3000, 6); },
    reload() {
      if (!on) return; const t = now();
      burst(0.3, 0.05, t, 'bandpass', 900, 400, 4);
      burst(0.34, 0.06, t + 0.42, 'bandpass', 1500, 600, 5);
      tone('square', 220, 90, 0.12, 0.08, t + 0.44);
    },
    dryfire() { if (!on) return; const t = now(); burst(0.22, 0.03, t, 'bandpass', 2600, 1200, 8); },
    hit() { if (!on) return; const t = now(); burst(0.34, 0.09, t, 'lowpass', 900, 160, 1); tone('triangle', 190, 60, 0.16, 0.08, t); },
    gib() {
      if (!on) return; const t = now();
      burst(0.5, 0.22, t, 'lowpass', 1500, 90, 1);
      tone('sawtooth', 110, 30, 0.22, 0.24, t);
    },
    hurt() {
      if (!on) return; const t = now();
      tone('sawtooth', 320, 70, 0.3, 0.28, t);
      burst(0.4, 0.2, t, 'lowpass', 700, 120);
    },
    screech(lowish) {
      if (!on) return; const t = now();
      const base = lowish ? 260 : 700;
      tone('sawtooth', base, base * 2.4, 0.16, 0.28, t);
      tone('square', base * 1.5, base * 0.6, 0.09, 0.34, t, 30);
      burst(0.16, 0.3, t, 'bandpass', 2400, 900, 3);
    },
    roar() {
      if (!on) return; const t = now();
      tone('sawtooth', 90, 38, 0.5, 1.3, t);
      tone('square', 128, 51, 0.24, 1.2, t, 20);
      tone('sawtooth', 61, 24, 0.4, 1.6, t, -25);
      burst(0.42, 1.4, t, 'lowpass', 1200, 90);
    },
    pickup() {
      if (!on) return; const t = now();
      [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.16, 0.1, t + i * 0.055));
    },
    bigpickup() {
      if (!on) return; const t = now();
      [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.2, 0.28, t + i * 0.075));
      burst(0.2, 0.9, t, 'bandpass', 3000, 500, 2);
    },
    wave() {
      if (!on) return; const t = now();
      tone('sawtooth', 140, 70, 0.22, 0.7, t);
      tone('sawtooth', 210, 105, 0.16, 0.7, t + 0.02);
    },
    heartbeat() {
      if (!on) return; const t = now();
      tone('sine', 68, 30, 0.55, 0.16, t);
      tone('sine', 62, 26, 0.42, 0.2, t + 0.24);
    },
    crack() { if (!on) return; const t = now(); burst(0.45, 0.14, t, 'bandpass', 2200, 500, 3); tone('square', 300, 120, 0.16, 0.1, t); },
    secret() {
      if (!on) return; const t = now();
      tone('sine', 60, 1200, 0.3, 1.6, t);
      tone('sawtooth', 1200, 60, 0.16, 1.8, t);
      burst(0.3, 2.0, t, 'bandpass', 400, 6000, 1.4);
    },
    god() {
      if (!on) return; const t = now();
      [130, 164, 196, 261, 392, 523].forEach((f, i) => { tone('sawtooth', f, f * 2, 0.18, 2.4, t + i * 0.04); });
      burst(0.4, 2.6, t, 'lowpass', 200, 5000);
    },
    whisper() {
      if (!on) return; const t = now();
      burst(0.13, 0.5 + Math.random() * 0.5, t, 'bandpass', 900 + Math.random() * 1400, 400, 7);
    },
    burn() { if (!on) return; const t = now(); burst(0.09, 0.2, t, 'highpass', 3000, 1400); },
    doorOpen() {
      if (!on) return; const t = now();
      tone('sawtooth', 40, 130, 0.34, 2.2, t);
      burst(0.3, 2.4, t, 'lowpass', 300, 1600);
    },
    /* Each SCAR mark drifts further from a rifle crack toward a laser: the
       noise body thins out, the tone rises and the sweep gets cleaner. */
    scarMk(lv) {
      if (!on) return; const t = now();
      const k = Math.min(1, (lv - 1) / 9);          // 0 = rifle, 1 = beam weapon
      const pitch = 1 + k * 0.9 + ((lv * 0.37) % 0.35);
      burst(0.5 * (1 - k * 0.55), 0.07 - k * 0.03, t, 'lowpass', (2600 + k * 3000) * pitch, 300 + k * 900, 1);
      tone('square', 150 * pitch, 44 * pitch, 0.24 * (1 - k * 0.4), 0.09, t);
      if (k > 0.15) {
        tone('sawtooth', 900 * pitch, 180 * pitch, 0.10 + k * 0.16, 0.10 + k * 0.05, t);
        tone('sine', 1600 * pitch, 400 * pitch, 0.06 + k * 0.12, 0.08, t);
      }
      if (k > 0.6) burst(0.16, 0.10, t, 'bandpass', 4200 * pitch, 1400, 5);
    },

    /* ---- weapons ---- */
    shotgun() {
      if (!on) return; const t = now();
      burst(0.7, 0.16, t, 'lowpass', 2200, 140, 1);
      burst(0.3, 0.34, t, 'highpass', 900, 400);
      tone('square', 110, 30, 0.34, 0.18, t);
    },
    nailgun() {
      if (!on) return; const t = now();
      burst(0.3, 0.035, t, 'bandpass', 4200, 2200, 6);
      tone('square', 420, 190, 0.16, 0.045, t);
    },
    plasma() {
      if (!on) return; const t = now();
      tone('sine', 880, 210, 0.24, 0.16, t);
      tone('square', 1320, 320, 0.10, 0.14, t, 18);
      burst(0.16, 0.16, t, 'bandpass', 2600, 800, 4);
    },
    minigun(spin) {
      if (!on) return; const t = now();
      burst(0.34, 0.05, t, 'lowpass', 1800 + spin * 1400, 260, 1);
      tone('square', 90 + spin * 60, 40, 0.18, 0.055, t);
    },
    spinup(v) {
      if (!on) return; const t = now();
      tone('sawtooth', 60 + v * 260, 70 + v * 300, 0.10, 0.14, t);
    },
    /* THE DELI SLICER. A wheel coming off its spindle: the whirr rises as it
       leaves (it is speeding up, not firing), and a thin ring of rim on top so
       it lands as steel rather than as another plasma noise. */
    slicer() {
      if (!on) return; const t = now();
      tone('sawtooth', 300, 1150, 0.15, 0.16, t);
      tone('square', 1800, 2400, 0.06, 0.10, t, 14);
      burst(0.32, 0.13, t, 'bandpass', 3600, 1400, 7);
    },
    // and back onto it. Short, bright, upward — a catch, not an impact.
    sliceHome() {
      if (!on) return; const t = now();
      burst(0.22, 0.05, t, 'bandpass', 2400, 5200, 9);
      tone('square', 640, 1280, 0.06, 0.05, t);
    },
    railgun() {
      if (!on) return; const t = now();
      tone('sawtooth', 2200, 90, 0.4, 0.5, t);
      tone('square', 1400, 60, 0.22, 0.55, t, -20);
      burst(0.55, 0.5, t, 'lowpass', 6000, 200);
    },
    railcharge() {
      if (!on) return; const t = now();
      tone('sine', 200, 1500, 0.14, 0.45, t);
    },
    beam() {
      if (!on) return; const t = now();
      tone('sawtooth', 620 + Math.random() * 180, 380, 0.09, 0.09, t);
      burst(0.10, 0.09, t, 'bandpass', 3400, 1600, 5);
    },
    /* ---- reload stages ---- */
    magOut() { if (!on) return; const t = now(); burst(0.3, 0.06, t, 'bandpass', 1100, 380, 5); tone('square', 260, 120, 0.10, 0.06, t); },
    magIn()  { if (!on) return; const t = now(); burst(0.34, 0.07, t, 'bandpass', 1600, 520, 6); tone('square', 180, 320, 0.12, 0.07, t); },
    rack()   { if (!on) return; const t = now(); burst(0.4, 0.05, t, 'bandpass', 2600, 900, 7); burst(0.3, 0.06, t + 0.06, 'bandpass', 1400, 600, 6); },
    magDrop(){ if (!on) return; const t = now() + 0.28; burst(0.18, 0.07, t, 'bandpass', 3200, 900, 8); },
    /* ---- economy ---- */
    coin() { if (!on) return; const t = now(); tone('square', 988, 988, 0.16, 0.07, t); tone('square', 1319, 1319, 0.14, 0.12, t + 0.06); },
    card() {
      if (!on) return; const t = now();
      [1046, 1318, 1568, 2093].forEach((f, i) => tone('sine', f, f, 0.16, 0.5, t + i * 0.04));
      burst(0.14, 0.7, t, 'bandpass', 5000, 2000, 3);
    },
    buy() { if (!on) return; const t = now(); [523, 784, 1046, 1568].forEach((f, i) => tone('triangle', f, f, 0.2, 0.16, t + i * 0.06)); },
    denied() { if (!on) return; const t = now(); tone('square', 180, 90, 0.24, 0.16, t); tone('square', 140, 70, 0.2, 0.2, t + 0.1); },
    step() { if (!on) return; const t = now(); burst(0.10, 0.06, t, 'lowpass', 420 + Math.random() * 220, 120); },
    boom() {
      if (!on) return; const t = now();
      burst(0.85, 0.7, t, 'lowpass', 3000, 60);
      tone('sawtooth', 130, 22, 0.55, 0.8, t);
      tone('sine', 70, 16, 0.5, 1.1, t);
      burst(0.3, 1.2, t, 'highpass', 400, 2200);
    },
    nadeBounce() { if (!on) return; const t = now(); burst(0.16, 0.05, t, 'bandpass', 1800, 700, 7); },

    /* ------------------------------------------------------------
       Formant speech synthesis. A buzzing carrier is shaped by three
       bandpass "vocal tract" filters per syllable, with plosive noise
       bursts for the consonants. Used by the hidden things.
       ------------------------------------------------------------ */
    speak(syl, f0, vol) {
      if (!on) return;
      const base = f0 || 265;
      const V = vol === undefined ? 1.0 : vol;
      let t = now() + 0.05;
      for (const s of syl) {
        if (s.con === 'm' || s.con === 'n') tone('sine', base * 0.5, base * 0.5, 0.16 * V, 0.08, t);
        else if (s.con) burst(0.30 * V, 0.04, t, 'bandpass', s.con === 'd' || s.con === 't' ? 2600 : 1500, s.con === 'd' ? 1600 : 800, 4);
        const vt = t + 0.04;

        const car = ac.createOscillator();
        car.type = 'sawtooth';
        car.frequency.setValueAtTime(base * s.p, vt);
        car.frequency.linearRampToValueAtTime(base * s.p * 1.06, vt + s.d);
        const vib = ac.createOscillator(); vib.frequency.value = 11;
        const vg = ac.createGain(); vg.gain.value = 24;
        vib.connect(vg); vg.connect(car.detune); vib.start(vt); vib.stop(vt + s.d + 0.1);

        const amp = ac.createGain();
        amp.gain.setValueAtTime(0.0001, vt);
        amp.gain.exponentialRampToValueAtTime(0.85 * V, vt + 0.035);
        amp.gain.setValueAtTime(0.85 * V, vt + s.d * 0.65);
        amp.gain.exponentialRampToValueAtTime(0.0001, vt + s.d);
        car.connect(amp);

        // a touch of sub under the voice so it carries on small speakers
        const sub = ac.createOscillator();
        sub.type = 'triangle'; sub.frequency.value = base * 0.5;
        const sg = ac.createGain();
        sg.gain.setValueAtTime(0.0001, vt);
        sg.gain.exponentialRampToValueAtTime(0.22 * V, vt + 0.04);
        sg.gain.exponentialRampToValueAtTime(0.0001, vt + s.d);
        sub.connect(sg); sg.connect(master);
        sub.start(vt); sub.stop(vt + s.d + 0.1);

        const gains = [1.0, 0.6, 0.28], qs = [9, 12, 14];
        s.F.forEach((f, i) => {
          const bp = ac.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = qs[i];
          const g = ac.createGain(); g.gain.value = gains[i] * 0.95 * V;
          amp.connect(bp); bp.connect(g); g.connect(master);
        });
        car.start(vt); car.stop(vt + s.d + 0.1);

        t += s.d + 0.045;
        if (s.post === 'z') {
          burst(0.28 * V, 0.24, t, 'bandpass', 3800, 3200, 9);
          tone('sawtooth', base * 0.8, base * 0.7, 0.16 * V, 0.22, t);
          t += 0.2;
        }
      }
      return t;
    },
    modagaz(f0) {
      const VO = [400, 800, 2600], VA = [730, 1090, 2440];
      api.speak([
        { con: 'm', F: VO, d: 0.24, p: 1.00 },
        { con: 'd', F: VA, d: 0.18, p: 1.12 },
        { con: 'g', F: VA, d: 0.32, p: 0.94, post: 'z' }
      ], f0 || 265, 1.15);
    },
    goromania(f0) {
      const VO = [400, 800, 2600], VA = [730, 1090, 2440], VI = [270, 2290, 3010];
      api.speak([
        { con: 'g', F: VO, d: 0.19, p: 1.00 },
        { con: 'r', F: VO, d: 0.17, p: 1.08 },
        { con: 'm', F: VA, d: 0.19, p: 1.18 },
        { con: 'n', F: VI, d: 0.15, p: 1.26 },
        { con: '',  F: VA, d: 0.34, p: 0.90 }
      ], f0 || 240, 1.25);
    },
    glock() {
      if (!on) return; const t = now();
      burst(0.24, 0.045, t, 'lowpass', 2400, 320, 1);
      tone('square', 210, 70, 0.16, 0.05, t);
    },
    ram() {
      if (!on) return; const t = now();
      burst(0.4, 0.16, t, 'lowpass', 1400, 160, 1);
      tone('sawtooth', 180, 60, 0.26, 0.18, t);
    },
    breath() {
      if (!on) return; const t = now();
      burst(0.16, 0.55, t, 'bandpass', 320 + Math.random() * 260, 180, 2.4);
    },

    death() {
      if (!on) return; const t = now();
      tone('sawtooth', 220, 22, 0.45, 2.6, t);
      tone('sine', 110, 18, 0.35, 3.0, t);
      burst(0.3, 2.4, t, 'lowpass', 900, 60);
    }
  };
  return api;
})();
