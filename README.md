# MEAT PROTOCOL

Top-down pixel-art horror wave shooter. You are Damjan. You have a headband, a
pistol that was in the drawer, and a shopping problem.

Ten waves a floor, two elites and a two-phase boss on the way through, PACI at
half time and again at the end.

**Ten floors, and then it ends.** Every one has its own look, its own props and
its own rule, the boss roster is shuffled every run, and the tenth floor has
something on it with three phases.

## Run it

```bash
node serve.js
```

Then open http://localhost:8123. It works over `file://` too — no build step,
no dependencies — but fonts in `fonts/` won't load that way.

## Controls

| key | does |
| --- | --- |
| WASD / arrows | move |
| mouse | aim (the laser dot shows exactly where the bullet lands) |
| left click | fire |
| right click | throw a frag |
| mouse wheel / 1-0 / Q | swap weapon |
| **E** | buy from a pedestal, or talk to TOMCE |
| R | reload |
| SHIFT / SPACE | dash (i-frames) |
| **B** | THE DECK — everything you're holding |
| C | cosmetics |
| ESC / P | pause — and where EVOLVE lives |
| M | mute |

## How a run goes

Ten waves per floor. **Elites** on waves 4 and 8, the **floor boss** on wave
10. On floor 5 that boss comes up as an **APEX** instead, at 2.6× health and
1.45× damage — there's exactly one a run.

**Every floor boss has two phases.** At half health it breaks: rears up, throws
the room off itself, and comes back faster, angrier, and doing something else
entirely — a boss that does one thing for its whole bar is a health sponge.

**Every boss has its own kit.** THE BUTCHER throws a hook and drags you back in
if you try to kite. MOTHER OF MELONS won't fight you at all — she backs off and
seeds the room, and the seeds hatch. THE HOGFATHER walks a three-shell volley
across where you're *going*. THE PITCHER fires a wall of shot with one moving
hole in it. THE FISHWIFE turns a beam. THE NIGHT SHELF mines the floor behind
itself so the room shrinks as the fight goes on.

**Which boss lands on which floor is rolled per run.** Nine of the ten, shuffled
— so the one you never meet is different every time too.

Every boss-class kill hands you a card. Only the floor boss opens the top of
the deck.

**PACI turns up twice a floor** — after wave 5 and again after wave 10. Clear
wave 10, spend what's left, and the north door opens. The next floor has
stronger enemies but you keep everything.

## The ten floors

| | | its rule |
| --- | --- | --- |
| 1 | THE ABATTOIR | — you have enough to learn already |
| 2 | THE HOLLOW | the light does not reach |
| 3 | THE MEAT LOOP | the floor is greased — dash to stop |
| 4 | THE RED KITCHEN | the burners are still on |
| 5 | THE FREEZER | the cold comes in waves, and it slows them too |
| 6 | THE RENDERING | more of them. less of each. |
| 7 | THE LONG TABLE | the lights go out on a count |
| 8 | THE SALT LINE | everything cuts deeper — including you |
| 9 | THE LAST AISLE | three elites instead of two |
| 10 | THE KILLING FLOOR | it has been waiting the whole time |

Each floor has its own palette, its own arena, one of five layouts, one of five
wall treatments, and its own set of props — braziers and long tables on floor
7, salt piles and bones on floor 8, tills and shelving on floor 9.

## The last floor

Floor 10, wave 10: **THE MEAT PROTOCOL**, and it has three phases that are
three different fights. It holds the centre and denies the ring, so you play at
range. Then it comes off the middle and *hunts*, mortaring where you're running
to — so range stops working. Then it plants and opens two beams turning in
opposite arcs with a spiral filling in behind them, and there's exactly one
safe wedge, and it's moving.

Put it down and you've won. There's a screen for it.

## THE MENU

Level up and you're dealt a hand of cards. **39 of them**, across five aisles.

**Rarity is not a multiplier.** Every card carries a **RIDER** — a second,
qualitative effect that only switches on if you take that card at **RARE or
better**. A RARE MALICE isn't 1.75 MALICEs, it's a different card: *every 6th
shot always crits*. That's the whole reason to care what comes up.

```
COMMON · UNCOMMON · RARE · EPIC · LEGENDARY
```

**Aisles commit back.** One rung every four cards you take from an aisle, three
times — a standing perk, then a louder one, then an identity:

| aisle | is | at 4 | at 8 | at 12 |
| --- | --- | --- | --- | --- |
| **BLADES** | hurting things | +12% damage | crits cleave everything behind the target | **THE RED WORK** |
| **FRESH** | health and speed | +20 max health | clearing a wave heals a quarter back | **IN SEASON** |
| **FROZEN** | armour and slowing | −10% damage taken | anything that dies slowed shatters | **DEEP STORAGE** |
| **TOOLS** | whatever gun you hold | +15% magazine | finishing a reload throws out a shockwave | **THE WHOLE RACK** |
| **JUNK** | bad for you. worth it. | +1 LUCK | every fourth card comes up a rarity better | **PAST THE DATE** |

Twelve is past what a spread build reaches on purpose. It's the rung you only
see if you've been refusing cards from other aisles, and it pays like it — THE
WHOLE RACK fires *every gun you own* alongside the one in your hands.

**Two cards are LEGENDARY or nothing.** They don't roll a rarity — they're
dealt at the top of the ladder or they aren't dealt at all. **SPLIT** (about
one hand in 48) makes your shot two rounds, both steering themselves in, and
neither goes where you pointed. **THE OTHER HAND** (one in 33) is a spare gun
that aims and fires itself while you're reloading, dashing, or doing nothing.

**Ten OFF-CUTS are the thing to go looking for.** Hold two named cards at rank
and a third thing exists that neither of them was — it's LEGENDARY, it takes
the first seat in your next hand, and the screen says so. CYCLE 3 + QUICK
HANDS 2 gives you instant reloads below a quarter mag. The level-up footer
prints your nearest unbuilt one with its progress.

The deck is the only thing a kill pays out in now. The five **signature
groceries** and the cold room they came from are gone — they were a fourth
progression track with no decision in it, and their item text had been lying
about its own numbers for three commits. Two of them came back as cards you
build toward instead: **THE OTHER HAND** (above) and **IGNITION** (your dash
rams, and at RARE it leaves fire behind).

## TOMCE

On about 60% of floors, someone is standing in a corner with three trades.
Every one has a real cost: **+24% damage, −15% max health**. **+45%
experience, and 18% more of them come.** **+40% coins, −14% experience.**

He's never in the same corner as the MODAGAZ sigil. Press **E**. Or don't —
he nods, he was not going to insist.

## Guns

Thirteen, bought from PACI, not found lying around. Walk onto a pedestal, press
**E**, pay. Coins are scarce and bosses are the reliable source.

He will not carry everything from the start: the crate opens one rung a floor,
so SCAR-L and the MEAT SPLITTER are floor-1 problems and GOD FINGER is a
floor-7 one. Money decides *which* of the three on the pallet, not whether you
can skip five floors of progression.

| gun | cost | deal |
| --- | --- | --- |
| THE SIDEARM | free | it was in the drawer. twelve rounds. it gains a mark every floor |
| SCAR-L | 20 | reliable, boring, yours |
| MEAT SPLITTER | 30 | nine pellets, and it shoves |
| THE PRICE GUN | 80 | tags things ON SALE — everything else hits them 1.6× |
| THE STAPLER | 55 | nailgun, pins enemies in place |
| MICROWAVE | 80 | plasma orbs that ricochet and set things on fire |
| FREEZER BURN | 95 | the cold aisle, weaponised |
| THE HOG | 120 | minigun — spins up, slows you down, never stops |
| **THE ROTISSERIE** | 165 | fires in a spinning circle. it does not care where you point it |
| GOD FINGER | 190 | railgun, charges, pierces the entire room, **never reloads** |
| **THE FISH** | **500 coins** | a fish. it opens its mouth and a laser comes out, and the laser cycles colour |
| **THE FLYKILLER** | **380** | the current chains through up to five more throats |
| **BLACK FRIDAY** | **460** | a singularity. it drags the room into one place, then goes off there |

THE ROTISSERIE isn't in the crate at all until its contract is signed.

**The three LEGENDARIES each own a verb.** THE FISH *holds*, THE FLYKILLER
*chains*, BLACK FRIDAY *gathers*. None of them is just the biggest number —
GOD FINGER still beats both of the new ones against a single target. They are
what you buy when the room stops being one thing at a time.

**THE FISH is the long game.** 500 coins, floor 5 at the earliest, and coins
come in at about one per eight kills — you will spend most of a run deciding
whether to save for it or arm yourself on the way.

There is no armory. Every weapon modifier is a card now, and it applies to
whatever you're holding rather than to one gun you paid to improve.

## PACI

Clear wave 5 or wave 10 and the next door leads sideways instead of down, into
a small purple room with an enormous man in it. Twice a floor.

> HELLO TRAVELER, WELCOME TO MY SHOP

Three pedestals, four once you're a REGULAR, and **all of them are filled every
visit**. What's on them is weighted by rarity rather than picked flat, so a
LEGENDARY on a pedestal is about one seat in seventy — seeing THE FISH at all
is the thing you tell someone about; affording it is a separate problem. Buy,
or don't, then walk out the door at the bottom.

The back room is also the one place with **no floor rule** running. The lights
stay on, the floor isn't greased, and nothing is on fire. That's the point of
it.

**Do not shoot him.** He doesn't fight back. The first shot gets you a warning
and a room that will not stop shaking, going redder the longer you stand in
it. The second gets you *GET OUT* — and whatever was still on the pedestals
stays on the pedestals.

## Contracts

Eight cross-run objectives, and each one changes what the game does rather
than adding a number. Take 25 RARE-or-better cards and every hand you're ever
dealt runs +1 LUCK. Kill an APEX and you're dealt four cards instead of three.
Put down 8 floor bosses and THE ROTISSERIE joins the crate. Put down THE MEAT
PROTOCOL — **CLOSING TIME** — and every run afterwards starts on a hand of
four.

They survive everything, including EVOLVE.

## Money keeps

**Coins and cards survive death.** Every coin is *also* banked in a separate
permanent **vault** used only for cosmetics, so buying guns never costs you
cosmetic progress.

Coins come in **30% slower** than they used to, which is what makes THE FISH a
decision rather than a milestone you walk past.

**Cosmetics**: GOLD (1000), TOXIC (2500), VOID (5000), BONE MASK (9000),
LIVING FLAME (15000, and the cloth is actually on fire). They repaint the
neckerchief at his throat — and the ones that touch the coat take the apron
with them.

## EVOLVE

**Ten rungs, and it is a pause-screen button.** It used to be on the title
screen, where it was a lever with no visible price. Pressing it now **restarts
the run you are in** — that is the cost, alongside every coin and card you were
holding — and the world permanently gets harder: +46% enemy HP, +30% damage,
+6% speed, +15% more of them, per rung.

**Every rung hands you something you keep forever.** Take one and you pick a
gun from the rarity that rung opened — COMMON at first, and the rarity climbs
as you go — and it is in your hands from the first frame of every run
afterwards. **No LEGENDARIES.** The ladder stops at EPIC: the fish, the
flykiller and BLACK FRIDAY are bought, and they are the only reason the coin
economy has to keep climbing past a few hundred.

Once your roster holds a gun of **every** rarity there is nothing left in the
crate, so the rungs above that deal you **three LEGENDARY cards** instead and
you start every run holding the one you took.

```
150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150, 3750  —  16,500 for all ten
```

**RESET EVOLUTION** (also pause) puts it all back: the level, the roster, the
starting hand. It restarts the run too, because you cannot keep holding guns
you no longer own.

## The secrets

**The eye.** One hidden item on floor 1 turns on god mode. Nothing tells you
where it is. Things worth noticing: one brick in the north wall doesn't quite
match its neighbours, it flickers if you're patient, and walls are usually
bulletproof. Usually.

**MODAGAZ.** Every floor has a mark hidden in one corner — a different corner
each floor. Step on it and something says its name.

**GOROMANIA.** There is a third one. It is not in a corner and it is not in a
wall. Consider what you have never once thought to shoot at.

## Files

- `index.html` — shell
- `js/font.js` — two typeface slots, with VT323 (latin subset) embedded as a
  data URI so something always loads, identically over `http` and `file://`.
  Drop **Melted Monster** / **Ari-W9500** into `fonts/` and they take over —
  see `fonts/README.md` and `OFL.txt`
- `js/sprites.js` — every sprite, hand-plotted as character grids, then EPX-
  upscaled, form-shaded, hand-stamped and antialiased at bake time
- `js/audio.js` — all sound synthesized at runtime (WebAudio), zero audio
  files, including formant speech synthesis for the corner secret
- `js/music.js` — the generative score, also synthesized, keyed per floor
- `js/game.js` — engine, AI, waves, bosses, the deck, economy, lighting, HUD
- `serve.js` — 20-line static server
- `docs/` — an Obsidian vault documenting every system in detail; open the
  folder as a vault and start at `00 START HERE`

`window.MEAT` is exposed in the console for poking at the guts
(`MEAT.giveWeapon('omega')`, `MEAT.spawnBoss(2, true)`, `MEAT.spawnBoss(-1)`
for the finale, `MEAT.dealCards(3, 2)`, `MEAT.S` …).
