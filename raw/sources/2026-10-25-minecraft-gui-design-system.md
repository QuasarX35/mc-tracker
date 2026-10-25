---
title: Minecraft in-game GUI design system — decisions (snapshot)
type: raw-source
captured: 2026-10-25
origin: design-system/minecraft-tracker/MASTER.md v2 and pages/tracker.md (EDICT-0005)
capture_method: verbatim extraction of the rules that govern the visual layer
---

# Minecraft in-game GUI design system — decisions

The visual direction comes from an explicit instruction: the UI should look as close to
Minecraft's in-game UI as possible. This snapshot records the rules that were actually
implemented in `src/styles.css`, not a wish list.

## Supersession

A previous design system (v1, EDICT-0004) specified a neon dashboard: primary `#7C3AED`,
accent `#F43F5E`, background `#0F0F23`, Russo One / Chakra Petch, "3D & Hyperrealism",
glassy cards and blurred overlays. It was architecturally the opposite of an in-game GUI and
was retired by direction. The v1 artifacts are archived under `legacy/superseded-dashboard/`;
the v1 page override is kept but marked as archive.

## Palette (implemented tokens)

| Token | Hex | Role |
|-------|-----|------|
| `--mc-panel` | `#c6c6c6` | GUI panel face — the signature Minecraft screen grey |
| `--mc-panel-dim` | `#b4b4b4` | table headers, secondary surfaces |
| `--mc-hi` / `--mc-lo` | `#ffffff` / `#555555` | 2px bevel: light top-left, dark bottom-right |
| `--mc-lo-deep` | `#373737` | slot borders, seams, backdrop base |
| `--mc-outline` | `#000000` | the 2px black outline every control carries |
| `--mc-row` / `--mc-row-alt` | `#6a6a6a` / `#606060` | dark inventory rows |
| `--mc-text` | `#3f3f3f` | text on light panels (dark-on-light, as vanilla does) |
| `--mc-text-on-dark` | `#ffffff` | text on dark rows, with a 2px dark shadow |
| `--mc-gold` / `--mc-aqua` / `--mc-green` | `#ffaa00` / `#55ffff` / `#55ff55` | status accents |
| `--mc-xp` / `--mc-xp-mid` | `#80ff20` / `#4fbf00` | XP-bar progress fill |
| `--mc-bar-bg` | `#1e1e1e` | empty progress track |
| `--mc-tip-bg` / `--mc-tip-border` | `#100010` / `#5000ff` | vanilla tooltip plate |

## Component rules

- **Panel:** panel face, 2px black border, `inset 2px 2px 0 #fff, inset -2px -2px 0 #555`,
  hard offset shadow against the world backdrop.
- **Button:** panel face with bevel; hover lightens the face; active inverts the bevel and
  moves 1px down. Variants: grass green (primary), red (danger).
- **Field:** black field with white pixel text and a 2px bevel; focus adds a gold ring.
- **Slot:** 30×30, `#8b8b8b`, black border, inverted bevel; 22×22 pixel icon inside.
- **Chip:** dark plate with a 2px coloured border; the status word is always present, so
  colour is never the only signal.
- **XP bar:** black border, dark track, green fill with a lighter top band; exposed as
  `role="progressbar"` with `aria-valuenow`.
- **Tooltip:** `#100010` plate, `#5000ff` border, white text, shown on hover and focus.
- **Tab:** folder tab; the selected tab is the panel face and merges into the panel.
- **Backdrop:** 16×16 dirt texture tiled at 2× with `image-rendering: pixelated`, brightness
  0.88, radial vignette.

## Hard rules

- Square corners only: no `border-radius` anywhere.
- Bevels are exactly 2px; outlines are exactly 2px black.
- No blur, no `backdrop-filter`, no gradients except the 2px bevel and the XP fill.
- Bitmap type only, bundled locally (Pixelify Sans, SIL OFL) — no CDN fonts.
- Icons are generated at 16×16 and scaled by an integer factor with nearest-neighbour.
- Contrast is measured, not asserted: text ≥ 4.5:1, control boundaries ≥ 3:1.

## Accessibility tension

Vanilla Minecraft puts white text on grey, which does not pass WCAG AA. This system keeps the
look but resolves the conflict the other way: **dark text on light panels** (as vanilla's own
inventory labels do) and **white text with shadow on dark rows**. The result is recognisably
Minecraft and legible; a strict pixel-for-pixel clone of the vanilla text colours was
rejected as unreadable.
