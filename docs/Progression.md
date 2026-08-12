---
title: Progression
tags: [reference, systems]
---

# Progression

Four tracks of power, three of them for the run and one permanent:

| track | source | lasts |
|---|---|---|
| **[[The Deck\|the deck]]** | levels, elites, floor bosses | the run |
| **[[Augments\|augments]]** | TOMCE, in a corner | the run |
| **the evolving sidearm** | descending a floor | the run |
| **[[Contracts\|contracts]]** | cross-run objectives | forever |

The [[Groceries|signatures]] were a fifth track and are gone. Three tracks for
a run is already two more than most of this genre carries, and the one that
went was the one you had no decisions inside.

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
- a Roman-numeral name: `SIDEARM MK I`, `MK II`, … `MK X`

Ten floors, so the marks now run exactly `MK I` to `MK X` and the wrap in
`roman()` never fires. **+180% damage** on the last floor, on the gun you were
handed for free.

> [!note] The GLUSEC banner is gone
> A mark used to fire a full-width hue-cycling sign across the bottom of the
> screen for three seconds. It landed on top of the floor name, the floor
> [[Floors#Twists|twist]] and everything else a floor entry throws up — three
> seconds of the brightest thing on screen, for a passive +20%.
>
> What is left is a short line on the weapon readout, which is where you would
> look to check anyway: `SIDEARM MK VII  +120%`, in the mark's own colour,
> faded out over 0.6s.

This is what keeps the starting gun relevant on floor 9 without it being a
purchase decision. It is unrelated to run **EVOLVE**, which uses the same word
for something entirely different.

## Ten floors, and then it stops

There are ten hand-built floors in `ROOMS` and nothing past them — `roomDef()`
**clamps** rather than generating. See [[Floors]].

| | before | now |
|---|---|---|
| authored floors | 4 | **10** |
| past them | generated from a hue wheel and a name list | there is no past them |
| bosses | the roster cycled `floor % 10`, forever | nine of ten, [[Bosses#The roster is shuffled, and that took a rewrite\|shuffled per run]] |
| APEX | every fifth floor, forever | **floor 5 only** |
| the end | death | [[Bosses#THE MEAT PROTOCOL\|THE MEAT PROTOCOL]], or death |

The generator was never a bad piece of code — it was a good answer to the wrong
question. An endless descent has no act structure, no finale and no reason to
build toward anything, because there is nothing to build toward. Ten floors
that end is a game you can beat, which is also the first time
[[Contracts|CLOSING TIME]] has had anything to ask for.

[[Difficulty Scaling]] still climbs linearly with no ceiling of its own — it
just only has nine rungs to climb now.

## Related
- [[Floors]] — the ten of them, in order
- [[The Deck]] — the main track: cards, aisles, grades, luck
- [[Augments]] — the parallel track with a cost attached
- [[Contracts]] — the permanent one
- [[Economy#Evolution]] — do not confuse sidearm "marks" with run **EVOLVE**
