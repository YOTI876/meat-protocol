---
title: Bugs Found
tags: [reference, history, engineering]
---

# Bugs found (and fixed) during development

Every entry below was a real defect caught by headless testing before it
shipped to you — driving the game via `window.MEAT` and `frame()` calls in
the browser console, not just reading the code. Kept here so the reasoning
behind each fix isn't lost.

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

## Related
- [[Changelog]] — which commit each fix landed in
- [[Difficulty Scaling]] — the formula that replaced bug #5
- [[File Map#Dev console hook]] — the harness all of these were caught with
