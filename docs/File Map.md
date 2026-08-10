---
title: File Map
tags: [reference, engine]
---

# File Map

```
SLOP/
├── index.html         shell: two stacked canvases (#game, #overlay), boot screen
├── serve.js            21-line static server (node serve.js → :8123)
├── js/
│   ├── font.js          two typeface slots + VT323 inlined as the fallback
│   ├── sprites.js       every sprite as a character grid, plus the bake pipeline
│   ├── audio.js         SFX synthesis (Web Audio), formant speech, music bus wiring
│   ├── music.js         the generative score — independent of audio.js's SFX
│   └── game.js          everything else: state, physics, AI, waves, bosses,
│                        weapons, the deck, economy, rendering, HUD, menus
├── fonts/               drop Melted Monster / Ari-W9500 here — see its README
├── OFL.txt              SIL Open Font License for the embedded typeface
├── README.md
└── docs/                this vault
```

> [!warning] Script order matters
> `index.html` loads `font.js → sprites.js → music.js → audio.js → game.js`.
> `audio.js` references `MUSIC` at wiring time and `game.js` references
> everything, so reordering these breaks the boot.

## `js/game.js` — rough section order

~6,400 lines, one IIFE, no modules.

1. Setup: render scale (`RS`, `subCanvas`, `blit`), crisp UI text (`htxt`),
   input handling
2. Content tables: `ROOMS` + `roomDef()`/`SHOP_ROOM`/`curRoom()`, `ETYPE`,
   `BOSSES`, `MINIS`, `ITEMS`, `GRADE`, `WEP`, `COSMETICS`
3. Save/vault (`loadSave`, `persist`) and **[[Economy#Evolution|EVOLVE]]**
   (`canEvolve`, `evolve`, `resetEvolution`, the `evoGuns`/`evoCards` roster
   helpers, `evoGunPool`/`evoCardPool`, `evoReward`, `openEvoPick`,
   `takeEvoGun`/`takeEvoCard`, `applyEvoLoadout`)
4. State (`freshState`) and derived stats (`ST()`, `diff()`)
5. **[[The Deck|THE MENU]]**: `AISLES`, `CARDS`, riders (`riderOn`/`rd`), aisle
   mastery (`recalcAisles`, `aisleT1/T2`), `FUSIONS` and the off-cut reads,
   `dealCards`, `takeCard`/`takeFusion`/`afterPick`
6. **[[Groceries#THE COLD ROOM|THE COLD ROOM]]** (`sigPool`, `openColdRoom`,
   `takeSig`)
7. **[[Augments|AUGMENTS]]** (`dealAugments`, `openAugments`, `takeAugment`)
8. **[[Contracts|CONTRACTS]]** (`cStat`, `bump`, `bumpMax`, `contractDone`,
   `checkContracts`)
9. Room/floor generation (`buildRoom` + `place`/`scatter`, `bakeFloor`) and
   [[The Shop]] (`shopStock`, `enterShop`, `angerPaci`, `exitShop`)
10. Entity spawning (`spawnEnemy`, `spawnBoss`, `spawnMini`, `makePlayer`)
11. Juice helpers (`part`, `gib`, `blood`, `shred`, `ring`, `deathBurst`,
    `float`, `shake`)
12. Collision (`collideWalls`, `pointInWall`, `freeSpot`)
13. Weapons (`fire`, `emit`, `updateBeam`, `chainZap`, `singularityPop`) and
    grenades (`throwNade`, `explode`)
14. Damage (`damageEnemy`, `killEnemy`, `hurtPlayer`) and pickups
15. Waves (`startWave`, `updateWaves`)
16. The big `update(dt)` loop, `updateEnemy`, `updateBoss`
17. Camera, secrets, flow (`startRun`, `nextRoom`, `quitToTitle`)
18. Drawing: `drawWorld`, `drawPlayer`, `drawEnemy`, `drawTomce`, `drawLight`,
    `post`
19. HUD + every screen (`drawHUD`, `drawTitle`, `drawCosmetics`, `drawDeck`,
    `drawLevelUp`, `drawColdRoom`, `drawEvoPick`, `drawAugments`,
    `drawContracts`, `drawPause`, `drawDead`)
20. Main loop (`frame`), `fitCanvas`, boot

## Dev console hook

`window.MEAT` exposes internals for poking at the game from DevTools —
`MEAT.S` (live state), `MEAT.spawnBoss(i)`, `MEAT.spawnMini(i)`,
`MEAT.giveWeapon(id)`, `MEAT.openLevelUp()`, `MEAT.dealCards(n, luck)`,
`MEAT.openColdRoom()`, `MEAT.availableFusions()`, `MEAT.openAugments()`,
`MEAT.triggerModagaz()`, `MEAT.enterShop()`, `MEAT.angerPaci(x, y)`,
`MEAT.buildRoom(n)`, etc. Full list at the bottom of `js/game.js`.

Driving `MEAT.frame(t)` with synthetic timestamps is how every change in this
project gets tested headlessly — see [[Bugs Found]] for what that has caught.
The measured tables in [[Tuning Values]] and [[Difficulty Scaling]] come from
exactly this: `startRun()`, force `S.room`, `buildRoom()`, `startWave(n)`,
then step `frame(t)` at 1/60 and watch `S.en.length`.

> [!warning] Keep this list in sync
> The export block is a plain object literal, so deleting a function without
> removing its name here throws a `ReferenceError` at load and takes the whole
> game down. `populateShops` hit exactly this when the shop moved to PACI.

## Related
- [[Deployment]] — how this maps to GitHub + Vercel
