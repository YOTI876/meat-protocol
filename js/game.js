/* ============================================================
   MEAT PROTOCOL  —  top-down survival horror wave shooter
   Damjan vs. the meat. Ten waves a floor. Bosses drop groceries.
   ============================================================ */
(() => {
'use strict';

const W = 480, H = 270;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ov = document.getElementById('overlay');
const octx = ov.getContext('2d');
let uiScale = 2;

const lcan = document.createElement('canvas'); lcan.width = W; lcan.height = H;
const lctx = lcan.getContext('2d');

/* ---------- crisp UI text (drawn on the high-res overlay) ----------
   Coordinates are in game space (480x270) and scaled up, so layout code stays
   identical to the pixel canvas — only the rasterisation is sharper. One
   typeface for the whole game (see js/font.js): the pixel look comes from the
   letterforms, the legibility comes from rasterising them at device
   resolution instead of at 480x270 and upscaling. */
const UI_FONT = GAME_FONT;
const CAP_H = 0.63;         // Pixelify Sans cap height in em — used to centre on a point
function htxt(s, x, y, col, align, size, opts) {
  const o = opts || {}, k = uiScale, sz = size || 9;
  // o.mid: treat y as the vertical centre of the cap box rather than the
  // baseline. Canvas' own 'middle' baseline sits low because it splits the em
  // box including descenders; centring on caps is what reads as centred.
  const by = o.mid ? y + sz * CAP_H / 2 : y;
  // Canvas puts letter-spacing after the final glyph as well, so the measured
  // run is one gap wider than the ink and centred text lands half a gap left.
  // Give it back, or every centred label sits fractionally off.
  const trk = (o.track === undefined ? 0.04 : o.track) * sz;
  const al = align || 'left';
  if (al === 'center') x += trk / 2; else if (al === 'right') x += trk;
  octx.save();
  octx.font = (o.weight || '600') + ' ' + (sz * k) + 'px ' + UI_FONT;
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
function htxtWidth(s, size, track) {
  const k = uiScale;
  octx.save();
  octx.font = '600 ' + ((size || 9) * k) + 'px ' + UI_FONT;
  if (octx.letterSpacing !== undefined) octx.letterSpacing = ((track === undefined ? 0.04 : track) * (size || 9) * k) + 'px';
  const w = octx.measureText(s).width / k;
  octx.restore();
  return w;
}
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

/* ---------- input ---------- */
const keys = {}, mouse = { x: W / 2, y: H / 2, down: false, rdown: false, wx: 0, wy: 0 };
let clickQueue = [];

addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (e.code === 'KeyM') A.toggleMute();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (S.mode === 'play') S.mode = 'pause';
    else if (S.mode === 'pause') S.mode = 'play';
    else if (S.mode === 'armory') S.mode = 'pause';
    else if (S.mode === 'cos') S.mode = S.cosReturn || 'title';
  }
  if (e.code === 'KeyB' && (S.mode === 'play' || S.mode === 'pause')) S.mode = 'armory';
  else if (e.code === 'KeyB' && S.mode === 'armory') S.mode = 'play';
  // cosmetics are reachable from anywhere that isn't a firefight
  if (e.code === 'KeyC' && S.mode !== 'cos' && S.mode !== 'play') { S.cosReturn = S.mode; S.mode = 'cos'; }
  if (S.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startRun();
  if (S.mode === 'dead' && e.code === 'KeyR') startRun();
  if (S.mode === 'play') {
    if (e.code === 'KeyQ') cycleWeapon(-1);
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6 }[e.code];
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
const ROOMS = [
  { name: 'THE ABATTOIR', sub: 'floor 01 // where the meat is hung',
    aw: 940, ah: 660, floor: ['#4a382f', '#42302a', '#392722'], grout: '#241a16',
    wall: ['#5e4840', '#3a2c28', '#725648'], fog: 'rgba(48,8,12,0.12)', dark: 0.76 },
  { name: 'THE HOLLOW', sub: 'floor 02 // it goes down further than it should',
    aw: 1020, ah: 720, floor: ['#2f3a43', '#27313a', '#212a31'], grout: '#141c22',
    wall: ['#425460', '#28343c', '#556878'], fog: 'rgba(10,30,50,0.13)', dark: 0.78 },
  { name: 'THE MEAT LOOP', sub: 'floor 03 // you have been here before',
    aw: 1080, ah: 760, floor: ['#42313c', '#392833', '#30212b'], grout: '#1c1319',
    wall: ['#583f50', '#342532', '#6d5062'], fog: 'rgba(60,0,50,0.13)', dark: 0.80 },
  { name: 'THE RED KITCHEN', sub: 'floor 04 // dinner',
    aw: 1120, ah: 780, floor: ['#4e2d2a', '#432422', '#391d1c'], grout: '#20100f',
    wall: ['#6a3835', '#3e2020', '#84463f'], fog: 'rgba(90,0,10,0.16)', dark: 0.82 }
];

/* Individual hits land much harder than they used to. Balanced back by a slower
   contact rate, longer i-frames and better healing — spikier, not just meaner. */
const ETYPE = {
  crawler:  { bank: SPR.anim.crawler,  hp: 26,  spd: 54, dmg: 16, r: 6, score: 10, gib: '#8b6161', name: 'CRAWLER' },
  shrieker: { bank: SPR.anim.shrieker, hp: 38,  spd: 33, dmg: 20, r: 6, score: 20, gib: '#6b8a52', name: 'SHRIEKER' },
  stalker:  { bank: SPR.anim.stalker,  hp: 32,  spd: 84, dmg: 23, r: 6, score: 26, gib: '#9a927e', name: 'STALKER' },
  bloater:  { bank: SPR.anim.bloater,  hp: 105, spd: 25, dmg: 32, r: 9, score: 40, gib: '#9c4049', name: 'BLOATER' }
};
const CONTACT_CD = 0.78;   // was 0.70 — bigger bites, taken less often
const OMEGA_CARDS = 50;    // the beam is the long game now
const EVO_COST = ev => 100 * Math.pow(2, ev);   // 100, 200, 400, 800 ...

const BOSSES = [
  // addT/addN: how often each boss calls for help, and how much. Every boss
  // summons now, but the cap in updateBoss keeps the arena from silting up.
  { key: 'butcher', name: 'THE BUTCHER',      bank: SPR.anim.bossA, tint: null,                     hp: 850,  spd: 40, r: 15, item: 'banana',  pat: 'charge',  addT: 6.5, addN: 3, adds: ['crawler'],                        cry: 'IT REMEMBERS YOUR NAME' },
  { key: 'mother',  name: 'MOTHER OF MELONS', bank: SPR.anim.bossB, tint: null,                     hp: 1100, spd: 26, r: 15, item: 'melon',   pat: 'spawner', addT: 4.2, addN: 4, adds: ['crawler', 'crawler', 'shrieker'], cry: 'SHE IS FULL OF CHILDREN' },
  { key: 'pitcher', name: 'THE PITCHER',      bank: SPR.anim.bossA, tint: 'rgba(224,40,50,0.55)',   hp: 1450, spd: 46, r: 15, item: 'coolade', pat: 'blink',   addT: 7.0, addN: 3, adds: ['stalker', 'crawler'],            cry: 'IT CAME THROUGH THE WALL' },
  { key: 'hog',     name: 'THE HOGFATHER',    bank: SPR.anim.bossB, tint: 'rgba(255,130,142,0.55)', hp: 1850, spd: 32, r: 15, item: 'glock',   pat: 'burst',   addT: 6.0, addN: 4, adds: ['crawler', 'shrieker', 'bloater'], cry: 'HE IS CARRYING SOMETHING' },
  { key: 'courier', name: 'THE COURIER',      bank: SPR.anim.bossA, tint: 'rgba(90,200,255,0.5)',   hp: 2400, spd: 62, r: 15, item: 'bike',    pat: 'circle',  addT: 6.8, addN: 4, adds: ['stalker', 'stalker', 'crawler'],  cry: 'IT HAS BEEN CIRCLING FOR HOURS' }
];
const BOSS_WAVES = { 3: 0, 5: 1, 7: 2, 9: 3, 10: 4 };

const ITEMS = {
  banana:  { spr: SPR.banana,  col: '#f7dc55', n: ['BANANA', 'BANANA SPLIT'],
             d: ['potassium overload: +35% speed, you drop peels', 'peels DETONATE, +70% speed'] },
  melon:   { spr: SPR.melon,   col: '#63b04a', n: ['MELON', 'MELON ARMOR'],
             d: ['+55 max hp, rind shield (3)', '+110 max hp, rind shield (6), fast regrow'] },
  coolade: { spr: SPR.coolade, col: '#e02832', n: ['COOLADE', 'PURPLE COOLADE'],
             d: ['sugar rush: x1.6 damage, bullets pierce', 'x2.3 damage, pierce 3'] },
  glock:   { spr: SPR.glock,   col: '#8a9099', n: ['GLOCK-18', 'AKIMBO GLOCK-18s'],
             d: ['a second gun fires itself at whatever is closest', 'two of them. they never stop.'] },
  bike:    { spr: SPR.bike,    col: '#c9232c', n: ['STOLEN BICYCLE', 'STOLEN MOTORCYCLE'],
             d: ['+25% speed, your dash RAMS things', 'ram harder, leave a burning trail'] }
};

/* ---- THE ARSENAL. price 0 = you start with it. ---- */
const WEP = {
  scar:  { id: 'scar',  name: 'SCAR-L',        spr: SPR.scar,  price: 0,   mag: 30,  rate: 0.088, dmg: 13, spread: 0.026, spd: 430, pellets: 1, reload: 1.45, sfx: 'shoot',    col: '#ffe9a8', tag: 'reliable. boring. yours.' },
  saw:   { id: 'saw',   name: 'MEAT SPLITTER', spr: SPR.saw,   price: 15,  mag: 2,   rate: 0.62,  dmg: 12, spread: 0.24,  spd: 380, pellets: 9, reload: 1.9,  sfx: 'shotgun',  col: '#ffcf8a', knock: 300, tag: 'nine reasons to stand still' },
  nail:  { id: 'nail',  name: 'THE STAPLER',   spr: SPR.nail,  price: 35,  mag: 60,  rate: 0.045, dmg: 8,  spread: 0.10,  spd: 540, pellets: 1, reload: 2.0,  sfx: 'nailgun',  col: '#f2d14a', pin: 0.45, tag: 'pins them to the floor' },
  micro: { id: 'micro', name: 'MICROWAVE',     spr: SPR.micro, price: 60,  mag: 16,  rate: 0.24,  dmg: 34, spread: 0.02,  spd: 270, pellets: 1, reload: 2.1,  sfx: 'plasma',   col: '#4fd6e8', bounce: 3, burn: 16, size: 3, tag: 'reheats the dead' },
  hog:   { id: 'hog',   name: 'THE HOG',       spr: SPR.hog,   price: 100, mag: 120, rate: 0.032, dmg: 10, spread: 0.13,  spd: 500, pellets: 1, reload: 3.4,  sfx: 'minigun',  col: '#ffd28a', spin: 1, slow: 0.45, tag: 'spins up. never stops.' },
  rail:  { id: 'rail',  name: 'GOD FINGER',    spr: SPR.rail,  price: 175, mag: 5,   rate: 0.55,  dmg: 165, spread: 0,    spd: 950, pellets: 1, reload: 2.4,  sfx: 'railgun',  col: '#a8e8ff', charge: 0.5, pierce: 99, size: 3, knock: 200, tag: 'points. things stop existing.' },
  omega: { id: 'omega', name: 'OMEGA BEAM',    spr: SPR.omega, price: 0, cards: OMEGA_CARDS, mag: 300, rate: 0.02, dmg: 720, spread: 0, spd: 0, pellets: 0, reload: 2.6, sfx: 'beam', col: '#c05cff', beam: 1, girth: 11, tag: 'fifty cards. one very wide line.' }
};
const WORDER = ['scar', 'saw', 'nail', 'micro', 'hog', 'rail', 'omega'];
const BUYABLE = ['saw', 'nail', 'micro', 'hog', 'rail'];

/* ---- COSMETICS. bought from the vault, kept forever. ---- */
const COSMETICS = [
  { id: 'crimson', name: 'CRIMSON BAND', price: 0,     pal: {},                                                                                    tag: 'the one he showed up in' },
  { id: 'gold',    name: 'GOLD BAND',    price: 1000,  pal: { r: '#f0c243', R: '#a37c12', w: '#fff3c0' },                                           tag: 'earned, technically' },
  { id: 'toxic',   name: 'TOXIC BAND',   price: 2500,  pal: { r: '#8ef04a', R: '#3f8a1e', w: '#e8ffcc', j: '#2a4a2a', J: '#16301a' },               tag: 'do not lick' },
  { id: 'void',    name: 'VOID',         price: 5000,  pal: { r: '#2a1030', R: '#140618', w: '#a05cff', j: '#2a1c3a', J: '#180f24', h: '#120a18', H: '#1e1226' }, tag: 'he stopped casting a shadow' },
  { id: 'bone',    name: 'BONE MASK',    price: 9000,  pal: { s: '#e8e2d0', S: '#b0a894', m: '#0a0508', e: '#0a0508', p: '#c02020', r: '#5a5248', R: '#332f2a' }, tag: 'nobody asked where the face went' },
  { id: 'flame',   name: 'LIVING FLAME', price: 15000, pal: { r: '#ff8a20', R: '#c02a00', w: '#ffe08a' }, fx: 'fire',                               tag: 'the headband is on fire. it is fine.' }
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
    godFound: s.godFound || S.god,
    modagaz: Math.max(s.modagaz || 0, S.modagazFound),
    goro: s.goro || S.goro
  });
}
/* Evolving has to be earned: 100 coins the first time, doubling after. */
function canEvolve() { return S.coins >= EVO_COST(S.evo | 0); }
function evolve() {
  if (!canEvolve()) { A.denied(); return false; }
  S.evo = (S.evo | 0) + 1;
  S.coins = 0; S.cards = 0;
  persist();
  A.god(); A.roar();
  S.flash = 1.0; S.flashCol = '#b028ff';
  return true;
}
/* ...and undoing it puts the world back to plain, ordinary awful. */
function resetEvolution() {
  if (!(S.evo | 0)) { A.denied(); return false; }
  S.evo = 0;
  persist();
  A.bigpickup();
  S.flash = 0.8; S.flashCol = '#9fe08a';
  return true;
}
function ownedCos() { const s = loadSave(); return s.cosOwned || ['crimson']; }
function equippedCos() { const s = loadSave(); return s.cosEq || 'crimson'; }
function cosDef(id) { return COSMETICS.find(c => c.id === id) || COSMETICS[0]; }

/* ============================================================
   STATE
   ============================================================ */
const S = {};
function freshState() {
  const sv = loadSave();
  Object.assign(S, {
    mode: 'title', t: 0, deadT: 0,
    room: 0, wave: 0, waveState: 'idle', waveT: 0,
    queue: [], spawnT: 0,
    aw: 0, ah: 0, walls: [], deco: [],
    p: null, bul: [], eb: [], en: [], part: [], gibs: [], props: [], drops: [],
    peels: [], floats: [], cracks: [], nades: [], rings: [], shops: [],
    boss: null, door: null, secret: null, corner: null,
    cam: { cx: 0, cy: 0, z: 1, punch: 0, sh: 0, shx: 0, shy: 0, shPh: 0, seed: 0 },
    items: {}, god: false,
    coins: sv.coins || 0, cards: sv.cards || 0, vault: sv.vault || 0,
    evo: sv.evo || 0, modagazFound: sv.modagaz || 0,
    goro: false, goroHits: 0, goroT: 0, vacuum: 0,
    xp: 0, level: 1, xpNext: 65, upgPts: 0, upg: { spd: 0, dmg: 0, def: 0 },
    scarLv: 1, lvlChoices: null, wupg: {}, glusec: 0, armorySel: 0,
    score: 0, combo: 1, comboT: 0, kills: 0, streak: 0,
    flash: 0, flashCol: '#fff', hitstop: 0, slow: 0, redness: 0, modT: 0,
    jump: 0, jumpSpr: null, muzzle: null, beamHit: null,
    msg: '', msgT: 0, sub: '', banner: null, prompt: null,
    fade: 0, fadeDir: 0, pending: null, cosReturn: 'title',
    whisperT: rnd(6, 14), beatT: 0, breathT: 0, ui: []
  });
}
freshState();

/* ============================================================
   DERIVED STATS
   ============================================================ */
/* Grocery bonuses are deliberately smaller than they were: the XP upgrade tree
   now supplies a chunk of your power, and stacking both at full strength made
   floor 2 trivial. */
function ST() {
  const it = S.items;
  const b = it.banana | 0, m = it.melon | 0, k = it.coolade | 0, g = it.glock | 0, bk = it.bike | 0;
  const u = S.upg;
  return {
    speed: 94 * (1 + (b === 1 ? 0.22 : b >= 2 ? 0.44 : 0) + (bk === 1 ? 0.16 : bk >= 2 ? 0.30 : 0))
              * (1 + u.spd * 0.06),
    maxhp: 100 + (m === 1 ? 38 : m >= 2 ? 76 : 0),
    dmgMul: (k === 1 ? 1.38 : k >= 2 ? 1.85 : 1) * (S.god ? 3 : 1) * (S.goro ? 1.25 : 1)
              * (1 + u.dmg * 0.08),
    /* every point of DEFENCE shaves damage taken, with diminishing returns */
    resist: 1 - Math.min(0.60, u.def * 0.07),
    pierce: k === 1 ? 1 : k >= 2 ? 2 : 0,
    shieldMax: m === 1 ? 2 : m >= 2 ? 4 : 0,
    shieldCd: m >= 2 ? 8 : 14,
    peel: b > 0, peelBoom: b >= 2,
    glocks: g === 1 ? 1 : g >= 2 ? 2 : 0,
    glockRate: g >= 2 ? 0.11 : 0.20,
    glockDmg: 13,
    ram: bk === 1 ? 40 : bk >= 2 ? 95 : 0,
    ramFire: bk >= 2,
    dashCd: bk ? 0.45 : (b ? 0.58 : 0.85),
    /* the base rifle gains a mark every FLOOR: new colour, new voice, +20% each.
       (Per-floor means far fewer marks than the old per-wave cadence, so each
       one has to be worth something.) */
    scarMul: 1 + 0.20 * (S.scarLv - 1)
  };
}

/* ---------- per-weapon upgrades, bought with coins ---------- */
const WTRACKS = [
  { id: 'rate',  name: 'CYCLE',  col: '#f5c518', max: 5, d: r => '+' + (r * 10) + '% fire rate' },
  { id: 'split', name: 'SPLIT',  col: '#7fd0ff', max: 3, d: r => r ? (r * 2 + 1) + '-way fan' : 'single shot' },
  { id: 'pow',   name: 'POWER',  col: '#ff6a72', max: 5, d: r => '+' + (r * 15) + '% damage' }
];
function wup(id) {
  if (!S.wupg[id]) S.wupg[id] = { rate: 0, split: 0, pow: 0 };
  return S.wupg[id];
}
/* Better guns cost more to improve, and each rank costs more than the last. */
function wupCost(id, track, rank) {
  const tier = 1 + (WEP[id].price || 120) / 190;
  const base = track === 'split' ? 34 : 20;
  return Math.round((base + rank * 24) * tier);
}

const SCAR_COLS = ['#ffe9a8', '#7fd0ff', '#8fff9a', '#ff7fe0', '#ffb03a',
                   '#c05cff', '#ff4a54', '#4fd6e8', '#eaff6a', '#ff8a3a'];
const scarCol = () => SCAR_COLS[(S.scarLv - 1) % SCAR_COLS.length];
function roman(n) {
  const M = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '', v = n;
  while (v > 0) for (const [d, r] of M) if (v >= d) { s += r; v -= d; break; }
  return s;
}
const scarName = () => 'SCAR-L MK ' + roman(S.scarLv);

/* ---------- XP & upgrades ---------- */
const UPGRADES = [
  { id: 'spd', name: 'ADRENALINE', col: '#7fe08a', d: '+6% move speed' },
  { id: 'dmg', name: 'MALICE',     col: '#ff6a72', d: '+8% damage' },
  { id: 'def', name: 'CALLUS',     col: '#7fd0ff', d: '-7% damage taken' }
];
function gainXP(n) {
  S.xp += n;
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext;
    S.level++;
    S.upgPts++;
    S.xpNext = Math.round(S.xpNext * 1.32);
    A.bigpickup();
    S.flash = Math.max(S.flash, 0.4); S.flashCol = '#9fe08a';
    ring(S.p.x, S.p.y, 46, '#9fe08a', 0.5, 2);
    float(S.p.x, S.p.y - 26, 'LEVEL ' + S.level, '#9fe08a', true);
  }
  if (S.upgPts > 0 && S.mode === 'play') openLevelUp();
}
function openLevelUp() {
  S.mode = 'levelup';
  S.lvlChoices = UPGRADES.slice();
  if (A.duck) A.duck(0.5, 3);
}
function takeUpgrade(id) {
  if (S.upgPts <= 0) return;
  S.upg[id] = (S.upg[id] | 0) + 1;
  S.upgPts--;
  A.buy();
  S.flash = 0.5; S.flashCol = UPGRADES.find(u => u.id === id).col;
  if (S.p) S.p.hp = Math.min(ST().maxhp, S.p.hp + 12);
  if (S.upgPts <= 0) S.mode = 'play';
}
/* One knob for how hard the floor hits. Evolutions stack on top forever. */
function diff() {
  const ev = S.evo | 0;
  return {
    hp: (1 + S.room * 0.95) * (1 + ev * 0.38),
    dmg: (1 + S.room * 0.62) * (1 + ev * 0.26) * 0.95,   // a flat 5% off the top
    spd: (1 + S.room * 0.08) * (1 + ev * 0.05),
    score: (1 + S.room * 0.7) * (1 + ev * 0.5)
  };
}
function curW() { return WEP[S.p.owned[S.p.wi]]; }
function curMag() { return S.p.mags[S.p.owned[S.p.wi]]; }
function magMax() { return S.god ? 999 : curW().mag; }

/* ============================================================
   ROOM BUILD
   ============================================================ */
function buildRoom(idx) {
  const R = ROOMS[Math.min(idx, ROOMS.length - 1)];
  const rng = mulberry32(1337 + idx * 977 + Math.floor(Math.random() * 99999));
  S.aw = R.aw; S.ah = R.ah;
  const T = 24;
  S.walls = [
    { x: 0, y: 0, w: R.aw, h: T }, { x: 0, y: R.ah - T, w: R.aw, h: T },
    { x: 0, y: 0, w: T, h: R.ah }, { x: R.aw - T, y: 0, w: T, h: R.ah }
  ];
  S.deco = [];

  const n = 7 + idx * 2;
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const w = rng() < 0.4 ? 24 : rndi(30, 76), h = rng() < 0.4 ? 24 : rndi(26, 70);
      const x = T + 22 + rng() * (R.aw - 2 * T - 44 - w);
      const y = T + 22 + rng() * (R.ah - 2 * T - 44 - h);
      if (Math.hypot(x + w / 2 - R.aw / 2, y + h / 2 - R.ah / 2) < 92) continue;
      let bad = false;
      for (let j = 4; j < S.walls.length; j++) {
        const o = S.walls[j];
        if (x < o.x + o.w + 40 && x + w + 40 > o.x && y < o.y + o.h + 40 && y + h + 40 > o.y) { bad = true; break; }
      }
      if (bad) continue;
      S.walls.push({ x: Math.round(x), y: Math.round(y), w, h, obs: 1, kind: rng() < 0.35 ? 'vat' : 'crate' });
      break;
    }
  }

  for (let i = 0; i < 26 + idx * 8; i++)
    S.deco.push({ x: rnd(T + 10, R.aw - T - 10), y: rnd(T + 10, R.ah - T - 10), k: rng() < 0.5 ? 'hook' : 'stain', s: rnd(0.6, 1.5) });

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

  bakeFloor(R, rng);
  S.cracks = [];
  S.shops = [];
}

/* Shops need the player's inventory, so they're placed after the player exists. */
function populateShops() {
  S.shops = [];
  const unowned = BUYABLE.filter(id => S.p.owned.indexOf(id) < 0);
  const offer = [];
  if (unowned.length) offer.push(unowned[0]);                       // always the next rung
  const rest = unowned.slice(1);
  while (offer.length < 3 && rest.length) offer.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);

  for (const id of offer) {
    const p = freeSpot(150);
    S.shops.push({ x: p.x, y: p.y, id, price: WEP[id].price, cards: 0, bought: false, bob: rnd(0, TAU) });
  }
  if (S.p.owned.indexOf('omega') < 0) {
    const p = freeSpot(190);
    S.shops.push({ x: p.x, y: p.y, id: 'omega', price: 0, cards: OMEGA_CARDS, bought: false, bob: rnd(0, TAU) });
  }
}

function bakeFloor(R, rng) {
  floorCan = document.createElement('canvas');
  floorCan.width = R.aw; floorCan.height = R.ah;
  floorCtx = floorCan.getContext('2d');
  const g = floorCtx;
  g.fillStyle = R.floor[0]; g.fillRect(0, 0, R.aw, R.ah);
  const TS = 16;
  for (let y = 0; y < R.ah; y += TS) {
    for (let x = 0; x < R.aw; x += TS) {
      const v = rng();
      g.fillStyle = v < 0.30 ? R.floor[1] : v < 0.44 ? R.floor[2] : R.floor[0];
      g.fillRect(x, y, TS, TS);
      g.fillStyle = R.grout;
      g.fillRect(x, y, TS, 1); g.fillRect(x, y, 1, TS);
      const sp = 5 + Math.floor(rng() * 9);
      for (let i = 0; i < sp; i++) {
        g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,240,220,0.045)';
        g.fillRect(x + Math.floor(rng() * TS), y + Math.floor(rng() * TS), 1, 1);
      }
      if (rng() < 0.05) { g.fillStyle = 'rgba(60,10,14,0.30)'; const s = 3 + rng() * 8; g.fillRect(x + rng() * 8, y + rng() * 8, s, s * 0.6); }
      if (rng() < 0.03) {
        g.fillStyle = 'rgba(0,0,0,0.4)';
        let cx = x + rng() * TS, cy = y + rng() * TS;
        for (let i = 0; i < 10; i++) { g.fillRect(cx | 0, cy | 0, 1, 1); cx += rng() * 3 - 1.5; cy += rng() * 3 - 1.5; }
      }
    }
  }
  if (S.secret) {
    g.fillStyle = 'rgba(180,160,140,0.14)';
    const ax = S.secret.x + 5, ay = 74;
    for (let i = 0; i < 14; i++) g.fillRect(ax, ay + i, 1, 1);
    for (let i = 0; i < 6; i++) { g.fillRect(ax - i, ay + i, 1, 1); g.fillRect(ax + i, ay + i, 1, 1); }
  }
  decalCan = document.createElement('canvas');
  decalCan.width = R.aw; decalCan.height = R.ah;
  decalCtx = decalCan.getContext('2d');
}

/* ============================================================
   ENTITIES
   ============================================================ */
function makePlayer() {
  return {
    x: S.aw / 2, y: S.ah / 2, vx: 0, vy: 0, r: 6, ang: 0,
    hp: 100, shield: 0, shieldT: 0,
    owned: ['scar'], wi: 0, mags: { scar: 30 },
    reT: 0, reMax: 0, reStage: 0, fireT: 0, recoil: 0,
    spin: 0, charge: 0, beamT: 0,
    nades: 3, nadeCd: 0,
    dash: 0, dashCd: 0, iframe: 0, walkT: 0, stepPhase: 0, flip: false,
    peelT: 0, hurtFlash: 0, kick: 0,
    glockT: 0, glockSide: 1, ramHit: [], tempShield: 0
  };
}

function spawnEnemy(type, x, y) {
  const d = ETYPE[type], D = diff();
  const waveK = 1 + S.wave * 0.045;
  const hp = d.hp * D.hp * waveK;
  const e = {
    type, x, y, vx: 0, vy: 0, r: d.r, bank: d.bank, spr: d.bank.walk[0],
    // random phase so a spawned batch doesn't march in lockstep
    anim: rnd(0, 4), poseT: 0,
    hp, max: hp,
    spd: d.spd * D.spd * rnd(0.9, 1.12),
    dmg: d.dmg * D.dmg * (1 + S.wave * 0.03),
    score: d.score, gib: d.gib, name: d.name,
    hit: 0, atkT: 0, fireT: rnd(1, 2), wob: rnd(0, TAU), stun: 0, burn: 0, burnT: 0,
    blinkT: rnd(1, 3), bob: rnd(0, TAU), flip: false, boss: false, dead: false, sq: 0,
    twitch: 0, twx: 0, twy: 0, trail: []
  };
  S.en.push(e);
  return e;
}

function spawnBoss(idx) {
  const B = BOSSES[idx], D = diff();
  const hp = B.hp * D.hp * 1.35;
  const b = {
    type: 'boss', def: B, name: B.name, x: S.aw / 2, y: 90, vx: 0, vy: 0,
    r: B.r, bank: B.bank, spr: B.bank.walk[0], tint: B.tint,
    anim: 0, poseT: 0,
    hp, max: hp, spd: B.spd * (1 + S.room * 0.06) * (1 + (S.evo | 0) * 0.04),
    dmg: 26 * D.dmg, score: 500,
    gib: '#8a3540', hit: 0, phase: 'idle', pt: 1.2, wob: 0, bob: 0, sq: 0, orbit: rnd(0, TAU),
    stun: 0, burn: 0, burnT: 0, flip: false, boss: true, dead: false, chargeDir: 0, spawnT: 4,
    twitch: 0, twx: 0, twy: 0, trail: []
  };
  S.en.push(b); S.boss = b;
  A.roar();
  if (A.music) { A.music.setBoss(true); A.duck(0.7, 1.4); }
  S.jump = 0.42; S.jumpSpr = B;
  shake(11); punch(0.05);
  msg(B.name, B.cry, 3.2);
  return b;
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
function gib(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(30, 150);
    S.gibs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: rnd(0.6, 1.5), s: rndi(1, 3) });
  }
}
function blood(x, y, r, col) {
  if (!decalCtx) return;
  decalCtx.fillStyle = col || 'rgba(96,10,16,0.55)';
  for (let i = 0; i < 6; i++) {
    const a = rnd(0, TAU), d = rnd(0, r);
    const s = rnd(1, r * 0.5);
    decalCtx.fillRect((x + Math.cos(a) * d) | 0, (y + Math.sin(a) * d) | 0, (s | 0) || 1, ((s * 0.7) | 0) || 1);
  }
}
function ring(x, y, r, col, life, wid) { S.rings.push({ x, y, r0: 2, r1: r, col, life, max: life, wid: wid || 1 }); }

/* The thing you actually see when something dies: a white pop, a meat cloud,
   a shockwave, sparks and a few rising embers. */
function deathBurst(e, ang) {
  const big = !!e.boss, n = big ? 3 : 1;
  ring(e.x, e.y, big ? 74 : 22, '#ffffff', 0.16, 2);
  ring(e.x, e.y, big ? 58 : 17, '#c02028', 0.30, 1);
  gib(e.x, e.y, e.gib, big ? 70 : 12);
  blood(e.x, e.y + 4, big ? 26 : 11);
  part(e.x, e.y, e.gib, 14 * n, 165, 0.55, 2);          // meat cloud
  part(e.x, e.y, '#8a1018', 12 * n, 120, 0.65, 2);
  part(e.x, e.y, '#ffd9a0', 7 * n, 210, 0.32, 1);       // hot sparks
  if (ang !== undefined) spray(e.x, e.y, ang, e.gib, 18 * n, 210, 0.6, 0.85);
  // embers that drift upward and fade
  for (let i = 0; i < 5 * n; i++) {
    S.part.push({ x: e.x + rnd(-5, 5), y: e.y + rnd(-5, 5), vx: rnd(-16, 16), vy: rnd(-52, -20),
      col: pick(['#ff6a4a', '#ffb46a', '#ffe3a8']), life: rnd(0.5, 1.1), max: 1.1, s: 1 });
  }
  if (big) { S.flash = Math.max(S.flash, 0.7); S.flashCol = '#ff2b2b'; }
}
function float(x, y, text, col, big) { S.floats.push({ x, y, text, col, life: big ? 1.1 : 0.7, big, vy: big ? -30 : -16, sc: big ? 1.6 : 1 }); }
function shake(a) {
  const c = S.cam;
  if (a > c.sh) { c.sh = a; c.seed = Math.random() * 100; }   // new impulse, new direction
}
function punch(a) { S.cam.punch = Math.max(S.cam.punch, a); }
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
  if (p.reT > 0 || S.god || p.mags[w.id] >= w.mag) return;
  p.reT = w.reload; p.reMax = w.reload; p.reStage = 0;
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
  const u = wup(w.id);
  const spin = w.spin ? p.spin : 1;
  const rateMul = 1 - u.rate * 0.10;
  p.fireT = (w.spin ? lerp(0.16, w.rate, p.spin) : w.rate) * rateMul;
  if (!S.god) p.mags[w.id]--;

  const base = (w.spread + p.recoil * 0.05) * (S.god ? 0.4 : 1);
  const mx = p.x + Math.cos(p.ang) * 11, my = p.y + Math.sin(p.ang) * 11 - 1;
  const isScar = w.id === 'scar';
  const dmg = w.dmg * st.dmgMul * (isScar ? st.scarMul : 1) * (1 + u.pow * 0.15);
  const col = S.god ? '#ff6cf5' : (isScar ? scarCol() : w.col);
  // SPLIT rank n fires a fan of 2n+1 directions
  const dirs = u.split ? u.split * 2 + 1 : 1;
  const fan = 0.20;
  for (let d = 0; d < dirs; d++) {
    const off = dirs === 1 ? 0 : (d - (dirs - 1) / 2) * fan;
    for (let i = 0; i < w.pellets; i++) {
      const a = p.ang + off + rnd(-base, base);
      S.bul.push({
        x: mx, y: my, vx: Math.cos(a) * w.spd, vy: Math.sin(a) * w.spd,
        dmg, pierce: (w.pierce || 0) + st.pierce, hitIds: [], life: 1.4,
        col, size: (w.size || 1) + (isScar && S.scarLv > 3 ? 1 : 0),
        knock: w.knock || 60, pin: w.pin || 0, burn: w.burn || 0, bounce: w.bounce || 0, god: S.god
      });
    }
  }
  p.recoil = Math.min(1, p.recoil + (w.pellets > 3 ? 0.7 : 0.24));
  p.kick = w.pellets > 3 ? 6 : w.charge ? 7 : 2.6;
  p.vx -= Math.cos(p.ang) * (w.knock ? w.knock * 0.28 : 12);
  p.vy -= Math.sin(p.ang) * (w.knock ? w.knock * 0.28 : 12);
  spray(mx, my, p.ang, '#ffd07a', w.pellets > 3 ? 14 : 5, 140, 0.18, 0.4);
  S.muzzle = { x: mx, y: my, t: 0.06, big: w.pellets > 3 || !!w.charge };
  shake(w.pellets > 3 ? 3.4 : w.charge ? 5.5 : S.god ? 1.4 : 1.0);
  if (w.charge) punch(0.05);
  if (S.god) A.godshoot();
  else if (isScar) A.scarMk(S.scarLv);       // voice morphs toward a laser each mark
  else if (A[w.sfx]) A[w.sfx](spin);
  else A.shoot();
  if (!w.beam) A.shell();
  const ca = p.ang + Math.PI / 2 + rnd(-0.4, 0.4);
  S.gibs.push({ x: mx, y: my, vx: Math.cos(ca) * 70, vy: Math.sin(ca) * 70, col: '#c9a227', life: 0.9, s: 1 });
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

  const u = wup(w.id);
  const ox = p.x + Math.cos(p.ang) * 11, oy = p.y + Math.sin(p.ang) * 11 - 1;
  let ex = ox, ey = oy;
  const hits = [];
  const girth = w.girth * (1 + u.split * 0.55);   // SPLIT widens the beam instead of forking it
  for (let i = 1; i < 220; i++) {
    const nx = ox + Math.cos(p.ang) * i * 4, ny = oy + Math.sin(p.ang) * i * 4;
    if (pointInWall(nx, ny)) break;
    ex = nx; ey = ny;
    for (const e of S.en) if (!e.dead && hits.indexOf(e) < 0 && Math.hypot(e.x - nx, e.y - ny) < e.r + girth) hits.push(e);
  }
  S.beamHit = { x: ox, y: oy, ex, ey, girth };
  for (const e of hits) damageEnemy(e, w.dmg * st.dmgMul * (1 + u.pow * 0.15) * (1 + u.rate * 0.10) * dt, true, p.ang);
  if (Math.random() < dt * 70) spray(ex, ey, p.ang + Math.PI, '#e0a8ff', 4, 150, 0.35, 1.4);
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

function explode(x, y, r, dmg, col) {
  ring(x, y, r * 1.5, col || '#ffb03a', 0.4, 2);
  ring(x, y, r * 0.8, '#ffffff', 0.22, 3);
  part(x, y, '#ffd05a', 34, 220, 0.55, 2);
  part(x, y, '#ff5a1e', 26, 160, 0.7, 2);
  part(x, y, '#3a2a24', 20, 90, 1.0, 2);
  blood(x, y, r * 0.6, 'rgba(24,12,8,0.4)');
  shake(14); punch(0.075); S.hitstop = Math.max(S.hitstop, 0.07);
  S.flash = Math.max(S.flash, 0.35); S.flashCol = '#ffcf8a';
  A.boom(); A.duck(0.35, 0.5);
  for (const e of S.en) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > r) continue;
    const f = 1 - d / r;
    const a = Math.atan2(e.y - y, e.x - x);
    e.vx += Math.cos(a) * 340 * f; e.vy += Math.sin(a) * 340 * f;
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
function damageEnemy(e, dmg, fromBullet, ang) {
  if (e.dead) return;
  e.hp -= dmg;
  e.hit = 0.09;
  e.sq = Math.min(1, e.sq + dmg * 0.012);
  blood(e.x, e.y + 4, 5, 'rgba(90,10,16,0.4)');
  if (ang !== undefined) spray(e.x, e.y, ang, e.gib, 5, 120, 0.35, 0.7);
  else part(e.x, e.y, e.gib, 3, 70, 0.3);
  if (e.hp <= 0) killEnemy(e, ang);
}

function killEnemy(e, ang) {
  e.dead = true;
  S.kills++; S.streak++;
  S.combo = Math.min(25, S.combo + 1); S.comboT = 3.2;
  const pts = Math.round(e.score * diff().score * S.combo);
  S.score += pts;
  float(e.x, e.y - 10, '+' + pts, '#ffd070');
  gainXP(e.boss ? 90 : Math.max(3, Math.round(e.score * 0.55)));
  deathBurst(e, ang);
  S.hitstop = Math.max(S.hitstop, e.boss ? 0.3 : 0.035);
  shake(e.boss ? 18 : 2.5);
  A.gib();

  if (S.streak > 0 && S.streak % 15 === 0) {
    float(S.p.x, S.p.y - 26, ['BUTCHERY', 'MEAT GRINDER', 'UNCLEAN', 'DELICIOUS'][(S.streak / 15 - 1) % 4] + ' x' + S.streak, '#ff8a3a', true);
    punch(0.03);
  }

  // ---- loot ----
  const bossKill = !!e.boss;
  if (bossKill) {
    S.boss = null;
    if (A.music) { A.music.setBoss(false); A.duck(0.8, 2.2); }
    S.slow = 0.9; punch(0.09);
    S.flash = 0.7; S.flashCol = '#ff2b2b';
    dropPickup(e.x, e.y, 'item', e.def.item);
    for (let i = 0; i < 5; i++) {                       // 5 coins a boss, exactly
      const a = rnd(0, TAU);
      S.drops.push({ x: e.x, y: e.y, kind: 'coin', t: 0, life: 40, bob: rnd(0, TAU), vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 });
    }
    if (Math.random() < 0.05) dropPickup(e.x + 8, e.y, 'card');
    dropPickup(e.x - 10, e.y, 'nade');
    msg(e.name + ' IS MEAT', 'it dropped something edible.', 3);
    A.roar();
  } else {
    const r = Math.random();
    if (r < 0.008) dropPickup(e.x, e.y, 'card');        // cards: genuinely rare
    else if (r < 0.021) dropPickup(e.x, e.y, 'nova');   // the rarer of the two new ones
    else if (r < 0.061) dropPickup(e.x, e.y, 'shield');
    else if (r < 0.221) dropPickup(e.x, e.y, 'coin');   // coins: reasonably common
    else if (r < 0.281) dropPickup(e.x, e.y, 'ammo');
    else if (r < 0.341) dropPickup(e.x, e.y, 'med');
    else if (r < 0.381) dropPickup(e.x, e.y, 'nade');
  }
}

function hurtPlayer(dmg, sx, sy) {
  const p = S.p;
  if (S.god || p.iframe > 0 || p.tempShield > 0 || S.mode !== 'play') return;
  dmg *= ST().resist;
  if (p.shield > 0) {
    p.shield--; p.shieldT = ST().shieldCd; p.iframe = 0.45;
    part(p.x, p.y, '#63b04a', 16, 130, 0.5);
    ring(p.x, p.y, 22, '#63b04a', 0.3, 2);
    float(p.x, p.y - 14, 'RIND', '#63b04a');
    A.hit(); shake(4);
    return;
  }
  p.hp -= dmg; p.iframe = 0.62; p.hurtFlash = 0.35;
  S.redness = Math.min(1, S.redness + 0.5);
  S.combo = 1; S.streak = 0;
  shake(8); punch(0.035); S.hitstop = Math.max(S.hitstop, 0.05);
  A.hurt();
  part(p.x, p.y, '#b01822', 14, 120, 0.45);
  blood(p.x, p.y + 5, 7);
  if (sx !== undefined) { p.vx += (p.x - sx) * 1.8; p.vy += (p.y - sy) * 1.8; }
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
  const perm = kind === 'item' || kind === 'god';
  S.drops.push({ x, y, kind, key, t: 0, life: perm ? 1e9 : 34, bob: rnd(0, TAU), vx: rnd(-40, 40), vy: rnd(-40, 40) });
}

function grantItem(key) {
  const lv = (S.items[key] | 0) + 1;
  S.items[key] = lv;
  S.banner = { key, lv, t: 4.2 };
  A.bigpickup();
  S.flash = 0.5; S.flashCol = ITEMS[key].col;
  shake(7); punch(0.05);
  if (key === 'melon') S.p.hp += 55;
  const st = ST();
  S.p.hp = Math.min(st.maxhp, S.p.hp);
  S.p.shield = st.shieldMax;
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
  p.mags[id] = WEP[id].mag;
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
  if (BOSS_WAVES[n] !== undefined) {
    spawnBoss(BOSS_WAVES[n]);
    for (let i = 0; i < Math.round(4 + n * 0.9 + S.room * 3.5); i++) S.queue.push(pick(['crawler', 'crawler', 'shrieker']));
    msg('WAVE ' + n, 'BOSS', 2.4);
  } else {
    // Head count, not a spend budget — a budget buys fewer/tougher enemies as it
    // grows, which is backwards. This grows quadratically across a floor and is
    // multiplied again for every floor down and every evolution.
    // Every gun you own is another mouth the floor sends to meet it.
    const armed = 1 + Math.max(0, S.p.owned.length - 1) * 0.10;
    const levelled = 1 + Math.max(0, S.level - 1) * 0.06;   // the stronger you get, the more come
    const count = Math.round((7 + n * 2.8 + n * n * 0.26) * (1 + S.room * 0.55)
                             * (1 + (S.evo | 0) * 0.12) * armed * levelled);
    // Weights shift toward the nastier things as the wave and floor climb.
    const pool = [['crawler', 10]];
    if (n >= 2 || S.room > 0) pool.push(['shrieker', 3 + n * 0.4 + S.room]);
    if (n >= 4 || S.room > 0) pool.push(['stalker', 2 + n * 0.45 + S.room]);
    if (n >= 6 || S.room > 0) pool.push(['bloater', 1 + n * 0.35 + S.room * 1.5]);
    let total = 0;
    for (const c of pool) total += c[1];
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total;
      for (const c of pool) { r -= c[1]; if (r <= 0) { S.queue.push(c[0]); break; } }
    }
    msg('WAVE ' + n, S.queue.length + ' SIGNATURES', 1.8);
  }
  A.wave();
  A.setDread(clamp(n / 10 * 0.6 + S.room * 0.2, 0, 1));
  // The score climbs across the floor and jumps a step for each floor down.
  if (A.music) A.music.setIntensity(clamp(0.12 + (n / 10) * 0.72 + S.room * 0.16, 0, 1));
}

function updateWaves(dt) {
  if (S.waveState === 'fight') {
    S.spawnT -= dt;
    // How many can be breathing at once, how fast they arrive, how many per crack
    const cap = Math.min(78, Math.round(19 + S.wave * 1.4 + S.room * 7.5 + (S.evo | 0) * 2 +
                                        Math.max(0, S.p.owned.length - 1) * 1.5 +
                                        Math.max(0, S.level - 1) * 0.8));
    if (S.spawnT <= 0 && S.queue.length && S.en.length < cap) {
      S.spawnT = Math.max(0.15, 0.85 - S.wave * 0.05 - S.room * 0.09);
      const batch = 1 + Math.floor(S.wave / 4) + S.room + (Math.random() < 0.4 ? 1 : 0);
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
      const heal = S.wave === 10 ? 60 : 10;
      S.p.hp = Math.min(ST().maxhp, S.p.hp + heal);
      S.p.nades = Math.min(6, S.p.nades + 1);
      S.score += 100 * S.wave * (S.room + 1);
      persist();
      if (S.wave >= 10) {
        S.door.open = true;
        msg('THE DOOR IS OPEN', 'go north. it is worse down there.', 4);
        A.doorOpen();
      } else {
        msg('WAVE ' + S.wave + ' CLEARED', '+' + (100 * S.wave * (S.room + 1)) + ' // +' + heal + ' hp // +1 frag', 2.2);
      }
      for (let i = 0; i < 2; i++) { const p = freeSpot(40); dropPickup(p.x, p.y, Math.random() < 0.5 ? 'ammo' : 'med'); }
    }
  } else if (S.waveState === 'clear') {
    S.waveT -= dt;
    if (S.waveT <= 0 && S.wave < 10) startWave(S.wave + 1);
  }

  for (let i = S.cracks.length - 1; i >= 0; i--) {
    const c = S.cracks[i];
    c.t -= dt;
    if (c.t <= 0) {
      spawnEnemy(c.type, c.x, c.y);
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

  if (S.fadeDir) {
    S.fade += S.fadeDir * rdt * 1.6;
    if (S.fade >= 1 && S.fadeDir > 0) { S.fade = 1; S.fadeDir = -1; if (S.pending) { S.pending(); S.pending = null; } }
    if (S.fade <= 0 && S.fadeDir < 0) { S.fade = 0; S.fadeDir = 0; }
  }

  if (S.mode === 'dead') { S.deadT += rdt; updateParticles(dt); updateCam(rdt); return; }
  if (S.mode !== 'play') { updateCam(rdt); return; }

  const p = S.p, st = ST(), w = curW();

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
    part(p.x, p.y, '#ffffff', 14, 100, 0.3);
    ring(p.x, p.y, 20, 'rgba(255,255,255,0.6)', 0.22, 1);
    punch(0.02);
    if (st.ram) A.ram(); else A.burn();
  }
  if (p.dash > 0) p.dash -= dt;

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
  const spd = st.speed * slowMul * (p.dash > 0 ? 3.4 : 1);
  p.vx = lerp(p.vx, ix * spd, 1 - Math.pow(0.0009, dt));
  p.vy = lerp(p.vy, iy * spd, 1 - Math.pow(0.0009, dt));
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

  if (st.peel) {
    p.peelT -= dt;
    if (p.peelT <= 0 && (ix || iy)) { p.peelT = 0.55; S.peels.push({ x: p.x, y: p.y + 4, life: 9 }); }
  }

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
    if (p.reT <= 0) { p.mags[w.id] = w.mag; p.reT = 0; }
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
      let best = null, bd = 260;
      for (const e of S.en) {
        if (e.dead || b.hitIds.indexOf(e) >= 0) continue;
        const d2 = Math.hypot(e.x - b.x, e.y - b.y);
        if (d2 < bd) { bd = d2; best = e; }
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
        if (b.bounce > 0) {                       // microwave orbs ricochet
          b.bounce--;
          b.x = px; b.y = py;
          if (pointInWall(b.x + b.vx * dt, b.y)) b.vx *= -1; else b.vy *= -1;
          part(b.x, b.y, b.col, 6, 80, 0.3);
          A.nadeBounce();
          continue;
        }
        spray(b.x, b.y, Math.atan2(-b.vy, -b.vx), '#d8c8b0', 6, 110, 0.28, 0.7);
        S.bul.splice(i, 1); removed = true; break;
      }
      for (const e of S.en) {
        if (e.dead || b.hitIds.indexOf(e) >= 0) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 3.5 + b.size) {
          const a = Math.atan2(b.vy, b.vx);
          if (b.knock) { e.vx += Math.cos(a) * b.knock; e.vy += Math.sin(a) * b.knock; }
          if (b.pin) e.stun = Math.max(e.stun, b.pin);
          if (b.burn) { e.burn = Math.max(e.burn, b.burn); e.burnT = Math.max(e.burnT, 2.6); }
          damageEnemy(e, b.dmg, true, a);
          float(b.x, b.y - 6, Math.round(b.dmg), b.god ? '#ff5cf0' : b.dmg > 60 ? '#ff8a3a' : '#ffe8b0', b.dmg > 60);
          b.hitIds.push(e);
          if (b.hitIds.length > b.pierce) { S.bul.splice(i, 1); removed = true; }
          break;
        }
      }
      if (removed) break;
      if (b.x < 0 || b.y < 0 || b.x > S.aw || b.y > S.ah) { S.bul.splice(i, 1); removed = true; break; }
    }
    if (removed) continue;
    b.life -= dt;
    if (b.life <= 0) S.bul.splice(i, 1);
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
    if (g.fuse <= 0) { explode(g.x, g.y, 58, 130 * ST().dmgMul, '#ffb03a'); S.nades.splice(i, 1); }
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
    if (e.stun > 0) {
      e.stun -= dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= 0.86; e.vy *= 0.86;
      collideWalls(e);
      continue;
    }
    if (e.boss) updateBoss(e, dt); else updateEnemy(e, dt);

    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 1) {
      e.atkT -= dt;
      if (e.atkT <= 0) { e.atkT = CONTACT_CD; hurtPlayer(e.dmg, e.x, e.y); }
    }
    for (const pl of S.peels) {
      if (pl.life > 0 && Math.hypot(e.x - pl.x, e.y - pl.y) < e.r + 6) {
        pl.life = 0;
        e.stun = 1.6; e.vx *= -0.6; e.vy *= -0.6;
        float(e.x, e.y - 10, 'SLIP!', '#f7dc55');
        part(e.x, e.y, '#f7dc55', 12, 90, 0.5);
        if (ST().peelBoom) explode(e.x, e.y, 40, 70 * ST().dmgMul, '#f7dc55');
      }
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
    const perm = d.kind === 'item' || d.kind === 'god';
    // End of a wave: the floor gives up everything it was holding.
    if (S.vacuum > 0 && !perm) {
      d.life = Math.max(d.life, 2);
      const a = Math.atan2(p.y - d.y, p.x - d.x);
      const sp = 150 + (1 - clamp(dd / 400, 0, 1)) * 260;
      d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt;
      d.vx = d.vy = 0;
      if (Math.random() < dt * 12) part(d.x, d.y, '#ffe9a8', 1, 20, 0.3);
    }
    else if (dd < 40 && !perm) { d.x += (p.x - d.x) * dt * 6; d.y += (p.y - d.y) * dt * 6; }
    if (dd < 12) {
      if (d.kind === 'ammo') { p.mags[curW().id] = curW().mag; p.reT = 0; float(p.x, p.y - 16, 'AMMO', '#f2d14a'); A.pickup(); }
      else if (d.kind === 'med') { p.hp = Math.min(ST().maxhp, p.hp + 32); float(p.x, p.y - 16, '+32 HP', '#ff6b6b'); A.pickup(); }
      else if (d.kind === 'nade') { p.nades = Math.min(6, p.nades + 1); float(p.x, p.y - 16, '+1 FRAG', '#7aa35e'); A.pickup(); }
      else if (d.kind === 'coin') { S.coins++; S.vault++; float(p.x, p.y - 16, '+1', '#f5c518'); A.coin(); }
      else if (d.kind === 'shield') {
        p.tempShield = Math.max(p.tempShield, 3.0);
        float(p.x, p.y - 18, 'AEGIS', '#7fd0ff', true);
        ring(p.x, p.y, 30, '#7fd0ff', 0.4, 2);
        part(p.x, p.y, '#c6e8ff', 22, 130, 0.6);
        A.bigpickup();
      }
      else if (d.kind === 'nova') {
        const st2 = ST(), N = 26;
        for (let k = 0; k < N; k++) {
          const a = k / N * TAU + Math.random() * 0.1;
          S.bul.push({
            x: p.x, y: p.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
            dmg: 90 * st2.dmgMul, pierce: 2 + st2.pierce, hitIds: [], life: 2.6,
            col: '#ffb03a', size: 3, knock: 180, pin: 0, burn: 12, bounce: 0, god: S.god,
            home: 5.5, spd: 340         // they go looking
          });
        }
        float(p.x, p.y - 18, 'NOVA', '#ffb03a', true);
        ring(p.x, p.y, 64, '#ffb03a', 0.4, 2);
        part(p.x, p.y, '#fff0a8', 40, 200, 0.7, 2);
        shake(9); punch(0.05); S.flash = 0.45; S.flashCol = '#ffcf8a';
        A.boom();
      }
      else if (d.kind === 'card') {
        S.cards++;
        float(p.x, p.y - 18, 'CARD ' + S.cards + '/' + OMEGA_CARDS, '#c0202a', true);
        A.card(); S.flash = 0.3; S.flashCol = '#e8dfc8'; shake(4);
      }
      else if (d.kind === 'item') grantItem(d.key);
      else if (d.kind === 'god') { grantGod(); if (S.secret) S.secret.taken = true; }
      S.drops.splice(i, 1);
    }
  }

  /* ---- weapon pedestals ---- */
  S.prompt = null;
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

  for (let i = S.peels.length - 1; i >= 0; i--) { const q = S.peels[i]; q.life -= dt; if (q.life <= 0) S.peels.splice(i, 1); }

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
    if (p.x > S.door.x - 6 && p.x < S.door.x + S.door.w + 6 && p.y < S.door.y + S.door.h + 12) nextRoom();
  }

  updateWaves(dt);
  updateParticles(dt);
  updateCam(rdt);
}

function updateEnemy(e, dt) {
  const p = S.p;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  e.wob += dt * 3;
  let tx = dx / d, ty = dy / d;

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
        S.eb.push({ x: e.x, y: e.y, vx: Math.cos(a + k * 0.16) * 130, vy: Math.sin(a + k * 0.16) * 130, r: 3, dmg: e.dmg * 0.7, life: 2.2, col: '#9ad14a' });
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
  } else if (e.type === 'crawler') {
    if (Math.random() < dt * 0.5 && d < 120) { e.vx += tx * 90; e.vy += ty * 90; e.poseT = 0.22; }
  } else if (e.type === 'bloater') {
    if (d < e.r + 18) e.poseT = Math.max(e.poseT, 0.1);               // swells before it lands on you
  }

  const wob = Math.sin(e.wob) * 0.28;
  const ca = Math.cos(wob), sa = Math.sin(wob);
  const rx = tx * ca - ty * sa, ry = tx * sa + ty * ca;
  e.vx = lerp(e.vx, rx * e.spd, 1 - Math.pow(0.02, dt));
  e.vy = lerp(e.vy, ry * e.spd, 1 - Math.pow(0.02, dt));
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.flip = e.vx < 0;
  collideWalls(e);

  for (const o of S.en) {
    if (o === e || o.boss) continue;
    const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
    if (od > 0.1 && od < e.r + o.r) { e.x += ox / od * (e.r + o.r - od) * 0.5; e.y += oy / od * (e.r + o.r - od) * 0.5; }
  }
}

function updateBoss(b, dt) {
  const p = S.p;
  const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  b.pt -= dt; b.flip = dx < 0;
  const pat = b.def.pat;

  // Every boss summons, but only up to a ceiling that scales with the floor —
  // so it stays a fight rather than an avalanche.
  const D2 = b.def;
  const addCap = Math.min(30, 14 + S.room * 4 + (S.evo | 0) * 2);
  b.spawnT -= dt;
  if (b.spawnT <= 0 && S.en.length < addCap) {
    b.spawnT = D2.addT * rnd(0.85, 1.15);
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
        S.eb.push({ x: b.x, y: b.y + 6, vx: rnd(-20, 20), vy: rnd(-20, 20), r: 3, dmg: b.dmg * 0.35, life: 1.6, col: '#ff8a2b' });
      if (b.pt <= 0) {
        b.phase = 'idle'; b.pt = rnd(1.4, 2.4);
        shake(8); punch(0.03);
        if (pat === 'burst') {
          for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 115, vy: Math.sin(a) * 115, r: 3, dmg: b.dmg * 0.5, life: 2.2, col: '#ff8a2b' }); }
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
      for (let i = 0; i < n; i++) { const a = off + i / n * TAU; S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, r: 3, dmg: b.dmg * 0.5, life: 3, col: '#8fdd4a' }); }
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
      for (let k = 0; k < 5; k++) S.eb.push({ x: b.x, y: b.y, vx: Math.cos(aa + rnd(-0.25, 0.25)) * 150, vy: Math.sin(aa + rnd(-0.25, 0.25)) * 150, r: 3, dmg: b.dmg * 0.4, life: 2, col: '#f2ede2' });
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
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.eb.push({ x: b.x, y: b.y, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, r: 3, dmg: b.dmg * 0.45, life: 2.2, col: '#5ac8ff' }); }
      }
    }
  }

  b.x += b.vx * dt; b.y += b.vy * dt;
  collideWalls(b);
  b.x = clamp(b.x, 30, S.aw - 30); b.y = clamp(b.y, 30, S.ah - 30);
}

function updateParticles(dt) {
  for (let i = S.part.length - 1; i >= 0; i--) {
    const q = S.part[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.92; q.vy *= 0.92;
    q.life -= dt; if (q.life <= 0) S.part.splice(i, 1);
  }
  for (let i = S.gibs.length - 1; i >= 0; i--) {
    const q = S.gibs[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.90; q.vy *= 0.90;
    q.life -= dt;
    if (q.life <= 0) { blood(q.x, q.y, 3, 'rgba(80,8,14,0.35)'); S.gibs.splice(i, 1); }
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
function startRun() {
  freshState();
  S.mode = 'play';
  buildRoom(0);
  S.p = makePlayer();
  populateShops();
  S.cam.cx = S.p.x; S.cam.cy = S.p.y;
  A.init();
  A.setDread(0.2);
  if (A.music) { A.music.setFloor(0); A.music.setBoss(false); A.music.setIntensity(0.15); A.music.start(); }
  msg(ROOMS[0].name, ROOMS[0].sub, 3.4);
  setTimeout(() => { if (S.mode === 'play' && S.wave === 0) startWave(1); }, 2200);
  setTimeout(() => { if (S.mode === 'play') msg('', 'something breathes inside the north wall.', 4); }, 6200);
}

function nextRoom() {
  if (S.pending || S.fadeDir) return;
  S.fadeDir = 1;
  const nr = S.room + 1;
  S.pending = () => {
    S.room = nr;
    const R = ROOMS[Math.min(nr, ROOMS.length - 1)];
    buildRoom(nr);
    S.en.length = 0; S.bul.length = 0; S.eb.length = 0; S.drops.length = 0;
    S.peels.length = 0; S.gibs.length = 0; S.part.length = 0; S.cracks.length = 0;
    S.nades.length = 0; S.props.length = 0; S.rings.length = 0;
    S.boss = null; S.wave = 0; S.waveState = 'idle';
    S.p.x = S.aw / 2; S.p.y = S.ah - 60; S.p.vx = S.p.vy = 0;
    S.p.hp = Math.min(ST().maxhp, S.p.hp + 45);
    S.p.nades = Math.min(6, S.p.nades + 2);
    S.p.reT = 0;
    for (const id of S.p.owned) S.p.mags[id] = WEP[id].mag;
    populateShops();
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
    setTimeout(() => { if (S.mode === 'play' && S.wave === 0) startWave(1); }, 2600);
  };
}

/* ============================================================
   DRAW
   ============================================================ */
function drawWorld() {
  const c = S.cam;
  const R = ROOMS[Math.min(S.room, ROOMS.length - 1)];
  const hw = W / (2 * c.z), hh = H / (2 * c.z);
  const vl = c.cx - hw, vt = c.cy - hh, vr = c.cx + hw, vb = c.cy + hh;

  ctx.save();
  ctx.translate(W / 2 + c.shx, H / 2 + c.shy);
  ctx.scale(c.z, c.z);
  ctx.translate(-c.cx, -c.cy);

  ctx.drawImage(floorCan, 0, 0);
  ctx.drawImage(decalCan, 0, 0);

  for (const d of S.deco) {
    if (d.x < vl || d.x > vr || d.y < vt || d.y > vb) continue;
    if (d.k === 'stain') { ctx.fillStyle = 'rgba(20,8,10,0.35)'; ctx.fillRect(d.x | 0, d.y | 0, (6 * d.s) | 0, (4 * d.s) | 0); }
  }

  drawCornerSigil();

  for (const q of S.peels) drawSpr(ctx, SPR.banana, q.x, q.y, 0.6, false, clamp(q.life / 2, 0, 1));

  // rings (shockwaves)
  for (const r of S.rings) {
    const k = 1 - r.life / r.max;
    ctx.globalAlpha = clamp(r.life / r.max, 0, 1) * 0.8;
    ctx.strokeStyle = r.col; ctx.lineWidth = r.wid;
    ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, k), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawShops();

  for (const d of S.drops) {
    const by = Math.sin(d.bob) * 2;
    const spr = d.kind === 'ammo' ? SPR.ammo : d.kind === 'med' ? SPR.medkit : d.kind === 'god' ? SPR.eye
      : d.kind === 'coin' ? SPR.coin : d.kind === 'card' ? SPR.card : d.kind === 'nade' ? SPR.grenade
      : d.kind === 'shield' ? SPR.shield : d.kind === 'nova' ? SPR.nova : ITEMS[d.key].spr;
    const sc = (d.kind === 'item' || d.kind === 'god') ? 1.6 : d.kind === 'card' ? 1.1 : 1;
    const col = d.kind === 'god' ? '#ff2b2b' : d.kind === 'item' ? ITEMS[d.key].col
      : d.kind === 'coin' ? '#f5c518' : d.kind === 'card' ? '#c0202a'
      : d.kind === 'shield' ? '#7fd0ff' : d.kind === 'nova' ? '#ffb03a' : '#ffffff';
    ctx.globalAlpha = 0.16 + Math.sin(S.t * 5 + d.bob) * 0.07;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(d.x, d.y + 6, 12 * sc, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    drawSpr(ctx, spr, d.x, d.y + by, sc, false, d.life < 4 && Math.sin(S.t * 18) > 0 ? 0.35 : 1);
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

  for (const q of S.gibs) { ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s); }
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
  for (const a of actors) { if (a === S.p) drawPlayer(a); else drawEnemy(a); }

  // Bullets glow: soft additive halo, a fat tracer, then a hot white core.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of S.bul) {
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
  for (const b of S.eb) {
    ctx.fillStyle = b.col; ctx.fillRect((b.x - b.r / 2) | 0, (b.y - b.r / 2) | 0, b.r, b.r);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(b.x | 0, b.y | 0, 1, 1);
  }

  for (const q of S.part) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s); }
  ctx.globalAlpha = 1;

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

function drawShops() {
  for (const sh of S.shops) {
    const w = WEP[sh.id];
    drawSpr(ctx, SPR.pedestal, sh.x, sh.y + 2, 1);
    if (sh.bought) continue;
    const by = Math.sin(sh.bob) * 2.2;
    ctx.globalAlpha = 0.20 + Math.sin(S.t * 4 + sh.bob) * 0.08;
    ctx.fillStyle = w.col;
    ctx.beginPath(); ctx.arc(sh.x, sh.y - 14 + by, 16, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    drawSpr(ctx, w.spr, sh.x, sh.y - 14 + by, 1.15, false, 1);
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

function drawWalls(R, vl, vt, vr, vb) {
  for (const w of S.walls) {
    if (w.x > vr || w.x + w.w < vl || w.y > vb || w.y + w.h < vt) continue;
    ctx.fillStyle = R.wall[1]; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = R.wall[0]; ctx.fillRect(w.x, w.y, w.w, Math.max(2, w.h - 4));
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = w.y; y < w.y + w.h; y += 6) ctx.fillRect(w.x, y, w.w, 1);
    for (let y = w.y, k = 0; y < w.y + w.h; y += 6, k++)
      for (let x = w.x + (k % 2 ? 0 : 6); x < w.x + w.w; x += 12) ctx.fillRect(x, y, 1, 6);
    ctx.fillStyle = R.wall[2]; ctx.fillRect(w.x, w.y, w.w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    if (w.kind === 'vat') {
      ctx.fillStyle = 'rgba(120,14,20,0.55)'; ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 8);
      ctx.fillStyle = 'rgba(190,30,40,0.25)'; ctx.fillRect(w.x + 3, w.y + 3 + Math.sin(S.t * 2 + w.x), w.w - 6, 2);
    }
  }
}

function drawDoor() {
  const d = S.door;
  if (d.open) {
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

/* ---------- Damjan ---------- */
function bodySprite() {
  const c = cosDef(equippedCos());
  return c.id === 'crimson' ? SPR.body : variant(SPR.body, c.id, c.pal);
}
function legSprite(i) {
  const c = cosDef(equippedCos());
  const base = SPR.legs[i];
  return (c.pal.n || c.pal.t) ? variant(base, c.id, c.pal) : base;
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

  // burning headband
  const cos = cosDef(equippedCos());
  if (cos.fx === 'fire' && Math.random() < 0.9)
    part(px + rnd(-5, 5), py - 13 + bob, pick(['#ff8a20', '#ffd05a', '#ff3b1e']), 1, 22, 0.4);

  /* ---- the rifle, with the reload animation ---- */
  const shx = px, shy = py - 1 + bob;
  const flipY = Math.cos(p.ang) < 0;
  let gunAng = p.ang, back = 0;
  if (p.reT > 0) {
    const prog = 1 - p.reT / p.reMax;
    const tilt = Math.sin(prog * Math.PI) * 1.05;     // dips down and comes back
    gunAng += (flipY ? -tilt : tilt);
    back = Math.sin(prog * Math.PI) * 3.2;
  }
  const gx = shx - Math.cos(p.ang) * back, gy = shy - Math.sin(p.ang) * back;
  drawSprRot(ctx, w.spr, gx, gy, gunAng, 1, 2 - p.kick * 0.4, 3, flipY, S.god ? godTint(0.5, 4) : null);

  // new magazine sliding home
  if (p.reT > 0) {
    const prog = 1 - p.reT / p.reMax;
    if (prog > 0.5 && prog < 0.92) {
      const k = clamp((prog - 0.5) / 0.32, 0, 1);
      const mAng = gunAng + Math.PI / 2 * (flipY ? -1 : 1);
      const off = (1 - k) * 9;
      drawSpr(ctx, SPR.mag, gx + Math.cos(mAng) * off + Math.cos(gunAng) * 2, gy + Math.sin(mAng) * off + Math.sin(gunAng) * 2, 1);
    }
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

  /* ---- OMEGA beam ---- */
  if (S.beamHit) {
    const b = S.beamHit, gt = b.girth || 11;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(120,40,200,0.30)'; ctx.lineWidth = gt * 2.6 + Math.sin(S.t * 30) * 2;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(192,92,255,0.6)'; ctx.lineWidth = gt * 1.5 + Math.sin(S.t * 40) * 1.6;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(232,180,255,0.9)'; ctx.lineWidth = gt * 0.6;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.ex, b.ey); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,255,0.85)';
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

  if (S.muzzle && S.muzzle.t > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,214,140,0.9)';
    ctx.beginPath(); ctx.arc(S.muzzle.x, S.muzzle.y, S.muzzle.big ? 9 : 5, 0, TAU); ctx.fill();
    ctx.restore();
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
    ctx.fillStyle = q.w.col; ctx.fillText(q.w.name, q.x, q.y - 34);
    ctx.fillStyle = q.ok ? '#9fe08a' : '#ff5a62';
    ctx.fillText((q.ok ? '[E] BUY  ' : 'NEED ') + q.cost, q.x, q.y - 27);
    ctx.textAlign = 'left';
  }
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
  const sc = e.boss ? 1.7 : 1;
  const spr = enemySpr(e);
  const lift = e.boss ? 8 : 0;

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
  const R = ROOMS[Math.min(S.room, ROOMS.length - 1)];
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = 'rgba(4,2,6,' + (S.god ? 0.55 : R.dark) + ')';
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';

  const z = S.cam.z;
  const ps = worldToScreen(S.p.x, S.p.y);

  let g = lctx.createRadialGradient(ps.x, ps.y, 4, ps.x, ps.y, 104 * z);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.72)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = g; lctx.beginPath(); lctx.arc(ps.x, ps.y, 104 * z, 0, TAU); lctx.fill();

  const spread = 0.52, len = 210 * z;
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
  for (const d of S.drops) if (d.kind === 'item' || d.kind === 'god' || d.kind === 'card') blob(d.x, d.y, 46, 0.9);
  for (const sh of S.shops) if (!sh.bought) blob(sh.x, sh.y - 12, 52, 0.85);
  if (S.corner && (S.corner.found || S.corner.pulse > 0.15)) blob(S.corner.x, S.corner.y, 40, S.corner.found ? 0.8 : S.corner.pulse * 0.7);
  if (S.door.open) blob(S.door.x + S.door.w / 2, S.door.y + S.door.h, 70, 0.9);
  for (const e of S.en) blob(e.x, e.y, e.boss ? 40 : 15, 0.42);
  for (const r of S.rings) blob(r.x, r.y, r.r1 * 0.8, clamp(r.life / r.max, 0, 1) * 0.8);

  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lcan, 0, 0);
  ctx.fillStyle = R.fog; ctx.fillRect(0, 0, W, H);
}

/* ---------- post ---------- */
let grainCans = [];
(() => {
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.054 ? 13 : 0;   // +20% over the last pass
    }
    g.putImageData(img, 0, 0);
    grainCans.push(c);
  }
})();
const scan = document.createElement('canvas'); scan.width = W; scan.height = H;
(() => { const g = scan.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.07)'; for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1); })();

function post() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.40, W / 2, H / 2, H * 0.98);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.60)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (S.redness > 0.01) { ctx.fillStyle = 'rgba(150,0,10,' + (S.redness * 0.34) + ')'; ctx.fillRect(0, 0, W, H); }
  if (S.modT > 0) {
    ctx.fillStyle = 'rgba(120,20,200,' + (S.modT / 2.6 * 0.22) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let i = 0; i < 7; i++) ctx.fillRect(0, (Math.random() * H) | 0, W, 1 + Math.random() * 3);
  }
  if (S.god) { ctx.fillStyle = 'hsla(' + ((S.t * 90) % 360) + ',80%,50%,0.055)'; ctx.fillRect(0, 0, W, H); }
  if (S.flash > 0) { ctx.globalAlpha = clamp(S.flash, 0, 1) * 0.7; ctx.fillStyle = S.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

  ctx.drawImage(grainCans[Math.abs(S.t * 24 | 0) % grainCans.length], 0, 0);
  ctx.drawImage(scan, 0, 0);

  if (S.jump > 0 && S.jumpSpr) {
    ctx.globalAlpha = clamp(S.jump * 2.2, 0, 1);
    ctx.fillStyle = '#12000a'; ctx.fillRect(0, 0, W, H);
    drawSpr(ctx, S.jumpSpr.bank.walk[0], W / 2 + rnd(-4, 4), H / 2 + rnd(-4, 4), 10, false, 1, 'rgba(180,10,20,0.5)');
    ctx.globalAlpha = 1;
  }

  /* GLUSEC — three seconds of the base rifle being reforged. The text cycles
     hue continuously and each line lags the other so they never match. */
  if (S.glusec > 0) {
    const a = clamp(S.glusec / 0.6, 0, 1);
    const h1 = (S.t * 210) % 360, h2 = (h1 + 140) % 360;
    const c1 = 'hsl(' + h1 + ',95%,66%)', c2 = 'hsl(' + h2 + ',95%,70%)';
    ctx.fillStyle = 'rgba(6,3,10,' + (a * 0.45) + ')';
    ctx.fillRect(0, H / 2 - 46, W, 62);
    ctx.fillStyle = c1; ctx.globalAlpha = a * 0.8;
    ctx.fillRect(0, H / 2 - 46, W, 1); ctx.fillRect(0, H / 2 + 15, W, 1);
    ctx.globalAlpha = 1;
    htxt('THE POWER OF GLUSEC COMPELS YOU', W / 2, H / 2 - 22, c1, 'center', 17,
         { weight: '700', alpha: a, glow: c2, glowSize: 30, track: 0.14 });
    htxt('YOUR BASE GUN IS UPGRADED', W / 2, H / 2 - 4, c2, 'center', 11,
         { weight: '700', alpha: a, glow: c1, glowSize: 22, track: 0.26 });
    htxt(scarName() + '   +' + Math.round((ST().scarMul - 1) * 100) + '% DAMAGE',
         W / 2, H / 2 + 10, scarCol(), 'center', 8, { alpha: a, track: 0.16 });
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
  const R = ROOMS[Math.min(S.room, ROOMS.length - 1)];

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
  purse(SPR.card, 0.62, S.cards + '/' + OMEGA_CARDS, S.cards >= OMEGA_CARDS ? '#ff5a62' : '#b3a888');
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
    const bars = Math.min(30, w.mag);
    const filled = Math.ceil(mag / w.mag * bars);
    const low = mag / w.mag <= 0.2;
    for (let i = 0; i < bars; i++) {
      ctx.fillStyle = i < filled ? (low ? '#ff3b3b' : w.col) : 'rgba(255,255,255,0.15)';
      ctx.fillRect(8 + i * 3, H - 29, 2, 5);
    }
    txt(mag + '/' + w.mag, 8, H - 16, '#7b6a58');
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
            ww.id === 'scar' && S.scarLv > 1 ? scarCol() : null);
  }
  const isScar = w.id === 'scar';
  txt(isScar ? scarName() : w.name, W / 2, H - 20, isScar ? scarCol() : w.col, 'center', 7);

  /* wave / room */
  txt(R.name, W / 2, 12, '#8e7a68', 'center');
  txt(S.waveState === 'idle' ? 'PREPARING' : 'WAVE ' + S.wave + '/10', W / 2, 22,
      BOSS_WAVES[S.wave] !== undefined ? '#ff3b46' : '#c0ac96', 'center');
  for (let i = 1; i <= 10; i++) {
    ctx.fillStyle = i < S.wave ? '#8a2a2e' : i === S.wave ? '#ff3b46' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(W / 2 - 30 + (i - 1) * 6, 26, 4, 2);
  }

  txt(String(S.score).padStart(7, '0'), W - 6, 12, '#d8c49a', 'right');
  if (S.combo > 1) txt('x' + S.combo, W - 6, 22, 'hsl(' + (40 + S.combo * 6) + ',90%,60%)', 'right');

  drawMinimap();
  if (S.vacuum > 0) htxt('COLLECTING', W / 2, 68, 'rgba(245,197,24,' + clamp(S.vacuum, 0, 1) + ')', 'center', 8, { track: 0.3 });

  const ks = ['banana', 'melon', 'coolade', 'glock', 'bike'];
  let ix = W - 12;
  for (let i = ks.length - 1; i >= 0; i--) {
    const k = ks[i], lv = S.items[k] | 0;
    if (!lv) continue;
    drawSpr(ctx, ITEMS[k].spr, ix, H - 36, 0.9);
    for (let j = 0; j < lv; j++) { ctx.fillStyle = ITEMS[k].col; ctx.fillRect(ix - 4 + j * 4, H - 27, 3, 2); }
    ix -= 16;
  }
  if (S.god) drawSpr(ctx, SPR.eye, ix, H - 36, 0.9);

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
    const col = b.scar ? scarCol() : b.wep ? WEP[b.wep].col : b.key === 'god' ? '#ff2b2b' : ITEMS[b.key].col;
    ctx.fillStyle = col; ctx.fillRect(0, H / 2 + 18, W, 1); ctx.fillRect(0, H / 2 + 61, W, 1);
    const spr = b.scar ? SPR.scar : b.wep ? WEP[b.wep].spr : b.key === 'god' ? SPR.eye : ITEMS[b.key].spr;
    drawSpr(ctx, spr, W / 2 - 84, H / 2 + 40, b.wep || b.scar ? 2 : 1.8, false, 1, b.scar ? col : null);
    const nm = b.scar ? scarName() : b.wep ? WEP[b.wep].name : b.key === 'god' ? 'THE THIRD EYE OF DAMJAN' : ITEMS[b.key].n[Math.min(b.lv - 1, 1)];
    const de = b.scar ? ('the rifle reforged — +' + Math.round((ST().scarMul - 1) * 100) + '% damage')
             : b.wep ? WEP[b.wep].tag : b.key === 'god' ? 'you are no longer bound by meat.' : ITEMS[b.key].d[Math.min(b.lv - 1, 1)];
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

  // loose loot (secrets are not on here)
  for (const d of S.drops) {
    if (d.kind === 'god') continue;
    const c = d.kind === 'item' ? ITEMS[d.key].col
      : d.kind === 'coin' ? '#f5c518' : d.kind === 'card' ? '#e04a54'
      : d.kind === 'med' ? '#ff6b6b' : d.kind === 'ammo' ? '#f2d14a'
      : d.kind === 'nade' ? '#7aa35e' : d.kind === 'shield' ? '#7fd0ff'
      : d.kind === 'nova' ? '#ffb03a' : '#ffffff';
    const big = d.kind === 'item';
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
  const sp = play ? 3 + S.p.recoil * 5 : 3;
  const arms = [[mx - sp - 3, my, 3, 1], [mx + sp, my, 3, 1],
                [mx, my - sp - 3, 1, 3], [mx, my + sp, 1, 3]];
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
  htxt('MEAT PROTOCOL', W / 2, 52, '#e02630', 'center', 30,
       { weight: '700', glow: '#8c0a14', glowSize: 26, alpha: flick, track: 0.14 });
  htxt('a Damjan situation', W / 2, 66, '#7d6a5c', 'center', 8, { track: 0.30 });

  drawSpr(ctx, bodySprite(), W / 2, 104, 2.2);
  drawSpr(ctx, legSprite(0), W / 2, 127.1, 2.2);   // 2.2 * (16/2 + 5/2) below the body centre
  drawSprRot(ctx, SPR.scar, W / 2 + 4, 112, 0.15, 2, 2, 3, false);
  if (cosDef(equippedCos()).fx === 'fire' && Math.random() < 0.8)
    part(W / 2 + rnd(-10, 10), 88, pick(['#ff8a20', '#ffd05a']), 1, 30, 0.5);
  for (const q of S.part) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s); }
  ctx.globalAlpha = 1;
  updateParticles(1 / 60);

  const evoCost = EVO_COST(S.evo | 0);
  uiBtn(W / 2 - 150, 150, 96, 22, 'PLAY', '#e8b25a', () => startRun());
  uiBtn(W / 2 - 48, 150, 96, 22, 'COSMETICS', '#b558ff', () => { S.cosReturn = 'title'; S.mode = 'cos'; });
  uiBtn(W / 2 + 54, 150, 96, 22, 'EVOLVE ' + (S.evo | 0), '#ff4a54', () => evolve(), !canEvolve());
  if (S.evo | 0)
    uiBtn(W / 2 - 48, 176, 96, 16, 'RESET EVO', '#7fe08a', () => resetEvolution());

  statRow([
    { spr: SPR.coin, v: String(S.coins), col: '#f5c518' },
    { spr: SPR.card, v: S.cards + '/' + OMEGA_CARDS, sc: 0.6, col: '#d8b8b8' },
    { v: 'VAULT ' + S.vault, col: '#9d8a7a' },
    { v: 'EVO ' + (S.evo | 0) + ' / NEXT ' + evoCost, col: canEvolve() ? '#ff6a72' : '#6b5a4e' }
  ], (S.evo | 0) ? 204 : 190);

  const sv = loadSave();
  const y0 = (S.evo | 0) ? 218 : 206;
  htxt('BEST ' + (sv.best || 0) + '   ·   DEEPEST FLOOR ' + (sv.deep || 1) +
       (sv.godFound ? '   ·   EYE' : '') + (sv.modagaz ? '   ·   MODAGAZ x' + sv.modagaz : '') +
       (sv.goro ? '   ·   GOROMANIA' : ''), W / 2, y0, '#6d5c4e', 'center', 7.5, { track: 0.12 });
  htxt('WASD move · MOUSE aim · LMB fire · RMB frag · WHEEL swap · R reload · E buy',
       W / 2, y0 + 13, '#7e6d5f', 'center', 7.5, { track: 0.06 });
  htxt('ENTER play · C cosmetics · B armory · ESC pause · M mute',
       W / 2, y0 + 23, '#6b5c50', 'center', 7.5, { track: 0.06 });
  htxt('one thing is hidden on floor 1.  one in every corner.  one behind a door that is shut.',
       W / 2, H - 8, 'rgba(126,86,86,0.55)', 'center', 7, { track: 0.10, noShadow: true });
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
    htxt('FLOOR ' + (S.room + 1) + '  ·  WAVE ' + S.wave, W / 2, 78, '#96826f', 'center', 8.5, { track: 0.22 });
    htxt(String(S.score), W / 2, 102, '#e8d2a4', 'center', 22, { weight: '700', track: 0.06 });
    htxt('SCORE', W / 2, 112, '#6b5a4e', 'center', 7, { track: 0.34 });

    statRow([
      { spr: SPR.coin, v: String(S.coins), col: '#f5c518' },
      { spr: SPR.card, v: String(S.cards), sc: 0.6, col: '#d8b8b8' },
      { v: 'VAULT ' + S.vault, col: '#9d8a7a' },
      { v: 'KILLS ' + S.kills, col: '#9d8a7a' }
    ], 128);
    const sv = loadSave();
    const evoCost = EVO_COST(S.evo | 0);
    htxt('guns ' + S.p.owned.length + '/7  ·  items ' + Object.keys(S.items).length + '/5' +
         (S.god ? '  ·  THE EYE' : '') + '  ·  best ' + (sv.best || 0) +
         '  ·  EVO ' + (S.evo | 0) + ' / NEXT ' + evoCost,
         W / 2, 142, '#5f5044', 'center', 7, { track: 0.10 });

    if (S.deadT > 1.0) {
      uiBtn(W / 2 - 150, 156, 96, 22, 'RETRY', '#e8b25a', () => startRun());
      uiBtn(W / 2 - 48, 156, 96, 22, 'COSMETICS', '#b558ff', () => { S.cosReturn = 'dead'; S.mode = 'cos'; });
      uiBtn(W / 2 + 54, 156, 96, 22, 'EVOLVE ' + (S.evo | 0), '#ff4a54', () => evolve(), !canEvolve());
      if (S.evo | 0) uiBtn(W / 2 - 150, 182, 96, 18, 'RESET EVO', '#7fe08a', () => resetEvolution());
      uiBtn(W / 2 + 54, 182, 96, 18, 'TITLE', '#8b7a68', () => { S.mode = 'title'; });
      htxt('R retry · C cosmetics', W / 2, 208, 'rgba(120,106,94,0.6)', 'center', 7, { track: 0.10, noShadow: true });
    }
  }
  crosshair();
}

function drawArmory() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(5,4,7,0.90)'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, 18, 6, W / 2, 18, 200);
  bg.addColorStop(0, 'rgba(200,150,30,0.13)'); bg.addColorStop(1, 'rgba(200,150,30,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('ARMORY', W / 2, 22, '#f0c65a', 'center', 20, { weight: '700', glow: '#6a4a10', glowSize: 18, track: 0.24 });
  drawSpr(ctx, SPR.coin, W / 2 - 34, 31, 1);
  htxt(String(S.coins), W / 2 - 26, 34, '#f5c518', 'left', 9, { track: 0.08 });

  const owned = S.p.owned;
  owned.forEach((id, i) => {
    const w = WEP[id], u = wup(id);
    const y = 44 + i * 29, rh = 25;
    ctx.fillStyle = 'rgba(13,10,14,0.8)'; ctx.fillRect(16, y, W - 32, rh);
    ctx.fillStyle = w.col; ctx.globalAlpha = 0.75; ctx.fillRect(16, y, 2, rh); ctx.globalAlpha = 1;
    drawSpr(ctx, w.spr, 34, y + 12, 0.95, false, 1, id === 'scar' && S.scarLv > 1 ? scarCol() : null);
    htxt(id === 'scar' ? scarName() : w.name, 52, y + 11,
         id === 'scar' ? scarCol() : w.col, 'left', 8.5, { track: 0.06 });
    htxt(w.beam ? 'beam' : Math.round(1 / (w.rate * (1 - u.rate * 0.10))) + '/s  ·  ' +
         (u.split ? (u.split * 2 + 1) + '-way' : '1-way'), 52, y + 20, 'rgba(140,122,108,0.9)', 'left', 6.5,
         { track: 0.03, noShadow: true });

    WTRACKS.forEach((tr, j) => {
      const bx = 160 + j * 104, bw = 98, bh = 19, by = y + 3;
      const rank = u[tr.id] | 0;
      const maxed = rank >= tr.max;
      const cost = wupCost(id, tr.id, rank);
      const afford = S.coins >= cost;
      const hot = !maxed && afford && mouse.x > bx && mouse.x < bx + bw && mouse.y > by && mouse.y < by + bh;
      const key = 'arm' + id + tr.id;
      hoverT[key] = clamp((hoverT[key] || 0) + (hot ? 0.22 : -0.18), 0, 1);
      const t = hoverT[key];

      ctx.fillStyle = maxed ? 'rgba(24,22,18,0.9)' : 'rgba(' + Math.round(10 + t * 40) + ',9,12,0.9)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = maxed ? 'rgba(120,110,80,0.5)' : tr.col;
      ctx.globalAlpha = maxed ? 0.5 : (afford ? 0.45 + t * 0.55 : 0.2);
      ctx.fillRect(bx, by, bw, 1); ctx.fillRect(bx, by + bh - 1, bw, 1);
      ctx.globalAlpha = 1;

      htxt(tr.name, bx + 5, by + 8, maxed ? '#8b8168' : afford ? (t > 0.4 ? '#fff' : tr.col) : '#7a5c58',
           'left', 7.5, { track: 0.10, glow: t > 0.2 ? tr.col : null, glowSize: 10 * t });
      for (let k = 0; k < tr.max; k++) {
        ctx.fillStyle = k < rank ? tr.col : 'rgba(90,80,74,0.45)';
        ctx.fillRect(bx + 5 + k * 6, by + 11, 4, 3);
      }
      if (maxed) htxt('MAX', bx + bw - 5, by + 14, '#8b8168', 'right', 7.5, { track: 0.10 });
      else {
        htxt(String(cost), bx + bw - 5, by + 14, afford ? '#f5c518' : '#96605e', 'right', 8, { track: 0.06 });
        drawSpr(ctx, SPR.coin, bx + bw - 9 - htxtWidth(String(cost), 8), by + 11, 0.62);
      }
      htxt(tr.d(rank), bx + 5, by + 17, 'rgba(132,118,106,0.75)', 'left', 6, { track: 0.02, noShadow: true });

      if (!maxed) S.ui.push({ x: bx, y: by, w: bw, h: bh, fn: () => {
        if (S.coins < cost) { A.denied(); return; }
        S.coins -= cost; u[tr.id] = rank + 1;
        persist(); A.buy();
        S.flash = 0.3; S.flashCol = tr.col;
      } });
    });
  });

  uiBtn(W / 2 - 48, H - 22, 96, 17, 'BACK', '#e8b25a', () => { S.mode = 'pause'; });
  htxt('upgrades are bought with run coins and last the run  ·  ESC back', W / 2, H - 27, 'rgba(120,106,94,0.65)', 'center', 6.5, { track: 0.10, noShadow: true });
  crosshair();
}

function drawLevelUp() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(4,6,4,0.86)'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, 190);
  bg.addColorStop(0, 'rgba(30,140,60,0.18)'); bg.addColorStop(1, 'rgba(30,140,60,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('LEVEL ' + S.level, W / 2, 48, '#9fe08a', 'center', 26,
       { weight: '700', glow: '#2e7a38', glowSize: 22, track: 0.18 });
  htxt(S.upgPts > 1 ? S.upgPts + ' POINTS TO SPEND' : 'CHOOSE ONE', W / 2, 64, '#7d8f78', 'center', 8.5, { track: 0.26 });

  const CW = 116, CH = 92, gap = 12;
  const x0 = W / 2 - (CW * 3 + gap * 2) / 2;
  (S.lvlChoices || UPGRADES).forEach((u, i) => {
    const x = x0 + i * (CW + gap), y = 86;
    const hot = mouse.x > x && mouse.x < x + CW && mouse.y > y && mouse.y < y + CH;
    const k = 'lvl' + u.id;
    hoverT[k] = clamp((hoverT[k] || 0) + (hot ? 0.22 : -0.18), 0, 1);
    const t = hoverT[k], off = t * 3;

    ctx.fillStyle = 'rgba(' + Math.round(10 + t * 26) + ',' + Math.round(12 + t * 30) + ',' + Math.round(11 + t * 22) + ',0.94)';
    ctx.fillRect(x, y - off, CW, CH);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t * 0.14;
    ctx.fillStyle = u.col; ctx.fillRect(x, y - off, CW, CH); ctx.restore();
    ctx.fillStyle = u.col;
    ctx.globalAlpha = 0.5 + t * 0.5;
    ctx.fillRect(x, y - off, CW, 2);
    ctx.globalAlpha = 0.22 + t * 0.7;
    ctx.fillRect(x, y + CH - 1 - off, CW, 1);
    ctx.fillRect(x, y - off, 1, CH); ctx.fillRect(x + CW - 1, y - off, 1, CH);
    ctx.globalAlpha = 1;

    const lvl = S.upg[u.id] | 0;
    htxt(u.name, x + CW / 2, y + 26 - off, t > 0.4 ? '#ffffff' : u.col, 'center', 13,
         { weight: '700', glow: t > 0.15 ? u.col : null, glowSize: 16 * t, track: 0.10 });
    htxt(u.d, x + CW / 2, y + 44 - off, '#9a8f84', 'center', 8, { track: 0.04 });
    htxt('RANK ' + lvl, x + CW / 2, y + 66 - off, lvl ? u.col : '#4f4a44', 'center', 9, { track: 0.16 });
    for (let j = 0; j < Math.min(lvl, 10); j++) {
      ctx.fillStyle = u.col;
      ctx.fillRect(x + CW / 2 - Math.min(lvl, 10) * 3 + j * 6, y + 74 - off, 4, 3);
    }
    S.ui.push({ x, y, w: CW, h: CH, fn: () => takeUpgrade(u.id) });
  });

  htxt('kills feed the meter. it does not stop climbing.', W / 2, H - 16, 'rgba(120,132,116,0.6)', 'center', 7.5, { track: 0.14 });
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

  /* Buttons live in a centred row under the title. Cornering them put the wide
     ones straight through PAUSED, and the keyboard hints they used to sit
     beside are on the title screen where you actually read them. */
  const btns = [['ARMORY', '#f0c65a', () => { S.mode = 'armory'; }],
                ['COSMETICS', '#b558ff', () => { S.cosReturn = 'pause'; S.mode = 'cos'; }]];
  if (S.evo | 0) btns.push(['RESET EVO', '#7fe08a', () => resetEvolution()]);
  const bw = 96, gap = 8, rowW = btns.length * bw + (btns.length - 1) * gap;
  btns.forEach((b, i) => uiBtn(W / 2 - rowW / 2 + i * (bw + gap), 40, bw, 18, b[0], b[1], b[2]));

  let y = 76;
  sectionRule('GROCERIES', y);
  y += 13;
  let any = false;
  for (const k of ['banana', 'melon', 'coolade', 'glock', 'bike']) {
    const lv = S.items[k] | 0; if (!lv) continue; any = true;
    const nm = ITEMS[k].n[Math.min(lv - 1, 1)];
    drawSpr(ctx, ITEMS[k].spr, 38, y - 2, 0.9);
    htxt(nm, 50, y + 1, ITEMS[k].col, 'left', 8, { track: 0.06 });
    htxt(ITEMS[k].d[Math.min(lv - 1, 1)], 50 + htxtWidth(nm, 8, 0.06) + 6, y + 1,
         'rgba(140,120,106,0.85)', 'left', 7, { track: 0.03, noShadow: true });
    y += 12;
  }
  if (S.god) { drawSpr(ctx, SPR.eye, 38, y - 2, 0.8); htxt('THE THIRD EYE — you cannot die', 50, y + 1, '#ff5b5b', 'left', 8); y += 12; any = true; }
  if (!any) { htxt('empty. go kill something with a name.', 38, y + 1, '#5f5044', 'left', 7.5); y += 12; }

  /* Arsenal in two columns: seven guns stacked in one column ran into the
     footer once you owned them all. */
  y += 10;
  sectionRule('ARSENAL', y);
  y += 13;
  const colX = [30, 250], colW = 200, half = Math.ceil(WORDER.length / 2);
  WORDER.forEach((id, i) => {
    const w = WEP[id], has = S.p.owned.indexOf(id) >= 0;
    const cx = colX[Math.floor(i / half)], ry = y + (i % half) * 12;
    drawSpr(ctx, w.spr, cx + 12, ry - 1, 0.9, false, has ? 1 : 0.22);
    htxt(id === 'scar' ? scarName() : w.name, cx + 28, ry + 2,
         has ? (id === 'scar' ? scarCol() : w.col) : '#4a3f36', 'left', 8, { track: 0.06 });
    htxt(has ? 'OWNED' : (w.cards ? w.cards + ' cards' : w.price + ' coins'),
         cx + colW - 4, ry + 2, has ? 'rgba(126,150,112,0.85)' : '#6b5a4e', 'right', 7,
         { track: 0.04, noShadow: true });
  });

  statRow([
    { spr: SPR.coin, v: String(S.coins), col: '#f5c518' },
    { spr: SPR.card, v: S.cards + '/' + OMEGA_CARDS, sc: 0.6, col: '#d8b8b8' },
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

  update(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  octx.clearRect(0, 0, ov.width, ov.height);

  if (S.mode === 'title') drawTitle();
  else if (S.mode === 'cos') drawCosmetics();
  else {
    drawWorld();
    drawLight();
    post();
    drawHUD();
    if (S.mode === 'pause') drawPause();
    if (S.mode === 'armory') drawArmory();
    if (S.mode === 'levelup') drawLevelUp();
    if (S.mode === 'dead') drawDead();
  }

  if (S.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(S.fade, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }
  requestAnimationFrame(frame);
}

/* ---------- presentation: never render below 200% ---------- */
function fitCanvas() {
  const sx = window.innerWidth / W, sy = window.innerHeight / H;
  const scale = Math.max(2, Math.floor(Math.min(sx, sy)));   // 200% floor, integer steps
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
window.MEAT = { S, startRun, startWave, spawnBoss, spawnEnemy, grantItem, grantGod, breakSecret,
                giveWeapon, explode, triggerModagaz, triggerGoromania, populateShops,
                evolve, resetEvolution, canEvolve, EVO_COST, OMEGA_CARDS,
                gainXP, openLevelUp, takeUpgrade, UPGRADES, scarName, scarCol, ST,
                ITEMS, BOSSES, WEP, WORDER, COSMETICS, frame, nextRoom };

})();
