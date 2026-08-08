---
title: Controls
tags: [reference]
---

# Controls

| input | action |
|---|---|
| `W A S D` / arrows | move |
| mouse | aim — the laser dot shows exactly where the bullet lands |
| left click (hold) | fire |
| right click | throw a frag grenade, lands on the crosshair |
| mouse wheel | swap weapon |
| `1`–`7` | select weapon by slot |
| `Q` | cycle to previous weapon |
| `R` | reload |
| `Shift` / `Space` | dash (grants i-frames; becomes a ram with [[Groceries\|STOLEN BICYCLE]]) |
| `E` | buy the gun on the pedestal you're standing on, in [[The Shop\|PACI's shop]] |
| `B` | open/close the [[Weapon Upgrades\|Armory]] |
| `C` | open [[Cosmetics]] — works from title, pause, or the death screen |
| `Esc` / `P` | pause / resume |
| `M` | mute |
| `Enter` / click | start a run from the title screen |

## Menu navigation

Every menu (title, cosmetics, armory, pause, level-up, death) is mouse-driven:
buttons highlight on hover and animate a lift before you click them. See
[[Rendering#Menus]] for how that's built.

> [!note] Key repeat
> The keydown handler ignores a key that's already held (`if (keys[e.code])
> return`), so `B` won't flicker the armory open and shut while you lean on
> it. Worth knowing if you're ever scripting input against the game.
