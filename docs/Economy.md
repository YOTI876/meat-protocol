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
- [[#Evolution|EVOLVE]] — 150 up to 3750, ten rungs, 16,500 for the lot

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

**`EVOLVE` lives on the [[Controls#Two things called a menu|pause screen]] and
nowhere else.** It used to sit on the title and death screens, where it was a
lever with no visible price and nothing to lose by pulling it. Pressing it now
**restarts the run you are in** — so it is offered on the one screen where the
run is in front of you and the coins it takes are on the same strip.

```
cost(evo) = 150 + 175*evo + 25*evo²
          →  150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150, 3750
          →  16,500 for the whole ladder
```

**Ten rungs, and that is the end of it** (`EVO_MAX = 10`). The cost used to
double forever, which is the right shape for something unbounded and the wrong
one for something that ends — rung 10 would have wanted 51,200 coins, and at
[[#Coins|COIN_RATE]] that is several hundred thousand kills.

Evolving:
- requires `coins >= cost` and `evo < EVO_MAX` (`canEvolve()`)
- **wipes coins and cards to zero**
- opens the **pick screen** below, and restarts the run on the way out
- permanently raises `S.evo`, feeding [[Difficulty Scaling]]:
  - +46% enemy HP, +30% damage, +6% speed, +50% score, +15% spawn count
  - also raises boss add-caps and the concurrent-enemy cap

### What a rung pays out

Not just a difficulty number any more. Each rung hands over something you keep
in **every** run afterwards, and what it hands over depends on how far up you
already are.

**Rungs 1–7ish: a gun.** You are offered the guns of the rarity that rung
opened, minus whatever the roster already holds, and the one you take is yours
from the first frame of every run forever.

| rung | rarity opened | guns in that tier |
|---|---|---|
| 1–2 | COMMON | SCAR-L, MEAT SPLITTER |
| 3–4 | UNCOMMON | THE PRICE GUN, THE STAPLER |
| 5–6 | RARE | MICROWAVE, FREEZER BURN, THE HOG |
| 7+ | EPIC | THE ROTISSERIE, GOD FINGER |

> [!note] No LEGENDARY is on the ladder
> `EVO_TIER` stops at EPIC, so no rung can ever offer
> [[Weapons#The three LEGENDARIES|THE FISH, THE FLYKILLER or BLACK FRIDAY]].
> All three are bought, and the tier is the only reason the coin economy has to
> keep climbing past a few hundred — handing one out for evolving would retire
> it. Verified across all ten rungs and every pool: no grade-4 gun is ever
> offered.

A tier holds two or three guns and a rung takes one, so the back half of a tier
would otherwise be a screen with a single card on it, which is not a choice. If
the tier is down to its last gun the pool opens the tier **above** it too, and
only falls back downward when there is nothing above. A
[[Contracts|contract-locked]] ROTISSERIE is handled by the same widening.

**Once the roster holds one gun of every rarity: three LEGENDARY cards.** There
is nothing left in the crate to hand over, so the rung deals three
[[The Deck|deck cards]] at LEGENDARY instead and you **start every run holding
the one you took**. Rank-capped cards drop out of the pool, and the weights are
the hand's own weights, so [[The Deck#SPLIT|SPLIT]] stays an event even here.

Taking a gun before a card is not a rule — it falls out of `evoReward()`
checking the roster first — but the ladder is built so rung 7 forces an EPIC,
which is what completes the set.

### Where the roster is applied

`applyEvoLoadout()` runs inside `startRun()`, **after** `makePlayer()` and
**before** anything reads the build. Cards go in before guns on purpose:
magazine size reads `ST().magMul`, which reads the deck, so a TOOLS card in the
starting hand has to be banked before any magazine is filled. Damjan's health
is then topped to `ST().maxhp`, so a starting ROUGHAGE is health you have
rather than a ceiling you are under.

> [!note] The roster thins PACI's crate
> Anything in the roster is owned from frame 1, so [[The Shop|PACI]] stops
> carrying it. That is the intended shape — an evolved run walks in holding
> what a fresh one has to buy — but a deep enough roster can leave him with an
> empty pallet below floor 5. `shopStock()` returns `[]` and the pedestal loop
> survives it.

> [!note] Elites read the roster for free
> `powerMul()` already counts guns held and cards in the deck, so an evolved
> roster prices [[Bosses#They scale to your build, not just to the floor|elites]]
> up on its own. `diff()` needs no extra term for it.

**RESET EVOLUTION** (pause only, appears once `evo > 0`) sets `S.evo` back to
0, **empties the roster and the starting hand**, and restarts the run — you
cannot keep holding guns you no longer own. No cost, no wallet wipe.

Evolving does **not** touch [[Contracts|contract]] progress. That is the one
part of the save that only goes up.

## What resets, and when

| | dying | evolving | reset evo |
|---|---|---|---|
| level, [[The Deck\|deck]], [[Augments\|augments]] | reset | reset | reset |
| owned guns | reset | reset | reset |
| coins, cards | **kept** | **wiped** | kept |
| vault, cosmetics | kept | kept | kept |
| contracts | kept | kept | kept |
| `S.evo` | kept | +1 (max 10) | **0** |
| `evoGuns` / `evoCards` roster | kept | **+1 pick** | **emptied** |

## Related
- [[Pickups]] — drop rates for coins and cards
- [[The Deck]] — the *other* thing called a card
- [[Cosmetics]] — what the vault buys
- [[Contracts]] — the permanent track that evolution can't wipe
