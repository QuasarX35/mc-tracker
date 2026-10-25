---
title: Minecraft Build Tracker
type: entity
summary: A local, offline web tool for planning Minecraft builds and tracking the materials each one needs, styled after the in-game GUI.
updated: 2026-10-25
sources:
  - 2026-10-25-minecraft-build-tracker-spec
  - 2026-10-25-minecraft-gui-design-system
tags: [product, minecraft, tooling]
---

# Minecraft Build Tracker

A single-page tool that answers one question at a time while playing: *what do I still need to
finish this build?* Worlds contain builds; builds contain materials; the world's shopping list
is the sum. It opens by double-clicking `src/index.html` — no build step, no server, no install
— and stores everything in the browser. Raw spec:
[`raw/sources/2026-10-25-minecraft-build-tracker-spec.md`](../../raw/sources/2026-10-25-minecraft-build-tracker-spec.md).

## What it does

- **Worlds** — one tracker per world, with edition and version; the active world is chosen in
  the top bar and edited in the Worlds tab.
- **Builds** — name, status (Planned / Building / Done), coordinates, notes, and an XP-style
  progress bar driven by the material list.
- **Materials** — per build, an item name plus `needed` and `got`, editable inline while
  playing; identical items merge and sum.
- **Shopping list** — every item in the world summed across builds, outstanding first, with
  which builds need it, search, filter, and copy-to-text.
- **Backup** — JSON export/import, validated before it replaces anything.

## How it is built

| Layer | Implementation |
|-------|----------------|
| Domain | `src/tracker/model.js` — pure immutable-update model; aggregation, validation, storage adapter, sample seed. Classic script so `file://` works (ES modules are blocked there). |
| UI | `src/index.html` + `src/app.js` — three tabs, inline editing committed on `change` (typing never re-renders), dialogs, toasts, `aria-live` status. |
| Visual | `src/styles.css` — the [[In-game GUI design]] system: grey panels, 2px bevels, square corners, slots, XP bars. |
| Assets | 9 tiling textures + 18 item icons + favicon generated at 16×16 by `scripts/gen-assets.py`; Pixelify Sans bundled locally. |
| Persistence | [[Local-first tracking]]: `localStorage` plus export/import. |

## Why it looks the way it does

The first design pass followed an inherited neon dashboard system and was rejected by
direction: *"look as close to Minecraft's in-game UI as possible"*. The replacement is
documented in [[In-game GUI design]], and the reversal itself in
[[Vanilla GUI over a neon dashboard]].

## Verification

15 model unit tests, 16 independent acceptance tests (including static offline/accessibility/
pixel-contract checks), a 30-case contrast and structure audit, and headless-Chrome renders at
1280 px and 390 px. The QA gate failed the first submission for a seed that silently dropped a
material and a 4.07:1 muted-text token; both are now covered by regression checks.

## Tensions

- **Local-only by design.** No accounts, no sync; one browser holds one dataset. Loss is
  prevented by discipline (Export), not by the system ([[Local-first tracking]]).
- **Icon coverage is 18 items.** Anything else gets a lettered slot — honest, but less pretty
  than a wrong icon would be.
- **Authenticity vs. legibility.** A pixel-faithful clone of vanilla's white-on-grey text
  fails WCAG AA; the shipped compromise favours reading ([[In-game GUI design]]).
- **Mobile verified in an iframe harness**, because headless Chrome on Windows refuses windows
  narrower than ~500 px; a real 390 px window was never directly observed.
