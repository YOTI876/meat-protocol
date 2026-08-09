---
title: Progression
tags: [reference, systems]
---

# Progression

Four tracks of power, three of them for the run and one permanent:

| track | source | lasts |
|---|---|---|
| **[[The Deck\|the deck]]** | levels, elites, floor bosses | the run |
| **[[Groceries\|the signatures]]** | THE COLD ROOM, one a floor | the run |
| **[[Augments\|augments]]** | TOMCE, in a corner | the run |
| **the evolving sidearm** | descending a floor | the run |
| **[[Contracts\|contracts]]** | cross-run objectives | forever |

Nothing here costs coins. Coins buy [[Weapons|guns]] and rerolls; see
[[Economy]].

## XP & levels

Every kill grants XP (`gainXP()`):
- regular enemy: `max(2, round(score * 0.42))`
- boss or elite: flat 90

Level-up threshold starts at **80** and grows **×1.30** per level. Each level
grants 1 pick and opens the [[The Deck|hand]], which pauses the fight
(`S.mode = 'levelup'`).

| level | cumulative XP |
|---|---|
| 2 | 80 |
| 3 | 184 |
| 4 | 319 |
| 5 | 495 |
| 7 | 1,022 |
| 10 | 2,566 |

> [!note] Levels were pulled too fast, and got pulled back
> The curve went 65/×1.32 → **48/×1.23** → **80/×1.30**, and a kill now pays
> 0.42 of its score instead of 0.55.
>
> The middle number was a correction for the deck being new, back when a whole
> floor could go by without a level. It overshot, because it ignored the other
> tap: **three boss-class kills a floor each hand you a free pick on top**. A
> floor was paying out seven or eight cards, at which point the hand stops
> being a decision — you are going to be offered everything anyway. Slower
> levels make a pick worth reading, and they make the bosses' guaranteed hands
> feel like the reward they are.

XP is also the thing [[Augments|TOMCE]] most often asks you to trade away —
THE DEBT and FEEDER both cut it, LOUDMOUTH nearly halves the curve — and the
PRICE HIKE card raises it at the cost of health.

### Level feeds difficulty back

Higher level directly increases how many enemies spawn — see
[[Difficulty Scaling#The axes]]. This is deliberate: getting stronger is also
what keeps the fight from getting easy.

## The evolving sidearm

**THE SIDEARM** — the gun you start with — gains a **mark** every time you
descend to a new floor. Each mark:

- +20% damage (`scarMul = 1 + 0.20 * (scarLv - 1)`)
- a new bullet colour from a fixed 10-step palette (`SCAR_COLS`), cycling
- a new firing sound that drifts from a crack toward a beam as the mark
  climbs (`A.scarMk(lv)` in `js/audio.js`)
- a Roman-numeral name: `SIDEARM MK I`, `MK II`, … `MK X`, wrapping past that

Triggering a mark shows the **GLUSEC banner** along the bottom of the screen —
hue-cycling text, held 3 seconds — see [[Rendering#GLUSEC banner]].

This is what keeps the starting gun relevant on floor 12 without it being a
purchase decision. It is unrelated to run **EVOLVE**, which uses the same word
for something entirely different.

## Endless floors

There are four hand-built floors (`ROOMS`). Everything past them is generated
by `roomDef(idx)`, so the descent never runs out:

| | authored (floors 1–4) | generated (floor 5+) |
|---|---|---|
| name | written | from `DEEP_NAMES`, Roman-numeral suffix once it wraps |
| subtitle | written | `floor NN //` + a line from `DEEP_SUBS` |
| palette | hand-picked | hue wheel, `(200 + d*47) % 360` |
| arena | up to 1120×780 | grows ~36×26 per floor, **capped at 1560×1080** |
| darkness | 0.76 → 0.82 | `+0.008` per floor, **capped at 0.88** |

Floor 201 is `THE SALT LINE XXV`. The two caps exist so that a very deep run
doesn't end up with an unplayably huge black arena.

The [[Bosses]] roster repeats on a **ten**-floor cycle, with an
[[Bosses#APEX|APEX]] every fifth floor, and [[Difficulty Scaling]] keeps
climbing linearly with no ceiling of its own.

## Related
- [[The Deck]] — the main track: cards, aisles, grades, luck
- [[Augments]] — the parallel track with a cost attached
- [[Contracts]] — the permanent one
- [[Economy#Evolution]] — do not confuse sidearm "marks" with run **EVOLVE**
