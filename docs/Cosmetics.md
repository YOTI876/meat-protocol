---
title: Cosmetics
tags: [reference, systems]
---

# Cosmetics

Bought with the [[Economy#The vault|vault]], not run coins — so cosmetic
progress is permanent and unaffected by what you spend mid-run. Reachable any
time from title, pause, or death, by button or the **C** key.

| cosmetic | price | look |
|---|---|---|
| **CRIMSON BAND** | free | the default — "the one he showed up in" |
| **GOLD BAND** | 1,000 | gold headband/jacket recolour |
| **TOXIC BAND** | 2,500 | sickly green recolour |
| **VOID** | 5,000 | near-black, purple accents — "stopped casting a shadow" |
| **BONE MASK** | 9,000 | pale skin, blacked-out eyes, red mouth |
| **LIVING FLAME** | 15,000 | orange/red recolour **and** the headband actually
  emits fire particles in-game (`fx: 'fire'`) |

Each is a palette swap over the base Damjan sprite (`COSMETICS[i].pal`,
applied via `variant()` in `js/sprites.js` — a cached palette-remap of the
same pixel grid, not a separate drawing).

## Equipping

Only one equipped at a time, saved to `localStorage` (`cosEq`), independent
of the current run — it persists across deaths, restarts, and evolutions.

## Related
- [[Economy#The vault]] — where the money comes from
- [[Rendering#Menus]] — the cosmetics screen's live preview and hover states
