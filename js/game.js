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
function htxt(s, x, y, col, align, size, opts) {
  const o = opts || {}, k = uiScale, sz = size || 9;
  const fnt = o.font || UI_FONT;
  // o.mid: treat y as the vertical centre of the cap box rather than the
  // baseline. Canvas' own 'middle' baseline sits low because it splits the em
  // box including descenders; centring on caps is what reads as centred.
  // The ratio is measured off whichever face this string is set in, so the
  // display face and the body face both land where they are asked to.
  const by = o.mid ? y + sz * capRatio(fnt) / 2 : y;
  // Canvas puts letter-spacing after the final glyph as well, so the measured
  // run is one gap wider than the ink and centred text lands half a gap left.
  // Give it back, or every centred label sits fractionally off.
  const trk = (o.track === undefined ? 0.04 : o.track) * sz;
  const al = align || 'left';
  if (al === 'center') x += trk / 2; else if (al === 'right') x += trk;
  octx.save();
  octx.font = (o.weight || '600') + ' ' + (sz * k) + 'px ' + fnt;
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
  const k = uiScale;
  octx.save();
  octx.font = '600 ' + ((size || 9) * k) + 'px ' + (font || UI_FONT);
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
    else if (S.mode === 'deck') S.mode = 'pause';
    else if (S.mode === 'cos' || S.mode === 'contracts') S.mode = S.cosReturn || 'title';
  }
  if (e.code === 'KeyB' && (S.mode === 'play' || S.mode === 'pause')) S.mode = 'deck';
  if (e.code === 'Escape' && S.mode === 'augment') refuseAugments();
  else if (e.code === 'KeyB' && S.mode === 'deck') S.mode = 'play';
  // cosmetics are reachable from anywhere that isn't a firefight
  if (e.code === 'KeyC' && S.mode !== 'cos' && S.mode !== 'play') { S.cosReturn = S.mode; S.mode = 'cos'; }
  if (S.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startRun();
  if (S.mode === 'dead' && e.code === 'KeyR') startRun();
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

/* Past the four hand-built floors the building keeps going. Names, palettes and
   arena size are generated from the floor index, so there is no bottom — the
   descent just keeps widening and getting darker. */
const DEEP_NAMES = ['THE RENDERING', 'THE COLD ROOM', 'THE LONG TABLE', 'THE UNDERCUT',
                    'THE SALT LINE', 'THE GRINDER', 'THE LAST AISLE', 'THE FLOOR BELOW'];
const DEEP_SUBS = ['it is still going down', 'nobody built this part',
                   'the walls are further apart here', 'you have stopped counting',
                   'something is keeping the lights off', 'it knows the way you walk',
                   'there was never a bottom', 'deeper than the plans allow'];
function roomDef(idx) {
  if (idx < ROOMS.length) return ROOMS[idx];
  const d = idx - ROOMS.length;
  const h = (200 + d * 47) % 360;
  const hs = (off, s, l) => 'hsl(' + (((h + off) % 360 + 360) % 360) + ',' + s + '%,' + l + '%)';
  const cyc = Math.floor(d / DEEP_NAMES.length);
  return {
    name: DEEP_NAMES[d % DEEP_NAMES.length] + (cyc ? ' ' + roman(cyc + 1) : ''),
    sub: 'floor ' + String(idx + 1).padStart(2, '0') + ' // ' + DEEP_SUBS[d % DEEP_SUBS.length],
    aw: Math.min(1560, 1140 + d * 36), ah: Math.min(1080, 790 + d * 26),
    floor: [hs(0, 17, 20), hs(9, 19, 17), hs(-9, 15, 14)],
    grout: hs(0, 26, 8),
    wall: [hs(7, 19, 31), hs(0, 17, 17), hs(13, 22, 41)],
    fog: 'hsla(' + h + ',72%,32%,0.16)',
    dark: Math.min(0.88, 0.82 + d * 0.008)
  };
}
/* PACI's back room. Not a floor — it never appears in the descent count. */
const SHOP_ROOM = {
  name: "PACI'S", sub: 'the back room // he was expecting you',
  aw: 440, ah: 330, floor: ['#3a3040', '#322838', '#2a2030'], grout: '#191320',
  wall: ['#5a4a64', '#332a3c', '#75608a'], fog: 'rgba(70,25,95,0.09)', dark: 0.52
};
function curRoom() { return S.inShop ? SHOP_ROOM : roomDef(S.room); }
const SHOP_EVERY = 3;      // one back room per three bosses put down

/* Individual hits land much harder than they used to. Balanced back by a slower
   contact rate, longer i-frames and better healing — spikier, not just meaner. */
const ETYPE = {
  crawler:  { bank: SPR.anim.crawler,  hp: 26,  spd: 54, dmg: 16, r: 6, score: 10, gib: '#8b6161', name: 'CRAWLER' },
  shrieker: { bank: SPR.anim.shrieker, hp: 38,  spd: 33, dmg: 20, r: 6, score: 20, gib: '#6b8a52', name: 'SHRIEKER' },
  stalker:  { bank: SPR.anim.stalker,  hp: 32,  spd: 84, dmg: 23, r: 6, score: 26, gib: '#9a927e', name: 'STALKER' },
  bloater:  { bank: SPR.anim.bloater,  hp: 105, spd: 25, dmg: 32, r: 9, score: 40, gib: '#9c4049', name: 'BLOATER' }
};
const CONTACT_CD = 0.74;   // still a shorter fuse than the 0.78 it used to be
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
/* Bosses used to land on five of the ten waves, which made them furniture.
   One floor boss on wave 10, two elites on the way there, and every fifth
   floor the boss comes up as an APEX instead. */
const BOSS_WAVE = 10;
const MINI_WAVES = [4, 8];
const APEX_EVERY = 5;                       // floors 5, 10, 15 ... are apex floors
function bossIndexFor(floor) { return floor % BOSSES.length; }
function isApexFloor(floor) { return (floor + 1) % APEX_EVERY === 0; }

/* Elites: a regular enemy that came up wrong. Named, tracked on the boss bar,
   and worth a card. */
const MINIS = [
  { key: 'crawler',  name: 'THE FIRSTBORN',   col: '#ff8a6a', tint: 'rgba(255,110,70,0.42)' },
  { key: 'shrieker', name: 'THE CHOIRMASTER', col: '#a8ff6a', tint: 'rgba(150,255,90,0.42)' },
  { key: 'stalker',  name: 'THE LONG WALK',   col: '#e8e0c0', tint: 'rgba(240,230,200,0.38)' },
  { key: 'bloater',  name: 'THE SPOILAGE',    col: '#ff6a8a', tint: 'rgba(255,90,120,0.42)' }
];

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

/* ============================================================
   GRADE — one rarity ladder, shared by guns and cards.
   Butcher's grades, because of course they are. `mul` scales a card's
   numbers; `glow` is how hard the thing shines on a pedestal.
   ============================================================ */
const GRADE = [
  { n: 'SELECT',      col: '#b0a696', mul: 1.00, w: 100, glow: 0  },
  { n: 'CHOICE',      col: '#7fe08a', mul: 1.40, w: 34,  glow: 9  },
  { n: 'PRIME',       col: '#7fd0ff', mul: 1.85, w: 9,   glow: 15 },
  { n: 'BLACK LABEL', col: '#ffb03a', mul: 2.40, w: 2,   glow: 22 },
  { n: 'CONDEMNED',   col: '#c05cff', mul: 3.20, w: 0,   glow: 28 }   // never rolled — placed by hand
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
   bought from PACI, and `gr` is the grade it shines at on his pedestals. */
const WEP = {
  pistol:{ id: 'pistol',name: 'THE SIDEARM',   spr: SPR.pistol,gr: 0, price: 0,   mag: 18,  rate: 0.155, dmg: 21, spread: 0.020, spd: 470, pellets: 1, reload: 1.15, sfx: 'shoot',    col: '#c8ccd4', evolve: 1, tag: 'it was in the drawer. it will do.' },
  scar:  { id: 'scar',  name: 'SCAR-L',        spr: SPR.scar,  gr: 0, price: 20,  mag: 30,  rate: 0.088, dmg: 13, spread: 0.026, spd: 430, pellets: 1, reload: 1.45, sfx: 'shoot',    col: '#ffe9a8', tag: 'reliable. boring. yours.' },
  saw:   { id: 'saw',   name: 'MEAT SPLITTER', spr: SPR.saw,   gr: 0, price: 30,  mag: 2,   rate: 0.62,  dmg: 12, spread: 0.24,  spd: 380, pellets: 9, reload: 1.9,  sfx: 'shotgun',  col: '#ffcf8a', knock: 300, tag: 'nine reasons to stand still' },
  price: { id: 'price', name: 'THE PRICE GUN', spr: SPR.price, gr: 1, price: 45,  mag: 40,  rate: 0.070, dmg: 7,  spread: 0.06,  spd: 560, pellets: 1, reload: 1.6,  sfx: 'nailgun',  col: '#ff4ab0', mark: 6, tag: 'everything it tags is on sale' },
  nail:  { id: 'nail',  name: 'THE STAPLER',   spr: SPR.nail,  gr: 1, price: 55,  mag: 60,  rate: 0.045, dmg: 8,  spread: 0.10,  spd: 540, pellets: 1, reload: 2.0,  sfx: 'nailgun',  col: '#f2d14a', pin: 0.45, tag: 'pins them to the floor' },
  micro: { id: 'micro', name: 'MICROWAVE',     spr: SPR.micro, gr: 2, price: 80,  mag: 16,  rate: 0.24,  dmg: 34, spread: 0.02,  spd: 270, pellets: 1, reload: 2.1,  sfx: 'plasma',   col: '#4fd6e8', bounce: 3, burn: 16, size: 3, tag: 'reheats the dead' },
  chill: { id: 'chill', name: 'FREEZER BURN',  spr: SPR.chill, gr: 2, price: 95,  mag: 55,  rate: 0.055, dmg: 9,  spread: 0.14,  spd: 400, pellets: 1, reload: 2.2,  sfx: 'plasma',   col: '#9fe4ff', chill: 2.2, size: 2, tag: 'the cold aisle, weaponised' },
  hog:   { id: 'hog',   name: 'THE HOG',       spr: SPR.hog,   gr: 2, price: 120, mag: 120, rate: 0.032, dmg: 10, spread: 0.13,  spd: 500, pellets: 1, reload: 3.4,  sfx: 'minigun',  col: '#ffd28a', spin: 1, slow: 0.45, tag: 'spins up. never stops.' },
  rot:   { id: 'rot',   name: 'THE ROTISSERIE',spr: SPR.rot,   gr: 3, price: 165, mag: 70,  rate: 0.050, dmg: 14, spread: 0.05,  spd: 330, pellets: 1, reload: 2.6,  sfx: 'plasma',   col: '#ff9a3a', radial: 0.55, burn: 10, size: 2, lock: 'seal', tag: 'it does not care where you point it' },
  rail:  { id: 'rail',  name: 'GOD FINGER',    spr: SPR.rail,  gr: 3, price: 190, mag: 5,   rate: 0.55,  dmg: 165, spread: 0,    spd: 950, pellets: 1, reload: 2.4,  sfx: 'railgun',  col: '#a8e8ff', charge: 0.5, pierce: 99, size: 3, knock: 200, tag: 'points. things stop existing.' },
  omega: { id: 'omega', name: 'OMEGA BEAM',    spr: SPR.omega, gr: 4, price: 0, cards: OMEGA_CARDS, mag: 300, rate: 0.02, dmg: 720, spread: 0, spd: 0, pellets: 0, reload: 2.6, sfx: 'beam', col: '#c05cff', beam: 1, girth: 11, tag: 'fifty cards. one very wide line.' }
};
const WORDER = ['pistol', 'scar', 'saw', 'price', 'nail', 'micro', 'chill', 'hog', 'rot', 'rail', 'omega'];
/* Two of these are behind contracts and simply are not in PACI's crate until
   you have earned them — see CONTRACTS. */
const BUYABLE = ['scar', 'saw', 'price', 'nail', 'micro', 'chill', 'hog', 'rot', 'rail'];

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
    /* THE MENU. `deck` is the run's whole build; `luck` tilts every hand. */
    xp: 0, level: 1, xpNext: 48, upgPts: 0,
    deck: {}, hand: null, lvlLuck: 0, rerolls: 0, cardsTaken: 0, luck: 0,
    augs: {}, augOffer: null, tomce: null,
    floorBosses: 0, apexKills: 0, fx: [], coinFrac: 0,
    killsSinceNova: 0, savesLeft: 0, regenT: 0, pendingLuck: 0, lvlDelay: 0, pendingKick: 0,
    scarLv: 1, glusec: 0,
    layout: 'scatter',
    bossKills: 0, shopDue: false, shopsSeen: 0, inShop: false, shopStash: null, paci: null,
    apex: false, mini: null,
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
  const maxhp = Math.max(30, Math.round((100 + (m === 1 ? 38 : m >= 2 ? 76 : 0) + dk('roughage'))
                           * (1 - Math.min(0.24, dkr('pricehike') * 0.08))
                           * (1 - ag('glass') * 0.15 - ag('hollow') * 0.10 + ag('ballast') * 0.22)));
  /* Missing health feeds RAW NERVE. Guarded because ST() is called before the
     player exists during boot. */
  const hurt = S.p ? clamp(1 - S.p.hp / Math.max(1, maxhp), 0, 1) : 0;
  return {
    speed: 94 * (1 + (b === 1 ? 0.22 : b >= 2 ? 0.44 : 0) + (bk === 1 ? 0.16 : bk >= 2 ? 0.30 : 0))
              * (1 + dk('adrenaline') / 100)
              * clamp(1 - ag('tinnitus') * 0.09 - ag('ballast') * 0.08 + ag('sleepless') * 0.14, 0.4, 2),
    maxhp,
    dmgMul: (k === 1 ? 1.38 : k >= 2 ? 1.85 : 1) * (S.god ? 3 : 1) * (S.goro ? 1.25 : 1)
              * (1 + dkc('malice') / 100)
              * (1 + dkc('nerve') / 100 * hurt)
              * (1 + ag('cataract') * 0.15 + ag('glass') * 0.24 + ag('thinskin') * 0.30),
    flatDmg: dkc('caliber'),
    crit: dkc('cleaver') / 100 + ag('coldblood') * 0.09,
    critMul: 2.0 + dkc('deepcut') / 100,
    resist: (1 - dkc('callus') / 100) * (1 + ag('thinskin') * 0.22 + ag('grease') * 0.11),
    dodge: dkc('aegis') / 100,
    pierce: (k === 1 ? 1 : k >= 2 ? 2 : 0) + dkc('carve'),
    shieldMax: m === 1 ? 2 : m >= 2 ? 4 : 0,
    shieldCd: m >= 2 ? 8 : 14,
    peel: b > 0, peelBoom: b >= 2,
    glocks: g === 1 ? 1 : g >= 2 ? 2 : 0,
    glockRate: g >= 2 ? 0.11 : 0.20,
    glockDmg: 13,
    ram: bk === 1 ? 40 : bk >= 2 ? 95 : 0,
    ramFire: bk >= 2,
    dashCd: (bk ? 0.45 : (b ? 0.58 : 0.85)) * (1 - ag('grease') * 0.30),
    /* ---- deck-driven weapon mods. These used to be bought per gun in the
       armory; they are cards now and they apply to whatever you are holding. */
    rateMul: 1 / (1 + dkc('cycle') / 100 + ag('tinnitus') * 0.16),
    split: dkc('split'),
    magMul: Math.max(0.35, 1 + dkc('hopper') / 100 - ag('shortfuse') * 0.16),
    reloadMul: Math.max(0.2, 1 - dkc('quick') / 100 - ag('shortfuse') * 0.22),
    bounce: dkc('ricochet'),
    home: dkc('guidance'),
    burn: dkc('spoiled'),
    slowHit: dkc('coldsnap') / 100,
    freeze: dkc('frostbite') / 100,
    aura: dkc('walkin') / 100,
    overkill: dkc('overkill'),
    graze: dkc('grazing') + ag('feeder') * 1.5,
    regen: dkc('regrowth'),
    lootMul: 1 + dkc('clearance') / 100,
    novaEvery: dkr('flashpoint') ? Math.max(8, 22 - dkc('flashpoint') * 5) : 0,
    /* ---- TOMCE's side of the ledger ---- */
    xpMul: Math.max(0.3, 1 - ag('debt') * 0.14 - ag('feeder') * 0.18 + ag('loudmouth') * 0.45),
    coinMul: 1 + ag('debt') * 0.40,
    sight: clamp(1 - ag('cataract') * 0.11 - ag('sleepless') * 0.10, 0.5, 1),
    magnet: clamp(1 - ag('coldblood') * 0.30, 0.3, 1),
    swarm: 1 + ag('loudmouth') * 0.18,
    /* the sidearm gains a mark every FLOOR: new colour, new voice, +20% each */
    scarMul: 1 + 0.20 * (S.scarLv - 1)
  };
}

/* ============================================================
   THE MENU — the card deck.

   There is no armory and there are no grocery drops any more; everything
   that used to be bought with coins or dropped by a boss is a card you pick
   on level-up. Five aisles, one grade ladder, and the five groceries sit at
   the top of the deck as CONDEMNED signature cards.

   A card holds { rank, amt }: rank is how many times you took it, amt is the
   accumulated number, which is what the game actually reads. Grade scales
   what a single pick is worth, so a PRIME MALICE is worth two SELECT ones.
   ============================================================ */
const AISLES = {
  butchery: { n: 'BUTCHERY', col: '#ff5a62' },
  produce:  { n: 'PRODUCE',  col: '#7fe08a' },
  frozen:   { n: 'FROZEN',   col: '#7fd0ff' },
  hardware: { n: 'HARDWARE', col: '#f5c518' },
  expired:  { n: 'EXPIRED',  col: '#c05cff' }
};
const AISLE_ORDER = ['butchery', 'produce', 'frozen', 'hardware', 'expired'];

const CARDS = [
  /* ---- BUTCHERY: hurting things ---- */
  { id: 'malice',    name: 'MALICE',        aisle: 'butchery', max: 6, b: 0, v: 6,   d: v => '+' + v + '% damage' },
  { id: 'cleaver',   name: 'CLEAVER',       aisle: 'butchery', max: 5, b: 0, v: 4,  cap: 60,  d: v => '+' + v + '% critical chance' },
  { id: 'deepcut',   name: 'DEEP CUT',      aisle: 'butchery', max: 4, b: 1, v: 18,  d: v => '+' + v + '% critical damage' },
  { id: 'overkill',  name: 'OVERKILL',      aisle: 'butchery', max: 3, b: 2, v: 18,  d: v => 'kills burst for ' + v + ' damage' },
  { id: 'nerve',     name: 'RAW NERVE',     aisle: 'butchery', max: 3, b: 1, v: 15, cap: 80,  d: v => 'up to +' + v + '% damage as you bleed' },
  { id: 'carve',     name: 'CARVE',         aisle: 'butchery', max: 2, b: 0, v: 1, int: 1, cap: 2, d: v => 'shots pass through ' + v + ' more' },
  /* ---- PRODUCE: staying alive and moving ---- */
  { id: 'adrenaline',name: 'ADRENALINE',    aisle: 'produce', max: 6, b: 0, v: 5,    d: v => '+' + v + '% move speed' },
  { id: 'roughage',  name: 'ROUGHAGE',      aisle: 'produce', max: 6, b: 0, v: 15,   d: v => '+' + v + ' max health' },
  { id: 'regrowth',  name: 'REGROWTH',      aisle: 'produce', max: 4, b: 0, v: 0.4, dec: 1, cap: 3, d: v => '+' + v + ' health a second' },
  { id: 'grazing',   name: 'GRAZING',       aisle: 'produce', max: 4, b: 0, v: 0.6, dec: 1, cap: 4, d: v => '+' + v + ' health a kill' },
  { id: 'banana',    name: 'BANANA',        aisle: 'produce', max: 2, b: 2, sig: 'banana', fixed: 4 },
  { id: 'bike',      name: 'STOLEN BICYCLE',aisle: 'produce', max: 2, b: 2, sig: 'bike',   fixed: 4 },
  /* ---- FROZEN: taking less, slowing them down ---- */
  { id: 'callus',    name: 'CALLUS',        aisle: 'frozen', max: 6, b: 0, v: 5, cap: 45,  d: v => '-' + v + '% damage taken' },
  { id: 'aegis',     name: 'AEGIS PLATING', aisle: 'frozen', max: 3, b: 0, v: 7, cap: 32,  d: v => v + '% chance a hit does nothing' },
  { id: 'coldsnap',  name: 'COLD SNAP',     aisle: 'frozen', max: 3, b: 0, v: 11, cap: 50, d: v => 'your hits slow by ' + v + '%' },
  { id: 'frostbite', name: 'FROSTBITE',     aisle: 'frozen', max: 3, b: 1, v: 4, cap: 20,  d: v => v + '% chance to freeze solid' },
  { id: 'walkin',    name: 'THE WALK-IN',   aisle: 'frozen', max: 3, b: 0, v: 8, cap: 40,  d: v => 'things near you crawl ' + v + '% slower' },
  { id: 'melon',     name: 'MELON',         aisle: 'frozen', max: 2, b: 2, sig: 'melon',  fixed: 4 },
  /* ---- HARDWARE: whatever you are holding ---- */
  { id: 'cycle',     name: 'CYCLE',         aisle: 'hardware', max: 5, b: 0, v: 6, cap: 45, d: v => '+' + v + '% fire rate' },
  { id: 'split',     name: 'SPLIT',         aisle: 'hardware', max: 2, b: 1, v: 1, int: 1, cap: 2, d: v => 'your shot forks ' + (v * 2 + 1) + ' ways' },
  { id: 'caliber',   name: 'CALIBER',       aisle: 'hardware', max: 5, b: 0, v: 1.2, dec: 1, cap: 12, d: v => '+' + v + ' flat damage a shot' },
  { id: 'hopper',    name: 'HOPPER',        aisle: 'hardware', max: 3, b: 0, v: 22, cap: 90, d: v => '+' + v + '% magazine' },
  { id: 'quick',     name: 'QUICK HANDS',   aisle: 'hardware', max: 3, b: 0, v: 11, cap: 45, d: v => '-' + v + '% reload time' },
  { id: 'ricochet',  name: 'RICOCHET',      aisle: 'hardware', max: 2, b: 1, v: 1, int: 1, cap: 3, d: v => 'shots bounce ' + v + ' more times' },
  { id: 'guidance',  name: 'GUIDANCE',      aisle: 'hardware', max: 2, b: 2, v: 1.1, dec: 1, cap: 3.5, d: v => 'shots steer, turn rate ' + v },
  { id: 'munitions', name: 'MUNITIONS',     aisle: 'hardware', max: 2, b: 1, v: 1, int: 1, cap: 2, d: v => '+' + v + ' frag every wave' },
  /* ---- EXPIRED: the bad idea aisle ---- */
  { id: 'clearance', name: 'CLEARANCE',     aisle: 'expired', max: 3, b: 1, v: 18, cap: 70, d: v => '+' + v + '% loot, and better cards' },
  { id: 'pricehike', name: 'PRICE HIKE',    aisle: 'expired', max: 2, b: 1, v: 30, cap: 80, d: v => '+' + v + '% experience, -8% max health' },
  { id: 'spoiled',   name: 'SPOILED',       aisle: 'expired', max: 3, b: 0, v: 6, cap: 30,  d: v => 'your hits burn for ' + v + '/s' },
  { id: 'seconds',   name: 'SECOND HELPING',aisle: 'expired', max: 1, b: 2, v: 1, int: 1, cap: 1, d: v => 'survive ' + v + ' fatal hit a floor' },
  { id: 'flashpoint',name: 'FLASHPOINT',    aisle: 'expired', max: 2, b: 2, v: 1, int: 1, cap: 2, d: v => 'a nova every ' + Math.max(8, 22 - v * 5) + ' kills' },
  { id: 'coolade',   name: 'COOLADE',       aisle: 'expired', max: 2, b: 2, sig: 'coolade', fixed: 4 },
  { id: 'glock',     name: 'GLOCK-18',      aisle: 'expired', max: 2, b: 2, sig: 'glock',   fixed: 4 }
];
/* What a card needs before it will be dealt. Tier 1 opens on the wave-4 elite
   and tier 2 — novas, second chances, the signature groceries — only on a real
   floor boss. Gating tier 1 behind wave 10 as well meant a whole floor fought
   on plain numbers, which is not difficulty, it is a flat line. */
const BOSS_GATE = ['from the start', 'once you have killed an elite', 'once you have killed a floor boss'];
function cardUnlocked(c) {
  const b = c.b | 0;
  return b === 0 || (b === 1 ? S.bossKills >= 1 : S.floorBosses >= 1);
}
const CARD_BY_ID = {};
for (const c of CARDS) CARD_BY_ID[c.id] = c;

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
function cardLine(c, v) {
  if (c.sig) { const lv = clamp((S.items[c.sig] | 0), 0, 1); return ITEMS[c.sig].d[lv]; }
  return c.d(c.cap !== undefined ? Math.min(c.cap, v) : v);
}
function cardName(c) {
  if (c.sig) return ITEMS[c.sig].n[Math.min(S.items[c.sig] | 0, 1)];
  return c.name;
}

/* Deal a hand. Signature cards are deliberately rare until THE FULL MENU is
   signed off, and every card rolls its own grade. */
function dealCards(n, luckBonus) {
  const luck = S.luck + (luckBonus || 0);
  const sigW = contractDone('menu') ? 0.9 : 0.4;
  const pool = CARDS.filter(c => dkr(c.id) < c.max && cardUnlocked(c));
  const out = [];
  while (out.length < n && pool.length) {
    let tw = 0;
    for (const c of pool) tw += c.sig ? sigW : 1;
    let r = Math.random() * tw, ci = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].sig ? sigW : 1; if (r <= 0) { ci = i; break; } }
    const c = pool.splice(ci, 1)[0];
    const g = c.fixed !== undefined ? c.fixed : rollGrade(luck);
    out.push({ c, g, val: c.sig ? 0 : cardVal(c, g) });
  }
  return out;
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
/* Levels come roughly twice as fast as they used to: the deck is now the whole
   progression, so waiting four waves for one card made a floor feel flat. */
function gainXP(n) {
  S.xp += Math.round(n * (1 + dkc('pricehike') / 100) * ST().xpMul);
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext;
    S.level++;
    S.upgPts++;
    S.xpNext = Math.round(S.xpNext * 1.23);
    A.bigpickup();
    S.flash = Math.max(S.flash, 0.4); S.flashCol = '#9fe08a';
    ring(S.p.x, S.p.y, 46, '#9fe08a', 0.5, 2);
    float(S.p.x, S.p.y - 26, 'LEVEL ' + S.level, '#9fe08a', true);
  }
}
/* How many cards you get to look at. The APEX contract widens the hand. */
function handSize() { return (contractDone('apex') ? 4 : 3) + ag('hollow'); }
function rerollCost() { return 20 + S.rerolls * 15; }
function openLevelUp(luckBonus) {
  if (S.mode === 'levelup') return;
  S.mode = 'levelup';
  S.lvlLuck = luckBonus || 0;
  S.hand = dealCards(handSize(), S.lvlLuck);
  if (A.duck) A.duck(0.5, 3);
}
function rerollHand() {
  const c = rerollCost();
  if (S.coins < c) { A.denied(); return; }
  S.coins -= c; S.rerolls++;
  S.hand = dealCards(handSize(), S.lvlLuck + 0.35);
  A.rack(); persist();
}
function takeCard(o) {
  if (S.upgPts <= 0 || !o) return;
  const c = o.c;
  const d = S.deck[c.id] || (S.deck[c.id] = { rank: 0, amt: 0, g: 0 });
  d.rank++;
  d.amt = Math.round((d.amt + o.val) * 10) / 10;
  d.g = Math.max(d.g | 0, o.g);
  if (c.sig) grantItem(c.sig);            // the five groceries still run on the old plumbing
  S.upgPts--;
  S.cardsTaken++;
  if (o.g >= 2) bump('prime');
  const sigs = CARDS.filter(x => x.sig && dkr(x.id) > 0).length;
  if (sigs) bumpMax('sigs', sigs);
  recalcLuck();
  A.buy();
  S.flash = 0.5; S.flashCol = GRADE[o.g].col;
  if (S.p) S.p.hp = Math.min(ST().maxhp, S.p.hp + 8);
  if (S.upgPts <= 0) { S.mode = 'play'; S.hand = null; }
  else S.hand = dealCards(handSize(), S.lvlLuck);
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
  { id: 'grade', name: 'GRADED',           goal: 25,    stat: 'prime',  d: 'take 25 PRIME-or-better cards',     u: '+1 LUCK on every card you are dealt' },
  { id: 'dozen', name: "BUTCHER'S DOZEN",  goal: 3000,  stat: 'kills',  d: '3000 kills, all runs counted',      u: 'start every run one level up' },
  { id: 'hoard', name: 'HOARDER',          goal: 12000, stat: 'vault',  d: 'bank 12000 coins in the vault',     u: 'start every run holding 60 coins' },
  { id: 'apex',  name: 'APEX PREDATOR',    goal: 1,     stat: 'apex',   d: 'kill an APEX',                      u: 'you are dealt four cards, not three' },
  { id: 'menu',  name: 'THE FULL MENU',    goal: 5,     stat: 'sigs',   d: 'hold all five signature cards',     u: 'signature cards turn up far more often' }
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
/* One knob for how hard the floor hits. Evolutions stack on top forever. */
function diff() {
  const ev = S.evo | 0;
  return {
    hp: (1 + S.room * 1.25) * (1 + ev * 0.38),
    dmg: (1 + S.room * 0.72) * (1 + ev * 0.26),
    spd: (1 + S.room * 0.11) * (1 + ev * 0.05),
    score: (1 + S.room * 0.7) * (1 + ev * 0.5)
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
    S.walls.push({ x, y, w, h, obs: 1, kind: kind || (rng() < 0.35 ? 'vat' : 'crate') });
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

  const n = 7 + idx * 2;
  const LAYOUTS = ['scatter', 'pillars', 'corridors', 'bunkers', 'ring'];
  const layout = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
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

  bakeFloor(R, rng);
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
  const pool = BUYABLE.filter(id => S.p.owned.indexOf(id) < 0 &&
                                    (!WEP[id].lock || contractDone(WEP[id].lock)));
  if (S.p.owned.indexOf('omega') < 0) pool.push('omega');
  const offer = [];
  const n = shopSlots();
  while (offer.length < n && pool.length) offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
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
    S.props.length = 0; S.peels.length = 0;
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
      price: id === 'omega' ? 0 : WEP[id].price,
      cards: id === 'omega' ? OMEGA_CARDS : 0,
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
    A.setDread(clamp(S.wave / 10 * 0.6 + S.room * 0.2, 0, 1));
    if (A.music) A.music.setIntensity(clamp(0.12 + (S.wave / 10) * 0.72 + S.room * 0.16, 0, 1));
    A.doorOpen();
    msg('BACK TO IT', S.wave >= 10 ? 'the door north is still open.' : 'he watched you leave.', 2.4);
  };
}

/* 4x4 Bayer. Ordered dithering is how the floor gets a value gradient out of
   three flat tones: instead of a fourth colour, tiles fade into each other in
   a fixed pattern, which at this pixel density reads as grime settling rather
   than as a pattern. Same trick the sprites use to shade a curved surface. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)] / 16;

function bakeFloor(R, rng) {
  const sc = subCanvas(R.aw, R.ah);
  floorCan = sc.can; floorCtx = sc.ctx;
  const g = floorCtx, P = 1 / RS;          // one device pixel, in game units
  const TS = 16, cols = Math.ceil(R.aw / TS), rows = Math.ceil(R.ah / TS);
  /* Pick every tile's two tones and how worn it is up front, then resolve the
     whole floor in one buffer pass. Doing the dither with fillRect would be a
     million calls a room. */
  const tone = new Int8Array(cols * rows), wear = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const v = rng();
    tone[i] = v < 0.30 ? 1 : v < 0.44 ? 2 : 0;
    wear[i] = 0.35 + rng() * 0.5;
  }
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const TONES = [rgb(R.floor[0]), rgb(R.floor[1]), rgb(R.floor[2])];
  const ALT = [1, 2, 1];                    // which tone each one dithers toward

  const dw = floorCan.width, dh = floorCan.height;
  const img = g.createImageData(dw, dh), px = img.data;
  const span = TS * RS;
  for (let dy = 0; dy < dh; dy++) {
    const ty = (dy / span) | 0, fy = (dy % span) / span - 0.5;
    for (let dx = 0; dx < dw; dx++) {
      const tx = (dx / span) | 0;
      const ti = ty * cols + tx;
      const t = tone[ti] || 0;
      const u = Math.max(Math.abs((dx % span) / span - 0.5), Math.abs(fy)) * 2;
      const c = (u * u * wear[ti] > bay(dx, dy)) ? TONES[ALT[t]] : TONES[t];
      // fine grain, one device pixel — the surface never sits perfectly flat
      const n = ((dx * 73856093) ^ (dy * 19349663)) & 255;
      const k = n < 40 ? -14 : n > 232 ? 10 : 0;
      const o = (dy * dw + dx) << 2;
      px[o] = clamp(c[0] + k, 0, 255); px[o + 1] = clamp(c[1] + k, 0, 255);
      px[o + 2] = clamp(c[2] + k, 0, 255); px[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  for (let y = 0; y < R.ah; y += TS) {
    for (let x = 0; x < R.aw; x += TS) {
      // grout: a dark channel with a lit lip on the side the room's lamp finds
      g.fillStyle = R.grout;
      g.fillRect(x, y, TS, P * 2); g.fillRect(x, y, P * 2, TS);
      g.fillStyle = 'rgba(255,244,224,0.05)';
      g.fillRect(x, y + P * 2, TS, P); g.fillRect(x + P * 2, y, P, TS);
      // old spill: a dark core with a dithered halo, not a flat rectangle
      if (rng() < 0.07) {
        const cx = x + rng() * TS, cy = y + rng() * TS, rr = 2 + rng() * 5;
        for (let ty = -rr * RS; ty < rr * RS; ty++) {
          for (let tx = -rr * RS; tx < rr * RS; tx++) {
            const d = Math.hypot(tx, ty * 1.7) / (rr * RS);
            if (d > 1) continue;
            g.fillStyle = d < 0.55 ? 'rgba(48,8,12,0.42)' : 'rgba(60,12,16,0.30)';
            if (d < 0.55 || 1 - d > bay(tx + 64, ty + 64) * 0.9) g.fillRect(cx + tx * P, cy + ty * P, P, P);
          }
        }
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
    owned: ['pistol'], wi: 0, mags: { pistol: 14 },
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
  const waveK = 1 + S.wave * 0.05;
  const hp = d.hp * D.hp * waveK;
  const e = {
    type, x, y, vx: 0, vy: 0, r: d.r, bank: d.bank, spr: d.bank.walk[0],
    // random phase so a spawned batch doesn't march in lockstep
    anim: rnd(0, 4), poseT: 0,
    hp, max: hp,
    spd: d.spd * D.spd * rnd(0.9, 1.12), base: d.spd * D.spd,
    mark: 0, slowT: 0, slowAmt: 0,
    dmg: d.dmg * D.dmg * (1 + S.wave * 0.03),
    score: d.score, gib: d.gib, name: d.name,
    hit: 0, atkT: 0, fireT: rnd(1, 2), wob: rnd(0, TAU), stun: 0, burn: 0, burnT: 0,
    blinkT: rnd(1, 3), bob: rnd(0, TAU), flip: false, boss: false, dead: false, sq: 0,
    twitch: 0, twx: 0, twy: 0, trail: []
  };
  S.en.push(e);
  return e;
}

function spawnBoss(idx, apex) {
  const B = BOSSES[idx], D = diff();
  const am = apex ? 2.6 : 1;
  const hp = B.hp * D.hp * 1.35 * am;
  const b = {
    type: 'boss', def: B, name: apex ? 'APEX ' + B.name : B.name, x: S.aw / 2, y: 90, vx: 0, vy: 0,
    r: B.r * (apex ? 1.45 : 1), bank: B.bank, spr: B.bank.walk[0],
    tint: apex ? 'rgba(176,40,255,0.5)' : B.tint, scale: apex ? 1.5 : 1, apex: !!apex,
    anim: 0, poseT: 0,
    hp, max: hp, spd: B.spd * (1 + S.room * 0.06) * (1 + (S.evo | 0) * 0.04) * (apex ? 1.22 : 1),
    base: B.spd * (1 + S.room * 0.06) * (1 + (S.evo | 0) * 0.04) * (apex ? 1.22 : 1),
    mark: 0, slowT: 0, slowAmt: 0,
    dmg: 26 * D.dmg * (apex ? 1.45 : 1), score: apex ? 1400 : 500,
    gib: '#8a3540', hit: 0, phase: 'idle', pt: 1.2, wob: 0, bob: 0, sq: 0, orbit: rnd(0, TAU),
    stun: 0, burn: 0, burnT: 0, flip: false, boss: true, dead: false, chargeDir: 0, spawnT: 4,
    twitch: 0, twx: 0, twy: 0, trail: []
  };
  S.en.push(b); S.boss = b;
  A.roar();
  if (A.music) { A.music.setBoss(true); A.duck(0.7, 1.4); }
  S.jump = 0.42; S.jumpSpr = B;
  shake(apex ? 18 : 11); punch(apex ? 0.09 : 0.05);
  if (apex) { S.flash = 0.8; S.flashCol = '#b028ff'; }
  msg(b.name, apex ? 'IT CAME UP WRONG AND IT KEPT GROWING' : B.cry, 3.2);
  return b;
}

/* An elite: a regular horror that got too big for the aisle. Uses the ordinary
   enemy AI, wears a boss health bar, and is worth a card. */
function spawnMini(idx) {
  const M = MINIS[idx % MINIS.length], D = diff();
  const e = spawnEnemy(M.key, S.aw / 2, 92);
  /* These were a slightly chunky crawler. They are a fight now: seven times
     the meat, twice the bite, and they shell the room and call for help. */
  const k = 5 + S.room * 1.6;
  e.hp = e.max = ETYPE[M.key].hp * D.hp * k;
  e.dmg *= 1.9;
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
  if (p.reT > 0 || S.god || p.mags[w.id] >= magCap(w)) return;
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
  p.fireT = (w.spin ? lerp(0.16, w.rate, p.spin) : w.rate) * st.rateMul;
  if (!S.god) p.mags[w.id]--;

  const base = (w.spread + p.recoil * 0.05) * (S.god ? 0.4 : 1);
  const mx = p.x + Math.cos(p.ang) * 11, my = p.y + Math.sin(p.ang) * 11 - 1;
  const evo = !!w.evolve;
  const dmg = (w.dmg + st.flatDmg) * st.dmgMul * (evo ? st.scarMul : 1);
  const col = S.god ? '#ff6cf5' : (evo ? scarCol() : w.col);
  /* THE ROTISSERIE ignores the crosshair entirely and walks its own angle
     around you — that is the whole joke, and the whole reason to own it. */
  const aim = w.radial ? (p.spitAng = (p.spitAng || 0) + w.radial) : p.ang;
  // SPLIT rank n fires a fan of 2n+1 directions
  const dirs = st.split ? st.split * 2 + 1 : 1;
  const fan = 0.20;
  for (let d = 0; d < dirs; d++) {
    const off = dirs === 1 ? 0 : (d - (dirs - 1) / 2) * fan;
    for (let i = 0; i < w.pellets; i++) {
      const a = aim + off + rnd(-base, base);
      S.bul.push({
        x: mx, y: my, vx: Math.cos(a) * w.spd, vy: Math.sin(a) * w.spd,
        dmg, pierce: (w.pierce || 0) + st.pierce, hitIds: [], life: 1.4,
        col, size: (w.size || 1) + (evo && S.scarLv > 3 ? 1 : 0),
        knock: w.knock || 60, pin: w.pin || 0, burn: (w.burn || 0) + st.burn,
        bounce: (w.bounce || 0) + st.bounce, mark: w.mark || 0, chill: w.chill || 0,
        home: st.home || 0, spd: w.spd, god: S.god
      });
    }
  }
  p.recoil = Math.min(1, p.recoil + (w.pellets > 3 ? 0.7 : 0.24));
  p.kick = w.pellets > 3 ? 6 : w.charge ? 7 : 2.6;
  p.vx -= Math.cos(p.ang) * (w.knock ? w.knock * 0.28 : 12);
  p.vy -= Math.sin(p.ang) * (w.knock ? w.knock * 0.28 : 12);
  spray(mx, my, aim, '#ffd07a', w.pellets > 3 ? 14 : 5, 140, 0.18, 0.4);
  S.muzzle = { x: mx, y: my, t: 0.06, big: w.pellets > 3 || !!w.charge };
  shake(w.pellets > 3 ? 3.4 : w.charge ? 5.5 : S.god ? 1.4 : 1.0);
  if (w.charge) punch(0.05);
  if (S.god) A.godshoot();
  else if (evo) A.scarMk(S.scarLv);          // voice morphs toward a laser each mark
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
  S.beamHit = { x: ox, y: oy, ex, ey, girth };
  for (const e of hits) damageEnemy(e, (w.dmg + st.flatDmg * 8) * st.dmgMul / st.rateMul * dt, true, p.ang);
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
const MARK_MUL = 1.6;      // what THE PRICE GUN's tag is worth to everything else
function damageEnemy(e, dmg, fromBullet, ang, noRoll) {
  if (e.dead) return 0;
  const st = ST();
  let crit = false;
  if (!noRoll) {
    if (e.mark > 0) dmg *= MARK_MUL;
    if (st.crit > 0 && Math.random() < st.crit) { dmg *= st.critMul; crit = true; }
  }
  e.hp -= dmg;
  e.hit = crit ? 0.16 : 0.09;
  e.sq = Math.min(1, e.sq + dmg * 0.012);
  blood(e.x, e.y + 4, crit ? 9 : 5, 'rgba(90,10,16,0.4)');
  if (crit) {
    part(e.x, e.y, '#fff0c0', 10, 190, 0.35, 2);
    ring(e.x, e.y, 16, '#ffd070', 0.18, 1);
    A.hit();
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
  gainXP(e.boss ? 90 : Math.max(3, Math.round(e.score * 0.55)));
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
  /* OVERKILL and FLASHPOINT are both triggered BY a kill and both CAUSE kills.
     Fired inline they recurse — one death used to clear a room of 140 and put
     600 bullets on screen in a single frame. They go on a queue that drains a
     few at a time, once a frame, so a chain is a chain and not a stack. */
  if (st.overkill > 0) S.fx.push({ k: 'boom', x: e.x, y: e.y, r: 42, d: st.overkill * st.dmgMul });
  if (st.graze > 0 && S.p.hp > 0) S.p.hp = Math.min(st.maxhp, S.p.hp + st.graze);
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

    /* Elites and floor bosses both pay in a card you get to choose. That is
       the whole reason to fight one now — the groceries live in the deck. */
    const elite = !!e.mini;
    const coins = elite ? 10 : e.apex ? 38 : 18;
    for (let i = 0; i < coins; i++) {
      const a = rnd(0, TAU);
      S.drops.push({ x: e.x, y: e.y, kind: 'coin', t: 0, life: 40, bob: rnd(0, TAU), vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 });
    }
    if (Math.random() < (elite ? 0.20 : e.apex ? 1 : 0.55)) dropPickup(e.x + 8, e.y, 'card');
    dropPickup(e.x - 10, e.y, 'nade');
    if (!elite) dropPickup(e.x + 18, e.y, 'shield');

    /* A guaranteed hand, dealt at better odds the bigger the thing was. */
    S.upgPts++;
    S.pendingLuck = elite ? 0.5 : e.apex ? 2.4 : 1.2;
    S.lvlDelay = 1.1;

    S.bossKills++;
    if (S.bossKills % SHOP_EVERY === 0) S.shopDue = true;
    /* Only a FLOOR boss opens the top of the deck — elites do not count. */
    if (!elite) {
      S.floorBosses++;
      if (e.apex) S.apexKills++;
      bump('bosses'); if (e.apex) bump('apex');
      float(e.x, e.y - 44, 'THE DECK OPENS', '#ffb03a', true);
    }
    checkContracts();
    msg(e.name + ' IS MEAT', elite ? 'an elite. the deck opens.'
        : e.apex ? 'the apex is down. take something obscene.' : 'the floor is yours. pick a card.', 3);
    if (S.shopDue) float(e.x, e.y - 30, 'A DOOR OPENS SIDEWAYS', '#c05cff', true);
    A.roar();
  } else {
    /* Med kits used to be a 6% drop on top of two guaranteed ones every wave,
       which meant health was never actually a resource. */
    const r = Math.random() / st.lootMul;
    if (r < 0.008) dropPickup(e.x, e.y, 'card');        // cards: genuinely rare
    else if (r < 0.021) dropPickup(e.x, e.y, 'nova');   // the rarer of the two new ones
    else if (r < 0.056) dropPickup(e.x, e.y, 'shield');
    else if (r < 0.216) dropPickup(e.x, e.y, 'coin');   // coins: reasonably common
    else if (r < 0.276) dropPickup(e.x, e.y, 'ammo');
    else if (r < 0.308) dropPickup(e.x, e.y, 'med');    // 3.2%, down from 6%
    else if (r < 0.338) dropPickup(e.x, e.y, 'nade');
  }
  if (S.kills % 25 === 0) { bump('kills', 25); checkContracts(); }
}

/* Shared by the NOVA pickup and the FLASHPOINT card. */
function fireNova(x, y) {
  const st = ST(), N = 26;
  for (let k = 0; k < N; k++) {
    const a = k / N * TAU + Math.random() * 0.1;
    S.bul.push({
      x, y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
      dmg: 90 * st.dmgMul, pierce: 2 + st.pierce, hitIds: [], life: 2.6,
      col: '#ffb03a', size: 3, knock: 180, pin: 0, burn: 12 + st.burn, bounce: st.bounce,
      mark: 0, chill: 0, god: S.god, home: 5.5, spd: 340
    });
  }
  float(x, y - 18, 'NOVA', '#ffb03a', true);
  ring(x, y, 64, '#ffb03a', 0.4, 2);
  part(x, y, '#fff0a8', 40, 200, 0.7, 2);
  shake(9); punch(0.05); S.flash = Math.max(S.flash, 0.45); S.flashCol = '#ffcf8a';
  A.boom();
}

function hurtPlayer(dmg, sx, sy) {
  const p = S.p;
  if (S.god || p.iframe > 0 || p.tempShield > 0 || S.mode !== 'play') return;
  const stp = ST();
  /* AEGIS PLATING: sometimes the hit just doesn't land. */
  if (stp.dodge > 0 && Math.random() < stp.dodge) {
    p.iframe = 0.3;
    float(p.x, p.y - 14, 'PLATED', '#7fd0ff');
    part(p.x, p.y, '#c6e8ff', 10, 90, 0.35);
    A.hit();
    return;
  }
  dmg *= stp.resist;
  if (p.shield > 0) {
    p.shield--; p.shieldT = ST().shieldCd; p.iframe = 0.45;
    part(p.x, p.y, '#63b04a', 16, 130, 0.5);
    ring(p.x, p.y, 22, '#63b04a', 0.3, 2);
    float(p.x, p.y - 14, 'RIND', '#63b04a');
    A.hit(); shake(4);
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
  /* SECOND HELPING: one refusal per floor, per rank. */
  if (p.hp <= 0 && S.savesLeft > 0) {
    S.savesLeft--;
    p.hp = Math.round(stp.maxhp * 0.30);
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
    const apex = isApexFloor(S.room);
    spawnBoss(bossIndexFor(S.room), apex);
    for (let i = 0; i < Math.round(4 + n * 0.9 + S.room * 3.5); i++) S.queue.push(pick(['crawler', 'crawler', 'shrieker']));
    msg('WAVE ' + n, apex ? 'APEX' : 'FLOOR BOSS', 2.4);
  } else if (MINI_WAVES.indexOf(n) >= 0) {
    spawnMini(S.room * MINI_WAVES.length + MINI_WAVES.indexOf(n));
    for (let i = 0; i < Math.round(6 + n * 1.4 + S.room * 3); i++) S.queue.push(pick(['crawler', 'crawler', 'shrieker', 'stalker']));
    msg('WAVE ' + n, 'ELITE', 2.4);
  } else {
    // Head count, not a spend budget — a budget buys fewer/tougher enemies as it
    // grows, which is backwards. This grows quadratically across a floor and is
    // multiplied again for every floor down and every evolution.
    // Every gun you own is another mouth the floor sends to meet it.
    const armed = 1 + Math.max(0, S.p.owned.length - 1) * 0.10;
    const levelled = 1 + Math.max(0, S.level - 1) * 0.06;   // the stronger you get, the more come
    // gentler inside a floor, much steeper between them
    const count = Math.round((7 + n * 2.6 + n * n * 0.26) * (1 + S.room * 0.72)
                             * (1 + (S.evo | 0) * 0.12) * armed * levelled * ST().swarm);
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
    const cap = Math.min(95, Math.round(18 + S.wave * 1.3 + S.room * 9.5 + (S.evo | 0) * 2 +
                                        Math.max(0, S.p.owned.length - 1) * 1.5 +
                                        Math.max(0, S.level - 1) * 0.8));
    /* Cracks take 0.75s to hatch but batches fire every 0.15s, so counting only
       what is already breathing lets a deep floor put five batches in the air
       before the cap notices — floor 14 was landing 159 against a cap of 78.
       Count what is on its way as well. */
    if (S.spawnT <= 0 && S.queue.length && S.en.length + S.cracks.length < cap) {
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
      const heal = S.wave === BOSS_WAVE ? 30 : 12;
      S.p.hp = Math.min(ST().maxhp, S.p.hp + heal);
      S.p.nades = Math.min(9, S.p.nades + 1 + dkc('munitions'));
      S.score += 100 * S.wave * (S.room + 1);
      persist();
      if (S.wave >= 10) {
        S.door.open = true;
        msg('THE DOOR IS OPEN', 'go north. it is worse down there.', 4);
        A.doorOpen();
      } else {
        msg('WAVE ' + S.wave + ' CLEARED', '+' + (100 * S.wave * (S.room + 1)) + ' // +' + heal + ' hp // +1 frag', 2.2);
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
      // a shop owed by the boss you just killed comes before anything else
      if (S.shopDue) { S.shopDue = false; enterShop(); }
      else if (S.wave < 10) startWave(S.wave + 1);
    }
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
  if (S.mode !== 'play') { updateCam(rdt); return; }

  const p = S.p, st = ST(), w = curW();

  /* The hand is dealt from here rather than from gainXP, so a boss can add its
     guaranteed pick and its luck bonus before the cards are turned over. */
  if (S.upgPts > 0) {
    S.lvlDelay -= rdt;
    if (S.lvlDelay <= 0 && !S.fadeDir) { openLevelUp(S.pendingLuck); S.pendingLuck = 0; }
  }

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
    if (p.reT <= 0) { p.mags[w.id] = magCap(w); p.reT = 0; }
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
      /* PACI is not an enemy and has no health bar. He is a very large man
         standing in his own shop, and rounds do land on him. */
      if (S.paci && S.paci.anger < 2 &&
          Math.abs(b.x - S.paci.x) < 34 && b.y > S.paci.y - 46 && b.y < S.paci.y + 48) {
        angerPaci(b.x, b.y);
        S.bul.splice(i, 1); removed = true; break;
      }
      for (const e of S.en) {
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
    /* COLD SNAP, FREEZER BURN and THE WALK-IN all turn the same dial, and a
       PRICE GUN tag times out on its own. */
    e.mark = Math.max(0, e.mark - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    let sl = e.slowT > 0 ? e.slowAmt : 0;
    if (st.aura > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 66) sl = Math.max(sl, st.aura);
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
    else if (dd < 40 * ST().magnet && !perm) { d.x += (p.x - d.x) * dt * 6; d.y += (p.y - d.y) * dt * 6; }
    if (dd < 12) {
      if (d.kind === 'ammo') { p.mags[curW().id] = magCap(curW()); p.reT = 0; float(p.x, p.y - 16, 'AMMO', '#f2d14a'); A.pickup(); }
      else if (d.kind === 'med') { p.hp = Math.min(ST().maxhp, p.hp + 26); float(p.x, p.y - 16, '+26 HP', '#ff6b6b'); A.pickup(); }
      else if (d.kind === 'nade') { p.nades = Math.min(9, p.nades + 1); float(p.x, p.y - 16, '+1 FRAG', '#7aa35e'); A.pickup(); }
      else if (d.kind === 'coin') {
        S.coinFrac += ST().coinMul;
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
      else if (d.kind === 'nova') fireNova(p.x, p.y);
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
      else explode(f.x, f.y, f.r, f.d, '#ff6a72');
    }
    if (S.fx.length > 12) S.fx.length = 12;    // a runaway chain still has to end
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
      for (let i = 0; i < adds; i++) {
        const q = freeSpot(90);
        S.cracks.push({ x: q.x, y: q.y, t: 0.75, type: pick(['crawler', 'stalker', 'shrieker']) });
      }
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
  S.luck = dkc('clearance') / 100 + (contractDone('grade') ? 1 : 0);
}

function startRun() {
  freshState();
  S.mode = 'play';
  buildRoom(0);
  S.p = makePlayer();
  S.cam.cx = S.p.x; S.cam.cy = S.p.y;
  recalcLuck();
  /* Signed contracts pay out here, at the top of the run. */
  if (contractDone('dozen')) { S.level = 2; S.upgPts = 1; S.lvlDelay = 2.6; }
  if (contractDone('hoard')) { S.coins += 60; persist(); }
  A.init();
  A.setDread(0.2);
  if (A.music) { A.music.setFloor(0); A.music.setBoss(false); A.music.setIntensity(0.15); A.music.start(); }
  msg(roomDef(0).name, roomDef(0).sub, 3.4);
  setTimeout(() => { if (S.mode === 'play' && S.wave === 0) startWave(1); }, 2200);
  setTimeout(() => { if (S.mode === 'play') msg('', 'something breathes inside the north wall.', 4); }, 6200);
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
    S.peels.length = 0; S.gibs.length = 0; S.part.length = 0; S.cracks.length = 0;
    S.nades.length = 0; S.props.length = 0; S.rings.length = 0;
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
    setTimeout(() => { if (S.mode === 'play' && S.wave === 0) startWave(1); }, 2600);
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

  drawPaci();
  drawTomce();
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
    const pu = 1 + Math.sin(S.t * 15 + b.bob) * 0.13;
    ctx.fillStyle = 'rgba(4,0,2,0.62)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * pu + 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * pu + 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff4e2';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, TAU); ctx.fill();
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
      // a slow ring of sparks, one per grade above PRIME
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
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = 'rgba(4,2,6,' + (S.god ? 0.55 : R.dark) + ')';
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';

  const z = S.cam.z;
  const ps = worldToScreen(S.p.x, S.p.y);

  const sight = ST().sight;                 // CATARACT and SLEEPLESS close this in
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
  for (const d of S.drops) if (d.kind === 'item' || d.kind === 'god' || d.kind === 'card') blob(d.x, d.y, 46, 0.9);
  for (const sh of S.shops) if (!sh.bought) blob(sh.x, sh.y - 12, 52, 0.85);
  if (S.paci) blob(S.paci.x, S.paci.y, 120, 0.95);
  if (S.tomce) blob(S.tomce.x, S.tomce.y, 34 + S.tomce.near * 40, 0.35 + S.tomce.near * 0.5);
  if (S.corner && (S.corner.found || S.corner.pulse > 0.15)) blob(S.corner.x, S.corner.y, 40, S.corner.found ? 0.8 : S.corner.pulse * 0.7);
  if (S.door.open) blob(S.door.x + S.door.w / 2, S.door.y + S.door.h, 70, 0.9);
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

  /* GLUSEC — three seconds of the base rifle being reforged. The text cycles
     hue continuously and each line lags the other so they never match.
     It sits low: a new floor also fires msg() and the item banner, and all
     three used to stack on the middle of the screen. */
  if (S.glusec > 0) {
    const a = clamp(S.glusec / 0.6, 0, 1);
    const h1 = (S.t * 210) % 360, h2 = (h1 + 140) % 360;
    const c1 = 'hsl(' + h1 + ',95%,66%)', c2 = 'hsl(' + h2 + ',95%,70%)';
    /* 197..227 is the only clear strip down here: the pickup banner ends at
       H/2+61 and the grocery shelf starts around H-42. */
    const gy0 = 197;
    ctx.fillStyle = 'rgba(6,3,10,' + (a * 0.6) + ')';
    ctx.fillRect(0, gy0, W, 30);
    ctx.fillStyle = c1; ctx.globalAlpha = a * 0.8;
    ctx.fillRect(0, gy0, W, 1); ctx.fillRect(0, gy0 + 29, W, 1);
    ctx.globalAlpha = 1;
    htxt('THE POWER OF GLUSEC COMPELS YOU', W / 2, gy0 + 13, c1, 'center', 13.5,
         { weight: '700', alpha: a, glow: c2, glowSize: 30, track: 0.14 });
    htxt('YOUR BASE GUN IS UPGRADED', W / 2, gy0 + 24, c2, 'center', 8.5,
         { weight: '700', alpha: a, glow: c1, glowSize: 20, track: 0.24 });
    htxt(scarName() + '  +' + Math.round((ST().scarMul - 1) * 100) + '%',
         W - 8, gy0 + 24, scarCol(), 'right', 7.5, { alpha: a, track: 0.10 });
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

  /* wave / room */
  txt(R.name, W / 2, 12, '#8e7a68', 'center');
  if (S.inShop) {
    txt('SPEND SOMETHING', W / 2, 22, '#c8a8e0', 'center');
    txt('leave through the door at the bottom', W / 2, 32, 'rgba(160,130,190,0.75)', 'center', 7);
  } else {
    txt(S.waveState === 'idle' ? 'PREPARING' : 'WAVE ' + S.wave + '/10', W / 2, 22,
        S.wave === BOSS_WAVE ? '#ff3b46' : MINI_WAVES.indexOf(S.wave) >= 0 ? '#ff8a3a' : '#c0ac96', 'center');
    for (let i = 1; i <= 10; i++) {
      ctx.fillStyle = i < S.wave ? '#8a2a2e' : i === S.wave ? '#ff3b46' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(W / 2 - 30 + (i - 1) * 6, 26, 4, 2);
    }
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
    const spr = b.scar ? SPR.pistol : b.wep ? WEP[b.wep].spr : b.key === 'god' ? SPR.eye : ITEMS[b.key].spr;
    drawSpr(ctx, spr, W / 2 - 84, H / 2 + 40, b.wep || b.scar ? 2 : 1.8, false, 1, b.scar ? col : null);
    const nm = b.scar ? scarName() : b.wep ? WEP[b.wep].name : b.key === 'god' ? 'THE THIRD EYE OF DAMJAN' : ITEMS[b.key].n[Math.min(b.lv - 1, 1)];
    const de = b.scar ? ('the sidearm reforged — +' + Math.round((ST().scarMul - 1) * 100) + '% damage')
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
  // the very large man
  if (S.paci) {
    ctx.fillStyle = '#c05cff';
    ctx.fillRect(gx(S.paci.x) - 3, gy(S.paci.y) - 3, 6, 6);
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
     doing the work that letter-spacing was doing for Pixelify Sans.

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

  /* If a requested typeface is not in fonts/, say so here rather than quietly
     rendering the fallback and letting it pass for the real thing. */
  const missing = fontMissing();
  if (missing.length)
    htxt('typeface not found in fonts/ — ' + missing.join(', '), W / 2, H - 6,
         '#6a4a4a', 'center', 6, { track: 0.12 });

  // the title screen shows him before any of it happened
  drawSpr(ctx, bodySprite(0), W / 2, 104, 2.2);
  drawSpr(ctx, legSprite(0, 0), W / 2, 127.1, 2.2);   // 2.2 * (16/2 + 5/2) below the body centre
  drawSprRot(ctx, SPR.pistol, W / 2 + 4, 112, 0.15, 2, 2, 3, false);
  if (cosDef(equippedCos()).fx === 'fire' && Math.random() < 0.8)
    part(W / 2 + rnd(-10, 10), 88, pick(['#ff8a20', '#ffd05a']), 1, 30, 0.5);
  for (const q of S.part) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s); }
  ctx.globalAlpha = 1;
  updateParticles(1 / 60);

  const evoCost = EVO_COST(S.evo | 0);
  const signed = CONTRACTS.filter(c => contractDone(c.id)).length;
  uiBtn(W / 2 - 150, 150, 96, 22, 'PLAY', '#e8b25a', () => startRun());
  uiBtn(W / 2 - 48, 150, 96, 22, 'COSMETICS', '#b558ff', () => { S.cosReturn = 'title'; S.mode = 'cos'; });
  uiBtn(W / 2 + 54, 150, 96, 22, 'EVOLVE ' + (S.evo | 0), '#ff4a54', () => evolve(), !canEvolve());
  if (S.evo | 0) {
    uiBtn(W / 2 - 100, 176, 96, 16, 'CONTRACTS', '#f0c65a', () => { S.cosReturn = 'title'; S.mode = 'contracts'; });
    uiBtn(W / 2 + 4, 176, 96, 16, 'RESET EVO', '#7fe08a', () => resetEvolution());
  } else {
    uiBtn(W / 2 - 48, 176, 96, 16, 'CONTRACTS', '#f0c65a', () => { S.cosReturn = 'title'; S.mode = 'contracts'; });
  }

  statRow([
    { spr: SPR.coin, v: String(S.coins), col: '#f5c518' },
    { spr: SPR.card, v: S.cards + '/' + OMEGA_CARDS, sc: 0.6, col: '#d8b8b8' },
    { v: 'CONTRACTS ' + signed + '/' + CONTRACTS.length, col: signed ? '#ffb03a' : '#6b5a4e' },
    { v: 'EVO ' + (S.evo | 0) + ' / NEXT ' + evoCost, col: canEvolve() ? '#ff6a72' : '#6b5a4e' }
  ], 204);

  const sv = loadSave();
  const y0 = 218;
  htxt('BEST ' + (sv.best || 0) + '   ·   DEEPEST FLOOR ' + (sv.deep || 1) +
       (sv.godFound ? '   ·   EYE' : '') + (sv.modagaz ? '   ·   MODAGAZ x' + sv.modagaz : '') +
       (sv.goro ? '   ·   GOROMANIA' : ''), W / 2, y0, '#6d5c4e', 'center', 7.5, { track: 0.12 });
  htxt('WASD move · MOUSE aim · LMB fire · RMB frag · WHEEL swap · R reload · E buy',
       W / 2, y0 + 13, '#7e6d5f', 'center', 7.5, { track: 0.06 });
  htxt('ENTER play · C cosmetics · B the menu · ESC pause · M mute',
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
    htxt('guns ' + S.p.owned.length + '/' + WORDER.length + '  ·  cards ' + S.cardsTaken +
         '  ·  level ' + S.level + (S.god ? '  ·  THE EYE' : '') + '  ·  best ' + (sv.best || 0) +
         '  ·  EVO ' + (S.evo | 0) + ' / NEXT ' + evoCost,
         W / 2, 142, '#5f5044', 'center', 7, { track: 0.10 });

    /* The nearest unsigned contract, so there is always one visible reason to
       press RETRY rather than close the tab. */
    const open = CONTRACTS.filter(c => !contractDone(c.id))
                          .sort((a, b) => cStat(b.stat) / b.goal - cStat(a.stat) / a.goal)[0];
    if (open) {
      const have = Math.min(cStat(open.stat), open.goal);
      htxt('NEXT CONTRACT  ·  ' + open.name + '  ' + have + '/' + open.goal + '  →  ' + open.u,
           W / 2, 152, '#a8905c', 'center', 7, { track: 0.06 });
    } else {
      htxt('every contract signed. there is still no bottom.', W / 2, 152, '#a8905c', 'center', 7, { track: 0.06 });
    }

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

/* A card face, drawn the same way on the level-up hand and in THE MENU. */
function cardFace(o, x, y, cw, ch, t, held) {
  const c = o.c, g = GRADE[o.g], ai = AISLES[c.aisle];
  const off = t * 3;
  const yy = y - off;

  ctx.fillStyle = 'rgba(' + Math.round(9 + t * 22) + ',' + Math.round(8 + t * 20) + ',' + Math.round(11 + t * 24) + ',0.95)';
  ctx.fillRect(x, yy, cw, ch);
  // the grade's own light, pooled at the top of the card
  if (g.glow > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(x, yy, x, yy + ch);
    lg.addColorStop(0, g.col); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (0.05 + g.glow / 28 * 0.13) * (0.55 + t * 0.75);
    ctx.fillStyle = lg; ctx.fillRect(x, yy, cw, ch);
    ctx.restore();
  }
  // aisle colour down the left edge, grade colour across the top
  ctx.fillStyle = ai.col; ctx.globalAlpha = 0.55 + t * 0.45;
  ctx.fillRect(x, yy, 2, ch);
  ctx.fillStyle = g.col; ctx.globalAlpha = 0.7 + t * 0.3;
  ctx.fillRect(x, yy, cw, 2);
  ctx.globalAlpha = 0.20 + t * 0.5;
  ctx.fillRect(x, yy + ch - 1, cw, 1); ctx.fillRect(x + cw - 1, yy, 1, ch);
  ctx.globalAlpha = 1;

  htxt(g.n, x + cw / 2, yy + 12, g.col, 'center', 6.5,
       { track: 0.30, glow: o.g >= 2 ? g.col : null, glowSize: g.glow * 0.5 });

  if (c.sig) drawSpr(ctx, ITEMS[c.sig].spr, x + cw / 2, yy + 28, 1.5);
  const nm = cardName(c);
  const nsz = nm.length > 14 ? 9 : nm.length > 10 ? 10.5 : 12;
  htxt(nm, x + cw / 2, yy + (c.sig ? 48 : 38), t > 0.4 ? '#ffffff' : ai.col, 'center', nsz,
       { weight: '700', glow: t > 0.15 ? ai.col : null, glowSize: 15 * t, track: 0.06 });

  const ey = yy + (c.sig ? 60 : 52);
  const lines = wrapped(cardLine(c, o.val), x + cw / 2, ey, cw - 14, '#a89a8c', 7.5);

  const rank = dkr(c.id);
  /* What you already hold, printed under what this pick adds. It wraps too — a
     fully stacked RAW NERVE is a long sentence. */
  if (held && rank && !c.sig)
    wrapped('held: ' + cardLine(c, dk(c.id)), x + cw / 2, ey + lines * 9 + 4, cw - 12,
            'rgba(176,158,138,0.8)', 6.5);

  htxt(ai.n, x + cw / 2, yy + ch - 16, 'rgba(150,136,124,0.7)', 'center', 6, { track: 0.24, noShadow: true });
  for (let j = 0; j < c.max; j++) {
    ctx.fillStyle = j < rank ? ai.col : 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + cw / 2 - c.max * 3 + j * 6, yy + ch - 10, 4, 3);
  }
}

/* Two lines, centred, broken on a space. Card copy is short but not that short. */
function wrapped(str, cx, y, maxw, col, size) {
  const words = String(str).split(' ');
  let line = '', out = [];
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (htxtWidth(t, size, 0.03) > maxw && line) { out.push(line); line = wd; } else line = t;
  }
  if (line) out.push(line);
  out = out.slice(0, 3);
  out.forEach((l, i) => htxt(l, cx, y + i * 9, col, 'center', size, { track: 0.03, noShadow: true }));
  return out.length;
}

function drawLevelUp() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(4,3,6,0.90)'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, 200);
  bg.addColorStop(0, 'rgba(120,40,150,0.15)'); bg.addColorStop(1, 'rgba(120,40,150,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('THE MENU', W / 2, 34, '#e8d2a4', 'center', 24,
       { weight: '700', glow: '#5a2a6a', glowSize: 20, track: 0.20 });
  htxt('LEVEL ' + S.level + (S.upgPts > 1 ? '  ·  ' + S.upgPts + ' PICKS LEFT' : '  ·  TAKE ONE'),
       W / 2, 48, '#8d7f92', 'center', 8, { track: 0.24 });

  const hand = S.hand || [];
  const CW = hand.length > 3 ? 104 : 116, gap = 10, CH = 118;
  const x0 = W / 2 - (CW * hand.length + gap * (hand.length - 1)) / 2;
  hand.forEach((o, i) => {
    const x = x0 + i * (CW + gap), y = 62;
    const hot = mouse.x > x && mouse.x < x + CW && mouse.y > y - 4 && mouse.y < y + CH;
    const k = 'card' + i + o.c.id;
    hoverT[k] = clamp((hoverT[k] || 0) + (hot ? 0.22 : -0.18), 0, 1);
    cardFace(o, x, y, CW, CH, hoverT[k], true);
    S.ui.push({ x, y: y - 4, w: CW, h: CH, fn: () => takeCard(o) });
  });

  /* Rerolling is the only thing coins do during a fight, which keeps them
     worth picking up between shops. */
  const rc = rerollCost(), can = S.coins >= rc;
  uiBtn(W / 2 - 66, H - 32, 132, 18, 'REROLL  ' + rc, can ? '#f5c518' : '#6b5a4e', () => rerollHand(), !can);
  htxt('LUCK ' + (Math.round((S.luck + S.lvlLuck) * 10) / 10) + '   ·   ' + S.coins + ' coins   ·   ' +
       'SELECT → CHOICE → PRIME → BLACK LABEL',
       W / 2, H - 8, 'rgba(126,114,124,0.7)', 'center', 7, { track: 0.10, noShadow: true });
  crosshair();
}

/* THE MENU, read-only: everything the run has picked up so far. */
function drawDeck() {
  S.ui = []; uiWipe();
  ctx.fillStyle = 'rgba(5,4,7,0.92)'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, 16, 6, W / 2, 16, 200);
  bg.addColorStop(0, 'rgba(120,40,150,0.13)'); bg.addColorStop(1, 'rgba(120,40,150,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  htxt('THE MENU', 22, 22, '#e8d2a4', 'left', 17, { weight: '700', glow: '#5a2a6a', glowSize: 14, track: 0.22 });
  htxt('LEVEL ' + S.level + '  ·  ' + S.cardsTaken + ' cards  ·  LUCK ' + (Math.round(S.luck * 10) / 10),
       W - 22, 22, '#9d8a7a', 'right', 8, { track: 0.10 });

  /* Two columns of aisles, each aisle a heading and its cards under it. */
  let col = 0, y = 38;
  const colX = [22, 250], colW = 208;
  for (const key of AISLE_ORDER) {
    const held = CARDS.filter(c => c.aisle === key && dkr(c.id) > 0);
    if (!held.length) continue;
    const need = 11 + held.length * 11;
    if (y + need > H - 24 && col === 0) { col = 1; y = 38; }
    const ai = AISLES[key], x = colX[col];
    htxt(ai.n, x, y, ai.col, 'left', 8, { track: 0.26 });
    const lw = htxtWidth(ai.n, 8, 0.26);
    ctx.fillStyle = ai.col; ctx.globalAlpha = 0.22;
    ctx.fillRect(x + lw + 6, y - 3, colW - lw - 6, 1);
    ctx.globalAlpha = 1;
    y += 11;
    for (const c of held) {
      const d = S.deck[c.id];
      if (c.sig) drawSpr(ctx, ITEMS[c.sig].spr, x + 6, y - 2, 0.8);
      htxt(cardName(c), x + (c.sig ? 15 : 4), y + 1, GRADE[d.g | 0].col, 'left', 7.5, { track: 0.04 });
      htxt(cardLine(c, d.amt), x + colW - 2, y + 1, 'rgba(150,134,120,0.9)', 'right', 6.5,
           { track: 0.02, noShadow: true });
      y += 11;
    }
    y += 5;
  }
  if (!S.cardsTaken) htxt('nothing yet. go and level up.', 22, 52, '#5f5044', 'left', 8);

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

  /* Buttons live in a centred row under the title. Cornering them put the wide
     ones straight through PAUSED, and the keyboard hints they used to sit
     beside are on the title screen where you actually read them. */
  const btns = [['THE MENU', '#f0c65a', () => { S.mode = 'deck'; }],
                ['COSMETICS', '#b558ff', () => { S.cosReturn = 'pause'; S.mode = 'cos'; }]];
  if (S.evo | 0) btns.push(['RESET EVO', '#7fe08a', () => resetEvolution()]);
  const bw = 96, gap = 8, rowW = btns.length * bw + (btns.length - 1) * gap;
  btns.forEach((b, i) => uiBtn(W / 2 - rowW / 2 + i * (bw + gap), 40, bw, 18, b[0], b[1], b[2]));

  let y = 76;
  sectionRule('SIGNATURE CARDS', y);
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
  if (!any) { htxt('none yet. they are the rarest cards in the deck.', 38, y + 1, '#5f5044', 'left', 7.5); y += 12; }

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
    htxt(w.evolve ? scarName() : w.name, cx + 28, ry + 2,
         has ? (w.evolve ? scarCol() : GRADE[w.gr].col) : '#4a3f36', 'left', 8, { track: 0.06 });
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

  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  octx.clearRect(0, 0, ov.width, ov.height);

  if (S.mode === 'title') drawTitle();
  else if (S.mode === 'cos') drawCosmetics();
  else if (S.mode === 'contracts') drawContracts();
  else {
    drawWorld();
    drawLight();
    post();
    drawHUD();
    if (S.mode === 'pause') drawPause();
    if (S.mode === 'deck') drawDeck();
    if (S.mode === 'levelup') drawLevelUp();
    if (S.mode === 'augment') drawAugments();
    if (S.mode === 'dead') drawDead();
  }

  if (S.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(S.fade, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); }
  requestAnimationFrame(frame);
}

/* ---------- presentation: never render below 200% ---------- */
function fitCanvas() {
  const sx = window.innerWidth / W, sy = window.innerHeight / H;
  /* Steps of RS, not of 1: the backing store is already RS times the logical
     grid, so only multiples of RS land one render pixel on a whole number of
     screen pixels. Anything else reintroduces the shimmer this was fixing. */
  const scale = Math.max(RS, Math.floor(Math.min(sx, sy) / RS) * RS);
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
                giveWeapon, explode, triggerModagaz, triggerGoromania,
                evolve, resetEvolution, canEvolve, EVO_COST, OMEGA_CARDS,
                gainXP, openLevelUp, takeCard, dealCards, rerollHand, scarName, scarCol, ST,
                ITEMS, BOSSES, WEP, WORDER, COSMETICS, frame, nextRoom,
                enterShop, exitShop, shopStock, shopSlots, roomDef, curRoom, buildRoom,
                CARDS, CARD_BY_ID, AISLES, GRADE, rollGrade, cardVal, dk, dkr, recalcLuck,
                CONTRACTS, cStat, bump, bumpMax, contractDone, checkContracts,
                AUGMENTS, ag, dealAugments, openAugments, takeAugment, refuseAugments,
                spawnMini, MINIS, BOSS_WAVE, MINI_WAVES, isApexFloor, bossIndexFor,
                magCap, fireNova, SHOP_EVERY, diff, killEnemy, damageEnemy,
                angerPaci, hurtStage, bodySprite, legSprite, shred, hurtPlayer, RS };

})();
