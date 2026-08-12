---
title: Floors
tags: [reference, systems]
---

# The ten floors

The descent used to be endless: four authored rooms and then a generator that
kept making more of them out of a hue wheel and a name list. It had no bottom,
which meant it had no shape either — no act structure, no build, and nothing to
beat.

There are **ten floors now and the game ends on the tenth**. `ROOMS` in
`js/game.js` holds all ten by hand; nothing is generated any more.

```js
const FLOORS   = ROOMS.length;               // 10
const isLastFloor = idx => idx >= FLOORS - 1;
function roomDef(idx) { return ROOMS[clamp(idx | 0, 0, ROOMS.length - 1)]; }
```

`roomDef` **clamps** rather than generating. Nothing can ask for floor 11 —
but if some future code path does, it gets the killing floor rather than a
crash.

## The three acts

| | floors | what changes |
|---|---|---|
| **ACT ONE** — *it is only a building* | 1–3 | you are in a place of work that happens to be hostile |
| **ACT TWO** — *it starts taking an interest* | 4–6 | the building has weather, and the weather is aimed at you |
| **ACT THREE** — *it stops pretending* | 7–10 | it takes things away — light, health, safety, and finally the pretence that it is a building at all |

## The ten

| # | floor | subtitle | arena | layout | twist |
|---|---|---|---|---|---|
| 1 | **THE ABATTOIR** | where the meat is hung | 940×660 | scatter | — |
| 2 | **THE HOLLOW** | it goes down further than it should | 1020×720 | pillars | `dark` |
| 3 | **THE MEAT LOOP** | you have been here before | 1080×760 | ring | `slick` |
| 4 | **THE RED KITCHEN** | dinner | 1120×780 | corridors | `heat` |
| 5 | **THE FREEZER** | nothing in here has finished dying | 1140×800 | bunkers | `frost` |
| 6 | **THE RENDERING** | everything they could not sell | 1200×830 | scatter | `swarm` |
| 7 | **THE LONG TABLE** | twelve places, all of them set | 1240×850 | corridors | `blackout` |
| 8 | **THE SALT LINE** | it cures. it does not heal. | 1280×880 | pillars | `frail` |
| 9 | **THE LAST AISLE** | there is nothing after this one | 1320×900 | ring | `hunt` |
| 10 | **THE KILLING FLOOR** | this is what the building is for | 1180×820 | bunkers | `final` |

Every floor carries its own three-stop floor palette, grout colour, three-stop
wall palette, fog tint, darkness, [[#Props|prop set]], [[#Walls|wall
treatment]] and vat colour. Nothing is shared but the geometry code.

> [!note] The last floor is smaller than the one before it
> THE LAST AISLE is the biggest arena in the game at 1320×900; THE KILLING
> FLOOR pulls back to 1180×820. A three-phase fight wants a room you can read
> the whole of. The descent gets wider right up until the point where widening
> it would make the finale worse.

## Twists

A floor rule, announced by name on entry (`tw`) and running for the whole
floor. `twist()` reads the current floor's — and returns `null` inside
[[The Shop|PACI's]] room, which is what makes the shop a breather rather than
just a room with things for sale.

Every twist had to pass one rule: **it needs a tell, a rhythm, or a trade**. A
twist that only subtracts is difficulty, not design.

| twist | floor | what it does | the tell / the trade |
|---|---|---|---|
| `dark` | 2 | sight ×0.68 | permanent, so you learn to fight closer |
| `slick` | 3 | grip drops 0.0009 → **0.30** — you slide | **dashing restores full grip**, so the dash becomes a brake |
| `heat` | 4 | two burner vents light every 2.6–4.0s | **1.1s of warning ring before it burns** |
| `frost` | 5 | 4s snaps, every 13–18s, everything at **55% speed** | announced 1.4s early, and **the enemies are slowed too** |
| `swarm` | 6 | **1.5× the spawn count, 0.7× the health** | more of them, less of each — splash gets better, not worse |
| `blackout` | 7 | lights out for 2.5s every 15–21s | **3s of dimming first**; muzzle flash, enemy bullets and the crosshair all still light |
| `frail` | 8 | **all damage ×1.25**, both directions | it cures, it does not heal — you kill faster too |
| `hunt` | 9 | elites on waves **3, 6 and 8** instead of 4 and 8 | three elites instead of two, so **one more [[The Deck\|hand]]** than any other floor |
| `final` | 10 | no environmental rule at all | the floor's twist is the thing standing in the middle of it |

```js
function twist()   { return S.inShop ? null : roomDef(S.room).twist; }
const isTwist = k => twist() === k;
const HUNT_WAVES = [3, 6, 8];
function miniWaves() { return isTwist('hunt') ? HUNT_WAVES : MINI_WAVES; }
```

`heat`, `frost` and `blackout` are the three with a clock, and they run in
`updateTwist()`. The other four are read inline where they apply — `slick` in
the player's friction, `frail` in `hurt()`, `swarm` in the spawn count, `dark`
in the lightmap.

> [!note] Why blackout warns you and heat doesn't punish you
> Blackout is the only twist that takes something away with no counter, so it
> is on a metronome you can count — three seconds of dimming is a full
> sentence of warning. The burners are the reverse: they can appear anywhere,
> so the ring is harmless for its first 1.1s and never lights within 90px of
> where you are standing. A hazard that spawns under you is not a hazard, it
> is a tax.

## Walls

The border wall was the same brick on all ten floors, which quietly undid every
palette change — you can repaint brick and it is still brick. Five treatments
now, assigned per floor:

```js
const WALL_STYLE = ['brick', 'panel', 'brick', 'tile', 'panel',
                    'concrete', 'panel', 'tile', 'rack', 'brick'];
```

| style | is | floors |
|---|---|---|
| `brick` | coursed brick with mortar shadow | 1, 3, 10 |
| `panel` | riveted steel plate | 2, 5, 7 |
| `tile` | glazed tile with grout | 4, 8 |
| `concrete` | poured slab, form lines, stains | 6 |
| `rack` | shelving uprights, and things on them | 9 |

## Props

Obstacles are **props**, not walls. Twenty kinds, drawn from a shared
`box()` helper so every one gets the same body / lit top edge / dark base
treatment and reads as the same world.

| group | kinds |
|---|---|
| containers | `crate` `barrel` `vat` `sacks` `freezer` |
| structure | `icewall` `pipes` `cage` `shelf` `machine` |
| furniture | `table` `till` `slab` |
| meat | `carcass` `bones` |
| light | `brazier` `candles` |
| ground | `saltpile` `sludge` |

Each floor draws from **four or five** of them:

```js
const FLOOR_PROPS = [
  ['crate','barrel','carcass','slab','vat'],     //  1 THE ABATTOIR
  ['pipes','slab','cage','crate'],               //  2 THE HOLLOW
  ['machine','barrel','pipes','crate','vat'],    //  3 THE MEAT LOOP
  ['brazier','table','machine','crate'],         //  4 THE RED KITCHEN
  ['freezer','icewall','shelf','crate'],         //  5 THE FREEZER
  ['vat','sludge','barrel','machine'],           //  6 THE RENDERING
  ['table','candles','shelf','crate'],           //  7 THE LONG TABLE
  ['saltpile','bones','slab','shelf'],           //  8 THE SALT LINE
  ['shelf','till','cage','sacks'],               //  9 THE LAST AISLE
  ['carcass','slab','brazier','machine']         // 10 THE KILLING FLOOR
];
```

Six of them **put light into the room**, which `drawLight()` reads — a brazier
that glows but doesn't lift the darkness around it looks painted on:

```js
const LIT_PROPS = { brazier: 34, candles: 26, freezer: 22,
                    machine: 18, till: 18, sludge: 14 };
```

### The kind is not uniform

`place()` picks a prop kind per block, but the `'vat'` hint (used by the
`pillars` layout for every column) biases toward the head of the list with
`rng() * rng()` — a triangular distribution, so the floor's *signature* prop
turns up most.

That is a tendency, not a guarantee, so a second pass over the finished layout
**retags the blocks furthest from the arena centre** until there are at least
two of `kinds[0]` and one of `kinds[1]`. Every floor is guaranteed to actually
contain the thing it is named after, and the guarantee is paid for at the
edges of the room where a swapped prop changes the fight least.

## Related
- [[Bosses]] — the ten roster bosses, shuffled across these floors, and the finale on the tenth
- [[Rendering#Arena layouts]] — the five geometries the props are placed into
- [[How A Run Goes]] — the wave shape inside a floor, and the ending
- [[Difficulty Scaling]] — how much harder each of the ten is than the last
