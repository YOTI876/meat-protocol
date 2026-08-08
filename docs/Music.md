---
title: Music
tags: [reference, engine]
---

# Music — the generative score

`js/music.js`. An **original**, fully synthesized score written specifically
for this game — not a transcription or arrangement of any existing track.
Requested to evoke the mood of a dungeon-crawler roguelike OST; built from
scratch in that idiom (minor/phrygian/locrian modes, syncopated pulse,
circling arpeggios, accumulating percussion) rather than by copying one.

## Scheduling

A lookahead scheduler: a 25ms `setInterval` queues notes ~120ms ahead of
playback against exact `AudioContext` timestamps (`nextT`), so the score
can't drift or stutter even while the main thread is busy drawing 70+
enemies. This is the same pattern professional Web Audio sequencers use —
schedule ahead of the deadline, never against `Date.now()`.

## Five layers, gated by intensity

| layer | comes in at | role |
|---|---|---|
| **pad** | always | sustained chord tones, the room breathing |
| **bass** | intensity > 0.10 | syncopated low pulse |
| **drums** | intensity > 0.28 | kick/snare/hats, pattern thickens with intensity |
| **arp** | intensity > 0.42 | circling 16th-note runs, reversing direction every 2 bars |
| **stab** | boss fights only | dissonant minor-2nd hits |

`intensity` is driven by the game: `0.12 + (wave/10)*0.72 + floor*0.16`,
eased rather than snapped so builds feel musical.

## Keys per floor

Every floor is **phrygian or locrian** — modes built around a flat second,
and the bottom two floors drop the perfect fifth entirely so the harmony
never fully resolves. Roots and tempo both shift with floor:

| floor | mode | tempo |
|---|---|---|
| 1 | A phrygian | 82 bpm |
| 2 | G phrygian | 88 bpm |
| 3 | F locrian | 94 bpm |
| 4 | D♯ locrian | 99 bpm |

Boss fights add +12% tempo and switch on the `stab` layer.

## The "creepier" pass

Three additions specifically for unease rather than just intensity:

- **`vDread`** — a slow tritone smear underneath everything, bending pitch
  over ~2 bars, rising and sinking back
- **`vScrape`** — an irregular, randomly-timed filtered noise sweep, like
  something metal being dragged nearby
- **`vWhine`** — a high sine thread, deliberately outside the current key,
  fading in and gliding down

None of these are on the beat grid — they're seeded with randomness
specifically so the gap between them is never predictable.

## Wiring into the game

- `A.music.setFloor(n)` / `setIntensity(v)` / `setBoss(bool)` are called from
  [[How A Run Goes]]'s wave/floor transitions and [[Bosses]] spawn/death
- `A.music.menu()` plays a sparse pad+arp theme on the title screen
- `A.duck()` (shared with [[Audio]]) ducks the score under boss roars and
  explosions and lets it back up
- Sits on its own bus under master, so mute covers it

## Related
- [[Audio]] — the separate SFX synthesis system
- [[Bugs Found]] — a stop/restart race condition found and fixed here
