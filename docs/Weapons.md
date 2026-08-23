---
title: Weapons
tags: [reference, systems]
---

# Weapons

Fourteen guns. Damjan starts with **THE SIDEARM** and nothing else — everything
above it is bought from [[The Shop|PACI]], or kept forever off the
[[Economy#What a rung pays out|evolution ladder]]. Guns are never scattered on
the arena floor.

| gun | rarity | cost | mag | dmg | what it does |
|---|---|---|---|---|---|
| **THE SIDEARM** | COMMON | free | 12 | 21 | *it was in the drawer. it will do.* Fires every **0.178s**. Evolves every floor — see [[Progression#The evolving sidearm]] |
| **SCAR-L** | COMMON | 20 | 30 | 13 | *reliable. boring. yours.* |
| **MEAT SPLITTER** | COMMON | 30 | 2 | 12 ×9 | shotgun, **45** knockback — *nine reasons to stand still* |
| **THE PRICE GUN** | UNCOMMON | **80** | 40 | 7 | tags things **ON SALE**: everything takes ×1.6 on a marked target |
| **THE STAPLER** | UNCOMMON | 55 | 60 | 8 | nailgun, pins for 0.45s |
| **MICROWAVE** | RARE | 80 | 16 | 34 | plasma orbs, ricochet ×3, burn 16 — *reheats the dead* |
| **FREEZER BURN** | RARE | 95 | 55 | 9 | chills for 2.2s — *the cold aisle, weaponised* |
| **THE HOG** | RARE | 120 | 120 | 10 | minigun, spins up, slows you 45% — *never stops* |
| **THE ROTISSERIE** | EPIC | 165 | 70 | 14 | **fires in a spinning circle** regardless of aim, burn 10 |
| **THE DELI SLICER** | EPIC | 175 | 4 | 64 | a blade that flies out, stalls, and **comes back through everything a second time** — *it comes back. that is the good part and the bad part.* |
| **GOD FINGER** | LEGENDARY | **360** | 6 | 210 | railgun, 0.5s charge, pierces everything — *you point. the room is shorter afterwards.* |
| **THE FISH** | LEGENDARY | **500 coins** | 300 (as fuel) | 720/s | a fish. it opens its mouth and a laser comes out, and the laser cycles colour |
| **THE FLYKILLER** | LEGENDARY | **380** | 24 | 44 | the current **chains** up to five more throats — *the blue light above the deli. it has opinions.* |
| **BLACK FRIDAY** | LEGENDARY | **460** | 5 | 250 | a singularity that **drags the room together** and then goes off in the middle of it — *everything comes to the sale* |

Rarity is the same ladder the [[The Deck#Rarity, and why it matters|cards]]
use, and it's what a gun shines at on the pedestal — `gr` in `WEP`. Full
definitions live in `js/game.js`; `WORDER` is the slot order.

## Every gun above RARE owns a verb

A gun at the top of the ladder has to **do something the rack cannot already
do**, or it is a cheaper gun with a bigger number on it. That is the whole
design rule for the last two rungs, and it is why the tier reads as a set of
choices rather than an order of preference.

| | rung | verb | best into | worst into |
|---|---|---|---|---|
| **THE ROTISSERIE** | EPIC | *sprays* | being surrounded | anything at range |
| **THE DELI SLICER** | EPIC | *returns* | a queue lined up on you | one thing that keeps moving |
| **GOD FINGER** | LEGENDARY | *punches through* | a lane, and bosses | a scattered room |
| **THE FISH** | LEGENDARY | *holds* | anything you can keep the line on | anything that makes you move |
| **THE FLYKILLER** | LEGENDARY | *chains* | a queue | one large thing |
| **BLACK FRIDAY** | LEGENDARY | *gathers* | a scattered room | one large thing |

### Measured, not modelled

Trigger held for 14 seconds into pinned unkillable dummies, Damjan standing
still, no cards. Damage per second:

| gun | rung | one target | a queue of five |
|---|---|---|---|
| THE SIDEARM *(control)* | COMMON | 81 | 81 |
| SCAR-L | COMMON | 87 | 87 |
| THE HOG | RARE | 151 | 164 |
| **THE DELI SLICER** | EPIC | 160 | **805** |
| **GOD FINGER** | LEGENDARY | **270** | **1350** |
| THE FLYKILLER | LEGENDARY | 126 | 423 |
| BLACK FRIDAY | LEGENDARY | — | 357 |

> [!warning] The paper figures for GOD FINGER are wrong, and they are wrong in a
> specific way
> Multiplying `mag × dmg ÷ (mag × (rate + charge) + reload)` gives **154**. The
> real number is **270**. The charge **overlaps the cooldown** when the trigger
> is held — you are not paying 0.5s *and* 0.55s per shot, you are paying 0.55s —
> so any model that adds them understates the gun by 43%. Sample the live game.

BLACK FRIDAY reads as a dash against one target because the rig pins its
dummies in place, and pinning fights the singularity's pull; its real
single-target figure is not measurable this way.

### THE FLYKILLER

`chain: 5, chainR: 132`. On a hit, `chainZap()` walks **outward from the thing
you actually hit** — each link is the nearest enemy the arc has not already
touched — so it snakes through a crowd rather than hitting a disc. It sheds
**a fifth of its bite per hop**, which is what stops five links being five full
shots. A per-cast `seen` list means a chain can never fold back and double-dip.

Draws on `S.arcs`, the same lightning primitive
[[The Deck|BUTCHER'S BILL]] uses.

### BLACK FRIDAY

`sing: { r: 96, pull: 340 }`. The round is a **ghost**: `b.ghost` skips the
enemy-collision block entirely, so it passes through everything and only pays
out where it stops. While it flies it drags every enemy within 96px toward
itself, hardest at the rim and falling off toward the round, so a crowd
collapses into a ball instead of orbiting a point it can never reach.

**It decelerates.** This is the whole trick and it was wrong in the first
version: fired at a constant speed it gathered a crowd on the way past and then
detonated on the far wall, well clear of the crowd it had just built — all of
the setup and none of the payoff. It now coasts to a halt (`×0.22/sec`),
stalls in the middle of what it gathered, and takes a last 0.42s of pull before
it lands. Damage falls to a third at the rim, so the reward for the drag is
that everything is at the centre when it goes.

> [!note] Bosses are pulled at 22%
> Dragging a boss off its own pattern would make BLACK FRIDAY the answer to
> every fight in the game rather than the answer to a crowd, and a boss that
> can be kited into a corner by a 460-coin purchase stops being a boss. They
> take full damage; they just do not come when called.

> [!note] None of the four is on the evolution ladder
> `EVO_TIER` stops at EPIC, so a rung can never offer a LEGENDARY — the rule
> that keeps [[#THE FISH|THE FISH]] a purchase, and that
> [[#GOD FINGER is LEGENDARY now, and it reloads again|GOD FINGER]] now falls
> under too. See [[Economy#What a rung pays out]]. Verified: ten rungs, every
> pool, no grade-4 gun ever offered.
>
> Which is exactly why [[#THE DELI SLICER|the slicer]] exists. GOD FINGER
> leaving EPIC would have left that rung holding one gun, and a pick screen
> with one card on it is not a choice, it is a receipt.

> [!note] Two numbers moved
> **THE SIDEARM** fires 15% slower (`rate` 0.155 → 0.178 — `rate` is the delay
> between shots, so a bigger number is a slower gun). The gun you are given
> free should be the one you are trying to stop needing.
>
> **THE PRICE GUN** went 45 → 80. It does almost no damage itself and then
> multiplies everything else you own by 1.6× on a marked target, which made it
> the strongest coin in the game at the cheapest tier — a floor-1 no-brainer
> rather than a decision.

## The magazine, and why 12

THE SIDEARM carried **18** rounds. Between the mag and the free reload
animation you could clear an early wave without ever being empty, which meant
the reload — a four-stage animation with its own four sounds, and the single
biggest window the game has for punishing you — effectively did not exist for
the first two floors.

**12** is the number where you notice it. It is still a full wave's worth of
kills at floor-1 health, it still leaves the gun usable at MK X, and it makes
CYCLE, HOPPER and QUICK HANDS cards you would actually take rather than cards
about a problem you did not have.

> [!warning] And it opened on 14 rounds in a 12-round magazine for two commits
> `makePlayer()` hardcoded `mags: { pistol: 14 }`, a literal left over from an
> older magazine size. Cutting the pistol to 12 left every run starting with
> two rounds the gun does not have and a HUD reading `14/12`. It reads off the
> weapon now, so it cannot drift again. See
> [[Bugs Found#19. The pistol opened every run on 14 rounds in a 12-round magazine]].

## THE DELI SLICER

The wheel off the deli counter with a handle welded to it, and the only round
in the game that **comes back**.

`blade: { reach: 200, ret: 520, acc: 1500 }`, `pierce: 99`, `life: 3.2`.

### The round trip

| | |
|---|---|
| out | 200px at `spd` 400 — **0.50s** |
| the turn | velocity to **zero**, then accelerate at 1500/s² toward Damjan, capped at 520 |
| home | **~0.55s** from full reach |
| caught | within 11px of the player, and it is gone |

Measured end to end: **1.03s** from muzzle to catch at full reach, and one disc
through a queue of five deals **exactly 2 × 64 to every one of them**.

### Three things happen at the turn, and all three matter

1. **It stops.** Not reverses — stops, hangs, and gathers speed back. Reversing
   the velocity instead reads as a ricochet off an invisible wall, which is a
   completely different and much worse piece of information to give the player.
2. **`hitIds` is emptied.** This is what makes the way home a real second pass
   rather than a victory lap. Everything it cut on the way out is a target
   again.
3. **It stops steering on its own angle and starts steering on Damjan**, every
   frame, for the rest of its life.

`bladeTurn()` is called from three places — reaching its reach, hitting a wall,
and reaching the edge of the arena — because all three mean the same thing:
*that is as far as it goes*.

> [!note] The return ignores walls
> A blade that dies behind a shelf you walked around is not a decision, it is a
> tax on the level geometry. Outbound it turns on a wall; inbound it passes
> through. Verified from six positions including point-blank into all four
> walls and into a corner: **every disc turned and every disc came home.**
> `life: 3.2` is the backstop — one cannot leak even in principle.

> [!tip] It is a gun about where you are standing
> The second pass is aimed at **you**, not at where you threw from. Measured
> standing still it does 160 dps single-target; measured while drifting
> backward under its own recoil, with the target pinned, it did **48**. In real
> play that cuts the other way — enemies chase Damjan, so they are on the
> return line by definition — but back away from a wall you have thrown at and
> you threw half a gun away.

## GOD FINGER is LEGENDARY now, and it reloads again

It used to carry `noReload: 1` — the magazine was not a resource, so
`startReload()` returned immediately and `emit()` skipped the decrement. That
flag is gone from the codebase entirely.

**Why it was there.** The gun already pays for itself twice before a shot
leaves it: a 0.5s charge you hold still through, and a 0.55s floor between
shots. A 2.4-second rack every five shots on top was a *third* tax on the same
decision, and the one that made you stop playing — you spent it standing in the
open having already committed to the fight.

**Why it came back, and cheaper than it left.** Six in the magazine instead of
five, 1.9s to rack instead of 2.4. Measured on a held trigger:

```
mag 6 -> 0 over 3.23s   (a shot every 0.55s)
rack             1.90s
                 -----
cycle            5.13s   — roughly two thirds firing
```

What it costs the gun is **sustained** damage: 300dps standing still before,
**270** now. What it buys is **burst** — 165 → **210** a slug, the biggest
single round in the game after BLACK FRIDAY's, still with `pierce: 99` behind
it. It is no longer the gun that never stops; it is the gun that ends whatever
is in the lane and then needs a second.

The rung follows from that. At EPIC it turned up on **~9%** of PACI's shop
visits; at LEGENDARY it is **2.7%**, and the price went 190 → 360 — the
cheapest of the four legendaries, just under THE FLYKILLER's 380.

> [!note] Two knock-ons, both good
> BOTTOM OF THE BOX (the HOPPER rider — "the last third of a mag hits 35%
> harder") could never fire on GOD FINGER, because the magazine was always
> full. It works now.
>
> The HUD's `NO RELOAD` line is gone with the flag, and the gun draws an
> ordinary six-pip magazine like everything else.

## Knockback

Everything shoves less than it did.

| | was | is |
|---|---|---|
| house default (any gun with no `knock` of its own) | 60 | **38** |
| **MEAT SPLITTER** | 140 | **45** |
| **GOD FINGER** | 200 | **110** |
| self-recoil | tied to `knock` | **decoupled** — 26 shotgun / 22 charge / 10 everything else |

The shotgun was the whole problem. At 140 across nine pellets a single shell
launched a crawler most of a screen, which sounds good and plays badly: it
removed the thing you were shooting from the fight instead of killing it,
scattered packs you were trying to hold together for splash, and shoved enemies
through the door you were standing in.

Decoupling **self**-recoil from the pellet knockback is what let the shotgun
stay a shotgun. It still kicks you backward hard — that is the gun's
personality, and it is a real cost in a room with a boss in it — but the thing
you hit now mostly stays where you hit it.

## THE FISH

It used to be the OMEGA BEAM: a violet line, bought with **50
[[Economy#Cards|cards]]**. It is now a fish, held by the tail, that opens its
mouth and emits a laser, bought with **500 coins**.

### Making it read as a fish

The first pass was a violet rectangle with an eye in it, and nobody was going
to call that a fish. Five things do the work at 16×6 (32×12 baked), and the
order matters:

1. **A forked tail.** The one silhouette feature that says *fish* and nothing
   else. The fist is wrapped round the tail, so the two prongs spread above and
   below the knuckles — which is how you hold a fish you have just picked up.
2. **A caudal peduncle** — the dark pinch between tail and body. Without the
   narrowing, a tail is just more fish.
3. **Fins breaking the outline**, dorsal and pelvic, offset from each other so
   the body does not read as symmetrical.
4. **An eye high on the head**, where a fish keeps it, not centred like a
   cartoon.
5. **An open mouth.** The centre line *alone* reaches the muzzle, with a tooth
   glint behind it — and that single-pixel tip is where the beam comes out.

The taper is what separates the two passes: the body now ends two columns short
on the rows above and below the centre, so the snout juts. Baked silhouette:

```
.............##....####.........
............####..######........
.....         #############.....
....          ##############....
....          ##################
....          ##################
....          ##############....
.....         #############.....
.....     ..#####..######.......
.......    ..##......##.........
```

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
| **floor 4** | FREEZER BURN *(and its contract)* |
| **floor 5** | THE HOG, **THE FISH** |
| **floor 6** | THE ROTISSERIE *(and its contract)* |
| **floor 7** | THE DELI SLICER, **GOD FINGER**, **THE FLYKILLER** |
| **floor 9** | **BLACK FRIDAY** |

So a floor-1 shop offers three things totalling 130 coins against a floor of
roughly 60 coins income: enough to buy one and want the others.

THE FISH is no longer exempt. Cards used to be its gate, so it was appended to
the pool unconditionally; 500 coins and floor 5 are its gate now.

## Two are locked behind contracts

Neither is in `shopStock()`'s pool — or on the
[[Economy#What a rung pays out|evolution ladder]] — until its contract is
signed. `lock` names the contract; both gates read the same field.

| gun | `lock` | contract |
|---|---|---|
| **THE ROTISSERIE** | `'seal'` | **BREAK THE SEAL** — 8 floor bosses |
| **FREEZER BURN** | `'deep'` | **THE DESCENT** — reach floor 8 |

> [!note] FREEZER BURN was unlocked for most of this project
> THE DESCENT's line reads *"FREEZER BURN joins the crate"* and for a long time
> that was decoration: `chill` carried no `lock`, so the contract signed,
> toasted, displayed as signed and changed nothing. Two closes were available —
> add the gate, or rewrite the promise — and the gate won, because a line the
> game says out loud in its own UI outranks a gun's availability on a first run.
> Measured: **0 of 500** shop rolls before the contract, **147** after. See
> [[Bugs Found#25. THE DESCENT's reward did not exist]].
>
> A first run therefore reaches floor 8 without ever seeing it. That is the
> point — it is the reward for the descent, not a stocking item, and the depth
> gate (`floor: 3`) is now a second gate behind the first rather than the only
> one.

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
  releases at full charge. Held down, the charge runs **during** the cooldown,
  which is why its paper DPS is badly wrong — see [[#Measured, not modelled]].
- **THE DELI SLICER** throws a disc and takes it back. It ejects no case (there
  isn't one) and the round is drawn as a turning wheel rather than a tracer,
  because a streak is the wrong read for a thing about to reverse.
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
