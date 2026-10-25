# Page Override — `dashboard`

> **SUPERSEDED (EDICT-0005, 2026-10-25).** The Emperor's direction is a Minecraft in-game
> UI. This page's rules describe the retired neon/violet dashboard design; the app that this
> repository ships is specified by [`tracker.md`](tracker.md) and the v2 `../MASTER.md`.
> Kept as an archive of the EDICT-0004 decision, not as a live contract.

# ARCHIVE — original page override follows

> Overrides `../MASTER.md` for this page only, per the Master + Overrides pattern.
> **Authored in EDICT-0003.** This file is not machine output from `--design-system`;
> every rule below either cites a verified `search.py` result or is an explicit,
> justified deviation from MASTER. Unlisted rules still come from MASTER.

## 1. Inherited from MASTER (unchanged)

| Rule | Value |
|------|-------|
| Brand palette | Primary `#7C3AED`, accent `#F43F5E`, background `#0F0F23`, card `#1E1C35`, foreground `#E2E8F0` |
| Typography | Russo One (headings) / Chakra Petch (UI + body) |
| Style family | 3D & Hyperrealism — depth, tactile surfaces, rich detail |
| Anti-patterns | No emoji icons, no layout-shifting hovers, no instant state changes, no low-contrast text |

## 2. Overridden — page pattern

| MASTER | This page | Why |
|--------|-----------|-----|
| `Feature-Rich Showcase` (Hero → feature grid → benefits → social proof → CTA) | **Data-Dense Dashboard**: app bar → KPI strip → trend chart + activity heatmap → leaderboard table | MASTER's pattern is a marketing landing sequence. `EDICT-0003` directs the skill at a *tracker*, which is an app surface, not a landing page. Verified alternative: `--domain style` bundle `Data-Dense Dashboard` (KPI cards, data tables, grid layout, maximum data visibility). |

## 3. Overridden — style execution

MASTER's *Style* section names `WebGL/Three.js 3D` and `parallax`. Both are rejected here:

- `--design-system` itself grades this style **`cost:high | drivers:animation,large-images`**
  and **`risk:high`**. A data tracker is read many times a day on laptops and phones;
  a WebGL scene on the critical path would violate priority 3 (Performance) of the skill.
- The skill's rule `effects-match-style` is satisfied by **layered depth in CSS**: layered
  shadows, inner top highlight, gradient rims, and 200–400 ms state transitions. Depth is
  kept; the render cost is not.

**Verification date:** 2026-10-25. Re-check the style row before changing this section.

## 4. Added — semantic status tokens

MASTER defines brand and destructive roles but no success/warning role, and a tracker must
express *online / offline / degraded*. Adding them as tokens (not literals) keeps the
`no raw hex in components` rule intact. Contrast is proven by
`tests/qa/contrast_audit.py`, not asserted.

| Token | Value | Used for |
|-------|-------|----------|
| `--color-success` | `#34D399` | online status, positive delta |
| `--color-warning` | `#FBBF24` | degraded TPS, stale data |
| `--color-border-strong` | `#7C3AED` | input/control boundaries (MASTER border fails 3:1 as a boundary) |

Colour is never the only signal: every status chip carries a text label **and** a distinct
glyph, per `color-not-only` and the chart rules in §5.

## 5. Data visualisation rules

Both rules below come from `--domain chart` searches run in EDICT-0003, not from taste:

| Need | Verified result | Applied rule |
|------|-----------------|--------------|
| Playtime over time (14 days, 2 series) | `Trend Over Time` → **Line Chart** (`<1000 pts: SVG`) | SVG line chart; series differ by **solid vs dashed stroke plus a direct label**, never hue alone. Fill at 20 % opacity. |
| Activity by hour × day (7 × 24) | `Heatmap / Intensity` → **Heat map** (20–10 000 cells) | Grid heat map with a **numeric legend**, values printed in cell `<title>`, and a data-table fallback. |

Both charts ship the verified **a11y fallback**: a visible data table plus a concise trend
summary, and keyboard focus reveals values. No chart library is imported; SVG keeps the
prototype dependency-free and under the `<1000 pts` threshold stated by the catalogue.

## 6. Layout

| Region | ≤767 px | 768–1023 px | ≥1024 px |
|--------|---------|-------------|----------|
| App bar | brand + menu, search collapses | brand + search | brand + server + search + action |
| KPI strip | 1 col → 2 cols | 2 cols | 5 cols |
| Charts | stacked | stacked | trend 2/3, heatmap 1/3 |
| Leaderboard | `overflow-x-auto` wrapper (verified `ux` rule *Table Handling*) | same | full table |

Spacing, radii and shadows use MASTER's tokens; grid gaps are uniform (`--space-lg`),
per the verified `html-tailwind` *Grid gaps* guideline expressed as CSS.

## 7. Page acceptance criteria

- `AC-1` Every text/background pair used on the page meets 4.5:1; every control boundary ≥3:1.
- `AC-2` No colour-only encoding: status and chart series carry text or shape.
- `AC-3` Full keyboard path: skip link → app bar → filters → table → chart data tables;
  focus ring visible at every stop.
- `AC-4` No horizontal page scroll at 375 px; leaderboard scrolls inside its own wrapper.
- `AC-5` `prefers-reduced-motion` removes transitions and stops the live pulse.
- `AC-6` Loading, empty and error states exist for the player list.
