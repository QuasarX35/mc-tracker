---
title: Material registry
type: concept
summary: How the tracker resolves an item name to a stack size and icon through build, world, account and catalogue scopes, without migrating free-text materials.
updated: 2026-10-25
sources: []
tags: [architecture, data-model, minecraft]
---

# Material registry

The [[Minecraft Build Tracker]] used to treat a material as two strings and two numbers: a
free-text item name, a needed count, a got count. EDICT-0015 added **custom items** — items the
icon catalogue does not contain — without rewriting the materials already stored. The result is
a four-level registry, resolved nearest-first.

## The four scopes

| Scope | Stored at | Lifetime |
|-------|-----------|----------|
| Build | `build.customItems` | one build |
| World | `world.customItems` | every build in that world |
| Account | `state.customItems` | every world in this browser profile |
| Catalogue | generated `icons.js` / `manifest.json` | shipped with the app |

A material row stores the item **name** it always did. Resolution walks build → world → account
→ catalogue and stops at the first match; the nearest registry wins. A custom entry has an id of
the form `custom:<slug>`, a display name (1–60 characters), a stack size (1–999, default 64) and
an icon that is either a catalogue slug or an uploaded image stored as a data URL. The catalogue
levels are unchanged: `MC_ICON_SET` is an array of slugs, while `MC_ICON_NAMES` and
`MC_ICON_STACKS` are slug-keyed objects ([[Vanilla assets without redistribution]]).

## Creation is additive

`M.createCustomItem(state, world, build, target, spec)` returns either `{ state, entry }` or
`{ error }` and never mutates its arguments. There is no schema bump: storage stays `SCHEMA = 1`,
a v1 backup imports with empty registries, and exported state carries the three arrays only when
they are non-empty. This is deliberate — a migration pass would have had to rewrite free-text
materials into entries, and that is a separate product decision ([[Local-first tracking]]).

The four validation errors are frozen strings: *Custom material needs a name.*, *Name already
used by another material.*, *Stack size must be between 1 and 999.*, *Icon must be a catalogue
item or an uploaded image.* The dialog validates the name on input and commits the icon on save;
`#btn-new-custom` appears only in the material picker, where the custom tile carries a `custom`
badge and catalogue matches sort ahead of it.

## Relations

- Implements the data half of EDICT-0015 in the [[Minecraft Build Tracker]].
- Preserves [[Local-first tracking]]: additive registries, browser storage, no server.
- Extends the picker vocabulary documented in [[In-game GUI design]].
- Product friction and proposals: [UX backlog](../../docs/backlog/ux.md) (rows 4, 9).

## Tensions / open questions

- **Shadowing is silent.** A custom item may reuse a catalogue name or a name from a wider scope;
  the nearest registry wins and the picker shows both. That is defined behaviour, not a warning.
- **Create-only this round.** Editing, deletion, per-build stack overrides beyond the registry,
  drag reordering and bulk undo are unowned follow-ups ([UX backlog](../../docs/backlog/ux.md)).
- **Free-text materials stay free text.** Existing rows are not migrated; a name that matches a
  custom entry resolves to it, but a rename has no registry-side history.
- **Storage is the ceiling.** Every custom item lives in `localStorage`; a large account registry
  competes with avatars and the rest of the state for the same quota.
