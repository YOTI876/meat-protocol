---
title: Pickups
tags: [reference, systems]
---

# Pickups

Everything that drops from a regular (non-boss) kill. Drop is a single roll
against cumulative thresholds (`killEnemy()` in `js/game.js`):

| roll range | drop | rarity |
|---|---|---|
| 0.000–0.008 | [[Economy#Cards\|card]] | 0.8% — genuinely rare |
| 0.008–0.021 | **NOVA** | 1.3% — the rarer of the two combat pickups |
| 0.021–0.061 | **AEGIS (shield)** | 4.0% |
| 0.061–0.221 | [[Economy#Coins\|coin]] | 16.0% |
| 0.221–0.281 | ammo (refills current mag) | 6.0% |
| 0.281–0.341 | med kit (+32 HP) | 6.0% |
| 0.341–0.381 | frag grenade (+1, cap 6) | 4.0% |
| else | nothing | 62% |

Boss kills separately guarantee 5 coins, 1 grenade, and a 5% card chance —
see [[Bosses#On death]].

## AEGIS

3 seconds of total damage immunity (`p.tempShield`), rendered as a pulsing
cyan bubble. Stacks by refreshing duration, not adding it. Blocks contact
damage, projectiles, and boss charges alike — checked before the permanent
[[Groceries#MELON → MELON ARMOR|MELON]] shield in `hurtPlayer()`.

## NOVA

Fires **26 rounds in a full circle** on pickup, each one:
- high damage (90 base, scaled by your damage stat)
- pierces 2 extra enemies
- **homes**: steers at 5.5 rad/s toward the nearest un-hit enemy within 260px
- lives 2.6 seconds — long enough to actually curve onto a target across the
  arena

## Wave-end collection

When a wave clears, `S.vacuum` is set to 2.6s. While it's active, every loose
(non-permanent) drop on the floor accelerates toward the player — faster the
farther away it is — instead of waiting to be walked over. A `COLLECTING`
readout shows on the HUD. Permanent drops ([[Groceries|grocery items]], the
[[Secrets#1. The Eye (god mode)|Eye]]) are excluded; they're never swept up
automatically.

## Related
- [[Economy]] — coins, cards, what they're spent on
- [[Groceries]] — the five permanent boss items (a separate drop path)
- [[Rendering#Minimap]] — how loose pickups are colour-coded on the map
