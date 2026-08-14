---
title: Weapons
tags: [reference, systems]
---

# Weapons

Thirteen guns. Damjan starts with **THE SIDEARM** and nothing else — everything
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
| **GOD FINGER** | EPIC | 190 | 5 | 165 | railgun, 0.5s charge, pierces everything, **never reloads** |
| **THE FISH** | LEGENDARY | **500 coins** | 300 (as fuel) | 720/s | a fish. it opens its mouth and a laser comes out, and the laser cycles colour |
| **THE FLYKILLER** | LEGENDARY | **380** | 24 | 44 | the current **chains** up to five more throats — *the blue light above the deli. it has opinions.* |
| **BLACK FRIDAY** | LEGENDARY | **460** | 5 | 250 | a singularity that **drags the room together** and then goes off in the middle of it — *everything comes to the sale* |

Rarity is the same ladder the [[The Deck#Rarity, and why it matters|cards]]
use, and it's what a gun shines at on the pedestal — `gr` in `WEP`. Full
definitions live in `js/game.js`; `WORDER` is the slot order.

## The three LEGENDARIES

A LEGENDARY has to **do something the rack cannot already do**, or it is an
EPIC that costs more. Each one owns a verb nothing else has, and none of them
is simply the biggest number in its column — GOD FINGER still out-damages both
of the new ones against a single target.

| | verb | best into | worst into |
|---|---|---|---|
| **THE FISH** | *holds* | anything you can keep the line on | anything that makes you move |
| **THE FLYKILLER** | *chains* | a queue | one large thing |
| **BLACK FRIDAY** | *gathers* | a scattered room | one large thing |

Measured against eight packed dummies, one trigger pull each:

| gun | targets hit | damage dealt |
|---|---|---|
| SCAR-L *(control)* | 1 / 8 | 13 |
| GOD FINGER | 1 / 8 | 165 |
| **THE FLYKILLER** | **6 / 8** | 162 |
| **BLACK FRIDAY** | **8 / 8** | **1342** |

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

> [!note] Neither is on the evolution ladder
> `EVO_TIER` stops at EPIC, so a rung can never offer a LEGENDARY — same rule
> that keeps [[#THE FISH|THE FISH]] a purchase. See
> [[Economy#What a rung pays out]]. Verified: ten rungs, every pool, no grade-4
> gun ever offered.

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

## GOD FINGER does not reload

`noReload: 1`. The magazine is not a resource: it does not deplete, so it
cannot run out and there is nothing to rack. `startReload()` returns
immediately and `emit()` skips the decrement.

The gun already pays for itself **twice** before a shot leaves it — a 0.5s
charge you have to hold still through, and a 0.55s floor between shots. A
2.4-second reload every five shots on top was a third tax on the same decision,
and the one that made you stop playing: you spent it standing in the open
having already committed to the fight. A charge weapon's rhythm should be
charge / release / charge, and now it is.

**Rate of fire is unchanged, so damage per second is untouched.** The HUD says
`NO RELOAD` in the gun's colour instead of drawing a pip row that never empties
— a full bar that never moves is a bar you learn to stop reading.

One knock-on: BOTTOM OF THE BOX (the HOPPER rider, "the last third of a mag
hits 35% harder") can never fire on GOD FINGER, because the magazine is always
full. That is coherent rather than a gap — no mag, no dregs.

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
| **floor 4** | FREEZER BURN |
| **floor 5** | THE HOG, **THE FISH** |
| **floor 6** | THE ROTISSERIE *(and its contract)* |
| **floor 7** | GOD FINGER, **THE FLYKILLER** |
| **floor 9** | **BLACK FRIDAY** |

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
> thing holding FREEZER BURN back. It is the **last** contract with a promise
> it doesn't keep — THE FULL MENU, which had the same failure mode, was
> [[Contracts#CLOSING TIME replaced THE FULL MENU|replaced outright]]. See
> [[Bugs Found#C. THE DESCENT's reward has no reward]].

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
