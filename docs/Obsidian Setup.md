---
title: Obsidian Setup
tags: [meta]
---

# Setting this up in Obsidian

This folder (`docs/`) is written as an Obsidian vault: every double-bracketed
link points to another note's title, and the frontmatter at the top of each
file gives it tags.

## 1. Install Obsidian

Download from **https://obsidian.md** (free, Windows/Mac/Linux) if you don't
already have it.

## 2. Open this folder as a vault

- Launch Obsidian
- On the startup screen, choose **"Open folder as vault"**
  (if you already have a vault open: **File → Open Vault → Open folder as
  vault**)
- Point it at:
  ```
  C:\Users\PC\OneDrive\Desktop\SLOP\docs
  ```
- Obsidian will index the folder and show **[[00 START HERE]]** — open that
  first, it's the index for everything else.

## 3. Recommended settings (optional but nice here)

- **Settings → Files & Links → New link format**: leave as default
  (`Shortest path when possible`) — it's what these notes already assume
- **Settings → Editor → readable line length**: on, this content reads better
  narrow
- Turn on **Graph View** (left ribbon icon that looks like connected dots) —
  with 20+ interlinked notes you'll see the whole system's shape: `Weapons`,
  `The Shop` and `Weapon Upgrades` cluster together, `Progression`/`Economy`/
  `Evolve` sit visibly apart despite the confusing overlapping names, and
  `Rendering` / `Audio` / `Music` hang off to the side as the engine layer.

## 4. Suggested community plugins (optional)

None are required — every note above uses only core Markdown, Obsidian
callouts (`> [!note]`, `> [!warning]`, `> [!tip]`), tables, and one Mermaid
diagram (native, no plugin needed). If you want more later:
- **Dataview** — could auto-generate the weapons/bosses tables from
  frontmatter if this vault grows past manual table maintenance
- **Tag Wrangler** — easier tag management once there are more notes

## How this vault is organized

```
docs/
├── 00 START HERE.md      the index — start every visit here
├── Controls.md
├── How A Run Goes.md
├── Secrets.md            spoilers
├── Weapons.md
├── The Shop.md
├── Weapon Upgrades.md
├── Enemies.md
├── Bosses.md
├── Groceries.md
├── Pickups.md
├── Progression.md
├── Economy.md
├── Cosmetics.md
├── Difficulty Scaling.md
├── Rendering.md
├── Audio.md
├── Music.md
├── File Map.md
├── Changelog.md
├── Bugs Found.md
├── Tuning Values.md
├── Deployment.md
└── Obsidian Setup.md      this file
```

Nothing here duplicates the game's own `README.md` at the project root — that
stays as the short, player-facing version. This vault is the deeper
reference: every formula, every drop rate, every bug caught along the way.
