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

## The guitar layer

The score gained a sixth layer, and it is the loudest thing in it. It lives in
[[Music#The guitar, and its three amplifiers|Music]] — this is the short
version. Three voices, because a rhythm guitar is not one sound:

| voice | is |
|---|---|
| `vChug` | palm-muted low root on a **gallop** — long, short-short — choked at 55ms so it reads as a hit rather than a note |
| `vPower` | root, fifth, octave. No third, which is exactly why it fits a scale whose third keeps moving |
| `vLead` | one voice up top, bent up into the note over 55ms and then vibratoed at 5.6Hz |

It did not have to be bolted on. The score was **already phrygian and
locrian** — the harmony metal borrowed in the first place — so the guitar
plays the same scale degrees as the pad and the bass, off the same `nf()`.

Distortion is a **waveshaper**, not a clipped gain, so it saturates instead of
tearing: a soft asymptotic curve, `(1+k)x / (1+k|x|)`, built once at 8192
points. Each voice runs into a cabinet — highpass at 85Hz, lowpass at 3.9k, and
a +5dB peak at 780Hz. Without that last stage a distorted saw is a wasp in a
jar rather than an amplifier.

> [!warning] There are three amplifiers, not one per note
> They used to be built per note, and that was most of
> [[Bugs Found#29. The music was not lagging figuratively — the audio clock was running at a quarter speed|defect #29]].
> A note is two oscillators and an envelope; the amps are built once.

The guitar is no longer gated — it plays from the first wave of the run. What
intensity moves is how dense it is: the gallop fills in at **0.66**, the
power-chord wall arrives at **0.5**, the lead at **0.62**. See
[[Music#Intensity says how much band, not whether there is one]].

## Volume

0.45 used to be a literal in two places, so the only choice was all or nothing
and unmuting always went back to whatever the literals said.

| key | does |
|---|---|
| `-` / numpad `-` | quieter |
| `=` / numpad `+` | louder |
| `M` | mute toggle, unchanged |

Eleven steps, stored under `meat_vol`. The curve to gain is **squared**,
so the quiet half of the range has somewhere to go instead of being all one
loudness, and step 0 is silence. The score rides the same master, so turning
the game down turns the music down with it rather than leaving a band playing
over nothing.

## The ordinary sounds

Ten events that used to be silent. None is a set piece — they are the noises a
room makes while you move around in it, and their absence is the sort of thing
you notice without being able to name.

| sound | fires on |
|---|---|
| `levelup` | the hand arriving — an arpeggio up a major triad, the only consonant sound in the game |
| `cardTake` | a card taken |
| `ricochet` | a round that hit masonry instead of meat |
| `thud` | a body meeting a wall, or another body |
| `click` | the empty-magazine click, distinct from `dryfire`'s whole failed action |
| `alert` | an enemy noticing you |
| `floorClear` | the floor going quiet |
| `lowHealth` | crossing into the red, once per crossing |
| `stomp` | something big landing |
| `blip` | the volume keys, so the change is audible at the level you just set |

## Nothing is left connected

Every sound effect in here goes through `env()`, so `env()` is where the
clean-up goes: each chain is registered with an end time and disconnected
once it is past. The sweep is amortised onto the calls themselves, so a quiet
game keeps no timer alive.

This is not tidiness. **A connected Web Audio node is a rendered node whether
or not anything is feeding it**, and before this there was not one
`disconnect()` in either audio file. A firefight is a hundred new nodes a
second, none of them ever released. See
[[Bugs Found#29. The music was not lagging figuratively — the audio clock was running at a quarter speed|defect #29]]
for what it cost and [[Instrumentation#Is the audio thread keeping up?]] for
how to check it has not come back.

> [!note] A suspended context is silence too
> Browsers suspend an `AudioContext` when the tab goes away and do not always
> hand it back. Alt-tabbing out of a fight and back was one of the ways the
> sound simply stopped; `visibilitychange` now resumes it.

## Related
- [[Music]] — the generative score, a separate always-running system
- [[Bugs Found]] — the GOROMANIA volume/pitch adjustment pass
