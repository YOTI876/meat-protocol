---
title: Deployment
tags: [reference, engineering]
---

# Deployment

## Repository

**GitHub:** https://github.com/YOTI876/meat-protocol (public)

Standard git — no build tooling, no CI config, no `.gitignore` surprises
beyond `node_modules/`, `.vercel/`, `.claude/`. Pushing to `main` is the
entire release process.

## Hosting

**Live:** https://meat-protocol.vercel.app

Deployed via Vercel's GitHub integration — connected once through Vercel's
dashboard (Import Git Repository → this repo), zero build command, zero
output directory override, because the whole game is static files served
as-is. Every push to `main` triggers an automatic redeploy; there's no manual
deploy step.

## Local development

```bash
node serve.js
```

Serves the folder at `http://localhost:8123` with `Cache-Control: no-store`
(see `serve.js` — deliberately no caching, so local edits are always fresh).
> [!warning] `file://` no longer works properly
> It used to, and this page said so. The score now reads
> `audio/tracks.json` with `fetch`, which `file://` blocks as cross-origin —
> so opening `index.html` directly gives you a playable game with **no music**,
> silently falling back to the synthesised score. Use the server. It is the
> same reason the [[#The desktop build|desktop shell]] runs one internally.

## Distribution

Two targets, both built from the same `dist/`:

```bash
node build.js --min           # browser: dist/ + meat-protocol-itch.zip
node build.js --min --exe     # ...and desktop/release/MEAT-PROTOCOL.exe
```

| target | is | for |
|---|---|---|
| `meat-protocol-itch.zip` | 13MB, `index.html` at the archive root | itch.io, ticked **"played in the browser"** — someone clicks and is playing in seconds |
| `MEAT-PROTOCOL.exe` | one portable file, no installer | the itch download button, and anyone who wants a "real" game |

Left out of both: `docs/`, `serve.js`, `build.js`, `README.md`, `.git`.

`--min` strips comments and whitespace (`game.js` 505KB → 230KB) but
**deliberately does not rename identifiers** — these are plain scripts, so
`MUSIC`, `A` and `MEAT` are real globals the files reach across for, and
renaming them yields a build that loads and then throws. The build also
refuses a "successful" minify that did not shrink the file.

### The desktop build

An Electron shell in `desktop/`, and the game inside it is untouched — it is
the same `dist/`, served over a loopback HTTP server on an ephemeral port
rather than embedded a second time. So the `.exe` and the itch upload run
identical bytes; neither can drift behind the other.

The server exists because the two obvious alternatives both break something:

| approach | breaks |
|---|---|
| `win.loadFile()` | `file://` blocks `fetch`, so the music manifest fails |
| a custom `app://` protocol | fixes fetch, but `<audio loop>` needs HTTP **range requests** |

A real server on `127.0.0.1` does both, and loopback-only binding does not
raise the Windows Firewall dialog that binding to `0.0.0.0` would.

```bash
cd desktop && npm run selftest
```

Launches the packaged game headless, draws every screen, runs the soak and
checks all three music tracks load, prints one line and exits non-zero on
failure — so "the exe works" is checked, not assumed.

> [!warning] Unsigned, and Windows will say so
> SmartScreen shows *"Windows protected your PC"* for any executable without a
> code-signing certificate; players must click **More info → Run anyway**.
> Certificates cost money annually. Say it plainly on the itch page and keep
> the browser build up for people who would rather not.

## Collaborators

Managed from GitHub → repo → **Settings → Collaborators and teams**. Invites
are email-based and must be accepted before the invitee can push.

## Related
- [[File Map]] — what actually gets deployed
