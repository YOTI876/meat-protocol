/* ============================================================
   MEAT PROTOCOL - pixel sprite bank
   Every sprite is hand-plotted. '.' = transparent.
   Colors resolve from PAL, overridden per-sprite by spr.pal

   DENSITY
   The world renders at 2x the logical 480x270 grid, so a sprite can be
   plotted at 2x and still occupy the same number of game units. That is
   what `ss` (sub-sampling) means on a sprite: `ss:2` says "this grid is
   twice as fine as the game's pixel", and drawSpr divides its footprint
   back down. A 32x30 ss:2 sprite is a drop-in for a 16x15 ss:1 one.

   `up2()` lifts an old 1x grid to 2x with EPX/Scale2x, so hand-drawn 2x
   detail and generated 2x detail can live in the same character grid.
   ============================================================ */
const PAL = {
  '.': null,
  'o': '#0a0609',   // universal outline
  /* Selective outlining. A single black keyline round everything reads flat,
     so the art picks its outline by which way the surface is facing: `o` for
     the shadow side and the silhouette, `,` where the form turns away from
     the eye but still catches the room, `;` for the rim the lamp clips. */
  ',': '#241a1f', ';': '#6e5a52',
  'd': '#0d0a0f',                       // deepest occlusion — under overhangs
  /* Blood, in four states: dried, fresh, wet, and the highlight on wet. Kept
     global because everything in this building eventually wears some. */
  '#': '#4a0d13', '%': '#8c141d', '&': '#c81f26', '*': '#ff5b5b',
  '~': '#6d2230',                       // viscera / exposed muscle
  '+': '#f4eede', '!': '#cfc6ae',       // bone highlight / teeth
  '=': '#9aa2ae',                       // metal highlight
  /* A neutral value ramp for dithering any surface toward light or dark
     without inventing a new hue for it. */
  '1': '#141218', '2': '#201d25', '3': '#2e2a33', '4': '#3f3a45',
  '5': '#524c58', '6': '#68616d', '7': '#807885', '8': '#9a929e', '9': '#b5adb8',
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
  'M': '#c05cff', 'W': '#6a2aa8',      // omega
  'O': '#ff9a3a', 'A': '#b04408',      // rotisserie fire
  'E': '#e8f8ff', 'D': '#4f9ec8',      // freezer burn
  'K': '#ff4ab0', 'L': '#a01a68',      // price-tag magenta
  'T': '#8a8f98', 'X': '#c8ccd4'       // bright steel
};

/* opt: { ss: sub-samples per game pixel (default 1), aa: soften diagonal steps } */
function SPRITE(rows, pal, opt) {
  const o = opt || {};
  const ss = o.ss || 1;
  // AA belongs at high density: at 1x a translucent fringe is a whole game
  // pixel wide and reads as a halo, not as a softened step.
  return { rows, w: Math.max(...rows.map(r => r.length)), h: rows.length,
           pal: pal || null, ss, aa: o.aa === undefined ? ss > 1 : !!o.aa };
}

/* EPX / Scale2x on a character grid. Doubles a sprite's density while keeping
   every edge hard — diagonals get their corner filled in instead of being
   blurred, which is the whole reason to use it on pixel art rather than a
   bilinear stretch. Lets 1x art and 2x art share one grid. */
function up2(rows) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '.' : (rows[y][x] || '.');
  const out = [];
  for (let y = 0; y < h; y++) {
    let r0 = '', r1 = '';
    for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      r0 += (C === A && C !== D && A !== B) ? A : P;
      r0 += (A === B && A !== C && B !== D) ? B : P;
      r1 += (D === C && D !== B && C !== A) ? C : P;
      r1 += (B === D && B !== A && D !== C) ? D : P;
    }
    out.push(r0, r1);
  }
  return out;
}

/* Ordered dither threshold, matched to the floor's. Two tones alternating on
   this pattern read as a third tone at this pixel density, which is how a
   surface gets a gradient without inventing a colour for every step. */
const _BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const _bay = (x, y) => _BAY[((y & 3) << 2) | (x & 3)] / 16;

/* FORM SHADING.
   Everything in this building is lit from the top-left by the same failing
   strip light, so a surface that turns that way catches it and one that turns
   away loses it. `map` says, per material, what it looks like one step
   brighter and one step darker; a character with no entry is left exactly as
   the artist drew it, which is how hand-placed detail survives this pass.

   The band is dithered at its far edge rather than cut off, so the light rolls
   off a curved body instead of ringing it. */
function shade(rows, map, opt) {
  const o = opt || {}, dep = o.depth || 2;
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '.' : (rows[y][x] || '.');
  const solid = ch => ch !== '.' && ch !== 'o' && ch !== ',' && ch !== ';';
  const out = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const c = at(x, y), m = map[c];
      if (!m || !solid(c)) { r += c; continue; }
      // how far this pixel sits from the lit edge, and from the shaded one
      let up = 0, dn = 0;
      for (let k = 1; k <= dep; k++) if (solid(at(x - k, y)) && solid(at(x, y - k))) up = k; else break;
      for (let k = 1; k <= dep; k++) if (solid(at(x + k, y)) && solid(at(x, y + k))) dn = k; else break;
      if (up < dep && dn >= dep) r += (up === 0 || _bay(x, y) < 0.55) ? (m[0] || c) : c;
      else if (dn < dep && up >= dep) r += (dn === 0 || _bay(x, y) < 0.55) ? (m[1] || c) : c;
      else r += c;
    }
    out.push(r);
  }
  return out;
}

/* Paint a hand-drawn block onto a generated grid. A space means "leave what is
   already there" so a patch only has to describe the part that is authored —
   a face, a wound, a run of blood — and not the body it sits on. */
function stamp(rows, x0, y0, patch) {
  const out = rows.slice();
  for (let j = 0; j < patch.length; j++) {
    const y = y0 + j;
    if (y < 0 || y >= out.length) continue;
    const src = patch[j];
    let r = out[y].padEnd(x0 + src.length, '.');
    for (let i = 0; i < src.length; i++) {
      if (src[i] === ' ') continue;
      r = r.slice(0, x0 + i) + src[i] + r.slice(x0 + i + 1);
    }
    out[y] = r;
  }
  return out;
}

const SPR = {};

/* ============================================================
   DAMJAN — a man who works here.

   He is a butcher. That is the whole brief, and it took three wrong turns to
   get back to it.

     THE HEAD    hair, a brow, one eye, a nose, a mouth, three days of stubble,
                 and a bandage over the other eye.
     THE BODY    crimson work shirt, bone apron on two straps over it, a belt,
                 dark trousers. Two bare hands, and they are both his.
     THAT IS IT  no hardware. Nothing bolted to him, nothing driven through him.

   ---- the three wrong turns, so they are not taken again ----

     1. A FULL HEAD WRAP. Solved a real problem — a face at sixteen pixels is
        brutally hard — by deleting the one part of a character people actually
        look for. A pale oval with two slits in it is an oval. Half a bandage
        keeps the idea; a whole one is a blank.
     2. RED ONLY AT THE EDGES. The apron used to fill the entire torso with the
        shirt showing as a thin strip down each outside edge. Red framing a pale
        front is a CAPE, not a shirt. The chest has to be shirt, edge to edge,
        for several rows before the apron is allowed to start.
     3. A RAIL THROUGH THE SHOULDER AND A HOOK FOR A HAND. Read as a cyborg,
        which is a different game. Hardware attached to a person reads as
        equipment however bloody it is drawn.

   What is left is a man, and the horror is what is on him rather than what has
   replaced him. That is a harder silhouette to make interesting and the right
   one for this game.

   ---- what makes him readable anyway ----

   At sixteen pixels tall only SILHOUETTE and VALUE survive; detail does not.
   With no hardware breaking the outline, both reads have to come from value:

     - the APRON is the one big pale mass, so the figure is dark-light-dark
       top to bottom and never a single blob
     - the BANDAGE is a pale wedge on a dark head, and being a wedge rather
       than a ball it reads as covering something

   Everything else is deliberately plain. A sprite this small holds about three
   ideas; an earlier pass had six and read as noise.

   ---- the face, at this size ----

   The head is fourteen sub-pixel rows: hair 2-6, brow 7, eye 8-9, nose 9-10,
   mouth 12, jaw 13. Two rules learned the hard way and worth keeping:

     - a NOSE is two pixels wide and a MOUTH is four. Equal widths stacked
       read as a moustache, which is how an earlier design got one by accident
     - never let them touch. Row 11 is left empty on purpose; without that gap
       the nose and the mouth fuse into a single dark bar

   ---- the cosmetics ----

   `r`/`R`/`w` are the SHIRT — the largest coloured area on him, which is what
   CRIMSON always meant, and it repaints cleanly. `h`/`H` is hair and `s`/`S`
   skin, so BONE MASK bleaches a real face into a skull. The bandage keeps the
   neutral ramp (`7`/`9`) so nothing repaints it: the dressing on a wound is
   not a colour anybody chooses.
   ============================================================ */

/* `9`/`7` is the bandage, `h`/`H` hair, `u`/`U` the apron. All in the shading
   map so the form pass rounds them like every other material. Hair is listed
   lit-first (`H` is the lighter brown). */
const DAM_MAP = { s: ['s', 'S'], S: ['s', 'S'], r: ['r', 'R'], R: ['r', 'R'],
                  h: ['H', 'h'], H: ['H', 'h'],
                  n: ['n', 'N'], N: ['n', 'N'], u: ['u', 'U'], U: ['u', 'U'],
                  9: ['9', '7'], 7: ['9', '7'] };

/* The 16x16 silhouette and its masses — SHAPE only, EPX-doubled and
   form-shaded before anything is stamped on it. The figure is symmetric here
   on purpose; everything that makes him specific is stamped at 2x, where it
   can be aimed at a particular pixel.

   NO ARMS BELOW ROW 9, AND THAT IS DELIBERATE. A drawn arm hangs wherever it
   was drawn, so a baked sleeve leaves the gun floating in front of a man
   standing to attention. `drawArm()` in game.js strikes them per frame from
   the deltoid line out to wherever his hands actually are. Put sleeves back on
   rows 10-14 and you get three arms. */
const DAM_BODY = [
  '.....oooooo.....',   //  0  hair
  '...oohhhhhhoo...',   //  1
  '..ohhhhhhhhhho..',   //  2
  '..osssssssssso..',   //  3  the face starts here
  '..osssssssssso..',   //  4
  '..osssssssssso..',   //  5
  '...osssssssso...',   //  6  jaw
  '....orrrrrro....',   //  7  collar
  '..orrrrrrrrrro..',   //  8  shoulders — SHIRT, edge to edge
  '.orrrrrrrrrrrro.',   //  9  the deltoid line. THE ARMS LEAVE FROM HERE
  '..or,uuuuuu,ro..',   // 10  the bib. torso only below this — see the note
  '..or,uuuuuu,ro..',   // 11
  '..o,uuuuuuuu,o..',   // 12  apron at its widest
  '..o,bbbbbbbb,o..',   // 13  belt
  '..o,uuuuuuuu,o..',   // 14
  '..oNNNNNNNNNNo..'    // 15  coat hem
];

/* THE FACE, and the bandage that has taken half of it.

   The hair is grain rather than a dome. `H` (the lighter brown) crowds the
   upper-left and thins out down and to the right, so the mass takes the same
   failing strip light as everything else instead of sitting flat — the stamp
   overwrites the form pass here, so this light has to be drawn by hand. It
   comes to a ragged fringe on row 6, teeth of hair with forehead showing
   between them, instead of a clean arc: a clean arc reads as a helmet.

   The bandage runs from the crown down across the eye on the rail side,
   widening as it descends and tapering off above the cheek. `%` is where it
   is still wet. Its lower-left edge is `,` so it separates from the skin
   without a full black keyline through the middle of his face.

   Every row is cut to the silhouette's own interior — the head tapers, so the
   crown rows are only ten sub-pixels wide and a stamp that ran the full width
   there would paint straight over the keyline and leave the skull edgeless. */
const DAM_FACE = [
  //   01234567890123456789012345678901
  '           HHHHHhH999           ',   //  2  hair grain, bandage over the crown
  '         HHHHhHhH999999         ',   //  3
  '       HHHhHhhhh999999977       ',   //  4
  '      HHhHhhhhhh9999999977      ',   //  5
  '      Hh hh hh h9999999977      ',   //  6  ragged fringe, forehead between
  '         hhhhh  9999999977      ',   //  7  brow
  '        ,eppe,  99%%999777      ',   //  8  the eye that is left, and the wet one
  '         SSSS  S ,9977,         ',   //  9  lower lid; bridge of the nose
  '               SS               ',   // 10  nose — two wide, never four
  '                                ',   // 11  left empty ON PURPOSE
  '        S     ,,,,  S           ',   // 12  mouth, and where he stopped shaving
  '         S S      S S           '    // 13  jaw
];

/* The apron straps, a belt buckle, and what the job has left on him.

   The straps run from the collar down to the bib and MEET it — x12-13 and
   x18-19 are exactly the bib's own edges. That is what stops the red from
   reading as a cape: without them the shirt is a red border round a pale front,
   which is a cape silhouette, and two straps crossing the red turn it back into
   a chest with something worn over it.

   `#` is dried blood, asymmetric on purpose — a symmetrical stain reads as a
   pattern, and a pattern reads as intentional. */
const DAM_WEAR = [
  //   01234567890123456789012345678901
  '      ww    uu    uu    ww      ',   // 16  collar highlight, and the straps
  '            uu    uu            ',   // 17
  '            uu    uu #          ',   // 18
  '            uu    uu##          ',   // 19
  '             #      ##          ',   // 20
  '                     #          ',   // 21
  '        #                       ',   // 22
  '        ##                      ',   // 23
  '                                ',   // 24
  '                                ',   // 25
  '              gggg              ',   // 26  belt buckle
  '              gGGg              ',   // 27
  '              #  ##             ',   // 28  the hands are drawn, not baked
  '                 #              '    // 29
];
SPR.body = SPRITE(
  [[0, 2, DAM_FACE], [0, 16, DAM_WEAR]]
    .reduce((r, p) => stamp(r, p[0], p[1], p[2]), shade(up2(DAM_BODY), DAM_MAP)),
  null, { ss: 2 });

/* DAMAGE.

   Three states, read off the APRON — the one big pale surface on him, which is
   what makes a wound visible at all. On a dark garment every mark is
   dark-on-dark and the system stays invisible until the last stage.

   The face keeps its own thread: a cut on the temple, then blood running down
   past the good eye, then the bandage torn off entirely and what it was there
   for on show. It all lands LEFT of x8 until the last stage, so the eye stays
   readable — a hurt player still needs to be able to find his own face.

   `.` punches clean through the sprite, so you can see the room through him by
   the end. Blood is the one thing here the cosmetics never repaint. */
const DAM_HURT = [
  //   01234567890123456789012345678901
  // 1 — a cut over the brow
  [[0, 5, [
    '      %%                        ',
    '      %%%                       ',
    '       %                        '
  ]], [0, 18, [
    '      ,o,                       ',
    '     ,oro,            %         ',
    '      ,o,            %%%        ',
    '           %%                   ',
    '          %%%%                  ',
    '           %%          %%       '
  ]]],
  // 2 — the apron is torn open, a sleeve has gone with it, and it is running
  //     down his face now
  [[0, 5, [
    '      %%%                       ',
    '      &%%                       ',
    '      %%                        ',
    '       %                        ',
    '       %                        ',
    '      %%                        '
  ]], [0, 17, [
    '     ,oo,                       ',   // 17  a bite out of the shoulder
    '    ,osSo,    %%                ',   // 18
    '    ,oSSo,   %%%%               ',   // 19
    '     ,oo,     %%                ',   // 20
    '          ,ouuo,    %%          ',   // 21  and a hole punched in the apron
    '          ou..uo   %%%%         ',   // 22
    '           ,oo,     %%          ',   // 23
    '     %%       &%&               ',   // 24
    '    %%%%      %%%               ',   // 25
    '     &%%       %                '    // 26
  ]]],
  // 3 — most of the apron is on the floor behind him, and the bandage has come
  //     off what it was covering
  [[0, 2, [
    '                  %%%           ',   //  2  cut to the crown's own width
    '                 %%%%%%         ',   //  3
    '                 %%%%%%%%       ',   //  4
    '                 %%%%%%%%%      ',   //  5
    '      %%         %%%%%%%%%      ',   //  6
    '      &%%        %%&&%%%%%      ',   //  7
    '      %%         %%p..p%%%      ',   //  8  the socket
    '       %          %%..%%%%      ',   //  9
    '       %          %%%%%%%       ',   // 10
    '      %%           %%%%%        '    // 11
  ]], [0, 17, [
    '    ,o..o,                      ',   // 17  the shoulder is opened right up
    '    o~%so,     &&               ',   // 18
    '    o~%SSo    &%%&              ',   // 19
    '     oo~%o    %%%%              ',   // 20
    '          ,ouuuuo,              ',   // 21  and the apron is opened right up
    '          ou.....uo             ',   // 22
    '          o.......o             ',   // 23
    '  %%       o.....o    %%        ',   // 24
    ' &%%%       ,ooo,    %%%%       ',   // 25
    '  %%%    %%          %%%%       ',   // 26
    '        %%%%          %%        ',   // 27
    '         %%                     '    // 28
  ]]]
];
SPR.bodyHurt = DAM_HURT.map(patches => SPRITE(
  patches.reduce((r, p) => stamp(r, p[0], p[1], p[2]), SPR.body.rows), null, { ss: 2 }));


/* 4-frame walk cycle: passing -> wide stride -> crossed -> wider stride.
   Played 0,1,2,3 it gives Damjan a bouncy, over-committed run. */
const DAM_LEGS = [
  [
    '....nnnnnnnn....',
    '....nnn..nnn....',
    '....nnn..nnn....',
    '....ttt..ttt....',
    '....ttt..ttt....'
  ],
  [
    '....nnnnnnnn....',
    '...nnn....nnn...',
    '...nnn....nnn...',
    '...ttt....ttt...',
    '..ttt......ttt..'
  ],
  [
    '....nnnnnnnn....',
    '.....nnnnnn.....',
    '.....nnnnnn.....',
    '.....tttttt.....',
    '.....tttttt.....'
  ],
  [
    '....nnnnnnnn....',
    '..nnn......nnn..',
    '..nnn......nnn..',
    '..ttt......ttt..',
    '.ttt........ttt.'
  ]
];
// the trouser leg splits and what is under it keeps running
const LEG_HURT = [
  [
    '                                ',
    '                                ',
    '        ,o,          ,o,        ',
    '         %            %         '
  ],
  [
    '            %%                  ',
    '     ,oo,   %%      ,oo,        ',
    '     osSo,  %      ,oSso        ',
    '     ,%%o,          o%%,        ',
    '      %%%            %%%        ',
    '       %              %%        '
  ]
];
SPR.legs = DAM_LEGS.map(l => SPRITE(shade(up2(l), DAM_MAP), null, { ss: 2 }));
/* index 0 is the light damage, 1 is the heavy — stage 1 shows nothing on the
   legs, because trousers survive a first hit and a jacket shoulder does not */
SPR.legsHurt = LEG_HURT.map(patch =>
  DAM_LEGS.map(l => SPRITE(stamp(shade(up2(l), DAM_MAP), 0, 2, patch), null, { ss: 2 })));
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
/* THE FISH.

   Not a gun. A fish, held by the tail, which opens its mouth and emits a
   laser. The grip column on the left is the same six-pixel `g/G` gunmetal
   silhouette every other weapon in the rack uses, so it still reads as
   "something Damjan is holding" from the hip — everything right of it is
   fish.

   The first pass was a violet rectangle with an eye in it, and nobody was
   going to call that a fish. Five things do the actual work at this size, and
   the order matters:

     1. a FORKED TAIL. It is the one silhouette feature that says fish and
        nothing else. The fist is wrapped round the tail, so the two prongs
        (x6, rows 0 and 4) spread above and below the knuckles — which is
        exactly how you hold a fish you have just picked up.
     2. a CAUDAL PEDUNCLE — the dark `W` pinch at x7 between tail and body.
        Without the narrowing, a tail is just more fish.
     3. FINS breaking the outline: dorsal on top, pelvic underneath, both
        offset from each other so the body does not read as symmetrical.
     4. an EYE high on the head, where a fish keeps it, not centred like a
        cartoon.
     5. a MOUTH that is open — the snout reaches furthest on the centre line
        alone, with a tooth glint behind it, and that single-pixel tip is
        where the beam comes out.

   `M`/`W` stay the omega violet in the sprite itself. The beam is what cycles
   colour — see the beam draw in game.js. A fish that strobed through the
   spectrum in your hand would fight the arena palette every frame; a fish
   that is one colour firing every colour is the joke. */
SPR.omega = SPRITE([        // THE FISH
  '......MM.MMM....',   // tail top prong, dorsal fin
  '..gggggWMMMMep..',   // peduncle, body, eye and pupil high on the head
  '..gGGGgMMMMMM!MM',   // the centre line ALONE reaches the open mouth
  '..GGgggWMMMMMW..',   // belly turning away from the light
  '...GG.MM..MM....',   // tail bottom prong, pelvic fin
  '....GG..........'
]);

/* THE FLYKILLER — the blue lamp above the deli, taken off the wall.
   A steel frame round an electrified mesh: `i` bright and `Z` dark, alternated
   so it reads as a grid rather than a panel. */
SPR.zap = SPRITE([          // THE FLYKILLER
  '.......TTTTTTT..',
  '..gggggTiZiZiTT.',
  '..gGGGgTZiZiZiT.',
  '..GGgggTiZiZiTT.',
  '...GG..TTTTTTT..',
  '....GG..........'
]);

/* BLACK FRIDAY — a black housing with a hole in the end of it. The `o` at the
   muzzle is the universal outline colour doing its other job: at this size the
   only way to draw a singularity is to draw nothing, ringed. */
SPR.void = SPRITE([         // BLACK FRIDAY
  '.........WMW....',
  '..gggggqqWMMMW..',
  '..gGGGgqqWMoMW..',
  '..GGgggqqWMMMW..',
  '...GG....WMW....',
  '....GG..........'
]);

/* The starting sidearm. Deliberately the smallest silhouette in the rack —
   you are supposed to want something else. */
SPR.pistol = SPRITE([
  '................',
  '.....TXXXXXX....',
  '..gggTTTTTTTl...',
  '..gGGGgGGg......',
  '...GGggg........',
  '....GG..........'
]);
SPR.price = SPRITE([        // THE PRICE GUN
  '.......KKKKK....',
  '..gggggKKKKKKKK.',
  '..gGGGgLLKKKKKK.',
  '..GGgggLLLgg....',
  '...GG..LLL......',
  '....GG..........'
]);
SPR.chill = SPRITE([        // FREEZER BURN
  '.....EEEEEEEE...',
  '..gggEDEDEDEDEEE',
  '..gGGGDDDDDDDD..',
  '..GGgggDDDgg....',
  '...GG..DDD......',
  '....GG..........'
]);
SPR.rot = SPRITE([          // THE ROTISSERIE
  '....OOAOOAOOAO..',
  '..gggOOOOOOOOOOO',
  '..gGGGAAAAAAAA..',
  '..GGgggAOAgg....',
  '...GG..AAA......',
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

/* ---- the four the deep floors drop ----
   Each is a different SHAPE, not the same badge in four colours: a chevron
   going up, a drop falling, a horseshoe, and a stack. At ten pixels across,
   shape is all you get. */
SPR.frenzy = SPRITE([          // stacked chevrons — everything, faster
  '....oo....',
  '...owwo...',
  '..owwwwo..',
  '.owwaawwo.',
  'oww.oo.wwo',
  'ow.o..o.wo',
  '..owwwwo..',
  '.owwaawwo.',
  'oww.oo.wwo',
  '.o.o..o.o.'
], { w: '#ffd28a', a: '#ff8a20' });

SPR.siphon = SPRITE([          // a drop, falling, with the light on its shoulder
  '....oo....',
  '....oo....',
  '...owwo...',
  '..owwwwo..',
  '.owwrrrwo.',
  'owwrrrrrwo',
  'owrrrrrrro',
  'owrrrrrrro',
  '.orrrrrro.',
  '..oooooo..'
], { w: '#ff9aa2', r: '#c02a3a' });

SPR.magnet = SPRITE([          // a horseshoe, poles down
  '..oo..oo..',
  '.ommo.ommo',
  'ommmo.ommm',
  'omm.o.o.mm',
  'omm.o.o.mm',
  'omm.o.o.mm',
  'ommmoommmo',
  '.ommmmmmo.',
  '..oMMMMo..',
  '...oooo...'
], { m: '#9fe08a', M: '#4f8f3a' });

SPR.bounty = SPRITE([          // a stack, not a single coin
  '..oooooo..',
  '.oyyyyyyo.',
  'oyyYYYYyyo',
  '.oyyyyyyo.',
  '..oooooo..',
  '.oyyyyyyo.',
  'oyyYYYYyyo',
  '.oyyyyyyo.',
  '..oooooo..',
  '...oooo...'
], { y: '#f5c518', Y: '#b2911f' });

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
const PACI_PAL = { A: '#c8bba2', a: '#8a7f6c', G: '#5e4a34', '9': '#e4dac6',
                   ',': '#241c18', ';': '#fff6e0', X: '#ff3020' };
const PACI_MAP = { A: ['9', 'a'], a: ['A', 'G'], G: ['a', 'G'], s: ['s', 'S'], S: ['s', 'S'],
                   h: ['h', 'H'], H: ['h', 'H'], y: ['y', 'Y'], Y: ['y', 'Y'], n: ['n', 'N'] };
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
/* THREE FACES.
   The first is the one he does business with: a smile held far too long and
   eyes set too wide for it. The second is what is underneath, and you only
   get to see it once. The third is the last thing you see before the door.  */
const PACI_CALM = [
  '            ,SSSSSSSSSSSSSSSSSS,            ',
  '            SssssssssssssssssssS            ',
  '            SssoepeossssoepeossS            ',
  '            SssoppeossssoeppossS            ',
  '            SssooooossssooooossS            ',
  '            SssssssssssssssssssS            ',
  '            Ss,mmmmmmmmmmmmmm,sS            ',
  '            Ssm!!m!!m!!m!!m!!mS             ',
  '              ,mmmmmmmmmmmmmm,              ',
  '              SSSSSSSSSSSSSSSS              '
];
const PACI_MAD = [
  '            ,SSSSSSSSSSSSSSSSSS,            ',
  '            SssooooossssooooossS            ',
  '            SssoXXXossssoXXXossS            ',
  '            SssoXpXossssoXpXossS            ',
  '            Sssooooo%ss%ooooossS            ',
  '            Sss%ssssssssssss%ssS            ',
  '            S,mmmmmmmmmmmmmmmm,S            ',
  '            Sm!!m!!m!!m!!m!!m!mS            ',
  '              m,mmmmmmmmmmmm,m              ',
  '              SSmmmmmmmmmmmmSS              '
];
const PACI_DONE = [
  '            ,SSSSSSSSSSSSSSSSSS,            ',
  '            SssooooossssooooossS            ',
  '            SssoXXXossssoXXXossS            ',
  '            SssoXXXo%ss%oXXXossS            ',
  '            Sssooooo%ss%ooooossS            ',
  '            Sss%%mmmmmmmmmm%%ssS            ',
  '            S,mmmmmmmmmmmmmmmm,S            ',
  '            Sm!mm!mm!mm!mm!mm!mS            ',
  '              mmmmmmmmmmmmmmm,              ',
  '              SsmmmmmmmmmmmmsS              '
];
const PACI_A = [
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
];
const PACI_B = [
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
];
/* The apron he has never once taken off, and the state of it. */
const PACI_STAIN = [
  '', '', '',
  '            %%##%%                          ',
  '          ##%%####%%          ##            ',
  '            %%##%%          ##%%##          ',
  '      ##                      %%##          ',
  '    ##%%##          ##                      ',
  '      %%##        ##%%##            ##      ',
  '                    %%##          ##%%##    '
];
function paciSpr(legs, face) {
  return SPRITE(stamp(stamp(shade(up2(PACI_BODY.concat(legs)), PACI_MAP), 0, 8, face),
                      0, 22, PACI_STAIN), PACI_PAL, { ss: 2 });
}
SPR.paci  = paciSpr(PACI_A, PACI_CALM);
SPR.paci2 = paciSpr(PACI_B, PACI_CALM);
/* he only has to be shot once for this to be the face he has from now on */
SPR.paciMad  = paciSpr(PACI_A, PACI_MAD);
SPR.paciMad2 = paciSpr(PACI_B, PACI_MAD);
SPR.paciDone  = paciSpr(PACI_A, PACI_DONE);
SPR.paciDone2 = paciSpr(PACI_B, PACI_DONE);

/* the mark in the corner. it is not for you. */
/* ---------- TOMCE 16x32 ----------
   Tall, thin, bald, and wearing the only pair of glasses in the building. He
   does not sell anything. He stands in a corner and offers you a trade.
   Two frames: the coat shifts, nothing else moves. */
const TOMCE_PAL = { f: '#c4b8a4', F: '#8e8272', q: '#1c1e26', n: '#2b3040', u: '#ded8c6', i: '#a8e8ff',
                    '9': '#e0d6c2', Q: '#0e1016', ',': '#12141a', ';': '#dff4ff', X: '#5c728a' };
/* His shading map is deliberately shallow. The coat is meant to read as one
   flat absence with a face floating over it, and giving it a full bevel would
   turn him into just another tall man. */
const TOMCE_MAP = { f: ['9', 'F'], F: ['f', 'F'], q: ['n', 'Q'], n: ['n', 'q'], u: ['u', 'F'] };
/* the glasses catch the room; the eyes behind them do not */
const TOMCE_FACE = [
  '      ,ffffffffffff,      ',
  '      f999999999999f      ',
  '     f99ffffffffff99f     ',
  '     f9ffffffffffff9f     ',
  '     ,iiii,ffffff,iiii,   ',
  '     iX;;XiffffffiX;;Xi   ',
  '     iXXXXi,ffff,iXXXXi   ',
  '     ,iiii,ffffff,iiii,   ',
  '     f9ffffffffffff9f     ',
  '     f9fFFF,mm,FFFf9f     ',
  '      f9ffFFmmFFff9f      ',
  '       ,fffffffff,        '
];
const TOMCE_HEAD = [
  '.....oooooo.....',
  '....offffffo....',
  '...offffffffo...',
  '...offffffffo...',
  '...oiiofffoiio..',
  '...offffffffo...',
  '...offFmmFffo...',
  '....offffffo....',
  '.....offffo.....',
  '......oqqo......'
];
const tomceSpr = coat => SPRITE(stamp(shade(up2(TOMCE_HEAD.concat(coat)), TOMCE_MAP), 3, 2, TOMCE_FACE),
                                TOMCE_PAL, { ss: 2 });
SPR.tomce = tomceSpr([
  '...oqqnqqnqqo...',
  '..oqqqnqqnqqqo..',
  '..oqqunqqnuqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqunqqnuqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqunqqnuqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqqqqqqqqqo..',
  '..oqqqqqqqqqqo..',
  '...oqqqqqqqqo...',
  '...oqqqqqqqqo...',
  '...oqqoooqqqo...',
  '...oqqo.oqqqo...',
  '...oqqo.oqqqo...',
  '...ottooootto...',
  '...ottooootto...',
  '....oo....oo....'
]);
SPR.tomce2 = tomceSpr([
  '...oqqnqqnqqo...',
  '..oqqqnqqnqqqo..',
  '..oqqunqqnuqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqunqqnuqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqunqqnuqqo..',
  '..oqqqnqqnqqqo..',
  '..oqqqqqqqqqqo..',
  '..oqqqqqqqqqqo..',
  '..oqqqqqqqqqqo..',
  '...oqqqqqqqqo...',
  '...oqqqqqqqqo...',
  '...oqqqoooqqo...',
  '...oqqqo.oqqo...',
  '...oqqqo.oqqo...',
  '...ottooootto...',
  '...ottooootto...',
  '....oo....oo....'
]);

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
/* Every creature is authored at 1x for silhouette and timing — that is what
   reads at a glance across a dark room — then lifted to 2x, given form
   shading, and hand-painted where the horror actually lives. The face is
   never generated. */
function CREATURE(map, rows, face) {
  let r = shade(up2(rows), map);
  if (face) r = stamp(r, face.x, face.y, face.rows);
  return r;
}
function FRAMES(pal, body, tails, opt) { return tails.map(t => SPRITE(body.concat(t), pal, opt)); }
/* eye = where the glow sits, in GAME pixels from the sprite's centre. It
   lives with the art because only the art knows where the sockets are, and it
   stays in game units so doubling a creature's density doesn't move its eyes. */
function BANK(pal, body, tails, pose, eye, opt) {
  return { walk: FRAMES(pal, body, tails, opt), pose: SPRITE(body.concat(pose), pal, opt),
           eye: eye || { y: -3, sep: 2.6 } };
}
SPR.anim = {};

/* ---------- CRAWLER 16x14 — low, skinless, four spindly legs ----------
   Skinned to the muscle and still coming. The face is two mismatched eyes
   set too far apart and a mouth that opens the wrong way — sideways, all
   the way across, because there is nothing holding the jaw together. */
{
  const pal = { L: '#d9a9a9', f: '#bb8b8b', F: '#8b6161', E: '#553a3c', k: '#2f1719', x: '#ff5252',
                '9': '#f4dcd6', X: '#ffe6d2', ',': '#3a1e22', ';': '#ffd6cc' };
  const map = { L: ['9', 'f'], f: ['L', 'F'], F: ['f', 'E'], E: ['F', 'k'], k: ['E', 'k'] };
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
  /* the eyes sit at different heights and the grin runs off both edges */
  const face = { x: 0, y: 6, rows: [
    '     ,EEEE,         ,EE,        ',
    '    ,EkkkkkE,      ,EkkkE,      ',
    '    EkxXXXxkE      EkxXxkE      ',
    '    EkXX;XXkE      EkX;XkE      ',
    '    EkxXXXxkE      EkxxXkE      ',
    '     ,EkkkE,   ~~   ,EkkE,      ',
    '   %   ,,,    ~~~~   ,,,   %    ',
    '   %kk!kk!kk!kkkk!kk!kk!kk%&    ',
    '   kk!kk!kk!kk!kk!kk!kk!kkk%    ',
    '   &%%kkkkkkkkkkkkkkkkkk%%&     '
  ] };
  const t = t1 => shade(up2(t1), map);
  SPR.anim.crawler = BANK(pal, CREATURE(map, body, face), [
    t(['..oFFffffffFFo..', '..oFEFffffFEFo..', '.oEo.oFFFFo.oEo.', '.oEo..oEEo..oEo.', '..o....oo....o..']),
    t(['..oFFffffffFFo..', '.oFEFFffffFFEFo.', 'oEo..oFFFFo..oEo', 'oEo...oEEo...oEo', 'oo.....oo.....oo']),
    t(['..oFFffffffFFo..', '..oFEFffffFEFo..', '..oEooFFFFooEo..', '..oEo.oEEo.oEo..', '...o...oo...o...']),
    t(['..oFFffffffFFo..', '.oFEFFffffFFEFo.', 'oEo...oFFo...oEo', 'oEo..oEEEEo..oEo', 'oo....o..o....oo'])
  ], // coiled to spring
    t(['..oFFffffffFFo..', '..oFFFffffFFFo..', '..oEEoFFFFoEEo..', '...oEoEEEEoEo...', '....o.o..o.o....']),
    { y: -2.5, sep: 2.5 }, { ss: 2 });
}

/* ---------- SHRIEKER 16x18 — bloated, gaping vertical maw ----------
   Blind. The eyes went milky a long time ago and the film over them has
   split. It finds you by the noise you make and answers with its own. */
{
  const pal = { L: '#c4dda6', c: '#9dbd7e', C: '#6b8a52', D: '#42582f', k: '#1d1010', x: '#ff3b3b',
                '9': '#e6f6cd', X: '#3a0c0c', ',': '#2c3a1e', ';': '#f2ffe0' };
  const map = { L: ['9', 'c'], c: ['L', 'C'], C: ['c', 'D'], D: ['C', 'k'], k: ['D', 'k'] };
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
  const face = { x: 0, y: 6, rows: [
    '     ,DDDD,      ,DDDD,         ',
    '    ,DkkkkkD,   ,DkkkkkD,       ',
    '    Dk+!!!+kD   Dk+!!!+kD       ',
    '    Dk!+XX+!D   Dk!+XX+!D       ',
    '    Dk+!!!+kD   Dk!+X+!kD       ',
    '     ,Dkkkk,     ,Dkkkk,        ',
    '       %%           %%          ',
    '        %            %%         '
  ] };
  const t = t1 => shade(up2(t1), map);
  /* the scream: the whole front of the head hinges open */
  const scream = stamp(t(['.oCkkkkkkkkkkCo.', '.ockkkkkkkkkkco.', '.ockkkkkkkkkkco.', '.oCckkkkkkkkcCo.',
                          '..oCDDccccDDCo..', '...oCo....oCo...', '...oCo....oCo...', '...ooo....ooo...']),
    0, 0, [
    '    ,Dk!k!k!k!k!k!k!k!k!kD,     ',
    '    Dk!kkkkkkkkkkkkkkkkk!kD     ',
    '    Dkkkk~~~~~~~~~~~~~~kkkD     ',
    '    Dkkk~~%%%%%%%%%%%%~~kkD     ',
    '    ,Dkk~~%%########%%~~kD,     ',
    '     Dkk~~%%########%%~~kD      ',
    '     ,Dkk~~%%######%%~~kD,      ',
    '      Dk!kk~~%%%%%%~~kk!kD      ',
    '      ,Dk!k!k!k!k!k!k!kD,       '
  ]);
  SPR.anim.shrieker = BANK(pal, CREATURE(map, body, face), [
    t(['.oCcccckkccccCo.', '.oCcccckkccccCo.', '.occcccckccccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '...oCo....oCo...', '...oCo....oCo...', '...ooo....ooo...']),
    t(['.oCccckkkkcccCo.', '.oCcckkkkkkccCo.', '.occcckkkkcccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '..oCo......oCo..', '..oCo......oCo..', '..ooo......ooo..']),
    t(['.oCcccckkccccCo.', '.oCcccckkccccCo.', '.occcccckccccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '....oCCCCCCo....', '....oCccccCo....', '....oooooooo....']),
    t(['.oCccckkkkcccCo.', '.oCcckkkkkkccCo.', '.occcckkkkcccco.', '.oCccccccccccCo.', '..oCDDccccDDCo..', '..oCo......oCo..', '..oCo......oCo..', '..ooo......ooo..'])
  ], scream, { y: -4.5, sep: 2.5 }, { ss: 2 });
}

/* ---------- STALKER 14x18 — tall, gaunt, long stride ----------
   Skull-faced, and the skin was pulled back over it and stitched shut in a
   hurry. What is left of the mouth cannot close over the teeth. */
{
  const pal = { L: '#f0e9d4', u: '#d5cdb6', U: '#9a927e', E: '#5f5847', k: '#241d18', x: '#ff2020',
                X: '#ff6a4a', ',': '#403829', ';': '#fffbe8' };
  const map = { L: ['+', 'u'], u: ['L', 'U'], U: ['u', 'E'], E: ['U', 'k'], k: ['E', 'k'] };
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
  const face = { x: 0, y: 6, rows: [
    '    ,EEEEE,,EEEEE,          ',
    '   ,EkkkkkEEkkkkkE,         ',
    '   EkkxXxkkEkkxXxkkE        ',
    '   EkkXXXkkEkkXXXkkE        ',
    '   ,Ekkxkk,,Ekkxkk,E        ',
    '    ,EEkEE,,EEkEE,          ',
    '      %%      %%            ',
    '   ,EkkkkkkkkkkkkkkE,       ',
    '   Ek!k!k!k!k!k!k!kE        ',
    '   ,EkkkkkkkkkkkkkkE,       ',
    '     ,%EEEEEEEE%,           '
  ] };
  const t = t1 => shade(up2(t1), map);
  SPR.anim.stalker = BANK(pal, CREATURE(map, body, face), [
    t(['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '..oEUuuuuUEo..', '..oUUo..oUUo..', '..ouuo..ouuo..', '..oUo....oUo..', '..ooo....ooo..']),
    t(['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '.oEUuuuuuuUEo.', '.oUUo....oUUo.', 'oUUo......oUUo', 'oUo........oUo', 'ooo........ooo']),
    t(['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '..oEUuuuuUEo..', '...oUUUUUUo...', '...ouuuuuuo...', '....oUUUUo....', '....oooooo....']),
    t(['.oUuuuuuuuuUo.', '.oUuEuuuuEuUo.', '..oUuuuuuuUo..', '.oEUuuuuuuUEo.', 'oUUo......oUUo', '.oUUo....oUUo.', '..oUo....oUo..', '..ooo....ooo..'])
  ], // coiled, about to blink
    t(['.oUuuuuuuuuUo.', '.oUEEuuuuEEUo.', '..oUEuuuuEUo..', '..oEEuuuuEEo..', '...oUUUUUUo...', '...oEEuuEEo...', '...oUo..oUo...', '...ooo..ooo...']),
    { y: -4.5, sep: 1.5 }, { ss: 2 });
}

/* ---------- BLOATER 20x18 — a pulsing sack with ribs showing ----------
   Swollen past the point where the skin can hold it. The eyes have sunk to
   pinholes in the fat and the belly has already split; you can see what is
   in there, and it is still working. */
{
  const pal = { L: '#c46a6e', v: '#9c4049', V: '#5e2229', D: '#3a141a', u: '#ded8c6', k: '#200e12', x: '#ff3b3b',
                '9': '#e09296', X: '#ffb0a0', ',': '#2a1014', ';': '#f2c0bc' };
  const map = { L: ['9', 'v'], v: ['L', 'V'], V: ['v', 'D'], D: ['V', 'k'], k: ['D', 'k'] };
  const face = { x: 0, y: 6, rows: [
    '          ,DDD,          ,DDD,        ',
    '         ,DkkkD,        ,DkkkD,       ',
    '         DkxXxkD        DkxXxkD       ',
    '         ,DkxxkD,      ,DkxXkD,       ',
    '          ,Dkk,          ,Dkk,        ',
    '            %              %          ',
    '       ,DkkkkkkkkkkkkkkkkkkkkkD,      ',
    '       Dkk~~%%%%%%%%%%%%%%~~kkkD      ',
    '       Dk~~%%##########%%~~~kkkD      ',
    '       ,Dkk~~%%%%%%%%%%~~kkkkD,       ',
    '        ,+Dkk~~~~~~~~~~kkkD+,         '
  ] };
  const t = t1 => shade(up2(t1), map);
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
  SPR.anim.bloater = BANK(pal, CREATURE(map, body, face), [
    t(['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', '.ovvvvvvvvvvvvvvvvo.', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '...oVVo......oVVo...', '...ooo........ooo...']),
    t(['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '..oVVo........oVVo..', '..ooo..........ooo..']),
    t(['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', '.ovvvvvvvvvvvvvvvvo.', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '....oVVo....oVVo....', '....ooo......ooo....']),
    t(['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', '.oVvvvvvvvvvvvvvvVo.', '..oVVvvvvvvvvvvVVo..', '..oVVo........oVVo..', '..ooo..........ooo..'])
  ], // swollen, about to burst forward
    t(['ovvuvvuvvuuvvuvvuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'ovvuuuuuuuuuuuuuuvvo', 'ovvvvvvvvvvvvvvvvvvo', 'oVvvvvvvvvvvvvvvvVo.', '.oVVvvvvvvvvvvvvVVo.', '..oVVo........oVVo..', '..ooo..........ooo..']),
    { y: -4.5, sep: 3.5 }, { ss: 2 });
}

/* ============================================================
   THE DEEP ROSTER

   Everything above is unlocked by floor 3, which meant floors 4 to 10 never
   showed you anything you had not already learned to kill. These three arrive
   later, and each answers a way of playing that had stopped costing you
   anything: standing still, kiting forever, and ignoring the weak ones.
   ============================================================ */

/* ---------- THE TROLLEY 16x14 — armour with something behind it ----------
   A squat steel front on wheels, and the only enemy WIDER than it is tall.
   That is the read: a wall coming at you. The eyes sit behind the grille, so
   the one soft thing on it is the one thing you cannot shoot from the front. */
{
  const pal = { T: '#c8ccd4', G: '#6b7079', E: '#3a3e45', k: '#15181c', x: '#ff5252',
                '9': '#f0f4fa', X: '#ffe6d2', ',': '#22262b', ';': '#ffd6cc', '!': '#9aa2ae' };
  const map = { T: ['9', 'G'], G: ['T', 'E'], E: ['G', 'k'], k: ['E', 'k'] };
  const face = { x: 0, y: 8, rows: [
    '      ,EkkkkE,        ,EkkkkE,  ',
    '      EkxXXxkE        EkxXXxkE  ',
    '      ,EkkkkE,        ,EkkkkE,  '
  ] };
  const t = t1 => shade(up2(t1), map);
  const body = [
    '....oooooooo....',
    '..ooTTTTTTTToo..',
    '.oTTGGGGGGGGTTo.',
    '.oTG!k!k!k!kGTo.',
    '.oTG!k!k!k!kGTo.',
    '.oTG!k!k!k!kGTo.',
    '.oTTGGGGGGGGTTo.',
    '.ooTTTTTTTTTToo.',
    '..oooooooooooo..'
  ];
  SPR.anim.trolley = BANK(pal, CREATURE(map, body, face), [
    t(['.oTTTTTTTTTTTTo.', '.oGGGGGGGGGGGGo.', '.oGo.oGGGGo.oGo.', '.ooo..oooo..ooo.', '................']),
    t(['.oTTTTTTTTTTTTo.', '.oGGGGGGGGGGGGo.', 'oGo..oGGGGo..oGo', 'ooo...oooo...ooo', '................'])
  ], // braced, and the plate catches what little light there is
    t(['.oTTTTTTTTTTTTo.', '.o999999999999o.', '.oGo..oGGGGo.oGo', '.ooo..oooo...ooo', '................']),
    { y: -2.0, sep: 3.4 }, { ss: 2 });
}

/* ---------- THE SPITTER 16x14 — it does not want to reach you ----------
   Top-heavy: a swollen sac over a short body, opening UPWARD, because what it
   throws goes over things. Nothing else has that proportion, so you can pick
   out the one in the crowd that is out-ranging you. */
{
  const pal = { L: '#b6cf8c', v: '#7f9c58', V: '#4a5f32', D: '#2b3a1c', k: '#141c0e', x: '#ff5252',
                '9': '#dcf0b4', X: '#ffe27a', ',': '#1a2412', ';': '#f4ffdc', '!': '#e8ffb0' };
  const map = { L: ['9', 'v'], v: ['L', 'V'], V: ['v', 'D'], D: ['V', 'k'], k: ['D', 'k'] };
  /* The funnel is a mouth that opens upward, and it is always a little open —
     which is the tell that it is loaded. */
  const face = { x: 0, y: 4, rows: [
    '      ,DkkkkkkkkkkkkD,          ',
    '      Dk!!kkkkkkkk!!kD          ',
    '      Dkk!!kkkkkk!!kkD          ',
    '      ,Dkk!!kkkk!!kkD,          ',
    '        ,DkkkkkkkkD,            ',
    '                                ',
    '     ,DkkD,          ,DkkD,     ',
    '     DkxXxkD        DkxXxkD     ',
    '     ,DkkD,          ,DkkD,     '
  ] };
  const t = t1 => shade(up2(t1), map);
  const body = [
    '......oooo......',
    '....ooLLLLoo....',
    '...oLvvvvvvLo...',
    '..oLvvvvvvvvLo..',
    '..oLvvvvvvvvLo..',
    '..oLvvvvvvvvLo..',
    '.oLvvvvvvvvvvLo.',
    '.oLvvvvvvvvvvLo.',
    '.oLvvvvvvvvvvLo.'
  ];
  SPR.anim.spitter = BANK(pal, CREATURE(map, body, face), [
    t(['.oLvvvvvvvvvvLo.', '..oLvvvvvvvvLo..', '..oVVo....oVVo..', '..oVo......oVo..', '..ooo......ooo..']),
    t(['.oLvvvvvvvvvvLo.', '..oLvvvvvvvvLo..', '.oVVo......oVVo.', '.oVo........oVo.', '.ooo........ooo.'])
  ], // it rears back to lob, and the sac goes bright
    t(['.oL99vvvvvv99Lo.', '..oL99vvvv99Lo..', '..oVVo....oVVo..', '.oVo........oVo.', '.ooo........ooo.']),
    { y: 0.5, sep: 3.0 }, { ss: 2 });
}

/* ---------- THE SHEPHERD 16x14 — it never touches you ----------
   Thin, upright, wearing a crown of spikes that breaks the outline at the top
   corners: the only silhouette in the game with anything above its own head.
   It makes everything around it worse. */
{
  const pal = { L: '#cbb6ff', c: '#9a7fd8', C: '#5c4590', D: '#33224f', k: '#150d22', x: '#ff5252',
                '9': '#e8dcff', X: '#ffe27a', ',': '#1d1330', ';': '#f6efff', '!': '#c8a8ff' };
  const map = { L: ['9', 'c'], c: ['L', 'C'], C: ['c', 'D'], D: ['C', 'k'], k: ['D', 'k'] };
  const face = { x: 0, y: 7, rows: [
    '        ,DkkD,    ,DkkD,        ',
    '        DkxXkD    DkxXkD        ',
    '        ,DkkD,    ,DkkD,        ',
    '                                ',
    '         ,DkkkkkkkkkkD,         ',
    '         Dkk!!!!!!!!kkD         ',
    '         ,DkkkkkkkkkkD,         '
  ] };
  const t = t1 => shade(up2(t1), map);
  const body = [
    '..o..oooooo..o..',
    '..oo.oLLLLo.oo..',
    '...ooLccccLoo...',
    '....oLccccLo....',
    '....oLccccLo....',
    '....oLccccLo....',
    '...oLccccccLo...',
    '...oLccccccLo...',
    '...oLccccccLo...'
  ];
  SPR.anim.shepherd = BANK(pal, CREATURE(map, body, face), [
    t(['...oLccccccLo...', '...oLccccccLo...', '...oCCo..oCCo...', '...oCo....oCo...', '...ooo....ooo...']),
    t(['...oLccccccLo...', '...oLccccccLo...', '..oCCo....oCCo..', '..oCo......oCo..', '..ooo......ooo..'])
  ], // it raises the crown and the room gets worse
    t(['...oL999999Lo...', '...oL999999Lo...', '..oCCo....oCCo..', '..oCo......oCo..', '..ooo......ooo..']),
    { y: -1.5, sep: 2.2 }, { ss: 2 });
}

/* ---------- BOSS A 26x24 — hulking, apron, sunken head ----------
   The head has sunk so far into the shoulders that the face has nowhere to
   go but wide. It is grinning. It has been grinning the whole time. */
{
  const pal = { L: '#b8555c', v: '#8f3944', V: '#54202a', D: '#33121a', u: '#ded8c6', U: '#a9a291', k: '#1c0d12', x: '#ff3b3b',
                '9': '#d4787e', X: '#ffcf6a', ',': '#260d13', ';': '#e89aa0' };
  const map = { L: ['9', 'v'], v: ['L', 'V'], V: ['v', 'D'], D: ['V', 'k'], k: ['D', 'k'] };
  const face = { x: 0, y: 6, rows: [
    '                 ,DDDDDD,  ,DDDDDD,                 ',
    '                 DkkkkkkD  DkkkkkkD                 ',
    '                 DkxXXXxD  DkxXXXxD                 ',
    '                 DkX;;XxD  DkX;;XxD                 ',
    '                 DkxXXXxD  DkxXXXxD                 ',
    '                 ,DkkkkD,  ,DkkkkD,                 ',
    '                    %%        %%                    ',
    '              ,DkkkkkkkkkkkkkkkkkkkkD,              ',
    '              Dk!k!k!k!k!k!k!k!k!k!kkD              ',
    '              Dkk!k!k!k!k!k!k!k!k!k!kD              ',
    '              ,DkkkkkkkkkkkkkkkkkkkkD,              ',
    '               %&DDDDDDDDDDDDDDDDDD&%               '
  ] };
  const t = t1 => shade(up2(t1), map);
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
  /* the apron. it was white once, and the stains are old enough to have
     layers — the dark ones underneath, the bright one from today. */
  const apron = [
    '',
    '',
    '',
    '',
    '                    %%##%%                          ',
    '                  ##%%##%%##                        ',
    '        ##        ##%%####%%##          ##          ',
    '      ##%%##        %%######%%        ##%%##        ',
    '      %%####%%        ##%%##        %%######        ',
    '        ##%%            %%            ##%%##        ',
    '                        ##                          '
  ];
  const t2 = (t1, ap) => ap ? stamp(shade(up2(t1), map), 0, 3, apron) : shade(up2(t1), map);
  SPR.anim.bossA = BANK(pal, CREATURE(map, body, face), [
    t2(['..oLvvvvvvvvvvvvvvvvvvLo..', '.oLvvvvvvvvvvvvvvvvvvvvLo.', 'oLvvvvvvvvvvvvvvvvvvvvvvLo', 'ovvvvvuuuuuuuuuuuuuuvvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '..ovvuuuuuuuuuuuuuuuuvvo..', '..ovvvuuuuuuuuuuuuuuvvvo..', '...ovvvvvvvvvvvvvvvvvvo...', '...oVVVVVo......oVVVVVo...', '....oVVVo........oVVVo....', '....ooooo........ooooo....'], 1),
    t2(['..oLvvvvvvvvvvvvvvvvvvLo..', '.oLvvvvvvvvvvvvvvvvvvvvLo.', 'oLvvvvvvvvvvvvvvvvvvvvvvLo', 'ovvvvvuuuuuuuuuuuuuuvvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '..ovvuuuuuuuuuuuuuuuuvvo..', '..ovvuuuuuuuuuuuuuuuuvvo..', '..ovvvuuuuuuuuuuuuuuvvvo..', '...ovvvvvvvvvvvvvvvvvvo...', '..oVVVVVo........oVVVVVo..', '..oVVVo............oVVVo..', '..ooooo............ooooo..'], 1)
  ], // rears up before it commits
    t2(['ooLvvvvvvvvvvvvvvvvvvvvLoo', 'oLLvvvvvvvvvvvvvvvvvvvvLLo', 'oLvvvvvvvvvvvvvvvvvvvvvvLo', 'ovvvvvuuuuuuuuuuuuuuvvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', 'ovvvvuuuuuuuuuuuuuuuuvvvvo', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '.ovvvuuuuuuuuuuuuuuuuvvvo.', '..ovvvuuuuuuuuuuuuuuvvvo..', '...ovvvvvvvvvvvvvvvvvvo...', '...oVVVVVVVVVVVVVVVVVVo...', '....oVVVVVVVVVVVVVVVVo....', '....oooooooooooooooooo....'], 1),
    { y: -7.5, sep: 2.5 }, { ss: 2 });
}

/* ---------- BOSS B 26x24 — bloated many-eyed sac ----------
   It has more eyes than it has room for and they do not all point the same
   way. When it wants to make more of itself the whole face opens. */
{
  const pal = { L: '#b6cf8c', c: '#8fae6a', C: '#4d6b38', D: '#2c3f20', u: '#ded8c6', k: '#170f12', x: '#ff3b3b',
                '9': '#d8ecb2', X: '#ffe27a', ',': '#1e2a16', ';': '#f4ffdc' };
  const map = { L: ['9', 'c'], c: ['L', 'C'], C: ['c', 'D'], D: ['C', 'k'], k: ['D', 'k'] };
  /* four eyes on the upper face, two of them looking somewhere else */
  const face = { x: 0, y: 9, rows: [
    '          ,DDDDDD,                ,DDDDDD,          ',
    '          DkxXXxkD                DkxXXxkD          ',
    '          DkX;;XkD                Dk;XX;kD          ',
    '          ,DkkkkD,                ,DkkkkD,          ',
    '             %%                      %%             ',
    '',
    '          ,DDDDDD,              ,DDDDDD,            ',
    '          DkxXXxkD              DkxXXxkD            ',
    '          Dk;XX;kD              DkX;;XkD            ',
    '          ,DkkkkD,              ,DkkkkD,            '
  ] };
  const t = t1 => shade(up2(t1), map);
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
  SPR.anim.bossB = BANK(pal, CREATURE(map, body, face), [
    t(['oLccccccccccccccccccccccLo', 'occcccCCcccccccccCCcccccco', 'occccccccccckkccccccccccco', 'occcccccccckkkkcccccccccco', 'occcccccccckkkkcccccccccco', 'occccccccccckkccccccccccco', 'occcccccccccccccccccccccco', 'occccCCccccccccccccCCcccco', '.occcccccccccccccccccccco.', '.occcccccccccccccccccccco.', '..occcccccccccccccccccco..', '...oCCCCo........oCCCCo...', '....oCCo..........oCCo....', '....oooo..........oooo....']),
    t(['oLccccccccccccccccccccccLo', 'occcccCCcccccccccCCcccccco', 'occcccccccccccccccccccccco', 'occccccccccckkccccccccccco', 'occccccccccckkccccccccccco', 'occcccccccccccccccccccccco', 'occcccccccccccccccccccccco', 'occccCCccccccccccccCCcccco', '.occcccccccccccccccccccco.', '..occcccccccccccccccccco..', '..occcccccccccccccccccco..', '..oCCCCo..........oCCCCo..', '..oCCo..............oCCo..', '..oooo..............oooo..'])
  ], // splits open to spawn — the seam runs the whole height of the sac
    stamp(t(['oLccccccccccccccccccccccLo', 'occcccCCcccccccccCCcccccco', 'occcccccccckkkkcccccccccco', 'occccccccckkkkkkccccccccco', 'occcccccckkkkkkkkcccccccco', 'occcccccckkkkkkkkcccccccco', 'occccccccckkkkkkccccccccco', 'occccCCcccckkkkccccCCcccco', '.occcccccccckkcccccccccco.', '.occcccccccccccccccccccco.', '..occcccccccccccccccccco..', '...oCCCCo........oCCCCo...', '....oCCo..........oCCo....', '....oooo..........oooo....']), 0, 2, [
      '                  ,Dk!k!k!k!kD,              ',
      '                 ,Dk!kkkkkkk!kD,             ',
      '                ,Dk!kk~~~~~~kk!kD,           ',
      '                Dk!kk~~%%%%~~kk!kD           ',
      '                Dkkk~~%%##%%~~kkkD           ',
      '                Dkkk~~%%##%%~~kkkD           ',
      '                ,Dk!kk~~%%%%~~k!kD,          ',
      '                 ,Dk!kk~~~~~~k!kD,           ',
      '                  ,Dk!kkkkkk!kD,             ',
      '                   ,Dk!k!k!k!kD,             '
    ]),
    { y: -6.5, sep: 6.0 }, { ss: 2 });
}

/* ============================================================
   THE REST OF THE ROSTER

   Ten bosses used to share two sprite banks and tell themselves apart with a
   colour wash. A tint is not a design — it says "this is the green one", and
   at twenty-six pixels across, colour is the first thing a dark room takes
   away from you. Every one of these is authored from its own SILHOUETTE, so
   you can name it from the shape alone before a single pixel of hue arrives.

   Same recipe as BOSS A and B: a palette, a value ramp for shade(), a 26-wide
   body mass at 1x, a face stamped at 2x, two walk tails and one special frame
   for whatever the thing does when it stops walking.
   ============================================================ */

/* ---------- THE PITCHER 26x24 — a glass vessel full of somebody ----------
   It came through the wall, and it is still carrying what it was carrying.
   The silhouette is a jug: shoulders, a belly, a foot. The face is not ON it,
   it is IN it — suspended in the red, looking out through the glass. */
{
  const pal = { L: '#eaf6ff', g: '#a9c9de', G: '#5f7b8f', D: '#33424e', k: '#141a20', x: '#ff3b3b',
                r: '#d4232c', R: '#7c1219', e: '#ff5b5b', b: '#6a5a4e', B: '#3d3229',
                '9': '#ffffff', X: '#ffcf6a', ',': '#1d262e', ';': '#dff2ff', '!': '#f4eede' };
  const map = { L: ['9', 'g'], g: ['L', 'G'], G: ['g', 'D'], D: ['G', 'k'], k: ['D', 'k'],
                r: ['e', 'R'], R: ['r', 'D'], b: ['b', 'B'], B: ['b', 'B'] };
  /* Drowned. The eyes and the grin sit under the surface, so they get the
     liquid's own dark rather than a keyline of their own. */
  const face = { x: 0, y: 10, rows: [
    '            ,DkkkkD,            ,DkkkkD,            ',
    '            DkxXXxkD            DkxXXxkD            ',
    '            Dk;XX;kD            Dk;XX;kD            ',
    '            ,DkkkkD,            ,DkkkkD,            ',
    '                                                    ',
    '              ,DkkkkkkkkkkkkkkkkkkkkD,              ',
    '              Dk!k!k!k!k!k!k!k!k!k!kkD              ',
    '              ,DkkkkkkkkkkkkkkkkkkkkD,              '
  ] };
  const t = t1 => shade(up2(t1), map);
  const body = [
    '.....oooooooooooooooo.....',
    '....oLLggggggggggggLLo....',
    '...oLggggggggggggggggLo...',
    '..oLggggggggggggggggggLo..',
    '..oLbbrrrrrrrrrrrrrrbbLo..',   // rubble on the shoulders, and the fill line
    '..oLgrrrrrrrrrrrrrrrrgLo..',
    '..oLgrrrrrrrrrrrrrrrrgLo..',
    '..oLgrrrrrrrrrrrrrrrrgLo..',
    '..oLggrrrrrrrrrrrrrrggLo..',
    '..oLggggggggggggggggggLo..'
  ];
  SPR.anim.pitcher = BANK(pal, CREATURE(map, body, face), [
    t(['..oLggggggggggggggggggLo..', '..oLggggggggggggggggggLo..', '..oLggggggggggggggggggLo..',
       '..oLggggggggggggggggggLo..', '..oLggggggggggggggggggLo..', '...oLggggggggggggggggLo...',
       '...oLggggggggggggggggLo...', '....oLggggggggggggggLo....', '....oLggggggggggggggLo....',
       '.....oGGGGo......oGGGGo...', '.....oGGo........oGGo.....', '.....oGGo........oGGo.....',
       '.....oooo........oooo.....', '..........................']),
    t(['..oLggggggggggggggggggLo..', '..oLggggggggggggggggggLo..', '..oLggggggggggggggggggLo..',
       '..oLggggggggggggggggggLo..', '..oLggggggggggggggggggLo..', '...oLggggggggggggggggLo...',
       '...oLggggggggggggggggLo...', '....oLggggggggggggggLo....', '....oLggggggggggggggLo....',
       '....oGGGGo........oGGGGo..', '....oGGo............oGGo..', '....oGGo............oGGo..',
       '....oooo............oooo..', '..........................'])
  ], // the blink: the glass goes bright at the rim a frame before it is elsewhere
    t(['..oLggggggggggggggggggLo..', '..oL9gggggggggggggggg9Lo..', '..oL9gggggggggggggggg9Lo..',
       '..oLggggggggggggggggggLo..', '..oL9gggggggggggggggg9Lo..', '..oL9gggggggggggggggg9Lo..',
       '...oLggggggggggggggggLo...', '...oLggggggggggggggggLo...', '...oLggggggggggggggggLo...',
       '..oGGGGo..........oGGGGo..', '..oGGo..............oGGo..', '..oGGo..............oGGo..',
       '..oooo..............oooo..', '..........................']),
    { y: -5.5, sep: 5.0 }, { ss: 2 });
}

/* ---------- THE HOGFATHER 26x24 — a head that outgrew its body ----------
   Ears out at the top corners and two tusks that leave the outline entirely,
   which is the whole silhouette: nothing else in the roster has anything
   pointing UP out of it. He is carrying something. He will put it down. */
{
  const pal = { L: '#f0b6b6', p: '#d08a8e', P: '#9a5257', D: '#5e2b30', k: '#1e0e11', x: '#ff3b3b',
                u: '#ded8c6', U: '#a9a291', y: '#f2d14a', Y: '#b2911f',
                '9': '#ffd9d9', X: '#ffcf6a', ',': '#2a1216', ';': '#ffe8e8', '!': '#f4eede' };
  const map = { L: ['9', 'p'], p: ['L', 'P'], P: ['p', 'D'], D: ['P', 'k'], k: ['D', 'k'],
                u: ['u', 'U'], U: ['u', 'U'], y: ['y', 'Y'], Y: ['y', 'Y'] };
  /* Small eyes set deep and far apart, and a brass ring through the snout —
     the one bright warm thing on him, and it sits dead centre. */
  const face = { x: 0, y: 8, rows: [
    '        ,DkkkkD,              ,DkkkkD,              ',
    '        DkxXXxkD              DkxXXxkD              ',
    '        ,DkkkkD,              ,DkkkkD,              ',
    '                                                    ',
    '                    ,DkkkkkkkkD,                    ',
    '                    DkkyyyyyykkD                    ',
    '                    Dky,,,,,,ykD                    ',
    '                    DkkyyyyyykkD                    ',
    '                    ,DkkkkkkkkD,                    '
  ] };
  const t = t1 => shade(up2(t1), map);
  const body = [
    '..oPo..oooooooooooo..oPo..',
    '..oPo.oLLppppppppLLo.oPo..',
    '..ooo.oLppppppppppLo.ooo..',
    '..oLppppppppppppppppppLo..',
    '..oLppxppppppppppppxppLo..',
    '..oLppppppppppppppppppLo..',
    '..oLppkkkkkkkkkkkkkkppLo..',
    '..oLpkkuu!!!!!!!!uukkpLo..',   // the snout, and what is in it
    '..oLppkkuu!!!!!!uukkppLo..',
    '..oLppppppppppppppppppLo..'
  ];
  SPR.anim.hogfather = BANK(pal, CREATURE(map, body, face), [
    t(['uu..oLppppppppppppppLo..uu', '.uu.oLppppppppppppppLo.uu.', '..uuoLppppppppppppppLouu..',
       '....oLppppppppppppppLo....', '....oLppppppppppppppLo....', '....oLppppppppppppppLo....',
       '.....oLppppppppppppLo.....', '.....oLppppppppppppLo.....', '.....oLppppppppppppLo.....',
       '.....oPPPo......oPPPo.....', '.....oPPo........oPPo.....', '.....oPPo........oPPo.....',
       '.....oooo........oooo.....', '..........................']),
    t(['uu..oLppppppppppppppLo..uu', '.uu.oLppppppppppppppLo.uu.', '..uuoLppppppppppppppLouu..',
       '....oLppppppppppppppLo....', '....oLppppppppppppppLo....', '....oLppppppppppppppLo....',
       '.....oLppppppppppppLo.....', '.....oLppppppppppppLo.....', '.....oLppppppppppppLo.....',
       '....oPPPo..........oPPPo..', '....oPPo............oPPo..', '....oPPo............oPPo..',
       '....oooo............oooo..', '..........................'])
  ], // he puts it down: braced, both feet planted, tusks forward
    t(['uu..oLppppppppppppppLo..uu', 'uuu.oLppppppppppppppLo.uuu', 'uuuuoLppppppppppppppLouuuu',
       '.uu.oLppppppppppppppLo.uu.', '....oLppppppppppppppLo....', '....oLppppppppppppppLo....',
       '....oLppppppppppppppLo....', '....oLppppppppppppppLo....', '...oLpppppppppppppppppLo..',
       '...oPPPPo........oPPPPo...', '...oPPo..............oPPo.', '...oPPo..............oPPo.',
       '...oooo..............oooo.', '..........................']),
    { y: -6.5, sep: 5.5 }, { ss: 2 });
}

/* ---------- THE COURIER 26x24 — it does not have legs ----------
   A narrow visored torso over one big spoked wheel. It is the only thing in
   the game whose lower half is a circle, which is why it reads instantly at
   any size and why it is the one you can identify while it is still circling
   the far side of the room. */
{
  const pal = { L: '#a8d8ff', c: '#5aa8dc', C: '#2c6088', D: '#173044', k: '#0b1620', x: '#ff3b3b',
                T: '#c8ccd4', G: '#31363d', y: '#f2d14a',
                '9': '#e0f4ff', X: '#ffcf6a', ',': '#101f2b', ';': '#eaffff', '!': '#f4eede' };
  const map = { L: ['9', 'c'], c: ['L', 'C'], C: ['c', 'D'], D: ['C', 'k'], k: ['D', 'k'],
                T: ['T', 'G'], G: ['T', 'G'] };
  /* No eyes — a visor. One unbroken lit slit, which is more unsettling at this
     size than any number of sockets because you cannot tell where it is
     looking, only that it is. */
  const face = { x: 0, y: 8, rows: [
    '                    ,DkkkkkkkkD,                    ',
    '                  ,DkkkkkkkkkkkkkkD,                ',
    '                  DkxXXXXXXXXXXXXxkD                ',
    '                  Dk;XXXXXXXXXXXX;kD                ',
    '                  ,DkkkkkkkkkkkkkkD,                '
  ] };
  const t = t1 => shade(up2(t1), map);
  const body = [
    '........oooooooooo........',
    '.......oLLccccccLLo.......',
    '......oLccccccccccLo......',
    '.....oLccccccccccccLo.....',
    '.....oLkkkkkkkkkkkkLo.....',
    '.....oLkkkkkkkkkkkkLo.....',
    '.....oLkkkkkkkkkkkkLo.....',
    '....oLccccccccccccccLo....',
    '....oLccccTTTTTTccccLo....',   // the strap
    '....oLccccccccccccccLo....'
  ];
  SPR.anim.courier = BANK(pal, CREATURE(map, body, face), [
    t(['....oLccccccccccccccLo....', '....oLccccccccccccccLo....', '.....oLccccccccccccLo.....',
       '.....oLccccccccccccLo.....', '....oooTTTTTTTTTTTTooo....', '....oTTGGGGGGGGGGGGTTo....',
       '....oTGGGkkkkkkkkGGGTo....', '....oTGGkkkkkkkkkkGGTo....', '....oTGGkkkkkkkkkkGGTo....',
       '....oTGGGkkkkkkkkGGGTo....', '....oTTGGGGGGGGGGGGTTo....', '....oooTTTTTTTTTTTTooo....',
       '......oooooooooooooo......', '..........................']),
    t(['....oLccccccccccccccLo....', '....oLccccccccccccccLo....', '.....oLccccccccccccLo.....',
       '.....oLccccccccccccLo.....', '....oooTTTTTTTTTTTTooo....', '....oTTGGGGGGGGGGGGTTo....',
       '....oTGGkGGGGGGGGkGGTo....', '....oTGGGkkkkkkkkGGGTo....', '....oTGGGkkkkkkkkGGGTo....',
       '....oTGGkGGGGGGGGkGGTo....', '....oTTGGGGGGGGGGGGTTo....', '....oooTTTTTTTTTTTTooo....',
       '......oooooooooooooo......', '..........................'])
  ], // it plants: the wheel locks and the rim lights
    t(['....oLccccccccccccccLo....', '....oLccccccccccccccLo....', '.....oLccccccccccccLo.....',
       '.....oLccccccccccccLo.....', '....ooo999999999999ooo....', '....o99GGGGGGGGGGGG99o....',
       '....o9GGkkkkkkkkkkGG9o....', '....o9GkkkkkkkkkkkkG9o....', '....o9GkkkkkkkkkkkkG9o....',
       '....o9GGkkkkkkkkkkGG9o....', '....o99GGGGGGGGGGGG99o....', '....ooo999999999999ooo....',
       '......oooooooooooooo......', '..........................']),
    { y: -5.0, sep: 0 }, { ss: 2 });
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
   THE DETAIL PASS

   Hardware gets bevelled rather than redrawn. Guns and props were plotted at
   1x for silhouette, and a silhouette is still the right thing to read a gun
   by across a dark room — but at 2x the same outline can carry a lit top
   edge, a shadowed underside and a specular line down the barrel without any
   of it changing shape.

   Deliberately not on this list: the sigil and the nova, whose colours mean
   something, and the joke groceries, which are funnier flat.
   ============================================================ */
const PROP_MAP = {
  g: ['=', 'G'], G: ['g', 'G'], T: ['X', 'g'], X: ['T', 'g'],
  y: ['+', 'Y'], Y: ['y', 'Y'], b: ['b', 'B'], B: ['b', 'B'],
  u: ['+', 'U'], U: ['u', 'U'], z: ['i', 'Z'], Z: ['z', 'Z'],
  M: ['M', 'W'], W: ['M', 'W'], O: ['O', 'A'], A: ['O', 'A'],
  E: ['E', 'D'], D: ['E', 'D'], K: ['K', 'L'], L: ['K', 'L'],
  n: ['n', 'N'], N: ['n', 'N'], w: ['w', 'U']
};
for (const k of ['scar', 'saw', 'nail', 'micro', 'hog', 'rail', 'omega', 'pistol',
                 'zap', 'void',
                 'price', 'chill', 'rot', 'mag', 'grenade', 'coin', 'card',
                 'shield', 'pedestal', 'ammo', 'medkit']) {
  const s = SPR[k];
  SPR[k] = SPRITE(shade(up2(s.rows), PROP_MAP), s.pal, { ss: 2 });
}

/* ============================================================
   Renderer: pre-bakes every sprite (and flip/tint variants)
   into offscreen canvases so we never fillRect per pixel.
   ============================================================ */
const _cache = new Map();

const _hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function _mixN(cols) {
  let r = 0, g = 0, b = 0;
  for (const c of cols) { const v = _hex(c); r += v[0]; g += v[1]; b += v[2]; }
  const n = cols.length;
  return 'rgba(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ',';
}

function _bake(spr, flip, tint) {
  const c = document.createElement('canvas');
  c.width = spr.w; c.height = spr.h;
  const g = c.getContext('2d');
  const pal = spr.pal ? Object.assign({}, PAL, spr.pal) : PAL;
  const grid = [];
  for (let y = 0; y < spr.h; y++) {
    const row = spr.rows[y], gr = [];
    for (let x = 0; x < spr.w; x++) {
      const col = pal[row[x]] || null;
      gr.push(col);
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(flip ? spr.w - 1 - x : x, y, 1, 1);
    }
    grid.push(gr);
  }
  /* Sub-pixel AA, applied selectively.
     A transparent cell with a single opaque neighbour sits on a straight edge
     and is left alone — softening those would just fatten the silhouette. A
     transparent cell with two or more opaque neighbours is the notch in a
     staircase, and gets a partial-coverage blend of them. That is the same
     call a pixel artist makes by hand, and at ss:2 it lands on a half game
     pixel, so the step is smoothed below the resolution of the grid itself. */
  if (spr.aa) {
    for (let y = 0; y < spr.h; y++) {
      for (let x = 0; x < spr.w; x++) {
        if (grid[y][x]) continue;
        const nb = [];
        if (y > 0 && grid[y - 1][x]) nb.push(grid[y - 1][x]);
        if (y < spr.h - 1 && grid[y + 1][x]) nb.push(grid[y + 1][x]);
        if (x > 0 && grid[y][x - 1]) nb.push(grid[y][x - 1]);
        if (x < spr.w - 1 && grid[y][x + 1]) nb.push(grid[y][x + 1]);
        if (nb.length < 2) continue;
        g.fillStyle = _mixN(nb) + (nb.length > 2 ? 0.7 : 0.5) + ')';
        g.fillRect(flip ? spr.w - 1 - x : x, y, 1, 1);
      }
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

/* The world backing store is denser than the logical grid, so positions snap
   to the render grid rather than to whole game units — otherwise every 2x
   sprite would be quantised straight back down to 1x placement. */
let SUBPIX = 1;
function setSubpix(n) { SUBPIX = n || 1; }
const snap = v => Math.round(v * SUBPIX) / SUBPIX;

/** Draw a sprite centered at (x,y) in world/screen space. */
function drawSpr(ctx, spr, x, y, scale, flip, alpha, tint) {
  scale = (scale || 1) / spr.ss;
  const c = sheet(spr, flip, tint);
  const w = spr.w * scale, h = spr.h * scale;
  if (alpha !== undefined && alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.drawImage(c, snap(x - w / 2), snap(y - h / 2), w, h);
  if (alpha !== undefined && alpha !== 1) ctx.restore();
}

/** Palette-swapped clone of a sprite (cosmetics). Cached so IDs stay stable. */
const _variants = new Map();
function variant(spr, key, palOverride) {
  const id = (spr._id || (spr._id = 'S' + (sheet._n = (sheet._n || 0) + 1))) + '::' + key;
  let v = _variants.get(id);
  if (!v) {
    v = SPRITE(spr.rows, Object.assign({}, spr.pal || {}, palOverride), { ss: spr.ss, aa: spr.aa });
    _variants.set(id, v);
  }
  return v;
}

/** Draw rotated around a pivot expressed in sprite-pixel coords. */
function drawSprRot(ctx, spr, x, y, ang, scale, px, py, flipY, tint) {
  scale = (scale || 1) / spr.ss;
  const c = sheet(spr, false, tint);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (flipY) ctx.scale(1, -1);
  ctx.drawImage(c, -px * spr.ss * scale, -py * spr.ss * scale, spr.w * scale, spr.h * scale);
  ctx.restore();
}
