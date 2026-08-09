# fonts

Drop the two typefaces in here. No build step, no config — `js/font.js` looks
for these filenames and picks up whatever is present on the next reload.

| slot | family | filename (any one of these) |
|---|---|---|
| the wordmark, and only the wordmark | **Melted Monster** | `MeltedMonster.woff2` · `.woff` · `.ttf` · `.otf` |
| everything else in the game | **Ari-W9500** by Catterio Sylt | `Ari-W9500.woff2` · `.woff` · `.ttf` · `.otf` |

`.woff2` is worth preferring — it is usually a third the size of the `.ttf` it
was built from, and this is a game that loads over the network.

## What happens if one is missing

That slot falls back to VT323 and the title screen says so along the
bottom edge, so a fallback is never mistaken for the real thing. Nothing
breaks; the game just looks like it did before.

## Cap height

Nothing to set. Vertical centring measures the cap height off whichever face
is actually resolved, per family, at load — so a new typeface lines up on the
first frame without a magic number being re-tuned.

## Running over `file://`

Fonts in here will **not** load if you open `index.html` by double-clicking it:
a `url()` font is blocked over `file://`, because every file is its own opaque
origin. Serve the folder instead:

```
node serve.js
```

VT323 is exempt because it is embedded as a data URI directly in
`js/font.js`. If double-clicking has to keep working with the new faces, they
need inlining the same way.

## Licensing

Check the licence before committing a font binary to a public repo — a lot of
display faces are free for personal use but not for redistribution, and
committing the file *is* redistribution. VT323 is here under the SIL
Open Font License 1.1 (see `../OFL.txt`), which permits it. If either of these
two does not, keep it out of git (add it to `.gitignore`) and ship it another
way.
