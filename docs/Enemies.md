---
title: Enemies
tags: [reference, systems]
---

# Enemies

Four base types (`ETYPE` in `js/game.js`). Stats below are floor-1, wave-1
baseline before any [[Difficulty Scaling|scaling]] is applied.

| type | hp | speed | contact dmg | behaviour |
|---|---|---|---|---|
| **CRAWLER** | 26 | 54 | 16 | erratic lunges toward you within 120px |
| **SHRIEKER** | 38 | 33 | 20 | keeps distance (backs off <96px, strafes <130px), fires 3-shot spreads |
| **STALKER** | 32 | 84 | 23 | teleports 70px toward you every 2.4–4s |
| **BLOATER** | 105 | 25 | 26 | slow tank; bursts into 10 acid projectiles on death |

## Shared behaviour

- **Contact damage** fires on a shared cooldown, `CONTACT_CD = 0.78s`
  (raised from 0.70s specifically so bigger hits land less often — see
  [[Bugs Found]] for the balance pass this came from).
- **Separation**: non-boss enemies push apart from each other so they don't
  stack into a single blob.
- **Twitching**: every enemy has an independent random offset timer
  (`e.twitch`) so they visibly jitter even mid-animation — this and the
  **afterimage trail** on fast enemies/bosses are the main "this is horror,
  not just a shooter" visual cues. See [[Rendering#Sprites]].
- **Eye glow**: two small additive-blended dots per enemy, brighter and wider
  on bosses, visible even in total darkness.

## Status effects

- **Burn** (from MICROWAVE, [[Groceries|BACON's replacement]] path, or NOVA):
  ticks damage over ~3.2s independent of contact.
- **Stun** (from THE STAPLER's pin, or a banana peel): zeroes velocity input,
  enemy drifts on residual momentum only.

## Related
- [[Bosses]] — the five named enemies with patterns and drops
- [[Difficulty Scaling]] — how HP/damage/speed/count scale with floor, wave,
  evolution, weapons owned and player level
