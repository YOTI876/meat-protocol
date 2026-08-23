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

---

# Open

Two defects, recorded here rather than fixed.

**THE FULL MENU** (previously B on this list) is **closed** — not by fixing it,
but because the contract it lived in no longer exists. See
[[Contracts#CLOSING TIME replaced THE FULL MENU]].

## C. THE DESCENT's reward has no reward

The last surviving contract with a promise it doesn't keep. Its unlock line
reads *"FREEZER BURN joins the crate"* — but `WEP.chill` has never carried a
`lock`:

```js
const BUYABLE = ['scar', 'saw', 'price', 'nail', 'micro', 'chill', 'hog', 'rot', 'rail'];
//                                                        ^ unconditional
rot: { ... lock: 'seal' ... }    // the only gun that actually filters
```

`shopStock()` filters on `WEP[id].lock`, and `chill` doesn't set one, so
FREEZER BURN has always been buyable from the first shop that rolled it.
Reaching floor 8 signs the contract, toasts it, and changes nothing.

Two ways to close it, and they are not equivalent:

- give `chill` `lock: 'deep'`, which makes the contract line true and puts
  FREEZER BURN behind floor 8 on a first run
- rewrite the contract's reward to something that exists

The [[Weapons#When PACI starts carrying it|depth gate]] added in the balance
pass masks it slightly — `floor: 3` now holds FREEZER BURN back to floor 4 —
but that is a different gate with a different number, and the contract still
claims credit for it.

## D. The pool caps do not run while a menu is open

**Found:** by the [[Instrumentation#`MEAT.soak(opts)`|new soak harness]], on
its first real run — a 30-second `kill` soak on floor 4 reported
`part: "1203/900"`. A pool over its own ceiling is never a "cap set too low";
it means the cap did not run.

`update()` calls `updateParticles()` on **`dead`** and on **`win`**, and then
returns:

```js
if (S.mode === 'dead') { S.deadT += rdt; updateParticles(dt); updateCam(rdt); return; }
if (S.mode === 'win')  { updateParticles(dt); updateCam(rdt); return; }
if (S.mode !== 'play') { updateCam(rdt); return; }   // <- no updateParticles
```

So on **pause, THE DECK, a level-up hand, the evolution pick, augments and
PACI's shop**, `updateParticles()` never runs. That function does two jobs, and
both stop: particles never **expire**, and the three
[[Rendering#Effects|soft caps]] — 900 particles, 420 gibs, 80 rings — live at
the bottom of it and never **fire**.

Meanwhile two particle spawners sit in the **draw** path, which runs in every
mode because `drawWorld()` is drawn under all of those screens:

| | |
|---|---|
| `js/game.js:7380` | `drawPlayer()`'s shield aura, `Math.random() < 0.4` |
| `js/game.js:6636` | a lit prop in the prop library, `Math.random() < 0.30` |

Measured on the level-up screen: **~43 particles a second, linear, no
plateau.** Held there for ten seconds the pool went 1030 → 1112 → 1195 → 1284
→ 1363 → **1432**, having already blown through 900. In `fill` mode, where all
1800 frames stay in `play`, the same pool never leaves **66–154**.

This is the [[#20. The run clock ran while you were reading a menu|#20]] shape
again, from the other side: there a counter ran on menus because it sat above
the guard; here a **cap** fails to run on menus because it sits below one.

> [!note] Why it is worth more than the particle count
> `drawParticles()` is linear in the pool, so you return from the menu into a
> frame that is already carrying 1400+ particles instead of the ~150 you left.
> It costs most exactly where it is least welcome — you open a level-up hand
> **because** you have been killing things, which means a busy arena.

## Related
- [[Changelog]] — which commit each fix landed in
- [[Difficulty Scaling]] — the formula that replaced bug #5
- [[File Map#Dev console hook]] — the harness all of these were caught with
