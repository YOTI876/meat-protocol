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
| **GOLD** | 1,000 | gold neckerchief |
| **TOXIC** | 2,500 | sickly green, and it takes the coat and apron with it |
| **VOID** | 5,000 | near-black, purple accents — *"stopped casting a shadow"* |
| **BONE MASK** | 9,000 | pale skin, blacked-out eyes, red mouth, slate apron |
| **LIVING FLAME** | 15,000 | orange and red, **and the cloth is actually on fire** (`fx: 'fire'`) |

Each is a palette swap over the base Damjan sprite (`COSMETICS[i].pal`, applied
via `variant()` in `js/sprites.js` — a cached palette-remap of the same pixel
grid, not a separate drawing).

## They used to be BANDs

Every one of these was called a BAND, because `r`/`R`/`w` painted a headband.
[[Rendering#Damjan|Damjan was rebuilt]] and the headband went with the rest of
the bobblehead — those keys are a **neckerchief at his throat** now, which is
the second place the eye lands after the face and a thing someone who works in
an abattoir would actually own.

The **ids are untouched** (`crimson`, `gold`, `toxic`, `void`, `bone`,
`flame`), so every save keeps whatever it had unlocked and equipped. Only the
display names lost the word.

## Two follow-ons the move forced

> [!note] The coat repaints now include the apron
> The apron (`u`/`U`) is the biggest single surface on him. TOXIC and VOID both
> repaint the coat, and leaving a bone-white rectangle in the middle of a
> cosmetic whose entire idea is that he stopped casting a shadow would have
> defeated it. BONE MASK goes the other way — it turns his *face* bone-white,
> and the apron already was, so its apron goes butcher's-slate or his head
> disappears into his chest.

> [!note] LIVING FLAME burns where the cloth is
> The fire particles were emitted at `y-13`, the top of his skull, because that
> is where the headband sat. The body sprite spans `y-13` to `y+3` and the
> neckerchief is on its rows 14–16 of 32, so the fire comes off **`y-6`** now.

## Equipping

Only one equipped at a time, saved to `localStorage` (`cosEq`), independent of
the current run — it persists across deaths, restarts, and evolutions.

## Related
- [[Rendering#Damjan]] — the figure these are painted on, and why it was rebuilt
- [[Economy#The vault]] — where the money comes from
- [[Rendering#Menus]] — the cosmetics screen's live preview and hover states
