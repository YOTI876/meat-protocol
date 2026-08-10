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
| **floor** (`S.room`) | descending, unbounded | HP, damage, speed, score, spawn count, spawn cap, boss add-cap, elite adds, arena size |
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
stats in [[Enemies]]/[[Bosses]]. **None of these terms is capped** — floor 8
enemies carry ~10× HP and ~6× damage, and it keeps going from there. This is
the mechanism behind [[Progression#Endless floors]].

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
cap = min(95, round(18 + wave*1.3 + floor*9.5 + evo*2
                    + max(0, gunsOwned-1)*1.5 + max(0, level-1)*0.8))

// gate: S.en.length + S.cracks.length < cap
```

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

That's the intended shape for an endless game: the **total** you have to kill
climbs without limit, while concurrency stays bounded so the frame budget
doesn't.

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
[[Bosses#Summoning]].

## Elite summons are not capped

[[Bosses#Elites|Elites]] summon on their own timer in `updateEnemy()`, and
that path has **neither of the two guards** the boss path has — no
`S.en.length` gate, no clamp:

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

> [!warning] Known defect, not a design choice
> The comment above the code says elites summon "so you cannot simply back
> away from one," which is a reasonable intent. The missing part is the
> ceiling — `updateBoss()` has one and `updateEnemy()`'s elite branch does
> not. A deep elite fight is bounded only by how fast you kill it.

## Related
- [[Bugs Found]] — the budget-vs-headcount bug this formula set replaced
- [[Tuning Values]] — the single numbers most likely to need adjusting later
- [[Augments]] — LOUDMOUTH, the one player-chosen difficulty axis
