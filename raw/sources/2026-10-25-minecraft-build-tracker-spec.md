---
title: Minecraft Build Tracker — product specification (snapshot)
type: raw-source
captured: 2026-10-25
origin: EDICT-0005 shipped product — src/index.html, src/app.js, src/tracker/model.js, README
capture_method: compiled from the shipped code and the edict record; immutable snapshot
---

# Minecraft Build Tracker — product specification

A local web tool for planning Minecraft builds and tracking the materials they need, across
several worlds. Styled after the Minecraft in-game GUI. Opens by double-clicking
`src/index.html`; no build step, no server, no install, works offline.

## User stories

- As a player, I keep one tracker per world (Survival SMP, Creative Flat, …) so build lists
  do not mix.
- As a player, I plan a build with a status (Planned / Building / Done), coordinates and
  free-text notes.
- As a player, I list the materials each build needs as an item name plus `needed` and
  `got` quantities, edited inline while I play.
- As a player, I want one shopping list for the whole world: every item summed across builds,
  what is still outstanding, and which builds need it.
- As a player, I want to copy the list into chat or a notebook, and to export a backup so a
  cleared browser does not destroy weeks of planning.

## Data model (schema version 1)

```
state = { version: 1, activeWorldId, worlds: [ world ] }
world = { id, name, edition: 'java'|'bedrock', version, notes, createdAt, builds: [ build ] }
build = { id, name, status: 'planned'|'building'|'done', coords, notes, materials: [ material ] }
material = { id, item, needed: int >= 1, collected: int >= 0 }
```

Aggregation is derived, never stored: `aggregateWorld(world)` groups by lower-cased item
name, sums `needed`, sums `min(collected, needed)`, and reports `remaining = max(0, needed -
collected)`. `worldSummary` and `globalSummary` roll the same numbers up by world and across
worlds.

## Behavioural rules

1. Every mutation returns a **new** state (`createWorld`, `createBuild`, `addMaterial`,
   `updateMaterial`, `deleteWorld`, …); the UI commits the returned state and persists it.
2. Adding the same item twice to one build merges the rows and sums quantities
   (case-insensitive).
3. Over-farming is legal: `collected` may exceed `needed`, but every derived number clamps it
   and `remaining` never goes negative.
4. Deleting a world removes its builds and repoints `activeWorldId` if it pointed there.
5. Destructive actions require a confirmation dialog that names the object being deleted.
6. Import validates before replacing anything: a malformed, foreign or partial file is refused
   and the existing state is untouched.
7. Storage failures (quota, denied) are returned as errors and shown as a toast; nothing throws.
8. `?demo=1` seeds sample worlds only when storage is empty; `?tab=builds|materials|worlds`
   deep-links a view.

## Acceptance criteria (as verified)

- Shopping list equals the independent sum over all builds.
- `remaining` never negative; totals consistent (`needed = collected + remaining`).
- Duplicate items merge with summed quantities.
- Deleting a world leaves no dangling active world and no orphan builds.
- Backup round-trips; bad files are refused without data loss.
- Fully offline: no remote fonts, scripts, styles or images; every referenced asset exists.
- Model unit tests 15/15; acceptance tests 16/16 including static contract checks.
- Contrast audit 30/30 (text ≥ 4.5:1, boundaries ≥ 3:1).

## Non-goals (deliberate)

No accounts, no cloud sync, no server, no sharing links. One browser holds one dataset;
Export/Import is the backup and transfer mechanism. No build screenshots or blueprint uploads
in v1. Item icons exist for 18 items; anything else falls back to a lettered slot rather than
a misleading icon.
