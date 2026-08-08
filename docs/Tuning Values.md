---
title: Tuning Values
tags: [reference, engineering]
---

# Tuning Values

Single-number knobs most likely to need adjusting later, and where they live.
All in `js/game.js` unless noted.

| what | value | where | effect if raised |
|---|---|---|---|
| wave count exponent | `n² * 0.26` in `startWave()` | spawn count | later waves balloon faster |
| floor spawn multiplier | `1 + floor*0.55` | `startWave()` | deeper floors get proportionally more enemies |
| concurrent cap | `min(78, ...)` | `updateWaves()` | raises the hard ceiling on simultaneous enemies — the enemy [[Enemies#Shared behaviour|separation]] pass is O(n²), so this is the first thing to reconsider if performance dips. The gate counts cracks too; do not remove that, see [[Bugs Found#13. Deep floors overshot the enemy cap]] |
| shop cadence | `SHOP_EVERY = 3` | top of file | bosses between [[The Shop\|PACI]] visits — lower means more guns, sooner |
| SPLIT price | `SPLIT_COST = 100` | top of file | the one flat armory purchase; deliberately not tier-scaled |
| deep arena cap | `min(1560, ...)` / `min(1080, ...)` | `roomDef()` | how big generated floors are allowed to get |
| deep darkness cap | `min(0.88, 0.82 + d*0.008)` | `roomDef()` | how black the bottom of the descent goes |
| capped-boss payout | `12` coins, `0.45` card | `killEnemy()` | what a boss gives once its grocery is maxed — the main deep-floor coin faucet |
| enemy HP multiplier | `1 + floor*0.95` | `diff()` | how spongy enemies get per floor |
| enemy damage multiplier | `(1 + floor*0.62) * 0.95` | `diff()` | how hard they hit; the trailing `*0.95` is the flat balance cut |
| contact cooldown | `CONTACT_CD = 0.78` | top of file | how often contact damage can land |
| evolution cost | `100 * 2^evo` | `EVO_COST` | how fast [[Economy#Evolution]] gates |
| boss add cap | `min(30, 14 + floor*4 + evo*2)` | `updateBoss()` | ceiling on boss-summoned enemies alive at once |
| XP curve | `xpNext *= 1.32` | `gainXP()` | how fast levels slow down |
| rifle mark bonus | `0.20` in `scarMul` | `ST()` | damage per [[Progression#The evolving rifle\|floor mark]] |
| weapon upgrade cost tier | `1 + price/190` | `wupCost()` | how much pricier guns cost more to upgrade (CYCLE/POWER only — SPLIT ignores it) |
| music intensity curve | `0.12 + (wave/10)*0.72 + floor*0.16` | `startWave()` | how fast [[Music]] builds within a floor |
| frame delta clamp | `[0, 0.05]` | `frame()` | see [[Bugs Found#4. Negative frame delta crashed the render loop]] — do not remove |

## Measured baselines (for comparison after any change)

From the last full soak (level 1, no evolution, one weapon, god mode on to
survive the depth):

| floor / wave | queued | live at once | ms/frame |
|---|---|---|---|
| 1 / 1 | 10 | 10 | 0.29 |
| 1 / 8 | 46 | 31 | 0.48 |
| 4 / 8 | 122 | 57 | 1.56 |
| 8 / 8 | 223 | 83 | 1.78 |
| 15 / 8 | 401 | 87 | 2.02 |
| 26 / 8 | 679 | 84 | 2.23 |

The **queued** column should keep climbing without limit — that's the endless
design. The **live** column should stay pinned near the cap and the frame time
flat. If live starts tracking queued again, the crack-counting gate has
regressed. If a specific wave starts to feel like it drags, this is the table
to re-measure against.

## Related
- [[Difficulty Scaling]] — the full formulas these values plug into
- [[Bugs Found]] — why some of these values are what they are
