---
title: CAMPAIGN
tags: [plan, art, state]
---

# THE ART CAMPAIGN

> **PASTE THIS TO RESUME. Nothing else needs reading first.**
>
> ```
> Continue the MEAT PROTOCOL art campaign. Read docs/CAMPAIGN.md first —
> start with CURRENT POSITION, then the DECISIONS log, then the pass table.
> Load the art-bible skill. Do the next pass marked NOT STARTED, in order,
> unless CURRENT POSITION says something is half-done — if so, finish that
> first. Show me the first creature or room before doing the rest of the pass.
> Update CURRENT POSITION and the pass status in the same commit as the work.
> ```

---

## CURRENT POSITION

**Last updated:** 2026-08-30, after Pass 1 and Pass 2a/2b.

> [!important] PICK UP EXACTLY HERE
> **All six enemy SILHOUETTES are done.** Every one meets its rule and all six
> are distinguishable at 4x filled pure black, with no colour information:
>
> | creature | silhouette | verified |
> |---|---|---|
> | crawler | tray of mince — flat-topped rectangle, tag on one corner | yes |
> | shrieker | hanging pack — punched header card, taper below | yes |
> | stalker | shrink-wrapped — arms off the torso, floor visible through it | yes |
> | bloater | convex — one unbroken swollen curve | yes |
> | husk | concave — the only inward silhouette in the game | yes |
> | cyst | rooted — wider at the floor than the top | yes |
>
> **WHAT IS LEFT IN PASS 2 — the animation half, and none of it is started:**
> 1. **hurt frames (2, ~6–8 frames total)** — nothing in the game has one.
> 2. **death frames (3, 14–18 frames)** — a collapse, not a fade. Nothing has one.
> 3. **the body must move in the walk cycle.** Every creature still animates
>    LEGS ONLY over a static body, which is the "no weight" problem in the
>    review. Bob or squash the body too.
>
> Do those three across all six, then Pass 2 is done.
>
> Three rules learned the hard way — follow them or repeat the mistakes:
> 1. **Author in global `PAL` keys and pass `null` as the bank palette.** All
>    six enemies now do this; the ten bosses still declare local hex and are
>    the remaining violation (Passes 8–9).
> 2. **Check every key a walk tail uses against global `PAL` first.** The
>    crawler's legs were a local `E`; global `E` is freezer-burn white, so
>    they came out as glowing sticks. The shrieker and stalker had the same
>    trap in their tails and scream/coil poses.
> 3. **A silhouette rule is only proven with the colour thrown away.** Use the
>    black-fill recipe in the skill every time, not the coloured sprite.

**Just finished: PASS 1 — DOCTRINE. The game no longer looks like itself.**

- `PAL` regrouped into the three B bands with a comment per band saying what
  it is *for*. All 68 keys kept, none duplicated. The neutral ramp was violet
  and is now cool retail grey, which was quietly tinting every wall.
- All ten floors re-palettised to RETAIL NEUTRAL, **value-differentiated**,
  with a saturated PRODUCT `vat` accent each. PACI's back room deliberately
  keeps its own violet — he is not in the building.
- Darkness band opened to the per-floor spec: **0.15 → 0.88**, was 0.74–0.86.
- Fluorescent model: **dead tubes** as hard rectangular patches on a
  deterministic per-floor grid, so a floor's dark spots are in the same places
  every run and can be learned. Replaces the vignette as the source of dark.
- The lamp carve and the `post()` vignette now **scale with the floor's
  darkness** — at full strength on a bright floor they put a torchlit-dungeon
  spotlight in the middle of a lit room, which is direction A's logic.
- **Damjan is out of the depth sort** and draws last, unconditionally, with a
  reserved warm lamp (`LAMP_WARM`) and a hard contact ring. Two channels:
  warmth carries him on dark floors, the ring carries him on bright ones.

**Verified:** 87 enemies on floor 9 — findable in under a second. `--selftest`
passes, `MEAT.soak` verified, light pass 0.218 ms/frame, avg 3.14.

**Then PASS 2a:** `husk` and `cyst` stopped being the bloater re-tinted
([[Bugs Found#31]]). Convex / concave / rooted, verified at 5x filled pure
black — three different shapes with no colour information at all.

**Then PASS 2b (part):** the `crawler` became a tray of mince — flat-topped
hard rectangle, wider than tall, price tag on one corner. It is the first
creature a player meets, so it is the one that teaches the shape language.

**Half-done: PASS 2 — the silhouettes are done, the ANIMATION is not. See the box at the top.**

> [!warning] A real bug came out of Pass 1 and is worth knowing about
> **The lightmap canvas was never cleared.** `drawLight()` laid its darkness
> fill straight over the previous frame's, so darkness *accumulated* — alpha
> 0.30 a frame reaches 0.97 in ten frames. It was invisible for the whole
> project because every floor ran at 0.76–0.86, which saturates on frame one
> and looks identical either way. The moment a floor asked to be genuinely
> bright it surfaced: a room set to `dark: 0` still rendered black.
>
> Fixed with a `'copy'` composite on the fill. **If a future pass finds a
> floor refusing to get brighter, look here first.**

**Do not relitigate:**
- The pipeline stays — grids, `up2`/`shade`/`stamp`, the 68-key palette
  (DECISION 001).
- **The direction is B · THE PRICE TAG** and it is committed to, not
  sampled (DECISION 005). Do not drift toward A because B is more work.
- **No lore.** This is a roguelike. Floors get identity from environmental
  design, not narrative (DECISION 007).

> [!warning] Read this before showing Damjan an early pass
> **B will not look good after Pass 1.** It will look half-converted and
> strange, because a direction only lands once enough of the game speaks it —
> a doctrine pass changes the palette and lighting under art that has not been
> redrawn to it yet, which is the ugliest point in the whole campaign.
>
> Damjan asked to be held to this. If he reacts badly to an early pass,
> **remind him of this paragraph before changing anything.** Do not start
> compromising the direction on a reaction to a half-converted build. That is
> a standing instruction from him, not a hedge from you (DECISION 009).

---

## DECISIONS

Append-only. Every entry is a choice that a later session must not silently
reverse. If you think one is wrong, say so to Damjan — do not just change it.

| # | date | decision | why |
|---|---|---|---|
| 001 | 2026-08-30 | **Keep character grids + `up2`/`shade`/`stamp` + the 68-key palette. No PNGs.** | Grids make silhouette the first thing authored; `shade()` reading a material map is what lets a doctrine change roll across every sprite at once; cosmetics are palette swaps and PNGs kill them. See [[Art Direction#Why not PNGs]] |
| 002 | 2026-08-30 | **The problem is doctrine, not craft.** Fix rules first, redraw second. | Pipeline, palette and faces are all good. What is missing is a rule for what a colour is *for*. Twenty good sprites with no rules is not a style |
| 003 | 2026-08-30 | **`husk` and `cyst` must get their own bodies.** | They are currently the bloater's bank re-tinted; three of six enemies are one sprite. This is the single most damaging art fact in the game |
| 004 | 2026-08-30 | **The frame budget is not negotiable.** Any pass touching the render path runs `MEAT.soak` before and after and reports both. | Five cycles were spent earning it |
| 005 | 2026-08-30 | **Direction B · THE PRICE TAG.** Committed to fully. Anything that does not fit gets cut even if it already exists. | *"I want to load the game and not recognise it."* A is a better version of what already exists; C fails at 95 enemies, which is most of the game. B is the only one where the screenshot is unmistakably this game, and asymmetric product silhouettes are a shape language the genre is not using. **Do not hedge back toward A because B is more work** — that is an explicit instruction |
| 006 | 2026-08-30 | **Open the darkness band, specced per floor.** Some floors genuinely bright, at least one near-black, and the value spread across the ten as wide as the hue spread currently is. | Uniform 0.74–0.86 is a filter, not atmosphere. Fixes readability and floor identity in one move, and B refuses darkness as its solution anyway. Spec is in the art-bible skill |
| 007 | 2026-08-30 | **No lore, no cutscenes, no narrative arc, no explanatory text.** Floors get identity from environmental design only. | This is a roguelike. THE FREEZER works because it is a *place*, not because anything is written about it. Everything serves the run: if a decision does not change how a floor plays or reads at a glance, it does not earn its place |
| 008 | 2026-08-30 | **Damjan gets unconditional render priority, in Pass 1, regardless of anything else.** | *"At 70 enemies I could not find the player"* is unacceptable in a game about being surrounded |
| 009 | 2026-08-30 | **A bad reaction to an early pass is not a reason to compromise the direction.** Remind Damjan of the half-converted warning first. | His standing instruction. A direction only lands once enough of the game speaks it |
| 010 | 2026-08-30 | **Do not fake creature art.** Where the result is only correct-and-coherent rather than good, ship it and mark it in the HUMAN PASS table below. | Do not quietly settle and do not stall waiting for an artist |

---

## THE PASSES

Status: `NOT STARTED` · `IN PROGRESS` · `DONE (hash)`.
Ordered by dependency **and** by how much each changes the impression. The
first four are front-loaded so the game looks transformed early.

| # | pass | status | depends on | frame risk | effort |
|---|---|---|---|---|---|
| 1 | **Doctrine** — palette bands, material maps, lighting model | **DONE** | decisions 005 + 006 | **high** | 1 session |
| 2 | **The six enemies** | **IN PROGRESS** | 1 | low | 2 sessions |
| 3 | **Damjan + player priority** | NOT STARTED | 1 | med | 1 session |
| 4 | **HUD** | NOT STARTED | 1 | low | 1 session |
| 5 | **ACT ONE — floors 1–3** | NOT STARTED | 1 | med | 1–2 sessions |
| 6 | **ACT TWO — floors 4–6** | NOT STARTED | 5 | med | 1–2 sessions |
| 7 | **ACT THREE — floors 7–10** | NOT STARTED | 6 | med | 2 sessions |
| 8 | **Bosses I** — 5 of the roster | NOT STARTED | 1, 2 | low | 2 sessions |
| 9 | **Bosses II** — 5 + the finale | NOT STARTED | 8 | low | 2 sessions |
| 10 | **Effects** — hits, deaths, beam, chain, singularity | NOT STARTED | 1 | **high** | 1–2 sessions |
| 11 | **Weapons, pickups, props** | NOT STARTED | 1 | low | 1–2 sessions |
| 12 | **Cards** | NOT STARTED | 1 | low | 1 session |
| 13 | **Title, death, win + wordmark** | NOT STARTED | 1, 4 | low | 1 session |
| 14 | **Boss telegraphs** — the [[Boss Designs]] fights | NOT STARTED | 9 | med | 3+ sessions |
| 15 | **Balance** | NOT STARTED | 14 | none | 1–2 sessions |
| 16 | **Audio to match** | NOT STARTED | most | low | 1–2 sessions |

### Pass 1 — Doctrine
**Changes, in this order:**
1. `PAL` reorganised into the three B bands — RETAIL NEUTRAL / PRODUCT /
   ORGANIC — with a comment per band saying what it is *for*. Local
   per-creature hex removed; creature palettes may only remap `PAL` keys.
2. The **darkness band opened and specced per floor** (DECISION 006). Table
   is in the art-bible skill. Fluorescent lighting model: flat, even, low
   falloff, dead tubes as hard rectangular dark patches.
3. **Damjan gets unconditional render priority** (DECISION 008) — he is drawn
   last, he carries a warm lamp nothing else in the world may use, and he is
   findable in under a second in a 70-enemy frame.

**No new sprites in this pass.**

**Done means:** every existing sprite has visibly changed without one grid
being redrawn; a stranger can read `PAL` and say what any key is for; and the
70-enemy floor-9 screenshot passes the find-the-player test.
**Test:** screenshot floors 1 / 5 / 9 before and after at 1:1; the floor-9
70-enemy frame; `MEAT.soak` before and after; `--selftest`.
**Risk:** touches `drawLight()` and every bake. Highest frame risk in the plan.

### Pass 2 — the three that share a body
**This is [[Bugs Found#31. Half the enemy roster is one sprite with a tint on it|defect #31]] and it goes first.**
`bloater`, `husk` and `cyst` are one sprite with two tints. They are three
different decisions — kill at range / do not splash / cross the room — and
they must not look like one shape.

Acceptance test, and it is objective: **rendered at 4x as pure black, with no
colour information at all, the three must be three different outlines** —
convex, concave and rooted respectively, per the family table in the skill.

Then the remaining three: crawler, shrieker, stalker.

Per creature: walk (4), **pose/telegraph**, **hurt (new)**, **death (new)**.
**Stop and show after the FIRST creature.** Do not batch six.
**Done means:** the silhouette test passes *and* Damjan confirms they read at
game size.

---

## HUMAN PASS CANDIDATES

Per DECISION 010. Anything that reached correct-and-coherent but not *good*
gets logged here with what specifically is weak, so a human artist has a brief
rather than a pile.

| item | pass | what is weak | status |
|---|---|---|---|
| **HUSK** body | 2 | Silhouette is provably concave and provably distinct, which is what the rule asked for. It still reads more like a moth or a bow tie than a crushed carton. Three iterations got the mass right and the *character* wrong. | open |

### Pass 3 — Damjan + player priority
Damjan to doctrine, plus whatever makes the player never lost in a crowd — rim
light, outline priority, or a reserved colour nothing else may use.
**Done means:** in a 70-enemy floor-9 screenshot, the player is findable in
under a second. Damjan judges this.

### Pass 4 — HUD
One frame language, one bar style, one type scale. Kill the debug minimap look.
Move full-screen event text out of the play area.

### Passes 5–7 — the floors
Each floor is a **place**: architecture, a light-source logic, a prop set that
means something, a value (not hue) that separates it from its neighbours.
Per act, not per floor, so an act shares a look.
**Done means:** floors within an act are siblings; floors across acts are
strangers. Screenshot all ten at 1:1 and compare as a strip.

### Passes 8–9 — bosses
Silhouette first, per the skill's boss rule: **a boss must not share a
silhouette family with an enemy.**

### Pass 10 — effects
Highest frame risk after Pass 1. `MEAT.soak` before and after, every time.

### Pass 14 — boss telegraphs
This is [[Boss Designs]], already written. SUNDAY ROAST is built and is the
proof the approach works. The other ten follow the ranking there.

---

## HOW WE WORK

### Every session starts
1. Read **CURRENT POSITION** at the top of this file.
2. Read the **DECISIONS** log. Do not contradict it.
3. Load the **art-bible** skill.
4. Open the pass you are on. If CURRENT POSITION says something is half-done,
   finish that before starting anything new.

### Short loops, always
**Never batch work for review at the end.** One creature family, or one room,
then stop and show Damjan at 1:1. His reaction steers the rest of the pass.

A pass is not "draw six things and present six things". It is "draw one, show
it, agree, draw the rest to the agreed thing".

### Showing work
Always at **1:1, 960x540 backing store, no browser resampling**. The rig:

```js
for (const cv of document.querySelectorAll('canvas')) {
  cv.style.width='960px'; cv.style.height='540px'; cv.style.imageRendering='pixelated';
}
```

Screenshot the game, not a zoomed sprite sheet — except for the silhouette
test, which is explicitly a diagnostic and must be labelled as one.

### Verifying no regression
After **anything** touching the render path:

```bash
cd desktop && npm run selftest
```

and in-page `MEAT.soak({floor:6, wave:3, seconds:12, seed:4242, mode:'kill'})`.
Report ms/frame before and after. **The frame budget is not negotiable**
(DECISION 004). If a pass costs frame time, say so and offer the trade rather
than absorbing it quietly.

For bosses: `cd desktop && npx electron . --bossprobe`.

### Checking drift
Every third pass, screenshot floors 1, 5 and 9 plus one creature from each
completed family, and put them side by side. **If a later floor looks like a
different game from an earlier one, the skill is not specific enough — fix the
skill, then fix the art.** That is the whole reason the skill exists.

### Ending a session
In the **same commit** as the work:
1. Update the pass status with the commit hash.
2. Update **CURRENT POSITION** — what just finished, what is next, what is
   half-done.
3. Append any new **DECISION**.

A session that ends without updating this file has lost its work, whatever is
in the diff.

---

## WHAT A FRESH SESSION KNOWS FROM THE REPO ALONE

Tested by reading only what is committed:

| question | answered by | ok? |
|---|---|---|
| What are we doing and why? | [[Art Review]] + [[Art Direction]] | yes |
| What has been decided? | DECISIONS log | yes |
| Where are we? | CURRENT POSITION | yes |
| What do I do next? | pass table, first NOT STARTED | yes |
| What are the art rules? | `.claude/skills/art-bible/` | yes |
| How do I verify? | HOW WE WORK | yes |
| How do I show work? | the 1:1 rig above | yes |
| What must I not change? | DECISIONS + the rejected list in the skill | yes |
| What does the game already do? | `docs/` — 29 existing files | yes |

**Gap, stated honestly:** a fresh session cannot know whether Damjan *liked*
the last thing shown. Reactions live in chat and chat does not survive. So
every pass must end by writing the *agreed* look into the skill as a rule —
not just "drew the crawler" but "crawlers are low and wide, agreed". If a
reaction does not become a rule, it is lost.

---

## Related
- [[Art Review]] · [[Art Direction]] · [[Boss Designs]] · [[Boss Audit]]
- [[Rendering]] — the pipeline every pass works inside
