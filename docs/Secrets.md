---
title: Secrets
tags: [reference, spoilers]
---

# Secrets

> [!warning] Spoilers
> This page explains how to find all three. If you'd rather find them
> yourself, stop reading.

## 1. The Eye (god mode)

Floor 1 only, one per save. A single brick in the north wall (`S.secret`) is
almost — but not quite — the same colour as its neighbours. Shooting it
13 times (`need: 13`) breaks it open and drops the **THE THIRD EYE**:

- `S.god = true` for the rest of the run
- 3× damage multiplier, near-immortality, rainbow-tinted everything
- One flicker of red every 4–8 seconds is the only hint before it's found

Code: `breakSecret()`, `triggerGoromania()`'s sibling in `game.js`.

## 2. MODAGAZ

One sigil per floor, hidden in a **different corner each floor** (`S.corner`),
drawn at ~5% opacity until you're almost standing on it. Stepping within 13px
triggers it:

- +1 [[Economy#Cards|card]]
- +1500 score
- A formant-synthesized voice says "MODAGAZ" — see [[Audio#Formant speech]]
- Screen flashes purple, tears briefly

## 3. GOROMANIA

Not a location — a **behaviour**. Shoot the north door **30 times while it is
still shut** (before the last wave opens it). Every 10th hit prints "it is
listening." At 30 hits (`triggerGoromania()`):

- +1 card, +4000 score
- **+25% damage for the rest of the run** (`S.goro`, folded into `ST().dmgMul`)
- 2 seconds of hard strobing at ~22Hz plus a second formant voice line
  ("GOROMANIA") — see [[Audio]] for the formant speech engine behind it

## Design note

None of the three appear on the [[Rendering#Minimap|minimap]] — that was
deliberate. A map that marked secrets wouldn't be secrets.
