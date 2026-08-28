/* ============================================================
   Builds the desktop app.

     node build.js              stage the game and package the Windows app
     node build.js --min        ...stripping comments and whitespace first
     node build.js --no-exe     stage dist/ only, package nothing
     node build.js --browser    also zip dist/ as a play-in-page build

   Output lands in ONE place:

     release/MEAT-PROTOCOL-windows.zip     unzip it, run the exe

   dist/ is an intermediate, not a deliverable: it is what the app is
   assembled from. The browser zip is opt-in because it is not the product.

   What is deliberately left out of the build: docs/, serve.js, build.js
   itself, README.md, .git. None of it is needed to run the game, and docs/ is
   the whole design record.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
/* Everything anyone is meant to upload ends up in ONE folder with names that
   say what they are. Two zips in two different trees, one of them four levels
   down next to a folder called win-unpacked, is a good way to upload the wrong
   file. */
const RELEASE = path.join(ROOT, 'release');
const ZIP = path.join(RELEASE, 'MEAT-PROTOCOL-browser.zip');
const MIN = process.argv.includes('--min');
/* The desktop app is the product. The browser zip is off by default now --
   dist/ is still built, because it is what the app is assembled FROM, but
   nobody wants a second artifact they are never going to upload. */
const EXE = !process.argv.includes('--no-exe');
const BROWSER_ZIP = process.argv.includes('--browser');
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

/* ---- the icon, stamped onto the .exe ourselves ----

   electron-builder will do this, but only as part of "sign and edit
   executable", which pulls in the winCodeSign toolchain -- and unpacking that
   creates macOS symlinks, which Windows refuses without Developer Mode. Asking
   for it does not degrade, it kills the whole package.

   The tool it would have used is rcedit, and rcedit itself extracts fine: the
   archive only fails on the darwin symlinks, well after rcedit is on disk. So
   we find it and run it directly, which needs no privilege at all.

   Located by search rather than a fixed path because electron-builder unpacks
   into a freshly randomised folder name on every run. */
function findRcedit() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base)) {
    const p = path.join(base, dir, 'rcedit-x64.exe');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function stampIcon(exe, ico) {
  const rc = findRcedit();
  if (!rc) { console.log('  no rcedit found — the exe keeps the default Electron icon'); return false; }
  try {
    execFileSync(rc, [exe, '--set-icon', ico], { stdio: ['ignore', 'ignore', 'pipe'] });
    return true;
  } catch (e) {
    console.log('  rcedit failed — the exe keeps the default Electron icon');
    return false;
  }
}

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
if (BROWSER_ZIP) {
fs.mkdirSync(RELEASE, { recursive: true });
try {
  execFileSync('powershell', ['-NoProfile', '-Command',
    'Compress-Archive -Path "' + path.join(DIST, '*') + '" -DestinationPath "' + ZIP + '" -Force'],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('browser  release/' + path.basename(ZIP) + '  ' + (fs.statSync(ZIP).size / 1048576).toFixed(2) + ' MB');
} catch (e) {
  console.log('could not zip dist/ — zip its CONTENTS yourself if you want it,');
  console.log('so that index.html sits at the root of the archive.');
}
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

      /* electron-builder is set to the "dir" target, so it produces the folder
         and stops. The icon goes on here, and the zip is made after -- in that
         order, or the archive carries an exe with the wrong icon in it. */
      const unpacked = path.join(DESKTOP, 'release', 'win-unpacked');
      const exe = path.join(unpacked, 'MEAT PROTOCOL.exe');
      if (!fs.existsSync(exe)) {
        console.log('');
        console.log('expected ' + exe + ' and it is not there.');
      } else {
        if (stampIcon(exe, path.join(DESKTOP, 'icon.ico'))) console.log('  icon stamped onto the exe');

        const dest = path.join(RELEASE, 'MEAT-PROTOCOL-windows.zip');
        fs.mkdirSync(RELEASE, { recursive: true });
        rmrf(dest);
        execFileSync('powershell', ['-NoProfile', '-Command',
          'Compress-Archive -Path "' + path.join(unpacked, '*') + '" -DestinationPath "' + dest + '" -Force'],
          { stdio: ['ignore', 'ignore', 'inherit'] });
        console.log('');
        console.log('release/MEAT-PROTOCOL-windows.zip  ' +
                    (fs.statSync(dest).size / 1048576).toFixed(1) + ' MB');
      }
    } catch (e) {
      console.log('');
      console.log('packaging failed — dist/ and the browser zip are still good.');
    }
  }
}
