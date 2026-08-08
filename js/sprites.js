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

/* ---------- PACI, the shopkeeper. 22x27, drawn at 3.6x — the head is
   deliberately small for the body so he reads as ENORMOUS next to Damjan
   rather than just tall. Two frames: settled, and the breath at the top
   of the loop. ---------- */
const PACI_PAL = { A: '#c8bba2', a: '#8a7f6c', G: '#5e4a34' };
const PACI_BODY = [
  '........oooooo........',
  '.......ohhhhhho.......',
  '......ohhhhhhhho......',
  '......oHhhhhhhHo......',
  '......osssssssso......',
  '......osepsspeso......',
  '......osssssssso......',
  '......ossmmmmsso......',
  '.......oSSSSSSo.......',
  '....oooooooooooooo....'
];
SPR.paci = SPRITE(PACI_BODY.concat([
  '..ooAAAAAAAAAAAAAAoo..',
  '.osAAAAAAAAAAAAAAAAso.',
  '.osAAAAyAAAAAAyAAAAso.',
  '.osAAAAAAAAAAAAAAAAso.',
  'oSsAAAAAAAAAAAAAAAAsSo',
  'oSsAAAAAAAAAAAAAAAAsSo',
  '.osAAAAAAAAAAAAAAAAso.',
  '.osAAAAyAAAAAAyAAAAso.',
  '.osAAAAAAAAAAAAAAAAso.',
  '..oaaaaaaaaaaaaaaaao..',
  '..oaaaaGGGGGGGGaaaao..',
  '..oaaaaaaaaaaaaaaaao..',
  '...oaaaaaaaaaaaaaao...',
  '....oooooo..oooooo....',
  '....onnnno..onnnno....',
  '....otttto..otttto....',
  '...ottttto..ottttto...'
]), PACI_PAL);
SPR.paci2 = SPRITE(PACI_BODY.concat([
  '..ooAAAAAAAAAAAAAAoo..',
  '.osAAAAAAAAAAAAAAAAso.',
  '.osAAAAyAAAAAAyAAAAso.',
  'oSsAAAAAAAAAAAAAAAAsSo',
  'oSsAAAAAAAAAAAAAAAAsSo',
  '.osAAAAAAAAAAAAAAAAso.',
  '.osAAAAAAAAAAAAAAAAso.',
  '.osAAAAyAAAAAAyAAAAso.',
  '.osAAAAAAAAAAAAAAAAso.',
  '..oaaaaaaaaaaaaaaaao..',
  '..oaaaaGGGGGGGGaaaao..',
  '..oaaaaaaaaaaaaaaaao..',
  '...oaaaaaaaaaaaaaao...',
  '....oooooo..oooooo....',
  '....onnnno..onnnno....',
  '....otttto..otttto....',
  '...ottttto..ottttto...'
]), PACI_PAL);

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

/* ============================================================
   ENEMIES & BOSSES — animated banks.

   Each creature is one body plus a short tail of rows that actually
   move, so a four-frame cycle costs a body and four tails instead of
   four whole sprites. Every bank exposes:
     walk[]  the loop, stepped by how fast the thing is travelling
     pose    the frame it holds while winding up to do something

   That second one is the point: the pose is a tell. A shrieker gapes
   before it screams, a stalker coils before it blinks, a boss rears
   before it charges. You can read the attack off the sprite now.
   ============================================================ */
function FRAMES(pal, body, tails) { return tails.map(t => SPRITE(body.concat(t), pal)); }
/* eye = where the glow sits, in sprite pixels from the sprite's centre. It
   lives with the art because only the art knows where the sockets are. */
function BANK(pal, body, tails, pose, eye) {
  return { walk: FRAMES(pal, body, tails), pose: SPRITE(body.concat(pose), pal),
           eye: eye || { y: -3, sep: 2.6 } };
}
SPR.anim = {};

/* ---------- CRAWLER 16x14 — low, skinless, four spindly legs ---------- */
{
  const pal = { L: '#d9a9a9', f: '#bb8b8b', F: '#8b6161', E: '#553a3c', k: '#2f1719', x: '#ff5252' };
  const body = [
    '.....oooooo.....',
    '...ooLLLLLLoo...',
    '..oLLffffffLLo..',
    '.oLLffffffffLLo.',
    '.oLffxffffxffLo.',
    '.offfffffffffFo.',
    '.oFkLLLLLLLLkFo.',
    '.oFkkkkkkkkkkFo.',
    '.oFLkLkLkLkLkFo.'
  ];
  SPR.anim.crawler = BANK(pal, body, [
    ['..oFFffffffFFo..', '..oFEFffffFEFo..', '.oEo.oFFFFo.oEo.', '.oEo..oEEo..oEo.', '..o....oo....o..'],
    ['..oFFffffffFFo..', '.oFEFFffffFFEFo.', 'oEo..oFFFFo..oEo', 'oEo...oEEo...oEo', 'oo.....oo.....oo'],
    ['..oFFffffffFFo..', '..oFEFffffFEFo..', '..oEooFFFFooEo..', '..oEo.oEEo.oEo..', '...o...oo...o...'],
    ['..oFFffffffFFo..', '.oFEFFffffFFEFo.', 'oEo...oFFo...oEo', 'oEo..oEEEEo..oEo', 'oo....o..o....oo']
  ], // coiled to spring
    ['..oFFffffffFFo..', '..oFFFffffFFFo..', '..oEEoFFFFoEEo..', '...oEoEEEEoEo...', '....o.o..o.o....'], { y: -2.5, sep: 2.5 });
}

/* ---------- SHRIEKER 16x18 — bloated, gaping vertical maw ---------- */
{
  const pal = { L: '#c4dda6', c: '#9dbd7e', C: '#6b8a52', D: '#42582f', k: '#1d1010', x: '#ff3b3b' };
  const body = [
    '....oooooooo....',
    '..ooLLccccLLoo..',
    '.oLLccccccccLLo.',
    '.oLccccccccccLo.',
    '.oLccxccccxccLo.',
    '.occcccccccccco.',
    '.occcccccccccco.',
    '.oCccccccccccCo.',
    '.oCccccccccccCo.',
    '.occcccccccccco.'
  ];
  SPR.anim.shrieker = BANK(pal, body, [
    ['.oCcccckkccccCo.', '.oCcccckkccccCo.', '.occcccckccccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '...oCo....oCo...', '...oCo....oCo...', '...ooo....ooo...'],
    ['.oCccckkkkcccCo.', '.oCcckkkkkkccCo.', '.occcckkkkcccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '..oCo......oCo..', '..oCo......oCo..', '..ooo......ooo..'],
    ['.oCcccckkccccCo.', '.oCcccckkccccCo.', '.occcccckccccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '....oCCCCCCo....', '....oCccccCo....', '....oooooooo....'],
    ['.oCccckkkkcccCo.', '.oCcckkkkkkccCo.', '.occcckkkkcccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '..oCo......oCo..', '..oCo......oCo..', '..ooo......ooo..']
  ], // the scream
    ['.oCkkkkkkkkkkCo.', '.ockkkkkkkkkkco.', '.ockkkkkkkkkkco.', '.oCckkkkkkkkcCo.', '..oCDDccccDDCo..', '...oCo....oCo...', '...oCo....oCo...', '...ooo....ooo...'], { y: -4.5, sep: 2.5 });
}

/* ---------- STALKER 14x18 — tall, gaunt, long stride ---------- */
{
  const pal = { L: '#f0e9d4', u: '#d5cdb6', U: '#9a927e', E: '#5f5847', k: '#241d18', x: '#ff2020' };
  const body = [
    '.....oooo.....',
    '...ooLLLLoo...',
    '..oLLuuuuLLo..',
    '..oLuuuuuuLo..',
    '..oLuxuuxuLo..',
    '..oUukkkkuUo..',
    '...oUuuuuUo...',
    '....oUUUUo....',
    '..ooLuuuuLoo..',
    '.oLuuuuuuuuLo.'
  ];
  SPR.anim.stalker = BANK(pal, body, [
    ['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '..oEUuuuuUEo..', '..oUUo..oUUo..', '..ouuo..ouuo..', '..oUo....oUo..', '..ooo....ooo..'],
    ['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '.oEUuuuuuuUEo.', '.oUUo....oUUo.', 'oUUo......oUUo', 'oUo........oUo', 'ooo........ooo'],
    ['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '..oEUuuuuUEo..', '...oUUUUUUo...', '...ouuuuuuo...', '....oUUUUo....', '....oooooo....'],
    ['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '.oEUuuuuuuUEo.', 'oUUo......oUUo', '.oUUo....oUUo.', '..oUo....oUo..', '..ooo....ooo..']
  ], // coiled, about to blink
    ['.oUuuuuuuuuUo.', '.oUEEuuuuEEUo.', '..oUEuuuuEUo..', '..oEEuuuuEEo..', '...oUUUUUUo...', '...oEEuuEEo...', '...oUo..oUo...', '...ooo..ooo...'], { y: -4.5, sep: 1.5 });
}

/* ---------- BLOATER 20x18 — a pulsing sack with ribs showing ---------- */
{
  const pal = { L: '#c46a6e', v: '#9c4049', V: '#5e2229', D: '#3a141a', u: '#ded8c6', k: '#200e12', x: '#ff3b3b' };
  const body = [
    '.......oooooo.......',
    '.....ooLLvvLLoo.....',
    '...ooLvvvvvvvvLoo...',
    '..oLvvvvvvvvvvvvLo..',
    '..oLvvxvvvvvvxvvLo..',
    '.oLvvvvvvvvvvvvvvLo.',
    '.oLvvkkkkkkkkkkvvLo.',
    '.ovvvkvkvkvkvkvvvvo.',
    '.ovvvvvvvvvvvvvvvvo.',
    'ovvvvvvvvvvvvvvvvvvo'
  ];
  SPR.anim.bloater = BANK(pal, body, [
    ['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', '.ovvvvvvvvvvvvvvvvo.', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '...oVVo......oVVo...', '...ooo........ooo...'],
    ['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '..oVVo........oVVo..', '..ooo..........ooo..'],
    ['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', '.ovvvvvvvvvvvvvvvvo.', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '....oVVo....oVVo....', '....ooo......ooo....'],
    ['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '..oVVo........oVVo..', '..ooo..........ooo..']
  ], // swollen, about to burst forward
    ['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuuuuuuuuuuuuuuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'oVvvvvvvvvvvvvvvvVo.', '.oVVvvvvvvvvvvvvVVo.', '..oVVo........oVVo..', '..ooo..........ooo..'], { y: -4.5, sep: 3.5 });
}

/* ---------- BOSS A 26x24 — hulking, apron, sunken head ---------- */
{
  const pal = { L: '#b8555c', v: '#8f3944', V: '#54202a', D: '#33121a', u: '#ded8c6', U: '#a9a291', k: '#1c0d12', x: '#ff3b3b' };
  const body = [
    '..........oooooo..........',
    '........ooLLvvLLoo........',
    '.......oLvvvvvvvvLo.......',
    '......oLvvvvvvvvvvLo......',
    '......oLvvxvvvvxvvLo......',
    '......oLvvvvvvvvvvLo......',
    '......oLvkkkkkkkkvLo......',
    '......oLvkukukukuvLo......',
    '......oLvvvvvvvvvvLo......',
    '....oooLvvvvvvvvvvLooo....'
  ];
  SPR.anim.bossA = BANK(pal, body, [
    ['..oLvvvvvvvvvvvvvvvvvvLo..', '.oLvvvvvvvvvvvvvvvvvvvvLo.', 'oLvvvvvvvvvvvvvvvvvvvvvvLo', 'ovvvvvuuuuuuuuuuuuuuvvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '..ovvuuuuuuuuuuuuuuuuvvo..', '..ovvvuuuuuuuuuuuuuuvvvo..', '...ovvvvvvvvvvvvvvvvvvo...', '...oVVVVVo......oVVVVVo...', '....oVVVo........oVVVo....', '....ooooo........ooooo....'],
    ['..oLvvvvvvvvvvvvvvvvvvLo..', '.oLvvvvvvvvvvvvvvvvvvvvLo.', 'oLvvvvvvvvvvvvvvvvvvvvvvLo', 'ovvvvvuuuuuuuuuuuuuuvvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '..ovvuuuuuuuuuuuuuuuuvvo..', '..ovvuuuuuuuuuuuuuuuuvvo..', '..ovvvuuuuuuuuuuuuuuvvvo..', '...ovvvvvvvvvvvvvvvvvvo...', '..oVVVVVo........oVVVVVo..', '..oVVVo............oVVVo..', '..ooooo............ooooo..']
  ], // rears up before it commits
    ['ooLvvvvvvvvvvvvvvvvvvvvLoo', 'oLLvvvvvvvvvvvvvvvvvvvvLLo', 'oLvvvvvvvvvvvvvvvvvvvvvvLo', 'ovvvvvuuuuuuuuuuuuuuvvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '..ovvvuuuuuuuuuuuuuuvvvo..', '...ovvvvvvvvvvvvvvvvvvo...', '...oVVVVVVVVVVVVVVVVVVo...', '....oVVVVVVVVVVVVVVVVo....', '....oooooooooooooooooo....'], { y: -7.5, sep: 2.5 });
}

/* ---------- BOSS B 26x24 — bloated many-eyed sac ---------- */
{
  const pal = { L: '#b6cf8c', c: '#8fae6a', C: '#4d6b38', D: '#2c3f20', u: '#ded8c6', k: '#170f12', x: '#ff3b3b' };
  const body = [
    '........oooooooooo........',
    '......ooLLccccccLLoo......',
    '....ooLLccccccccccLLoo....',
    '...oLLccccccccccccccLLo...',
    '..oLccccccccccccccccccLo..',
    '..oLccxxccccccccccxxccLo..',
    '..oLccccccccccccccccccLo..',
    '.oLccccccccccccccccccccLo.',
    '.oLcccxxcccccccccxxccccLo.',
    '.oLccccccccccccccccccccLo.'
  ];
  SPR.anim.bossB = BANK(pal, body, [
    ['oLccccccccccccccccccccccLo', 'occcccCCcccccccccCCcccccco', 'occccccccccckkccccccccccco', 'occcccccccckkkkcccccccccco', 'occcccccccckkkkcccccccccco', 'occccccccccckkccccccccccco', 'occcccccccccccccccccccccco', 'occccCCccccccccccccCCcccco', '.occcccccccccccccccccccco.', '.occcccccccccccccccccccco.', '..occcccccccccccccccccco..', '...oCCCCo........oCCCCo...', '....oCCo..........oCCo....', '....oooo..........oooo....'],
    ['oLccccccccccccccccccccccLo', 'occcccCCcccccccccCCcccccco', 'occcccccccccccccccccccccco', 'occccccccccckkccccccccccco', 'occccccccccckkccccccccccco', 'occcccccccccccccccccccccco', 'occcccccccccccccccccccccco', 'occccCCccccccccccccCCcccco', '.occcccccccccccccccccccco.', '..occcccccccccccccccccco..', '..occcccccccccccccccccco..', '..oCCCCo..........oCCCCo..', '..oCCo..............oCCo..', '..oooo..............oooo..']
  ], // splits open to spawn
    ['oLccccccccccccccccccccccLo', 'occcccCCcccccccccCCcccccco', 'occcccccccckkkkcccccccccco', 'occccccccckkkkkkccccccccco', 'occcccccckkkkkkkkcccccccco', 'occcccccckkkkkkkkcccccccco', 'occccccccckkkkkkccccccccco', 'occccCCcccckkkkccccCCcccco', '.occcccccccckkcccccccccco.', '.occcccccccccccccccccccco.', '..occcccccccccccccccccco..', '...oCCCCo........oCCCCo...', '....oCCo..........oCCo....', '....oooo..........oooo....'], { y: -6.5, sep: 6.0 });
}

/* Back-compat aliases: the title screen and the jumpscare want one still frame. */
SPR.crawler  = SPR.anim.crawler.walk[0];
SPR.shrieker = SPR.anim.shrieker.walk[0];
SPR.stalker  = SPR.anim.stalker.walk[0];
SPR.bloater  = SPR.anim.bloater.walk[0];
SPR.bossA    = SPR.anim.bossA.walk[0];
SPR.bossB    = SPR.anim.bossB.walk[0];

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
