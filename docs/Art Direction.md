---
title: Art Direction
tags: [design, art, proposal]
---

# Three directions

> [!success] **B · THE PRICE TAG was chosen, on 2026-08-30.**
> A and C are kept below as the record of what was rejected and why — not as
> live options. The working rules live in `.claude/skills/art-bible/`, and the
> reasoning is CAMPAIGN DECISION 005.
>
> The 16px lever chosen was **open the darkness band**, specced per floor in
> the skill (DECISION 006).

Baseline: [[Art Review]]. Rule for all three — they keep the
`up2` / `shade` / `stamp` pipeline, the 68-key palette and character-grid
authoring. Nothing here needs PNGs, and I argue below why PNGs would make it
worse.

---

## The decision that comes before the direction

Mocking these up surfaced a problem no art direction fixes.

**A creature is ~16 game pixels tall on a 270-pixel-tall screen — 6% of screen
height — and the floor sits at 0.74–0.86 darkness with up to 95 of them on it.**

At that size, in that dark, at that density, *nothing survives except
silhouette and value*. Not faces, not material shading, not the hand-stamped
grin — none of the work the pipeline is best at. I rendered the current
crawler and three redesigns at true game size under 0.78 darkness and all four
are a coloured smudge. The redesigns are better smudges. They are still
smudges.

So before picking a look, **one of these three has to give**:

| lever | change | costs |
|---|---|---|
| **A. Creatures get bigger** | camera pulls in ~30%, creatures go 16px → 22px | fewer enemies fit on screen; the 95-add fantasy shrinks; `concurrencyCap` retunes |
| **B. The room gets lighter** | darkness band moves 0.74–0.86 → 0.35–0.80, floors differentiate by value | loses the "horror dark"; `dark`/`blackout` twists need rework |
| **C. Enemies get fewer and meaner** | cap 95 → ~45, each worth more | changes the whole difficulty model and the swarm twist |

I think **B is the right answer** and it is also the cheapest: the game is
currently dark *uniformly*, which is not atmosphere, it is a flat filter. Real
horror lighting is high contrast — bright pools and true black — not a
constant grey wash. Moving the band gives you ten floors that differ by value
instead of hue, which is the fix for the "one room, ten colours" problem in
the same stroke.

But this changes the feel of your game, and it is your call, not mine.
**Nothing in the campaign should start until this is decided**, because all
three directions below assume an answer.

---

## A · THE COLD ROOM

> **"This is a working building with the lights failing, and the only warm
> thing in it is meat."**

### Palette doctrine
The 68 keys split by **temperature, and temperature means threat**.

| band | keys | for |
|---|---|---|
| **cold** (~34 keys) | steel, tile, concrete, frost, rime, sodium-dead greys and blue-greens | every surface, every prop, every wall. The building. |
| **warm** (~22 keys) | blood ×4, viscera, meat red, pale flesh, bone, teeth | anything alive, anything dead, anything wet. Creatures and the player only. |
| **signal** (~12 keys) | plasma, rail, freezer, rotisserie, price-magenta | light sources, hazards, UI. **Never** on a creature or a wall. |

The rule a stranger can follow: **if it is warm, it can hurt you or it is
you.** Nothing else in the world is allowed to be warm. This is why THE
FREEZER already works and the other nine floors do not.

### Lighting logic
Light is **practical and industrial** — you can see the fixture. Hanging
worklamps, fridge strips, sodium emergency bulbs, the muzzle flash. It falls
off hard and it casts.

- **meat** takes a wet specular — a small bright hit that moves with the light
- **bone** takes a dry lift, flat and even, no highlight
- **cloth** eats light, sinks fast, almost no lift
- **steel** takes a hard narrow rim and nothing else

That is four material behaviours and `shade()` already accepts a per-material
map, so this is a data change, not an engine change.

### Shape language
Creatures are things that have been **cut**. Every silhouette answers *which
cut is it*, and mass distribution is the rule:

| creature | mass | silhouette rule |
|---|---|---|
| crawler | **low and wide** | a slab that grew legs. Horizontal, flat-cut top |
| shrieker | **high and narrow** | hung by one end. Vertical, drooping, tapered |
| stalker | **jointed** | upright, angular, more negative space than solid |
| bloater | **spherical** | distended, no legs, taut |
| husk | **concave** | collapsed inward — the only hollow silhouette |
| cyst | **rooted** | wider at the floor than the top. Grows *from* the ground |

Verified in the mockup: the low-wide crawler reads as a genuinely different
shape from the current dome at 4x silhouette.

### Deliberately ugly
**The wetness.** Specular highlights on meat pushed past tasteful into
unpleasant — the shine on a cut surface. Restraint everywhere else so this one
thing is revolting.

### Refuses
Saturated fantasy colour. Cartoon proportion. Any warm environment. Torchlight
romance. Anything that looks like a dungeon rather than a workplace.

---

## B · THE PRICE TAG

> **"A supermarket that never closed, lit by the products it is still trying
> to sell you."**

### Palette doctrine
The world is **dead neutral** and the *labels* scream.

| band | keys | for |
|---|---|---|
| **retail neutral** (~30) | lino grey, shelf white, cardboard beige, steel | every surface. Deliberately, aggressively boring |
| **product** (~20) | fluorescent green, price magenta, sale yellow, packaging cyan | signage, labels, stickers, packaging — **and creature markings** |
| **organic** (~18) | greyed meat, greyed bone, blood | flesh, which under fluorescent light looks *grey*, not pink |

The crime: **the only saturated colour in the game is advertising.** Blood is
the second most saturated thing and it is losing.

### Lighting logic
**Overhead fluorescent.** Flat, even, sourceless, buzzing, and some tubes are
dead. The horror is that the room is *well lit* and still terrible — this is
the direction that solves the readability problem by refusing darkness.

- everything is evenly lit; there is almost no falloff
- **dead tubes** create the dark zones, in hard rectangular patches
- meat goes grey-green under it, bone goes yellow, white goes blue-white
- the player's lamp becomes a *warm* light in a cold flat room — the only
  warm light in the game, which makes the player permanently readable

### Shape language
Creatures are **products**. Every silhouette carries a packaging element:

| creature | is |
|---|---|
| crawler | a tray of mince with legs — hard rectangle, flat top, **tag corner** |
| shrieker | a hanging pack, punched header card |
| stalker | shrink-wrapped, limbs bound to the body |
| bloater | a vacuum pack that has swollen and lost seal |
| husk | a crushed carton |
| cyst | a display pyramid, stacked, rooted |

**Asymmetry is the rule** — every creature has its tag on one side, so nothing
is mirror-symmetric. That alone separates this from every other direction and
from the current game, where everything is symmetrical.

Verified in the mockup: the rectangle-with-a-tag silhouette is by far the most
distinct of the three, and its label green survived 0.78 darkness better than
anything else on the sheet.

### Deliberately ugly
**The fluorescent cast on skin.** Damjan should look ill. Green-yellow in the
midtones on every warm surface, all the time.

### Refuses
Darkness as mood. Gothic. Torchlight. Anything that lets the player feel the
building is old or haunted — this building is *operational*.

---

## C · THE RENDERING

> **"Everything is drawn in blood and lit by fire, and the dark is not empty —
> it is full."**

### Palette doctrine
Brutally reduced. A **three-value world**: near-black, one mid, one hot.

| band | keys | for |
|---|---|---|
| **ink** (~40) | near-blacks and one dark mid, barely differentiated | everything. Walls, floor, props, most of every creature |
| **fire** (~14) | orange through white-hot | light sources, muzzle flash, eyes, and *only* those |
| **blood** (~14) | the four blood states, pushed | wounds, gore, hazard |

Most of the 68 keys go unused on purpose. The restraint *is* the style.

### Lighting logic
**Firelight only.** Braziers, candles, muzzle flash, the burning fat of a
vent. Warm, flickering, strongly directional, with hard cast shadows. Outside
the fire, things are not dim — they are **pure black silhouette**.

This is the highest-contrast option and the most striking in a screenshot.

### Shape language
Heavy outline, exaggerated proportion, **one feature per creature carried past
plausibility**. Drawn with a brush, not a pencil:

| creature | the one exaggeration |
|---|---|
| crawler | the jaw — wider than the body |
| shrieker | the throat — a column of open mouth |
| stalker | the reach — limbs at 2x body length |
| bloater | the mass — nothing else on it |
| husk | the hollow — a hole through the middle |
| cyst | the spread — it covers floor |

### Deliberately ugly
**The proportions are wrong on purpose.** Heads too small, limbs too long,
joints in places joints do not go.

### Refuses
Naturalism. A readable middle value. Subtlety of any kind. Colour as
information — in this direction colour carries *no* gameplay meaning, only
value and silhouette do.

---

## Honest comparison

| | A · COLD ROOM | B · PRICE TAG | C · RENDERING |
|---|---|---|---|
| readability at 95 adds | **good** | **best** | **worst** |
| readability in the dark | good | n/a — refuses dark | poor unless lit |
| screenshot recognisability | medium | **high** | **highest** |
| distance from current art | medium | **furthest** | medium |
| fits the writing's tone | **best** | good (funnier) | good (more gothic) |
| work to convert existing art | medium | **most** | medium |
| risk it looks worse than now | low | medium | **high** |

**If you want the safest large improvement: A.** It is the direction the
FREEZER already proves works, it keeps the game's tone, and warm-means-threat
is a rule that fixes readability by itself.

**If you want a screenshot nobody mistakes for another game: B.** It is the
only one of the three that is genuinely *unusual*, it solves the darkness
problem by refusing it, and asymmetric product silhouettes are a shape
language no roguelike is using.

**C is the most beautiful and the most dangerous.** At 95 enemies and 16px it
will fail, unless the size decision above goes with it.

## Where I could not judge, and you must

1. **Whether any of these read at 16px.** I built the mockups and looked at
   them at true size. I cannot reliably tell. That is your eye, not mine.
2. **My own C mockup did not execute its own brief** — I specified
   "exaggerated, asymmetric, brush-drawn" and then drew another rounded dome.
   Its silhouette is the closest of the three to the current art, which is a
   failure of my drawing, not of the direction. Judge C on the written brief,
   not on my mockup of it.
3. **Whether the tone should stay horror at all.** B is funnier than A and the
   writing would have to move with it.

## Why not PNGs

Asked and answered honestly: **no.**

- The grids are the only reason ten bosses got unique silhouettes at all — the
  format makes silhouette the first thing you author and the easiest thing to
  compare.
- `shade()` generating form from a material map is what would let a
  **palette-doctrine change roll across every sprite at once**. With PNGs,
  every direction change is a repaint of every asset by hand.
- Cosmetics are palette swaps. PNGs kill that outright.
- The bake-and-cache path, the flip cache, the tint cache and the sub-pixel AA
  all assume grids.

The pipeline is not the problem. The absence of rules for it is.

## Related
- [[Art Review]] — the baseline this answers
- [[CAMPAIGN]] — execution of whichever is chosen
