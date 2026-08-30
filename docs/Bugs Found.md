---
title: Bugs Found
tags: [reference, history, engineering]
---

# Bugs found (and fixed) during development

Every entry below was a real defect caught by headless testing before it
shipped to you — driving the game via `window.MEAT` and `frame()` calls in
the browser console, not just reading the code. Kept here so the reasoning
behind each fix isn't lost.

> [!note] Screenshots don't work in this harness
> The browser pane won't composite the canvas, so **every** check in this file
> is numerical: overlay ink bounding boxes instead of "does it look right",
> driven `MEAT.frame(t)` calls instead of watching, entity and particle counts
> instead of eyeballing a burst. That constraint is why the bugs below were
> found at all — you cannot squint at a number.

## 1. The secret was unreachable
**Found:** during the very first build, before the first commit.
Bullets stop at a wall's *inner face*, but the hidden brick's hit-test
checked against its full drawn rectangle — which extended past that face.
The collision could never actually land. **Fix:** test the brick's column
against the specific wall segment (`wl === S.walls[0]`) instead of a general
rectangle overlap.

## 2. God-mode rainbow tint leaked the sprite cache
**Found:** same pass. Every sprite draw with a rainbow tint baked
`S.t`-derived hue directly into the cache key, so god mode minted a brand
new cached canvas *every single frame*, forever. **Fix:** `godTint()`
quantizes hue to 12 discrete steps before it reaches the cache key.

## 3. Shrieker strafe direction was degenerate
**Found:** same pass. `tx = -ty; ty = tx` reassigns `tx` before using its old
value on the next line — the swap silently used the *new* `tx`. **Fix:**
route through a temporary variable.

## 4. Negative frame delta crashed the render loop
**Found:** while building the weapons/grenades/economy rewrite. A clock jump
(tab switch, in this case a test harness artifact) produced a negative `dt`,
which indexed the film-grain array out of bounds and threw inside `frame()`
every subsequent call — a silent freeze. **Fix:** clamp `dt` to `[0, 0.05]`
before anything else touches it.

## 5. The spawner made deeper floors *emptier*
**Found:** measuring actual spawn counts before committing "more enemies as
you go deeper." The old spawner spent a growing **point budget** on enemies
priced by toughness — so as the budget grew, it increasingly bought fewer,
tougher enemies. Floor 2 wave 1 queued **4** enemies against floor 1 wave 1's
**9**. Going deeper was making the arena *emptier*. **Fix:** replaced budget
spending with a direct head-count formula — see [[Difficulty Scaling]].

## 6. Screen shake was vibration, not shake
**Found:** while implementing "smooth" screen shake. The existing code
picked a new random offset *every frame*, which reads as high-frequency
noise, not a camera recoiling and settling. **Fix:** layered sine waves with
a random phase chosen once per impulse (`shake()`), so the camera swings and
decays instead of jittering.

## 7. Item pickup banner crashed on every frame it was visible
**Found:** during a full soak test that granted every item and weapon in
sequence — the banner code referenced an `a` (alpha) variable that was never
declared in that scope, throwing `ReferenceError` on every single frame the
banner showed. Only surfaced because the soak exercised that path; a quick
manual test wouldn't have hit it reliably. **Fix:** declare `const a = clamp(...)`
before using it.

## 8. Music could go silent after a fast death/restart
**Found:** while building [[Music]]. `stop()` faded the score out and
scheduled the actual `clearInterval` **1.4 seconds later**. Dying and
restarting inside that window let the *old* stop timer fire after the new
session had already started, silently killing the score for the rest of the
run. **Fix:** a monotonically-increasing `stopToken`; the delayed callback
checks it still owns the timer before clearing anything.

## 9. Damjan had a gap through his stomach
**Found:** reported directly, then confirmed by reading the sprite math. The
15-row body sprite was drawn centred so it ended at **y+2.5**; the legs
sprite was centred so it began at **y+4.5** — a 2px transparent band across
the waist, visible against any lit floor. **Fix:** added a 16th torso row to
the body sprite and repositioned the legs to **y+5.5**, so the edges meet
exactly (verified numerically: body bottom `+3` = legs top `+3`).

## 10. Wave 4 started while the shop was still fading in
**Found:** first end-to-end test of [[The Shop]]. `waveT` goes negative and
*stays* negative until something changes `waveState`, so the moment
`enterShop()` cleared `S.shopDue` and started its fade, the very next frame
re-entered the same branch, found `shopDue` false, and started the next wave —
behind the fade, in a room that was about to be swapped out. **Fix:** gate the
whole clear-branch on `!S.fadeDir && !S.pending`, and set
`waveState = 'shop'` synchronously in `enterShop()` rather than waiting for
the fade to land.

## 11. Crates spawning on Damjan's head
**Found:** flood-fill audit of the new [[Rendering#Arena layouts|layouts]].
The arena margin is measured from the arena *edge*, which leaves a block
legally able to sit 22px above the bottom wall — exactly where the player
lands on a floor transition. Scatter had always had this hazard; the
deliberate layouts, which place bigger blocks on a grid, made it hit ~5% of
builds. **Fix:** explicit keep-outs over the spawn pad and the door approach
in `place()`. Re-audited over 400 arenas: zero blocked spawns, zero
unreachable pockets, door always reachable.

> The first version of this audit reported 15 failures that were all
> quantization artifacts of an 8px grid with a 7px dilation. Worth knowing:
> the test was wrong before the code was. Re-running with exact
> circle-vs-rect geometry is what separated the real defect from the noise.

## 12. The shop ate your boss item
**Found:** reading `S.vacuum` while checking what the room swap destroys. The
wave-end vacuum has an explicit `!perm` guard — [[Groceries|groceries]] and
the [[Secrets|Eye]] are never hoovered up, you have to walk to them. Every
previous room swap was player-initiated (you walk to the door), so that was
fine. The shop opens on a **timer**, 3 seconds after the wave clears, with no
input from you — so clearing `S.drops` would have silently deleted the item
the boss had just dropped. **Fix:** carry permanent drops into the shop, lay
them out between the entrance and the exit, and carry any still-uncollected
ones back out again.

## 13. Deep floors overshot the enemy cap
**Found:** measuring frame time on a deep-floor soak. The concurrency gate
counted only enemies that were already *breathing*. Cracks take 0.75s to
hatch, spawn batches fire every 0.15s, and batch size grows with floor — so a
deep floor could put five batches (~90 enemies) in the air before the cap
noticed any of them. Floor 14 was landing **159** live against a cap of 78.
Since the enemy separation pass is O(n²), that was the first thing that would
have broken the frame budget on a long run. **Fix:** count `S.cracks.length`
in the gate too. Live count now holds at 83–87 out to floor 26 while the
per-wave total keeps climbing past 679 — see the table in
[[Difficulty Scaling#Concurrent cap]].

## 14. A menu inside the first 2.2 seconds killed the floor permanently
**Found:** reported as *"there are no enemies when I evolve"*, and it was not
an [[Economy#Evolution|EVOLVE]] bug at all — EVOLVE only made an old one easy
to hit.

Wave 1 was started from a wall-clock `setTimeout` at the bottom of
`startRun()`:

```js
setTimeout(() => { if (S.mode === 'play' && S.wave === 0) startWave(1); }, 2200);
```

Wall-clock keeps running while you are on a menu, and the timer fires **once**.
Open the pause screen, THE DECK, or a level-up hand inside that opening window
and the `S.mode === 'play'` guard threw away the only `startWave(1)` call the
run was ever going to get. The floor then sat there for as long as you cared to
stand in it: no enemies, so no kills, so no drops and no coins — which is
exactly the three symptoms that got reported.

Reproduced deterministically by pausing 30 frames into a run and holding it
past the window: `wave=0, queue=0, en=0` and no recovery, ever.

Rare on a cold start, because nobody opens a menu two seconds into a run they
just started. Common after EVOLVE, which drops you into a brand new run
*straight off a menu*, holding a gun you have every reason to want to look at.
`nextRoom()` carried the same defect on a 2600ms timer.

**Fix:** `S.introT` / `S.introMsgT`, counted down in `update()` — which only
ticks in play, so a menu **pauses** the opening beat instead of consuming it.
They are also held while a room fade is in flight, so a wave can never land in
the half-built room the fade is hiding, and `freshState()` clears both, so
restarting can no longer leave an orphaned timer from an abandoned run pointing
at the new one.

## 15. Every elite in the game spawned with a NaN health bar

**Found:** by an elite-vs-boss ratio test that returned `null`.

Shuffling the [[Bosses#The roster is shuffled, and that took a rewrite|boss
roster]] meant taking `hp` off the roster entries — a floor's difficulty cannot
be a property of *which* boss it is if the order is random. `spawnBoss()` was
moved onto the new `BOSS_HP` table. `spawnMini()` was not: it still read
`BOSSES[bossIndexFor(S.room)].hp`, a field that no longer existed.

`undefined * 0.22 * flavour * powerMul()` is `NaN`, so every elite spawned with
`hp = max = NaN` — an unkillable enemy behind an empty bar.

**Fix:** one function, `bossBudget(floor)`, and both spawn paths go through it.
An elite can no longer be priced against a different number than the boss it is
a share of, because there is only one number.

## 16. The level-up screen swallowed the ending

**Found:** driving the finale to death in the harness and watching `S.won` stay
true while `S.winT` never moved.

The finale's own kill still runs `gainXP`, which can level you up on the last
hit. Two things then went wrong at once: the hand opened **over** the victory
beat, and it **stalled** it, because the win countdown only ticks in
`mode === 'play'`.

**Fix:** `if (!S.won && S.upgPts > 0)` on the level-up branch, and the win path
zeroes `S.upgPts`, `S.sigDue` and `S.pendingLuck`. You have won; there is
nothing left to spend a pick on.

## 17. `pillars` floors furnished themselves from two props

**Found:** a distribution audit over 120 `buildRoom()` calls per floor.

`place()` takes a `kind` hint, and the `'vat'` hint — which the `pillars`
layout passes for **every** column — mapped to `kinds[0..1]` only. So THE
HOLLOW and THE SALT LINE, the two `pillars` floors, drew from a two-item list
while every other floor drew from four or five. The prop sets were written and
then half-ignored.

**Fix:** a triangular bias (`rng() * rng()`) that favours the head of the list
without excluding the tail, plus a post-layout pass that **retags the blocks
furthest from the arena centre** until each floor holds at least two of
`kinds[0]` and one of `kinds[1]`. The guarantee is paid for at the edges of the
room, where a swapped prop changes the fight least.

## 18. `drawDeck` threw the instant the deck screen opened

**Found:** rendering all eleven screens in a loop, which is a test that exists
precisely because a screen nobody opened during a code change is a screen
nobody tested.

`ReferenceError: sigs is not defined` — a leftover local from the
[[Groceries|signature]] chip block, still being read by the "you have taken no
cards yet" branch after the block around it was deleted.

**Fix:** `if (!S.cardsTaken)`. The lesson is the test, not the typo: a deleted
system leaves references in places that only run on screens you are not
looking at.

## 19. The pistol opened every run on 14 rounds in a 12-round magazine

**Found:** reading the HUD during an unrelated check, which is the only reason
it was found at all — nothing throws, and `14/12` is the kind of thing you see
a hundred times without registering.

`makePlayer()` hardcoded the starting magazine:

```js
owned: ['pistol'], wi: 0, mags: { pistol: 14 },
```

That `14` was correct when the pistol held 18 and something else set it; when
[[Weapons#The magazine, and why 12|the pistol was cut to 12]] the literal was
missed. Every run therefore started with **two rounds the gun does not have**,
and the ammo readout opened on `14/12`.

**Fix:** `mags: { pistol: WEP.pistol.mag }`. The number is read off the gun and
never typed twice, so it cannot drift again.

> The lesson is the duplication, not the arithmetic. A magazine size that
> appears in two places is a magazine size that will disagree with itself.

## 20. The run clock ran while you were reading a menu

**Found:** by testing the thing immediately after building it — 600 frames of
play, then 300 frames on the pause screen, asserting the clock had not moved.
It had, from 10.05s to 15.06s.

`S.runT += rdt` went at the top of `update()`. But `update()` is called **every
frame in every mode** — the `if (S.mode !== 'play') return` guard sits forty
lines further down, and it is that guard, not the call site, that makes the
rest of the function play-only. So the run timer counted the pause screen, THE
DECK, level-up hands and PACI's room.

**Fix:** move the increment below the guard. Verified frozen across all eight
non-play modes, and it resumes correctly.

This is the same misreading as
[[#14. A menu inside the first 2.2 seconds killed the floor permanently|#14]]
from the other direction: there, wall-clock time ran when it should not have;
here, a game-time counter ran on menus because it was placed above the line
that defines "in play".

## 21. A moustache, from two bars of similar width

**Found:** reported on sight — *"he looks so weird now with his mustache"* —
after the [[Rendering#What he is|character rebuild]].

Not a code defect; an art one, and worth recording because the rule
generalises. The face put a **4px dark nose base** on row 11 and a **6px dark
mouth** on row 12, directly beneath it. Two solid horizontal bars, stacked,
immediately under the nose. At sixteen pixels tall the eye does not resolve
that as "nose, then mouth" — it resolves it as a moustache.

**Fix:** nose base to 2px, mouth to 4px. Two rules came out of it:

- **never stack bars of similar width** — make them differ enough to read as
  separate features
- **a mouth is a short line**, not one approaching the width of the jaw

## 22. Elite summons bypassed the enemy cap

**Found:** in a real Chrome trace, on a floor that actually ships. Floor 8,
wave 4, **one** elite alive, the spawn queue already **empty**, nobody firing:

```
89 → 99 → 104 → 114 → 119 → 124 → 134 → 139 → 149 → 154     (cap: 95)
```

Linear, ~1.6 enemies a second, no plateau, for as long as the elite lived.
`eliteSummon`'s branch had **neither** of the two guards the floor-boss path
has — no `S.en.length` gate and no clamp on the count. Since the
[[Enemies#Shared behaviour|separation pass]] is O(n²) and drawing an enemy
costs ~40µs, this is what actually put the game into the regime where it felt
bad: at 95 bodies it holds 60fps, at 140 it does not.

> The note that used to sit here said ten floors "bounds it, but does not fix
> it". That was too generous. Ten floors changes the **slope**, not the shape —
> it still climbs without limit while the elite is alive, and 154 was reached
> on floor 8 inside 40 seconds.

**Why the obvious fix was the wrong one.** `updateBoss()`'s gate is a plain
`S.en.length < addCap` refusal. Applied here it satisfies the ceiling and
guts the documented intent — "so you cannot simply back away from one" —
because it silences the elite exactly when the room is fullest, which is
exactly when walking away is easiest. Measured on a 45s kiting run: the gate
cut summons by **86%**, from 106.7/min to 14.7/min.

**Fix:** at the ceiling the elite **recycles** instead of refusing.
`retireOldestAdd()` retires the longest-standing body that is more than 300px
away and either a previous reinforcement or still at full health, and a fresh
crack opens in its place. Population conserved rather than frozen: same cap,
**2.3×** the gate's renewal, +1.6% frame time. Full tables in
[[Difficulty Scaling#Elite summons: capped by recycling, not by refusing]].

The root cause was structural and is fixed as such: the ceiling used to be
computed inline in `updateWaves()` and nowhere else, so there was no shared
number for the elite branch to respect. It is `concurrencyCap()` now, read by
both.

> [!warning] The visual constraint is load-bearing
> A first pass retired bodies beyond **210px** and measured one vanishing
> **ten pixels from Damjan**. The camera's half-diagonal is ~275. `RETIRE_R`
> is 300 and there is no near fallback — if nothing is safely off-screen the
> summon is skipped. Lowering it trades a bug-looking pop for pressure that
> was not needed.

## 23. The pool caps did not run while a menu was open

**Found:** by the [[Instrumentation#`MEAT.soak(opts)`|soak harness]] on its
first real run, reporting `part: "1203/900"` — and a pool over its own ceiling
is never a cap set too low, it means the cap did not run. Reproduced in real
Chrome at **1957 against a ceiling of 900**, still climbing when the reading
was taken.

`update()` called `updateParticles()` from the `'dead'` and `'win'` branches
and nowhere else:

```js
if (S.mode === 'dead') { S.deadT += rdt; updateParticles(dt); updateCam(rdt); return; }
if (S.mode === 'win')  { updateParticles(dt); updateCam(rdt); return; }
if (S.mode !== 'play') { updateCam(rdt); return; }   // <- nothing ticks the pools
```

That function does **two** jobs and both stopped: things stopped expiring, and
the three [[Rendering#Effects|soft ceilings]] — 900 particles, 420 gibs, 80
rings — live at the bottom of it and stopped firing. So on pause, THE DECK, a
level-up hand, the evolution pick, augments and PACI's shop, the pools were
untended.

That would be harmless if only the simulation fed them. **Eight particle
spawners live in the DRAW path**, which runs under every one of those screens:

| | |
|---|---|
| `drawPlayer` | the shield aura, the charge glow, and burning — up to ~60/s each |
| `drawTomce` | his ambience |
| `PROPS.brazier` | ~18/s **per drum** |
| `drawCornerSigil` | ~15/s |
| `PROPS.pipes`, `PROPS.carcass` | a drip each |

Measured on floor 4 with a shield up: **39 particles a second** into a pool
that had stopped draining. Linear, no plateau.

**Fix:** the non-play branch ticks the effects too, which is the same call the
death screen was already making. It is presentation, not simulation — the
fight underneath stays frozen. Verified: 12 seconds held on a menu with the
spawners live, pool steady at **33–46** and `S.en` unchanged at 27.

> [!note] The same shape as #20, from the other side
> There a gameplay counter ran on menus because it sat **above** the mode
> guard. Here a **ceiling** failed to run on menus because it sat **below**
> one. Both are the same question — is this line simulation or presentation? —
> answered wrongly, in opposite directions.

## 24. Your combo expired while you read the level-up hand

**Found:** by auditing every timer on the wrong side of the mode guard after
[[#23. The pool caps did not run while a menu was open|#23]] — the point being
that #23 was one instance of a class, not a one-off.

`js/game.js`, in `update()`, **above** the guard:

```js
if (S.comboT > 0) { S.comboT -= rdt; if (S.comboT <= 0) { S.combo = 1; S.streak = 0; } }
```

`S.combo` climbs to **x25** and multiplies score on every kill; `S.comboT` is a
**3.2-second** window. Above the guard, that window drained on menus — and the
menu you open most is the level-up hand, which is handed to you **for
killing**, so it always arrives mid-combo. Reading three cards for four seconds
silently reset a x25 multiplier and the kill streak with it, and nothing on
screen said it had happened.

**Fix:** move it below the guard, next to the run clock, which is there for
precisely the same reason. Verified: five seconds on a menu leaves combo x11
and streak 10 untouched with `comboT` frozen at 3.2; five seconds in play still
expires both.

> [!note] Three of these now
> [[#14. A menu inside the first 2.2 seconds killed the floor permanently|#14]]
> wall-clock ran while a menu was open. [[#20. The run clock ran while you were reading a menu|#20]]
> a game-time counter sat above the guard. #24 is #20 again with real stakes —
> it was costing score rather than only misreporting it. The guard is the line
> between simulation and presentation, and every timer has to be on the correct
> side of it deliberately.

## 25. THE DESCENT's reward did not exist

**Found:** by reading the contract table against `WEP`. Carried open on this
list as **defect C** rather than fixed, because it had two possible closes and
picking the wrong one quietly rewrites a gun's availability.

THE DESCENT's unlock line reads *"FREEZER BURN joins the crate"*. `WEP.chill`
carried no `lock`:

```js
const BUYABLE = ['scar', 'saw', 'price', 'nail', 'micro', 'chill', 'hog', ... ];
//                                                        ^ unconditional
rot: { ... lock: 'seal' ... }    // the only gun that actually filtered
```

`shopStock()` and `evoPickable()` both gate on `WEP[id].lock`, and `chill` set
none — so FREEZER BURN was buyable from the first shop that rolled it, and
reaching floor 8 signed the contract, fired the toast, and changed nothing. The
comment above `shopStock()` already read *"two guns are behind contracts"*,
which is the clearest evidence of which way this was always meant to go.

**Fix:** `lock: 'deep'` on `chill` — the close that makes the contract line
true, rather than the one that rewrites the line to match the code. A promise
the game says out loud in its own UI is worth more than a gun's availability on
a first run, and the alternative would have left THE DESCENT paying out nothing
at all.

Verified with the save forced either side of the gate, 500 shop rolls each at
floor 9 with an empty loadout:

| `deep` | contract | FREEZER BURN in 500 rolls | RARE evolution rung |
|---|---|---|---|
| 1 | unsigned | **0** | MICROWAVE, THE HOG |
| 8 | signed | **147** | MICROWAVE, FREEZER BURN, THE HOG |

> [!note] The rung was the thing to check, not the shop
> RARE holds exactly three guns and two rungs draw from it, so locking one
> could have left a rung with a single card on it — which is not a choice, it
> is a receipt. It doesn't: two guns for two rungs, and `evoGunPool()`'s
> widening covers the last one anyway. The gate was safe to add only because
> that pool had the headroom.

---

## 26. The probe measured draw calls being ISSUED, not drawing

**Found:** by disbelieving a conclusion the probe had already given, twice.
This one is in the [[Instrumentation|measurement harness]] rather than in the
game, and it is on this list because it cost a whole cycle of work aimed at the
wrong layer.

`PROBE` brackets each render phase with `performance.now()`:

```js
const _p0 = performance.now();
drawParticles();                 // 900 fillRect / arc / stroke calls
_accPar += performance.now() - _p0;
```

That reads **0.35ms at 900 live particles**, and the number is correct. It is
also nearly meaningless, because a canvas draw call returns as soon as it is
*recorded*. The rasterisation happens later, on the compositor, and lands in
the **gap between frames** where no bracket around JS can see it.

So the probe reported the cost of *asking* for 900 particles, not the cost of
*drawing* them — and 0.35ms of asking was used to argue that batching the
effects layer could never win more than 2% of a frame. Measured properly, the
effects layer is about **75% of the burst stall**.

**How it was caught.** Not by a better bracket — by an A/B that leaves JS
almost unchanged and changes only what reaches the screen. Same 22 kills, same
`deathBurst()` calls, ceilings at 900/420/80 against 1/1/1:

| | frames over 25ms | stall |
|---|---|---|
| effects on | 13 / 16 / 22 / 12 | 217 / 268 / 402 / 270 ms |
| effects off | 4 / 4 / 2 / 0 | **69 / 68 / 35 / 1 ms** |

The JS difference between those arms is `updateParticles` plus
`drawParticles` over 900 entries instead of 1 — about **0.7ms a frame, 28ms
across the window**. The stall difference is **202ms**. Roughly **85% of it is
outside JS**.

> [!warning] The rule this leaves behind
> **A wall-clock bracket around canvas work is a lower bound and nothing more.**
> [[Rendering#It used to be one enormous pixel loop, and that was the lag|The
> floor bake]] said this, [[Instrumentation#Two things the timings cannot tell you|the
> probe's own documentation]] says it in a callout, and it was still used to
> close a question it cannot answer.
>
> To attribute GPU-side cost, **change what is drawn and measure the frame
> gap** — never bracket the call and believe the number. `PROBE.drain` exists
> for exactly this and was not used. When a phase's JS time and its effect on
> frame pacing disagree, the pacing is right.

This is [[#11. Crates spawning on Damjan's head|#11]] again, one level up. There
the test was wrong before the code was; here the **instrument** was wrong before
the code was, and it was wrong in a way that produced a confident, specific,
plausible number. A number is not evidence that the thing was measured.

## 27. Hitstop re-armed on every kill, so a stream never un-froze

**Found:** by giving the player a switch and asking. Two cycles of performance
work had gone into dropped frames, and the thing actually being felt was this.

`killEnemy()` did `S.hitstop = Math.max(S.hitstop, 0.035)`, and `update()` scales
`dt` to **8%** while it runs. Draw is untouched — the screen keeps painting at
60 while the simulation crawls.

`Math.max` handles **simultaneity** correctly: ten kills on one frame buy one
kill's worth, not ten. What it did not handle is a **stream**. 0.035s is about
two frames at 60Hz, so kills arriving faster than every two frames re-armed it
before it expired, indefinitely. Measured: active on **20 of 40 frames** through
a pierce shot and **28 of 50** through a NOVA, with no upper bound at all.

> [!note] This is why it was so hard to find
> Nothing is dropping a frame in that window. The frame gap is a clean 16.7ms,
> the profiler is clean, the pools are within their caps — and the game feels
> like it is stuttering, because almost nothing moves for half a second. Every
> measurement taken across two cycles was **correct**; the model was wrong.

**Fix:** a duty cycle, the same shape as `deathBurst()`'s per-frame budget.

```js
const HS_DUTY = 0.35;   // at most this fraction of any stretch may be frozen
const HS_POOL = 0.12;   // and never more than this much of it back to back
const HS_MIN  = 1 / 60; // and never a grant too small to pay for a frame
```

The bank refills with real time and drains while hitstop runs; a kill arms only
what the bank can pay for. Bosses and the finale bypass it — those are designed
beats, one at a time, and they are what the freeze is *for*.

| kill rate | frozen frames |
|---|---|
| one every 2nd frame (90 kills) | **40%** |
| one every 4th frame | 38% |
| one every 8th frame | 37% |
| sparse (6 kills in 3s) | **14%** |
| a single isolated kill | full 0.035s, unchanged |
| a boss on an empty bank | full 0.3s, unchanged |

> [!warning] The duty has to be charged in FRAMES, not in seconds
> The obvious accounting — drain the bank by however much hitstop actually ran —
> is wrong, and it measured **55–60%** against a knob set to 35%. Hitstop scales
> the *whole frame* however little of it remains, so a 1ms grant buys a full
> frozen frame for a thousandth of the budget. Charge a frame per frozen frame,
> and refuse any grant the bank cannot pay a full frame for.

---

## 28. A piercing round hit one enemy per frame, not one room

**Found:** while trying to reproduce [[#27. Hitstop re-armed on every kill, so a stream never un-froze|#27]]
and failing. No matter how tightly the bodies were packed, a slug with
`pierce: 99` would not produce a multi-kill frame in the harness. The harness
was right.

The bullet/enemy loop in `updateBullets()` ended with an unconditional
`break`:

```js
b.hitIds.push(e);
if (b.hitIds.length > b.pierce) { S.bul.splice(i, 1); removed = true; }
break;                       // <- after the FIRST body, every time
```

So `pierce: 99` never meant "passes through 99 bodies". It meant **survives 99
frames**. A slug through six enemies was six consecutive frames, each paying a
hit, a kill, and its own 0.035s of hitstop — which is most of why a pierce shot
felt worse than anything else in the game.

> [!note] It was never a decision
`git log -L` on those lines: the `break` is in the **initial commit**
> and no commit has touched it since. `hitIds` and `pierce` were there from
> the start too, so it is not a leftover from before piercing existed. It is
> simply the shape the loop was written in on day one and never revisited.

Everything written about it since assumed otherwise, including the code:

- `deathBurst()` — *"a round that punches through eight things fires eight of
  these on the SAME FRAME"*. That comment is the justification for the entire
  per-frame burst budget, and it describes behaviour that could not happen.
- [[Weapons]] — GOD FINGER *"pierces everything"*
- README — *"pierces the entire room"*

**Fix:** drop the `break` and break only when the round runs out of pierce.
`hitIds` is already a permanent per-enemy cooldown — the `indexOf` guard at
the top of the loop — so continuing cannot double-tap anything. It just lets the
round spend its pierce budget on the frame it arrives.

Verified: a slug into a packed knot of twelve now lands **13 hits on one frame**
where it previously landed one. Which also means the burst budget in
`deathBurst()` now protects against the case its own comment described.

> [!note] The lesson, and it is not the usual one
> [[#11. Crates spawning on Damjan's head|#11]] was a wrong test.
> [[#26. The probe measured draw calls being ISSUED, not drawing|#26]] was a wrong
> instrument. This one is neither: **every measurement was right and the model
> was wrong.** A symptom reported as performance was game logic the whole time,
> and the only thing that found it was handing the player a switch
> ([[Instrumentation#`MEAT.FX` — one switch per thing a hit does|`MEAT.FX`]]) and
> asking which one changed the feel. Two cycles of correct profiling could not
> have found it, because there was nothing wrong with the frames.

---

## 29. The music was not lagging figuratively — the audio clock was running at a quarter speed

**Reported as:** *"the music is lagging and the sound turns off sometimes"*.

Which sounded like a scheduling problem, or a main-thread problem, or a figure
of speech. It was none of those. The audio thread could not render samples fast
enough to keep up with real time, so the score genuinely played slow — and when
the thread missed its deadline outright, the output went silent.

### The measurement

One number settles it. Open a second, empty `AudioContext` in the same tab at
the same moment, and compare how fast each one's clock advances against
`performance.now()`:

```
bare AudioContext   0.985x real time
the game's          0.167x real time
```

Same browser, same tab, same second. That rules out the harness, the machine
and page throttling in a single step — see
[[Instrumentation#Is the audio thread keeping up?]].

Sampled every five seconds with the boss arrangement running, it is not a
plateau, it is a slide:

| seconds of music | audio clock |
|---|---|
| 5 | 0.450x |
| 10 | 0.418x |
| 15 | 0.345x |
| 20 | 0.315x |
| 25 | 0.284x |
| 30 | 0.270x |

Monotonic decay is the signature of accumulation, not of cost.

### The cause

```
$ grep -c disconnect js/music.js js/audio.js
0
0
```

Every voice in both files built a little chain of nodes, wired it to a bus, and
walked away from it. **A connected Web Audio node is a rendered node whether or
not anything is feeding it** — the source stopping does not take the filter out
of the graph. GC reclaims them eventually, if nothing references them and the
browser gets round to it, and "eventually" is not a rate.

Measured creation rate at full tilt: **158 nodes a second**, of which

| per second | from |
|---|---|
| 50 biquads | `cab()`, building a three-filter cabinet per note |
| 9.5 `WaveShaper`s | `distort()`, each at `oversample: '4x'` |
| 41 oscillators, 47 gains | the notes themselves |

The waveshapers are the expensive half. `oversample: '4x'` means four times the
sample rate through the shaping curve, and there were ten new ones a second, all
still in the graph. Thirty seconds of a boss fight is three hundred
permanently-running, 4x-oversampled distortion units.

### The fix, in three parts

1. **A reaper.** Everything that gets connected also gets an end time, and the
   scheduler disconnects it once it is past. `MUSIC.debug().liveNodes` reports
   the number in flight. In `js/audio.js` the same job goes in `env()`, which is
   the one function every sound effect passes through, and the sweep is
   amortised onto the calls themselves so a quiet game keeps no timer alive.
2. **Three amplifiers, not one per note.** The distortion and cabinet are built
   once at `attach()`, so a note is two oscillators and an envelope. `oversample`
   drops to `'2x'` — inaudible here, and a quarter of the work.
3. **`LOOKAHEAD` 0.12s → 0.75s.** Not a cause of this defect, but 120ms is less
   than one bad frame in this game and was its own source of gaps.

### After

| | before | after |
|---|---|---|
| audio clock at 5s | 0.450x | **0.999x** |
| audio clock at 30s | 0.270x | **0.999x** |
| trend | monotonic decay | **flat** |
| live nodes | unbounded | **34–50, stable** |

Held at 0.997x with the boss arrangement running *and* ~150 sound effects a
second layered on top, which is heavier than the game can actually produce.

> [!note] Why two cycles of profiling never found it
> Every performance tool pointed at this game measures the **main thread** —
> frame time, the frame gap, `PROBE`,
> [[Instrumentation#`MEAT.FX` — one switch per thing a hit does|`MEAT.FX`]]. The
> audio render thread is a different thread with a different deadline, and
> nothing on that list can see it. The frames were fine. They were fine the
> whole time.
>
> [[#26. The probe measured draw calls being ISSUED, not drawing|#26]] was the
> right instrument pointed at the wrong side of a boundary. This is the right
> instrument pointed at the wrong **thread**. The reference-context trick is the
> general answer to both: when you cannot measure a thing directly, run a
> known-good copy of it beside the suspect and compare.

---

## 30. Sharing the guitar amplifier turned the score into a square wave

**Reported as:** *"there is no music being heard just a loud buzzing sound kinda
static"*. A regression, introduced by the fix for
[[#29. The music was not lagging figuratively — the audio clock was running at a quarter speed|#29]]
one commit earlier, and audible from the first bar.

### The measurement

Tap the node graph on its way to `destination` with an `AnalyserNode`, then
check the same scenario against the previous commit's `js/music.js`:

| `js/music.js` | peak | RMS | clipped samples in 2s |
|---|---|---|---|
| `9848bb9`, before the fix | 0.255 | 0.041 | **0** |
| `f5c11af`, after it | **1.176** | 0.201 | **155** |

Anything past 1.0 is off the end of the scale and gets flattened. Muting the
guitar and drum busses (via `menu()`) dropped the peak from 1.176 to **0.057**,
which named the bus without needing to read a line of code.

### The cause

Not the sharing itself — a real amplifier takes all six strings at once, and
summing before the distortion is what makes a chord sound like a chord. The
defect was **gain staging**, and it came from one detail moving.

When every note built its own chain, the envelope was *after* the distortion:

```
osc → drive ×14 → shaper (clips to ±1) → envelope ×0.3 → cab → bus
```

Each note left the shaper pinned at full scale, and was then scaled down to its
actual volume. Sharing the amp put the envelope *in front* of the shaper:

```
osc → envelope ×0.3 → [ drive ×14 → shaper → cab ] → bus
```

which is correct for **how hard a note drives the amp** — that is what a palm
mute physically is — and catastrophic for how loud it comes out. The shaper now
saw `0.3 × 14 = 4.2` per note, several notes at once, and **nothing after it
brought the level back down**. A waveshaper held far past its knee outputs a
square wave. A square wave that never stops is a buzz.

The comment written at the time said the move was "not a shortcut, it is
correct". Half of that was true, which is the reason it survived review: the
reasoning about drive was sound and the arithmetic about level was never done.

### The fix

Keep the shared amp — it is what closes #29 — and stage it properly:

- **drive** from 14/9/20 down to 3.0/2.2/4.0, so a summed chord lands in range
  rather than welded to the rails
- a **trim after the cabinet** (0.30/0.22/0.20), which is the stage that went
  missing when the envelope moved
- a **limiter across all three amps** into the bus. The trims set the level;
  this guarantees it, whatever way a given bar happens to stack up.

| | peak | clipped |
|---|---|---|
| before the regression | 0.255 | 0 |
| the regression | 1.176 | 155 |
| **fixed, wave track** | **0.215** | **0** |
| **fixed, boss track** | **0.229** | **0** |

Back to the level it used to sit at, with headroom to spare.

> [!note] Why the #29 work did not catch it
> Every check on #29 was about the *graph*: clock rate, node counts, live
> nodes, all of which were correct and stayed correct. Not one of them looked
> at the **signal**. A leak and a level are different questions and they need
> different instruments — an `AnalyserNode` on the way to `destination` costs
> one node and would have caught this in the same session that caused it.
> It is now part of [[Instrumentation#Is the mix actually in range?]].

## 31. Half the enemy roster is one sprite with a tint on it

**Found:** the art-direction audit, by reading `SPR.anim` rather than looking
at the game — which is exactly why it survived from the first commit. On
screen it looks like three enemies. In the table it is one.

`SPR.anim` has no `husk` and no `cyst`. Both are **the bloater's bank**, told
apart by a tint and a scale multiplier:

| type | bank | scale | tint |
|---|---|---|---|
| bloater | `bloater` | 1.00 | — |
| **husk** | **`bloater`** | 0.85 | `rgba(216,210,196,0.45)` |
| **cyst** | **`bloater`** | 1.12 | `rgba(150,210,70,0.42)` |

This is filed as a defect and not as a wishlist item because the codebase
already **decided this was wrong, in writing, and then only fixed half of
it.** [[Bosses#The look of them]] says:

> *All ten used to share two sprite banks and tell themselves apart with a
> colour wash. A tint is not a design — it says "this is the green one", and
> at twenty-six pixels across, colour is the first thing a dark room takes
> away from you.*

That reasoning was applied to the ten bosses, which a run meets **nine
times**, and never applied to the six enemies, which a run meets **thousands**
of times. The rule is right and it was enforced on the rarest thing in the
game instead of the commonest.

### Why it is a gameplay defect, not a cosmetic one

The three share a sprite and share nothing else. They are three different
decisions:

| type | what you are supposed to do |
|---|---|
| **bloater** | kill it at range — it bursts into 10 acid projectiles on death |
| **husk** | do **not** splash it — `e.split = 2`, it dies into two crawlers |
| **cyst** | leave the kiting pattern and cross the room to it — it never comes to you |

[[Enemies#The two late arrivals]] is explicit that HUSK and CYST exist to
punish two specific degenerate strategies: careless AoE, and circle-kiting.
**Neither punishment can land if the player cannot see which one they are
looking at.** A tell the player cannot read is not a tell; it is a dice roll
that the design believes is a lesson.

And the one channel carrying the difference is the one the game takes away:
floors run at 0.74–0.86 darkness, floor 2 is `dark`, floor 7 is `blackout`.
The tints are 0.42 and 0.45 alpha. Under the lamp falloff there is no visible
difference at all between a husk and a bloater.

### Not fixed yet — deliberately

The fix is three real bodies, and it is the **first creature work of the art
campaign** rather than a patch, because drawing them before the silhouette
rules exist would mean drawing them twice. See
[[CAMPAIGN#Pass 2 — the three that share a body]] and the family rules in
`.claude/skills/art-bible/`.

Verified separation is the acceptance test: rendered at 4x as pure black,
bloater / husk / cyst must be three different outlines — convex, concave and
rooted respectively — with no colour information at all.

> [!note] The lesson is about where a rule gets enforced
> The tint rule was written down, argued well, and then applied to the part of
> the game that shows it off rather than the part that needed it. When a
> principle is worth writing in a doc, the next question is *where does this
> bind*, and the answer is usually "the thing on screen most often", which is
> almost never the thing you were looking at when you thought of it.

---

# Open

**One.** [[#31. Half the enemy roster is one sprite with a tint on it|#31]] is
open by choice — it is the first creature pass of the art campaign rather
than a patch, because fixing it before the silhouette rules exist would mean
drawing it twice. Everything else on this list is closed.

**THE FULL MENU** (previously B) closed without a fix — the contract it lived
in no longer exists. See [[Contracts#CLOSING TIME replaced THE FULL MENU]].
**Defect A** closed as [[#22. Elite summons bypassed the enemy cap|#22]],
**D** as [[#23. The pool caps did not run while a menu was open|#23]], and
**C** as [[#25. THE DESCENT's reward did not exist|#25]] above.

## Related
- [[Changelog]] — which commit each fix landed in
- [[Difficulty Scaling]] — the formula that replaced bug #5
- [[File Map#Dev console hook]] — the harness all of these were caught with
