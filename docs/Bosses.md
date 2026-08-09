---
title: Bosses
tags: [reference, systems]
---

# Bosses, elites and the apex

Bosses used to land on five of the ten waves, which made them furniture. A
floor now has **one** floor boss, on wave 10, with two **elites** on the way
there — and every fifth floor the boss comes up as an **APEX** instead.

| wave | what |
|---|---|
| 4 | elite |
| 8 | elite |
| 10 | floor boss — **two phases** — or APEX on floors 5, 10, 15 … |

```js
BOSS_WAVE = 10
MINI_WAVES = [4, 8]
APEX_EVERY = 5      // isApexFloor(f) → (f + 1) % 5 === 0
```

The roster repeats every floor, forever — that's what makes the endless
descent work. Which one you get is `floor % 10`, so floor 1 is THE BUTCHER and
the cycle turns over every **ten** floors.

## The ten

Stats are floor-1 baseline before [[Difficulty Scaling]].

| # | boss | hp | opens | breaks to | summons | cry |
|---|---|---|---|---|---|---|
| 0 | **THE BUTCHER** | 1400 | `charge` | `burst` | 3 crawlers / 6.5s | *IT REMEMBERS YOUR NAME* |
| 1 | **MOTHER OF MELONS** | 1550 | `spawner` | `nova` | 4 (crawler×2 + shrieker) / 4.2s | *SHE IS FULL OF CHILDREN* |
| 2 | **THE PITCHER** | 1700 | `blink` | `rush` | 3 (stalker + crawler) / 7.0s | *IT CAME THROUGH THE WALL* |
| 3 | **THE HOGFATHER** | 1900 | `burst` | `spiral` | 4 (crawler + shrieker + bloater) / 6.0s | *HE IS CARRYING SOMETHING* |
| 4 | **THE COURIER** | 2100 | `circle` | `rush` | 4 (stalker×2 + crawler) / 6.8s | *IT HAS BEEN CIRCLING FOR HOURS* |
| 5 | **THE FISHWIFE** | 2300 | `blink` | `spiral` | 4 (shrieker + crawler + husk) / 5.4s | *SHE HAS BEEN ON ICE SINCE FRIDAY* |
| 6 | **THE TRIMMINGS** | 2500 | `spawner` | `rush` | 5 (crawler + husk×2) / 3.6s | *IT IS EVERY PART THEY DID NOT SELL* |
| 7 | **SUNDAY ROAST** | 2650 | `burst` | `nova` | 4 (bloater + crawler + shrieker) / 5.8s | *IT HAS BEEN IN THERE SINCE SUNDAY* |
| 8 | **THE NIGHT SHELF** | 2800 | `circle` | `spiral` | 5 (stalker×2 + husk) / 6.2s | *IT ONLY RESTOCKS AFTER CLOSING* |
| 9 | **THE BEST BEFORE** | 3000 | `rush` | `nova` | 5 (bloater + cyst + husk) / 5.0s | *THE DATE PASSED AND IT KEPT GOING* |

> [!note] Why the HP band is narrow
> 1400 → 3000 across ten entries is a much flatter ramp than the old five
> (850 → 2400), and deliberately so. `bossIndexFor` wraps, so a steep roster
> ramp only buys a **sawtooth**: floor 11 would drop back to the weakest entry
> after floor 10's hardest. Floor scaling does the escalating; the roster does
> the variety.

> [!note] What a boss actually pays
> Bosses used to hand you a [[Groceries|grocery]] on a fixed schedule. Now a
> floor boss pays two things: a **guaranteed hand** of [[The Deck|cards]] at
> better odds, and it opens [[Groceries#THE COLD ROOM|THE COLD ROOM]], where
> you choose one of two signatures. An elite pays a card; a floor boss pays a
> card and a name.

## Two phases

Every wave-10 boss **breaks at half health**. `enterPhase2()` fires once, at
`hp <= max * 0.5`:

- it rears up for **1.05s**, holding still
- `knockRoom(220, 300)` throws everything off it, itself included
- **+28% speed, +18% damage**, and its summon timer runs at **0.7×**
- it switches from `pat` to `pat2` for the rest of the fight
- a red flash, hitstop, `SECOND PHASE` over its head, and its own `cry2`

> [!note] The rear-up is not invulnerable
> Deliberately. It stands still for a second because that is the *reward* for
> breaking it — i-frames on an opening you have just earned reads as the game
> taking the opening back. If you can burst it down during the break, that is
> a build working.

The bar does **not** refill. Two phases over one bar is structure; two phases
over two bars is just twice the health.

### Patterns

The first five are the openers the roster was built on. The last three exist
because a phase change has to *look* different, not just harder — each asks a
different question of the room.

- **charge** — idles toward you, telegraphs (0.75s, red line shown), then
  charges at 5.2× speed in a straight line.
- **spawner** — drifts, periodically rings out a full-circle burst of
  projectiles (12 + 4/floor of them) instead of charging.
- **blink** — teleports to a random point 55–90px from you every 2–3s,
  firing a 5-shot spread on arrival.
- **burst** — charges like `charge`, but leaking projectiles mid-charge and
  detonating into a 16-way ring burst when the charge ends.
- **circle** — orbits you at 96px, tightening in for a 4.6× speed charge,
  then rings out 8 projectiles. Never fully stops moving.
- **spiral** — plants itself and screws 2–4 continuous arms of shot outward at
  2.1 rad/s. The one pattern where the boss stops caring where you are: the
  arm rotates slower than you can run, so the fight becomes a chase around a
  fixed point. Spacing along an arm grows with radius, so it is solid near the
  boss and a run-through at the rim.
- **nova** — holds at ~130px and detonates on a metronome, alternating the
  ring offset each time so the gap you used last is where the next one lands.
  The wind-up particles are the tell, not the ring.
- **rush** — no telegraph, no rest, capped at **112 px/s** against your 94. It
  sheds a 7-round wall behind itself every 2.4–3.4s. The steering is
  deliberately lazy, so it commits to a heading and overshoots when you juke —
  the counter is the dash, which is the point.

> [!warning] `rush` is capped in absolute units, not as a multiple
> The roster's base speeds run 26 to 62. A plain multiplier made THE COURIER
> unloseable and THE TRIMMINGS a walk, so `rush` reads
> `Math.min(b.spd * 1.75, 112)`. Same reasoning caps `nova` at 30 rounds a
> ring: uncapped, floor 25 fired 66, whose gaps are narrower than Damjan is —
> a ring you cannot be outside of is a damage tick with extra steps, not a
> dodge.

## Elites

A regular horror that got too big for the aisle. `spawnMini()` takes an
ordinary [[Enemies|enemy]] type, names it, scales it up and puts it on the
boss bar — but it keeps its own species' AI, so THE LONG WALK still teleports
and THE SPOILAGE still bursts on death.

| elite | species | colour |
|---|---|---|
| **THE FIRSTBORN** | crawler | orange |
| **THE CHOIRMASTER** | shrieker | green |
| **THE LONG WALK** | stalker | bone |
| **THE SPOILAGE** | bloater | pink |
| **THE HOLLOW MAN** | husk | pale |
| **THE BROODMOTHER** | cyst | acid green |

Which one you meet is `(floor * 2 + slot) % 6`, so a floor's two elites are
always different species and the roster cycles every **three** floors:
FIRSTBORN/CHOIRMASTER, then LONG WALK/SPOILAGE, then HOLLOW MAN/BROODMOTHER.

Elites do **not** have phases. They are a wall, not a fight with an act break.

THE BROODMOTHER is the odd one — a [[Enemies#The two late arrivals|cyst]]
does not chase, so the fight is entirely about crossing the room to it while
what it has hatched comes the other way.

They are not a chunky crawler. An elite carries **1.9×** its species' damage,
moves 25% faster, and is nearly twice the size. On its own timer (`e.eliteT`,
every 2.2–3.2s) it also fires a ring of `8 + floor*1.5` shots **and summons
`1 + floor*0.7` reinforcements**, so you cannot simply back away from one the
way you can from a bloater.

### Priced off the floor's boss, not off the species

```js
ELITE_SHARE = 0.22
hp = floorBossHp * ELITE_SHARE * flavour * powerMul()
```

It used to be `speciesHP * (5 + floor*1.6)`, and that was quietly broken. The
species table spans **26 (CRAWLER) to 170 (CYST)** — a 6.5× swing — and the
depth term multiplied straight through it, while a floor boss is a fixed
roster number. So on any floor whose elite slots landed on HUSK/CYST, the
**wave-8 elite outlasted the wave-10 boss**:

| floor | worst elite ÷ floor boss | era |
|---|---|---|
| 6 | **1.93×** | the original build |
| 15 | **2.41×** | after the ten-boss pass |
| 15 | **9.71×** | once the build multiplier landed on top |

Species should decide how a thing *fights*, not how big its bar is. `flavour`
(0.93 CRAWLER → 1.35 CYST) keeps a BROODMOTHER chunkier than a FIRSTBORN, but
1.45× chunkier rather than 6.5×. The ordering is now true **by construction**
at every depth — worst case is `0.22 × 3.2 = 0.70×` the boss.

### They scale to your build, not just to the floor

`diff()` scales the floor by *depth*. That is only half the story: two runs on
floor 6 can be five minutes and forty minutes apart in power, because one of
them found an off-cut and three guns and the other did not. Depth-only scaling
means a good run trivialises its own elites and a bad run gets flattened by the
same numbers.

So elites read the build instead. `powerMul()` sums what you chose to pick up:

| term | each |
|---|---|
| levels | +5% |
| cards taken | +3% |
| guns owned | +7% |
| signature levels | +14% |
| off-cuts built | +18% |

**Capped at 3.2×.** Half of it applies to their damage as well — full would
make a strong run's elites one-shot you through a full FROZEN stack, none at
all makes them a stationary target you out-heal.

Measured, with a plausible build for each depth:

| floor | powerMul | worst elite | floor boss | ratio |
|---|---|---|---|---|
| 1 | 1.00 | 400 | 1,890 | 0.21× |
| 6 | 2.65 | 17,717 | 22,511 | 0.79× |
| 15 | 3.20 | 49,846 | 52,448 | 0.95× |
| 30 | 3.20 | 143,380 | 150,863 | 0.95× |

> [!note] Deliberately not applied to floor bosses
> They already have a roster HP band and a [[#Two phases|phase break]] doing
> that job. Stacking a build multiplier on top of both would make wave 10 the
> only wave that matters.

Their coin payout went 10 → 15 to match the longer fight.

> [!warning] The elite summon has no ceiling
> Unlike the [[#Summoning|floor-boss summon]], the elite branch in
> `updateEnemy()` has neither the population gate nor the clamp. At depth it
> adds enemies faster than any reasonable kill rate removes them, without
> bound — measured at 291 live on floor 26 and still climbing. See
> [[Difficulty Scaling#Elite summons are not capped]] and
> [[Bugs Found#A. Elite summons bypass the enemy cap]].

## APEX

Every fifth floor (5, 10, 15 …) the wave-10 boss arrives as an APEX: same
pattern, same roster slot, everything else turned up.

| | floor boss | APEX |
|---|---|---|
| hp / dmg | ×1 | ×2.6 hp, ×1.45 damage |
| size | ×1 | ×1.45 radius, ×1.5 sprite |
| speed | ×1 | ×1.22 |
| score | 500 | 1400 |
| tint | its own | purple |
| card drop | 55% | **guaranteed** |
| hand luck | +1.2 | **+2.4** |

It announces itself with a purple screen flash and *IT CAME UP WRONG AND IT
KEPT GROWING*. Killing one signs the **APEX PREDATOR** [[Contracts|contract]]
permanently, which widens every hand you are ever dealt to four cards.

## On death

| | elite | floor boss | APEX |
|---|---|---|---|
| coins | 15 | 26 | **50** |
| card chance | 20% | 55% | **100%** |
| frag | yes | yes | yes |
| AEGIS | — | yes | yes |
| **a pick** | **yes** | **yes** | **yes** |
| hand luck | +0.5 | +1.2 | +2.4 |
| opens deck tier | 1 | 1 **and 2** | 1 and 2 |
| [[Groceries#THE COLD ROOM\|cold room]] | — | **yes** | **yes** |

Every one of them also gets a full [[Rendering#Death burst|death burst]] at
3× scale, hitstop, a red screen flash, and the score drops to a boss-kill
sting.

The pick is deferred by `S.lvlDelay = 1.1` so the hand doesn't slam up over
the death animation.

Coins went 10/18/38 → **15/26/50**. Both classes are a much longer fight than
they were — elites carry ~50% more meat, floor bosses have a second phase to
chew through — and [[The Shop|PACI]] now expects you twice a floor.

> [!note] Only a floor boss opens the top of the deck
> Elites increment `S.bossKills` but **not** `S.floorBosses`. Tier-2 cards —
> the novas, the second chances — and [[Groceries#THE COLD ROOM|the cold room]]
> all need a real floor boss. See [[The Deck#Unlock gates]].
>
> `S.bossKills` no longer has anything to do with the shop; it is a tier gate
> and a [[Contracts|contract]] counter only.

## Their escort

A boss or elite wave also queues filler alongside the named thing —
`4 + n*0.9 + floor*3.5` for a boss, `6 + n*1.4 + floor*3` for an elite. From
**floor 2** that filler mixes in [[Enemies#The two late arrivals|husks]], so
clearing the room around a boss with splash stops being free.

## Summoning

Every floor boss calls for backup on its own `addT`/`addN` schedule, but only
while the arena is under a floor-scaled ceiling:

```js
addCap = min(30, 14 + floor*4 + evolution*2)
if (b.spawnT <= 0 && S.en.length < addCap) { ... }         // gate
const cnt = Math.min(addN + floor/2, addCap - S.en.length); // clamp
```

This is what keeps a summoning boss on top of a wave-10 spawn queue from
turning into an avalanche.

## PACI keeps wave hours now

The shop no longer hangs off boss kills at all. Clearing **wave 5** or
**wave 10** sets `S.shopDue` and the next door leads sideways — twice a floor,
on the fives. See [[The Shop#Cadence]].

The old rule (`SHOP_EVERY = 3` against an `S.bossKills` that counted elites
too) landed the shop exactly once a floor, always after the floor boss. That
put every purchase on the way *out*: you carried the floor's takings the whole
way through it with nowhere to spend them.

## Related
- [[Enemies]] — the four regular types, and what an elite is made of
- [[The Deck]] — the hand a boss pays out in
- [[The Shop]] — the cadence that opens the door
- [[Contracts]] — BREAK THE SEAL and APEX PREDATOR both count boss kills
