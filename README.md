# MEAT PROTOCOL

Top-down pixel-art horror wave shooter. You are Damjan. You have a headband, a
SCAR with a laser sight, and a shopping problem.

## Run it

```bash
node serve.js
```

Then open http://localhost:8123 (or just double-click `index.html` — it works
over `file://` too, no build step, no dependencies).

## Controls

| key | does |
| --- | --- |
| WASD / arrows | move |
| mouse | aim (the laser dot shows exactly where the bullet lands) |
| left click | fire |
| **right click** | throw a frag |
| **mouse wheel / 1-7 / Q** | swap weapon |
| **E** | buy from a pedestal you're standing at |
| R | reload |
| SHIFT / SPACE | dash (i-frames) |
| ESC / P | pause — full inventory + arsenal list |
| M | mute |

## How a run goes

Ten waves per floor. Bosses on waves **3, 5, 7, 9 and 10**. Each boss drops one
grocery (permanent for the run) and exactly **5 coins**:

| item | boss | what it does |
| --- | --- | --- |
| 🍌 BANANA | THE BUTCHER | +35% speed, you leave peels that make enemies slip |
| 🍉 MELON | MOTHER OF MELONS | +55 max HP and a regenerating rind shield |
| 🥤 COOLADE | THE PITCHER | sugar rush: x1.6 damage, bullets pierce |
| 🔫 GLOCK-18 | THE HOGFATHER | a second gun that aims and fires itself |
| 🚲 STOLEN BICYCLE | THE COURIER | +25% speed, and your dash becomes a ram |

Clear wave 10 and the north door opens. The next floor has stronger enemies but
you keep everything, and its bosses drop **upgraded** versions (BANANA SPLIT,
MELON ARMOR, PURPLE COOLADE, AKIMBO GLOCK-18s, STOLEN MOTORCYCLE) that stack.

Enemies hit hard and their HP scales gently, so deeper floors get lethal rather
than spongy.

## Guns

Weapons sit on pedestals scattered around the floor. Walk up, press **E**, pay.
They're yours for the rest of the run. Coins are deliberately scarce — bosses
are the reliable source, regular enemies drop one about one time in twelve.

| gun | cost | deal |
| --- | --- | --- |
| SCAR-L | free | reliable, boring, yours |
| MEAT SPLITTER | 20 | 9 pellets and enormous knockback |
| THE STAPLER | 45 | nailgun, pins enemies in place |
| MICROWAVE | 80 | plasma orbs that ricochet and set things on fire |
| THE HOG | 140 | minigun — spins up, slows you down, never stops |
| GOD FINGER | 250 | railgun, charges, pierces the entire room |
| **OMEGA BEAM** | **10 cards** | a continuous beam that deletes everything in the line |

**Cards** are the rare drop — about one enemy in fifty. Ten of them buys the
OMEGA BEAM from its own pedestal, which is on every floor from the start so you
can see what you're saving for.

## Money keeps

**Coins and cards survive death.** Whatever you're holding when you die is
still in your pocket next run, so the guns are a long game. Every coin is
*also* banked in a separate permanent **vault** used only for cosmetics, so
buying guns never costs you cosmetic progress.

**Cosmetics** are reachable any time — title screen, pause, or the death
screen, by button or by pressing **C**. GOLD BAND (1000), TOXIC BAND (2500),
VOID (5000), BONE MASK (9000), LIVING FLAME (15000, and it actually burns).
They change how Damjan looks in-game, headband and all.

**EVOLVE** (title or death screen, any time you want) wipes your coins and
cards to zero and permanently raises the world one notch: +38% enemy HP, +26%
enemy damage, +5% enemy speed, and +50% score per evolution. It stacks forever
and it never resets.

## The secrets

**The eye.** One hidden item on floor 1 turns on god mode. Nothing tells you
where it is. Things worth noticing: the floor has a scratch on it that isn't
decoration, one brick in the north wall doesn't quite match its neighbours, it
flickers if you're patient, and walls are usually bulletproof. Usually.

**MODAGAZ.** Every floor has a mark hidden in one corner — a different corner
each floor. It is almost invisible until you're nearly standing on it. Step on
it and something says its name. It gives you a card.

**GOROMANIA.** There is a third one. It is not in a corner and it is not in a
wall. Consider what you have never once thought to shoot at.

## Files

- `index.html` — shell
- `js/font.js` — the typeface (Pixelify Sans, latin subset) embedded as a data
  URI so it loads identically over `http` and `file://`. Every string in the
  game — HUD, menus and world labels — resolves through it. See `OFL.txt`.
- `js/sprites.js` — every sprite, hand-plotted as character grids, baked to canvases
- `js/audio.js` — all sound synthesized at runtime (WebAudio), zero audio files,
  including formant speech synthesis for the corner secret
- `js/game.js` — engine, AI, waves, bosses, weapons, economy, lighting, HUD
- `serve.js` — 30-line static server

`window.MEAT` is exposed in the console for poking at the guts
(`MEAT.giveWeapon('omega')`, `MEAT.spawnBoss(2)`, `MEAT.triggerModagaz()`, `MEAT.S` …).
