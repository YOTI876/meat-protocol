---
title: The Deck (THE MENU)
tags: [reference, systems]
---

# The deck — THE MENU

The run's build. There is **no armory**: everything that used to be bought
with coins is a card you pick on level-up.

Three kinds of reward used to be shuffled into one pile. They are not the same
kind of thing and they no longer share a screen:

| source | you get | where |
|---|---|---|
| **a level** | a hand of cards | THE MENU |
| **an elite** (waves 4, 8) | a hand of cards | THE MENU |
| **a floor boss** (wave 10) | one of two [[Groceries\|signature groceries]] | [[Groceries#THE COLD ROOM\|THE COLD ROOM]] |
| **TOMCE** | one of three trades | [[Augments]] |

Press **B** any time to read what you're holding — that screen is called
**THE DECK**. *THE MENU* is the level-up screen, the supermarket you order
from.

## Rarity, and why it matters

```
COMMON · UNCOMMON · RARE · EPIC · LEGENDARY
```

| rarity | ×number | weight | colour |
|---|---|---|---|
| COMMON | ×1.00 | 100 | bone |
| UNCOMMON | ×1.35 | 30 | green |
| **RARE** | ×1.75 | 8 | blue |
| EPIC | ×2.25 | 1.6 | purple |
| LEGENDARY | ×3.00 | **never rolled** | orange |

> [!note] Plain names on purpose
> These used to be butcher's grades — SELECT / CHOICE / PRIME / BLACK LABEL /
> CONDEMNED. Thematic, and completely opaque: nothing about the word PRIME
> tells you it sits above CHOICE, so the ladder had to be explained every time
> it was shown.

LEGENDARY has weight 0 and cannot be **rolled**. Two things reach it anyway:
[[#Off-cuts|off-cuts]], and any card carrying the `leg` flag — which is
[[#SPLIT|SPLIT]] and nothing else. A `leg` card does not roll a grade at all;
it is dealt LEGENDARY or it is not dealt.

## Riders — the reason rarity is a moment

**Rarity is not a multiplier.** It was, and an EPIC card was just the same
card with a bigger number on it, which is not a moment.

Every card carries a **RIDER**: a second, qualitative effect that only
switches on if you take the card at **RARE or better** (`RIDER_AT = 2`). A
RARE MALICE is not 1.75 MALICEs — it is a different card.

Riders are deliberately verbs. They change what you *do*, not what your
numbers are:

| card | rider | what it does |
|---|---|---|
| MALICE | SHARPENED | every 6th shot always crits |
| CLEAVER | FOLLOW-THROUGH | crits splash everything within 26 |
| CARVE | SKEWER | each body a shot passes adds +25% damage |
| ROUGHAGE | STOCKED | and it heals you for that much on the spot |
| GRAZING | GORGED | healing past full banks a shield instead |
| CALLUS | THICK HIDE | the first hit of every wave does nothing |
| COLD SNAP | BRITTLE | anything slowed takes +22% from everything |
| SPLIT | CROSSFIRE | both forks steer themselves in |
| HOPPER | BOTTOM OF THE BOX | the last third of a mag hits 35% harder |
| SPOILED | CONTAGION | a burning thing sets its neighbours alight |
| SECOND HELPING | FULL PLATE | and you come back at full health |

The rider fires a banner the first time it comes online, because a silent
state change is a mechanic the player never learns they have.

`riderOn(id)` / `rd(id)` is the engine-wide read: it checks the **best grade
you ever took that card at**, not the last one.

## The five aisles

Aisles stopped being decoration. Commit to one and it commits back — **four
ranks** anywhere in an aisle buys a standing perk, **eight** buys a much
louder one. This is what gives a run a shape instead of a pile of
percentages.

| aisle | is | THE ORDER (4) | MASTERED (8) |
|---|---|---|---|
| **BLADES** | hurting things | +12% damage | crits cleave everything behind the target |
| **FRESH** | health and speed | +20 max health | clearing a wave heals a quarter of it back |
| **FROZEN** | armour and slowing | −10% damage taken | anything that dies slowed shatters for 45 |
| **TOOLS** | whatever gun you hold | +15% magazine | finishing a reload throws out a shockwave |
| **JUNK** | bad for you. worth it. | **+1 LUCK** | every fourth card dealt comes up a rarity better |

Names are one word each and the word says what the aisle does. The old
BUTCHERY / PRODUCE / HARDWARE / EXPIRED were flavour you had to memorise a
mapping for — the internal ids still use them.

> [!note] Two colour systems, two registers
> Aisle colours are muted earth tones; the rarity ladder owns the bright
> saturated palette. They appear on the same screen, so keeping them in
> different registers is the only way to tell at a glance which colour means
> *quality* and which means *category*. **Nothing on a card is ever drawn in
> an aisle colour** — aisle colour lives on THE ORDER strip and the deck
> headings, nowhere else.

`recalcAisles()` runs on every pick rather than on read, because `ST()` runs
many times a frame and would otherwise walk the whole card list each time.

## Off-cuts — the fusions

Hold two named cards at the ranks named and a **third thing exists that
neither of them was**. An off-cut is LEGENDARY, it takes the **first seat in
the next hand** the moment it unlocks, and the screen makes noise about it.
This is the part of the deck you go looking for on the second run.

| off-cut | needs | does |
|---|---|---|
| **CROSS-CUT** | SPLIT 1 + RICOCHET 1 | forks bounce twice more, and harder |
| **THE GRINDER** | THE HOOKS 2 + COLD SNAP 1 | the hooks freeze whatever they catch |
| **BLAST FURNACE** | SPOILED 2 + OVERKILL 1 | anything that dies burning detonates |
| **PERMAFROST** | FROSTBITE 1 + THE WALK-IN 2 | your aura freezes instead of slowing |
| **ARTERY** | RAW NERVE 2 + BLOOD DEBT 1 | hurt is fast. up to +60% fire rate |
| **BUTCHER'S BILL** | CLEAVER 3 + DEEP CUT 2 | a crit arcs to two more throats |
| **HARVEST** | GRAZING 2 + RENDERING 1 | standing in your own pools heals you |
| **FLASH FLOOD** | FLASHPOINT 1 + HARD FROST 1 | every nova freezes the room solid |
| **HAIR TRIGGER** | CYCLE 3 + QUICK HANDS 2 | instant reloads below a quarter mag |
| **PRIME CUT** | *three cards held at RARE+* | +25% damage, +1 LUCK, every hand runs hotter |

PRIME CUT is the odd one out — its condition is about the grades you've taken
rather than two named cards, so it has its own read (`primeCount()`).

The level-up footer prints your **nearest unbuilt off-cut with its progress**
(`fusionHint()`), which is the single line that turns a pile of cards into
something you aim at.

## The hand

```js
handSize()   = (contractDone('apex') ? 4 : 3) + ag('hollow')   // 3 to 5
rerollCost() = 20 + rerolls * 15
```

`dealCards()` seats any unlocked off-cut first (never a hand of nothing but
off-cuts), then fills from cards you haven't maxed and can unlock. Each rolls
its own rarity; the **JUNK mastery** quietly upgrades every fourth card dealt.

The fill is **weighted**, not uniform: every card carries an implicit `w` of
1 and only [[#SPLIT|SPLIT]] sets it lower. A uniform pool of 38 would still
have offered a 1-in-38 card in most hands, which is not rare.

A hand arrives with the weight of the best thing in it (`dealDrama()`): three
COMMONs open quietly, an EPIC flashes and shakes the screen before you've
finished reading the names.

Taking a card heals **+8 HP**, and if you have picks banked the screen deals a
fresh hand instead of closing.

## Luck

Luck does **not** reroll — it tilts the weights up the ladder, multiplying the
odds of every rarity above COMMON:

```js
weight(i) = GRADE[i].w * (1 + luck * 0.55 * i)
```

so it lifts EPIC harder than UNCOMMON. Sources:

- **CLEARANCE** (card) — `dkc('clearance') / 100`
- **JUNK at THE ORDER** — flat +1
- **PRIME CUT** (off-cut) — flat +1
- **GRADED** ([[Contracts|contract]]) — flat +1, permanently
- the **hand's own bonus**: `+0.5` elite, `+1.2` floor boss, **`+2.4` apex**

## Storage

```js
S.deck[id] = { rank, amt, g }
```

`rank` is how many times you took it (against `max`), `amt` is the accumulated
number the game reads, `g` is the **best** rarity you ever took it at — which
is what the rider checks. `dk()` reads raw; **`dkc()` reads capped**.

> [!note] The cap lives on the card
> A card that says "−45% damage taken" has to mean it. The cap is a property
> of the card and both the maths *and* the printed number go through `dkc()`,
> so a card face can never promise something `ST()` won't pay.

## SPLIT

The one card in the deck with its own set of rules, because it is the one card
that broke the rest of them.

| | was | is |
|---|---|---|
| ranks | 2 | **1** |
| fires | `2n+1` — 3 then 5 | **2, and no centre shot** |
| fork damage | ×0.5 | **×0.65** |
| total output | ×3.0 at rank 2 | **×1.30** |
| rarity | rolled like anything else | **always LEGENDARY** (`leg: 1`) |
| pool weight | 1 | **0.30** — about 1 hand in 40 |
| first dealt | floor 1 | **floor 3** (`floor: 2`) |

At full power one pick roughly tripled crowd output with no downside at all,
which meant every other TOOLS card was a worse SPLIT. Two forks at 0.65 is
+30% traded against never hitting dead centre — a real cost on GOD FINGER, a
real gift on a shotgun.

Because it is LEGENDARY it always clears `RIDER_AT`, so **CROSSFIRE is never
off**: both forks steer themselves back in. That is now the card's identity
rather than a bonus tier of it.

> [!note] Rare, not removed
> `w` first landed at 0.08 — one hand in a hundred and forty, which over a
> whole run means nobody ever sees it and [[#Off-cuts|CROSS-CUT]] (which needs
> a rank of it) can never be built. 0.30 is about once in a deep run, which is
> what a random LEGENDARY should feel like.

## Unlock gates

Two independent gates, and a card can carry both.

| `b` | dealt |
|---|---|
| 0 | from the start |
| 1 | once you have killed **an elite** |
| 2 | once you have killed **a floor boss** |

| `floor` | dealt |
|---|---|
| unset | any depth |
| *n* | only once `S.room >= n` — SPLIT is the only card that sets it |

Gating tier 1 behind wave 10 meant a whole floor fought on plain numbers,
which is not difficulty, it is a flat line. The wave-4 elite exists partly to
open the deck early.

**38 cards**, up from 28 once the five groceries were taken out.

## Related
- [[Groceries]] — the signatures, and the cold room they come from
- [[Augments]] — TOMCE's parallel system, which is *not* the deck
- [[Contracts]] — three of them change how the deck behaves
- [[Progression]] — XP, levels, and the sidearm's marks
