---
title: Groceries (Signature Items)
tags: [reference, systems]
---

# Groceries — the five signatures

Five passive items, stacking to level 2. They used to be [[Bosses|boss]]
drops, then briefly [[The Deck|cards]]. They have their own door now.

## THE COLD ROOM

Kill a **floor boss** and the cold room opens: you are shown **two** of the
signatures you haven't maxed and you take one.

> [!note] Why they left the deck
> A grocery and *+5% move speed* were being dealt into the same hand through
> different code paths. One is a percentage, the other is a permanent change
> to the character, and the hand had no way to price them against each other.
> Now the level-up hand is only ever cards, and the signatures have a room.

`openColdRoom()` draws two at random from `sigPool()` — everything below
`SIG_MAX = 2`. If you've maxed all five it doesn't open at all, and the floor
boss floats `THE DECK OPENS` instead of `THE COLD ROOM IS OPEN`. They keep
the old plumbing: `takeSig()` calls `grantItem()`, so `S.items` and `ITEMS`
work exactly as they always did.

Elites do **not** open it. An elite pays a card; a floor boss pays a card and
a name.

## The five

| item | level 1 | level 2 |
|---|---|---|
| **BANANA** → BANANA SPLIT | +35% speed, you drop peels | peels **DETONATE**, +70% speed |
| **MELON** → MELON ARMOR | +55 max hp, rind shield (3) | +110 max hp, rind shield (6), fast regrow |
| **COOLADE** → PURPLE COOLADE | ×1.6 damage, bullets pierce | ×2.3 damage, pierce 3 |
| **GLOCK-18** → AKIMBO GLOCK-18s | a second gun fires itself at whatever is closest | two of them. they never stop. |
| **STOLEN BICYCLE** → STOLEN MOTORCYCLE | +25% speed, your dash RAMS things | ram harder, leave a burning trail |

### The exact numbers

What `ST()` actually pays, which is not always what the item text says:

| item | lv1 | lv2 |
|---|---|---|
| BANANA | +22% speed, peels stun | +44% speed, `peelBoom` |
| MELON | +38 max hp, 2-charge shield, 14s recharge | +76 max hp, 4-charge, 8s |
| COOLADE | ×1.38 damage, pierce +1 | ×1.85 damage, pierce +2 |
| GLOCK-18 | 1 auto-gun, 13 dmg, 0.20s rate | 2 auto-guns, 0.11s rate |
| STOLEN BICYCLE | +16% speed, ram 40 dmg | +30% speed, ram 95 + fire trail |

> [!note] Why the text is louder than the code
> These descriptions were written when groceries were guaranteed boss drops
> and the only permanent power in the game. The numbers were cut when the deck
> arrived — stacking both at full strength trivialized floor 2 — but the copy
> was kept, because a once-a-floor pick that reads like a shrug is a bad thing
> to be handed. See the "Grocery bonuses" comment above `ST()`.

## Pace

One floor boss a floor, so at most **one signature per floor**, and ten picks
in total across a run before the pool is empty. Since a floor boss is also the
thing that opens deck tier 2, the cold room and the top of the deck arrive
together.

## Where they show up

- **THE COLD ROOM**, as the two-card choice
- the **pause screen**, under `SIGNATURE CARDS`, with their live level text
- the **shelf** along the bottom-right of the HUD, with a pip per level

Holding all five is what completes **THE FULL MENU** [[Contracts|contract]]
(`bumpMax('sigs', held)`).

> [!warning] THE FULL MENU's reward no longer does anything
> Its unlock reads *"signature cards turn up far more often."* That was the
> signature weight in the old `dealCards()`, which is gone — signatures aren't
> dealt any more. `contractDone('menu')` is referenced **nowhere** in
> `js/game.js`. The contract still completes and still shows as signed; it
> just has no effect. See [[Bugs Found#Open]].

## Related
- [[The Deck]] — the level-up hand, which no longer contains these
- [[Bosses]] — the floor boss that opens the cold room
- [[Contracts]] — THE FULL MENU
