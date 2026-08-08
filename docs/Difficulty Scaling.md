---
title: Difficulty Scaling
tags: [reference, systems, formulas]
---

# Difficulty Scaling

Every input that makes the game harder, and the exact formula each one drives.
Five independent axes stack multiplicatively.

## The axes

| axis | grows from | feeds |
|---|---|---|
| **floor** (`S.room`) | descending, unbounded | HP, damage, speed, score, spawn count, spawn cap, boss add-cap, arena size |
| **wave** (`S.wave`) | 1→10 per floor | spawn count (quadratic), enemy type mix |
| **evolution** (`S.evo`) | [[Economy#Evolution]] | HP, damage, speed, score, spawn count, boss add-cap |
| **weapons owned** | buying guns | spawn count (+10%/gun), spawn cap |
| **player level** | [[Progression#XP & levels]] | spawn count (+6%/level), spawn cap |

## `diff()` — enemy stat multipliers

```js
hp    = (1 + floor*0.95) * (1 + evo*0.38)
dmg   = (1 + floor*0.62) * (1 + evo*0.26) * 0.95   // flat 5% balance cut
spd   = (1 + floor*0.08) * (1 + evo*0.05)
score = (1 + floor*0.70) * (1 + evo*0.50)
```

Applied per-spawn in `spawnEnemy()`/`spawnBoss()`, on top of each type's base
stats in [[Enemies]]/[[Bosses]]. **None of these terms is capped** — floor 8
enemies carry ~7.6× HP and ~5.1× damage, and it keeps going from there. This
is the mechanism behind [[Progression#Endless floors]].

## Wave spawn count

```js
armed    = 1 + max(0, gunsOwned - 1) * 0.10
levelled = 1 + max(0, playerLevel - 1) * 0.06
count = round((7 + wave*2.8 + wave²*0.26) * (1 + floor*0.55)
             * (1 + evo*0.12) * armed * levelled)
```

Measured examples (see [[Bugs Found]] for the original bug this replaced):

| floor | wave 1 | wave 8 |
|---|---|---|
| 1 | 7 | 37–46 (armed/levelled dependent) |
| 4 | 19 | 92–195 (fully armed + levelled) |

## Concurrent cap

```js
cap = min(78, round(19 + wave*1.4 + floor*7.5 + evo*2
                    + max(0, gunsOwned-1)*1.5 + max(0, level-1)*0.8))

// gate: S.en.length + S.cracks.length < cap
```

This is the ceiling on simultaneously-alive enemies — the queue can be much
larger than this; the cap just throttles how many exist at once.

The gate counts **cracks as well as live enemies**. Cracks take 0.75s to
hatch but spawn batches fire every 0.15s, so counting only what was already
breathing let deep floors put five batches in the air before the cap noticed
— floor 14 was landing 159 against a cap of 78. See
[[Bugs Found#13. Deep floors overshot the enemy cap]].

Measured after the fix:

| floor / wave | queued for the wave | live at once | ms/frame |
|---|---|---|---|
| 1 / 1 | 10 | 10 | 0.29 |
| 1 / 8 | 46 | 31 | 0.48 |
| 4 / 8 | 122 | 57 | 1.56 |
| 8 / 8 | 223 | 83 | 1.78 |
| 15 / 8 | 401 | 87 | 2.02 |
| 26 / 8 | 679 | 84 | 2.23 |

That's the intended shape for an endless game: the **total** you have to kill
climbs without limit, while concurrency stays bounded so the frame budget
doesn't.

## Boss summon ceiling

```js
addCap = min(30, 14 + floor*4 + evo*2)
```

Each boss also has its own summon interval and roster — see
[[Bosses#Summoning]].

## Related
- [[Bugs Found]] — the budget-vs-headcount bug this formula set replaced
- [[Tuning Values]] — the single numbers most likely to need adjusting later
