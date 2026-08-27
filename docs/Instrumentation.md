---
title: Instrumentation
tags: [reference, engine, engineering]
---

# Instrumentation

The frame-time probe, the F3 overlay, and `MEAT.soak()` — the measurement
harness the performance work runs on. All of it is measurement: nothing here
changes a gameplay number, and the moment it does it has stopped being a probe.

## F3 / F4

| key | does |
|---|---|
| **F3** | toggle the debug overlay (and reset the rolling window) |
| **F4** | toggle `PROBE.drain` — only while F3 is on |

The overlay draws on `#overlay`, **last**, after the fade and after every modal
screen. That is deliberate: [[Rendering#Two-canvas split|`uiWipe()`]] clears the
overlay and every screen that paints over the world calls it, so a probe drawn
any earlier would vanish exactly when you stopped to look at something.

Anything with a ceiling gets a bar as well as a number, because the question a
pool asks is never "how many" but "how close to the cap". Amber at 70%, red at
90%.

## What it reports

- frame **avg / p95 / p99** over a rolling 3s window, plus worst-in-window and
  worst-ever
- **update vs draw**, with draw split into `drawWorld` (minus the two below),
  the **actor pass** (`drawEnemy` × n + `drawPlayer`), **particles**,
  `drawLight`, `post`, and the HUD/screen
- `S.en` + `S.cracks` against the live
  [[Difficulty Scaling#Concurrent cap|cap]], and the queue remaining
- every pool against its ceiling: particles/900, gibs/420, rings/80, `S.fx`/12
- **sprite cache size** — the one number that should never climb during play.
  [[Rendering#It used to be one enormous pixel loop, and that was the lag|An entire ten-floor run bakes
  29 canvases]]; anything growing frame on frame is a cache key with a
  continuous value in it, which is
  [[Bugs Found#2. God-mode rainbow tint leaked the sprite cache|Bugs Found #2]].

## Two things the timings cannot tell you

> [!warning] The clock is coarsened to 100us
> A page that is not cross-origin isolated has `performance.now()` quantized to
> **100 microseconds** as an anti-Spectre measure. Measured here:
> `clockQuantum_us: 100`, `crossOriginIsolated: false`.
>
> Any single phase under about half a millisecond is therefore reported as 0.0
> or 0.1 and nothing in between. The quantization dithers frame to frame, so a
> **windowed average recovers real resolution** — 180 frames of a 100us quantum
> averages to roughly 7us — but a **single frame's split is noise**. Averages
> are safe to reason about. Individual frames are not.
>
> `PROBE.overhead()` reports the quantum so this is never taken on trust. To get
> 5us back, serve the page cross-origin isolated (COOP + COEP in `serve.js`) — a
> change to the server, not to the probe.

> [!warning] Wall-clock brackets under-report canvas work
> The same warning as
> [[Rendering#It used to be one enormous pixel loop, and that was the lag|the
> floor bake]]: draw calls queue, and the real cost lands on whatever later call
> forces a flush. The draw split attributes JS-side time honestly and GPU-side
> time badly.
>
> `PROBE.drain = 1` (F4) forces a 1px readback after every phase, which makes
> attribution accurate and frame pacing meaningless. Use it to find out **where**
> time goes, never **how much**.
>
> **This warning was written, published, and then ignored.** The particle pass
> measures 0.35ms at 900 live particles with `drain` off, and that figure was
> used to rule out batching the effects layer. The effects layer turned out to
> be ~75% of the burst stall. See
> [[Bugs Found#26. The probe measured draw calls being ISSUED, not drawing]].

## How to attribute GPU-side cost

The phase split cannot do it, and no bracket around JS can. The only instrument
that works is **an A/B that changes what reaches the screen while leaving the
JS as close to identical as possible, measured on the frame gap**:

- keep the same kills, the same spawns, the same call counts
- change one thing about what is *drawn* — a ceiling, a blend mode, a pass
- read **frames over budget** and **total stall**, never the phase split
- interleave the arms and take medians of at least four reps; a single capture
  on this machine has varied from 0 to 22 over-budget frames on the same
  scenario

When the phase split and the frame gap disagree, **the frame gap is right**.

Probe cost, measured rather than claimed: 11 `performance.now()` calls a frame,
**~6us**, **0.036%** of a 16.7ms budget.

## Is the audio thread keeping up?

Nothing else on this page can answer that. Frame time, the frame gap, `PROBE`
and `MEAT.FX` all measure the **main thread**. Web Audio renders on its own
thread with its own deadline, and it can be drowning while every frame number
you have looks perfect — which is exactly what
[[Bugs Found#29. The music was not lagging figuratively — the audio clock was running at a quarter speed|#29]]
was.

The audio thread has one honest tell: **`ac.currentTime` is not a clock you
read, it is a report of how many samples have actually been produced.** If it
falls behind wall time, the thread is not keeping up, and everything you hear
is slow, glitching, or absent.

```js
const rate = async (ctx, ms) => {
  const a = ctx.currentTime, w = performance.now();
  await new Promise(r => setTimeout(r, ms));
  return (ctx.currentTime - a) / ((performance.now() - w) / 1000);
};
```

A healthy context returns ~1.0.

### Run a known-good copy beside it

A single ratio is not evidence — a throttled tab, a busy machine or a headless
harness can all drag it down, and this machine's variance is severe
([[#Two things the timings cannot tell you]]). So open a second, empty
`AudioContext` in the same tab at the same moment and measure both:

```js
const bare = new AudioContext();
const [b, g] = [await rate(bare, 4000), await rate(gameCtx, 4000)];
bare.close();
```

Anything affecting the tab, the browser or the machine hits both. A gap between
them is the graph, and only the graph. The reading that found #29:

```
bare   0.985x
game   0.167x
```

This generalises past audio. It is the same move as
[[#How to attribute GPU-side cost]]: when you cannot instrument a thing
directly, put a known-good copy of it next to the suspect and diff.

### Sample it over time, not once

Cost and accumulation look identical in a single reading and completely
different in six. Take one every five seconds:

- **flat and low** — the graph is genuinely too expensive. Cut work.
- **falling** — something is being created and never released. Count what.

#29 read 0.450 → 0.418 → 0.345 → 0.315 → 0.284 → 0.270 over thirty seconds.
Monotonic, so: a leak.

### Counting what leaked

Wrap the factory methods before anything builds a graph, and you get the rate
and the culprit in one pass:

```js
['createOscillator', 'createGain', 'createBiquadFilter',
 'createWaveShaper', 'createBufferSource'].forEach(k => {
  const o = AudioContext.prototype[k];
  AudioContext.prototype[k] = function (...a) {
    counts[k] = (counts[k] || 0) + 1;
    return o.apply(this, a);
  };
});
```

Divide by elapsed seconds. 158 nodes a second, ten of them `WaveShaper`s at
`oversample: '4x'`, is not a mixing decision — it is a defect with a rate.

`MUSIC.debug().liveNodes` reports what the score currently holds connected.
**Watch the trend, not the value.** 20–60 and flat is healthy; anything that
climbs and does not come back down is the same bug returning.

## `MEAT.FX` — one switch per thing a hit does

"It feels laggy" is not one symptom. Real dropped frames and
[[#Hitstop is a second symptom in the same clothes|hitstop holding the
simulation at 8%]] while the screen keeps painting at 60 feel nearly identical
from the chair, and no amount of profiling settles which one a player is
reacting to. These are for settling it **by feel** — flip one from the console,
play the same fight, see whether it changed.

```js
MEAT.FX.hitstop = 0      // and back to 1
```

| switch | `0` turns off | verified by |
|---|---|---|
| `hitstop` | the 8% time-scale after a kill — the kill still lands | a body travels **2.3px** in six frames with it, **14.9px** without |
| `flash` | the white tint on an enemy that just took a hit | drawn brightness 712633 → 641243 |
| `knock` | knockback from a bullet — **gameplay**, bodies stop moving | struck enemy `vx` 97.6 → −5.5 |
| `burst` | `deathBurst()`: the pop, gibs, meat cloud, sparks, embers | a kill makes 60 particles + 12 gibs → 0 and 0 |
| `decals` | `blood()` painting the arena-sized decal canvas | 23.4µs → 5.6µs a hit |
| `eyes` | the two additive eye dots per enemy | drawn pixels differ |
| `lights` | the lightmap hole per enemy and per ring | room goes visibly darker |

Only `knock` changes gameplay; the rest are presentation. `hitstop` still
drains its timer when off, so turning it off cannot strand the game in slow
motion.

## What a plain bullet hit costs

The **hit** path, not the kill path — you hit far more things than you kill, so
it is worth knowing separately. Median of seven runs of 3,000 non-lethal,
non-crit hits:

| on the frame a bullet lands | µs |
|---|---|
| `blood()` — 6 + r×2 individual `fillRect` calls onto the decal canvas | **17.8** |
| `ST()` — the stat table, rebuilt from the deck | **6.3** |
| knockback, the `e.hit` flash flag, squash, `spray()`, `impact()`, the damage number | **< 1 combined** |
| **total** `damageEnemy()` | **23.5** |
| a crit on top (`A.hit()`, 10 particles, a ring) | +0.9 |

> [!note] Three things the hit path does NOT do
> It never touches `S.hitstop`. It never shakes the screen. It never builds a
> gradient. Those all belong to the kill path, and the suspicion that a hit
> carried its own copy of them is measurably wrong.
>
> The flash tint mints **exactly one** sprite-cache entry, the first time it is
> used, and none after. It is a constant string, so it cannot leak the way
> [[Bugs Found#2. God-mode rainbow tint leaked the sprite cache|#2]] did.

> [!note] A bullet used to hit ONE enemy per frame, whatever its pierce
> The collision loop in `updateBullets()` breaks after the first enemy it
> finds. `pierce: 99` does not mean 99 bodies on one frame — it means the
> round survives to hit one more on the NEXT frame. A slug through six enemies
> is six consecutive frames, each paying a hit and, if lethal, a kill and
> another 0.035s of hitstop. That is why a pierce shot cannot be made to
> produce a multi-kill frame in a harness, and it is most of why it feels the
> way it does.

At nine hits on one frame — a shotgun into a crowd, the worst realistic case —
the whole hit path is **2.3% of a frame**. It is not the hitch.

## Hitstop is a second symptom in the same clothes

`killEnemy()` does `S.hitstop = Math.max(S.hitstop, 0.035)`, and `update()`
scales `dt` to **8%** while it runs — draw is untouched. `Math.max` means ten
simultaneous kills buy one kill's worth, which is right. What is not right is
that it **re-arms on every kill**: 0.035s is about two frames at 60Hz, so kills
arriving faster than every two frames hold the simulation in near-freeze
indefinitely. Measured on a burst: active on **20 of 40 frames** through a
pierce shot and **28 of 50** through a NOVA.

Nothing is dropping a frame in that window. The screen is painting at 60 and
almost nothing is moving, which from the chair is indistinguishable from a
stall. `MEAT.FX.hitstop = 0` is how you tell them apart.

## `MEAT.soak(opts)`

```js
MEAT.soak({ floor: 3, wave: 3, seconds: 30, seed: 7, mode: 'kill' })
```

| option | |
|---|---|
| `floor` | 0–9, the `S.room` index (default 0) |
| `wave` | 1–`WAVES` (default 3) |
| `seconds` | simulated, stepped at a fixed 1/60 (default 30) |
| `seed` | same seed, same run (default 12345) |
| `mode` | **fill** — invincible, never fires; the arena fills to the cap, which is the scenario [[Difficulty Scaling#Measured — ordinary waves\|the existing tables]] were taken under. **kill** — invincible, fires continuously at the nearest enemy. |
| `samples` | seconds at which to snapshot (default 3, 10, 20, 30) |
| `drain` | force a flush per phase — see the warning above |
| `verify` | `false` skips the verification pass and halves the cost |

Returns a JSON-safe summary at each mark: frame times, the phase split, entity
counts against the cap, every pool against its ceiling, the sprite cache, kills,
`mode`, and an `overCap` string that is non-null whenever a pool has exceeded
its own ceiling.

`modeFrames` counts how many stepped frames were spent in each mode. A soak that
spends half its length on a level-up hand is not measuring what the caller
thinks it is — and, as it turned out, the pools do not tick in those frames at
all. See [[Bugs Found#23. The pool caps did not run while a menu was open]].

### Determinism, and what it cost to get

`MEAT.soakDiff(opts)` runs the same soak twice and reports the **first frame at
which the two diverge**, field by field. A harness that claims determinism
without checking it is a harness that will quietly stop being deterministic.

Getting there found four causes, three of them fixed:

1. **Frame 0 had an arbitrary `dt`.** `frame()` derives `dt` from the
   module-level `last`, which held whatever the previous caller left there — the
   live rAF loop on a cold page, the tail of the previous soak otherwise. So the
   opening frame got anything in `[0, 0.05]`: a cold page produced the clamp
   *ceiling*, a repeat run produced *zero*. One frame of difference in the
   opening `dt` moves `spawnT` by 0.05s, which changes which frame the first
   batch lands on, which changes everything after it. **Fixed:** `last = ts`
   before the first step.
2. **Setup left the RNG at an unpredictable stream position.** `startRun()` and
   `buildRoom()` spend a draw count that is not stable across calls, so
   `startWave()` — which samples the enemy type table once per queued body — was
   building a *different wave* every time. **Fixed:** each stage re-seeds, so no
   stage inherits the draw count of the one before it.
3. **The fingerprint hashed `queue.length` and not the queue's contents**, so
   two completely different waves compared as identical. That is why cause 2 hid
   for as long as it did — the test was wrong before the code was, which is
   [[Bugs Found#11. Crates spawning on Damjan's head|the same lesson as the
   flood-fill audit]]. **Fixed:** hash the contents.
4. **Something about the first execution of a given soak *shape* in a page
   session still shifts it.** Not isolated. A second call with the same options
   is stable, and every call after that is byte-identical to it.

Cause 4 is handled structurally rather than by warming, because warming turned
out to depend on the soak's shape. `soak()` runs the scenario, throws it away,
runs it again, and returns the second — with **`verified`** saying whether the
two agreed. A caller cannot accidentally read a cold result, and if the build
ever becomes genuinely non-deterministic, `verified: false` says so in the
result instead of hiding inside a number that looks plausible.

> [!note] Milliseconds from a soak are a shape, not a measurement
> Driving frames synchronously with no `requestAnimationFrame` between them
> makes draw calls batch and flush in clumps, which manufactures 40–90ms spikes
> no player ever sees —
> [[Rendering#It used to be one enormous pixel loop, and that was the lag|Rendering
> says so explicitly]]. Treat the **counts** as authoritative and the
> **milliseconds** as indicative, and take real frame timings off a Chrome
> performance trace.

## Related
- [[Rendering]] — the render scale, the pipeline, and the floor-bake lesson
- [[Difficulty Scaling]] — the caps and formulas the probe reads
- [[Bugs Found]] — including what this harness found on its first run
