/* ============================================================
   MEAT PROTOCOL - pixel sprite bank
   Every sprite is hand-plotted. '.' = transparent.
   Colors resolve from PAL, overridden per-sprite by spr.pal
   ============================================================ */
const PAL = {
  '.': null,
  'o': '#0a0609',   // universal outline
  'h': '#2b1a13', 'H': '#3d2718',      // hair
  'r': '#c9232c', 'R': '#7c1219', 'w': '#e8dcc8',  // HEADBAND
  's': '#c9926a', 'S': '#a06f4a',      // skin
  'e': '#efe6d4', 'p': '#0f0a0d',      // eye / pupil
  'm': '#5e2626',
  'j': '#31483a', 'J': '#1d2c24',      // jacket
  'b': '#4a3421',                       // strap
  'n': '#242833', 'N': '#171a23',      // pants
  't': '#120f10',                       // boots
  'g': '#565c66', 'G': '#31363d',      // gunmetal
  'y': '#f2d14a', 'Y': '#b2911f',      // brass / banana
  'l': '#ff2b2b',
  'f': '#c09292', 'F': '#8e6666', 'k': '#4a2a2a',  // pale flesh
  'v': '#8a3540', 'V': '#4e1e26',      // meat red
  'c': '#9fb08a', 'C': '#68785a',      // sick green
  'u': '#ded8c6', 'U': '#a8a294',      // bone
  'x': '#ff4242',                       // glow eye
  'q': '#1a1c22',
  'B': '#2e2013',                       // dark wood
  'z': '#4fd6e8', 'Z': '#1c7f92',      // plasma
  'i': '#a8e8ff',                       // rail glow
  'M': '#c05cff', 'W': '#6a2aa8'       // omega
};

function SPRITE(rows, pal) { return { rows, w: Math.max(...rows.map(r => r.length)), h: rows.length, pal: pal || null }; }

const SPR = {};

/* ---------- DAMJAN (body, headband, no legs) 16x15 ---------- */
SPR.body = SPRITE([
  '.....oooooo.....',
  '...oohhhhhhoo...',
  '..ohhhhhhhhhho..',
  '..oHhhhhhhhhHo..',
  '..orrrrrrrrrro..',
  '..oRrwrrrrwrRo..',
  '..osssssssssso..',
  '..osepsssspeso..',
  '..osssssssssso..',
  '..osssmmmmssso..',
  '...osssssssso...',
  '.ojjjjjjjjjjjjo.',
  '.ojjjjbbbbjjjjo.',
  '.ojjjjjjjjjjjjo.',
  '.ojjjjjjjjjjjjo.',
  '.oJJJJJJJJJJJJo.'
]);
/* 4-frame walk cycle: passing -> wide stride -> crossed -> wider stride.
   Played 0,1,2,3 it gives Damjan a bouncy, over-committed run. */
SPR.legs = [
  SPRITE([
    '....nnnnnnnn....',
    '....nnn..nnn....',
    '....nnn..nnn....',
    '....ttt..ttt....',
    '....ttt..ttt....'
  ]),
  SPRITE([
    '....nnnnnnnn....',
    '...nnn....nnn...',
    '...nnn....nnn...',
    '...ttt....ttt...',
    '..ttt......ttt..'
  ]),
  SPRITE([
    '....nnnnnnnn....',
    '.....nnnnnn.....',
    '.....nnnnnn.....',
    '.....tttttt.....',
    '.....tttttt.....'
  ]),
  SPRITE([
    '....nnnnnnnn....',
    '..nnn......nnn..',
    '..nnn......nnn..',
    '..ttt......ttt..',
    '.ttt........ttt.'
  ])
];
SPR.legsA = SPR.legs[0];
SPR.legsB = SPR.legs[1];

/* ---------- SCAR rifle w/ laser module 16x6 (points +X) ---------- */
SPR.scar = SPRITE([
  '.........ggggg..',
  '..gggggggggggggl',
  '..gGGGgggggggg..',
  '..GGgggGGGgg....',
  '...GG..GGG......',
  '....GG..........'
]);

/* ---------- THE ARSENAL (all 16x6, muzzle points +X) ---------- */
SPR.saw = SPRITE([          // MEAT SPLITTER
  '.......ggggg....',
  '..bbbbbgggggggg.',
  '..bbbbbGGgggggg.',
  '..BBbbbGGGgg....',
  '...BB..GGG......',
  '....BB..........'
]);
SPR.nail = SPRITE([         // THE STAPLER
  '......yyyyyyy...',
  '..ggggyyyyyyyygl',
  '..gGGGyyyyyyyy..',
  '..GGgggYYYgg....',
  '...GG..YYY......',
  '....GG..........'
]);
SPR.micro = SPRITE([        // MICROWAVE
  '.......zzzzzz...',
  '..gggggzZzZzZzzz',
  '..gGGGgzzzzzzz..',
  '..GGgggZZZzz....',
  '...GG..ZZZ......',
  '....GG..........'
]);
SPR.hog = SPRITE([          // THE HOG
  '.....GGGGGGGGGG.',
  '..gggggggggggggg',
  '..gGGGgGGGGGGGGG',
  '..GGgggggggggggg',
  '...GG..GGGGGGGG.',
  '....GG..........'
]);
SPR.rail = SPRITE([         // GOD FINGER
  '....iiiiiiiiiiii',
  '..ggggggggggggg.',
  '..gGGGgggggggg..',
  '..GGgggGGGgg....',
  '...GG..GGG......',
  '....GG..........'
]);
SPR.omega = SPRITE([        // OMEGA BEAM
  '......MMMMMMMM..',
  '..gggMWMWMWMWMMM',
  '..gGGGMMMMMMMM..',
  '..GGgggWWWMM....',
  '...GG..WWW......',
  '....GG..........'
]);

SPR.mag = SPRITE([
  '.ooo.',
  'oGGGo',
  'oGgGo',
  'oGGGo',
  'oGgGo',
  'oGGGo',
  '.ooo.'
]);

/* ---------- PROPS & CURRENCY ---------- */
SPR.grenade = SPRITE([
  '..oyyo..',
  '..oGGo..',
  '.oGgGGo.',
  'oGgGGGGo',
  'oGGGGGGo',
  'oGGGGGGo',
  '.oGGGGo.',
  '..oooo..'
], { G: '#3f5a34', g: '#7aa35e', y: '#c9a227' });

SPR.coin = SPRITE([
  '..oooo..',
  '.oyyyyo.',
  'oyyYYyyo',
  'oyYyyYyo',
  'oyYyyYyo',
  'oyyYYyyo',
  '.oYYYYo.',
  '..oooo..'
], { y: '#f5c518', Y: '#9c7a06' });

SPR.card = SPRITE([
  '.oooooooo.',
  'ouuuuuuuuo',
  'ouUuuuuUuo',
  'ouuxxxxuuo',
  'ouxxppxxuo',
  'ouxxppxxuo',
  'ouuxxxxuuo',
  'ouuuuuuuuo',
  'ouUuuuuUuo',
  'ouuxuuxuuo',
  'ouuuxxuuuo',
  'ouuuuuuuuo',
  'ouUUUUUUuo',
  '.oooooooo.'
], { u: '#e8dfc8', U: '#b3a888', x: '#c0202a', p: '#141018' });

SPR.shield = SPRITE([
  '..oooooo..',
  '.obbbbbbo.',
  'obbwwwwbbo',
  'obwwwwwwbo',
  'obwwwwwwbo',
  'obbwwwwbbo',
  '.obbwwbbo.',
  '..obbbbo..',
  '...obbo...',
  '....oo....'
], { b: '#3f92d6', w: '#c6e8ff' });

SPR.nova = SPRITE([
  '....xx....',
  '..x.xx.x..',
  '...xxxx...',
  '.xxxXXxxx.',
  'xxXXXXXXxx',
  'xxXXXXXXxx',
  '.xxxXXxxx.',
  '...xxxx...',
  '..x.xx.x..',
  '....xx....'
], { x: '#ff8a2b', X: '#fff0a8' });

SPR.pedestal = SPRITE([
  '......oooooooo......',
  '.....oUUUUUUUUo.....',
  '.....oUuuuuuuUo.....',
  '.....oUuuuuuuUo.....',
  '......oUUUUUUo......',
  '.......oUUUUo.......',
  '.......oUuuUo.......',
  '.......oUuuUo.......',
  '.......oUuuUo.......',
  '......oUUuuUUo......',
  '.....oUUuuuuUUo.....',
  '....oUUuuuuuuUUo....',
  '...oUUuuuuuuuuUUo...',
  '...oUUUUUUUUUUUUo...',
  '...oUUUUUUUUUUUUo...',
  '...oooooooooooooo...'
], { u: '#7a7268', U: '#4e4841' });

/* the mark in the corner. it is not for you. */
SPR.sigil = SPRITE([
  '..oo......oo..',
  '.oxxo....oxxo.',
  '..oxxo..oxxo..',
  '...oxxooxxo...',
  '....oxxxxo....',
  '..ooxxxxxxoo..',
  '.oxxxxxxxxxxo.',
  '.oxxxxxxxxxxo.',
  '..ooxxxxxxoo..',
  '....oxxxxo....',
  '...oxxooxxo...',
  '..oxxo..oxxo..',
  '.oxxo....oxxo.',
  '..oo......oo..'
], { x: '#b028ff' });

/* ---------- ENEMIES ---------- */
SPR.crawler = SPRITE([
  '.....oooo.....',
  '...ooffffoo...',
  '..offffffffo..',
  '..offxffxffo..',
  '..offffffffo..',
  '..ofkkkkkkfo..',
  '...offffffo...',
  '..ofFFFFFFfo..',
  '.oFfFFFFFFfFo.',
  '.oFFFFFFFFFFo.',
  '..oFFFFFFFFo..',
  '..oFF....FFo..',
  '..oFo....oFo..',
  '..ooo....ooo..'
]);

SPR.shrieker = SPRITE([
  '....oooooo....',
  '..ooccccccoo..',
  '..occcccccco..',
  '..occxccxcco..',
  '..occcccccco..',
  '..ocCkkkkCco..',
  '..ocCkkkkCco..',
  '..ocCkkkkCco..',
  '..occcccccco..',
  '.occcccccccco.',
  '.oCCccccccCCo.',
  '..occcccccco..',
  '..oCCcccccCo..',
  '..oCo....oCo..',
  '..oCo....oCo..',
  '..ooo....ooo..'
], { c: '#8fae72', C: '#546b45', k: '#20100f' });

SPR.stalker = SPRITE([
  '.....oooo.....',
  '....ouuuuo....',
  '...ouuuuuuo...',
  '...ouxuuxuo...',
  '...ouuuuuuo...',
  '....oUUUUo....',
  '..oouuuuuuoo..',
  '.ouuuuuuuuuuo.',
  '.ouUuuuuuuUuo.',
  '.ouUuuuuuuUuo.',
  '..ouuuuuuuuo..',
  '..oUUuuuuUUo..',
  '...ouu..uuo...',
  '...ouu..uuo...',
  '...oUo..oUo...',
  '...ooo..ooo...'
], { u: '#cfc7b0', U: '#8e8878', x: '#ff2020' });

SPR.bloater = SPRITE([
  '......oooooo......',
  '....oovvvvvvoo....',
  '...ovvvvvvvvvvo...',
  '..ovvxvvvvvvxvvo..',
  '..ovvvvvvvvvvvvo..',
  '.ovvvvkkkkkkvvvvo.',
  '.ovvvkvkvkvkvvvvo.',
  '.ovvvvvvvvvvvvvvo.',
  'ovvvvvvvvvvvvvvvvo',
  'ovvvVVvvvvvvVVvvvo',
  'ovvvvvvvvvvvvvvvvo',
  '.ovvvvvvvvvvvvvvo.',
  '.oVVvvvvvvvvvvVVo.',
  '..oVVVVVVVVVVVVo..',
  '...oVVo....oVVo...',
  '...oooo....oooo...'
]);

/* ---------- BOSSES 24x22 ---------- */
SPR.bossA = SPRITE([   // hulking, apron, sunken head
  '.........oooooo.........',
  '.......oovvvvvvoo.......',
  '......ovvvvvvvvvvo......',
  '.....ovvvvvvvvvvvvo.....',
  '.....ovvxxvvvvxxvvo.....',
  '.....ovvvvvvvvvvvvo.....',
  '.....ovkkkkkkkkkkvo.....',
  '.....ovkukukukukuvo.....',
  '.....ovvvvvvvvvvvvo.....',
  '..oooovvvvvvvvvvvvoooo..',
  '.ovvvvvvvvvvvvvvvvvvvvo.',
  'ovvvvvvuuuuuuuuvvvvvvvvo',
  'ovvvvvuuuuuuuuuuvvvvvvvo',
  'ovvvvvuuuuuuuuuuvvvvvvvo',
  '.ovvvvuuuuuuuuuuvvvvvvo.',
  '.ovvvvuuuuuuuuuuvvvvvvo.',
  '..ovvvuuuuuuuuuuvvvvvo..',
  '..ovvvvuuuuuuuuvvvvvvo..',
  '...ovvvvvvvvvvvvvvvvo...',
  '...oVVVVVVo..oVVVVVVo...',
  '...oVVVVVo....oVVVVVo...',
  '...ooooooo....ooooooo...'
]);

SPR.bossB = SPRITE([   // bloated many-eyed sac
  '........oooooooo........',
  '......ooccccccccoo......',
  '....ooccccccccccccoo....',
  '...occcccccccccccccco...',
  '..occcccccccccccccccco..',
  '..occxxccccxxccccxxcco..',
  '..occcccccccccccccccco..',
  '.occcccccccccccccccccco.',
  '.occcxxcccccccccxxcccco.',
  'occcccccccccccccccccccco',
  'occcCCccccccccccccCCccco',
  'occcccccccckkcccccccccco',
  'occccccccckkkkccccccccco',
  'occccccccckkkkccccccccco',
  '.occccccccckkccccccccco.',
  '.occcccccccccccccccccco.',
  '..occcccccccccccccccco..',
  '..occcCCccccccccCCccco..',
  '...occcccccccccccccco...',
  '....oCCCo......oCCCo....',
  '....oCCCo......oCCCo....',
  '....ooooo......ooooo....'
], { c: '#8fae6a', C: '#4d6b38', k: '#170f12', x: '#ff3b3b' });

/* ---------- LOOT (the joke arsenal) ---------- */
SPR.banana = SPRITE([
  '.......oo.',
  '......oyko',
  '.....oyyyo',
  '....oyyyo.',
  '...oyyyo..',
  '..oyyYo...',
  '.oyyYo....',
  '.oyYYo....',
  '.okYo.....',
  '..oo......'
], { y: '#f7dc55', Y: '#c0a01e', k: '#4a3311' });

SPR.melon = SPRITE([
  '...oooooo...',
  '.oCcCcCcCco.',
  'oCcCcCcCcCco',
  'oCcCcCcCcCco',
  'oCcCcCcCcCco',
  'oCcCcCcCcCco',
  'oCcCcCcCcCco',
  '.oCcCcCcCco.',
  '..occcccco..',
  '...oooooo...'
], { c: '#63b04a', C: '#1f6b2e' });

SPR.milk = SPRITE([
  '...oooo...',
  '..ouuuuo..',
  '.ouuuuuuo.',
  '.ouuuuuuo.',
  '.oubbbbUo.',
  '.oubUUbUo.',
  '.oubbbbUo.',
  '.ouuuuuUo.',
  '.ouuuuuUo.',
  '.oUUUUUUo.',
  '.oUUUUUUo.',
  '..oooooo..'
], { u: '#f2ede2', U: '#c0b9aa', b: '#3a6ea5' });

SPR.coolade = SPRITE([
  '..oooooo..',
  '.ouuuuuuo.',
  '.ouxxxxuo.',
  'oouxxxxuo.',
  'ouoxxxxuo.',
  'oouxxxxuo.',
  '.ouxxxxuo.',
  '.ouXXXXuo.',
  '.ouxxxxuo.',
  '.ouXXXXuo.',
  '.oUUUUUUo.',
  '..oooooo..'
], { u: '#e8dfd0', U: '#b3a898', x: '#e02832', X: '#a8141c' });

SPR.glock = SPRITE([
  '....gggggg..',
  '..ogggggggo.',
  '..oGGgggggo.',
  '..oggGGGGo..',
  '..ogGo......',
  '..ogGo......',
  '..oGGo......',
  '..oooo......'
]);

SPR.bike = SPRITE([
  '.......hh.....',
  '..ss...h......',
  '..ss..hh......',
  '...ffffff.....',
  '..ff.f..ff....',
  '.oooo..oooo...',
  'o....o.o....o.',
  'o....o.o....o.',
  '.oooo...oooo..'
], { f: '#c9232c', s: '#2a2226', h: '#8a8a92' });

SPR.bacon = SPRITE([
  '.oooooooooo.',
  'opppuppppupo',
  'oPppupppupPo',
  'oppuppppuppo',
  'oPuppppuppPo',
  'oppppuppppPo',
  'oPPPPPPPPPPo',
  '.oooooooooo.'
], { p: '#d4685f', P: '#8f3936', u: '#f2ddd2' });

SPR.eye = SPRITE([
  '....oooooo....',
  '..oouuuuuuoo..',
  '.ouuuuuuuuuuo.',
  'ouuuuvxxvuuuuo',
  'ouuuvxxppxxvuo',
  'ouuvxxppppxxuo',
  'ouuvxxppppxxuo',
  'ouuuvxxppxxvuo',
  'ouuuuvxxvuuuuo',
  '.ouuuuuuuuuuo.',
  '..oouuuuuuoo..',
  '....oooooo....'
], { u: '#f0e7d5', x: '#c8181f', v: '#7d1216', p: '#080406' });

SPR.ammo = SPRITE([
  '.oooooooo.',
  'oggggggggo',
  'ogyyggyygo',
  'ogyyggyygo',
  'oggggggggo',
  'ogGGGGGGgo',
  'oggggggggo',
  '.oooooooo.'
]);

SPR.medkit = SPRITE([
  '.oooooooo.',
  'ouuuuuuuuo',
  'ouuuxxuuuo',
  'ouxxxxxxuo',
  'ouxxxxxxuo',
  'ouuuxxuuuo',
  'ouuuuuuuuo',
  '.oooooooo.'
], { u: '#e8e2d4', x: '#cc2020' });

/* ============================================================
   Renderer: pre-bakes every sprite (and flip/tint variants)
   into offscreen canvases so we never fillRect per pixel.
   ============================================================ */
const _cache = new Map();

function _bake(spr, flip, tint) {
  const c = document.createElement('canvas');
  c.width = spr.w; c.height = spr.h;
  const g = c.getContext('2d');
  const pal = spr.pal ? Object.assign({}, PAL, spr.pal) : PAL;
  for (let y = 0; y < spr.h; y++) {
    const row = spr.rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(flip ? spr.w - 1 - x : x, y, 1, 1);
    }
  }
  if (tint) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = tint;
    g.fillRect(0, 0, spr.w, spr.h);
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

function sheet(spr, flip, tint) {
  if (!spr._id) spr._id = 'S' + (sheet._n = (sheet._n || 0) + 1);
  const key = spr._id + (flip ? 'F' : '') + (tint || '');
  let c = _cache.get(key);
  if (!c) { c = _bake(spr, !!flip, tint || null); _cache.set(key, c); }
  return c;
}

/** Draw a sprite centered at (x,y) in world/screen space. */
function drawSpr(ctx, spr, x, y, scale, flip, alpha, tint) {
  scale = scale || 1;
  const c = sheet(spr, flip, tint);
  if (alpha !== undefined && alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.drawImage(c, Math.round(x - spr.w * scale / 2), Math.round(y - spr.h * scale / 2),
    spr.w * scale, spr.h * scale);
  if (alpha !== undefined && alpha !== 1) ctx.restore();
}

/** Palette-swapped clone of a sprite (cosmetics). Cached so IDs stay stable. */
const _variants = new Map();
function variant(spr, key, palOverride) {
  const id = (spr._id || (spr._id = 'S' + (sheet._n = (sheet._n || 0) + 1))) + '::' + key;
  let v = _variants.get(id);
  if (!v) {
    v = SPRITE(spr.rows, Object.assign({}, spr.pal || {}, palOverride));
    _variants.set(id, v);
  }
  return v;
}

/** Draw rotated around a pivot expressed in sprite-pixel coords. */
function drawSprRot(ctx, spr, x, y, ang, scale, px, py, flipY, tint) {
  const c = sheet(spr, false, tint);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (flipY) ctx.scale(1, -1);
  ctx.drawImage(c, -px * scale, -py * scale, spr.w * scale, spr.h * scale);
  ctx.restore();
}
