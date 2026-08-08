---
title: Groceries (Boss Items)
tags: [reference, systems]
---

# Groceries

Five passive items, one per [[Bosses|boss]], stacking to level 2 if you meet
the same boss again on a deeper floor. Defined in `ITEMS`.

## BANANA → BANANA SPLIT
Dropped by **THE BUTCHER**.
- Lv1: +22% speed, drop banana peels as you move (stun enemies who touch them)
- Lv2: +44% speed, peels **detonate** on contact (`peelBoom`)

## MELON → MELON ARMOR
Dropped by **MOTHER OF MELONS**.
- Lv1: +38 max HP, a 2-charge regenerating rind shield (14s recharge)
- Lv2: +76 max HP, 4-charge shield, faster recharge (8s)

## COOLADE → PURPLE COOLADE
Dropped by **THE PITCHER**. (Originally "MILK" — renamed.)
- Lv1: ×1.38 damage, bullets pierce 1 extra enemy
- Lv2: ×1.85 damage, pierce 2 extra

## GLOCK-18 → AKIMBO GLOCK-18s
Dropped by **THE HOGFATHER**. (Originally "BACON" — replaced.)
- Lv1: a second gun auto-aims and fires at the nearest enemy within 210px
  (13 dmg, rate 0.20s)
- Lv2: **two** auto-firing guns, alternating sides, faster rate (0.11s)

## STOLEN BICYCLE → STOLEN MOTORCYCLE
Dropped by **THE COURIER**.
- Lv1: +16% speed, dash becomes a **ram** (40 dmg, knockback, 0.4s stun)
- Lv2: +30% speed, ram hits for 95, leaves a burning particle trail

> [!note] Balance history
> Every item's numbers were cut once the [[Progression|XP upgrade tree]] was
> added, since stacking both systems at full strength trivialized floor 2.
> See the "Grocery bonuses" comment above `ST()` in `js/game.js`.

## Related
- [[Bosses]] — who drops what, and their fight patterns
- [[Progression]] — the other source of permanent power
- [[Pickups]] — the smaller, non-permanent drops
