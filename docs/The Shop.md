---
title: The Shop (PACI)
tags: [reference, systems]
---

# PACI's back room

Guns are not lying around the abattoir. Clear **wave 5** or **wave 10** and the
next door leads *sideways* instead of onward, into a small purple room with a
very large man in it.

## Cadence

```js
SHOP_WAVES = [5, 10]
```

**Twice a floor**, on the fives. The first is floor 1, wave 5.

> [!note] He used to keep boss hours
> `SHOP_EVERY = 3`, counted against an `S.bossKills` that tallied
> elites and floor bosses alike, which worked out to exactly one shop
> a floor, always after the wave-10 boss. That meant every purchase happened
> on the way *out* of a floor: you spent the whole floor carrying money you had
> no way to put down, and the gun you bought was tested on the next floor's
> enemies rather than on the ones that paid for it. The half-time shop is the
> one that changes how you fight waves 6–10.

> [!warning] The crate is gated by depth, not just by price
> Since PACI now turns up twice as often, price alone stopped being a gate —
> two floors of savings could put GOD FINGER in your hands before you had met
> a bloater. Every gun carries a `floor` it first appears at. See
> [[Weapons#When PACI starts carrying it]].

## PACI

The shopkeeper. Drawn at **3.6× scale** against Damjan's 1× — deliberately
absurd, small head on an enormous aproned body, two-frame breathing loop. He
greets you on arrival:

> HELLO TRAVELER, WELCOME TO MY SHOP

If you already own everything he has nothing to sell, and says so instead.

## Stock

Three pedestals — **four** once the REGULAR [[Contracts|contract]] is signed
(`shopSlots()`) — and **every visit fills all of them**.

Three gates build the pool:

| gate | is | fails when |
|---|---|---|
| `owned` | you already have it | always, once bought — including guns from your [[Economy#Evolution\|evolution roster]] |
| `lock` | a [[Contracts\|contract]] you have not signed | THE ROTISSERIE, until BREAK THE SEAL |
| `floor` | how deep you are | see [[Weapons#When PACI starts carrying it]] |

Price is the fourth gate, and the only one you can argue with.

Nothing is exempt. **THE FISH** used to be appended to the pool unconditionally
because [[Economy#Cards|cards]] were its gate; now that it costs **500 coins**
it goes through the same gates as every other gun.

### Weighted by rarity, not uniform

Uniform selection meant a COMMON and a LEGENDARY were equally likely to be
standing on a pedestal, so the crate had no texture: every visit was a
coin-flip between two things you could afford and one you could not.

```js
const SHOP_W = [100, 52, 24, 9, 2.5];
```

| grade | weight | ~share of pedestals |
|---|---|---|
| COMMON | 100 | 53% |
| UNCOMMON | 52 | 32% |
| RARE | 24 | 13% |
| EPIC | 9 | <1% |
| LEGENDARY | 2.5 | <1% |

*(measured over 1,200 rolls)*

A LEGENDARY on a pedestal is about **one seat in seventy**. Seeing THE FISH at
all should be the thing you tell someone about; buying it is a separate problem
costing 500 coins.

Picks are **spliced** out of the pool, so a pedestal can never duplicate the one
beside it, and the offer is sorted into `WORDER` so the crate reads in a
consistent order rather than shuffling under your eyes between visits.

### Three pedestals, always

A shop with one thing on offer is not a shop, it is a receipt — and three
pedestals in a room is a promise the room makes just by having three pedestals
in it. Depth and an [[Economy#Evolution|evolved roster]] can both leave the pool
short, so:

```js
if (pool.length < shopSlots())
  for (const id of all)
    if (!owned(id) && unlocked(id) && pool.indexOf(id) < 0) pool.push(id);
```

The **depth gate is dropped** — never the contract gate, and never ownership.
The rarity weights then do the gating that `floor` was doing: a floor-1 player
*can* be shown GOD FINGER this way, at odds of about one visit in thirty, and
cannot afford it anyway.

Stand on a pedestal and press **E**.

## Do not shoot him

He does not fight back. He stands there and the building reacts.

**The first shot.** A red ring, a hard shake, and every dread channel goes to
maximum:

> PACI — DO NOT DO THAT AGAIN.

From that moment the floor will not stop moving (`shake()` every frame, with
a 31Hz tremor riding on top), the light goes the colour of the inside of him
(`S.redness` climbs continuously, plus a pulsing red wash and an additive
pass in `post()`), and specks of him drift through the room. **It gets worse
the longer you stand in it** — the shake ramps with `angerT`.

**The second shot.** He still doesn't hit you. He decides you are leaving,
and the room agrees with him:

> PACI — GET OUT.

- whatever is still on the pedestals stays on the pedestals (`S.shops = []`)
- you are thrown away from him and upward
- the picture starts tearing — nine black scanlines a frame
- `S.pendingKick = 0.85`, and when it runs out `exitShop()` fires whether you
  were finished or not

The hit box is generous on purpose (`|b.x − paci.x| < 34`, from 46px above
him to 48px below) — a stray round from a MEAT SPLITTER counts. `angerPaci()`
is the whole system; there is no third stage.

## Leaving

The way out is a purple door on the **south** wall (the floor door is always
north, so the two never read the same). Walk into it and you drop back into
the arena exactly where you left it, and the wave picks up from where it
paused.

> [!warning] Permanent drops ride with you
> The wave-end vacuum deliberately never pulls in permanent drops — the
> [[Secrets|Eye]] has to be walked to. Since the shop opens on a timer rather
> than on your say-so, an uncollected one would otherwise be destroyed by the
> room swap. Permanent drops are carried into the shop, laid out between
> where you land and the exit, and carried back out again if you leave
> without them. See [[Bugs Found#12. The shop ate your boss item]].

## How it's built

`enterShop()` stashes the whole arena — dimensions, walls, decor, both baked
canvases, the door, the secret, the corner sigil, [[Augments|TOMCE]], plus
your exact position — then builds the shop room over the top. `exitShop()`
puts it all back and sets `waveState = 'clear'` so
[[How A Run Goes#Per-wave loop|the wave clock]] resumes normally.

The shop is **not a floor**. It never increments `S.room`, never counts toward
the descent, and its room definition (`SHOP_ROOM`) lives outside the ten
[[Floors|`ROOMS`]] entirely. `curRoom()` is what picks between them.

It also has **no [[Floors#Twists|twist]]** — `twist()` returns `null` whenever
`S.inShop` is set. That is not an oversight; it is what makes the back room a
breather rather than just a room with things for sale in it. The floor is still
greased or dark or on fire when you walk back out.

## Related
- [[Weapons]] — what he sells, what it costs, and what he won't carry yet
- [[How A Run Goes#The shape of a floor]] — where the two visits land
- [[Contracts]] — REGULAR buys the fourth pedestal
- [[Economy]] — where the money comes from
