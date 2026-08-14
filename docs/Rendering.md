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

`bakeFloor()` bakes a small **atlas of 12 tile variants**, blits it across the
arena, and then stamps sparse spills and hairline cracks over the top. Each
floor picks a [[Floors#Surfaces|surface]] from `FLOOR_TEX`, and `TEXTURE[style]`
paints one variant at device resolution over a shared tone-and-grain base.

Ordered dithering is what lets three flat floor tones read as a value gradient
without inventing a fourth colour — at this pixel density it looks like grime
settling rather than a pattern. `BAYER`/`bay()` is the same 4×4 matrix the
sprite shader uses.

### It used to be one enormous pixel loop, and that was the lag

The old version resolved **every device pixel of the arena in JS**: a
`createImageData` the size of the room, tone and dither and grain per pixel.
Then grout with four `fillRect`s per tile, and spills painted a device pixel at
a time. Measured, that is a flat **~32 nanoseconds per device pixel**, and
floor 9 is **4.75 million** of them.

| | |
|---|---|
| pixel loop | ~100 ms |
| spills | ~37 ms (55,000 `fillRect`s) |
| grout | ~9 ms (19,000 `fillRect`s) |

Every part of it was doing per-pixel work for something that **repeats**. So:
bake 12 tile variants once (12,288 pixels instead of 4,752,000, a **386×**
reduction), bake the grout *into* those variants so it costs nothing,
pre-render six spill blobs and `drawImage` them, and blit.

| bake | before | after |
|---|---|---|
| worst floor | 234 ms | **31 ms** |
| whole run | 1,791 ms | **220 ms** |
| dropped frames | 107 | **13** |

**8.1× overall.** The cost now scales with tile *count* rather than pixel
count, so it barely grows as the arenas do — floor 9 is the biggest room and no
longer the worst bake.

> [!warning] Measure a canvas bake with the pipeline drained
> Raw `performance.now()` around a bake **under-reports** it: `drawImage` calls
> queue, and the cost lands on whatever later call forces a flush. Both figures
> above were taken with a forced drain after the bake and the drain's own
> overhead (~16.6 ms) subtracted, old and new, on the same machine in the same
> session. Without that the "after" looked like 26 ms and the "before" like
> 149 ms — flattering to both, and not comparable.

> [!note] What the profiling ruled out first
> "It lags sometimes" is not the framerate. Steady play is **1.3 ms a frame at
> the enemy cap** against a 16.7 ms budget; the heap is flat at 5–7 MB; the
> sprite cache creates **29 canvases for an entire ten-floor run**; and enemy
> cost scales linearly, not quadratically. The floor bake was the only real
> stall.
>
> Beware the harness, too: driving frames synchronously with no
> `requestAnimationFrame` between them makes draw calls batch and periodically
> flush inside the timing window, which manufactures 40–90 ms "spikes" that no
> player ever sees.

## Damjan

The player is deliberately the one thing in the game that stays natural — no
exaggerated face, no horror styling. What happens to him is physical.

### He was rebuilt from the silhouette in

The old figure was a mascot. His head was **22 of his 32 rows** — two thirds of
the whole sprite — sitting straight on a flat green rectangle with no neck, no
shoulders and no arms, wearing a knotted bandana with a tail. At a glance that
is a bobblehead in a headband, and no amount of face detail fixes a proportion
problem.

| | |
|---|---|
| **proportion** | head 22 rows → **14**, ~44% of him instead of 69%. Does more than everything else combined. |
| **a neck** | he has one. It is what lets the head read as attached rather than balanced. |
| **shoulders** | a real shoulder line sloping out from the neck, with arms separated from the torso by a one-pixel shadow gap so the limb does not merge into the body at distance. Gloves on the forearms. |
| **one big shape** | a bone-white butcher's apron, bib to hem, against a dark coat. A silhouette this small cannot carry texture; it can carry one strong value contrast. Stained asymmetrically with dried blood, because he works here. |
| **hair** | direction (strands falling from a part and sweeping right), two tones with the highlight pooling top-left under the same strip light as everything else, a flat crown instead of a circle, a fringe that dips into the forehead instead of ruling a line across it, and sideburns carrying the mass down past the temple. |

The reference is not any one game — it is the discipline the good top-down
pixel work shares: commit to a shape, let value do the work, and spend detail
only where the eye already goes.

> [!warning] The moustache, and the rule that came out of it
> The first pass put a **4px dark nose base** on row 11 and a **6px dark
> mouth** on row 12, directly beneath it. Two solid horizontal bars, stacked,
> immediately under the nose — at sixteen pixels tall the eye does not resolve
> that as "nose, then mouth", it resolves it as a moustache. And once you have
> seen it you cannot unsee it.
>
> Two rules, and they are general at this density:
> - **never stack bars of similar width.** Make them differ enough to read as
>   separate features — the nose base is 2px now, the mouth 4px.
> - **a mouth is a short line.** Anything approaching the width of the jaw
>   stops being a mouth.

The `r`/`R`/`w` palette keys that were the headband are a **neckerchief** at
his throat now, so every [[Cosmetics]] repaint still lands.

### Damage on Damjan

`hurtStage()` returns 0–3 from his health fraction (thresholds .72 / .46 /
.22), and `bodySprite()` / `legSprite()` swap in progressively wrecked
versions. Retargeted with the rebuild, and they now read off the **apron** — on
the old dark-green jacket every wound was dark-on-dark and the whole system was
invisible until stage 3. Order of destruction: the apron gets wet, then it
tears and the sleeve opens on the arm inside it, then the apron is mostly gone
and so is some of him.

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
> A flood-fill audit over 400 built arenas confirms every layout is fully
> connected — no sealed pockets, spawn always clear, door always reachable.
> See [[Bugs Found#11. Crates spawning on Damjan's head]].

What goes *into* the layout is per-floor: twenty [[Floors#Props|prop kinds]],
four or five per floor, six of which put light into the room. The layout is the
geometry; the props are what the geometry is made of.

## Walls

Five treatments — `brick`, `panel`, `tile`, `concrete`, `rack` — assigned per
floor by `WALL_STYLE`. The border wall is the single biggest surface on screen
and it was the same brick on all ten floors, which quietly undid every palette
change: you can repaint brick and it is still brick. See [[Floors#Walls]].

Only the four border walls are wall. Everything else in `S.walls` is a
[[Floors#Props|prop]] and draws through `PROPS[w.kind]`.

## Effects

The effects layer was rewritten around three ideas: **a hit should read as a
direction**, **a shape should ease rather than fade**, and **nothing should be
allowed to grow without a ceiling**.

| | does |
|---|---|
| `sparks(x, y, ang, col, n, spd, life, cone)` | directional particles carrying `trail: 1` and `drag: 0.86` — drawn as a **stroked line along their own velocity**, so speed is visible |
| `impact(x, y, ang, heavy)` | the standard hit: a back-spray cone, a thin forward spit of white, a ring, and a one-frame white core |
| `ring()` | cubic ease-out on the radius, **squared** alpha fade, thinning width, and a hot white leading edge for the first 55% |
| `S.muzzle` | a 4-point star rotated to the shot's angle, 0.06s |
| `explode(x, y, r, dmg, col, quiet)` | `quiet` keeps the damage and halves the particles but drops shake, punch, hitstop, flash and the audio duck — and softens knock 340 → 150 |

`quiet` is what lets [[The Deck#The balance pass|OVERKILL]] and the frag
grenade stop shaking the screen without becoming invisible. A kill-triggered
effect that shakes the camera means the camera never settles for a whole run.

Every pool is capped, oldest-first: **900** particles, **420** gibs, **80**
rings. Measured at 222–601 fps per floor and 188 under deliberate load.

> [!note] The deferred queue is why any of this is safe
> `S.fx` drains **3 entries a frame, capped at 12**. A kill that triggers an
> effect that kills something that triggers an effect is a recursion, and this
> is the thing that flattens it into a queue.

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
when there is one. It lost the locked-rider band and the rarity ladder, because
everything on it competing for the eye is something you are not reading.

Everything inside the frame is the **rarity's** colour. Aisle colours appear
only on THE ORDER strip and the deck headings: two colour systems in five
boxes means neither can be read.

Cards **size themselves to the space**. Width was hardcoded to two values, and
`handSize()` reaches five (HOLLOW stacked on the APEX contract) — which drew a
566px row on a 480px canvas and ran off both edges. Copy scales with card
width too, and the strings that silently truncated at the narrowest layout
were shortened.

### The foot: two numbers, and it must be obvious which is which

The bottom of a card carried the **aisle's name** followed immediately by a row
of **pips** — and the pips counted that *card's* ranks, not the aisle's. Two
different scopes, touching, with only one of them labelled. `BLADES ▪▪▪▪▪▪`
reads as six of something to do with BLADES, which is not what it was.

Worse, the count you actually want while deciding — how close **that aisle** is
to its [[The Deck#The five aisles|next rung]] — was the one thing the card did
not tell you. So the aisle half now shows the aisle's own progress, the card
half is labelled, and neither is a pip:

```
BLADES 5/8                              HELD 0/2
```

Both halves shrink together (6px down to 4.6px) if a five-card hand leaves the
card too narrow, rather than letting the right one slide off the edge
unnoticed. `HELD` is dimmed when you hold none of it, so a card you have never
taken does not compete with the aisle count for attention.

> [!note] The pips are gone, and so is the reason they were confusing
> They also used to animate a "preview" pip for the rank you were about to buy,
> which in a still frame is simply a filled pip — so a card you owned none of
> looked owned. Numbers are unambiguous at 6px in a way two adjacent ladders
> never were.

## THE ORDER strip

Five chips under the hand, one per aisle, each filling toward that aisle's next
rung with **three pips for the three rungs** — the same shape the HUD corner
uses, so the ladder is countable rather than inferred.

> [!warning] It used to claim an aisle was finished at 8
> The headline read *"4 cards earns its perk, 8 masters it"* and the chip
> printed `MAX` at eight. That copy was written when there were two rungs and
> never updated when a third arrived, so the strip told you an aisle was done
> while a whole rung sat above it — and the deck screen agreed, showing an
> aisle at 11 of 12 as MASTERED with nothing left to say.
>
> Everything that draws progress now walks `AISLE_RUNGS` instead of hardcoding
> which two of the three it knows about, and the headline states the **cadence**
> rather than listing numbers: *"it pays you again every 4 cards, three
> times."* True, and it stays true if the numbers move.

The bar also fills **from the last rung to the next**, not from zero. Filling
from zero meant an aisle at 9 of 12 showed a three-quarters-full bar that had
not moved since 8 — progress you were not making.

## The run clock

`runClock()` renders `S.runT` as `MM:SS`, rolling to `H:MM:SS` only once there
is an hour to show — a leading `0:` on every run of a game whose floors take
four minutes is two characters of nothing. Seconds are zero-padded so the
string never changes width mid-wave and jitters the right edge of the HUD.

It sits **under the score** in the top-right, dimmer than it: the other number
that only ever counts up, but something you check between waves rather than
play toward. The combo drops a line below rather than sharing the row, because
a combo is loud and brief and would fight a clock that is always there.

The final time appears on both terminal screens — on
[[#The win screen|the win screen]] it is the one number you can try to beat.

> [!warning] `update()` runs in every mode; the guard is what makes it play-only
> `S.runT += rdt` first went at the top of `update()`, which is called every
> frame regardless of `S.mode`. The mode guard sits forty lines further down.
> So the run timer kept ticking through the pause screen, THE DECK and every
> level-up hand — measured at **15.06 s after 10 s of play and 5 s on a menu**.
>
> Moved below the guard it measures time actually spent in the building, which
> is the only version of a run timer worth reading. Verified frozen across all
> eight non-play modes. It also stops on the winning hit rather than when the
> win screen appears, because the 3.4 s the finale takes to fall over is not
> time you spent clearing the game. Same class of mistake as
> [[Bugs Found#14. A menu inside the first 2.2 seconds killed the floor permanently|the wall-clock wave timer]].

## The death screen

Title, how far you got, the score, one row of numbers — coins, cards, vault,
kills, **time** — and then RETRY.

> [!note] It used to hand you a paragraph before it let you at the button
> Two more lines sat between the stats and the buttons: a run of *"guns 3/13 ·
> cards 14 · level 9 · best 41200 · EVO 2/10 — next 600 coins"*, and the
> nearest unsigned contract with its progress. Both were written to give you a
> reason to press RETRY and both did the opposite — you have just died, and the
> screen answered with reading.
>
> The information was real but the moment is wrong for it: EVO and the contract
> ladder both live on screens you go to deliberately, and the wallet numbers
> are on the HUD every second of the next run anyway.
>
> Removing them also retired a line that had gone stale — *"every contract
> signed. there is still no bottom."* was written for the endless descent, and
> [[Floors|the descent has had a bottom]] since `9551e17`.

## The deck screen

`drawDeck()` is panels. Each aisle is a boxed section with its own coloured
edge and header bar, rows carry an alternating wash, riders indent under their
card, and off-cuts sit in framed chips. Panels flow into whichever column has
room.

It was two flat columns — name hard left, effect hard right across a 214px
row — which left a void down the middle of every row and no visible grouping,
so it read as two unrelated lists sharing a screen.

The [[Groceries|signature]] chips are gone with the signatures — and took a
`ReferenceError` with them on the way out. See
[[Bugs Found#18. `drawDeck` threw the instant the deck screen opened]].

## The win screen

`drawWin()`, reached 3.4 seconds after [[Bosses#THE MEAT PROTOCOL|the finale]]
dies. It is `drawDead()` with the temperature turned around: the same layout,
the same three buttons in the same places, and every visual decision inverted.

| | dead | win |
|---|---|---|
| wash | cold | warm amber radial |
| motes | falling | **embers rising** |
| headline | YOU ARE MEAT | **THE PROTOCOL IS MEAT** |
| subtitle | how deep you got | *ten floors. all of them behind you.* |
| buttons | RETRY · COSMETICS · TITLE | **PLAY AGAIN** · COSMETICS · TITLE |

Under the score it prints guns owned, **clears** (`cStat('protocol')`), best
score and EVO rung — and one editorial line pointing at
[[Economy#Evolution|EVOLVE]], because the run being over is not the same as the
game being over.

Keeping the shape identical is the point. Winning and losing should feel like
two readings of the same instrument, not two different screens.

## The title screen

A poster. Below the buttons there is nothing: the wallet row, the records
line, the two lines of control listing, the secrets teaser and the fonts
warning are all gone. The last two had been drawn on top of each other at the
bottom edge for two commits.

**One centred row of three same-sized buttons** — PLAY, COSMETICS, CONTRACTS
— with a single quiet `EVOLUTION n / 10` line beneath it. EVOLVE and RESET EVO
used to sit up here too, which forced a **second row centred on a different
axis depending on whether you had evolved**: the row physically shifted under
the cursor between visits, so the button you were reaching for moved while you
reached. Both are on the [[Controls#Two things called a menu|pause screen]]
now, where the run they cost you is the thing behind them. The death screen is
the same shape: RETRY, COSMETICS, TITLE.

## The evolution pick screen

`drawEvoPick()` — its own mode (`S.mode = 'evolve'`), because taking a rung is
not a dialog on top of a run, it is the moment between two runs.

The whole screen is washed in the colour of what is being offered: violet for
a gun, [[The Deck#Rarity, and why it matters|LEGENDARY orange]] for a card, as
a radial gradient under fourteen rising motes. Panels land staggered —
`S.evoIn * 3 - i * 0.4`, cubic-eased — so they arrive one after another rather
than all at once.

A gun panel is a `frameBox` with the rarity's colour on its header bar, the
sprite floating over an additive glow at 2.4×, the name, the flavour line, and
`PACI wanted <price>` at the foot — the price it is *not* costing you.

The footer is the part that does work: it names the rarities your roster is
still missing, and says that holding one of each turns the rungs into cards.
Without it the switch from guns to cards at rung ~7 looks like the game
changing its mind.

> [!warning] This screen cannot be escaped
> There is no back button, `Esc` does not leave it and `C` is explicitly
> blocked from opening [[Cosmetics]] over it. The rung is already paid for —
> `S.evo` went up and the wallet went to zero before it drew — so a way out
> would be a way to lose the pick. It exits by taking something.

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
