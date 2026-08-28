/* ============================================================
   Builds dist/ — the game and nothing else — and zips it for itch.io.

     node build.js             copy only
     node build.js --min       strip comments and whitespace from the JS too
     node build.js --min --exe ...and package the desktop build as well

   Both targets are built from the SAME dist/. The desktop shell serves it over
   loopback rather than embedding a second copy of the game, so the .exe and
   the itch upload are running identical bytes -- there is no version of this
   where one of them is a build behind.

   itch.io wants a zip with index.html at its ROOT, which is what this makes.

   What is deliberately left out: docs/, serve.js, README.md, build.js itself,
   .git, .claude. None of it is needed to run the game, and docs/ in particular
   is the whole design record — no reason to ship it inside the playable build.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ZIP = path.join(ROOT, 'meat-protocol-itch.zip');
const MIN = process.argv.includes('--min');
const EXE = process.argv.includes('--exe');
const DESKTOP = path.join(ROOT, 'desktop');

/* Everything the browser actually asks for, and the two licence files that
   have to travel with it. */
const FILES = ['index.html', 'LICENSE', 'OFL.txt'];
const DIRS = {
  js: f => f.endsWith('.js'),
  /* the manifest and the tracks it names — not audio/README.md */
  audio: f => f.endsWith('.mp3') || f.endsWith('.ogg') || f.endsWith('.wav') || f === 'tracks.json',
  /* fonts/ currently holds only a README; if real font files land there they
     ship, and the README still does not */
  fonts: f => /\.(woff2?|ttf|otf)$/i.test(f)
};

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }

/* Whitespace and syntax only -- NOT identifiers. These are plain scripts, not
   modules: `const MUSIC`, `const A` and the rest are genuine globals that the
   other files reach across for. Renaming them is exactly the kind of build
   step that produces a dist which loads and then throws. Comments are what we
   actually wanted gone, and --minify-whitespace takes those. */
function minify(src, dest) {
  /* On Windows npx is npx.cmd, and since Node's CVE-2024-27980 fix, spawning a
     .cmd without a shell fails outright with EINVAL. So a shell it is -- with
     the paths quoted here rather than handed to Node as loose arguments, which
     is the thing the shell:true deprecation warning is actually about. */
  const q = p => '"' + p + '"';
  const cmd = ['npx --yes esbuild', q(src),
               '--minify-whitespace', '--minify-syntax',
               '--legal-comments=inline',        // keeps the /*! copyright header
               '--outfile=' + q(dest)].join(' ');
  try {
    execSync(cmd, { stdio: ['ignore', 'ignore', 'pipe'] });
    /* Trust nothing: a "successful" minify that did not shrink the file, or
       produced nothing at all, is a broken build that would only show up as a
       blank page on itch. */
    if (!fs.existsSync(dest) || fs.statSync(dest).size >= fs.statSync(src).size) {
      throw new Error('output was not smaller than the input');
    }
    return true;
  } catch (e) {
    console.log('  ! minify failed for ' + path.basename(src) + ' — shipping it unminified');
    const err = String(e.stderr || e.message || '').trim();
    if (err) console.log('    ' + err.slice(0, 200));
    fs.copyFileSync(src, dest);
    return false;
  }
}

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });

let n = 0, bytes = 0, minified = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.log('  missing, skipped: ' + f); continue; }
  fs.copyFileSync(src, path.join(DIST, f));
  n++; bytes += fs.statSync(src).size;
}

for (const [dir, keep] of Object.entries(DIRS)) {
  const from = path.join(ROOT, dir);
  if (!fs.existsSync(from)) continue;
  const names = fs.readdirSync(from).filter(keep);
  if (!names.length) continue;
  fs.mkdirSync(path.join(DIST, dir), { recursive: true });
  for (const f of names) {
    const src = path.join(from, f), dest = path.join(DIST, dir, f);
    if (MIN && f.endsWith('.js')) { if (minify(src, dest)) minified++; }
    else fs.copyFileSync(src, dest);
    n++; bytes += fs.statSync(dest).size;
  }
}

console.log('dist/  ' + n + ' files, ' + (bytes / 1048576).toFixed(2) + ' MB' +
            (MIN ? '  (' + minified + ' js minified)' : ''));

/* Compress-Archive rather than a zip dependency, because this project does not
   have dependencies and is not about to grow one for a build step. */
rmrf(ZIP);
try {
  execFileSync('powershell', ['-NoProfile', '-Command',
    'Compress-Archive -Path "' + path.join(DIST, '*') + '" -DestinationPath "' + ZIP + '" -Force'],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('zip    ' + path.basename(ZIP) + '  ' + (fs.statSync(ZIP).size / 1048576).toFixed(2) + ' MB');
  console.log('\nUpload that to itch.io and tick "This file will be played in the browser".');
} catch (e) {
  console.log('\ndist/ is ready. Could not zip it automatically — zip the CONTENTS');
  console.log('of dist/ yourself, so that index.html sits at the root of the archive.');
}

/* ---- the desktop build ----
   Stages dist/ into desktop/game/ and lets electron-builder wrap it. Skipped
   unless asked for, because it needs desktop/node_modules and takes minutes,
   and most builds are only the browser one.

   Both targets come from the SAME dist/, and the desktop shell serves that
   copy over loopback rather than embedding a second one -- so the .exe and
   the itch upload are running identical bytes. There is no version of this
   where one of them is a build behind the other. */
if (EXE) {
  if (!fs.existsSync(path.join(DESKTOP, 'node_modules'))) {
    console.log('');
    console.log('desktop/node_modules is missing — run "npm install" inside desktop/ first.');
  } else {
    const stage = path.join(DESKTOP, 'game');
    rmrf(stage);
    fs.cpSync(DIST, stage, { recursive: true });
    console.log('');
    console.log('staged dist/ into desktop/game/, packaging…');
    try {
      execSync('npm run pack', { cwd: DESKTOP, stdio: 'inherit' });
      const exe = path.join(DESKTOP, 'release', 'MEAT-PROTOCOL.exe');
      if (fs.existsSync(exe)) {
        console.log('');
        console.log('exe    ' + exe + '  ' + (fs.statSync(exe).size / 1048576).toFixed(1) + ' MB');
      }
    } catch (e) {
      console.log('');
      console.log('packaging failed — dist/ and the browser zip are still good.');
    }
  }
}
