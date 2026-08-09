---
title: Tuning Values
tags: [reference, engineering]
---

# Tuning Values

Single-number knobs most likely to need adjusting later, and where they live.
All in `js/game.js` unless noted.

## Difficulty

| what | value | where | effect if raised |
|---|---|---|---|
| wave count exponent | `n² * 0.26` | `startWave()` | later waves balloon faster |
| floor spawn multiplier | `1 + floor*0.72` | `startWave()` | deeper floors get proportionally more enemies |
| concurrent cap | `min(95, ...)` | `updateWaves()` | the hard ceiling on simultaneous enemies — the [[Enemies#Shared behaviour\|separation]] pass is O(n²), so this is the first thing to reconsider if performance dips. The gate counts cracks too; do not remove that, see [[Bugs Found#13. Deep floors overshot the enemy cap]] |
| enemy HP multiplier | `1 + floor*1.25` | `diff()` | how spongy enemies get per floor |
| enemy damage multiplier | `1 + floor*0.72` | `diff()` | how hard they hit |
| contact cooldown | `CONTACT_CD = 0.74` | top of file | how often contact damage can land |
| boss add cap | `min(30, 14 + floor*4 + evo*2)` | `updateBoss()` | ceiling on boss-summoned enemies alive at once |
| elite summon count | `1 + floor*0.7` | `updateEnemy()` | **ungated** — see [[Bugs Found#A. Elite summons bypass the enemy cap]] |
| cyst hatch gate | `S.en.length < 70` | `updateEnemy()` | the only self-imposed spawn ceiling outside `updateBoss()` |
| deep arena cap | `min(1560, ...)` / `min(1080, ...)` | `roomDef()` | how big generated floors are allowed to get |
| deep darkness cap | `min(0.88, 0.82 + d*0.008)` | `roomDef()` | how black the bottom of the descent goes |

## The deck

| what | value | where | effect if raised |
|---|---|---|---|
| rider threshold | `RIDER_AT = 2` | deck section | which rarity lights a [[The Deck#Riders — the reason rarity is a moment\|rider]]. The single most load-bearing number in the deck |
| rarity weights | `w: 100 / 30 / 8 / 1.6 / 0` | `GRADE` | how often RARE turns up, and so how often riders happen at all |
| rarity multipliers | `1.00 / 1.35 / 1.75 / 2.25 / 3.00` | `GRADE` | what a high roll is worth numerically, on top of its rider |
| luck slope | `1 + luck * 0.55 * i` | `rollGrade()` | how hard one point of LUCK tilts the ladder |
| aisle thresholds | `AISLE_T1 = 4`, `AISLE_T2 = 8` | deck section | how far you must commit to an [[The Deck#The five aisles\|aisle]] before it pays |
| hand size | `3 + apex + hollow` | `handSize()` | reaches 5; card width scales to fit, do not hardcode it again |
| reroll cost | `20 + rerolls * 15` | `rerollCost()` | how repeatable a reroll is within a run |
| XP curve | `xpNext = 80`, `*= 1.30` | `freshState` / `gainXP()` | how fast levels slow down. Went 65/1.32 -> 48/1.23 -> 80/1.30 — see [[Progression#XP & levels]] |
| XP per kill | `max(2, score * 0.42)` | `killEnemy()` | the other half of the same knob. Was 0.55 |
| card pool weight | `c.w`, default 1 | `dealCards()` | how often a card is *offered*. Only [[The Deck#SPLIT|SPLIT]] sets it (0.30) |
| forced rarity | `c.leg` | `dealCards()` | a card that is always LEGENDARY and never rolls. Only SPLIT |
| card depth gate | `c.floor` | `cardUnlocked()` | earliest floor a card can be dealt. Only SPLIT (2) |

## Economy & structure

| what | value | where | effect if raised |
|---|---|---|---|
| shop cadence | `SHOP_WAVES = [5, 10]` | top of file | which wave-clears open [[The Shop\|PACI]]. Twice a floor. Was `SHOP_EVERY = 3` counted against boss kills |
| gun depth gate | `WEP[id].floor` | `WEP` / `shopStock()` | how deep before PACI carries a gun at all — see [[Weapons#When PACI starts carrying it]] |
| boss phase break | `hp <= max * 0.5` | `updateBoss()` | where a floor boss switches to `pat2` — see [[Bosses#Two phases]] |
| phase-2 buff | ×1.28 speed, ×1.18 damage, ×0.7 summon timer | `enterPhase2()` | how much angrier the second half is |

| evolution cost | `100 * 2^evo` | `EVO_COST` | how fast [[Economy#Evolution]] gates |
| coin rate | `COIN_RATE = 0.70` | top of file | a flat 30% cut on every coin from every source, applied once inside `coinMul` |
| beam price | `OMEGA_COINS = 500` | top of file | the long game, in coins now |
| elite share | `ELITE_SHARE = 0.22` | top of file | what fraction of the floor boss an elite is worth before [[#the build multiplier|powerMul]] |
| build multiplier | `powerMul()`, capped 3.2 | above `spawnMini` | how hard elites track your build rather than just the floor |
| signature cap | `SIG_MAX = 2` | cold room section | how many times a [[Groceries\|grocery]] can be taken |
| apex cadence | `APEX_EVERY = 5` | top of file | how often the floor boss comes up wrong |
| sidearm mark bonus | `0.20` in `scarMul` | `ST()` | damage per [[Progression#The evolving sidearm\|floor mark]] |
| music intensity curve | `0.12 + (wave/10)*0.72 + floor*0.16` | `startWave()` | how fast [[Music]] builds within a floor |
| frame delta clamp | `[0, 0.05]` | `frame()` | see [[Bugs Found#4. Negative frame delta crashed the render loop]] — do not remove |

## Measured baselines

From the last full soak — 24s per row, god mode on so nothing dies, level 1,
no evolution, one weapon. Re-measure against this table after any change to
spawn maths.

### Ordinary waves

| floor / wave | queued | cap | live at once | ms/frame |
|---|---|---|---|---|
| 1 / 1 | 10 | 19 | 10 | 0.52 |
| 1 / 7 | 38 | 27 | 38 | 1.18 |
| 4 / 7 | 120 | 56 | 72 | 1.62 |
| 8 / 7 | 229 | 94 | 102 | 2.46 |
| 15 / 7 | 420 | 95 | 100 | 2.69 |
| 26 / 7 | 721 | 95 | 109 | 2.04 |

The **queued** column should keep climbing without limit — that's the endless
design. The **live** column should stay near the cap and the frame time flat.
If live starts tracking queued again, the crack-counting gate has regressed.

### Elite waves

| floor / wave | queued | cap | live at once | ms/frame |
|---|---|---|---|---|
| 1 / 8 | 18 | 28 | 26 | 0.81 |
| 8 / 8 | 39 | 95 | 79 | 1.37 |
| 15 / 8 | 60 | 95 | 141 | 2.13 |
| 26 / 8 | 93 | 95 | 237 | 3.31 |

These are **not** a baseline to preserve — they are the defect in
[[Bugs Found#A. Elite summons bypass the enemy cap]]. If a fix lands, the live
column should come down to the ordinary-wave shape.

## Related
- [[Difficulty Scaling]] — the full formulas these values plug into
- [[The Deck]] — what the rarity and aisle numbers actually do
- [[Bugs Found]] — why some of these values are what they are
