---
title: Augments (TOMCE)
tags: [reference, systems]
---

# TOMCE, and what he deals in

Augments are **not** [[The Deck|cards]]. Every one is a trade with a real
cost attached, tuned so the upside beats the downside by a nose and no
further. There is no version of this menu where every option is good.

## Finding him

`buildRoom()` gives him a **60% chance per floor**. He stands in one of the
three corners the [[Secrets#2. MODAGAZ|MODAGAZ sigil]] isn't in — the two of
them are never in the same place — and the spot is rejected if anything is
in a wall there.

Walk up and press **E**. He offers three, you take one or press **Esc** to
refuse, and either way he's done for the floor (`q.used`). He does not
follow you into [[The Shop|PACI's room]], and he is not swept up by the room
swap — the shop stash carries him.

He is not [[The Shop|PACI]] and he does not greet you. Take the trade and
*he writes something down and does not look up*; refuse it and *he nods. he
was not going to insist.*

## The ledger

`AUGMENTS` in `js/game.js`. All rank to 2 except HOLLOW.

| augment | you get | you pay |
|---|---|---|
| **CATARACT** | +15% damage | you see 11% less |
| **TINNITUS** | +16% fire rate | −9% move speed |
| **GLASS HANDS** | +24% damage | −15% max health |
| **DEAD WEIGHT** | +22% max health | −8% move speed |
| **SHORT FUSE** | −22% reload time | −16% magazine |
| **THIN SKIN** | +30% damage | +22% damage taken |
| **GREASE** | dash 30% more often | +11% damage taken |
| **COLD BLOOD** | +9% critical chance | loot pulls from 30% closer |
| **THE DEBT** | +40% coins | −14% experience |
| **FEEDER** | +1.5 health a kill | −18% experience |
| **LOUDMOUTH** | +45% experience | 18% more of them come |
| **SLEEPLESS** | +14% move speed | −10% sight |
| **HOLLOW** (max 1) | one more card in every hand | −10% max health |

Values scale linearly with rank, so a second CATARACT is +30% damage and
−22% sight.

## The ones that touch other systems

Most augments fold into `ST()` and stop there. These reach further:

- **LOUDMOUTH**'s `swarm` multiplies the wave's spawn *count* — it makes the
  floor genuinely busier, not just slower to level.
- **SLEEPLESS** and **CATARACT** multiply `sight`, which shrinks the holes
  punched in the [[Rendering#Lighting|lightmap]]. You are actually seeing
  less of the room.
- **COLD BLOOD**'s `magnet` shrinks the pickup pull radius, so loot has to be
  walked to.
- **HOLLOW** widens `handSize()`, stacking with the APEX PREDATOR
  [[Contracts|contract]].

> [!warning] GLASS HANDS can cut the ceiling out from under you
> `takeAugment()` clamps `p.hp` to the new `maxhp` immediately. Taking a
> −15% max health trade at full health costs you the health, not just the
> ceiling.

## Related
- [[The Deck]] — the other, larger progression system, dealt on level-up
- [[Secrets]] — the corner TOMCE deliberately never stands in
- [[Difficulty Scaling]] — where LOUDMOUTH's `swarm` lands
