---
title: Economy
tags: [reference, systems]
---

# Economy

Three currencies, one prestige system.

## Coins

Earned from: [[Bosses|boss kills]] (exactly 5, guaranteed — or **12** once
that boss's grocery is already maxed) and regular enemies (~16% chance per
kill, see [[Pickups]]). Spent on:

- [[Weapons|guns]] (15–175 coins) — bought from [[The Shop|PACI]]
- [[Weapon Upgrades|the Armory]]: CYCLE and POWER scale with weapon tier and
  rank; **SPLIT is a flat 100 coins on every weapon, once**
- [[#Evolution|EVOLVE]] (100, doubling each time)

**Coins survive death.** Whatever you're holding carries into the next run.

## Cards

Genuinely rare (0.8% per regular kill, 5% per boss kill — **45%** from a boss
whose grocery is already maxed). Also awarded by two [[Secrets|secrets]]:
MODAGAZ (+1) and GOROMANIA (+1). Their only use is buying the **OMEGA BEAM**
for **50 cards**, and only when [[The Shop|PACI]] happens to be stocking it
— see [[Weapons]].

Cards also survive death.

## The vault

A *separate*, coin-fed pool used only for [[Cosmetics]]. Every coin you ever
pick up adds to the vault permanently (`persist()` takes
`max(vault, S.vault)`), independent of how many you've since spent on guns.
This is the deliberate design point: **spending coins on weapons never costs
you cosmetic progress**, because the vault tracks the running maximum, not
your current balance.

## Evolution

`EVOLVE`, available on the title and death screens:

```
cost(evolution) = 100 * 2^evolution   →  100, 200, 400, 800, 1600 ...
```

Evolving:
- requires `coins >= cost` (button is disabled otherwise — `canEvolve()`)
- **wipes coins and cards to zero**
- permanently raises `S.evo`, feeding [[Difficulty Scaling]]:
  - +38% enemy HP per evolution
  - +26% enemy damage per evolution (before the flat −5% balance pass)
  - +5% enemy speed per evolution
  - +50% score per evolution
  - also raises boss add-caps and spawn counts slightly

**RESET EVOLUTION** (title, pause, death — appears once `evo > 0`) sets
`S.evo` back to 0 with no cost, no wallet wipe. It's a pure undo, not a
respec — you don't get coins back for it.

## Related
- [[Pickups]] — drop rates for coins and cards
- [[Cosmetics]] — what the vault buys
- [[Difficulty Scaling]] — the exact formulas evolution feeds into
