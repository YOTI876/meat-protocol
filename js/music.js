/* ============================================================
   MEAT PROTOCOL — generative score.

   Original music, synthesized live. No samples, no loops, nothing
   transcribed from anywhere. It is written in the idiom roguelike
   dungeon-crawlers tend to live in: minor and phrygian modes, a
   syncopated low pulse, arpeggios that circle, percussion that
   accumulates — but the notes are this file's own.

   Five layers fade in and out on an intensity value the game drives:
     pad    always      the room breathing
     bass   >0.10       the pulse
     drums  >0.28       kick / snare / hats, patterns thicken with intensity
     arp    >0.42       circling 16ths
     stab   boss only   dissonant minor-2nd hits

   Scheduling is lookahead: a 25ms timer queues every note ~120ms early
   with exact AudioContext timestamps, so nothing drifts or stutters when
   the main thread is busy drawing 70 enemies.
   ============================================================ */
const MUSIC = (() => {
  let ac = null, out = null, noise = null;
  let running = false, timer = null, stopToken = 0;

  const LOOKAHEAD = 0.12, TICK_MS = 25;
  let step = 0, nextT = 0;

  let bpm = 96, bpmTarget = 96;
  let inten = 0, intenTarget = 0;
  let floorIdx = 0, boss = false, menuMode = false;

  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const PHRYG = [0, 1, 3, 5, 7, 8, 10];

  /* One key per floor. Deeper floors sit lower, run faster and lean
     phrygian, which is where the flat second lives — the sour interval. */
  const KEYS = [
    { root: 110.00, scale: MINOR, bpm: 94,  prog: [0, 5, 3, 6] },  // A minor
    { root: 92.50,  scale: MINOR, bpm: 100, prog: [0, 3, 5, 4] },  // F# minor
    { root: 73.42,  scale: PHRYG, bpm: 107, prog: [0, 1, 5, 4] },  // D phrygian
    { root: 65.41,  scale: PHRYG, bpm: 113, prog: [0, 6, 1, 0] }   // C phrygian
  ];
  const key = () => KEYS[Math.min(floorIdx, KEYS.length - 1)];

  function makeNoise() {
    const len = ac.sampleRate * 2;
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /* degree is scale-relative and may run past an octave in either direction */
  function nf(degree, octave) {
    const k = key(), n = k.scale.length;
    const wrap = ((degree % n) + n) % n;
    const oct = (octave || 0) + Math.floor(degree / n);
    return k.root * Math.pow(2, (k.scale[wrap] + 12 * oct) / 12);
  }

  const busses = {};
  function bus(name, vol) {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(out);
    busses[name] = { g, vol };
    return g;
  }
  function setBus(name, amount, t) {
    const b = busses[name];
    if (b) b.g.gain.setTargetAtTime(Math.max(0, amount) * b.vol, t, 0.35);
  }

  /* ---------- voices ---------- */
  function env(node, dest, vol, atk, dec, t) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
    node.connect(g); g.connect(dest);
    return g;
  }

  function vKick(t, vol) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(41, t + 0.13);
    env(o, busses.drums.g, vol, 0.004, 0.19, t);
    o.start(t); o.stop(t + 0.26);
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    s.connect(f); env(f, busses.drums.g, vol * 0.35, 0.002, 0.03, t);
    s.start(t); s.stop(t + 0.06);
  }
  function vSnare(t, vol) {
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1750; f.Q.value = 0.8;
    s.connect(f); env(f, busses.drums.g, vol, 0.003, 0.14, t);
    s.start(t); s.stop(t + 0.2);
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(232, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.09);
    env(o, busses.drums.g, vol * 0.4, 0.003, 0.09, t);
    o.start(t); o.stop(t + 0.15);
  }
  function vHat(t, vol, open) {
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7600;
    s.connect(f); env(f, busses.drums.g, vol, 0.002, open ? 0.13 : 0.032, t);
    s.start(t); s.stop(t + 0.2);
  }
  function vBass(t, f0, dur, vol) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0;
    const sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.value = f0 / 2;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280 + inten * 900, t);
    lp.frequency.exponentialRampToValueAtTime(190, t + dur);
    lp.Q.value = 6;
    o.connect(lp); sub.connect(lp);
    env(lp, busses.bass.g, vol, 0.008, dur, t);
    o.start(t); o.stop(t + dur + 0.06);
    sub.start(t); sub.stop(t + dur + 0.06);
  }
  function vArp(t, f0, vol) {
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f0;
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f0; o2.detune.value = 9;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 3;
    o.connect(lp); o2.connect(lp);
    env(lp, busses.arp.g, vol, 0.006, 0.16, t);
    o.start(t); o.stop(t + 0.24); o2.start(t); o2.stop(t + 0.24);
  }
  function vPad(t, degree, dur) {
    // root, fifth and third an octave up — sustained, slowly opening filter
    const tones = [nf(degree, 0), nf(degree + 4, 0), nf(degree + 2, 1)];
    tones.forEach((f0, i) => {
      const o = ac.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f0;
      o.detune.value = (i - 1) * 7;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, t);
      lp.frequency.linearRampToValueAtTime(430 + inten * 700, t + dur * 0.6);
      lp.frequency.linearRampToValueAtTime(240, t + dur);
      o.connect(lp);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14 / (i + 1), t + dur * 0.25);
      g.gain.setValueAtTime(0.14 / (i + 1), t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      lp.connect(g); g.connect(busses.pad.g);
      o.start(t); o.stop(t + dur + 0.1);
    });
  }
  function vStab(t, degree) {
    // the chord tone and the note a semitone above it, together
    const f0 = nf(degree, 1);
    [f0, f0 * Math.pow(2, 1 / 12)].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
      o.connect(lp);
      env(lp, busses.stab.g, 0.16 - i * 0.05, 0.006, 0.32, t);
      o.start(t); o.stop(t + 0.42);
    });
  }

  /* ---------- patterns ---------- */
  // 16 steps to the bar. true = hit.
  const P_KICK  = [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0];
  const P_KICK2 = [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0];
  const P_SNARE = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1];
  const P_BASS  = [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0];
  const ARP_UP  = [0, 2, 4, 6, 4, 2];
  const ARP_DN  = [6, 4, 2, 0, 2, 4];

  function scheduleStep(s, t) {
    const k = key();
    const bar = Math.floor(s / 16) % 4;
    const i16 = s % 16;
    const deg = k.prog[bar];
    const hot = boss ? 1 : inten;

    if (i16 === 0) vPad(t, deg, (60 / bpm) * 4 * 0.98);

    if (hot > 0.10 && P_BASS[i16]) {
      const oct = (i16 === 8 && hot > 0.55) ? 1 : 0;
      vBass(t, nf(deg, oct - 1), 60 / bpm * 0.45, 0.30);
    }

    if (hot > 0.28) {
      const kp = hot > 0.62 ? P_KICK2 : P_KICK;
      if (kp[i16]) vKick(t, 0.5);
      if (P_SNARE[i16]) vSnare(t, 0.24);
      if (hot > 0.40 && i16 % 2 === 0) vHat(t, i16 % 4 === 0 ? 0.10 : 0.06, false);
      if (hot > 0.75 && i16 % 2 === 1) vHat(t, 0.05, i16 === 15);
    }

    if (hot > 0.42) {
      const seq = (Math.floor(s / 32) % 2) ? ARP_DN : ARP_UP;
      const nIdx = Math.floor(s / 2) % seq.length;
      if (s % 2 === 0) vArp(t, nf(deg + seq[nIdx], 1), 0.085 + hot * 0.05);
      if (hot > 0.8 && i16 === 14) vArp(t, nf(deg + 7, 1), 0.09);
    }

    if (boss && (i16 === 0 || i16 === 10)) vStab(t, deg);
  }

  function tick() {
    if (!running) return;
    // ease tempo and intensity toward their targets
    bpm += (bpmTarget - bpm) * 0.04;
    inten += (intenTarget - inten) * 0.03;
    const now = ac.currentTime;
    const spb = 60 / bpm / 4;                       // seconds per 16th
    while (nextT < now + LOOKAHEAD) {
      if (nextT < now) nextT = now + 0.02;          // recover from a stall
      scheduleStep(step, nextT);
      nextT += spb;
      step = (step + 1) % 64;
    }
    const t = ac.currentTime;
    const hot = boss ? 1 : inten;
    setBus('pad',   menuMode ? 0.85 : 0.55 + hot * 0.45, t);
    setBus('bass',  menuMode ? 0.35 : (hot > 0.10 ? 0.75 + hot * 0.25 : 0), t);
    setBus('drums', menuMode ? 0    : (hot > 0.28 ? 0.6 + hot * 0.4 : 0), t);
    setBus('arp',   menuMode ? 0.25 : (hot > 0.42 ? 0.55 + hot * 0.45 : 0), t);
    setBus('stab',  boss ? 1 : 0, t);
  }

  return {
    attach(context, destination) {
      if (ac) return;
      ac = context; out = destination;
      noise = makeNoise();
      bus('pad', 0.55); bus('bass', 0.42); bus('drums', 0.40);
      bus('arp', 0.30); bus('stab', 0.34);
    },
    start() {
      if (!ac) return;
      stopToken++;                       // cancels any stop still counting down
      if (timer) clearInterval(timer);
      running = true;
      step = 0; nextT = ac.currentTime + 0.1;
      timer = setInterval(tick, TICK_MS);
    },
    stop(fade) {
      if (!ac) return;
      const t = ac.currentTime;
      for (const k in busses) busses[k].g.gain.setTargetAtTime(0, t, fade === undefined ? 0.4 : fade);
      const mine = ++stopToken;
      setTimeout(() => {
        if (mine !== stopToken) return;  // something restarted us in the meantime
        running = false;
        if (timer) clearInterval(timer);
        timer = null;
      }, 1400);
    },
    setFloor(i) {
      floorIdx = i | 0;
      bpmTarget = KEYS[Math.min(floorIdx, KEYS.length - 1)].bpm;
      menuMode = false;
    },
    setIntensity(v) { intenTarget = Math.max(0, Math.min(1, v)); },
    setBoss(b) {
      boss = !!b;
      const base = KEYS[Math.min(floorIdx, KEYS.length - 1)].bpm;
      bpmTarget = b ? base * 1.12 : base;
    },
    menu() {
      menuMode = true; boss = false;
      floorIdx = 0; bpmTarget = 78; intenTarget = 0.2;
      if (!ac) return;
      stopToken++;
      if (timer) clearInterval(timer);
      running = true;
      nextT = ac.currentTime + 0.1;
      timer = setInterval(tick, TICK_MS);
    },
    isRunning() { return running; },
    debug() { return { bpm: Math.round(bpm), inten: +inten.toFixed(2), boss, floorIdx, step, menuMode, running }; }
  };
})();
