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

- **Face:** **Minecraft** (Craftron Gaming, via DaFont, badge "100% Free"; bundled at
  `src/assets/fonts/Minecraft.ttf`, 14,488 B, licence text `Minecraft-LICENCE.md`, raw evidence
  `raw/sources/2026-10-25-minecraft-font-licence.md`). 110 glyphs by the page and
  `maxp.numGlyphs`, 107 mapped by `cmap`: ASCII `0x20–0x7E` complete, plus U+00A0,
  U+00A1–U+00A9, **U+20AC euro** and U+3000; **no accented letters**; arrows, em/en dash,
  ellipsis, `×`, `·`, `≥`, `≤` are absent.
- **Fallback:** Pixelify Sans (SIL OFL, bundled) is the *fallback*, not the face — it covers the
  missing glyphs. `--font-pixel: "Minecraft", "Pixelify", ui-monospace, monospace`. Never a CDN
  font: the app must work offline and from `file://`.
- **Case:** the Minecraft face renders lowercase as small capitals; that is the vanilla look,
  accepted, not a defect.
- **Sizes:** unchanged — 13/14 px meta, 16 px body, 20 px section titles, 22 px dialog titles,
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
| **Input / select** | Black field (`--mc-field`) with white pixel text and a 2px bevel; focus adds a 3px gold ring. Selects use the dark `#6f6f6f` face with the vanilla dropdown chevron drawn in CSS. Quantity fields stay `type=number` — the native spinners are hidden in CSS only (`::-webkit-inner-spin-button`, `::-webkit-outer-spin-button`, `-moz-appearance: textfield`), so keyboard ↑/↓ still works. |
| **Themed native select** | Keep the native `<select>`. Under `@supports (appearance: base-select)` the control becomes `base-select` and `::picker(select)` is themed: panel `rgb(111, 111, 111)`, `2px solid rgb(0, 0, 0)`, inset bevel, Minecraft face, vanilla option hover/checked; `::picker-icon` is hidden so the drawn chevron stays. Any other browser keeps the native popup — progressive enhancement, never a custom JS listbox just to style the popup. |
| **Slot** | 30×30, `#8b8b8b` face, 2px black border, inverted bevel (dark top-left, light bottom-right); holds a 22×22 icon from the game's own **256×256 inventory renders** (generated locally by `scripts/mc-icons.py`, git-ignored; 3D renders carry a documented brightness correction for an upstream IconExporter bug) displayed smoothly downscaled. A missing icon shows the item's initial — never a broken image. |
| **Chip** | Dark `#1e1e1e` plate, 2px border in the status colour, white label. **Colour is never the only signal** — the word is always present. |
| **XP bar** | 16px tall (12px in table rows), black border, `#1e1e1e` track, green fill with a lighter top band. Exposed as `role="progressbar"` with `aria-valuenow`. |
| **Tooltip** | One shared `#mc-tooltip` (`role="tooltip"`), not pseudo-elements: appended to the open `<dialog>` (else `body`), carries the source slot's `data-tip`, is fixed and clamped 8px inside the viewport, and flips below the slot when less than 44px of room remains above. Delegation uses bubbling `pointerover`/`pointerout` with an `event.relatedTarget` check plus `focusin`/`focusout`; Escape and dialog close hide it. `#100010` plate with a `#5000ff` border, white text. |
| **Tab** | Folder tab: unselected `#6f6f6f`, selected is the panel face and merges into the panel (no bottom border, −2px overlap). |
| **List row** | Dark row, 2px seam, tight bevel; hover lightens; selected is `#4a4a4a` with a 2px white inner outline (vanilla list selection). |
| **Dialog** | Native `<dialog>`, panel face, black border, bevel, scrim `rgb(0 0 0 / 0.6)`, right-aligned Cancel/Confirm. |
| **Avatar** | Square identity chip: 2px black border, inverted bevel, image `object-fit: cover` with smooth downscaling (`image-rendering: auto`). Sizes 28 / 32 / 40 / 48 px. Items use their 256×256 inventory render; uploads are 128×128 WebP/PNG data URLs; a missing render falls back to the subject's initial. |
| **Icon picker** | One dialog, no tabs: search + a grid of `.icon-tile` buttons (slot + label, `role="option"`, lazy-loaded renders) with incremental paging, and a footer with **Upload image…** (`#icon-upload`, shared image dialog), Cancel and **Use icon**. Paging: first batch 120 tiles, `div#icon-sentinel[data-icon-sentinel]` (aria-hidden, last child of `#icon-grid`) appends 120 more per scroll hit — no slice cap, every one of the 1,368 slugs reachable; typing resets to the first batch and removes the sentinel; `#icon-count-hint` reads `showing 120 of 1368 — scroll for more` and `showing N of M for "query"` while narrowed. Names wrap 2–3 lines, no truncation. Recent picks (`data-icon-recent="true"`) lead the unfiltered first batch. Item mode commits on click; pick-item mode (add material) hides upload and Use, and a single click selects and closes. Curated/common icons sort first. Escape clears the search, then closes; focus returns to the invoker. |
| **Wrapped item name** | Full names wrap to 2–3 lines in picker tiles, material rows and the chooser chip — `white-space: normal`, `overflow-wrap: break-word`, no `text-overflow: ellipsis`, no `-webkit-line-clamp`. Material rows keep `grid-auto-rows: auto` so a taller name grows the row; the assertion is `scrollWidth <= clientWidth + 1` on every name node at 1280 and 390. |
| **Empty state** | One sentence naming the next action plus one control; never a control whose only response is an error toast. Five states: `#build-empty` (`#btn-first-build` asks the state which dialog to open), `#world-empty` (`#btn-empty-create-world` opens the world dialog), `#detail-empty` (`#detail-empty-action`: world dialog if no worlds, else build dialog), `#material-empty` (`#btn-empty-pick-material` focuses the chooser), `#world-material-empty` (`#btn-empty-reset-filter` clears search + filter). |
| **Bulk-paste dialog** | `#bulk-dialog` with `textarea#bulk-input`, `.bulk-row[data-bulk-state="matched"|"unknown"]` review rows carrying `data-bulk-qty`, `#bulk-add` (**Add matched**), `#bulk-cancel` and `#bulk-error`. The matcher is frozen: case-insensitive exact display name → exact slug → unique prefix of at least 3 characters; ambiguous or missing stays unmatched and is not added; duplicates merge by slug; qty clamps ≥1. Blank lines ignored; multi-word names allowed; no edit distance. |
| **Undo toast action** | The toast may carry a real `button#toast-action` labelled **Undo** for material, build or world deletion, visible for 6000 ms (other toasts keep 3200 ms). One deep-equal snapshot; any later commit clears it; clicking restores state, view and focus. Confirm copy says “You can undo for 6 seconds.”, never “cannot be undone”. |
| **Suggested-icon marker** | Display-only: `#detail-avatar` carries `data-icon-auto="true"` and `title="<reason>"` while showing a suggestion for a build with no stored icon; the picker shows `p#icon-suggest-note` “Suggested from "<matched text>"” and marks the tile `data-icon-suggested="true"`. Choosing stores the icon and clears the marker; there is no apply control, and the world half of `iconAuto` is carried but inert. |
| **Recent picks** | `mc-build-tracker:recent` — up to 8 slugs, browser-local, not exported; unknown slugs dropped on load. The unfiltered first picker batch leads with `data-icon-recent="true"` tiles; choosing records the slug at the front, de-duplicated. |
| **Icon button** | Square panel button with a 2px black border and the standard bevel, 28–30 px, icon-only (`aria-label` mandatory). Used for the title-rename pencil (`#build-rename`, left of Delete) and coords copy (`#copy-coords`, right of the coords field; disabled when empty or whitespace). |
| **Inline title / notes editor** | View mode is text; edit mode swaps in the existing input/textarea plus `✓` (save) and `✕` (cancel). Enter/Save commits through one model path, Escape cancels and restores the previous value, blank titles are refused, notes are trimmed, and focus returns to the invoking button. `Ctrl/Cmd+Enter` saves notes. |
| **Micro stepper** | `button.mat-step`, 28 px tall, compact grid above and below the needed field, with **resolved labels**: `+1 +10 +64` over `-1 -10 -64` (the stack number comes from `MC_ICON_STACKS`, default 64). Stack-1 items omit the two stack buttons entirely (four buttons, no disabled twins, no full-stack aria). Every button carries `data-mat` and `data-stack` (`64|16|1`); `data-step` keeps the shipped literals `+1|+10|+stack|-1|-10|-stack` (no rename), and `data-mat-step` carries the resolved amount. `needed` clamps at 1; the row must not overflow at 390×844. |
| **Chooser chip** | Add-material control: a 30×30 `.slot` with the chosen item's render, the item name beside it, and a "Choose item" affordance (`#mat-choice`/`#mat-choice-slot`/`#mat-choice-name`). Opens the picker in pick-item mode; the hidden `#mat-item` feeds the form and `#mat-error` shows inline validation. |
| **World backdrop** | Fallback: 16×16 dirt tiled at 2× (`image-rendering: pixelated`), brightness 0.88, radial vignette. **Panorama:** locally generated 2,560×640 strip — six resolved inputs `panorama_0…5` with the top/bottom caps recorded but not stitched, and the four side faces stitched with a wrap crossfade so the loop is seamless; bake Gaussian radius **2.0 px** (ceiling 2), brightness 0.95, saturation 0.92, 55,096 B WebP (sha256 `331253bd…bf1a5`); two `.backdrop__layer` copies of the strip translated −50 % over **180 s** linear infinite (`backdrop-translate`) under `:root.has-panorama`; per-layer `filter: blur(1px)` desktop / `blur(1.5px)` at ≤640 px; `--backdrop-scrim-alpha` (**0.2**) scrim plus vignette. Feature-detected at runtime; absence is a normal state. `prefers-reduced-motion` freezes the pan. |

---

## Style guidelines

**Style:** authentic early-2010s game GUI. Flat pixel planes, 2px bevels, hard black
outlines, bitmap type, chunky hit targets.

**Do:** square everything · keep bevels exactly 2px · show item icons from the game's 256 px
inventory renders, smoothly downscaled (`image-rendering: auto`) so slots and avatars stay
sharp at every size · keep tiled block textures pixelated and integer-scaled · keep the panel
grey unmistakably `#c6c6c6` · put dark text on light panels and shadowed white text on dark
rows · use 1×1 CSS pixel borders so the result looks like it was drawn at 16×.

**Never:** `border-radius` · `backdrop-filter` · gradients other than the 2px bevel, the
XP fill and the backdrop scrim · drop shadows that blur (use hard offset shadows) · emoji as
icons · animation that moves layout · colour-only status · web fonts from a CDN · committing
game pixels (icons, panorama, uploads stay local/git-ignored) · nearest-neighbour-scaling the
256 px item renders down into a slot (that aliases; they are drawn smoothly instead).

---

## Pre-delivery checklist

- [ ] `node --check src/app.js` and `node --check src/tracker/model.js` clean
- [ ] Unit files green — **98/98** (model 22, identity 9, suggestion 38, app-qa 9, wiki 20)
- [ ] Acceptance files green — **85/85** (tracker 17, identity 8, resolution 7, assets 11,
      edict-0014 14, app-qa 7, wiki 13, wiki-sync 8)
- [ ] `python tests/qa/mc_ui_audit.py` → **147/147**, exit 0
- [ ] `node scripts/app-qa.mjs run` → **66/66** browser flows and a fresh stamp covering the
      8 app sources (app files plus `Minecraft.ttf`, `backdrop.webp`, panorama `manifest.json`)
- [ ] Face is Minecraft with the Pixelify fallback; `Minecraft-LICENCE.md` present; glyph gaps
      (arrows, dashes, ellipsis, `×`, `·`, `≥`, `≤`) documented and covered by the fallback
- [ ] Item catalog is 1,368 addressable base items from 1,609 renders (241 collapsed variants),
      curated 53 first; `MC_ICON_SET` is an array of slugs while `MC_ICON_NAMES` and
      `MC_ICON_STACKS` are slug-keyed objects; the manifest carries name/stack/sha256/lighting;
      the five `flat_pixel_mismatches` are disclosed
- [ ] Picker pages in 120-tile batches through `#icon-sentinel`, no cap, every slug reachable;
      `#icon-count-hint` uses the frozen `showing N of 1368 — scroll for more` wording; typing
      resets to the first batch
- [ ] Steppers show resolved amounts (`+1 +10 +64`), keep the shipped `+stack`/`-stack` literals
      in `data-step` with resolved `data-mat-step`, and stack-1 rows omit the two stack buttons
- [ ] Tooltip is the single `#mc-tooltip` in the top layer; no `.slot[data-tip]::after` rule
      remains; bubbling `pointerover`/`pointerout` + `relatedTarget`, clamped, flips below,
      hides on Escape and dialog close
- [ ] Backdrop: six inputs, four stitched sides with a wrap crossfade, 2,560×640, 180 s seamless
      translate loop over two `.backdrop__layer` copies, bake blur 2.0, per-layer CSS `blur(1px)`
      (1.5 px at ≤640 px), 0.2 scrim, 55,096 B, sha256 starting `331253bd`
- [ ] Themed select probe: `CSS.supports('appearance', 'base-select')` true on the pinned
      Chromium and the `::picker(select)` computed panel/border/font match the frozen values
- [ ] Headless Chrome screenshots at 1280 px and at 390 px: no overflow, no missing icons,
      tab state matches the visible panel
- [ ] Every new colour is a token; every new component has a bevel spec above
- [ ] `prefers-reduced-motion` still honoured; focus ring visible on every control

