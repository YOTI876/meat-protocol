---
title: Weapons
tags: [reference, systems]
---

# Weapons

Eleven guns. Damjan starts with **THE SIDEARM** and nothing else — everything
above it is bought from [[The Shop|PACI]], and guns are never scattered on the
arena floor.

| gun | rarity | cost | mag | dmg | what it does |
|---|---|---|---|---|---|
| **THE SIDEARM** | COMMON | free | 18 | 21 | *it was in the drawer. it will do.* Fires every **0.178s**. Evolves every floor — see [[Progression#The evolving sidearm]] |
| **SCAR-L** | COMMON | 20 | 30 | 13 | *reliable. boring. yours.* |
| **MEAT SPLITTER** | COMMON | 30 | 2 | 12 ×9 | shotgun, 140 knockback — *nine reasons to stand still* |
| **THE PRICE GUN** | UNCOMMON | **80** | 40 | 7 | tags things **ON SALE**: everything takes ×1.6 on a marked target |
| **THE STAPLER** | UNCOMMON | 55 | 60 | 8 | nailgun, pins for 0.45s |
| **MICROWAVE** | RARE | 80 | 16 | 34 | plasma orbs, ricochet ×3, burn 16 — *reheats the dead* |
| **FREEZER BURN** | RARE | 95 | 55 | 9 | chills for 2.2s — *the cold aisle, weaponised* |
| **THE HOG** | RARE | 120 | 120 | 10 | minigun, spins up, slows you 45% — *never stops* |
| **THE ROTISSERIE** | EPIC | 165 | 70 | 14 | **fires in a spinning circle** regardless of aim, burn 10 |
| **GOD FINGER** | EPIC | 190 | 5 | 165 | railgun, 0.5s charge, pierces everything |
| **THE FISH** | LEGENDARY | **500 coins** | 300 (as fuel) | 720/s | a fish. it opens its mouth and a laser comes out, and the laser cycles colour |

Rarity is the same ladder the [[The Deck#Rarity, and why it matters|cards]]
use, and it's what a gun shines at on the pedestal — `gr` in `WEP`. Full
definitions live in `js/game.js`; `WORDER` is the slot order.

> [!note] Two numbers moved
> **THE SIDEARM** fires 15% slower (`rate` 0.155 → 0.178 — `rate` is the delay
> between shots, so a bigger number is a slower gun). The gun you are given
> free should be the one you are trying to stop needing.
>
> **THE PRICE GUN** went 45 → 80. It does almost no damage itself and then
> multiplies everything else you own by 1.6× on a marked target, which made it
> the strongest coin in the game at the cheapest tier — a floor-1 no-brainer
> rather than a decision.

## THE FISH

It used to be the OMEGA BEAM: a violet line, bought with **50
[[Economy#Cards|cards]]**. It is now a fish, held by the tail, that opens its
mouth and emits a laser, bought with **500 coins**.

The beam draw takes a `prism` flag off the weapon. Four stacked strokes —
widest and dimmest first, so the line reads as a hot core inside a haze —
and with `prism` set the three outer layers walk the hue wheel, each offset
26° from the last, so the beam **fringes** across its width the way a real
split would rather than being one flat colour that happens to change.

> [!note] The core stays white on purpose
> Only the outer layers cycle. A beam whose *centre* changed colour reads as a
> different weapon every second, and you would stop being able to pick it out
> against a floor palette that is also coloured. Same reason the sprite itself
> stays violet: a fish that strobed through the spectrum in your hand would
> fight the arena every frame. One colour, firing every colour, is the joke.

## When PACI starts carrying it

Price was never a real gate. Now every gun has a `floor` — the depth PACI
first puts it on a pedestal — and since he turns up
[[The Shop#Cadence|twice a floor]] this is what keeps the crate from opening
all at once.

| first offered on | guns |
|---|---|
| **floor 1** | SCAR-L, MEAT SPLITTER, THE PRICE GUN |
| **floor 2** | THE STAPLER |
| **floor 3** | MICROWAVE |
| **floor 4** | FREEZER BURN |
| **floor 5** | THE HOG, **THE FISH** |
| **floor 6** | THE ROTISSERIE *(and its contract)* |
| **floor 7** | GOD FINGER |

So a floor-1 shop offers three things totalling 130 coins against a floor of
roughly 60 coins income: enough to buy one and want the others.

THE FISH is no longer exempt. Cards used to be its gate, so it was appended to
the pool unconditionally; 500 coins and floor 5 are its gate now.

## One is locked behind a contract

**THE ROTISSERIE** is not in `shopStock()`'s pool at all until **BREAK THE
SEAL** (8 floor bosses) is signed. `WEP.rot.lock = 'seal'` names the contract;
`shopStock()` filters on it.

> [!warning] THE DESCENT's reward is not implemented
> The contract's unlock line reads *"FREEZER BURN joins the crate"*, but
> `WEP.chill` carries **no `lock`** — it has always been in `BUYABLE`
> unconditionally, so the contract signs, toasts, displays as signed, and
> changes nothing. This predates the depth gate; `floor: 3` is now the only
> thing holding FREEZER BURN back. Same failure mode as
> [[Bugs Found#B. THE FULL MENU's reward does not exist|THE FULL MENU]].

## Handling notes

- **Reload** is a 4-stage animation (mag ejects with gravity → new mag slides
  in → charging handle racks) at each gun's own `reload` duration — see
  [[Rendering#Reload animation]].
- **THE ROTISSERIE** ignores your aim entirely. `p.spitAng` advances 0.55 rad
  a shot, so it paints a spiral outward — it is a *room* weapon, not a
  pointing one.
- **THE PRICE GUN** does very little damage itself. Its 6-second mark makes
  everything *else* you own hit for 1.6× on that target (`MARK_MUL`).
- **THE HOG** ramps `p.spin` from 0→1 over 0.75s; fire rate and movement
  penalty both scale with it.
- **GOD FINGER** accumulates `p.charge`; firing early does nothing, it only
  releases at full charge.
- **THE FISH** doesn't fire discrete bullets — `updateBeam()` runs a
  continuous raycast each frame and drains the mag as fuel per second.

## What modifies them

There is no armory. Every weapon modifier is a [[The Deck|card]] now, and it
applies to **whatever you happen to be holding** rather than to one gun you
paid to improve: the whole **TOOLS** aisle (CYCLE, SPLIT, CALIBER, HOPPER,
QUICK HANDS, RICOCHET, GUIDANCE, MUNITIONS) plus everything in **BLADES**.

> [!warning] SPLIT was the card that broke this
> One rank used to fan **2n+1** rounds with the centre shot at full power, so
> the card was a free +100% with no downside and every other TOOLS card was a
> worse SPLIT. It is now one rank, **two rounds at 0.65 each and no centre
> shot** — +30% output traded against never hitting dead centre, which is a
> real cost on GOD FINGER and a real gift on a shotgun. It is also LEGENDARY,
> floor-3-and-below locked, and dealt about once in forty hands. See
> [[The Deck#SPLIT]].
>
> On a continuous beam there is nothing to fork, so SPLIT **widens** it
> instead — `girth * (1 + split * 0.45)`. [[#THE FISH|The fish]] is the one gun
> the old armory refused to touch at all; it takes cards like everything else.

## Where you buy them

Clearing wave 5 or wave 10 opens [[The Shop|PACI's back room]], which lays out
**three** pedestals (four with the REGULAR contract) drawn at random from
whatever passes all three gates — owned, contract-locked, and deep enough.
Within a floor's eligible set nothing is ordered by tier, so the two shops on
one floor can offer the same gun twice or never.

## Related
- [[The Deck]] — the cards that modify whatever you're holding
- [[The Shop]] — the pedestals, the prices, and PACI's temper
- [[Progression#The evolving sidearm]] — why THE SIDEARM is special
- [[Contracts]] — the one locked gun, and the one that only claims to be
