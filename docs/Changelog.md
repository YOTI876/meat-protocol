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
5%→20% to compensate; the [[Rendering#GLUSEC banner|GLUSEC banner]]; AEGIS
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
[[Rendering#GLUSEC banner|GLUSEC banner]] moved to the bottom of the screen;
five [[Rendering#Arena layouts|layout archetypes]] instead of one scatter
pass; and [[Progression#Endless floors|generated floors past floor 4]] so the
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
LEGENDARY. [[Groceries#THE COLD ROOM|Signatures left the deck]] for their own
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
**[[Bosses#Two phases|breaks at half health]]** and switches to a second
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

**Two more [[Weapons#The three LEGENDARIES|LEGENDARIES]].** A LEGENDARY has to
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

## Related
- [[Bugs Found]] — the defects behind each fix above, and three still open
- [[Tuning Values]] — where the numbers stand today
