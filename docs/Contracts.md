---
title: Contracts
tags: [reference, systems, meta]
---

# Contracts

Persistent, cross-run objectives — the reason to come back. Each one unlocks
something the game actually **does differently**, so the meta isn't just a
bigger number the way [[Economy#Evolution|EVOLVE]] is.

Read them from the title screen (**CONTRACTS** button). `CONTRACTS` in
`js/game.js`.

| contract | goal | what signing it changes |
|---|---|---|
| **BREAK THE SEAL** | put down 8 floor bosses | THE ROTISSERIE joins PACI's crate |
| **THE DESCENT** | reach floor 8 | FREEZER BURN joins PACI's crate |
| **REGULAR** | visit PACI 12 times | PACI lays out a **fourth** pedestal |
| **GRADED** | take 25 RARE-or-better cards | **+1 LUCK** on every card you are dealt |
| **BUTCHER'S DOZEN** | 3000 kills, all runs counted | start every run **one level up** |
| **HOARDER** | bank 12000 coins in the vault | start every run holding **60 coins** |
| **APEX PREDATOR** | kill an APEX | you are dealt **four** cards, not three |
| **THE FULL MENU** | hold all five signatures | ~~signature cards turn up far more often~~ — **nothing, see below** |

> [!warning] THE FULL MENU's reward is dead code
> Its unlock was the signature weight in `dealCards()`. Signatures left the
> deck for [[Groceries#THE COLD ROOM|the cold room]] and the weight went with
> them — `contractDone('menu')` is now referenced **nowhere** in
> `js/game.js`. The contract still tracks, still completes, still shows as
> signed, and does nothing. See [[Bugs Found#Open]].

Two of them are the only way to reach two of the [[Weapons|guns]]: THE
ROTISSERIE and FREEZER BURN are not in `shopStock()`'s pool at all until
their contract is signed.

## How they're counted

Counters live in `localStorage` under `c_*`, except two that were already
being tracked for the title screen:

| stat | source |
|---|---|
| `deep` | the existing deepest-floor record |
| `vault` | the existing [[Economy#The vault\|vault]] total |
| everything else | `bump()` / `bumpMax()` from the event itself |

`bump()` fires on the event (a boss dies, a shop opens, a RARE-or-better card
is taken); kills are batched every 25 rather than written on each death.
`bumpMax()` is for high-water marks like "five signatures held at once", which
can go down within a run and must not.

The `prime` counter behind GRADED is keyed off `RIDER_AT`, so it counts
exactly the picks that lit a [[The Deck#Riders — the reason rarity is a moment|rider]].

`checkContracts()` runs after anything that could complete one, compares
against the `cDone` list already in the save, and fires the toast exactly
once — so a contract you signed three runs ago stays quiet.

## Where each one pays out

- **at the top of a run** (`startRun()`) — BUTCHER'S DOZEN and HOARDER
- **when a hand is dealt** — GRADED, APEX PREDATOR
- **when PACI stocks his room** — REGULAR, BREAK THE SEAL, THE DESCENT
- **nowhere** — THE FULL MENU

> [!note] Contracts survive EVOLVE
> Evolving wipes coins and cards. It does **not** touch contract progress or
> the `cDone` list — those are the one thing in the save that only ever goes
> up.

## Related
- [[The Deck]] — what GRADED, APEX PREDATOR and THE FULL MENU change
- [[The Shop]] — the fourth pedestal and the two locked guns
- [[Economy]] — the vault total HOARDER reads
