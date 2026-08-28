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

Genuinely rare — **1.12%** per regular kill, 20% from an elite, 55% from a
floor boss and **guaranteed** from an APEX. Also awarded by two
[[Secrets|secrets]]: MODAGAZ (+1, once per floor) and GOROMANIA (+1).

Cards survive death, and — unlike coins — survive [[#Evolution|EVOLVE]] too.

### Cards buy [[Cosmetics]]

That was the missing half. Their only sink used to be the OMEGA BEAM at 50
cards; when that became [[Weapons#THE FISH|THE FISH]] at 500 coins, `S.cards`
was left as a counter with a drop rate, a sprite, a pickup sound and nothing
to spend it on. `enterShop` even carried the line `cards: 0, // nothing costs
cards any more`.

Cosmetics cost cards now, and nothing else does. That gives the rarest drop in
the game a purpose and gives cosmetics a currency you earn by *fighting* rather
than one that accrues on its own.

**Yield, from the game's own numbers.** A wave is
`round((8 + 3n) * (1 + 0.45 * floor))` bodies, so ten floors is about 2,570
regular kills at 1.12%, plus twenty elites at 20% and ten bosses at 55%:

| a run that | yields |
|---|---|
| dies around floor 5 | ~12–15 cards |
| clears all ten floors | ~40 cards |

> [!important] EVOLVE no longer wipes them
> It used to zero coins *and* cards together, as one run wallet. Now that
> cards are the cosmetic currency, that would have charged you your cosmetic
> savings for evolving — with nothing on the screen saying so. Coins still go
> to zero; cards are wallet, not run state.

> [!warning] Two different things called a card
> The dropped card above is **not** the same as a [[The Deck|deck card]].
> Deck cards are picked on level-up and cost nothing.

## Every run starts broke

Coins used to carry over between runs. They do not any more — `freshState()`
sets `coins: 0` and `persist()` no longer writes them, because nothing reads
them back.

The point is that the wallet you walk in with is not a function of how the
*last* run went. It also removes the incentive to keep farming a run you have
already given up on.

The one exception is earned: **HOARDER** pays "start every run holding 60
coins", and that still applies — it is now the only way a run begins with
anything at all.

[[#Cards|Cards]] and [[#The vault|the vault]] are unaffected and still carry
over. They are wallet; coins are run state.

> [!warning] This makes the top of the EVOLVE ladder much harder
> `EVO_COST(ev) = 150 + 175·ev + 25·ev²`, so the rungs are 150, 350, 600, 900,
> 1250, 1650, 2100, 2600, 3150, **3750** — and they used to be paid for out of
> coins banked across several runs.
>
> A full ten-floor clear is roughly 2,570 kills at [[#Coins|COIN_RATE]] 0.70,
> so about **1,800 coins**, before anything you spend in [[The Shop|the shop]].
> That covers rungs 0–5 comfortably and does not cover 6–9 at all without a
> coin build (DEBT ×1.4, CLEARANCE ×2) and buying nothing.
>
> That may be the intent — it makes each rung a run you have to *play for*
> rather than a total you accumulate. But if the last four rungs turn out to be
> unreachable in practice, `EVO_COST` is the number to turn, not this one.

## The vault

A *separate*, coin-fed pool. Every coin you ever pick up adds to it
permanently (`persist()` takes `max(vault, S.vault)`), independent of how many
you have since spent on guns — it is a running maximum, not a balance.

> [!note] It used to buy cosmetics, and now buys nothing
> Cosmetics moved to [[#Cards|cards]]. The vault is still tracked and still
> read by the **HOARDER** [[Contracts|contract]] (bank 12,000), so it is not
> dead — but it is a scoreboard now rather than a currency.

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
- **wipes coins to zero** — but *not* cards, which buy [[Cosmetics]]
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
| 7+ | EPIC | THE ROTISSERIE, THE DELI SLICER |

> [!note] No LEGENDARY is on the ladder
> `EVO_TIER` stops at EPIC, so no rung can ever offer
> [[Weapons#Every gun above RARE owns a verb|GOD FINGER, THE FISH, THE FLYKILLER
> or BLACK FRIDAY]]. All four are bought, and the tier is the only reason the
> coin economy has to keep climbing past a few hundred — handing one out for
> evolving would retire it. Verified across all ten rungs and every pool: no
> grade-4 gun is ever offered.
>
> This is what **THE DELI SLICER** is structurally for. Promoting GOD FINGER to
> LEGENDARY took it off this ladder, and EPIC would otherwise have been a rung
> holding a single gun — which is not a choice, it is a receipt.

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
