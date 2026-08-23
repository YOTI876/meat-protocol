/* ============================================================
   MEAT PROTOCOL  —  top-down survival horror wave shooter
   Damjan vs. the meat. Ten waves a floor. Bosses drop groceries.
   ============================================================ */
(() => {
'use strict';

const W = 480, H = 270;
/* RENDER SCALE.
   Layout, physics and every coordinate in this file stay on the 480x270 grid
   the game was designed on. The backing store is RS times that, and the world
   transform is scaled to match, so nothing in the simulation changes — there
   are simply four device pixels where there used to be one. That is the room
   the detailed sprites, the selective outlines and the sub-pixel AA need. */
const RS = 2;
const cv = document.getElementById('game');
cv.width = W * RS; cv.height = H * RS;
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
setSubpix(RS);

/* An offscreen that draws in game coordinates but stores at render scale. */
function subCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RS); c.height = Math.ceil(h * RS);
  const g = c.getContext('2d');
  g.setTransform(RS, 0, 0, RS, 0, 0);
  g.imageSmoothingEnabled = false;
  c._gw = w; c._gh = h;                 // its size in game units, for blitting
  return { can: c, ctx: g };
}
/** Blit an offscreen back into game space at 1:1 game units. */
function blit(g, c, x, y) { g.drawImage(c, x, y, c._gw, c._gh); }

const ov = document.getElementById('overlay');
const octx = ov.getContext('2d');
let uiScale = 2;

const _l = subCanvas(W, H), lcan = _l.can, lctx = _l.ctx;

/* ---------- crisp UI text (drawn on the high-res overlay) ----------
   Coordinates are in game space (480x270) and scaled up, so layout code stays
   identical to the pixel canvas — only the rasterisation is sharper. One
   typeface for the whole game (see js/font.js): the pixel look comes from the
   letterforms, the legibility comes from rasterising them at device
   resolution instead of at 480x270 and upscaling. */
const UI_FONT = GAME_FONT;
/* OPTICAL SIZE NORMALISATION.
   A size passed to htxt means "capitals this many game units tall", not "this
   em size" — em sizes lie. The layout was tuned against a face whose caps
   were 0.63 of the em; a face with smaller caps (VT323 sits at ~0.56) would
   render every label visibly smaller at the same px, so the px is scaled by
   the measured ratio instead. Swap the font file and every string in the
   game keeps its optical size without a single call site changing. */
const OPT_CAP = 0.63;
function fontNorm(fnt) { return clamp(OPT_CAP / capRatio(fnt), 0.8, 1.45); }
function htxt(s, x, y, col, align, size, opts) {
  const o = opts || {}, k = uiScale, sz = size || 9;
  const fnt = o.font || UI_FONT;
  const norm = fontNorm(fnt);
  // o.mid: treat y as the vertical centre of the cap box rather than the
  // baseline. Canvas' own 'middle' baseline sits low because it splits the em
  // box including descenders; centring on caps is what reads as centred.
  // With the size normalised, the rendered cap height IS sz * OPT_CAP.
  const by = o.mid ? y + sz * OPT_CAP / 2 : y;
  // Canvas puts letter-spacing after the final glyph as well, so the measured
  // run is one gap wider than the ink and centred text lands half a gap left.
  // Give it back, or every centred label sits fractionally off.
  const trk = (o.track === undefined ? 0.04 : o.track) * sz;
  const al = align || 'left';
  if (al === 'center') x += trk / 2; else if (al === 'right') x += trk;
  octx.save();
  /* Default weight 400: the embedded face has one weight, and asking canvas
     for 600 makes it synthesize a bold that smears a monoline pixel font.
     Titles that explicitly pass 700 still get the synthetic bold — at title
     sizes it reads as "thicker", which is what a title wants. */
  octx.font = (o.weight || '400') + ' ' + (sz * norm * k) + 'px ' + fnt;
  octx.textAlign = al;
  octx.textBaseline = 'alphabetic';
  if (octx.letterSpacing !== undefined) octx.letterSpacing = (trk * k) + 'px';
  if (o.glow) { octx.shadowColor = o.glow; octx.shadowBlur = (o.glowSize || 10) * k * 0.5; }
  if (o.alpha !== undefined) octx.globalAlpha = o.alpha;
  if (!o.noShadow) {
    octx.fillStyle = 'rgba(0,0,0,0.9)';
    octx.fillText(s, x * k + k * 0.9, by * k + k * 0.9);
  }
  octx.fillStyle = col;
  octx.fillText(s, x * k, by * k);
  octx.restore();
}
function htxtWidth(s, size, track, font) {
  const k = uiScale, fnt = font || UI_FONT;
  octx.save();
  octx.font = '400 ' + ((size || 9) * fontNorm(fnt) * k) + 'px ' + fnt;
  if (octx.letterSpacing !== undefined) octx.letterSpacing = ((track === undefined ? 0.04 : track) * (size || 9) * k) + 'px';
  const w = octx.measureText(s).width / k;
  octx.restore();
  return w;
}
/* ============================================================
   PROBE — frame-time and pool instrumentation.

   Measurement only. Nothing in this block changes a gameplay number; the
   moment it does it has stopped being a probe.

   ---- the rules it has to obey, because it runs in the hot loop ----

   No allocation per frame. Every buffer here is allocated once and written
   by index. Percentiles sort a scratch buffer IN PLACE and only when
   something asks to read them — once a frame for the F3 overlay, once a
   sample for a soak — never unconditionally per frame.

   `performance.now()` about ten times a frame costs ~0.5us against a 16.7ms
   budget. `PROBE.overhead()` measures it rather than asserting it.

   ---- what this cannot tell you, and it matters ----

   Rendering.md's floor-bake warning applies to every number below: wall-clock
   brackets around canvas work UNDER-REPORT it, because draw calls queue and
   the real cost lands on whatever later call forces a flush. So the split
   attributes JS-side time honestly and GPU-side time badly.

   `PROBE.drain = 1` forces a readback flush after each phase, which makes
   attribution accurate and frame pacing meaningless. Use it to find out WHERE
   the time goes, never HOW MUCH. The unflushed numbers are the ones that
   describe the frame you actually see.
   ============================================================ */
const PROBE_N = 512;                    // ~8s of history at 60fps
const _pbT   = new Float64Array(PROBE_N);   // wall-clock stamp per sample
const _pbTot = new Float32Array(PROBE_N);
const _pbUpd = new Float32Array(PROBE_N);
const _pbWld = new Float32Array(PROBE_N);   // drawWorld MINUS actors and particles
const _pbAct = new Float32Array(PROBE_N);   // the actor pass: drawEnemy * n + drawPlayer
const _pbPar = new Float32Array(PROBE_N);   // drawParticles
const _pbLit = new Float32Array(PROBE_N);   // drawLight
const _pbPst = new Float32Array(PROBE_N);   // post
const _pbHud = new Float32Array(PROBE_N);   // drawHUD + whatever screen is open
const _pbScr = new Float32Array(PROBE_N);   // scratch, sorted in place
let _pbI = 0, _pbCount = 0, _pbWorst = 0, _pbWorstAt = 0;
/* filled from inside drawWorld, zeroed at the top of every frame */
let _accAct = 0, _accPar = 0;
let _soaking = 0;                       // suppresses rAF so a soak can drive frame() itself

/* Pre-allocated result objects. The stats API hands these back by reference,
   so reading the probe never allocates either. */
function _pbSlot() { return { avg: 0, p95: 0, p99: 0, max: 0, n: 0 }; }
const _pbOut = [_pbSlot(), _pbSlot(), _pbSlot(), _pbSlot(), _pbSlot(), _pbSlot(), _pbSlot(), _pbSlot()];

function _pbFlush() {
  // a 1px readback is the cheapest way to make the driver finish what it queued
  if (PROBE.drain) ctx.getImageData(0, 0, 1, 1);
}

/* Copy the samples inside the rolling window into the scratch buffer, newest
   first. Walking backward and breaking on the first sample older than the
   window is what makes this a TIME window rather than a frame-count one — at
   20fps three seconds is 60 samples, not 180, and averaging 180 of them would
   quietly reach back eight seconds exactly when the game is worst. */
function _pbWindow(buf, ms) {
  if (!_pbCount) return 0;
  const now = _pbT[(_pbI - 1 + PROBE_N) % PROBE_N];
  let n = 0;
  for (let k = 0; k < _pbCount; k++) {
    const i = (_pbI - 1 - k + PROBE_N * 2) % PROBE_N;
    if (now - _pbT[i] > ms) break;
    _pbScr[n++] = buf[i];
  }
  return n;
}
function _pbStat(buf, ms, out) {
  const n = _pbWindow(buf, ms);
  out.n = n;
  if (!n) { out.avg = out.p95 = out.p99 = out.max = 0; return out; }
  let s = 0, mx = 0;
  for (let k = 0; k < n; k++) { const v = _pbScr[k]; s += v; if (v > mx) mx = v; }
  // park the dead tail above every real sample so one in-place sort does it
  _pbScr.fill(Infinity, n);
  _pbScr.sort();
  out.avg = s / n;
  out.p95 = _pbScr[Math.min(n - 1, Math.floor(n * 0.95))];
  out.p99 = _pbScr[Math.min(n - 1, Math.floor(n * 0.99))];
  out.max = mx;
  return out;
}
function _pbRec(t0, upd, wld, act, par, lit, pst, hud, tot) {
  const i = _pbI;
  _pbT[i] = t0; _pbTot[i] = tot; _pbUpd[i] = upd; _pbWld[i] = wld;
  _pbAct[i] = act; _pbPar[i] = par; _pbLit[i] = lit; _pbPst[i] = pst; _pbHud[i] = hud;
  _pbI = (i + 1) % PROBE_N;
  if (_pbCount < PROBE_N) _pbCount++;
  if (tot > _pbWorst) { _pbWorst = tot; _pbWorstAt = t0; }
}

const PROBE = {
  on: 0,            // F3 overlay
  drain: 0,         // see the warning above
  win: 3000,        // rolling window, ms
  reset() { _pbI = 0; _pbCount = 0; _pbWorst = 0; _pbWorstAt = 0; },
  worst() { return _pbWorst; },
  /* Reading is not the hot path, so this one allocates — deliberately, because
     a caller that holds a reference to a recycled object gets lied to later. */
  stats(ms) {
    const w = ms || PROBE.win;
    const f = (b) => { const o = _pbStat(b, w, _pbSlot()); return o; };
    return {
      windowMs: w, frames: _pbCount,
      total: f(_pbTot), update: f(_pbUpd),
      draw: { world: f(_pbWld), actors: f(_pbAct), particles: f(_pbPar),
              light: f(_pbLit), post: f(_pbPst), hud: f(_pbHud) },
      worstEver: _pbWorst
    };
  },
  /* Everything the F3 overlay reads that is not a timing. Counts, caps and
     occupancies in one place so the overlay and the soak cannot disagree. */
  counts() {
    return {
      en: S.en.length, cracks: S.cracks.length, cap: S.capNow | 0, queue: S.queue.length,
      bul: S.bul.length, eb: S.eb.length,
      part: S.part.length, partCap: 900,
      gibs: S.gibs.length, gibsCap: 420,
      rings: S.rings.length, ringsCap: 80,
      fx: S.fx.length, fxCap: 12,
      floats: S.floats.length, arcs: S.arcs.length, drops: S.drops.length,
      sprCache: _cache.size, sprVariants: _variants.size,
      floor: S.room + 1, wave: S.wave, mode: S.mode
    };
  },
  /* What the probe itself costs, and — more important — what it is ALLOWED
     to resolve. A page that is not cross-origin isolated has
     performance.now() coarsened to 100us as an anti-Spectre measure, which
     means any single phase under about half a millisecond is being reported
     as 0.0 or 0.1 and nothing in between.

     That does not make the split useless, but it changes what may be read off
     it. The quantization dithers frame to frame, so a WINDOWED AVERAGE
     recovers real resolution — 180 frames of a 100us quantum averages to
     roughly 7us — while any SINGLE frame's split is noise. Averages are safe
     to reason about; individual frames are not.

     To get 5us back, serve the page cross-origin isolated (COOP + COEP in
     serve.js). That is a change to the server, not to the probe. */
  overhead(n) {
    const N = n || 20000;
    let t = performance.now(), sink = 0;
    for (let i = 0; i < N; i++) sink += performance.now();
    const per = (performance.now() - t) / N;
    // the smallest non-zero step the clock will actually report
    let prev = performance.now(), q = Infinity;
    for (let i = 0; i < 60000; i++) {
      const v = performance.now();
      if (v > prev) { if (v - prev < q) q = v - prev; prev = v; }
    }
    const qus = q === Infinity ? null : +(q * 1000).toFixed(2);
    return { perCall_us: +(per * 1000).toFixed(4), callsPerFrame: 11,
             perFrame_us: +(per * 11 * 1000).toFixed(3),
             pctOf16ms: +(per * 11 / 16.7 * 100).toFixed(4),
             clockQuantum_us: qus,
             crossOriginIsolated: !!self.crossOriginIsolated,
             readable: (qus && qus > 20)
               ? 'COARSE CLOCK — trust windowed averages, never a single frame split'
               : 'fine clock — per-frame splits are meaningful',
             _sink: sink && 0 };
  }
};

let floorCan = null, floorCtx = null, decalCan = null, decalCtx = null;

/* ---------- helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Rainbow tints feed the sprite bake cache, so quantize hue to 12 steps.
function godTint(alpha, speed) { return 'hsla(' + (Math.floor((S.t * (speed || 3)) % 12) * 30) + ',90%,62%,' + alpha + ')'; }
/* '#rrggbb' + alpha -> rgba(). Lets a palette colour be reused as a wash
   without a second hardcoded copy of the same colour drifting out of sync. */
function hexA(h, a) {
  return 'rgba(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' +
         parseInt(h.slice(5, 7), 16) + ',' + a + ')';
}

/* ---------- input ---------- */
const keys = {}, mouse = { x: W / 2, y: H / 2, down: false, rdown: false, wx: 0, wy: 0 };
let clickQueue = [];

addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (e.code === 'KeyM') A.toggleMute();
  // F3 is the probe. F4 toggles the flush mode it warns about.
  if (e.code === 'F3') { e.preventDefault(); PROBE.on = PROBE.on ? 0 : 1; if (PROBE.on) PROBE.reset(); }
  if (e.code === 'F4' && PROBE.on) { e.preventDefault(); PROBE.drain = PROBE.drain ? 0 : 1; PROBE.reset(); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (S.mode === 'play') S.mode = 'pause';
    else if (S.mode === 'pause') S.mode = 'play';
    else if (S.mode === 'deck') S.mode = 'pause';
    else if (S.mode === 'cos' || S.mode === 'contracts') S.mode = S.cosReturn || 'title';
  }
  /* B toggles the deck. This was two statements with an `else if` chained off
     the Escape line below it, so pressing B in play opened the deck and the
     second branch — now seeing mode === 'deck' — closed it again in the same
     event. From pause it silently unpaused you. One statement, one decision. */
  if (e.code === 'KeyB') {
    if (S.mode === 'deck') S.mode = 'play';
    else if (S.mode === 'play' || S.mode === 'pause') S.mode = 'deck';
  }
  if (e.code === 'Escape' && S.mode === 'augment') refuseAugments();
  // cosmetics are reachable from anywhere that isn't a firefight
  // ...but not out of the evolution pick, which owes you something on the way out
  if (e.code === 'KeyC' && S.mode !== 'cos' && S.mode !== 'play' && S.mode !== 'evolve') { S.cosReturn = S.mode; S.mode = 'cos'; }
  if (S.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startRun();
  if ((S.mode === 'dead' || S.mode === 'win') && e.code === 'KeyR') startRun();
  if (S.mode === 'play') {
    if (e.code === 'KeyQ') cycleWeapon(-1);
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4,
                Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Digit0: 9 }[e.code];
    if (n !== undefined && S.p.owned[n]) selectWeapon(n);
  }
});
addEventListener('keyup', e => keys[e.code] = false);

function relMouse(e) {
  const r = cv.getBoundingClientRect();
  mouse.x = clamp((e.clientX - r.left) / r.width * W, 0, W);
  mouse.y = clamp((e.clientY - r.top) / r.height * H, 0, H);
}
cv.addEventListener('mousemove', relMouse);
cv.addEventListener('mousedown', e => {
  relMouse(e);
  if (e.button === 2) { mouse.rdown = true; if (S.mode === 'play') throwNade(); return; }
  mouse.down = true;
  if (S.mode !== 'play') clickQueue.push({ x: mouse.x, y: mouse.y });
});
addEventListener('mouseup', e => { if (e.button === 2) mouse.rdown = false; else mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); if (S.mode === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: false });

/* ============================================================
   CONTENT
   ============================================================ */
/* ============================================================
   THE TEN FLOORS

   The building used to have no bottom: four hand-built floors and then a
   generator that kept minting new ones off the floor index forever. It made
   the run infinite and it made the run *shapeless* — floor 14 was floor 9 in a
   different hue, there was nothing to beat, and every fight past about floor 6
   was the same fight with bigger numbers on it.

   Ten floors, and the tenth ends. That gives the descent an act structure it
   could not have while it was endless:

     1-3   you learn the game            2 teaches darkness, 3 teaches footing
     4-6   the game learns you back      hazards, cold, numbers
     7-9   it stops being fair           blackouts, thin skin, being hunted
     10    THE KILLING FLOOR

   Every floor owns four things nothing else has: a palette, an arena SIZE, a
   fixed LAYOUT archetype, and a TWIST — one rule change that is true for that
   floor and nowhere else. The layout is fixed rather than rolled because a
   floor you can learn the shape of is a floor you can outplay; rolling it made
   every arena "some boxes, at random".

   `motif` is the decor pass, `vat` recolours the crates, `twist` is read in
   half a dozen places — search `S.twist`.
   ============================================================ */
const ROOMS = [
  /* ---- ACT ONE: it is only a building ---- */
  { name: 'THE ABATTOIR', sub: 'floor 01 // where the meat is hung',
    aw: 940, ah: 660, floor: ['#4a382f', '#42302a', '#392722'], grout: '#241a16',
    wall: ['#5e4840', '#3a2c28', '#725648'], fog: 'rgba(48,8,12,0.12)', dark: 0.76,
    layout: 'scatter', motif: 'hook', vat: '#78121a', twist: null,
    // The one floor with no rule of its own. You have enough to learn already.
    tw: '' },
  { name: 'THE HOLLOW', sub: 'floor 02 // it goes down further than it should',
    aw: 1020, ah: 720, floor: ['#2f3a43', '#27313a', '#212a31'], grout: '#141c22',
    wall: ['#425460', '#28343c', '#556878'], fog: 'rgba(10,30,50,0.13)', dark: 0.80,
    layout: 'pillars', motif: 'drip', vat: '#1d4a58', twist: 'dark',
    tw: 'THE LIGHT DOES NOT REACH' },
  { name: 'THE MEAT LOOP', sub: 'floor 03 // you have been here before',
    aw: 1080, ah: 760, floor: ['#42313c', '#392833', '#30212b'], grout: '#1c1319',
    wall: ['#583f50', '#342532', '#6d5062'], fog: 'rgba(60,0,50,0.13)', dark: 0.80,
    layout: 'ring', motif: 'rust', vat: '#5a1848', twist: 'slick',
    tw: 'THE FLOOR IS GREASED' },
  /* ---- ACT TWO: it starts taking an interest ---- */
  { name: 'THE RED KITCHEN', sub: 'floor 04 // dinner',
    aw: 1120, ah: 780, floor: ['#4e2d2a', '#432422', '#391d1c'], grout: '#20100f',
    wall: ['#6a3835', '#3e2020', '#84463f'], fog: 'rgba(90,0,10,0.16)', dark: 0.82,
    layout: 'corridors', motif: 'ember', vat: '#8a2410', twist: 'heat',
    tw: 'THE BURNERS ARE STILL ON' },
  { name: 'THE FREEZER', sub: 'floor 05 // nothing in here has finished dying',
    aw: 1140, ah: 800, floor: ['#39474e', '#31404a', '#2a3740'], grout: '#16232b',
    wall: ['#5a7280', '#33454f', '#8aa8b8'], fog: 'rgba(150,220,255,0.10)', dark: 0.74,
    layout: 'bunkers', motif: 'frost', vat: '#2a6a80', twist: 'frost',
    tw: 'THE COLD COMES IN WAVES' },
  { name: 'THE RENDERING', sub: 'floor 06 // everything they could not sell',
    aw: 1200, ah: 830, floor: ['#38412a', '#303924', '#28301e'], grout: '#171c10',
    wall: ['#4e5a34', '#2d3520', '#68783f'], fog: 'rgba(90,130,20,0.13)', dark: 0.80,
    layout: 'scatter', motif: 'sludge', vat: '#4a6a12', twist: 'swarm',
    tw: 'MORE OF THEM. LESS OF EACH.' },
  /* ---- ACT THREE: it stops pretending ---- */
  { name: 'THE LONG TABLE', sub: 'floor 07 // twelve places, all of them set',
    aw: 1240, ah: 850, floor: ['#4a3c22', '#41341d', '#382c18'], grout: '#211a0d',
    wall: ['#6a5528', '#3d3018', '#8a7038'], fog: 'rgba(120,80,0,0.13)', dark: 0.82,
    layout: 'corridors', motif: 'candle', vat: '#7a5410', twist: 'blackout',
    tw: 'THE LIGHTS GO OUT ON A COUNT' },
  { name: 'THE SALT LINE', sub: 'floor 08 // it cures. it does not heal.',
    aw: 1280, ah: 880, floor: ['#4a4640', '#413d38', '#383430'], grout: '#201e1b',
    wall: ['#6a6459', '#3d3a34', '#8f887a'], fog: 'rgba(220,210,190,0.09)', dark: 0.78,
    layout: 'pillars', motif: 'salt', vat: '#6a6050', twist: 'frail',
    tw: 'EVERYTHING CUTS DEEPER HERE' },
  { name: 'THE LAST AISLE', sub: 'floor 09 // there is nothing after this one',
    aw: 1320, ah: 900, floor: ['#2e2438', '#281f31', '#221a2a'], grout: '#130e19',
    wall: ['#463c5a', '#2a2134', '#5e4a78'], fog: 'rgba(90,20,140,0.15)', dark: 0.84,
    layout: 'ring', motif: 'eye', vat: '#4a1c6a', twist: 'hunt',
    tw: 'SOMETHING IS WALKING THE AISLE WITH YOU' },
  { name: 'THE KILLING FLOOR', sub: 'floor 10 // this is what the building is for',
    aw: 1180, ah: 820, floor: ['#3a1416', '#321012', '#2a0d0f'], grout: '#160607',
    wall: ['#6a1c22', '#380f12', '#a02a30'], fog: 'rgba(160,0,10,0.18)', dark: 0.86,
    layout: 'bunkers', motif: 'hook', vat: '#a01018', twist: 'final',
    tw: 'IT HAS BEEN WAITING THE WHOLE TIME' }
];
const FLOORS = ROOMS.length;                 // the run ends when this one does
const isLastFloor = idx => idx >= FLOORS - 1;
/* Past the last floor there is nothing, so the descent clamps rather than
   generating. Anything that asks for a deeper room gets the killing floor. */
function roomDef(idx) { return ROOMS[clamp(idx | 0, 0, ROOMS.length - 1)]; }
/* The twist of the floor you are standing in — the shop is not a floor and has
   no twist of its own, which is exactly what makes it a breather. */
function twist() { return S.inShop ? null : roomDef(S.room).twist; }
const isTwist = k => twist() === k;
/* PACI's back room. Not a floor — it never appears in the descent count. */
const SHOP_ROOM = {
  name: "PACI'S", sub: 'the back room // he was expecting you',
  aw: 440, ah: 330, floor: ['#3a3040', '#322838', '#2a2030'], grout: '#191320',
  wall: ['#5a4a64', '#332a3c', '#75608a'], fog: 'rgba(70,25,95,0.09)', dark: 0.52,
  /* His own surface, and it belongs to nobody else — you know you are out of
     the building the moment you look down. */
  tex: 'quarry'
};
function curRoom() { return S.inShop ? SHOP_ROOM : roomDef(S.room); }
/* PACI now keeps wave hours, not boss hours.

   The old rule was one back room per three boss-class kills, which worked out
   to exactly one shop a floor, always after the wave-10 boss — so every gun
   purchase happened on the way out of a floor and you spent the whole floor
   holding money you could not put down. Twice a floor means the half-time shop
   actually changes how you fight the back half of one — it is waves 3 and 5
   now that the floor is five long, so PACI still lands at the midpoint and
   again on the way out. */
/* ============================================================
   FIVE WAVES A FLOOR, not ten.

   A floor is the same amount of fight, delivered in half as many pieces. That
   is the whole change, and everything that was written against "ten" had to be
   rewritten against WAVES rather than against a new hard-coded five — the
   per-wave coefficients below are all doubled so the value at the END of a
   floor is exactly what it was, while the curve to get there is twice as
   steep. Anything phrased as a fraction of the floor is now `S.wave / WAVES`
   so it never needs doing again.

   The shape:

     1  fight
     2  ELITE
     3  fight        then PACI
     4  ELITE
     5  FLOOR BOSS   then PACI

   Two elites and one boss, exactly as before. PACI still turns up twice, and
   still on the wave you have just been hurt by.
   ============================================================ */
const WAVES = 5;
const SHOP_WAVES = [3, 5];
const shopDueAfter = w => SHOP_WAVES.indexOf(w) >= 0;

/* Individual hits land much harder than they used to. Balanced back by a slower
   contact rate, longer i-frames and better healing — spikier, not just meaner. */
const ETYPE = {
  crawler:  { bank: SPR.anim.crawler,  hp: 26,  spd: 54, dmg: 16, r: 6, score: 10, gib: '#8b6161', name: 'CRAWLER' },
  shrieker: { bank: SPR.anim.shrieker, hp: 38,  spd: 33, dmg: 20, r: 6, score: 20, gib: '#6b8a52', name: 'SHRIEKER' },
  stalker:  { bank: SPR.anim.stalker,  hp: 32,  spd: 84, dmg: 23, r: 6, score: 26, gib: '#9a927e', name: 'STALKER' },
  bloater:  { bank: SPR.anim.bloater,  hp: 105, spd: 25, dmg: 32, r: 9, score: 40, gib: '#9c4049', name: 'BLOATER' },
  /* The two late arrivals answer the two degenerate strategies. Every launch
     enemy either chases or shoots, so spray-and-pray AoE and circle-kiting
     both won for free. The HUSK is a dried-out bloater that is FULL OF THEM —
     kill it carelessly and you have two more problems. The CYST does not come
     to you at all: it sits where it landed and hatches, and either you cross
     the room to burst it or the wave never thins. */
  husk:     { bank: SPR.anim.bloater,  hp: 62,  spd: 36, dmg: 22, r: 8, score: 30, gib: '#b8b0a0', name: 'HUSK',
              tint: 'rgba(216,210,196,0.45)', scale: 0.85, split: 2 },
  cyst:     { bank: SPR.anim.bloater,  hp: 170, spd: 0,  dmg: 18, r: 10, score: 55, gib: '#8fae4a', name: 'CYST',
              tint: 'rgba(150,210,70,0.42)', scale: 1.12, nest: 1 },
  /* ---- THE DEEP ROSTER ----
     Everything above is unlocked by floor 3, so floors 4 to 10 used to show
     you nothing you had not already learned to kill. These three arrive later
     and each one closes a way of playing that had stopped costing anything.

     TROLLEY  answers standing still. Its front is plated: shoot it head-on and
              you do a fraction of the damage. You have to get around it, which
              means giving up the corner you were holding.
     SPITTER  answers kiting. It does not close — it hangs back and drops
              hazard on where you are going, so running a circle forever now
              runs you through your own future.
     SHEPHERD answers ignoring the chaff. It never touches you. It stands at
              the back making everything near it faster and tougher, and the
              wave you were comfortably out-damaging stops being one. */
  trolley:  { bank: SPR.anim.trolley,  hp: 210, spd: 30, dmg: 30, r: 9, score: 60, gib: '#8a9098', name: 'TROLLEY',
              floor: 3, armour: 0.22, armArc: 1.15 },
  spitter:  { bank: SPR.anim.spitter,  hp: 70,  spd: 30, dmg: 20, r: 7, score: 65, gib: '#7f9c58', name: 'SPITTER',
              floor: 5, standoff: 150, lob: 2.6 },
  shepherd: { bank: SPR.anim.shepherd, hp: 130, spd: 40, dmg: 16, r: 7, score: 90, gib: '#9a7fd8', name: 'SHEPHERD',
              floor: 7, standoff: 210, aura: 118 }
};
const CONTACT_CD = 0.74;   // still a shorter fuse than the 0.78 it used to be
/* Every coin that reaches your pocket goes through this, from any source —
   drops, boss piles, the lot. `S.coinFrac` was already accumulating
   remainders for THE DEBT, so a non-integer global rate costs nothing and
   nothing gets silently rounded away.

   0.70 is a flat 30% cut. It is what makes THE FISH's 500 a real target
   rather than a number you pass on the way to floor 6. */
const COIN_RATE = 0.70;
const OMEGA_COINS = 500;   // THE FISH is the long game now
/* ---- EVOLUTION ----
   Ten rungs and no more. The cost used to double forever (100, 200, 400 ...),
   which is the right shape for something unbounded and the wrong one for
   something that ends: rung 10 would have wanted 51,200 coins, and at
   COIN_RATE that is several hundred thousand kills. A capped ladder wants a
   quadratic instead — the differences grow, the total does not run away.

     150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150, 3750  →  16,500 all-in

   which is roughly ten good runs for the whole ladder, and the first rung
   inside one. */
const EVO_MAX = 10;
const EVO_COST = ev => 150 + 175 * ev + 25 * ev * ev;
/* Which weapon rarity each rung opens up, indexed by the evolution you are
   *buying* (rung 1 reads slot 0). Two rungs a tier, so the middle tiers are a
   real choice rather than a formality — RARE holds three guns and you only
   ever take two of them.

     1-2 COMMON   3-4 UNCOMMON   5-6 RARE   7-8 EPIC

   Past that the roster holds one of every rarity and the reward changes shape
   entirely; see evoReward(). LEGENDARY is not on this ladder at all — THE FISH
   is bought with 500 coins by a player who went and got them, and handing it
   out for evolving would retire the whole tier — and with it the only reason
   the coin economy has to keep climbing past a few hundred. */
const EVO_TIER = [0, 0, 1, 1, 2, 2, 3, 3, 3, 3];
const EVO_TIERS_ALL = [0, 1, 2, 3];             // what "one of every rarity" means

/* ============================================================
   THE ROSTER

   Nine of them for nine floors, dealt in a DIFFERENT ORDER every run, plus the
   thing on floor 10 that is not on this list.

   ---- why they are shuffled, and what had to change first ----

   Fixed order meant floor 3 was THE PITCHER, every time, forever. The roster
   was the only part of a run that could not surprise you, on the one wave
   where surprise is the entire point. But you cannot simply shuffle a list
   whose HP climbs down it — that is how you get a 3000-health boss on floor 1
   and a 1400 on floor 9.

   So HP left the roster. DEPTH decides how much health the floor boss has
   (BOSS_HP below); the ROSTER decides who is carrying it. `bulk` is the only
   thing an entry says about its own size and it is a nudge — 0.92 to 1.12 —
   for a fight that should feel heavier or nimbler than its neighbours. Speed,
   summons and patterns stay with the identity, because those are the identity.

   ---- the patterns ----

   `pat` is how it opens; at half health it breaks and switches to `pat2` —
   see enterPhase(). Every entry below has a UNIQUE PAIR. That matters more
   than every pattern being unique: eight verbs across two slots is what makes
   ten fights instead of ten health bars, and a boss is remembered for its
   combination ("the one that mines the floor and then sweeps you off it")
   rather than for any single move.

   Half of the verbs are new — hook, brood, mortar, curtain, sweep, mines — and
   they exist because the old five were all "walk at the player and emit a ring
   of projectiles" with different timings. See updateBoss.

   addT/addN: how often each calls for help, and how much. Every boss summons,
   but the cap in updateBoss keeps the arena from silting up.
   ============================================================ */
const BOSSES = [
  { key: 'butcher', name: 'THE BUTCHER',      bank: SPR.anim.bossA, tint: null,                     bulk: 1.10, spd: 40, r: 15, item: 'banana',  pat: 'hook',    pat2: 'rush',    addT: 6.5, addN: 3, adds: ['crawler'],                        cry: 'IT REMEMBERS YOUR NAME',              cry2: 'IT HAS STOPPED BEING CAREFUL' },
  { key: 'mother',  name: 'MOTHER OF MELONS', bank: SPR.anim.bossB, tint: null,                     bulk: 1.06, spd: 26, r: 15, item: 'melon',   pat: 'brood',   pat2: 'nova',    addT: 4.2, addN: 4, adds: ['crawler', 'crawler', 'shrieker'], cry: 'SHE IS FULL OF CHILDREN',             cry2: 'SHE IS EMPTYING HERSELF' },
  { key: 'pitcher', name: 'THE PITCHER',      bank: SPR.anim.pitcher, tint: null,                   bulk: 0.94, spd: 46, r: 15, item: 'coolade', pat: 'blink',   pat2: 'curtain', addT: 7.0, addN: 3, adds: ['stalker', 'crawler'],            cry: 'IT CAME THROUGH THE WALL',            cry2: 'IT IS NOT BOTHERING WITH WALLS NOW' },
  { key: 'hog',     name: 'THE HOGFATHER',    bank: SPR.anim.hogfather, tint: null,                 bulk: 1.12, spd: 32, r: 15, item: 'glock',   pat: 'mortar',  pat2: 'burst',   addT: 6.0, addN: 4, adds: ['crawler', 'shrieker', 'bloater'], cry: 'HE IS CARRYING SOMETHING',            cry2: 'HE PUT IT DOWN. IT IS FOR YOU.' },
  { key: 'courier', name: 'THE COURIER',      bank: SPR.anim.courier, tint: null,                   bulk: 0.92, spd: 62, r: 15, item: 'bike',    pat: 'circle',  pat2: 'mines',   addT: 6.8, addN: 4, adds: ['stalker', 'stalker', 'crawler'],  cry: 'IT HAS BEEN CIRCLING FOR HOURS',      cry2: 'THE ROUND IS OVER. DELIVERY.' },
  { key: 'fishwife',name: 'THE FISHWIFE',     bank: SPR.anim.fishwife, tint: null,                  bulk: 1.00, spd: 38, r: 15, item: 'coolade', pat: 'sweep',   pat2: 'blink',   addT: 5.4, addN: 4, adds: ['shrieker', 'crawler', 'husk'],    cry: 'SHE HAS BEEN ON ICE SINCE FRIDAY',    cry2: 'SHE HAS THAWED ALL THE WAY THROUGH' },
  { key: 'trim',    name: 'THE TRIMMINGS',    bank: SPR.anim.trimmings, tint: null,                 bulk: 1.08, spd: 30, r: 15, item: 'melon',   pat: 'spawner', pat2: 'rush',    addT: 3.6, addN: 5, adds: ['crawler', 'husk', 'husk'],        cry: 'IT IS EVERY PART THEY DID NOT SELL',  cry2: 'ALL OF IT AT ONCE, THEN' },
  { key: 'roast',   name: 'SUNDAY ROAST',     bank: SPR.anim.roast, tint: null,                     bulk: 1.04, spd: 34, r: 15, item: 'banana',  pat: 'charge',  pat2: 'spiral',  addT: 5.8, addN: 4, adds: ['bloater', 'crawler', 'shrieker'], cry: 'IT HAS BEEN IN THERE SINCE SUNDAY',   cry2: 'IT IS DONE. IT IS VERY DONE.' },
  { key: 'shelf',   name: 'THE NIGHT SHELF',  bank: SPR.anim.shelf, tint: null,                     bulk: 0.96, spd: 54, r: 15, item: 'glock',   pat: 'mines',   pat2: 'curtain', addT: 6.2, addN: 5, adds: ['stalker', 'stalker', 'husk'],     cry: 'IT ONLY RESTOCKS AFTER CLOSING',      cry2: 'IT IS PUTTING YOU OUT ON THE FRONT' },
  { key: 'bestby',  name: 'THE BEST BEFORE',  bank: SPR.anim.bestby, tint: null,                    bulk: 1.02, spd: 44, r: 15, item: 'bike',    pat: 'brood',   pat2: 'sweep',   addT: 5.0, addN: 5, adds: ['bloater', 'cyst', 'husk'],        cry: 'THE DATE PASSED AND IT KEPT GOING',   cry2: 'THERE IS NO DATE LEFT TO PASS' }
];

/* ---- THE FINAL BOSS ----
   Not in the roster, never shuffled, and the only thing in the game with three
   phases. Floor 10, wave 10. See enterPhase() and the `final` branches in
   updateBoss — it does not reuse a roster pattern for any of its three. */
const BOSS_FINAL = {
  key: 'protocol', name: 'THE MEAT PROTOCOL', bank: SPR.anim.protocol1,
  /* ONE BANK PER PHASE. enterPhase swaps them, so the finale is three
     creatures rather than one silhouette with its health bar in three
     different colours. None of them carries a tint. */
  banks: [SPR.anim.protocol1, SPR.anim.protocol2, SPR.anim.protocol3],
  tint: null, bulk: 1, spd: 44, r: 19, item: null,
  final: 1, phases: 3,
  pat: 'p1', pat2: 'p2', pat3: 'p3',
  addT: 5.2, addN: 4, adds: ['crawler', 'husk', 'shrieker'],
  cry: 'IT IS WHAT THE BUILDING IS FOR',
  cry2: 'IT IS OPENING',
  cry3: 'THERE IS NOTHING LEFT OF IT BUT THE APPETITE'
};

/* How much health the FLOOR's boss has, before diff().hp multiplies it.
   Indexed by floor, not by identity — see the roster comment. Nine rungs for
   nine floors; floor 10 has its own number. */
const BOSS_HP = [1350, 1520, 1700, 1880, 2060, 2250, 2440, 2640, 2850];
const FINAL_HP = 4200;
/* The single place that answers "how much boss is this floor worth". Both
   spawnBoss and spawnMini go through it, so an elite can never be priced
   against a different number than the boss it is a share of. */
function bossBudget(floor) {
  if (isLastFloor(floor)) return FINAL_HP;
  const i = clamp(floor | 0, 0, BOSS_HP.length - 1);
  return BOSS_HP[i] * (BOSSES[bossIndexFor(i)].bulk || 1);
}

/* Bosses used to land on five of the ten waves, which made them furniture.
   One floor boss on wave 10, two elites on the way there, and every fifth
   floor the boss comes up as an APEX instead. */
const BOSS_WAVE = WAVES;
const MINI_WAVES = [2, 4];
/* THE LAST AISLE puts a third one on wave 6 — the wave that has never had
   anything in it, on the floor where you have stopped expecting surprises. */
const HUNT_WAVES = [2, 3, 4];
function miniWaves() { return isTwist('hunt') ? HUNT_WAVES : MINI_WAVES; }
/* What fraction of the floor's boss an elite is worth, before the build
   multiplier. See spawnMini — this is what keeps a wave-8 elite from
   outlasting the wave-10 boss at depth. */
const ELITE_SHARE = 0.22;
const APEX_EVERY = 5;                       // floor 5 is the apex floor
/* One shuffle per run, so the roster is a hand you are dealt rather than a
   list you memorise. Built lazily and cached on S so a mid-run read (the HUD,
   a docs query, a save) can never reshuffle the run you are inside. */
function rollRoster() {
  const a = BOSSES.map((_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  S.roster = a;
  return a;
}
function bossIndexFor(floor) {
  const r = S.roster || rollRoster();
  return r[clamp(floor | 0, 0, r.length - 1)];
}
/* Floor 10 is the finale, not an apex — the apex treatment (bigger, meaner,
   worth an obscene card) would be a downgrade applied to the last boss in the
   game. Floor 5 keeps it. */
function isApexFloor(floor) { return !isLastFloor(floor) && (floor + 1) % APEX_EVERY === 0; }

/* Elites: a regular enemy that came up wrong. Named, tracked on the boss bar,
   and worth a card. */
const MINIS = [
  { key: 'crawler',  name: 'THE FIRSTBORN',   col: '#ff8a6a', tint: 'rgba(255,110,70,0.42)' },
  { key: 'shrieker', name: 'THE CHOIRMASTER', col: '#a8ff6a', tint: 'rgba(150,255,90,0.42)' },
  { key: 'stalker',  name: 'THE LONG WALK',   col: '#e8e0c0', tint: 'rgba(240,230,200,0.38)' },
  { key: 'bloater',  name: 'THE SPOILAGE',    col: '#ff6a8a', tint: 'rgba(255,90,120,0.42)' },
  { key: 'husk',     name: 'THE HOLLOW MAN',  col: '#d8d0c0', tint: 'rgba(235,228,212,0.45)' },
  { key: 'cyst',     name: 'THE BROODMOTHER', col: '#a8e04a', tint: 'rgba(160,225,70,0.5)' }
];

/* ============================================================
   GRADE — one rarity ladder, shared by guns and cards.
   Butcher's grades, because of course they are. `mul` scales a card's
   numbers; `glow` is how hard the thing shines on a pedestal.
   ============================================================ */
/* THE RARITY LADDER.

   Plain names on purpose. The butcher's grades (SELECT / CHOICE / PRIME /
   BLACK LABEL) were thematic and completely opaque: nothing about the word
   PRIME tells you it sits above CHOICE, so the ladder had to be explained
   every time it was shown. These five need no explaining, and the palette is
   the one every player already knows.

   `mul` scales the card's number, `glow` is how hard it shines, `w` is the
   raw weight before luck. The rung that matters is RARE: it is where the
   riders switch on, so the odds are tuned to make it uncommon enough to be an
   event and common enough that a run gets two or three. */
const GRADE = [
  { n: 'COMMON',    col: '#b8b0a4', mul: 1.00, w: 100, glow: 0,  sfx: null },
  { n: 'UNCOMMON',  col: '#6ede7a', mul: 1.35, w: 30,  glow: 10, sfx: null },
  { n: 'RARE',      col: '#4aa8ff', mul: 1.75, w: 8,   glow: 17, sfx: 'card' },
  { n: 'EPIC',      col: '#b45cff', mul: 2.25, w: 1.6, glow: 26, sfx: 'secret' },
  { n: 'LEGENDARY', col: '#ffa02a', mul: 3.00, w: 0,   glow: 34, sfx: 'god' }  // never rolled — off-cuts and signatures only
];
/* Luck (from cards and contracts) tilts the weights up the ladder rather than
   rerolling: every point multiplies the odds of each grade above SELECT. */
function rollGrade(luck, cap) {
  const top = cap === undefined ? 3 : cap;
  let total = 0;
  const ws = [];
  for (let i = 0; i <= top; i++) { const v = GRADE[i].w * (i ? 1 + luck * 0.55 * i : 1); ws.push(v); total += v; }
  let r = Math.random() * total;
  for (let i = 0; i <= top; i++) { r -= ws[i]; if (r <= 0) return i; }
  return 0;
}

/* ---- THE ARSENAL. price 0 = you start with it. ----
   Damjan starts with a pistol now and nothing else. Everything above it is
   bought from PACI, and `gr` is the grade it shines at on his pedestals.

   `floor` is the depth PACI will first carry it at (0 = floor 1). Price alone
   was never a gate: a lucky floor-1 boss plus a CLEARANCE card could put GOD
   FINGER in your hands before you had met a bloater, and the rest of the run
   had nothing left to give you. Now the crate opens one rung at a time and
   money is a question of *which* of the two or three things on offer, not of
   whether you can skip five floors of progression. */
const WEP = {
  // rate is the delay between shots, so 0.155 -> 0.178 is 15% SLOWER. The gun
  // you are given free should be the one you are trying to stop needing.
  // 18 rounds -> 12. Twelve is the number that makes the reload a decision:
  // a wave-1 crawler pack costs most of a magazine, so HOPPER, QUICK HANDS and
  // the first thing PACI puts on a pedestal all have something to answer.
  pistol:{ id: 'pistol',name: 'THE SIDEARM',   spr: SPR.pistol,gr: 0, price: 0,   mag: 12,  rate: 0.178, dmg: 21, spread: 0.020, spd: 470, pellets: 1, reload: 1.15, sfx: 'shoot',    col: '#c8ccd4', evolve: 1, tag: 'it was in the drawer. it will do.' },
  scar:  { id: 'scar',  name: 'SCAR-L',        spr: SPR.scar,  gr: 0, floor: 0, price: 20,  mag: 30,  rate: 0.088, dmg: 13, spread: 0.026, spd: 430, pellets: 1, reload: 1.45, sfx: 'shoot',    col: '#ffe9a8', tag: 'reliable. boring. yours.' },
  /* knock 300 -> 140 -> 45. Even at 140 the shotgun was a crowd-control tool
     that happened to do damage: nine pellets each shoving, so a point-blank
     barrel emptied a circle whether or not anything died in it, and the recoil
     pushed Damjan a third of the way across a room he was trying to hold. At
     45 the shove is a flinch — it staggers the thing you hit and leaves the
     positioning to you. */
  saw:   { id: 'saw',   name: 'MEAT SPLITTER', spr: SPR.saw,   gr: 0, floor: 0, price: 30,  mag: 2,   rate: 0.62,  dmg: 12, spread: 0.24,  spd: 380, pellets: 9, reload: 1.9,  sfx: 'shotgun',  col: '#ffcf8a', knock: 45, tag: 'nine reasons to stand still' },
  // 45 -> 80. It does almost no damage itself and then multiplies everything
  // else you own by 1.6x on a marked target, which made it the strongest coin
  // in the game at the cheapest tier — a floor-1 no-brainer rather than a buy.
  price: { id: 'price', name: 'THE PRICE GUN', spr: SPR.price, gr: 1, floor: 0, price: 80,  mag: 40,  rate: 0.070, dmg: 7,  spread: 0.06,  spd: 560, pellets: 1, reload: 1.6,  sfx: 'nailgun',  col: '#ff4ab0', mark: 6, tag: 'everything it tags is on sale' },
  nail:  { id: 'nail',  name: 'THE STAPLER',   spr: SPR.nail,  gr: 1, floor: 1, price: 55,  mag: 60,  rate: 0.045, dmg: 8,  spread: 0.10,  spd: 540, pellets: 1, reload: 2.0,  sfx: 'nailgun',  col: '#f2d14a', pin: 0.45, tag: 'pins them to the floor' },
  micro: { id: 'micro', name: 'MICROWAVE',     spr: SPR.micro, gr: 2, floor: 2, price: 80,  mag: 16,  rate: 0.24,  dmg: 34, spread: 0.02,  spd: 270, pellets: 1, reload: 2.1,  sfx: 'plasma',   col: '#4fd6e8', bounce: 3, burn: 16, size: 3, tag: 'reheats the dead' },
  chill: { id: 'chill', name: 'FREEZER BURN',  spr: SPR.chill, gr: 2, floor: 3, price: 95,  mag: 55,  rate: 0.055, dmg: 9,  spread: 0.14,  spd: 400, pellets: 1, reload: 2.2,  sfx: 'plasma',   col: '#9fe4ff', chill: 2.2, size: 2, tag: 'the cold aisle, weaponised' },
  hog:   { id: 'hog',   name: 'THE HOG',       spr: SPR.hog,   gr: 2, floor: 4, price: 120, mag: 120, rate: 0.032, dmg: 10, spread: 0.13,  spd: 500, pellets: 1, reload: 3.4,  sfx: 'minigun',  col: '#ffd28a', spin: 1, slow: 0.45, tag: 'spins up. never stops.' },
  rot:   { id: 'rot',   name: 'THE ROTISSERIE',spr: SPR.rot,   gr: 3, floor: 5, price: 165, mag: 70,  rate: 0.050, dmg: 14, spread: 0.05,  spd: 330, pellets: 1, reload: 2.6,  sfx: 'plasma',   col: '#ff9a3a', radial: 0.55, burn: 10, size: 2, lock: 'seal', tag: 'it does not care where you point it' },
  /* THE DELI SLICER. The EPIC rung's second seat, and the only gun in the
     rack whose round comes back.

     ---- why a returning blade, and why here ----

     Every weapon above RARE owns a verb nothing else has: THE ROTISSERIE
     *sprays*, THE FLYKILLER *chains*, BLACK FRIDAY *gathers*, GOD FINGER
     *punches through*. The slicer *returns* — a disc that flies out to a
     fixed reach, stalls, and comes home through everything a second time.

     That makes it the exact middle of the tier it sits in, which is the whole
     reason it exists. THE ROTISSERIE is damage you cannot aim. GOD FINGER is
     damage that lands the instant you release. The slicer is damage you aim
     perfectly and then have to *wait for* — and, crucially, wait for **where
     you are standing**, because the second pass is measured from you. Throw
     it down a corridor and back out, and you threw half a gun away.

     `blade.reach` is in pixels, not seconds, so the round trip is the same
     length whatever else is modifying the gun; `ret` is faster than a player
     can run, so it always catches up; `acc` is what stops the turn looking
     like a bounce — it stalls, hangs, and gathers speed toward you. It clears
     `hitIds` at the turn, which is what makes the way home a real second pass
     rather than a victory lap. */
  deli:  { id: 'deli',  name: 'THE DELI SLICER', spr: SPR.deli, gr: 3, floor: 6, price: 175, mag: 4,   rate: 0.50,  dmg: 64,  spread: 0.01, spd: 400, pellets: 1, reload: 1.7,  sfx: 'slicer',   col: '#dfe8f2', size: 3, pierce: 99, knock: 16, life: 3.2, blade: { reach: 200, ret: 520, acc: 1500 }, tag: 'it comes back. that is the good part and the bad part.' },
  // knock 200 -> 110. A rail slug should still throw what it hits; it should
  // not clear the lane it punched through.
  /* GOD FINGER, promoted to LEGENDARY, and it reloads again.

     `noReload` is gone from the whole codebase. It came in because a 2.4s rack
     every five shots was a *third* tax on a gun that already paid a 0.5s
     charge and a 0.55s floor between shots, and the third tax was the one that
     made you stop playing: you spent it standing in the open having already
     committed to the fight.

     None of that stopped being true, so the reload had to come back cheaper
     than it left. Six in the magazine instead of five and 1.9s to rack instead
     of 2.4: measured on a held trigger, that is six shots over 3.23s and then
     1.90s of rack — a 5.13s cycle that is roughly two thirds firing. It gives
     the gun the one thing it never had, which is a moment where it is *out*
     and you had to have thought about that before you walked in.

     What that costs it is SUSTAINED damage, and a lot: 300dps standing still
     before, 270 now (measured, not modelled — the charge overlaps the cooldown
     when the trigger is held, so the paper figure of 154 is simply wrong).
     What it buys is BURST. 165 -> 210 a slug, which is the biggest single
     round in the game after BLACK FRIDAY's, still with pierce 99 behind it.

     That is the trade the rung is for: it is no longer the gun that never
     stops, it is the gun that ends whatever is in the lane and then needs a
     second. It is also off the evolution ladder now — EVO_TIER stops at EPIC,
     so this is bought, like the other three, by someone who went and got the
     money for it. */
  rail:  { id: 'rail',  name: 'GOD FINGER',    spr: SPR.rail,  gr: 4, floor: 6, price: 360, mag: 6,   rate: 0.55,  dmg: 210, spread: 0,    spd: 950, pellets: 1, reload: 1.9,  sfx: 'railgun',  col: '#a8e8ff', charge: 0.5, pierce: 99, size: 3, knock: 110, tag: 'you point. the room is shorter afterwards.' },
  // THE FISH. Coins, not cards — 500 of them, which at COIN_RATE is most of a
  // deep run. `prism: 1` is what makes its beam cycle colour; see drawWorld.
  omega: { id: 'omega', name: 'THE FISH',      spr: SPR.omega, gr: 4, floor: 4, price: OMEGA_COINS, mag: 300, rate: 0.02, dmg: 720, spread: 0, spd: 0, pellets: 0, reload: 2.6, sfx: 'beam', col: '#c05cff', beam: 1, prism: 1, girth: 11, tag: 'it is a fish. it fires a laser. do not ask.' },
  /* ---- the other two LEGENDARIES ----
     Both are deep, both are expensive, and neither is a bigger number than the
     gun below it — that is the point of the rung. A LEGENDARY has to do
     something the rack cannot already do, or it is just an EPIC that costs
     more, so each one owns a verb nothing else has: THE FLYKILLER *chains*,
     BLACK FRIDAY *gathers*. Neither is on the evolution ladder; EVO_TIER stops
     at EPIC and these are bought, like the fish and like GOD FINGER. */
  zap:   { id: 'zap',   name: 'THE FLYKILLER', spr: SPR.zap,   gr: 4, floor: 6, price: 380, mag: 24,  rate: 0.30,  dmg: 44, spread: 0.02,  spd: 620, pellets: 1, reload: 2.2,  sfx: 'plasma',   col: '#9cf0ff', size: 2, chain: 5, chainR: 132, pin: 0.22, tag: 'the blue light above the deli. it has opinions.' },
  // `void` is a reserved word but a perfectly legal property name, and every
  // use of it here is string-keyed. Consistency with SPR.void wins.
  void:  { id: 'void',  name: 'BLACK FRIDAY',  spr: SPR.void,  gr: 4, floor: 8, price: 460, mag: 5,   rate: 0.95,  dmg: 250, spread: 0,    spd: 330, pellets: 1, reload: 3.1,  sfx: 'railgun',  col: '#c46bff', size: 4, life: 2.4, sing: { r: 96, pull: 340 }, knock: 0, tag: 'everything comes to the sale' }
};
const WORDER = ['pistol', 'scar', 'saw', 'price', 'nail', 'micro', 'chill', 'hog', 'rot', 'deli', 'rail', 'omega', 'zap', 'void'];
/* Two of these are behind contracts and simply are not in PACI's crate until
   you have earned them — see CONTRACTS. All four LEGENDARIES are here too:
   they go through exactly the same depth/price gates as everything else, and
   `evoPickable()` reads this list but only ever asks it for grades 0-3, so a
   LEGENDARY can never fall out of an evolution rung. */
const BUYABLE = ['scar', 'saw', 'price', 'nail', 'micro', 'chill', 'hog', 'rot', 'deli', 'rail', 'zap', 'void'];

/* ---- COSMETICS. bought from the vault, kept forever. ----

   Repointed for the third Damjan. `r`/`R`/`w` were a headband, then a
   neckerchief; they are the WORK SHIRT now — the largest coloured area on him
   after the apron, and what CRIMSON always meant. `u`/`U` is the apron, which
   the darker sets take with them: it is the biggest single surface on him, and
   leaving it bone-white under VOID would put a floodlit rectangle in the
   middle of a cosmetic whose whole idea is that he stopped casting a shadow.

   `j`/`J` (jacket) and `h`/`H` (hair) are gone from the sprite entirely, so
   the overrides that named them went too — a palette key nothing draws is a
   line of config that silently does nothing.

   NOTHING here touches the head wrap (`9`/`7`) or the rail (`g`/`G`). That is
   deliberate and it is the rule the whole set is built on: **the parts of him
   that are not his do not get to be a colour he chose.** A gold rail would
   read as equipment. It is not equipment.

   Ids are untouched, so every save keeps what it had unlocked and equipped. */
const COSMETICS = [
  { id: 'crimson', name: 'CRIMSON',      price: 0,     pal: {},                                                                                    tag: 'the one he showed up in' },
  { id: 'gold',    name: 'GOLD',         price: 1000,  pal: { r: '#f0c243', R: '#a37c12', w: '#fff3c0' },                                           tag: 'earned, technically' },
  { id: 'toxic',   name: 'TOXIC',        price: 2500,  pal: { r: '#8ef04a', R: '#3f8a1e', w: '#e8ffcc', u: '#cfe8b4', U: '#93ad7c' },               tag: 'do not lick' },
  { id: 'void',    name: 'VOID',         price: 5000,  pal: { r: '#2a1030', R: '#140618', w: '#a05cff', u: '#4a3a5e', U: '#2c2138' },               tag: 'he stopped casting a shadow' },
  /* BONE MASK bleaches every scrap of skin he has left — the face and the one
     bare hand — and darkens the shirt and apron so a white head does not swim
     into a white chest. The pupil goes red, because a skull with a brown eye
     in it is a man in makeup and a skull with a red one is not. */
  { id: 'bone',    name: 'BONE MASK',    price: 9000,  pal: { s: '#e8e2d0', S: '#b0a894', p: '#c02020', r: '#5a5248', R: '#332f2a', u: '#6b6560', U: '#454140' }, tag: 'nobody asked where the face went' },
  { id: 'flame',   name: 'LIVING FLAME', price: 15000, pal: { r: '#ff8a20', R: '#c02a00', w: '#ffe08a' }, fx: 'fire',                               tag: 'the shirt is on fire. he has not mentioned it.' }
];

/* ============================================================
   SAVE / VAULT
   ============================================================ */
const SAVE_KEY = 'meat_protocol_v2';
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
}
function writeSave(patch) {
  const s = loadSave();
  Object.assign(s, patch);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
  return s;
}
/* Coins, cards and the vault all survive death — the run resets, the wallet doesn't. */
function persist() {
  const s = loadSave();
  writeSave({
    best: Math.max(s.best || 0, S.score),
    deep: Math.max(s.deep || 0, S.room + 1),
    vault: Math.max(s.vault || 0, S.vault),
    coins: S.coins, cards: S.cards, evo: S.evo | 0,
    evoGuns: (S.evoGuns || []).slice(), evoCards: (S.evoCards || []).slice(),
    godFound: s.godFound || S.god,
    modagaz: Math.max(s.modagaz || 0, S.modagazFound),
    goro: s.goro || S.goro
  });
}

/* ============================================================
   EVOLUTION

   It is not a title-screen button any more. Evolving restarts the run, and a
   button that restarts the run belongs where you can see what you are giving
   up — you press it from the pause screen, mid-floor, holding the coins it is
   about to take. From the title it was a free lever with no cost on screen.

   What it pays out is a permanent roster. Each rung hands you one gun that is
   yours from the first frame of every run afterwards, drawn from the rarity
   that rung opened. Once the roster holds one gun of every rarity there is
   nothing left to hand over in the crate, so the rungs above that deal three
   cards at LEGENDARY instead and you start every run holding the one you took.
   ============================================================ */
function evoGuns() { return S.evoGuns || (S.evoGuns = []); }
function evoCards() {
  if (!S.evoCards) S.evoCards = [];
  return S.evoCards;
}
function evoCardDef(id) { return CARDS.find(c => c.id === id); }
/* Everything in PACI's crate except the fish, minus anything still behind an
   unsigned contract — evolution is a different door into the same crate, not
   a way around the lock on it. */
function evoPickable() {
  return BUYABLE.filter(id => !WEP[id].lock || contractDone(WEP[id].lock));
}
/* True once every rarity on the ladder is represented in the roster. */
function evoFullSet() {
  const have = evoGuns().map(id => WEP[id].gr);
  return EVO_TIERS_ALL.every(g => have.indexOf(g) >= 0);
}
/* The guns rung `ev` is allowed to offer: the tier it opened, minus whatever
   the roster already holds.

   Tiers hold two or three guns and a rung takes one, so the back half of a
   tier would otherwise be a screen with a single card on it — which is not a
   choice, it is a receipt. When the tier is down to its last gun the pool
   opens the tier *above* it too, and only falls back downward when there is
   nothing above. A locked ROTISSERIE is handled by the same widening. */
function evoGunPool(ev) {
  const tier = EVO_TIER[clamp((ev | 0) - 1, 0, EVO_TIER.length - 1)];
  const held = evoGuns(), stock = evoPickable();
  const at = g => stock.filter(id => WEP[id].gr === g && held.indexOf(id) < 0);
  const pool = at(tier);
  for (let g = tier + 1; g <= 3 && pool.length < 2; g++) for (const id of at(g)) pool.push(id);
  for (let g = tier - 1; g >= 0 && pool.length < 2; g--) for (const id of at(g)) pool.push(id);
  return pool;
}
/* What rung `ev` is about to pay out: 'gun', 'card', or nothing left to give. */
function evoReward(ev) {
  if (!evoFullSet() && evoGunPool(ev).length) return 'gun';
  if (evoCardPool().length) return 'card';
  return null;
}
/* Cards you could still be handed at LEGENDARY. A card already banked at its
   own max rank has nothing left to give, and the depth gates do not apply —
   you are not on a floor yet. */
function evoCardPool() {
  const taken = evoCards();
  return CARDS.filter(c => {
    let n = 0;
    for (const id of taken) if (id === c.id) n++;
    return n < c.max;
  });
}

/* Open the pick screen for the rung just bought. Returns false when the rung
   has nothing to offer, so the caller can restart without an empty door. */
function openEvoPick() {
  const kind = evoReward(S.evo | 0);
  if (!kind) return false;
  if (kind === 'gun') {
    S.evoOffer = { kind: 'gun', guns: evoGunPool(S.evo | 0),
                   tier: EVO_TIER[clamp((S.evo | 0) - 1, 0, EVO_TIER.length - 1)] };
  } else {
    /* Three cards, every one of them LEGENDARY. Weighted the same way a hand
       is, so SPLIT stays the event it is meant to be even here. */
    const bag = evoCardPool().slice(), out = [];
    while (out.length < 3 && bag.length) {
      let total = 0;
      for (const c of bag) total += c.w === undefined ? 1 : c.w;
      let r = Math.random() * total, idx = bag.length - 1;
      for (let i = 0; i < bag.length; i++) { r -= bag[i].w === undefined ? 1 : bag[i].w; if (r <= 0) { idx = i; break; } }
      const c = bag.splice(idx, 1)[0];
      out.push({ c, g: 4, val: cardVal(c, 4) });
    }
    S.evoOffer = { kind: 'card', cards: out };
  }
  S.mode = 'evolve';
  S.evoIn = 0;
  if (A.duck) A.duck(0.6, 3.2);
  A.doorOpen();
  return true;
}
function takeEvoGun(id) {
  if (S.mode !== 'evolve' || evoGuns().indexOf(id) >= 0) return;
  evoGuns().push(id);
  evoGuns().sort((a, b) => WORDER.indexOf(a) - WORDER.indexOf(b));
  persist();
  S.evoOffer = null;
  A.buy(); A.bigpickup();
  startRun();
  // after, not before: startRun -> freshState() zeroes the flash
  S.flash = 0.7; S.flashCol = WEP[id].col;
}
function takeEvoCard(o) {
  if (S.mode !== 'evolve' || !o) return;
  evoCards().push(o.c.id);
  persist();
  S.evoOffer = null;
  A.god(); A.roar();
  startRun();
  S.flash = 0.9; S.flashCol = GRADE[4].col;
}
/* Fold the permanent roster into a run that has just been built. Cards go in
   before guns on purpose: magazine size reads ST().magMul, which reads the
   deck, so a TOOLS card in the starting hand has to be banked before any
   magazine is filled. */
function applyEvoLoadout() {
  for (const id of evoCards()) {
    const c = evoCardDef(id); if (!c) continue;
    const d = S.deck[c.id] || (S.deck[c.id] = { rank: 0, amt: 0, g: 0 });
    d.rank++;
    d.amt = Math.round((d.amt + cardVal(c, 4)) * 10) / 10;
    d.g = 4;
  }
  recalcAisles();
  for (const id of evoGuns()) {
    if (!WEP[id] || S.p.owned.indexOf(id) >= 0) continue;
    S.p.owned.push(id);
    S.p.mags[id] = magCap(WEP[id]);
  }
  S.p.owned.sort((a, b) => WORDER.indexOf(a) - WORDER.indexOf(b));
  S.p.wi = 0;
}

/* Evolving has to be earned, and it ends at EVO_MAX. */
function canEvolve() { return (S.evo | 0) < EVO_MAX && S.coins >= EVO_COST(S.evo | 0); }
function evolve() {
  if (!canEvolve()) { A.denied(); return false; }
  S.evo = (S.evo | 0) + 1;
  S.coins = 0; S.cards = 0;
  persist();
  A.god(); A.roar();
  S.flash = 1.0; S.flashCol = '#b028ff';
  /* The pick screen restarts the run on its way out. If the rung has nothing
     left to offer — every gun taken and every card at max — restart straight
     away rather than opening an empty door. */
  if (!openEvoPick()) startRun();
  return true;
}
/* ...and undoing it puts the world back to plain, ordinary awful: the level,
   the roster and the starting hand all go, and the run restarts without them
   because you cannot keep holding guns you no longer own. */
function resetEvolution() {
  if (!(S.evo | 0)) { A.denied(); return false; }
  S.evo = 0;
  S.evoGuns = []; S.evoCards = [];
  persist();
  A.bigpickup();
  S.flash = 0.8; S.flashCol = '#9fe08a';
  startRun();
  return true;
}
function ownedCos() { const s = loadSave(); return s.cosOwned || ['crimson']; }
function equippedCos() { const s = loadSave(); return s.cosEq || 'crimson'; }
function cosDef(id) { return COSMETICS.find(c => c.id === id) || COSMETICS[0]; }

/* ============================================================
   STATE
   ============================================================ */
const S = {};
/* MM:SS, and H:MM:SS only once there is an hour to show — a leading `0:` on
   every run of a game whose floors take four minutes is two characters of
   nothing. Floors are padded so the number never changes width mid-wave and
   jitters the right edge of the HUD. */
function runClock(t) {
  const s = Math.max(0, (t === undefined ? S.runT : t) | 0);
  const h = (s / 3600) | 0, m = ((s / 60) | 0) % 60;
  const p2 = v => (v < 10 ? '0' : '') + v;
  return h ? h + ':' + p2(m) + ':' + p2(s % 60) : m + ':' + p2(s % 60);
}

function freshState() {
  const sv = loadSave();
  Object.assign(S, {
    mode: 'title', t: 0, deadT: 0, runT: 0,
    room: 0, wave: 0, waveState: 'idle', waveT: 0,
    queue: [], spawnT: 0,
    aw: 0, ah: 0, walls: [], deco: [],
    p: null, bul: [], eb: [], en: [], part: [], gibs: [], props: [], drops: [],
    floats: [], cracks: [], nades: [], rings: [], shops: [],
    boss: null, door: null, secret: null, corner: null,
    cam: { cx: 0, cy: 0, z: 1, punch: 0, sh: 0, shx: 0, shy: 0, shPh: 0, seed: 0 },
    god: false,
    coins: sv.coins || 0, cards: sv.cards || 0, vault: sv.vault || 0,
    evo: sv.evo || 0, modagazFound: sv.modagaz || 0,
    /* The permanent roster. Both survive freshState because both are the
       whole point of evolving — they are wallet, not run state. Guns are
       filtered against WEP here; cards cannot be, because freshState runs
       above CARDS in the file and a `const` in its own dead zone throws.
       evoCards() does that filtering at the point of use instead. */
    evoGuns: (sv.evoGuns || []).filter(id => !!WEP[id]),
    evoCards: (sv.evoCards || []).slice(),
    evoOffer: null,
    goro: false, goroHits: 0, goroT: 0, vacuum: 0,
    /* THE MENU. `deck` is the run's whole build; `luck` tilts every hand.
       `aisle` is the per-aisle rank tally THE ORDER reads, `fused` the
       off-cuts taken, and handTop/handIn drive how loudly a hand arrives. */
    xp: 0, level: 1, xpNext: 80, upgPts: 0,
    deck: {}, hand: null, lvlLuck: 0, rerolls: 0, cardsTaken: 0, luck: 0,
    aisle: {}, fused: {}, fusedOrder: [], dealt: 0, handTop: 0, handIn: 0,
    orbs: [], pools: [], arcs: [],
    moveT: 0, holdT: 0, waveKills: 0, waveHit: false, frostT: 0, shotN: 0, bleedT: 0,
    augs: {}, augOffer: null, tomce: null,
    floorBosses: 0, apexKills: 0, fx: [], coinFrac: 0,
    killsSinceNova: 0, savesLeft: 0, regenT: 0, pendingLuck: 0, lvlDelay: 0, pendingKick: 0,
    scarLv: 1, glusec: 0,
    layout: 'scatter',
    bossKills: 0, shopDue: false, shopsSeen: 0, inShop: false, shopStash: null, paci: null,
    apex: false, mini: null,
    score: 0, combo: 1, comboT: 0, kills: 0, streak: 0,
    flash: 0, flashCol: '#fff', hitstop: 0, slow: 0, redness: 0, modT: 0,
    burstT: -1, burstN: 0,      // per-frame death-burst budget, see deathBurst
    jump: 0, jumpSpr: null, muzzle: null, beamHit: null,
    msg: '', msgT: 0, sub: '', banner: null, prompt: null,
    fade: 0, fadeDir: 0, pending: null, cosReturn: 'title',
    /* The floor's opening beat. Both count down in game time inside update(),
       which is the whole point — see startRun(). */
    introT: 0, introMsgT: 0,
    /* THE FLOOR TWIST. `twistT` counts to the next beat, `twistOn` is how long
       the beat still has to run, `twistN` is which beat this is — a couple of
       the twists alternate. All game time, so a menu pauses the weather. */
    twistT: 0, twistOn: 0, twistN: 0, chillT: 0,
    won: false, winT: 0,
    /* Boss hazards that are not simple projectiles: telegraphed mortar strikes,
       proximity mines and sweeping beams. One array with a `k` discriminator
       rather than three, because they share a lifetime, a draw pass and a
       "clear the room" moment. See updateHaz. */
    haz: [],
    /* Which boss is on which floor THIS RUN. Shuffled in startRun. */
    roster: null,
    whisperT: rnd(6, 14), beatT: 0, breathT: 0, ui: []
  });
}
freshState();

/* ============================================================
   DERIVED STATS
   ============================================================ */
/* THE GROCERIES ARE GONE.

   Five signature items — BANANA, MELON, COOLADE, GLOCK-18, STOLEN BICYCLE —
   used to drop off floor bosses and live in their own screen (THE COLD ROOM).
   They were a second progression system running in parallel with the deck,
   awarding bigger numbers than any card for no decision beyond "take the one
   you haven't got", and their bonuses were multiplicative on top of everything
   the deck already gave you. Two systems both answering "what makes you
   stronger" is one too many.

   The whole apparatus is removed: the items, the cold room, the drop kind, the
   HUD strip. What is left is the deck, which is the system that was actually
   designed.

   Two of their VERBS were worth keeping, so they became cards rather than
   dying with the groceries — see SIDEARM and IGNITION in CARDS. Everything
   else (the peels, the rind shield, the pierce) already had a card doing the
   same job. */
function ST() {
  const maxhp = Math.max(30, Math.round((100 + dk('roughage')
                            + (aisleT1('produce') ? 20 : 0) + (aisleT3('produce') ? 45 : 0))
                           * (1 - Math.min(0.24, dkr('pricehike') * 0.08))
                           * (1 - ag('glass') * 0.15 - ag('hollow') * 0.10 + ag('ballast') * 0.22)));
  /* Missing health feeds RAW NERVE. Guarded because ST() is called before the
     player exists during boot. */
  const hp01 = S.p ? clamp(S.p.hp / Math.max(1, maxhp), 0, 1) : 1;
  const hurt = 1 - hp01;
  /* ---- riders that are just a number, resolved once here ----
     MOMENTUM ramps while you move (update keeps S.moveT), THE LONG PIG counts
     the wave's dead, ARTERY reads the same wound RAW NERVE does. */
  const momentum = rd('adrenaline') ? clamp(S.moveT / 2.2, 0, 1) * 0.18 : 0;
  /* THE LONG PIG. One kill in ten for up to +120% damage, and NO LEFTOVERS
     stopped the counter ever resetting inside a floor — so from the middle of
     wave 3 onward it simply sat at its ceiling and the card stopped being a
     wave-by-wave gamble at all. One in fourteen, ceiling +85%: it still gets
     there on a long wave, and it takes most of one to do it. */
  const longpig = dkr('longpig') ? Math.min(dkc('longpig') / 100 * Math.floor(S.waveKills / 14), 0.85) : 0;
  return {
    speed: 94 * (1 + dk('adrenaline') / 100)
              * (1 + (aisleT3('produce') ? 0.10 : 0))
              * clamp(1 - ag('tinnitus') * 0.09 - ag('ballast') * 0.08 + ag('sleepless') * 0.14, 0.4, 2),
    maxhp,
    dmgMul: (S.god ? 3 : 1) * (S.goro ? 1.25 : 1)
              * (1 + dkc('malice') / 100)
              * (1 + dkc('nerve') / 100 * hurt)
              * (1 + dkc('debtcard') / 100)
              * (1 + momentum + longpig)
              * (1 + (aisleT1('butchery') ? 0.12 : 0))
              * (1 + (aisleT3('butchery') ? 0.28 : 0))
              * (1 + (rd('pricehike') ? 0.18 : 0))
              * (1 + (fz('primecut') ? 0.25 : 0))
              * (1 + ag('cataract') * 0.15 + ag('glass') * 0.24 + ag('thinskin') * 0.30),
    flatDmg: dkc('caliber'),
    crit: dkc('cleaver') / 100 + ag('coldblood') * 0.09 + (aisleT3('butchery') ? 0.15 : 0),
    critMul: 2.0 + dkc('deepcut') / 100,
    /* TUNNEL VISION pays out exactly where RAW NERVE is loudest. */
    resist: (1 - dkc('callus') / 100) * (1 - (aisleT1('frozen') ? 0.10 : 0))
              * (1 - (aisleT3('frozen') ? 0.16 : 0))
              * ((rd('nerve') && hp01 < 0.34) ? 0.75 : 1)
              * (1 + ag('thinskin') * 0.22 + ag('grease') * 0.11),
    dodge: dkc('aegis') / 100,
    pierce: dkc('carve'),
    shieldMax: dkc('apron') + (aisleT3('frozen') ? 1 : 0),
    shieldCd: 14 * (dkr('apron') ? 0.75 : 1),
    /* Inherited from the GLOCK-18 and the STOLEN BICYCLE, now bought as cards.
       Both kept their numbers roughly where the grocery had them, spread over
       more ranks so they ramp instead of arriving whole. */
    glocks: dkc('sidearm'),
    glockRate: rd('sidearm') ? 0.12 : 0.20,
    glockDmg: 13,
    ram: dkc('ignition'),
    ramFire: rd('ignition'),
    dashCd: 0.85 * (1 - dkc('wind') / 100) * (1 - ag('grease') * 0.30),
    /* ---- deck-driven weapon mods. These used to be bought per gun in the
       armory; they are cards now and they apply to whatever you are holding.
       WOUND UP and ARTERY both push the same dial from different directions. */
    rateMul: 1 / (1 + dkc('cycle') / 100
                    + (rd('cycle') ? clamp(S.holdT / 1.8, 0, 1) * 0.25 : 0)
                    + (fz('artery') ? hurt * 0.60 : 0)
                    + ag('tinnitus') * 0.16),
    split: dkc('split'),
    magMul: Math.max(0.35, 1 + dkc('hopper') / 100 + (aisleT1('hardware') ? 0.15 : 0)
                     + (aisleT3('hardware') ? 0.35 : 0) - ag('shortfuse') * 0.16),
    reloadMul: Math.max(0.2, 1 - dkc('quick') / 100 - (aisleT3('hardware') ? 0.22 : 0) - ag('shortfuse') * 0.22),
    bounce: dkc('ricochet') + (fz('crosscut') ? 2 : 0),
    home: dkc('guidance'),
    burn: dkc('spoiled'),
    slowHit: dkc('coldsnap') / 100,
    freeze: dkc('frostbite') / 100,
    aura: dkc('walkin') / 100,
    auraDmg: rd('walkin') ? 7 : 0,
    overkill: dkc('overkill'),
    graze: dkc('grazing') + ag('feeder') * 1.5,
    regen: dkc('regrowth') * ((rd('regrowth') && hp01 < 0.5) ? 2 : 1),
    lootMul: 1 + dkc('clearance') / 100,
    novaEvery: dkr('flashpoint') ? Math.max(30, 65 - dkc('flashpoint') * 17) : 0,
    /* ---- the new verbs ---- */
    hooks: dkc('hooks'),
    tender: dkc('tender') / 100,
    pool: dkc('render'),
    frostEvery: dkr('frost') ? Math.max(5, 11 - dkc('frost') * 3) : 0,
    marrow: dkc('marrow') / 100,
    /* The bleed is BLOOD DEBT's price and it scales with the rank, because a
       flat 1/s was cancelled outright by a single REGROWTH pick — at which
       point the card was +20% damage for nothing and the whole aisle's
       "worth it" premise fell over. PAID FORWARD is the refund, not a waiver. */
    bleed: dkr('debtcard'),
    payback: rd('debtcard') ? 3 : 0,
    /* ---- TOMCE's side of the ledger ---- */
    xpMul: Math.max(0.3, (1 + dkc('ripe') / 100)
              * (1 - ag('debt') * 0.14 - ag('feeder') * 0.18 + ag('loudmouth') * 0.45)),
    coinMul: COIN_RATE * (1 + ag('debt') * 0.40) * (rd('clearance') ? 2 : 1),
    sight: clamp(1 - ag('cataract') * 0.11 - ag('sleepless') * 0.10, 0.5, 1),
    /* WINDFALL used to be unconditional room-wide vacuum. It is a radius now —
       a big one, but a radius — so RIPE's rider is "loot comes to you" rather
       than "loot is collected". See the drop loop. */
    magnet: clamp((1 + dkc('ripe') / 100) * (1 - ag('coldblood') * 0.30), 0.3, 3),
    reach: rd('ripe') ? 190 : 0,
    swarm: 1 + ag('loudmouth') * 0.18,
    /* the sidearm gains a mark every FLOOR: new colour, new voice, +20% each */
    scarMul: 1 + 0.20 * (S.scarLv - 1)
  };
}

/* ============================================================
   THE MENU — the card deck.

   Three separate things used to be shuffled into one pile. They are not the
   same kind of reward and they no longer share a screen:

     level up      -> a hand of cards from the five aisles      (this file, below)
     floor boss    -> one of two SIGNATURE groceries            (THE COLD ROOM)
     TOMCE         -> one of three augments, each with a bill   (unchanged)

   A card holds { rank, amt, g }: rank is how many times you took it, amt is
   the accumulated number the game actually reads, and g is the best grade you
   ever took it at.

   RARITY IS NOT A MULTIPLIER. It was, and an EPIC card was just the same card
   with a bigger number on it, which is not a moment. Every card now carries a
   RIDER — a second, qualitative effect that only switches on if you take the
   card at RARE or better. A RARE MALICE is not 1.75 MALICEs, it is a
   different card. That is the whole excitement engine, and it is why the
   rarity is the first thing on the face.
   ============================================================ */
const RIDER_AT = 2;                 // RARE. Take a card at this or better and its rider lights.
const riderOn = id => { const d = S.deck[id]; return !!d && (d.g | 0) >= RIDER_AT; };
const rd = riderOn;                 // short name, used all over the engine hooks

/* The aisles are no longer just a colour on the edge of a card. Commit to one
   and it commits back: four ranks anywhere in an aisle buys a standing perk,
   eight buys a much louder one. This is what makes a run have a shape instead
   of being a pile of percentages. */
/* One word each, and the word says what the aisle does — BUTCHERY / PRODUCE /
   HARDWARE / EXPIRED were flavour that you had to memorise a mapping for.

   The colours are deliberately muted earth tones. The rarity ladder owns the
   bright saturated palette, and these two systems appear on the same screen;
   keeping them in different registers is the only reason a player can tell at
   a glance which colour means "quality" and which means "category". Nothing
   on a card is ever drawn in an aisle colour — the aisle colours live on THE
   ORDER strip and the deck headings, and nowhere else. */
/* ---- THREE RUNGS, ONE CADENCE ----

   THE ORDER stopped at eight ranks, which was a ceiling you hit around floor 5
   with any focused build and then never thought about again — the aisle you had
   committed to went quiet for the whole back half of the run. So there is a
   third rung.

   The three sit at 4 / 8 / 12: **one rung every four cards, three times.**
   That regularity is the whole point and it is worth more than any individual
   number. The rungs were 4 / 8 / 14 for one build, and 14 is unlearnable — it
   is not a multiple of anything, the strip could not draw a sensible bar
   toward it, and a player counting cards had no way to know when the next
   thing was coming. "Every four" is a rule you can hold in your head on the
   level-up screen, which is the only place it matters.

   Twelve ranks in one aisle across ten floors is still a real commitment: it
   is the rung you only see if you have refused cards from other aisles on
   purpose, and it pays like it.

   Rung 3 is a NAMED STATE, not another percentage. Each one turns the aisle
   into the thing it has been hinting at all run, and the deck screen prints the
   name — MASTERED is a tier, THE RED WORK is an identity. */
const AISLES = {
  butchery: { n: 'BLADES', col: '#a8564e', sub: 'hurting things',
              p1: '+12% damage', p2: 'crits cleave everything behind the target',
              t3: 'THE RED WORK', p3: '+28% damage, +15% crit, and crits ignite' },
  produce:  { n: 'FRESH',  col: '#6f9450', sub: 'health and speed',
              p1: '+20 max health', p2: 'clearing a wave heals a quarter of it back',
              t3: 'IN SEASON', p3: '+45 max health, +10% speed, and you regrow 2/s' },
  frozen:   { n: 'FROZEN', col: '#5486a0', sub: 'armour and slowing them down',
              p1: '-10% damage taken', p2: 'anything that dies slowed shatters for 45',
              t3: 'DEEP STORAGE', p3: '-16% more damage taken, +1 rind, and taking a hit freezes the room' },
  hardware: { n: 'TOOLS',  col: '#a8823c', sub: 'whatever gun you are holding',
              p1: '+15% magazine',  p2: 'finishing a reload throws out a shockwave',
              t3: 'THE WHOLE RACK', p3: '+35% magazine, -22% reload, and every gun you own fires with you' },
  expired:  { n: 'JUNK',   col: '#8a5f96', sub: 'bad for you. worth it.',
              p1: '+1 LUCK',        p2: 'every fourth card dealt comes up a rarity better',
              t3: 'PAST THE DATE', p3: '+2 LUCK, and one card in every hand is dealt RARE or better' }
};
const AISLE_ORDER = ['butchery', 'produce', 'frozen', 'hardware', 'expired'];
const AISLE_T1 = 4, AISLE_T2 = 8, AISLE_T3 = 12;
/* The rungs in order, so anything that draws progress can walk them instead of
   hardcoding which two of the three it knows about — which is exactly how the
   strip ended up claiming an aisle was MAXed at 8 while a rung sat at 14. */
const AISLE_RUNGS = [AISLE_T1, AISLE_T2, AISLE_T3];
/* How many rungs an aisle has earned, and what it is working toward. `goal` is
   null once all three are in, which is the only honest way to say MAX. */
function aisleProgress(k) {
  const n = ais(k);
  let done = 0;
  for (const r of AISLE_RUNGS) if (n >= r) done++;
  return { n, done, goal: done < AISLE_RUNGS.length ? AISLE_RUNGS[done] : null };
}
/* Recomputed on every pick rather than derived on read — ST() runs many times
   a frame and this would otherwise walk the whole card list each time. */
function recalcAisles() {
  S.aisle = {};
  for (const c of CARDS) { const r = dkr(c.id); if (r) S.aisle[c.aisle] = (S.aisle[c.aisle] | 0) + r; }
}
const ais = k => S.aisle ? (S.aisle[k] | 0) : 0;
const aisleT1 = k => ais(k) >= AISLE_T1;
const aisleT2 = k => ais(k) >= AISLE_T2;
const aisleT3 = k => ais(k) >= AISLE_T3;

/* Every entry: `d(v)` is what one more rank does, `r` is the rider that only
   exists at RARE or better. Riders are deliberately verbs — they change what
   you do, not what your numbers are — because a run you remember is a run
   where something started behaving differently. */
const CARDS = [
  /* ---- BUTCHERY: hurting things ---- */
  { id: 'malice',    name: 'MALICE',        aisle: 'butchery', max: 6, b: 0, v: 6,   d: v => '+' + v + '% damage',
    r: { n: 'SHARPENED', d: 'every 6th shot always crits' } },
  { id: 'cleaver',   name: 'CLEAVER',       aisle: 'butchery', max: 5, b: 0, v: 4,  cap: 60,  d: v => '+' + v + '% critical chance',
    r: { n: 'FOLLOW-THROUGH', d: 'crits splash everything within 26' } },
  { id: 'deepcut',   name: 'DEEP CUT',      aisle: 'butchery', max: 4, b: 1, v: 18,  d: v => '+' + v + '% critical damage',
    r: { n: 'HAMSTRUNG', d: 'a crit stuns whatever it lands on' } },
  /* OVERKILL. 18/rank at radius 42 with a full screen-shake on every kill.
     Three things were wrong with that and only one of them was the number.

     The damage: 54 at max rank is more than a CRAWLER has (26) and most of a
     SHRIEKER (38), so every kill killed its neighbours, and each of those
     kills bursts too — a queued chain, but still a chain that cleared packs
     you never shot at. 10/rank tops out at 30, which finishes wounded things
     and softens healthy ones.

     The radius: see killEnemy — 42 covered a pack and the pack behind it.

     The camera: see explode(`quiet`). A passive that fires on every kill does
     not get to shake the screen. */
  { id: 'overkill',  name: 'OVERKILL',      aisle: 'butchery', max: 3, b: 2, v: 10,  d: v => 'kills burst for ' + v + ' damage',
    r: { n: 'RENDERED', d: 'the burst sets the ground alight' } },
  { id: 'nerve',     name: 'RAW NERVE',     aisle: 'butchery', max: 3, b: 1, v: 15, cap: 80,  d: v => 'up to +' + v + '% damage as you bleed',
    r: { n: 'TUNNEL VISION', d: 'under a third health, -25% damage taken' } },
  { id: 'carve',     name: 'CARVE',         aisle: 'butchery', max: 2, b: 0, v: 1, int: 1, cap: 2, d: v => 'shots pass through ' + v + ' more',
    r: { n: 'SKEWER', d: 'each body a shot passes adds +25% damage' } },
  { id: 'tender',    name: 'TENDERISER',    aisle: 'butchery', max: 3, b: 0, v: 16, cap: 60, d: v => '+' + v + '% damage to slowed, frozen or pinned',
    r: { n: 'DEAD WEIGHT', d: 'and your hits stagger them too' } },
  { id: 'hooks',     name: 'THE HOOKS',     aisle: 'butchery', max: 3, b: 1, v: 1, int: 1, cap: 3, d: v => v + ' meat hook' + (v > 1 ? 's orbit' : ' orbits') + ' you',
    r: { n: 'ON THE RAIL', d: 'they swing wider and drag things in' } },
  /* ---- PRODUCE: staying alive and moving ---- */
  { id: 'adrenaline',name: 'ADRENALINE',    aisle: 'produce', max: 6, b: 0, v: 5,    d: v => '+' + v + '% move speed',
    r: { n: 'MOMENTUM', d: 'keep moving for up to +18% damage' } },
  { id: 'roughage',  name: 'ROUGHAGE',      aisle: 'produce', max: 6, b: 0, v: 15,   d: v => '+' + v + ' max health',
    r: { n: 'STOCKED', d: 'and it heals you for that much on the spot' } },
  { id: 'regrowth',  name: 'REGROWTH',      aisle: 'produce', max: 4, b: 0, v: 0.4, dec: 1, cap: 3, d: v => '+' + v + ' health a second',
    r: { n: 'SCAR TISSUE', d: 'twice as fast below half health' } },
  { id: 'grazing',   name: 'GRAZING',       aisle: 'produce', max: 4, b: 0, v: 0.6, dec: 1, cap: 4, d: v => '+' + v + ' health a kill',
    r: { n: 'GORGED', d: 'healing past full banks a shield instead' } },
  { id: 'wind',      name: 'SECOND WIND',   aisle: 'produce', max: 3, b: 0, v: 15, cap: 50, d: v => '+' + v + '% dash rate, and dashes chill',
    r: { n: 'THROUGH THEM', d: 'dashing through something opens it up' } },
  /* WINDFALL was "every drop on the floor, wherever it is, comes to you" —
     which is not a rider, it is the removal of a system. Loot placement stops
     mattering, the wave-end vacuum stops mattering, and there is no reason to
     walk anywhere ever again. It is a very large RADIUS now (190px, roughly
     two-fifths of the arena's short side) so the fantasy survives: you still
     hoover up the room around you, you just have to be in the room. */
  { id: 'ripe',      name: 'RIPE',          aisle: 'produce', max: 3, b: 0, v: 12, cap: 45, d: v => '+' + v + '% experience and pickup reach',
    r: { n: 'WINDFALL', d: 'loot comes to you from most of the room' } },
  /* ---- inherited from the STOLEN BICYCLE ---- */
  { id: 'ignition',  name: 'IGNITION',      aisle: 'produce', max: 3, b: 1, v: 32, cap: 100, d: v => 'your dash RAMS things for ' + v,
    r: { n: 'BURNOUT', d: 'and leaves a trail of fire behind you' } },
  { id: 'marrow',    name: 'MARROW',        aisle: 'produce', max: 3, b: 1, v: 6, cap: 24, d: v => 'clearing a wave heals ' + v + '% of your health',
    r: { n: 'BONE BROTH', d: 'and hands you a frag with it' } },
  /* ---- FROZEN: taking less, slowing them down ---- */
  { id: 'callus',    name: 'CALLUS',        aisle: 'frozen', max: 6, b: 0, v: 5, cap: 45,  d: v => '-' + v + '% damage taken',
    r: { n: 'THICK HIDE', d: 'the first hit of every wave does nothing' } },
  { id: 'aegis',     name: 'AEGIS PLATING', aisle: 'frozen', max: 3, b: 0, v: 7, cap: 32,  d: v => v + '% chance a hit does nothing',
    r: { n: 'DEFLECTION', d: 'a plated hit throws the room off you' } },
  { id: 'coldsnap',  name: 'COLD SNAP',     aisle: 'frozen', max: 3, b: 0, v: 11, cap: 50, d: v => 'your hits slow by ' + v + '%',
    r: { n: 'BRITTLE', d: 'anything slowed takes +22% from everything' } },
  { id: 'frostbite', name: 'FROSTBITE',     aisle: 'frozen', max: 3, b: 1, v: 4, cap: 20,  d: v => v + '% chance to freeze solid',
    r: { n: 'SHATTER', d: 'frozen things burst for 60 when they go' } },
  { id: 'walkin',    name: 'THE WALK-IN',   aisle: 'frozen', max: 3, b: 0, v: 8, cap: 40,  d: v => 'things near you crawl ' + v + '% slower',
    r: { n: 'FREEZER DOOR', d: 'and the cold does 7 a second' } },
  { id: 'apron',     name: "BUTCHER'S APRON",aisle:'frozen', max: 2, b: 1, v: 1, int: 1, cap: 2, d: v => '+' + v + ' rind shield, regrows on its own',
    r: { n: 'SPRUNG', d: 'a shield breaking knocks the room back' } },
  { id: 'frost',     name: 'HARD FROST',    aisle: 'frozen', max: 2, b: 2, v: 1, int: 1, cap: 2, d: v => 'a freezing pulse every ' + Math.max(5, 11 - v * 3) + 's',
    r: { n: 'DEEP FREEZE', d: 'the pulse cuts as well as freezes' } },
  /* ---- HARDWARE: whatever you are holding ---- */
  { id: 'cycle',     name: 'CYCLE',         aisle: 'hardware', max: 5, b: 0, v: 6, cap: 45, d: v => '+' + v + '% fire rate',
    r: { n: 'WOUND UP', d: 'holding the trigger winds to another +25%' } },
  /* SPLIT. Was rank 2, dealt like anything else, and turned every gun in the
     game into five guns — one pick roughly tripled crowd output, which meant
     every other HARDWARE card was a worse SPLIT. It is now one rank, two
     rounds, no centre shot, and it does not turn up until floor 3. See `leg`
     and `w` below: it is the one card in the deck that always deals
     LEGENDARY, and at w 0.30 against everything else's 1 it turns up in
     roughly one hand in forty — about once in a deep run. Rarer than that
     (0.08, where this landed first) is not rare, it is removed: CROSS-CUT
     needs a rank of it and nobody would ever build one. */
  { id: 'split',     name: 'SPLIT',         aisle: 'hardware', max: 1, b: 1, floor: 2, leg: 1, w: 0.30,
    v: 1, int: 1, cap: 1, d: () => 'your shot becomes two, each at 65% power',
    r: { n: 'CROSSFIRE', d: 'and both of them steer themselves in' } },
  { id: 'caliber',   name: 'CALIBER',       aisle: 'hardware', max: 5, b: 0, v: 1.2, dec: 1, cap: 12, d: v => '+' + v + ' flat damage a shot',
    r: { n: 'OVERBORE', d: 'and the rounds come out visibly bigger' } },
  { id: 'hopper',    name: 'HOPPER',        aisle: 'hardware', max: 3, b: 0, v: 22, cap: 90, d: v => '+' + v + '% magazine',
    r: { n: 'BOTTOM OF THE BOX', d: 'the last third of a mag hits 35% harder' } },
  { id: 'quick',     name: 'QUICK HANDS',   aisle: 'hardware', max: 3, b: 0, v: 11, cap: 45, d: v => '-' + v + '% reload time',
    r: { n: 'SLAM FIRE', d: 'a finished reload blows the room back' } },
  { id: 'ricochet',  name: 'RICOCHET',      aisle: 'hardware', max: 2, b: 1, v: 1, int: 1, cap: 3, d: v => 'shots bounce ' + v + ' more times',
    r: { n: 'ANGLE OF ATTACK', d: 'every bounce adds +30% damage' } },
  { id: 'guidance',  name: 'GUIDANCE',      aisle: 'hardware', max: 2, b: 2, v: 1.1, dec: 1, cap: 3.5, d: v => 'shots steer, turn rate ' + v,
    r: { n: 'LOCK', d: 'they pick their own target and keep it' } },
  { id: 'munitions', name: 'MUNITIONS',     aisle: 'hardware', max: 2, b: 1, v: 1, int: 1, cap: 2, d: v => '+' + v + ' frag every wave',
    r: { n: 'INCENDIARY', d: 'frags leave the ground burning' } },
  /* ---- inherited from the GLOCK-18 ----

     A second gun that aims and fires itself is not a percentage. It is a whole
     extra source of damage that runs while you are reloading, dashing, or
     doing nothing at all — and at rank 2 it is two of them. Rolled at COMMON,
     that arrived as a shrug of a card carrying a permanent 40% uplift; there
     was no version of the hand where you did not take it.

     So it is dealt the way SPLIT is dealt, and for the same reason: `leg`
     means it never rolls a grade, it is LEGENDARY or it is not dealt at all,
     and `w` makes it about one hand in thirty rather than one in thirty-nine.
     Because LEGENDARY always clears RIDER_AT, AKIMBO is never off — the fast
     spare gun IS the card now, rather than a tier of it. Held back to floor 4
     on top, so the run has a shape before it turns up. */
  { id: 'sidearm',   name: 'THE OTHER HAND',aisle: 'hardware', max: 2, b: 2, floor: 3, leg: 1, w: 0.40,
    v: 1, int: 1, cap: 2,
    d: v => v + ' spare gun' + (v > 1 ? 's fire' : ' fires') + ' itself at whatever is closest',
    r: { n: 'AKIMBO', d: 'and they never stop to think about it' } },
  /* ---- EXPIRED: the bad idea aisle ---- */
  { id: 'clearance', name: 'CLEARANCE',     aisle: 'expired', max: 3, b: 1, v: 18, cap: 70, d: v => '+' + v + '% loot, and better cards',
    r: { n: 'DOUBLE COUPON', d: 'coins are worth two' } },
  { id: 'pricehike', name: 'PRICE HIKE',    aisle: 'expired', max: 2, b: 1, v: 30, cap: 80, d: v => '+' + v + '% experience, -8% max health',
    r: { n: 'WORTH IT', d: 'and +18% damage on top' } },
  // 6 -> 5 a rank. Burn is applied by every pellet and ticks whether or not you
  // keep shooting, so on a nine-pellet shotgun it was doing more work than the
  // gun was; CONTAGION then spread that to the pack for free.
  { id: 'spoiled',   name: 'SPOILED',       aisle: 'expired', max: 3, b: 0, v: 5, cap: 26,  d: v => 'your hits burn for ' + v + '/s',
    r: { n: 'CONTAGION', d: 'a burning thing sets its neighbours alight' } },
  { id: 'seconds',   name: 'SECOND HELPING',aisle: 'expired', max: 1, b: 2, v: 1, int: 1, cap: 1, d: v => 'survive ' + v + ' fatal hit a floor',
    r: { n: 'FULL PLATE', d: 'and you come back at full health' } },
  /* FLASHPOINT was a nova every 17 kills, then every 12 at rank 2 — and a nova
     kills more than twelve things. That is not a card, it is a loop: the nova
     pays for the next nova, and from the moment you take the second rank the
     rest of the floor is you walking through detonations you did not ask for.
     A kill-triggered effect has to cost more kills than it makes, or it never
     stops. 48 / 31 sits above what a (now weaker — see fireNova) nova clears
     in a dense wave, so it fires two or three times a wave at full stack and
     each one is a moment again. Floor 3 at the earliest. */
  { id: 'flashpoint',name: 'FLASHPOINT',    aisle: 'expired', max: 2, b: 2, floor: 2, v: 1, int: 1, cap: 2, d: v => 'a nova every ' + Math.max(30, 65 - v * 17) + ' kills',
    r: { n: 'FALLOUT', d: 'the nova leaves the floor burning' } },
  { id: 'debtcard',  name: 'BLOOD DEBT',    aisle: 'expired', max: 2, b: 1, v: 14, cap: 30, d: v => '+' + v + '% damage. the debt bleeds you',
    r: { n: 'PAID FORWARD', d: 'every kill gives 3 health back' } },
  { id: 'longpig',   name: 'THE LONG PIG',  aisle: 'expired', max: 2, b: 2, v: 7, cap: 16, d: v => '+' + v + '% damage per 10 kills this wave',
    r: { n: 'NO LEFTOVERS', d: 'it never resets' } },
  { id: 'render',    name: 'RENDERING',     aisle: 'expired', max: 3, b: 1, v: 10, cap: 36, d: v => 'the dead leave a pool that burns for ' + v,
    r: { n: 'THE DRAIN', d: 'the pools pull things into them' } }
];
/* What a card needs before it will be dealt. Tier 1 opens on the wave-4 elite
   and tier 2 — novas, second chances, the signature groceries — only on a real
   floor boss. Gating tier 1 behind wave 10 as well meant a whole floor fought
   on plain numbers, which is not difficulty, it is a flat line. */
const BOSS_GATE = ['from the start', 'once you have killed an elite', 'once you have killed a floor boss'];
function cardUnlocked(c) {
  // `floor` is the second gate: some cards are not a floor-1 answer at any grade.
  if (c.floor !== undefined && S.room < c.floor) return false;
  const b = c.b | 0;
  return b === 0 || (b === 1 ? S.bossKills >= 1 : S.floorBosses >= 1);
}
const CARD_BY_ID = {};
for (const c of CARDS) CARD_BY_ID[c.id] = c;

/* ============================================================
   OFF-CUTS — the fusions.

   Two cards you already hold, at the ranks named, and a third thing exists
   that neither of them was. An off-cut is LEGENDARY, it is guaranteed a seat
   in the next hand the moment it unlocks, and the screen makes noise about
   it. This is the part of the deck you go looking for on the second run.
   ============================================================ */
const FUSIONS = [
  { id: 'crosscut', name: 'CROSS-CUT',      need: [['split', 1], ['ricochet', 1]],
    d: 'forks bounce twice more, and harder' },
  { id: 'grinder',  name: 'THE GRINDER',    need: [['hooks', 2], ['coldsnap', 1]],
    d: 'the hooks freeze whatever they catch' },
  { id: 'furnace',  name: 'BLAST FURNACE',  need: [['spoiled', 2], ['overkill', 1]],
    d: 'anything that dies burning detonates' },
  { id: 'permafrost', name: 'PERMAFROST',   need: [['frostbite', 1], ['walkin', 2]],
    d: 'your aura freezes instead of slowing' },
  { id: 'artery',   name: 'ARTERY',         need: [['nerve', 2], ['debtcard', 1]],
    d: 'hurt is fast. up to +60% fire rate' },
  { id: 'bill',     name: "BUTCHER'S BILL", need: [['cleaver', 3], ['deepcut', 2]],
    d: 'a crit arcs to two more throats' },
  { id: 'harvest',  name: 'HARVEST',        need: [['grazing', 2], ['render', 1]],
    d: 'standing in your own pools heals you' },
  { id: 'flood',    name: 'FLASH FLOOD',    need: [['flashpoint', 1], ['frost', 1]],
    d: 'every nova freezes the room solid' },
  { id: 'trigger',  name: 'HAIR TRIGGER',   need: [['cycle', 3], ['quick', 2]],
    d: 'instant reloads below a quarter mag' },
  { id: 'primecut', name: 'PRIME CUT',      need: 'three cards held at RARE or better',
    d: '+25% damage, +1 LUCK, and every hand runs hotter' }
];
const FUSION_BY_ID = {};
for (const f of FUSIONS) FUSION_BY_ID[f.id] = f;
const fz = id => !!(S.fused && S.fused[id]);
/* PRIME CUT is the odd one out: its condition is about the grades you have
   taken rather than about two named cards, so it gets its own read. */
function primeCount() { let n = 0; for (const k in S.deck) if ((S.deck[k].g | 0) >= RIDER_AT) n++; return n; }
function fusionReady(f) {
  if (fz(f.id)) return false;
  if (f.id === 'primecut') return primeCount() >= 3;
  return f.need.every(([id, r]) => dkr(id) >= r);
}
/* What is missing, phrased for the card back so a nearly-there off-cut reads
   as a goal rather than as a locked box. */
function fusionHint(f) {
  if (f.id === 'primecut') return primeCount() + '/3 cards at RARE or better';
  return f.need.map(([id, r]) => CARD_BY_ID[id].name + ' ' + Math.min(dkr(id), r) + '/' + r).join('   ·   ');
}
function availableFusions() { return FUSIONS.filter(fusionReady); }

/* Read a card's accumulated number, and its rank. These two are all the rest
   of the game needs to know about the deck. */
function dk(id) { const d = S.deck[id]; return d ? d.amt : 0; }
function dkr(id) { const d = S.deck[id]; return d ? d.rank : 0; }
/* The capped read. A card that says "-62% damage taken" has to mean it, so the
   cap lives on the card and both the maths and the printed number go through
   here — there is no way for the face to promise something ST() won't pay. */
function dkc(id) {
  const c = CARD_BY_ID[id], v = dk(id);
  return c && c.cap !== undefined ? Math.min(c.cap, v) : v;
}

/* What one pick at this grade is worth. Integer cards round up so a PRIME
   SPLIT is genuinely worth two SELECT ones instead of 1.55 of one. */
function cardVal(c, g) {
  const raw = c.v * GRADE[g].mul;
  return c.int ? Math.max(1, Math.round(raw)) : c.dec ? Math.round(raw * 10) / 10 : Math.round(raw);
}
function cardLine(c, v) { return c.d(c.cap !== undefined ? Math.min(c.cap, v) : v); }
function cardName(c) { return c.name; }

/* Deal a hand.

   An unlocked off-cut always takes the first seat — it is the reward for
   having built toward it, and burying it behind a weight roll would waste the
   moment. The rest roll their own grade, and the EXPIRED mastery quietly
   upgrades every fourth card that comes off the top. */
function dealCards(n, luckBonus) {
  const luck = S.luck + (luckBonus || 0);
  const out = [];
  for (const f of availableFusions()) {
    if (out.length >= Math.max(1, n - 1)) break;      // never a hand of nothing but off-cuts
    out.push({ fusion: f, g: 4, val: 0 });
  }
  const pool = CARDS.filter(c => dkr(c.id) < c.max && cardUnlocked(c));
  while (out.length < n && pool.length) {
    /* Weighted rather than uniform. `w` defaults to 1 and only SPLIT sets it
       low: it is a LEGENDARY that has to stay an event, and a uniform pool of
       ~38 would still have offered it in most hands. */
    let total = 0;
    for (const c of pool) total += c.w === undefined ? 1 : c.w;
    let r = Math.random() * total, idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].w === undefined ? 1 : pool[i].w; if (r <= 0) { idx = i; break; } }
    const c = pool.splice(idx, 1)[0];
    S.dealt = (S.dealt | 0) + 1;
    /* `leg` cards do not roll — they are LEGENDARY or they are not dealt, and
       the EXPIRED mastery has nothing above LEGENDARY to bump them to. */
    let g;
    if (c.leg) g = 4;
    else {
      g = rollGrade(luck);
      if (aisleT2('expired') && S.dealt % 4 === 0) g = Math.min(3, g + 1);
    }
    out.push({ c, g, val: cardVal(c, g) });
  }
  return out;
}
/* The best grade in a hand decides how loudly it arrives — see openLevelUp. */
function handDrama(hand) { return hand.reduce((m, o) => Math.max(m, o.g | 0), 0); }

const SCAR_COLS = ['#ffe9a8', '#7fd0ff', '#8fff9a', '#ff7fe0', '#ffb03a',
                   '#c05cff', '#ff4a54', '#4fd6e8', '#eaff6a', '#ff8a3a'];
const scarCol = () => SCAR_COLS[(S.scarLv - 1) % SCAR_COLS.length];
function roman(n) {
  const M = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '', v = n;
  while (v > 0) for (const [d, r] of M) if (v >= d) { s += r; v -= d; break; }
  return s;
}
const scarName = () => 'SIDEARM MK ' + roman(S.scarLv);

/* ============================================================
   AUGMENTS — what TOMCE deals in.

   Not cards. Every one is a trade with a real cost attached, tuned so the
   upside beats the downside by a nose and no further. He turns up in a corner
   of some floors, never the corner the sigil is in, and offers three.
   ============================================================ */
const AUGMENTS = [
  { id: 'cataract',  name: 'CATARACT',    max: 2, up: r => '+' + (15 * r) + '% damage',           dn: r => 'you see ' + (11 * r) + '% less' },
  { id: 'tinnitus',  name: 'TINNITUS',    max: 2, up: r => '+' + (16 * r) + '% fire rate',        dn: r => '-' + (9 * r) + '% move speed' },
  { id: 'glass',     name: 'GLASS HANDS', max: 2, up: r => '+' + (24 * r) + '% damage',           dn: r => '-' + (15 * r) + '% max health' },
  { id: 'ballast',   name: 'DEAD WEIGHT', max: 2, up: r => '+' + (22 * r) + '% max health',       dn: r => '-' + (8 * r) + '% move speed' },
  { id: 'shortfuse', name: 'SHORT FUSE',  max: 2, up: r => '-' + (22 * r) + '% reload time',      dn: r => '-' + (16 * r) + '% magazine' },
  { id: 'thinskin',  name: 'THIN SKIN',   max: 2, up: r => '+' + (30 * r) + '% damage',           dn: r => '+' + (22 * r) + '% damage taken' },
  { id: 'grease',    name: 'GREASE',      max: 2, up: r => 'dash ' + (30 * r) + '% more often',   dn: r => '+' + (11 * r) + '% damage taken' },
  { id: 'coldblood', name: 'COLD BLOOD',  max: 2, up: r => '+' + (9 * r) + '% critical chance',   dn: r => 'loot pulls from ' + (30 * r) + '% closer' },
  { id: 'debt',      name: 'THE DEBT',    max: 2, up: r => '+' + (40 * r) + '% coins',            dn: r => '-' + (14 * r) + '% experience' },
  { id: 'feeder',    name: 'FEEDER',      max: 2, up: r => '+' + (1.5 * r) + ' health a kill',    dn: r => '-' + (18 * r) + '% experience' },
  { id: 'loudmouth', name: 'LOUDMOUTH',   max: 2, up: r => '+' + (45 * r) + '% experience',       dn: r => (18 * r) + '% more of them come' },
  { id: 'sleepless', name: 'SLEEPLESS',   max: 2, up: r => '+' + (14 * r) + '% move speed',       dn: r => '-' + (10 * r) + '% sight' },
  { id: 'hollow',    name: 'HOLLOW',      max: 1, up: r => 'one more card in every hand',         dn: r => '-10% max health' }
];
const ag = id => S.augs[id] | 0;

function dealAugments(n) {
  const pool = AUGMENTS.filter(a => ag(a.id) < a.max);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function openAugments() {
  if (S.mode !== 'play') return;
  S.mode = 'augment';
  S.augOffer = dealAugments(3);
  if (A.duck) A.duck(0.5, 3);
  A.secret();
}
function takeAugment(a) {
  S.augs[a.id] = ag(a.id) + 1;
  if (S.tomce) S.tomce.used = true;
  S.mode = 'play'; S.augOffer = null;
  S.p.hp = Math.min(ST().maxhp, S.p.hp);       // GLASS HANDS can cut the ceiling out from under you
  A.god(); A.bigpickup();
  S.flash = 0.6; S.flashCol = '#a8e8ff';
  float(S.p.x, S.p.y - 26, a.name, '#a8e8ff', true);
  msg('TOMCE', 'he writes something down and does not look up.', 3);
}
function refuseAugments() {
  if (S.tomce) S.tomce.used = true;
  S.mode = 'play'; S.augOffer = null;
  msg('TOMCE', 'he nods. he was not going to insist.', 2.4);
}

/* ---------- XP & the level-up hand ---------- */
/* The curve went 48 / x1.23 -> 80 / x1.30, and a kill pays 0.42 of its score
   instead of 0.55.

   Levels had been pulled fast on purpose, back when the deck was new and a
   floor could go by without one. It overshot: three boss-class kills a floor
   each hand you a free pick on top, so a floor was paying out seven or eight
   cards and the hand stopped being a decision — you were going to be offered
   everything anyway. Slower levels make a pick worth reading, and they make
   the bosses' guaranteed hands feel like the reward they are. */
function gainXP(n) {
  S.xp += Math.round(n * (1 + dkc('pricehike') / 100) * ST().xpMul);
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext;
    S.level++;
    S.upgPts++;
    S.xpNext = Math.round(S.xpNext * 1.30);
    A.bigpickup();
    S.flash = Math.max(S.flash, 0.4); S.flashCol = '#9fe08a';
    ring(S.p.x, S.p.y, 46, '#9fe08a', 0.5, 2);
    float(S.p.x, S.p.y - 26, 'LEVEL ' + S.level, '#9fe08a', true);
  }
}
/* How many cards you get to look at. APEX PREDATOR and CLOSING TIME each widen
   the hand, and they do not stack — the second one you sign is a fourth card
   you already had. `Math.max` rather than a sum, because five is HOLLOW's job
   and a six-card hand does not fit the screen. */
function handSize() {
  return ((contractDone('apex') || contractDone('menu')) ? 4 : 3) + ag('hollow');
}
function rerollCost() { return 20 + S.rerolls * 15; }
/* A hand arrives with the weight of the best thing in it. A screen of three
   COMMONs should open quietly; an EPIC should announce itself before you have
   finished reading the names. */
function dealDrama(hand) {
  const top = handDrama(hand);
  S.handTop = top;
  S.handIn = 0;                                    // drives the deal-in animation
  if (A.duck) A.duck(0.5, 3);
  if (top >= 4) { S.flash = 0.85; S.flashCol = GRADE[4].col; A.god(); A.secret(); shake(9); }
  else if (top === 3) { S.flash = 0.6; S.flashCol = GRADE[3].col; A.secret(); shake(5); }
  else if (top === 2) { S.flash = 0.35; S.flashCol = GRADE[2].col; A.card(); }
}
function openLevelUp(luckBonus) {
  if (S.mode === 'levelup') return;
  S.mode = 'levelup';
  S.lvlLuck = luckBonus || 0;
  S.hand = dealCards(handSize(), S.lvlLuck);
  dealDrama(S.hand);
}
function rerollHand() {
  const c = rerollCost();
  if (S.coins < c) { A.denied(); return; }
  S.coins -= c; S.rerolls++;
  S.hand = dealCards(handSize(), S.lvlLuck + 0.35);
  A.rack(); persist();
  dealDrama(S.hand);
}
/* Shared tail of taking anything off the level-up screen. */
function afterPick(g) {
  S.upgPts--;
  S.cardsTaken++;
  if (g >= RIDER_AT) bump('prime');
  recalcLuck(); recalcAisles();
  A.buy();
  S.flash = Math.max(S.flash, 0.5); S.flashCol = GRADE[g].col;
  if (S.p) S.p.hp = Math.min(ST().maxhp, S.p.hp + 8);
  checkContracts();
  if (S.upgPts <= 0) { S.mode = 'play'; S.hand = null; }
  else { S.hand = dealCards(handSize(), S.lvlLuck); dealDrama(S.hand); }
}
function takeCard(o) {
  if (S.upgPts <= 0 || !o) return;
  if (o.fusion) return takeFusion(o);
  const c = o.c;
  const before = ais(c.aisle);
  const d = S.deck[c.id] || (S.deck[c.id] = { rank: 0, amt: 0, g: 0 });
  const hadRider = (d.g | 0) >= RIDER_AT;
  d.rank++;
  d.amt = Math.round((d.amt + o.val) * 10) / 10;
  d.g = Math.max(d.g | 0, o.g);
  recalcAisles();
  /* Two things worth a banner: a rider coming online for the first time, and
     an aisle mastery tripping. Both are silent state changes otherwise, and a
     silent state change is a mechanic the player never learns they have. */
  if (!hadRider && (d.g | 0) >= RIDER_AT && c.r)
    msg(c.r.n, c.name + ' — ' + c.r.d, 3.4);
  const after = ais(c.aisle), ai = AISLES[c.aisle];
  if (before < AISLE_T1 && after >= AISLE_T1) { msg(ai.n + ' — THE ORDER', ai.p1, 3.4); A.secret(); }
  else if (before < AISLE_T2 && after >= AISLE_T2) { msg(ai.n + ' — MASTERED', ai.p2, 4); A.god(); S.flash = 0.7; S.flashCol = ai.col; }
  /* The third rung is the loudest thing a card can do that is not an off-cut,
     and it should be: twelve ranks in one aisle is most of a run's picks spent
     on one idea. */
  else if (before < AISLE_T3 && after >= AISLE_T3) {
    msg(ai.n + ' — ' + ai.t3, ai.p3, 4.6);
    A.god(); A.roar();
    S.flash = 1.0; S.flashCol = ai.col;
    shake(13); punch(0.06);
    if (S.p) { ring(S.p.x, S.p.y, 130, ai.col, 0.85, 3); float(S.p.x, S.p.y - 32, ai.t3, ai.col, true); }
  }
  // STOCKED: the max-health card also fills what it just added
  if (c.id === 'roughage' && rd('roughage') && S.p) S.p.hp += o.val;
  afterPick(o.g);
}
function takeFusion(o) {
  const f = o.fusion;
  S.fused[f.id] = true;
  S.fusedOrder.push(f.id);
  recalcLuck();
  msg(f.name, f.d, 4.2);
  A.god(); A.roar();
  S.flash = 1.0; S.flashCol = GRADE[4].col;
  shake(14); punch(0.06);
  if (S.p) { ring(S.p.x, S.p.y, 110, GRADE[4].col, 0.8, 3); float(S.p.x, S.p.y - 30, f.name, GRADE[4].col, true); }
  afterPick(4);
}

/* ============================================================
   CONTRACTS — the reason to come back.

   Persistent, cross-run objectives. Each one unlocks something the game
   actually does differently, so the meta isn't just a bigger number.
   ============================================================ */
const CONTRACTS = [
  { id: 'seal',  name: 'BREAK THE SEAL',   goal: 8,     stat: 'bosses', d: 'put down 8 floor bosses',           u: 'THE ROTISSERIE joins the crate' },
  { id: 'deep',  name: 'THE DESCENT',      goal: 8,     stat: 'deep',   d: 'reach floor 8',                     u: 'FREEZER BURN joins the crate' },
  { id: 'reg',   name: 'REGULAR',          goal: 12,    stat: 'shops',  d: 'visit PACI 12 times',               u: 'PACI lays out a fourth pedestal' },
  { id: 'grade', name: 'GRADED',           goal: 25,    stat: 'prime',  d: 'take 25 RARE-or-better cards',      u: '+1 LUCK on every card you are dealt' },
  { id: 'dozen', name: "BUTCHER'S DOZEN",  goal: 3000,  stat: 'kills',  d: '3000 kills, all runs counted',      u: 'start every run one level up' },
  { id: 'hoard', name: 'HOARDER',          goal: 12000, stat: 'vault',  d: 'bank 12000 coins in the vault',     u: 'start every run holding 60 coins' },
  { id: 'apex',  name: 'APEX PREDATOR',    goal: 1,     stat: 'apex',   d: 'kill an APEX',                      u: 'you are dealt four cards, not three' },
  /* THE FULL MENU used to read "hold all five signature cards", counting a
     stat that only the cold room could advance — so with the groceries gone it
     became a contract that could never be signed, tracking a system that no
     longer exists, promising a reward that had already been removed once
     before. Replaced rather than deleted: the slot is worth keeping, and
     clearing the building is the achievement the game had no contract for. */
  { id: 'menu',  name: 'CLOSING TIME',     goal: 1,     stat: 'protocol', d: 'put down THE MEAT PROTOCOL', u: 'every run starts on a hand of four' }
];
/* Counters live in the save under c_*, except two that were already tracked. */
function cStat(k) {
  const s = loadSave();
  if (k === 'deep') return s.deep || 1;
  if (k === 'vault') return s.vault || 0;
  return s['c_' + k] | 0;
}
function bump(k, n) {
  const s = loadSave(), v = (s['c_' + k] | 0) + (n === undefined ? 1 : n);
  const patch = {}; patch['c_' + k] = v;
  writeSave(patch);
  return v;
}
function bumpMax(k, v) {
  const s = loadSave();
  if (v > (s['c_' + k] | 0)) { const patch = {}; patch['c_' + k] = v; writeSave(patch); }
}
function contractDone(id) {
  const c = CONTRACTS.find(x => x.id === id);
  return c ? cStat(c.stat) >= c.goal : false;
}
/* Called after anything that could complete one, so the toast fires once. */
function checkContracts() {
  const s = loadSave();
  const seen = s.cDone || [];
  let changed = false;
  for (const c of CONTRACTS) {
    if (seen.indexOf(c.id) >= 0 || !contractDone(c.id)) continue;
    seen.push(c.id); changed = true;
    if (S.mode === 'play' || S.mode === 'levelup') {
      msg('CONTRACT SIGNED', c.name + '  —  ' + c.u, 4.5);
      A.secret(); S.flash = 0.6; S.flashCol = '#ffb03a';
    }
  }
  if (changed) writeSave({ cDone: seen });
}
/* One knob for how hard the floor hits.

   The evolution terms went up with the payout. A rung used to buy a flat
   world-difficulty increase and nothing else; it now hands over a gun you
   keep forever, and past the full roster a LEGENDARY card you open every run
   holding. Ten rungs of that is a different character, so ten rungs of this
   has to be a different building — at EVO_MAX enemies carry 5.6x health, hit
   4x as hard and arrive 2.5x as thick.

   Elites need no term here: powerMul() already counts the guns in your hands
   and the cards in your deck, so an evolved roster prices them up on its own.
   See spawnMini. */
/* DIFFICULTY, and the shape of it matters more than the size.

   This used to be a straight line: +125% hp and +72% damage per floor. A line
   is the wrong curve here, because a line is at its CRUELLEST early. Floor 3
   arrived at 3.5x health and 2.4x damage, which is a 56% and 42% step up from
   floor 2 in one go, and it landed exactly where the player's own power stalls
   — the first two floors you are still picking up guns and the first cards,
   and after that the curve keeps climbing while your kit does not.

   So it is a gentle quadratic instead. The linear term is cut by a third and
   the difference put into a squared term that stays near nothing until it is
   deep enough to matter. The TOP END IS DELIBERATELY UNCHANGED — floor 10 is
   still 12.3x health and 7.5x damage, because the killing floor was not the
   complaint. What moves is the middle:

     floor      3      4      5      6      7      8
     hp    was 3.50   4.75   6.00   7.25   8.50   9.75
           now 2.88   3.96   5.13   6.40   7.77   9.24
     dmg   was 2.44   3.16   3.88   4.60   5.32   6.04
           now 2.07   2.68   3.35   4.08   4.87   5.72 */
function diff() {
  const ev = S.evo | 0, r = S.room;
  return {
    hp: (1 + r * 0.85 + r * r * 0.045) * (1 + ev * 0.46),
    dmg: (1 + r * 0.48 + r * r * 0.0266) * (1 + ev * 0.30),
    spd: (1 + r * 0.11) * (1 + ev * 0.06),
    score: (1 + r * 0.7) * (1 + ev * 0.5)
  };
}
function curW() { return WEP[S.p.owned[S.p.wi]]; }
function curMag() { return S.p.mags[S.p.owned[S.p.wi]]; }
function magCap(w) { return Math.round(w.mag * ST().magMul); }
function magMax() { return S.god ? 999 : magCap(curW()); }

/* ============================================================
   ROOM BUILD
   ============================================================ */
function buildRoom(idx) {
  const R = roomDef(idx);
  const rng = mulberry32(1337 + idx * 977 + Math.floor(Math.random() * 99999));
  S.aw = R.aw; S.ah = R.ah;
  const T = 24;
  S.walls = [
    { x: 0, y: 0, w: R.aw, h: T }, { x: 0, y: R.ah - T, w: R.aw, h: T },
    { x: 0, y: 0, w: T, h: R.ah }, { x: R.aw - T, y: 0, w: T, h: R.ah }
  ];
  S.deco = [];

  /* ---- layout ----
     One scatter pass every time made every floor read the same: a field of
     boxes at random. Each floor now picks an archetype, so the arena you
     fight in has a shape you can learn and use for cover. The middle is
     always left open — that is where you land and where bosses arrive.
     `gap` is the breathing room enforced around each block; deliberate
     layouts sit tighter than scatter, but never below ~18px, which is three
     times the player's radius. */
  const M = T + 22;
  function place(x, y, w, h, kind, gap) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const g = gap === undefined ? 40 : gap;
    if (x < M || y < M || x + w > R.aw - M || y + h > R.ah - M) return false;
    if (Math.hypot(x + w / 2 - R.aw / 2, y + h / 2 - R.ah / 2) < 92) return false;
    // You land on the south pad and leave through the north door. Neither is
    // allowed to have a crate standing in it — the margin alone doesn't cover
    // it, and a deliberate layout will happily drop a slab on your head.
    if (x < R.aw / 2 + 36 && x + w > R.aw / 2 - 36 && y + h > R.ah - 100) return false;
    if (x < R.aw / 2 + 42 && x + w > R.aw / 2 - 42 && y < 80) return false;
    for (let j = 4; j < S.walls.length; j++) {
      const o = S.walls[j];
      if (x < o.x + o.w + g && x + w + g > o.x && y < o.y + o.h + g && y + h + g > o.y) return false;
    }
    /* The kind is drawn from the FLOOR's furniture list, not from a global
       coin-flip between crate and vat. `kind` is still honoured as a hint —
       the layout code asks for 'vat' on the big slabs and 'crate' on the
       small ones — but it is mapped onto whatever this floor actually keeps:
       a hint of 'vat' means "something bulky", not literally a vat. */
    const kinds = propKinds(idx);
    /* A 'vat' hint means "this one is bulky", so it biases toward the front of
       the list where each floor's heaviest furniture lives — but only biases.
       Restricting it to the first two entries meant the `pillars` layout, which
       passes the hint for every single column, furnished those floors out of a
       two-item list and the other kinds never appeared at all. rng()*rng() is
       a triangular distribution: front-loaded, full range. */
    const u = kind === 'vat' ? rng() * rng() : rng();
    S.walls.push({ x, y, w, h, obs: 1, kind: kinds[Math.floor(u * kinds.length)] });
    return true;
  }
  function scatter(count, gap) {
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const w = rng() < 0.4 ? 24 : rndi(30, 76), h = rng() < 0.4 ? 24 : rndi(26, 70);
        if (place(M + rng() * (R.aw - 2 * M - w), M + rng() * (R.ah - 2 * M - h), w, h, null, gap)) break;
      }
    }
  }

  /* The archetype is the FLOOR's, not the roll's. It used to be picked at
     random every time you walked through a door, which meant the arena had no
     identity you could carry between runs — you could not learn that floor 7 is
     long lanes and floor 2 is columns, because on the next run it wasn't.
     Rolled positions inside a fixed archetype is the right amount of variety:
     the shape is the same, the cover is not. */
  const n = 7 + idx * 2;
  const layout = R.layout || 'scatter';
  S.layout = layout;

  if (layout === 'pillars') {
    // a hall of columns. lots of cover, no sightlines, easy to get flanked.
    const cols = 4 + Math.floor(rng() * 3), rows = 3 + Math.floor(rng() * 3);
    const x0 = M + 34, y0 = M + 34;
    const dx = (R.aw - 2 * (M + 34)) / (cols - 1), dy = (R.ah - 2 * (M + 34)) / (rows - 1);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (rng() < 0.16) continue;                       // missing columns, so it isn't a lattice
      const s = rng() < 0.28 ? 32 : 24;
      place(x0 + i * dx - s / 2, y0 + j * dy - s / 2, s, s, 'vat', 20);
    }
  } else if (layout === 'corridors') {
    // long walls cutting lanes across the room. good for kiting, bad for panic.
    const bars = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < bars; i++) {
      const vert = rng() < 0.5, len = rndi(120, 230), th = rng() < 0.5 ? 16 : 22;
      const w = vert ? th : len, h = vert ? len : th;
      for (let tries = 0; tries < 20; tries++)
        if (place(M + rng() * (R.aw - 2 * M - w), M + rng() * (R.ah - 2 * M - h), w, h, 'crate', 32)) break;
    }
    scatter(Math.max(2, n - 5), 40);
  } else if (layout === 'bunkers') {
    // a few slabs big enough to lose a boss behind
    const blocks = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < blocks; i++) {
      const w = rndi(88, 150), h = rndi(80, 130);
      for (let tries = 0; tries < 24; tries++)
        if (place(M + rng() * (R.aw - 2 * M - w), M + rng() * (R.ah - 2 * M - h), w, h, 'vat', 46)) break;
    }
    scatter(Math.max(3, n - 4), 40);
  } else if (layout === 'ring') {
    // a broken ring around the arena centre — gaps are the only way in or out
    const rad = Math.min(R.aw, R.ah) * (0.26 + rng() * 0.07);
    const segs = 9 + Math.floor(rng() * 4);
    for (let i = 0; i < segs; i++) {
      if (rng() < 0.28) continue;                       // the doorways
      const a = i / segs * TAU;
      const flat = Math.abs(Math.cos(a)) > 0.5;
      const w = flat ? 22 : 56, h = flat ? 56 : 22;
      place(R.aw / 2 + Math.cos(a) * rad - w / 2, R.ah / 2 + Math.sin(a) * rad - h / 2, w, h, 'crate', 18);
    }
    scatter(Math.max(3, n - 5), 40);
  } else {
    scatter(n, 40);
  }

  /* ---- guarantee the floor's signature furniture ----
     Kinds are rolled per obstacle, so a floor with four kinds and fourteen
     blocks can and does roll zero of one of them — and the one it drops is
     just as likely to be the brazier that makes THE RED KITCHEN read as a
     kitchen. Retag a few of the placed blocks so the first two kinds are
     always present. Retagging rather than placing keeps the LAYOUT untouched:
     cover, sightlines and spacing are decided by the archetype, and this only
     changes what the cover is made of. */
  {
    const kinds = propKinds(idx);
    const obs = [];
    for (let i = 4; i < S.walls.length; i++) obs.push(S.walls[i]);
    for (let k = 0; k < Math.min(2, kinds.length); k++) {
      const want = k === 0 ? 2 : 1;
      let have = 0;
      for (const o of obs) if (o.kind === kinds[k]) have++;
      for (let n2 = have; n2 < want && obs.length; n2++) {
        // retag the block that is furthest from the middle, so a feature prop
        // never lands where it would crowd the arrival pad
        let best = null, bd = -1;
        for (const o of obs) {
          if (o.kind === kinds[k] || o.tagged) continue;
          const d = Math.hypot(o.x - R.aw / 2, o.y - R.ah / 2);
          if (d > bd) { bd = d; best = o; }
        }
        if (!best) break;
        best.kind = kinds[k]; best.tagged = 1;
      }
    }
  }

  /* Decor. Half of it is the shared floor stain; the other half is the FLOOR'S
     OWN MOTIF, which is the cheapest way to make ten arenas look like ten
     places rather than ten palettes. Drawn in drawWorld — see `d.k`. */
  const motif = R.motif || 'hook';
  for (let i = 0; i < 30 + idx * 6; i++)
    S.deco.push({ x: rnd(T + 10, R.aw - T - 10), y: rnd(T + 10, R.ah - T - 10),
                  k: rng() < 0.42 ? 'stain' : motif, s: rnd(0.6, 1.5), ph: rng() * TAU });

  S.door = { x: R.aw / 2 - 22, y: 2, w: 44, h: T + 4, open: false, glow: 0 };
  S.secret = idx === 0
    ? { x: Math.round(R.aw * 0.735), y: 7, w: 11, h: 12, hits: 0, need: 13, broken: false, taken: false, flick: 0, t: rnd(2, 5) }
    : null;

  // MODAGAZ — one sigil per floor, a different corner each time.
  const c = idx % 4;
  S.corner = {
    x: (c === 1 || c === 3) ? R.aw - 46 : 46,
    y: (c === 2 || c === 3) ? R.ah - 46 : 46,
    found: false, pulse: 0
  };

  /* TOMCE stands in one of the other three corners, on some floors, and never
     in the sigil's — the two of them are not to be found in the same place. */
  S.tomce = null;
  if (rng() < 0.6) {
    const free = [0, 1, 2, 3].filter(k => k !== c);
    for (let a = 0; a < free.length; a++) {
      const tc = free.splice(Math.floor(rng() * free.length), 1)[0];
      const tx = (tc === 1 || tc === 3) ? R.aw - 62 : 62;
      const ty = (tc === 2 || tc === 3) ? R.ah - 70 : 70;
      if (pointInWall(tx, ty) || pointInWall(tx, ty - 26) || pointInWall(tx, ty + 16)) continue;
      S.tomce = { x: tx, y: ty, bob: 0, used: false, near: 0 };
      break;
    }
  }

  bakeFloor(R, rng, idx);
  S.cracks = [];
  S.shops = [];
}

/* ============================================================
   PACI'S BACK ROOM

   Guns are not lying around the abattoir any more. Every third boss you
   put down, the way out leads sideways instead of down, into a small
   purple room with a very large man in it and three pedestals of whatever
   he happens to be holding. Buy, or don't, then walk back out the bottom
   and the wave picks up where it left off.
   ============================================================ */
/* Two guns are behind contracts and simply are not in the crate until those
   are signed. REGULAR buys a fourth pedestal. */
function shopSlots() { return contractDone('reg') ? 4 : 3; }
function shopStock() {
  /* Three gates, and they are not the same gate. `lock` is a contract you
     signed, `floor` is how deep you are, and price is whether you can afford
     what is actually on the pallet.

     A fourth thing now thins the crate from outside it: anything already in
     your permanent evolution roster is owned from the first frame, so PACI
     stops carrying it. That is the intended shape — an evolved run walks in
     holding what a fresh one has to buy — but it does mean a deep enough
     roster can leave him with an empty pallet, and the pedestal loop below is
     written to survive that rather than assume three things exist. */
  const owned = id => S.p.owned.indexOf(id) >= 0;
  const unlocked = id => !WEP[id].lock || contractDone(WEP[id].lock);
  // THE FISH goes through the same gates as everything else now that it costs
  // coins. It used to be appended unconditionally because cards were its gate.
  const all = BUYABLE.concat(BUYABLE.indexOf('omega') < 0 ? ['omega'] : []);
  const pool = all.filter(id => !owned(id) && unlocked(id) && S.room >= (WEP[id].floor | 0));
  /* If depth has left him short of a full pallet, drop the depth gate — never
     the contract gate, and never the ownership one. Three pedestals every
     visit is a promise the room makes just by having three pedestals in it,
     and a shop with one thing on offer is not a shop, it is a receipt. The
     rarity weights below then do the gating that `floor` was doing: a floor-1
     player CAN be shown GOD FINGER this way, at odds of about one visit in
     thirty, and cannot afford it anyway. */
  if (pool.length < shopSlots())
    for (const id of all)
      if (!owned(id) && unlocked(id) && pool.indexOf(id) < 0) pool.push(id);

  /* ---- weighted by rarity, not uniform ----

     Uniform meant a COMMON and a LEGENDARY were equally likely to be standing
     on a pedestal, so the crate had no texture: every visit was a coin-flip
     between two things you could afford and one you could not. These weights
     are roughly a rarity ladder of their own —

       COMMON 100 · UNCOMMON 52 · RARE 24 · EPIC 9 · LEGENDARY 2.5

     — so a LEGENDARY on a pedestal is about one seat in seventy. Seeing THE
     FISH at all should be the thing you tell someone about; buying it is a
     separate problem costing 500 coins. */
  const SHOP_W = [100, 52, 24, 9, 2.5];
  const offer = [];
  const n = shopSlots();
  while (offer.length < n && pool.length) {
    let total = 0;
    for (const id of pool) total += SHOP_W[WEP[id].gr | 0];
    let r = Math.random() * total, idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= SHOP_W[WEP[pool[i]].gr | 0]; if (r <= 0) { idx = i; break; } }
    // spliced, so a pedestal can never be a duplicate of the one beside it
    offer.push(pool.splice(idx, 1)[0]);
  }
  offer.sort((a, b) => WORDER.indexOf(a) - WORDER.indexOf(b));
  return offer;
}

function enterShop() {
  if (S.pending || S.fadeDir) return;
  S.fadeDir = 1;
  S.waveState = 'shop';        // stop the wave clock now, not when the fade lands
  S.pending = () => {
    // stash the arena whole — the run is mid-floor and has to come back to it
    S.shopStash = {
      aw: S.aw, ah: S.ah, walls: S.walls, deco: S.deco, layout: S.layout,
      floorCan, floorCtx, decalCan, decalCtx,
      door: S.door, secret: S.secret, corner: S.corner, tomce: S.tomce,
      px: S.p.x, py: S.p.y
    };
    const R = SHOP_ROOM, T = 24;
    S.inShop = true;
    S.waveState = 'shop';
    S.aw = R.aw; S.ah = R.ah;
    S.walls = [
      { x: 0, y: 0, w: R.aw, h: T }, { x: 0, y: R.ah - T, w: R.aw, h: T },
      { x: 0, y: 0, w: T, h: R.ah }, { x: R.aw - T, y: 0, w: T, h: R.ah }
    ];
    S.deco = [];
    S.secret = null; S.corner = null; S.tomce = null;
    S.en.length = 0; S.bul.length = 0; S.eb.length = 0; S.cracks.length = 0;
    S.nades.length = 0; S.part.length = 0; S.gibs.length = 0; S.rings.length = 0;
    S.props.length = 0; S.pools.length = 0; S.arcs.length = 0;
    S.haz.length = 0;
    S.boss = null; S.vacuum = 0;
    /* The wave-end vacuum deliberately never pulls in permanent drops — a boss's
       grocery has to be walked to. The shop opens on a timer, not on your say-so,
       so wiping the drop list here would eat the item you just earned. Carry the
       permanent ones through and lay them out on the way to PACI's door. */
    const carried = S.drops.filter(d => d.kind === 'item' || d.kind === 'god');
    S.drops.length = 0;
    // the way back out is south, not north — nothing here goes deeper
    S.door = { x: R.aw / 2 - 24, y: R.ah - T - 4, w: 48, h: T + 4, open: true, glow: 1, exit: true };
    bakeFloor(R, mulberry32(4242 + S.shopsSeen * 131));
    S.shopsSeen++;
    bump('shops'); checkContracts();

    S.paci = { x: R.aw / 2, y: 104, bob: 0, blink: rnd(2, 5), line: 0, anger: 0, angerT: 0 };
    S.pendingKick = 0;
    S.shops = shopStock().map((id, i, arr) => ({
      x: R.aw / 2 + (i - (arr.length - 1) / 2) * (arr.length > 3 ? 84 : 96), y: 196, id,
      price: WEP[id].price,
      cards: 0,                        // nothing costs cards any more
      bought: false, bob: rnd(0, TAU)
    }));

    S.p.x = R.aw / 2; S.p.y = R.ah - 86; S.p.vx = S.p.vy = 0;
    S.p.reT = 0;
    carried.forEach((d, i) => {
      d.x = R.aw / 2 + (i - (carried.length - 1) / 2) * 32;
      d.y = R.ah - 58;                   // between where you land and the way out
      d.vx = d.vy = 0;
      S.drops.push(d);
    });
    for (const id of S.p.owned) S.p.mags[id] = magCap(WEP[id]);
    S.cam.cx = S.p.x; S.cam.cy = S.p.y;

    msg('PACI', S.shops.length ? 'HELLO TRAVELER, WELCOME TO MY SHOP'
                               : 'HELLO TRAVELER. YOU HAVE BOUGHT ME OUT.', 4.5);
    A.doorOpen(); A.bigpickup();
    A.setDread(0.1);
    if (A.music) { A.music.setBoss(false); A.music.setIntensity(0.1); }
    persist();
  };
}

/* ---------- shooting the shopkeeper ----------
   The first round is a warning. He does not take cover, he does not bleed and
   he does not stop being twice your size; the room simply stops being a shop
   and starts being a room with him in it. The second round ends the visit. */
function angerPaci(bx, by) {
  const q = S.paci;
  if (!q || q.anger >= 2) return;
  part(bx, by, '#e8c8ff', 10, 90, 0.4);

  if (q.anger === 0) {
    q.anger = 1; q.angerT = 0;
    S.flash = 0.55; S.flashCol = '#c02028';
    shake(20); punch(0.1); S.hitstop = Math.max(S.hitstop, 0.12);
    ring(q.x, q.y, 150, '#ff2b2b', 0.7, 3);
    A.roar(); A.setDread(1);
    if (A.music) A.music.setBoss(true);
    msg('PACI', 'DO NOT DO THAT AGAIN.', 3.6);
    return;
  }

  /* Second one. He does not hit you — he just decides you are leaving, and
     the room agrees with him. */
  q.anger = 2; q.angerT = 0;
  S.flash = 1; S.flashCol = '#ff2b2b';
  shake(34); punch(0.16); S.hitstop = Math.max(S.hitstop, 0.2);
  ring(q.x, q.y, 260, '#ff2b2b', 1.0, 4);
  ring(q.x, q.y, 190, '#ffffff', 0.5, 2);
  A.roar(); A.death();
  msg('PACI', 'GET OUT.', 4.0);
  // whatever is still on the pedestals stays on the pedestals
  S.shops = [];
  S.p.vx += (S.p.x - q.x) * 5.5; S.p.vy += 260;
  S.pendingKick = 0.85;
}

function exitShop() {
  if (S.pending || S.fadeDir) return;
  S.fadeDir = 1;
  S.pending = () => {
    const st = S.shopStash;
    // and back the other way, if you walked out without picking them up
    const carried = S.drops.filter(d => d.kind === 'item' || d.kind === 'god');
    S.drops.length = 0;
    S.inShop = false; S.paci = null; S.shops = [];
    S.aw = st.aw; S.ah = st.ah; S.walls = st.walls; S.deco = st.deco; S.layout = st.layout;
    floorCan = st.floorCan; floorCtx = st.floorCtx;
    decalCan = st.decalCan; decalCtx = st.decalCtx;
    S.door = st.door; S.secret = st.secret; S.corner = st.corner; S.tomce = st.tomce;
    S.p.x = st.px; S.p.y = st.py; S.p.vx = S.p.vy = 0;
    S.cam.cx = S.p.x; S.cam.cy = S.p.y;
    carried.forEach((d, i) => {
      d.x = st.px + (i - (carried.length - 1) / 2) * 32;
      d.y = st.py + 26;
      d.vx = d.vy = 0;
      S.drops.push(d);
    });
    S.shopStash = null;
    // drop back into the post-wave pause so updateWaves resumes normally —
    // or, if the floor's tenth wave is already done, into the open door.
    S.waveState = 'clear'; S.waveT = 1.4;
    A.setDread(clamp(S.wave / WAVES * 0.6 + S.room * 0.2, 0, 1));
    if (A.music) A.music.setIntensity(clamp(0.12 + (S.wave / WAVES) * 0.72 + S.room * 0.16, 0, 1));
    A.doorOpen();
    msg('BACK TO IT', S.wave >= WAVES ? 'the door north is still open.' : 'he watched you leave.', 2.4);
  };
}

/* 4x4 Bayer. Ordered dithering is how the floor gets a value gradient out of
   three flat tones: instead of a fourth colour, tiles fade into each other in
   a fixed pattern, which at this pixel density reads as grime settling rather
   than as a pattern. Same trick the sprites use to shade a curved surface. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)] / 16;

/* ============================================================
   THE FLOOR

   ---- why this is not one big pixel loop any more ----

   It used to resolve every device pixel of the arena in JS: a
   `createImageData` the size of the whole room, one pass, tone + dither +
   grain per pixel. Measured, that is a flat ~32 NANOSECONDS PER DEVICE PIXEL,
   and the arena is 4.75 million of them on floor 9. Then it drew grout with
   four fillRects per tile (19,000 of them) and painted spills a device pixel
   at a time (55,000 more).

     pixel loop  ~100ms
     spills       ~37ms
     grout         ~9ms
     ------------------
     ~149ms, once per floor, ~1.2 SECONDS and 71 dropped frames a run

   That is the hitch you feel walking through a door. Every part of it was
   doing per-pixel work for something that repeats.

   So: bake a small ATLAS of tile variants once (12 tiles at 32x32 = 12,288
   pixels instead of 4.75 million, a 386x reduction), bake the grout INTO
   those variants so it costs nothing, pre-render a handful of spill blobs and
   `drawImage` them, and blit the atlas across the room. Same idea, ~8x less
   time, and it now scales with tile COUNT rather than pixel count — which
   means it barely grows as the arenas do.
   ============================================================ */

/* Ten floors, ten surfaces. The palettes already differed; the PATTERN did
   not, so every room was the same 16-unit grid of tiles in a different colour
   and read as one building with the lights changed. A surface says more about
   where you are than its hue does — you know a freezer from a wooden floor
   with the colour turned off. */
const FLOOR_TEX = ['tile', 'grate', 'plate', 'quarry', 'ice',
                   'sludge', 'board', 'salt', 'lino', 'drain'];
function floorTex(idx) { return FLOOR_TEX[clamp(idx | 0, 0, FLOOR_TEX.length - 1)]; }

/* One tile variant, painted at DEVICE resolution over the shared tone base.
   `s` is the tile's span in device pixels (32). Everything here is drawn once
   per variant per floor — twelve times — so it can afford to be detailed. */
const TEXTURE = {
  tile(g, s, R, rng) {                      // 1. THE ABATTOIR — glazed, grouted
    g.fillStyle = R.grout; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);
    g.fillStyle = 'rgba(255,244,224,0.05)'; g.fillRect(0, 2, s, 1); g.fillRect(2, 0, 1, s);
  },
  grate(g, s, R, rng) {                     // 2. THE HOLLOW — you are standing on a drain
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i < 4; i++) g.fillRect(3, 4 + i * 7, s - 6, 3);
    g.fillStyle = 'rgba(255,250,235,0.09)';
    for (let i = 0; i < 4; i++) g.fillRect(3, 3 + i * 7, s - 6, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    g.fillStyle = 'rgba(200,205,215,0.14)';
    g.fillRect(1, 1, 2, 2); g.fillRect(s - 3, 1, 2, 2); g.fillRect(1, s - 3, 2, 2);
  },
  plate(g, s, R, rng) {                     // 3. THE MEAT LOOP — riveted tread plate
    g.fillStyle = 'rgba(0,0,0,0.40)'; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    g.fillStyle = 'rgba(255,250,240,0.06)'; g.fillRect(0, 1, s, 1); g.fillRect(1, 0, 1, s);
    for (let y = 0; y < s; y += 8) for (let x = 0; x < s; x += 8) {
      const ox = (y / 8) % 2 ? 4 : 0;
      g.fillStyle = 'rgba(255,250,240,0.10)';
      g.fillRect(x + ox + 1, y + 3, 4, 1); g.fillRect(x + ox + 2, y + 4, 2, 1);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + ox + 1, y + 5, 4, 1);
    }
    g.fillStyle = 'rgba(220,225,235,0.16)'; g.fillRect(2, 2, 2, 2); g.fillRect(s - 4, s - 4, 2, 2);
  },
  quarry(g, s, R, rng) {                    // 4. THE RED KITCHEN — small tiles, staggered
    const h = s / 2;
    g.fillStyle = R.grout;
    g.fillRect(0, 0, s, 1); g.fillRect(0, h, s, 1);
    g.fillRect(0, 0, 1, h); g.fillRect(h, h, 1, h);
    g.fillStyle = 'rgba(255,244,224,0.06)';
    g.fillRect(0, 1, s, 1); g.fillRect(0, h + 1, s, 1);
  },
  ice(g, s, R, rng) {                       // 5. THE FREEZER — rime and stress cracks
    g.fillStyle = 'rgba(220,245,255,0.10)';
    for (let i = 0; i < 14; i++) g.fillRect((rng() * s) | 0, (rng() * s) | 0, 1 + ((rng() * 2) | 0), 1);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    g.fillStyle = 'rgba(120,180,205,0.30)';
    let cx = rng() * s, cy = rng() * s, a = rng() * TAU;
    for (let i = 0; i < 10; i++) { g.fillRect(cx | 0, cy | 0, 1, 1); a += rng() - 0.5; cx += Math.cos(a) * 2; cy += Math.sin(a) * 2; }
  },
  sludge(g, s, R, rng) {                    // 6. THE RENDERING — poured, and something got on it
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < 5; i++) g.fillRect((rng() * s) | 0, (rng() * s) | 0, (3 + rng() * 8) | 0, (2 + rng() * 5) | 0);
    g.globalAlpha = 0.16; g.fillStyle = R.vat || '#4a6a12';
    for (let i = 0; i < 3; i++) g.fillRect((rng() * s) | 0, (rng() * s) | 0, (2 + rng() * 6) | 0, (2 + rng() * 4) | 0);
    g.globalAlpha = 1;
  },
  board(g, s, R, rng) {                     // 7. THE LONG TABLE — floorboards
    const ph = 8;
    g.fillStyle = 'rgba(0,0,0,0.42)';
    for (let y = 0; y < s; y += ph) g.fillRect(0, y, s, 1);
    g.fillStyle = 'rgba(255,236,200,0.055)';
    for (let y = 0; y < s; y += ph) g.fillRect(0, y + 1, s, 1);
    g.fillStyle = 'rgba(0,0,0,0.16)';                       // grain, along the plank
    for (let y = 0; y < s; y += ph) for (let i = 0; i < 3; i++)
      g.fillRect((rng() * s) | 0, y + 2 + ((rng() * (ph - 3)) | 0), (3 + rng() * 9) | 0, 1);
    // an end joint only sometimes, so the planks read long instead of square
    if (rng() < 0.35) {
      g.fillStyle = 'rgba(0,0,0,0.42)';
      g.fillRect((rng() * s) | 0, ((rng() * (s / ph)) | 0) * ph, 1, ph);
    }
    g.fillStyle = 'rgba(210,200,180,0.15)';
    for (let y = ph; y < s; y += ph) if (rng() < 0.5) g.fillRect((rng() * s) | 0, y - 3, 1, 1);
  },
  salt(g, s, R, rng) {                      // 8. THE SALT LINE — crusted over
    g.fillStyle = 'rgba(240,238,225,0.15)';
    for (let i = 0; i < 26; i++) g.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    g.fillStyle = 'rgba(255,255,250,0.19)';
    for (let i = 0; i < 6; i++) g.fillRect((rng() * s) | 0, (rng() * s) | 0, 2, 1);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
  },
  lino(g, s, R, rng) {                      // 9. THE LAST AISLE — supermarket vinyl
    g.fillStyle = 'rgba(255,250,240,0.07)';
    for (let i = 0; i < 30; i++) g.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < 18; i++) g.fillRect((rng() * s) | 0, (rng() * s) | 0, 1, 1);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(0, 0, 1, s);   // the seam between rolls
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(1, 0, 1, s);
  },
  drain(g, s, R, rng) {                     // 10. THE KILLING FLOOR — a slab that has seen use
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let i = 0; i < 4; i++)
      g.fillRect((rng() * s) | 0, (rng() * s) | 0, (3 + rng() * 10) | 0, (1 + rng() * 3) | 0);
    g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    g.fillStyle = 'rgba(255,240,230,0.04)'; g.fillRect(0, 1, s, 1);
  }
};

/* Whole-room features that cannot be a repeating tile, because the point of
   them is that they run across the floor. Only the styles that need one. */
const TEX_ARENA = {
  drain(g, R, rng, P) {                     // channels, running the length of the room
    for (let i = 0; i < 3; i++) {
      const y = Math.round((0.22 + i * 0.28) * R.ah);
      g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect(16, y, R.aw - 32, 3);
      g.fillStyle = 'rgba(150,150,155,0.12)';
      for (let x = 18; x < R.aw - 32; x += 3) g.fillRect(x, y, P, 3);
      g.fillStyle = 'rgba(255,240,230,0.05)'; g.fillRect(16, y - P, R.aw - 32, P);
    }
  },
  grate(g, R, rng, P) {                     // one wide sump the grating drains into
    const x = Math.round(R.aw * 0.5) - 26, y = Math.round(R.ah * 0.5) - 10;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, 52, 20);
    g.fillStyle = 'rgba(190,196,206,0.10)';
    for (let i = 0; i < 52; i += 4) g.fillRect(x + i, y, P * 2, 20);
  }
};

/* Twelve variants is enough that the eye stops finding the repeat, and few
   enough that baking them is free. */
const TILE_VARIANTS = 12;

function bakeTileAtlas(R, rng, tex) {
  const TS = 16, span = TS * RS;
  const can = document.createElement('canvas');
  can.width = span * TILE_VARIANTS; can.height = span;
  const g = can.getContext('2d');
  g.imageSmoothingEnabled = false;

  /* The shared base: tone, the worn-edge dither, and one-device-pixel grain.
     Identical maths to the old full-arena loop — it just runs over 12,288
     pixels instead of 4,752,000. */
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const TONES = [rgb(R.floor[0]), rgb(R.floor[1]), rgb(R.floor[2])];
  const ALT = [1, 2, 1];
  const tone = [], wear = [];
  for (let v = 0; v < TILE_VARIANTS; v++) {
    const q = rng();
    tone.push(q < 0.30 ? 1 : q < 0.44 ? 2 : 0);
    wear.push(0.35 + rng() * 0.5);
  }
  const W = can.width, img = g.createImageData(W, span), px = img.data;
  for (let y = 0; y < span; y++) {
    const fy = y / span - 0.5;
    for (let X = 0; X < W; X++) {
      const v = (X / span) | 0, x = X % span;
      const t = tone[v];
      const u = Math.max(Math.abs(x / span - 0.5), Math.abs(fy)) * 2;
      const c = (u * u * wear[v] > bay(X, y)) ? TONES[ALT[t]] : TONES[t];
      const n = ((X * 73856093) ^ (y * 19349663)) & 255;
      const k = n < 40 ? -14 : n > 232 ? 10 : 0;
      const o = (y * W + X) << 2;
      px[o] = clamp(c[0] + k, 0, 255); px[o + 1] = clamp(c[1] + k, 0, 255);
      px[o + 2] = clamp(c[2] + k, 0, 255); px[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // then the surface itself, clipped so a variant can never bleed into its neighbour
  const paint = TEXTURE[tex] || TEXTURE.tile;
  for (let v = 0; v < TILE_VARIANTS; v++) {
    g.save();
    g.translate(v * span, 0);
    g.beginPath(); g.rect(0, 0, span, span); g.clip();
    paint(g, span, R, rng);
    g.restore();
  }
  return { can, span };
}

/* Spills were 55,000 fillRects a room. They are six blobs now, rendered once
   into their own little canvases and stamped. */
function bakeSpills(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rr = 2 + rng() * 5;                       // radius, game units
    const d = Math.ceil(rr * RS * 2) + 2;
    const c = document.createElement('canvas');
    c.width = d; c.height = d;
    const g = c.getContext('2d');
    const img = g.createImageData(d, d), px = img.data;
    const h = d / 2;
    for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      const tx = x - h, ty = y - h;
      const dist = Math.hypot(tx, ty * 1.7) / (rr * RS);
      if (dist > 1) continue;
      const core = dist < 0.55;
      if (!core && !(1 - dist > bay(x + 64, y + 64) * 0.9)) continue;
      const o = (y * d + x) << 2;
      px[o] = core ? 48 : 60; px[o + 1] = core ? 8 : 12; px[o + 2] = core ? 12 : 16;
      px[o + 3] = core ? 107 : 77;                  // the old 0.42 / 0.30 alphas
    }
    g.putImageData(img, 0, 0);
    out.push({ can: c, w: d / RS, h: d / RS });
  }
  return out;
}

function bakeFloor(R, rng, idx) {
  const sc = subCanvas(R.aw, R.ah);
  floorCan = sc.can; floorCtx = sc.ctx;
  const g = floorCtx, P = 1 / RS;          // one device pixel, in game units
  const TS = 16, cols = Math.ceil(R.aw / TS), rows = Math.ceil(R.ah / TS);
  const tex = R.tex || floorTex(idx === undefined ? S.room : idx);

  /* ---- the surface, blitted rather than computed ---- */
  const atlas = bakeTileAtlas(R, rng, tex);
  const span = atlas.span;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);        // blit in device pixels, 1:1, no resampling
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const v = (rng() * TILE_VARIANTS) | 0;
      g.drawImage(atlas.can, v * span, 0, span, span, rx * span, ry * span, span, span);
    }
  }
  g.restore();

  // whatever this surface does at room scale rather than tile scale
  if (TEX_ARENA[tex]) TEX_ARENA[tex](g, R, rng, P);

  /* ---- spills and cracks: the sparse detail that makes it a place ---- */
  const blobs = bakeSpills(rng, 6);
  for (let y = 0; y < R.ah; y += TS) {
    for (let x = 0; x < R.aw; x += TS) {
      if (rng() < 0.07) {
        const b = blobs[(rng() * blobs.length) | 0];
        g.drawImage(b.can, x + rng() * TS - b.w / 2, y + rng() * TS - b.h / 2, b.w, b.h);
      }
      // a hairline crack, one device pixel wide
      if (rng() < 0.05) {
        let cx = x + rng() * TS, cy = y + rng() * TS, a = rng() * TAU;
        for (let i = 0; i < 22; i++) {
          g.fillStyle = i % 5 === 0 ? 'rgba(255,240,220,0.05)' : 'rgba(0,0,0,0.42)';
          g.fillRect(Math.round(cx * RS) * P, Math.round(cy * RS) * P, P, P);
          a += rng() - 0.5; cx += Math.cos(a) * 0.7; cy += Math.sin(a) * 0.7;
        }
      }
    }
  }
  if (S.secret) {
    g.fillStyle = 'rgba(180,160,140,0.14)';
    const ax = S.secret.x + 5, ay = 74;
    for (let i = 0; i < 14; i++) g.fillRect(ax, ay + i, 1, 1);
    for (let i = 0; i < 6; i++) { g.fillRect(ax - i, ay + i, 1, 1); g.fillRect(ax + i, ay + i, 1, 1); }
  }
  const dc = subCanvas(R.aw, R.ah);
  decalCan = dc.can; decalCtx = dc.ctx;
}

/* ============================================================
   ENTITIES
   ============================================================ */
function makePlayer() {
  return {
    x: S.aw / 2, y: S.ah / 2, vx: 0, vy: 0, r: 6, ang: 0,
    hp: 100, shield: 0, shieldT: 0,
    /* Read off the gun, never typed twice. This was a literal `14` left over
       from an older magazine size, so cutting the pistol to 12 left every run
       starting on 14 rounds in a 12-round magazine — the HUD opened on
       `14/12` and you got two shots the gun does not have. It cannot drift
       again from here. */
    owned: ['pistol'], wi: 0, mags: { pistol: WEP.pistol.mag },
    reT: 0, reMax: 0, reStage: 0, fireT: 0, recoil: 0,
    spin: 0, charge: 0, beamT: 0,
    nades: 3, nadeCd: 0,
    dash: 0, dashCd: 0, iframe: 0, walkT: 0, stepPhase: 0, flip: false,
    hurtFlash: 0, kick: 0,
    glockT: 0, glockSide: 1, ramHit: [], tempShield: 0, frenzyT: 0, siphonT: 0
  };
}

function spawnEnemy(type, x, y) {
  const d = ETYPE[type], D = diff();
  const waveK = 1 + S.wave * 0.10;      // x2 per wave, so the floor still ends at +50%
  // the other half of THE RENDERING's twist — see startWave
  const hp = d.hp * D.hp * waveK * (isTwist('swarm') ? 0.7 : 1);
  const e = {
    type, x, y, vx: 0, vy: 0, r: d.r, bank: d.bank, spr: d.bank.walk[0],
    // random phase so a spawned batch doesn't march in lockstep
    anim: rnd(0, 4), poseT: 0,
    hp, max: hp,
    tint: d.tint || null, scale: d.scale || 1,
    split: d.split | 0, nest: d.nest | 0, hatchT: rnd(1.5, 2.5),
    armour: d.armour || 0, armArc: d.armArc || 0, standoff: d.standoff || 0,
    lob: d.lob || 0, lobT: rnd(1.2, 2.6), aura: d.aura || 0, buffed: 0,
    spd: d.spd * D.spd * rnd(0.9, 1.12), base: d.spd * D.spd,
    mark: 0, slowT: 0, slowAmt: 0,
    dmg: d.dmg * D.dmg * (1 + S.wave * 0.06),
    score: d.score, gib: d.gib, name: d.name,
    hit: 0, atkT: 0, fireT: rnd(1, 2), wob: rnd(0, TAU), stun: 0, burn: 0, burnT: 0,
    blinkT: rnd(1, 3), bob: rnd(0, TAU), flip: false, boss: false, dead: false, sq: 0,
    twitch: 0, twx: 0, twy: 0, trail: []
  };
  S.en.push(e);
  return e;
}

/* `idx < 0` means the finale. Everything else is a roster index. */
function spawnBoss(idx, apex) {
  const fin = idx < 0;
  const B = fin ? BOSS_FINAL : BOSSES[idx], D = diff();
  const am = apex ? 2.6 : 1;
  /* Health is the FLOOR's, scaled by the entry's `bulk` nudge — see BOSS_HP.
     The finale is priced flat because it is not on the ladder: it is the top
     of it, and floor 10's diff().hp is already 12.25x. */
  const hp = bossBudget(fin ? FLOORS - 1 : S.room) * D.hp * 1.35 * am;
  const sp = B.spd * (1 + S.room * 0.06) * (1 + (S.evo | 0) * 0.04) * (apex ? 1.22 : 1);
  const b = {
    type: 'boss', def: B, name: apex ? 'APEX ' + B.name : B.name, x: S.aw / 2, y: 90, vx: 0, vy: 0,
    r: B.r * (apex ? 1.45 : fin ? 1.2 : 1), bank: B.bank, spr: B.bank.walk[0],
    tint: apex ? 'rgba(176,40,255,0.5)' : B.tint, scale: apex ? 1.5 : fin ? 1.35 : 1, apex: !!apex,
    final: !!fin,
    anim: 0, poseT: 0,
    hp, max: hp, spd: sp, base: sp,
    mark: 0, slowT: 0, slowAmt: 0,
    dmg: 26 * D.dmg * (apex ? 1.45 : fin ? 1.25 : 1), score: fin ? 6000 : apex ? 1400 : 500,
    gib: '#8a3540', hit: 0, phase: 'idle', pt: 1.2, wob: 0, bob: 0, sq: 0, orbit: rnd(0, TAU),
    stun: 0, burn: 0, burnT: 0, flip: false, boss: true, dead: false, chargeDir: 0, spawnT: 4,
    twitch: 0, twx: 0, twy: 0, trail: [],
    /* `ph` is which phase it is in and `phases` how many it has — two for the
       roster, three for the finale. See enterPhase(). */
    ph: 1, phases: B.phases || 2, phaseT: 0, spitAng: rnd(0, TAU),
    edge: 0, dropT: 0, hookT: rnd(1.4, 2.2), volley: 0
  };
  S.en.push(b); S.boss = b;
  A.roar();
  if (A.music) { A.music.setBoss(true); A.duck(0.7, fin ? 2.4 : 1.4); }
  S.jump = fin ? 0.75 : 0.42; S.jumpSpr = B;
  shake(fin ? 24 : apex ? 18 : 11); punch(fin ? 0.11 : apex ? 0.09 : 0.05);
  if (apex) { S.flash = 0.8; S.flashCol = '#b028ff'; }
  if (fin) { S.flash = 1.0; S.flashCol = '#ff2b2b'; A.setDread(1); }
  msg(b.name, apex ? 'IT CAME UP WRONG AND IT KEPT GROWING' : B.cry, fin ? 4.2 : 3.2);
  return b;
}

/* ---------- how strong the run has actually got ----------

   `diff()` scales the floor by *depth*. That is only half the story: two runs
   on floor 6 can be five minutes and forty minutes apart in power, because one
   of them found an off-cut and three guns and the other did not. Depth-only
   scaling means a good run trivialises its own elites and a bad run gets
   flattened by the same numbers.

   So the elites read the build instead. Every term is something you chose to
   pick up, weighted by roughly how much it moved your damage:

     levels            +5%  each   — the broadest signal, and the slowest
     cards taken       +3%  each   — deck ranks, the main track
     guns owned        +7%  each   — a new gun is a whole new output curve
     aisle rungs      +12%  each   — THE ORDER, MASTERED, and the third rung
     off-cuts built   +18%  each   — LEGENDARY by definition

   The signature-grocery term went with the groceries. Aisle rungs replace it:
   they are the same kind of signal — a small number of large, deliberate power
   spikes — and they read a system that still exists.

   Capped at 3.2x. Uncapped, a very long run's elites outgrow its floor boss,
   which inverts the shape of a floor. Deliberately NOT applied to floor
   bosses: they have a roster HP band and a phase break doing that job, and
   stacking a build multiplier on top of both would make wave 10 the only wave
   that matters. */
function powerMul() {
  let n = 1;
  n += Math.max(0, S.level - 1) * 0.05;
  n += (S.cardsTaken | 0) * 0.03;
  n += Math.max(0, (S.p ? S.p.owned.length : 1) - 1) * 0.07;
  for (const k of AISLE_ORDER)
    n += ((aisleT1(k) ? 1 : 0) + (aisleT2(k) ? 1 : 0) + (aisleT3(k) ? 1 : 0)) * 0.12;
  for (const f of FUSIONS) if (fz(f.id)) n += 0.18;
  return Math.min(3.2, n);
}

/* An elite: a regular horror that got too big for the aisle. Uses the ordinary
   enemy AI, wears a boss health bar, and is worth a card. */
function spawnMini(idx) {
  const M = MINIS[idx % MINIS.length], D = diff();
  const e = spawnEnemy(M.key, S.aw / 2, 92);
  /* ---- an elite is priced off the floor's boss, not off its species ----

     It used to be `speciesHP * (5 + floor*1.6)`, and that was quietly broken:
     the species table spans 26 (CRAWLER) to 170 (CYST), a **6.5x** swing, and
     the depth term multiplied straight through it. Meanwhile a floor boss is a
     fixed roster number. So on any floor whose elite slots landed on HUSK/CYST
     the wave-8 elite outlasted the wave-10 boss — measured at 1.93x on floor 6
     in the original build, and every buff since has widened it.

     Species should decide how a thing *fights*, not how big its bar is. So the
     bar is a share of what the floor boss is worth, which makes the ordering
     true by construction at every depth:

       0.22 share x 3.2 powerMul cap = 0.70x the boss, worst case

     `flavour` keeps a CYST elite chunkier than a CRAWLER elite — but 1.45x
     chunkier, not 6.5x. */
  /* Reads the FLOOR's boss budget, not the roster entry's — which no longer
     carries one at all, now that identity and health have been separated (see
     BOSS_HP). Reading `BOSSES[...].hp` here silently produced NaN and every
     elite in the game spawned with an undefined health bar. */
  const bossHp = bossBudget(S.room) * D.hp * 1.35;
  const flavour = 0.85 + 0.5 * (ETYPE[M.key].hp / 170);   // 0.93 crawler .. 1.35 cyst
  e.hp = e.max = bossHp * ELITE_SHARE * flavour * powerMul();
  /* Half the build multiplier on the bite as well. Full would make a strong
     run's elites one-shot you through a full FROZEN stack; none at all makes
     them a stationary target you out-heal. */
  e.dmg *= 1.9 * (1 + (powerMul() - 1) * 0.5);
  e.base *= 1.25; e.spd = e.base;
  e.score = 320;
  e.elite = true; e.eliteT = 2.4; e.eliteCol = M.col;
  e.mini = true; e.boss = true;              // boss:true only for the bar and the payout
  e.def = { item: null };
  e.name = M.name;
  e.tint = M.tint; e.scale = 1.9; e.r = ETYPE[M.key].r * 1.8;
  e.trail = [];
  S.boss = e;
  A.roar();
  if (A.music) { A.music.setBoss(true); A.duck(0.6, 1.2); }
  S.jump = 0.34; S.jumpSpr = { bank: ETYPE[M.key].bank, tint: M.tint };
  shake(8); punch(0.04);
  msg(M.name, 'AN ELITE. IT IS CARRYING A CARD.', 3.0);
  return e;
}

/* ---------- juice ---------- */
function part(x, y, col, n, spd, life, size) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(spd * 0.3, spd);
    S.part.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: rnd(life * 0.5, life), max: life, s: size || 1 });
  }
}
function spray(x, y, ang, col, n, spd, life, cone) {
  for (let i = 0; i < n; i++) {
    const a = ang + rnd(-(cone || 0.6), cone || 0.6), s = rnd(spd * 0.35, spd);
    S.part.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: rnd(life * 0.5, life), max: life, s: 1 });
  }
}
/* ---- sparks ----
   The same emitter, but the particle carries `trail`, so the draw pass strikes
   it as a short line along its own velocity instead of a square. That single
   difference is most of what separates "a puff of dots" from an impact: a
   spark you can see the DIRECTION of tells you where the hit came from, which
   is information the dot never carried. They also decay much faster, so they
   read as a flash rather than as smoke. */
function sparks(x, y, ang, col, n, spd, life, cone) {
  for (let i = 0; i < n; i++) {
    const a = ang + rnd(-(cone === undefined ? 0.7 : cone), cone === undefined ? 0.7 : cone);
    const s = rnd(spd * 0.45, spd);
    S.part.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col,
                  life: rnd(life * 0.4, life), max: life, s: 1, trail: 1, drag: 0.86 });
  }
}
/* ---- the impact ----
   One call, used by every bullet that lands on something. A white core that
   sells the moment of contact, a fan of sparks thrown BACK along the shot
   (which is where debris actually goes), and a thin expanding ring so the hit
   still registers when the enemy sprite is under a pile of other enemies.

   `heavy` is for crits and big single rounds: same shape, more of it. Scaling
   one effect rather than adding a second one is what keeps a crit reading as
   "that hit harder" instead of "that was a different event". */
function impact(x, y, ang, col, heavy) {
  const n = heavy ? 11 : 5;
  sparks(x, y, ang + Math.PI, col, n, heavy ? 260 : 170, heavy ? 0.34 : 0.22, 0.85);
  sparks(x, y, ang, '#fff6e0', heavy ? 4 : 2, 120, 0.16, 0.5);
  ring(x, y, heavy ? 17 : 9, heavy ? '#ffffff' : col, heavy ? 0.20 : 0.13, 1);
  S.part.push({ x, y, vx: 0, vy: 0, col: '#ffffff', life: heavy ? 0.09 : 0.06,
                max: 0.1, s: heavy ? 4 : 2, glow: 1 });
}
function gib(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(30, 150);
    S.gibs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: rnd(0.6, 1.5), s: rndi(1, 3) });
  }
}
/* Decals are baked at render resolution now, so a splash can be a spatter of
   fine droplets around a wet core instead of a handful of blocks. */
function blood(x, y, r, col) {
  if (!decalCtx) return;
  const P = 1 / RS;
  decalCtx.fillStyle = col || 'rgba(96,10,16,0.55)';
  for (let i = 0; i < 6; i++) {
    const a = rnd(0, TAU), d = rnd(0, r * 0.7);
    const s = rnd(0.8, r * 0.45);
    decalCtx.fillRect(Math.round((x + Math.cos(a) * d) * RS) * P, Math.round((y + Math.sin(a) * d) * RS) * P,
      Math.max(P, (s * RS | 0) * P), Math.max(P, (s * 0.7 * RS | 0) * P));
  }
  decalCtx.fillStyle = col || 'rgba(96,10,16,0.32)';
  for (let i = 0; i < r * 2; i++) {
    const a = rnd(0, TAU), d = rnd(r * 0.5, r * 1.7);
    decalCtx.fillRect(Math.round((x + Math.cos(a) * d) * RS) * P, Math.round((y + Math.sin(a) * d) * RS) * P, P, P);
  }
}

/* SHREDDING.
   What comes off Damjan when something reaches him. Cloth tears in flat dark
   scraps that tumble and settle; meat comes off wet and leaves a mark. How
   much of each depends on how far gone he already is — early on it is all
   jacket, and by the end there is not much jacket left to lose. */
function shred(x, y, dmg, stage) {
  const cos = cosDef(equippedCos());
  const cloth = cos.pal.j || '#31483a', clothD = cos.pal.J || '#1d2c24';
  const n = clamp(Math.round(dmg * 0.35) + 2, 2, 9);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(40, 170);
    S.gibs.push({ x: x + rnd(-4, 4), y: y + rnd(-6, 4), vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      col: Math.random() < 0.5 ? cloth : clothD, life: rnd(0.7, 1.6), s: rndi(1, 3), rag: true });
  }
  // and the parts of him that were under it
  const meat = Math.round(stage * 1.6 + dmg * 0.2);
  for (let i = 0; i < meat; i++) {
    const a = rnd(0, TAU), s = rnd(50, 190);
    S.gibs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      col: pick(['#8c141d', '#c9926a', '#6d2230', '#a03a3a']), life: rnd(0.5, 1.2), s: rndi(1, 2) });
  }
}
function ring(x, y, r, col, life, wid) { S.rings.push({ x, y, r0: 2, r1: r, col, life, max: life, wid: wid || 1 }); }

/* Three kinds of particle out of one array. Plain ones are a square, which is
   right for smoke and meat; sparks are struck as a short line along their own
   velocity, so the DIRECTION of a hit is visible; `glow` ones go through
   'lighter' so an impact core or a muzzle actually blows out instead of
   sitting on the image as a grey square. */
function drawParticles() {
  ctx.save();
  ctx.lineCap = 'round';
  for (const q of S.part) {
    const a = clamp(q.life / q.max, 0, 1);
    if (q.trail) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = q.col;
      ctx.lineWidth = 1 + a * 0.8;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - q.vx * 0.026, q.y - q.vy * 0.026);
      ctx.stroke();
    } else if (q.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.fillStyle = q.col;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (0.5 + a), 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* The thing you actually see when something dies: a white pop, a meat cloud,
   a shockwave, sparks and a few rising embers. */
function deathBurst(e, ang) {
  /* THE ACTUAL CAUSE OF THE STUTTER ON A PIERCING SHOT.

     One death is about 65 particles. That is fine, and it is what makes a kill
     feel like one. But a round that punches through eight things fires eight
     of these on the SAME FRAME — 520 objects created at once, then updated and
     drawn every frame until they expire. Nothing was ever wrong with any
     single burst; there was simply no ceiling on how many could land together.

     So bursts get cheaper the more of them share a frame. The first is full
     price, the second about 60%, and it tails off to a fifth. A single kill is
     completely unchanged — which matters, because that is the one you look at
     — and a pile of eight still throws plenty, it just stops throwing eight
     times as much. `S.t` only advances between frames, so comparing against it
     is what makes this per-frame rather than per-kill. */
  if (S.burstT !== S.t) { S.burstT = S.t; S.burstN = 0; }
  const k = Math.max(0.2, 1 / (1 + S.burstN * 0.7));
  S.burstN++;
  const q = (c) => Math.max(1, Math.round(c * k));

  const big = !!e.boss, n = big ? 3 : 1;
  /* The white pop is what sells the frame the thing stops existing on: a
     one-frame additive disc at the body's own size, before any of the debris.
     Without it a death is a cloud of red squares appearing out of nothing. */
  S.part.push({ x: e.x, y: e.y, vx: 0, vy: 0, col: '#ffffff',
                life: big ? 0.14 : 0.07, max: big ? 0.14 : 0.07,
                s: (e.r || 6) * (big ? 2.4 : 1.5), glow: 1 });
  ring(e.x, e.y, big ? 74 : 22, '#ffffff', 0.16, 2);
  ring(e.x, e.y, big ? 58 : 17, '#c02028', 0.30, 1);
  gib(e.x, e.y, e.gib, q(big ? 70 : 12));
  blood(e.x, e.y + 4, q(big ? 26 : 11));
  part(e.x, e.y, e.gib, q(14 * n), 165, 0.55, 2);          // meat cloud
  part(e.x, e.y, '#8a1018', q(12 * n), 120, 0.65, 2);
  // struck sparks rather than dots, so the burst has a shape and a direction
  sparks(e.x, e.y, rnd(0, TAU), '#ffd9a0', q(8 * n), 250, 0.30, Math.PI);
  if (ang !== undefined) {
    spray(e.x, e.y, ang, e.gib, q(14 * n), 210, 0.6, 0.85);
    sparks(e.x, e.y, ang, '#ffe3b0', q(6 * n), 300, 0.26, 0.6);
  }
  // embers that drift upward and fade
  for (let i = 0, ne = q(5 * n); i < ne; i++) {
    S.part.push({ x: e.x + rnd(-5, 5), y: e.y + rnd(-5, 5), vx: rnd(-16, 16), vy: rnd(-52, -20),
      col: pick(['#ff6a4a', '#ffb46a', '#ffe3a8']), life: rnd(0.5, 1.1), max: 1.1, s: 1 });
  }
  if (big) { S.flash = Math.max(S.flash, 0.7); S.flashCol = '#ff2b2b'; }
}
function float(x, y, text, col, big) { S.floats.push({ x, y, text, col, life: big ? 1.1 : 0.7, big, vy: big ? -30 : -16, sc: big ? 1.6 : 1 }); }
/* ============================================================
   SCREEN MOTION — OFF.

   Both of these are now no-ops, and they are kept as functions rather than
   deleted because they are called from about forty places: every kill, every
   explosion, every phase break, every door. Gutting them here turns all of it
   off in one line and leaves each call site readable as "this was a big
   moment", which is worth keeping if it is ever wanted back.

   `shake` moved the camera; `punch` pulsed its zoom. Neither cost anything to
   run — a shake is one translate — so neither was the source of the stutter on
   a bullet that kills several things at once. That is the death burst, and it
   is capped in deathBurst() instead. This is off because it was asked for, not
   because it was slow.
   ============================================================ */
const SCREEN_MOTION = 0;
function shake(a) {
  if (!SCREEN_MOTION) return;
  const c = S.cam;
  if (a > c.sh) { c.sh = a; c.seed = Math.random() * 100; }   // new impulse, new direction
}
function punch(a) { if (SCREEN_MOTION) S.cam.punch = Math.max(S.cam.punch, a); }
function msg(m, sub, t) { S.msg = m; S.sub = sub || ''; S.msgT = t || 2.2; }

/* ---------- collision ---------- */
function collideWalls(e) {
  for (const w of S.walls) {
    if (e.x + e.r > w.x && e.x - e.r < w.x + w.w && e.y + e.r > w.y && e.y - e.r < w.y + w.h) {
      const ox1 = (w.x + w.w) - (e.x - e.r), ox2 = (e.x + e.r) - w.x;
      const oy1 = (w.y + w.h) - (e.y - e.r), oy2 = (e.y + e.r) - w.y;
      const m = Math.min(ox1, ox2, oy1, oy2);
      if (m === ox1) e.x += ox1; else if (m === ox2) e.x -= ox2;
      else if (m === oy1) e.y += oy1; else e.y -= oy2;
    }
  }
}
function pointInWall(x, y) {
  for (const w of S.walls) if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return w;
  return null;
}
function freeSpot(minD) {
  for (let i = 0; i < 160; i++) {
    const x = rnd(46, S.aw - 46), y = rnd(46, S.ah - 46);
    if (pointInWall(x, y)) continue;
    if (S.p && Math.hypot(x - S.p.x, y - S.p.y) < (minD || 130)) continue;
    let clash = false;
    for (const sh of S.shops) if (Math.hypot(x - sh.x, y - sh.y) < 70) { clash = true; break; }
    if (clash) continue;
    return { x, y };
  }
  return { x: S.aw / 2, y: 60 };
}

/* ============================================================
   WEAPONS
   ============================================================ */
function selectWeapon(i) {
  const p = S.p;
  if (i === p.wi || !p.owned[i]) return;
  p.wi = i; p.reT = 0; p.spin = 0; p.charge = 0; p.fireT = 0.12; p.beamT = 0;
  S.beamHit = null;             // otherwise the beam hangs on screen after a mid-burst swap
  A.rack();
  float(p.x, p.y - 20, curW().name, curW().col);
}
function cycleWeapon(dir) {
  const p = S.p;
  selectWeapon((p.wi + dir + p.owned.length) % p.owned.length);
}

function startReload() {
  const p = S.p, w = curW();
  if (p.reT > 0 || S.god || p.mags[w.id] >= magCap(w)) return;
  /* HAIR TRIGGER: run it dry and it is already loaded. Deliberately rewards
     emptying the magazine rather than tapping R, so it changes how you fire. */
  if (fz('trigger') && p.mags[w.id] <= magCap(w) / 4) {
    p.mags[w.id] = magCap(w);
    part(p.x, p.y, '#f5c518', 10, 110, 0.3);
    float(p.x, p.y - 18, 'HAIR TRIGGER', '#f5c518');
    A.rack();
    return;
  }
  p.reT = w.reload * ST().reloadMul; p.reMax = p.reT; p.reStage = 0;
}

function fire() {
  const p = S.p, w = curW(), st = ST();
  if (p.reT > 0) return;
  if (w.beam) return;                       // beam handled continuously
  if (p.mags[w.id] <= 0 && !S.god) { A.dryfire(); startReload(); return; }

  if (w.charge) {                            // railgun: charges then dumps
    p.charge += 1 / 60;
    return;
  }
  emit(w);
}

function emit(w) {
  const p = S.p, st = ST();
  const spin = w.spin ? p.spin : 1;
  // FRENZY cuts the gap between shots by a third for as long as it lasts
  p.fireT = (w.spin ? lerp(0.16, w.rate, p.spin) : w.rate) * st.rateMul * (p.frenzyT > 0 ? 0.66 : 1);
  if (!S.god) p.mags[w.id]--;

  const base = (w.spread + p.recoil * 0.05) * (S.god ? 0.4 : 1);
  const mx = p.x + Math.cos(p.ang) * 11, my = p.y + Math.sin(p.ang) * 11 - 1;
  const evo = !!w.evolve;
  /* ---- the riders that live on the trigger ----
     SHARPENED counts shots and forces the sixth. BOTTOM OF THE BOX pays out
     on the dregs of a magazine, so it reads the mag before it is spent. */
  S.shotN = (S.shotN | 0) + 1;
  const forceCrit = rd('malice') && S.shotN % 6 === 0;
  const cap = magCap(w);
  const magLow = rd('hopper') && !S.god && cap > 3 && p.mags[w.id] <= cap / 3;
  let dmg = (w.dmg + st.flatDmg) * st.dmgMul * (evo ? st.scarMul : 1);
  if (magLow) dmg *= 1.35;
  const col = S.god ? '#ff6cf5' : (evo ? scarCol() : w.col);
  /* THE ROTISSERIE ignores the crosshair entirely and walks its own angle
     around you — that is the whole joke, and the whole reason to own it. */
  const aim = w.radial ? (p.spitAng = (p.spitAng || 0) + w.radial) : p.ang;
  /* SPLIT: two rounds, and neither of them goes where you pointed.
     It used to fan 2n+1 with the centre shot at full power, so the card was a
     free +100% at rank 1 and +200% at rank 2 with no downside at all. Two
     forks at 0.65 is +30% output traded against never hitting dead centre —
     which is a real cost on GOD FINGER and a real gift on a shotgun. */
  const dirs = st.split ? 2 : 1;
  const fan = 0.26;
  for (let d = 0; d < dirs; d++) {
    const off = dirs === 1 ? 0 : (d - (dirs - 1) / 2) * fan;
    const outer = dirs > 1;
    // CROSSFIRE: both forks turn back toward whatever you were aiming past
    const homing = (st.home || 0) + (rd('split') && outer ? 3.2 : 0);
    const fdmg = outer ? dmg * 0.65 : dmg;
    for (let i = 0; i < w.pellets; i++) {
      const a = aim + off + rnd(-base, base);
      S.bul.push({
        x: mx, y: my, vx: Math.cos(a) * w.spd, vy: Math.sin(a) * w.spd,
        dmg: fdmg, pierce: (w.pierce || 0) + st.pierce, hitIds: [], life: w.life || 1.4,
        col, size: (w.size || 1) + (evo && S.scarLv > 3 ? 1 : 0) + (rd('caliber') ? 1 : 0),
        // house default 60 -> 38: every gun without its own `knock` was pushing
        // the room away from the muzzle, which quietly made backpedalling the
        // correct answer to everything.
        knock: w.knock === undefined ? 38 : w.knock, pin: w.pin || 0, burn: (w.burn || 0) + st.burn,
        bounce: (w.bounce || 0) + st.bounce, mark: w.mark || 0, chill: w.chill || 0,
        home: homing, lock: rd('guidance') ? null : undefined,
        /* THE FLYKILLER and BLACK FRIDAY. `ghost` is what makes a singularity
           a singularity: it does not collide, it arrives. */
        chain: w.chain || 0, chainR: w.chainR || 0,
        sing: w.sing || null, ghost: !!w.sing,
        /* THE DELI SLICER. `blade` carries the whole round trip; `travel` and
           `back` are the state it keeps while making it. */
        blade: w.blade || null, travel: 0, back: 0, wheel: Math.random() * TAU,
        crit: forceCrit, spd: w.spd, god: S.god
      });
    }
  }
  if (magLow) part(mx, my, '#ffb03a', 3, 60, 0.25);
  p.recoil = Math.min(1, p.recoil + (w.pellets > 3 ? 0.7 : 0.24));
  p.kick = w.pellets > 3 ? 6 : w.charge ? 7 : 2.6;
  /* Self-recoil used to be derived from `knock`, which tied how hard the gun
     shoved YOU to how hard it shoved THEM. Cutting the shotgun's knockback
     would then have silently deleted its kick as well, and the two are not the
     same feeling — one is a crowd tool, the other is weight. It is its own
     number now, and a much smaller one: a shove you notice, not a retreat. */
  const self = w.pellets > 3 ? 26 : w.charge ? 22 : 10;
  p.vx -= Math.cos(p.ang) * self;
  p.vy -= Math.sin(p.ang) * self;
  // burnt powder, thrown forward and shedding speed fast
  sparks(mx, my, aim, '#ffd07a', w.pellets > 3 ? 10 : 4, 190, 0.16, 0.42);
  // the flash carries the barrel's angle and the gun's own colour now
  S.muzzle = { x: mx, y: my, a: aim, col, t: 0.06, big: w.pellets > 3 || !!w.charge };
  shake(w.pellets > 3 ? 3.4 : w.charge ? 5.5 : S.god ? 1.4 : 1.0);
  if (w.charge) punch(0.05);
  if (S.god) A.godshoot();
  else if (evo) A.scarMk(S.scarLv);          // voice morphs toward a laser each mark
  else if (A[w.sfx]) A[w.sfx](spin);
  else A.shoot();
  /* A thrown disc has no case to eject, and a fish has no case at all. Both
     used to drop a brass cylinder on the floor anyway. */
  if (!w.beam && !w.blade) {
    A.shell();
    const ca = p.ang + Math.PI / 2 + rnd(-0.4, 0.4);
    S.gibs.push({ x: mx, y: my, vx: Math.cos(ca) * 70, vy: Math.sin(ca) * 70, col: '#c9a227', life: 0.9, s: 1 });
  }
}

/* ---- THE DELI SLICER's turn ----
   The one moment the whole gun is built around. Three things happen at once
   and all three matter:

     1. the disc STOPS. Not reverses — stops. `rsp` starts at zero and climbs
        by `acc`, so the blade hangs for a beat at the end of its reach before
        it starts back. Reversing the velocity instead reads as a ricochet off
        an invisible wall, which is a completely different (and much worse)
        piece of information.
     2. `hitIds` is emptied, which is what makes the way home a second pass
        rather than a victory lap. Everything it cut on the way out is a
        target again.
     3. it stops steering on `spd` and starts steering on the player, every
        frame, for the rest of its life.

   Called from three places: reaching its reach, hitting a wall, and reaching
   the edge of the arena. All three mean the same thing — that is as far as it
   goes — so all three do the same thing. */
function bladeTurn(b) {
  if (b.back) return;
  b.back = 1; b.rsp = 0; b.vx = 0; b.vy = 0;
  b.hitIds.length = 0;
  part(b.x, b.y, b.col, 4, 55, 0.24);
}

/* ---- THE FLYKILLER's chain ----
   Walks outward from the thing you actually hit rather than splashing from it:
   each link is the nearest enemy the arc has not already touched, so it snakes
   through a crowd instead of hitting a disc. It sheds a fifth of its bite per
   hop, which is what keeps a five-link chain from being five full shots — the
   gun is enormous into a queue and mediocre into one large thing, and that is
   the whole character of it.

   `seen` is per-cast, so a chain cannot fold back and double-dip. */
function chainZap(from, dmg, hops, radius, col) {
  const seen = [from];
  let cur = from, d = dmg;
  for (let h = 0; h < hops; h++) {
    let best = null, bd = radius;
    for (const o of S.en) {
      if (o.dead || seen.indexOf(o) >= 0) continue;
      const dd = Math.hypot(o.x - cur.x, o.y - cur.y);
      if (dd < bd) { bd = dd; best = o; }
    }
    if (!best) break;
    d *= 0.8;
    S.arcs.push({ x1: cur.x, y1: cur.y, x2: best.x, y2: best.y, life: 0.16, col });
    damageEnemy(best, d, false, Math.atan2(best.y - cur.y, best.x - cur.x), true);
    best.stun = Math.max(best.stun, 0.16);          // the twitch, not a stunlock
    part(best.x, best.y, col, 3, 60, 0.22);
    seen.push(best); cur = best;
  }
  if (seen.length > 1 && A.plasma) A.plasma();
  return seen.length - 1;
}

/* ---- BLACK FRIDAY's singularity ----
   The round itself is a ghost: it passes through everything, drags the room
   toward it on the way past, and only pays out when it lands. Damage falls to
   a third at the rim, so the reward for the drag is that everything is at the
   centre when it goes.

   Bosses are pulled at a fraction. Dragging a boss off its own pattern would
   make the gun the answer to every fight in the game rather than the answer to
   a crowd, and a boss that can be kited into a corner by a 460-coin purchase
   stops being a boss. */
function singularityPop(b) {
  const r = b.sing.r;
  ring(b.x, b.y, r, b.col, 0.55, 3);
  ring(b.x, b.y, r * 0.55, '#ffffff', 0.28, 2);
  part(b.x, b.y, b.col, 26, 200, 0.6);
  shake(11); punch(0.05);
  if (A.roar) A.roar();
  for (const e of S.en) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - b.x, e.y - b.y);
    if (d > r) continue;
    damageEnemy(e, b.dmg * (1 - 0.66 * (d / r)), false,
                Math.atan2(e.y - b.y, e.x - b.x), true);
    if (!e.dead) e.stun = Math.max(e.stun, 0.45);
  }
}

/* continuous beam (OMEGA) */
function updateBeam(dt) {
  const p = S.p, w = curW(), st = ST();
  S.beamHit = null;
  if (!w.beam || !mouse.down || p.reT > 0) { p.beamT = 0; return; }
  if (p.mags.omega <= 0 && !S.god) { startReload(); return; }
  p.beamT += dt;
  if (!S.god) p.mags.omega -= dt * 42;
  if (p.mags.omega < 0) p.mags.omega = 0;

  const ox = p.x + Math.cos(p.ang) * 11, oy = p.y + Math.sin(p.ang) * 11 - 1;
  let ex = ox, ey = oy;
  const hits = [];
  const girth = w.girth * (1 + st.split * 0.45);   // SPLIT widens the beam instead of forking it
  for (let i = 1; i < 220; i++) {
    const nx = ox + Math.cos(p.ang) * i * 4, ny = oy + Math.sin(p.ang) * i * 4;
    if (pointInWall(nx, ny)) break;
    ex = nx; ey = ny;
    for (const e of S.en) if (!e.dead && hits.indexOf(e) < 0 && Math.hypot(e.x - nx, e.y - ny) < e.r + girth) hits.push(e);
  }
  S.beamHit = { x: ox, y: oy, ex, ey, girth, prism: !!w.prism };
  for (const e of hits) damageEnemy(e, (w.dmg + st.flatDmg * 8) * st.dmgMul / st.rateMul * dt, true, p.ang);
  // the spark at the far end wears whatever the beam is currently doing
  if (Math.random() < dt * 70)
    spray(ex, ey, p.ang + Math.PI, w.prism ? 'hsl(' + ((S.t * 95) % 360) + ',100%,78%)' : '#e0a8ff', 4, 150, 0.35, 1.4);
  if (Math.random() < dt * 26) A.beam();
  shake(1.2);
}

/* ============================================================
   GRENADES & EXPLOSIONS
   ============================================================ */
/* Where the frag will actually land: the cursor, clamped to throwing range. */
function nadeTarget() {
  const p = S.p;
  const dx = mouse.wx - p.x, dy = mouse.wy - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const r = clamp(d, 18, 240);
  return { x: p.x + dx / d * r, y: p.y + dy / d * r };
}

function throwNade() {
  const p = S.p;
  if (p.nades <= 0 || p.nadeCd > 0) { A.denied(); return; }
  p.nades--; p.nadeCd = 0.45;
  const tg = nadeTarget();
  // Solve the arc so it touches down exactly on the crosshair.
  const T = 0.62;
  const G = 420, z0 = 6;
  S.nades.push({
    x: p.x, y: p.y, z: z0,
    vx: (tg.x - p.x) / T, vy: (tg.y - p.y) / T,
    vz: (0 - z0 + 0.5 * G * T * T) / T,     // lands at z=0 after exactly T
    fuse: 1.15, rot: 0, tx: tg.x, ty: tg.y, landed: false
  });
  A.magOut();
  float(p.x, p.y - 20, 'FRAG', '#7aa35e');
}

/* `quiet` is what a passive gets instead of the full detonation.
   A frag is an event: you threw it, you were expecting it, and the camera is
   allowed to react. OVERKILL is not an event — it fires on every kill, and a
   camera that recoils on every kill is a camera that never stops moving. So a
   quiet burst keeps the ring, the sparks and the damage, and gives up the
   shake, the punch, the hitstop, the screen flash and the audio duck. The
   feedback you need (a ring where it went off) survives; the feedback that
   fights you for control of the frame does not. */
function explode(x, y, r, dmg, col, quiet) {
  ring(x, y, r * 1.5, col || '#ffb03a', 0.4, 2);
  ring(x, y, r * 0.8, '#ffffff', 0.22, 3);
  part(x, y, '#ffd05a', quiet ? 14 : 34, quiet ? 150 : 220, 0.55, 2);
  part(x, y, '#ff5a1e', quiet ? 10 : 26, 160, 0.7, 2);
  if (!quiet) part(x, y, '#3a2a24', 20, 90, 1.0, 2);
  blood(x, y, r * 0.6, 'rgba(24,12,8,0.4)');
  if (quiet) {
    A.hit();
  } else {
    shake(14); punch(0.075); S.hitstop = Math.max(S.hitstop, 0.07);
    S.flash = Math.max(S.flash, 0.35); S.flashCol = '#ffcf8a';
    A.boom(); A.duck(0.35, 0.5);
  }
  for (const e of S.en) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > r) continue;
    const f = 1 - d / r;
    const a = Math.atan2(e.y - y, e.x - x);
    e.vx += Math.cos(a) * (quiet ? 150 : 340) * f; e.vy += Math.sin(a) * (quiet ? 150 : 340) * f;
    damageEnemy(e, dmg * f, false, a);
  }
  const pd = Math.hypot(S.p.x - x, S.p.y - y);
  if (pd < r * 0.8) {
    const a = Math.atan2(S.p.y - y, S.p.x - x);
    S.p.vx += Math.cos(a) * 260; S.p.vy += Math.sin(a) * 260;
    if (!S.god) hurtPlayer(dmg * 0.16 * (1 - pd / (r * 0.8)), x, y);
  }
}

/* ============================================================
   DAMAGE
   ============================================================ */
const MARK_MUL = 1.6;      // what THE PRICE GUN's tag is worth to everything else
/* Slowed, stunned, pinned or frozen — the state TENDERISER and BRITTLE both
   price, kept in one place so the two cards can never disagree. */
function impaired(e) { return e.slowT > 0 || e.stun > 0 || e.mark > 0; }

function damageEnemy(e, dmg, fromBullet, ang, noRoll, forceCrit) {
  if (e.dead) return 0;
  const st = ST();
  let crit = false;
  /* PLATED FRONT. The TROLLEY faces where it is going, so anything arriving
     inside `armArc` radians of its heading hits the plate and mostly does not
     count. It is not a damage sponge — from behind it takes everything — it is
     a reason to stop holding the corner you were holding. `ang` is the
     direction the hit is TRAVELLING, so a shot landing on the front of a
     rightward-moving trolley arrives pointing left: the test is against the
     reverse of its heading. */
  if (e.armour > 0 && ang !== undefined) {
    const h = Math.atan2(e.vy, e.vx);
    let da = Math.abs(((ang - h - Math.PI) % TAU + TAU + Math.PI) % TAU - Math.PI);
    if (da < e.armArc) {
      dmg *= e.armour;
      if (fromBullet && Math.random() < 0.5) {
        part(e.x + Math.cos(ang + Math.PI) * e.r, e.y + Math.sin(ang + Math.PI) * e.r, '#c8ccd4', 2, 60, 0.25);
      }
    }
  }
  if (!noRoll) {
    if (e.mark > 0) dmg *= MARK_MUL;
    if (st.tender > 0 && impaired(e)) dmg *= 1 + st.tender;
    if (rd('coldsnap') && e.slowT > 0) dmg *= 1.22;          // BRITTLE
    if (forceCrit || (st.crit > 0 && Math.random() < st.crit)) { dmg *= st.critMul; crit = true; }
  }
  e.hp -= dmg;
  /* SIPHON. 4% of what you deal comes back, capped per hit so a beam weapon
     cannot heal you to full off one bloater — it rewards keeping the trigger
     down in a crowd, which is exactly when you were going to lose health. */
  if (S.p.siphonT > 0 && dmg > 0) {
    const before = S.p.hp;
    S.p.hp = Math.min(ST().maxhp, S.p.hp + Math.min(dmg * 0.04, 2.2));
    if (S.p.hp > before && Math.random() < 0.25) part(S.p.x, S.p.y - 6, '#ff5b5b', 1, 30, 0.35);
  }
  e.hit = crit ? 0.16 : 0.09;
  e.sq = Math.min(1, e.sq + dmg * 0.012);
  blood(e.x, e.y + 4, crit ? 9 : 5, 'rgba(90,10,16,0.4)');
  if (crit) {
    part(e.x, e.y, '#fff0c0', 10, 190, 0.35, 2);
    ring(e.x, e.y, 16, '#ffd070', 0.18, 1);
    A.hit();
    /* HAMSTRUNG, FOLLOW-THROUGH, the BUTCHERY mastery and BUTCHER'S BILL all
       hang off the same crit. Every secondary hit passes noRoll so a crit can
       never crit its own splash and run away with itself. */
    if (rd('deepcut')) e.stun = Math.max(e.stun, 0.5);
    const splash = rd('cleaver') ? 26 : aisleT2('butchery') ? 30 : 0;
    if (splash) {
      ring(e.x, e.y, splash, '#ffd070', 0.22, 1);
      for (const o of S.en)
        if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < splash)
          damageEnemy(o, dmg * 0.5, false, ang, true);
    }
    if (fz('bill')) {
      let n = 0;
      for (const o of S.en) {
        if (n >= 2) break;
        if (o.dead || o === e) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) > 120) continue;
        n++;
        S.arcs.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, life: 0.16, col: '#ffd070' });
        damageEnemy(o, dmg * 0.6, false, ang, true);
      }
    }
  }
  if (ang !== undefined) spray(e.x, e.y, ang, e.gib, 5, 120, 0.35, 0.7);
  else part(e.x, e.y, e.gib, 3, 70, 0.3);
  if (e.hp <= 0) killEnemy(e, ang);
  return crit ? dmg : 0;
}

function killEnemy(e, ang) {
  e.dead = true;
  S.kills++; S.streak++;
  S.combo = Math.min(25, S.combo + 1); S.comboT = 3.2;
  const pts = Math.round(e.score * diff().score * S.combo);
  S.score += pts;
  float(e.x, e.y - 10, '+' + pts, '#ffd070');
  /* x1.4 with the move to five waves. A floor is 29% fewer bodies now, and the
     floor's DIFFICULTY did not drop with it — diff() is keyed to the floor, not
     the wave. Leaving the per-kill values alone would have meant arriving at
     floor five with 71% of the levels, cards and coins to fight the same thing
     with, which is a harder game rather than a shorter one. The 1.4 is measured:
     8,829 bodies across a full old run against 6,306 now. */
  gainXP(e.boss ? 90 : Math.max(2, Math.round(e.score * 0.59)));
  deathBurst(e, ang);
  S.hitstop = Math.max(S.hitstop, e.boss ? 0.3 : 0.035);
  shake(e.boss ? 18 : 2.5);
  A.gib();

  if (S.streak > 0 && S.streak % 15 === 0) {
    float(S.p.x, S.p.y - 26, ['BUTCHERY', 'MEAT GRINDER', 'UNCLEAN', 'DELICIOUS'][(S.streak / 15 - 1) % 4] + ' x' + S.streak, '#ff8a3a', true);
    punch(0.03);
  }

  /* ---- what the deck does when something dies ---- */
  const st = ST();
  S.waveKills++;
  /* OVERKILL and FLASHPOINT are both triggered BY a kill and both CAUSE kills.
     Fired inline they recurse — one death used to clear a room of 140 and put
     600 bullets on screen in a single frame. They go on a queue that drains a
     few at a time, once a frame, so a chain is a chain and not a stack. Every
     death-triggered rider added since goes on the same queue for the same
     reason; none of them may call damageEnemy directly from here. */
  // r 42 -> 30. OVERKILL's radius was wider than a crawler pack is deep, so one
  // death cleared the pack and the pack's neighbours; the chain that made was
  // the card's whole reputation. It reaches its own kill's neighbours now.
  if (st.overkill > 0) S.fx.push({ k: 'boom', x: e.x, y: e.y, r: 30, d: st.overkill * st.dmgMul, fire: rd('overkill') });
  /* GORGED: healing past the ceiling is banked as a temporary shield instead
     of being thrown away, which is what makes stacked GRAZING worth having. */
  if (st.graze > 0 && S.p.hp > 0) {
    const room = st.maxhp - S.p.hp;
    if (st.graze > room && rd('grazing')) S.p.tempShield = Math.min(4, S.p.tempShield + (st.graze - room) * 0.05);
    S.p.hp = Math.min(st.maxhp, S.p.hp + st.graze);
  }
  if (fz('harvest') && S.p.hp > 0) S.p.hp = Math.min(st.maxhp, S.p.hp + 0.5);
  if (st.payback && S.p.hp > 0) S.p.hp = Math.min(st.maxhp, S.p.hp + st.payback);   // PAID FORWARD
  /* SHATTER and the FROZEN mastery are the same idea at two prices: something
     that died held still leaves a hole where it stood. */
  const wasFrozen = e.stun > 0, wasSlowed = e.slowT > 0;
  if (rd('frostbite') && wasFrozen)
    S.fx.push({ k: 'boom', x: e.x, y: e.y, r: 40, d: 60 * st.dmgMul, col: '#bfefff' });
  else if (aisleT2('frozen') && (wasSlowed || wasFrozen))
    S.fx.push({ k: 'boom', x: e.x, y: e.y, r: 36, d: 45 * st.dmgMul, col: '#bfefff' });
  /* CONTAGION and BLAST FURNACE both read the same corpse: it was on fire. */
  if (e.burnT > 0) {
    if (fz('furnace')) S.fx.push({ k: 'boom', x: e.x, y: e.y, r: 54, d: 85 * st.dmgMul, col: '#ff8a2b' });
    if (rd('spoiled')) {
      for (const o of S.en)
        if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 44) {
          o.burn = Math.max(o.burn, st.burn || 6); o.burnT = Math.max(o.burnT, 2.6);
        }
    }
  }
  /* The HUSK was full of them. Direct spawn, not the fx queue — spawning is
     not damage, so it cannot recurse (crawlers do not split). The children
     get a shove outward so they read as bursting out rather than appearing. */
  if (e.split > 0) {
    for (let i = 0; i < e.split; i++) {
      const a = rnd(0, TAU);
      const c2 = spawnEnemy('crawler', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
      c2.vx = Math.cos(a) * 160; c2.vy = Math.sin(a) * 160;
      c2.stun = 0.25;
    }
    float(e.x, e.y - 16, 'IT WAS FULL', '#d8d0c0');
    gib(e.x, e.y, e.gib, 8);
    A.crack();
  }
  /* Bursting a CYST point-blank is answered: a slow ring of acid, easily
     walked out of at range, not at arm's length. */
  if (e.nest) {
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + rnd(0, 0.4);
      S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85,
                  r: 4, bob: rnd(0, TAU), dmg: e.dmg * 0.55, life: 1.8, col: '#a8d14a' });
    }
    blood(e.x, e.y, 14, 'rgba(90,120,20,0.35)');
  }

  // RENDERING: the dead leave something behind that the living have to walk through
  if (st.pool > 0 && !e.boss) S.pools.push({ x: e.x, y: e.y, r: 20, life: 6, max: 6, d: st.pool });
  if (st.novaEvery > 0) {
    S.killsSinceNova++;
    if (S.killsSinceNova >= st.novaEvery) { S.killsSinceNova = 0; S.fx.push({ k: 'nova', x: S.p.x, y: S.p.y }); }
  }

  // ---- loot ----
  if (e.boss) {
    S.boss = null;
    if (A.music) { A.music.setBoss(false); A.duck(0.8, 2.2); }
    S.slow = 0.9; punch(0.09);
    S.flash = 0.7; S.flashCol = '#ff2b2b';

    /* ---- the end of the game ----
       Everything it left in the air goes with it. A victory beat you have to
       dodge through is not a victory beat, and there is nothing left alive to
       be fighting: the finale spawns alone, so an empty room is the honest
       state of the world the moment it dies. */
    if (e.final) {
      S.eb.length = 0; S.haz.length = 0; S.cracks.length = 0; S.queue.length = 0;
      for (const o of S.en) if (o !== e) { o.dead = true; o.hp = 0; }
      S.won = true; S.winT = 3.4;
      // and nothing is owed a screen any more
      S.upgPts = 0; S.pendingLuck = 0;
      S.slow = 2.2; S.hitstop = Math.max(S.hitstop, 0.4);
      S.flash = 1; S.flashCol = '#ffffff';
      shake(26); punch(0.14);
      for (let k = 0; k < 5; k++) ring(e.x, e.y, 60 + k * 70, '#ff2b2b', 0.9 + k * 0.2, 3);
      part(e.x, e.y, '#ffffff', 70, 260, 1.4, 2);
      A.roar(); A.god();
      if (A.music) A.music.stop(2.6);
      A.setDread(0);
      bump('protocol');
      msg('THE MEAT PROTOCOL IS MEAT', 'it is over. you can stop now.', 5);
    }

    /* Elites and floor bosses both pay in a card you get to choose. That is
       the whole reason to fight one now — the groceries live in the deck. */
    const elite = !!e.mini;
    /* Up from 10/18/38. Two shops a floor is only a decision if there is money
       to bring to the second one, and both of these are a much longer fight
       than they were — elites carry ~50% more meat, floor bosses have a second
       phase to chew through. */
    const coins = elite ? 15 : e.apex ? 50 : 26;
    for (let i = 0; i < coins; i++) {
      const a = rnd(0, TAU);
      S.drops.push({ x: e.x, y: e.y, kind: 'coin', t: 0, life: 40, bob: rnd(0, TAU), vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 });
    }
    if (Math.random() < (elite ? 0.20 : e.apex ? 1 : 0.55)) dropPickup(e.x + 8, e.y, 'card');
    dropPickup(e.x - 10, e.y, 'nade');
    if (!elite) dropPickup(e.x + 18, e.y, 'shield');

    /* A guaranteed hand, dealt at better odds the bigger the thing was — but
       not from the finale. There is no next wave to spend a card on, and
       shoving a level-up screen between the last kill and the ending is the
       single most reliable way to throw an ending away. */
    if (!e.final) {
      S.upgPts++;
      /* A floor boss used to pay a card AND open the cold room. With the
         groceries gone it owes the difference in the only currency left, so
         its hand runs much hotter: 2.0 luck against an elite's 0.5. The apex
         stays the biggest number in the game. */
      S.pendingLuck = elite ? 0.5 : e.apex ? 2.4 : 2.0;
      S.lvlDelay = 1.1;
    }

    S.bossKills++;
    // Only a FLOOR boss opens the top of the deck — elites do not count.
    if (!elite) {
      S.floorBosses++;
      if (e.apex) S.apexKills++;
      bump('bosses'); if (e.apex) bump('apex');
      if (!e.final) float(e.x, e.y - 44, 'THE DECK OPENS', '#ffb03a', true);
    }
    checkContracts();
    if (!e.final) {
      msg(e.name + ' IS MEAT', elite ? 'an elite. the deck opens.'
          : e.apex ? 'the apex is down. take something obscene.'
          : 'the floor is yours. pick something good.', 3);
      A.roar();
    }
  } else {
    /* Med kits used to be a 6% drop on top of two guaranteed ones every wave,
       which meant health was never actually a resource. */
    const r = Math.random() / st.lootMul;
    if (r < 0.0112) dropPickup(e.x, e.y, 'card');       // rare, x1.4 for five waves
    else if (r < 0.021) dropPickup(e.x, e.y, 'nova');   // the rarer of the two new ones
    else if (r < 0.056) dropPickup(e.x, e.y, 'shield');
    /* ---- WHAT THE DEEP FLOORS DROP ----
       The table used to be identical on floor 1 and floor 10: heal, shield,
       ammo, coin, frag. Everything you could find you had already found in the
       first five minutes, so going deeper stopped paying in anything but
       numbers. These four unlock with depth, and none is a bigger version of
       something you already had — each changes what you can DO for a few
       seconds rather than topping a bar back up.

       THE BAND IS CARVED OUT OF COIN, and it sits BELOW card/nova/shield on
       purpose. Put above them and it swallows them: the first version of this
       took nova from 1.3% to zero and shield from 3.5% to 0.4%, because an
       `else if` chain gives the earlier test the whole overlap. Coin is the
       widest band at 19% and the one that can afford to lose five points. */
    else if (S.room >= 7 && r < 0.070) dropPickup(e.x, e.y, 'bounty');
    else if (S.room >= 5 && r < 0.082) dropPickup(e.x, e.y, 'siphon');
    else if (S.room >= 3 && r < 0.096) dropPickup(e.x, e.y, 'frenzy');
    else if (S.room >= 4 && r < 0.106) dropPickup(e.x, e.y, 'magnet');
    // 16% -> 19%. PACI turns up twice a floor now and the second visit has to
    // be able to buy something, or it is just a corridor with a man in it.
    else if (r < 0.246) dropPickup(e.x, e.y, 'coin');
    else if (r < 0.306) dropPickup(e.x, e.y, 'ammo');
    else if (r < 0.338) dropPickup(e.x, e.y, 'med');    // 3.2%, down from 6%
    else if (r < 0.368) dropPickup(e.x, e.y, 'nade');
  }
  if (S.kills % 25 === 0) { bump('kills', 25); checkContracts(); }
}

/* Shared by the NOVA pickup and the FLASHPOINT card.

   The old one was 26 homing rounds at 90 damage with two pierce each and a
   2.6s life — which is 78 potential bodies from one press, and they *steered*,
   so it did not miss. It cleared any wave it was fired into, which is why
   FLASHPOINT could feed itself. Cut on four axes at once, because no single
   one of them was the problem:

     rounds    26 -> 20     it is a ring, not a wall
     damage    90 -> 55     kills a CRAWLER, wounds a BLOATER
     pierce     2 ->  1     two bodies a round, not three
     homing   5.5 -> 1.6    it now has to be aimed by standing somewhere

   Still the loudest single button in the game, and still worth picking the
   pickup up for. It just no longer ends the wave on its own. */
function fireNova(x, y) {
  const st = ST(), N = 20;
  for (let k = 0; k < N; k++) {
    const a = k / N * TAU + Math.random() * 0.1;
    S.bul.push({
      x, y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
      dmg: 55 * st.dmgMul, pierce: 1 + st.pierce, hitIds: [], life: 1.9,
      col: '#ffb03a', size: 3, knock: 80, pin: 0, burn: 12 + st.burn, bounce: st.bounce,
      mark: 0, chill: 0, god: S.god, home: 1.6, spd: 340
    });
  }
  float(x, y - 18, 'NOVA', '#ffb03a', true);
  ring(x, y, 64, '#ffb03a', 0.4, 2);
  part(x, y, '#fff0a8', 30, 200, 0.7, 2);
  shake(5); punch(0.03); S.flash = Math.max(S.flash, 0.28); S.flashCol = '#ffcf8a';
  A.boom();
  // FALLOUT leaves the ground going; FLASH FLOOD puts the room on ice with it
  if (rd('flashpoint')) S.pools.push({ x, y, r: 40, life: 5, max: 5, d: 16, fire: 1 });
  if (fz('flood')) frostPulse(x, y, false);
}

/* ============================================================
   THE NEW VERBS

   Three cards do something the engine could not previously do, so they get
   real machinery rather than another multiplier: THE HOOKS orbit, RENDERING
   leaves ground behind, HARD FROST pulses. Everything else in the deck rides
   on hooks that already existed.
   ============================================================ */

/* THE HOOKS. The array is rebuilt only when the count changes, so the ring
   keeps its phase across a level-up instead of snapping back to zero. */
function updateOrbs(dt, st) {
  const want = st.hooks | 0;
  if (S.orbs.length !== want) {
    const base = S.orbs.length ? S.orbs[0].a : 0;
    S.orbs = [];
    for (let i = 0; i < want; i++) S.orbs.push({ a: base + i / want * TAU, hit: [] });
  }
  if (!want) return;
  const p = S.p, wide = rd('hooks');
  const R = wide ? 46 : 34, spin = wide ? 2.6 : 2.1;
  for (const o of S.orbs) {
    o.a += dt * spin;
    o.x = p.x + Math.cos(o.a) * R;
    o.y = p.y + Math.sin(o.a) * R;
    for (let i = o.hit.length - 1; i >= 0; i--) { o.hit[i].t -= dt; if (o.hit[i].t <= 0) o.hit.splice(i, 1); }
    for (const e of S.en) {
      if (e.dead || o.hit.some(h => h.e === e)) continue;
      if (Math.hypot(e.x - o.x, e.y - o.y) > e.r + 6) continue;
      o.hit.push({ e, t: 0.5 });                       // one bite per pass, not per frame
      damageEnemy(e, 26 * st.dmgMul, false, o.a);
      part(o.x, o.y, '#ff5a62', 5, 80, 0.3);
      A.hit();
      // ON THE RAIL drags them in; THE GRINDER puts them on ice as well
      if (wide) { const a = Math.atan2(p.y - e.y, p.x - e.x); e.vx += Math.cos(a) * 150; e.vy += Math.sin(a) * 150; }
      if (fz('grinder')) { e.stun = Math.max(e.stun, 0.9); float(e.x, e.y - 10, 'HUNG', '#bfefff'); }
    }
  }
}

/* RENDERING's pools. They tick on the same 0.25s cadence as the walk-in aura
   so a floor covered in them costs a predictable amount of frame. */
function updatePools(dt, st) {
  if (!S.pools.length) return;
  const p = S.p, drain = rd('render');
  S.poolT = (S.poolT || 0) + dt;
  const tick = S.poolT >= 0.25;
  if (tick) S.poolT -= 0.25;
  for (let i = S.pools.length - 1; i >= 0; i--) {
    const q = S.pools[i];
    q.life -= dt;
    if (q.life <= 0) { S.pools.splice(i, 1); continue; }
    /* `warm` is a burner that has lit but not yet caught: it draws its ring and
       does nothing at all. Your own pools never set it — only the floor does,
       because only the floor's pools can hurt you and only a hazard that can
       hurt you owes you a warning. */
    if (q.warm > 0) {
      q.warm -= dt;
      if (Math.random() < dt * 18) part(q.x + rnd(-q.r, q.r) * 0.6, q.y + rnd(-q.r, q.r) * 0.4, '#ff8a2b', 1, 26, 0.4);
      if (q.warm <= 0) { ring(q.x, q.y, q.r, '#ff8a2b', 0.35, 2); A.burn(); }
      continue;
    }
    if (Math.random() < dt * 6)
      part(q.x + rnd(-q.r, q.r) * 0.7, q.y + rnd(-q.r, q.r) * 0.5, q.fire ? '#ff8a2b' : '#8fdc5a', 1, 12, 0.5);
    if (!tick) continue;
    // THE RED KITCHEN's burners are the only pools that read Damjan as fuel.
    if (q.hot && Math.hypot(p.x - q.x, p.y - q.y) < q.r) hurtPlayer(q.d * 0.5, q.x, q.y);
    for (const e of S.en) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - q.x, e.y - q.y);
      if (d > q.r) continue;
      damageEnemy(e, q.d * 0.25, false, undefined, true);
      if (drain && d > 4) { const a = Math.atan2(q.y - e.y, q.x - e.x); e.vx += Math.cos(a) * 55; e.vy += Math.sin(a) * 55; }
    }
    // HARVEST turns your own mess into a health pack you have to stand in
    if (fz('harvest') && Math.hypot(p.x - q.x, p.y - q.y) < q.r && p.hp > 0)
      p.hp = Math.min(st.maxhp, p.hp + 1);
  }
  if (S.pools.length > 40) S.pools.splice(0, S.pools.length - 40);
}

/* ============================================================
   BOSS HAZARDS

   A boss whose entire vocabulary is "spawn a ring of projectiles" asks the
   player exactly one question, over and over: which way is out. Ten of those
   in a row is one boss with ten health bars. These are the other questions.

     mark   a shell lands HERE, in `t` seconds. the circle is the contract:
            it is drawn before it is dangerous and it does not move, so the
            answer is always "be elsewhere" and never "be lucky".
     mine   sits, arms, and goes off when you touch it. it turns the arena
            into terrain you have to spend, which is the only way to make a
            big empty room a place with corners in it.
     beam   a line, anchored to the boss, that sweeps. it does not care where
            you are; it cares where you WILL be, and it cannot be outrun in a
            straight line — only crossed.

   Every one has a wind-up you can see and a shape you can learn. That is the
   whole design rule for this file: no damage without a tell.
   ============================================================ */
function updateHaz(dt) {
  const p = S.p;
  for (let i = S.haz.length - 1; i >= 0; i--) {
    const h = S.haz[i];
    h.t -= dt;

    if (h.k === 'mark') {
      if (h.t <= 0) {
        /* `spawn` makes it an EGG rather than a shell — MOTHER OF MELONS seeds
           the room instead of shelling it. Same telegraph, same circle, and
           what comes out of it is the surprise. It goes through the crack
           system so it hatches on the ordinary spawn animation, and it obeys
           the room cap: a boss that can seed past the cap is bug #A with a
           different name on it. */
        if (h.spawn) {
          const addCap = Math.min(30, 14 + S.room * 4 + (S.evo | 0) * 2);
          if (S.en.length + S.cracks.length < addCap)
            S.cracks.push({ x: h.x, y: h.y, t: 0.4, type: h.spawn });
          ring(h.x, h.y, h.r, h.col, 0.35, 2);
          part(h.x, h.y, h.col, 14, 120, 0.5);
          A.screech(true);
        } else {
          // the shell lands: one loud ring, damage falling off to the rim
          ring(h.x, h.y, h.r, h.col, 0.45, 3);
          ring(h.x, h.y, h.r * 0.5, '#ffffff', 0.22, 2);
          part(h.x, h.y, h.col, 24, 190, 0.6, 2);
          shake(7); punch(0.03); A.boom();
          const d = Math.hypot(p.x - h.x, p.y - h.y);
          if (d < h.r) hurtPlayer(h.dmg * (1 - 0.45 * (d / h.r)), h.x, h.y);
        }
        S.haz.splice(i, 1);
      }

    } else if (h.k === 'mine') {
      /* Armed after 0.7s, then live for the rest of its life. `hit` stops one
         mine paying out twice inside a single dash. */
      if (h.t <= 0) { S.haz.splice(i, 1); continue; }
      if (h.life - h.t < 0.7) continue;
      if (!h.hit && Math.hypot(p.x - h.x, p.y - h.y) < h.r) {
        h.hit = 1;
        ring(h.x, h.y, h.r * 1.6, h.col, 0.4, 2);
        part(h.x, h.y, h.col, 20, 170, 0.5, 2);
        shake(6); A.boom();
        hurtPlayer(h.dmg, h.x, h.y);
        S.haz.splice(i, 1);
      }

    } else if (h.k === 'beam') {
      /* Anchored to its boss and swept by it. Dies with the boss — a beam
         hanging in the air after the thing holding it is gone reads as a bug
         no matter how good it looks. */
      if (h.t <= 0 || !h.b || h.b.dead) { S.haz.splice(i, 1); continue; }
      h.x = h.b.x; h.y = h.b.y;
      h.ang += h.spin * dt;
      if (h.warm > 0) { h.warm -= dt; continue; }
      // point-to-line distance along the beam's own axis
      const dx = p.x - h.x, dy = p.y - h.y;
      const along = dx * Math.cos(h.ang) + dy * Math.sin(h.ang);
      const off = Math.abs(-dx * Math.sin(h.ang) + dy * Math.cos(h.ang));
      if (along > 0 && along < h.len && off < h.w + p.r) {
        hurtPlayer(h.dmg * dt, h.x, h.y);
        part(p.x, p.y, h.col, 1, 40, 0.3);
      }
    }
  }
  if (S.haz.length > 48) S.haz.splice(0, S.haz.length - 48);
}

/* Called twice a frame. Marks and mines are FLOOR — they have to sit under
   everything that walks on them or they read as objects in the air. A sweeping
   beam is not floor; it goes over the top with the muzzle flashes. */
function drawHaz(air) {
  for (const h of S.haz) {
    if (!!air !== (h.k === 'beam')) continue;
    if (h.k === 'mark') {
      /* The circle fills as the shell falls. Full ring = now. Nothing about
         this is subtle on purpose; a telegraph you have to squint at is not a
         telegraph. */
      const u = clamp(1 - h.t / h.max, 0, 1);
      ctx.globalAlpha = 0.22 + u * 0.22;
      ctx.fillStyle = h.col;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * u, h.r * u * 0.6, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5 + Math.abs(Math.sin(S.t * (5 + u * 14))) * 0.4;
      ctx.strokeStyle = h.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;

    } else if (h.k === 'mine') {
      const armed = h.life - h.t >= 0.7;
      ctx.globalAlpha = armed ? 0.55 + Math.sin(S.t * 7 + h.x) * 0.3 : 0.3;
      ctx.fillStyle = h.col;
      ctx.fillRect((h.x - 2) | 0, (h.y - 2) | 0, 4, 4);
      if (armed) {
        ctx.globalAlpha = 0.16 + Math.sin(S.t * 7 + h.x) * 0.10;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

    } else if (h.k === 'beam') {
      const ex = h.x + Math.cos(h.ang) * h.len, ey = h.y + Math.sin(h.ang) * h.len;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      if (h.warm > 0) {
        // the sighting line: where it is about to be, at a width that cannot hurt
        ctx.globalAlpha = 0.35 + Math.sin(S.t * 20) * 0.2;
        ctx.strokeStyle = h.col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
      } else {
        ctx.globalAlpha = 0.30; ctx.strokeStyle = h.col; ctx.lineWidth = h.w * 2.4;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 0.75; ctx.lineWidth = h.w * 1.1;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
}

/* One shell, landing where it is drawn, `t` seconds from now. */
function mortarAt(x, y, r, dmg, t, col) {
  S.haz.push({ k: 'mark', x, y, r, dmg, t, max: t, col: col || '#ff8a2b' });
}

/* ============================================================
   THE FLOOR TWISTS

   One rule per floor, and each one has to be a rule you can PLAY AGAINST
   rather than a number you absorb. That is the whole test: a twist that just
   subtracts (−10% damage, say) is difficulty; a twist you can read, time and
   step around is design. So every one of these either has a tell, a rhythm, or
   a trade attached.

     dark      floor 2 · the lamp is smaller. nothing else changes.
     slick     floor 3 · you keep your momentum. so do your mistakes.
     heat      floor 4 · burners open on a beat and you can see them coming
     frost     floor 5 · the room freezes over; you are slow for four seconds
     swarm     floor 6 · half again as many, at 70% health each
     blackout  floor 7 · the lights cut out and it counts you down first
     frail     floor 8 · everything hits 25% harder. no tell. that IS floor 8.
     hunt      floor 9 · a third elite, on a wave that never had one
     final     floor 10 · see BOSS_FINAL

   `heat`, `frost` and `blackout` run on the shared timer below. The rest are
   read where they land — search isTwist().
   ============================================================ */
function updateTwist(dt) {
  const t = twist();
  if (!t) return;
  const p = S.p;

  if (t === 'heat') {
    /* Burners. A vent lights, and for 1.1s it is only a warning ring — long
       enough to walk out of, short enough that standing still is a decision.
       Two of them at a time, never within 90px of you when they light, because
       a hazard that spawns under you is not a hazard, it is a tax. */
    S.twistT -= dt;
    if (S.twistT <= 0) {
      S.twistT = rnd(2.6, 4.0);
      for (let k = 0; k < 2; k++) {
        const q = freeSpot(120);
        if (Math.hypot(q.x - p.x, q.y - p.y) < 90) continue;
        S.pools.push({ x: q.x, y: q.y, r: 34, life: 4.6, max: 4.6, d: 22, fire: 1, hot: 1, warm: 1.1 });
      }
      A.burn();
    }

  } else if (t === 'frost') {
    /* The cold comes in waves, and the wave is announced. Four seconds of
       wind-up, then four seconds where you move at 55% — everything else in
       the room is slowed with you, so it is a change of tempo rather than a
       handicap. The freezer is the one floor where standing and shooting is
       correct. */
    S.twistT -= dt;
    if (S.twistOn > 0) {
      S.twistOn -= dt;
      if (Math.random() < dt * 30) part(rnd(0, S.aw), rnd(0, S.ah), '#dff4ff', 1, 8, 1.2);
      if (S.twistOn <= 0) msg('', 'it is letting go of you.', 1.6);
    } else if (S.twistT <= 0) {
      S.twistT = rnd(13, 18); S.twistOn = 4.0; S.twistN++;
      msg('THE COLD', 'everything slows down. including them.', 2.2);
      S.flash = Math.max(S.flash, 0.35); S.flashCol = '#bfefff';
      ring(p.x, p.y, 200, '#bfefff', 0.6, 3);
      A.hit(); shake(5);
      for (const e of S.en) { e.slowT = Math.max(e.slowT, 4.2); e.slowAmt = Math.max(e.slowAmt, 0.45); }
    } else if (S.twistT < 1.4 && Math.random() < dt * 26) {
      part(rnd(0, S.aw), rnd(0, S.ah), '#bfefff', 1, 20, 0.8);
    }

  } else if (t === 'blackout') {
    /* The lights go, and they tell you first: three seconds of the room dimming
       before it drops to nothing for two and a half. In the dark you keep the
       muzzle flash, the enemy bullets (which light their own way — see
       drawLight) and the crosshair, and that is the fight. It is the only twist
       that takes something away without giving you a way to counter it, which
       is why it is on a metronome you can count. */
    S.twistT -= dt;
    if (S.twistOn > 0) {
      S.twistOn -= dt;
      if (S.twistOn <= 0) { A.doorOpen(); msg('', 'the lights come back. count them.', 1.8); }
    } else if (S.twistT <= 0) {
      S.twistT = rnd(15, 21); S.twistOn = 2.5;
      msg('THE LIGHTS', '', 1.4); A.denied(); shake(4);
    }
  }
}

/* How dark it is right now, 0..1 on top of the room's own `dark`. */
function blackoutK() {
  if (!isTwist('blackout')) return 0;
  if (S.twistOn > 0) return 1;                          // out
  return clamp((3 - S.twistT) / 3, 0, 1) * 0.55;        // dimming, as a warning
}

/* One shared shove. DEFLECTION, SPRUNG, SLAM FIRE and the HARDWARE mastery
   are the same gesture bought in four different aisles. */
function knockRoom(x, y, r, force, col) {
  ring(x, y, r, col, 0.35, 2);
  part(x, y, col, 18, 160, 0.4);
  shake(6); A.ram();
  for (const e of S.en) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > r) continue;
    const a = Math.atan2(e.y - y, e.x - x), f = 1 - d / r;
    e.vx += Math.cos(a) * force * f; e.vy += Math.sin(a) * force * f;
    e.stun = Math.max(e.stun, 0.3 * f);
  }
}

/* HARD FROST / PERMAFROST / FLASH FLOOD all land here. */
function frostPulse(x, y, deep) {
  const st = ST();
  ring(x, y, 96, '#bfefff', 0.45, 2);
  part(x, y, '#dff4ff', 26, 150, 0.6, 2);
  A.hit(); shake(4);
  for (const e of S.en) {
    if (e.dead || Math.hypot(e.x - x, e.y - y) > 96) continue;
    if (e.boss) { e.slowT = Math.max(e.slowT, 2.4); e.slowAmt = Math.max(e.slowAmt, 0.5); }
    else { e.stun = Math.max(e.stun, 1.5); float(e.x, e.y - 10, 'FROZEN', '#bfefff'); }
    if (deep) damageEnemy(e, 55 * st.dmgMul, false, undefined, true);
  }
}

function hurtPlayer(dmg, sx, sy) {
  const p = S.p;
  if (S.god || p.iframe > 0 || p.tempShield > 0 || S.mode !== 'play') return;
  const stp = ST();
  /* THICK HIDE: the first thing to reach you each wave simply does not. */
  if (rd('callus') && !S.waveHit) {
    S.waveHit = true;
    p.iframe = 0.5;
    float(p.x, p.y - 14, 'THICK HIDE', '#7fd0ff');
    ring(p.x, p.y, 24, '#7fd0ff', 0.3, 2);
    A.hit();
    return;
  }
  S.waveHit = true;
  /* AEGIS PLATING: sometimes the hit just doesn't land. */
  if (stp.dodge > 0 && Math.random() < stp.dodge) {
    p.iframe = 0.3;
    float(p.x, p.y - 14, 'PLATED', '#7fd0ff');
    part(p.x, p.y, '#c6e8ff', 10, 90, 0.35);
    A.hit();
    if (rd('aegis')) knockRoom(p.x, p.y, 120, 300, '#7fd0ff');    // DEFLECTION
    return;
  }
  dmg *= stp.resist;
  // THE SALT LINE. No tell and no counter — the whole floor is the tell.
  if (isTwist('frail')) dmg *= 1.25;
  if (p.shield > 0) {
    p.shield--; p.shieldT = ST().shieldCd; p.iframe = 0.45;
    part(p.x, p.y, '#63b04a', 16, 130, 0.5);
    ring(p.x, p.y, 22, '#63b04a', 0.3, 2);
    float(p.x, p.y - 14, 'RIND', '#63b04a');
    A.hit(); shake(4);
    if (rd('apron')) knockRoom(p.x, p.y, 130, 330, '#63b04a');     // SPRUNG
    return;
  }
  const wasStage = hurtStage();
  p.hp -= dmg; p.iframe = 0.62; p.hurtFlash = 0.35;
  S.redness = Math.min(1, S.redness + 0.5);
  S.combo = 1; S.streak = 0;
  shake(8); punch(0.035); S.hitstop = Math.max(S.hitstop, 0.05);
  A.hurt();
  part(p.x, p.y, '#b01822', 14, 120, 0.45);
  blood(p.x, p.y + 5, 7);
  shred(p.x, p.y - 2, dmg, wasStage);
  /* crossing into a worse state is its own moment — that is the hit where a
     piece of him actually leaves, so it gets the weight of one */
  if (hurtStage() > wasStage) {
    shred(p.x, p.y - 4, dmg * 2.2, hurtStage());
    blood(p.x, p.y + 6, 12);
    shake(12); punch(0.05); S.hitstop = Math.max(S.hitstop, 0.09);
    A.crack();
  }
  if (sx !== undefined) { p.vx += (p.x - sx) * 1.8; p.vy += (p.y - sy) * 1.8; }
  /* SECOND HELPING: one refusal per floor, per rank. FULL PLATE makes the
     refusal total rather than a sliver. */
  if (p.hp <= 0 && S.savesLeft > 0) {
    S.savesLeft--;
    p.hp = Math.round(stp.maxhp * (rd('seconds') ? 1 : 0.30));
    p.iframe = 2.0;
    S.slow = 0.7; S.flash = 1.0; S.flashCol = '#c05cff';
    shake(16); punch(0.09);
    ring(p.x, p.y, 90, '#c05cff', 0.7, 3);
    float(p.x, p.y - 26, 'SECOND HELPING', '#c05cff', true);
    msg('NOT YET', S.savesLeft ? S.savesLeft + ' more refusals this floor.' : 'that was the last one.', 2.6);
    A.god(); A.bigpickup();
    return;
  }
  if (p.hp <= 0) {
    p.hp = 0; S.mode = 'dead'; S.deadT = 0;
    A.death(); A.setDread(1);
    if (A.music) A.music.stop(0.6);
    gib(p.x, p.y, '#c9926a', 30); blood(p.x, p.y, 22);
    persist();
  }
}

/* ============================================================
   PICKUPS
   ============================================================ */
function dropPickup(x, y, kind, key) {
  // THE EYE is the only drop the floor will hold onto forever now
  const perm = kind === 'god';
  S.drops.push({ x, y, kind, key, t: 0, life: perm ? 1e9 : 34, bob: rnd(0, TAU), vx: rnd(-40, 40), vy: rnd(-40, 40) });
}

function grantGod() {
  S.god = true; S.p.hp = ST().maxhp;
  A.god(); A.secret();
  S.flash = 1.4; S.flashCol = '#ffffff';
  shake(16); punch(0.1);
  S.banner = { key: 'god', lv: 1, t: 6 };
  msg('THE THIRD EYE OF DAMJAN', 'it sees the code. you cannot die.', 5);
}

function giveWeapon(id) {
  const p = S.p;
  if (p.owned.indexOf(id) >= 0) return;
  p.owned.push(id);
  p.owned.sort((a, b) => WORDER.indexOf(a) - WORDER.indexOf(b));
  p.mags[id] = magCap(WEP[id]);
  p.wi = p.owned.indexOf(id);
  p.reT = 0; p.spin = 0; p.charge = 0;
  S.banner = { wep: id, t: 4.2 };
  A.buy(); A.bigpickup();
  S.flash = 0.45; S.flashCol = WEP[id].col;
  shake(7); punch(0.05);
}

/* ============================================================
   WAVES
   ============================================================ */
function startWave(n) {
  S.wave = n;
  S.waveState = 'fight';
  S.queue = [];
  S.spawnT = 0.5;
  if (n === BOSS_WAVE) {
    /* The last wave of the last floor is THE MEAT PROTOCOL, and it arrives
       alone. Every other boss wave queues a floor's worth of filler on top;
       this one does not, because the finale's own three phases are the content
       and a crowd underneath them would only make the beams unreadable. */
    const last = isLastFloor(S.room);
    const apex = !last && isApexFloor(S.room);
    spawnBoss(last ? -1 : bossIndexFor(S.room), apex);
    if (!last) {
      const filler = S.room >= 1 ? ['crawler', 'crawler', 'shrieker', 'husk'] : ['crawler', 'crawler', 'shrieker'];
      for (let i = 0; i < Math.round((6 + n * 1.5) * (1 + S.room * 0.5)); i++) S.queue.push(pick(filler));
    }
    msg('WAVE ' + n, last ? 'THE LAST ONE' : apex ? 'APEX' : 'FLOOR BOSS', 2.4);
  } else if (miniWaves().indexOf(n) >= 0) {
    const mw = miniWaves();
    spawnMini(S.room * mw.length + mw.indexOf(n));
    const filler = S.room >= 1 ? ['crawler', 'crawler', 'shrieker', 'stalker', 'husk'] : ['crawler', 'crawler', 'shrieker', 'stalker'];
    /* Elite waves stay lighter on filler than fight waves — the elite IS the
       content — but they now scale with the floor instead of crawling up by
       three a time, or by floor ten they are a boss standing in an empty room. */
    for (let i = 0; i < Math.round((8 + n * 3) * (1 + S.room * 0.45)); i++) S.queue.push(pick(filler));
    msg('WAVE ' + n, 'ELITE', 2.4);
  } else {
    // Head count, not a spend budget — a budget buys fewer/tougher enemies as it
    // grows, which is backwards. This grows quadratically across a floor and is
    // multiplied again for every floor down and every evolution.
    // Every gun you own is another mouth the floor sends to meet it.
    const armed = 1 + Math.max(0, S.p.owned.length - 1) * 0.10;
    const levelled = 1 + Math.max(0, S.level - 1) * 0.06;   // the stronger you get, the more come
    // gentler inside a floor, much steeper between them
    // THE RENDERING sends half again as many and takes 30% off each of them —
    // the same total meat arriving in more pieces, which is a different fight
    // rather than a harder one. See spawnEnemy for the health side of it.
    /* Rewritten for five waves. The old curve ran (7 + 2.6n + 0.26n^2) over
       ten waves; this one has to deliver a comparable floor across two normal
       waves instead of seven, so the constant is bigger and it climbs harder.
       Tuned against the measured old per-floor total rather than by eye. */
    const count = Math.round((28 + n * 12 + n * n * 1.6) * (1 + S.room * 0.72)
                             * (1 + (S.evo | 0) * 0.15) * armed * levelled * ST().swarm
                             * (isTwist('swarm') ? 1.5 : 1));
    /* Weights shift toward the nastier things as the wave and floor climb, and
       every wave GATE is halved — `n >= 6` could never fire again with a floor
       only five waves long, which would have meant no bloaters at all on floor
       one. The n-coefficients are doubled for the same reason the rest are. */
    const pool = [['crawler', 10]];
    if (n >= 1 || S.room > 0) pool.push(['shrieker', 3 + n * 0.8 + S.room]);
    if (n >= 2 || S.room > 0) pool.push(['stalker', 2 + n * 0.9 + S.room]);
    if (n >= 3 || S.room > 0) pool.push(['bloater', 1 + n * 0.7 + S.room * 1.5]);
    // the two teachers arrive once the basics are learned
    if (n >= 3 || S.room >= 1) pool.push(['husk', 1 + n * 0.6 + S.room]);
    if (n >= 4 || S.room >= 2) pool.push(['cyst', 0.5 + n * 0.3 + S.room * 0.5]);
    /* THE DEEP ROSTER. Gated on FLOOR only, never on wave, so each one is a
       thing the floor introduces rather than a thing that turns up late in
       every fight — you meet it, it is new, and it is new for a whole floor.
       Weights stay low: these are the ones you plan around, and three of them
       in a crowd is a puzzle, ten is a wall. */
    for (const k of ['trolley', 'spitter', 'shepherd']) {
      const f = ETYPE[k].floor;
      if (S.room >= f) pool.push([k, 0.8 + (S.room - f) * 0.55 + n * 0.24]);
    }
    let total = 0;
    for (const c of pool) total += c[1];
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total;
      for (const c of pool) { r -= c[1]; if (r <= 0) { S.queue.push(c[0]); break; } }
    }
    msg('WAVE ' + n, '', 1.8);
  }
  A.wave();
  A.setDread(clamp(n / WAVES * 0.6 + S.room * 0.2, 0, 1));
  // The score climbs across the floor and jumps a step for each floor down.
  if (A.music) A.music.setIntensity(clamp(0.12 + (n / WAVES) * 0.72 + S.room * 0.16, 0, 1));
}

/* How many enemies may be breathing at once.

   This used to be computed inline in updateWaves() and nowhere else, which is
   exactly why the elite summon could ignore it — there was nothing to ignore,
   the number did not exist outside that one function. One definition now, read
   by the wave spawner and by the elite branch, so the two cannot drift. */
function concurrencyCap() {
  return Math.min(95, Math.round(18 + S.wave * 2.6 + S.room * 9.5 + (S.evo | 0) * 2 +
                                 Math.max(0, S.p.owned.length - 1) * 1.5 +
                                 Math.max(0, S.level - 1) * 0.8));
}
/* Everything on its way in as well as everything already breathing. Cracks
   take 0.75s to hatch, so counting only the living is how deep floors used to
   put five batches in the air before the cap noticed — see Bugs Found #13. */
function liveLoad() { return S.en.length + S.cracks.length; }

function updateWaves(dt) {
  if (S.waveState === 'fight') {
    S.spawnT -= dt;
    const cap = concurrencyCap();
    S.capNow = cap;                 // read-only, for PROBE — the gate below is unchanged
    /* Cracks take 0.75s to hatch but batches fire every 0.15s, so counting only
       what is already breathing lets a deep floor put five batches in the air
       before the cap notices — floor 14 was landing 159 against a cap of 78.
       Count what is on its way as well. */
    if (S.spawnT <= 0 && S.queue.length && S.en.length + S.cracks.length < cap) {
      S.spawnT = Math.max(0.15, 0.85 - S.wave * 0.10 - S.room * 0.09);
      const batch = 1 + Math.floor(S.wave / 2) + S.room + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < batch && S.queue.length; i++) {
        const t = S.queue.shift();
        const p = freeSpot(140);
        S.cracks.push({ x: p.x, y: p.y, t: 0.75, type: t });
      }
    }
    if (!S.queue.length && !S.en.length && !S.cracks.length) {
      S.waveState = 'clear'; S.waveT = 3.0;
      S.vacuum = 2.6;                 // sweep the floor clean
      A.pickup();
      /* MARROW and the PRODUCE mastery both pay out here, and BONE BROTH adds
         a frag to it. waveKills/waveHit reset on the same beat so THE LONG PIG
         and THICK HIDE start the next wave clean — unless NO LEFTOVERS says
         otherwise. */
      const st2 = ST();
      let heal = S.wave === BOSS_WAVE ? 30 : 24;   // half as many gaps, twice as much in each
      heal += st2.marrow * st2.maxhp;
      if (aisleT2('produce')) heal += st2.maxhp * 0.25;
      heal = Math.round(heal);
      S.p.hp = Math.min(st2.maxhp, S.p.hp + heal);
      S.p.nades = Math.min(9, S.p.nades + 1 + dkc('munitions') + (rd('marrow') ? 1 : 0));
      if (!rd('longpig')) S.waveKills = 0;
      S.waveHit = false;
      S.score += 100 * S.wave * (S.room + 1);
      persist();
      // PACI keeps to the fives now — see SHOP_WAVES.
      if (shopDueAfter(S.wave)) S.shopDue = true;
      if (S.wave >= WAVES && isLastFloor(S.room)) {
        // there is no eleventh floor and therefore no door. see the win path.
      } else if (S.wave >= WAVES) {
        S.door.open = true;
        msg('THE DOOR IS OPEN', 'go north. it is worse down there.', 4);
        A.doorOpen();
      } else {
        msg('WAVE ' + S.wave + ' CLEARED', '+' + (100 * S.wave * (S.room + 1)) + ' // +' + heal + ' hp // +1 frag', 2.2);
      }
      if (S.shopDue) {
        const q = freeSpot(60);
        float(q.x, q.y, 'A DOOR OPENS SIDEWAYS', '#c05cff', true);
      }
      /* One parting gift, and it is usually ammo. Two guaranteed drops with a
         coin-flip on health meant a med kit every other wave for free. */
      { const q = freeSpot(40); dropPickup(q.x, q.y, Math.random() < 0.78 ? 'ammo' : 'med'); }
    }
  } else if (S.waveState === 'clear') {
    S.waveT -= dt;
    // waveT stays negative until something else changes state, so anything
    // already mid-transition has to hold this branch off or it fires again
    // on the very next frame.
    if (S.waveT <= 0 && !S.fadeDir && !S.pending) {
      // a shop owed by the wave you just cleared comes before anything else
      if (S.shopDue) { S.shopDue = false; enterShop(); }
      else if (S.wave < WAVES) startWave(S.wave + 1);
    }
  }

  for (let i = S.cracks.length - 1; i >= 0; i--) {
    const c = S.cracks[i];
    c.t -= dt;
    if (c.t <= 0) {
      const ne = spawnEnemy(c.type, c.x, c.y);
      if (c.sum) { ne.sum = 1; ne.born = c.born === undefined ? S.t : c.born; }
      part(c.x, c.y, '#c0202a', 14, 70, 0.5);
      S.cracks.splice(i, 1);
      if (Math.random() < 0.4) A.screech(true);
    }
  }
}

/* ============================================================
   UPDATE
   ============================================================ */
function update(rdt) {
  S.t += rdt;
  let dt = rdt;
  if (S.hitstop > 0) { S.hitstop -= rdt; dt *= 0.08; }
  else if (S.slow > 0) { S.slow -= rdt; dt *= 0.35; }

  if (S.msgT > 0) S.msgT -= rdt;
  if (S.banner) { S.banner.t -= rdt; if (S.banner.t <= 0) S.banner = null; }
  S.flash = Math.max(0, S.flash - rdt * 2.4);
  S.redness = Math.max(0, S.redness - rdt * 0.7);
  S.modT = Math.max(0, S.modT - rdt);
  S.goroT = Math.max(0, S.goroT - rdt);
  S.glusec = Math.max(0, S.glusec - rdt);
  S.jump = Math.max(0, S.jump - rdt);
  if (S.comboT > 0) { S.comboT -= rdt; if (S.comboT <= 0) { S.combo = 1; S.streak = 0; } }

  /* An angry PACI does not attack. He stands there and the building reacts:
     the floor will not stop moving and the light goes the colour of the
     inside of him. It gets worse the longer you stand in it. */
  if (S.paci && S.paci.anger > 0) {
    S.paci.angerT += rdt;
    const a = S.paci.anger;
    shake(a > 1 ? 26 : 7 + Math.min(6, S.paci.angerT * 1.4) + Math.sin(S.t * 31) * 3);
    S.redness = Math.min(1, S.redness + rdt * (a > 1 ? 4.2 : 1.9));
    if (Math.random() < rdt * (a > 1 ? 50 : 16))
      part(rnd(0, S.aw), rnd(0, S.ah), '#8c141d', 1, 30, 0.7);
    if (a > 1 && S.pendingKick > 0) {
      S.pendingKick -= rdt;
      if (S.pendingKick <= 0) { S.pendingKick = 0; exitShop(); }
    }
  }

  if (S.fadeDir) {
    S.fade += S.fadeDir * rdt * 1.6;
    if (S.fade >= 1 && S.fadeDir > 0) { S.fade = 1; S.fadeDir = -1; if (S.pending) { S.pending(); S.pending = null; } }
    if (S.fade <= 0 && S.fadeDir < 0) { S.fade = 0; S.fadeDir = 0; }
  }

  if (S.mode === 'dead') { S.deadT += rdt; updateParticles(dt); updateCam(rdt); return; }
  // the win screen keeps the wreckage moving behind it, same as the death one
  if (S.mode === 'win') { updateParticles(dt); updateCam(rdt); return; }
  /* EVERY non-play screen ticks the effects too, not just these two.

     `updateParticles()` does two jobs — it expires things, and it holds all
     three pool ceilings — and it used to be called from the 'dead' and 'win'
     branches above and nowhere else. So on pause, THE DECK, a level-up hand,
     the evolution pick, augments and PACI's shop, nothing expired and no cap
     ran.

     That would be harmless if the pools were only fed from the simulation.
     They are not: EIGHT particle spawners live in the DRAW path, which runs
     under every one of those screens — drawPlayer's shield aura and charge and
     burn, drawTomce, the brazier, the corner sigil, the pipes, the carcass.
     Between them they push about 40 a second into a pool that had stopped
     draining, so a level-up hand grew it without bound: measured at 1957 live
     against a ceiling of 900, and still climbing when the reading was taken.

     Ticking them here is the same call the death screen already makes, and it
     is presentation, not simulation — the fight below is still frozen. See
     Bugs Found #23. */
  if (S.mode !== 'play') { updateParticles(dt); updateCam(rdt); return; }

  /* THE RUN CLOCK, and it lives BELOW the mode guard on purpose.

     `update()` is called every frame in every mode — the guard three lines up
     is what makes the rest of this function play-only. Counting the clock
     above it (where it started) meant the run timer kept ticking through the
     pause screen, THE DECK and every level-up hand: measured at 15.06s after
     10s of play and 5s of sitting on a menu. Here it measures time you
     actually spent in the building, which is the only version of a run timer
     worth reading. Same reasoning as S.introT; see Bugs Found #14.

     It also stops on the winning hit rather than when the win screen appears,
     because the 3.4s the finale takes to fall over is not time you spent
     clearing the game. */
  if (!S.won) S.runT += rdt;

  const p = S.p, st = ST(), w = curW();

  /* The floor's opening beat. Ticks only here, so it is paused by every menu
     rather than lost to one — see startRun() for the bug this replaced. */
  // held rather than spent while a room fade is in flight, so a wave can never
  // land in the half-built room the fade is hiding
  if (S.introT > 0 && !S.fadeDir) {
    S.introT -= rdt;
    if (S.introT <= 0 && S.wave === 0) startWave(1);
  }
  /* The ending. A few seconds of standing in the wreckage before the screen
     comes up, because cutting straight from the last hit to a stats page is
     how you make a finale feel like a menu transition. */
  if (S.won) {
    S.winT -= rdt;
    if (S.winT <= 0) {
      persist();
      bumpMax('deep', FLOORS);
      S.mode = 'win'; S.deadT = 0;
      if (A.music) A.music.stop(0.8);
    }
  }

  if (S.introMsgT > 0) {
    S.introMsgT -= rdt;
    if (S.introMsgT <= 0) {
      /* The floor's rule, announced on the way in. A twist you have to work out
         from the damage numbers is a bug as far as the player is concerned. */
      const R2 = roomDef(S.room);
      if (R2.tw) { msg(R2.tw, '', 3.2); A.denied(); }
      else msg('', 'something breathes inside the north wall.', 4);
    }
  }

  /* The hand is dealt from here rather than from gainXP, so a boss can add its
     guaranteed pick and its luck bonus before the cards are turned over. The
     cold room jumps the queue when a floor boss has just opened it — the
     signature is the bigger moment and it should not arrive third. */
  /* `!S.won` is load-bearing. The finale's own kill still runs gainXP, which
     can push you over a level on the very hit that ends the game — and a
     level-up screen opening during the victory beat both buries the ending
     and stalls it, because the win countdown below only ticks in play. There
     is nothing to spend a card on after the last boss anyway. */
  if (!S.won && S.upgPts > 0) {
    S.lvlDelay -= rdt;
    if (S.lvlDelay <= 0 && !S.fadeDir) { openLevelUp(S.pendingLuck); S.pendingLuck = 0; }
  }

  /* ---- the deck's per-frame verbs ----
     MOMENTUM wants to know how long you have been moving, WOUND UP how long
     the trigger has been down. Both decay faster than they build so neither
     is free. */
  S.moveT = (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD ||
             keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight)
            ? S.moveT + rdt : Math.max(0, S.moveT - rdt * 3);
  S.holdT = mouse.down ? S.holdT + rdt : Math.max(0, S.holdT - rdt * 4);
  if (st.bleed && p.hp > 1) p.hp = Math.max(1, p.hp - st.bleed * rdt);   // BLOOD DEBT
  for (let i = S.arcs.length - 1; i >= 0; i--) { S.arcs[i].life -= rdt; if (S.arcs[i].life <= 0) S.arcs.splice(i, 1); }

  /* THE WALK-IN's rider turns the slow field into a damage field. Ticked on a
     0.25s cadence rather than per-frame so the number on the card is honest. */
  if (st.auraDmg > 0) {
    S.auraT = (S.auraT || 0) + rdt;
    if (S.auraT >= 0.25) {
      S.auraT -= 0.25;
      for (const e of S.en)
        if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 66) damageEnemy(e, st.auraDmg * 0.25, false, undefined, true);
    }
  }

  /* HARD FROST: a pulse on a timer, which is the only card that does anything
     while you stand still. FLASH FLOOD makes every nova do it too. */
  if (st.frostEvery > 0) {
    S.frostT += rdt;
    if (S.frostT >= st.frostEvery) { S.frostT = 0; frostPulse(p.x, p.y, rd('frost')); }
  }

  updateTwist(rdt);              // the floor's own weather, before the pools it makes
  updateHaz(rdt);
  updateOrbs(rdt, st);
  updatePools(rdt, st);

  /* REGROWTH ticks once a second so the number on the card is the number you get. */
  if (st.regen > 0 && p.hp > 0) {
    S.regenT += rdt;
    if (S.regenT >= 1) { S.regenT -= 1; p.hp = Math.min(st.maxhp, p.hp + st.regen); }
  }

  S.whisperT -= rdt;
  if (S.whisperT <= 0) { S.whisperT = rnd(7, 18); A.whisper(); }
  if (p.hp / st.maxhp < 0.34 && !S.god) {
    S.beatT -= rdt;
    if (S.beatT <= 0) { S.beatT = 0.55 + (p.hp / st.maxhp) * 0.8; A.heartbeat(); }
  }
  // something close enough to hear
  S.breathT -= rdt;
  if (S.breathT <= 0) {
    S.breathT = 0.9;
    let near = 1e9;
    for (const e of S.en) near = Math.min(near, Math.hypot(e.x - p.x, e.y - p.y));
    if (near < 58) { A.breath(); S.redness = Math.min(0.3, S.redness + 0.06); }
  }

  /* ---- movement ---- */
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  const il = Math.hypot(ix, iy) || 1; ix /= il; iy /= il;

  p.dashCd = Math.max(0, p.dashCd - dt);
  p.nadeCd = Math.max(0, p.nadeCd - dt);
  if ((keys.ShiftLeft || keys.ShiftRight || keys.Space) && p.dashCd <= 0 && (ix || iy)) {
    p.dash = 0.16; p.dashCd = st.dashCd; p.iframe = Math.max(p.iframe, 0.24);
    p.ramHit.length = 0;
    if (p.windHit) p.windHit.length = 0; else p.windHit = [];
    part(p.x, p.y, '#ffffff', 14, 100, 0.3);
    ring(p.x, p.y, 20, 'rgba(255,255,255,0.6)', 0.22, 1);
    punch(0.02);
    if (st.ram) A.ram(); else A.burn();
  }
  if (p.dash > 0) p.dash -= dt;

  /* SECOND WIND — the dash drags a cold wake through the room. Its rider
     turns passing through something into an actual attack, which is what
     makes a dash-build want to go through the crowd rather than around it. */
  if (dkr('wind') && p.dash > 0) {
    if (Math.random() < dt * 40) part(p.x, p.y, '#9fe4ff', 1, 30, 0.5);
    if (!p.windHit) p.windHit = [];
    for (const e of S.en) {
      if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r + 9) continue;
      e.slowT = Math.max(e.slowT, 1.6); e.slowAmt = Math.max(e.slowAmt, 0.45);
      if (!rd('wind') || p.windHit.indexOf(e) >= 0) continue;
      p.windHit.push(e);
      damageEnemy(e, 45 * st.dmgMul, false, Math.atan2(p.vy, p.vx));
      float(e.x, e.y - 12, 'THROUGH', '#9fe4ff');
    }
  }

  /* STOLEN BICYCLE — the dash becomes a battering ram */
  if (st.ram && p.dash > 0) {
    const a = Math.atan2(p.vy, p.vx);
    for (const e of S.en) {
      if (e.dead || p.ramHit.indexOf(e) >= 0) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r + 6) continue;
      p.ramHit.push(e);
      e.vx += Math.cos(a) * 330; e.vy += Math.sin(a) * 330;
      e.stun = Math.max(e.stun, 0.4);
      damageEnemy(e, st.ram * st.dmgMul, false, a);
      float(e.x, e.y - 12, 'RAM', '#c9232c');
      shake(5); S.hitstop = Math.max(S.hitstop, 0.05);
      A.ram();
    }
    if (st.ramFire && Math.random() < dt * 60)
      part(p.x + rnd(-4, 4), p.y + rnd(-2, 6), pick(['#ff8a20', '#ffd05a', '#ff3b1e']), 1, 26, 0.5);
  }

  /* GLOCK-18 — a second (and third) gun that picks its own targets */
  if (st.glocks) {
    p.glockT -= dt;
    if (p.glockT <= 0) {
      let best = null, bd = 210;
      for (const e of S.en) {
        if (e.dead) continue;
        const d2 = Math.hypot(e.x - p.x, e.y - p.y);
        if (d2 < bd) { bd = d2; best = e; }
      }
      if (best) {
        p.glockT = st.glockRate;
        p.glockSide *= -1;
        const side = st.glocks > 1 ? p.glockSide : 1;
        const ga = Math.atan2(best.y - p.y, best.x - p.x) + rnd(-0.07, 0.07);
        const ox = p.x + Math.cos(ga + side * 1.2) * 7, oy = p.y + Math.sin(ga + side * 1.2) * 7;
        S.bul.push({
          x: ox, y: oy, vx: Math.cos(ga) * 470, vy: Math.sin(ga) * 470,
          dmg: 16 * st.dmgMul, pierce: st.pierce, hitIds: [], life: 1.0,
          col: '#ffe9a8', size: 1, knock: 40, pin: 0, burn: 0, bounce: 0, god: S.god
        });
        part(ox, oy, '#ffd07a', 2, 70, 0.12);
        A.glock();
      } else p.glockT = 0.2;
    }
  }

  const slowMul = w.spin ? 1 - w.slow * p.spin : 1;
  // THE FREEZER's cold snap slows the room, you included. See updateTwist.
  const cold = (isTwist('frost') && S.twistOn > 0) ? 0.55 : 1;
  const spd = st.speed * slowMul * cold * (p.dash > 0 ? 3.4 : 1);
  /* THE MEAT LOOP is greased. `grip` is the per-frame share of the gap between
     where you are going and where you asked to go — 0.0009 is "instant", and
     0.30 is a floor that keeps your momentum for you whether or not you wanted
     it kept. It does not slow you down; it makes stopping a thing you have to
     plan, which turns every corridor into a commitment. The dash is unaffected
     on purpose: it is the one move that still does exactly what you told it.

     Eased 0.30 -> 0.12. At 0.30 the floor was not asking you to plan, it was
     refusing to take the input at all — roughly a fifth of the correction per
     frame that instant control gives you, which on the floor that also steps
     the difficulty up read as the game taking the controller off you. At 0.12
     you still slide and stopping is still something you commit to, but a
     correction lands in about half the distance. */
  const grip = (isTwist('slick') && p.dash <= 0) ? 0.12 : 0.0009;
  p.vx = lerp(p.vx, ix * spd, 1 - Math.pow(grip, dt));
  p.vy = lerp(p.vy, iy * spd, 1 - Math.pow(grip, dt));
  p.x += p.vx * dt; p.y += p.vy * dt;
  collideWalls(p);
  p.x = clamp(p.x, 8, S.aw - 8); p.y = clamp(p.y, 8, S.ah - 8);

  // walk cycle + footsteps
  if (ix || iy) {
    const prev = Math.floor(p.walkT) % 4;
    p.walkT += dt * (p.dash > 0 ? 22 : 9.5);
    const cur = Math.floor(p.walkT) % 4;
    if (cur !== prev && (cur === 1 || cur === 3)) {
      A.step();
      part(p.x + rnd(-3, 3), p.y + 9, 'rgba(180,160,140,0.5)', 3, 26, 0.35);
    }
  } else p.walkT = 0;

  // aim
  const sw = screenToWorld(mouse.x, mouse.y);
  mouse.wx = sw.x; mouse.wy = sw.y;
  p.ang = Math.atan2(mouse.wy - (p.y - 2), mouse.wx - p.x);
  p.flip = Math.cos(p.ang) < 0;
  p.recoil = Math.max(0, p.recoil - dt * 2.6);
  p.kick = Math.max(0, p.kick - dt * 26);
  p.iframe = Math.max(0, p.iframe - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.tempShield = Math.max(0, p.tempShield - dt);
  p.frenzyT = Math.max(0, p.frenzyT - dt);
  p.siphonT = Math.max(0, p.siphonT - dt);
  S.vacuum = Math.max(0, S.vacuum - dt);

  if (st.shieldMax > 0 && p.shield < st.shieldMax) {
    p.shieldT -= dt;
    if (p.shieldT <= 0) { p.shield++; p.shieldT = st.shieldCd; part(p.x, p.y, '#63b04a', 10, 70, 0.4); }
  }

  /* ---- reload animation state machine ---- */
  if (p.reT > 0) {
    p.reT -= dt;
    const prog = 1 - p.reT / p.reMax;
    if (p.reStage === 0 && prog > 0.14) {
      p.reStage = 1; A.magOut(); A.magDrop();
      const a = p.ang + Math.PI / 2;
      S.props.push({ spr: SPR.mag, x: p.x + Math.cos(p.ang) * 8, y: p.y + Math.sin(p.ang) * 8, z: 5,
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, vz: 40, rot: 0, vr: rnd(-9, 9), life: 2.2 });
    }
    if (p.reStage === 1 && prog > 0.62) { p.reStage = 2; A.magIn(); }
    if (p.reStage === 2 && prog > 0.90) {
      p.reStage = 3; A.rack();
      part(p.x + Math.cos(p.ang) * 12, p.y + Math.sin(p.ang) * 12, '#ffe9a8', 5, 60, 0.2);
    }
    if (p.reT <= 0) {
      p.mags[w.id] = magCap(w); p.reT = 0;
      // SLAM FIRE, and the HARDWARE mastery, both cash out the moment it seats
      if (rd('quick') || aisleT2('hardware')) knockRoom(p.x, p.y, 116, 300, '#f5c518');
    }
  }

  /* ---- firing ---- */
  p.fireT -= dt;
  if (keys.KeyR) startReload();

  if (w.spin) {
    const want = (mouse.down && p.reT <= 0 && (p.mags.hog > 0 || S.god)) ? 1 : 0;
    const was = p.spin;
    p.spin = clamp(p.spin + (want ? dt / 0.75 : -dt / 0.5), 0, 1);
    if (want && p.spin < 1 && Math.random() < dt * 18) A.spinup(p.spin);
    if (was < 1 && p.spin >= 1) shake(2);
  } else p.spin = 0;

  if (w.charge) {
    if (mouse.down && p.reT <= 0 && (p.mags.rail > 0 || S.god)) {
      const before = p.charge;
      p.charge += dt;
      if (before < w.charge && p.charge >= w.charge) A.railcharge();
      if (p.charge >= w.charge && p.fireT <= 0) { p.charge = 0; emit(w); }
    } else p.charge = Math.max(0, p.charge - dt * 2);
  } else p.charge = 0;

  if (w.beam) updateBeam(dt);
  else {
    S.beamHit = null;                    // never leave a beam painted after a swap
    if (mouse.down && p.fireT <= 0 && !w.charge) {
      if (p.mags[w.id] <= 0 && !S.god) { A.dryfire(); startReload(); p.fireT = 0.25; }
      else if (p.reT <= 0) { if (!w.spin || p.spin > 0.55) emit(w); }
    }
  }
  if (p.mags[w.id] <= 0 && !S.god && p.reT <= 0 && !w.beam) startReload();
  if (w.beam && p.mags.omega <= 0 && !S.god && p.reT <= 0) startReload();

  /* ---- bullets ---- */
  for (let i = S.bul.length - 1; i >= 0; i--) {
    const b = S.bul[i];
    // Seeking rounds steer toward the nearest thing they haven't already hit.
    if (b.home) {
      /* LOCK: the round picks one and keeps it, instead of re-deciding every
         frame and drifting between two things that are equally close. */
      let best = null, bd = 260;
      if (b.lock && !b.lock.dead && b.hitIds.indexOf(b.lock) < 0) best = b.lock;
      else {
        for (const e of S.en) {
          if (e.dead || b.hitIds.indexOf(e) >= 0) continue;
          const d2 = Math.hypot(e.x - b.x, e.y - b.y);
          if (d2 < bd) { bd = d2; best = e; }
        }
        if (b.lock !== undefined) b.lock = best;
      }
      if (best) {
        const want = Math.atan2(best.y - b.y, best.x - b.x);
        let cur = Math.atan2(b.vy, b.vx);
        let diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
        cur += clamp(diff, -b.home * dt, b.home * dt);
        b.vx = Math.cos(cur) * b.spd; b.vy = Math.sin(cur) * b.spd;
      }
      if (Math.random() < dt * 40) part(b.x, b.y, b.col, 1, 18, 0.3);
    }
    /* BLACK FRIDAY drags on the way past. Strongest at the rim of nothing and
       falling off toward the round itself, so a crowd collapses into a ball
       rather than orbiting a point it can never reach. */
    if (b.sing) {
      /* It coasts to a halt and goes off where it stopped.
         Fired at a constant speed it would drag a crowd together on the way
         past and then detonate on the far wall, well clear of the crowd it had
         just built — all of the setup and none of the payoff. Decelerating
         means the round stalls in the middle of what it gathered, which is the
         entire trick of the gun. The stall then buys a last 0.42s of pull
         before it lands. */
      const k = Math.pow(0.22, dt);
      b.vx *= k; b.vy *= k;
      if (!b.stalled && Math.hypot(b.vx, b.vy) < 34) {
        b.stalled = 1;
        b.life = Math.min(b.life, 0.42);
      }
      for (const e of S.en) {
        if (e.dead) continue;
        const dx = b.x - e.x, dy = b.y - e.y, d = Math.hypot(dx, dy);
        if (d > b.sing.r || d < 2) continue;
        const f = b.sing.pull * (1 - d / b.sing.r) * dt * (e.boss ? 0.22 : 1);
        e.vx += dx / d * f; e.vy += dy / d * f;
      }
      if (Math.random() < dt * 70) {
        const a2 = Math.random() * TAU, rr = b.sing.r * rnd(0.4, 1);
        part(b.x + Math.cos(a2) * rr, b.y + Math.sin(a2) * rr, b.col, 1, 12, 0.3);
      }
    }
    /* THE DELI SLICER's disc, out and back. */
    if (b.blade) {
      b.wheel += dt * 26;                            // the spin, for the draw
      if (!b.back) {
        b.travel += b.spd * dt;
        if (b.travel >= b.blade.reach) bladeTurn(b);
      } else {
        /* Home on Damjan, not on the point he threw from. The gun is only
           worth its rung if the second pass follows you — which is also the
           only thing that makes standing still a mistake with it. */
        const a = Math.atan2(S.p.y - b.y, S.p.x - b.x);
        b.rsp = Math.min(b.blade.ret, (b.rsp || 0) + b.blade.acc * dt);
        b.vx = Math.cos(a) * b.rsp; b.vy = Math.sin(a) * b.rsp;
        if (Math.hypot(S.p.x - b.x, S.p.y - b.y) < 11) {   // caught
          part(b.x, b.y, b.col, 5, 65, 0.2);
          A.sliceHome();
          S.bul.splice(i, 1);
          continue;
        }
      }
      if (Math.random() < dt * 26) part(b.x, b.y, b.col, 1, 20, 0.24);
    }
    let removed = false;
    for (let sub = 0; sub < 2; sub++) {
      const px = b.x, py = b.y;
      b.x += b.vx * dt / 2; b.y += b.vy * dt / 2;
      const wl = pointInWall(b.x, b.y);
      if (wl) {
        if (S.secret && !S.secret.broken && wl === S.walls[0] &&
            b.x > S.secret.x - 3 && b.x < S.secret.x + S.secret.w + 3 && b.y < 40) {
          S.secret.hits++;
          A.crack(); shake(4); punch(0.012);
          part(b.x, b.y, '#c9b9a0', 12, 100, 0.5);
          float(b.x, b.y - 6, S.secret.hits >= S.secret.need - 3 ? 'it moved.' : '*crack*', '#d8c8b0');
          if (S.secret.hits >= S.secret.need) breakSecret();
          S.bul.splice(i, 1); removed = true; break;
        }
        // GOROMANIA: nobody shoots a door that is already shut.
        if (!S.goro && !S.door.open && wl === S.walls[0] &&
            b.x > S.door.x && b.x < S.door.x + S.door.w && b.y < 40) {
          S.goroHits++;
          part(b.x, b.y, '#8a6a4a', 6, 80, 0.3);
          if (S.goroHits % 10 === 0 && S.goroHits < 30) float(b.x, b.y - 8, 'it is listening', '#b028ff');
          if (S.goroHits >= 30) triggerGoromania();
          S.bul.splice(i, 1); removed = true; break;
        }
        /* A disc does not stop on a crate — it turns round early, which is the
           gun telling you the shot was too long. Coming HOME it ignores walls
           entirely: the alternative is a blade that dies behind a shelf you
           walked around, and losing half the shot to the level geometry is not
           a decision, it is a tax. */
        if (b.blade) {
          if (!b.back) {
            b.x = px; b.y = py;
            bladeTurn(b);
            sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx), '#e8f0ff', 4, 130, 0.2, 0.8);
            A.nadeBounce();
          }
          continue;
        }
        if (b.bounce > 0) {                       // microwave orbs ricochet
          b.bounce--;
          b.bounced = (b.bounced | 0) + 1;        // ANGLE OF ATTACK prices each one
          b.x = px; b.y = py;
          if (pointInWall(b.x + b.vx * dt, b.y)) b.vx *= -1; else b.vy *= -1;
          part(b.x, b.y, b.col, 6, 80, 0.3);
          A.nadeBounce();
          continue;
        }
        if (b.sing) singularityPop(b);      // it lands on the wall it reached
        else {
          // a round into a crate throws chips back at you, not a grey puff
          const back = Math.atan2(-b.vy, -b.vx);
          sparks(b.x, b.y, back, '#e8dcc0', 5, 150, 0.24, 0.75);
          sparks(b.x, b.y, back, b.col, 2, 90, 0.16, 0.9);
          S.part.push({ x: b.x, y: b.y, vx: 0, vy: 0, col: '#fff6e0', life: 0.05, max: 0.08, s: 2, glow: 1 });
        }
        S.bul.splice(i, 1); removed = true; break;
      }
      /* PACI is not an enemy and has no health bar. He is a very large man
         standing in his own shop, and rounds do land on him. */
      if (S.paci && S.paci.anger < 2 &&
          Math.abs(b.x - S.paci.x) < 34 && b.y > S.paci.y - 46 && b.y < S.paci.y + 48) {
        angerPaci(b.x, b.y);
        S.bul.splice(i, 1); removed = true; break;
      }
      // a singularity passes through everything; it pays out where it stops
      for (const e of b.ghost ? [] : S.en) {
        if (e.dead || b.hitIds.indexOf(e) >= 0) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 3.5 + b.size) {
          const a = Math.atan2(b.vy, b.vx);
          if (b.knock) { e.vx += Math.cos(a) * b.knock; e.vy += Math.sin(a) * b.knock; }
          if (b.pin) e.stun = Math.max(e.stun, b.pin);
          if (b.burn) { e.burn = Math.max(e.burn, b.burn); e.burnT = Math.max(e.burnT, 2.6); }
          if (b.mark && e.mark <= 0) { e.mark = b.mark; float(e.x, e.y - 12, 'ON SALE', '#ff4ab0'); }
          if (b.chill) { e.slowT = Math.max(e.slowT, b.chill); e.slowAmt = Math.max(e.slowAmt, 0.55); }
          if (st.slowHit > 0) { e.slowT = Math.max(e.slowT, 1.5); e.slowAmt = Math.max(e.slowAmt, st.slowHit); }
          if (st.freeze > 0 && !e.boss && Math.random() < st.freeze) {
            e.stun = Math.max(e.stun, 1.3);
            float(e.x, e.y - 10, 'FROZEN', '#bfefff');
            part(e.x, e.y, '#dff4ff', 12, 90, 0.5);
          }
          /* SKEWER pays for depth, ANGLE OF ATTACK pays for patience. Both
             read counters the bullet was already keeping. */
          let hd = b.dmg;
          if (rd('carve')) hd *= 1 + 0.25 * b.hitIds.length;
          // 0.30 -> 0.20 a bounce. With CROSS-CUT's two extra the old figure
          // reached +150% on the last hop of a round you did not have to aim.
          if (rd('ricochet') && b.bounced) hd *= 1 + 0.20 * b.bounced;
          damageEnemy(e, hd, true, a, false, b.crit);
          /* The hit itself. A bullet used to land with nothing but a damage
             number: no spark, no flash, no direction — the enemy flickered and
             a figure appeared. `impact` gives it a physical event scaled to
             how hard it landed, so a shotgun into a crowd reads as nine
             separate hits and a GOD FINGER slug reads as one enormous one. */
          impact(b.x, b.y, a, b.col, hd > 55 || b.crit);
          float(b.x, b.y - 6, Math.round(hd), b.god ? '#ff5cf0' : hd > 60 ? '#ff8a3a' : '#ffe8b0', hd > 60);
          // THE FLYKILLER: the round stops here, the current does not
          if (b.chain) chainZap(e, hd, b.chain, b.chainR, b.col);
          b.hitIds.push(e);
          if (b.hitIds.length > b.pierce) { S.bul.splice(i, 1); removed = true; }
          break;
        }
      }
      if (removed) break;
      if (b.x < 0 || b.y < 0 || b.x > S.aw || b.y > S.ah) {
        // the disc turns at the edge of the room instead of leaving it
        if (b.blade && !b.back) {
          b.x = clamp(b.x, 2, S.aw - 2); b.y = clamp(b.y, 2, S.ah - 2);
          bladeTurn(b);
          continue;
        }
        if (b.sing) singularityPop(b);
        S.bul.splice(i, 1); removed = true; break;
      }
    }
    if (removed) continue;
    b.life -= dt;
    if (b.life <= 0) {
      if (b.sing) singularityPop(b);       // it does not fizzle, it arrives
      S.bul.splice(i, 1);
    }
  }

  /* ---- grenades ---- */
  for (let i = S.nades.length - 1; i >= 0; i--) {
    const g = S.nades[i];
    g.fuse -= dt; g.rot += dt * 9;
    g.vz -= 420 * dt;
    g.z += g.vz * dt;
    const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
    if (pointInWall(nx, g.y)) { g.vx *= -0.55; g.landed = true; A.nadeBounce(); } else g.x = nx;
    if (pointInWall(g.x, ny)) { g.vy *= -0.55; g.landed = true; A.nadeBounce(); } else g.y = ny;
    if (g.z <= 0) {
      g.z = 0;
      if (!g.landed) {                    // first touchdown: stick the landing on the crosshair
        g.landed = true; g.vz = 60; g.vx *= 0.06; g.vy *= 0.06;
        part(g.x, g.y, 'rgba(190,170,150,0.6)', 6, 40, 0.35);
        A.nadeBounce();
      } else if (g.vz < -25) { g.vz *= -0.3; g.vx *= 0.5; g.vy *= 0.5; }
      else { g.vz = 0; g.vx *= 0.86; g.vy *= 0.86; }
    }
    if (Math.random() < dt * 22) part(g.x, g.y - g.z, '#8a8a8a', 1, 16, 0.4);
    if (g.fuse <= 0) {
      /* Quiet, like everything else that goes off. The camera shake on a frag
         was a full 14 units with a punch and a hitstop, which is a lot of the
         frame taken away from you at exactly the moment you want to see what
         your frag did. The blast keeps its rings, its sparks, its light and
         its sound — see explode(). */
      explode(g.x, g.y, 58, 130 * ST().dmgMul, '#ffb03a', true);
      if (rd('munitions')) S.pools.push({ x: g.x, y: g.y, r: 44, life: 5, max: 5, d: 18, fire: 1 });  // INCENDIARY
      S.nades.splice(i, 1);
    }
  }

  /* ---- enemies ---- */
  for (let i = S.en.length - 1; i >= 0; i--) {
    const e = S.en[i];
    if (e.dead) { S.en.splice(i, 1); continue; }
    e.hit = Math.max(0, e.hit - dt);
    e.sq = Math.max(0, e.sq - dt * 3);
    e.bob += dt * 6;
    /* The walk cycle is stepped by how fast the thing is actually travelling,
       so a stalker sprints and a bloater lumbers off the same code. poseT is
       the wind-up frame; the AI sets it, the draw reads it. */
    e.anim += dt * (1.7 + Math.hypot(e.vx, e.vy) * (e.boss ? 0.022 : 0.05));
    e.poseT = Math.max(0, e.poseT - dt);
    // twitching: they don't hold still, and it isn't the animation
    e.twitch -= dt;
    if (e.twitch <= 0) {
      e.twitch = rnd(0.25, 1.4);
      if (Math.random() < 0.55) { e.twx = rnd(-1.5, 1.5); e.twy = rnd(-1.5, 1.5); }
      else { e.twx = 0; e.twy = 0; }
    }
    if (e.spd > 60 || e.boss) {                 // fast things smear
      e.trail.push({ x: e.x, y: e.y });
      if (e.trail.length > 5) e.trail.shift();
    }
    if (e.burnT > 0) {
      e.burnT -= dt; e.hp -= e.burn * dt;
      if (Math.random() < 0.4) part(e.x, e.y - 2, pick(['#ff8a2b', '#ffd05a', '#ff3b1e']), 1, 30, 0.4);
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    /* COLD SNAP, FREEZER BURN and THE WALK-IN all turn the same dial, and a
       PRICE GUN tag times out on its own. */
    e.mark = Math.max(0, e.mark - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    let sl = e.slowT > 0 ? e.slowAmt : 0;
    if (st.aura > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 66) {
      sl = Math.max(sl, st.aura);
      // PERMAFROST: standing near you stops being slow and starts being fatal
      if (fz('permafrost') && !e.boss && Math.random() < dt * 1.6) {
        e.stun = Math.max(e.stun, 1.1);
        part(e.x, e.y, '#dff4ff', 6, 60, 0.4);
      }
    }
    e.spd = e.base * (1 - Math.min(0.85, sl));
    if (e.stun > 0) {
      e.stun -= dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= 0.86; e.vy *= 0.86;
      collideWalls(e);
      continue;
    }
    // elites wear the boss bar but keep their own species' AI
    if (e.boss && !e.mini) updateBoss(e, dt); else updateEnemy(e, dt);

    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 1) {
      e.atkT -= dt;
      if (e.atkT <= 0) { e.atkT = CONTACT_CD; hurtPlayer(e.dmg, e.x, e.y); }
    }
  }

  /* ---- enemy projectiles ---- */
  for (let i = S.eb.length - 1; i >= 0; i--) {
    const b = S.eb[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (Math.random() < 0.3) part(b.x, b.y, b.col, 1, 12, 0.25);
    if (b.life <= 0 || pointInWall(b.x, b.y)) { part(b.x, b.y, b.col, 5, 60, 0.3); S.eb.splice(i, 1); continue; }
    if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) {
      hurtPlayer(b.dmg, b.x, b.y);
      part(b.x, b.y, b.col, 12, 100, 0.4);
      /* THE BUTCHER's hook. It does very little damage and then puts you where
         it wants you: one hard shove toward whatever threw it. Applied as
         velocity rather than as a teleport so the walls, the crates and your
         own dash all still get a say — it is a tug, not a grab, and a dash
         fired on the same frame beats it. Landing it is how the fight resets
         to its own preferred range. */
      if (b.hook && b.owner && !b.owner.dead) {
        const a = Math.atan2(b.owner.y - p.y, b.owner.x - p.x);
        p.vx += Math.cos(a) * 460; p.vy += Math.sin(a) * 460;
        float(p.x, p.y - 16, 'HOOKED', '#e8dcc8', true);
        for (let k = 0; k < 5; k++)
          S.arcs.push({ x1: b.owner.x, y1: b.owner.y, x2: p.x, y2: p.y, life: 0.24, col: '#e8dcc8' });
        A.ram(); shake(6);
      }
      S.eb.splice(i, 1);
    }
  }

  /* ---- pickups ---- */
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const d = S.drops[i];
    d.t += dt; d.life -= dt; d.bob += dt * 3;
    if (d.vx) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.88; d.vy *= 0.88; }
    if (d.life <= 0) { S.drops.splice(i, 1); continue; }
    const dd = Math.hypot(d.x - p.x, d.y - p.y);
    const perm = d.kind === 'god';
    // End of a wave: the floor gives up everything it was holding.
    if (S.vacuum > 0 && !perm) {
      d.life = Math.max(d.life, 2);
      const a = Math.atan2(p.y - d.y, p.x - d.x);
      const sp = 150 + (1 - clamp(dd / 400, 0, 1)) * 260;
      d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt;
      d.vx = d.vy = 0;
      if (Math.random() < dt * 12) part(d.x, d.y, '#ffe9a8', 1, 20, 0.3);
    }
    /* WINDFALL widens the reach enormously — but it IS a reach. Unconditional
       collection made loot placement, the wave-end vacuum and walking anywhere
       all pointless in one rider. */
    else if (!perm) {
      const stp = ST();
      const reach = Math.max(40 * stp.magnet, stp.reach);
      if (dd < reach) {
        const pull = dd < 40 * stp.magnet ? 6 : 2.6;   // gentler at the far edge
        d.x += (p.x - d.x) * dt * pull; d.y += (p.y - d.y) * dt * pull;
        if (stp.reach && dd > 60 && Math.random() < dt * 4) part(d.x, d.y, '#9fe08a', 1, 16, 0.3);
      }
    }
    if (dd < 12) {
      if (d.kind === 'ammo') { p.mags[curW().id] = magCap(curW()); p.reT = 0; float(p.x, p.y - 16, 'AMMO', '#f2d14a'); A.pickup(); }
      else if (d.kind === 'med') { p.hp = Math.min(ST().maxhp, p.hp + 26); float(p.x, p.y - 16, '+26 HP', '#ff6b6b'); A.pickup(); }
      else if (d.kind === 'nade') { p.nades = Math.min(9, p.nades + 1); float(p.x, p.y - 16, '+1 FRAG', '#7aa35e'); A.pickup(); }
      else if (d.kind === 'coin') {
        S.coinFrac += ST().coinMul * 1.4;   // five waves: same money, fewer bodies
        let got = 0;
        while (S.coinFrac >= 1) { S.coinFrac -= 1; S.coins++; S.vault++; got++; }
        float(p.x, p.y - 16, '+' + got, '#f5c518'); A.coin();
      }
      else if (d.kind === 'shield') {
        p.tempShield = Math.max(p.tempShield, 3.0);
        float(p.x, p.y - 18, 'AEGIS', '#7fd0ff', true);
        ring(p.x, p.y, 30, '#7fd0ff', 0.4, 2);
        part(p.x, p.y, '#c6e8ff', 22, 130, 0.6);
        A.bigpickup();
      }
      /* ---- the deep drops ----
         Timed, loud, and short. A buff you have to spend before it runs out is
         a decision; a buff you carry is just a bigger number. */
      else if (d.kind === 'frenzy') {
        p.frenzyT = Math.max(p.frenzyT, 7);
        float(p.x, p.y - 18, 'FRENZY', '#ffb03a', true);
        ring(p.x, p.y, 30, '#ffb03a', 0.4, 2); part(p.x, p.y, '#ffd28a', 20, 130, 0.6);
        A.bigpickup();
      }
      else if (d.kind === 'siphon') {
        p.siphonT = Math.max(p.siphonT, 8);
        float(p.x, p.y - 18, 'SIPHON', '#c02a3a', true);
        ring(p.x, p.y, 30, '#c02a3a', 0.4, 2); part(p.x, p.y, '#ff5b5b', 20, 130, 0.6);
        A.bigpickup();
      }
      else if (d.kind === 'magnet') {
        /* Not a buff — a sweep. Everything loose on the floor comes in at
           once, which is why it is worth walking to rather than worth saving. */
        let n = 0;
        for (const o of S.drops) if (o !== d) { o.pull = 1; n++; }
        float(p.x, p.y - 18, 'SWEEP x' + n, '#9fe08a', true);
        ring(p.x, p.y, 44, '#9fe08a', 0.5, 2);
        A.bigpickup();
      }
      else if (d.kind === 'bounty') {
        const got = 40 + S.room * 12;
        S.coins += got; S.vault += got;
        float(p.x, p.y - 18, '+' + got, '#f5c518', true);
        ring(p.x, p.y, 36, '#f5c518', 0.45, 2); part(p.x, p.y, '#ffe27a', 26, 150, 0.7);
        A.coin(); A.bigpickup();
      }
      else if (d.kind === 'nova') fireNova(p.x, p.y);
      else if (d.kind === 'card') {
        S.cards++;
        float(p.x, p.y - 18, 'CARD ' + S.cards, '#c0202a', true);
        A.card(); S.flash = 0.3; S.flashCol = '#e8dfc8'; shake(4);
      }
      else if (d.kind === 'god') { grantGod(); if (S.secret) S.secret.taken = true; }
      S.drops.splice(i, 1);
    }
  }

  /* ---- weapon pedestals ---- */
  S.prompt = null;

  if (S.tomce) {
    const q = S.tomce;
    q.bob += dt;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    q.near = clamp(1 - d / 110, 0, 1);
    if (!q.used && d < 34) {
      S.prompt = { x: q.x, y: q.y - 30, tomce: 1 };
      if (keys.KeyE) { keys.KeyE = false; openAugments(); }
    }
  }

  for (const sh of S.shops) {
    if (sh.bought) continue;
    sh.bob += dt * 2;
    const d = Math.hypot(sh.x - p.x, sh.y - p.y);
    if (d < 26) {
      const w2 = WEP[sh.id];
      const need = sh.cards ? S.cards >= sh.cards : S.coins >= sh.price;
      S.prompt = { x: sh.x, y: sh.y, w: w2, cost: sh.cards ? sh.cards + ' CARDS' : sh.price + ' COINS', ok: need };
      if (keys.KeyE) {
        keys.KeyE = false;
        if (need) {
          if (sh.cards) S.cards -= sh.cards; else S.coins -= sh.price;
          sh.bought = true;
          giveWeapon(sh.id);
          ring(sh.x, sh.y, 50, w2.col, 0.5, 2);
        } else { A.denied(); float(p.x, p.y - 20, 'NOT ENOUGH', '#ff3b46'); }
      }
    }
  }


  /* ---- secrets ---- */
  if (S.secret && !S.secret.taken) {
    S.secret.t -= dt;
    if (S.secret.t <= 0) { S.secret.t = rnd(4, 8); S.secret.flick = 0.14; }
    S.secret.flick = Math.max(0, S.secret.flick - dt);
    if (Math.hypot(p.x - (S.secret.x + 5), p.y - 24) < 78 && Math.random() < dt * 0.7) {
      A.whisper(); S.redness = Math.min(0.35, S.redness + 0.12);
    }
  }
  if (S.corner && !S.corner.found) {
    const d = Math.hypot(p.x - S.corner.x, p.y - S.corner.y);
    S.corner.pulse = clamp(1 - d / 90, 0, 1);
    if (d < 13) triggerModagaz();
  }

  if (S.door.open) {
    S.door.glow = Math.min(1, S.door.glow + dt);
    const inX = p.x > S.door.x - 6 && p.x < S.door.x + S.door.w + 6;
    // the shop's door is on the south wall and goes back, not down
    if (S.door.exit) { if (inX && p.y > S.door.y - 12) exitShop(); }
    else if (inX && p.y < S.door.y + S.door.h + 12) nextRoom();
  }

  /* drain the on-kill queue — at most three a frame, whatever queued them */
  if (S.fx.length) {
    const batch = S.fx.splice(0, 3);
    for (const f of batch) {
      if (f.k === 'nova') fireNova(f.x, f.y);
      else {
        // everything on this queue was triggered BY a kill, so all of it is
        // quiet — see explode().
        explode(f.x, f.y, f.r, f.d, f.col || '#ff6a72', true);
        // RENDERED: OVERKILL's burst leaves the floor alight where it went off
        if (f.fire) S.pools.push({ x: f.x, y: f.y, r: 26, life: 4, max: 4, d: 14, fire: 1 });
      }
    }
    if (S.fx.length > 12) S.fx.length = 12;    // a runaway chain still has to end
  }

  updateWaves(dt);
  updateParticles(dt);
  updateCam(rdt);
}

/* An elite calling for help — and the reason it does not simply use the gate
   updateBoss() uses.

   The intent written down in Difficulty Scaling is "so you cannot simply back
   away from one". A plain `S.en.length < cap` gate satisfies the ceiling and
   destroys that intent, because it goes quiet exactly when the room is fullest
   — which is exactly when backing away is easiest. Both were built and
   measured on a 45-second kiting run at floor 8 wave 4, Damjan retreating and
   never firing:

     | | live max | summons/min | reached you/min |
     | uncapped (the defect) |  164 |  106.7 |  81.3 |
     | plain gate            |   95 |   14.7 |  14.7 |
     | recycle (this)        |   95 |   69.3 |  33.3 |

   The gate cuts the elite's voice by 86% and leaves you free to walk away from
   a full room. Recycling holds the same ceiling and still delivers 2.3x the
   gate's renewal, because the population is conserved rather than frozen: the
   room stays the same size, and what is IN it keeps being reissued in front of
   you. Frame cost of the difference, measured: +1.6%. */
function eliteSummon(e, adds) {
  const cap = concurrencyCap();
  for (let i = 0; i < adds; i++) {
    // at the ceiling, something has to leave before something may arrive
    if (liveLoad() >= cap && !retireOldestAdd()) break;
    const q = freeSpot(90);
    S.cracks.push({ x: q.x, y: q.y, t: 0.75,
                    type: pick(['crawler', 'stalker', 'shrieker']), sum: 1, born: S.t });
  }
}

/* Retire the longest-standing reinforcement, and only if it is somewhere you
   cannot see it. Never an elite, never a boss.

   RETIRE_R is the hard constraint on this whole mechanic. The camera shows
   480x270 game units, so its half-diagonal is about 275 — anything retired
   closer than that can pop out of existence in view, and a measured pass with
   a 210 radius did exactly that: 25% of retirements used a near fallback and
   one of them vanished TEN PIXELS from Damjan. That does not read as a
   mechanic, it reads as a bug, and no amount of pressure is worth it.

   So there is no fallback. If every reinforcement is close enough to see, the
   summon is simply skipped for that slot — the elite falls back to gate
   behaviour exactly when, and only when, gating is the honest thing to do.
   Measured, that costs almost nothing: the median retirement sits at ~400px,
   well outside the frame. */
const RETIRE_R = 300;
function retireOldestAdd() {
  /* Who may be recycled, in priority order:

     1. a REINFORCEMENT the elite made earlier. It was free pressure when it
        arrived and it is free pressure when it leaves.
     2. failing that, any ordinary enemy the player has NEVER TOUCHED. Full
        health means no bullets spent on it and no progress lost, so recycling
        it takes nothing the player had earned. A damaged enemy is work in
        progress and is never taken.

     Restricting this to (1) alone was measured and it is too small a pool —
     summons are a minority of a 95-body room, so 30% of summon slots found
     nothing safe and the elite went nearly as quiet as the plain gate. Both
     groups are off-screen and unengaged, which is the property that actually
     matters; which spawner made them is not.

     Elites and bosses are never eligible, at any distance. */
  let best = null, bestBorn = Infinity, bestRank = 9;
  for (const o of S.en) {
    if (o.dead || o.elite || o.boss) continue;
    if (Math.hypot(o.x - S.p.x, o.y - S.p.y) <= RETIRE_R) continue;
    const rank = o.sum ? 0 : (o.hp >= o.max ? 1 : 9);
    if (rank === 9) continue;                       // damaged: work in progress
    const bo = o.born === undefined ? -1 : o.born;
    if (rank < bestRank || (rank === bestRank && bo < bestBorn)) { bestRank = rank; bestBorn = bo; best = o; }
  }
  if (!best) return false;
  part(best.x, best.y, '#4a1016', 6, 50, 0.35);   // it sinks back into the floor
  const i = S.en.indexOf(best);
  if (i >= 0) S.en.splice(i, 1);
  return true;
}

function updateEnemy(e, dt) {
  const p = S.p;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  e.wob += dt * 3;
  let tx = dx / d, ty = dy / d;

  /* Elites keep their species' movement but add a shell burst and a summon, so
     you cannot simply back away from one the way you can from a bloater. */
  if (e.elite) {
    e.eliteT -= dt;
    if (e.eliteT <= 0) {
      e.eliteT = rnd(2.2, 3.2);
      e.poseT = 0.4;
      const n = 8 + Math.floor(S.room * 1.5);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + rnd(0, 0.26);
        S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 145, vy: Math.sin(a) * 145,
                    r: 4, bob: rnd(0, TAU), dmg: e.dmg * 0.45, life: 2.6, col: e.eliteCol });
      }
      const adds = 1 + Math.floor(S.room * 0.7);
      eliteSummon(e, adds);
      A.screech(); shake(4);
    }
  }

  if (e.type === 'shrieker') {
    if (d < 96) { tx *= -1; ty *= -1; }
    else if (d < 130) { const t2 = tx; tx = -ty; ty = t2; }
    e.fireT -= dt;
    // it gapes before it screams — the wide maw is the warning
    if (e.fireT < 0.5 && d < 220) e.poseT = Math.max(e.poseT, 0.1);
    if (e.fireT <= 0 && d < 220) {
      e.fireT = rnd(1.8, 2.8);
      e.poseT = 0.34;
      A.screech();
      const a = Math.atan2(dy, dx);
      for (let k = -1; k <= 1; k++)
        S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a + k * 0.16) * 130, vy: Math.sin(a + k * 0.16) * 130, r: 4, bob: rnd(0, TAU), dmg: e.dmg * 0.7, life: 2.2, col: '#9ad14a' });
    }
  } else if (e.type === 'stalker') {
    e.blinkT -= dt;
    if (e.blinkT < 0.4 && d > 40) e.poseT = Math.max(e.poseT, 0.1);   // coils first
    if (e.blinkT <= 0 && d > 40) {
      e.blinkT = rnd(2.4, 4);
      part(e.x, e.y, '#cfc7b0', 14, 100, 0.4);
      e.x += tx * 70; e.y += ty * 70;
      collideWalls(e);
      part(e.x, e.y, '#cfc7b0', 14, 100, 0.4);
      A.screech();
    }
  } else if (e.type === 'spitter') {
    /* It does not want to reach you. Inside its standoff it backs away, and it
       drops hazard on WHERE YOU ARE GOING rather than where you are — leading
       your own velocity, so a clean circle runs you straight through it. That
       is the whole point of the thing: kiting stops being free. */
    e.lobT -= dt;
    if (e.lobT < 0.5) e.poseT = Math.max(e.poseT, 0.12);
    if (e.lobT <= 0) {
      e.lobT = e.lob * rnd(0.85, 1.2);
      e.poseT = 0.34;
      const lead = 0.55;
      mortarAt(clamp(S.p.x + S.p.vx * lead, 12, S.aw - 12),
               clamp(S.p.y + S.p.vy * lead, 12, S.ah - 12),
               26, e.dmg * 0.9, 1.15, '#b6cf8c');
      part(e.x, e.y - 4, '#dcf0b4', 8, 70, 0.4);
      A.screech();
    }
  } else if (e.aura > 0) {
    /* It never touches you. It stands off and makes everything near it faster
       and tougher, and marks who it is holding with a tether so the buff is
       something you can SEE and therefore something you can answer. */
    for (const o of S.en) {
      if (o === e || o.boss || o.dead) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < e.aura) o.buffed = Math.max(o.buffed, 0.25);
    }
    if (Math.random() < dt * 3) part(e.x + rnd(-6, 6), e.y - 8, '#cbb6ff', 1, 26, 0.5);
    e.poseT = Math.max(e.poseT, 0.1);
  } else if (e.type === 'crawler') {
    if (Math.random() < dt * 0.5 && d < 120) { e.vx += tx * 90; e.vy += ty * 90; e.poseT = 0.22; }
  } else if (e.type === 'bloater') {
    if (d < e.r + 18) e.poseT = Math.max(e.poseT, 0.1);               // swells before it lands on you
  } else if (e.nest) {
    /* The CYST does not chase. It sits where the wave put it, swells, and
       hatches — the pressure it applies is the growing crowd, and the counter
       is crossing the room to burst it. It refuses knockback for the same
       reason a door refuses knockback: its job is to be a place. */
    e.vx *= 0.7; e.vy *= 0.7;
    e.x += e.vx * dt; e.y += e.vy * dt;
    collideWalls(e);
    e.hatchT -= dt;
    if (e.hatchT < 0.6) e.poseT = Math.max(e.poseT, 0.1);             // the swell is the warning
    if (e.hatchT <= 0 && S.en.length < 70) {
      e.hatchT = Math.max(1.6, 3.4 - S.room * 0.15);
      e.poseT = 0.5;
      const kind = S.room >= 3 && Math.random() < 0.3 ? 'husk' : 'crawler';
      S.cracks.push({ x: e.x + rnd(-16, 16), y: e.y + rnd(10, 22), t: 0.75, type: kind });
      part(e.x, e.y, '#8fae4a', 10, 60, 0.5);
      A.screech();
    }
    if (Math.random() < dt * 2) part(e.x, e.y - 2, '#a8c85a', 1, 20, 0.6);
    return;                                                            // no walk cycle, no wander
  }

  const wob = Math.sin(e.wob) * 0.28;
  const ca = Math.cos(wob), sa = Math.sin(wob);
  let rx = tx * ca - ty * sa, ry = tx * sa + ty * ca;
  /* STANDOFF. The two that do their work at range walk AWAY once you are
     inside their band, and sidle when you are at it — so closing the distance
     is the counter to both of them, which is the opposite of the counter to
     everything else in the room. */
  if (e.standoff > 0) {
    if (d < e.standoff * 0.8) { rx = -rx; ry = -ry; }
    else if (d < e.standoff) { const t2 = rx; rx = -ry; ry = t2; }
  }
  /* The SHEPHERD's blessing. Held for a quarter second at a time and refreshed
     every frame it is in range, so it lapses on its own the moment the
     shepherd dies — the buff is never something you have to clean up. */
  const buff = e.buffed > 0 ? 1.35 : 1;
  if (e.buffed > 0) e.buffed -= dt;
  e.vx = lerp(e.vx, rx * e.spd * buff, 1 - Math.pow(0.02, dt));
  e.vy = lerp(e.vy, ry * e.spd * buff, 1 - Math.pow(0.02, dt));
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.flip = e.vx < 0;
  collideWalls(e);

  for (const o of S.en) {
    if (o === e || o.boss) continue;
    const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
    if (od > 0.1 && od < e.r + o.r) { e.x += ox / od * (e.r + o.r - od) * 0.5; e.y += oy / od * (e.r + o.r - od) * 0.5; }
  }
}

/* ---------- the break ----------
   At half health a floor boss stops doing the thing it opened with. It rears
   up for a beat, knocks the room off itself, and comes back on `pat2` — faster,
   hitting harder, calling for help more often.

   It is NOT invulnerable during the rear-up. Standing still for a second is
   the reward for breaking it, and i-frames on a boss you have just earned an
   opening on reads as the game taking the opening back.

   The bar does not refill. Two phases over one bar is structure; two phases
   over two bars is just twice the health. */
function enterPhase(b) {
  b.ph++;
  const last = b.ph >= b.phases;
  b.phaseT = last ? 1.35 : 1.05;          // the rear-up, longer for a final form
  /* THE BODY CHANGES WITH THE PHASE. drawEnemy reads `e.bank` live every
     frame, so assigning it here IS the transformation - walk frames, the
     wind-up pose and the eye positions all arrive with it. */
  if (b.def && b.def.banks && b.def.banks[b.ph - 1]) {
    b.bank = b.def.banks[b.ph - 1];
    b.spr = b.bank.walk[0];
  }
  b.phase = 'idle'; b.pt = 0.4;
  b.spd *= 1.24; b.base *= 1.24;
  b.dmg *= 1.16;
  b.spawnT = Math.min(b.spawnT, 1.2);
  b.poseT = b.phaseT;
  /* Everything the boss has already put in the air goes with the break. Two
     reasons, and the second is the real one: a phase change that leaves the
     last pattern's bullets on screen reads as the two patterns overlapping
     rather than one replacing the other, and on a three-phase fight that
     compounds into noise nobody can parse. The rear-up is also the player's
     window — handing it to them with the room still full is not a window. */
  knockRoom(b.x, b.y, 240, 300, '#ff2b2b');
  S.eb.length = 0;
  for (let i = S.haz.length - 1; i >= 0; i--) if (S.haz[i].b === b) S.haz.splice(i, 1);
  b.vx = b.vy = 0;                        // knockRoom shoves everything, itself included
  b.beam = null; b.hooked = 0;
  ring(b.x, b.y, 120, '#ff2b2b', 0.7, 3);
  ring(b.x, b.y, 70, '#ffffff', 0.45, 2);
  part(b.x, b.y, '#ff5a48', 46, 190, 0.8, 2);
  blood(b.x, b.y + 8, 26, 'rgba(90,10,16,0.4)');
  S.flash = Math.max(S.flash, last ? 0.9 : 0.7); S.flashCol = '#ff2b2b';
  shake(b.apex || last ? 22 : 15); punch(0.08);
  S.hitstop = Math.max(S.hitstop, last ? 0.16 : 0.1);
  A.roar(); A.screech(true);
  if (A.music) A.music.setIntensity(1);
  A.setDread(1);
  const cry = b.ph === 3 ? (b.def.cry3 || b.def.cry2) : b.def.cry2;
  msg(b.name, cry || 'IT IS NOT FINISHED', 2.6);
  float(b.x, b.y - 46, b.ph === 3 ? 'FINAL PHASE' : 'SECOND PHASE', '#ff2b2b', true);
}

function updateBoss(b, dt) {
  const p = S.p;
  const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  b.pt -= dt; b.flip = dx < 0;

  /* The bar is divided into `phases` equal bands and it breaks on every
     boundary — halves for the roster, thirds for the finale. The bar never
     refills: N phases over one bar is structure, N phases over N bars is just
     N times the health. */
  if (b.ph < b.phases && b.hp <= b.max * (1 - b.ph / b.phases)) enterPhase(b);
  /* The break itself: it holds still, everything else keeps running. Nothing
     below this point executes until the rear-up is over. */
  if (b.phaseT > 0) {
    b.phaseT -= dt;
    b.vx *= 0.8; b.vy *= 0.8;
    b.x += b.vx * dt; b.y += b.vy * dt;
    collideWalls(b);
    b.x = clamp(b.x, 30, S.aw - 30); b.y = clamp(b.y, 30, S.ah - 30);
    if (Math.random() < dt * 40) part(b.x, b.y, '#ff2b2b', 2, 70, 0.4);
    return;
  }
  const pat = b.ph === 3 ? (b.def.pat3 || b.def.pat2 || b.def.pat)
            : b.ph === 2 ? (b.def.pat2 || b.def.pat) : b.def.pat;

  // Every boss summons, but only up to a ceiling that scales with the floor —
  // so it stays a fight rather than an avalanche.
  const D2 = b.def;
  const addCap = Math.min(30, 14 + S.room * 4 + (S.evo | 0) * 2);
  b.spawnT -= dt;
  // p3 does not call for help. A bullet-hell finale with adds walking through
  // it is not harder, it is unreadable — and unreadable is where a good fight
  // stops being a fight and starts being a dice roll.
  if (pat !== 'p3' && b.spawnT <= 0 && S.en.length < addCap) {
    b.spawnT = D2.addT * rnd(0.85, 1.15) * (b.ph === 2 ? 0.7 : 1);
    b.poseT = 0.6;                          // bossB splits open to let them out
    const cnt = Math.min(D2.addN + Math.floor(S.room * 0.5), addCap - S.en.length);
    for (let i = 0; i < cnt; i++) {
      const q = freeSpot(90);
      S.cracks.push({ x: q.x, y: q.y, t: 0.6, type: pick(D2.adds) });
    }
    A.screech(true);
  }

  if (pat === 'charge' || pat === 'burst') {
    if (b.phase === 'idle') {
      b.vx = lerp(b.vx, dx / d * b.spd, 1 - Math.pow(0.05, dt));
      b.vy = lerp(b.vy, dy / d * b.spd, 1 - Math.pow(0.05, dt));
      if (b.pt <= 0) { b.phase = 'tell'; b.pt = 0.75; b.chargeDir = Math.atan2(dy, dx); }
    } else if (b.phase === 'tell') {
      b.vx *= 0.85; b.vy *= 0.85;
      b.chargeDir = lerp(b.chargeDir, Math.atan2(dy, dx), dt * 3);
      if (Math.random() < dt * 20) part(b.x, b.y, '#ff2b2b', 2, 40, 0.3);
      b.poseT = 0.2;                        // reared up, holding the tell
      if (b.pt <= 0) { b.phase = 'charge'; b.pt = 1.0; A.roar(); shake(7); }
    } else if (b.phase === 'charge') {
      b.vx = Math.cos(b.chargeDir) * b.spd * 5.2;
      b.vy = Math.sin(b.chargeDir) * b.spd * 5.2;
      blood(b.x, b.y + 8, 8, 'rgba(80,8,14,0.28)');
      if (pat === 'burst' && Math.random() < dt * 14)
        S.eb.push({ x: b.x, y: b.y + 6, vx: rnd(-20, 20), vy: rnd(-20, 20), r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.35, life: 1.6, col: '#ff8a2b' });
      if (b.pt <= 0) {
        b.phase = 'idle'; b.pt = rnd(1.4, 2.4);
        shake(8); punch(0.03);
        if (pat === 'burst') {
          for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 115, vy: Math.sin(a) * 115, r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.5, life: 2.2, col: '#ff8a2b' }); }
          ring(b.x, b.y, 70, '#ff8a2b', 0.4, 2);
          A.roar();
        }
      }
    }
  } else if (pat === 'spawner') {
    b.vx = lerp(b.vx, dx / d * b.spd, 1 - Math.pow(0.1, dt));
    b.vy = lerp(b.vy, dy / d * b.spd, 1 - Math.pow(0.1, dt));
    if (b.pt <= 0) {
      b.pt = rnd(2.6, 3.6);
      b.poseT = 0.5;
      const off = Math.random() * TAU, n = 12 + S.room * 4;
      for (let i = 0; i < n; i++) { const a = off + i / n * TAU; S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.5, life: 3, col: '#8fdd4a' }); }
      ring(b.x, b.y, 60, '#8fdd4a', 0.35, 2);
      A.screech(true); shake(5);
    }
  } else if (pat === 'blink') {
    b.vx = lerp(b.vx, dx / d * b.spd * 0.6, 1 - Math.pow(0.1, dt));
    b.vy = lerp(b.vy, dy / d * b.spd * 0.6, 1 - Math.pow(0.1, dt));
    if (b.pt <= 0) {
      b.pt = rnd(2.0, 3.0);
      b.poseT = 0.4;
      part(b.x, b.y, '#e8f0ff', 28, 140, 0.55);
      const a = Math.random() * TAU, rr = rnd(55, 90);
      b.x = clamp(p.x + Math.cos(a) * rr, 40, S.aw - 40);
      b.y = clamp(p.y + Math.sin(a) * rr, 40, S.ah - 40);
      collideWalls(b);
      part(b.x, b.y, '#e8f0ff', 28, 140, 0.55);
      A.screech();
      const aa = Math.atan2(p.y - b.y, p.x - b.x);
      for (let k = 0; k < 5; k++) S.eb.push({ x: b.x, y: b.y, vx: Math.cos(aa + rnd(-0.25, 0.25)) * 150, vy: Math.sin(aa + rnd(-0.25, 0.25)) * 150, r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.4, life: 2, col: '#f2ede2' });
    }
  } else if (pat === 'circle') {
    // THE COURIER never stops moving. It orbits, then commits.
    if (b.phase === 'idle') {
      b.orbit += dt * 1.5;
      const R2 = 96;
      const tx = p.x + Math.cos(b.orbit) * R2, ty = p.y + Math.sin(b.orbit) * R2;
      b.vx = lerp(b.vx, (tx - b.x) * 3.2, 1 - Math.pow(0.02, dt));
      b.vy = lerp(b.vy, (ty - b.y) * 3.2, 1 - Math.pow(0.02, dt));
      if (Math.random() < dt * 3) part(b.x, b.y + 10, '#5ac8ff', 1, 30, 0.4);
      if (b.pt <= 0) { b.phase = 'tell'; b.pt = 0.5; b.chargeDir = Math.atan2(dy, dx); }
    } else if (b.phase === 'tell') {
      b.vx *= 0.8; b.vy *= 0.8;
      b.chargeDir = lerp(b.chargeDir, Math.atan2(dy, dx), dt * 5);
      if (Math.random() < dt * 24) part(b.x, b.y, '#5ac8ff', 2, 50, 0.3);
      b.poseT = 0.2;
      if (b.pt <= 0) { b.phase = 'charge'; b.pt = 0.65; A.ram(); shake(6); }
    } else {
      b.vx = Math.cos(b.chargeDir) * b.spd * 4.6;
      b.vy = Math.sin(b.chargeDir) * b.spd * 4.6;
      if (Math.random() < dt * 30) part(b.x, b.y, '#5ac8ff', 1, 40, 0.5);
      if (b.pt <= 0) {
        b.phase = 'idle'; b.pt = rnd(1.6, 2.6);
        ring(b.x, b.y, 54, '#5ac8ff', 0.35, 2); shake(6);
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.45, life: 2.2, col: '#5ac8ff' }); }
      }
    }

  /* ---------- the three second-phase patterns ----------
     These exist because a phase change has to look different, not just harder.
     Each one asks a different question of the room: spiral asks you to move
     through a rotating gap, nova asks you to be somewhere else on a beat, rush
     asks you to stop standing still at all. */
  } else if (pat === 'spiral') {
    /* It plants itself and screws a continuous arm of shot outward. The arm
       rotates slower than you can run, so the fight becomes a chase around a
       fixed point — the one pattern where the boss stops caring where you are. */
    b.vx = lerp(b.vx, dx / d * b.spd * 0.35, 1 - Math.pow(0.2, dt));
    b.vy = lerp(b.vy, dy / d * b.spd * 0.35, 1 - Math.pow(0.2, dt));
    b.spitAng = (b.spitAng || 0) + dt * 2.1;
    b.spitT = (b.spitT || 0) - dt;
    if (b.spitT <= 0) {
      /* 0.12s x 2.8s life x 4 arms tops out around 90 rounds in the air. At the
         0.085/3.4 it was first written at it was 146, which on a 480x270 screen
         is not a pattern, it is a fill. Spacing along an arm grows with radius,
         so it reads as solid near the boss and as a run-through at the rim —
         which is the shape the fight wants. */
      b.spitT = 0.12;
      const arms = 2 + Math.min(2, Math.floor(S.room / 4));
      for (let k = 0; k < arms; k++) {
        const a = b.spitAng + k / arms * TAU;
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 118, vy: Math.sin(a) * 118, r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.34, life: 2.8, col: '#ffb03a' });
      }
      if (Math.random() < 0.14) A.screech();
    }
    if (b.pt <= 0) { b.pt = rnd(2.2, 3.2); b.poseT = 0.4; ring(b.x, b.y, 44, '#ffb03a', 0.3, 2); }

  } else if (pat === 'nova') {
    /* Stands off and detonates on a metronome. Two rings on alternating
       offsets, so the gap you walked through last time is where the next one
       lands — the tell is the wind-up particles, not the ring. */
    const want = 130;                                  // it wants to be at arm's length
    const push = (d - want) / want;
    b.vx = lerp(b.vx, dx / d * b.spd * clamp(push, -1, 1), 1 - Math.pow(0.1, dt));
    b.vy = lerp(b.vy, dy / d * b.spd * clamp(push, -1, 1), 1 - Math.pow(0.1, dt));
    if (b.pt <= 0.55 && b.pt > 0) {
      b.poseT = 0.5;                                   // the wind-up IS the tell
      if (Math.random() < dt * 50) part(b.x, b.y, '#c05cff', 2, 90, 0.45);
    }
    if (b.pt <= 0) {
      b.pt = rnd(1.9, 2.5);
      b.novaN = (b.novaN | 0) + 1;
      /* Capped at 30. Uncapped, floor 25 put 66 rounds on a ring whose gaps are
         narrower than Damjan is — a ring you cannot be outside of is not a
         dodge, it is a damage tick with extra steps. Depth comes from the
         boss's damage number instead. */
      const n = Math.min(30, 16 + S.room * 2), off = (b.novaN & 1) ? Math.PI / n : 0;
      for (let i = 0; i < n; i++) {
        const a = off + i / n * TAU;
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 132, vy: Math.sin(a) * 132, r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.42, life: 3, col: '#c05cff' });
      }
      ring(b.x, b.y, 86, '#c05cff', 0.45, 3);
      part(b.x, b.y, '#e0a8ff', 30, 170, 0.6, 2);
      A.boom(); shake(7); punch(0.03);
    }

  } else if (pat === 'rush') {
    /* No telegraph, no rest. It simply comes, and it is faster than you if you
       are walking. The only counter is the dash, which is the point: the room
       stops being somewhere you stand and starts being somewhere you cross. */
    /* Capped in absolute units, not as a multiple of b.spd: the roster's base
       speeds run 26 to 62, so a plain multiplier makes THE COURIER unloseable
       and THE TRIMMINGS a walk. 112 against the player's 94 means it closes on
       you but overshoots when you juke — the steering below is deliberately
       lazy so it commits to a heading it then has to correct. */
    const sp = Math.min(b.spd * 1.75, 112);
    b.vx = lerp(b.vx, dx / d * sp, 1 - Math.pow(0.35, dt));
    b.vy = lerp(b.vy, dy / d * sp, 1 - Math.pow(0.35, dt));
    if (Math.random() < dt * 26) part(b.x, b.y + 8, '#ff6a3a', 1, 40, 0.5);
    blood(b.x, b.y + 8, 2, 'rgba(80,8,14,0.16)');
    if (b.pt <= 0) {
      // it never stops, but it does occasionally shed a wall of shot behind it
      b.pt = rnd(2.4, 3.4);
      const aa = Math.atan2(b.vy, b.vx);
      for (let k = -3; k <= 3; k++)
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(aa + k * 0.26) * 140, vy: Math.sin(aa + k * 0.26) * 140, r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.38, life: 2.4, col: '#ff6a3a' });
      ring(b.x, b.y, 40, '#ff6a3a', 0.28, 2);
      A.ram();
    }

  /* ==========================================================
     THE SIX NEW VERBS

     Every pattern above this line resolves to "get near the player and emit
     projectiles". These do not. Each one changes what the ARENA is worth:
     hook says distance is not yours to keep, mortar says the ground is
     temporary, curtain says the room has one door at a time, sweep says
     standing anywhere is a decision, mines says the floor you already crossed
     is spent, brood says you have to choose between the boss and the room.
     ========================================================== */

  } else if (pat === 'hook') {
    /* THE BUTCHER. It works at a butcher's distance — about a hook's length —
       and if you back off further than that it throws the hook and DRAGS you
       back in. You cannot solve this one by kiting, which is exactly the point
       of putting it on the first boss you meet: the game teaches you to kite
       for nine waves and then introduces something that has read the manual.

       The hook is an ordinary enemy bullet carrying `hook`, so it collides,
       lights the room and can be walked around like anything else. What it
       does on contact is in the S.eb loop. */
    const want = 96;
    const push = clamp((d - want) / 90, -0.7, 1);
    b.vx = lerp(b.vx, dx / d * b.spd * push, 1 - Math.pow(0.1, dt));
    b.vy = lerp(b.vy, dy / d * b.spd * push, 1 - Math.pow(0.1, dt));
    b.hookT -= dt;
    if (b.hookT <= 0 && d > 70) {
      b.hookT = rnd(2.6, 3.6);
      b.poseT = 0.45;
      const a = Math.atan2(dy, dx);
      S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 5,
                  bob: rnd(0, TAU), dmg: b.dmg * 0.35, life: 1.5, col: '#e8dcc8',
                  hook: 1, owner: b });
      A.ram();
    }
    // and a short swing whenever you are actually inside its reach
    if (b.pt <= 0) {
      b.pt = rnd(1.5, 2.2);
      if (d < 74) {
        b.poseT = 0.35;
        const a = Math.atan2(dy, dx);
        for (let k = -2; k <= 2; k++)
          S.eb.push({ x: b.x + Math.cos(a) * 16, y: b.y + Math.sin(a) * 16,
                      vx: Math.cos(a + k * 0.22) * 165, vy: Math.sin(a + k * 0.22) * 165,
                      r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.4, life: 0.55, col: '#ff5a48' });
        ring(b.x + Math.cos(a) * 20, b.y + Math.sin(a) * 20, 34, '#ff5a48', 0.25, 2);
        A.roar(); shake(4);
      }
    }

  } else if (pat === 'brood') {
    /* MOTHER OF MELONS. She will not fight you: she backs away and seeds the
       room, and every seed hatches into something that will. The fight is a
       question about priorities — kill her slowly while the room fills, or
       clear the room and let her seed it again — and the answer is different
       depending on what gun you bought. That is a boss.

       Eggs are mortar marks that hatch instead of detonating (`spawn`), so
       they land where they were drawn and you can see the room's next shape
       two seconds before it arrives. */
    const want = 170;
    const push = clamp((d - want) / 120, -1, 0.6);
    b.vx = lerp(b.vx, dx / d * b.spd * push, 1 - Math.pow(0.1, dt));
    b.vy = lerp(b.vy, dy / d * b.spd * push, 1 - Math.pow(0.1, dt));
    if (Math.random() < dt * 6) part(b.x, b.y + 6, '#8fdd4a', 1, 24, 0.5);
    if (b.pt <= 0) {
      b.pt = rnd(2.8, 3.8);
      b.poseT = 0.6;
      const n = 2 + Math.min(2, Math.floor(S.room / 4));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * TAU, rr = rnd(40, 110);
        const ex = clamp(p.x + Math.cos(a) * rr, 40, S.aw - 40);
        const ey = clamp(p.y + Math.sin(a) * rr, 40, S.ah - 40);
        if (pointInWall(ex, ey)) continue;
        S.haz.push({ k: 'mark', x: ex, y: ey, r: 22, dmg: b.dmg * 0.25, t: 1.9, max: 1.9,
                     col: '#8fdd4a', spawn: pick(b.def.adds) });
      }
      A.screech(true);
    }

  } else if (pat === 'mortar') {
    /* THE HOGFATHER. Sits at range, strafes, and walks a three-shell volley
       across wherever you are going — the shells LEAD you, so running in a
       straight line puts you under the third one. The counter is to change
       direction between shells, which is the only pattern in the game that
       punishes committing to a heading. */
    const want = 165;
    const push = clamp((d - want) / 110, -1, 1);
    const perp = Math.atan2(dy, dx) + Math.PI / 2;
    b.vx = lerp(b.vx, dx / d * b.spd * push + Math.cos(perp) * b.spd * 0.7, 1 - Math.pow(0.14, dt));
    b.vy = lerp(b.vy, dy / d * b.spd * push + Math.sin(perp) * b.spd * 0.7, 1 - Math.pow(0.14, dt));
    if (b.pt <= 0) {
      if (b.volley > 0) {
        b.volley--;
        b.pt = 0.42;                       // the walk between shells
        b.poseT = 0.3;
        // lead grows with each shell of the volley: it is learning your speed
        const lead = 0.35 + (2 - b.volley) * 0.22;
        const ex = clamp(p.x + p.vx * lead, 36, S.aw - 36);
        const ey = clamp(p.y + p.vy * lead, 36, S.ah - 36);
        mortarAt(ex, ey, 40, b.dmg * 0.85, 1.35, '#ff8a2b');
        A.magOut();
      } else {
        b.volley = 3; b.pt = rnd(2.6, 3.4);
      }
    }

  } else if (pat === 'curtain') {
    /* A wall of shot with exactly one hole in it, walked across the arena.
       It picks an edge, slides along it, and sweeps — so the room stops being
       a space and becomes a corridor with a moving door. The gap wanders, and
       it wanders slowly enough to run to and fast enough that you cannot camp
       it.

       It does not chase at all while it is doing this. That is the trade: the
       safest place to stand is right next to it. */
    if (!b.edge) { b.edge = 1 + Math.floor(Math.random() * 4); b.gap = Math.random(); }
    const vert = b.edge <= 2;
    const tx = b.edge === 1 ? 56 : b.edge === 2 ? S.aw - 56 : S.aw / 2;
    const ty = b.edge === 3 ? 56 : b.edge === 4 ? S.ah - 56 : S.ah / 2;
    b.vx = lerp(b.vx, (tx - b.x) * 1.6, 1 - Math.pow(0.05, dt));
    b.vy = lerp(b.vy, (ty - b.y) * 1.6, 1 - Math.pow(0.05, dt));
    b.gap = (b.gap + dt * 0.09) % 1;
    if (b.pt <= 0) {
      b.pt = 0.5;
      b.poseT = 0.3;
      /* Fired along the wall it is standing on, aimed across the room. `slots`
         positions, one of which is empty and moving. */
      const slots = 11, hole = Math.floor(b.gap * slots);
      const span = vert ? S.ah - 80 : S.aw - 80;
      const dir = b.edge === 1 ? 0 : b.edge === 2 ? Math.PI : b.edge === 3 ? Math.PI / 2 : -Math.PI / 2;
      for (let i = 0; i < slots; i++) {
        if (i === hole || i === hole + 1) continue;      // a two-wide door
        const u = 40 + span * (i / (slots - 1));
        S.eb.push({
          x: vert ? b.x : u, y: vert ? u : b.y,
          vx: Math.cos(dir) * 108, vy: Math.sin(dir) * 108,
          r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.36, life: 4.2, col: '#7fd0ff'
        });
      }
      A.screech();
      // and it moves house every few sweeps, so the door is never in the same wall
      if (Math.random() < 0.16) { b.edge = 1 + Math.floor(Math.random() * 4); b.pt = 1.4; }
    }

  } else if (pat === 'sweep') {
    /* THE FISHWIFE plants herself and turns a beam. The beam does not track
       you, it does not stop, and it cannot be blocked — you cross it or you
       leave. It also winds up as a sighting line first, so the geometry is
       readable a full second before it is lethal.

       `spin` flips sign between casts so the safe side of the room alternates.
       A beam that always turns the same way is one you solve once. */
    b.vx = lerp(b.vx, dx / d * b.spd * 0.18, 1 - Math.pow(0.2, dt));
    b.vy = lerp(b.vy, dy / d * b.spd * 0.18, 1 - Math.pow(0.2, dt));
    if (!b.beam || b.beam.t <= 0 || S.haz.indexOf(b.beam) < 0) {
      if (b.pt <= 0) {
        b.pt = rnd(3.0, 4.0);
        b.poseT = 0.9;
        b.spinFlip = -(b.spinFlip || -1);
        b.beam = {
          k: 'beam', b, x: b.x, y: b.y, ang: Math.atan2(dy, dx),
          spin: b.spinFlip * (0.62 + Math.min(0.5, S.room * 0.05)),
          len: Math.max(S.aw, S.ah), w: 5, dmg: b.dmg * 1.9,
          t: 3.4, warm: 0.9, col: '#4fd6e8'
        };
        S.haz.push(b.beam);
        A.beam();
      }
    }

  } else if (pat === 'mines') {
    /* THE NIGHT SHELF restocks. It orbits at speed and leaves armed mines
       behind it, so the floor it has already crossed is floor you cannot use —
       the arena shrinks over the fight instead of the boss getting bigger. The
       mines outlive it by design; killing it does not clean up after it.

       Capped at 14 live. Uncapped, a long fight tiles the room and the fight
       stops being about the boss at all. */
    b.orbit += dt * 1.15;
    const R2 = 128;
    const tx2 = p.x + Math.cos(b.orbit) * R2, ty2 = p.y + Math.sin(b.orbit) * R2;
    b.vx = lerp(b.vx, (tx2 - b.x) * 3.0, 1 - Math.pow(0.03, dt));
    b.vy = lerp(b.vy, (ty2 - b.y) * 3.0, 1 - Math.pow(0.03, dt));
    b.dropT -= dt;
    let live = 0;
    for (const h of S.haz) if (h.k === 'mine') live++;
    if (b.dropT <= 0 && live < 14) {
      b.dropT = rnd(0.75, 1.1);
      S.haz.push({ k: 'mine', x: b.x, y: b.y, r: 26, dmg: b.dmg * 0.8,
                   t: 15, life: 15, col: '#8a6aff' });
      part(b.x, b.y, '#8a6aff', 4, 30, 0.3);
    }
    if (b.pt <= 0) {
      // a spread aimed where it is going, not where it is
      b.pt = rnd(1.8, 2.6);
      const aa = Math.atan2(dy, dx);
      for (let k = -1; k <= 1; k++)
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(aa + k * 0.20) * 150, vy: Math.sin(aa + k * 0.20) * 150,
                    r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.4, life: 2.2, col: '#8a6aff' });
      A.nailgun();
    }

  /* ==========================================================
     THE MEAT PROTOCOL — three phases, three different fights.

     Each phase is built to invalidate the answer that got you through the
     last one, which is the only thing that makes a three-phase fight better
     than a two-phase fight with more health:

       p1  it holds the middle and denies the ring — you play at range
       p2  it hunts, fast, and mortars where you are running to — range stops
           working, you have to keep crossing it
       p3  it stops moving and turns two beams while the room floods — there
           is no safe distance left, only safe timing

     It never summons in p3. Adds during a bullet-hell phase is how you make a
     finale unreadable rather than hard.
     ========================================================== */
  } else if (pat === 'p1') {
    /* It sits on the centre of the arena and will not be moved off it. Rings
       go out on a slow beat with an alternating offset, and between them it
       spits a lead shot at you — so the room has a rhythm and you have to hold
       a distance inside it. */
    const cx = S.aw / 2, cy = S.ah / 2;
    b.vx = lerp(b.vx, (cx - b.x) * 1.1, 1 - Math.pow(0.06, dt));
    b.vy = lerp(b.vy, (cy - b.y) * 1.1, 1 - Math.pow(0.06, dt));
    b.spitT = (b.spitT || 0) - dt;
    if (b.spitT <= 0) {
      b.spitT = 0.62;
      const a = Math.atan2(p.y + p.vy * 0.3 - b.y, p.x + p.vx * 0.3 - b.x);
      for (let k = -1; k <= 1; k++)
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a + k * 0.13) * 178, vy: Math.sin(a + k * 0.13) * 178,
                    r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.34, life: 2.4, col: '#ff2b2b' });
    }
    if (b.pt <= 0.6 && b.pt > 0 && Math.random() < dt * 60) { b.poseT = 0.5; part(b.x, b.y, '#ff2b2b', 2, 100, 0.5); }
    if (b.pt <= 0) {
      b.pt = rnd(2.4, 3.0);
      b.novaN = (b.novaN | 0) + 1;
      const n = 26, off = (b.novaN & 1) ? Math.PI / n : 0;
      for (let i = 0; i < n; i++) {
        const a = off + i / n * TAU;
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 124, vy: Math.sin(a) * 124,
                    r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.42, life: 3.4, col: '#ff6a3a' });
      }
      ring(b.x, b.y, 96, '#ff2b2b', 0.5, 3);
      part(b.x, b.y, '#ff8a48', 34, 190, 0.6, 2);
      A.boom(); shake(8); punch(0.035);
    }

  } else if (pat === 'p2') {
    /* It comes off the middle and hunts. Fast, lazy steering — it overcommits
       and has to correct, so it can be juked — and it drops a pair of shells
       on where you are RUNNING TO every couple of seconds, which means juking
       into open floor is exactly the wrong instinct. */
    const sp = Math.min(b.spd * 1.9, 118);
    b.vx = lerp(b.vx, dx / d * sp, 1 - Math.pow(0.32, dt));
    b.vy = lerp(b.vy, dy / d * sp, 1 - Math.pow(0.32, dt));
    if (Math.random() < dt * 30) part(b.x, b.y + 8, '#ff2b2b', 1, 44, 0.5);
    blood(b.x, b.y + 8, 2, 'rgba(90,8,14,0.18)');
    b.spitT = (b.spitT || 0) - dt;
    if (b.spitT <= 0) {
      b.spitT = 1.9;
      for (let k = 0; k < 2; k++) {
        const lead = 0.5 + k * 0.45;
        mortarAt(clamp(p.x + p.vx * lead, 36, S.aw - 36),
                 clamp(p.y + p.vy * lead, 36, S.ah - 36),
                 44, b.dmg * 0.8, 1.25, '#ff2b2b');
      }
      A.magOut();
    }
    if (b.pt <= 0) {
      b.pt = rnd(2.2, 3.0);
      const aa = Math.atan2(b.vy, b.vx);
      for (let k = -4; k <= 4; k++)
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(aa + k * 0.24) * 146, vy: Math.sin(aa + k * 0.24) * 146,
                    r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.36, life: 2.6, col: '#ff8a2b' });
      ring(b.x, b.y, 46, '#ff8a2b', 0.3, 2);
      A.ram();
    }

  } else if (pat === 'p3') {
    /* It plants in the middle for the last time and opens two beams on
       opposite sides, turning slowly, while a thin spiral fills in behind
       them. Two beams 180 degrees apart means there is always exactly one
       safe wedge and it is always moving — the fight becomes a single
       continuous circular run, and the spiral is what stops you from simply
       matching the beam's speed and standing in the gap forever.

       It is the only pattern in the game with no rest beat in it. It is also
       the last thirty seconds of the game. */
    const cx = S.aw / 2, cy = S.ah / 2;
    b.vx = lerp(b.vx, (cx - b.x) * 0.9, 1 - Math.pow(0.05, dt));
    b.vy = lerp(b.vy, (cy - b.y) * 0.9, 1 - Math.pow(0.05, dt));
    let beams = 0;
    for (const h of S.haz) if (h.k === 'beam' && h.b === b) beams++;
    if (!beams) {
      const a0 = Math.atan2(dy, dx);
      for (let k = 0; k < 2; k++)
        S.haz.push({ k: 'beam', b, x: b.x, y: b.y, ang: a0 + k * Math.PI,
                     spin: 0.5, len: Math.max(S.aw, S.ah), w: 5.5,
                     dmg: b.dmg * 2.0, t: 999, warm: 1.2, col: '#ff2b2b' });
      A.beam(); shake(6);
    }
    b.spitAng = (b.spitAng || 0) + dt * 1.5;
    b.spitT = (b.spitT || 0) - dt;
    if (b.spitT <= 0) {
      b.spitT = 0.19;
      for (let k = 0; k < 2; k++) {
        const a = b.spitAng + k * Math.PI + Math.PI / 2;
        S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 96, vy: Math.sin(a) * 96,
                    r: 4, bob: rnd(0, TAU), dmg: b.dmg * 0.30, life: 3.2, col: '#c05cff' });
      }
    }
    if (Math.random() < dt * 20) part(b.x, b.y, '#ff2b2b', 1, 60, 0.6);
  }

  b.x += b.vx * dt; b.y += b.vy * dt;
  collideWalls(b);
  b.x = clamp(b.x, 30, S.aw - 30); b.y = clamp(b.y, 30, S.ah - 30);
}

function updateParticles(dt) {
  for (let i = S.part.length - 1; i >= 0; i--) {
    const q = S.part[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    // sparks shed speed harder than smoke does, which is what makes them snap
    const k = q.drag || 0.92;
    q.vx *= k; q.vy *= k;
    q.life -= dt; if (q.life <= 0) S.part.splice(i, 1);
  }
  for (let i = S.gibs.length - 1; i >= 0; i--) {
    const q = S.gibs[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    // cloth catches the air and flutters down; meat just goes where it was thrown
    if (q.rag) { q.vx *= 0.82; q.vy = q.vy * 0.82 + 26 * dt; q.spin = (q.spin || 0) + dt * 9; }
    else { q.vx *= 0.90; q.vy *= 0.90; }
    q.life -= dt;
    // a scrap of jacket does not leave a bloodstain where it lands
    if (q.life <= 0) { if (!q.rag) blood(q.x, q.y, 3, 'rgba(80,8,14,0.35)'); S.gibs.splice(i, 1); }
  }
  for (let i = S.props.length - 1; i >= 0; i--) {
    const q = S.props[i];
    q.vz -= 420 * dt;
    q.z += q.vz * dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    if (q.z <= 0) { q.z = 0; q.vz *= -0.35; q.vx *= 0.6; q.vy *= 0.6; q.vr *= 0.5; }
    q.vx *= 0.98; q.vy *= 0.98;
    q.life -= dt; if (q.life <= 0) S.props.splice(i, 1);
  }
  for (let i = S.rings.length - 1; i >= 0; i--) { const r = S.rings[i]; r.life -= dt; if (r.life <= 0) S.rings.splice(i, 1); }
  /* ---- soft caps ----
     Nothing in here was bounded, and the effects pass just got a lot more
     generous: every bullet impact now emits sparks and a glow core, and every
     death emits a pop on top of the debris it already had. A chain of
     OVERKILL bursts through a packed floor-10 wave measured over five
     thousand live particles, and the draw loop is linear in all of them.

     Oldest-first, because the oldest are the most faded and the least
     informative — dropping the tail of a burst costs nothing you were
     reading. The numbers are set well above anything normal play reaches
     (a busy wave sits around 300), so this only ever fires on a chain. */
  if (S.part.length > 900) S.part.splice(0, S.part.length - 900);
  if (S.gibs.length > 420) S.gibs.splice(0, S.gibs.length - 420);
  if (S.rings.length > 80) S.rings.splice(0, S.rings.length - 80);
  for (let i = S.floats.length - 1; i >= 0; i--) {
    const f = S.floats[i]; f.y += f.vy * dt; f.vy *= 0.92; f.life -= dt;
    if (f.life <= 0) S.floats.splice(i, 1);
  }
}

function updateCam(dt) {
  const c = S.cam;
  if (S.p) {
    const lookX = (mouse.x - W / 2) * 0.22, lookY = (mouse.y - H / 2) * 0.22;
    c.cx = lerp(c.cx, S.p.x + lookX, 1 - Math.pow(0.0008, dt));
    c.cy = lerp(c.cy, S.p.y + lookY, 1 - Math.pow(0.0008, dt));
  }
  c.punch = Math.max(0, c.punch - dt * 0.42);
  c.z = 1 + c.punch;
  const hw = W / (2 * c.z), hh = H / (2 * c.z);
  c.cx = S.aw > hw * 2 ? clamp(c.cx, hw, S.aw - hw) : S.aw / 2;
  c.cy = S.ah > hh * 2 ? clamp(c.cy, hh, S.ah - hh) : S.ah / 2;
  // Layered sines instead of per-frame randomness: the camera swings and
  // settles rather than vibrating, so rapid fire reads as recoil, not static.
  c.sh = Math.max(0, c.sh - dt * 24);
  c.shPh = (c.shPh || 0) + dt;
  const s = c.sh, ph = c.shPh, sd = c.seed || 0;
  c.shx = (Math.sin(ph * 44 + sd) * 0.66 + Math.sin(ph * 27.7 + sd * 2.3) * 0.34) * s;
  c.shy = (Math.cos(ph * 38.5 + sd * 1.7) * 0.66 + Math.cos(ph * 33.1 + sd) * 0.34) * s;
}

function worldToScreen(x, y) {
  const c = S.cam;
  return { x: (x - c.cx) * c.z + W / 2 + c.shx, y: (y - c.cy) * c.z + H / 2 + c.shy };
}
function screenToWorld(sx, sy) {
  const c = S.cam;
  return { x: (sx - W / 2 - c.shx) / c.z + c.cx, y: (sy - H / 2 - c.shy) / c.z + c.cy };
}

/* ============================================================
   SECRETS
   ============================================================ */
function breakSecret() {
  const s = S.secret;
  s.broken = true;
  shake(14); punch(0.06); S.flash = 0.6; S.flashCol = '#ffdca8'; S.hitstop = 0.2;
  A.crack(); A.secret();
  part(s.x + 5, s.y + 6, '#c9b9a0', 56, 170, 0.9, 2);
  msg('THE WALL OPENS', 'something was left in here for you.', 4);
  dropPickup(s.x + 5, 36, 'god');
}

function triggerModagaz() {
  const c = S.corner;
  c.found = true;
  S.modagazFound++;
  S.modT = 2.6;
  S.cards++;
  S.score += 1500;
  A.modagaz(rnd(400, 470));
  shake(6); punch(0.045);
  S.flash = 0.4; S.flashCol = '#b028ff';
  part(c.x, c.y, '#b028ff', 46, 150, 1.1, 2);
  ring(c.x, c.y, 70, '#b028ff', 0.6, 2);
  float(c.x, c.y - 18, 'MODAGAZ', '#d888ff', true);
  msg('MODAGAZ', '+1 card. do not ask.', 3.2);
  persist();
}

function triggerGoromania() {
  S.goro = true;
  S.goroT = 2.0;                       // two seconds of it, at speed
  S.score += 4000;
  A.goromania(rnd(225, 255));
  shake(10); punch(0.06);
  part(S.p.x, S.p.y, '#b028ff', 50, 180, 1.0, 2);
  persist();
}

/* ============================================================
   FLOW
   ============================================================ */
/* LUCK tilts every hand up the grade ladder. Recomputed whenever the deck
   changes, because CLEARANCE feeds it. */
function recalcLuck() {
  S.luck = dkc('clearance') / 100 + (contractDone('grade') ? 1 : 0)
         + (aisleT1('expired') ? 1 : 0) + (fz('primecut') ? 1 : 0);
}

/* Abandon the run and go back to the title. Everything that persists is
   already persisted continuously (coins, cards, vault, contract counters),
   so this is the death path minus the death: bank it, wipe the run state,
   fade the score out. */
function quitToTitle() {
  persist();
  if (A.music) A.music.stop(0.6);
  A.setDread(0.2);
  freshState();
}

function startRun() {
  freshState();
  S.mode = 'play';
  buildRoom(0);
  S.p = makePlayer();
  applyEvoLoadout();                 // the permanent roster, before anything reads it
  S.p.hp = ST().maxhp;               // a starting ROUGHAGE should be health you have, not a ceiling
  S.cam.cx = S.p.x; S.cam.cy = S.p.y;
  rollRoster();                      // a new order of bosses for a new run
  recalcLuck();
  /* Signed contracts pay out here, at the top of the run. */
  if (contractDone('dozen')) { S.level = 2; S.upgPts = 1; S.lvlDelay = 2.6; }
  if (contractDone('hoard')) { S.coins += 60; persist(); }
  A.init();
  A.setDread(0.2);
  if (A.music) { A.music.setFloor(0); A.music.setBoss(false); A.music.setIntensity(0.15); A.music.start(); }
  msg(roomDef(0).name, roomDef(0).sub, 3.4);
  /* Wave 1 is on GAME time, not wall-clock.
     These were two `setTimeout`s, and that was a real defect rather than a
     style choice. A wall-clock timer keeps running while you are on a menu and
     it fires exactly once: pause, open THE DECK, or sit on a level-up hand
     inside the opening 2.2 seconds and the `S.mode === 'play'` guard threw the
     only wave-1 call the run was ever going to get. The floor then sat there,
     empty, forever — no enemies, no drops, no way back.

     Rare on a cold start, and much less rare after EVOLVE, which drops you
     into a brand new run straight off a menu holding a gun you have every
     reason to want to look at. They are counted down in update() instead,
     which only ticks in play, so pausing pauses them. They also cannot
     accumulate: freshState() clears both, so restarting cannot leave an
     orphaned timer from the run you abandoned pointing at the new one. */
  S.introT = 2.2;
  S.introMsgT = 6.2;
}

function nextRoom() {
  if (S.pending || S.fadeDir) return;
  S.fadeDir = 1;
  const nr = S.room + 1;
  S.pending = () => {
    S.room = nr;
    const R = roomDef(nr);
    buildRoom(nr);
    S.en.length = 0; S.bul.length = 0; S.eb.length = 0; S.drops.length = 0;
    S.gibs.length = 0; S.part.length = 0; S.cracks.length = 0;
    S.nades.length = 0; S.props.length = 0; S.rings.length = 0;
    S.pools.length = 0; S.arcs.length = 0; S.haz.length = 0;
    S.waveKills = 0; S.waveHit = false;
    S.boss = null; S.wave = 0; S.waveState = 'idle';
    S.p.x = S.aw / 2; S.p.y = S.ah - 60; S.p.vx = S.p.vy = 0;
    S.p.hp = Math.min(ST().maxhp, S.p.hp + 30);
    S.p.nades = Math.min(9, S.p.nades + 2);
    S.p.reT = 0;
    S.savesLeft = dkc('seconds');               // one refusal a floor, per rank
    for (const id of S.p.owned) S.p.mags[id] = magCap(WEP[id]);
    S.score += 2500 * nr;
    S.cam.cx = S.p.x; S.cam.cy = S.p.y;
    // A new floor reforges the base rifle.
    S.scarLv++;
    S.glusec = 3.0;
    A.rack(); A.bigpickup();
    msg(R.name, R.sub, 4);
    A.setDread(0.5 + nr * 0.15);
    if (A.music) { A.music.setFloor(nr); A.music.setBoss(false); A.music.setIntensity(0.2 + nr * 0.16); }
    persist();
    S.introT = 2.6;              // game time — see startRun()
    // the new floor's rule lands after its name has finished being read
    S.introMsgT = R.tw ? 4.4 : 0;
    // the weather is the floor's, so it starts over with the floor
    S.twistT = R.twist === 'heat' ? 3.0 : rnd(9, 13);
    S.twistOn = 0; S.twistN = 0;
  };
}

/* ============================================================
   DRAW
   ============================================================ */
function drawWorld() {
  const c = S.cam;
  const R = curRoom();
  const hw = W / (2 * c.z), hh = H / (2 * c.z);
  const vl = c.cx - hw, vt = c.cy - hh, vr = c.cx + hw, vb = c.cy + hh;

  ctx.save();
  ctx.translate(W / 2 + c.shx, H / 2 + c.shy);
  ctx.scale(c.z, c.z);
  ctx.translate(-c.cx, -c.cy);

  blit(ctx, floorCan, 0, 0);
  blit(ctx, decalCan, 0, 0);

  /* ---- floor decor ----
     One shared stain plus a per-floor motif. All of it is two or three
     fillRects at a handful of pixels; the point is not detail, it is that the
     eye can tell floor 5 from floor 8 with the HUD covered up. Everything here
     draws UNDER the walls and the actors, so none of it can hide a threat. */
  for (const d of S.deco) {
    if (d.x < vl || d.x > vr || d.y < vt || d.y > vb) continue;
    const x = d.x | 0, y = d.y | 0, s = d.s;
    switch (d.k) {
      case 'stain':
        ctx.fillStyle = 'rgba(20,8,10,0.35)'; ctx.fillRect(x, y, (6 * s) | 0, (4 * s) | 0); break;
      case 'hook':      // a chain and the hook on the end of it, hanging
        ctx.fillStyle = 'rgba(150,140,124,0.30)'; ctx.fillRect(x, y - (7 * s | 0), 1, (7 * s) | 0);
        ctx.fillStyle = 'rgba(186,176,158,0.42)'; ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 1, y + 2, 2, 1);
        break;
      case 'drip':      // condensation running down nothing
        ctx.fillStyle = 'rgba(150,200,220,0.22)'; ctx.fillRect(x, y, 1, (5 * s) | 0);
        ctx.fillStyle = 'rgba(190,225,240,0.30)'; ctx.fillRect(x, y + (5 * s | 0), 1, 1);
        break;
      case 'rust':      // a bloom of corrosion, dithered outward
        ctx.fillStyle = 'rgba(122,58,26,0.30)'; ctx.fillRect(x, y, (5 * s) | 0, (3 * s) | 0);
        ctx.fillStyle = 'rgba(160,84,36,0.22)'; ctx.fillRect(x - 2, y + 1, 2, 1); ctx.fillRect(x + (5 * s | 0), y, 2, 1);
        break;
      case 'ember':     // a coal that has not gone out, breathing
        ctx.fillStyle = 'rgba(60,20,10,0.40)'; ctx.fillRect(x, y, (4 * s) | 0, (3 * s) | 0);
        ctx.globalAlpha = 0.30 + Math.sin(S.t * 2.2 + d.ph) * 0.22;
        ctx.fillStyle = '#ff7a2a'; ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.globalAlpha = 1; break;
      case 'frost':     // rime, brighter at the centre
        ctx.fillStyle = 'rgba(196,236,255,0.16)'; ctx.fillRect(x - 1, y, (7 * s) | 0, (4 * s) | 0);
        ctx.fillStyle = 'rgba(230,248,255,0.26)'; ctx.fillRect(x + 1, y + 1, (3 * s) | 0, 1);
        break;
      case 'sludge':    // something that dripped and then set
        ctx.fillStyle = 'rgba(52,72,18,0.42)'; ctx.fillRect(x, y, (6 * s) | 0, (3 * s) | 0);
        ctx.fillStyle = 'rgba(122,158,42,0.26)'; ctx.fillRect(x + 1, y - 1, (3 * s) | 0, 1);
        break;
      case 'candle':    // a stub with a flame on it, guttering
        ctx.fillStyle = 'rgba(214,200,170,0.42)'; ctx.fillRect(x, y - 3, 2, 4);
        ctx.globalAlpha = 0.45 + Math.sin(S.t * 5 + d.ph) * 0.3;
        ctx.fillStyle = '#ffc24a'; ctx.fillRect(x, y - 5, 1, 2);
        ctx.globalAlpha = 1; break;
      case 'salt':      // crust, bone-pale, in loose drifts
        ctx.fillStyle = 'rgba(232,226,208,0.20)'; ctx.fillRect(x, y, (5 * s) | 0, 2);
        ctx.fillStyle = 'rgba(248,244,232,0.28)'; ctx.fillRect(x + 2, y - 1, 2, 1);
        break;
      case 'eye':       // it is watching, and it blinks
        ctx.globalAlpha = 0.10 + Math.max(0, Math.sin(S.t * 0.6 + d.ph)) * 0.32;
        ctx.fillStyle = '#c05cff'; ctx.fillRect(x, y, 3, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y, 1, 1);
        ctx.globalAlpha = 1; break;
    }
  }

  drawCornerSigil();

  /* RENDERING's pools sit on the floor, under everything that walks on them.
     Drawn as two stacked ellipses so they read as depth rather than as a
     flat disc, and they shrink as they dry up. */
  for (const q of S.pools) {
    /* A burner that has not caught yet is drawn as an outline that pulses
       faster the closer it is to lighting — the ring IS the timer, so you can
       read how long you have without a number on the screen. */
    if (q.warm > 0) {
      const u = 1 - clamp(q.warm / 1.1, 0, 1);
      ctx.globalAlpha = 0.35 + Math.abs(Math.sin(S.t * (6 + u * 16))) * 0.45;
      ctx.strokeStyle = '#ff8a2b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(q.x, q.y + 3, q.r, q.r * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.14 * u; ctx.fillStyle = '#ff5a1e';
      ctx.beginPath(); ctx.ellipse(q.x, q.y + 3, q.r * u, q.r * 0.55 * u, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    const k = clamp(q.life / q.max, 0, 1), r = q.r * (0.7 + k * 0.3);
    const hot = q.fire;
    ctx.globalAlpha = k * 0.5;
    ctx.fillStyle = hot ? '#5a2408' : '#25400f';
    ctx.beginPath(); ctx.ellipse(q.x, q.y + 3, r, r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = k * (0.35 + Math.sin(S.t * 5 + q.x) * 0.08);
    ctx.fillStyle = hot ? '#ff8a2b' : '#8fdc5a';
    ctx.beginPath(); ctx.ellipse(q.x, q.y + 3, r * 0.66, r * 0.36, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }


  drawHaz(0);          // mortar circles and mines, on the floor with the pools

  /* ---- shockwaves ----
     Rings are the single most reused effect in the game — explosions, novas,
     phase breaks, pickups, aisle rungs, every knockRoom. They used to expand
     LINEARLY and fade linearly, which is why they all read as the same soft
     grey pulse: a real shockwave leaves fast and stops, it does not travel at
     a constant speed.

     Cubic ease-out on the radius, a squared fade on the alpha, and a second
     hot inner edge trailing the leading one — three lines, and every one of
     the two dozen call sites gets sharper for free. The width also thins as
     it goes, so it dissipates instead of just disappearing. */
  ctx.save();
  for (const r of S.rings) {
    const u = clamp(1 - r.life / r.max, 0, 1);
    const ease = 1 - Math.pow(1 - u, 3);
    const rad = lerp(r.r0, r.r1, ease);
    const a = (1 - u) * (1 - u);
    ctx.globalAlpha = a * 0.85;
    ctx.strokeStyle = r.col;
    ctx.lineWidth = Math.max(0.6, r.wid * (1 - u * 0.65));
    ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
    // the leading edge, hotter and thinner, just inside the front
    if (u < 0.55) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - u / 0.55) * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad * 0.94, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  drawPaci();
  drawTomce();
  drawShops();

  /* ---- pickups ----
     Was: one flat translucent disc and the sprite. Now every drop is lit from
     under itself and sits in a small piece of staging — a cast shadow that
     tells you where the FLOOR is (a bobbing sprite with no shadow reads as
     stuck to the camera), an additive pool, and for anything above ammo a slow
     halo ring and a rising mote. The rare things earn a second ring turning
     the other way, so RARE reads as rare from across the room without a label
     on it. */
  for (const d of S.drops) {
    const by = Math.sin(d.bob) * 2;
    const spr = d.kind === 'ammo' ? SPR.ammo : d.kind === 'med' ? SPR.medkit : d.kind === 'god' ? SPR.eye
      : d.kind === 'coin' ? SPR.coin : d.kind === 'card' ? SPR.card : d.kind === 'nade' ? SPR.grenade
      : d.kind === 'shield' ? SPR.shield
      : d.kind === 'frenzy' ? SPR.frenzy : d.kind === 'siphon' ? SPR.siphon
      : d.kind === 'magnet' ? SPR.magnet : d.kind === 'bounty' ? SPR.bounty : SPR.nova;
    const sc = d.kind === 'god' ? 1.6 : d.kind === 'card' ? 1.1 : 1;
    const fade = d.life < 4 && Math.sin(S.t * 18) > 0 ? 0.35 : 1;

    // the shadow shrinks as it rises, which is the whole reason it is there
    ctx.globalAlpha = fade * (0.30 - by * 0.03);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 7, 5.5 * sc - by * 0.4, 2.2 * sc, 0, 0, TAU); ctx.fill();

    /* NO HALO. Every drop used to sit inside a 13px additive disc of its own
       colour, and the rare ones carried two counter-rotating rings and a
       sparkle on top of that. It was a lot of light for a thing that is ten
       pixels wide: the glow was bigger than the item, so what you actually
       read across a room was a coloured blob, and the sprite — which is the
       part that tells you WHICH pickup it is — was the thing you could see
       least. The item is now the whole of it.

       The shadow stays: it is dark, not light, and it is what puts the pickup
       on the floor instead of floating in front of it. The lightmap still
       opens a hole around every drop (see drawLight), so they are lit on a
       dark floor without anything being drawn on top of them. */
    ctx.globalAlpha = 1;
    drawSpr(ctx, spr, d.x, d.y + by, sc, false, fade);
  }

  for (const c2 of S.cracks) {
    const k = 1 - c2.t / 0.75;
    ctx.strokeStyle = 'rgba(200,25,35,' + (0.35 + k * 0.5) + ')';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + c2.x;
      ctx.beginPath(); ctx.moveTo(c2.x, c2.y);
      ctx.lineTo(c2.x + Math.cos(a) * 12 * k, c2.y + Math.sin(a) * 12 * k); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(10,0,2,' + (0.5 * k) + ')';
    ctx.beginPath(); ctx.ellipse(c2.x, c2.y, 9 * k, 5 * k, 0, 0, TAU); ctx.fill();
  }

  for (const q of S.gibs) {
    ctx.globalAlpha = clamp(q.life, 0, 1);
    ctx.fillStyle = q.col;
    if (q.rag) {   // a scrap of cloth is a flat sliver, and it turns as it falls
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.spin || 0);
      ctx.fillRect(-q.s, -0.5, q.s * 2, 1);
      ctx.restore();
    } else ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s);
  }
  ctx.globalAlpha = 1;

  // dropped mags etc.
  for (const q of S.props) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(q.x, q.y, 3, 1.5, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(q.x, q.y - q.z); ctx.rotate(q.rot);
    drawSpr(ctx, q.spr, 0, 0, 1, false, clamp(q.life, 0, 1));
    ctx.restore();
  }

  // where the next frag lands
  if (S.p.nades > 0 && S.mode === 'play') {
    const tg = nadeTarget();
    ctx.strokeStyle = 'rgba(122,163,94,0.42)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, 7 + Math.sin(S.t * 6) * 0.8, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(122,163,94,0.55)';
    ctx.fillRect(tg.x - 1, tg.y - 1, 2, 2);
  }

  // grenades
  for (const g of S.nades) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y, 4, 2, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(g.x, g.y - g.z); ctx.rotate(g.rot);
    drawSpr(ctx, SPR.grenade, 0, 0, 1);
    ctx.restore();
    if (g.fuse < 0.45 && Math.sin(S.t * 40) > 0) {
      ctx.fillStyle = '#ff3b46'; ctx.fillRect((g.x - 1) | 0, (g.y - g.z - 5) | 0, 2, 2);
    }
  }

  const actors = S.en.slice();
  actors.push(S.p);
  actors.sort((a, b) => a.y - b.y);
  const _a0 = performance.now();
  for (const a of actors) { if (a === S.p) drawPlayer(a); else drawEnemy(a); }
  _accAct += performance.now() - _a0;

  /* THE HOOKS. Drawn over the actors — they are on a rail above the floor,
     and they have to stay readable when the ring is inside a crowd. */
  for (const o of S.orbs) {
    if (o.x === undefined) continue;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#ff5a62';
    ctx.beginPath(); ctx.arc(o.x, o.y, 7, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#2a1216'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(o.x, o.y - 4); ctx.lineTo(o.x, o.y + 1);
    ctx.arc(o.x + 2, o.y + 1, 2.4, Math.PI, TAU * 0.75, true); ctx.stroke();
    ctx.strokeStyle = '#d8c8b0'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(o.x, o.y - 4); ctx.lineTo(o.x, o.y + 1);
    ctx.arc(o.x + 2, o.y + 1, 2.4, Math.PI, TAU * 0.75, true); ctx.stroke();
  }
  drawHaz(1);          // sweeping beams, over the top of whatever they are crossing

  // BUTCHER'S BILL's arcs, and anything else that wants a line between two throats
  if (S.arcs.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const a of S.arcs) {
      ctx.globalAlpha = clamp(a.life / 0.16, 0, 1);
      ctx.strokeStyle = a.col; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1);
      ctx.lineTo((a.x1 + a.x2) / 2 + rnd(-5, 5), (a.y1 + a.y2) / 2 + rnd(-5, 5));
      ctx.lineTo(a.x2, a.y2); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  // Bullets glow: soft additive halo, a fat tracer, then a hot white core.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of S.bul) {
    /* THE DELI SLICER's disc. Everything else in here is a tracer — a streak
       back along its own velocity — and a streak is exactly the wrong read for
       a thing that is about to turn round and come back at you. So it is drawn
       as what it is: a wheel, turning, with teeth on it.

       The teeth are the whole point. A plain ring at this size is a bubble;
       six spokes breaking the rim are a saw blade, and they are what tells you
       at a glance which of the two things in the air is yours. `wheel` was
       seeded randomly at the muzzle so a mag dumped in one direction does not
       come back as one rigid rotating object. */
    if (b.blade) {
      const r = b.size * 1.5 + 3;
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = b.col;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        const a = b.wheel + k * TAU / 6;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * r * 0.5, b.y + Math.sin(a) * r * 0.5);
        ctx.lineTo(b.x + Math.cos(a) * (r + 2.2), b.y + Math.sin(a) * (r + 2.2));
        ctx.stroke();
      }
      ctx.fillStyle = '#fffdf2';
      ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, TAU); ctx.fill();
      continue;
    }
    const tx = b.x - b.vx * 0.018, ty = b.y - b.vy * 0.018;
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = b.col; ctx.lineWidth = b.size * 4 + 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = b.size * 2 + 1;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.size * 1.1 + 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffdf2';
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }
  ctx.lineCap = 'butt';
  ctx.restore();
  /* Enemy fire used to be a 3px square that vanished against a lit floor.
     It now carries a bloom, a black rim so it survives any background, a
     saturated ring and a pulsing white core — four layers, all readable. */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of S.eb) {
    const tx = b.x - b.vx * 0.05, ty = b.y - b.vy * 0.05;
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = b.col; ctx.lineWidth = b.r * 2.4;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.globalAlpha = 0.30 + Math.sin(S.t * 15 + b.bob) * 0.11;
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.7, 0, TAU); ctx.fill();
  }
  ctx.lineCap = 'butt';
  ctx.restore();
  for (const b of S.eb) {
    /* A hook in flight is drawn as the chain it is on, back to the fist that
       threw it. Without the line it is one more enemy round and there is no
       reason to read it differently from the twenty others in the air — with
       it, you can see the thing that is about to happen to you. */
    if (b.hook && b.owner && !b.owner.dead) {
      ctx.strokeStyle = 'rgba(30,22,18,0.8)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(b.owner.x, b.owner.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(196,186,166,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.owner.x, b.owner.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const pu = 1 + Math.sin(S.t * 15 + b.bob) * 0.13;
    ctx.fillStyle = 'rgba(4,0,2,0.62)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * pu + 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * pu + 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff4e2';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, TAU); ctx.fill();
  }

  const _q0 = performance.now();
  drawParticles();
  _accPar += performance.now() - _q0;

  drawWalls(R, vl, vt, vr, vb);
  drawDoor();
  drawSecret();

  ctx.font = '8px ' + GAME_FONT;
  ctx.textAlign = 'center';
  for (const f of S.floats) {
    ctx.globalAlpha = clamp(f.life * 1.6, 0, 1);
    ctx.font = (f.big ? 11 : 8) + 'px ' + GAME_FONT;
    ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  ctx.restore();
}

/* PACI. Drawn at 3.6x against Damjan's 1x — he is meant to be absurd. */
function drawPaci() {
  const q = S.paci;
  if (!q) return;
  const mad = q.anger | 0;
  // when he is angry his breathing goes shallow and fast, and he shakes with it
  const breath = Math.sin(S.t * (mad ? 5.5 + mad * 3 : 1.4));
  const bank = mad > 1 ? [SPR.paciDone, SPR.paciDone2] : mad ? [SPR.paciMad, SPR.paciMad2]
                                                            : [SPR.paci, SPR.paci2];
  const spr = breath > 0 ? bank[1] : bank[0];
  const jx = mad ? rnd(-mad, mad) : 0, jy = mad ? rnd(-mad, mad) : 0;
  const y = q.y + breath * (mad ? 0.9 : 1.6) + jy;

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(q.x, q.y + 50, 46, 12, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = mad ? 0.22 + Math.sin(S.t * 11) * 0.10 : 0.10 + Math.sin(S.t * 2) * 0.035;
  ctx.fillStyle = mad ? '#ff2b2b' : '#c05cff';
  ctx.beginPath(); ctx.arc(q.x, q.y, mad ? 104 + mad * 22 : 82, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  drawSpr(ctx, spr, q.x + jx, y, 3.6);

  const line = mad > 1 ? 'YOU ARE LEAVING NOW'
             : mad ? 'PUT IT DOWN. I WILL NOT ASK TWICE.'
             : S.shops.length ? 'HELLO TRAVELER, WELCOME TO MY SHOP'
                              : 'NOTHING LEFT. COME BACK WHEN I RESTOCK.';
  const col = mad ? ['#ff9a9a', '#ffd0d0'] : ['#c8a8e0', '#e8c8ff'];
  ctx.font = '8px ' + GAME_FONT; ctx.textAlign = 'center';
  const tw = ctx.measureText(line).width;
  ctx.fillStyle = mad ? 'rgba(24,2,4,0.88)' : 'rgba(10,4,16,0.82)';
  ctx.fillRect(q.x - tw / 2 - 6, q.y - 74, tw + 12, 22);
  ctx.fillStyle = mad ? 'rgba(255,43,43,0.75)' : 'rgba(176,92,255,0.55)';
  ctx.fillRect(q.x - tw / 2 - 6, q.y - 74, tw + 12, 1);
  ctx.fillRect(q.x - tw / 2 - 6, q.y - 53, tw + 12, 1);
  ctx.fillStyle = col[1]; ctx.fillText('PACI', q.x, q.y - 65);
  ctx.fillStyle = col[0]; ctx.fillText(line, q.x, q.y - 57);
  ctx.textAlign = 'left';
}

function drawShops() {
  for (const sh of S.shops) {
    const w = WEP[sh.id];
    drawSpr(ctx, SPR.pedestal, sh.x, sh.y + 2, 1);
    if (sh.bought) continue;
    const by = Math.sin(sh.bob) * 2.2;
    const gr = GRADE[w.gr];
    /* How hard it shines is how good it is — you can read the grade of a gun
       from the doorway before you can read the price. */
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + gr.glow / 28 * 0.34 + Math.sin(S.t * 4 + sh.bob) * 0.07;
    ctx.fillStyle = gr.col;
    ctx.beginPath(); ctx.arc(sh.x, sh.y - 14 + by, 15 + gr.glow * 0.7, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.22 + Math.sin(S.t * 4 + sh.bob) * 0.08;
    ctx.fillStyle = w.col;
    ctx.beginPath(); ctx.arc(sh.x, sh.y - 14 + by, 15, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (w.gr >= 2) {
      // a slow ring of sparks, one per rarity rung above UNCOMMON
      for (let k = 0; k < w.gr - 1; k++) {
        const a = S.t * (0.8 + k * 0.4) + k * 2.1;
        ctx.fillStyle = gr.col;
        ctx.fillRect((sh.x + Math.cos(a) * 20) | 0, (sh.y - 14 + by + Math.sin(a) * 9) | 0, 1, 1);
      }
    }
    drawSpr(ctx, w.spr, sh.x, sh.y - 14 + by, 1.15, false, 1);
    ctx.font = '6px ' + GAME_FONT; ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(gr.n, sh.x + 1, sh.y + 8);
    ctx.fillStyle = gr.col; ctx.fillText(gr.n, sh.x, sh.y + 7);
    ctx.font = '7px ' + GAME_FONT; ctx.textAlign = 'center';
    const cost = sh.cards ? sh.cards + ' CARDS' : sh.price + '';
    const ok = sh.cards ? S.cards >= sh.cards : S.coins >= sh.price;
    ctx.fillStyle = '#000'; ctx.fillText(cost, sh.x + 1, sh.y + 17);
    ctx.fillStyle = ok ? '#f5c518' : '#8a5a5a'; ctx.fillText(cost, sh.x, sh.y + 16);
    if (!sh.cards) drawSpr(ctx, SPR.coin, sh.x - ctx.measureText(cost).width / 2 - 6, sh.y + 13, 0.7);
    ctx.textAlign = 'left';
  }
}

function drawCornerSigil() {
  const c = S.corner;
  if (!c) return;
  if (c.found) {
    ctx.globalAlpha = 0.55 + Math.sin(S.t * 3) * 0.2;
    drawSpr(ctx, SPR.sigil, c.x, c.y, 1.2);
    ctx.globalAlpha = 1;
    return;
  }
  // barely there until you are almost standing on it
  ctx.globalAlpha = 0.055 + c.pulse * 0.75 + Math.sin(S.t * 2.2) * 0.03;
  drawSpr(ctx, SPR.sigil, c.x, c.y, 1);
  ctx.globalAlpha = 1;
  if (c.pulse > 0.4 && Math.random() < 0.25) part(c.x + rnd(-6, 6), c.y + rnd(-6, 6), '#b028ff', 1, 14, 0.5);
}

/* ============================================================
   THE PROP LIBRARY

   Every obstacle in the arena used to be the same object: a brick-textured
   rectangle, with a red rectangle inside it if it happened to be a "vat". Ten
   floors of that is ten floors of the same room in ten palettes — the level
   design was already doing its job (each floor has a fixed layout archetype),
   but nothing you could SEE told you which building you were in.

   So obstacles now have a KIND, drawn by one of the entries below, and each
   floor draws its kinds from its own short list (FLOOR_PROPS). The rules every
   prop obeys, because they are gameplay objects before they are decoration:

     · it FILLS its rect. The collision box is the rect; a prop that draws
       smaller than its box is a lie you walk into.
     · it has a dark base edge and a lit top edge, always in the same
       direction, so a room of mixed props still reads as one lit space.
     · it is legible at 1px. No detail smaller than a pixel, no detail that
       only resolves when you stand on it.
     · nothing animates fast enough to be mistaken for a threat. Flame
       flickers, liquid ripples, lamps pulse — all slow.

   `lit` marks the props that put light into the room; drawLight reads it. */
const PROPS = {

  /* ---- containers ---- */
  crate(w, R) {                             // slatted wood, iron banding
    box(w, '#5a4028', '#7a5a38', '#2c1d10');
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = w.y + 4; y < w.y + w.h - 3; y += 5) ctx.fillRect(w.x + 1, y, w.w - 2, 1);
    ctx.fillStyle = 'rgba(230,210,170,0.10)';
    for (let y = w.y + 5; y < w.y + w.h - 3; y += 5) ctx.fillRect(w.x + 1, y, w.w - 2, 1);
    // corner brackets
    ctx.fillStyle = '#3a3038';
    ctx.fillRect(w.x + 1, w.y + 1, 3, 3); ctx.fillRect(w.x + w.w - 4, w.y + 1, 3, 3);
    ctx.fillRect(w.x + 1, w.y + w.h - 5, 3, 3); ctx.fillRect(w.x + w.w - 4, w.y + w.h - 5, 3, 3);
  },

  barrel(w, R) {                            // a drum, ribbed, lid on top
    box(w, '#3f4a3a', '#5c6a52', '#1c231a');
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(w.x + 1, w.y + Math.round(w.h * 0.32), w.w - 2, 2);
    ctx.fillRect(w.x + 1, w.y + Math.round(w.h * 0.66), w.w - 2, 2);
    ctx.fillStyle = 'rgba(220,230,210,0.13)';
    ctx.fillRect(w.x + 1, w.y + Math.round(w.h * 0.32) + 2, w.w - 2, 1);
    // rust running down from the top rib
    ctx.fillStyle = 'rgba(140,68,26,0.35)';
    ctx.fillRect(w.x + 3, w.y + Math.round(w.h * 0.34), 1, Math.round(w.h * 0.3));
    ctx.fillRect(w.x + w.w - 6, w.y + Math.round(w.h * 0.34), 1, Math.round(w.h * 0.2));
    // lid
    ctx.fillStyle = '#6e7d64'; ctx.fillRect(w.x + 2, w.y + 1, w.w - 4, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(w.x + 2, w.y + 4, w.w - 4, 1);
  },

  vat(w, R) {                               // open tank, floor-coloured contents
    box(w, '#3a3640', '#585062', '#191622');
    const c = R.vat || '#78121a';
    const iy = w.y + 4, ih = w.h - 8;
    ctx.globalAlpha = 0.62; ctx.fillStyle = c;
    ctx.fillRect(w.x + 3, iy, w.w - 6, ih);
    // two crossing ripples, slow, so it reads as liquid and not as a pattern
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffffff';
    ctx.fillRect(w.x + 3, iy + 2 + Math.sin(S.t * 1.4 + w.x * 0.1) * (ih * 0.2), w.w - 6, 1);
    ctx.fillRect(w.x + 3, iy + ih * 0.6 + Math.sin(S.t * 1.1 + w.y * 0.1) * (ih * 0.15), w.w - 6, 1);
    ctx.globalAlpha = 1;
    // rim
    ctx.fillStyle = '#6a6478'; ctx.fillRect(w.x + 1, w.y + 2, w.w - 2, 2);
  },

  sacks(w, R) {                             // stacked sacks on a pallet
    box(w, '#4a4030', '#655840', '#241e14');
    ctx.fillStyle = '#7a6a4e';
    for (let y = w.y + 3; y < w.y + w.h - 6; y += 7)
      for (let x = w.x + 3; x < w.x + w.w - 5; x += 9) {
        ctx.fillRect(x, y, 7, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + 4, 7, 1);
        ctx.fillStyle = 'rgba(240,224,190,0.14)'; ctx.fillRect(x, y, 7, 1);
        ctx.fillStyle = '#7a6a4e';
      }
    ctx.fillStyle = '#3a3020';                 // the pallet under it
    ctx.fillRect(w.x, w.y + w.h - 5, w.w, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let x = w.x + 2; x < w.x + w.w; x += 6) ctx.fillRect(x, w.y + w.h - 5, 1, 5);
  },

  /* ---- cold ---- */
  freezer(w, R) {                           // chest freezer, frosted lid, lit
    box(w, '#4a5860', '#6e828c', '#1e2830');
    ctx.fillStyle = 'rgba(190,236,255,0.20)';
    ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, Math.max(4, w.h - 12));
    ctx.fillStyle = 'rgba(230,248,255,0.30)';
    ctx.fillRect(w.x + 4, w.y + 4, w.w - 8, 1);
    // the cold coming off it, breathing
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.10 + Math.sin(S.t * 1.3 + w.x) * 0.05;
    ctx.fillStyle = '#bfefff';
    ctx.fillRect(w.x - 3, w.y - 2, w.w + 6, w.h + 4);
    ctx.restore();
    ctx.fillStyle = '#8aa8b8'; ctx.fillRect(w.x + 4, w.y + w.h - 7, w.w - 8, 2);   // handle
  },

  icewall(w, R) {                           // a block of it, cracked through
    ctx.fillStyle = '#5d7f8e'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = 'rgba(200,240,255,0.30)'; ctx.fillRect(w.x, w.y, w.w, w.h - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.40)'; ctx.fillRect(w.x, w.y, w.w, 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {                 // frozen-in fractures
      ctx.beginPath();
      let cx = w.x + ((k * 37 + w.x) % Math.max(1, w.w)), cy = w.y + 2;
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 3; s++) { cx += ((k + s) % 2 ? 4 : -3); cy += w.h / 3; ctx.lineTo(cx, cy); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
  },

  /* ---- heat ---- */
  brazier(w, R) {                           // a fire drum. the brightest thing in a room.
    box(w, '#3a2a22', '#523a2c', '#1a1010');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(w.x + 1, w.y + Math.round(w.h * 0.55), w.w - 2, 2);
    // coals
    ctx.fillStyle = '#8a2a08'; ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, 4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const ph = S.t * (3.4 + k) + w.x * 0.3 + k;
      const fh = 5 + Math.abs(Math.sin(ph)) * 7;
      ctx.globalAlpha = 0.30 + Math.sin(ph * 1.7) * 0.12;
      ctx.fillStyle = k === 0 ? '#ff4a10' : k === 1 ? '#ff9a2a' : '#ffe08a';
      const fw = (w.w - 8) * (1 - k * 0.24);
      ctx.fillRect(w.x + 4 + ((w.w - 8) - fw) / 2, w.y + 4 - fh, fw, fh);
    }
    ctx.globalAlpha = 0.13 + Math.sin(S.t * 2.6 + w.x) * 0.05;
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(w.x - 10, w.y - 12, w.w + 20, w.h + 22);
    ctx.restore(); ctx.globalAlpha = 1;
    if (Math.random() < 0.30) part(w.x + rnd(4, w.w - 4), w.y + 2, pick(['#ff9a2a', '#ffd05a']), 1, 24, 1.1);
  },

  candles(w, R) {                           // a table of them, guttering
    box(w, '#40301c', '#5c4628', '#1e1610');
    ctx.fillStyle = 'rgba(240,220,180,0.10)'; ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let x = w.x + 5; x < w.x + w.w - 3; x += 8) {
      const ph = S.t * 4.5 + x;
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(x, w.y - 4, 2, 6);
      ctx.globalAlpha = 0.55 + Math.sin(ph) * 0.25;
      ctx.fillStyle = '#ffc24a'; ctx.fillRect(x, w.y - 7 + (Math.sin(ph) > 0 ? 0 : 1), 2, 3);
      ctx.globalAlpha = 0.10; ctx.fillStyle = '#ffb03a';
      ctx.fillRect(x - 9, w.y - 15, 20, 24);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  },

  /* ---- machinery ---- */
  machine(w, R) {                           // an industrial unit with a status lamp
    box(w, '#3c4048', '#565c68', '#171a20');
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(w.x + 3, w.y + 4, w.w - 6, Math.max(3, w.h * 0.4));
    ctx.fillStyle = 'rgba(190,205,225,0.10)'; ctx.fillRect(w.x + 3, w.y + 4, w.w - 6, 1);
    // vents
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let x = w.x + 5; x < w.x + w.w - 5; x += 3) ctx.fillRect(x, w.y + w.h - 9, 1, 4);
    // the lamp, slow, never fast enough to look like a threat
    const on = (Math.sin(S.t * 1.6 + w.x * 0.2) + 1) / 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + on * 0.5; ctx.fillStyle = '#4fd6e8';
    ctx.fillRect(w.x + w.w - 6, w.y + 3, 3, 3);
    ctx.globalAlpha = 0.06 + on * 0.07;
    ctx.fillRect(w.x + w.w - 14, w.y - 5, 19, 18);
    ctx.restore(); ctx.globalAlpha = 1;
  },

  pipes(w, R) {                             // a bank of them, with valve wheels
    ctx.fillStyle = '#232a30'; ctx.fillRect(w.x, w.y, w.w, w.h);
    for (let x = w.x + 2; x < w.x + w.w - 2; x += 7) {
      ctx.fillStyle = '#4a565e'; ctx.fillRect(x, w.y, 5, w.h);
      ctx.fillStyle = 'rgba(190,215,230,0.20)'; ctx.fillRect(x, w.y, 1, w.h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 4, w.y, 1, w.h);
      // a coupling band partway down
      ctx.fillStyle = '#65727c';
      ctx.fillRect(x - 1, w.y + Math.round(w.h * 0.45), 7, 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2);
    // one dripping joint, in slow time
    if (Math.random() < 0.02) part(w.x + w.w / 2, w.y + w.h, 'rgba(150,200,220,0.7)', 1, 8, 1.4);
  },

  cage(w, R) {                              // wire mesh, empty. probably.
    ctx.fillStyle = 'rgba(10,8,12,0.72)'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#5a6068';
    ctx.fillRect(w.x, w.y, w.w, 2); ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2);
    ctx.fillRect(w.x, w.y, 2, w.h); ctx.fillRect(w.x + w.w - 2, w.y, 2, w.h);
    ctx.fillStyle = 'rgba(140,150,160,0.30)';
    for (let x = w.x + 4; x < w.x + w.w - 2; x += 5) ctx.fillRect(x, w.y + 2, 1, w.h - 4);
    for (let y = w.y + 4; y < w.y + w.h - 2; y += 5) ctx.fillRect(w.x + 2, y, w.w - 4, 1);
    ctx.fillStyle = 'rgba(220,230,240,0.16)'; ctx.fillRect(w.x, w.y, w.w, 1);
  },

  shelf(w, R) {                             // wire shelving with stock still on it
    ctx.fillStyle = '#2a2630'; ctx.fillRect(w.x, w.y, w.w, w.h);
    const rows = Math.max(2, Math.floor(w.h / 11));
    for (let r = 0; r < rows; r++) {
      const y = w.y + 3 + r * ((w.h - 5) / rows);
      // the goods, then the shelf they sit on
      ctx.fillStyle = ['#7a5a38', '#4a6a52', '#6a4a5a', '#5a5a70'][r % 4];
      for (let x = w.x + 3; x < w.x + w.w - 5; x += 8) {
        if (((x + r * 13) | 0) % 3 === 0) continue;      // gaps, so it is not a wall
        ctx.fillRect(x, y - 5, 6, 5);
        ctx.fillStyle = 'rgba(255,240,220,0.12)'; ctx.fillRect(x, y - 5, 6, 1);
        ctx.fillStyle = ['#7a5a38', '#4a6a52', '#6a4a5a', '#5a5a70'][r % 4];
      }
      ctx.fillStyle = '#6a6e78'; ctx.fillRect(w.x + 1, y, w.w - 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(w.x + 1, y + 2, w.w - 2, 1);
    }
    ctx.fillStyle = '#454a54';                                // uprights
    ctx.fillRect(w.x, w.y, 2, w.h); ctx.fillRect(w.x + w.w - 2, w.y, 2, w.h);
  },

  till(w, R) {                              // a checkout unit, screen still lit
    box(w, '#3a3a44', '#54545e', '#18181e');
    ctx.fillStyle = '#1a2a22'; ctx.fillRect(w.x + 3, w.y + 3, Math.max(6, w.w - 10), Math.max(4, w.h * 0.4));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.30 + Math.sin(S.t * 0.8 + w.x) * 0.10;
    ctx.fillStyle = '#6ede7a';
    ctx.fillRect(w.x + 4, w.y + 4, Math.max(4, w.w - 12), 1);
    ctx.fillRect(w.x + 4, w.y + 7, Math.max(3, (w.w - 14) * 0.6), 1);
    ctx.globalAlpha = 0.07; ctx.fillRect(w.x - 6, w.y - 5, w.w + 12, w.h + 12);
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#6a6a76'; ctx.fillRect(w.x + 2, w.y + w.h - 6, w.w - 4, 3);   // the belt
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = w.x + 3; x < w.x + w.w - 3; x += 4) ctx.fillRect(x, w.y + w.h - 6, 1, 3);
  },

  /* ---- the abattoir's own ---- */
  carcass(w, R) {                           // something hung on a rail, still dripping
    ctx.fillStyle = '#3a3238'; ctx.fillRect(w.x, w.y, w.w, 3);          // the rail
    ctx.fillStyle = 'rgba(220,225,235,0.20)'; ctx.fillRect(w.x, w.y, w.w, 1);
    const bx = w.x + 2, bw = w.w - 4, by = w.y + 5, bh = w.h - 6;
    ctx.fillStyle = '#5e2830'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#7d3640'; ctx.fillRect(bx, by, bw, Math.max(2, bh - 5));
    ctx.fillStyle = 'rgba(240,190,190,0.16)'; ctx.fillRect(bx, by, bw, 1);
    // ribs
    ctx.fillStyle = 'rgba(225,215,200,0.30)';
    for (let y = by + 3; y < by + bh - 2; y += 5) ctx.fillRect(bx + 2, y, bw - 4, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx, by + bh - 3, bw, 3);
    // hooks holding it up
    ctx.fillStyle = '#8a8fa0';
    ctx.fillRect(bx + 3, w.y + 2, 1, 4); ctx.fillRect(bx + bw - 4, w.y + 2, 1, 4);
    if (Math.random() < 0.012) part(bx + rnd(2, bw - 2), by + bh, 'rgba(120,16,22,0.8)', 1, 6, 1.6);
  },

  slab(w, R) {                              // poured concrete. the honest one.
    box(w, '#4a4a4e', '#63636a', '#1e1e22');
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    for (let k = 0; k < 3; k++) {
      const x = w.x + 3 + ((k * 29 + w.x) % Math.max(1, w.w - 6));
      ctx.fillRect(x, w.y + 3 + (k % 2) * 4, 1, Math.max(3, w.h - 10));
    }
    ctx.fillStyle = 'rgba(255,250,240,0.06)';
    ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, 1);
  },

  table(w, R) {                             // a working table, cloth over the end
    box(w, '#4c3a26', '#6c5236', '#20180e');
    ctx.fillStyle = 'rgba(250,240,220,0.12)'; ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    for (let x = w.x + 4; x < w.x + w.w - 2; x += 6) ctx.fillRect(x, w.y + 2, 1, w.h - 6);
    // the cloth
    ctx.fillStyle = '#9a8a72';
    ctx.fillRect(w.x + 2, w.y + Math.round(w.h * 0.5), Math.round(w.w * 0.45), Math.round(w.h * 0.4));
    ctx.fillStyle = 'rgba(120,20,26,0.35)';
    ctx.fillRect(w.x + 4, w.y + Math.round(w.h * 0.6), Math.round(w.w * 0.25), 3);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
  },

  bones(w, R) {                             // a heap. not stacked — heaped.
    ctx.fillStyle = 'rgba(20,16,14,0.55)'; ctx.fillRect(w.x, w.y + 2, w.w, w.h - 2);
    for (let k = 0; k < Math.max(4, (w.w * w.h) / 170); k++) {
      const x = w.x + ((k * 41 + w.x * 7) % Math.max(1, w.w - 6));
      const y = w.y + 2 + ((k * 27 + w.y * 5) % Math.max(1, w.h - 5));
      const horiz = (k + w.x) % 2;
      ctx.fillStyle = k % 3 ? '#c8bfa8' : '#a89b84';
      if (horiz) { ctx.fillRect(x, y, 6, 2); ctx.fillRect(x - 1, y - 1, 2, 4); ctx.fillRect(x + 5, y - 1, 2, 4); }
      else { ctx.fillRect(x, y, 2, 6); ctx.fillRect(x - 1, y - 1, 4, 2); ctx.fillRect(x - 1, y + 5, 4, 2); }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(w.x, w.y + w.h - 2, w.w, 2);
  },

  saltpile(w, R) {                          // crust, drifted up against itself
    ctx.fillStyle = '#6a6558'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#cfc9b4'; ctx.fillRect(w.x, w.y, w.w, Math.max(2, w.h - 5));
    ctx.fillStyle = '#eae5d2';
    for (let x = w.x; x < w.x + w.w; x += 3)
      ctx.fillRect(x, w.y + 1 + (((x * 13) % 5) | 0), 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.30)'; ctx.fillRect(w.x, w.y, w.w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.40)'; ctx.fillRect(w.x, w.y + w.h - 4, w.w, 4);
  },

  sludge(w, R) {                            // a tank of something that is still working
    box(w, '#2e3a20', '#44562e', '#141a0e');
    const c = R.vat || '#4a6a12';
    ctx.globalAlpha = 0.55; ctx.fillStyle = c;
    ctx.fillRect(w.x + 3, w.y + 4, w.w - 6, w.h - 9);
    ctx.globalAlpha = 0.30 + Math.sin(S.t * 1.1 + w.x) * 0.08;
    ctx.fillStyle = '#a8dc4a';
    // bubbles, rising on their own clocks
    for (let k = 0; k < 3; k++) {
      const ph = (S.t * (0.4 + k * 0.12) + k * 0.4 + w.x * 0.03) % 1;
      const bx = w.x + 5 + ((k * 17 + w.x) % Math.max(1, w.w - 10));
      ctx.fillRect(bx, w.y + w.h - 5 - ph * (w.h - 10), 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a6a3a'; ctx.fillRect(w.x + 1, w.y + 2, w.w - 2, 2);
  }
};

/* Every prop shares this: a body, a lit top edge, a dark base. Doing it once
   is what keeps twenty props looking like one art pass instead of twenty. */
function box(w, body, top, base) {
  ctx.fillStyle = body; ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = top; ctx.fillRect(w.x, w.y, w.w, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(w.x, w.y, 1, w.h);
  ctx.fillStyle = base; ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(w.x + w.w - 1, w.y, 1, w.h);
}

/* Which props each floor is furnished with. Three or four kinds each, chosen
   so the floor's NAME is legible from its contents: you should be able to tell
   THE FREEZER from THE LONG TABLE with the HUD covered. */
const FLOOR_PROPS = [
  ['crate', 'barrel', 'carcass', 'slab', 'vat'],     //  1 THE ABATTOIR
  ['pipes', 'slab', 'cage', 'crate'],                //  2 THE HOLLOW
  ['machine', 'barrel', 'pipes', 'crate', 'vat'],    //  3 THE MEAT LOOP
  ['brazier', 'table', 'machine', 'crate'],          //  4 THE RED KITCHEN
  ['freezer', 'icewall', 'shelf', 'crate'],          //  5 THE FREEZER
  ['vat', 'sludge', 'barrel', 'machine'],            //  6 THE RENDERING
  ['table', 'candles', 'shelf', 'crate'],            //  7 THE LONG TABLE
  ['saltpile', 'bones', 'slab', 'shelf'],            //  8 THE SALT LINE
  ['shelf', 'till', 'cage', 'sacks'],                //  9 THE LAST AISLE
  ['carcass', 'slab', 'brazier', 'machine']          // 10 THE KILLING FLOOR
];
function propKinds(floor) { return FLOOR_PROPS[clamp(floor | 0, 0, FLOOR_PROPS.length - 1)]; }
/* The props that put light into the room. drawLight reads this — a brazier
   that glows but does not lift the darkness around it looks painted on. */
const LIT_PROPS = { brazier: 34, candles: 26, freezer: 22, machine: 18, till: 18, sludge: 14 };

/* ---- the walls the room is made of ----
   Five treatments rather than one brick. The border wall is the biggest single
   surface on screen and it was the same brick on all ten floors, which quietly
   undid every palette change: you can repaint brick and it is still brick. */
const WALL_STYLE = ['brick', 'panel', 'brick', 'tile', 'panel',
                    'concrete', 'panel', 'tile', 'rack', 'brick'];
function wallStyle(floor) { return WALL_STYLE[clamp(floor | 0, 0, WALL_STYLE.length - 1)]; }

function drawWalls(R, vl, vt, vr, vb) {
  const style = S.inShop ? 'brick' : wallStyle(S.room);
  for (const w of S.walls) {
    if (w.x > vr || w.x + w.w < vl || w.y > vb || w.y + w.h < vt) continue;

    /* An obstacle is a PROP; only the four border walls are wall. Guarded on
       the kind existing so a stale save or an unknown kind falls back to a
       crate rather than throwing inside the draw loop. */
    if (w.obs) { (PROPS[w.kind] || PROPS.crate)(w, R); continue; }

    ctx.fillStyle = R.wall[1]; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = R.wall[0]; ctx.fillRect(w.x, w.y, w.w, Math.max(2, w.h - 4));

    if (style === 'brick') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = w.y; y < w.y + w.h; y += 6) ctx.fillRect(w.x, y, w.w, 1);
      for (let y = w.y, k = 0; y < w.y + w.h; y += 6, k++)
        for (let x = w.x + (k % 2 ? 0 : 6); x < w.x + w.w; x += 12) ctx.fillRect(x, y, 1, 6);

    } else if (style === 'tile') {
      // glazed square tile with a bright grout lip — a kitchen, a mortuary
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = w.y; y < w.y + w.h; y += 8) ctx.fillRect(w.x, y, w.w, 1);
      for (let x = w.x; x < w.x + w.w; x += 8) ctx.fillRect(x, w.y, 1, w.h);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (let y = w.y + 1; y < w.y + w.h; y += 8) ctx.fillRect(w.x, y, w.w, 1);
      for (let x = w.x + 1; x < w.x + w.w; x += 8) ctx.fillRect(x, w.y, 1, w.h);

    } else if (style === 'panel') {
      // riveted steel plate: wide panels, seams, a rivet line down each seam
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      for (let x = w.x; x < w.x + w.w; x += 22) ctx.fillRect(x, w.y, 2, w.h);
      for (let y = w.y; y < w.y + w.h; y += 22) ctx.fillRect(w.x, y, w.w, 2);
      ctx.fillStyle = 'rgba(230,240,255,0.10)';
      for (let x = w.x + 2; x < w.x + w.w; x += 22) ctx.fillRect(x, w.y, 1, w.h);
      ctx.fillStyle = 'rgba(200,215,235,0.18)';
      for (let x = w.x + 5; x < w.x + w.w; x += 22)
        for (let y = w.y + 5; y < w.y + w.h; y += 7) ctx.fillRect(x, y, 1, 1);

    } else if (style === 'concrete') {
      // poured, with form-tie holes and staining down from them
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = w.y; y < w.y + w.h; y += 14) ctx.fillRect(w.x, y, w.w, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      for (let x = w.x + 9; x < w.x + w.w; x += 26)
        for (let y = w.y + 7; y < w.y + w.h; y += 14) {
          ctx.fillRect(x, y, 2, 2);
          ctx.globalAlpha = 0.35; ctx.fillRect(x, y + 2, 1, 5); ctx.globalAlpha = 1;
        }

    } else {                                    // 'rack' — shelving, back-of-house
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      for (let y = w.y + 3; y < w.y + w.h; y += 9) ctx.fillRect(w.x, y, w.w, 2);
      ctx.fillStyle = 'rgba(210,200,230,0.10)';
      for (let y = w.y + 3; y < w.y + w.h; y += 9) ctx.fillRect(w.x, y - 1, w.w, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let x = w.x + 6; x < w.x + w.w; x += 18) ctx.fillRect(x, w.y, 2, w.h);
    }

    ctx.fillStyle = R.wall[2]; ctx.fillRect(w.x, w.y, w.w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
  }
}

function drawDoor() {
  const d = S.door;
  if (d.open && d.exit) {
    // the shop's way out: south wall, purple, spills its light upward
    const g = ctx.createLinearGradient(0, d.y + d.h, 0, d.y - 26);
    g.addColorStop(0, 'rgba(176,92,255,0.85)'); g.addColorStop(1, 'rgba(176,92,255,0)');
    ctx.fillStyle = g; ctx.fillRect(d.x, d.y - 26, d.w, d.h + 26);
    ctx.fillStyle = '#0e0614'; ctx.fillRect(d.x + 3, d.y + 2, d.w - 6, d.h - 2);
    ctx.fillStyle = 'rgba(210,150,255,' + (0.5 + Math.sin(S.t * 4) * 0.3) + ')';
    ctx.fillRect(d.x + 3, d.y + 2, d.w - 6, 2);
    ctx.font = '8px ' + GAME_FONT; ctx.textAlign = 'center';
    ctx.fillStyle = '#d8a8ff'; ctx.fillText('BACK', d.x + d.w / 2, d.y - 8);
    ctx.textAlign = 'left';
  } else if (d.open) {
    const g = ctx.createLinearGradient(0, d.y, 0, d.y + d.h + 26);
    g.addColorStop(0, 'rgba(255,60,70,0.85)'); g.addColorStop(1, 'rgba(255,60,70,0)');
    ctx.fillStyle = g; ctx.fillRect(d.x, d.y, d.w, d.h + 26);
    ctx.fillStyle = '#12060a'; ctx.fillRect(d.x + 3, d.y, d.w - 6, d.h - 2);
    ctx.fillStyle = 'rgba(255,110,120,' + (0.5 + Math.sin(S.t * 4) * 0.3) + ')';
    ctx.fillRect(d.x + 3, d.y + d.h - 4, d.w - 6, 2);
    ctx.font = '8px ' + GAME_FONT; ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8a90'; ctx.fillText('DOWN', d.x + d.w / 2, d.y + d.h + 16);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(d.x + 4, d.y + 4, d.w - 8, d.h - 8);
    ctx.fillStyle = 'rgba(60,20,24,0.9)'; ctx.fillRect(d.x + 6, d.y + 6, d.w - 12, d.h - 12);
  }
}

function drawSecret() {
  const s = S.secret;
  if (!s) return;
  if (!s.broken) {
    ctx.fillStyle = '#3a2b26'; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(s.x, s.y, s.w, 1); ctx.fillRect(s.x, s.y + s.h - 1, s.w, 1);
    const dmg = s.hits / s.need;
    if (dmg > 0) {
      ctx.strokeStyle = 'rgba(10,0,0,' + (0.3 + dmg * 0.7) + ')'; ctx.lineWidth = 1;
      for (let i = 0; i < Math.ceil(dmg * 6); i++) {
        ctx.beginPath(); ctx.moveTo(s.x + 1 + i * 1.6, s.y + 1); ctx.lineTo(s.x + 2 + ((i * 7) % s.w), s.y + s.h - 1); ctx.stroke();
      }
    }
    if (s.flick > 0) { ctx.fillStyle = 'rgba(190,20,26,0.5)'; ctx.fillRect(s.x, s.y, s.w, s.h); }
  } else {
    ctx.fillStyle = '#050205'; ctx.fillRect(s.x - 3, s.y - 4, s.w + 6, s.h + 10);
    ctx.fillStyle = 'rgba(180,20,26,' + (0.25 + Math.sin(S.t * 3) * 0.15) + ')';
    ctx.fillRect(s.x - 2, s.y - 3, s.w + 4, s.h + 8);
  }
}

/* ---------- Damjan ----------
   How chewed up he is, from 0 (untouched) to 3 (barely). It reads off health
   rather than off the number of hits, so a big one takes a visible piece out
   of him and a graze does not. */
function hurtStage() {
  const p = S.p;
  if (!p) return 0;
  const f = p.hp / Math.max(1, ST().maxhp);
  return f > 0.72 ? 0 : f > 0.46 ? 1 : f > 0.22 ? 2 : 3;
}
function bodySprite(stage) {
  const c = cosDef(equippedCos());
  const st = stage === undefined ? hurtStage() : stage;
  const base = st === 0 ? SPR.body : SPR.bodyHurt[st - 1];
  return c.id === 'crimson' ? base : variant(base, c.id, c.pal);
}
function legSprite(i, stage) {
  const c = cosDef(equippedCos());
  const st = stage === undefined ? hurtStage() : stage;
  // trousers survive the first hit; a jacket shoulder does not
  const base = st < 2 ? SPR.legs[i] : SPR.legsHurt[st - 2][i];
  return (c.pal.n || c.pal.t) ? variant(base, c.id, c.pal) : base;
}

/* ============================================================
   THE ARMS

   They are not in the sprite, and that is the whole point. A drawn arm hangs
   wherever it was drawn, so a baked sleeve leaves the gun floating in front of
   a man standing to attention — he never looks like he is holding it. These
   are struck every frame from a shoulder joint out to wherever his hands
   actually are, which gets them tracking the aim, the reload dip, the mag
   change and the recoil kick for nothing extra.

   ARM_SH is the joint in game pixels from his centre, read off the sprite: the
   widest shirt row is the deltoid line at y-5 and it ends at x±7, so the joint
   sits just inside that. `DAM_BODY` has no sleeves below that row.
   ============================================================ */
const ARM_SH_X = 5.2, ARM_SH_Y = -4.6;

/* Cosmetics have to repaint the arms too, or GOLD stops at his shoulders.
   Both tones of each material, because a limb gets form-shaded like the rest
   of him rather than being one flat colour. */
function armCols() {
  const c = cosDef(equippedCos()).pal;
  return { cloth: c.r || PAL.r, clothDark: c.R || PAL.R,
           skin: c.s || PAL.s, skinDark: c.S || PAL.S, line: PAL.o };
}

/* One limb, shoulder to hand.

   The elbow is the midpoint pushed AWAY from his centre. A straight arm reads
   as a stick, one joint is all this many pixels can show, and bowing outward
   is the only rule that works for every aim direction — bend it along a fixed
   perpendicular instead and the elbow inverts through the body whenever he
   aims across himself.

   It is PLOTTED as pixels, not stroked as a line. A canvas stroke is
   anti-aliased and lands wherever the maths puts it, which in a game where
   every other edge is hard reads as a rubber tube laid over pixel art — and a
   round cap fat enough to look like a shoulder is fat enough to swallow the
   gun, which is why the gun kept disappearing at some angles. So this walks
   the curve and stamps a cross-section onto the same half-pixel grid the
   sprites are snapped to: outline, cloth, outline.

   WHICH TONE a cloth pixel gets is decided by which way that side of the limb
   turns, against the same top-left strip light `shade()` uses on the sprite —
   so a raised arm is lit along its top edge exactly like the shoulder it comes
   out of, and the limb has form instead of being one flat bar.

   The limb thins and then vanishes as the arm folds, leaving just the hand.
   Aiming up and across genuinely does put a hand back at its own shoulder and
   that is not a bug to design out.

   Cells go into one map keyed by grid position — so a later pixel overwrites
   an earlier one instead of blending — and come out grouped by colour, three
   or four fills for a whole arm rather than a rect at a time. */
function armCells(a, cols, bare, k, gx0, gy0, part) {
  k = k || 1; gx0 = gx0 || 0; gy0 = gy0 || 0;       // the title screen draws him big
  const cell = k / SUBPIX;
  const grid = new Map();
  const put = (x, y, c) =>
    grid.set(Math.round((x - gx0) / cell) + ',' + Math.round((y - gy0) / cell), c);

  const dxh = a.hx - a.ax, dyh = a.hy - a.ay;
  const L = Math.hypot(dxh, dyh) / k;
  const W = L < 1.6 ? -1 : L < 3.2 ? 0 : 1;         // half-width of cloth, sub-pixels

  if (W >= 0 && part !== 'hand') {
    const mx = (a.ax + a.hx) / 2, my = (a.ay + a.hy) / 2;
    let ex = mx - a.cx, ey = my - a.cy;
    const el = Math.hypot(ex, ey);
    if (el < 0.4) { const d = L * k || 1; ex = -dyh / d; ey = dxh / d; }
    else { ex /= el; ey /= el; }
    ex = mx + ex * 1.6 * k; ey = my + ey * 1.6 * k;             // the elbow

    const steps = Math.ceil(Math.hypot(dxh, dyh) / (cell * 0.5)) + 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const x = it * it * a.ax + 2 * it * t * ex + t * t * a.hx;
      const y = it * it * a.ay + 2 * it * t * ey + t * t * a.hy;
      let nx = -(2 * it * (ey - a.ay) + 2 * t * (a.hy - ey));    // the curve's normal
      let ny = (2 * it * (ex - a.ax) + 2 * t * (a.hx - ex));
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      for (let j = -W - 1; j <= W + 1; j++) {
        const lit = (nx + ny) * j < 0;              // does this side face top-left
        put(x + nx * j * cell, y + ny * j * cell,
            Math.abs(j) > W ? cols.line
              : bare ? (lit ? cols.skin : cols.skinDark)
                     : (lit ? cols.cloth : cols.clothDark));
      }
    }
  }

  /* The hand. Five sub-pixels across, and small on purpose — the gun is twelve
     sub-pixels tall, so a hand any bigger stops reading as gripping it and
     starts reading as hiding it. */
  if (part !== 'limb')
    for (let jy = -2; jy <= 2; jy++) for (let jx = -2; jx <= 2; jx++) {
      const d = Math.hypot(jx, jy);
      if (d > 2.35) continue;
      put(a.hx + jx * cell, a.hy + jy * cell,
          d > 1.5 ? cols.line : (jx + jy < 0 ? cols.skin : cols.skinDark));
    }

  return grid;
}

/* Fill the cells, grouped by colour — three or four fills for a whole arm
   rather than a rect at a time. */
function plotArm(a, cols, bare, alpha, k, gx0, gy0, part) {
  k = k || 1; gx0 = gx0 || 0; gy0 = gy0 || 0;
  const cell = k / SUBPIX;
  const byCol = new Map();
  for (const e of armCells(a, cols, bare, k, gx0, gy0, part)) {
    let arr = byCol.get(e[1]); if (!arr) byCol.set(e[1], arr = []);
    arr.push(e[0]);
  }
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  for (const e of byCol) {
    ctx.fillStyle = e[0]; ctx.beginPath();
    for (const key of e[1]) {
      const c = key.indexOf(',');
      ctx.rect(gx0 + +key.slice(0, c) * cell, gy0 + +key.slice(c + 1) * cell, cell, cell);
    }
    ctx.fill();
  }
  ctx.restore();
}

/* Shoulders, hands, and which arm his chest is in front of.

   Both hands go on the gun, one behind the other along it and offset to the
   side it is mirrored to. Neither sits at the grip proper: the gun pivots on
   his centre, so a hand there ends up at his sternum and the arm to the nearer
   shoulder collapses to a two-pixel nub with a round cap on it — a blob, not a
   limb. Pushing both hands out along the barrel keeps every arm long enough to
   read at every angle, and a hand four pixels up a sixteen-pixel gun is still
   plainly on the gun.

   Which shoulder takes the forward hand is tied to `flipY` — the same flag the
   gun sprite already mirrors on — and NOT to which shoulder is nearer. Nearer
   is the obvious rule and it chatters: around straight-down the two shoulders
   are within a hair of each other and the arms swap back and forth three times
   across a three-degree band. Keying off `flipY` swaps them exactly once per
   boundary, at the same instant the gun flips, so one deliberate change of
   grip reads instead of two glitches.

   DEPTH is per-arm and physical: top-down, higher on screen is further away,
   so an arm reaching to a hand above its own shoulder is reaching away from
   the camera and his torso is in front of it. The ordering therefore flips
   exactly when an arm passes horizontal — the moment when almost none of it is
   covered either way, so the swap cannot be seen. Ranking the two arms against
   each other instead pops in the middle of a sweep. */
function armRig(px, py, bob, lean, gx, gy, gunAng, flipY, gunLen, magPt) {
  const cl = Math.cos(lean), sl = Math.sin(lean), by = -5 + bob;
  const cx = px - by * sl, cy = py + by * cl;
  const joint = side => {
    const sx = ARM_SH_X * side, sy = ARM_SH_Y + bob;
    return { x: px + sx * cl - sy * sl, y: py + sx * sl + sy * cl, side };
  };
  const c = Math.cos(gunAng), s = Math.sin(gunAng), n = flipY ? -1 : 1;
  const on = (d, o) => ({ x: gx + c * d - s * o * n, y: gy + s * d + c * o * n });
  const rear = on(4.2, 1.3);
  const fore = magPt || on(clamp(gunLen * 0.5, 7.5, 11), 0.2);

  const J = [joint(-1), joint(1)], lf = flipY;
  const mk = (j, h) => ({ ax: j.x, ay: j.y, hx: h.x, hy: h.y, side: j.side,
                          cx, cy, behind: h.y < j.y });
  return [mk(lf ? J[0] : J[1], fore), mk(lf ? J[1] : J[0], rear)];
}

function drawPlayer(p) {
  const w = curW();
  const bob = Math.sin(p.walkT * Math.PI) * 1.4;
  const frame = Math.floor(p.walkT) % 4;
  const lean = clamp(p.vx * 0.0016, -0.16, 0.16);
  const kx = -Math.cos(p.ang) * p.kick * 0.3, ky = -Math.sin(p.ang) * p.kick * 0.3;
  const px = p.x + kx, py = p.y + ky;

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 7, 3, 0, 0, TAU); ctx.fill();

  if (p.dash > 0) drawSpr(ctx, bodySprite(), px - p.vx * 0.03, py - p.vy * 0.03 - 6 + bob, 1, p.flip, 0.3);

  const tint = p.hurtFlash > 0 ? 'rgba(255,60,60,0.7)' : (S.god ? godTint(0.35, 3) : null);
  const alpha = p.iframe > 0 && Math.sin(S.t * 40) > 0 ? 0.55 : 1;

  /* The gun's transform is worked out BEFORE anything is drawn, because the
     hands have to reach it and the torso has to be drawn between the arms. */
  const shx = px, shy = py - 1 + bob;
  const flipY = Math.cos(p.ang) < 0;
  const prog = p.reT > 0 ? 1 - p.reT / p.reMax : 0;
  let gunAng = p.ang, back = 0;
  if (p.reT > 0) {
    const tilt = Math.sin(prog * Math.PI) * 1.05;     // dips down and comes back
    gunAng += (flipY ? -tilt : tilt);
    back = Math.sin(prog * Math.PI) * 3.2;
  }
  const gx = shx - Math.cos(p.ang) * back, gy = shy - Math.sin(p.ang) * back;

  /* Where the new magazine is, if one is on its way in. The forward hand goes
     with it — a reload where the gun moves and the hands do not reads as the
     gun malfunctioning rather than as him reloading it. */
  let magPt = null;
  if (p.reT > 0 && prog > 0.5 && prog < 0.92) {
    const k = clamp((prog - 0.5) / 0.32, 0, 1);
    const mAng = gunAng + Math.PI / 2 * (flipY ? -1 : 1);
    const off = (1 - k) * 9;
    magPt = { x: gx + Math.cos(mAng) * off + Math.cos(gunAng) * 2,
              y: gy + Math.sin(mAng) * off + Math.sin(gunAng) * 2 };
  }

  const arms = armRig(px, py, bob, lean, gx, gy, gunAng, flipY, w.spr.w / w.spr.ss, magPt);
  const cols = armCols(), hstage = hurtStage();
  const bareArm = a => hstage >= 2 && a.side < 0;     // the shoulder the tear is on

  /* Layering, and it is the whole trick. An arm reaching away goes under the
     torso entirely. An arm reaching toward the camera has its LIMB under the
     gun and only its HAND over it — a forearm runs the length of a barrel, so
     drawing the whole arm on top buries half the weapon, which is exactly what
     it looked like. The hand alone is five sub-pixels: enough to read as a
     grip, small enough to leave the gun legible. */
  for (const a of arms) if (a.behind) plotArm(a, cols, bareArm(a), alpha);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(lean);                                   // exaggerated run lean
  const sq = 1 + Math.sin(p.walkT * Math.PI) * 0.05;
  ctx.scale(1 / sq, sq);
  // Body is 16 tall centred at -5 (bottom edge +3); legs are 5 tall and must be
  // centred at +5.5 so their top edge meets it. Any more and you see daylight
  // through his waist.
  drawSpr(ctx, legSprite(p.walkT > 0 ? frame : 0), 0, 5.5 + bob * 0.4, 1, p.flip, alpha, tint);
  drawSpr(ctx, bodySprite(), 0, -5 + bob, 1, p.flip, alpha, tint);
  ctx.restore();

  /* LIVING FLAME burns where the cloth actually is. The body sprite spans
     y-13 to y+3 and the work shirt's collar sits on its rows 14-16 of 32,
     which lands at about y-6. The fire used to come off y-13, the top of his
     skull, because back then `r`/`R`/`w` painted a headband. */
  const cos = cosDef(equippedCos());
  if (cos.fx === 'fire' && Math.random() < 0.9)
    part(px + rnd(-4, 4), py - 6 + bob, pick(['#ff8a20', '#ffd05a', '#ff3b1e']), 1, 22, 0.4);

  /* ---- the forearms, then the gun, then the hands on top of it ---- */
  for (const a of arms) if (!a.behind) plotArm(a, cols, bareArm(a), alpha, 1, 0, 0, 'limb');
  drawSprRot(ctx, w.spr, gx, gy, gunAng, 1, 2 - p.kick * 0.4, 3, flipY, S.god ? godTint(0.5, 4) : null);
  if (magPt) drawSpr(ctx, SPR.mag, magPt.x, magPt.y, 1);
  for (const a of arms) if (!a.behind) plotArm(a, cols, bareArm(a), alpha, 1, 0, 0, 'hand');

  if (p.reT > 0) {
    // reload ring
    ctx.save();
    ctx.strokeStyle = 'rgba(200,160,74,0.75)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y + 2, 13, -Math.PI / 2, -Math.PI / 2 + prog * TAU); ctx.stroke();
    ctx.restore();
  }

  // railgun charge glow
  if (p.charge > 0) {
    const k = clamp(p.charge / w.charge, 0, 1);
    const cxp = shx + Math.cos(p.ang) * 14, cyp = shy + Math.sin(p.ang) * 14;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(168,232,255,' + (0.35 + k * 0.55) + ')';
    ctx.beginPath(); ctx.arc(cxp, cyp, 1 + k * 5, 0, TAU); ctx.fill();
    ctx.restore();
    if (Math.random() < k * 0.7) part(cxp + rnd(-6, 6), cyp + rnd(-6, 6), '#a8e8ff', 1, 20, 0.3);
  }

  // minigun spin
  if (w.spin && p.spin > 0.02) {
    ctx.save(); ctx.globalAlpha = p.spin * 0.5;
    ctx.strokeStyle = '#ffd28a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(shx + Math.cos(p.ang) * 14, shy + Math.sin(p.ang) * 14, 4, S.t * 30, S.t * 30 + 2.2); ctx.stroke();
    ctx.restore();
  }

  /* ---- THE FISH's beam ----
     Four stacked strokes, widest and dimmest first, so the line reads as a
     hot core inside a haze rather than as four lines.

     `prism` walks the hue instead of holding violet. The three outer layers
     are offset around the wheel by 26 degrees each, so the beam is never one
     colour across its width — it fringes, the way a real prism split would.
     The core stays white: a beam whose centre changes colour reads as a
     different weapon every second, and you would stop being able to find it
     against a floor that is also coloured. */
  if (S.beamHit) {
    const b = S.beamHit, gt = b.girth || 11;
    const pr = b.prism;
    const hue = (S.t * 95) % 360;
    const lay = (i, a, l) => pr
      ? 'hsla(' + ((hue + i * 26) % 360) + ',100%,' + l + '%,' + a + ')'
      : ['rgba(120,40,200,', 'rgba(192,92,255,', 'rgba(232,180,255,'][i] + a + ')';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = lay(0, 0.30, 45); ctx.lineWidth = gt * 2.6 + Math.sin(S.t * 30) * 2;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.strokeStyle = lay(1, 0.6, 62); ctx.lineWidth = gt * 1.5 + Math.sin(S.t * 40) * 1.6;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.strokeStyle = lay(2, 0.9, 80); ctx.lineWidth = gt * 0.6;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.fillStyle = pr ? 'hsla(' + hue + ',100%,88%,0.85)' : 'rgba(255,220,255,0.85)';
    ctx.beginPath(); ctx.arc(b.ex, b.ey, gt * 0.9 + Math.sin(S.t * 30) * 2, 0, TAU); ctx.fill();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  /* ---- LASER SIGHT ---- */
  if (!w.beam) {
    const lx = shx + Math.cos(p.ang) * 13, ly = shy + Math.sin(p.ang) * 13;
    let ex = lx, ey = ly;
    for (let i = 0; i < 90; i++) {
      const nx = lx + Math.cos(p.ang) * i * 4, ny = ly + Math.sin(p.ang) * i * 4;
      if (pointInWall(nx, ny)) break;
      let blocked = false;
      for (const e of S.en) if (Math.hypot(e.x - nx, e.y - ny) < e.r) { blocked = true; break; }
      ex = nx; ey = ny;
      if (blocked) break;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = S.god ? godTint(0.5, 5) : 'rgba(255,30,40,0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = S.god ? '#ffffff' : '#ff4a52';
    ctx.fillRect(ex - 1, ey - 1, 2, 2);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(ex, ey, 3 + Math.sin(S.t * 20) * 0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---- muzzle flash ----
     Was a single additive disc, which is a light source and not a flash: it
     had no direction, so every gun in the game bloomed identically and none of
     them looked like they were pointing anywhere.

     A flash is now a four-point star oriented along the barrel — a long lobe
     forward, a short one back, two short ones across — with a hot core and a
     couple of burnt-powder specks. It is aimed, so the shotgun's fat one and
     the pistol's thin one read as different guns from the same call. Two
     frames of it; anything longer starts to look like a light you are
     carrying rather than a thing that just happened. */
  if (S.muzzle && S.muzzle.t > 0) {
    const m = S.muzzle, k = clamp(m.t / 0.06, 0, 1);
    const L = (m.big ? 21 : 12) * (0.7 + k * 0.3), Wd = (m.big ? 8 : 4.5) * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(m.x, m.y); ctx.rotate(m.a || 0);
    ctx.globalAlpha = 0.55 * k;
    ctx.fillStyle = m.col || '#ffd68c';
    ctx.beginPath();                        // the star
    ctx.moveTo(L, 0); ctx.lineTo(0, -Wd);
    ctx.lineTo(-L * 0.32, 0); ctx.lineTo(0, Wd);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9 * k;              // hot core
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.moveTo(L * 0.55, 0); ctx.lineTo(0, -Wd * 0.42);
    ctx.lineTo(-L * 0.16, 0); ctx.lineTo(0, Wd * 0.42);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  if (p.shield > 0) {
    for (let i = 0; i < p.shield; i++) {
      const a = S.t * 1.7 + i / p.shield * TAU;
      drawSpr(ctx, SPR.melon, p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 7, 0.45, false, 0.9);
    }
  }

  // AEGIS bubble from the shield pickup
  if (p.tempShield > 0) {
    const k = clamp(p.tempShield / 3, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(127,208,255,' + (0.35 + k * 0.4) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 15 + Math.sin(S.t * 12) * 1.2, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.12 + k * 0.10;
    ctx.fillStyle = '#7fd0ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, TAU); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.4) {
      const a = Math.random() * TAU;
      part(p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 15, '#c6e8ff', 1, 16, 0.35);
    }
  }

  // shop prompt
  if (S.prompt) {
    const q = S.prompt;
    ctx.font = '7px ' + GAME_FONT; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(q.x - 44, q.y - 42, 88, 17);
    if (q.tomce) {
      ctx.fillStyle = '#a8e8ff'; ctx.fillText('TOMCE', q.x, q.y - 34);
      ctx.fillStyle = '#9fe08a'; ctx.fillText('[E] SPEAK', q.x, q.y - 27);
    } else {
      ctx.fillStyle = q.w.col; ctx.fillText(q.w.name, q.x, q.y - 34);
      ctx.fillStyle = q.ok ? '#9fe08a' : '#ff5a62';
      ctx.fillText((q.ok ? '[E] BUY  ' : 'NEED ') + q.cost, q.x, q.y - 27);
    }
    ctx.textAlign = 'left';
  }
}

/* TOMCE. Two frames, a very slow sway, and a cold light he does not cast so
   much as fail to block. He is barely there until you are nearly on him. */
function drawTomce() {
  const q = S.tomce;
  if (!q) return;
  const sway = Math.sin(q.bob * 0.7);
  const spr = sway > 0 ? SPR.tomce2 : SPR.tomce;
  const vis = 0.16 + q.near * 0.84;

  ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * vis) + ')';
  ctx.beginPath(); ctx.ellipse(q.x, q.y + 30, 14, 5, 0, 0, TAU); ctx.fill();

  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (0.05 + q.near * 0.10) + Math.sin(S.t * 1.6) * 0.02;
  ctx.fillStyle = '#a8e8ff';
  ctx.beginPath(); ctx.arc(q.x, q.y, 46, 0, TAU); ctx.fill();
  ctx.restore();

  drawSpr(ctx, spr, q.x, q.y + sway * 0.7, 2, false, vis);

  // the lenses catch what little light there is
  if (q.near > 0.05) {
    ctx.globalAlpha = clamp(q.near * 1.4, 0, 1) * (0.5 + Math.sin(S.t * 7) * 0.18);
    ctx.fillStyle = '#dff4ff';
    ctx.fillRect((q.x - 7) | 0, (q.y - 22) | 0, 3, 2);
    ctx.fillRect((q.x + 4) | 0, (q.y - 22) | 0, 3, 2);
    ctx.globalAlpha = 1;
  }
  if (q.used) return;
  if (q.near > 0.3 && Math.random() < 0.16)
    part(q.x + rnd(-8, 8), q.y + rnd(-24, 24), '#a8e8ff', 1, 12, 0.6);
}

/* Which frame of the bank is showing: the wind-up pose if the AI has flagged
   one, otherwise the walk cycle at whatever phase this creature is on. */
function enemySpr(e) {
  if (!e.bank) return e.spr;
  if (e.poseT > 0) return e.bank.pose;
  return e.bank.walk[Math.floor(e.anim) % e.bank.walk.length];
}

function drawEnemy(e) {
  const bob = Math.sin(e.bob) * (e.boss ? 1.6 : 1);
  const sc = (e.boss ? 1.7 : 1) * (e.scale || 1);
  const spr = enemySpr(e);
  const lift = e.boss ? 8 : 0;

  /* Marked, chilled and frozen all need to read at a glance in a crowd. */
  if (e.mark > 0) {
    ctx.globalAlpha = 0.30 + Math.sin(S.t * 9) * 0.12;
    ctx.strokeStyle = '#ff4ab0'; ctx.lineWidth = 1;
    ctx.strokeRect((e.x - e.r - 3) | 0, (e.y - e.r - 5) | 0, (e.r * 2 + 6) | 0, (e.r * 2 + 8) | 0);
    ctx.globalAlpha = 1;
  }

  // afterimages — you see where it was before you see where it is
  if (e.trail && e.trail.length) {
    for (let i = 0; i < e.trail.length; i++) {
      const tr = e.trail[i];
      ctx.globalAlpha = (i / e.trail.length) * (e.boss ? 0.20 : 0.14);
      drawSpr(ctx, spr, tr.x, tr.y + bob - lift, sc, e.flip, 1, 'rgba(0,0,0,0.85)');
    }
    ctx.globalAlpha = 1;
  }

  // shadow tightens as the body rises, which is what sells the bob as weight
  const shk = 1 - bob * 0.05;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y + (e.boss ? 20 : 8), (e.boss ? 16 : 6) * shk, (e.boss ? 6 : 3) * shk, 0, 0, TAU); ctx.fill();

  // bosses drag a writhing dark aura around with them
  if (e.boss) {
    ctx.save();
    ctx.globalAlpha = 0.30 + Math.sin(S.t * 2.4) * 0.08;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 30 + Math.sin(S.t * 3) * 3, 24, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(160,10,20,0.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const a = S.t * 0.7 + i / 7 * TAU;
      const r1 = 22 + Math.sin(S.t * 3 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 11);
      ctx.lineTo(e.x + Math.cos(a + 0.4) * r1, e.y + Math.sin(a + 0.4) * (r1 * 0.7));
      ctx.stroke();
    }
    ctx.restore();
  }

  let tint = e.tint || null;
  if (e.hit > 0) tint = 'rgba(255,255,255,0.85)';
  else if (e.burnT > 0) tint = 'rgba(255,120,40,0.45)';
  else if (e.stun > 0) tint = 'rgba(247,220,85,0.4)';
  else if (e.poseT > 0) tint = 'rgba(255,90,90,0.32)';   // lit up while winding up

  /* Breathing and lean. The sprite frames carry the gait; these two carry the
     weight — nothing in here is ever perfectly still or perfectly upright. */
  const breath = 1 + Math.sin(e.bob * 0.5) * (e.boss ? 0.035 : 0.05);
  const lean = clamp(e.vx * 0.0012, -0.13, 0.13);
  ctx.save();
  ctx.translate(e.x + (e.twx || 0), e.y + (e.twy || 0) + bob - lift);
  ctx.rotate(lean);
  ctx.scale((1 + e.sq * 0.3) / breath, (1 - e.sq * 0.25) * breath);   // squash on impact
  drawSpr(ctx, spr, 0, 0, sc, e.flip, 1, tint);
  ctx.restore();

  // eyes burn through the dark — anchored off the art, not guessed
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const eye = e.bank ? e.bank.eye : { y: -3, sep: 2.6 };
  const eg = e.boss ? 2.2 : 1;
  const ey = e.y + (e.twy || 0) + bob - lift + eye.y * sc;
  const ex = e.x + (e.twx || 0);
  const sep = eye.sep * sc;
  const glow = e.poseT > 0 ? 1 : (e.boss ? 0.85 : 0.6);
  ctx.fillStyle = 'rgba(255,' + (e.poseT > 0 ? 90 : 45) + ',45,' + glow + ')';
  ctx.fillRect(ex - sep - eg / 2, ey, eg, eg);
  ctx.fillRect(ex + sep - eg / 2, ey, eg, eg);
  ctx.restore();

  if (e.boss && e.phase === 'tell') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,30,40,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.chargeDir) * 130, e.y + Math.sin(e.chargeDir) * 130); ctx.stroke();
    ctx.restore();
  }
  if (e.stun > 0) {
    ctx.font = '8px ' + GAME_FONT; ctx.textAlign = 'center';
    ctx.fillStyle = '#f7dc55'; ctx.fillText('~', e.x, e.y - 14 + Math.sin(S.t * 10)); ctx.textAlign = 'left';
  }
}

/* ---------- lighting ---------- */
function drawLight() {
  const R = curRoom();
  /* THE LONG TABLE's blackout rides on top of whatever the room was already
     doing, up to near-total. Capped short of 1 so the silhouettes never fully
     go — a room you cannot see AT ALL is not tense, it is a loading screen. */
  const bo = blackoutK();
  const dark = S.god ? 0.55 : Math.min(0.97, R.dark + bo * 0.14);
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = 'rgba(4,2,6,' + dark + ')';
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';

  const z = S.cam.z;
  const ps = worldToScreen(S.p.x, S.p.y);

  /* CATARACT and SLEEPLESS close this in, and so does the floor: THE HOLLOW
     runs the lamp at 68% permanently, and a blackout squeezes it to a quarter
     for the two and a half seconds it lasts. */
  const sight = ST().sight * (isTwist('dark') ? 0.68 : 1) * (1 - bo * 0.75);
  const lamp = 104 * sight;
  let g = lctx.createRadialGradient(ps.x, ps.y, 4, ps.x, ps.y, lamp * z);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.72)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = g; lctx.beginPath(); lctx.arc(ps.x, ps.y, lamp * z, 0, TAU); lctx.fill();

  const spread = 0.52, len = 210 * sight * z;
  lctx.save();
  lctx.translate(ps.x, ps.y); lctx.rotate(S.p.ang);
  const cg = lctx.createLinearGradient(0, 0, len, 0);
  cg.addColorStop(0, 'rgba(0,0,0,1)');
  cg.addColorStop(0.5, 'rgba(0,0,0,0.78)');
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = cg;
  lctx.beginPath(); lctx.moveTo(0, 0); lctx.arc(0, 0, len, -spread, spread); lctx.closePath(); lctx.fill();
  lctx.restore();

  const blob = (wx, wy, r, a) => {
    const s = worldToScreen(wx, wy);
    if (s.x < -r || s.x > W + r || s.y < -r || s.y > H + r) return;
    const gg = lctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, r * z);
    gg.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = gg; lctx.beginPath(); lctx.arc(s.x, s.y, r * z, 0, TAU); lctx.fill();
  };

  if (S.muzzle && S.muzzle.t > 0) blob(S.muzzle.x, S.muzzle.y, S.muzzle.big ? 130 : 92, 1);
  if (S.beamHit) {
    blob(S.beamHit.ex, S.beamHit.ey, 100, 1); blob(S.beamHit.x, S.beamHit.y, 70, 0.95);
    const mx = (S.beamHit.x + S.beamHit.ex) / 2, my = (S.beamHit.y + S.beamHit.ey) / 2;
    blob(mx, my, 80, 0.9);
  }
  for (const g2 of S.nades) if (g2.fuse < 0.45) blob(g2.x, g2.y, 30, 0.6);
  /* EVERY drop opens a hole now, not just the three big ones. The additive
     halo that used to be drawn on top of each pickup was also the only reason
     the small ones were findable on THE DARK ROOM and THE BLACKOUT; taking it
     away without this would have hidden them completely on the two floors
     where you most need to find a medkit. The lightmap lights the item itself
     rather than painting a disc over it, which is the difference between
     seeing a pickup and seeing a glow. */
  for (const d of S.drops) {
    const big = d.kind === 'item' || d.kind === 'god' || d.kind === 'card';
    blob(d.x, d.y, big ? 46 : 24, big ? 0.9 : 0.62);
  }
  for (const sh of S.shops) if (!sh.bought) blob(sh.x, sh.y - 12, 52, 0.85);
  if (S.paci) blob(S.paci.x, S.paci.y, 120, 0.95);
  if (S.tomce) blob(S.tomce.x, S.tomce.y, 34 + S.tomce.near * 40, 0.35 + S.tomce.near * 0.5);
  if (S.corner && (S.corner.found || S.corner.pulse > 0.15)) blob(S.corner.x, S.corner.y, 40, S.corner.found ? 0.8 : S.corner.pulse * 0.7);
  if (S.door.open) blob(S.door.x + S.door.w / 2, S.door.y + S.door.h, 70, 0.9);
  /* Props that make light, make light. A brazier drawn as a fire inside a
     lightmap that does not know it is there reads as a picture of a fire —
     this is the line between set dressing and a lit room, and it is also
     genuinely useful: on the dark floors the furniture is what you navigate
     by. Only obstacles, so the cost is a dozen blobs at worst. */
  for (const w of S.walls) {
    if (!w.obs) continue;
    const r = LIT_PROPS[w.kind];
    if (!r) continue;
    const flick = w.kind === 'brazier' || w.kind === 'candles'
      ? 1 + Math.sin(S.t * 6 + w.x) * 0.09 : 1;
    blob(w.x + w.w / 2, w.y + w.h / 2, r * flick, 0.55);
  }
  for (const e of S.en) blob(e.x, e.y, e.boss ? 40 : 15, 0.42);
  // incoming fire lights its own way in, so a dark room can't hide it
  for (const b of S.eb) blob(b.x, b.y, 26, 0.75);
  for (const r of S.rings) blob(r.x, r.y, r.r1 * 0.8, clamp(r.life / r.max, 0, 1) * 0.8);

  lctx.globalCompositeOperation = 'source-over';
  blit(ctx, lcan, 0, 0);
  ctx.fillStyle = R.fog; ctx.fillRect(0, 0, W, H);
}

/* ---------- post ---------- */
let grainCans = [];
(() => {
  // Grain and scanlines live at render scale now, so they sit ON the image
  // instead of being blown up into visible blocks with it.
  for (let k = 0; k < 4; k++) {
    const s = subCanvas(W, H), g = s.ctx;
    const img = g.createImageData(s.can.width, s.can.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.054 ? 15 : 0;
    }
    g.putImageData(img, 0, 0);
    grainCans.push(s.can);
  }
})();
const scan = subCanvas(W, H).can;
(() => {
  const g = scan.getContext('2d'), P = 1 / RS;
  g.fillStyle = 'rgba(0,0,0,0.09)';
  for (let y = 0; y < H; y += P * 2) g.fillRect(0, y, W, P);
})();

function post() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.40, W / 2, H / 2, H * 0.98);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.60)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (S.redness > 0.01) { ctx.fillStyle = 'rgba(150,0,10,' + (S.redness * 0.34) + ')'; ctx.fillRect(0, 0, W, H); }
  /* the back room, once he has stopped being a shopkeeper */
  if (S.paci && S.paci.anger > 0) {
    const a = S.paci.anger;
    ctx.fillStyle = 'rgba(158,0,8,' + (a > 1 ? 0.46 : 0.24 + Math.sin(S.t * 9) * 0.07) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(120,0,0,' + (0.10 + Math.sin(S.t * 17) * 0.05) * a + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    // the picture starts tearing at the second one
    if (a > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 9; i++) ctx.fillRect(0, (Math.random() * H) | 0, W, 1 + Math.random() * 4);
    }
  }
  if (S.modT > 0) {
    ctx.fillStyle = 'rgba(120,20,200,' + (S.modT / 2.6 * 0.22) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let i = 0; i < 7; i++) ctx.fillRect(0, (Math.random() * H) | 0, W, 1 + Math.random() * 3);
  }
  if (S.god) { ctx.fillStyle = 'hsla(' + ((S.t * 90) % 360) + ',80%,50%,0.055)'; ctx.fillRect(0, 0, W, H); }
  if (S.flash > 0) { ctx.globalAlpha = clamp(S.flash, 0, 1) * 0.7; ctx.fillStyle = S.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

  blit(ctx, grainCans[Math.abs(S.t * 24 | 0) % grainCans.length], 0, 0);
  blit(ctx, scan, 0, 0);

  if (S.jump > 0 && S.jumpSpr) {
    ctx.globalAlpha = clamp(S.jump * 2.2, 0, 1);
    ctx.fillStyle = '#12000a'; ctx.fillRect(0, 0, W, H);
    drawSpr(ctx, S.jumpSpr.bank.walk[0], W / 2 + rnd(-4, 4), H / 2 + rnd(-4, 4), 10, false, 1, 'rgba(180,10,20,0.5)');
    ctx.globalAlpha = 1;
  }

  /* The sidearm still gains a mark on every floor — see scarMul — but it no
     longer announces itself with a full-width hue-cycling banner across the
     bottom of the screen. That sign fired on top of the floor name, the floor
     twist and whatever else a floor entry throws up, three seconds of the
     brightest thing on screen for a passive +20%.

     What is left is a short mark on the weapon readout itself, which is where
     you would look to check anyway. */
  if (S.glusec > 0) {
    const a = clamp(S.glusec / 0.6, 0, 1);
    htxt(scarName() + '  +' + Math.round((ST().scarMul - 1) * 100) + '%',
         W / 2, H - 30, scarCol(), 'center', 8,
         { alpha: a * 0.9, track: 0.14, glow: scarCol(), glowSize: 10 });
  }

  /* GOROMANIA — two seconds, as fast as the screen will go */
  if (S.goroT > 0) {
    const f = Math.floor(S.t * 22) % 2;
    ctx.fillStyle = f ? '#b028ff' : '#0a0006';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(' + (f ? '10,0,10' : '176,40,255') + ',' + rnd(0.15, 0.6) + ')';
      ctx.fillRect(0, (Math.random() * H) | 0, W, 1 + Math.random() * 5);
    }
    for (let i = 0; i < 4; i++) {
      htxt('GOROMANIA', W / 2 + rnd(-5, 5), H / 2 + rnd(-5, 5), f ? '#0a0006' : '#ffffff',
           'center', 30 + rnd(-2, 4), { weight: '700', track: 0.14, noShadow: true });
    }
    htxt('GOROMANIA', W / 2, H / 2 + 28, f ? '#160020' : '#e0b0ff', 'center', 11, { track: 0.40 });
  }
}

/* ---------- HUD ----------
   The HUD used to rasterise on the 480x270 canvas and get upscaled with the
   world, which is what made small numbers mushy. It goes on the overlay now,
   same as the menus — one typeface, one sharpness, everywhere. The cost is
   that modal screens have to wipe the overlay before they draw (see uiWipe),
   because a pixel-canvas backdrop no longer covers this text. */
function txt(s, x, y, col, align, size) {
  htxt(s, x, y, col, align, size || 8, { weight: '500' });
}
/* Screens that paint over the world clear the overlay first, so the HUD
   underneath them doesn't bleed through. */
function uiWipe() { octx.clearRect(0, 0, ov.width, ov.height); }

function drawHUD() {
  const p = S.p, st = ST(), w = curW();
  const R = curRoom();

  const hw = 96;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(6, 6, hw + 2, 8);
  const frac = clamp(p.hp / st.maxhp, 0, 1);
  ctx.fillStyle = S.god ? 'hsl(' + ((S.t * 200) % 360) + ',90%,55%)' : frac > 0.5 ? '#b8242c' : frac > 0.25 ? '#d0641c' : '#ff2a2a';
  ctx.fillRect(7, 7, hw * frac, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(7, 7, hw * frac, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 1; i < 8; i++) ctx.fillRect(7 + hw * i / 8, 7, 1, 6);
  txt(Math.ceil(p.hp) + '/' + Math.round(st.maxhp), hw + 12, 13, '#a89684');

  for (let i = 0; i < st.shieldMax; i++) {
    ctx.fillStyle = i < p.shield ? '#63b04a' : 'rgba(60,80,50,0.5)';
    ctx.fillRect(7 + i * 6, 17, 4, 3);
  }

  /* wallet — flowed rather than sat on fixed columns. The typeface is
     proportional and these numbers grow, so a five-figure coin count used to
     run straight under the card icon. */
  let wx = 11;
  const purse = (spr, sc, val, col) => {
    drawSpr(ctx, spr, wx, 30, sc);
    txt(val, wx + 7, 33, col);
    wx += 7 + htxtWidth(val, 8) + 11;
  };
  purse(SPR.coin, 0.9, String(S.coins), '#f5c518');
  purse(SPR.card, 0.62, String(S.cards), '#b3a888');
  purse(SPR.grenade, 0.9, String(p.nades), '#9fc98a');
  if (S.evo) txt('EVO ' + S.evo, wx, 33, '#ff5a62');
  if (S.goro) txt('GOROMANIA', 11, 43, '#b028ff', 'left', 7);

  // XP bar + level
  const xw = 96, xf = clamp(S.xp / S.xpNext, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(6, 22, xw + 2, 4);
  ctx.fillStyle = '#4d8f52'; ctx.fillRect(7, 23, xw * xf, 2);
  ctx.fillStyle = 'rgba(190,255,190,0.35)'; ctx.fillRect(7, 23, xw * xf, 1);
  const lvs = 'LV' + S.level;
  txt(lvs, xw + 12, 26, '#9fe08a', 'left', 7);
  if (S.upgPts > 0) txt('+' + S.upgPts, xw + 15 + htxtWidth(lvs, 7), 26, Math.sin(S.t * 8) > 0 ? '#ffffff' : '#9fe08a', 'left', 7);

  /* ammo + reload */
  const mag = Math.ceil(p.mags[w.id] || 0);
  // U+221E is outside the embedded latin subset — spelling it out keeps god
  // mode in the same typeface as everything else instead of falling back.
  if (S.god) txt('INFINITE AMMO', 8, H - 22, 'hsl(' + ((S.t * 240) % 360) + ',90%,65%)');
  else if (p.reT > 0) {
    const prog = 1 - p.reT / p.reMax;
    txt('RELOADING', 8, H - 22, '#c8a04a');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(8, H - 19, 62, 3);
    ctx.fillStyle = '#c8a04a'; ctx.fillRect(8, H - 19, 62 * prog, 3);
    if (prog > 0.9) { ctx.fillStyle = '#fff'; ctx.fillRect(8, H - 19, 62, 3); }
  } else {
    /* Pips, not a string of '|' and '.'. That bar only ever held a steady
       width because Courier was monospaced; in a proportional face it would
       breathe in and out as rounds swapped between the two glyphs. */
    const cap = magCap(w);
    const bars = Math.min(30, cap);
    const filled = Math.ceil(mag / cap * bars);
    const low = mag / cap <= 0.2;
    for (let i = 0; i < bars; i++) {
      ctx.fillStyle = i < filled ? (low ? '#ff3b3b' : w.col) : 'rgba(255,255,255,0.15)';
      ctx.fillRect(8 + i * 3, H - 29, 2, 5);
    }
    txt(mag + '/' + cap, 8, H - 16, '#7b6a58');
  }
  if (w.spin && p.spin > 0) {
    ctx.fillStyle = 'rgba(255,210,138,0.8)'; ctx.fillRect(8, H - 12, 40 * p.spin, 2);
  }
  if (w.charge && p.charge > 0) {
    ctx.fillStyle = 'rgba(168,232,255,0.9)'; ctx.fillRect(8, H - 12, 40 * clamp(p.charge / w.charge, 0, 1), 2);
  }

  /* weapon wheel */
  const n = p.owned.length;
  const wx0 = W / 2 - (n * 20) / 2;
  for (let i = 0; i < n; i++) {
    const ww = WEP[p.owned[i]];
    const x = wx0 + i * 20 + 10, y = H - 9;
    ctx.fillStyle = i === p.wi ? 'rgba(40,30,20,0.9)' : 'rgba(10,8,10,0.6)';
    ctx.fillRect(x - 9, y - 7, 18, 14);
    if (i === p.wi) { ctx.fillStyle = ww.col; ctx.fillRect(x - 9, y + 6, 18, 1); }
    drawSpr(ctx, ww.spr, x, y, 0.85, false, i === p.wi ? 1 : 0.45,
            WEP[ww.id].evolve && S.scarLv > 1 ? scarCol() : null);
  }
  const isEvo = !!w.evolve;
  txt(isEvo ? scarName() : w.name, W / 2, H - 20, isEvo ? scarCol() : w.col, 'center', 7);

  /* wave / room. The descent has a bottom now, so the HUD says how far down it
     is — "FLOOR 7" means nothing without the 10 next to it. */
  txt(S.inShop ? R.name : R.name + '  ·  FLOOR ' + (S.room + 1) + '/' + FLOORS,
      W / 2, 12, isLastFloor(S.room) && !S.inShop ? '#c0555c' : '#8e7a68', 'center');
  if (S.inShop) {
    txt('SPEND SOMETHING', W / 2, 22, '#c8a8e0', 'center');
    txt('leave through the door at the bottom', W / 2, 32, 'rgba(160,130,190,0.75)', 'center', 7);
  } else {
    txt(S.waveState === 'idle' ? 'PREPARING' : 'WAVE ' + S.wave + '/' + WAVES, W / 2, 22,
        S.wave === BOSS_WAVE ? '#ff3b46' : miniWaves().indexOf(S.wave) >= 0 ? '#ff8a3a' : '#c0ac96', 'center');
    /* One tick per wave. Widened with the move to five: at the old 4px-on-6
       the row was half as long as the label above it and read as a stray
       underline rather than as a progress bar. Sized from WAVES so the bar
       keeps its width whatever the number is. */
    const tw = Math.max(4, Math.round(58 / WAVES) - 3), tg = tw + 3;
    const tx0 = W / 2 - (WAVES * tg - 3) / 2;
    for (let i = 1; i <= WAVES; i++) {
      ctx.fillStyle = i < S.wave ? '#8a2a2e' : i === S.wave ? '#ff3b46' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(tx0 + (i - 1) * tg, 26, tw, 2);
    }
  }

  txt(String(S.score).padStart(7, '0'), W - 6, 12, '#d8c49a', 'right');
  /* THE RUN CLOCK, under the score — the other number that only ever counts
     up. Dimmer than the score on purpose: it is something you check between
     waves, not something you play toward. The combo drops below it rather
     than sharing the line, because a combo is loud and brief and would fight
     a clock that is always there. */
  txt(runClock(), W - 6, 22, '#7b6a58', 'right', 7.5);
  if (S.combo > 1) txt('x' + S.combo, W - 6, 32, 'hsl(' + (40 + S.combo * 6) + ',90%,60%)', 'right');

  drawMinimap();
  if (S.vacuum > 0) htxt('COLLECTING', W / 2, 68, 'rgba(245,197,24,' + clamp(S.vacuum, 0, 1) + ')', 'center', 8, { track: 0.3 });

  /* The grocery strip lived here. What is worth showing in that corner now is
     the aisle you are actually building — three pips per aisle, filling as you
     clear THE ORDER, MASTERED and the third rung, and only for aisles you have
     put something into. It is the same information the strip gave (what am I
     becoming) read off the system that still exists. */
  {
    let ix = W - 14;
    for (let i = AISLE_ORDER.length - 1; i >= 0; i--) {
      const k = AISLE_ORDER[i], n = ais(k);
      if (!n) continue;
      const ai = AISLES[k];
      const rungs = (aisleT1(k) ? 1 : 0) + (aisleT2(k) ? 1 : 0) + (aisleT3(k) ? 1 : 0);
      htxt(ai.n, ix, H - 34, rungs ? ai.col : 'rgba(150,132,118,0.55)', 'right', 6.5,
           { track: 0.10, noShadow: true });
      for (let j = 0; j < 3; j++) {
        const on = j < rungs;
        ctx.globalAlpha = on ? 0.95 : 0.22;
        ctx.fillStyle = ai.col;
        ctx.fillRect(ix - 2 - j * 4, H - 29, 3, 3);
      }
      ctx.globalAlpha = 1;
      ix -= Math.max(30, htxtWidth(ai.n, 6.5, 0.10) + 8);
    }
    if (S.god) drawSpr(ctx, SPR.eye, ix - 6, H - 32, 0.9);
  }

  if (S.boss) {
    const bw = 200;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(W / 2 - bw / 2 - 1, 36, bw + 2, 7);
    ctx.fillStyle = '#8a1018'; ctx.fillRect(W / 2 - bw / 2, 37, bw * clamp(S.boss.hp / S.boss.max, 0, 1), 5);
    ctx.fillStyle = 'rgba(255,80,80,0.35)'; ctx.fillRect(W / 2 - bw / 2, 37, bw * clamp(S.boss.hp / S.boss.max, 0, 1), 2);
    htxt(S.boss.name, W / 2, 51, '#ff7a82', 'center', 9.5, { weight: '700', glow: '#8c0a14', glowSize: 12, track: 0.22 });
  }

  if (S.msgT > 0) {
    const a = clamp(S.msgT, 0, 1);
    if (S.msg) htxt(S.msg, W / 2, H / 2 - 24, '#f0e0c2', 'center', 19,
                    { weight: '700', alpha: a, glow: 'rgba(0,0,0,0.9)', glowSize: 18, track: 0.16 });
    if (S.sub) htxt(S.sub, W / 2, H / 2 - 10, '#a89279', 'center', 8.5, { alpha: a, track: 0.10 });
  }

  if (S.banner) {
    const b = S.banner;
    const a = clamp(b.t / 1.2, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,4,8,0.86)'; ctx.fillRect(0, H / 2 + 18, W, 44);
    const col = b.scar ? scarCol() : b.wep ? WEP[b.wep].col : '#ff2b2b';
    ctx.fillStyle = col; ctx.fillRect(0, H / 2 + 18, W, 1); ctx.fillRect(0, H / 2 + 61, W, 1);
    const spr = b.scar ? SPR.pistol : b.wep ? WEP[b.wep].spr : SPR.eye;
    drawSpr(ctx, spr, W / 2 - 84, H / 2 + 40, b.wep || b.scar ? 2 : 1.8, false, 1, b.scar ? col : null);
    const nm = b.scar ? scarName() : b.wep ? WEP[b.wep].name : 'THE THIRD EYE OF DAMJAN';
    const de = b.scar ? ('the sidearm reforged — +' + Math.round((ST().scarMul - 1) * 100) + '% damage')
             : b.wep ? WEP[b.wep].tag : 'you are no longer bound by meat.';
    ctx.globalAlpha = 1;
    htxt(nm, W / 2 - 58, H / 2 + 36, col, 'left', 12, { weight: '700', alpha: a, glow: col, glowSize: 12, track: 0.10 });
    htxt(de, W / 2 - 58, H / 2 + 50, '#b09a84', 'left', 8, { alpha: a, track: 0.05 });
  }

  crosshair();
}

/* Minimap. Shows layout, loot and threats — deliberately NOT the three secrets,
   which stay findable only by looking. */
function drawMinimap() {
  const MW = 78, MH = 54;
  const mx = W - MW - 6, my = 30;
  const sx = MW / S.aw, sy = MH / S.ah;
  const gx = x => mx + x * sx, gy = y => my + y * sy;

  ctx.fillStyle = 'rgba(6,4,8,0.72)';
  ctx.fillRect(mx - 1, my - 1, MW + 2, MH + 2);
  ctx.fillStyle = 'rgba(150,120,100,0.35)';
  ctx.fillRect(mx - 1, my - 1, MW + 2, 1); ctx.fillRect(mx - 1, my + MH, MW + 2, 1);
  ctx.fillRect(mx - 1, my - 1, 1, MH + 2); ctx.fillRect(mx + MW, my - 1, 1, MH + 2);

  // interior obstacles only (index 0-3 are the border walls)
  ctx.fillStyle = 'rgba(120,100,92,0.32)';
  for (let i = 4; i < S.walls.length; i++) {
    const w = S.walls[i];
    ctx.fillRect(gx(w.x), gy(w.y), Math.max(1, w.w * sx), Math.max(1, w.h * sy));
  }

  // the way down
  if (S.door.open) {
    ctx.fillStyle = Math.sin(S.t * 6) > 0 ? '#ff6a72' : '#8a1018';
    ctx.fillRect(gx(S.door.x) - 1, my, Math.max(3, S.door.w * sx), 2);
  }

  // weapon pedestals
  for (const sh of S.shops) {
    if (sh.bought) continue;
    ctx.fillStyle = WEP[sh.id].col;
    ctx.fillRect(gx(sh.x) - 1.5, gy(sh.y) - 1.5, 3, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(gx(sh.x) - 0.5, gy(sh.y) - 0.5, 1, 1);
  }
  // the very large man
  if (S.paci) {
    ctx.fillStyle = '#c05cff';
    ctx.fillRect(gx(S.paci.x) - 3, gy(S.paci.y) - 3, 6, 6);
  }

  // loose loot (secrets are not on here)
  for (const d of S.drops) {
    if (d.kind === 'god') continue;
    const c = d.kind === 'coin' ? '#f5c518' : d.kind === 'card' ? '#e04a54'
      : d.kind === 'med' ? '#ff6b6b' : d.kind === 'ammo' ? '#f2d14a'
      : d.kind === 'frenzy' ? '#ff8a20' : d.kind === 'siphon' ? '#c02a3a'
      : d.kind === 'magnet' ? '#9fe08a' : d.kind === 'bounty' ? '#f5c518'
      : d.kind === 'nade' ? '#7aa35e' : d.kind === 'shield' ? '#7fd0ff'
      : d.kind === 'nova' ? '#ffb03a' : '#ffffff';
    // the rare ones pulse, so a card on the far side of the arena gets noticed
    const big = d.kind === 'card' || d.kind === 'nova' || d.kind === 'shield';
    ctx.fillStyle = c;
    if (big) {
      ctx.globalAlpha = 0.5 + Math.sin(S.t * 6) * 0.3;
      ctx.fillRect(gx(d.x) - 2, gy(d.y) - 2, 4, 4);
      ctx.globalAlpha = 1;
    } else ctx.fillRect(gx(d.x) - 1, gy(d.y) - 1, 2, 2);
  }

  // threats
  for (const e of S.en) {
    if (e.boss) continue;
    ctx.fillStyle = '#ff3b46';
    ctx.fillRect(gx(e.x) - 1, gy(e.y) - 1, 2, 2);
  }
  if (S.boss) {
    const r = 3.2 + Math.sin(S.t * 5) * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,64,190,0.35)';
    ctx.beginPath(); ctx.arc(gx(S.boss.x), gy(S.boss.y), r + 2.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff40be';
    ctx.beginPath(); ctx.arc(gx(S.boss.x), gy(S.boss.y), r, 0, TAU); ctx.fill();
  }

  if (S.tomce && !S.tomce.used) {
    ctx.fillStyle = Math.sin(S.t * 3) > 0 ? '#a8e8ff' : 'rgba(168,232,255,0.45)';
    ctx.fillRect(gx(S.tomce.x) - 1, gy(S.tomce.y) - 2, 2, 4);
  }

  // you
  const px = gx(S.p.x), py = gy(S.p.y);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px - 1, py - 1, 3, 3);
  ctx.fillStyle = '#63d06a';
  ctx.fillRect(px - 0.5, py - 0.5, 2, 2);
  ctx.strokeStyle = 'rgba(99,208,106,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 0.5, py + 0.5);
  ctx.lineTo(px + 0.5 + Math.cos(S.p.ang) * 5, py + 0.5 + Math.sin(S.p.ang) * 5); ctx.stroke();
}

/* The OS cursor is hidden (body{cursor:none}), so this is the only pointer
   there is — every screen that can be clicked has to draw it, and it has to
   survive whatever it is sitting on top of. Hence the dark backing. */
function crosshair() {
  const mx = mouse.x | 0, my = mouse.y | 0;
  const play = S.mode === 'play';
  /* The centre pixel spans [mx, mx+1), so the thing to be symmetrical about is
     mx + 0.5, not mx. Measuring the near arms from mx alone left them a pixel
     further out than the far ones. Rounded, too, so a fractional recoil spread
     can't land an arm on a half pixel and smear it. */
  const g = Math.round(play ? 3 + S.p.recoil * 5 : 3), len = 3;
  const arms = [[mx - g - len, my, len, 1], [mx + g + 1, my, len, 1],
                [mx, my - g - len, 1, len], [mx, my + g + 1, 1, len]];
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  for (const a of arms) ctx.fillRect(a[0] - 1, a[1] - 1, a[2] + 2, a[3] + 2);
  ctx.fillStyle = S.god ? 'hsl(' + ((S.t * 300) % 360) + ',95%,65%)' : '#ff3b46';
  for (const a of arms) ctx.fillRect(a[0], a[1], a[2], a[3]);
  // On menus it is a pointer rather than a sight, so give it a solid centre
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(mx - 1, my - 1, 3, 3);
  ctx.fillStyle = play ? 'rgba(255,255,255,0.75)' : '#fff6ee';
  ctx.fillRect(mx, my, 1, 1);
  if (!play) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(mx - 1, my, 3, 1); ctx.fillRect(mx, my - 1, 1, 3); }
}

/* ---------- screens ---------- */
/* Buttons animate toward their hover state instead of snapping, and dim when
   they can't be used. Frame is drawn on the pixel canvas, label on the overlay.
   One label, centred in the box, and nothing underneath it — anything a button
   used to whisper in a subtitle now lives on the screen that owns it. */
const hoverT = {};
function uiBtn(x, y, w, h, label, col, fn, disabled) {
  const hot = !disabled && mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h;
  const k = label + x;
  hoverT[k] = clamp((hoverT[k] || 0) + (hot ? 0.22 : -0.18), 0, 1);
  const t = hoverT[k];
  const off = t * 1.5;                                    // lifts toward you

  if (disabled) {
    ctx.fillStyle = 'rgba(10,7,10,0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(70,58,54,0.5)';
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  } else {
    // body darkens to a bruised red as it wakes up
    ctx.fillStyle = 'rgba(' + Math.round(12 + t * 52) + ',' + Math.round(7 + t * 12) + ',' + Math.round(11 + t * 16) + ',' + (0.82 + t * 0.14) + ')';
    ctx.fillRect(x, y - off, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = t * 0.16;
    ctx.fillStyle = col; ctx.fillRect(x, y - off, w, h);
    ctx.restore();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.45 + t * 0.55;
    ctx.fillRect(x, y - off, w, 1); ctx.fillRect(x, y + h - 1 - off, w, 1);
    ctx.globalAlpha = 0.18 + t * 0.82;
    ctx.fillRect(x, y - off, 1, h); ctx.fillRect(x + w - 1, y - off, 1, h);
    // corner ticks grow on hover
    const c2 = 2 + t * 4;
    ctx.globalAlpha = t;
    ctx.fillRect(x - 1, y - 1 - off, c2, 1); ctx.fillRect(x - 1, y - 1 - off, 1, c2);
    ctx.fillRect(x + w + 1 - c2, y - 1 - off, c2, 1); ctx.fillRect(x + w, y - 1 - off, 1, c2);
    ctx.fillRect(x - 1, y + h - off, c2, 1); ctx.fillRect(x - 1, y + h + 1 - c2 - off, 1, c2);
    ctx.fillRect(x + w + 1 - c2, y + h - off, c2, 1); ctx.fillRect(x + w, y + h + 1 - c2 - off, 1, c2);
    ctx.globalAlpha = 1;
  }

  // Step the size down rather than let a long label spill past the frame, so
  // a big EVOLVE count can never break the button.
  let ls = 10;
  while (ls > 6.5 && htxtWidth(label, ls, 0.10) > w - 10) ls -= 0.5;
  htxt(label, x + w / 2, y + h / 2 - off, disabled ? 'rgba(120,104,98,0.75)' : (t > 0.4 ? '#fff6ee' : col),
       'center', ls, { mid: true, glow: t > 0.15 && !disabled ? col : null, glowSize: 14 * t, track: 0.10 });
  S.ui.push({ x, y, w, h, fn: disabled ? function () { A.denied(); } : fn });
}

/* A stat strip: pixel icon on the game canvas, crisp number on the overlay. */
function statRow(items, cy, col) {
  let total = 0;
  for (const it of items) total += 13 + htxtWidth(it.v, 8);
  let x = W / 2 - total / 2;
  for (const it of items) {
    if (it.spr) drawSpr(ctx, it.spr, x + 5, cy - 3, it.sc || 0.85);
    htxt(it.v, x + 12, cy, it.col || col || '#b9a693', 'left', 8, { track: 0.05 });
    x += 13 + htxtWidth(it.v, 8);
  }
}

function drawTitle() {
  S.ui = [];
  ctx.fillStyle = '#0a0610'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = (i * 71 + Math.sin(S.t * 0.35 + i) * 40 + S.t * 12) % (W + 40) - 20;
    const y = 52 + ((i * 53) % 170);
    ctx.globalAlpha = 0.13 + (i % 3) * 0.05;
    drawSpr(ctx, i % 3 === 0 ? SPR.stalker : i % 3 === 1 ? SPR.crawler : SPR.shrieker, x, y, 1.6, i % 2 === 0);
  }
  ctx.globalAlpha = 1;

  // a slow red breath behind the logo
  const bg = ctx.createRadialGradient(W / 2, 46, 4, W / 2, 46, 150);
  bg.addColorStop(0, 'rgba(140,14,22,' + (0.20 + Math.sin(S.t * 1.4) * 0.06) + ')');
  bg.addColorStop(1, 'rgba(140,14,22,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 120);

  const flick = Math.sin(S.t * 30) > 0.93 ? 0.4 : 1;
  /* The wordmark is the one string in the game set in the display face. A
     melted face needs less tracking than the body face does — it is already
     doing the work that letter-spacing does for the body face.

     Its size is fitted rather than fixed. 30px is right for the faces this
     was drawn against, but a display face can be half again as wide at the
     same nominal size, and a wordmark that runs off both edges of the screen
     is a worse first impression than one that is a few pixels short. */
  const disp = fontMissing().indexOf('Melted Monster') < 0;
  const trk = disp ? 0.04 : 0.14;
  let tsz = 30;
  while (tsz > 14 && htxtWidth('MEAT PROTOCOL', tsz, trk, TITLE_FONT) > W - 40) tsz -= 1;
  /* anchored on the middle of the cap box, not the baseline: two display
     faces with different cap heights then sit at the same optical height
     instead of one of them riding 6px low. 42 is where the old fixed-size
     baseline-at-52 wordmark had its cap centre. */
  htxt('MEAT PROTOCOL', W / 2, 42, '#e02630', 'center', tsz,
       { weight: '700', glow: '#8c0a14', glowSize: 26, alpha: flick,
         track: trk, font: TITLE_FONT, mid: true });
  htxt('a Damjan situation', W / 2, 66, '#7d6a5c', 'center', 8, { track: 0.30 });

  /* The fonts/ warning used to be drawn here. It was stamped on top of the
     teaser line at the bottom edge — two strings occupying the same pixels —
     and it is a developer's message, not a player's. It lives in the console
     now, once, where developers look. */
  if (!S.fontWarned && FONT_PROBED) {
    S.fontWarned = true;
    const missing = fontMissing();
    if (missing.length) console.info('[MEAT] typeface not found in fonts/: ' + missing.join(', ') + ' — using the embedded fallback.');
  }

  /* The title screen shows him before any of it happened — and it has to run
     the same arm rig, or he stands there with no arms and a floating pistol.
     K is the scale the sprite is drawn at; his centre is 5 body-pixels below
     the body's own centre, which is the origin `armRig` measures from. */
  const K = 2.2, TX = W / 2, TY = 104 + 5 * K;
  const tArms = armRig(0, 0, 0, 0, 0, -1, 0.15, false, SPR.pistol.w / SPR.pistol.ss, null);
  const tCols = armCols();
  const tPlot = (a, part) => plotArm({ ax: TX + a.ax * K, ay: TY + a.ay * K,
                                       hx: TX + a.hx * K, hy: TY + a.hy * K,
                                       cx: TX + a.cx * K, cy: TY + a.cy * K },
                                     tCols, false, 1, K, TX, TY, part);
  for (const a of tArms) if (a.behind) tPlot(a);
  drawSpr(ctx, bodySprite(0), W / 2, 104, K);
  drawSpr(ctx, legSprite(0, 0), W / 2, 127.1, K);     // 2.2 * (16/2 + 5/2) below the body centre
  for (const a of tArms) if (!a.behind) tPlot(a, 'limb');
  drawSprRot(ctx, SPR.pistol, TX, TY - 1 * K, 0.15, K, 2, 3, false);
  for (const a of tArms) if (!a.behind) tPlot(a, 'hand');
  if (cosDef(equippedCos()).fx === 'fire' && Math.random() < 0.8)
    part(W / 2 + rnd(-10, 10), 88, pick(['#ff8a20', '#ffd05a']), 1, 30, 0.5);
  drawParticles();
  updateParticles(1 / 60);

  /* Three buttons, one centred row, all the same size.
     EVOLVE and RESET EVO used to sit here, which forced a second row that was
     centred on a different axis depending on whether you had evolved — the
     row physically shifted under the cursor between visits. Both moved to the
     pause screen, where evolving costs you the run it is interrupting; see
     drawPause. What is left is a poster with one door in it. */
  const tb = [['PLAY', '#e8b25a', () => startRun()],
              ['COSMETICS', '#b558ff', () => { S.cosReturn = 'title'; S.mode = 'cos'; }],
              ['CONTRACTS', '#f0c65a', () => { S.cosReturn = 'title'; S.mode = 'contracts'; }]];
  const tbw = 96, tgap = 8, trow = tb.length * tbw + (tb.length - 1) * tgap;
  tb.forEach((b, i) => uiBtn(W / 2 - trow / 2 + i * (tbw + tgap), 152, tbw, 22, b[0], b[1], b[2]));
  if (S.evo | 0)
    htxt('EVOLUTION ' + (S.evo | 0) + ' / ' + EVO_MAX +
         (evoGuns().length ? '  ·  ' + evoGuns().length + ' guns kept' : '') +
         (evoCards().length ? '  ·  ' + evoCards().length + ' cards kept' : ''),
         W / 2, 184, 'rgba(255,106,114,0.7)', 'center', 7, { track: 0.16, noShadow: true });

  /* Below the buttons: nothing. The wallet, the contract count, the best
     score, the control listing, the secrets teaser and the font warning all
     lived down here at one point or another — a title screen is a poster,
     not a ledger. The wallet is on the pause screen, the records are on the
     death screen, the contracts have their own board. */
  post();
  crosshair();
}

function drawCosmetics() {
  S.ui = [];
  ctx.fillStyle = '#0a0610'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, 20, 4, W / 2, 20, 170);
  bg.addColorStop(0, 'rgba(120,30,190,0.16)'); bg.addColorStop(1, 'rgba(120,30,190,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('COSMETICS', W / 2, 24, '#c46bff', 'center', 20, { weight: '700', glow: '#7016b8', glowSize: 20, track: 0.20 });
  drawSpr(ctx, SPR.coin, W / 2 - 36, 33, 1);
  htxt('VAULT ' + S.vault, W / 2 - 28, 36, '#f5c518', 'left', 9, { track: 0.08 });

  const owned = ownedCos(), eq = equippedCos();
  COSMETICS.forEach((c, i) => {
    const x = 30, y = 48 + i * 30, w = W - 60, h = 26;
    const has = owned.indexOf(c.id) >= 0;
    const on = eq === c.id;
    const hot = mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h;
    const key = 'cos' + c.id;
    hoverT[key] = clamp((hoverT[key] || 0) + (hot ? 0.22 : -0.18), 0, 1);
    const t = hoverT[key];

    ctx.fillStyle = on ? 'rgba(46,18,58,0.92)' : 'rgba(14,9,15,' + (0.76 + t * 0.16) + ')';
    ctx.fillRect(x, y, w, h);
    if (t > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t * 0.12;
      ctx.fillStyle = has ? '#7fe08a' : '#c46bff'; ctx.fillRect(x, y, w, h); ctx.restore();
    }
    const edge = on ? '#c46bff' : has ? '#7fe08a' : 'rgba(120,92,82,0.8)';
    ctx.fillStyle = edge; ctx.fillRect(x, y, 2 + t * 2, h);
    ctx.globalAlpha = 0.2 + t * 0.6;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.globalAlpha = 1;

    drawSpr(ctx, c.id === 'crimson' ? SPR.body : variant(SPR.body, c.id, c.pal), x + 20, y + 13, 1.15);
    htxt(c.name, x + 36, y + 12, has ? '#efe0c8' : '#8b7a68', 'left', 9.5, { track: 0.10 });
    htxt(c.tag, x + 36, y + 21, 'rgba(150,128,112,' + (0.7 + t * 0.3) + ')', 'left', 7, { track: 0.04, noShadow: true });

    if (on) htxt('EQUIPPED', x + w - 10, y + 17, '#c46bff', 'right', 9, { glow: t > 0.2 ? '#7016b8' : null, track: 0.12 });
    else if (has) htxt('EQUIP', x + w - 10, y + 17, '#7fe08a', 'right', 9, { glow: t > 0.2 ? '#2e7a38' : null, track: 0.12 });
    else {
      const ok = S.vault >= c.price;
      htxt(String(c.price), x + w - 10, y + 17, ok ? '#f5c518' : '#96605e', 'right', 9.5, { track: 0.08 });
      drawSpr(ctx, SPR.coin, x + w - 14 - htxtWidth(String(c.price), 9.5), y + 14, 0.72);
    }
    S.ui.push({ x, y, w, h, fn: () => {
      if (has) { writeSave({ cosEq: c.id }); A.pickup(); return; }
      if (S.vault >= c.price) {
        S.vault -= c.price;
        writeSave({ vault: S.vault, cosOwned: owned.concat([c.id]), cosEq: c.id });
        A.buy(); S.flash = 0.4; S.flashCol = '#b028ff';
      } else { A.denied(); }
    } });
  });

  uiBtn(W / 2 - 48, H - 26, 96, 18, 'BACK', '#e8b25a', () => { S.mode = S.cosReturn || 'title'; });
  htxt('ESC back', W / 2, H - 4, 'rgba(120,106,94,0.65)', 'center', 7, { track: 0.10, noShadow: true });
  post();
  crosshair();
}

function drawDead() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(10,0,4,' + clamp(S.deadT * 0.7, 0, 0.9) + ')';
  ctx.fillRect(0, 0, W, H);
  if (S.deadT > 0.4) {
    htxt('YOU ARE MEAT', W / 2, 62, '#e02630', 'center', 28, { weight: '700', glow: '#8c0a14', glowSize: 24, track: 0.14 });
    htxt('FLOOR ' + (S.room + 1) + '/' + FLOORS + '  ·  WAVE ' + S.wave, W / 2, 78, '#96826f', 'center', 8.5, { track: 0.22 });
    htxt(String(S.score), W / 2, 102, '#e8d2a4', 'center', 22, { weight: '700', track: 0.06 });
    htxt('SCORE', W / 2, 112, '#6b5a4e', 'center', 7, { track: 0.34 });

    /* One row of numbers, and then the buttons.

       There were two more lines under this: a run of "guns 3/13 · cards 14 ·
       level 9 · best 41200 · EVO 2/10 — next 600 coins", and the nearest
       unsigned contract with its progress. Both were written to give you a
       reason to press RETRY, and both did the opposite — you have just died,
       and the screen answered by handing you a paragraph to read before it
       would let you at the button. The information was real but the moment is
       wrong for it: EVO and the contract ladder both live on screens you go to
       deliberately, and the wallet numbers are on the HUD every second of the
       next run anyway.

       What is left is what you actually want at the instant you die: how far
       you got, what you scored, how long it took, and RETRY. */
    statRow([
      { spr: SPR.coin, v: String(S.coins), col: '#f5c518' },
      { spr: SPR.card, v: String(S.cards), sc: 0.6, col: '#d8b8b8' },
      { v: 'VAULT ' + S.vault, col: '#9d8a7a' },
      { v: 'KILLS ' + S.kills, col: '#9d8a7a' },
      { v: runClock(), col: '#9d8a7a' }
    ], 128);

    if (S.deadT > 1.0) {
      /* Also centred, also without EVOLVE. There is no run here to restart, so
         the button had nothing to cost you — it belongs on pause. */
      const db = [['RETRY', '#e8b25a', () => startRun()],
                  ['COSMETICS', '#b558ff', () => { S.cosReturn = 'dead'; S.mode = 'cos'; }],
                  ['TITLE', '#8b7a68', () => { S.mode = 'title'; }]];
      const dbw = 96, dgap = 8, drow = db.length * dbw + (db.length - 1) * dgap;
      db.forEach((b, i) => uiBtn(W / 2 - drow / 2 + i * (dbw + dgap), 150, dbw, 22, b[0], b[1], b[2]));
      htxt('R retry · C cosmetics', W / 2, 184, 'rgba(120,106,94,0.6)', 'center', 7, { track: 0.10, noShadow: true });
    }
  }
  crosshair();
}

/* ---------- THE END ----------
   The other terminal screen. Deliberately built as the inverse of drawDead:
   that one is red on black and says you stopped; this one is warm, the wash
   drifts upward instead of pooling, and every number on it is a total rather
   than a where-you-got-to. There is no RETRY here — the verb is PLAY AGAIN,
   because you are not recovering from anything. */
function drawWin() {
  S.ui = []; uiWipe();
  S.deadT += 1 / 60;
  const t = S.deadT;
  ctx.fillStyle = 'rgba(6,4,3,0.94)'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 8, W / 2, H * 0.42, 260);
  g.addColorStop(0, 'rgba(255,176,58,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // embers going up, not motes coming down
  for (let i = 0; i < 22; i++) {
    const y = H - ((S.t * 26 + i * 37) % (H + 40));
    ctx.globalAlpha = 0.10 + (i % 4) * 0.05;
    ctx.fillStyle = i % 3 ? '#ffb03a' : '#ff6a3a';
    ctx.fillRect((i * 61 + Math.sin(S.t * 0.5 + i) * 30) % W | 0, y | 0, 2, 2);
  }
  ctx.globalAlpha = 1;

  htxt('THE PROTOCOL IS MEAT', W / 2, 54, '#ffb03a', 'center', 26,
       { weight: '700', glow: '#a04a08', glowSize: 26, track: 0.12 });
  htxt('ten floors. all of them behind you.', W / 2, 72, '#9d8a7a', 'center', 8,
       { track: 0.16 });

  if (t > 0.5) {
    htxt(String(S.score), W / 2, 100, '#e8d2a4', 'center', 22, { weight: '700', track: 0.06 });
    htxt('FINAL SCORE', W / 2, 110, '#6b5a4e', 'center', 7, { track: 0.34 });
    /* The clearance time belongs here more than anywhere: it is the one number
       on this screen you can actually try to beat next time. */
    statRow([
      { spr: SPR.coin, v: String(S.coins), col: '#f5c518' },
      { v: 'KILLS ' + S.kills, col: '#9d8a7a' },
      { v: 'CARDS ' + S.cardsTaken, col: '#9d8a7a' },
      { v: 'LEVEL ' + S.level, col: '#9d8a7a' },
      { v: runClock(), col: '#e8b25a' }
    ], 126);
    const sv = loadSave();
    htxt('guns ' + S.p.owned.length + '/' + WORDER.length +
         '  ·  clears ' + Math.max(1, cStat('protocol')) +
         '  ·  best ' + Math.max(sv.best || 0, S.score) +
         '  ·  EVO ' + (S.evo | 0) + '/' + EVO_MAX,
         W / 2, 140, '#5f5044', 'center', 7, { track: 0.10 });
    /* The one line that says the run is not the whole game: an evolved roster
       makes the next ten floors a different ten floors. */
    htxt((S.evo | 0) >= EVO_MAX
           ? 'there is nothing left to evolve. do it faster.'
           : 'EVOLVE and come back holding something. it gets worse, and so do you.',
         W / 2, 152, '#a8905c', 'center', 7, { track: 0.06 });
  }

  if (t > 1.2) {
    const db = [['PLAY AGAIN', '#e8b25a', () => startRun()],
                ['COSMETICS', '#b558ff', () => { S.cosReturn = 'win'; S.mode = 'cos'; }],
                ['TITLE', '#8b7a68', () => { S.mode = 'title'; }]];
    const dbw = 96, dgap = 8, drow = db.length * dbw + (db.length - 1) * dgap;
    db.forEach((b, i) => uiBtn(W / 2 - drow / 2 + i * (dbw + dgap), 166, dbw, 22, b[0], b[1], b[2]));
    htxt('R again · C cosmetics', W / 2, 208, 'rgba(120,106,94,0.6)', 'center', 7,
         { track: 0.10, noShadow: true });
  }
  crosshair();
}

/* A card face, drawn the same way on the level-up hand and in THE MENU. */
/* ---------- the card frame ----------
   Shared by cards and off-cuts so a hand is one shape repeated, not two
   competing designs sitting next to each other. */
function frameBox(x, y, w, h, col, t, glow) {
  // the card sits ON the screen, not IN it: a hard shadow low-right, and for
  // anything rare enough to glow, a soft halo pooling behind the whole tag
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x + 3, y + 4, w, h);
  if (glow >= 16) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 0.9);
    hg.addColorStop(0, hexA(col, (0.04 + glow / 34 * 0.05) * (1 + t)));
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(x - 24, y - 20, w + 48, h + 40);
    ctx.restore();
  }
  // paper: a slight top-lit vertical gradient instead of one flat fill
  const pg = ctx.createLinearGradient(x, y, x, y + h);
  const lift = t * 18;
  pg.addColorStop(0, 'rgba(' + Math.round(14 + lift) + ',' + Math.round(12 + lift) + ',' + Math.round(16 + lift) + ',0.97)');
  pg.addColorStop(1, 'rgba(' + Math.round(7 + lift) + ',' + Math.round(6 + lift) + ',' + Math.round(9 + lift) + ',0.97)');
  ctx.fillStyle = pg;
  ctx.fillRect(x, y, w, h);
  // paper grain: faint ruled hairlines, like a receipt that has been handled
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.022;
  for (let ly = y + 26; ly < y + h - 14; ly += 5) ctx.fillRect(x + 5, ly, w - 10, 1);
  if (glow > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (0.05 + glow / 32 * 0.15) * (0.55 + t * 0.8);
    ctx.fillStyle = lg; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.22 + t * 0.5;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  // corner ticks grow with hover, which is what makes the box feel picked up
  const tk = 5 + t * 7;
  ctx.globalAlpha = 0.55 + t * 0.45;
  ctx.fillRect(x, y, tk, 2); ctx.fillRect(x, y, 2, tk);
  ctx.fillRect(x + w - tk, y, tk, 2); ctx.fillRect(x + w - 2, y, 2, tk);
  ctx.fillRect(x, y + h - 2, tk, 2); ctx.fillRect(x, y + h - tk, 2, tk);
  ctx.fillRect(x + w - tk, y + h - 2, tk, 2); ctx.fillRect(x + w - 2, y + h - tk, 2, tk);
  ctx.globalAlpha = 1;
}

/* The punched hole that makes the frame read as a price tag hanging on a
   hook rather than a dialog box. Dark hole, a ring of the card's colour. */
function tagHole(cx, y, col) {
  ctx.fillStyle = '#030204';
  ctx.beginPath(); ctx.arc(cx, y, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.globalAlpha = 0.65;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, y, 2.6, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ONE CARD, ONE COLOUR.

   Everything drawn inside a card frame is the rarity's colour and nothing
   else. Cards used to carry an aisle stripe as well, so a hand was two
   competing colour systems in five boxes and neither could be read; the aisle
   is now text at the foot of the card and colour only on THE ORDER strip.

   The card also stopped saying so much. There was a rarity word, a rarity
   ladder, an aisle line, a name, an effect, a rider band that was drawn even
   when it was locked and said nothing, a "held" line and a row of pips. Six of
   those are only worth reading once. What is left is what you actually choose
   between: how rare, what it is called, what it does, and — when it has one —
   the rider. */
function cardFace(o, x, y, cw, ch, t, held) {
  const fusion = !!o.fusion;
  const c = fusion ? null : o.c;
  const g = GRADE[o.g];
  const yy = y - t * 4;
  const lit = fusion || o.g >= RIDER_AT;
  const cx = x + cw / 2 + 1;

  frameBox(x, yy, cw, ch, g.col, t, g.glow);
  /* The top of the card pools the rarity's light. Legendary keeps a slow
     sheen over the whole face so it is never the calm card in the row. */
  if (o.g >= 4) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.05 + Math.sin(S.t * 2.6) * 0.03 + t * 0.06;
    ctx.fillStyle = g.col; ctx.fillRect(x, yy, cw, ch);
    ctx.restore();
  }

  // the tag hole, then the rarity, then the rule — top of the tag
  tagHole(cx, yy + 9, g.col);
  htxt(fusion ? 'LEGENDARY  ·  OFF-CUT' : g.n, cx, yy + 21, g.col, 'center', 6.5,
       { track: 0.26, mid: 1, glow: o.g >= 2 ? g.col : null, glowSize: g.glow * 0.5 });
  ctx.fillStyle = g.col;
  ctx.globalAlpha = 0.30 + t * 0.35;
  ctx.fillRect(x + 16, yy + 28, cw - 32, 1);
  ctx.globalAlpha = 1;

  /* With no rider the name and effect sit in the middle of the card rather
     than leaving a hole at the bottom where the band used to be. Measured off
     the card height so a taller card recentres rather than drifting up. */
  const ny = lit ? yy + 46 : yy + Math.round(ch * 0.44);
  const nm = fusion ? o.fusion.name : cardName(c);
  const nsz = nm.length > 15 ? 8.5 : nm.length > 11 ? 10 : 11.5;
  htxt(nm, cx, ny, t > 0.4 ? '#ffffff' : '#efe4d2', 'center', nsz,
       { weight: '700', mid: 1, glow: g.col, glowSize: 7 + 15 * t, track: 0.05 });
  // a five-card hand leaves each card 84px wide; the copy scales with it so a
  // long effect wraps instead of being silently cut off at the third line
  const esz = cw < 100 ? 6.8 : 7.5;
  wrapped(fusion ? o.fusion.d : cardLine(c, o.val), cx, ny + 16, cw - 14, '#c8bba8', esz, lit ? 3 : 4);

  // the rider, when the rarity paid for one. No band, no box — just air above it.
  if (lit) {
    const by = yy + ch - 46;
    htxt('◆ ' + (fusion ? 'MADE FROM' : c.r.n), cx, by, g.col, 'center', 6.5,
         { track: 0.14, mid: 1, glow: g.col, glowSize: 8 });
    const txt2 = fusion
      ? (o.fusion.id === 'primecut' ? 'three RARE or better cards'
         : o.fusion.need.map(([id]) => CARD_BY_ID[id].name).join(' + '))
      : c.r.d;
    wrapped(txt2, cx, by + 11, cw - 16, '#ded2c0', 6.5);
  }

  /* ---- THE FOOT: two numbers, and it must be obvious which is which ----

     This used to be the aisle's NAME followed immediately by a row of pips —
     and the pips counted this CARD's ranks, not the aisle's. Two different
     scopes, touching, with only one of them labelled: "BLADES ▪▪▪▪▪▪" reads
     as six of something to do with BLADES, which is not what it was. Worse,
     the count you actually wanted while deciding — how close this aisle is to
     its next rung — was the one thing the card did not tell you.

     So: the aisle half now shows the AISLE's progress (which is what a player
     reads it for), the card half is labelled HELD, and neither is a pip.
     Numbers are unambiguous at 6px in a way that two adjacent ladders are
     not. */
  const foot = yy + ch - 9;
  if (fusion) {
    htxt('OFF-CUT', cx, foot, '#d8ccb8', 'center', 6, { track: 0.26, mid: 1, glow: g.col, glowSize: 9 });
    return 1;
  }
  const ai = AISLES[c.aisle], rank = dkr(c.id);
  const ap = aisleProgress(c.aisle);
  const lbl = ai.n + ' ' + (ap.goal ? ap.n + '/' + ap.goal : 'MAX');
  const rgt = 'HELD ' + rank + '/' + c.max;
  /* Both halves have to fit a five-card hand's 84px card. Shrink together
     rather than letting the right one slide off the edge unnoticed. */
  let fs = 6;
  while (fs > 4.6 && htxtWidth(lbl, fs, 0.12) + htxtWidth(rgt, fs, 0.06) + 8 > cw - 12) fs -= 0.25;
  htxt(lbl, x + 7, foot, '#d8ccb8', 'left', fs, { track: 0.12, mid: 1, glow: g.col, glowSize: 9 });
  /* Dimmed when you hold none of it, so "HELD 0/3" does not compete with the
     aisle count for attention on a card you have never taken. */
  htxt(rgt, x + cw - 7, foot, rank ? '#d8ccb8' : 'rgba(150,138,124,0.7)', 'right', fs,
       { track: 0.06, mid: 1, glow: rank ? g.col : null, glowSize: 9 });
  return 1;
}

/* Centred, broken on a space. `max` defaults to three lines, but a five-card
   hand makes each card narrow enough that a long effect needs a fourth or it
   is silently truncated mid-sentence. */
function wrapped(str, cx, y, maxw, col, size, max) {
  const words = String(str).split(' ');
  let line = '', out = [];
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (htxtWidth(t, size, 0.03) > maxw && line) { out.push(line); line = wd; } else line = t;
  }
  if (line) out.push(line);
  out = out.slice(0, max || 3);
  out.forEach((l, i) => htxt(l, cx, y + i * 9, col, 'center', size, { track: 0.03, noShadow: true }));
  return out.length;
}

/* THE ORDER, as a strip of five chips — one per aisle, filled toward the next
   threshold.

   It ships with its own headline because it needs one: five empty boxes
   labelled 0/4 at the start of a run tell you nothing about what they are or
   why you would want them, and sitting under a row of cards that also carry
   coloured edges, they read as a second rarity scale. The heading says what
   the bar is; the chip says what the aisle pays. */
function drawOrderStrip(y) {
  const any = AISLE_ORDER.some(k => ais(k) > 0);
  htxt('THE ORDER', 20, y, '#9d8a7a', 'left', 7, { track: 0.26, mid: 1, noShadow: true });
  /* This line used to read "4 cards earns its perk, 8 masters it", which was
     written when there were two rungs and never updated when a third arrived —
     so the strip told you an aisle was finished at 8 while a whole rung sat
     above it. Say the cadence instead of listing the numbers: it is true, it
     stays true if the numbers move, and "every 4" is the only part of this a
     player needs to carry. */
  htxt(any ? 'keep taking from one aisle — it pays you again every 4 cards, three times'
           : 'cards come from five aisles. every 4 you take from one, it pays you back.',
       20 + htxtWidth('THE ORDER', 7, 0.26) + 8, y, 'rgba(126,114,104,0.75)', 'left', 6.5,
       { track: 0.04, mid: 1, noShadow: true });

  const cw = 88, gap = 6, x0 = W / 2 - (cw * 5 + gap * 4) / 2, cy = y + 8;
  AISLE_ORDER.forEach((key, i) => {
    const ai = AISLES[key], x = x0 + i * (cw + gap);
    const { n, done, goal } = aisleProgress(key);
    /* The bar fills toward the NEXT rung from the LAST one, not from zero.
       Filling from zero meant an aisle at 9 of 12 showed a three-quarters-full
       bar that had not moved since 8, which reads as progress you are not
       making. */
    const from = done ? AISLE_RUNGS[done - 1] : 0;
    const f = goal ? clamp((n - from) / (goal - from), 0, 1) : 1;
    ctx.fillStyle = 'rgba(10,8,12,0.85)'; ctx.fillRect(x, cy, cw, 22);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.07 + done * 0.06;
    ctx.fillStyle = ai.col; ctx.fillRect(x, cy, cw * f, 22);
    ctx.restore();
    ctx.fillStyle = ai.col; ctx.globalAlpha = done ? 0.9 : 0.35;
    ctx.fillRect(x, cy, 2, 22);
    ctx.globalAlpha = 1;
    htxt(ai.n, x + 6, cy + 6, done ? ai.col : 'rgba(150,136,124,0.85)', 'left', 6,
         { track: 0.16, mid: 1, noShadow: true });
    /* Three pips for three rungs, the same shape the HUD corner uses, so the
       ladder is countable rather than inferred from a number. */
    for (let j = 0; j < AISLE_RUNGS.length; j++) {
      ctx.globalAlpha = j < done ? 0.95 : 0.22;
      ctx.fillStyle = ai.col;
      ctx.fillRect(x + cw - 9 - (AISLE_RUNGS.length - 1 - j) * 4, cy + 3, 3, 3);
    }
    ctx.globalAlpha = 1;
    htxt(goal ? n + '/' + goal : 'MAX', x + cw - 5, cy + 15,
         done ? ai.col : 'rgba(130,118,108,0.7)', 'right', 5.5,
         { track: 0.04, mid: 1, noShadow: true });
    /* What the NEXT rung pays — the one you are working toward, not the one
       you already have. A chip advertising a perk you own is not a reason to
       do anything. */
    const perk = goal ? [ai.p1, ai.p2, ai.p3][done] : ai.t3;
    const room = cw - 12 - htxtWidth(goal ? n + '/' + goal : 'MAX', 5.5, 0.04);
    let txt = perk;
    while (txt.length > 4 && htxtWidth(txt + '…', 5.5, 0.02) > room) txt = txt.slice(0, -1);
    htxt(txt === perk ? perk : txt + '…', x + 6, cy + 15,
         done ? 'rgba(210,196,180,0.85)' : 'rgba(120,110,102,0.6)', 'left', 5.5,
         { track: 0.02, mid: 1, noShadow: true });
  });
}

function drawLevelUp() {
  S.ui = []; uiWipe();
  const top = S.handTop | 0;
  ctx.fillStyle = 'rgba(4,3,6,0.90)'; ctx.fillRect(0, 0, W, H);
  /* The backdrop takes the colour of the best thing in the hand, so an EPIC
     screen is a different colour of room before you have read a word. Derived
     from the ladder rather than hardcoded, so retuning the palette retunes
     the room with it. */
  const wash = top >= 2 ? GRADE[top].col : '#6a4478';
  const bg = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, 210);
  bg.addColorStop(0, hexA(wash, 0.13 + top * 0.03));
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('THE MENU', W / 2, 17, '#e8d2a4', 'center', 20,
       { weight: '700', mid: 1, glow: wash, glowSize: 14 + top * 5, track: 0.20 });
  htxt('LEVEL ' + S.level + (S.upgPts > 1 ? '  ·  ' + S.upgPts + ' PICKS LEFT' : '  ·  TAKE ONE'),
       W / 2, 30, '#8d7f92', 'center', 7.5, { track: 0.24, mid: 1 });

  const hand = S.hand || [];
  S.handIn = Math.min(1, (S.handIn || 0) + 0.06);
  /* The hand is not always three. THE FULL MENU widens it to four and TOMCE's
     HOLLOW adds a fifth, and a fixed card width put five cards 86px past both
     edges of a 480px screen. Fit the row to the space instead of guessing. */
  const gap = 9, ROOM = W - 24;
  const CW = Math.min(118, Math.floor((ROOM - gap * (hand.length - 1)) / Math.max(1, hand.length)));
  const CH = 140, cy = 42;
  const x0 = W / 2 - (CW * hand.length + gap * (hand.length - 1)) / 2;
  hand.forEach((o, i) => {
    // each card deals in a beat after the one before it
    const a = clamp(S.handIn * 3.2 - i * 0.55, 0, 1);
    const ease = 1 - Math.pow(1 - a, 3);
    const x = x0 + i * (CW + gap), y = cy + (1 - ease) * 26;
    const key = 'card' + i + (o.fusion ? o.fusion.id : o.c.id);
    const hot = a >= 1 && mouse.x > x && mouse.x < x + CW && mouse.y > y - 6 && mouse.y < y + CH;
    hoverT[key] = clamp((hoverT[key] || 0) + (hot ? 0.22 : -0.18), 0, 1);
    ctx.save();
    ctx.globalAlpha = ease;
    cardFace(o, x, y, CW, CH, hoverT[key], true);
    ctx.restore();
    if (a >= 1) S.ui.push({ x, y: y - 6, w: CW, h: CH + 6, fn: () => takeCard(o) });
  });

  /* Three things and no more: the cards, what the aisles pay, and the reroll.
     This screen also carried a rarity legend, a line explaining riders, the
     nearest off-cut with its progress, and a luck/coins readout — all true,
     all things you read once, and together they turned a choice between three
     cards into a wall of text you had to look past to make it. The rarity
     names explain themselves, a rider announces itself with a banner the
     first time it fires, and an off-cut is loud enough when it turns up. */
  drawOrderStrip(196);

  const rc = rerollCost(), can = S.coins >= rc;
  uiBtn(W / 2 - 66, 236, 132, 18, 'REROLL  ' + rc, can ? '#f5c518' : '#6b5a4e', () => rerollHand(), !can);
  crosshair();
}

/* ---------- THE EVOLUTION PICK ----------
   What a rung actually pays for. Either the guns of the rarity it opened, or
   — once the roster covers every rarity — three cards at LEGENDARY to open
   the next run holding. Whatever you take, the run restarts on the way out;
   that is the price of the rung, and the screen says so on both counts. */
function drawEvoPick() {
  S.ui = []; uiWipe();
  const off = S.evoOffer;
  ctx.fillStyle = 'rgba(6,2,10,0.95)'; ctx.fillRect(0, 0, W, H);
  const wash = off && off.kind === 'card' ? GRADE[4].col : '#b028ff';
  const bg = ctx.createRadialGradient(W / 2, H / 2, 8, W / 2, H / 2, 240);
  bg.addColorStop(0, hexA(wash, 0.20)); bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // rising motes, because something has just happened to the world
  for (let i = 0; i < 14; i++) {
    const y = H - ((S.t * 22 + i * 43) % (H + 30));
    ctx.globalAlpha = 0.10 + (i % 3) * 0.04;
    ctx.fillStyle = wash;
    ctx.fillRect((i * 71 + Math.sin(S.t * 0.7 + i) * 26) % W | 0, y | 0, 2, 2);
  }
  ctx.globalAlpha = 1;
  S.evoIn = Math.min(1, (S.evoIn || 0) + 0.05);

  htxt('EVOLUTION ' + (S.evo | 0), W / 2, 22, '#ff6a72', 'center', 22,
       { weight: '700', mid: 1, glow: '#8c0a14', glowSize: 22, track: 0.18 });
  if (!off) { crosshair(); return; }

  if (off.kind === 'gun') {
    const tier = off.tier | 0;
    htxt('the crate opens a rung. one of these is yours, in every run, forever.',
         W / 2, 38, '#8d7f92', 'center', 7.5, { track: 0.08, mid: 1 });
    htxt(GRADE[tier].n, W / 2, 50, GRADE[tier].col, 'center', 9,
         { track: 0.30, mid: 1, glow: GRADE[tier].col, glowSize: 10 });

    const n = off.guns.length;
    const gap = 12, CW = Math.min(150, Math.floor((W - 40 - gap * (n - 1)) / n)), CH = 126, cy = 60;
    const x0 = W / 2 - (CW * n + gap * (n - 1)) / 2;
    off.guns.forEach((id, i) => {
      const w = WEP[id], col = GRADE[w.gr].col;
      const a = clamp(S.evoIn * 3 - i * 0.4, 0, 1), ease = 1 - Math.pow(1 - a, 3);
      const x = x0 + i * (CW + gap);
      const key = 'evog' + id;
      const hot = a >= 1 && mouse.x > x && mouse.x < x + CW && mouse.y > cy - 6 && mouse.y < cy + CH;
      hoverT[key] = clamp((hoverT[key] || 0) + (hot ? 0.20 : -0.16), 0, 1);
      const t = hoverT[key], y = cy - t * 4 + (1 - ease) * 22;
      ctx.save(); ctx.globalAlpha = ease;

      frameBox(x, y, CW, CH, col, t, GRADE[w.gr].glow);
      ctx.fillStyle = col; ctx.globalAlpha = ease * (0.14 + t * 0.12);
      ctx.fillRect(x + 2, y + 3, CW - 3, 12);
      ctx.globalAlpha = ease;
      htxt(GRADE[w.gr].n, x + CW / 2, y + 9, col, 'center', 6.5,
           { track: 0.26, mid: 1, glow: col, glowSize: 10 });

      // the gun, lit from underneath and floating like a grocery
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ease * (0.10 + t * 0.10 + Math.sin(S.t * 2.4) * 0.03);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x + CW / 2, y + 40, 24, 0, TAU); ctx.fill();
      ctx.restore();
      drawSpr(ctx, w.spr, x + CW / 2, y + 40 + Math.sin(S.t * 2 + i) * 1.5, 2.4);

      htxt(w.name, x + CW / 2, y + 68, t > 0.4 ? '#ffffff' : '#e8dcc8', 'center', 10.5,
           { weight: '700', mid: 1, glow: col, glowSize: 10 + 14 * t, track: 0.04 });
      wrapped(w.tag, x + CW / 2, y + 82, CW - 20, '#c8bba8', 7);
      htxt('PACI wanted ' + w.price, x + CW / 2, y + CH - 10, 'rgba(150,132,118,0.8)', 'center', 6.5,
           { track: 0.04, mid: 1, noShadow: true });
      ctx.restore();
      if (a >= 1) S.ui.push({ x, y: cy - 6, w: CW, h: CH + 6, fn: () => takeEvoGun(id) });
    });

    const need = EVO_TIERS_ALL.filter(g => evoGuns().every(id => WEP[id].gr !== g));
    htxt(need.length
           ? 'still missing: ' + need.map(g => GRADE[g].n).join(', ') +
             '  —  hold one of every rarity and the rungs start dealing cards'
           : 'the roster is complete. the next rung deals LEGENDARY cards.',
         W / 2, H - 24, 'rgba(150,132,118,0.75)', 'center', 7, { track: 0.06, mid: 1, noShadow: true });
  } else {
    htxt('the roster holds one of every rarity. take one into every run.',
         W / 2, 38, '#8d7f92', 'center', 7.5, { track: 0.08, mid: 1 });
    htxt('LEGENDARY', W / 2, 50, GRADE[4].col, 'center', 9,
         { track: 0.30, mid: 1, glow: GRADE[4].col, glowSize: 12 });

    const hand = off.cards;
    const gap = 10, CW = Math.min(118, Math.floor((W - 28 - gap * (hand.length - 1)) / Math.max(1, hand.length)));
    const CH = 138, cy = 60;
    const x0 = W / 2 - (CW * hand.length + gap * (hand.length - 1)) / 2;
    hand.forEach((o, i) => {
      const a = clamp(S.evoIn * 3.2 - i * 0.5, 0, 1), ease = 1 - Math.pow(1 - a, 3);
      const x = x0 + i * (CW + gap), y = cy + (1 - ease) * 24;
      const key = 'evoc' + o.c.id;
      const hot = a >= 1 && mouse.x > x && mouse.x < x + CW && mouse.y > y - 6 && mouse.y < y + CH;
      hoverT[key] = clamp((hoverT[key] || 0) + (hot ? 0.22 : -0.18), 0, 1);
      ctx.save(); ctx.globalAlpha = ease;
      cardFace(o, x, y, CW, CH, hoverT[key], true);
      ctx.restore();
      if (a >= 1) S.ui.push({ x, y: y - 6, w: CW, h: CH + 6, fn: () => takeEvoCard(o) });
    });

    const held = evoCards().map(id => (evoCardDef(id) || {}).name).filter(Boolean);
    if (held.length)
      htxt('already starting with  ' + held.join('  ·  '), W / 2, H - 24,
           'rgba(150,132,118,0.75)', 'center', 7, { track: 0.06, mid: 1, noShadow: true });
  }

  htxt('taking it starts the run over. that is what the coins were for.',
       W / 2, H - 10, 'rgba(126,114,124,0.6)', 'center', 7, { track: 0.10, mid: 1, noShadow: true });
  crosshair();
}

/* THE MENU, read-only: everything the run has picked up so far.

   Each aisle is a PANEL — a boxed section with its own header bar — instead
   of a loose heading floating over loose rows. The old layout put the card
   name hard left and its effect hard right across a 214px column, which left
   a void in the middle of every line and no visible grouping; it read as two
   unrelated lists that happened to share a screen. */
function drawDeck() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(5,4,7,0.94)'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, 16, 6, W / 2, 16, 200);
  bg.addColorStop(0, 'rgba(120,40,150,0.13)'); bg.addColorStop(1, 'rgba(120,40,150,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('THE DECK', 14, 15, '#e8d2a4', 'left', 15, { weight: '700', mid: 1, glow: '#5a2a6a', glowSize: 14, track: 0.22 });
  htxt('LEVEL ' + S.level + '  ·  ' + S.cardsTaken + ' cards  ·  LUCK ' + (Math.round(S.luck * 10) / 10),
       W - 14, 15, '#9d8a7a', 'right', 7.5, { track: 0.10, mid: 1 });

  /* Signatures and off-cuts as chips — boxed, so they read as things you own
     rather than stray words. They wrap; five signatures plus off-cuts is
     wider than the screen. */
  let y = 27;
  /* The signature chips are gone with the groceries. What sits on this row now
     is every aisle rung you have earned — the named states, which are exactly
     the same shape of possession an off-cut is: a thing you have, not a number
     you accumulated. Off-cuts follow on the same row. */
  const rungs = [];
  for (const k of AISLE_ORDER) {
    const ai = AISLES[k];
    if (aisleT3(k)) rungs.push({ n: ai.t3, col: ai.col, big: 1 });
    else if (aisleT2(k)) rungs.push({ n: ai.n + ' MASTERED', col: ai.col });
    else if (aisleT1(k)) rungs.push({ n: ai.n + ' ORDER', col: ai.col });
  }
  if (rungs.length || S.fusedOrder.length) {
    let x = 14;
    const chip = (w, draw) => {
      if (x + w > W - 14) { x = 14; y += 15; }
      ctx.fillStyle = 'rgba(14,11,17,0.9)'; ctx.fillRect(x, y, w, 13);
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#9d8a7a';
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 12, w, 1);
      ctx.fillRect(x, y, 1, 13); ctx.fillRect(x + w - 1, y, 1, 13);
      ctx.globalAlpha = 1;
      draw(x);
      x += w + 5;
    };
    for (const r of rungs) {
      chip(htxtWidth(r.n, 6.5, 0.04) + 12, cx => {
        htxt(r.n, cx + 6, y + 6.5, r.col, 'left', 6.5,
             { track: 0.04, mid: 1, glow: r.big ? r.col : null, glowSize: 8 });
      });
    }
    for (const fid of S.fusedOrder) {
      const f = FUSION_BY_ID[fid], lbl = '◆ ' + f.name;
      chip(htxtWidth(lbl, 6.5, 0.04) + 12, cx => {
        htxt(lbl, cx + 6, y + 6.5, GRADE[4].col, 'left', 6.5,
             { track: 0.04, mid: 1, glow: GRADE[4].col, glowSize: 7 });
      });
    }
    y += 20;
  }

  /* Aisle panels, two columns, flowed left column first. */
  let col = 0;
  const top = y, colX = [14, 244], colW = 222;
  const colY = [y, y];
  for (const key of AISLE_ORDER) {
    const held = CARDS.filter(c => c.aisle === key && dkr(c.id) > 0);
    if (!held.length) continue;
    const riders = held.filter(c => riderOn(c.id)).length;
    const need = 14 + held.length * 10 + riders * 9 + 6;
    // place the panel in whichever column it fits; prefer the emptier one
    col = colY[0] <= colY[1] ? 0 : 1;
    if (colY[col] + need > H - 26 && colY[1 - col] + need <= H - 26) col = 1 - col;
    const ai = AISLES[key], x = colX[col];
    let py = colY[col];
    const h = Math.min(need, H - 26 - py);
    if (h < 24) continue;                       // no room left at all — skip, don't smear

    // panel: body, hairline frame, aisle-coloured left edge and header bar
    ctx.fillStyle = 'rgba(12,10,15,0.9)'; ctx.fillRect(x, py, colW, h);
    ctx.fillStyle = ai.col;
    ctx.globalAlpha = 0.13; ctx.fillRect(x, py, colW, 12);
    ctx.globalAlpha = 0.9;  ctx.fillRect(x, py, 2, h);
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x, py, colW, 1); ctx.fillRect(x, py + h - 1, colW, 1); ctx.fillRect(x + colW - 1, py, 1, h);
    ctx.globalAlpha = 1;

    /* The header said MASTERED at 8 and then had nothing left to say, so an
       aisle sitting at 11 of 12 looked finished. It walks all three rungs
       now: what you have earned, and how far to the next one. */
    const ap = aisleProgress(key);
    const earned = ap.done === 3 ? ai.t3 : ap.done === 2 ? 'MASTERED' : ap.done === 1 ? 'THE ORDER' : '';
    const tag = ap.goal ? (earned ? earned + '  ' : '') + ap.n + '/' + ap.goal : earned;
    htxt(ai.n, x + 7, py + 6, ai.col, 'left', 7, { track: 0.24, mid: 1 });
    htxt(tag, x + colW - 6, py + 6, ap.done ? ai.col : 'rgba(130,118,108,0.75)', 'right', 6,
         { track: 0.08, mid: 1, noShadow: true });

    let ry = py + 14, row = 0;
    for (const c of held) {
      if (ry + 9 > py + h - 2) break;
      const d = S.deck[c.id], lit = riderOn(c.id);
      // alternate row wash, so a long panel stays scannable
      if (row % 2) { ctx.fillStyle = 'rgba(255,255,255,0.022)'; ctx.fillRect(x + 2, ry - 4, colW - 3, lit ? 19 : 10); }
      htxt(cardName(c) + (d.rank > 1 ? ' ×' + d.rank : ''), x + 8, ry + 1, GRADE[d.g | 0].col, 'left', 7,
           { track: 0.03, mid: 1 });
      htxt(cardLine(c, d.amt), x + colW - 6, ry + 1, 'rgba(158,142,126,0.9)', 'right', 6,
           { track: 0.01, mid: 1, noShadow: true });
      ry += 10;
      if (lit) {
        htxt('◆ ' + c.r.n + ' — ' + c.r.d, x + 14, ry, GRADE[d.g | 0].col, 'left', 5.5,
             { track: 0.01, mid: 1, alpha: 0.8, noShadow: true });
        ry += 9;
      }
      row++;
    }
    colY[col] = py + h + 7;
  }
  // `sigs` was the signature-grocery list; the empty case is now just the deck
  if (!S.cardsTaken)
    htxt('nothing yet. go and level up.', W / 2, 120, '#5f5044', 'center', 8, { mid: 1 });

  uiBtn(W / 2 - 48, H - 20, 96, 16, 'BACK', '#e8b25a', () => { S.mode = 'pause'; });
  crosshair();
}

/* TOMCE's offer. Not a card screen — every row is a trade, and the cost is
   printed as loudly as the benefit. */
function drawAugments() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(3,6,8,0.92)'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, 210);
  bg.addColorStop(0, 'rgba(30,110,150,0.16)'); bg.addColorStop(1, 'rgba(30,110,150,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  drawSpr(ctx, Math.sin(S.t * 0.7) > 0 ? SPR.tomce2 : SPR.tomce, 40, H / 2 - 4, 2.3, false, 0.85);
  htxt('TOMCE', W / 2 + 18, 30, '#a8e8ff', 'center', 20,
       { weight: '700', glow: '#14506a', glowSize: 18, track: 0.26 });
  htxt('"i can do something about that. it will cost you something else."',
       W / 2 + 18, 44, '#6f8894', 'center', 7.5, { track: 0.08 });

  const offer = S.augOffer || [];
  const CW = 118, gap = 9, CH = 104, y = 58;
  const x0 = W / 2 + 18 - (CW * offer.length + gap * (offer.length - 1)) / 2;
  offer.forEach((a, i) => {
    const x = x0 + i * (CW + gap);
    const hot = mouse.x > x && mouse.x < x + CW && mouse.y > y && mouse.y < y + CH;
    const k = 'aug' + a.id;
    hoverT[k] = clamp((hoverT[k] || 0) + (hot ? 0.22 : -0.18), 0, 1);
    const t = hoverT[k], off = t * 3, yy = y - off;
    const rank = ag(a.id) + 1;

    ctx.fillStyle = 'rgba(' + Math.round(8 + t * 16) + ',' + Math.round(11 + t * 24) + ',' + Math.round(14 + t * 30) + ',0.95)';
    ctx.fillRect(x, yy, CW, CH);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t * 0.13;
    ctx.fillStyle = '#a8e8ff'; ctx.fillRect(x, yy, CW, CH); ctx.restore();
    ctx.fillStyle = '#a8e8ff'; ctx.globalAlpha = 0.6 + t * 0.4;
    ctx.fillRect(x, yy, CW, 2);
    ctx.globalAlpha = 0.18 + t * 0.5;
    ctx.fillRect(x, yy + CH - 1, CW, 1); ctx.fillRect(x, yy, 1, CH); ctx.fillRect(x + CW - 1, yy, 1, CH);
    ctx.globalAlpha = 1;

    htxt(a.name, x + CW / 2, yy + 16, t > 0.4 ? '#ffffff' : '#a8e8ff', 'center',
         a.name.length > 11 ? 10 : 12, { weight: '700', glow: t > 0.15 ? '#a8e8ff' : null, glowSize: 14 * t, track: 0.06 });
    if (a.max > 1) htxt('STAGE ' + rank + '/' + a.max, x + CW / 2, yy + 25, 'rgba(130,150,160,0.8)', 'center', 6, { track: 0.20, noShadow: true });

    // the good half, then a rule, then the bill
    const uy = yy + 38;
    htxt('GAIN', x + 8, uy, '#7fe08a', 'left', 6.5, { track: 0.22, noShadow: true });
    const un = wrapped(a.up(rank), x + CW / 2, uy + 11, CW - 14, '#9fe08a', 8);
    const ry = uy + 11 + un * 9 + 3;
    ctx.fillStyle = 'rgba(168,232,255,0.20)'; ctx.fillRect(x + 10, ry, CW - 20, 1);
    htxt('COST', x + 8, ry + 12, '#ff6a72', 'left', 6.5, { track: 0.22, noShadow: true });
    wrapped(a.dn(rank), x + CW / 2, ry + 23, CW - 14, '#ff8a90', 8);

    S.ui.push({ x, y, w: CW, h: CH, fn: () => takeAugment(a) });
  });

  uiBtn(W / 2 + 18 - 54, H - 26, 108, 17, 'WALK AWAY', '#8b7a68', () => refuseAugments());
  htxt('he only offers once a floor.', W / 2 + 18, H - 6, 'rgba(110,132,142,0.65)', 'center', 7,
       { track: 0.10, noShadow: true });
  crosshair();
}

/* The contracts board. Persistent, cross-run, and the only thing in the game
   that hands out permanent rules rather than permanent numbers. */
function drawContracts() {
  S.ui = [];
  ctx.fillStyle = '#0a0610'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, 18, 4, W / 2, 18, 190);
  bg.addColorStop(0, 'rgba(200,140,20,0.15)'); bg.addColorStop(1, 'rgba(200,140,20,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const done = CONTRACTS.filter(c => contractDone(c.id)).length;
  htxt('CONTRACTS', W / 2, 22, '#f0c65a', 'center', 18, { weight: '700', glow: '#6a4a10', glowSize: 16, track: 0.22 });
  htxt(done + ' / ' + CONTRACTS.length + ' SIGNED', W / 2, 34, '#8b7a68', 'center', 7.5, { track: 0.26 });

  CONTRACTS.forEach((c, i) => {
    const x = 20, y = 42 + i * 21, w = W - 40, h = 19;
    const have = cStat(c.stat), ok = have >= c.goal;
    const f = clamp(have / c.goal, 0, 1);
    ctx.fillStyle = ok ? 'rgba(28,22,10,0.9)' : 'rgba(12,10,14,0.85)';
    ctx.fillRect(x, y, w, h);
    // progress reads as a fill behind the text, not a separate bar
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ok ? 0.10 : 0.07;
    ctx.fillStyle = ok ? '#ffb03a' : '#7fd0ff'; ctx.fillRect(x, y, w * f, h); ctx.restore();
    ctx.fillStyle = ok ? '#ffb03a' : 'rgba(120,100,90,0.7)';
    ctx.fillRect(x, y, 2, h);
    ctx.globalAlpha = 0.25; ctx.fillRect(x, y + h - 1, w, 1); ctx.globalAlpha = 1;

    htxt(c.name, x + 8, y + 9, ok ? '#ffd070' : '#c0ac96', 'left', 8.5, { track: 0.10 });
    htxt(c.d, x + 8, y + 17, 'rgba(140,124,112,0.85)', 'left', 6.5, { track: 0.02, noShadow: true });
    htxt(ok ? 'SIGNED' : Math.min(have, c.goal) + ' / ' + c.goal, x + w - 8, y + 9,
         ok ? '#ffb03a' : '#8b7a68', 'right', 8, { track: 0.08 });
    htxt(c.u, x + w - 8, y + 17, ok ? 'rgba(180,200,150,0.9)' : 'rgba(110,96,86,0.8)', 'right', 6.5,
         { track: 0.02, noShadow: true });
  });

  uiBtn(W / 2 - 48, H - 20, 96, 16, 'BACK', '#e8b25a', () => { S.mode = S.cosReturn || 'title'; });
  post();
  crosshair();
}

/* A ruled section heading, so the two lists read as two lists. */
function sectionRule(label, y) {
  htxt(label, 30, y, '#9d8a7a', 'left', 9, { track: 0.26 });
  const lw = htxtWidth(label, 9, 0.26);
  ctx.fillStyle = 'rgba(157,138,122,0.26)';
  ctx.fillRect(30 + lw + 8, y - 3, W - 60 - lw - 8, 1);
}

function drawPause() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(5,3,8,0.88)'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, 16, 6, W / 2, 16, 200);
  bg.addColorStop(0, 'rgba(150,24,32,0.13)'); bg.addColorStop(1, 'rgba(150,24,32,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('PAUSED', W / 2, 26, '#e8d2a4', 'center', 20, { weight: '700', glow: '#4a2a10', glowSize: 16, track: 0.24 });

  /* Buttons live in a centred row under the title. MAIN MENU abandons the
     run: coins, cards and the vault are already banked continuously, so the
     only thing lost is the floor you are standing on — same as dying, minus
     the death. */
  /* "THE DECK", not "THE MENU": with MAIN MENU sitting two buttons away on
     the same row, two buttons both called menu read as the same door. THE
     MENU stays the name of the level-up screen — the supermarket you pick
     from — and this button is the deck you picked, so it says so. */
  /* EVOLVE lives here and nowhere else now. It restarts the run, so it belongs
     on the screen where the run is in front of you and the coins it costs are
     on the same screen — from the title it was a lever with no visible price
     and nothing to lose by pulling it. */
  const maxed = (S.evo | 0) >= EVO_MAX;
  const btns = [['THE DECK', '#f0c65a', () => { S.mode = 'deck'; }],
                ['COSMETICS', '#b558ff', () => { S.cosReturn = 'pause'; S.mode = 'cos'; }],
                [maxed ? 'EVOLVE MAX' : 'EVOLVE ' + (S.evo | 0), '#ff4a54', () => evolve(), !canEvolve()]];
  if (S.evo | 0) btns.push(['RESET EVO', '#7fe08a', () => resetEvolution()]);
  btns.push(['MAIN MENU', '#ff6a72', () => quitToTitle()]);
  const gap = 7, bw = Math.min(96, Math.floor((W - 36 - gap * (btns.length - 1)) / btns.length));
  const rowW = btns.length * bw + (btns.length - 1) * gap;
  btns.forEach((b, i) => uiBtn(W / 2 - rowW / 2 + i * (bw + gap), 40, bw, 18, b[0], b[1], b[2], b[3]));

  /* One line under the row saying exactly what the red button wants, because
     a disabled button that will not say why is a bug as far as a player is
     concerned. */
  const cost = EVO_COST(S.evo | 0);
  htxt(maxed
         ? 'EVOLUTION ' + EVO_MAX + ' — there is no eleventh rung'
         : (canEvolve()
              ? 'EVOLVE  ·  ' + cost + ' coins  ·  restarts the run  ·  ' +
                (evoReward((S.evo | 0) + 1) === 'card' ? 'deals three LEGENDARY cards' : 'opens the crate a rung')
              : 'EVOLVE  ·  ' + cost + ' coins  ·  you have ' + S.coins),
       W / 2, 66, canEvolve() ? 'rgba(255,120,124,0.85)' : 'rgba(130,112,104,0.75)', 'center', 7,
       { track: 0.08, noShadow: true });

  /* THE ORDER, in place of the old signature list. Every aisle you have put a
     rank into, how far along it is, and what the next rung costs — the one
     progress bar in the game that a player can actually steer toward. */
  let y = 84;
  sectionRule('THE ORDER', y);
  y += 12;
  let any = false;
  for (const k of AISLE_ORDER) {
    const n = ais(k); if (!n) continue; any = true;
    const ai = AISLES[k];
    const { done: rung, goal: next } = aisleProgress(k);
    // rank tick, then the aisle, then where it stands
    ctx.fillStyle = ai.col; ctx.globalAlpha = 0.6;
    ctx.fillRect(32, y - 4, 2, 7); ctx.globalAlpha = 1;
    htxt(ai.n, 38, y + 1, ai.col, 'left', 8, { track: 0.06 });
    const lbl = rung === 3 ? ai.t3 : rung === 2 ? 'MASTERED' : rung === 1 ? 'THE ORDER' : '—';
    htxt(lbl, 84, y + 1, rung ? ai.col : 'rgba(120,104,94,0.7)', 'left', 7,
         { track: 0.06, noShadow: true, glow: rung === 3 ? ai.col : null, glowSize: 8 });
    htxt(next ? n + '/' + next + ' ranks' : n + ' ranks  ·  maxed',
         W - 38, y + 1, 'rgba(140,120,106,0.85)', 'right', 7, { track: 0.03, noShadow: true });
    y += 10;
  }
  if (S.god) { drawSpr(ctx, SPR.eye, 38, y - 2, 0.8); htxt('THE THIRD EYE — you cannot die', 50, y + 1, '#ff5b5b', 'left', 8); y += 10; any = true; }
  if (!any) { htxt('nothing committed to yet. every 4 ranks in one aisle buys a rung — there are three.', 38, y + 1, '#5f5044', 'left', 7.5); y += 10; }

  /* Arsenal, divided by rarity — one row per rung, guns laid along it.

     It used to be one flat run of eleven names down two columns ordered by
     WORDER, which is draw order rather than a hierarchy: the only thing that
     told you a GOD FINGER outranked a STAPLER was the colour of its name, and
     nothing at all told you which rarity evolution was about to open.

     Rows, not columns, and for a reason beyond taste. Stacking the five
     groups into columns cost a header per group, and the worst case here —
     five signatures and THE THIRD EYE stacked above — pushed the tallest
     column straight through the wallet strip at the bottom. Along a row the
     header is the row, so five rarities cost five lines instead of five
     headers plus eleven rows. */
  y += 6;
  sectionRule('ARSENAL', y);
  y += 11;
  const byGrade = [[], [], [], [], []];
  for (const id of WORDER) byGrade[WEP[id].gr | 0].push(id);
  const LABX = 30, GUNX = 92;
  byGrade.forEach((list, g) => {
    if (!list.length) return;
    // a tick of the rarity's colour, then the rarity, then its guns
    ctx.fillStyle = GRADE[g].col; ctx.globalAlpha = 0.55;
    ctx.fillRect(LABX - 6, y - 5, 2, 7); ctx.globalAlpha = 1;
    htxt(GRADE[g].n, LABX, y + 1, GRADE[g].col, 'left', 7, { track: 0.18, noShadow: true });

    let gx = GUNX;
    for (const id of list) {
      const w = WEP[id], has = S.p.owned.indexOf(id) >= 0;
      const perm = evoGuns().indexOf(id) >= 0;
      const nm = w.evolve ? scarName() : w.name;
      drawSpr(ctx, w.spr, gx + 6, y - 2, 0.8, false, has ? 1 : 0.22);
      htxt(nm, gx + 13, y + 1, has ? (w.evolve ? scarCol() : GRADE[g].col) : '#4a3f36',
           'left', 7.5, { track: 0.04 });
      gx += 13 + htxtWidth(nm, 7.5, 0.04) + 3;
      /* EVO outranks OWNED as a label: it says you keep it, not merely that
         you are holding it this run. */
      const tag = perm ? 'EVO' : has ? 'OWNED' : (w.cards ? w.cards + 'c' : String(w.price));
      htxt(tag, gx, y + 1,
           perm ? 'rgba(255,120,124,0.9)' : has ? 'rgba(126,150,112,0.85)' : '#6b5a4e',
           'left', 6, { track: 0.04, noShadow: true });
      gx += htxtWidth(tag, 6, 0.04) + 13;
    }
    y += 11;
  });

  statRow([
    { spr: SPR.coin, v: String(S.coins), col: '#f5c518' },
    { spr: SPR.card, v: String(S.cards), sc: 0.6, col: '#d8b8b8' },
    { v: 'VAULT ' + S.vault, col: '#9d8a7a' },
    { v: 'EVO ' + (S.evo | 0), col: (S.evo | 0) ? '#ff6a72' : '#6b5a4e' }
  ], H - 12);
  if (S.goro) htxt('GOROMANIA  +25% DMG', W - 30, H - 24, '#b558ff', 'right', 7.5, { track: 0.14 });
  crosshair();
}

/* ============================================================
   LOOP
   ============================================================ */
let last = performance.now();
function frame(now) {
  const _f0 = performance.now();
  _accAct = 0; _accPar = 0;
  let _w0 = 0, _w1 = 0, _l1 = 0, _p1 = 0, _h1 = 0;
  const dt = clamp((now - last) / 1000, 0, 0.05);   // survives tab-switches and clock jumps
  last = now;
  if (S.muzzle) S.muzzle.t -= dt;

  // menu clicks (any non-play screen)
  if (S.mode !== 'play' && clickQueue.length) {
    for (const c of clickQueue) {
      for (let i = S.ui.length - 1; i >= 0; i--) {
        const b = S.ui[i];
        if (c.x > b.x && c.x < b.x + b.w && c.y > b.y && c.y < b.y + b.h) { b.fn(); break; }
      }
    }
  }
  clickQueue = [];

  const _u0 = performance.now();
  update(dt);
  const _u1 = performance.now();

  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  octx.clearRect(0, 0, ov.width, ov.height);

  if (S.mode === 'title') drawTitle();
  else if (S.mode === 'cos') drawCosmetics();
  else if (S.mode === 'contracts') drawContracts();
  else {
    _w0 = performance.now();
    drawWorld();      _pbFlush(); _w1 = performance.now();
    drawLight();      _pbFlush(); _l1 = performance.now();
    post();           _pbFlush(); _p1 = performance.now();
    drawHUD();        _pbFlush(); _h1 = performance.now();
    if (S.mode === 'pause') drawPause();
    if (S.mode === 'deck') drawDeck();
    if (S.mode === 'levelup') drawLevelUp();
    if (S.mode === 'evolve') drawEvoPick();
    if (S.mode === 'augment') drawAugments();
    if (S.mode === 'dead') drawDead();
    if (S.mode === 'win') drawWin();
  }

  if (S.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(S.fade, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }

  /* The probe records last so `total` covers the whole frame, and the overlay
     draws after it so it can show the frame it just measured. `_w0` stays 0 on
     the title/cosmetics/contracts screens, which do not go through the world
     path — recording zeros there would drag every average down with frames
     that never drew a world. */
  if (_w0) {
    _pbRec(_f0, _u1 - _u0, (_w1 - _w0) - _accAct - _accPar, _accAct, _accPar,
           _l1 - _w1, _p1 - _l1, _h1 - _p1, performance.now() - _f0);
  }
  if (PROBE.on) drawDebug();
  if (!_soaking) requestAnimationFrame(frame);
}

/* ============================================================
   F3 — the debug overlay.

   Drawn on #overlay, LAST, after the fade and after every modal screen, for
   one reason: `uiWipe()` clears the overlay and any screen that paints over
   the world calls it. A probe you cannot read on the pause screen is a probe
   that disappears exactly when you stopped to look at something.

   A bar is drawn for anything with a ceiling, because the question a pool
   asks is never "how many" — it is "how close to the cap", and a number
   cannot answer that at a glance. The bar goes amber at 70% and red at 90%.
   ============================================================ */
const _dbgRows = [];                          // reused; the overlay allocates nothing per frame
function _dbgBar(x, y, w, v, cap, col) {
  const k = uiScale, f = clamp(v / cap, 0, 1);
  octx.save();
  octx.fillStyle = 'rgba(255,255,255,0.13)';
  octx.fillRect(x * k, y * k, w * k, 2 * k);
  octx.fillStyle = f > 0.9 ? '#ff3b46' : f > 0.7 ? '#ffb03a' : (col || '#6ede7a');
  octx.fillRect(x * k, y * k, w * f * k, 2 * k);
  octx.restore();
}
function drawDebug() {
  const st = PROBE.stats(PROBE.win), c = PROBE.counts();
  const k = uiScale;
  const X = 6, W0 = 150;
  let y = 40;
  // a panel, so the numbers survive a bright floor
  octx.save();
  octx.fillStyle = 'rgba(6,4,8,0.82)';
  octx.fillRect((X - 3) * k, (y - 8) * k, (W0 + 6) * k, 150 * k);
  octx.strokeStyle = 'rgba(255,255,255,0.10)'; octx.lineWidth = 1;
  octx.strokeRect((X - 3) * k, (y - 8) * k, (W0 + 6) * k, 150 * k);
  octx.restore();

  const L = (s, col, sz) => { htxt(s, X, y, col || '#cfc6b8', 'left', sz || 5.5, { noShadow: 1, track: 0.02 }); y += 6.5; };
  const R = (s, col, sz) => htxt(s, X + W0, y - 6.5, col || '#cfc6b8', 'right', sz || 5.5, { noShadow: 1, track: 0.02 });

  const ms = st.total;
  const budget = (v) => v > 16.7 ? '#ff3b46' : v > 8 ? '#ffb03a' : '#6ede7a';
  L('F3  PROBE   ' + (PROBE.drain ? '[DRAINED — pacing is meaningless]' : '') , '#ff3b46', 6);
  L('frame  avg ' + ms.avg.toFixed(2) + '   p95 ' + ms.p95.toFixed(2) +
    '   p99 ' + ms.p99.toFixed(2), budget(ms.p99));
  L('worst  window ' + ms.max.toFixed(2) + '   ever ' + st.worstEver.toFixed(2) +
    '   (' + ms.n + ' fr / ' + (PROBE.win / 1000) + 's)', budget(ms.max));
  y += 2;

  const d = st.draw;
  const drawTot = d.world.avg + d.actors.avg + d.particles.avg + d.light.avg + d.post.avg + d.hud.avg;
  L('update ' + st.update.avg.toFixed(2) + '      draw ' + drawTot.toFixed(2), '#9fd8ff');
  L('  world ' + d.world.avg.toFixed(2) + '   actors ' + d.actors.avg.toFixed(2) +
    '   part ' + d.particles.avg.toFixed(2), '#7fa8c8');
  L('  light ' + d.light.avg.toFixed(2) + '   post ' + d.post.avg.toFixed(2) +
    '   hud ' + d.hud.avg.toFixed(2), '#7fa8c8');
  y += 2;

  L('en ' + c.en + ' + cracks ' + c.cracks + ' = ' + (c.en + c.cracks) +
    ' / cap ' + c.cap + '     queue ' + c.queue,
    (c.en + c.cracks) > c.cap ? '#ff3b46' : '#cfc6b8');
  _dbgBar(X, y - 4.5, W0, c.en + c.cracks, Math.max(1, c.cap));
  y += 3;
  L('bullets ' + c.bul + '   enemy fire ' + c.eb + '   drops ' + c.drops);
  y += 2;

  L('part  ' + c.part + ' / ' + c.partCap);   _dbgBar(X + 46, y - 4.5, W0 - 46, c.part, c.partCap);
  L('gibs  ' + c.gibs + ' / ' + c.gibsCap);   _dbgBar(X + 46, y - 4.5, W0 - 46, c.gibs, c.gibsCap);
  L('rings ' + c.rings + ' / ' + c.ringsCap); _dbgBar(X + 46, y - 4.5, W0 - 46, c.rings, c.ringsCap);
  L('fx    ' + c.fx + ' / ' + c.fxCap);       _dbgBar(X + 46, y - 4.5, W0 - 46, c.fx, c.fxCap);
  L('floats ' + c.floats + '   arcs ' + c.arcs);
  y += 2;

  /* The one number that should NEVER climb during play. Rendering.md says an
     entire ten-floor run bakes 29 canvases; anything that grows frame on
     frame here is a cache key with a continuous value in it (Bugs Found #2). */
  L('sprite cache ' + c.sprCache + ' baked   ' + c.sprVariants + ' palette variants',
    c.sprCache > 200 ? '#ff3b46' : c.sprCache > 80 ? '#ffb03a' : '#6ede7a');
  L('floor ' + c.floor + '  wave ' + c.wave + '/' + WAVES + '  ' + c.mode + '  kills ' + (S.kills | 0), '#8a8078');
}

/* ============================================================
   SOAK — the deterministic measurement scenario.

   Every performance claim about this game is supposed to be reproducible.
   That means the same call has to produce the same run: same floor, same
   wave, same spawn order, same drops, same numbers. `Math.random()` is
   called from about ninety places, so the only honest way to pin it is to
   replace it for the duration and put it back afterwards.

   MEAT.soak({ floor, wave, seconds, seed, mode, samples, drain })

     floor    0-9, the S.room index          (default 0)
     wave     1-WAVES                        (default 3)
     seconds  simulated, at a fixed 1/60     (default 30)
     seed     any int; same seed, same run   (default 12345)
     mode     'fill' — invincible, never fires. The arena fills to the cap.
                       This is the scenario the tables in Difficulty Scaling
                       were taken under.
              'kill' — invincible, fires continuously at the nearest enemy.
                       This is the one that reproduces the complaint, because
                       the complaint is about KILLING, not about standing
                       next to a crowd.
     samples  seconds at which to snapshot   (default [3,10,20,30])
     drain    force a canvas flush per phase — accurate attribution, useless
              pacing. See the warning on PROBE.

   Returns a JSON-safe object. Re-runnable: call it again after a change and
   diff the same fields.

   > Two things this deliberately does NOT do. It does not use
   > requestAnimationFrame, because a fixed 1/60 step is the only way two runs
   > are comparable — and `_soaking` suppresses the rAF that frame() would
   > otherwise schedule, or every soak call would leave a second copy of the
   > loop running forever. And it does not trust wall-clock ms as the headline
   > number: driving frames synchronously makes draw calls batch and flush in
   > clumps, which manufactures spikes no player sees. Rendering.md says so
   > explicitly. Treat the COUNTS as authoritative and the MILLISECONDS as a
   > shape, and take the real timings off a Chrome trace.
   ============================================================ */
function _soakFields() {
  const p = S.p || {};
  return { t: +(S.t || 0).toFixed(4), en: S.en.length, cracks: S.cracks.length,
           queue: S.queue.length, bul: S.bul.length, eb: S.eb.length,
           part: S.part.length, gibs: S.gibs.length, drops: S.drops.length,
           kills: S.kills | 0, xp: S.xp | 0, lvl: S.level | 0,
           px: +(p.x || 0).toFixed(3), py: +(p.y || 0).toFixed(3),
           hp: +(p.hp || 0).toFixed(2), ang: +(p.ang || 0).toFixed(4),
           mag: p.mags ? (p.mags[p.owned[p.wi]] | 0) : 0,
           rng: _rngN,
           wave: S.wave, mode: S.mode, spawnT: +(S.spawnT || 0).toFixed(4),
           waveT: +(S.waveT || 0).toFixed(4), waveState: S.waveState };
}

function _soakHash() {
  let h = 2166136261;
  const mix = (v) => { h ^= ((v * 1000) | 0); h = Math.imul(h, 16777619); };
  mix(S.en.length); mix(S.cracks.length); mix(S.queue.length); mix(S.bul.length);
  mix(S.eb.length); mix(S.part.length); mix(S.gibs.length);
  mix(S.kills | 0); mix(S.xp | 0); mix(S.t || 0);
  /* the queue's CONTENTS, not just its length — hashing the length alone is
     what let two different waves fingerprint as the same run */
  for (let i = 0; i < S.queue.length; i++) { const q = S.queue[i]; for (let c = 0; c < q.length; c++) mix(q.charCodeAt(c)); }
  if (S.p) { mix(S.p.x); mix(S.p.y); mix(S.p.hp); }
  for (let i = 0; i < S.en.length; i++) { const e = S.en[i]; mix(e.x); mix(e.y); mix(e.hp); }
  return h >>> 0;
}

function _mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---- the verify wrapper ----

   Three separate causes of first-run drift were found and fixed in
   _soakOnce: an unpinned `last` giving frame 0 an arbitrary dt, setup
   leaving the RNG at an unpredictable stream position, and a fingerprint that
   hashed the spawn queue's LENGTH but not its CONTENTS — so two completely
   different waves compared as equal.

   A fourth remains. Something about the first execution of a given soak SHAPE
   in a page session shifts it; a second call with the same options is stable
   and every call after that is byte-identical to it. It is not isolated, and
   the honest thing is to say so rather than to publish numbers that quietly
   depend on call order.

   So the guarantee is made structurally instead of by warming: run the
   scenario, throw it away, run it again, and return the second — with
   `verified` saying whether the two agreed. A caller now cannot accidentally
   read a cold result, and if the build ever becomes genuinely
   non-deterministic, `verified: false` says so in the result instead of
   hiding in a number that looks plausible.

   `verify: false` opts out and halves the cost, for a caller that is
   iterating rather than recording. */
function soak(opts) {
  const o = opts || {};
  if (o.verify === false) return _soakOnce(o);
  const discard = _soakOnce(o);
  const keep = _soakOnce(o);
  keep.verified = discard.fingerprint === keep.fingerprint;
  keep.discardedFingerprint = discard.fingerprint;
  return keep;
}

/* Runs the same soak twice and reports the first frame at which the two
   diverge. A harness that claims determinism without checking it is a harness
   that will quietly stop being deterministic. */
function soakDiff(opts) {
  const o = Object.assign({}, opts || {}, { trace: (opts && opts.trace) || 15, fields: 1 });
  const a = soak(o), b = soak(o);
  if (!a.verified || !b.verified) { /* reported below */ }
  let first = null;
  for (let i = 0; i < Math.min(a.trace.length, b.trace.length); i++) {
    if (a.trace[i][1] !== b.trace[i][1]) {
      const fa = a.trace[i][2], fb = b.trace[i][2], differs = {};
      for (const k in fa) if (fa[k] !== fb[k]) differs[k] = [fa[k], fb[k]];
      first = { frame: a.trace[i][0], atSec: +(a.trace[i][0] / 60).toFixed(2),
                differingFields: differs, a: fa, b: fb,
                prevFrame: i ? a.trace[i - 1][0] : null };
      break;
    }
  }
  return { identical: a.fingerprint === b.fingerprint && !first,
           bothVerified: !!a.verified && !!b.verified,
           fingerprintA: a.fingerprint, fingerprintB: b.fingerprint,
           firstDivergence: first, tracePoints: a.trace.length,
           killsA: a.kills, killsB: b.kills };
}

/* Has a soak run yet in this page session? See the prologue in soak(). */
let _soakWarmed = 0;
let _rngN = 0;

function _soakOnce(opts) {
  const o = opts || {};
  const floor = clamp(o.floor === undefined ? 0 : o.floor | 0, 0, ROOMS.length - 1);
  const wave = clamp(o.wave === undefined ? 3 : o.wave | 0, 1, WAVES);
  const secs = o.seconds === undefined ? 30 : +o.seconds;
  const seed = o.seed === undefined ? 12345 : o.seed | 0;
  const mode = o.mode || 'fill';
  const marks = (o.samples || [3, 10, 20, 30]).filter(s => s <= secs).sort((a, b) => a - b);

  const realRandom = Math.random, realDrain = PROBE.drain, realGod = S.god;
  const realDown = mouse.down, realMx = mouse.x, realMy = mouse.y;
  Math.random = _mulberry32(seed);
  PROBE.drain = o.drain ? 1 : 0;
  _soaking = 1;

  const out = { input: { floor: floor + 1, wave, seconds: secs, seed, mode, drain: !!o.drain },
                samples: [], kills: 0, errors: [], trace: [],
                /* How many of the stepped frames were NOT in play. A soak that
                   spends half its length on a level-up hand is not measuring
                   what the caller thinks it is measuring — and the pools do
                   not tick in those frames, which is a finding in itself. */
                modeFrames: {} };
  const traceEvery = o.trace ? (o.trace | 0 || 15) : 0;
  try {
    startRun();
    S.room = floor;
    buildRoom(floor);
    /* startRun drops you into the opening beat; a soak wants the fight, so
       clear the intro rather than spending three of its seconds on it. */
    S.introT = 0; S.introMsgT = 0; S.fade = 0; S.fadeDir = 0; S.pending = null;
    S.god = true;                       // the PLAYER not dying is not the same
    /* Re-seed before the queue is built.

       startRun() and buildRoom() spend a number of draws that is NOT stable
       across calls in a page session, so startWave() — which samples the
       enemy type table once per queued body — was drawing from a different
       stream position every time. The queue LENGTH matched, which is why this
       hid for so long: a fingerprint that hashes `queue.length` and not the
       queue's contents sees two completely different waves as identical.

       Each stage now starts at a known position of its own stream, so no
       stage can inherit the draw count of the one before it. */
    Math.random = _mulberry32(seed ^ 0x85EBCA6B);
    startWave(wave);                    // as nothing dying — see `mode`
    PROBE.reset();

    const killsAt = () => (S.kills | 0);
    const kills0 = killsAt();
    let ts = 1000, mi = 0;
    const STEP = 1000 / 60;
    /* Pin the clock before the first stepped frame.

       frame() derives dt from the module-level `last`, which holds whatever
       the previous caller left there — the live rAF loop on a cold page, or
       the tail of the previous soak. So frame 0 was getting a dt of anywhere
       in [0, 0.05]: a cold page produced the clamp CEILING (0.05, because
       ts=1016 against last≈0 is a full second before clamping) and a repeat
       run produced ZERO (ts restarts at 1000, last is 9000, negative clamps
       to 0). One frame of difference in the opening dt is enough to move
       `spawnT` by 0.05s, which changes which frame the first batch lands on,
       which changes everything after it.

       Two identical calls have to produce identical runs or none of the
       numbers below mean anything, so the clock starts where we say it does. */
    last = ts;
    /* And pin the crosshair, for the same reason.

       `mouse` is module state, not S state, so freshState() does not touch it.
       On frame 0 the arena holds cracks and no enemies yet, so 'kill' mode has
       nothing to aim at and leaves the crosshair wherever the page left it —
       the live rAF loop's value on a cold load, the previous soak's last
       target afterwards. That is a different firing angle on the opening
       frame, which is a different wall impact, which is one extra particle,
       which is a different run.

       This was the actual cause of "the first soak after a page load never
       matches the ones after it". Anything outside S has to be pinned here or
       the seed is not the only input. */
    mouse.x = W / 2; mouse.y = H / 2; mouse.down = false;
    /* Re-seed, so the measured window starts at a known stream position.

       Setup and measurement are two different things and they need two
       different guarantees. Setup has to be REPRODUCIBLE — same seed, same
       arena, same queue — and it is, seeded above. But setup also CONSUMES an
       unknown number of draws, and that count turned out to vary: the first
       soak of a page session left the stream one draw off every subsequent
       one, so a floor burner's `Math.random() < dt * 6` ambient particle
       landed on frame 0 of run two and not of run one. One particle, and from
       there the two runs are different games.

       Rather than hunt the draw, take the dependency away: setup gets one
       stream, the measured loop gets a fresh one. However many draws
       startRun/buildRoom/startWave spend, the frame loop always begins at
       position zero of its own sequence.

       The constant is the golden-ratio word, used only to make the two
       streams unrelated rather than offset by a fixed amount. */
    const _base = _mulberry32(seed ^ 0x9E3779B9);
    _rngN = 0;
    Math.random = function () { _rngN++; return _base(); };
    const N = Math.round(secs * 60);
    for (let i = 0; i < N; i++) {
      if (mode === 'kill') {
        /* Point the crosshair at the nearest living thing and hold the
           trigger. Aim is taken from the mouse every frame in update(), so
           the only honest way to steer is to move the mouse. */
        let best = null, bd = 1e9;
        for (const e of S.en) {
          if (e.dead) continue;
          const d = (e.x - S.p.x) * (e.x - S.p.x) + (e.y - S.p.y) * (e.y - S.p.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          mouse.x = clamp(best.x - S.cam.cx + W / 2, 0, W);
          mouse.y = clamp(best.y - S.cam.cy + H / 2, 0, H);
        }
        mouse.down = true;
        S.p.reT = 0;                    // ammo is not what we are measuring
      }
      ts += STEP;
      try { frame(ts); } catch (e) { out.errors.push('f' + i + ': ' + e.message); break; }
      out.modeFrames[S.mode] = (out.modeFrames[S.mode] | 0) + 1;
      if (traceEvery && i % traceEvery === 0)
        out.trace.push(o.fields ? [i, _soakHash(), _soakFields()] : [i, _soakHash(), S.en.length, S.mode]);
      const t = (i + 1) / 60;
      while (mi < marks.length && t >= marks[mi]) {
        const st = PROBE.stats(3000), c = PROBE.counts();
        out.samples.push({
          at: marks[mi], frames: st.frames,
          ms: { avg: +st.total.avg.toFixed(3), p95: +st.total.p95.toFixed(3),
                p99: +st.total.p99.toFixed(3), worstInWindow: +st.total.max.toFixed(3),
                worstEver: +st.worstEver.toFixed(3) },
          split: { update: +st.update.avg.toFixed(3), world: +st.draw.world.avg.toFixed(3),
                   actors: +st.draw.actors.avg.toFixed(3), particles: +st.draw.particles.avg.toFixed(3),
                   light: +st.draw.light.avg.toFixed(3), post: +st.draw.post.avg.toFixed(3),
                   hud: +st.draw.hud.avg.toFixed(3) },
          entities: { en: c.en, cracks: c.cracks, cap: c.cap, queue: c.queue,
                      bul: c.bul, eb: c.eb },
          pools: { part: c.part + '/' + c.partCap, gibs: c.gibs + '/' + c.gibsCap,
                   rings: c.rings + '/' + c.ringsCap, fx: c.fx + '/' + c.fxCap,
                   floats: c.floats, arcs: c.arcs, drops: c.drops },
          sprites: { cache: c.sprCache, variants: c.sprVariants },
          mode: c.mode,
          /* A pool over its own ceiling is never normal. It means the cap did
             not run, not that the cap is too low. */
          overCap: (c.part > c.partCap ? 'part ' + c.part + '>' + c.partCap + ' ' : '') +
                   (c.gibs > c.gibsCap ? 'gibs ' + c.gibs + '>' + c.gibsCap + ' ' : '') +
                   (c.rings > c.ringsCap ? 'rings ' + c.rings + '>' + c.ringsCap : '') || null,
          kills: killsAt() - kills0
        });
        mi++;
      }
    }
    out.kills = killsAt() - kills0;
    out.fingerprint = _soakHash();
    out.peak = { part: 0, gibs: 0, rings: 0, fx: 0, en: 0, sprCache: 0 };
    for (const s of out.samples) {
      out.peak.en = Math.max(out.peak.en, s.entities.en);
      out.peak.part = Math.max(out.peak.part, parseInt(s.pools.part));
      out.peak.gibs = Math.max(out.peak.gibs, parseInt(s.pools.gibs));
      out.peak.rings = Math.max(out.peak.rings, parseInt(s.pools.rings));
      out.peak.fx = Math.max(out.peak.fx, parseInt(s.pools.fx));
      out.peak.sprCache = Math.max(out.peak.sprCache, s.sprites.cache);
    }
  } finally {
    Math.random = realRandom;
    PROBE.drain = realDrain;
    S.god = realGod;
    mouse.down = realDown; mouse.x = realMx; mouse.y = realMy;
    _soaking = 0;
  }
  return out;
}

/* ---------- presentation: never render below 200% ---------- */
function fitCanvas() {
  const sx = window.innerWidth / W, sy = window.innerHeight / H;
  /* Fill the limiting axis completely, fractional scale and all. The game
     grid is exactly 16:9, so on a 16:9 display in fullscreen this is the
     whole screen with zero letterboxing — integer-only snapping was leaving
     bars on every screen whose ideal scale was 3.2x or 3.5x, which is every
     Windows laptop running 125% DPI. A fractional scale means game pixels
     alternate 3px/4px wide instead of being uniform; the render store is
     already 2x the grid, so in practice the unevenness lands on the fine
     detail, and a full screen beats a ruler-perfect grid with bars on it. */
  const scale = Math.max(RS, Math.min(sx, sy));
  const cssW = W * scale, cssH = H * scale;
  cv.style.width = cssW + 'px';
  cv.style.height = cssH + 'px';
  // Overlay matches on screen but carries a much denser backing store, so UI
  // text is rasterised at full resolution instead of being upscaled 2-6x.
  uiScale = Math.min(6, scale * 2);
  ov.style.width = cssW + 'px';
  ov.style.height = cssH + 'px';
  ov.width = Math.round(W * uiScale);
  ov.height = Math.round(H * uiScale);
  octx.imageSmoothingEnabled = true;
}
addEventListener('resize', fitCanvas);
fitCanvas();

/* ---------- boot ---------- */
const boot = document.getElementById('boot');
function wake() {
  boot.classList.add('hidden');
  A.init();
  if (A.music && S.mode === 'title') A.music.menu();   // sparse pad+arp on the title
  removeEventListener('click', wake);
  removeEventListener('keydown', wake);
}
addEventListener('click', wake);
addEventListener('keydown', wake);

buildRoom(0);
S.p = makePlayer();
requestAnimationFrame(frame);

// dev hook
window.MEAT = { S, startRun, startWave, spawnBoss, spawnEnemy, grantGod, breakSecret,
                giveWeapon, explode, triggerModagaz, triggerGoromania,
                evolve, resetEvolution, canEvolve, EVO_COST, EVO_MAX, EVO_TIER,
                evoGuns, evoCards, evoGunPool, evoCardPool, evoReward, evoFullSet,
                openEvoPick, takeEvoGun, takeEvoCard, applyEvoLoadout,
                OMEGA_COINS, COIN_RATE, powerMul,
                gainXP, openLevelUp, takeCard, dealCards, rerollHand, scarName, scarCol, ST,
                BOSSES, WEP, WORDER, COSMETICS, frame, nextRoom,
                enterShop, exitShop, shopStock, shopSlots, roomDef, curRoom, buildRoom,
                CARDS, CARD_BY_ID, AISLES, AISLE_ORDER, GRADE, rollGrade, cardVal, dk, dkr, dkc,
                riderOn, recalcLuck, recalcAisles, ais, aisleT1, aisleT2, aisleT3,
                AISLE_T1, AISLE_T2, AISLE_T3,
                FUSIONS, FUSION_BY_ID, fz, fusionReady, fusionHint, availableFusions, takeFusion,
                frostPulse, knockRoom, PROPS, propKinds,
                FLOOR_TEX, floorTex, TEXTURE, bakeTileAtlas, bakeSpills, runClock,
                CONTRACTS, cStat, bump, bumpMax, contractDone, checkContracts,
                AUGMENTS, ag, dealAugments, openAugments, takeAugment, refuseAugments,
                spawnMini, MINIS, BOSS_WAVE, MINI_WAVES, miniWaves, isApexFloor, bossIndexFor,
                ROOMS, FLOORS, isLastFloor, twist, isTwist, rollRoster, updateTwist,
                BOSS_FINAL, BOSS_HP, FINAL_HP, bossBudget, enterPhase, mortarAt, updateHaz, drawWin,
                magCap, fireNova, SHOP_WAVES, diff, killEnemy, damageEnemy,
                angerPaci, hurtStage, bodySprite, legSprite, shred, hurtPlayer, RS, quitToTitle,
                armRig, armCells, armCols, ARM_SH_X, ARM_SH_Y,
                PROBE, soak, soakDiff, drawDebug,
                concurrencyCap, liveLoad, eliteSummon, retireOldestAdd };

})();
