---
title: Rendering
tags: [reference, engine]
---

# Rendering

Everything draws with Canvas2D at a native **480×270**, scaled up an integer
multiple to fill the window at a minimum of 200%. No WebGL, no libraries.

## Two-canvas split

| canvas | id | purpose |
|---|---|---|
| game | `#game` | pixel art — floor, walls, sprites, particles, lighting |
| overlay | `#overlay` | menu text, at up to 6× the game canvas's backing resolution |

The overlay exists because upscaling 480×270 text 2–6× made every menu
blocky. `htxt()` in `js/game.js` draws to the overlay canvas in game-space
coordinates that are internally multiplied by `uiScale`, so layout code is
identical to the pixel-canvas helpers — only the rasterization differs.
`fitCanvas()` recomputes both canvases' backing resolution on resize.

## Sprites

Every sprite in `js/sprites.js` is a character grid (`SPRITE([...rows], pal)`)
mapped through a shared palette (`PAL`), baked once to an offscreen canvas
(`sheet()`), and cached — including flipped and palette-swapped (`variant()`,
used by [[Cosmetics]]) copies. `drawSpr()`/`drawSprRot()` blit from the cache;
nothing is replotted per frame.

## Lighting

`drawLight()` renders an opaque dark layer to a lightmap canvas, then punches
holes in it with `destination-out` radial gradients: one around the player,
one cone along the aim direction (the "flashlight"), and smaller ones around
muzzle flashes, drops, pedestals, the exit door, and each enemy's glow. The
result composites back onto the main canvas, followed by a per-floor colour
fog wash.

## Screen shake

Two layered sine waves with a random phase seeded per-impulse
(`shake()`/`updateCam()`), not per-frame randomness — the difference between
a camera that swings-and-settles versus one that vibrates. See the comment
above `updateCam()` for the exact formula.

## Death burst

`deathBurst()` on every kill: a white ring, a red shockwave ring, a meat-
coloured particle cloud, directional gib spray, hot sparks, and 5+ upward-
drifting embers that fade over ~1 second. Bosses get roughly 3× everything
plus a red screen flash and hitstop.

## Reload animation

4-stage state machine on `p.reStage`, timed against each weapon's own reload
duration: mag ejects as a physical object with gravity and bounce → new mag
slides visually into the well → charging handle racks with a spark → weapon
returns to ready. Each stage triggers its own sound
(`A.magOut/magDrop/magIn/rack`).

## Minimap

Top-right corner, `drawMinimap()`. Shows interior walls, unbought weapon
pedestals (in the weapon's colour), the exit door (once open), and every
loose pickup colour-coded by kind. Enemies render as small red dots; the
current boss as a large pulsing pink dot with an additive glow; [[The Shop|
PACI]] as a fat purple square. The three [[Secrets]] are deliberately never
drawn.

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
keep-outs over the spawn pad and the door approach. Deliberate layouts pack
tighter than scatter (18–32px gaps versus 40) but never below three times the
player's radius.

> [!note] Verified, not assumed
> A flood-fill audit over 400 generated arenas confirms every layout is fully
> connected — no sealed pockets, spawn always clear, door always reachable.
> See [[Bugs Found#11. Crates spawning on Damjan's head]].

## GLUSEC banner

A band along the **bottom** of the screen on every
[[Progression#The evolving rifle|rifle mark]], held 3 seconds. Two lines of
text cycle hue continuously and independently, offset 140° apart on the colour
wheel so they never land on the same colour at the same time — see `S.glusec`
handling in `post()`.

It sits at **y 197–227**, which is the only free horizontal strip down there:
the item-pickup banner ends at `H/2+61` (196) and the grocery shelf starts
around 227. It used to be centred, where a floor transition stacked it
directly on top of `msg()`'s floor-name text.

## PACI

[[The Shop|The shopkeeper]] is drawn at **3.6×** against Damjan's 1×, with a
deliberately small head on a huge aproned body — the scale contrast is the
whole joke. Two frames alternate on a 1.4Hz breath (`SPR.paci`, `SPR.paci2`),
over a soft purple glow and a wide ground shadow, with his greeting drawn in
world space above him so it tracks with the camera. He gets his own oversized
hole in the lightmap (radius 120) so the room reads as *his*.

## Menus

Buttons (`uiBtn()`) ease toward their hover state over several frames rather
than snapping — lift, additive colour wash, growing corner ticks, glow — and
grey out with a denial sound when unaffordable. Cosmetic rows in
[[Cosmetics]] use the same hover-easing pattern independently.

## Related
- [[Music]] / [[Audio]] — the non-visual half of "feel"
- [[Bugs Found]] — a couple of rendering bugs caught before shipping
