---
title: Shared inventory
type: concept
summary: The EDICT-0017 tracker model — one world-level item stock whose per-build covered/left figures are derived by allocating it in list order.
updated: 2026-10-26
sources: []
tags: [minecraft, data-model, tracking]
---

# Shared inventory

The tracker used to keep a `got` counter on every build's material row, so the same stack of stone
counted once per build. EDICT-0017 replaced that with **one inventory per world** and a computed
allocation: a material stores only what the build still needs (`needed`), and what each build
already has is derived from the world stock it can claim. It is the mechanism behind
[[Minecraft Build Tracker]]'s shopping list and progress bars.

## The model

- **One stock.** `world.inventory` is a map `item-slug → count` (non-negative integer). It holds
  an entry for every item any build in the world names, even at `0`, so a row always has stock to
  show. Nothing else stores a count of held items: `material` is `{id, item, needed}` and the old
  `collected` field is gone.
- **Allocation order.** `M.allocate(world)` walks `world.builds` in array order. A paused build
  (`active === false`) and a Done build are skipped for allocation; a Done build reports its full
  need as covered and never consumes stock.
- **Claiming.** For each item, active builds are grouped in build order and each build claims
  `min(its need, stock remaining)`; inside one build, duplicate rows for the item are filled in
  material order. `covered` is the sum claimed, `remaining = max(0, needed − covered)`, and
  `surplus` is whatever stock is left after every active build (`remaining` is never negative).
- **Contested stock.** `shared` counts active builds with a non-zero need for the item; the row
  shows `shared with N builds` only when N > 1 in the standard view. The first build keeps what
  it needs — the list order *is* the priority order.
- **Derived, never stored.** `perMaterial` (row `In`), `perBuild` (build bar), per-item
  `covered/remaining/surplus` (rows, compact tiles), the sidebar's `X / Y items gathered (Z%)`
  and the shopping list (`remaining > 0`, with owners) are recomputed on every render. Editing
  the inventory changes every build's numbers at once.

## Why per-build counters were retired

Two builds sharing a chest double-counted the same stack: the world could claim to hold 100 stone
while the builds needed 64 + 64, and the old shopping list demanded 128. The allocation answers
"how much of this is left *for this build*" without a second ledger, and pausing or finishing a
build hands its share back to the pool. The cost is positional: there is no per-build reservation,
so reordering builds changes who gets contested stock (see [[Open questions]]).

## Migration

Schema **2** lives under `mc-build-tracker:v2`; `mc-build-tracker:v1` is left untouched.
`M.migrateV1` sums each world's per-build `collected` into `inventory` by item slug
(case-insensitively), deletes the material's `collected`, defaults `active` to true, clamps
`needed` at 1, sets `migratedFrom: 1` once, and the next save drops that notice. Import behaves
the same way: a v1 backup migrates, while a v2 file whose materials still carry `collected` is
refused. The merge is one-way and lossy — two builds that each recorded 64 stone become a single
stock of 128 (see [[Local-first tracking]] for the storage layer).

## Reading and changing the stock

- The standard row shows `Item | Needed | Got | In | Left | Surplus | Update | menu`; only
  **Needed** is typed (Enter/blur commits, Escape restores, ≥1).
- **Update** opens `#inventory-dialog` for that build and item: an absolute number or a delta
  `+64`, `-32`, `2s`, `2s+10` (a stack is the item's own size), the delta winning. One commit, one
  Undo; Escape writes nothing.
- Units (Items / Stacks / Shulkers) only re-format counts through `M.formatUnits`; a shulker is 27
  stacks. Typed values are always item counts.
- A compact material tile shows the remaining count and opens the same dialog
  ([[Compact view]]); the sidebar owns the world's progress line and shopping list
  ([[World sidebar]]).

## Relations

- Part of [[Minecraft Build Tracker]]
- Replaces the per-build counter that [[Number stepper]] was built around (the stepper itself is
  retired)
- Persisted by [[Local-first tracking]]; distinct from [[Status-ranked build ordering]], which
  orders the rendered list — allocation uses the stored array order

## Tensions / open questions

- **Allocation is positional and volatile.** It depends on array order and on the pause/Done
  flags; there is no way to reserve a stack for a specific build, and the numbers move when the
  world stock or the order changes.
- **Migration is lossy.** Per-build attribution cannot be recovered after the merge, and the v1
  key is never deleted, so clearing only the v2 key re-migrates stale data on the next load.
- **Duplicates merge silently.** Two rows for the same item in one build are filled in material
  order; a pasted list deduplicates by item slug before the allocation ever sees it.
