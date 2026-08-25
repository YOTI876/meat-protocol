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
