---
title: Economy
tags: [reference, systems]
---

# Economy

Three currencies, one prestige system, one set of [[Contracts|contracts]].

## Coins

Earned from:

| source | amount |
|---|---|
| regular kill | ~19% chance of a coin drop |
| **elite** | 15 |
| **floor boss** | 26 |
| **APEX** | 50 |

…and then **every one of them goes through `COIN_RATE = 0.70` on the way into
your pocket.** The table above is what *drops*; you bank 70% of it.

```js
coinMul: COIN_RATE * (1 + ag('debt') * 0.40) * (rd('clearance') ? 2 : 1)
```

One knob, applied once, inside `coinMul` — which every coin already went
through, including the fixed piles a boss leaves. Measured: **3,000 regular
kills produced 514 coin drops and banked 359 coins**, or 0.12 a kill.

> [!note] Why the rate went up and then down again
> The drop table rose (16% / 10 / 18 / 38 → 19% / 15 / 26 / 50) when
> [[The Shop|PACI]] moved to **twice a floor** — a second visit you cannot
> afford anything at is a corridor with a man in it. `COIN_RATE` then cut 30%
> off the whole thing.
>
> These are not opposites. The first change fixed the *shape* of income across
> a floor; the second lowered its *total*, because [[Weapons#THE FISH|THE
> FISH]] at 500 coins has to be something you spend a run reaching rather than
> a number you pass on the way to floor 6.

Spent on:

- [[Weapons|guns]] (20–190 coins) — bought from [[The Shop|PACI]], twice a floor
- **[[Weapons#THE FISH|THE FISH]] — 500 coins**, and the reason the rate came down
- **rerolling a level-up hand** — `20 + rerolls * 15`, climbing within a run
- [[#Evolution|EVOLVE]] (100, doubling each time)

**Coins survive death.** Whatever you're holding carries into the next run.

> [!note] THE DEBT pays in fractions
> [[Augments|THE DEBT]] multiplies coin pickups by up to 1.8×, which is not a
> whole number. `S.coinFrac` accumulates the remainder across pickups and
> pays out whole coins as it crosses 1, so nothing is silently rounded away.

## Cards

Genuinely rare — **0.8%** per regular kill, 20% from an elite, 55% from a
floor boss and **guaranteed** from an APEX. Also awarded by two
[[Secrets|secrets]]: MODAGAZ (+1, once per floor) and GOROMANIA (+1).

Cards survive death, and are wiped by [[#Evolution|EVOLVE]].

> [!warning] Cards currently buy nothing
> Their only sink was the OMEGA BEAM at 50 cards. That gun is now
> [[Weapons#THE FISH|THE FISH]] and costs **500 coins**, so as of this pass
> `S.cards` is a counter with no spend attached — it still drops, still
> persists, still shows in the purse, and does nothing.
>
> The HUD no longer prints `n/50`, because there is no target to count toward.
> Three ways out, none of them chosen yet: give cards a new sink, fold them
> into an existing one, or remove the currency and its drop entirely.

> [!warning] Two different things called a card
> The dropped card above is **not** the same as a [[The Deck|deck card]].
> Deck cards are picked on level-up and cost nothing.

## The vault

A *separate*, coin-fed pool used only for [[Cosmetics]]. Every coin you ever
pick up adds to the vault permanently (`persist()` takes
`max(vault, S.vault)`), independent of how many you've since spent on guns.

This is the deliberate design point: **spending coins never costs you
cosmetic progress**, because the vault tracks the running maximum, not your
current balance. The **HOARDER** [[Contracts|contract]] reads the same total.

## Evolution

`EVOLVE`, available on the title and death screens:

```
cost(evolution) = 100 * 2^evolution   →  100, 200, 400, 800, 1600 ...
```

Evolving:
- requires `coins >= cost` (button is disabled otherwise — `canEvolve()`)
- **wipes coins and cards to zero**
- permanently raises `S.evo`, feeding [[Difficulty Scaling]]:
  - +38% enemy HP, +26% damage, +5% speed, +50% score per evolution
  - also raises boss add-caps and spawn counts slightly

**RESET EVOLUTION** (title, pause, death — appears once `evo > 0`) sets
`S.evo` back to 0 with no cost and no wallet wipe. It's a pure undo, not a
respec.

Evolving does **not** touch [[Contracts|contract]] progress. That is the one
part of the save that only goes up.

## What resets, and when

| | dying | evolving |
|---|---|---|
| level, [[The Deck\|deck]], [[Augments\|augments]] | reset | reset |
| owned guns, [[Groceries\|signature items]] | reset | reset |
| coins, cards | **kept** | **wiped** |
| vault, cosmetics | kept | kept |
| contracts | kept | kept |
| `S.evo` | kept | +1 |

## Related
- [[Pickups]] — drop rates for coins and cards
- [[The Deck]] — the *other* thing called a card
- [[Cosmetics]] — what the vault buys
- [[Contracts]] — the permanent track that evolution can't wipe
