---
title: The Shop (PACI)
tags: [reference, systems]
---

# PACI's back room

Guns are not lying around the abattoir any more. Every **third boss** you put
down, the next door leads *sideways* instead of onward, into a small purple
room with a very large man in it.

> [!info] First visit
> Bosses land on waves 3, 5, 7, 9, 10 — so your third boss kill, and your
> first shop, is **floor 1 wave 7**. After that it's every three bosses:
> 6th, 9th, 12th, and so on forever.

## PACI

The shopkeeper. Drawn at **3.6× scale** against Damjan's 1× — deliberately
absurd, small head on an enormous aproned body, two-frame breathing loop
(`SPR.paci` / `SPR.paci2` in `js/sprites.js`). He greets you on arrival:

> HELLO TRAVELER, WELCOME TO MY SHOP

If you already own everything he has nothing to sell, and says so instead.

## Stock

Three pedestals, randomly drawn from whatever you *don't* own — the five
[[Weapons|buyable guns]] plus the **OMEGA BEAM** if you're still missing it.
Prices are unchanged from the old floor pedestals; the beam still costs
[[Economy#Cards|cards]], not coins. Stand on a pedestal and press **E**.

Because the beam is only one of six entries in the pool, it shows up in
roughly half of shops — so cards are still a long game, they just have a
different door now.

## Leaving

The way out is a purple door on the **south** wall (the floor door is always
north, so the two never read the same). Walk into it and you drop back into
the arena exactly where you left it, and the wave picks up from where it
paused.

> [!warning] Groceries ride with you
> The wave-end vacuum deliberately never pulls in permanent drops — a boss's
> [[Groceries|grocery]] has to be walked to. Since the shop opens on a timer
> rather than on your say-so, an uncollected item would otherwise be destroyed
> by the room swap. Permanent drops are carried into the shop, laid out
> between where you land and the exit, and carried back out again if you leave
> without them. See [[Bugs Found#12. The shop ate your boss item]].

## How it's built

`enterShop()` stashes the whole arena — dimensions, walls, decor, both baked
canvases, the door, the secret and the corner sigil, plus your exact position
— then builds the shop room over the top. `exitShop()` puts it all back and
sets `waveState = 'clear'` so [[How A Run Goes#Per-wave loop|the wave clock]]
resumes normally.

The shop is **not a floor**. It never increments `S.room`, never counts toward
the descent, and its room definition (`SHOP_ROOM`) lives outside the `ROOMS`
progression entirely. `curRoom()` is what picks between them.

## Related
- [[Weapons]] — what he sells and what it costs
- [[Bosses]] — the cadence that opens the door
- [[Economy]] — where the money comes from
- [[Progression]] — the rest of the run structure
