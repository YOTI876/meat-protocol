---
title: Groceries (removed)
tags: [reference, history, removed]
---

# Groceries — removed

> [!warning] This system is gone
> There are no signature items in the game. `ITEMS`, `SIG_MAX`, `sigPool()`,
> `openColdRoom()`, `takeSig()` and `grantItem()` are all deleted from
> `js/game.js` — the identifier `ITEMS =` does not appear in the shipped file.
> Kept as a record, because two of the five came back as
> [[The Deck#The two cards the groceries left behind|cards]] and the reasoning
> is worth not losing.

Five passive items stacking to level 2. They were [[Bosses|boss]] drops, then
briefly [[The Deck|cards]], then had their own door — **THE COLD ROOM**, which
opened on every floor-boss kill and offered two of the ones you hadn't maxed.

| item | level 1 | level 2 |
|---|---|---|
| **BANANA** → BANANA SPLIT | +22% speed, peels stun | +44% speed, peels detonate |
| **MELON** → MELON ARMOR | +38 max hp, 2-charge rind shield | +76 max hp, 4-charge, faster regrow |
| **COOLADE** → PURPLE COOLADE | ×1.38 damage, pierce +1 | ×1.85 damage, pierce +2 |
| **GLOCK-18** → AKIMBO | a second gun fires itself at whatever is closest | two of them, faster |
| **STOLEN BICYCLE** → STOLEN MOTORCYCLE | +16% speed, dash rams for 40 | +30% speed, ram 95 + fire trail |

## Why they went

They were the **fourth** parallel progression track — deck, augments, sidearm
marks, and these — and the only one with no decision in it worth the screen it
took. The cold room offered two of five; by the third floor you had usually
seen most of the pool, and by the fifth the "choice" was whichever one you
hadn't maxed yet.

Three specific problems:

1. **They were a second economy for the same currency.** A grocery and a card
   both arrived off a boss kill and both made numbers bigger. Two systems, one
   feeling.
2. **The copy lied and had to.** The item text was written when groceries were
   guaranteed boss drops and the only permanent power in the game. The numbers
   were cut hard when the deck arrived — *"×1.6 damage"* actually paid ×1.38 —
   but the copy was kept, because a once-a-floor pick that reads like a shrug
   is a bad thing to hand someone. That is a system arguing with itself.
3. **They dragged three other things along.** A whole extra screen, a HUD
   shelf, a pause-screen section, a `!perm` carve-out in the wave-end vacuum,
   a `perm` carve-out in the shop room swap, and a [[Contracts|contract]] that
   counted them.

## What replaced them

| the grocery | now |
|---|---|
| GLOCK-18 | **THE OTHER HAND** — a TOOLS [[The Deck\|card]], max 2, rider AKIMBO |
| STOLEN BICYCLE | **IGNITION** — a FRESH card, max 3, rider BURNOUT |
| BANANA, MELON, COOLADE | nothing. ADRENALINE, ROUGHAGE, MALICE and CARVE already covered every part of them. |
| THE COLD ROOM | nothing. The floor boss pays a hand of cards at better luck. |
| THE FULL MENU (contract) | **[[Contracts\|CLOSING TIME]]** — put down THE MEAT PROTOCOL |
| the HUD shelf | nothing — the bottom-right of the HUD is empty and better for it |

The two that came back came back as **cards you build toward** rather than
items a boss hands you, which is the difference the whole removal was for.

## Related
- [[The Deck#The two cards the groceries left behind]] — where GLOCK-18 and the bicycle went
- [[Contracts]] — CLOSING TIME, which took THE FULL MENU's slot
- [[Weapon Upgrades]] — the other removed system, and the same lesson
