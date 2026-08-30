---
title: Boss Audit
tags: [reference, design, audit]
---

# Boss audit — is the complaint true?

The complaint is *"the bosses feel the same"*. This is the baseline, measured
off `updateBoss()` in `js/game.js` rather than off [[Bosses]], because the doc
describes the intent and the code describes the fight.

**Short answer: the complaint is true, but not for the reason it sounds like.**
The phase *pairs* are well chosen and genuinely different from each other. The
problem is one layer down — **six of the fourteen patterns are shared between
two bosses outright, and four of the ten roster bosses contain no attack that
is theirs alone.**

## 1. Every attack in the game

One row per attack, not per pattern. Frame counts are at 60fps; the game is
`dt`-driven so these are nominal.

| boss | attack | what it does | telegraph | frames | counterplay | phase | shape |
|---|---|---|---|---|---|---|---|
| **THE BUTCHER** | HOOK | fires a `hook: 1` bullet at 210px/s that drags you back in | pose change, `A.ram()` | ~27 | break the line, or eat it and fight close | p1 | homes on contact |
| | CLEAVER FAN | 5-shot fan at 165px/s inside 74px | pose 0.35s, no ring | ~21 | leave its reach | p1 | spread |
| | RUSH | chase at 112px/s, no rest | **none** | **0** | dash | p2 | — |
| | SHED WALL | 7-round wall behind its own heading | ring 0.28s *after* the fact | ~0 | be off its line | p2 | spread |
| **MOTHER OF MELONS** | SEED | 2–4 ground marks that hatch enemies, 1.9s | ground ring, green | **114** | kill the eggs or take the room | p1 | spawn |
| | NOVA | 16–30 ring, alternating offset, 132px/s | wind-up particles at `pt<=0.55` | **33** | be in the gap the offset opens | p2 | radial |
| **THE PITCHER** | BLINK | teleports 55–90px from you | particles at departure | **0** | none — it is a reposition | p1 | — |
| | ARRIVAL SPREAD | 5-shot spread at 150px/s on landing | the blink itself | ~0 | pre-move | p1 | spread |
| | CURTAIN | 11-slot wall, 2-wide moving hole, 108px/s | it walks to a wall first | ~30 | run to the hole | p2 | wall |
| **THE HOGFATHER** | MORTAR VOLLEY | 3 shells, lead grows 0.35 → 0.79s | ground ring, 1.35s | **81** | change heading between shells | p1 | ground |
| | BURST CHARGE | charge at 5.2x, leaking rounds | red line + particles, 0.75s | **45** | sidestep | p2 | contact |
| | BURST RING | 16-way ring at charge end | the charge ending | ~0 | be off it when it stops | p2 | radial |
| **THE COURIER** | ORBIT | circles at 96px | — | — | — | p1 | — |
| | ORBIT CHARGE | 4.6x charge out of the orbit | particles, 0.5s | **30** | sidestep | p1 | contact |
| | 8-RING | 8 rounds at 125px/s on charge end | the charge ending | ~0 | be off it | p1 | radial |
| | MINE DROP | armed mine every 0.75–1.1s, 14 live cap | it is visible on the floor | persistent | do not walk there | p2 | ground |
| | LEAD SPREAD | 3-shot at 150px/s | `A.nailgun()` | ~0 | strafe | p2 | spread |
| **THE FISHWIFE** | BEAM | rotating beam, 3.4s, flips direction each cast | **sighting line, 0.9s harmless** | **54** | cross it or leave | p1 | beam |
| | BLINK | *identical to THE PITCHER's* | particles | 0 | — | p2 | — |
| | ARRIVAL SPREAD | *identical to THE PITCHER's* | the blink | ~0 | pre-move | p2 | spread |
| **THE TRIMMINGS** | CIRCLE BURST | 12 + 4/floor full ring at 100px/s | pose 0.5s only | ~30 | be outside it | p1 | radial |
| | RUSH | *identical to THE BUTCHER's* | none | 0 | dash | p2 | — |
| | SHED WALL | *identical to THE BUTCHER's* | after the fact | 0 | be off its line | p2 | spread |
| **SUNDAY ROAST** | CHARGE | 5.2x straight-line charge | red line + particles, 0.75s | **45** | sidestep | p1 | contact |
| | SPIRAL | 2–4 arms at 2.1 rad/s, 118px/s | the arms themselves | continuous | run the gap | p2 | radial |
| **THE NIGHT SHELF** | MINE DROP | *identical to THE COURIER's* | visible | persistent | do not walk there | p1 | ground |
| | LEAD SPREAD | *identical to THE COURIER's* | — | ~0 | strafe | p1 | spread |
| | CURTAIN | *identical to THE PITCHER's* | walks to a wall | ~30 | run to the hole | p2 | wall |
| **THE BEST BEFORE** | SEED | *identical to MOTHER OF MELONS'* | ground ring | 114 | kill eggs or take the room | p1 | spawn |
| | BEAM | *identical to THE FISHWIFE's* | sighting line 0.9s | 54 | cross or leave | p2 | beam |
| **THE MEAT PROTOCOL** | HOLD RING | 26-round ring, 2.4–3.0s beat, alternating offset | the beat is learnable | ~30 | be in the offset gap | p1 | radial |
| | LEADING SPIT | 3-shot leading you, every 0.62s | none | 0 | keep moving | p1 | spread |
| | HUNT | 118px/s lazy pursuit | none | 0 | cross it | p2 | — |
| | TWIN MORTAR | 2 shells on your heading, every 1.9s | ground ring | ~81 | change heading | p2 | ground |
| | HEADING FAN | 9-shot along its own heading | none | 0 | be off its line | p2 | spread |
| | TWIN BEAM | 2 beams 180° apart, 0.5 rad/s | warm-up | 54 | run one circle | p3 | beam |
| | FILL SPIRAL | 2 arms behind the beams | continuous | continuous | timing | p3 | radial |

### The six elites

Elites have **no attack of their own at all.** `spawnMini()` scales an ordinary
enemy and puts it on the boss bar; it keeps its species AI and adds one
universal ring-and-summon on a 2.2–3.2s timer.

| elite | species | its "boss" attack |
|---|---|---|
| THE FIRSTBORN | crawler | ring of `8 + floor*1.5` + summon `1 + floor*0.7` |
| THE CHOIRMASTER | shrieker | *the same ring and summon* |
| THE LONG WALK | stalker | *the same ring and summon* |
| THE SPOILAGE | bloater | *the same ring and summon* |
| THE HOLLOW MAN | husk | *the same ring and summon* |
| THE BROODMOTHER | cyst | *the same ring and summon* |

**Six elites, one attack, shared.** Species AI is the only thing telling them
apart, and species AI is the thing the player has already fought a hundred of.

## 2. Phase structure

| boss | p1 → p2 | what actually changes |
|---|---|---|
| THE BUTCHER | hook → rush | pull becomes pursuit. Both are "you do not get to keep distance" |
| MOTHER OF MELONS | brood → nova | stops seeding, starts detonating. **Real rule change** |
| THE PITCHER | blink → curtain | stops being everywhere, becomes a wall. **Real rule change** |
| THE HOGFATHER | mortar → burst | range denial becomes contact. **Real rule change** |
| THE COURIER | circle → mines | orbit-and-charge becomes orbit-and-drop. **Same skeleton** |
| THE FISHWIFE | sweep → blink | plant becomes teleport. **Real rule change** |
| THE TRIMMINGS | spawner → rush | stand-and-ring becomes pursuit. **Real rule change** |
| SUNDAY ROAST | charge → spiral | contact becomes stationary bullet-hell. **Real rule change** |
| THE NIGHT SHELF | mines → curtain | ground denial becomes lane denial. **Real rule change** |
| THE BEST BEFORE | brood → sweep | seeding becomes a beam. **Real rule change** |
| THE MEAT PROTOCOL | p1 → p2 → p3 | hold → hunt → plant. **Two real rule changes** |

## 3. The honest numbers

### How many distinct attack verbs?

**Thirteen**, and they are not evenly used:

| verb | patterns using it | count |
|---|---|---|
| emit a radial ring | burst, spawner, circle, nova, spiral, p1, p3 | **7** |
| fire a spread at or along a heading | blink, hook, rush, mines, p1, p2 | **6** |
| straight-line contact charge | charge, burst, circle | **3** |
| ground-marked delayed detonation | mortar, p2 | 2 |
| rotating beam | sweep, p3 | 2 |
| pursue at speed | rush, p2 | 2 |
| ground-marked delayed **spawn** | brood | 1 |
| wall of shot with a moving gap | curtain | 1 |
| persistent dropped area denial | mines | 1 |
| grapple and pull | hook | 1 |
| teleport | blink | 1 |
| summon adds on a timer | **all eleven** | 11 |

Three verbs — ring, spread, charge — account for **16 of 29 attacks (55%)**.

### How many phase 2s are just "faster and angrier"?

**By pattern: one of ten.** Only THE COURIER reuses its own skeleton (orbit at
a radius, then do a thing). The other nine pairs are genuinely different
patterns. The doc's claim here is correct and the complaint is wrong about it.

**By ritual: ten of ten.** `enterPhase()` is *identical* for every boss in the
game — same 1.05s rear-up, same `knockRoom(240,300)`, same screen wipe, same
red flash, same `+24% speed / +16% damage`, same banner, same hitstop. The
pattern changes; the *break* never does. Eleven fights share one act break.

That is the part that reads as sameness. A player does not experience "pattern
4 became pattern 11" — they experience *the boss did the rear-up thing again*.

### Which attacks are functionally identical between two bosses?

Not "similar". **The same code, reached by two different sprites:**

| pattern | shared by |
|---|---|
| `blink` | THE PITCHER (p1) · THE FISHWIFE (p2) |
| `curtain` | THE PITCHER (p2) · THE NIGHT SHELF (p2) |
| `sweep` | THE FISHWIFE (p1) · THE BEST BEFORE (p2) |
| `mines` | THE COURIER (p2) · THE NIGHT SHELF (p1) |
| `brood` | MOTHER OF MELONS (p1) · THE BEST BEFORE (p1) |
| `rush` | THE BUTCHER (p2) · THE TRIMMINGS (p2) |

**Six of the fourteen patterns are duplicated. Twelve of the twenty roster
pattern-slots (60%) run code another boss also runs.**

And the number that actually explains the complaint:

| | bosses | n |
|---|---|---|
| **both** patterns unique | THE HOGFATHER, SUNDAY ROAST | **2** |
| **one** pattern unique | THE BUTCHER, MOTHER OF MELONS, THE COURIER, THE TRIMMINGS | 4 |
| **no** unique attack whatsoever | **THE PITCHER, THE FISHWIFE, THE NIGHT SHELF, THE BEST BEFORE** | **4** |

> [!warning] Four of ten bosses are assembled entirely from other bosses' parts
> THE FISHWIFE is THE BEST BEFORE's beam plus THE PITCHER's blink. THE NIGHT
> SHELF is THE COURIER's mines plus THE PITCHER's curtain. Nothing in either
> fight belongs to it. They are not *similar* to another boss — they are two
> other bosses wearing a new silhouette.
>
> This is the whole complaint, and [[Bosses]] misses it because it audits
> **pairs** ("no two share a pair") rather than **attacks**. No two share a
> pair, and it does not help: a run fights nine bosses and meets the beam
> three times.

### What percentage of boss attacks are a projectile aimed at me?

- **16 of 29 (55%)** emit projectiles of some kind.
- **7 of 29 (24%)** are specifically *aimed at the player* — the rest are
  radial or geometric and would fire identically at an empty room.
- **11 of 11 fights** contain at least one projectile emission. There is no
  fight in the game that is not, in part, a bullet pattern.

### The finding nobody asked for: telegraph blindness

The arena is 480x270 with a light cone and up to 95 adds. Measured against
that, **9 of 29 attacks have a telegraph of 0 frames** — no warning at all:

`rush` · `shed wall` · `blink` · `arrival spread` · `burst ring` · `8-ring` ·
`lead spread` · `leading spit` · `heading fan`

Every one of those is a projectile emission. In a lit, empty room they read
fine. On floor 7 during `blackout` with 60 adds on screen they are not attacks,
they are damage that happens to you.

**The attacks with real telegraphs are exactly the six new verbs** — mortar
81f, brood 114f, sweep 54f, curtain 30f, mines persistent. That is strong
evidence the six-verb pass was the right instinct and simply was not finished.

## 4. Verification of the new designs

Step 4, audited against the same table. See [[Boss Designs]] for the fights.

### Verb count after the redesign

| | before | after |
|---|---|---|
| distinct verbs | 13 | **21** |
| attacks that are radial rings | 7 | **1** |
| attacks that are aimed spreads | 6 | **2** |
| patterns shared by two bosses | 6 | **0** |
| bosses with no unique attack | 4 | **0** |
| attacks with a 0-frame telegraph | 9 | **0** |
| distinct phase-break rituals | 1 | **11** |

### Duplication check on the new set

Run pairwise across all 33 new attacks. Three collisions were found and
resolved rather than shipped:

1. **THE PITCHER's LEVEL and THE BEST BEFORE's SPOIL** both changed the floor
   under the player. Resolved: LEVEL tilts the arena's *momentum* — a global
   velocity bias you lean against; SPOIL *removes tiles permanently*. One is a
   force, the other is a subtraction.
2. **THE FISHWIFE's SOUNDING and THE NIGHT SHELF's STOCKTAKE** both moved
   information through darkness. Resolved: SOUNDING reveals *her* to you on a
   ping; STOCKTAKE reveals *you* to the adds. One gives information, one leaks
   it.
3. **THE TRIMMINGS' RECOMBINE and MOTHER OF MELONS' BROOD** both produced
   bodies. Resolved: brood is **cut from the redesign entirely**. MOTHER now
   *takes* bodies rather than making them. Only THE TRIMMINGS creates.

### Where the no-overlap rule could not be fully held

Two places, and I would rather flag them than pretend.

1. **Summoning.** Every boss still summons on `addT`/`addN`, because the add
   economy is load-bearing for XP, cards and the concurrency curve. Stripping
   it from ten fights changes the run's whole payout shape and is a much larger
   change than boss design. So "summons adds" stays a shared verb — but each
   redesign *uses* the adds differently (consumes, ignores, converts, hides
   behind them), which is the part the player reads.
2. **Contact damage.** All eleven bodies still hurt on touch on the shared
   `CONTACT_CD`. That is a property of the collision system, not a designed
   attack, and separating it per boss is risk with no payoff.

## Related
- [[Boss Designs]] — the eleven fights this audit is the baseline for
- [[Bosses]] — the system as it stands today
- [[Difficulty Scaling]] — the 95-add ceiling every telegraph has to survive
