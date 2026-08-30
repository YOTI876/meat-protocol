---
title: Boss Designs
tags: [design, proposal]
---

# Eleven fights

The baseline these are beating is in [[Boss Audit]]. The rule set:

1. Each fight is built on a **different core verb**, and none of them is
   "shoots projectiles".
2. **No attack appears in two fights.** Not reskinned, not retuned.
3. **No phase break is "same fight, more damage."** Every break introduces a
   new rule, removes an option, or changes the arena.
4. Every attack has a telegraph readable **through darkness and 95 adds**.
5. Each boss is identifiable **from silhouette alone**.
6. Each fits its existing `BOSS_HP` rung and `bossBudget()`. Deeper bosses get
   **more complexity, not more health**.

## What transfers from the reference games, and what does not

Studied: Hades, Hollow Knight, Enter the Gungeon, Binding of Isaac, Risk of
Rain 2, Dead Cells, Furi, Titan Souls, Cuphead, Nuclear Throne.

### Principles that transfer

| principle | from | why it works here |
|---|---|---|
| **A phase break should delete an option, not add a number** | Hades — Hydra's heads: phase 2 does not make the head hit harder, it makes the head *stop being the only target* | Our `enterPhase()` already wipes the screen; it has the ritual and not the rule change |
| **The boss should be the brightest thing on screen** | Cuphead — every boss is high-value against a deliberately desaturated stage | Our arena is dark and cluttered; a boss that owns a hue nothing else uses is legible at 26px |
| **Sound is a telegraph channel that darkness cannot take** | Dead Cells — the Time Keeper's parry window is audio-first | We have a full `A.*` bus and `blackout` on floor 7. **This is the single most transferable idea in the list** |
| **A fight can be about your resource rather than your position** | Risk of Rain 2 — Mithrix phase 4 takes your items | Nothing in our game currently threatens the build. THE BEST BEFORE and SUNDAY ROAST both do now |
| **One unavoidable thing you position around beats five avoidable ones** | Titan Souls — every boss is one attack and one weak point | At 95 adds, *fewer and bigger* is the only readable direction |
| **Adds should be the boss's resource, not the boss's filler** | Binding of Isaac — Mom's Heart spawns as pressure, not as damage | We already spawn 4–5 per cycle. Making the boss *consume* them is free complexity |
| **Telegraph by changing the room, not by adding a sprite** | Furi — the arena ring recolours before a phase | A 480x270 screen has no room for a warning icon; it has plenty of room for the floor changing colour |

### What does NOT transfer, and why

> [!warning] Half of Hollow Knight assumes a clean plane and full visibility
> Its bosses telegraph with **animation windup** — a pose held for 12 frames
> that you read across an empty arena. We have up to 95 adds and a light cone.
> A 26-pixel boss holding a pose behind four crawlers is not a telegraph, it is
> a coincidence. **Every windup here must be paired with a non-positional
> channel: sound, a full-screen tint, or a floor change.**

Also rejected:

- **Cuphead's memorisation-dense patterns.** They work because the stage is
  static and empty. Ours has moving props and a shuffled roster, so a pattern
  you can only solve by memorising it is a pattern most players meet twice.
- **Gungeon's bullet-pattern density.** Gungeon gives you a dodge-roll with
  generous i-frames and a clean readable floor. Our dash is a brake on `slick`
  and a repositioning tool everywhere else, and our floor is busy. Density is
  the one axis we must not push.
- **Furi's parry.** We have no parry and adding one is a combat-system change,
  not a boss change.
- **Titan Souls' one-hit-kill.** Our run is 10 floors deep with a build; a
  boss that ignores the build invalidates the build.
- **Risk of Rain 2's verticality.** Top-down, no z-axis. Anything that solves
  readability by moving the boss *up* is unavailable to us.

---

## 0 · THE BUTCHER — *it takes things off you*

**Floor:** roster-shuffled. **Verb: taking something away.** It removes your
distance first and then your gun, so the fight walks you backward through your
own options until you are holding a knife in a small room.

**Silhouette:** unchanged and already correct — a hooked slab, head sunk into
the shoulders, and now **the hook hangs visibly from the low arm**. At 480x270
the hook is the read: it is the only boss with something dangling below its own
outline, and when the hook is *out* the silhouette is visibly incomplete.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **ON THE HOOK** | throws the hook; on contact drags you to butcher's distance and **holds you there for 0.6s** | the arm rises and the hook glints white — plus `A.ram()` pitched down | **32** | break the line with a prop, or dash the instant it lands |
| **THE TRIM** | a short horizontal cleave inside 74px that **does no damage** and instead knocks your current magazine to zero | the boss squares its shoulders, floor under it flashes bone-white | **26** | leave the reach, or accept it with a full mag already spent |
| **HUNG** | one carcass hook descends from off-screen onto a marked spot; standing under it when it lands is a heavy hit | ceiling shadow grows on the floor for a long beat | **75** | walk out of the shadow |

**Phase 2 — THE APRON.** It stops throwing the hook and **wears it**: the hook
now trails behind the boss on a chain as a moving damage line anchored to its
body. The new rule is that *the space behind it is lethal*, so the safe side of
the boss inverts — the position you have been trained to hold for the whole
first phase becomes the wrong one.

**The mistake that kills you:** reloading after THE TRIM. It empties the mag,
so the instinct is to press R, and the reload animation is the longest window
in the game. The fight wants you to *switch weapon* instead.

**Adds:** ignores them completely. It never targets them, never eats them, and
its hook passes through them. THE BUTCHER is a duel happening inside a crowd.

**Punishes:** high-magazine sustained guns — THE HOG, THE FISH — because THE
TRIM deletes the resource they are built on. **Rewards:** THE MEAT SPLITTER and
GOD FINGER, low-mag burst weapons that were going to reload anyway, and any
TOOLS aisle build with `HAIR TRIGGER`.

*It is the only one that wants you alive long enough to take everything first.*

---

## 1 · MOTHER OF MELONS — *she eats her children*

**Floor:** roster-shuffled. **Verb: consuming the room.** She does not seed the
room any more — [[Boss Audit|brood is cut]]. She **eats the adds** to heal, so
every add on the floor is a health potion she is walking toward, and the fight
becomes a race between your DPS and your crowd control.

**Silhouette:** the many-eyed sac, and it **visibly swells** with each add
consumed — the outline grows by up to 40% across the fight and shrinks when she
is damaged. She is the only boss whose size is a health bar.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **THE LATCH** | reaches for the nearest add and drags it in; on arrival she heals 4% of max | a thick green tether draws from her to the target — visible through darkness because it is a **lit line**, not a sprite | **40** | kill the tethered add before it arrives, or body-block the tether |
| **FULL** | when she has eaten three, she **stops moving and gives birth**: the three come back at 1.5x size, hers, and they chase | she goes still and the tether colour goes white | **55** | burst her during the birth — she cannot move |
| **SPLIT SKIN** | at the seam down her height, a 0.9s pulse that pushes everything (adds included) away from her | the seam opens and light comes out of it | **54** | it is a knockback, not damage — use it to reposition |

**Phase 2 — SHE STOPS BEING HUNGRY.** She can no longer eat. Instead every add
that dies **within 80px of her** heals her for the same amount. The rule
inverts: in p1 you protect adds from her, in p2 you must kill adds *away* from
her. Same crowd, opposite instruction.

**The mistake that kills you:** clearing the room. A clean room is a room where
she has nothing to eat — and in p2 a clean room near her is a full heal.

**Adds:** **consumes them.** This is the fight where the add economy is the
mechanic rather than the noise.

**Punishes:** BLACK FRIDAY, THE ROTISSERIE, anything that gathers or sprays,
because both drag the crowd into exactly the place she wants it. **Rewards:**
GOD FINGER and THE DELI SLICER — precision at range, killing the tether target
specifically. FROZEN aisle is strong here: a frozen add cannot be dragged.

*She was never full. The children were always the meal.*

---

## 2 · THE PITCHER — *the room stops being level*

**Floor:** roster-shuffled. **Verb: the room turns against you.** It does not
attack the player much at all; it attacks the *floor*, and you fight the
building.

**Silhouette:** the glass vessel — shoulders, belly, foot, face suspended in
the liquid. The **liquid line inside it visibly tilts to match the room's
current lean**, so the boss is the spirit level that tells you which way the
floor is going.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **THE LEAN** | tilts the arena for 4s: a constant velocity bias pushes everything downhill, player and adds alike | the liquid line in its belly swings first, **and the whole floor tints toward the low edge** | **66** | pre-position uphill; dash is unaffected by the bias |
| **DECANT** | pours a spreading puddle from itself that follows the current lean downhill | the pour starts as a visible dribble before it becomes a pool | **45** | it flows downhill — stand uphill of it, which fights the lean |
| **THE LEVEL** | slams the room flat: everything currently sliding is **stopped dead and stunned for 0.4s**, you included | it rights itself with a hard clink, audio-first | **30** | be stationary when it lands, which means fighting the lean early |

**Phase 2 — THE ROOM DOES NOT COME BACK.** The lean stops resetting between
casts and instead **accumulates**: each LEAN adds to the last, so by the end of
the phase the floor has a permanent strong downhill. It never attacks you
directly in p2 at all. The arena is the boss.

**The mistake that kills you:** fighting the lean with the movement key.
Walking uphill is slow enough to make you a target for the whole room. The
answer is to accept the slide and use it, treating downhill as free movement.

**Adds:** ignores them, but the **lean moves them too**, so a downhill corner
silts up with the whole room's crowd. This is the fight where the adds become
terrain.

**Punishes:** THE HOG — the 45% self-slow plus a downhill bias is close to
immobility — and THE DELI SLICER, whose return path is thrown off by the drift.
**Rewards:** FRESH aisle speed builds, SECOND WIND dashes, and THE ROTISSERIE,
which does not care which way you are facing.

*It has been full of something for a long time and the shelf was never straight.*

---

## 3 · THE HOGFATHER — *one shell, and you choose where you are*

**Floor:** roster-shuffled. **Verb: a single unavoidable thing you position
around.** It fires one shell. It always hits. The fight is entirely about where
you are standing when it does.

**Silhouette:** unchanged — ears at the top corners, two tusks leaving the
outline, the only boss with anything pointing **up**. Now **the thing it is
carrying is visible on its back**, and it gets smaller each time it fires.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **THE DELIVERY** | one shell, marked on the ground, that **cannot be dodged by moving** — the mark follows you at 40% of your speed for 2.4s before it lands | a bone-white ring locked to the floor and a rising two-tone whistle | **144** | you cannot outrun it; you *lead it* onto adds, because it damages everything in the mark |
| **DOWNWIND** | the blast leaves a 3s cloud where it landed; standing in it halves your rate of fire | the cloud is a visible ground fog | persistent | leave the crater; do not fight in your own hole |
| **SHOULDERED** | if you are within 60px when a shell lands, it **shoulder-checks you across the room** instead of firing again | it turns its head to you, tusks catch the light | **34** | do not crowd it while the shell is in the air |

**Phase 2 — IT PUTS THE BAG DOWN.** It stops carrying the shells and starts
**dropping them where it stands**, then walking away. The mark no longer
follows you — it follows *it*. The rule flips from "you cannot escape the mark"
to "the mark is wherever it has been", which turns the whole fight from
evasion into map control.

**The mistake that kills you:** running from the mark. It follows. The players
who die are the ones who spend all 144 frames sprinting instead of walking it
onto the crowd.

**Adds:** **uses them as a resource against you** — the mark damages adds too,
so it will happily bury its own reinforcements to hit you.

**Punishes:** camping builds and THE FISH, which wants to hold one line.
**Rewards:** anything with splash that benefits from the mark herding the room
into one place — CLEAVER, FOLLOW-THROUGH, BLAST FURNACE.

*He is carrying something and it has your name written on the underside.*

---

## 4 · THE COURIER — *it bills you for standing still*

**Floor:** roster-shuffled. **Verb: forces you to move constantly.** It does
not chase you and it does not shoot much. It **marks where you are** and comes
back for it.

**Silhouette:** unchanged — visored torso over one spoked wheel, the only
circular lower half. The wheel now **leaves a visible track on the floor** for
3s, so its recent path is legible even in the dark, which is also the telegraph
for its return.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **SIGNED FOR** | stamps the tile you are standing on. After 3s that tile **detonates**, and it stamps every 1.1s | the stamp is a bright ring left behind you — you are drawing the danger yourself | **180** | keep moving; never double back |
| **THE ROUND** | rides its own tyre track from 3s ago at 4x speed, damaging along it | the track is already drawn — it is a **pre-drawn attack line** | track age | be off its old path, which you can see |
| **RETURN TO SENDER** | picks up an uncollected stamp and throws it at you as a slow projectile | it stops, and the stamp lifts off the floor | **48** | shoot the thrown stamp — it has 1 HP and dies to anything |

**Phase 2 — SAME-DAY.** The stamps stop expiring. Every tile it stamps in p2
stays armed for the rest of the fight, so the arena is consumed by your own
movement history. The rule change is that in p1 movement is safety and in p2
**movement is what is killing you** — the floor you use is the floor you lose.

**The mistake that kills you:** circling. Circle-strafing is the reflex the
whole game trains, and it walks you straight back onto your own stamp.

**Adds:** ignores them. The stamps hurt adds too, so a long fight in p2 clears
the room for you as a side effect — the one fight where the arena becoming
lethal is partly good news.

**Punishes:** THE FISH and GOD FINGER, both of which want you planted.
**Rewards:** mobile builds, FRESH aisle, and THE ROTISSERIE, which fires while
you run.

*It has been circling for hours and it has your address.*

---

## 5 · THE FISHWIFE — *you fight a sound*

**Floor:** roster-shuffled. **Verb: hiding.** She is not on the screen for most
of the fight. She is under it.

**Silhouette:** all mouth, tapering to a point then flaring into a fluke — and
critically, **when submerged she is a bulge in the floor texture**, not a
sprite. The read is a displaced tile pattern moving under the surface.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **SOUNDING** | submerges. While under, she is untargetable and moving. Every 1.2s she **pings**, briefly lighting her own position through darkness | the ping is audio-first (`A.beam()` pitched down) with a one-frame light bloom at her position | ping cadence | listen, aim at the last ping, wait for the surface |
| **BREACH** | erupts under you: a 30px column, heavy damage, and she is targetable for 1.6s afterward | the floor under you cracks and rises | **38** | move off the crack; the reward is her only vulnerable window |
| **THE NET** | from the surface she throws a spreading net that **slows you 60% for 2s** where it lands, and does no damage | thrown high, casts a shadow that arrives before it does | **50** | do not be caught slowed when the next BREACH is due |

**Phase 2 — THE TIDE.** She stops surfacing. She is submerged permanently, and
BREACH is now the only way she can be hit — but the pings stop, and instead the
**adds react to her**: enemies near her position visibly flinch away, so the
crowd becomes your sonar. The rule change is that in p1 the game tells you
where she is and in p2 the *room* does.

**The mistake that kills you:** chasing the ping. The ping is where she *was*.
Players who lead it live.

**Adds:** **hides behind them** in p1, and in p2 the adds are the only thing
revealing her. She is the one fight that gets harder as you clear the room —
kill everything and you have blinded yourself.

**Punishes:** GOD FINGER and BLACK FRIDAY — long charges wasted on an
untargetable boss — and anything AoE that clears your own sonar.
**Rewards:** THE MEAT SPLITTER and burst weapons that can dump into a 1.6s
window, and FREEZER BURN for holding the crowd alive as markers.

*She has been on ice since Friday and the ice was never the thing holding her.*

---

## 6 · THE TRIMMINGS — *it comes apart*

**Floor:** roster-shuffled. **Verb: splitting into parts.** It is not one boss.
It is four, and the health bar is shared.

**Silhouette:** the asymmetric heap — no mirror line, and the lean is the
identity. Each **limb that detaches keeps a piece of the lean**, so the four
parts read as one creature's handwriting.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **SHED** | detaches a limb. The limb is an independent body with its own AI and shares the boss's bar; the core shrinks visibly | the heap shudders and the limb's outline separates before it leaves | **44** | kill limbs or kill core — damage to any of them is damage to all |
| **RECOMBINE** | surviving limbs converge on the core; each one that arrives heals the shared bar 5% and the core **grows** | the limbs all turn at once — a synchronised movement in a room where nothing else is synchronised | **60** | intercept the returning limb, or burst the core while the limbs are away |
| **THE PILE** | the core drops still and every limb **charges the player simultaneously from its own angle** | all limbs stop, then point | **36** | there is one gap: the angle no limb is on. Find it and stand in it |

**Phase 2 — IT STOPS PUTTING ITSELF BACK.** No more RECOMBINE. Instead the
core sheds **continuously** until it is a husk with 20% of the bar and six
limbs holding the rest. The rule change: p1 is a boss with adds, p2 has **no
boss at all** — the health bar exists but the thing that owned it does not.
Killing the core in p2 does nothing until the limbs are down.

**The mistake that kills you:** focusing the core. It feels like the boss. In
p2 it is the least important target on the screen.

**Adds:** it **converts them** — a summoned add that touches the core is
absorbed and becomes a limb.

**Punishes:** single-target burst. GOD FINGER into a four-body fight is a third
of its value. **Rewards:** THE FLYKILLER (chains between limbs), THE DELI
SLICER (two passes through a converging group), and BLACK FRIDAY at the exact
moment of RECOMBINE.

*It is every part they did not sell and none of the parts agree.*

---

## 7 · SUNDAY ROAST — *it cooks on your trigger*

**Floor:** roster-shuffled. **Verb: forces you to stop shooting.** This is the
proof-of-concept fight — see [[#Sequencing]]. It is the only boss in the game
whose threat level is a function of the player's own input rather than a timer.

**Silhouette:** the spit straight through and out both sides, the only
horizontal line in the roster, trussed into segments. **The segments glow
brighter from the inside as heat rises**, so the boss is its own heat gauge —
readable at 26px in total darkness because it is emissive, not lit.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **THE ROAST** | every bullet the player fires adds heat. Heat decays while you hold fire. At full it **vents**: a room-wide ring of flame from the boss outward | the boss's segments ramp bone → amber → white, plus a rising sizzle that pitches with heat | continuous, ~90 from amber | **stop firing.** Heat decays 3x faster while your trigger is up-and-idle |
| **BASTE** | at half heat it flings burning fat onto three tiles which burn for 4s | fat arcs visibly before landing | **40** | the tiles are pre-drawn — do not stand in them |
| **TURN** | the spit rotates 90°, and the horizontal bar sweeps everything on its long axis | the whole silhouette rotating *is* the telegraph — it is the only rotation in the game | **50** | be off the long axis, which is legible from the silhouette alone |

**Phase 2 — IT IS DONE.** Heat stops decaying. It only goes up, and the vent
becomes periodic and unavoidable — but the boss now **takes 2x damage while
venting**. The rule change is total: p1 rewards trigger discipline, p2 punishes
it, because heat you refuse to build is a damage window you refuse to open. The
correct play inverts from *shoot less* to *shoot everything, right now*.

**The mistake that kills you:** holding the trigger through the amber ramp on
reflex. Every other fight in the game rewards sustained fire. This one is
built specifically to punish the habit the other ten teach.

**Adds:** **ignores them**, but the vent kills them, so a heavy vent clears the
room. Building heat is crowd control you pay for in danger.

**Punishes:** THE HOG, THE ROTISSERIE and THE FISH — the three sustained-fire
guns, which build heat faster than anything else in the game. **Rewards:**
GOD FINGER, THE MEAT SPLITTER, THE DELI SLICER: high damage per trigger pull,
which is exactly the metric this fight measures.

*It has been in there since Sunday and it is still going.*

---

## 8 · THE NIGHT SHELF — *it puts the aisle back up*

**Floor:** roster-shuffled. **Verb: space denial by construction.** It does not
deny ground with hazards. It builds **walls**, and the arena gets smaller.

**Silhouette:** hard right angles and shelf lines, stock still on it, some of
it looking back. **The stock level on the boss visibly depletes** as it builds,
so how much arena it has left to take is readable off its body.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **RESTOCK** | erects a solid shelf segment — real collision, blocks bullets and bodies both | the segment rises from the floor over a long beat, semi-transparent first | **72** | shoot the segment while it is rising (it has HP), or be on the side you want to be on |
| **STOCKTAKE** | sweeps a scanner beam; anything it touches **is revealed to every add in the room**, which then converge on it for 4s | the beam is a slow visible sweep line | **60** | break the sweep with a shelf you let it build — its own walls are your cover |
| **CLEARANCE** | pulls one shelf back into itself, and everything against that shelf is dragged with it | the shelf it is reclaiming flashes | **44** | do not fight with your back to a shelf |

**Phase 2 — AFTER CLOSING.** It stops building and **turns the lights off** —
a fight-local blackout independent of the floor twist. The shelves it has
already built stay. The rule change is that p1 is about losing space and p2 is
about navigating the space you have already lost, blind, from memory.

**The mistake that kills you:** destroying every shelf as it goes up. The
shelves are the only cover in p2 and the only defence against STOCKTAKE.
Players who let it build a maze survive the dark; players who keep the room
open die in it.

**Adds:** **uses them as a weapon** — STOCKTAKE is a targeting system for the
crowd. This is the one fight where the adds are aimed.

**Punishes:** GOD FINGER and any piercing build, because walls eat the pierce,
and BLACK FRIDAY, whose pull cannot cross a shelf. **Rewards:** MICROWAVE
(ricochet off the new geometry), THE ROTISSERIE, and FROZEN aisle survivability
for the blind phase.

*It only restocks after closing and it has decided where you shop.*

---

## 9 · THE BEST BEFORE — *it has read your deck*

**Floor:** roster-shuffled. **Verb: mirroring your own build back at you.**
The only fight in the game that is different for every player, because it is
made of their own cards.

**Silhouette:** bottom-heavy and slumped, a teardrop the wrong way up, losing
to gravity. **It wears a copy of your currently-held weapon's silhouette** on
its front — small, but it is the tell for what it is about to do.

| attack | does | telegraph | frames | counterplay |
|---|---|---|---|---|
| **TASTE** | reads your **most recently taken card** and copies its effect onto itself for 12s — your crit rate, your burn, your chill, your damage bonus | it stops, and a card-shaped light rises out of it showing which one it took | **66** | you know exactly what is coming, because you picked it |
| **EXPIRY** | **disables one of your cards** for 8s, chosen as your highest-grade one | the disabled card's name floats up in the aisle colour and the deck strip greys that row | **48** | play the 8s without your best card — the fight is a stress test of the rest of the build |
| **THE DATE** | it counts down visibly from 5. At zero it heals to the **last phase boundary** unless it has taken a set amount of damage in that window | a large legible numeral over its head — the only literal UI element any boss uses, and deliberately so | **300** | it is a DPS check with a clock, and the clock is honest |

**Phase 2 — PAST THE DATE.** It stops copying single cards and takes your
**entire aisle rung** — if you are THE RED WORK, it ignites; if you are DEEP
STORAGE, it freezes the room when hit. The rule change is that p1 punishes your
last pick and p2 punishes your whole identity, so the more committed the build
the harder its second phase is. Deliberately: this is the boss that scales with
commitment rather than with the floor.

**The mistake that kills you:** taking a strong card immediately before the
fight. TASTE reads the *most recent* pick, so the card you were most excited
about is the one pointed back at you.

**Adds:** **it gives them your cards too** — during TASTE, adds within 100px
inherit a weakened copy. The crowd starts fighting like you do.

**Punishes:** narrow, over-committed builds. A PRIME CUT triple-RARE run hands
it a monster. **Rewards:** broad builds, and — genuinely — a player who has
been forced to spread across aisles by bad hands. It is the one fight where a
messy deck is an advantage.

*The date passed and it kept going, and it has been reading over your shoulder.*

---

## 10 · THE MEAT PROTOCOL — *the thesis*

**Floor 10, wave 10.** Not roster-shuffled. Three phases, 9240 base HP.

The finale is not the eleventh boss. It is the game's argument, which is:
**this building has spent ten floors taking things from you, and now it takes
the three verbs you have left.** You shoot, you move, you see. It removes them
one at a time, in that order, and gives each one back only as a reward.

**Silhouette:** three banks, one per phase, already in the code. The change is
that each phase's silhouette should be visibly *less* than the last — it sheds
mass as it takes yours, so the final form is the smallest and worst thing in
the game.

### p1 — IT TAKES SHOOTING

Holds the centre. Every shot you fire it **absorbs**, building a charge; at
full charge it releases the absorbed damage back as a single shockwave. You
cannot out-DPS it; you must fire in measured bursts and spend the gaps moving.
The counter is that a **melee-range hit — being inside 40px — bypasses
absorption entirely**, so the answer to "you may not shoot" is "get closer than
it wants you".

*Telegraph:* the absorbed charge is a growing white core inside its outline,
plus a rising tone. 120 frames from half to full.

### p2 — IT TAKES MOVING

It comes off the centre and **anchors you**: a tether attaches to the player,
and moving away from it costs health while moving toward it is free. The arena
inverts — the safest place is the closest place, which is the exact opposite of
everything the previous nine floors trained. The tether breaks if you land
enough damage, and reattaches on a timer.

*Telegraph:* the tether is a lit line, and it hums louder the further you
stretch it. Audio-first, so `blackout` cannot hide it.

### p3 — IT TAKES SEEING

It plants. The light cone **collapses to 25%** and the only illumination left
is your own muzzle flash and its attacks. This is the game's darkness mechanic
turned all the way up and pointed at the player as a boss attack rather than a
floor twist. The room fills on a rhythm you have to learn by ear.

Firing lights the room. So the final phase's rule is the exact inversion of the
first: **p1 punished shooting, p3 requires it to see.** The thesis lands there
— the last thirty seconds of the game make the thing it took from you first
into the only thing that can save you.

*It never summons in p3.* That stays. Adds during a bullet-hell blackout is
unreadable, not hard.

**The mistake that kills you:** playing p3 like p1. Trigger discipline is
correct for thirty seconds and fatal for the last thirty.

---

## Sequencing

Ranked by **impact ÷ implementation risk**. Impact is how much of the
"they all feel the same" complaint the fight answers; risk is how much of the
existing engine it has to touch.

| rank | fight | impact | risk | ratio | why |
|---|---|---|---|---|---|
| **1** | **SUNDAY ROAST** | high | **very low** | **best** | One new pattern branch, one counter hooked to player fire, no new systems |
| 2 | THE COURIER | high | low | high | Stamps are `mark` hazards, which already exist |
| 3 | MOTHER OF MELONS | high | low | high | Tether + heal, reuses the enemy list |
| 4 | THE HOGFATHER | med | low | high | A `mark` that moves — a small extension of `updateHaz` |
| 5 | THE TRIMMINGS | high | med | med | Multi-body shared health bar; touches `killEnemy` and the bar UI |
| 6 | THE BUTCHER | med | med | med | Needs a mag-zeroing hook into the weapon system |
| 7 | THE FISHWIFE | high | med | med | Untargetable state touches every targeting path |
| 8 | THE BEST BEFORE | **highest** | **high** | med | Reading the deck is easy; making 40 cards mirror correctly is not |
| 9 | THE NIGHT SHELF | high | high | low | Runtime collision geometry — the props system is baked at room build |
| 10 | THE PITCHER | med | high | low | A global velocity bias touches player, adds, bullets and props |
| 11 | THE MEAT PROTOCOL | highest | **highest** | lowest | Three new phases, one of which rewrites the lightmap. Build it last, on proven parts |

### Build SUNDAY ROAST first

It is the cheapest fight on the list and it proves the **most** load-bearing
claim in this whole document: that a boss can be built on something other than
a bullet pattern, inside this engine, without new systems.

Specifically, it proves:

1. **A boss can read player input as its threat clock.** Nothing in the game
   does this yet. If heat-from-firing works, then THE BEST BEFORE reading the
   deck and THE MEAT PROTOCOL absorbing shots are the same technique at
   different scales.
2. **A telegraph can be emissive rather than positional.** The glow ramp is
   readable at 26px, in a blackout, behind 60 adds. If that reads, every other
   fight here can use the same channel and the telegraph-blindness finding in
   [[Boss Audit]] is solved generally.
3. **A phase break can invert the correct play rather than raise a number.**
   p1 says stop firing, p2 says fire everything. If players feel that flip, the
   "same fight, more damage" problem is solved by example and the other ten
   breaks can follow the pattern.

If those three land, the remaining ten are execution. If they do not, this
whole document is wrong in a way worth knowing before writing 3000 more lines.

## Related
- [[Boss Audit]] — the baseline, and the verification pass
- [[Bosses]] — the system as it stands
- [[The Deck]] — the cards THE BEST BEFORE reads
- [[Weapons]] — the guns each fight punishes and rewards
