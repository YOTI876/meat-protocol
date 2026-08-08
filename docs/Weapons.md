---
title: Weapons
tags: [reference, systems]
---

# Weapons

Seven guns total. `SCAR-L` is the only one you start with; the other five
buyable ones cost coins and `OMEGA BEAM` costs [[Economy#Cards|cards]]
instead. All six are bought from [[The Shop|PACI]] — **guns are no longer
scattered on the arena floor**.

| gun | cost | mag | dmg | notes |
|---|---|---|---|---|
| **SCAR-L** | free | 30 | 13 | evolves every floor — see [[Progression#The evolving rifle]] |
| **MEAT SPLITTER** | 15 coins | 2 | 12 ×9 pellets | huge knockback, shotgun spread |
| **THE STAPLER** | 35 coins | 60 | 8 | nailgun — pins enemies in place (0.45s stun) |
| **MICROWAVE** | 60 coins | 16 | 34 | plasma orbs, ricochet ×3, ignites (burn 16) |
| **THE HOG** | 100 coins | 120 | 10 | minigun — spins up over 0.75s, slows you 45% while spinning |
| **GOD FINGER** | 175 coins | 5 | 165 | railgun — charges 0.5s, pierces everything, huge knockback |
| **OMEGA BEAM** | 50 [[Economy#Cards\|cards]] | 300 (drains as ammo) | 720/s | continuous beam, girth 11px |

Full definitions live in `WEP` in `js/game.js`.

## Handling notes

- **Reload** is a 4-stage animation (mag drop → new mag slides in → rack) at
  each gun's own `reload` duration — see [[Rendering#Reload animation]].
- **THE HOG** ramps `p.spin` from 0→1 over 0.75s; fire rate and movement
  penalty both scale with it.
- **GOD FINGER** accumulates `p.charge`; firing early does nothing, it only
  releases at full charge.
- **OMEGA BEAM** doesn't fire discrete bullets — `updateBeam()` runs a
  continuous raycast each frame and drains the "mag" as fuel per second.
- Every gun's fire rate, damage and behaviour can be modified further by
  [[Weapon Upgrades]], bought per-weapon in the Armory — **except the beam,
  which takes no upgrades at all**.

## Where you buy them

Every third boss opens [[The Shop|PACI's back room]], which stocks **three at
random** from whatever you don't already own — the five in `BUYABLE`
(`saw, nail, micro, hog, rail`) plus `omega` if you're still missing it. See
`shopStock()`.

Nothing is guaranteed and nothing is ordered by tier any more: it's a
genuinely random three out of what's left, so a lucky early shop can hand you
GOD FINGER before THE STAPLER.

## Related
- [[Weapon Upgrades]] — CYCLE / SPLIT / POWER, bought per weapon
- [[Progression#The evolving rifle]] — why SCAR-L is special
- [[Groceries]] — passive items, separate system from guns
