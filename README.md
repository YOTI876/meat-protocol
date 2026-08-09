# MEAT PROTOCOL

Top-down pixel-art horror wave shooter. You are Damjan. You have a headband, a
pistol that was in the drawer, and a shopping problem.

Ten waves a floor, two elites and a two-phase boss on the way through, PACI at
half time and again at the end, and no bottom to it.

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
| ESC / P | pause |
| M | mute |

## How a run goes

Ten waves per floor. **Elites** on waves 4 and 8, the **floor boss** on wave
10 — and every fifth floor that boss comes up as an **APEX** instead, at 2.6×
health and 1.45× damage.

**Every floor boss has two phases.** At half health it breaks: rears up, throws
the room off itself, and comes back faster, angrier, and doing something else
entirely — a boss that does one thing for its whole bar is a health sponge.
There are **ten** of them now, one per floor, cycling every ten.

All three boss-class kills hand you a card. Only the floor boss opens THE COLD
ROOM.

**PACI turns up twice a floor** — after wave 5 and again after wave 10. Clear
wave 10, spend what's left, and the north door opens. The next floor has
stronger enemies but you keep everything.

**There is no last floor.** Past the four hand-built ones the game keeps
generating them — new names, new palettes, wider arenas, darker rooms — and
the difficulty keeps climbing with no ceiling. Floor 201 is `THE SALT LINE
XXV`. Every floor also rolls one of five arena layouts, so you're not always
fighting in the same shape of room.

## THE MENU

Level up and you're dealt a hand of cards. **38 of them**, across five aisles.

**Rarity is not a multiplier.** Every card carries a **RIDER** — a second,
qualitative effect that only switches on if you take that card at **RARE or
better**. A RARE MALICE isn't 1.75 MALICEs, it's a different card: *every 6th
shot always crits*. That's the whole reason to care what comes up.

```
COMMON · UNCOMMON · RARE · EPIC · LEGENDARY
```

**Aisles commit back.** Four ranks anywhere in one aisle buys a standing perk,
eight buys a louder one:

| aisle | is | at 4 | at 8 |
| --- | --- | --- | --- |
| **BLADES** | hurting things | +12% damage | crits cleave everything behind the target |
| **FRESH** | health and speed | +20 max health | clearing a wave heals a quarter back |
| **FROZEN** | armour and slowing | −10% damage taken | anything that dies slowed shatters |
| **TOOLS** | whatever gun you hold | +15% magazine | finishing a reload throws out a shockwave |
| **JUNK** | bad for you. worth it. | +1 LUCK | every fourth card comes up a rarity better |

**SPLIT is the one card with its own rules.** LEGENDARY, never dealt before
floor 3, and about one hand in forty. It makes your shot two rounds, both
steering themselves in, and neither of them goes where you pointed.

**Ten OFF-CUTS are the thing to go looking for.** Hold two named cards at rank
and a third thing exists that neither of them was — it's LEGENDARY, it takes
the first seat in your next hand, and the screen says so. CYCLE 3 + QUICK
HANDS 2 gives you instant reloads below a quarter mag. The level-up footer
prints your nearest unbuilt one with its progress.

## THE COLD ROOM

Kill a floor boss and it opens. Two of the five signature groceries, you take
one, they stack to level 2:

| item | what it does |
| --- | --- |
| BANANA | +35% speed, you leave peels that make enemies slip |
| MELON | +55 max HP and a regenerating rind shield |
| COOLADE | sugar rush: x1.6 damage, bullets pierce |
| GLOCK-18 | a second gun that aims and fires itself |
| STOLEN BICYCLE | +25% speed, and your dash becomes a ram |

These used to be dealt into the level-up hand. A grocery and *+5% move speed*
are not the same kind of reward and the hand couldn't price one against the
other, so they got their own door.

## TOMCE

On about 60% of floors, someone is standing in a corner with three trades.
Every one has a real cost: **+24% damage, −15% max health**. **+45%
experience, and 18% more of them come.** **+40% coins, −14% experience.**

He's never in the same corner as the MODAGAZ sigil. Press **E**. Or don't —
he nods, he was not going to insist.

## Guns

Eleven, bought from PACI, not found lying around. Walk onto a pedestal, press
**E**, pay. Coins are scarce and bosses are the reliable source.

He will not carry everything from the start: the crate opens one rung a floor,
so SCAR-L and the MEAT SPLITTER are floor-1 problems and GOD FINGER is a
floor-7 one. Money decides *which* of the three on the pallet, not whether you
can skip five floors of progression.

| gun | cost | deal |
| --- | --- | --- |
| THE SIDEARM | free | it was in the drawer. slow. it gains a mark every floor |
| SCAR-L | 20 | reliable, boring, yours |
| MEAT SPLITTER | 30 | nine pellets, and it shoves |
| THE PRICE GUN | 80 | tags things ON SALE — everything else hits them 1.6× |
| THE STAPLER | 55 | nailgun, pins enemies in place |
| MICROWAVE | 80 | plasma orbs that ricochet and set things on fire |
| FREEZER BURN | 95 | the cold aisle, weaponised |
| THE HOG | 120 | minigun — spins up, slows you down, never stops |
| **THE ROTISSERIE** | 165 | fires in a spinning circle. it does not care where you point it |
| GOD FINGER | 190 | railgun, charges, pierces the entire room |
| **THE FISH** | **500 coins** | a fish. it opens its mouth and a laser comes out, and the laser cycles colour |

THE ROTISSERIE isn't in the crate at all until its contract is signed.

**THE FISH is the long game.** 500 coins, floor 5 at the earliest, and coins
come in at about one per eight kills — you will spend most of a run deciding
whether to save for it or arm yourself on the way.

There is no armory. Every weapon modifier is a card now, and it applies to
whatever you're holding rather than to one gun you paid to improve.

## PACI

Clear wave 5 or wave 10 and the next door leads sideways instead of down, into
a small purple room with an enormous man in it. Twice a floor.

> HELLO TRAVELER, WELCOME TO MY SHOP

Three pedestals, four once you're a REGULAR. Buy, or don't, then walk out the
door at the bottom.

**Do not shoot him.** He doesn't fight back. The first shot gets you a warning
and a room that will not stop shaking, going redder the longer you stand in
it. The second gets you *GET OUT* — and whatever was still on the pedestals
stays on the pedestals.

## Contracts

Eight cross-run objectives, and each one changes what the game does rather
than adding a number. Take 25 RARE-or-better cards and every hand you're ever
dealt runs +1 LUCK. Kill an APEX and you're dealt four cards instead of three.
Put down 8 floor bosses and THE ROTISSERIE joins the crate.

They survive everything, including EVOLVE.

## Money keeps

**Coins and cards survive death.** Every coin is *also* banked in a separate
permanent **vault** used only for cosmetics, so buying guns never costs you
cosmetic progress.

Coins come in **30% slower** than they used to, which is what makes THE FISH a
decision rather than a milestone you walk past.

**Cosmetics**: GOLD BAND (1000), TOXIC BAND (2500), VOID (5000), BONE MASK
(9000), LIVING FLAME (15000, and it actually burns).

**EVOLVE** wipes your coins and cards and permanently raises the world one
notch: +38% enemy HP, +26% damage, +5% speed, +50% score. It stacks forever
and it never resets.

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
(`MEAT.giveWeapon('omega')`, `MEAT.spawnBoss(2, true)`, `MEAT.openColdRoom()`,
`MEAT.dealCards(3, 2)`, `MEAT.S` …).
