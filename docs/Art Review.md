---
title: Art Review
tags: [design, art, audit]
---

# Art direction review — day one

Written from the running game at 1:1 (960x540 backing store, no browser
resampling), plus direct inspection of `SPR.anim`, `PAL`, `ROOMS` and the
prop table. Every claim here has a screenshot or a table behind it.

This is the hired-art-director review. It is not balanced and it is not kind.
The section at the end lists what is genuinely good and must survive, and that
list is real — but it comes last on purpose.

---

## The one-line diagnosis

**The art is authored at 4x and played at 1x.**

Everything that is good about this project — the material shading, the
hand-stamped faces, the three-tone selective outline, the sub-pixel AA — lives
at a magnification the player never sees. Everything that decides whether the
game reads — silhouette, value, hue separation — was never given a rule. So
the craft is real and it is being spent in a place nobody is looking.

That single sentence explains almost every specific failure below.

---

## THE TOP FIVE

Ranked strictly by how much fixing each one changes the impression of the
game. Not by effort.

### 1. Three of the six enemies are the same sprite with a colour wash

`husk` and `cyst` are **the bloater's sprite bank**, re-tinted and re-scaled:

| type | bank | scale | tint |
|---|---|---|---|
| bloater | `bloater` | 1.00 | — |
| **husk** | **`bloater`** | 0.85 | `rgba(216,210,196,0.45)` |
| **cyst** | **`bloater`** | 1.12 | `rgba(150,210,70,0.42)` |

There is no `SPR.anim.husk` and no `SPR.anim.cyst`. They do not exist.

This is the exact practice [[Bosses]] proudly says was removed from the boss
roster — *"A tint is not a design — it says 'this is the green one', and at
twenty-six pixels across, colour is the first thing a dark room takes away
from you."* That fix was applied to the ten bosses, which a player meets nine
times a run, and never applied to the six enemies, which a player meets
**thousands** of times a run.

It is worse than a repeated sprite, because these three behave in completely
different ways: a tank that bursts into acid, a husk that splits into two
crawlers, and an immobile hatcher you are supposed to walk across the room to
kill. The player must make three different decisions about three things that
look identical in the dark.

**This is the single most damaging art fact in the game.**

### 2. Every creature in the game is the same shape

Rendered as pure silhouettes at 4x, all six enemies are a **rounded dome**.
The only variation is leg count and height:

| creature | silhouette |
|---|---|
| crawler | dome, four stubby legs |
| shrieker | dome, two legs — near-identical to crawler |
| stalker | dome, two long legs with a gap — *the only real variation* |
| bloater | dome, no legs |
| husk | dome, no legs, smaller |
| cyst | dome, no legs, larger |

The bosses are better but the docs overclaim. **THE BUTCHER, MOTHER OF MELONS,
THE TRIMMINGS and THE BEST BEFORE are all the same dome-with-legs.** Five of
eleven boss silhouettes are genuinely distinct (PITCHER, HOGFATHER, COURIER,
FISHWIFE, NIGHT SHELF, the finale); the rest are not.

Worse: **the bosses share the shape family with the enemies.** A boss is not a
different order of creature, it is a bigger one. Nothing in the silhouette
says *this one is a fight*.

There is one shape (a dome), one view (flat-on, front), and one construction
(a face stamped on a body). Every creature in the game is a variation on it.
That is not a style — it is one idea used twenty times.

### 3. The ten floors are one room, hue-shifted — and this is provable

Every floor uses the identical palette *recipe*: three desaturated mid-dark
stops of a single hue, a wall triad of the same hue one step lighter, one
saturated accent, and a darkness value between 0.74 and 0.86.

| # | floor | hue | dark |
|---|---|---|---|
| 1 | THE ABATTOIR | brown | 0.76 |
| 2 | THE HOLLOW | blue-grey | 0.80 |
| 3 | THE MEAT LOOP | purple | 0.80 |
| 4 | THE RED KITCHEN | red | 0.82 |
| 5 | THE FREEZER | blue | 0.74 |
| 6 | THE RENDERING | green | 0.80 |
| 7 | THE LONG TABLE | olive | 0.82 |
| 8 | THE SALT LINE | warm grey | 0.78 |
| 9 | THE LAST AISLE | purple | 0.84 |
| 10 | THE KILLING FLOOR | red | 0.86 |

Ten floors, **six distinct hues** — 3 and 9 are both purple, 4 and 10 are both
red, 2 and 5 are both blue. And the **value range is identical across all
ten**: everything sits at roughly 25–35% luminance.

THE SALT LINE is a room encrusted in salt and it is mid-grey. THE FREEZER
should be the brightest, hardest, coldest room in the building and it is the
same value as the abattoir. **Not one floor is bright. Not one is black.** The
single lever that could make ten places feel different is moved by 0.12 across
the entire game.

Architecture does not differentiate them either: same flat tile grid, same
camera height, same prop density, same emptiness. The layout names
(`scatter`, `pillars`, `ring`, `corridors`, `bunkers`) do not read at all in
play.

### 4. The lighting deletes the art, then the art is drawn anyway

On floor 7 in god mode — *brighter* than a player ever sees it — the room
contains 4 tables, 4 shelves, 5 crates and 5 lit candles. **Not one of them is
visible.** The screen is a black void with a small lamp around Damjan.

The whole environment art budget is being spent below the visibility floor.
Every prop, every surface treatment, every wall style, every one of the twelve
baked tile variants: drawn, then covered by a 0.8 black wash.

Meanwhile at 70 enemies on floor 9, the elite is drawn *on top of* the player
and I could not tell where Damjan was. The player has no rim light, no
outline priority, no drop shadow, no z-order privilege — nothing that says
*this pixel is you*. Every game in this genre solves this and this one has not.

### 5. The palette is 68 keys that nothing obeys

`PAL` is a genuinely well-designed palette — blood in four states, three
selective outline tones, a neutral value ramp, material keys for bone, meat,
cloth, metal. It is the best-designed asset in the project.

And **almost every creature overrides it with local hex values.** The crawler
declares its own `L/f/F/E/k/x/9/X/,/;`. So does every other creature. `PAL` is
a default that the art routes around, which is why the roster looks like a
cartoon monster collection — a blue vessel, a cyan fish, an orange roast, a
green melon, a pink hog — rather than the inhabitants of one building.

There is no rule anywhere that says *what a colour is for*. That is the actual
root cause of "it has no style".

---

## The rest, ranked

### 6. Nothing has weight — the bodies do not animate

A creature is one static body plus a short tail of rows that move. The walk
cycle is **legs only**. No squash, no stretch, no head bob, no breathing, no
anticipation in the mass. Everything glides like a chess piece with its feet
wiggling.

There is a `pose` frame per creature and it is a good idea. Two frames of
telegraph is not an animation system, though — it is a still and another still.

### 7. The HUD is five unrelated debug overlays

Health bar (segmented red blocks, top-left), level, three pickup counters,
score (top-right, seven digits, no framing), run timer, minimap (a grey box
with a hairline border), ammo (bottom-left, different bar style from health),
weapon name and icon (bottom-centre). Five corners, four bar styles, three
type sizes, no shared frame, no shared language.

The minimap in particular looks like a debugging tool someone left on.

### 8. The title screen has no logo

"MEAT PROTOCOL" is a default blocky pixel font, letterspaced wide, with a red
glow behind it. It is not a wordmark. The four menu buttons are thin
rectangles in four unrelated hues — amber, purple, amber, cyan — which is the
palette problem showing up on the first screen a player ever sees.

### 9. Cards are empty

`THE MENU` is the best-composed screen in the game — corner brackets, clean
rarity coding, the aisle strip, good type. And every card is **80% empty
space** with faint horizontal rules. In a game whose entire identity is the
deck, no card carries an image. Inscryption, Balatro and Slay the Spire all
make the card face the memorable object. This one has the frame and not the
picture.

### 10. The full-screen event text sits on top of the fight

`THE LIGHT DOES NOT REACH`, `WAVE 4 CLEARED`, `THE COLD` — enormous centred
type drawn over the middle of the arena, exactly where the player is looking
and exactly where the enemies are. It is well-typeset and it is in the wrong
place.

---

## What every game in this genre has that this one does not

| | who does it | what it buys |
|---|---|---|
| **Player-priority rendering** | Nuclear Throne, Gungeon, Vampire Survivors | you never lose yourself in a crowd |
| **A value hierarchy** — enemies dark, threats bright, floor darkest | Vampire Survivors, Noita | 200 enemies stay readable |
| **Silhouette families by behaviour** | Gungeon, Isaac | you read the threat before the sprite |
| **Hit feedback with weight** | Dead Cells, Gungeon | shooting feels like contact |
| **A signature colour crime** | Hotline Miami, Carrion, Signalis | screenshots are recognisable |
| **Environmental storytelling in props** | Darkest Dungeon, Blasphemous | rooms mean something |
| **A wordmark** | all of them | the game has a face |

---

## What is genuinely good and must survive

This list is short but it is not a courtesy. These are real assets.

1. **The up2 / shade / stamp pipeline.** Authoring at 1x for silhouette,
   lifting to 2x, generating form shading from a per-material map, then
   hand-stamping the face — that is a *good* pipeline and it is the reason
   the game has any identity at all. Keep it. Everything below is achievable
   inside it.
2. **The 68-key palette itself.** Blood in four states and three outline
   tones is genuinely thoughtful design. It needs enforcing, not replacing.
3. **The faces.** At 4x the crawler's sideways grin, the shrieker's blind
   sockets and the stalker's stitched skull are the best art in the project.
   They are wasted at 1x, which is a framing problem, not a quality problem.
4. **THE MENU screen.** Composition, type and rarity coding are all right.
5. **The floor title cards.** `THE ABATTOIR / floor 01 // where the meat is
   hung` is the most stylish thing in the build. The type voice here is the
   game's voice and nothing else lives up to it.
6. **THE FREEZER.** The one floor that reads as a place, and it shows why:
   cold ground against warm bodies. It is the accidental proof of the palette
   doctrine the game needs.
7. **The writing.** Every name, subtitle and boss cry is better than the art
   it is attached to. The art has to catch up to the words.

---

## The uncomfortable conclusion

There is nothing wrong with this game's *craft*. The pipeline is good, the
palette is good, the faces are good, the writing is very good.

What is missing is **doctrine** — a set of rules that say what a colour is
for, what a shape means, where light comes from, and what the player is
allowed to lose track of. Without those, twenty well-made sprites do not add
up to a style; they add up to twenty well-made sprites.

That is a solvable problem, and it is solved by deciding, not by drawing.

## Related
- [[Art Direction]] — the three directions this review leads to
- [[CAMPAIGN]] — the plan that executes the chosen one
- [[Rendering]] — the pipeline being judged
