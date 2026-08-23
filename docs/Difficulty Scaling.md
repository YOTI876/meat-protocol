---
title: Difficulty Scaling
tags: [reference, systems, formulas]
---

# Difficulty Scaling

Every input that makes the game harder, and the exact formula each one drives.
Six independent axes stack multiplicatively.

## The axes

| axis | grows from | feeds |
|---|---|---|
| **floor** (`S.room`) | descending, **0–9** | HP, damage, speed, score, spawn count, spawn cap, boss add-cap, elite adds |
| **[[Floors#Twists\|the floor's twist]]** | which of the ten you are on | spawn count and health (`swarm`), damage both ways (`frail`), sight (`dark`), grip (`slick`), tempo (`frost`) |
| **wave** (`S.wave`) | 1→10 per floor | spawn count (quadratic), enemy type mix |
| **evolution** (`S.evo`) | [[Economy#Evolution]], capped at 10 | HP, damage, speed, score, spawn count, boss add-cap, spawn cap |
| **weapons owned** | buying guns, **and the [[Economy#What a rung pays out\|evolution roster]]** | spawn count (+10%/gun), spawn cap |
| **player level** | [[Progression#XP & levels]] | spawn count (+6%/level), spawn cap |
| **LOUDMOUTH** | [[Augments]] | spawn count (+18%/rank) |

## `diff()` — enemy stat multipliers

```js
hp    = (1 + floor*1.25) * (1 + evo*0.46)
dmg   = (1 + floor*0.72) * (1 + evo*0.30)
spd   = (1 + floor*0.11) * (1 + evo*0.06)
score = (1 + floor*0.70) * (1 + evo*0.50)
```

> [!note] The evolution terms went up with the payout
> They were `0.38 / 0.26 / 0.05`. A rung used to buy a flat world-difficulty
> increase and nothing else; it now hands over a
> [[Economy#What a rung pays out|gun you keep forever]], and past the full
> roster a LEGENDARY card you open every run holding. Ten rungs of that is a
> different character, so ten rungs of this had to be a different building.
>
> Measured on a floor-1 CRAWLER: **26 HP / 16 damage** at EVO 0, **86 / 40** at
> EVO 5, **146 / 64** at EVO 10 — 5.6× and 4×.
>
> Elites need no term here at all. `powerMul()` counts guns held and cards in
> the deck, so an evolved roster prices them up on its own. See
> [[Bosses#They scale to your build, not just to the floor]].

Applied per-spawn in `spawnEnemy()`/`spawnBoss()`, on top of each type's base
stats in [[Enemies]]/[[Bosses]]. **None of these terms is capped**, but the
floor term now runs out: floor 10 (`S.room === 9`) is the last rung, at ~12×
HP and ~7.5× damage over floor 1.

That bound is the point. An unbounded curve had to stay gentle enough to be
survivable at floor 30, which made floors 1–10 — the only ones most runs ever
saw — flatter than they should have been. Nine rungs of ramp, each one felt,
beats an asymptote nobody reaches.

The HP and damage curves are both much steeper than they were (0.95 and 0.62
respectively) because [[The Deck|the deck]] gives you far more power per floor
than the old armory did — and steeper again in effect now that
[[The Deck#Riders — the reason rarity is a moment|riders]] and
[[The Deck#Off-cuts — the fusions|off-cuts]] compound on top of the numbers.

## Wave spawn count

```js
armed    = 1 + max(0, gunsOwned - 1) * 0.10
levelled = 1 + max(0, playerLevel - 1) * 0.06
count = round((7 + wave*2.6 + wave²*0.26) * (1 + floor*0.72)
             * (1 + evo*0.12) * armed * levelled * ST().swarm)
```

Boss and elite waves don't use this — they queue a smaller fixed escort
(`4 + n*0.9 + floor*3.5` for a boss, `6 + n*1.4 + floor*3` for an elite) on
top of the named thing itself, mixing in husks from floor 2.

The **mix** shifts with wave and floor independently of the count:

```js
crawler   10
shrieker  3 + n*0.4  + floor          // wave 2+, or any floor past 1
stalker   2 + n*0.45 + floor          // wave 4+
bloater   1 + n*0.35 + floor*1.5      // wave 6+
husk      1 + n*0.3  + floor          // wave 5+
cyst      0.5 + n*0.15 + floor*0.5    // wave 7+, or floor 3+
```

So a deep floor is not just more of the same enemy — the ratio tilts toward
the things that punish standing still.

## Concurrent cap

```js
concurrencyCap() = min(95, round(18 + wave*2.6 + floor*9.5 + evo*2
                                 + max(0, gunsOwned-1)*1.5 + max(0, level-1)*0.8))

liveLoad()       = S.en.length + S.cracks.length     // gate: liveLoad() < cap
```

> [!note] One definition, read by everything that spawns
> This used to be computed inline in `updateWaves()` and nowhere else, which is
> precisely how the elite summon came to ignore it — there was nothing to
> ignore, because the number did not exist outside that one function. It is
> `concurrencyCap()` now, and `eliteSummon()` reads the same function the wave
> spawner does.

This is the ceiling on simultaneously-alive enemies — the queue can be much
larger; the cap just throttles how many exist at once.

The gate counts **cracks as well as live enemies**. Cracks take 0.75s to
hatch but spawn batches fire every 0.15s, so counting only what was already
breathing let deep floors put five batches in the air before the cap noticed.
See [[Bugs Found#13. Deep floors overshot the enemy cap]].

### Measured — ordinary waves

24-second soak per row, god mode on so nothing dies and the arena fills.

| floor / wave | queued | cap | live at once | ms/frame |
|---|---|---|---|---|
| 1 / 1 | 10 | 19 | 10 | 0.52 |
| 1 / 7 | 38 | 27 | 38 | 1.18 |
| 4 / 7 | 120 | 56 | 72 | 1.62 |
| 8 / 7 | 229 | 94 | 102 | 2.46 |
| 15 / 7 | 420 | 95 | 100 | 2.69 |
| 26 / 7 | 721 | 95 | 109 | 2.04 |

> [!note] The last two rows are from the endless era
> Floors 15 and 26 no longer exist — the run stops at ten. They are kept
> because they are the rows that prove the **shape** is right: the total you
> have to kill can climb as far as you like while concurrency stays bounded, so
> the frame budget never was the thing that limited how deep the game could go.
> Floor 10 wave 7 is the real ceiling now, and it sits comfortably inside the
> floor-8 row.

Live sits over cap for three compounding reasons, all bounded: a spawn batch
is `1 + wave/4 + floor` enemies and lands whole (at floor 26 that's up to 28
at once), every [[Enemies#The two late arrivals|husk]] that dies adds two
crawlers outside the gate, and every cyst hatches on its own timer — though
the cyst at least checks `S.en.length < 70` before it does.

## Boss summon ceiling

```js
addCap = min(30, 14 + floor*4 + evo*2)
cnt    = min(addN + floor/2, addCap - S.en.length)
```

Gated on `S.en.length < addCap` *and* clamped so a summon can never carry the
count past the ceiling. Each boss also has its own interval and roster — see
[[Bosses#Summoning]]. The gate carries a third condition now: **the finale's
third phase does not summon at all**, because adds during a bullet-hell phase
is how you make a fight unreadable rather than hard.

## Elite summons: capped by recycling, not by refusing

[[Bosses#Elites|Elites]] summon on their own timer. That path used to have
**neither of the two guards** the boss path has — no `S.en.length` gate, no
clamp:

```js
const adds = 1 + Math.floor(S.room * 0.7);   // floor 26 → 18
for (let i = 0; i < adds; i++) S.cracks.push(...);   // every 2.2–3.2s
```

Measured on the same soak, at the same depths, on the elite waves:

| floor / wave | queued | cap | live at once | ms/frame |
|---|---|---|---|---|
| 1 / 8 | 18 | 28 | 26 | 0.81 |
| 8 / 8 | 39 | 95 | 79 | 1.37 |
| 15 / 8 | 60 | 95 | **141** | 2.13 |
| 26 / 8 | 93 | 95 | **237** | 3.31 |

The count does not plateau. Sampled every 3 seconds on floor 26 with the
queue already empty, it climbs **linearly and without bound** — 93, 129, 147,
165, 183, 201, 219, 237, 255 — and reaches **291 at 30 seconds**, for as long
as the elite is alive. Since the [[Enemies#Shared behaviour|separation pass]]
is O(n²), this is the same failure mode as
[[Bugs Found#13. Deep floors overshot the enemy cap]], reintroduced through a
different door.

Note that the [[Enemies#The two late arrivals|CYST]] — added in the same pass
that these measurements were re-run against — *does* gate its own hatching on
`S.en.length < 70`. The elite branch is the outlier, not the convention.

### Why it does not use the gate `updateBoss()` uses

The intent — "so you cannot simply back away from one" — is the thing a plain
ceiling destroys. A `liveLoad() < cap` gate satisfies the cap and makes the
elite **go quiet exactly when the room is fullest**, which is exactly when
walking away is easiest. The cap and the intent pull against each other, so
the choice was measured rather than argued.

A 45-second kiting run on floor 8 wave 4 — Damjan retreating continuously,
never firing, nothing dying:

| | live max | summons/min | **reached you /min** | threat ring | ms |
|---|---|---|---|---|---|
| uncapped *(the defect)* | **164** | 106.7 | 81.3 | 66.5 | 9.90 |
| plain gate | 95 | **14.7** | **14.7** | 52.3 | 8.03 |
| **recycle** *(shipped)* | **95** | 69.3 | **33.3** | 56.6 | 8.16 |

The gate cuts the elite's voice by **86%**. Recycling holds the identical
ceiling and still delivers **2.3× the gate's renewal**, for +1.6% frame time,
because the population is *conserved* rather than *frozen*: the room stays the
same size and what is in it keeps being reissued in front of you.

```js
for (let i = 0; i < adds; i++) {
  if (liveLoad() >= cap && !retireOldestAdd()) break;
  S.cracks.push({ ...freeSpot(90), t: 0.75, type: pick([...]), sum: 1, born: S.t });
}
```

### What may be recycled, and the rule that constrains all of it

`retireOldestAdd()` takes the longest-standing body that is **further than
`RETIRE_R = 300`** from Damjan, preferring earlier reinforcements and then
falling back to any enemy still at **full health** — untouched means no bullets
spent and no progress lost. A damaged enemy is work in progress and is never
taken. Elites and bosses are never eligible at any distance.

> [!warning] RETIRE_R is a visual constraint, not a tuning knob
> The camera shows 480×270 game units, half-diagonal ≈ 275. A measured pass at
> **210** retired an enemy **ten pixels from Damjan** — 25% of retirements used
> a near fallback. A body vanishing in frame does not read as a mechanic, it
> reads as a bug. There is no fallback now: if nothing is safely off-screen the
> summon is simply skipped, which measured at a 16% skip rate and still left
> renewal at 2.3× the gate.

### Measured, before and after

`MEAT.soak({ floor: 7, wave: 4, seconds: 30, seed: 4242, mode: 'fill' })`

| at | before — live / over cap | after — live / over cap |
|---|---|---|
| 3s | 89 / −6 | 89 / −6 |
| 10s | 99 / **+4** | 95 / **0** |
| 20s | 119 / **+24** | 95 / **0** |
| 30s | 134 / **+39** | 95 / **0** |

> [!note] Ten floors caps how bad this can get
> The measurements above go to floor 26 because they were taken when the
> descent had no bottom. `1 + floor*0.7` on the deepest floor that now exists
> is **7** adds a cycle, not 18, and the floor-8 row (79 live) is the closest
> real analogue. The defect is unchanged and still worth fixing — it is just no
> longer capable of the numbers in the table.

## Related
- [[Bugs Found]] — the budget-vs-headcount bug this formula set replaced
- [[Tuning Values]] — the single numbers most likely to need adjusting later
- [[Augments]] — LOUDMOUTH, the one player-chosen difficulty axis
