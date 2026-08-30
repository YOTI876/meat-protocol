---
name: art-bible
description: The MEAT PROTOCOL art bible — silhouette rules per creature family, palette doctrine, lighting logic, animation timing, telegraph vocabulary and the rejected list. Load this before drawing, editing or reviewing ANY sprite, floor, prop, effect or UI element in this project, and before judging whether something "reads". Use when the task touches js/sprites.js, the palette, drawLight, any creature or boss appearance, floor surfaces or props, or when asked whether art is good enough.
---

# MEAT PROTOCOL — art bible

This is the document that stops floor 9 belonging to a different game than
floor 1. If two passes disagree, this file wins. If this file is wrong, fix
*this file* and say so — do not quietly draw around it.

Read alongside `docs/CAMPAIGN.md` (where we are) and `docs/Art Direction.md`
(why these rules).

## The one rule above the others

**The player sees this game at 1x in the dark with up to 95 enemies on
screen.** Anything that only works at 4x in a lit room is decoration you are
paying for and nobody is receiving.

Author for silhouette and value first. Faces, materials and shading are the
reward for having got those right — never the substitute.

## THE DIRECTION — B · THE PRICE TAG

> **"A supermarket that never closed, lit by the products it is still trying
> to sell you."**

Committed to fully (CAMPAIGN DECISION 005). Anything that does not fit gets
cut even if it already exists. **Do not drift back toward a moodier, darker,
more conventional horror look because it is easier** — that is an explicit
standing instruction, not a preference.

The crime this direction commits: **the only saturated colour in the game is
advertising.** Blood is the second most saturated thing and it is losing.

### It is a roguelike, not a story game

**No lore. No cutscenes. No narrative arc. No text explaining what happened
here** (DECISION 007). Floors get identity from *environmental design* — what
the room is built of, how it is lit, what is stacked in it, how it plays.
THE FREEZER works because it is a place, not because anything is written
about it.

Test for any art decision: **does it change how a floor plays, or how it
reads at a glance?** If neither, it does not earn its place.

## THE PLAYER IS ALWAYS FINDABLE

Unconditional (DECISION 008). *"At 70 enemies I could not find the player"* is
not acceptable in a game about being surrounded.

- Damjan draws **last**, over everything, always.
- He carries the only **warm** light in a cold flat world — under B's
  fluorescent doctrine this makes him permanently, structurally readable
  rather than readable by luck.
- No enemy, prop, hazard or effect may use his reserved lamp colour.
- **Acceptance test:** a 70-enemy floor-9 frame at 1:1. Findable in under a
  second, or it is not done.

## LIGHTING — flat fluorescent

Light is **overhead, even, sourceless, buzzing, and unflattering.** The horror
is that the room is *well lit* and still terrible.

- Almost no falloff. This direction refuses darkness as a mood.
- **Dead tubes make the dark**, in hard rectangular patches with clean edges —
  not soft radial vignettes.
- Under fluorescent: meat goes **grey-green**, bone goes **yellow**, white
  goes **blue-white**. Damjan should look ill. That is the deliberate ugliness
  and it is always on.
- The player's lamp is the one warm light. See above.

### The darkness band, per floor

The old band was 0.74–0.86 across all ten — a 0.12 spread, which is a filter,
not lighting. The new spread is **0.15–0.88**, wider than the hue spread, and
**floors are told apart by value first and hue second** (DECISION 006).

| # | floor | dark | is |
|---|---|---|---|
| 1 | THE ABATTOIR | **0.30** | working area, hosed down, fully lit |
| 2 | THE HOLLOW | **0.72** | service level, most tubes dead |
| 3 | THE MEAT LOOP | **0.38** | processing line, lit for work |
| 4 | THE RED KITCHEN | **0.28** | prep, bright and hot |
| 5 | THE FREEZER | **0.15** | **the brightest room in the game** — fluorescent on white frost |
| 6 | THE RENDERING | **0.62** | sump level, failing |
| 7 | THE LONG TABLE | **0.88** | **the near-black one**; `blackout` lives here |
| 8 | THE SALT LINE | **0.22** | salt-white, blinding |
| 9 | THE LAST AISLE | **0.35** | the shop floor, full retail fluorescent, flickering |
| 10 | THE KILLING FLOOR | **0.55** | lit by what is standing in it |

Rules this table obeys, and any change must keep: **no two adjacent floors
share a value**, at least one floor is genuinely bright, one is near-black,
and the run **oscillates** rather than fading monotonically into the dark.

## PALETTE DOCTRINE

`PAL` in `js/sprites.js` is 68 keys. It is a **good** palette and it is
currently ignored — most creatures declare local hex and route around it.
That stops.

### The bands

Every key belongs to exactly one band, and a band is a **job**, not a hue.

| band | is | may appear on | never appears on |
|---|---|---|---|
| **RETAIL NEUTRAL** (~30) | lino grey, shelf white, cardboard beige, steel. Deliberately, aggressively boring | floors, walls, props, architecture, shelving | creatures, the player, UI |
| **PRODUCT** (~20) | fluorescent green, price magenta, sale yellow, packaging cyan. The only saturated colour in the game | signage, labels, stickers, packaging, **creature markings**, hazards, UI | any large surface — it is an accent, never a field |
| **ORGANIC** (~18) | greyed meat, yellowed bone, blood ×4 | creature bodies, the player, gore | walls, floors, props |

*Exact key→band assignment lands in Pass 1. The counts above are the target
shape, not gospel.*

The reason this works at 95 enemies: the world is desaturated, so **anything
saturated is information**. A player learns that on floor 1 and can trust it
on floor 10.

### Rules that hold whatever the direction

1. **A creature may not be the same hue family as the floor it stands on.**
   This is why THE FREEZER reads and THE ABATTOIR does not.
2. **Local per-creature hex is banned.** If a creature needs a colour, it goes
   in `PAL` with a band. A creature palette may only *remap* existing keys.
3. **Cosmetics are palette swaps.** Nothing may hard-code a colour that a
   cosmetic needs to change.
4. **SIGNAL colours are never decorative.** If it is bright and saturated, it
   is either dangerous, useful, or light. The player learns this in floor 1
   and must be able to trust it on floor 10.
5. **Blood is the only colour allowed in every band.** It is the connective
   tissue of the whole game.

### Floors differ by VALUE, not hue

The current ten floors are one recipe in ten hues at one value (0.74–0.86
darkness, 25–35% luminance). That is the "one room, ten colours" bug.

- an act shares a value range; acts differ from each other
- **at least one floor must be genuinely bright** and one genuinely near-black
- never two adjacent floors at the same value

## SILHOUETTE

### The test, and it is not optional

Render at 4x, fill with pure black, look at nothing but the outline. **If two
creatures are the same black shape, they are the same creature.** Recipe:

```js
const sc=document.createElement('canvas'); sc.width=220; sc.height=140;
const sg=sc.getContext('2d'); sg.imageSmoothingEnabled=false;
drawSpr(sg, spr, 110, 70, 4, false, 1, null);
sg.globalCompositeOperation='source-in'; sg.fillStyle='#000'; sg.fillRect(0,0,220,140);
```

### Creature families

Mass distribution is the rule. Not detail — **mass**.

Under direction B, **creatures are products.** Every silhouette carries a
packaging element, and **asymmetry is the rule** — every creature has its tag,
seam or label on one side only. Nothing is mirror-symmetric. That alone
separates this game from every other roguelike and from its own past.

| family | is | mass | must have | must not |
|---|---|---|---|---|
| **crawler** | a tray of mince with legs | low, wide, horizontal | hard rectangle, flat top, **tag corner on one side** | be taller than wide, or be symmetrical |
| **shrieker** | a hanging pack | high, narrow, vertical | a punched header card at the top, a taper below | be symmetrical in mass |
| **stalker** | shrink-wrapped, limbs bound | jointed, upright | more negative space than solid | be a filled blob |
| **bloater** | a vacuum pack that lost seal | spherical, taut | one unbroken **convex** curve | have legs |
| **husk** | a crushed carton | collapsed | a **hollow** — the only inward silhouette in the game | be convex anywhere |
| **cyst** | a display pyramid | rooted, floor-wide | wider at the base than the top | leave the ground |

> [!warning] bloater / husk / cyst are the acceptance test for the whole rule
> These three are currently **one sprite with two tints**
> ([[Bugs Found#31]]) and they are three different decisions: kill at range,
> do not splash, cross the room. Convex / concave / rooted is not decoration —
> it is the shape of the instruction.
>
> Test them with **no colour information at all.** If the three black outlines
> are not immediately three things, the pass is not done.

### Bosses

**A boss may not share a silhouette family with any enemy.** A boss is a
different *order* of thing, not a bigger one. Currently four bosses are the
same dome-with-legs as the crawler — that is the bug this rule exists to kill.

Every boss needs one feature that leaves the bounding box: horns, a spit, a
reach, an overhang. If you cannot name that feature in four words, the
silhouette is not finished.

### Universal

- **Nothing is mirror-symmetric except by deliberate decision.** Symmetry is
  the current game's default and it is why everything reads as one family.
- One creature, one idea. If it needs two sentences, it is two creatures.

## MATERIALS

`shade()` takes a per-material lift/sink map and this is the lever that makes
a doctrine change roll across every sprite at once. Use it. Under B's flat
fluorescent, four materials behave differently:

| material | behaviour |
|---|---|
| **meat** | goes grey-green in the midtones, no wet specular — fluorescent kills shine |
| **bone** | yellows, flat even lift, no highlight |
| **plastic / film** | the only thing that keeps a hard specular — packaging shines, flesh does not |
| **steel / shelving** | narrow bright rim, dead flat face |

**If the art is invisible, do not draw it.** Floor 7 currently renders 18
props nobody can see at any lighting level a player experiences. Either light
them or cut them.

## ANIMATION

The current game animates **legs only** — a static body with a moving tail of
rows. Everything glides. That is the "no weight" problem.

### Frame counts and timing

| state | frames | timing | notes |
|---|---|---|---|
| **walk** | 4 | stepped by travel speed | the body moves too — bob or squash, not just legs |
| **pose / telegraph** | 1 held + 1 approach | ≥ 26 frames held | this is a *tell*; it must be readable at 1x in the dark |
| **hurt** | 2 | 6–8 frames total | recoil against travel direction |
| **death** | 3 | 14–18 frames | collapse, not a fade |

### Anticipation and recovery

Every attack is **anticipation → action → recovery**, and the player is owed
all three.

- **anticipation** ≥ 26 frames, and it must change the *silhouette*, not just
  the palette. A pose that only recolours is invisible at 1x.
- **action** is the shortest of the three.
- **recovery** ≥ 12 frames — this is the player's window and it must look like
  one.

## TELEGRAPH VOCABULARY

Fixed meanings. Once learned on floor 1, they must hold to floor 10.

| channel | means | when |
|---|---|---|
| **ground ring** | something lands *here*, on a clock | mortars, seeds, stamps |
| **sighting line** | a beam will sweep this arc | anything rotating |
| **emissive ramp on the body** | the creature is charging something | heat, absorption |
| **body rotation** | a sweep along the long axis | anything that turns |
| **rising pitch** | a threshold is approaching | pairs with emissive ramp |
| **the room changing colour** | a rule is changing, not an attack | twists, phase breaks |

Two hard rules:

1. **Darkness may never hide a telegraph.** Every telegraph needs a channel
   darkness cannot take: light it emits itself, sound, or a change to the
   whole screen. A held pose alone is not a telegraph on floor 7.
2. **A telegraph that has never been survivable is a tax.** If the player
   cannot act on it, it is damage with extra steps.

## REJECTED — do not reintroduce

| rejected | why |
|---|---|
| **Distinguishing creatures by tint** | `husk` and `cyst` are the bloater re-tinted. Colour is the first thing the dark takes |
| **Local per-creature hex palettes** | Why the roster looks like a monster collection instead of one building |
| **Ten floors as ten hues of one recipe** | Same value, same structure, same emptiness. Hue is not a place |
| **Symmetry as the default** | Everything is mirrored down the middle; it is why everything reads as one family |
| **Legs-only animation** | No weight, no anticipation, no recovery |
| **Full-screen text over the play area** | Event text sits exactly where the fight is |
| **Detail that only exists at 4x** | The game is played at 1x |
| **A single black keyline** | Reads flat; `PAL` already carries three outline tones — use them |
| **PNG sprites** | Kills cosmetics, kills doctrine-wide changes, kills the flip/tint cache. See CAMPAIGN DECISION 001 |
| **Uniform darkness as atmosphere** | 0.74–0.86 across ten floors is a filter, not lighting |
| **Soft radial vignettes as the dark** | B's dark comes from **dead tubes** — hard rectangular patches with clean edges |
| **Lore, cutscenes, narrative text, an arc** | This is a roguelike. Floors are places, not chapters (DECISION 007) |
| **Drifting back toward A · THE COLD ROOM** | B is committed to. If it is looking half-converted, that is the middle of the campaign, not evidence against it (DECISION 009) |
| **Wet specular on meat** | That is direction A. Under fluorescent, only *packaging* shines |
| **Symmetrical creatures** | B's rule is a tag, seam or label on one side only |

## WHEN TO STOP AND ASK

Claude cannot reliably judge whether a 16-pixel sprite reads. That is
established, not a disclaimer.

**Ask Damjan, do not decide, when:**
- judging whether something reads at game size, in the dark, at speed
- two silhouettes might be too close
- a colour choice changes the game's tone rather than its clarity
- a change trades frame budget for looks

**Decide yourself when:** the rule is already in this file. That is what it is
for.

## VERIFY

After any render-path change:

```bash
cd desktop && npm run selftest
```

plus in-page `MEAT.soak({floor:6, wave:3, seconds:12, seed:4242, mode:'kill'})`,
reporting ms/frame before and after. The frame budget is not negotiable.

Show work at 1:1 — 960x540 backing store, `imageRendering: pixelated`, no
browser resampling. Screenshot the game, not a zoomed sheet, except for the
silhouette test.
