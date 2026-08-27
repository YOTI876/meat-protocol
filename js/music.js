/* ============================================================
   MEAT PROTOCOL — the score.

   Two pieces, not one.

     THE FLOOR   the run itself. Phrygian, a gallop under it, and a full
                 band from the first wave rather than a pad and a hope.
     THE THING   what a boss brings with it. Locrian, faster, double kick,
                 its own riff, its own lead, and the stabs.

   Layers fade in on an intensity value the game drives, but intensity no
   longer decides whether there IS music — only how much of the band is
   playing. That distinction is the whole difference between a floor that
   sounds empty and one that sounds like a fight.

   Scheduling is lookahead: a timer queues every note ~750ms early with exact
   AudioContext timestamps, so the music does not follow the main thread
   around when it is busy drawing seventy enemies.

   If you would rather have a real recording than this, you can — see
   "a real recording" near the bottom, and audio/README.md.
   ============================================================ */
const MUSIC = (() => {
  let ac = null, out = null, noise = null;
  let running = false, timer = null, stopToken = 0;

  /* LOOKAHEAD was 0.12s, which is less than one bad frame in this game: a
     130ms stall and the queue ran dry in the middle of a bar. 0.75s now. The
     cost is that a change in intensity takes up to that long to become
     audible, and for music that is not a cost. */
  const LOOKAHEAD = 0.75, TICK_MS = 50;
  const MAX_CATCHUP = 96;          // a clock jump must not queue an hour of music

  let step = 0, nextT = 0, lastEase = 0;

  let bpm = 96, bpmTarget = 96;
  let inten = 0, intenTarget = 0;
  let floorIdx = 0, boss = false, menuMode = false;

  /* ---------- the reaper ----------

     Every note used to build a little chain of nodes, wire it to a bus and
     walk away from it. There was not one disconnect() in this file, so the
     graph only ever grew, and a Web Audio node that is still connected is
     still being rendered whether or not anything is feeding it.

     Measured, with the boss arrangement running: the audio clock fell to
     0.45x real time within five seconds and 0.27x by thirty, while a bare
     AudioContext opened alongside it in the same tab held 0.985x. The score
     was not "lagging" in any figurative sense — it was being rendered at a
     quarter speed by a thread that could not keep up, and cutting out when it
     missed its deadline outright.

     So now everything that gets connected also gets an end time, and the
     scheduler disconnects it once it is past. The list stays small because it
     is swept every tick; the sweep is a backwards swap-remove because voices
     do not finish in the order they start (a pad lasts two bars, a chug under
     it lasts 130ms). */
  let live = [];
  function retire(end, ...nodes) { live.push({ end, nodes }); }
  function reap(now) {
    for (let i = live.length - 1; i >= 0; i--) {
      if (live[i].end >= now) continue;
      const n = live[i].nodes;
      for (let j = 0; j < n.length; j++) { try { n[j].disconnect(); } catch (e) {} }
      live[i] = live[live.length - 1]; live.pop();
    }
  }

  /* ---------- scales, roots, patterns ---------- */
  const PHRYG = [0, 1, 3, 5, 7, 8, 10];
  const LOCR  = [0, 1, 3, 5, 6, 8, 10];   // flat fifth — nothing here resolves

  /* Root and tempo come from the floor, so going down still darkens and
     quickens everything. Scale and chord movement come from the track, so a
     boss is a different piece of music on every floor rather than the same
     piece played louder. */
  const ROOTS = [
    { root: 55.00, bpm: 84 },   // A
    { root: 49.00, bpm: 90 },   // G
    { root: 43.65, bpm: 96 },   // F
    { root: 38.89, bpm: 101 }   // D#
  ];
  const rootOf = () => ROOTS[Math.min(floorIdx, ROOTS.length - 1)];

  // 16 steps to the bar. 1 = hit.
  const P_KICK  = [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0];
  const P_KICK2 = [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0];
  const P_KICK3 = [1,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,1,0];   // double time, boss only
  const P_SNARE = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1];
  const P_SNARE2= [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,1,0];
  const P_BASS  = [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0];
  const P_BASS2 = [1,0,1,0, 1,0,1,0, 1,0,1,1, 0,1,0,1];
  const ARP_UP  = [0, 2, 4, 6, 4, 2];
  const ARP_DN  = [6, 4, 2, 0, 2, 4];

  /* A gallop — the figure that makes a riff sound like it is running. Long,
     short-short, long, short-short. */
  const P_CHUG  = [1,0,1,1, 0,0,1,1, 1,0,1,1, 0,1,1,0];
  const P_CHUG2 = [1,1,1,1, 0,1,1,1, 1,1,1,1, 0,1,1,1];   // flat out
  const P_CHUG3 = [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,1,1];   // boss: the hole moves

  // where the riff walks off the root, in scale degrees
  const RIFF    = [0,0,0,1, 0,0,0,3, 0,0,0,1, 0,5,4,0];
  const RIFF_B  = [0,0,1,0, 0,3,0,1, 0,0,1,0, 4,3,1,0];   // walks further, lands lower
  const LEAD_A  = [7, 6, 4, 6, 7, 9, 7, 6];
  const LEAD_B  = [4, 6, 7, 9, 11, 9, 7, 6];
  const LEAD_C  = [7, 8, 7, 5, 4, 5, 7, 8];               // boss: leans on the flat 2
  const LEAD_D  = [11, 10, 8, 7, 8, 7, 5, 4];

  const TRACKS = {
    /* THE FLOOR — phrygian, driving, and it does not wait to be invited. */
    wave: { scale: PHRYG, prog: [0, 1, 0, 6], bpmMul: 1.00,
            kick: [P_KICK, P_KICK2], snare: P_SNARE, bass: P_BASS,
            chug: [P_CHUG, P_CHUG2], riff: RIFF, lead: [LEAD_A, LEAD_B],
            stab: false, dread: 1.0 },
    /* THE THING — locrian, a seventh faster, and the kit never lets up. */
    boss: { scale: LOCR, prog: [0, 4, 1, 5], bpmMul: 1.14,
            kick: [P_KICK2, P_KICK3], snare: P_SNARE2, bass: P_BASS2,
            chug: [P_CHUG2, P_CHUG3], riff: RIFF_B, lead: [LEAD_C, LEAD_D],
            stab: true, dread: 1.35 }
  };
  const trk = () => TRACKS[boss ? 'boss' : 'wave'];

  function makeNoise() {
    const len = ac.sampleRate * 2;
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /* degree is scale-relative and may run past an octave in either direction */
  function nf(degree, octave) {
    const sc = trk().scale, n = sc.length;
    const wrap = ((degree % n) + n) % n;
    const oct = (octave || 0) + Math.floor(degree / n);
    return rootOf().root * Math.pow(2, (sc[wrap] + 12 * oct) / 12);
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
    const g = env(o, busses.drums.g, vol, 0.004, 0.19, t);
    o.start(t); o.stop(t + 0.26);
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    s.connect(f);
    const g2 = env(f, busses.drums.g, vol * 0.35, 0.002, 0.03, t);
    s.start(t); s.stop(t + 0.06);
    retire(t + 0.3, o, g, s, f, g2);
  }
  function vSnare(t, vol) {
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1750; f.Q.value = 0.8;
    s.connect(f);
    const g = env(f, busses.drums.g, vol, 0.003, 0.14, t);
    s.start(t); s.stop(t + 0.2);
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(232, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.09);
    const g2 = env(o, busses.drums.g, vol * 0.4, 0.003, 0.09, t);
    o.start(t); o.stop(t + 0.15);
    retire(t + 0.25, s, f, g, o, g2);
  }
  function vHat(t, vol, open) {
    const s = ac.createBufferSource(); s.buffer = noise;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7600;
    s.connect(f);
    const g = env(f, busses.drums.g, vol, 0.002, open ? 0.13 : 0.032, t);
    s.start(t); s.stop(t + 0.2);
    retire(t + 0.25, s, f, g);
  }
  function vBass(t, f0, dur, vol) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0;
    const sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.value = f0 / 2;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280 + inten * 900, t);
    lp.frequency.exponentialRampToValueAtTime(190, t + dur);
    lp.Q.value = 6;
    o.connect(lp); sub.connect(lp);
    const g = env(lp, busses.bass.g, vol, 0.008, dur, t);
    o.start(t); o.stop(t + dur + 0.06);
    sub.start(t); sub.stop(t + dur + 0.06);
    retire(t + dur + 0.12, o, sub, lp, g);
  }
  function vArp(t, f0, vol) {
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f0;
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f0; o2.detune.value = 9;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 3;
    o.connect(lp); o2.connect(lp);
    const g = env(lp, busses.arp.g, vol, 0.006, 0.16, t);
    o.start(t); o.stop(t + 0.24); o2.start(t); o2.stop(t + 0.24);
    retire(t + 0.3, o, o2, lp, g);
  }
  function vPad(t, degree, dur) {
    // Root, the flat second above it and the third an octave up. That second is
    // a semitone rub against the root and it never goes away.
    const tones = [nf(degree, 0), nf(degree + 1, 1), nf(degree + 2, 1)];
    tones.forEach((f0, i) => {
      const o = ac.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f0;
      // heavy, uneven detune so the layers beat against each other
      o.detune.value = (i - 1) * 16 + (i === 1 ? 11 : 0);
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
      retire(t + dur + 0.16, o, lp, g);
    });
  }
  /* A slow tritone smear underneath everything — the interval that refuses to
     resolve. Rises out of the floor, bends, and sinks back. */
  function vDread(t, degree, dur, amt) {
    const f0 = nf(degree, -1);
    [f0, f0 * Math.pow(2, 6 / 12)].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.985, t);
      o.frequency.linearRampToValueAtTime(f * 1.02, t + dur * 0.55);
      o.frequency.linearRampToValueAtTime(f * 0.97, t + dur);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 4;
      o.connect(lp);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((0.10 - i * 0.035) * (amt || 1), t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      lp.connect(g); g.connect(busses.pad.g);
      o.start(t); o.stop(t + dur + 0.1);
      retire(t + dur + 0.16, o, lp, g);
    });
  }

  /* Something metal being dragged, somewhere off to the side. Irregular. */
  function vScrape(t) {
    const s = ac.createBufferSource();
    s.buffer = noise;
    s.playbackRate.value = 0.18 + Math.random() * 0.5;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400 + Math.random() * 2600, t);
    bp.frequency.exponentialRampToValueAtTime(500 + Math.random() * 900, t + 0.7);
    bp.Q.value = 14;
    s.connect(bp);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    bp.connect(g); g.connect(busses.pad.g);
    s.start(t); s.stop(t + 0.9);
    retire(t + 0.96, s, bp, g);
  }

  /* A high thread of a tone that shouldn't be in the key at all. */
  function vWhine(t) {
    const o = ac.createOscillator();
    o.type = 'sine';
    const f = 1900 + Math.random() * 1700;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (0.86 + Math.random() * 0.3), t + 1.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.016, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(g); g.connect(busses.pad.g);
    o.start(t); o.stop(t + 1.8);
    retire(t + 1.86, o, g);
  }

  /* ---------- guitar ----------

     The score was already phrygian and locrian, which is the harmony metal
     borrowed in the first place, so a distorted layer does not have to be
     bolted on — it plays the same degrees everything else does.

     Three voices, because a rhythm guitar is not one sound:
       vChug    palm-muted low root, gallop pattern, the engine
       vPower   root + fifth + octave, held, the wall behind it
       vLead    one voice up top with vibrato and a bend into the note

     THE AMPS ARE BUILT ONCE. They used to be built per note: a WaveShaper at
     oversample '4x' plus three biquads, about ten of each a second at full
     tilt, none of them ever released. That one detail is most of why the
     audio thread was drowning. Now there are exactly three amplifiers for the
     whole run and a note is two oscillators and an envelope.

     The envelope sits BEFORE the distortion, which is deliberate: how hard a
     note drives the amp is how distorted it comes out, and a palm mute is
     exactly a note that does not drive it very hard for very long. */
  let distCurve = null, amps = null;
  function makeDistCurve(k) {
    const N = 8192, c = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i * 2) / N - 1;
      c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));   // soft asymptotic clip
    }
    return c;
  }

  /* A cabinet, roughly: nothing below 85Hz, nothing above 3.9k, and a peak in
     the low mids where a speaker cone lives. Without this a distorted saw is a
     wasp in a jar rather than an amplifier. */
  function amp(drive, dest) {
    const pre = ac.createGain(); pre.gain.value = drive;
    const ws = ac.createWaveShaper();
    if (!distCurve) distCurve = makeDistCurve(28);
    ws.curve = distCurve;
    ws.oversample = '2x';        // 4x cost four times the samples for no audible gain here
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85;
    const mid = ac.createBiquadFilter(); mid.type = 'peaking';
    mid.frequency.value = 780; mid.Q.value = 1.1; mid.gain.value = 5;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3900; lp.Q.value = 0.7;
    pre.connect(ws); ws.connect(hp); hp.connect(mid); mid.connect(lp); lp.connect(dest);
    return pre;
  }

  function vChug(t, f0, vol) {
    // palm mute: the note is choked almost immediately, so it reads as a hit
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.055);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    g.connect(amps.chug);
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0;
    const o2 = ac.createOscillator(); o2.type = 'square';
    o2.frequency.value = f0; o2.detune.value = -7;
    o.connect(g); o2.connect(g);
    o.start(t); o.stop(t + 0.2); o2.start(t); o2.stop(t + 0.2);
    retire(t + 0.26, o, o2, g);
  }

  function vPower(t, degree, dur, vol) {
    // root, fifth, octave — a power chord has no third, which is why it fits a
    // scale whose third is the thing that keeps changing
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(amps.power);
    const f0 = nf(degree, -1);
    const kept = [g];
    [[f0, 0], [f0 * Math.pow(2, 7 / 12), 6], [f0 * 2, -5]].forEach(([f, det]) => {
      const o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.1);
      kept.push(o);
    });
    retire(t + dur + 0.16, ...kept);
  }

  function vLead(t, f0, dur, vol) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(amps.lead);
    const o = ac.createOscillator(); o.type = 'sawtooth';
    // bend up into the note, then vibrato — the two things that stop a
    // synthesised lead sounding like an organ
    o.frequency.setValueAtTime(f0 * 0.945, t);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.055);
    const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.6;
    const lg = ac.createGain(); lg.gain.value = f0 * 0.011;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g);
    o.start(t); o.stop(t + dur + 0.1);
    lfo.start(t); lfo.stop(t + dur + 0.1);
    retire(t + dur + 0.16, o, lfo, lg, g);
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
      const g = env(lp, busses.stab.g, 0.16 - i * 0.05, 0.006, 0.32, t);
      o.start(t); o.stop(t + 0.42);
      retire(t + 0.48, o, lp, g);
    });
  }

  /* ---------- the arrangement ---------- */
  function scheduleStep(s, t) {
    const T = trk();
    const bar = Math.floor(s / 16) % 4;
    const i16 = s % 16;
    const deg = T.prog[bar];

    /* THE FLOOR never drops below a bit over half. Intensity used to decide
       whether there was a band at all — wave 1 of floor 1 works out to 0.26,
       which sat under the drum gate, the guitar gate and the arp gate, so the
       answer was a pad and a bass line. It moves the band from half-strength
       to flat out now; it does not switch it off. A boss is always flat out. */
    const hot = boss ? 1 : (menuMode ? inten : 0.45 + inten * 0.55);

    const barLen = (60 / bpm) * 4;
    if (i16 === 0) {
      vPad(t, deg, barLen * 0.98);
      if (bar % 2 === 0) vDread(t, deg, barLen * 1.9, T.dread);
    }
    // irregular room noises — never on the beat, never the same gap twice
    if (Math.random() < 0.010 + hot * 0.012) vScrape(t + Math.random() * 0.2);
    if (i16 === 7 && Math.random() < 0.16) vWhine(t);

    if (T.bass[i16]) {
      const oct = (i16 === 8 && hot > 0.55) ? 1 : 0;
      vBass(t, nf(deg, oct - 1), 60 / bpm * 0.45, 0.30);
    }

    const kp = T.kick[hot > 0.62 ? 1 : 0];
    if (kp[i16]) vKick(t, 0.5);
    if (T.snare[i16]) vSnare(t, 0.24);
    if (hot > 0.40 && i16 % 2 === 0) vHat(t, i16 % 4 === 0 ? 0.10 : 0.06, false);
    if (hot > 0.75 && i16 % 2 === 1) vHat(t, 0.05, i16 === 15);

    /* ---- guitar ---- */
    const cp = T.chug[hot > 0.66 ? 1 : 0];
    if (cp[i16]) vChug(t, nf(deg + T.riff[i16], -1), 0.24 + hot * 0.10);
    // the wall arrives on the bar, and only once it is properly loud
    if (i16 === 0 && hot > 0.5) vPower(t, deg, barLen * 0.92, 0.13 + hot * 0.06);
    if (i16 === 8 && hot > 0.78) vPower(t, deg + 3, barLen * 0.44, 0.11);

    /* The lead is the last thing to arrive and the first to go. Two bars of
       eighths every fourth bar, so it is a hook and not a drone. */
    if (hot > 0.62 && (bar === 1 || bar === 3) && i16 % 2 === 0) {
      const L = T.lead[bar === 1 ? 0 : 1];
      vLead(t, nf(deg + L[(i16 / 2) | 0], 1), (60 / bpm) * 0.46, 0.085 + hot * 0.045);
    }

    if (hot > 0.42) {
      const seq = (Math.floor(s / 32) % 2) ? ARP_DN : ARP_UP;
      const nIdx = Math.floor(s / 2) % seq.length;
      if (s % 2 === 0) vArp(t, nf(deg + seq[nIdx], 1), 0.085 + hot * 0.05);
      if (hot > 0.8 && i16 === 14) vArp(t, nf(deg + 7, 1), 0.09);
    }

    if (T.stab && (i16 === 0 || i16 === 10)) vStab(t, deg);
  }

  function tick() {
    if (!running || !ac) return;
    const now = ac.currentTime;

    /* Ease toward the targets on WALL TIME, not per tick. The tick rate has
       changed twice; a per-tick factor silently changes how fast the music
       responds every time it does. */
    const dt = lastEase ? Math.min(0.5, now - lastEase) : 0;
    lastEase = now;
    bpm   += (bpmTarget - bpm)     * Math.min(1, dt * 1.6);
    inten += (intenTarget - inten) * Math.min(1, dt * 1.2);

    reap(now);

    if (!fileMode) {
      const spb = 60 / bpm / 4;                       // seconds per 16th
      let guard = MAX_CATCHUP;
      while (nextT < now + LOOKAHEAD && guard-- > 0) {
        if (nextT < now) nextT = now + 0.02;          // recover from a stall
        scheduleStep(step, nextT);
        nextT += spb;
        step = (step + 1) % 64;
      }
    }

    const t = now;
    const hot = boss ? 1 : (menuMode ? inten : 0.45 + inten * 0.55);
    const q = fileMode ? 0 : 1;                       // a recording gets the mix to itself
    setBus('pad',   q * (menuMode ? 0.85 : 0.55 + hot * 0.45), t);
    setBus('bass',  q * (menuMode ? 0.35 : 0.75 + hot * 0.25), t);
    setBus('drums', q * (menuMode ? 0    : 0.6 + hot * 0.4), t);
    setBus('gtr',   q * (menuMode ? 0    : 0.55 + hot * 0.45), t);
    setBus('arp',   q * (menuMode ? 0.25 : (hot > 0.42 ? 0.55 + hot * 0.45 : 0)), t);
    setBus('stab',  q * (boss ? 1 : 0), t);
  }

  /* ---------- a real recording, if you have one ----------

     Everything above is synthesised, and it is synthesised because I cannot
     go and take a rock track off the internet and put it in this repository:
     somebody owns it, and the ones that are genuinely free to use are free
     under licences that want crediting properly, which is your call to make
     and not mine.

     What the game can do is prefer a file when there is one. Drop a track in
     as audio/wave.* and audio/boss.* — ogg, mp3 or wav — and it plays those
     instead, looped, crossfading when a boss arrives. Everything else still
     works, because the file rides the same bus the synth does: the volume
     keys, mute, and the duck under a boss roar all still apply.

     Either file on its own is fine. If only audio/boss.ogg exists then bosses
     use it and the rest of the run stays synthesised. See audio/README.md. */
  const bufs = { wave: null, boss: null };
  let fileBus = null, fileSrc = null, fileGain = null, fileNow = null;
  let fileMode = false, filesTried = false;

  async function loadTrack(file) {
    if (!file) return null;
    try {
      const r = await fetch('audio/' + file);
      if (!r.ok) return null;
      return await ac.decodeAudioData(await r.arrayBuffer());
    } catch (e) { return null; }   // absent, or not something this browser decodes
  }

  /* Named in audio/tracks.json rather than probed for by convention. Probing
     meant six failed requests on every single load of a game that ships with
     no music files, and a console full of red 404s is a bad way to say
     "working as intended". The manifest ships with both entries null, so a
     default checkout makes exactly one request and it succeeds. */
  async function loadFiles() {
    if (filesTried) return;
    filesTried = true;
    let man = null;
    try {
      const r = await fetch('audio/tracks.json');
      if (r.ok) man = await r.json();
    } catch (e) { /* no manifest: synth only, which is the shipped state */ }
    if (!man) return;
    const [w, b] = await Promise.all([loadTrack(man.wave), loadTrack(man.boss)]);
    bufs.wave = w; bufs.boss = b;
    if (w || b) syncFile();
  }

  /* Start whichever recording the current track wants, fading the previous
     one out rather than cutting it. */
  function syncFile() {
    if (!ac) return;
    /* Each track answers for itself. Supplying only one file used to make the
       other track borrow it, which is not what "drop in a boss theme" means --
       a track with no file of its own falls back to the synth. */
    const want = boss ? bufs.boss : bufs.wave;
    const wasFile = fileMode;
    fileMode = !!want;
    if (!fileMode && wasFile) nextT = ac.currentTime + 0.1;   // synth picks the bar back up from now
    if (want === fileNow) return;
    const t = ac.currentTime, FADE = 0.9;
    if (fileSrc) {
      const os = fileSrc, og = fileGain;
      og.gain.setTargetAtTime(0, t, FADE / 3);
      setTimeout(() => { try { os.stop(); os.disconnect(); og.disconnect(); } catch (e) {} }, (FADE + 0.4) * 1000);
      fileSrc = null; fileGain = null; fileNow = null;
    }
    if (!want) return;
    fileGain = ac.createGain();
    fileGain.gain.setValueAtTime(0.0001, t);
    fileGain.gain.setTargetAtTime(0.9, t, FADE / 3);
    fileGain.connect(fileBus);
    fileSrc = ac.createBufferSource();
    fileSrc.buffer = want; fileSrc.loop = true;
    fileSrc.connect(fileGain);
    fileSrc.start(t);
    fileNow = want;
  }

  return {
    attach(context, destination) {
      if (ac) return;
      ac = context; out = destination;
      noise = makeNoise();
      bus('pad', 0.55); bus('bass', 0.42); bus('drums', 0.40);
      bus('gtr', 0.50); bus('arp', 0.30); bus('stab', 0.34);
      amps = {
        chug:  amp(14, busses.gtr.g),
        power: amp(9,  busses.gtr.g),
        lead:  amp(20, busses.gtr.g)
      };
      fileBus = ac.createGain(); fileBus.gain.value = 1; fileBus.connect(out);
      loadFiles();
    },
    start() {
      if (!ac) return;
      stopToken++;                       // cancels any stop still counting down
      if (timer) clearInterval(timer);
      running = true;
      step = 0; nextT = ac.currentTime + 0.1; lastEase = 0;
      timer = setInterval(tick, TICK_MS);
      syncFile();
    },
    stop(fade) {
      if (!ac) return;
      const t = ac.currentTime;
      for (const k in busses) busses[k].g.gain.setTargetAtTime(0, t, fade === undefined ? 0.4 : fade);
      if (fileGain) fileGain.gain.setTargetAtTime(0, t, fade === undefined ? 0.4 : fade);
      const mine = ++stopToken;
      setTimeout(() => {
        if (mine !== stopToken) return;  // something restarted us in the meantime
        running = false;
        if (timer) clearInterval(timer);
        timer = null;
        if (fileSrc) { try { fileSrc.stop(); fileSrc.disconnect(); } catch (e) {} fileSrc = null; fileNow = null; }
        reap(Infinity);                  // and leave nothing connected behind
      }, 1400);
    },
    setFloor(i) {
      floorIdx = i | 0;
      menuMode = false;
      bpmTarget = rootOf().bpm * trk().bpmMul;
    },
    setIntensity(v) { intenTarget = Math.max(0, Math.min(1, v)); },
    setBoss(b) {
      const nb = !!b;
      if (nb === boss) return;
      boss = nb;
      /* A different piece starts on a downbeat, not halfway through the bar
         the last one was in. */
      step = 0;
      bpmTarget = rootOf().bpm * trk().bpmMul;
      syncFile();
    },
    menu() {
      menuMode = true; boss = false;
      floorIdx = 0; bpmTarget = 78; intenTarget = 0.2;
      if (!ac) return;
      stopToken++;
      if (timer) clearInterval(timer);
      running = true;
      lastEase = 0;
      nextT = ac.currentTime + 0.1;
      timer = setInterval(tick, TICK_MS);
      syncFile();
    },
    isRunning() { return running; },
    usingFiles() { return fileMode; },
    debug() {
      return { bpm: Math.round(bpm), inten: +inten.toFixed(2), boss, floorIdx, step,
               menuMode, running, track: boss ? 'boss' : 'wave',
               hot: +(boss ? 1 : (menuMode ? inten : 0.45 + inten * 0.55)).toFixed(2),
               liveNodes: live.length, fileMode };
    }
  };
})();
