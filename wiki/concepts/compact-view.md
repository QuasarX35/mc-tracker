---
title: Compact view
type: concept
summary: A second builds view — one card per build with a material matrix and a quick-update dialog — for scanning a large world without the list/detail split.
updated: 2026-10-26
sources: []
tags: [interaction, layout, minecraft]
---

# Compact view

**Compact view** is the [[Minecraft Build Tracker]]'s second way to read the Builds tab. A
Standard/Compact switch (`#view-standard` / `#view-compact`) persists the choice in
`localStorage['mbt.buildsView']`; Compact hides the list/detail split and the
[[World sidebar]], uses the full panel width, and renders `#compact-grid` as
`repeat(auto-fill, minmax(560px, 1fr))` cards. A derived `#compact-world` line keeps the world
name, edition/version and gathered summary on screen.

## The card

Each `article.ccard` shows the build title, status chip and gathered percentage; hover or focus
reveals edit/delete actions; meta carries the material count, coordinates and created/updated
stamps; a 10 px bar carries progress. Below it, `button.ctile` tiles form the material matrix:
an open tile shows the **deficit** (needed − got), a done tile shows the target and dims to 45%
with a check badge. Tiles reuse the shared `#mc-tooltip` for name, owned/required and stack
arithmetic.

## Quick update

Clicking a tile opens the quick-update dialog. `#tile-absolute` is the collected count (selected
on open, Enter commits); `#tile-relative` accepts a signed amount — `+64`, `-32`, or the stack
shorthand `2s` / `2st` via `M.parseRelative`. Clicking the mini steppers changes the signed field;
Enter commits, Escape leaves the count untouched, and errors surface in `#tile-error`. One
`M.updateMaterial` then one commit; no synthetic events.

## Relations

- A view of the [[Minecraft Build Tracker]] built by EDICT-0016.
- Opens the [[Number stepper]] in its dialog and hides the [[World sidebar]].
- Makes density a product choice in [[In-game GUI design]].
- Phase 2 (global inventory, phases, Ascend, crafting, procs, Power) is deferred to
  [the phase-2 backlog](../../docs/backlog/compact-view-phase-2.md).

## Tensions / open questions

- **Builds only.** Materials and Worlds keep their standard layouts; a second compact surface is
  not designed.
- **Discovery.** The switch is a small two-button control; users who never find it keep the
  standard view.
- **Matrix density.** Six-plus tiles per card at 1280 is the floor, but a build with dozens of
  materials still wraps into a tall block.
- **Phase 2 is unowned.** The deficit formula across worlds and the target/phases model are in
  the backlog, not this round.
