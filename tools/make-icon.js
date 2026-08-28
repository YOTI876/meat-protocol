/* ============================================================
   Generates desktop/icon.ico — a red M on near-black.

     node tools/make-icon.js

   Written out by hand rather than pulled from a drawing tool, for the same
   reason the rest of this project has no dependencies: the icon is six sizes
   of four straight strokes, and a script that regenerates it is smaller than
   the binary it produces and a great deal easier to change.

   Everything here is stdlib. PNG is deflate (zlib) plus four chunks; ICO is a
   header and a directory pointing at PNG payloads, which Windows has accepted
   since Vista.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0f, 0x06, 0x0d];        // near-black, a shade off the page background
const RED = [0xe0, 0x22, 0x2c];       // the wordmark red
const GLOW = [0x8c, 0x0a, 0x14];      // what the wordmark bleeds on the boot screen

/* ---------- CRC32, because PNG chunks each carry one ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/* RGBA pixels -> a PNG file */
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                       // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- the M ----------
   Four strokes in a 0..1 box: two uprights and two diagonals meeting in the
   middle. Drawn as distance-to-segment rather than filled polygons, which
   gives clean antialiased edges for free and stays legible at 16px. */
const STROKES = [
  [0.20, 0.19, 0.20, 0.81],   // left upright
  [0.80, 0.19, 0.80, 0.81],   // right upright
  [0.20, 0.19, 0.50, 0.62],   // left diagonal
  [0.80, 0.19, 0.50, 0.62]    // right diagonal
];

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const half = (size < 32 ? 0.115 : 0.10) * size;   // fatter at small sizes or it vanishes
  const r = size * 0.16;                            // corner radius of the tile
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;

      /* rounded-square tile, antialiased at the corners */
      const qx = Math.abs(px - size / 2) - (size / 2 - r);
      const qy = Math.abs(py - size / 2) - (size / 2 - r);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
      const tile = Math.max(0, Math.min(1, 0.5 - outside));

      /* the strokes */
      let d = Infinity;
      for (const s of STROKES) {
        d = Math.min(d, distToSeg(px / size, py / size, s[0], s[1], s[2], s[3]) * size);
      }
      const ink = Math.max(0, Math.min(1, half - d + 0.5));
      // a little bloom around the letter, the way the boot screen wordmark sits
      const bloom = Math.max(0, Math.min(1, (half * 2.2 - d) / (half * 2.2))) * 0.45;

      const bg = [
        BG[0] + (GLOW[0] - BG[0]) * bloom,
        BG[1] + (GLOW[1] - BG[1]) * bloom,
        BG[2] + (GLOW[2] - BG[2]) * bloom
      ];
      const i = (y * size + x) * 4;
      rgba[i]     = Math.round(bg[0] + (RED[0] - bg[0]) * ink);
      rgba[i + 1] = Math.round(bg[1] + (RED[1] - bg[1]) * ink);
      rgba[i + 2] = Math.round(bg[2] + (RED[2] - bg[2]) * ink);
      rgba[i + 3] = Math.round(255 * tile);
    }
  }
  return png(size, size, rgba);
}

/* ---------- ICO container ---------- */
const SIZES = [16, 32, 48, 64, 128, 256];
const images = SIZES.map(render);

const dir = Buffer.alloc(6 + 16 * images.length);
dir.writeUInt16LE(0, 0);                  // reserved
dir.writeUInt16LE(1, 2);                  // type: icon
dir.writeUInt16LE(images.length, 4);
let offset = dir.length;
images.forEach((img, i) => {
  const e = 6 + i * 16;
  dir[e] = SIZES[i] === 256 ? 0 : SIZES[i];        // 0 means 256
  dir[e + 1] = SIZES[i] === 256 ? 0 : SIZES[i];
  dir[e + 2] = 0;                                   // palette size
  dir[e + 3] = 0;                                   // reserved
  dir.writeUInt16LE(1, e + 4);                      // colour planes
  dir.writeUInt16LE(32, e + 6);                     // bits per pixel
  dir.writeUInt32LE(img.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += img.length;
});

const out = path.join(__dirname, '..', 'desktop', 'icon.ico');
fs.writeFileSync(out, Buffer.concat([dir, ...images]));
console.log('icon.ico  ' + SIZES.join('/') + 'px  ' + fs.statSync(out).size + ' bytes');
