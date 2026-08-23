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
| **CLOSING TIME** | put down [[Bosses#THE MEAT PROTOCOL\|THE MEAT PROTOCOL]] | every run starts on a hand of four |

### CLOSING TIME replaced THE FULL MENU

> [!note] A contract that could never be signed
> The old eighth contract read *"hold all five signature cards"* and counted a
> stat only the cold room could advance. With the [[Groceries|groceries]] gone
> it became a contract that **could never be signed**, tracking a system that
> no longer existed, promising a reward that had already been removed once
> before — the signature weight in `dealCards()`, which went with the
> signatures.
>
> It was replaced rather than deleted. The slot is worth keeping, and
> **clearing the building** was the one achievement the game had no contract
> for. It reuses the `menu` id, so old saves keep their row.

CLOSING TIME and APEX PREDATOR pay the same thing and do not stack —
`handSize()` reads `contractDone('apex') || contractDone('menu')`. That is
deliberate: they are the two hardest things in the game and either one should
be enough.

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
`bumpMax()` is for high-water marks — a count that can go **down** within a run
and must not be allowed to take the record with it.

The `prime` counter behind GRADED is keyed off `RIDER_AT`, so it counts
exactly the picks that lit a [[The Deck#Riders — the reason rarity is a moment|rider]].

`checkContracts()` runs after anything that could complete one, compares
against the `cDone` list already in the save, and fires the toast exactly
once — so a contract you signed three runs ago stays quiet.

## Where each one pays out

- **at the top of a run** (`startRun()`) — BUTCHER'S DOZEN and HOARDER
- **when a hand is dealt** — GRADED, APEX PREDATOR, CLOSING TIME
- **when PACI stocks his room** — REGULAR, BREAK THE SEAL, THE DESCENT

> [!note] THE DESCENT pays out for real now
> For most of this project its unlock line was decoration: `WEP.chill` carried
> no `lock`, so FREEZER BURN was buyable from the first shop that rolled it and
> signing the contract changed nothing. `lock: 'deep'` closed it — the fix that
> makes the line true rather than the one that rewrites the line. Measured
> either side of the gate: **0 of 500** shop rolls before, **147** after. See
> [[Bugs Found#25. THE DESCENT's reward did not exist]].

> [!note] Contracts survive EVOLVE
> Evolving wipes coins and cards. It does **not** touch contract progress or
> the `cDone` list — those are the one thing in the save that only ever goes
> up.

## Related
- [[The Deck]] — what GRADED, APEX PREDATOR and CLOSING TIME change
- [[Bosses#THE MEAT PROTOCOL]] — the thing CLOSING TIME asks you to put down
- [[The Shop]] — the fourth pedestal and the two locked guns
- [[Economy]] — the vault total HOARDER reads
