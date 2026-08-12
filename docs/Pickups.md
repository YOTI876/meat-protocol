---
title: Pickups
tags: [reference, systems]
---

# Pickups

Everything that drops from a regular (non-boss) kill. One roll against
cumulative thresholds in `killEnemy()`, **divided by your loot multiplier**
so CLEARANCE widens every band at once:

```js
const r = Math.random() / ST().lootMul;
```

| roll | drop | rarity at ×1 |
|---|---|---|
| < 0.008 | [[Economy#Cards\|card]] | 0.8% — genuinely rare |
| < 0.021 | **NOVA** | 1.3% |
| < 0.056 | **AEGIS (shield)** | 3.5% |
| < 0.246 | [[Economy#Coins\|coin]] | **19.0%** |
| < 0.306 | ammo (refills current mag) | 6.0% |
| < 0.338 | med kit (**+26 HP**) | 3.2% |
| < 0.368 | frag grenade (+1, cap 9) | 3.0% |
| else | nothing | 63.2% |

> [!note] This is the drop table, not your income
> Coins went 16% → 19% when [[The Shop|PACI]] moved to twice a floor. Every
> coin then goes through `COIN_RATE = 0.70` on the way into your pocket, so
> 19% of kills drop one and you bank **0.12 a kill**. See [[Economy#Coins]].

> [!note] Health is a resource now
> Med kits used to be a 6% drop *on top of* two guaranteed drops every wave,
> which meant health was never actually something you could run out of. The
> rate is halved and the guaranteed wave-end drop is now a single one that's
> ammo 78% of the time.

[[Bosses#On death|Bosses and elites]] drop on a separate path: a fixed pile of
coins, a frag, an AEGIS, a card roll, and a guaranteed pick.

## AEGIS

3 seconds of total damage immunity (`p.tempShield`), rendered as a pulsing
cyan bubble. Stacks by refreshing duration, not adding it. Blocks contact
damage, projectiles and boss charges alike — checked before the rind shield
(now a FROZEN [[The Deck#The five aisles|aisle]] reward rather than a
[[Groceries|grocery]]) and before the AEGIS PLATING card's dodge roll in
`hurtPlayer()`.

## NOVA

Fires **26 rounds in a full circle** on pickup, each one:
- 90 base damage, scaled by your damage stat
- pierces 2 extra enemies (plus your own pierce)
- **homes**: steers at 5.5 rad/s toward the nearest un-hit enemy
- lives 2.6 seconds — long enough to curve onto a target across the arena

`fireNova()` is shared with the **FLASHPOINT** [[The Deck|card]], which fires
one automatically every 22 (or 12) kills.

> [!warning] Kill-triggered effects go on a queue
> OVERKILL and FLASHPOINT are both *triggered by* a kill and both *cause*
> kills. Fired inline they recurse — one death used to clear a room of 140 and
> put 600 bullets on screen in a single frame. They push onto `S.fx`, which
> drains a few at a time once a frame, so a chain stays a chain instead of
> becoming a stack.

## Wave-end collection

When a wave clears, `S.vacuum` is set to 2.6s. While it's active, every loose
(non-permanent) drop accelerates toward the player — faster the farther away
it is — instead of waiting to be walked over. A `COLLECTING` readout shows on
the HUD.

Outside the vacuum, loose drops drift toward you within `40 * ST().magnet`
px. [[Augments|COLD BLOOD]] shrinks that radius, which is its real cost.

Permanent drops (the [[Secrets#1. The Eye (god mode)|Eye]]) are excluded from
both; they're never swept up automatically. See
[[The Shop]] for why that matters at a room swap.

## Related
- [[Economy]] — coins, cards, what they're spent on
- [[The Deck]] — CLEARANCE, FLASHPOINT, OVERKILL, GRAZING
- [[Rendering#Minimap]] — how loose pickups are colour-coded on the map
