---
title: Music
tags: [reference, engine]
---

# Music — the score

`js/music.js`. Two **original**, fully synthesised pieces written for this
game — not transcriptions or arrangements of anything. Built in the idiom a
dungeon-crawler roguelike lives in (phrygian and locrian modes, a syncopated
pulse, circling arpeggios, accumulating percussion) rather than by copying one.

> [!important] The score is off by default
> Press **N** to turn it on. See [[#The score is off unless you ask for it]].
> Drop a real recording into `audio/` and the game plays that instead of the
> synth, looped and crossfaded, with the volume keys and the duck still
> working — see [[#A real recording, if you have one]].

## The score is off unless you ask for it

`N` toggles it, and the setting sticks in `localStorage` under `meat_music`
next to the volume. Ships **off**, because synthesised music is a stand-in for
music somebody wrote, and a stand-in should not be the thing you cannot switch
off.

Off is genuinely off, not muted: `start()` and `menu()` decline, so there is
no scheduler, no nodes and no bus. Verified — `liveNodes: 0`, `running: false`,
and the whole mix peaks at **0.027**, which is the ambient drone in
[[Audio]] and nothing else.

The [[Audio#The ordinary sounds|sound effects]] are unaffected either way. They
are a different system on a different bus, and turning the score off does not
touch them.

## Two pieces, not one

There used to be one score with a boss flag on it, and the flag only forced
`intensity` to 1 — same key, same riff, same everything, louder. So a boss did
not sound like a different thing arriving, it sounded like the same thing
turned up.

| | **THE FLOOR** | **THE THING** |
|---|---|---|
| when | the run — waves, shops, corridors | bosses, the finale, an angry PACI |
| mode | phrygian | **locrian** — no perfect fifth, nothing resolves |
| tempo | the floor's | **+14%** |
| chords | `[0, 1, 0, 6]` | `[0, 4, 1, 5]` |
| kick | backbeat, doubles when hot | **double time throughout** |
| chug | gallop | denser, and the hole in it moves |
| riff | `RIFF` | `RIFF_B` — walks further, lands lower |
| lead | `LEAD_A` / `LEAD_B` | `LEAD_C` / `LEAD_D`, leaning on the flat 2 |
| stabs | no | yes |
| dread | ×1.0 | ×1.35 |

Root and tempo still come from the **floor**, so descending darkens and
quickens both pieces. Scale and chord movement come from the **track**, which
means a boss is a different piece of music on every floor rather than one
boss theme played nine times.

Switching tracks resets `step` to 0, so the new piece starts on a downbeat
instead of halfway through the bar the last one was in.

## Intensity says how much band, not whether there is one

The gates used to decide whether the music existed. Wave 1 of floor 1 works
out to `0.12 + (1/5)*0.72 + 0` = **0.264**, which sat under the drum gate
(0.28), the guitar gate (0.34) and the arp gate (0.42). The answer was a pad
and a bass line, and it read as "this game has no music outside boss fights."

```js
const hot = boss ? 1 : (menuMode ? inten : 0.45 + inten * 0.55);
```

One line. THE FLOOR now runs from a bit over half strength to flat out; it
never runs from nothing. The same opening wave is `hot = 0.53` — drums,
gallop, power chords and arp all playing. The title screen still uses raw
`inten` so the menu stays sparse.

| layer | comes in at | role |
|---|---|---|
| **pad** | always | sustained chord tones, the room breathing |
| **bass** | always | syncopated low pulse |
| **drums** | always | kick/snare/hats, pattern thickens with `hot` |
| **gtr** | always | chug always, the power-chord wall from 0.5 |
| **lead** | `hot` > 0.62 | two bars of eighths every fourth bar |
| **arp** | `hot` > 0.42 | circling 16ths, reversing every 2 bars |
| **stab** | THE THING only | dissonant minor-2nd hits |

## Keys per floor

| floor | root | tempo (THE FLOOR / THE THING) |
|---|---|---|
| 1 | A | 84 / 96 |
| 2 | G | 90 / 103 |
| 3 | F | 96 / 109 |
| 4+ | D♯ | 101 / 115 |

## The guitar, and its three amplifiers

| voice | is |
|---|---|
| `vChug` | palm-muted low root on a gallop, choked at 55ms so it reads as a hit |
| `vPower` | root, fifth, octave. No third, which is why it fits a scale whose third keeps moving |
| `vLead` | bent up into the note over 55ms, then vibratoed at 5.6Hz |

Distortion is a **waveshaper**, not a clipped gain, so it saturates instead of
tearing: `(1+k)x / (1+k|x|)`, built once at 8192 points. Each voice runs into a
cabinet — 85Hz highpass, 3.9k lowpass, +5dB at 780Hz — because without that a
distorted saw is a wasp in a jar rather than an amplifier.

> [!important] There are exactly three amplifiers for the whole run
> They used to be built **per note**: a `WaveShaper` at `oversample: '4x'` plus
> three biquads, about ten of each a second at full tilt. That is most of
> [[Bugs Found#29. The music was not lagging figuratively — the audio clock was running at a quarter speed|defect #29]].
> A note is now two oscillators and an envelope.

### Gain staging, which is the whole ballgame

Sharing an amp is authentic — a real one takes all six strings at once, and
summing before the distortion is what makes a chord sound like a chord. But it
moves where the envelope sits, and that changes the arithmetic completely:

| | per-note amps | shared amp |
|---|---|---|
| signal path | `osc → drive → shaper → **envelope** → cab` | `osc → **envelope** → drive → shaper → cab → **trim**` |
| what the shaper sees | one note at full drive | several notes, summed |
| what sets the level | the envelope, after the clipping | the trim, after the cabinet |

Putting the envelope in front of the shaper is correct for **how hard a note
drives the amp** — that is what a palm mute physically is. What it is not is a
volume control, and the first version of this shipped without replacing the one
it removed. The result peaked at 1.176 and buzzed:
[[Bugs Found#30. Sharing the guitar amplifier turned the score into a square wave|defect #30]].

Drive is now 3.0 / 2.2 / 4.0 and the trim after each cabinet is 0.30 / 0.22 /
0.20, with a limiter across all three into the bus. **Drive is how distorted,
trim is how loud**, and they are not interchangeable.

## Scheduling

A lookahead scheduler: a 50ms `setInterval` queues notes **~750ms** ahead
against exact `AudioContext` timestamps (`nextT`), never against `Date.now()`.

`LOOKAHEAD` was 0.12s, which is **less than one bad frame in this game** — see
[[Rendering#The effect ceilings, swept]], where the worst frame is 50ms at
every setting and 83ms was measured before the light blob was baked. A 130ms
stall and the queue ran dry mid-bar. The cost of 0.75s is that a change in
intensity takes up to that long to become audible, and for music that is not a
cost.

Easing runs on **wall time**, not per tick:

```js
bpm   += (bpmTarget - bpm)     * Math.min(1, dt * 1.6);
inten += (intenTarget - inten) * Math.min(1, dt * 1.2);
```

A per-tick factor silently changes how fast the music responds every time the
tick rate is touched, and the tick rate has now been touched twice.

## Nothing is left connected

Every voice registers its nodes with an end time; `tick()` disconnects
anything past it. This is not tidiness — a connected Web Audio node is a
*rendered* node whether or not anything is feeding it, and the graph used to
only ever grow. See
[[Bugs Found#29. The music was not lagging figuratively — the audio clock was running at a quarter speed|#29]]
for what that actually cost, and
[[Instrumentation#Is the audio thread keeping up?]] for how to check it.

`MUSIC.debug().liveNodes` is the number in flight. It should sit between about
20 and 60 and go **flat**, not up.

## The "creepier" pass

Three things for unease rather than intensity, none of them on the beat grid:

- **`vDread`** — a slow tritone smear underneath everything, bending over ~2
  bars. Scaled by the track, so THE THING gets it 35% louder.
- **`vScrape`** — irregular filtered noise, like metal being dragged nearby
- **`vWhine`** — a high sine thread deliberately outside the key

## A real recording, if you have one

The score is synthesised because a recording has an owner. Picking one is a
licensing decision, not a technical one, so the game defers it to you:

1. put the file in `audio/`
2. name it in `audio/tracks.json`

```json
{ "wave": "myband.ogg", "boss": "myband-heavy.ogg" }
```

Either entry may stay `null` — **a track with no file of its own falls back to
the synth**, so shipping only a boss theme is a supported thing to do. Files
are looped and crossfaded over ~0.9s on a track change, and they ride the same
bus the synth does, so [[Audio#Volume|the volume keys]], mute and `A.duck()`
all keep working with no extra wiring.

While a file is playing the synth stops scheduling entirely (`liveNodes: 0`)
rather than playing underneath it.

> [!note] Why a manifest and not just looking for `audio/wave.ogg`
> Probing three extensions × two tracks meant **six failed requests on every
> load** of a game that ships with no music files. A console full of red 404s
> is a bad way to say "working as intended". The manifest ships with both
> entries `null`, so a default checkout makes one request and it succeeds.

`audio/README.md` has the list of places that hand out music with a licence
attached.

## Wiring into the game

- `A.music.setFloor(n)` / `setIntensity(v)` / `setBoss(bool)` from
  [[How A Run Goes]]'s wave and floor transitions and [[Bosses]] spawn/death
- `A.music.menu()` — sparse pad+arp on the title screen
- `A.duck()` (shared with [[Audio]]) ducks the score under roars and explosions
- Its own bus under master, so mute and the volume keys cover it

## Related
- [[Audio]] — the SFX synthesis system, which had the same leak
- [[Instrumentation#Is the audio thread keeping up?]] — how #29 was caught
- [[Bugs Found#29. The music was not lagging figuratively — the audio clock was running at a quarter speed|Bugs Found #29]]
- [[Tuning Values]] — `LOOKAHEAD`, the `hot` floor, the track table
