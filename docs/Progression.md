---
title: Progression
tags: [reference, systems]
---

# Progression

Two independent tracks of permanent-for-the-run power: **XP levels** and the
**evolving base rifle**. Neither costs coins — see [[Weapon Upgrades]] and
[[Economy]] for the paid track.

## XP & levels

Every kill grants XP (`gainXP()`):
- regular enemy: `max(3, round(score * 0.55))`
- boss: flat 90

Level-up threshold starts at 65 and grows ×1.32 per level
(`xpNext = round(xpNext * 1.32)`). Each level grants **1 upgrade point** and
opens a full-screen choice popup that **pauses the fight** (`S.mode =
'levelup'`).

### The three upgrades (`UPGRADES`)

| upgrade | effect per rank |
|---|---|
| **ADRENALINE** | +6% move speed |
| **MALICE** | +8% damage |
| **CALLUS** | −7% damage taken (capped at 60% total reduction) |

Ranks are unlimited and stack linearly, folded into `ST()` as
`u.spd`/`u.dmg`/`u.def`. Picking a card also heals +12 HP.

### Level feeds difficulty back

Higher level directly increases how many enemies spawn — see
[[Difficulty Scaling#The axes]]. This is deliberate: getting stronger is
also what keeps the fight from getting easy.

## The evolving rifle

SCAR-L gains a **mark** every time you descend to a new floor (not every
wave — that was the original design, changed once per-wave marks made the
gun outscale everything else too fast). Each mark:

- +20% damage (`scarMul = 1 + 0.20 * (scarLv - 1)`)
- a new bullet colour from a fixed 10-step palette (`SCAR_COLS`), cycling
- a new firing sound that drifts from rifle-crack toward laser-beam as the
  mark climbs (`A.scarMk(lv)` in `js/audio.js`)
- a Roman-numeral name: `SCAR-L MK I`, `MK II`, ... `MK X`, wrapping past that

Triggering a mark shows the **GLUSEC banner** along the bottom of the screen —
hue-cycling text, held 3 seconds — see [[Rendering#GLUSEC banner]].

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

The [[Bosses]] roster repeats, but with a payout that adapts once you've maxed
its grocery, and [[Difficulty Scaling]] keeps climbing linearly with no
ceiling of its own.

## Related
- [[Weapon Upgrades]] — the coin-bought, per-weapon track (CYCLE/SPLIT/POWER)
- [[Difficulty Scaling]] — where level and evolution feed back into spawn math
- [[Economy#Evolution]] — do not confuse rifle "marks" with run **EVOLVE**;
  they're unrelated systems that happen to both use the word "evolve/evolution"
