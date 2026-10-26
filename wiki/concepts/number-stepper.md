---
title: Number stepper
type: concept
summary: One −/input/+ control for every number field, with Shift as a full stack and Ctrl/⌘ as sixteen, replacing the six-button material strip.
updated: 2026-10-26
sources: []
tags: [interaction, components, minecraft]
---

# Number stepper

A **stepper** is the single numeric control in the [[Minecraft Build Tracker]]: a `−` button, a
`type=number` input and a `+` button, side by side. EDICT-0016 replaced the six-button
`#mat-steps` / `.mat-step` strip and `materialStepsHtml` with it, so one component now serves the
material rows (Needed and Got), the add-material form, the custom-item dialog and the compact
tile's quick-update dialog. The retired strip's `data-step` attributes are gone; the buttons
carry `data-stepper-step="-1|1"` and each stepper is a `div.stepper[data-stepper]`.

## Behaviour

A plain click changes the value by one. **Shift** applies one stack (the resolved stack from the
[[Material registry]] or `MC_ICON_STACKS`, default 64) and **Ctrl/⌘** applies 16; when both are
held, Shift wins. The input keeps `type=number` but the native spinners are hidden in CSS, so
keyboard ↑/↓ still steps by one. Clicking the number selects all; the wheel over a focused input
steps the value and never scrolls the page; Enter moves focus to the next same-kind field. `needed`
clamps at 1 and `got` at 0, and every change dispatches `input` then `change` so the model commit
path is unchanged.

## Relations

- Part of the [[Minecraft Build Tracker]]'s interaction contract.
- Resolves stack sizes through the [[Material registry]].
- Reused by the [[Compact view]]'s quick-update dialog.
- Styling lives in [[In-game GUI design]].

## Tensions / open questions

- **Modifier discovery.** Shift/Ctrl semantics are invisible until someone reads the design system
  or tries them; there is no tooltip or long-press affordance yet.
- **Wheel capture.** Stepping on wheel while focused prevents page scroll — correct for a number
  field, surprising if the pointer merely passes over it, so the listener is focus-scoped.
- **Stack-1 items.** The stepper hides no buttons (unlike the retired strip); a Shift click on a
  stack-1 item is simply +1, which is why the old "four versus six" rule could be dropped.
