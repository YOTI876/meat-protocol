---
title: Music
tags: [reference, engine]
---

# Music — the score

`js/music.js`. Two **original**, fully synthesised pieces written for this
game — not transcriptions or arrangements of anything. Built in the idiom a
dungeon-crawler roguelike lives in (phrygian and locrian modes, a syncopated
pulse, circling arpeggios, accumulating percussion) rather than by copying one.

> [!important] The game plays real recordings now
> Three of them — see [[#Three recordings]]. What follows describes the
> **synthesised fallback**, which runs only for a track with no file behind
> it. `N` toggles music on and off.
>
> Off is genuinely off, not muted: no scheduler, no nodes, no bus. The whole
> mix then peaks at **0.027**, which is the ambient drone in [[Audio]] and
> nothing else. The [[Audio#The ordinary sounds|sound effects]] are a
> different system on a different bus and are never affected either way.

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

## Three recordings

The game plays real tracks. The synthesised score below is the fallback, not
the default — it runs only for a slot with no file behind it.

| slot | file | plays |
|---|---|---|
| `wave` | `feral-angel-waltz.mp3` | the run — every wave, every floor but the last |
| `boss` | `burn-the-world-waltz.mp3` | boss fights, and an angry PACI |
| `final` | `mesmerizing-galaxy-loop.mp3` | **the last floor, all of it** — every wave, its boss, and the finale |

`audio/tracks.json` is the whole configuration; `audio/README.md` is the
player-facing version of this section.

**The last floor outranks the boss flag.** That is the point of the third slot:
`wantTrack()` checks `finalFloor` before it checks `boss`, so walking into
floor 10 starts one piece that runs unbroken until the run ends, and the boss
fight at the bottom of it does not interrupt itself.

```js
const k = finalFloor ? 'final' : (boss ? 'boss' : 'wave');
```

`game.js` passes that in with the floor it already knows:
`A.music.setFloor(nr, isLastFloor(nr))`.

**The title screen is silent**, deliberately. `menu()` stops everything rather
than falling back to the synth — there is no menu recording and nothing should
stand in for one. It used to get a sparse pad-and-arp arrangement.

**A boss theme starts at the top**, because that is the point of it arriving.
The floor track resumes where it left off, so a long run gets through the song
instead of restarting it after every fight — except at the start of a new run,
which always begins at the top.

Any slot may be `null`, and a slot with no file falls back to the synth rather
than borrowing another slot's music. While a file plays, the synth stops
scheduling entirely (`liveNodes: 0`) rather than playing underneath it.

`N` toggles music, on by default, stored in `localStorage` under `meat_music2`.

### Streamed, not decoded

The files are `<audio>` elements routed through `createMediaElementSource`.
This is the one decision in here worth defending, because buffers are the
obvious choice and they are wrong for this:

`decodeAudioData()` holds a whole song as float PCM — about **21MB a minute**
at 44.1kHz stereo. These three are a 13MB download and would sit near **a
quarter of a gigabyte resident**. An element streams, so the cost is a buffer
instead of a song.

The trade is that MP3 looping is not perfectly gapless the way a buffer loop
is. For multi-minute tracks under gunfire that is the right side of the trade.
A short seamless loop is the one case where decoding to a buffer wins.

Everything rides the same bus the synth does, so
[[Audio#Volume|the volume keys]], mute and `A.duck()` all keep working with no
extra wiring.

> [!note] Why a manifest rather than looking for `audio/wave.*`
> Probing three extensions across three slots would be **nine failed requests
> on every load** of a checkout with no music in it, and a console full of red
> 404s is a bad way to say "working as intended".

> [!note] Licensing
> All three are royalty-free. Note that royalty-free means no per-use fee, not
> automatically no attribution — some such licences still want a credit line,
> and some separate personal from commercial use. Nothing to act on for a
> project you play with friends; worth reading the actual terms before it goes
> on a storefront. `audio/README.md` keeps the per-track table.

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
