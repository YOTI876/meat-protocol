---
title: File Map
tags: [reference, engine]
---

# File Map

```
SLOP/
├── index.html         shell: two stacked canvases (#game, #overlay), boot screen
├── serve.js            30-line static server (node serve.js → :8123)
├── js/
│   ├── font.js          the embedded typeface, inlined so there's no network fetch
│   ├── sprites.js       every sprite as a character grid + the sheet/variant cache
│   ├── audio.js         SFX synthesis (Web Audio), formant speech, music bus wiring
│   ├── music.js         the generative score — independent of audio.js's SFX
│   └── game.js          everything else: state, physics, AI, waves, bosses,
│                        weapons, economy, progression, rendering, HUD, menus
├── OFL.txt              SIL Open Font License for the embedded typeface
├── README.md
└── docs/                this vault
```

> [!warning] Script order matters
> `index.html` loads `font.js → sprites.js → music.js → audio.js → game.js`.
> `audio.js` references `MUSIC` at wiring time and `game.js` references
> everything, so reordering these breaks the boot.

## `js/game.js` — rough section order

1. Setup: canvases, helpers, input handling
2. Content tables: `ROOMS` + `roomDef()`/`SHOP_ROOM`/`curRoom()`, `ETYPE`,
   `BOSSES`, `ITEMS`, `WEP`, `COSMETICS`, `WTRACKS`, `UPGRADES`
3. Save/vault (`loadSave`, `persist`, `evolve`, `resetEvolution`)
4. State (`freshState`) and derived stats (`ST()`, `diff()`)
5. Room/floor generation (`buildRoom` + its `place`/`scatter` layout helpers,
   `bakeFloor`) and [[The Shop]] (`shopStock`, `enterShop`, `exitShop`)
6. Entity spawning (`spawnEnemy`, `spawnBoss`, `makePlayer`)
7. Juice helpers (`part`, `gib`, `blood`, `ring`, `deathBurst`, `float`, `shake`)
8. Collision (`collideWalls`, `pointInWall`, `freeSpot`)
9. Weapons (`fire`, `emit`, `updateBeam`) and grenades (`throwNade`, `explode`)
10. Damage (`damageEnemy`, `killEnemy`, `hurtPlayer`) and pickups (`dropPickup`,
    `grantItem`, `grantGod`, `giveWeapon`)
11. Waves (`startWave`, `updateWaves`)
12. The big `update(dt)` loop, `updateEnemy`, `updateBoss`
13. Camera (`updateCam`, `worldToScreen`/`screenToWorld`)
14. Secrets (`breakSecret`, `triggerModagaz`, `triggerGoromania`)
15. Flow (`startRun`, `nextRoom`)
16. Drawing: `drawWorld`, `drawPlayer`, `drawEnemy`, `drawLight`, `post`
17. HUD + all menu screens (`drawHUD`, `drawTitle`, `drawCosmetics`,
    `drawArmory`, `drawLevelUp`, `drawPause`, `drawDead`)
18. Main loop (`frame`) and boot

## Dev console hook

`window.MEAT` exposes internals for poking at the game from DevTools —
`MEAT.S` (live state), `MEAT.spawnBoss(i)`, `MEAT.giveWeapon(id)`,
`MEAT.triggerModagaz()`, `MEAT.evolve()`, `MEAT.enterShop()`,
`MEAT.roomDef(n)`, `MEAT.buildRoom(n)`, `MEAT.wupCost(...)`, etc. Full list at
the bottom of `js/game.js`.

Driving `MEAT.frame(t)` with synthetic timestamps is how every change in this
project gets tested headlessly — see [[Bugs Found]] for what that has caught.

> [!warning] Keep this list in sync
> The export block is a plain object literal, so deleting a function without
> removing its name here throws a `ReferenceError` at load and takes the whole
> game down. `populateShops` hit exactly this when the shop moved to PACI.

## Related
- [[Deployment]] — how this maps to GitHub + Vercel
