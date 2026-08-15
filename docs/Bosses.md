---
title: Bosses
tags: [reference, systems]
---

# Bosses, elites, the apex and the finale

Bosses used to land on five of the ten waves, which made them furniture. A
floor now has **one** floor boss, on wave 5, with two **elites** on the way
there — three on [[Floors|THE LAST AISLE]] — and on floor 5 the boss comes up
as an **APEX** instead.

Floor 10's wave 5 is not a roster boss at all. It is [[#THE MEAT PROTOCOL|the
finale]], and it is the end of the game.

| wave | what |
|---|---|
| 4 | elite (3, 6 and 8 on the `hunt` floor) |
| 8 | elite |
| 10 | floor boss — **two phases** — APEX on floor 5, **THE MEAT PROTOCOL** on floor 10 |

```js
BOSS_WAVE  = 10
MINI_WAVES = [4, 8]
HUNT_WAVES = [3, 6, 8]
APEX_EVERY = 5      // isApexFloor(f) → !isLastFloor(f) && (f + 1) % 5 === 0
```

## The roster is shuffled, and that took a rewrite

There are ten roster bosses and nine floors that use one. Which boss you get
on which floor is **rolled once per run** by a Fisher–Yates shuffle over the
roster indices, cached on `S.roster`:

```js
function rollRoster()      { /* shuffle [0..9], cache on S.roster */ }
function bossIndexFor(f)   { return (S.roster || rollRoster())[clamp(f,0,9)]; }
```

So a run has nine of the ten bosses in it, in a different order every time,
and which one you *never* meet is also different every time.

> [!warning] This could not be done while HP lived on the boss
> The roster used to carry `hp: 1400 … 3000` per entry and `bossIndexFor` was
> `floor % 10`. Shuffling that puts a 3000-HP boss on floor 1 and a 1400 on
> floor 9 — the identity and the difficulty were the same number, so the order
> could not be touched.
>
> **HP is decoupled from identity now.** The floor owns the health; the roster
> owns the fight:
>
> ```js
> const BOSS_HP = [1350, 1520, 1700, 1880, 2060, 2250, 2440, 2640, 2850];
> const FINAL_HP = 4200;
> function bossBudget(floor) {
>   if (isLastFloor(floor)) return FINAL_HP;
>   return BOSS_HP[clamp(floor,0,8)] * (BOSSES[bossIndexFor(floor)].bulk || 1);
> }
> ```
>
> `bulk` (0.92–1.12) is the only thing identity still contributes, and it is a
> texture rather than a tier: THE HOGFATHER is a little chunkier than THE
> COURIER wherever they land.

`bossBudget()` is the **single** place that answers "how much boss is this
floor worth", and both `spawnBoss()` and `spawnMini()` go through it — so an
elite can never be priced against a different number than the boss it is a
share of. It was written that way after the first attempt left `spawnMini`
reading a field that no longer existed, and every elite in the game spawned
with a NaN health bar.

## The ten

Every boss has a **kit**: an opening pattern and a different one it breaks
into. No two share a pair.

| # | boss | opens | breaks to | summons | cry |
|---|---|---|---|---|---|
| 0 | **THE BUTCHER** | `hook` | `rush` | 3 crawlers / 6.5s | *IT REMEMBERS YOUR NAME* |
| 1 | **MOTHER OF MELONS** | `brood` | `nova` | 4 (crawler×2 + shrieker) / 4.2s | *SHE IS FULL OF CHILDREN* |
| 2 | **THE PITCHER** | `blink` | `curtain` | 3 (stalker + crawler) / 7.0s | *IT CAME THROUGH THE WALL* |
| 3 | **THE HOGFATHER** | `mortar` | `burst` | 4 (crawler + shrieker + bloater) / 6.0s | *HE IS CARRYING SOMETHING* |
| 4 | **THE COURIER** | `circle` | `mines` | 4 (stalker×2 + crawler) / 6.8s | *IT HAS BEEN CIRCLING FOR HOURS* |
| 5 | **THE FISHWIFE** | `sweep` | `blink` | 4 (shrieker + crawler + husk) / 5.4s | *SHE HAS BEEN ON ICE SINCE FRIDAY* |
| 6 | **THE TRIMMINGS** | `spawner` | `rush` | 5 (crawler + husk×2) / 3.6s | *IT IS EVERY PART THEY DID NOT SELL* |
| 7 | **SUNDAY ROAST** | `charge` | `spiral` | 4 (bloater + crawler + shrieker) / 5.8s | *IT HAS BEEN IN THERE SINCE SUNDAY* |
| 8 | **THE NIGHT SHELF** | `mines` | `curtain` | 5 (stalker×2 + husk) / 6.2s | *IT ONLY RESTOCKS AFTER CLOSING* |
| 9 | **THE BEST BEFORE** | `brood` | `sweep` | 5 (bloater + cyst + husk) / 5.0s | *THE DATE PASSED AND IT KEPT GOING* |

## The look of them

All ten used to share **two** sprite banks and tell themselves apart with a
colour wash. A tint is not a design — it says "this is the green one", and at
twenty-six pixels across, colour is the first thing a dark room takes away from
you. Every one is now authored from its own **silhouette**, so it can be named
from the outline before any hue arrives, and **not one carries a tint**.

| boss | the shape |
|---|---|
| **THE BUTCHER** | a hooked slab with the head sunk into the shoulders |
| **MOTHER OF MELONS** | a many-eyed sac that splits down its whole height |
| **THE PITCHER** | a glass vessel — shoulders, belly, foot — with a face suspended *in* the liquid rather than on it |
| **THE HOGFATHER** | ears out at the top corners and two tusks that leave the outline; the only thing with anything pointing **up** out of it |
| **THE COURIER** | no legs. A visored torso over one spoked wheel — the only circular lower half in the game |
| **THE FISHWIFE** | nearly all mouth, and the only figure that tapers to a point then flares into a fluke; everything else gets wider on the way down |
| **THE TRIMMINGS** | **no symmetry anywhere.** Every other figure is mirrored down its middle; a heap has no middle, and the lean is the identity |
| **SUNDAY ROAST** | a spit straight through and out both sides — the only horizontal line in the roster — trussed into segments, charred on top |
| **THE NIGHT SHELF** | hard right angles and shelf lines where everything else is organic. There is still stock on it. Some of it is looking back |
| **THE BEST BEFORE** | bottom-heavy and slumped: a teardrop the wrong way up, the only one that looks like it is losing to gravity |

> [!note] The test that matters is the silhouette, not the palette
> Two bosses the same shape are the same boss whatever you paint on them. Every
> creature bank in the game is checked for a unique outline, and the check is
> what caught the last duplicates.

> [!note] `H` was never in the finale's palette
> The finale's horns were plotted with `H`, which its own palette never
> declared — so they fell through to the **global** one, where `H` is hair
> brown. A demon lord in a crown of hair is not the note. It is declared as
> bone now. Worth remembering: an undeclared key does not fail loudly, it
> silently inherits.

## Patterns

Fourteen of them. The first eight came with the original roster; the six
below the line were written so that "a different boss" means a different
fight rather than a different sprite tint.

### The originals

- **charge** — idles toward you, telegraphs (0.75s, red line shown), then
  charges at 5.2× speed in a straight line.
- **spawner** — drifts, periodically rings out a full-circle burst of
  projectiles (12 + 4/floor) instead of charging.
- **blink** — teleports to a random point 55–90px from you every 2–3s, firing
  a 5-shot spread on arrival.
- **burst** — charges like `charge`, but leaking projectiles mid-charge and
  detonating into a 16-way ring burst when the charge ends.
- **circle** — orbits you at 96px, tightening in for a 4.6× speed charge, then
  rings out 8 projectiles. Never fully stops moving.
- **spiral** — plants itself and screws 2–4 continuous arms of shot outward at
  2.1 rad/s. The one pattern where the boss stops caring where you are.
- **nova** — holds at ~130px and detonates on a metronome, alternating the ring
  offset so the gap you used last is where the next one lands.
- **rush** — no telegraph, no rest, capped at **112 px/s** against your 94. It
  sheds a 7-round wall behind itself every 2.4–3.4s and steers lazily, so it
  overshoots when you juke.

### The six kits

Each of these asks a different question of the room. That is the whole design
brief: `curtain` says the room is a corridor, `sweep` says standing anywhere is
a decision, `mines` says the floor you already crossed is spent, `brood` says
you have to choose between the boss and the room.

- **hook** — *THE BUTCHER.* Works at a butcher's distance (~96px) and if you
  back off further it **throws a hook and drags you back in**. You cannot solve
  this one by kiting, which is exactly why it is on the first boss you meet:
  the game teaches you to kite for nine waves and then introduces something
  that has read the manual. Inside its reach it also swings a 5-shot fan.
- **brood** — *MOTHER OF MELONS, THE BEST BEFORE.* She will not fight you: she
  backs off to 170px and **seeds the room**, and every seed hatches into
  something that will. The eggs are [[#Hazards|mortar marks that hatch instead
  of detonating]], so you can see the room's next shape two seconds before it
  arrives.
- **mortar** — *THE HOGFATHER.* Sits at range, strafes, and walks a
  **three-shell volley** across where you are *going* — the lead grows with
  each shell, so running in a straight line puts you under the third one. The
  only pattern that punishes committing to a heading.
- **curtain** — *THE PITCHER, THE NIGHT SHELF.* Goes to a wall and fires an
  11-slot wall of shot across the arena with **one two-wide moving hole** in
  it. The room stops being a space and becomes a corridor with a door in it.
  It does not chase at all while it does this — the safest place to stand is
  right next to it.
- **sweep** — *THE FISHWIFE, THE BEST BEFORE.* Plants and **turns a beam**.
  The beam doesn't track, doesn't stop and can't be blocked; you cross it or
  you leave. It winds up as a harmless sighting line for 0.9s first, and the
  spin direction **flips between casts**, because a beam that always turns the
  same way is one you solve once.
- **mines** — *THE COURIER, THE NIGHT SHELF.* Orbits at speed and leaves
  **armed mines** behind it, so the floor it has already crossed is floor you
  cannot use. The arena shrinks over the fight instead of the boss getting
  bigger. Capped at 14 live; the mines outlive it by design.

## Hazards

The six kits needed a layer that isn't a bullet and isn't an enemy. `S.haz`
holds three kinds, updated in `updateHaz()` and drawn in two passes —
`drawHaz(0)` on the floor, under everything, and `drawHaz(1)` over the top for
beams.

| kind | is | behaviour |
|---|---|---|
| `mark` | a targeting ring on the ground | counts down, then **detonates** — or **hatches** an enemy if it carries `spawn` |
| `mine` | a dropped charge | arms after 0.7s, then triggers on proximity |
| `beam` | a rotating line | anchored to its owner (`h.b`), sweeps by `h.spin`, harmless during `warm` |

```js
function mortarAt(x, y, r, dmg, t, col) {
  S.haz.push({ k: 'mark', x, y, r, dmg, t, max: t, col: col || '#ff8a2b' });
}
```

Anchoring beams to the boss rather than to a position is what lets
[[#Phases|enterPhase]] clean up after itself: everything with `h.b === b` goes
when the boss breaks.

## Phases

A roster boss has **two**; the finale has **three**. The bar divides into
`phases` equal bands and it breaks on every boundary:

```js
if (b.ph < b.phases && b.hp <= b.max * (1 - b.ph / b.phases)) enterPhase(b);
```

On a break:

- it rears up for **1.05s** — **1.35s** for a final form — holding still
- `knockRoom(240, 300)` throws everything off it, itself included
- **+24% speed, +16% damage**, and its summon timer is pulled in to 1.2s
- **every bullet and hazard it owns is cleared** (`S.eb.length = 0`, and any
  `S.haz` entry whose `b` is this boss)
- it switches to the next pattern in its kit for the rest of the fight
- red flash, hitstop, `SECOND PHASE` / `FINAL PHASE` over its head, and its own
  `cry2` / `cry3`

> [!note] Why the break wipes the screen
> Two reasons, and the second is the real one. A phase change that leaves the
> last pattern's bullets in the air reads as the two patterns *overlapping*
> rather than one *replacing* the other — and on a three-phase fight that
> compounds into noise nobody can parse. The rear-up is also the player's
> window, and handing someone a window with the room still full is not a
> window.

> [!note] The rear-up is not invulnerable
> Deliberately. It stands still for a second because that is the *reward* for
> breaking it — i-frames on an opening you have just earned reads as the game
> taking the opening back. If you can burst it down during the break, that is a
> build working.

The bar does **not** refill. N phases over one bar is structure; N phases over
N bars is just N times the health.

## THE MEAT PROTOCOL

Floor 10, wave 5. Not in the roster, never shuffled, **4200 base HP**, and the
only thing in the game with three phases. It does not reuse a roster pattern
for any of them.

```js
const BOSS_FINAL = {
  key: 'protocol', name: 'THE MEAT PROTOCOL',
  final: 1, phases: 3, pat: 'p1', pat2: 'p2', pat3: 'p3',
  addT: 5.2, addN: 4, adds: ['crawler', 'husk', 'shrieker'],
  cry:  'IT IS WHAT THE BUILDING IS FOR',
  cry2: 'IT IS OPENING',
  cry3: 'THERE IS NOTHING LEFT OF IT BUT THE APPETITE'
};
```

Each phase is built to **invalidate the answer that got you through the last
one**, which is the only thing that makes a three-phase fight better than a
two-phase fight with more health.

| | it does | you have to |
|---|---|---|
| **p1** | holds the centre and will not be moved off it. A 26-round ring on a 2.4–3.0s beat with an alternating offset, and a leading 3-shot spit every 0.62s between rings. | play at range, inside its rhythm |
| **p2** | comes off the middle and **hunts** at 118 px/s with lazy steering, dropping **two mortar shells on where you are running to** every 1.9s, plus a 9-shot fan along its own heading. | keep crossing it — range has stopped working, and juking into open floor is now the wrong instinct |
| **p3** | plants for the last time and opens **two beams 180° apart**, turning at 0.5 rad/s, while a thin two-armed spiral fills in behind them. | run one continuous circle — there is exactly one safe wedge and it is always moving |

> [!note] It never summons in p3
> ```js
> if (pat !== 'p3' && b.spawnT <= 0 && S.en.length < addCap) { ... }
> ```
> Adds during a bullet-hell phase is how you make a finale unreadable rather
> than hard. p1 and p2 each call for backup; p3 is you, it, and the geometry.

p3 is also the only pattern in the game with **no rest beat in it**. It is the
last thirty seconds of the game and it is allowed to be.

### Killing it ends the run

`killEnemy()` branches on `e.final`: it clears every bullet, hazard, crack and
queued effect, kills whatever is still standing, and sets `S.won` with a 3.4s
countdown into [[Rendering#The win screen|the win screen]].

It also zeroes `S.upgPts`, `S.sigDue` and `S.pendingLuck`:

> [!warning] The level-up screen used to swallow the ending
> The finale's own kill still runs `gainXP`, which can level you up on the last
> hit — so the hand opened **over** the victory beat, and then stalled it,
> because the win countdown only ticks in `mode === 'play'`. The guard is
> `if (!S.won && S.upgPts > 0)` plus throwing the banked picks away. You have
> won; there is nothing left to spend them on.

Putting it down signs **CLOSING TIME** ([[Contracts]]), which starts every
future run on a hand of four.

## Elites

A regular horror that got too big for the aisle. `spawnMini()` takes an
ordinary [[Enemies|enemy]] type, names it, scales it up and puts it on the boss
bar — but it keeps its own species' AI, so THE LONG WALK still teleports and
THE SPOILAGE still bursts on death.

| elite | species | colour |
|---|---|---|
| **THE FIRSTBORN** | crawler | orange |
| **THE CHOIRMASTER** | shrieker | green |
| **THE LONG WALK** | stalker | bone |
| **THE SPOILAGE** | bloater | pink |
| **THE HOLLOW MAN** | husk | pale |
| **THE BROODMOTHER** | cyst | acid green |

Which one you meet is `(floor * 2 + slot) % 6`, so a floor's two elites are
always different species. Elites do **not** have phases — they are a wall, not
a fight with an act break.

They are not a chunky crawler: an elite carries **1.9×** its species' damage,
moves 25% faster, is nearly twice the size, and on its own timer (2.2–3.2s)
fires a ring of `8 + floor*1.5` shots **and summons `1 + floor*0.7`
reinforcements**.

### Priced off the floor's boss, not off the species

```js
ELITE_SHARE = 0.22
hp = bossBudget(floor) * ELITE_SHARE * flavour * powerMul()
```

It used to be `speciesHP * (5 + floor*1.6)`, which was quietly broken: the
species table spans **26 (CRAWLER) to 170 (CYST)**, a 6.5× swing, and the depth
term multiplied straight through it. On any floor whose elite slots landed on
HUSK/CYST, the **second elite outlasted the floor boss** — 1.93× on floor 6
in the original build, 9.71× once the build multiplier landed on top.

Species should decide how a thing *fights*, not how big its bar is. `flavour`
(0.93 CRAWLER → 1.35 CYST) keeps a BROODMOTHER chunkier than a FIRSTBORN, but
1.45× chunkier rather than 6.5×. The ordering is true **by construction** at
every depth — worst case is `0.22 × 3.2 = 0.70×` the boss. Measured across all
ten floors it holds at **0.30×**.

### They scale to your build, not just to the floor

`diff()` scales the floor by *depth*. That is half the story: two runs on floor
6 can be five minutes and forty minutes apart in power. `powerMul()` sums what
you chose to pick up:

| term | each |
|---|---|
| levels | +5% |
| cards taken | +3% |
| guns owned | +7% |
| [[The Deck#The five aisles\|THE ORDER]] rungs reached | +12% each |
| off-cuts built | +18% |

The signature-level term went with the [[Groceries|groceries]]. The aisle rungs
replaced it, and are a better read anyway: a run with two aisles at MASTERED is
a committed build in a way that "holds four items" never quite was.

**Capped at 3.2×**, and half of it applies to their damage as well.

> [!note] Deliberately not applied to floor bosses
> They already have a floor HP band and a [[#Phases|phase break]] doing that
> job. Stacking a build multiplier on top of both would make the boss wave the only
> wave that matters.

> [!warning] The elite summon still has no ceiling
> Unlike the [[#Summoning|floor-boss summon]], the elite branch in
> `updateEnemy()` has neither the population gate nor the clamp. Ten floors
> caps how deep this can get — it is nothing like the floor-26 measurements
> that found it — but it is still the one summon path in the game without a
> ceiling. See [[Bugs Found#A. Elite summons bypass the enemy cap]].

## APEX

**Floor 5** — and floor 5 only, now that the run is ten floors and the tenth
belongs to [[#THE MEAT PROTOCOL|the finale]]. The floor boss arrives as an
APEX: same kit, same roster slot, everything else turned up.

| | floor boss | APEX |
|---|---|---|
| hp / dmg | ×1 | ×2.6 hp, ×1.45 damage |
| size | ×1 | ×1.45 radius, ×1.5 sprite |
| speed | ×1 | ×1.22 |
| score | 500 | 1400 |
| tint | its own | purple |
| card drop | 55% | **guaranteed** |
| hand luck | +1.2 | **+2.4** |

It announces itself with a purple screen flash and *IT CAME UP WRONG AND IT
KEPT GROWING*. Killing one signs **APEX PREDATOR**, which widens every hand you
are ever dealt to four cards.

> [!note] One APEX a run makes it an event again
> On an endless descent it landed on 5, 10, 15, 20 … and became a rhythm. There
> is exactly one now, halfway down, and `isApexFloor()` explicitly excludes the
> last floor — the finale does not need help.

## On death

| | elite | floor boss | APEX | THE MEAT PROTOCOL |
|---|---|---|---|---|
| coins | 15 | 26 | **50** | — *(the run is over)* |
| card chance | 20% | 55% | **100%** | — |
| a pick | yes | yes | yes | **discarded** |
| hand luck | +0.5 | +1.2 | +2.4 | — |
| opens deck tier | 1 | 1 **and 2** | 1 and 2 | — |
| contract | — | BREAK THE SEAL | APEX PREDATOR | **CLOSING TIME** |

Every one of them gets a full [[Rendering#Death burst|death burst]] at 3×
scale, hitstop, a red screen flash, and the score drops to a boss-kill sting.
The pick is deferred by `S.lvlDelay = 1.1` so the hand doesn't slam up over the
death animation.

> [!note] Only a floor boss opens the top of the deck
> Elites increment `S.bossKills` but **not** `S.floorBosses`. Tier-2 cards —
> the novas, the second chances — need a real floor boss. See
> [[The Deck#Unlock gates]].

## Their escort

A boss or elite wave also queues filler alongside the named thing —
`4 + n*0.9 + floor*3.5` for a boss, `6 + n*1.4 + floor*3` for an elite. From
**floor 2** that filler mixes in [[Enemies#The two late arrivals|husks]], so
clearing the room around a boss with splash stops being free.

## Summoning

Every floor boss calls for backup on its own `addT`/`addN` schedule, but only
while the arena is under a floor-scaled ceiling:

```js
addCap = min(30, 14 + floor*4 + evolution*2)
if (pat !== 'p3' && b.spawnT <= 0 && S.en.length < addCap) { ... }   // gate
const cnt = Math.min(addN + floor/2, addCap - S.en.length);          // clamp
```

This is what keeps a summoning boss on top of a boss-wave spawn queue from
turning into an avalanche.

## PACI keeps wave hours

The shop does not hang off boss kills at all. Clearing **wave 5** or **wave
10** sets `S.shopDue` and the next door leads sideways — twice a floor, on the
fives. See [[The Shop#Cadence]].

## Related
- [[Floors]] — which floor each of these lands on, and what the room is doing while you fight it
- [[Enemies]] — the six regular types, and what an elite is made of
- [[The Deck]] — the hand a boss pays out in
- [[Contracts]] — BREAK THE SEAL, APEX PREDATOR and CLOSING TIME all count boss kills
