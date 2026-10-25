---
title: Vanilla GUI over a neon dashboard
type: synthesis
summary: Case study in overriding an inherited design system — the violet dashboard was replaced by an in-game GUI because explicit direction outweighs an artifact.
updated: 2026-10-25
sources:
  - 2026-10-25-minecraft-gui-design-system
  - 2026-10-25-minecraft-build-tracker-spec
tags: [decision, design, case-study]
---

# Vanilla GUI over a neon dashboard

Written after the fact as a decision record: the product first inherited a design system that
contradicted its stated look, and the resolution mattered more than the styling itself.

## What was inherited

A prior UI/UX pass produced `design-system/minecraft-tracker/MASTER.md` v1: primary `#7C3AED`,
accent `#F43F5E`, background `#0F0F23`, Russo One / Chakra Petch, "3D & Hyperrealism", glassy
cards and blurred overlays — a modern esports dashboard. It also produced a server-player
dashboard SPA, not a build planner.

## What the direction said

> "I also want the UI to look as close to Minecraft's in-game UI as possible."

## The decision

1. **Direction beats inheritance.** A design document is evidence of past intent, not a
   constraint; when it conflicts with an explicit current instruction, the instruction wins.
2. **Archive, don't delete.** The v1 dashboard and its page override were preserved under
   `legacy/superseded-dashboard/` and marked superseded. Removing them would have destroyed the
   only record of a completed design pass.
3. **Replace the product too.** Restyling a server dashboard would have kept the wrong data
   model; the build tracker needed worlds → builds → materials.
4. **Keep what was still true.** The v1 pass established genuinely useful practices: semantic
   tokens instead of raw hex, measured contrast rather than asserted contrast, and an automated
   audit as part of the gate. Those survived into [[In-game GUI design]]; only the aesthetic
   and the page pattern were discarded.

## Why it worked

The replacement was verifiable, not just asserted: contrast pairs measured by an audit,
screenshots reviewed at desktop and mobile widths, and the pixel rules (square corners, 2px
bevels, bundled bitmap font) encoded as tests that fail if a future edit reintroduces
`border-radius` or a CDN font.

## Tensions

- **Cost.** A completed design pass became archive. The safeguard is that archive retention is
  cheap; the alternative — silently deleting it — loses the reasoning.
- **Drift risk.** Two design narratives now live in the repo (v1 archive, v2 live). The
  supersession note in `pages/dashboard.md` is what prevents a future agent from following the
  dead one; without it, [[In-game GUI design]] and the archive would contradict each other.
- **Taste dressed as requirement.** "Looks like Minecraft" is not measurable. The resolution
  was to convert it into measurable proxies (panel grey, bevel width, corner radius, font
  origin, screenshot review) — otherwise the argument would have been unwinnable.

## Relations

- Predicates [[In-game GUI design]] and the [[Minecraft Build Tracker]].
- An instance of the general rule that inherited artifacts must carry provenance, which is the
  same reason this wiki keeps a [[Open questions]] page.
