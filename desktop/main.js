/* ============================================================
   DAMJAN: MEAT PROTOCOL — desktop shell.

   The game itself is untouched. This is a window with the same page in it.

   WHY THERE IS A LOOPBACK SERVER AND NOT loadFile()

   The obvious thing is `win.loadFile('game/index.html')`, and it does not
   work: that loads over file://, where `fetch('audio/tracks.json')` is
   blocked as a cross-origin request. The music manifest would fail, every
   track would fall back to the synth, and the game would quietly lose the
   thing it was just given.

   A custom protocol handler fixes the fetch and then breaks something else:
   <audio> elements need HTTP range requests to seek and to loop cleanly, and
   a naive protocol handler does not serve ranges.

   So: a real HTTP server, bound to 127.0.0.1 on an ephemeral port. It serves
   the same bytes the browser build serves, with the same semantics, which
   means the desktop build and the itch build are running the identical thing
   rather than two subtly different things.

   Bound to loopback ONLY. It is not reachable from the network, and binding
   to 127.0.0.1 does not raise the Windows Firewall dialog that binding to
   0.0.0.0 would.
   ============================================================ */
const { app, BrowserWindow, Menu, shell, nativeImage } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'game');
const SELFTEST = process.argv.includes('--selftest');
/* --shots <dir> drives the game into a few interesting states and captures the
   window to PNGs. Store pages want screenshots, and the honest way to get them
   is from the real build rather than a mock-up. */
const SHOTS = process.argv.indexOf('--shots');
const SHOTS_DIR = SHOTS >= 0 ? (process.argv[SHOTS + 1] || '.') : null;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf'
};

/* Range support, because <audio loop> asks for one. Without it a track plays
   once and then behaves oddly at the loop point. */
function serve(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= st.size) end = st.size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1
      });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(serve);
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + srv.address().port + '/'));
  });
}

/* The game asks for a click before it makes any sound, so nothing here needs
   to fight the autoplay policy -- but Chromium will not let the AudioContext
   start at all in some configurations without this. */
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(async () => {
  const url = await startServer();

  const win = new BrowserWindow({
    width: 1280, height: 720,
    minWidth: 640, minHeight: 400,
    backgroundColor: '#05030a',          // matches the page, so no white flash on open
    title: 'DAMJAN: MEAT PROTOCOL',
    /* Set here as well as in the packaging config. Writing an icon INTO the
       .exe needs executable-resource editing, which needs the winCodeSign
       toolchain, which needs symlink privileges Windows withholds without
       Developer Mode. This path needs none of that and is what the window and
       the taskbar actually read, so the running game is branded either way. */
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  Menu.setApplicationMenu(null);         // it is a game, not a document
  win.once('ready-to-show', () => { if (!SELFTEST) win.show(); });

  /* A game should not become a browser. Anything trying to open a new window
     or navigate away goes to the real browser instead. */
  win.webContents.setWindowOpenHandler(({ url: u }) => { shell.openExternal(u); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, u) => {
    if (!u.startsWith(url)) { e.preventDefault(); shell.openExternal(u); }
  });

  await win.loadURL(url);

  if (SHOTS_DIR) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const js = code => win.webContents.executeJavaScript(code, true);
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    await wait(1800);
    await js("document.dispatchEvent(new MouseEvent('click',{bubbles:true})),1");  // past the boot screen
    await wait(1200);

    /* Each scene sets the game up, lets the real loop render it for a moment,
       then captures. Nothing is faked -- these are frames the game drew. */
    /* Damjan cannot fight back while this runs -- there is no input -- so on a
       deep floor he is swarmed and dead within seconds, and the first attempt
       captured an empty health bar because of it. Every gameplay scene tops
       him back up immediately before the shutter. */
    const HEAL = "MEAT.S.p.hp = MEAT.ST().maxhp; MEAT.S.mode='play'; MEAT.S.upgPts=0; 1";

    const scenes = [
      ['01-title',  "MEAT.S.mode='title',1", 1400, false],
      ['02-floor1', "MEAT.startRun(); MEAT.startWave(2); 1", 2400, true],
      ['03-deep',   "MEAT.startRun(); MEAT.S.room=6; MEAT.buildRoom(6); MEAT.startWave(4); MEAT.gainXP(26); 1", 2600, true],
      ['04-menu',   "MEAT.startRun(); MEAT.S.upgPts=1; MEAT.openLevelUp(); 1", 1600, false],
      /* spawnBoss takes an index -- spawnBoss() with none threw, so the first
         run never had a boss at all, which is why no name was drawn. The name
         is a msg() banner, so the capture has to land while it is still up. */
      ['05-boss',   "MEAT.startRun(); MEAT.S.room=4; MEAT.buildRoom(4); MEAT.spawnBoss(2); 1", 1800, true]
    ];
    for (const [name, code, settle, heal] of scenes) {
      try { await js(code); } catch (err) { console.log(name + ': ' + err.message); }
      await wait(settle);
      if (heal) { try { await js(HEAL); } catch (err) {} await wait(120); }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SHOTS_DIR, name + '.png'), img.toPNG());
      console.log('shot ' + name + '  ' + img.getSize().width + 'x' + img.getSize().height);
    }

    /* The cover and the banner both come off the title screen.

       The cover is 630x500 (1.26:1). The first version of this took the FULL
       height of the frame, and it read as a black rectangle: a browse listing
       gives a cover about 315px wide, and at that size a small wordmark in a
       lot of empty dark is nothing at all. The crop is deliberately tight --
       wide enough to hold the wordmark, no taller than that forces -- so the
       title and Damjan fill the frame. */
    try {
      await js("MEAT.S.mode='title'; 1");
      await wait(1500);
      const full = await win.webContents.capturePage();
      const sz = full.getSize();

      const cw = 800, ch = Math.round(cw / 1.26);
      const cover = full
        .crop({ x: Math.round((sz.width - cw) / 2), y: 46, width: cw, height: Math.min(ch, sz.height - 46) })
        .resize({ width: 630, height: 500, quality: 'best' });
      fs.writeFileSync(path.join(SHOTS_DIR, 'cover.png'), cover.toPNG());
      console.log('shot cover  630x500');

      /* The banner is the strip across the top of an itch page: same frame,
         much wider crop. */
      const bh = Math.min(Math.round(sz.width / 2.4), sz.height - 40);
      const banner = full
        .crop({ x: 0, y: 40, width: sz.width, height: bh })
        .resize({ width: 1600, height: Math.round(1600 / 2.4), quality: 'best' });
      fs.writeFileSync(path.join(SHOTS_DIR, 'banner.png'), banner.toPNG());
      console.log('shot banner 1600x' + Math.round(1600 / 2.4));
    } catch (err) { console.log('cover/banner: ' + err.message); }

    console.log('SHOTS DONE');
    app.exit(0);
    return;
  }

  if (SELFTEST) {
    /* Headless check that the packaged game actually runs: globals resolve,
       every screen draws, the pools stay inside their caps, and the music
       files are reachable over the loopback server. Prints one line and
       exits, so it can be run from a build script. */
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(2000);
    let out;
    try {
      /* The audio stack only wakes on startRun() -- A.init() is what attaches
         MUSIC and kicks off the manifest fetch. Checking the tracks in the
         same synchronous block that starts the run reports "none" every time
         and says nothing about whether the build works. Start it, let the
         fetch land, then look. */
      await win.webContents.executeJavaScript('MEAT.startRun(), 1');
      await wait(3000);
      out = await win.webContents.executeJavaScript(`(() => {
        const r = { globals: [typeof MEAT, typeof A, typeof MUSIC, typeof SPR].join(',') };
        const bad = [];
        ['title','play','levelup','deck','shop','pause','dead','win','contracts','augments','evo','options','cos']
          .forEach(m => { try { MEAT.S.mode = m; MEAT.frame(performance.now()); } catch (e) { bad.push(m); } });
        r.screensThatThrew = bad;
        MEAT.S.mode = 'title'; MEAT.startRun();
        r.soak = MEAT.soak({ floor: 6, wave: 3, seconds: 12, seed: 4242, mode: 'kill' }).verified;
        const d = A.music.debug();
        r.music = { fileMode: d.fileMode, playing: d.playing,
                    tracks: Object.keys(d.files).map(k => d.files[k] ? (d.files[k].ok ? 'ok' : 'FAILED') : 'none').join(',') };
        return JSON.stringify(r);
      })()`);
    } catch (e) { out = 'SELFTEST THREW: ' + e.message; }

    /* Fullscreen, checked against the WINDOW rather than the page. The page
       can only tell you what it asked for; win.isFullScreen() is what actually
       happened. executeJavaScript's second argument fakes the user gesture the
       Fullscreen API insists on. */
    let fsResult = 'skipped';
    try {
      const tap = "document.dispatchEvent(new KeyboardEvent('keydown',{code:'F11',bubbles:true}));" +
                  "document.dispatchEvent(new KeyboardEvent('keyup',{code:'F11',bubbles:true}));1";
      const before = win.isFullScreen();
      await win.webContents.executeJavaScript(tap, true);
      await wait(1500);
      const entered = win.isFullScreen();
      await win.webContents.executeJavaScript(tap, true);
      await wait(1500);
      const left = win.isFullScreen();
      fsResult = (!before && entered && !left) ? 'toggles' :
                 ('before=' + before + ' entered=' + entered + ' left=' + left);
    } catch (e) { fsResult = 'THREW: ' + e.message; }
    out = String(out).replace(/}$/, ',"fullscreen":"' + fsResult + '"}');

    console.log('SELFTEST ' + out);
    /* Gate on all three, not only the screens. A build where every screen
       draws but the soak blew its pool caps, or where a named music track
       failed to load, is a broken build that would otherwise exit 0. */
    const t = String(out);
    const pass = t.includes('"screensThatThrew":[]') &&
                 t.includes('"soak":true') &&
                 t.includes('"fullscreen":"toggles"') &&
                 !t.includes('FAILED');
    console.log(pass ? 'SELFTEST PASS' : 'SELFTEST FAIL');
    app.exit(pass ? 0 : 1);
  }
});

app.on('window-all-closed', () => app.quit());
