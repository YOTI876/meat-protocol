---
title: Changelog
tags: [reference, history]
---

# Changelog

In order, oldest first. Commit hashes match `git log` on `main`.

## `0b8bef7` — MEAT PROTOCOL: initial build
The whole game in one commit: Damjan, the SCAR-L with a laser sight, four
enemy types, the original four bosses, groceries, ten waves per floor, the
[[Secrets#1. The Eye (god mode)|Eye]] secret, reload animation, grenades, the
original weapon/coin/card economy, [[Cosmetics]], and the
[[Secrets#2. MODAGAZ|MODAGAZ]] corner secret.

## `2aa0f24` — Scale enemy counts hard with wave and floor
Found and fixed a real bug: the spawner was **budget**-based, so as the
budget grew with wave/floor it bought *fewer, tougher* enemies — deeper
floors could field fewer bodies than shallow ones. Replaced with a head-count
formula. See [[Bugs Found#5. The spawner made deeper floors *emptier*|the bug in full]].

## `62d8cb3` — Menu overhaul, visibility pass, and an evolution economy
Split menu text onto a supersampled [[Rendering#Two-canvas split|overlay
canvas]]; added hover-eased buttons; fixed [[Bugs Found#6. Screen shake was vibration, not shake|static screen shake]];
added glowing bullets and the first [[Rendering#Death burst|death burst]];
lifted floor/wall palettes and lightened darkness; cut weapon prices; OMEGA
BEAM 10→18 cards; introduced coin-gated **EVOLVE** (doubling cost) and
**RESET EVOLUTION**; enemy damage +23%, balanced by longer contact cooldown
and i-frames.

## `5b3d107` — Minimap, wave-end collection, two new pickups, fatter waves
Fixed the [[Bugs Found#9. Damjan had a gap through his stomach|sprite seam at Damjan's waist]].
Added the [[Rendering#Minimap|minimap]], [[Pickups#Wave-end collection|wave-end
vacuum]], **AEGIS** and **NOVA** pickups, film grain +20%, and made every
[[Bosses|boss]] summon adds on its own schedule under a shared cap. Contact
damage cut 5%.

## `f5eabdb` — Add a generative score
[[Music]]: the entire five-layer synthesized score, lookahead-scheduled,
keyed per floor. Fixed [[Bugs Found#8. Music could go silent after a fast death/restart|a stop/restart
race]] found while building it.

## `cefbca8` — XP upgrade tree, evolving base rifle, homing nova, nastier score
[[Progression#XP & levels|XP, levels, the level-up popup]]; the base rifle's
per-mark evolution (originally per-wave); [[Pickups#NOVA|homing NOVA
rounds]]; [[Music#The "creepier" pass|three new dread music voices]] and a
shift to all-phrygian/locrian keys; [[Groceries|grocery]] rebalance to make
room for the new power source. Fixed [[Bugs Found#7. Item pickup banner crashed on every frame it was visible|a
banner crash]] before shipping.

## `f09a24b` — Weapon upgrade armory, per-floor rifle marks, longer shield
[[Weapon Upgrades|The Armory]] (CYCLE/SPLIT/POWER per weapon); moved the
rifle's mark cadence from **per-wave to per-floor** and raised its bonus
5%→20% to compensate; the [[Progression#The evolving sidearm|GLUSEC banner]]; AEGIS
shield 2s→3s.

## `8fcfe50` — One typeface everywhere, animated enemies, cleaner pause screen
## `6294742` — Rework the armory upgrade rows, centre the crosshair
Collaborator commits. They added the embedded typeface (`js/font.js` +
`OFL.txt`), moved every enemy onto animated sprite banks, and rebuilt the
[[Weapon Upgrades|armory]] row layout.

## `fe0ffb1` — PACI's shop, endless floors, flat SPLIT, and the docs vault
[[The Shop|PACI's back room]] every third boss, with guns removed from the
arena floor entirely; SPLIT reduced to one flat 100-coin rank on every weapon
and the OMEGA BEAM excluded from upgrades; the
[[Progression#The evolving sidearm|GLUSEC banner]] moved to the bottom of the screen;
five [[Rendering#Arena layouts|layout archetypes]] instead of one scatter
pass; and [[Progression|generated floors past floor 4]] so the
descent has no bottom. Four real defects caught before shipping —
[[Bugs Found#10. Wave 4 started while the shop was still fading in|#10]]
through [[Bugs Found#13. Deep floors overshot the enemy cap|#13]]. This vault
starts here.

## `c6f0a3e` — Detailed sprites at 2x, a shredded Damjan, a shopkeeper with a temper
The [[Rendering#Render scale|render scale]] went to 2× and the whole sprite
bank with it: [[Rendering#The sprite pipeline|EPX upscaling, automatic form
shading, hand-stamped faces, selective outlines and bake-time sub-pixel AA]].
The floor became one `createImageData` pass with ordered dithering. Damjan
[[Rendering#Damage on Damjan|comes apart as he takes damage]] in three stages,
shedding cloth and meat separately. Shoot [[The Shop#Do not shoot him|PACI]]
and he warns you; shoot him again and he throws you out. Also the two-slot
typeface architecture.

## `44555c5` — Rebuild the level-up deck: riders, aisle mastery, off-cuts
The big one. Rarity stopped being a multiplier: every card carries a
[[The Deck#Riders — the reason rarity is a moment|RIDER]] that only switches
on at RARE or better, so a RARE MALICE is a different card rather than a
bigger one. The ladder became plain — COMMON / UNCOMMON / RARE / EPIC /
LEGENDARY. [[Groceries|Signatures left the deck]] for their own
room. [[The Deck#The five aisles|Aisles]] became BLADES / FRESH / FROZEN /
TOOLS / JUNK with perks at 4 and 8 ranks, and ten
[[The Deck#Off-cuts — the fusions|off-cuts]] became the thing to build toward.
38 cards, up from 28. Three defects fixed on the way, including
[[Controls#Menu navigation|the `B` key toggling the deck shut in the same
event it opened it]].

## `9ab0816` — Balance pass, two new enemies, price-tag cards, full-screen fit, VT323
[[Rendering#Fitting the window|fitCanvas]] now fills the limiting axis exactly
instead of snapping to integer multiples. The typeface is
[[Rendering#Typefaces|VT323]], with optical size normalised off measured cap
height. BLOOD DEBT cut 20%→14% and SPLIT's forks dropped to half power. Cards
[[Rendering#Cards look like price tags|are drawn as price tags]]. Two new
[[Enemies#The two late arrivals|enemies]] — the HUSK and the CYST — close the
two degenerate strategies, and join the elite roster as THE HOLLOW MAN and THE
BROODMOTHER.

## `12b6a55` — Panelled deck screen, a way back to the title, and a quieter title
[[Rendering#The deck screen|THE DECK]] is panels instead of two flat columns.
The pause row gains **MAIN MENU**, which is the death path minus the death —
and with two buttons a row apart both called menu, the old THE MENU button
became [[Controls#Two things called a menu|THE DECK]]. The
[[Rendering#The title screen|title screen]] is a poster again: everything
below the buttons is gone.

## `3f2c232` — Ten two-phase bosses, wave-hours PACI, and a slower ladder
A balance pass, top to bottom.

**[[Bosses|Bosses]].** The wave-10 roster went from five to **ten**, so a run
no longer exhausts everything the game has by floor 5. Every one of them now
**[[Bosses#Phases|breaks at half health]]** and switches to a second
pattern — three new ones (`spiral`, `nova`, `rush`) exist purely so a phase
change looks different rather than just harder. The HP band was *flattened*
(1400→3000) on purpose: `bossIndexFor` wraps, so a steep roster ramp only buys
a sawtooth at the wrap. **Elites** carry `8 + floor*2.3` instead of
`5 + floor*1.6` — about 50% more meat — because one good magazine was killing
them.

**[[The Shop|PACI]].** Moved from boss hours to wave hours:
`SHOP_WAVES = [5, 10]`, twice a floor. The old cadence put every purchase on
the way *out* of a floor. Since price alone was no longer a gate at that
frequency, guns gained a **[[Weapons#When PACI starts carrying it|depth gate]]**
and coin income rose to match (16%→19% on kills, 10/18/38→15/26/50 on bosses).

**[[The Deck#SPLIT|SPLIT]].** The card that flattened the deck. One rank
instead of two, **two rounds and no centre shot** instead of `2n+1` with the
centre at full power, ×1.30 total output instead of ×3.00 — and it is now
LEGENDARY, floor-3-gated, and dealt about once in forty hands. `dealCards()`
gained a weighted pool and a `leg` flag to do it.

**[[Progression#XP & levels|Levels]]** slowed to 80/×1.30 from 48/×1.23, with
kills paying 0.42 of score instead of 0.55 — three boss-class kills a floor
already hand out free picks, so the old curve was dealing seven or eight cards
a floor and the hand had stopped being a decision. The **MEAT SPLITTER**'s
knockback dropped 300→140. The wave banner lost its `N SIGNATURES` subtitle.

## `3f2c232` — THE FISH, elites that read your build, and a tighter purse
A second balance pass on top of the one above.

**[[Bosses#They scale to your build, not just to the floor|Elites]] scale to
the run, not just the floor.** `diff()` only knew about depth, so two runs on
floor 6 — one with an off-cut and three guns, one with a pistol — met the same
elite. `powerMul()` sums levels, cards taken, guns, signature levels and
off-cuts (capped ×3.2) and multiplies the elite's HP, with half of it on the
bite.

**Fixing that surfaced a pre-existing inversion.** Elite HP was
`speciesHP × depth`, and the species table spans 26 → 170, so any floor whose
elite slots landed on HUSK/CYST had a **wave-8 elite tankier than the wave-10
boss** — 1.93× on the original build, 9.71× once the build multiplier landed.
Elites are now priced as a share of the floor's own boss
(`ELITE_SHARE = 0.22 × flavour × powerMul`), which makes the ordering true by
construction: 0.21× the boss on a bare floor 1, 0.95× on a maxed floor 30,
never above.

**[[Weapons#THE FISH|THE OMEGA BEAM is now THE FISH]]** — a fish, held by the
tail, that opens its mouth and emits a laser. New sprite; the beam takes a
`prism` flag that walks its three outer layers around the hue wheel at 26°
offsets so it fringes across its width. The core stays white on purpose. It
costs **500 coins** instead of 50 cards, and goes through the same depth gate
as every other gun (floor 5).

**Money is 30% slower.** `COIN_RATE = 0.70`, applied once inside `coinMul` so
it catches every source including boss piles. Measured at 0.12 coins a kill.
**THE PRICE GUN** 45 → 80, and **THE SIDEARM** fires 15% slower (0.155 →
0.178).

> [!warning] Cards no longer buy anything
> The beam was their only sink. See [[Economy#Cards]].

## `9124da9` — EVOLVE becomes a roster, and moves to the pause screen
[[Economy#Evolution|EVOLVE]] was a title-screen button that bought a
difficulty number. It is now a ten-rung ladder that pays out a **permanent
arsenal**, and it lives on the pause screen because pressing it **restarts the
run**.

**Where it lives.** Off the title and death screens entirely; both are now
three same-sized buttons on one centred row. The old second row was centred on
a different axis depending on whether you had evolved, so it physically shifted
under the cursor between visits. EVOLVE on the title was a lever with no
visible price and nothing to lose by pulling it; on pause the run and the
wallet are both on screen, and a line under the row says exactly what the
button wants and what it will do.

**What a rung pays.** One gun, kept in every run forever, drawn from the
rarity that rung opened — two rungs a tier, COMMON up to EPIC. **THE FISH is
never offered at any rung**: the LEGENDARY tier is the long game the coin
economy has left
and handing it out for evolving would retire it. Once the roster holds one gun
of every rarity there is nothing left in the crate, so the rungs above deal
**three cards at LEGENDARY** and you start every run holding the one you took.
A tier down to its last gun opens the tier above it, because a pick screen with
one card on it is a receipt, not a choice.

**The ceiling and the curve.** `EVO_MAX = 10`, and the cost stopped doubling:
`150 + 175*evo + 25*evo²` — 150 up to 3750, **16,500 for the whole ladder**.
Doubling is the right shape for something unbounded and the wrong one for
something that ends; rung 10 would have wanted 51,200 coins.

**RESET EVOLUTION** moved to pause too and now empties the roster and the
starting hand as well as the level, then restarts the run — you cannot keep
holding guns you no longer own.

**The world got heavier to match.** `diff()`'s evolution terms went
`0.38/0.26/0.05` → **`0.46/0.30/0.06`**, and spawn count `0.12` → `0.15`. A
floor-1 CRAWLER carries 26 HP at EVO 0 and **146 at EVO 10**, hitting 4× as
hard. Elites needed no new term: `powerMul()` already counts guns held and
cards in the deck, so the roster prices them up by itself.

**The pause arsenal is divided by rarity** — one row per rung, guns laid along
it, with `EVO` rather than `OWNED` on anything you keep. It used to be a flat
run of eleven names down two columns ordered by `WORDER`, which is draw order
rather than a hierarchy. Rows rather than columns for a second reason: stacked
groups cost a header each, and the worst case — five signatures and THE THIRD
EYE above them — pushed the tallest column straight through the wallet strip.

## `9124da9` — An empty floor, two more legendaries, and a fish that looks like one

**The floor could come up empty, and EVOLVE made it easy.** Reported as *"there
are no enemies when I evolve"*. Wave 1 was started by a wall-clock `setTimeout`
that fired exactly once and was thrown away if you were on a menu when it
landed — so opening pause, THE DECK or a level-up hand inside the opening 2.2
seconds killed the floor permanently: no enemies, so no kills, so no drops and
no coins. EVOLVE drops you into a new run *straight off a menu* holding a gun
you want to look at, which is why it surfaced there. Replaced with `S.introT`,
counted in `update()`, which only ticks in play — a menu now **pauses** the
opening beat instead of consuming it, and `freshState()` clears it so an
abandoned run can no longer leave an orphaned timer pointing at the new one.
Full write-up:
[[Bugs Found#14. A menu inside the first 2.2 seconds killed the floor permanently|Bugs Found #14]].

**Two more [[Weapons#Every gun above RARE owns a verb|LEGENDARIES]].** A LEGENDARY has to
do something the rack cannot already do or it is an EPIC that costs more, so
each owns a verb: **THE FLYKILLER** (380, floor 7) *chains* — the current walks
outward from the thing you hit, five links, shedding a fifth of its bite a hop.
**BLACK FRIDAY** (460, floor 9) *gathers* — a ghost round that passes through
everything, drags the room toward itself, **decelerates**, and goes off in the
middle of what it collected. Neither out-damages GOD FINGER single-target; both
are the answer to a crowd. Neither is on the evolution ladder — `EVO_TIER` stops
at EPIC.

> [!note] BLACK FRIDAY's deceleration is the whole gun
> The first version flew at a constant speed, gathered a crowd on the way past,
> and detonated on the far wall — all of the setup and none of the payoff.
> Measured at **0 damage** against eight dummies it had just dragged together.
> Coasting to a halt puts it in the middle of them: **1342**.

**[[Weapons#Making it read as a fish|THE FISH looks like a fish]].** It was a
violet rectangle with an eye in it. Now: a forked tail spreading above and below
the fist that holds it, a caudal peduncle, offset dorsal and pelvic fins, an eye
high on the head, and a tapered snout where the centre line alone reaches the
muzzle — which is where the beam comes out.

## `d0beda0` — Catch the vault up
Docs only. Real commit hashes against `git log`, corrected counts, and the
EVOLVE pick screen written up.

## `9551e17` — Ten floors that end, ten boss kits, and no groceries

The largest single change since the initial build: **+2,176 / −457** in
`js/game.js`.

### The descent has a bottom now

**Ten authored [[Floors|floors]]**, and `roomDef()` clamps rather than
generating. The four hand-built rooms and the hue-wheel generator past them are
gone. Every floor carries its own palette, arena, layout, prop set, wall
treatment and **rule**:

| act | floors | |
|---|---|---|
| *it is only a building* | THE ABATTOIR, THE HOLLOW, THE MEAT LOOP | — · `dark` · `slick` |
| *it starts taking an interest* | THE RED KITCHEN, THE FREEZER, THE RENDERING | `heat` · `frost` · `swarm` |
| *it stops pretending* | THE LONG TABLE, THE SALT LINE, THE LAST AISLE, THE KILLING FLOOR | `blackout` · `frail` · `hunt` · the finale |

Every [[Floors#Twists|twist]] had to pass one rule: **a tell, a rhythm, or a
trade**. A twist that only subtracts is difficulty, not design. `slick` gives
the dash back as a brake; the burners warn for 1.1s and never light within 90px
of you; `frost` slows the enemies with you; `swarm` trades 1.5× the count for
0.7× the health; the blackout dims for three full seconds first.

An endless descent had no act structure, no finale, and no way for a run to end
well. This one can be beaten.

### The roster is shuffled, and that took a rewrite

**HP left the boss entries.** `BOSS_HP[]` is indexed by *floor*; `bulk`
(0.92–1.12) is all that identity still contributes. Without that, shuffling the
roster puts a 3000-HP boss on floor 1 — the identity and the difficulty were
the same number. One function, `bossBudget(floor)`, now answers "how much boss
is this floor worth" for **both** `spawnBoss` and `spawnMini`.

**Every boss has a kit**, an opening pattern and a different one it breaks
into, and no two share a pair. Six new patterns, each asking a different
question of the room: `hook` drags you back in when you kite; `brood` seeds the
room and makes you choose between the boss and what it hatched; `mortar` walks
a three-shell volley across where you are *going*; `curtain` turns the arena
into a corridor with one moving door; `sweep` turns an unblockable beam;
`mines` spends the floor you have already crossed. Backed by a new `S.haz`
layer — marks, mines and anchored beams — drawn in two passes.

### THE MEAT PROTOCOL

Floor 10, wave 10, **4200 HP**, three phases, and none of them reuse a roster
pattern. p1 holds the centre and denies the ring, so you play at range. p2
hunts at 118 px/s and mortars where you are running *to*, so range stops
working. p3 plants and turns two beams 180° apart while a spiral fills in
behind them — one safe wedge, always moving, and no rest beat in the pattern at
all.

It **never summons in p3**. Adds during a bullet-hell phase is how you make a
finale unreadable rather than hard.

Killing it ends the run into a proper [[Rendering#The win screen|win screen]]
and signs **CLOSING TIME**.

### The groceries are gone

`ITEMS`, `SIG_MAX`, THE COLD ROOM and all five signatures are deleted. Two came
back as cards you build toward — **THE OTHER HAND** (the GLOCK-18) and
**IGNITION** (the bicycle). THE FULL MENU, a contract that could no longer be
signed promising a reward already removed, became CLOSING TIME. Full reasoning
in [[Groceries]].

### Numbers

- **THE SIDEARM** 18 → **12** rounds. The reload is the biggest window the game
  has and it effectively did not exist for two floors.
- **OVERKILL** 18 → **10** a rank, radius 42 → 30, and **no screen shake at
  all**. A full shake on every kill meant the camera never settled all run.
- **FLASHPOINT** a nova every 12 kills → every **65** (48 at rank 2). A nova
  that clears twelve things earns the next nova; it was a loop with no exit.
- **WINDFALL** loot-from-anywhere → reach **190**.
- **Knockback**: house default 60 → **38**, MEAT SPLITTER 140 → **45**, GOD
  FINGER 200 → **110**, and self-recoil decoupled so the shotgun still kicks
  *you*.
- **THE ORDER** gained a **third rung at 14** — a named state per aisle, not
  another percentage.
- The [[The Shop#Weighted by rarity, not uniform|shop]] fills every pedestal
  every visit, weighted `100/52/24/9/2.5`, dropping the depth gate before the
  contract or ownership gate if the pool is short.

### The look

Twenty [[Floors#Props|prop kinds]] on a shared `box()` helper, four or five per
floor, six of them putting real light into the room. Five wall treatments
instead of one brick. The [[Rendering#Effects|effects layer]] rewritten around
directional velocity-stroked sparks, eased rings with a hot leading edge, a
rotated muzzle star, and `explode(..., quiet)` — which is what lets a card stop
shaking the screen without becoming invisible. Everything capped: 900 particles,
420 gibs, 80 rings.

The GLUSEC banner is gone, replaced by a short mark on the weapon readout.

### Found on the way

Four defects, all caught numerically because screenshots don't work in this
harness: [[Bugs Found#15. Every elite in the game spawned with a NaN health bar|NaN
elite health]], [[Bugs Found#16. The level-up screen swallowed the ending|the
level-up screen swallowing the ending]],
[[Bugs Found#17. `pillars` floors furnished themselves from two props|two-prop
pillars floors]], and
[[Bugs Found#18. `drawDeck` threw the instant the deck screen opened|a dangling
reference that broke the deck screen]].

## `0210224` — Rebuild Damjan, and a rung every four cards

**[[Rendering#What he is|Damjan was a mascot]].** His
head was **22 of his 32 rows** — two thirds of the whole sprite — sitting
straight on a flat green rectangle with no neck, no shoulders and no arms,
wearing a knotted bandana with a tail. Head to 14 rows, a neck, a real shoulder
line, arms separated from the torso by a one-pixel shadow gap, a bone-white
butcher's apron as the one big shape, and hair with actual direction and two
tones instead of a flat brown dome.

The headband went with the rest of it: `r`/`R`/`w` are a **neckerchief** now,
so all six [[Cosmetics]] still repaint. They lost the word BAND from their
names, kept their ids, and the two that repaint the coat now repaint the apron
as well.

> [!note] The moustache
> A 4px nose base stacked over a 6px mouth reads as a moustache at sixteen
> pixels tall. Two rules out of it, both general:
> [[Bugs Found#21. A moustache, from two bars of similar width|never stack bars
> of similar width, and a mouth is a short line]].

**[[The Deck#The five aisles|THE ORDER is 4 / 8 / 12]]** — a rung every four
cards, three times. It was 4 / 8 / 14, and 14 is unlearnable: not a multiple of
anything, no sensible bar to draw toward it. Every surface states the cadence
now instead of listing numbers, which also retired a strip that
[[Rendering#THE ORDER strip|claimed an aisle was finished at 8]] while a whole
rung sat above it.

**[[Rendering#The foot: two numbers, and it must be obvious which is which|The
card foot]]** was the aisle's name next to pips that counted the *card's*
ranks — two scopes touching, one of them labelled. Two labelled numbers now.

**GOD FINGER never reloads**, and
**[[The Deck#The two legendary cards|THE OTHER HAND is LEGENDARY-only]]** —
measured 121 appearances over 4,000 hands, all 121 at LEGENDARY.

Fixed on the way:
[[Bugs Found#19. The pistol opened every run on 14 rounds in a 12-round magazine|every
run opened on 14 rounds in a 12-round magazine]].

## `1541835` — Ten floor surfaces, an 8× faster bake, and a run clock

**The [[Rendering#It used to be one enormous pixel loop, and that was the lag|floor
bake was the lag]].** Reported as *"it lags rarely sometimes"*, and profiling
first ruled out everything else: steady play is **1.3ms a frame at the enemy
cap** against a 16.7ms budget, the heap is flat at 5–7MB, the sprite cache
creates 29 canvases for a whole run, and enemy cost scales linearly.

`buildRoom()` resolved every device pixel of the arena in JS at a flat ~32
nanoseconds each — 4.75 million of them on floor 9 — then drew grout with
19,000 `fillRect`s and spills with 55,000 more. Now it bakes an **atlas of 12
tile variants** once, bakes the grout into them, pre-renders six spill blobs,
and blits.

| | before | after |
|---|---|---|
| worst floor | 234 ms | **31 ms** |
| whole run | 1,791 ms | **220 ms** |
| dropped frames | 107 | **13** |

**8.1×**, measured old against new on the same machine with the GPU pipeline
drained and the drain's overhead subtracted — raw timings under-report a bake,
because `drawImage` calls queue and land on whatever later call forces a flush.

**[[Floors#Surfaces|Ten surfaces]].** The palettes already differed; the
pattern did not, so every room was the same tile grid with the lights changed.
Glazed tile, a grate, riveted tread plate, staggered quarry tile, cracked ice,
poured sludge, floorboards, crusted salt, supermarket lino, and a stained drain
slab — plus room-scale drainage channels and a sump that a repeating tile
cannot express.

**[[Rendering#The run clock|A run clock]]**, `MM:SS` under the score, on both
terminal screens. It counts below the mode guard in `update()`, which is the
load-bearing detail —
[[Bugs Found#20. The run clock ran while you were reading a menu|above it, the
clock ran while you were on menus]].

**[[Rendering#The death screen|The death screen says less]].** Two lines went
from between the stats and the buttons; you have just died and the screen was
answering with a paragraph. That also retired *"every contract signed. there is
still no bottom."*, written for a descent that has had a bottom since
`9551e17`.

## `ef87bcd` — Give Damjan a face, a shirt, and no hardware
Three passes on the character, each fixing something the last one broke. All
of it is recorded in [[Rendering#What he is|Rendering]], because each one is a
general lesson about drawing at this density and not a fact about this sprite.

**The head was a ball.** A full bandage solved a real problem — a face at
sixteen pixels is brutally hard — by deleting the one part of a character
people actually look for. *A pale oval with two slits in it is an oval.* The
bandage covers **one eye** now, and the other half of him is hair, a brow, an
eye, a nose, a mouth and three days of stubble.

**The red read as a cape.** The apron filled the entire torso with the shirt
showing only as a thin strip down each outside edge, and red framing a pale
front is a cape silhouette. The chest is shirt edge-to-edge for six rows before
the apron starts, with the straps crossing it and meeting the bib at its own
edges.

**The rail and hook read as a cyborg.** Hardware attached to a person reads as
equipment however bloody you draw it. Both gone; he has two hands. What is left
is a man, and the horror is what is *on* him rather than what has replaced him
— which costs him the thing that broke his outline, so both reads now come from
value alone.

Also: the damage tears were re-aimed after the apron moved, having started to
land on his sleeves; [[Cosmetics#Three rules the set is built on|BONE MASK]]
now bleaches a real face into a skull, which it could not do when there was no
face; and LIVING FLAME stopped referring to a kerchief he had not worn for two
designs. **The four-frame walk cycle was never touched.**

## `5d7f2e7` — Damjan holds the gun
The arms came off the sprite. A drawn arm hangs where it was drawn, so a baked
sleeve left the gun floating in front of a man standing to attention; they are
struck every frame from a shoulder joint to wherever his hands are, so they
track the aim, the reload dip, the mag change and the recoil for nothing.

They are **plotted as pixels, not stroked**. The first pass used canvas strokes,
which was wrong twice: a stroke is anti-aliased and lands wherever the maths
puts it, so it read as rubber tubing on pixel art — and a round cap fat enough
to be a shoulder buried the gun. Measured, **48% of the weapon was covered at
the worst angle**. Now: pixel limb a third the width, and the forearm goes
*under* the gun with only the HAND over it, because a forearm runs the length of
a barrel. Worst case **18%**, average 12%, and every forward hand still touches
gun pixels at every angle.

## `5492ac7` — Ease the middle floors
Difficulty was a straight line, and a line is cruellest early: floor 3 arrived
at 3.5× health in one 56% step, landing where the player's own power stalls.
Replaced with a gentle quadratic — **floor 10 is deliberately unchanged** at
12.3× / 7.5×, and the middle drops ~18% at floor 3 tapering to nothing by 10.
THE MEAT LOOP's grip eased 0.30 → 0.12: at 0.30 the floor was not asking you to
plan your stops, it was refusing the input.

## `79c4e0f` — Deep floors get their own enemies and loot
[[Enemies]] stopped growing after floor 3 and the drop table was identical on
floor 1 and floor 10. Three new enemies gated on **floor** — TROLLEY (4, plated
front, 22% damage head-on), SPITTER (6, will not close, leads your velocity),
SHEPHERD (8, never touches you, buffs everything near it) — each closing a way
of playing that had stopped costing anything. Four new drops at floors 4/5/6/8,
none of them a bigger version of something you had.

> [!warning] The band that ate the other bands
> The first version put the new drops **above** nova and shield in the `else if`
> chain, which gives the earlier test the whole overlap. Nova went to **zero**
> and shield from 3.5% to 0.4%. Found by sampling the live table rather than
> reading the code. The band is carved out of **coin** and sits below them now.

## `2a65698` — Screen motion off, and the real stutter fixed
`shake()` and `punch()` are no-ops behind one flag. **But shake was never the
lag** — a shake is one translate. The stutter on a piercing shot was the death
burst: one kill is ~65 particles, and eight kills on the same frame fired eight
full bursts, 520 objects at once. Bursts now get cheaper the more of them share
a frame. A single kill is byte-identical; eight go 520 → **241**.

## `3ff3cca` `c5234f4` — Five waves a floor
A floor is five waves, not ten: fight, ELITE, fight + PACI, ELITE, BOSS + PACI.
Nothing is hard-coded to five — everything goes through a `WAVES` constant and
anything phrased as a fraction of a floor is `S.wave / WAVES`.

Every per-wave coefficient doubled so the value at the **end** of a floor is
unchanged while the climb is twice as steep. Every wave gate halved — the mix
opened bloaters at `n >= 6`, which can never fire on a five-wave floor, so
floor 1 would have had none at all. Counts retuned against measured old totals:
a consistent **70–74%** per floor, 6,306 bodies a run against 8,829.

**So rewards are up 1.4×**, and this is the part that would have been missed: a
floor is 29% fewer bodies but `diff()` is keyed to the floor, not the wave, so
floor 5 is exactly as hard as it was. Leaving per-kill values alone would have
meant arriving with 71% of the levels, cards and coins — a harder game, not a
shorter one.

> [!bug] Three hard-coded tens survived the first sweep
> The door opened on `S.wave >= 10`, so **the floor never ended**; the HUD read
> `n/10`; and the progress row drew **ten ticks**. The door one is the worst,
> because I called it verified — my check went through the boss wave, where
> PACI's shop opens a door of its own, and I confirmed the symptom I wanted to
> see instead of the mechanism.

## `cad2d97` `007710a` — Every boss gets its own body
Ten bosses shared **two** sprite banks and told themselves apart with a colour
wash. A tint is not a design: at twenty-six pixels across, colour is the first
thing a dark room takes away. All ten are now authored from their own
silhouette, and none carries a tint — see [[Bosses#The look of them]].

[[Bosses#THE MEAT PROTOCOL|The finale]] is **three creatures**: one sprite bank
per phase, swapped by `enterPhase`, at 32 pixels wide against the roster's 26.
CLOSED, then OPEN, then APPETITE — and the last is the *smallest by mass*,
which is what makes it read as escalation rather than as something running out.

## `754a366` — The halo came off the pickups
Every drop sat inside a 13px additive disc of its own colour. The glow was
bigger than the item, so what you read across a room was a coloured blob and
the sprite was the thing you could see least. Gone — and every drop now opens a
**lightmap** hole instead, because that halo was also the only reason a medkit
was findable on THE DARK ROOM and THE BLACKOUT.

## `886cf09` — The wave bar, and the vault
The [[How A Run Goes|five-wave change]] left three hard-coded tens behind; the
last of them drew **ten ticks** in the HUD progress row. It sizes off `WAVES`
now. The door was checked properly this time — placed inside the trigger box on
the last wave, `S.room` goes 0 → 1 — and nineteen wave-count corrections went
through the vault.

## GOD FINGER moves up a rung, and THE DELI SLICER fills the seat
**[[Weapons#GOD FINGER is LEGENDARY now, and it reloads again|GOD FINGER is
LEGENDARY]]** and it reloads again. `noReload` is gone from the codebase
entirely; the flag existed because a 2.4s rack every five shots was a *third*
tax on a gun already paying a 0.5s charge and a 0.55s floor between shots. It
came back cheaper than it left — six in the magazine, 1.9s to rack — for a
measured 5.13s cycle that is two thirds firing.

The trade is **sustained damage for burst**: 300dps standing still before, 270
now, against 165 → **210 a slug** with `pierce: 99` still behind it. Price 190
→ 360, and the rung halved how often PACI carries it (≈9% of visits at EPIC,
2.7% at LEGENDARY).

> [!warning] The paper DPS for a charge weapon is wrong by 43%
> `mag × dmg ÷ (mag × (rate + charge) + reload)` gives 154 for GOD FINGER. The
> real figure is 270, because a held trigger charges **during** the cooldown —
> you pay 0.55s a shot, not 0.55 + 0.5. Every number in this entry was sampled
> off the running game instead. See [[Weapons#Measured, not modelled]].

**[[Weapons#THE DELI SLICER|THE DELI SLICER]]** (175, floor 7) is the new EPIC,
and it exists for a structural reason as much as a thematic one: promoting GOD
FINGER took it off the [[Economy#What a rung pays out|evolution ladder]], and
EPIC would otherwise have been a rung holding one gun — which is not a choice,
it is a receipt.

It owns the one verb nothing else had: it **returns**. The disc flies 200px,
**stalls** — velocity to zero, then accelerates home at 1500/s² capped at 520 —
empties its hit list, and comes back through everything a second time, homing
on *Damjan* rather than on where he threw from. Measured: 1.03s round trip, and
one disc through a queue of five deals exactly 2 × 64 to every one of them.

That makes it the exact middle of its tier. THE ROTISSERIE is damage you cannot
aim; GOD FINGER is damage that lands the instant you release; the slicer is
damage you aim perfectly and then have to wait for — and wait for *where you
are standing*. Standing still it measures 160dps single-target and **805 into a
queue**. Backing away from a wall you have thrown at, it measured **48**.

> [!note] Three things happen at the turn and all three matter
> It **stops** rather than reversing (a reversal reads as a ricochet off an
> invisible wall, which is a completely different piece of information); it
> **clears `hitIds`**, which is what makes the way home a second pass rather
> than a victory lap; and it starts steering on the player. `bladeTurn()` is
> called from reaching its reach, hitting a wall, and reaching the edge of the
> arena, because all three mean *that is as far as it goes*.
>
> Coming home it ignores walls. A blade that dies behind a shelf you walked
> around is not a decision, it is a tax on the level geometry.

The silhouette is the point of the sprite. Every other gun in the rack is a
long rectangle pointing +X, told apart by *colour* — and colour is the first
thing a dim floor takes away. This one is a **circle**: a bright rim, a duller
steel face, and a two-pixel brass hub, because a disc with a centre spins and a
disc without one is a coin. The teeth are drawn on the projectile instead,
where the wheel is six times the size and actually turning.

Two new voices in [[Audio#The slicer's two sounds|audio.js]] — `slicer()`
sweeps **upward** because the wheel is speeding up as it leaves, and
`sliceHome()` is the only sound in the game for a round *arriving*. It ejects
no case, which it used to do anyway.

## Instrumentation: an F3 probe and a deterministic soak harness
Measurement only — no gameplay number moves. See [[Instrumentation]].

**F3** draws a live panel on the overlay: frame avg/p95/p99 over a rolling 3s
window plus worst-ever, update vs draw with draw split six ways, entities and
cracks against the live cap, every pool against its ceiling, `S.fx` depth, and
the sprite cache size. It draws **last**, after the fade and after every modal
screen, because `uiWipe()` would otherwise erase it exactly when you paused to
read it. Cost, measured: 11 `performance.now()` calls a frame, ~6us, 0.036% of
the budget.

**`MEAT.soak({floor, wave, seconds, seed, mode})`** steps `frame()` at a fixed
1/60 and returns counts and timings sampled at 3/10/20/30s. `mode: 'fill'`
reproduces the scenario [[Difficulty Scaling]]'s tables were taken under;
`mode: 'kill'` holds the trigger on the nearest enemy, which is the scenario the
lag complaint is actually about.

> [!warning] Two limits on the numbers, both measured rather than assumed
> `performance.now()` is quantized to **100us** here (the page is not
> cross-origin isolated), so a windowed average is meaningful and a single
> frame's phase split is noise. And wall-clock brackets under-report canvas work
> for the same reason [[Rendering#It used to be one enormous pixel loop, and that was the lag|the floor bake did]];
> `PROBE.drain` (F4) trades pacing for attribution.

**Determinism took four goes**, and the first three are worth keeping:
frame 0 inherited `last` from whatever ran before, so its `dt` was anywhere in
`[0, 0.05]`; setup left the RNG at an unpredictable stream position, so
`startWave()` built a *different wave* each run; and the fingerprint hashed
`queue.length` instead of the queue's contents, which is what hid the second one.
`soakDiff()` now reports the first divergent frame field by field, and `soak()`
runs twice and returns the verified second.

> [!bug] It found something on its first real run
> A 30s `kill` soak reported `part: "1203/900"` — a pool 34% past its own
> ceiling. `updateParticles()` runs on `dead` and `win` but not on any other
> non-play mode, and it holds both the expiry loop **and** all three pool caps.
> Two particle spawners live in the draw path, which runs under every screen. So
> a level-up hand grows the pool at **~43/s, linear, forever**. Logged as
> [[Bugs Found#D. The pool caps do not run while a menu is open|open defect D]],
> not fixed.

## Related
- [[Bugs Found]] — the defects behind each fix above, and two still open
- [[Tuning Values]] — where the numbers stand today
- [[Floors]] — the ten of them in full
