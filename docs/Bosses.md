---
title: Bosses
tags: [reference, systems]
---

# Bosses

Five bosses, spawning on waves **3, 5, 7, 9, 10** in that order
(`BOSS_WAVES`). Stats are floor-1 baseline before [[Difficulty Scaling]].

The roster repeats every floor, forever — that's what makes the endless
descent work. What changes is [[Difficulty Scaling|how hard they hit]] and
what they're still able to give you.

| # | boss | hp | drop | pattern | summons |
|---|---|---|---|---|---|
| 0 | **THE BUTCHER** | 850 | [[Groceries#BANANA → BANANA SPLIT\|BANANA]] | `charge` | 3 crawlers / 6.5s |
| 1 | **MOTHER OF MELONS** | 1100 | [[Groceries#MELON → MELON ARMOR\|MELON]] | `spawner` | 4 (crawler×2 + shrieker) / 4.2s |
| 2 | **THE PITCHER** | 1450 | [[Groceries#COOLADE → PURPLE COOLADE\|COOLADE]] | `blink` | 3 (stalker + crawler) / 7.0s |
| 3 | **THE HOGFATHER** | 1850 | [[Groceries#GLOCK-18 → AKIMBO GLOCK-18s\|GLOCK-18]] | `burst` | 4 (crawler + shrieker + bloater) / 6.0s |
| 4 | **THE COURIER** | 2400 | [[Groceries#STOLEN BICYCLE → STOLEN MOTORCYCLE\|STOLEN BICYCLE]] | `circle` | 4 (stalker×2 + crawler) / 6.8s |

## Patterns

- **charge** — idles toward you, telegraphs (0.75s, red line shown), then
  charges at 5.2× speed in a straight line.
- **spawner** — drifts, periodically rings out a full-circle burst of
  projectiles (12 + 4/floor of them) instead of charging.
- **blink** — teleports to a random point 55–90px from you every 2–3s,
  firing a 5-shot spread on arrival.
- **burst** — charges like `charge`, but leaking projectiles mid-charge and
  detonating into a 16-way ring burst when the charge ends.
- **circle** — orbits you at 96px, tightening in for a 4.6× speed charge,
  then rings out 8 projectiles. Never fully stops moving.

## Summoning

Every boss calls for backup on its own `addT`/`addN` schedule (see table
above), but only while the arena is under a **floor-scaled ceiling**:

```
addCap = min(30, 14 + floor*4 + evolution*2)
```

This is what keeps five simultaneously-summoning boss types from turning into
an avalanche — see the tuning notes in [[Bugs Found]] and [[Tuning Values]].

## On death

Every boss drops:
- Its item (see [[Groceries]]) — permanent for the run
- **Exactly 5 coins**, scattered outward
- 5% chance of a [[Economy#Cards|card]]
- 1 grenade pickup
- A full [[Rendering#Death burst|death burst]]: white pop, shockwave, meat
  cloud, sparks, rising embers, plus hitstop and a screen flash

### Once its shelf is empty

Groceries stop at level 2. Because bosses repeat forever, a boss whose item
you've already maxed has nothing left to give — so it pays in metal instead:

| | fresh boss | shelf already full |
|---|---|---|
| item | dropped | none |
| coins | 5 | **12** |
| card chance | 5% | **45%** |

This is what stops the twentieth THE BUTCHER from dropping a meaningless third
banana, and it's the main coin faucet on deep floors.

## Every third boss opens a shop

`S.bossKills` counts across the whole run, and every `SHOP_EVERY` (3) kills
sets `S.shopDue`. Instead of the next wave starting, the floor hands you
[[The Shop|PACI's back room]]. The kill that triggers it also floats
`A DOOR OPENS SIDEWAYS` over the corpse.

## Related
- [[Enemies]] — the four regular types bosses summon
- [[Groceries]] — what each boss actually drops and what it does
- [[The Shop]] — what the third boss unlocks
