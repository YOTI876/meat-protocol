---
title: Audio
tags: [reference, engine]
---

# Audio (SFX)

`js/audio.js`. Every sound effect is synthesized live with the Web Audio API
— zero audio files anywhere in the project. See [[Music]] for the separate
generative score system.

## Building blocks

- `tone(type, f0, f1, vol, dur, t0)` — an oscillator with an exponential
  frequency sweep and envelope
- `burst(vol, dur, t0, filterType, f0, f1, q)` — filtered noise, used for
  every "impact" sound (gunfire, explosions, footsteps, cracks)
- `env()` — shared exponential attack/decay envelope
- A single shared 2-second noise buffer (`makeNoise()`) reused for every
  burst-based sound

## Per-weapon voices

Each [[Weapons|weapon]]'s `sfx` field maps to a dedicated function —
`shotgun()`, `nailgun()`, `plasma()`, `minigun()`, `railgun()`, `beam()`,
`slicer()`. The
base rifle uses `scarMk(lv)` instead, which **morphs** its own timbre based on
the [[Progression#The evolving sidearm|current mark]] — the noise body thins,
pitch rises, and a laser-like tone layer fades in as `lv` climbs from 1 to 10.

## The slicer's two sounds

THE DELI SLICER is the only weapon with a sound for its round *arriving*.
`slicer()` is the throw — a **rising** sawtooth sweep (300→1150Hz), because the
wheel is speeding up as it leaves rather than detonating, plus a thin square
ring on top so it lands as steel and not as another plasma noise. `sliceHome()`
is the catch: short, bright, and sweeping **upward** (2400→5200Hz), which is
what separates a catch from an impact.

It also skips `shell()`. A thrown disc has no case to eject, and it used to
drop one on the floor anyway — see [[Weapons#THE DELI SLICER]].

## Formant speech

Both [[Secrets|MODAGAZ and GOROMANIA]] are actual synthesized speech, not
a sample. `speak(syllables, f0, vol)` builds each syllable from:
- a plosive/noise consonant attack
- a sawtooth carrier with vibrato, shaped by 3 bandpass filters at fixed
  formant frequencies (`VO`/`VA`/`VI` — vowel-like resonances)
- a sub-oscillator underneath so it carries on small speakers

`modagaz()` and `goromania()` are just different syllable/pitch presets over
the same `speak()` engine.

## Mixing

A master gain node feeds the destination; a separate `musicBus` sits between
[[Music]] and master so **mute covers both**, and `A.duck()` pulls the score
down under boss roars and explosions without touching SFX volume.

## Related
- [[Music]] — the generative score, a separate always-running system
- [[Bugs Found]] — the GOROMANIA volume/pitch adjustment pass
