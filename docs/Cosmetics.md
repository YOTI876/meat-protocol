---
title: Cosmetics
tags: [reference, systems]
---

# Cosmetics

Bought with the [[Economy#The vault|vault]], not run coins — so cosmetic
progress is permanent and unaffected by what you spend mid-run. Reachable any
time from title, pause, death or the win screen, by button or the **C** key.

| cosmetic | price | look |
|---|---|---|
| **CRIMSON** | free | the default — *"the one he showed up in"* |
| **GOLD** | 1,000 | gold work shirt |
| **TOXIC** | 2,500 | sickly green, and it takes the apron with it |
| **VOID** | 5,000 | near-black, purple accents — *"stopped casting a shadow"* |
| **BONE MASK** | 9,000 | the face bleached to a skull with a red eye, shirt and apron to slate |
| **LIVING FLAME** | 15,000 | orange and red, **and the shirt is actually on fire** (`fx: 'fire'`) |

Each is a palette swap over the base Damjan sprite (`COSMETICS[i].pal`, applied
via `variant()` in `js/sprites.js` — a cached palette-remap of the same pixel
grid, not a separate drawing).

## What each key paints

`r`/`R`/`w` are the **work shirt** — the largest coloured area on him, and what
CRIMSON always meant. They have been a headband and a neckerchief in earlier
designs; the **ids never changed** (`crimson`, `gold`, `toxic`, `void`, `bone`,
`flame`), so every save has kept whatever it had unlocked through all of it.

| key | surface |
|---|---|
| `r` `R` `w` | the work shirt |
| `u` `U` | the apron |
| `s` `S` | skin — his face and both hands |
| `p` | the pupil |
| `h` `H` | hair |
| `9` `7` | the bandage |

## Three rules the set is built on

> [!note] Anything that leaves crimson takes the apron with it
> The apron (`u`/`U`) is the biggest single surface on him. TOXIC and VOID both
> repaint the shirt, and leaving a bone-white rectangle in the middle of a
> cosmetic whose entire idea is that he stopped casting a shadow would defeat
> it.

> [!note] BONE MASK works now in a way it could not before
> It bleaches `s`/`S` — every scrap of skin he has, meaning the face and both
> hands — and darkens the shirt and apron so a white head does not swim into a
> white chest. The pupil goes red, because a skull with a brown eye in it is a
> man in makeup. When [[Rendering#Damjan|his head was a full bandage]] there
> was no face for this to act on at all.

> [!note] Nothing repaints the bandage
> It keeps the neutral ramp (`7`/`9`) and no cosmetic touches it. A gold
> dressing would read as an accessory; the dressing on a wound is not a colour
> anybody chooses.

> [!note] LIVING FLAME burns where the cloth is
> The fire particles come off **`y-6`**, the top of the shirt. The body sprite
> spans `y-13` to `y+3`, so `y-13` — where the fire used to be emitted, back
> when `r`/`R`/`w` was a headband — is now the crown of his head.

## Equipping

Only one equipped at a time, saved to `localStorage` (`cosEq`), independent of
the current run — it persists across deaths, restarts, and evolutions.

## Related
- [[Rendering#Damjan]] — the figure these are painted on, and why it was rebuilt
- [[Economy#The vault]] — where the money comes from
- [[Rendering#Menus]] — the cosmetics screen's live preview and hover states
