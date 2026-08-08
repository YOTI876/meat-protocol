---
title: Changelog
tags: [reference, history]
---

# Changelog

In order, oldest first. Commit hashes match `git log` on `main`.

## `0b8bef7` — MEAT PROTOCOL: initial build
The whole game in one commit: Damjan, the SCAR-L with a laser sight, four
enemy types, the original four bosses, groceries, ten waves per floor, the
[[Secrets#1. The Eye (god mode)|Eye]] secret, reload animation, grenades, the
original weapon/coin/card economy, [[Cosmetics]], and the
[[Secrets#2. MODAGAZ|MODAGAZ]] corner secret.

## `2aa0f24` — Scale enemy counts hard with wave and floor
Found and fixed a real bug: the spawner was **budget**-based, so as the
budget grew with wave/floor it bought *fewer, tougher* enemies — deeper
floors could field fewer bodies than shallow ones. Replaced with a head-count
formula. See [[Bugs Found#5. The spawner made deeper floors *emptier*|the bug in full]].

## `62d8cb3` — Menu overhaul, visibility pass, and an evolution economy
Split menu text onto a supersampled [[Rendering#Two-canvas split|overlay
canvas]]; added hover-eased buttons; fixed [[Bugs Found#6. Screen shake was vibration, not shake|static screen shake]];
added glowing bullets and the first [[Rendering#Death burst|death burst]];
lifted floor/wall palettes and lightened darkness; cut weapon prices; OMEGA
BEAM 10→18 cards; introduced coin-gated **EVOLVE** (doubling cost) and
**RESET EVOLUTION**; enemy damage +23%, balanced by longer contact cooldown
and i-frames.

## `5b3d107` — Minimap, wave-end collection, two new pickups, fatter waves
Fixed the [[Bugs Found#9. Damjan had a gap through his stomach|sprite seam at Damjan's waist]].
Added the [[Rendering#Minimap|minimap]], [[Pickups#Wave-end collection|wave-end
vacuum]], **AEGIS** and **NOVA** pickups, film grain +20%, and made every
[[Bosses|boss]] summon adds on its own schedule under a shared cap. Contact
damage cut 5%.

## `f5eabdb` — Add a generative score
[[Music]]: the entire five-layer synthesized score, lookahead-scheduled,
keyed per floor. Fixed [[Bugs Found#8. Music could go silent after a fast death/restart|a stop/restart
race]] found while building it.

## `cefbca8` — XP upgrade tree, evolving base rifle, homing nova, nastier score
[[Progression#XP & levels|XP, levels, the level-up popup]]; the base rifle's
per-mark evolution (originally per-wave); [[Pickups#NOVA|homing NOVA
rounds]]; [[Music#The "creepier" pass|three new dread music voices]] and a
shift to all-phrygian/locrian keys; [[Groceries|grocery]] rebalance to make
room for the new power source. Fixed [[Bugs Found#7. Item pickup banner crashed on every frame it was visible|a
banner crash]] before shipping.

## `f09a24b` — Weapon upgrade armory, per-floor rifle marks, longer shield
[[Weapon Upgrades|The Armory]] (CYCLE/SPLIT/POWER per weapon); moved the
rifle's mark cadence from **per-wave to per-floor** and raised its bonus
5%→20% to compensate; the [[Rendering#GLUSEC banner|GLUSEC banner]]; AEGIS
shield 2s→3s.

## `8fcfe50` — One typeface everywhere, animated enemies, cleaner pause screen
## `6294742` — Rework the armory upgrade rows, centre the crosshair
Not mine — these two are collaborator commits. They added the embedded
typeface (`js/font.js` + `OFL.txt`), moved every enemy onto animated sprite
banks, and rebuilt the [[Weapon Upgrades|armory]] row layout that the current
version builds on.

## *(uncommitted at time of writing)* — PACI's shop, endless floors, flat SPLIT
[[The Shop|PACI's back room]] every third boss, with guns removed from the
arena floor entirely; SPLIT reduced to **one flat 100-coin rank** on every
weapon and the **OMEGA BEAM excluded from upgrades** altogether; the
[[Rendering#GLUSEC banner|GLUSEC banner]] moved to the bottom of the screen
where nothing overlaps it; five [[Rendering#Arena layouts|layout archetypes]]
instead of one scatter pass; and [[Progression#Endless floors|generated floors
past floor 4]] so the descent has no bottom. Four real defects caught before
shipping — [[Bugs Found#10. Wave 4 started while the shop was still fading in|#10]]
through [[Bugs Found#13. Deep floors overshot the enemy cap|#13]].

## Related
- [[Bugs Found]] — the defects behind each fix above, in more detail
- [[Tuning Values]] — where the numbers stand today
