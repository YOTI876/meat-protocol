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
The game also works directly over `file://` with no server at all, since
there's no build step and no relative-path fetches beyond the three
`<script>` tags in `index.html`.

## Collaborators

Managed from GitHub → repo → **Settings → Collaborators and teams**. Invites
are email-based and must be accepted before the invitee can push.

## Related
- [[File Map]] — what actually gets deployed
