---
title: World sidebar
type: concept
summary: The active world as a left panel — identity, derived stats and world actions — replacing the top-bar strip on the Builds and Materials tabs.
updated: 2026-10-26
sources: []
tags: [layout, navigation, minecraft]
---

# World sidebar

The **world sidebar** is the left `aside#world-panel` in the [[Minecraft Build Tracker]]. It holds
the active world's identity (`#world-panel-name`, icon), edition/version, the derived gathered
stats (`#world-progress`, `#world-remaining`, `#world-bar` / `#world-fill`) and the world actions
(`#btn-new-world`, `#btn-import`, `#btn-export`). It replaces the top-bar strip's role on the
Builds and Materials tabs, which keeps the world context visible while the content column grows.

## Layout

The panel is 230 px wide at ≥1100 px viewports and 200 px at ≥900 px; below 900 it stacks above
the content. It has its own panel face, 2 px border, bevel and 12 px padding, so it reads as a
distinct surface inside the main panel (which widens to
`min(1240px, calc(100vw - 32px))`). It is hidden on the Worlds tab — the cards there are the world
navigation — and hidden in [[Compact view]], where the full-width canvas matters more than the
side context.

## Naming

The sidebar text keeps its own id, `#world-panel-name`, while the world dialog keeps `#world-name`;
the retired top-bar strip keeps its ids for state compatibility. The `aside` has an accessible
name (`aria-label="Selected world"`) and is the only persistent world landmark.

## Relations

- A layout choice of the [[Minecraft Build Tracker]], shipped by EDICT-0016.
- Replaced by the [[Compact view]]'s `#compact-world` line when compact mode is on.
- Width and bevel rules live in [[In-game GUI design]].
- Its stats are derived from the model's `worldSummary`, documented in [[Status-ranked build ordering]].

## Tensions / open questions

- **Hidden on Worlds.** The tab already lists every world, so the sidebar would duplicate it; a
  user switching tabs loses the sidebar context until Builds or Materials.
- **Cost to the detail column.** At 1280 the sidebar narrows the list/detail columns; the
  alignment and budget checks absorb that, but a very long build title wraps sooner.
- **Mobile stacking.** Below 900 the panel stacks above the content, pushing builds down; the
  mobile budget accounts for it, and collapsing it is not offered.
