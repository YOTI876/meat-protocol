---
title: Enemies
tags: [reference, systems]
---

# Enemies

Six types (`ETYPE` in `js/game.js`). Stats are floor-1, wave-1 baseline before
any [[Difficulty Scaling|scaling]].

| type | hp | speed | contact dmg | behaviour |
|---|---|---|---|---|
| **CRAWLER** | 26 | 54 | 16 | erratic lunges toward you within 120px |
| **SHRIEKER** | 38 | 33 | 20 | keeps distance (backs off <96px, strafes <130px), fires 3-shot spreads |
| **STALKER** | 32 | 84 | 23 | teleports 70px toward you every 2.4–4s |
| **BLOATER** | 105 | 25 | 32 | slow tank; bursts into 10 acid projectiles on death |
| **HUSK** | 62 | 36 | 22 | a dried-out bloater — **bursts into 2 crawlers when it dies** |
| **CYST** | 170 | **0** | 18 | doesn't move. Sits and hatches until you come and burst it |

## The two late arrivals

The HUSK and the CYST exist to answer two degenerate strategies. Every launch
enemy either chases you or shoots at you, so **spray-and-pray AoE** and
**circle-kiting** both won for free.

**THE HUSK** punishes careless AoE. It is cheap and it looks like a small
bloater, and killing it without thinking hands you two more problems —
`e.split = 2`, spawned directly rather than through the `S.fx` queue, because
spawning is not damage and crawlers don't split, so it cannot recurse. The
children get a shove outward so they read as bursting out rather than
appearing.

**THE CYST** punishes kiting. It does not come to you at all. It sits where
the wave dropped it, swells, and hatches — the pressure it applies is the
growing crowd, and the only counter is crossing the room. It refuses knockback
for the same reason a door refuses knockback: its job is to be a place.
Bursting one point-blank is answered with a ring of six acid shots, slow
enough to walk out of at range and not at arm's length.

```js
// the cyst gates its own hatching, which the elite summon does not
if (e.hatchT <= 0 && S.en.length < 70) { ... }
```

Hatch interval is `max(1.6, 3.4 - floor*0.15)`, and from floor 4 it has a 30%
chance of hatching a husk instead of a crawler.

## When each turns up

Ordinary waves weight the pool by wave and floor:

| type | first appears |
|---|---|
| crawler | always |
| shrieker | wave 2, or any floor past 1 |
| stalker | wave 4, or any floor past 1 |
| bloater | wave 6, or any floor past 1 |
| **husk** | wave 5, or any floor past 1 |
| **cyst** | wave 7, or **floor 3+** |

Boss and elite waves mix husks into their filler **from floor 2**.

All six also turn up as named [[Bosses#Elites|elites]] on waves 4 and 8.

## Shared behaviour

- **Contact damage** fires on a shared cooldown, `CONTACT_CD = 0.74s`.
  Individual hits land much harder than they used to; the slower rate, longer
  i-frames and better healing are what balance that back. Spikier, not just
  meaner.
- **Separation**: non-boss enemies push apart so they don't stack into a
  single blob. This pass is O(n²) and is the reason the
  [[Difficulty Scaling#Concurrent cap|concurrency cap]] exists.
- **Twitching**: every enemy has an independent random offset timer
  (`e.twitch`) so they visibly jitter even mid-animation — this and the
  **afterimage trail** on fast enemies are the main "this is horror, not just
  a shooter" visual cues.
- **Eye glow**: two small additive-blended dots per enemy, brighter and wider
  on bosses, visible even in total darkness.
- **Faces**: every creature's expression is hand-stamped over its generated
  shading. See [[Rendering#The sprite pipeline]].

## Status effects

Nearly all of these are [[The Deck|cards]] now rather than properties of a
particular gun:

| effect | from |
|---|---|
| **burn** | MICROWAVE, THE ROTISSERIE, SPOILED, NOVA |
| **stun / pin** | THE STAPLER's nail, a banana peel, HAMSTRUNG crits |
| **chill / slow** | FREEZER BURN, COLD SNAP, SECOND WIND dashes |
| **freeze solid** | FROSTBITE, HARD FROST, PERMAFROST |
| **aura slow** | THE WALK-IN — anything near you, permanently |
| **marked** | THE PRICE GUN — tagged things take ×1.6 |
| **caustic ground** | RENDERING pools, RENDERED bursts |

## Related
- [[Bosses]] — the six elites, the floor bosses, and the apex
- [[The Deck]] — where most of the status effects come from now
- [[Difficulty Scaling]] — how everything scales, and where it doesn't
