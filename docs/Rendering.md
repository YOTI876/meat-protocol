---
title: Rendering
tags: [reference, engine]
---

# Rendering

Canvas2D. No WebGL, no libraries, no image files — every pixel in the game is
plotted as text in `js/sprites.js` and baked at load.

## Render scale

The game is designed on a **480×270** grid and every coordinate in `game.js`
— layout, physics, collision, camera — stays on it. What changed is the
backing store:

```js
const RS = 2;
cv.width = W * RS; cv.height = H * RS;   // 960×540
setSubpix(RS);
```

`subCanvas()` makes offscreens the same way (`ctx.setTransform(RS,0,0,RS,0,0)`,
with `_gw`/`_gh` carrying their size in game units for `blit()`). **Nothing in
the simulation changes** — there are simply four device pixels where there
used to be one, which is the room the detailed sprites, the selective outlines
and the sub-pixel AA need.

## Fitting the window

`fitCanvas()` fills the **limiting axis exactly**, fractional scale and all:

```js
const scale = Math.max(RS, Math.min(sx, sy));
```

The grid is exactly 16:9, so on a 16:9 display in fullscreen this is edge to
edge with no bars.

> [!note] Why not integer scaling
> It used to snap to multiples of `RS`, so a window whose ideal scale was 3.2×
> fell all the way to 2× and the game sat in a 960×540 box — which is every
> Windows laptop at 125% DPI, and people were browser-zooming to 200% to play.
> A fractional scale means game pixels alternate 3px/4px wide instead of being
> uniform. The render store is already 2× the grid, so the unevenness lands on
> fine detail, and a full screen beats a ruler-perfect grid with bars on it.

## Two-canvas split

| canvas | id | purpose |
|---|---|---|
| game | `#game` | pixel art — floor, walls, sprites, particles, lighting |
| overlay | `#overlay` | menu text, at up to 6× the game canvas's backing resolution |

The overlay exists because upscaling 480×270 text made every menu blocky.
`htxt()` draws to it in game-space coordinates internally multiplied by
`uiScale`, so layout code is identical to the pixel-canvas helpers — only the
rasterization differs. `fitCanvas()` recomputes both on resize.

## The sprite pipeline

Sprites are character grids mapped through a shared **68-key palette** and
baked once to an offscreen canvas, cached including flipped and
palette-swapped ([[Cosmetics]]) copies. Nothing is replotted per frame.

What sits between the grid and the canvas is four passes:

### 1. Density (`ss`)

`ss: 2` means "this grid is twice as fine as the game's pixel", and
`drawSpr()` divides the footprint back down — so a 32×30 `ss:2` sprite is a
drop-in replacement for a 16×15 `ss:1` one, in the same game-unit space.
`drawSprRot()` multiplies its pivot by `spr.ss` for the same reason.

### 2. `up2()` — EPX / Scale2x

Lifts an existing 1× grid to 2× by interpolating corners from its four
neighbours, so hand-drawn 2× detail and generated 2× detail can live in the
same grid. This is how 19 weapon and prop sprites got their detail pass
without being redrawn.

### 3. `shade()` — automatic form shading

Walks two cells up-left and down-right from every solid pixel. A lit edge
takes the material's lift colour, a shadow edge takes its sink colour, and the
**far edge of each band is Bayer-dithered** (`_bay(x,y) < 0.55`) so the
surface rolls off instead of banding. Each creature passes its own material
map, so bone, meat and cloth catch the light differently.

### 4. `stamp()` — the hand-drawn part

Patches drawn over the generated result, where a space means "keep what's
underneath". Every face in the game is a stamp: the crawler's mismatched eyes
and sideways grin, the shrieker's blind milky sockets and screaming maw, the
stalker's stitched skull, the bloater's pinholes and split belly, the two
bosses' four-square eyes. The generator does the form; the horror is drawn by
hand.

### Selective outlining

A single black keyline round everything reads flat. The palette carries three:
`o` for the shadow side and the silhouette, `,` where the form turns away but
still catches the room, `;` for the rim the lamp clips.

### Sub-pixel AA

Applied at **bake** time, and only to staircase notches — never to a straight
edge, which would just blur it. A notch samples its neighbours and fills with
their mix at 0.5 alpha (0.7 where three or more colours meet).

## The floor

`bakeFloor()` builds per-tile `tone` and `wear` arrays, then resolves the
whole floor in **one `createImageData` pass** with ordered dithering and a
hash grain, followed by grout with a lit lip, dithered spills and hairline
cracks.

> [!note] Why one pass
> Dithering the floor per-pixel with `fillRect` would have been roughly a
> million calls per room build. The `createImageData` version is a single
> buffer write. Ordered dithering is also what lets three flat floor tones
> read as a value gradient without inventing a fourth colour — at this pixel
> density it looks like grime settling rather than like a pattern.

`BAYER`/`bay()` at the top of the shop section is the same 4×4 matrix the
sprite shader uses.

## Damage on Damjan

The player is deliberately the one thing in the game that stays natural — no
exaggerated face, no horror styling. What happens to him is physical.

`hurtStage()` returns 0–3 from his health fraction (thresholds .72 / .46 /
.22), and `bodySprite()` / `legSprite()` swap in progressively wrecked
versions: cloth tears open, then what's under it shows.

`shred()` throws two kinds of debris on every hit — **cloth rags** and
**meat gibs**. Rags get drag, gravity and spin, render as flat rotating
slivers, and leave no stain; meat behaves like meat. Crossing into a worse
stage is its own moment: `hurtPlayer()` fires `shred()` a second time at 2.2×,
with extra shake, hitstop and `A.crack()` — that's the hit where a piece of
him actually leaves.

## Lighting

`drawLight()` renders an opaque dark layer to a lightmap canvas, then punches
holes in it with `destination-out` radial gradients: one around the player,
one cone along the aim direction, and smaller ones around muzzle flashes,
drops, pedestals, the exit door, [[The Shop|PACI]] (radius 120, so the room
reads as *his*) and each enemy's glow. The result composites back onto the
main canvas, followed by a per-floor colour fog wash.

[[Augments|CATARACT and SLEEPLESS]] multiply `ST().sight`, which shrinks those
holes — the augment genuinely takes vision away rather than dimming a number.

## Screen shake

Two layered sine waves with a random phase seeded per-impulse
(`shake()`/`updateCam()`), not per-frame randomness — the difference between
a camera that swings-and-settles and one that vibrates.

## Death burst

`deathBurst()` on every kill: a white ring, a red shockwave ring, a meat-
coloured particle cloud, directional gib spray, hot sparks, and 5+ upward-
drifting embers that fade over ~1 second. Bosses get roughly 3× everything
plus a red screen flash and hitstop.

## PACI's temper

[[The Shop#Do not shoot him|Shooting the shopkeeper]] runs entirely through
`post()` and one branch in `update()`: a continuous `shake()` with a 31Hz
tremor riding on it, `S.redness` climbing every frame, a pulsing red fill plus
an additive `lighter` pass, and at anger 2 nine black tearing scanlines a
frame. He never attacks. The room does it.

## Reload animation

4-stage state machine on `p.reStage`, timed against each weapon's own reload
duration: mag ejects as a physical object with gravity and bounce → new mag
slides visually into the well → charging handle racks with a spark → weapon
returns to ready. Each stage triggers its own sound
(`A.magOut/magDrop/magIn/rack`).

## Minimap

Top-right corner, `drawMinimap()`. Shows interior walls, unbought weapon
pedestals (in the weapon's colour), the exit door (once open), and every loose
pickup colour-coded by kind. Enemies render as small red dots; the current
boss or [[Bosses#Elites|elite]] as a large pulsing pink dot with an additive
glow; [[The Shop|PACI]] as a fat purple square. The three [[Secrets]] are
deliberately never drawn — and neither is [[Augments|TOMCE]].

## Arena layouts

`buildRoom()` picks one of five archetypes per floor rather than always
scattering boxes at random:

| layout | shape |
|---|---|
| **scatter** | the original — loose boxes at random |
| **pillars** | a grid of columns with ~16% missing, so it isn't a lattice |
| **corridors** | 4–8 long thin walls cutting lanes across the room |
| **bunkers** | 3–5 slabs big enough to lose a boss behind |
| **ring** | a broken ring around the centre; the gaps are the only way through |

All of them go through one `place()` helper that enforces the arena margin, a
per-layout separation gap, a clear 92px circle at the arena centre, and
keep-outs over the spawn pad and the door approach.

> [!note] Verified, not assumed
> A flood-fill audit over 400 generated arenas confirms every layout is fully
> connected — no sealed pockets, spawn always clear, door always reachable.
> See [[Bugs Found#11. Crates spawning on Damjan's head]].

## GLUSEC banner

A band along the **bottom** of the screen on every
[[Progression#The evolving sidearm|sidearm mark]], held 3 seconds. Two lines
of text cycle hue continuously and independently, offset 140° apart on the
colour wheel so they never land on the same colour at the same time.

It sits low deliberately: the item-pickup banner ends at `H/2+61` and the
grocery shelf starts around `H-42`. It used to be centred, where a floor
transition stacked it directly on top of `msg()`'s floor-name text.

## Typefaces

Two slots, loaded from `fonts/` by filename — **Melted Monster** for the
wordmark, **Ari-W9500** for everything else. Until a file is there, both fall
through to **VT323**, which is embedded as a data URI and so loads identically
over `http` and `file://`.

VT323 (a terminal face) replaced Pixelify Sans, which read as decoration at
HUD sizes — its `8` in particular was a blob at 6px — and a terminal face
suits a game that is mostly a CRT full of meat.

Because different faces sit differently in the em, **`htxt()` normalises
optical size off the measured cap height**: a size means "capitals this tall",
whatever face resolves. That is what lets a font be dropped into `fonts/` and
land at the right size with no retuning. Weights default to 400 — the embedded
face has one weight, and synthetic 600 smears a monoline font.

A missing font prints to the **console once**. It used to be drawn along the
bottom of the title screen, which was a developer's message wearing a player's
clothes. See `fonts/README.md`.

## Cards look like price tags

A [[The Deck|card face]] is a price tag: a punched hole with a ring, paper
grain, a hard drop shadow, and a halo behind anything RARE or better. The face
carries only what you choose between — rarity, name, effect, and the rider
when there is one. It lost the locked-rider band, the ladder pips, the aisle
line and the "held" line, because everything on it competing for the eye is
something you are not reading.

Everything inside the frame is the **rarity's** colour. Aisle colours appear
only on THE ORDER strip and the deck headings: two colour systems in five
boxes means neither can be read.

Cards **size themselves to the space**. Width was hardcoded to two values, and
`handSize()` reaches five (HOLLOW stacked on the APEX contract) — which drew a
566px row on a 480px canvas and ran off both edges. Copy scales with card
width too, and the strings that silently truncated at the narrowest layout
were shortened.

> [!note] A pulsing pip is a filled pip
> The rank pips used to animate a "preview" pip for the rank you were about to
> buy. In a still frame that reads as filled, so a card you owned none of
> looked owned. They don't pulse any more.

## The deck screen

`drawDeck()` is panels. Each aisle is a boxed section with its own coloured
edge and header bar, rows carry an alternating wash, riders indent under their
card, and signatures and off-cuts sit in framed chips. Panels flow into
whichever column has room.

It was two flat columns — name hard left, effect hard right across a 214px
row — which left a void down the middle of every row and no visible grouping,
so it read as two unrelated lists sharing a screen.

## The title screen

A poster. Below the buttons there is nothing: the wallet row, the records
line, the two lines of control listing, the secrets teaser and the fonts
warning are all gone. The last two had been drawn on top of each other at the
bottom edge for two commits.

## Menus

Buttons (`uiBtn()`) ease toward their hover state over several frames rather
than snapping — lift, additive colour wash, growing corner ticks, glow — and
grey out with a denial sound when unaffordable. [[Cosmetics]] rows use the
same hover-easing pattern independently.

A level-up hand arrives with the weight of the best thing in it
(`dealDrama()`): three COMMONs open quietly, an EPIC flashes, shakes and
sounds before you've finished reading the names.

## Related
- [[Music]] / [[Audio]] — the non-visual half of "feel"
- [[Bugs Found]] — a couple of rendering bugs caught before shipping
