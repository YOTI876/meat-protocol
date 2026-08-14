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
| floor count | `FLOORS = ROOMS.length` | top of file | how long a run is. **10.** Adding an eleventh means adding a `BOSS_HP` rung with it |
| twist strengths | `0.68` sight, `0.30` grip, `0.55` frost, `1.25` frail, `1.5`/`0.7` swarm | `updateTwist()` and inline | how loud each [[Floors#Twists\|floor rule]] is |

## The deck

| what | value | where | effect if raised |
|---|---|---|---|
| rider threshold | `RIDER_AT = 2` | deck section | which rarity lights a [[The Deck#Riders — the reason rarity is a moment\|rider]]. The single most load-bearing number in the deck |
| rarity weights | `w: 100 / 30 / 8 / 1.6 / 0` | `GRADE` | how often RARE turns up, and so how often riders happen at all |
| rarity multipliers | `1.00 / 1.35 / 1.75 / 2.25 / 3.00` | `GRADE` | what a high roll is worth numerically, on top of its rider |
| luck slope | `1 + luck * 0.55 * i` | `rollGrade()` | how hard one point of LUCK tilts the ladder |
| aisle thresholds | `AISLE_RUNGS = [4, 8, 12]` | deck section | how far you must commit to an [[The Deck#The five aisles\|aisle]] before it pays. **Keep the spacing even** — a rung every 4 is a rule a player can hold; 4/8/14 was unlearnable and the UI could not draw a bar toward it. Anything that shows progress walks this array |
| hand size | `3 + (apex ‖ menu) + hollow` | `handSize()` | reaches 5; card width scales to fit, do not hardcode it again |
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
| chain length / reach | `chain: 5`, `chainR: 132` | `WEP.zap` / `chainZap()` | how far [[Weapons#THE FLYKILLER\|THE FLYKILLER]] snakes. Each hop keeps 80% of the last |
| singularity pull / reach | `sing: { r: 96, pull: 340 }` | `WEP.void` | how hard [[Weapons#BLACK FRIDAY\|BLACK FRIDAY]] gathers. Bosses get 22% of it |
| singularity drag | `Math.pow(0.22, dt)` | bullet loop | how far the round coasts before it stalls and goes off. Lower = it lands nearer you |
| floor intro delay | `S.introT` — 2.2s / 2.6s | `startRun()` / `nextRoom()` | the beat before wave 1. **Game** time, on purpose — see [[Bugs Found#14. A menu inside the first 2.2 seconds killed the floor permanently]] |
| boss phase break | `hp <= max * (1 - ph/phases)` | `updateBoss()` | equal bands — halves for the roster, thirds for the finale. See [[Bosses#Phases]] |
| phase buff | ×1.24 speed, ×1.16 damage, summon timer pulled to 1.2s | `enterPhase()` | how much angrier each break makes it |
| floor boss health | `BOSS_HP[]` — 1350 → 2850 | top of file | the nine rungs. **Indexed by floor, not by boss** — see [[Bosses#The roster is shuffled, and that took a rewrite]] |
| finale health | `FINAL_HP = 4200` | top of file | how long [[Bosses#THE MEAT PROTOCOL\|the last fight]] takes across three phases |
| boss bulk | `bulk: 0.92 – 1.12` | `BOSSES` | the only thing boss identity still contributes to health. Keep it narrow or the shuffle starts mattering again |

| evolution cost | `150 + 175*evo + 25*evo²` | `EVO_COST` | how fast [[Economy#Evolution]] gates. Was `100 * 2^evo`, which wanted 51,200 at the top rung |
| evolution ceiling | `EVO_MAX = 10` | top of file | how many rungs exist at all |
| rarity per rung | `EVO_TIER` | top of file | which weapon rarity each rung opens — see [[Economy#What a rung pays out]] |
| evolution difficulty | `×0.46 / 0.30 / 0.06` HP/dmg/spd | `diff()` | how much harder a rung makes the world. Was `0.38 / 0.26 / 0.05` |
| coin rate | `COIN_RATE = 0.70` | top of file | a flat 30% cut on every coin from every source, applied once inside `coinMul` |
| beam price | `OMEGA_COINS = 500` | top of file | the long game, in coins now |
| elite share | `ELITE_SHARE = 0.22` | top of file | what fraction of the floor boss an elite is worth before [[#the build multiplier|powerMul]] |
| build multiplier | `powerMul()`, capped 3.2 | above `spawnMini` | how hard elites track your build rather than just the floor |
| shop rarity weights | `SHOP_W = [100, 52, 24, 9, 2.5]` | `shopStock()` | how textured the crate is. A LEGENDARY pedestal is ~1 seat in 70 |
| apex cadence | `APEX_EVERY = 5` | top of file | how often the floor boss comes up wrong. With ten floors and the last one taken, this means **exactly one APEX a run** |
| house knockback | `38` | `fire()` | the default shove for any gun with no `knock` of its own. Was 60; the shotgun's own went 140 → 45 |
| particle ceilings | 900 part / 420 gib / 80 ring | `updateParticles()` | oldest-first splice. The frame budget's real backstop — see [[Rendering#Effects]] |
| deferred effect drain | 3 a frame, cap 12 | `S.fx` | how fast kill-triggered effects resolve. This is what stops an OVERKILL chain recursing |
| tile variants | `TILE_VARIANTS = 12` | above `bakeTileAtlas` | how much floor there is before the eye finds the repeat. Raising it costs bake time **linearly**, unlike the old per-pixel loop — see [[Rendering#The floor]] |
| floor surface | `FLOOR_TEX[]` | top of the floor section | which of the ten [[Floors#Surfaces\|surfaces]] a floor is made of |
| spill blobs | 6, at 7% of tiles | `bakeSpills` / `bakeFloor` | how used the floor looks. Pre-rendered, so the rate is nearly free now |
| never-reload guns | `noReload: 1` | `WEP` | the magazine stops being a resource. Only GOD FINGER — see [[Weapons#GOD FINGER does not reload]] |
| starting magazine | `WEP.pistol.mag` | `makePlayer()` | **read off the gun, never a literal** — see [[Bugs Found#19. The pistol opened every run on 14 rounds in a 12-round magazine]] |
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

The **live** column should stay near the cap and the frame time flat while
**queued** climbs. If live starts tracking queued again, the crack-counting
gate has regressed.

The floor-15 and floor-26 rows predate the [[Floors|ten-floor]] rewrite and
those depths no longer exist. They are kept as the proof that the shape holds
well past anything the game now asks for — floor 10 wave 7 sits inside the
floor-8 row.

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
