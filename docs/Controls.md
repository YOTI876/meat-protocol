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
| `1`–`0` | select weapon by slot |
| `Q` | cycle to previous weapon |
| `R` | reload |
| `Shift` / `Space` | dash (grants i-frames; becomes a ram with [[Groceries\|STOLEN BICYCLE]]) |
| `E` | buy the gun you're standing on in [[The Shop\|PACI's shop]], **or** talk to [[Augments\|TOMCE]] |
| `B` | open/close [[The Deck\|THE DECK]] — everything you're holding |
| `C` | open [[Cosmetics]] — works from title, pause, or the death screen |
| `Esc` / `P` | pause / resume — and **refuse** TOMCE's offer |
| `M` | mute |
| `Enter` / click | start a run from the title screen |
| `R` | retry, on the death screen |

`E` is context-sensitive: it's whatever you're standing next to. There is no
separate key for TOMCE.

> [!note] Eleven guns, ten number keys
> `WORDER` has eleven entries but `Digit1`–`Digit0` only reach the first ten
> slots. [[Weapons#THE FISH|THE FISH]] sits last, so once you own everything
> it is wheel-or-`Q` only. Not a bug worth a key for — by the time you have
> found 500 coins for a fish you are not swapping off it.

## Two things called a menu

| name | is |
|---|---|
| **THE MENU** | the level-up screen — the supermarket you order from |
| **THE DECK** | what you've already picked (`B`, or the pause button) |
| **MAIN MENU** | the pause button that abandons the run |

The pause button used to be called THE MENU, which stopped working the moment
MAIN MENU appeared two buttons away on the same row: two buttons both called
menu read as the same door.

## Menu navigation

Every screen (title, cosmetics, the deck, contracts, pause, level-up,
augments, the cold room, death) is mouse-driven: buttons highlight on hover
and animate a lift before you click. See [[Rendering#Menus]].

`B` reaches the deck from **play or pause**; `CONTRACTS` is on the title
screen; `Esc` walks back out of whichever one you're in.

**MAIN MENU** (pause) abandons the run. Coins, cards, the vault and every
[[Contracts|contract]] counter are persisted continuously, so quitting costs
exactly the floor you were standing on — it is the death path minus the death.

> [!note] Key repeat, and one real bug it hid
> The keydown handler ignores a key that's already held (`if (keys[e.code])
> return`), so `B` won't flicker while you lean on it. Contextual `E` actions
> go further and clear the key themselves (`keys.KeyE = false`) so one press
> buys one thing.
>
> `B` itself used to be two statements whose second was an `else if` chained
> off the `Escape` line below it — so pressing `B` in play opened the deck and
> the second branch, now seeing `mode === 'deck'`, closed it again in the same
> event. From pause it silently unpaused you. It's one statement and one
> decision now.
