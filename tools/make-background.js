/* ============================================================
   Generates release/store-art/background.png — the page backdrop.

     node tools/make-background.js

   Built rather than captured, because a store background has a different job
   from a screenshot: it sits BEHIND text, so it has to stay dark, stay flat,
   and never compete. A gameplay frame tiled behind a description is unreadable.

   So this is the game's own palette with nothing in it: the near-black the
   page uses, the red the wordmark bleeds, the grain the post pass lays over
   every frame, and a vignette to keep the edges quiet.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./png');

const W = 1920, H = 1080;

const BASE = [0x0a, 0x06, 0x10];   // the page background
const GLOW = [0x8c, 0x0a, 0x16];   // the red the wordmark sits in

/* Deterministic noise, so re-running gives the same file rather than a fresh
   binary in every diff. */
let seed = 0x9e3779b9;
function rnd() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return ((seed >>> 0) % 10000) / 10000;
}

const rgba = Buffer.alloc(W * H * 4);

/* Grain is generated in 2x2 blocks. Per-pixel noise is the single worst thing
   you can do to PNG compression -- this way the file stays a few hundred KB
   instead of several MB, and at this amplitude the difference is invisible. */
const GW = Math.ceil(W / 2), GH = Math.ceil(H / 2);
const grain = new Int8Array(GW * GH);
for (let i = 0; i < grain.length; i++) grain[i] = Math.round((rnd() - 0.5) * 13);

for (let y = 0; y < H; y++) {
  const ny = y / H;
  for (let x = 0; x < W; x++) {
    const nx = x / W;

    /* One soft red bloom up where a page header sits, falling off fast. */
    const dx = (nx - 0.5) * 1.35, dy = (ny - 0.10) * 1.9;
    const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.15) ** 2.4 * 0.5;

    /* Vignette: quiet the corners so text never sits on the brightest part. */
    const vx = (nx - 0.5) * 2, vy = (ny - 0.5) * 2;
    const vig = 1 - Math.min(1, (vx * vx + vy * vy) * 0.30);

    const g = grain[((y >> 1) * GW) + (x >> 1)];
    const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) {
      let v = BASE[c] + (GLOW[c] - BASE[c]) * glow;
      v = v * (0.72 + vig * 0.28) + g;
      rgba[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    rgba[i + 3] = 255;
  }
}

const out = path.join(__dirname, '..', 'release', 'store-art', 'background.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePNG(W, H, rgba));
console.log('background.png  ' + W + 'x' + H + '  ' +
            (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
