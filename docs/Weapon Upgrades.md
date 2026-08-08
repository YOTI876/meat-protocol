---
title: Weapon Upgrades (Armory)
tags: [reference, systems]
---

# Weapon Upgrades — the Armory

Opened from pause (**ARMORY** button) or the **B** key mid-run. Every
[[Weapons|weapon you own]] *except the beam* gets three independent,
coin-bought tracks (`WTRACKS` in `js/game.js`):

| track | ranks | effect |
|---|---|---|
| **CYCLE** | ×5 | +10% fire rate per rank |
| **SPLIT** | ×1 | 3-way fan — one flat purchase |
| **POWER** | ×5 | +15% damage per rank |

## Cost formula

```
SPLIT           → 100 coins, flat, on every weapon
CYCLE / POWER   → tier = 1 + weapon.price / 190
                  cost(rank) = round((20 + rank * 24) * tier)
```

CYCLE and POWER still cost more on better guns — improving GOD FINGER
(price 175 → tier ≈ 1.92) costs roughly double what improving SCAR-L
(price 0 → tier 1) does for the same rank.

**SPLIT deliberately ignores all of that.** It's a single rank at a single
price on every weapon in the game, so the 3-way fan is a flat decision rather
than a scaling investment: 100 coins, once, per gun.

## The beam takes no upgrades

**OMEGA BEAM cannot be improved.** It still appears in the armory list so you
can see you own it, but its row shows `CANNOT BE IMPROVED` in place of the
three track boxes and registers no clickable regions at all. It's already the
ceiling — see [[Weapons]].

`wupgradable(id)` is the single predicate behind this (`!WEP[id].beam`).

## Where this money comes from

Same wallet as everything else — see [[Economy#Coins]]. Upgrades are bought
with **run coins** and reset with the run; they are not part of the permanent
[[Economy#The vault|vault]].

## Related
- [[Weapons]] — base stats before any upgrade
- [[Progression]] — the *other* upgrade tree (XP-based, not coin-based)
