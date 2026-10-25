---
title: Status-ranked build ordering
type: concept
summary: Builds sort by a fixed status rank with a stable tie-break, and the world header replaces the old summary card with derived progress figures.
updated: 2026-10-25
sources: []
tags: [design, information-architecture, minecraft]
---

# Status-ranked build ordering

Two EDICT-0015 changes turned a registry-ordered list and a redundant card into a
state-driven header. Both are decisions about **what the screen says first**, not decoration.

## The ordering rule

Builds render by a fixed status rank — **Building → Planned → Done** — with a stable tie-break
by registry order inside each rank. The selected build survives re-renders and status changes;
a build moves group only when its own status changes. The list is never sorted by completion
ratio or name. The visible effect is two tiers: active work on top, Done last.

Today's registry order accidentally put a Done build above a Building one; the fix moves the
decision from the renderer's data order into an explicit `statusRank` comparator in the model
([[Minecraft Build Tracker]]). The same rank is used by the tests, so a re-render cannot silently
reintroduce insertion order.

## Header stats instead of a world card

The world card that repeated the totals is gone. The world's top bar now carries:

- `#world-meta` — identity only (`Java 1.21.4 · 3 builds`);
- `#world-progress` — `"X% gathered"`, **derived** from `M.worldSummary` on every render, never
  a literal;
- `#world-remaining` — `"N of M items still to collect"` with thousands separators;
- `#world-bar` > `#world-fill` — a 10 px track with a 6 px fill, exposed as
  `role="progressbar"` with `aria-valuemin="0"`, `aria-valuemax="100"` and `aria-valuenow` = the
  percentage.

The three stats hide together when there is no world or when the world's total needed is zero;
the bar previously risked `NaN` in that state. `#world-summary` was retired, and the retired
block must not come back.

## Why it holds together

The header is a **measured** surface: the label/control alignment and the height budget are
checked with `getBoundingClientRect` at 1280×900 and 390×844, and the header controls are
asserted against one visual row. Deriving the percentage from the model rather than formatting a
stored string is what makes the header honest when materials change in any build
([[Testing a UI like a user]]).

## Relations

- Implemented for the [[Minecraft Build Tracker]].
- Uses the aggregation documented in [[Local-first tracking]] (the world's shopping list is the
  model's sum).
- Extended by EDICT-0015's compact layout, which spends the space the card used to take
  ([[In-game GUI design]]).
- Decision log: [UX backlog](../../docs/backlog/ux.md) rows 1, 2, 3, 6.

## Tensions / open questions

- **Rank order vs. "two tiers".** Three statuses produce three ranks; the brief described the
  effect as two visible tiers. The contract's rank order is the source of truth, and the
  tie-break is registry order, not name.
- **Derived numbers can be wrong in a new way.** A derived percentage inherits every aggregation
  bug the model has; a literal would hide it. The trade was made deliberately: disagreeing with
  the shopping list is now visible as a header number.
- **Zero-total is a special case.** A world whose materials all have zero needed hides the
  stats rather than showing `0 of 0`; whether that reads as "nothing to do" or "broken" is
  untested with a fresh user.
