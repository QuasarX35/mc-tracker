# Design System — Minecraft Build Tracker (v2, in-game GUI)

> **LOGIC:** before building a page, check `pages/[page-name].md`. If it exists, its rules
> **override** this file. If not, follow this file exactly.
>
> **Version 2**, 2026-10-25. Supersedes v1 (neon-purple "3D & Hyperrealism" dashboard,
> EDICT-0004). The Emperor's direction for this product is explicit: *"look as close to
> Minecraft's in-game UI as possible"* — v1's dark/purple/glow language is the opposite of
> that, so it is retired, not extended. v1 artifacts are archived in
> `legacy/superseded-dashboard/` and `pages/dashboard.md` is marked superseded.

**Project:** Minecraft Build Tracker
**Category:** Gaming / in-game utility
**Reference:** vanilla Minecraft Java 1.21 GUI screens (inventory, world list, options)

---

## Global rules

### Colour tokens

Every colour is a named token in `src/styles.css` `:root`. Raw hex never appears in a
component rule except for local bevel highlights, which must stay visually adjacent.

| Token | Hex | Role |
|-------|-----|------|
| `--mc-panel` | `#c6c6c6` | GUI panel face — the signature Minecraft screen grey |
| `--mc-panel-dim` | `#b4b4b4` | table headers, secondary surfaces |
| `--mc-hi` / `--mc-lo` | `#ffffff` / `#555555` | 2px bevel: light top-left, dark bottom-right |
| `--mc-lo-deep` | `#373737` | slot borders, seams, backdrop base |
| `--mc-outline` | `#000000` | the 2px black outline every control carries |
| `--mc-row` / `--mc-row-alt` | `#6a6a6a` / `#606060` | dark inventory rows |
| `--mc-text` | `#3f3f3f` | text **on panels** (dark on light, as vanilla does) |
| `--mc-text-on-dark` | `#ffffff` | text on rows/slots, with 2px dark shadow |
| `--mc-gold` | `#ffaa00` | planned / headings accent |
| `--mc-aqua` | `#55ffff` | building / info accent |
| `--mc-green` | `#55ff55` | done / success |
| `--mc-red` | `#ff5555` | destructive emphasis |
| `--mc-xp` / `--mc-xp-mid` | `#80ff20` / `#4fbf00` | XP-bar progress fill |
| `--mc-bar-bg` | `#1e1e1e` | empty progress track |
| `--mc-tip-bg` / `--mc-tip-border` | `#100010` / `#5000ff` | tooltips and toasts (vanilla tooltip) |

Contrast is **measured**, not asserted: `tests/qa/mc_ui_audit.py` proves every pair the UI
uses (≥4.5:1 text, ≥3:1 boundaries).

### Typography

- **Face:** Pixelify Sans (SIL OFL, bundled at `src/assets/fonts/`). Never a CDN font: the
  app must work offline and from `file://`.
- **Sizes:** 13/14 px meta, 16 px body, 20 px section titles, 22 px dialog titles,
  `clamp(40px, 7vw, 72px)` app title.
- **Shadow:** dark surfaces use the vanilla 2px offset shadow (`2px 2px 0 #3f3f3f`); text on
  light panels is flat dark — the same split vanilla uses.
- No synthetic bold or italic; no letter-spacing except the uppercase eyebrow.

### Spacing & motion

4/8/12/16/24/32 px scale (`--space-1..6`). Transitions are 120 ms and limited to
background/box-shadow/width; `prefers-reduced-motion` zeroes them.

---

## Components

| Component | Spec |
|-----------|------|
| **Panel** | `--mc-panel`, 2px black border, `inset 2px 2px 0 #fff, inset -2px -2px 0 #555`, plus a hard offset shadow against the world backdrop. Padding 16px. |
| **Button** | Panel face + bevel; 2px black border; hover lightens face and adds a pale inner ring; active inverts the bevel and moves 1px down. Variants: `--primary` (grass green), `--danger` (red). Minimum height 38px, 32px for `--sm`. |
| **Input / select** | Black field (`--mc-field`) with white pixel text and a 2px bevel; focus adds a 3px gold ring. Selects use the dark 6f6f6f face with the vanilla dropdown chevron drawn in CSS. |
| **Slot** | 30×30, `#8b8b8b` face, 2px black border, inverted bevel (dark top-left, light bottom-right); holds a 22×22 pixel icon. |
| **Chip** | Dark `#1e1e1e` plate, 2px border in the status colour, white label. **Colour is never the only signal** — the word is always present. |
| **XP bar** | 16px tall (12px in table rows), black border, `#1e1e1e` track, green fill with a lighter top band. Exposed as `role="progressbar"` with `aria-valuenow`. |
| **Tooltip** | `#100010` plate with a `#5000ff` border, white text, 8px above the item slot; pure CSS on `:hover`/`:focus-visible`. |
| **Tab** | Folder tab: unselected `#6f6f6f`, selected is the panel face and merges into the panel (no bottom border, −2px overlap). |
| **List row** | Dark row, 2px seam, tight bevel; hover lightens; selected is `#4a4a4a` with a 2px white inner outline (vanilla list selection). |
| **Dialog** | Native `<dialog>`, panel face, black border, bevel, scrim `rgb(0 0 0 / 0.6)`, right-aligned Cancel/Confirm. |
| **World backdrop** | 16×16 dirt texture tiled at 2× (`image-rendering: pixelated`), brightness 0.88, radial vignette. |

---

## Style guidelines

**Style:** authentic early-2010s game GUI. Flat pixel planes, 2px bevels, hard black
outlines, bitmap type, chunky hit targets.

**Do:** square everything · keep bevels exactly 2px · show item icons only at integer scale ·
keep the panel grey unmistakably `#c6c6c6` · put dark text on light panels and shadowed
white text on dark rows · use 1×1 CSS pixel borders so the result looks like it was drawn at
16×.

**Never:** `border-radius` · `backdrop-filter` · gradients other than the 2px bevel and the
XP fill · drop shadows that blur (use hard offset shadows) · emoji as icons · animation that
moves layout · colour-only status · web fonts from a CDN.

---

## Pre-delivery checklist

- [ ] `node --check src/app.js` and `node --check src/tracker/model.js` clean
- [ ] `node tests/unit/tracker-model.test.mjs` green
- [ ] `node tests/qa/tracker.acceptance.test.mjs` green
- [ ] `python tests/qa/mc_ui_audit.py` → 30/30, exit 0
- [ ] Headless Chrome screenshots at 1280 px and at 390 px (iframe harness): no overflow,
      no missing icons, tab state matches the visible panel
- [ ] Every new colour is a token; every new component has a bevel spec above
- [ ] `prefers-reduced-motion` still honoured; focus ring visible on every control
