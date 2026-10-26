# Design System — Minecraft Build Tracker (v2, in-game GUI)

> **LOGIC:** before building a page, check `pages/[page-name].md`. If it exists, its rules
> **override** this file. If not, follow this file exactly.
>
> **Version 2**, 2026-10-25. Supersedes v1 (neon-purple "3D & Hyperrealism" dashboard,
> EDICT-0004). The Emperor's direction for this product is explicit: *"look as close to
> Minecraft's in-game UI as possible"* — v1's dark/purple/glow language is the opposite of
> that, so it is retired, not extended. v1 artifacts are archived in
> `legacy/superseded-dashboard/` and `pages/dashboard.md` is marked superseded.
>
> **EDICT-0017** (2026-10-26) moves stock from the build to the world: one shared inventory per
> world, per-build allocation in list order, and a single inventory dialog. Rows below that still
> describe `got` per build, the `.stepper`, `#bulk-dialog` or `#tile-dialog` are superseded by the
> rows marked EDICT-0017.

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
- **Sizes:** one root knob — `html { font-size: 18px }` — and one scale: **18 px body**
  (`--fs-body`), 17 px muted/notes, 15 px meta, 13 px tiny. Section titles 22 px, dialog titles
  24 px, masthead title `clamp(28px, 3.8vw, 44px)` (44 px at 1280 px wide). Nothing reads 16 px
  any more; the old 13/14/16/20/22 scale is retired.
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
| **Input / select** | Black field (`--mc-field`) with white pixel text and a 2px bevel; focus adds a 3px gold ring. Selects use the dark `#6f6f6f` face with the vanilla dropdown chevron drawn in CSS. The row **Needed** cell is `input[type=text][inputmode=numeric]` showing the value in the current unit: Enter or blur commits one integer (clamps ≥1), Escape restores the pre-edit value, and malformed input is refused without closing the editor. The inventory dialog's `#inv-absolute` stays `type=number` with the native spinners hidden in CSS only. No quantity field carries `−`/`+` buttons — EDICT-0017 retired the `.stepper`. |
| **Themed native select** | Keep the native `<select>`. Under `@supports (appearance: base-select)` the control becomes `base-select` and `::picker(select)` is themed: panel `rgb(111, 111, 111)`, `2px solid rgb(0, 0, 0)`, inset bevel, Minecraft face, vanilla option hover/checked; `::picker-icon` is hidden so the drawn chevron stays. Any other browser keeps the native popup — progressive enhancement, never a custom JS listbox just to style the popup. |
| **Slot** | 30×30, `#8b8b8b` face, 2px black border, inverted bevel (dark top-left, light bottom-right); holds a 22×22 icon from the game's own **256×256 inventory renders** (generated locally by `scripts/mc-icons.py`, git-ignored; 3D renders carry a documented brightness correction for an upstream IconExporter bug) displayed smoothly downscaled. A missing icon shows the item's initial — never a broken image. |
| **Chip** | Dark `#1e1e1e` plate, 2px border in the status colour, white label. **Colour is never the only signal** — the word is always present. |
| **XP bar** | 16px tall (12px in table rows), black border, `#1e1e1e` track, green fill with a lighter top band. Exposed as `role="progressbar"` with `aria-valuenow`. |
| **Tooltip** | One shared `#mc-tooltip` (`role="tooltip"`), not pseudo-elements: appended to the open `<dialog>` (else `body`), carries the source slot's `data-tip`, is fixed and clamped 8px inside the viewport, and flips below the slot when less than 44px of room remains above. Delegation uses bubbling `pointerover`/`pointerout` with an `event.relatedTarget` check plus `focusin`/`focusout`; Escape and dialog close hide it. `#100010` plate with a `#5000ff` border, white text. |
| **Tab** | Folder tab: unselected `#6f6f6f`, selected is the panel face and merges into the panel (no bottom border, −2px overlap). |
| **List row** | Dark row, 2px seam, tight bevel; hover lightens; selected is `#4a4a4a` with a 2px white inner outline (vanilla list selection). |
| **Dialog** | Native `<dialog>`, panel face, black border, bevel, scrim `rgb(0 0 0 / 0.6)`, right-aligned Cancel/Confirm. |
| **Avatar** | Square identity chip: 2px black border, inverted bevel, image `object-fit: cover` with smooth downscaling (`image-rendering: auto`). Sizes 24 / 28 / 32 / 40 / 48 px — 24 is the build-list entry slot (`.avatar--24`, fixed 24 px so a wide render cannot stretch the row). Items use their 256×256 inventory render; uploads are 128×128 WebP/PNG data URLs; a missing render falls back to the subject's initial. |
| **Icon picker** | One dialog, no tabs: search + a grid of `.icon-tile` buttons (slot + label, `role="option"`, lazy-loaded renders) with incremental paging, and a footer with **Upload image…** (`#icon-upload`, shared image dialog), Cancel and **Use icon**. Paging: first batch 120 tiles, `div#icon-sentinel[data-icon-sentinel]` (aria-hidden, last child of `#icon-grid`) appends 120 more per scroll hit — no slice cap, every one of the 1,368 slugs reachable; typing resets to the first batch and removes the sentinel; `#icon-count-hint` reads `showing 120 of 1368 — scroll for more` and `showing N of M for "query"` while narrowed. Names wrap 2–3 lines, no truncation. Recent picks (`data-icon-recent="true"`) lead the unfiltered first batch. Item mode commits on click; pick-item mode (add material) hides upload and Use, and a single click selects and closes. Curated/common icons sort first. Escape clears the search, then closes; focus returns to the invoker. |
| **Wrapped item name** | Full names wrap to 2–3 lines in picker tiles, material rows and the chooser chip — `white-space: normal`, `overflow-wrap: break-word`, no `text-overflow: ellipsis`, no `-webkit-line-clamp`. Material rows keep `grid-auto-rows: auto` so a taller name grows the row; the assertion is `scrollWidth <= clientWidth + 1` on every name node at 1280 and 390. |
| **Empty state** | One sentence naming the next action plus one control; never a control whose only response is an error toast. Five states: `#build-empty` (`#btn-first-build` asks the state which dialog to open), `#world-empty` (`#btn-empty-create-world` opens the world dialog), `#detail-empty` (`#detail-empty-action`: world dialog if no worlds, else build dialog), `#material-empty` (`#btn-empty-pick-material` focuses the chooser), `#world-material-empty` (`#btn-empty-reset-filter` clears search + filter). |
| **Paste preview** | `#paste-preview` with `textarea#paste-text` (placeholder `64 stone bricks` / `- 32 glass` / `20x oak log`), a live `#paste-rows` list — one row per parsed line with `data-slug` and its parsed quantity — the count `N lines ready to import`, `#paste-errors` naming lines the parser could not read, and `#paste-ok` (**Import list**) disabled while any line is unmatched. `M.parseBulk` is the only parser: one `qty name` or `name x qty` per line, optional `-`/`+` sign, stack syntax (`2s`, `2s+10`), case-insensitive catalogue match; unknown items are reported, never guessed. Importing adds every matched row in one model write with one Undo. The old `#bulk-dialog` / `#bulk-add` / `.bulk-row` review UI is retired. |
| **Undo toast action** | The toast may carry a real `button#toast-action` labelled **Undo** for material, build or world deletion, visible for 6000 ms (other toasts keep 3200 ms). One deep-equal snapshot; any later commit clears it; clicking restores state, view and focus. Confirm copy says “You can undo for 6 seconds.”, never “cannot be undone”. |
| **Suggested-icon marker** | Display-only: `#detail-avatar` carries `data-icon-auto="true"` and `title="<reason>"` while showing a suggestion for a build with no stored icon; the picker shows `p#icon-suggest-note` “Suggested from "<matched text>"” and marks the tile `data-icon-suggested="true"`. Choosing stores the icon and clears the marker; there is no apply control, and the world half of `iconAuto` is carried but inert. |
| **Recent picks** | `mc-build-tracker:recent` — up to 8 slugs, browser-local, not exported; unknown slugs dropped on load. The unfiltered first picker batch leads with `data-icon-recent="true"` tiles; choosing records the slug at the front, de-duplicated. |
| **Icon button** | Square panel button with a 2px black border and the standard bevel, 28–30 px, icon-only (`aria-label` mandatory). Used for the title-rename pencil (`#build-rename`, left of Delete) and coords copy (`#copy-coords`, right of the coords field; disabled when empty or whitespace). |
| **Inline title / notes editor** | Title: view mode is the heading; the pencil swaps in the existing input plus save/cancel; Enter commits through one model path, Escape restores the previous value, blank titles are refused, and focus returns to the invoking button. Notes: view mode is a real `<p class="notes__text" id="notes-text">` with **no field skin** — transparent, no border or shadow, panel text, `pre-wrap`, `overflow-wrap: anywhere`, muted `No notes yet.` when empty. Edit mode swaps in `#notes-editor` with `#build-notes` and replaces the pencil in the **label row** with `#notes-hint` (*Ctrl+Enter to Save*), `#notes-save` and `#notes-cancel` — there is no actions row below the textarea. `Ctrl/Cmd+Enter` saves, Escape cancels, notes are trimmed. |
| **Material row** | One row per material, eight cells: **Item** (icon + name; the name wraps and never ellipsises), **Needed** (the click-to-edit cell above), **In world** (`data-mat-got`, this item's world stock; title "In world — shared stock"), **Allocated** (`data-mat-covered`, what the allocation gave this build), **Left** (`data-mat-remaining`), **Surplus** (`data-mat-surplus` — always present; `+N surplus` with `is-surplus` only when the world stock exceeds the total need, otherwise `–`), the icon **Update** button (`data-mat-update`, a 28 px `mc-btn--xs mc-btn--icon` with `PLUS_ICON`) and the row menu (remove). The whole row is clickable for the dialog (Enter/Space on the focused row too). When the stock is split across more than one active build the Item cell carries `shared with N builds`. A row whose build is Done shows covered = needed, a `.mat-row--done` dim and `.mat-row__check` icon. Editing Needed never edits In world; every number is a display value of one allocation, and the button and the row open one dialog. |
| **Inventory dialog** | One `#inventory-dialog` for the app, `mc-dialog--wide` (580 px) with `novalidate`. Head: `#inv-icon` (the item slot), `#inv-item` (the item name), `#inv-context` (`<build> · <covered> allocated of <needed> needed · <stock> in world`). Body: `#inv-builds` (one `.inv-build[role=listitem]` per build using the item, naming its need and allocation, `(paused)` marked), `#inv-absolute` (`type=number`) pre-filled with the world stock, `#inv-delta` (`type=text`, placeholder `+64`, stack syntax explained in the hint), and `#inv-preview` (`aria-live="polite"`) reading `200 → 264`. Semantics: absolute applies first, then the relative amount; absolute accepts any integer and clamps to 0; delta accepts `+64`, `-32`, `2s`, `2s+10`; `#inv-error` carries the one validation message. **Update** is one model write + one Undo toast; Enter from a field commits (the dialog keydown handler), Escape closes without writing and returns focus to the invoker; the cancelled action clears the target. |
| **Created / updated stamps** | Worlds keep `createdAt` and gain `updatedAt`; builds and all three custom-item scopes carry both. ISO strings, `createdAt` immutable, `updatedAt` touched on every successful mutation; absent stays absent and is never fabricated. Display is **relative**: `Updated <relativeTime>` in a `<time class="stamp" data-iso datetime>` sibling text node (`just now` / `N min ago` / `N h ago` / `N days ago`), with the exact UTC `YYYY-MM-DD HH:MM` (from `M.formatStamp`) plus the raw ISO in `title` (`Updated 2026-10-26 07:05 (<iso>)`) and the raw ISO in `datetime`/`data-iso`. No "Created" is surfaced anymore, and the visible text is never the absolute slice. A present-but-unparseable value shows `—` with title `No timestamp recorded`. |
| **World sidebar** | `aside#world-panel` (`.world-panel`) is grid column 1 of `#main` on every tab: its own panel face, 2px border and bevel, 200 px wide, collapsing in place to a 56 px rail via `#sidebar-toggle` (`«`/`»`, `aria-pressed`) persisted in `localStorage['mbt.sidebar']` (`open`/`closed`). Holds the world picker with its 44 px avatar (`#world-select`, `#world-avatar`), name `#world-panel-name`, identity `#world-meta`, the derived progress line `#world-progress-text` plus `#world-bar`/`#world-fill`, the inactive-build select (`#inactive-mode`: `priority` **Show in place** / `end` **Show at the end** / `hide` **Hide**), the display-only unit toggle (`#unit-toggle`: **Items** / **Stacks** / **Shulkers**, `data-unit`, `aria-pressed`), the **Shopping list** button (`#btn-shopping-list` → `#shopping-dialog`) and the world actions (`#btn-new-world`, `#btn-import`, `#btn-export`). Hidden on the Worlds tab and in Compact mode; the collapsed rail keeps the toggle, the progress bar and the avatar. |
| **Section-head alignment** | Both build columns pin their section head to the same box: `padding-bottom: 4px`, `min-height: 44px`, items centred, so the head rule sits at the same y in the list and the detail (no 2 px override). The four-rule check (`builds`/`detail` × head/rule) must agree within 0.5 px. |
| **Compact builds view** | `#view-standard` / `#view-compact` (`.viewswitch`, `aria-pressed`) switch the Builds tab only; the choice persists in `localStorage['mbt.buildsView']`. Compact keeps the derived `#compact-world` line (name, edition/version, gathered text) and renders `#compact-grid` — `repeat(auto-fill, minmax(560px, 1fr))`, gap 16, one column ≤640. The world sidebar is hidden and the canvas takes the full width. |
| **Compact card** | `article.ccard[data-build-id][data-status]` with `.ccard--done` / `.ccard--inactive` / `.ccard--selected`: head = 24 px avatar, title, status chip and the compact edit/delete buttons (`data-ccard-edit`, `data-ccard-delete`); then `.ccard__progress` (10 px `.ccard__bar` with `role="progressbar"` > `.ccard__fill` and the `%` in `.ccard__pct`); then the material matrix. No materials count, no coords and no stamps — Compact is a scanning view, the detail panel owns the rest. Inactive builds still render, dimmed, whatever `#inactive-mode` says. Cards keep the panel/row bevel language and wrap names. |
| **Compact material tile** | `button.ctile[data-build][data-mat]` in `.ccard__matrix`: a column layout — the **total need** in `.ctile__need` above the item slot, then the **remaining** count in `.ctile__count`; `ctile--done` when nothing is left (opacity .6, grayscale, check icon) and finished tiles sort to the end of the matrix. No visible name; `data-tip` and `aria-label` read `"<item>: need N · have M · L left (N = stacks)"` in the current unit. Click, Enter or Space open the shared `#inventory-dialog` — `#tile-dialog` and friends stay retired. |
| **Chooser chip** | Add-material control: a 30×30 `.slot` with the chosen item's render, the item name beside it, and a "Choose item" affordance (`#mat-choice`/`#mat-choice-slot`/`#mat-choice-name`). Opens the picker in pick-item mode; the hidden `#mat-item` feeds the form and `#mat-error` shows inline validation. |
| **Build list ordering** | The list renders `world.builds` in its stored order — the same order the allocator gives pieces out in — so the position *is* the priority. Each row shows a `data-rank` badge (rank 1 gets the gold `build-entry--top` accent), a 24 px slot, the name (ellipsised with a `title` tooltip), the status badge, `.build-entry__bar` > `.build-entry__fill` (progress), and hover/focus-revealed Edit (`data-build-edit`), Activate (`data-build-activate`, ▶/⏸) and Delete (`data-build-remove`) buttons. Every row is draggable (`.is-dragging`, `.is-drop-before`/`.is-drop-after` indicator) and the keyboard equivalent is `Alt+↑`/`Alt+↓`; both commit one `M.moveBuild` write and keep the selection/focus. A paused build then follows `#inactive-mode`: in place (`priority`, dimmed), at the end (`end`) or hidden (`hide`). Never sorted by status rank or completion anymore. |
| **Sidebar progress** | `#world-meta` is identity + freshness: `<edition> <version> · N builds · Updated <relative>` (the `time` carries the exact timestamp in its title). `#world-progress-text` reads `M.progressText(summary.covered, summary.needed)` — `<covered> / <needed> items gathered (<pct>%)` — from `M.worldSummary` (never a literal), and `#world-bar` (thin XP track) > `#world-fill` (`role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow` = pct). No world or zero needed blanks the line and zeroes the bar. `#world-remaining` and `#world-summary` are retired. |
| **Alignment (measured)** | At 1280×900 and 390×844: each label's left equals its **own** control's left ±1 (pairwise, not one shared column); one control height per row; the add-form slot and Needed share tops and heights; table head and row cell edges ±1; sidebar controls centre within ≤2 px per visual row. Measured on `tests/qa/edict-0017-fixtures/`, not `?demo=1`. |
| **Layout budget (EDICT-0018)** | The shell is `#main` (`200px / 360px / minmax(640px, 1fr)`, `max-width: 1600px` including `.screen`), so a 1600 px window uses the width instead of leaving a gutter; the collapsed rail is 56 px and the table keeps its own 8-column minimums (`minmax(110px,1fr) 84 72 70 64 80 34 28`). At 1280×900 the table head sits at 586 px and six 48 px rows fit above the fold; at ≤1180 the layout drops to two columns, at ≤900 to one, and at ≤760 the material row reflows to a two-row grid (covered/update hidden, head hidden) with no horizontal scroll at 390. The footer is one line at every width. Fixtures live in `tests/qa/edict-0017-fixtures/`; the EDICT-0015 fixture documents the superseded numbers. |
| **Import dialog** | `#import-dialog` with `#import-file` (`accept=".json"` — the extension token is the fix; `application/json` is unregistered on this host, so the first MIME token hid JSON files), a real `#import-drop` target, `#import-text` + `#import-restore` paste path that works with no chooser, and the backup-list restore action; inline `#import-error`; a restored world selects its first build in §2 order. |
| **Custom material** | Three scopes: account/state, world, build (`state/world/build.customItems`), id `custom:<slug>`, name 1–60 chars, stack 1–999, icon = catalogue slug or uploaded image (`{ kind: "image", dataUrl }`). Resolver `build → world → account → catalogue`, nearest wins. Creation is immutable/positional: `M.createCustomItem(state, world, build, target, spec)` → `{ state, entry } | { error }`; four exact error strings. `#btn-new-custom` sits in material mode only, badge `custom`, catalogue-first ordering. **Name validates on input; the icon commits on save.** No schema bump; v1 backups import with empty registries; the account registry is bounded by localStorage. |
| **World backdrop** | Fallback: 16×16 dirt tiled at 2× (`image-rendering: pixelated`), brightness 0.88, radial vignette. **Panorama:** locally generated 2,560×640 strip (six resolved `panorama_0…5` inputs; four side faces stitched with a wrap crossfade; bake radius 2.0, brightness 0.95, saturation 0.92; 55,096 B, sha `331253bd…`). **One** `.backdrop__layer`, `width: 800vh; height: 100%; background-size: 400vh auto; repeat-x; left center`; `backdrop-drift` animates `translateX(-50%) → translateX(0)` over **120 s linear infinite**; per-layer `blur(1px)` desktop / `blur(1.5px)` at ≤640 px; scrim 0.2. `prefers-reduced-motion: reduce` defaults the layer to **paused** (frame still painted: `animation-name: backdrop-drift`, `animation-play-state: paused`) — never `animation: none`; the global 0 ms reset excludes `.backdrop__layer`. Feature-detected at runtime; absence is a normal state. |
| **Pause control** | `button#backdrop-pause` 28×28 in `.topbar__actions` before `#btn-new-world`, `aria-pressed` (`true` = paused), label Pause/Play scenery; persists `localStorage['mc-build-tracker:motion']` (`paused`/`play`) and the `motion-paused` class. Under `reduce` the default is paused; the button or a stored `play` is the explicit opt-in. |

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
- [ ] `npm test` green (one file per process), `python tests/qa/mc_ui_audit.py` exit 0 and
      `node scripts/app-qa.mjs run` green with a fresh stamp over the app sources. The EDICT-0017
      counts, stamp and evidence live in the EDICT-0017 S5 record — not frozen here.
- [ ] Type scale: root 18 px; body 18, muted 17, meta 15, tiny 13; no rule reads 16 px; masthead
      44 px at 1280, section titles 22 px, dialog titles 24 px
- [ ] Face is Minecraft with the Pixelify fallback; `Minecraft-LICENCE.md` present; glyph gaps
      (arrows, dashes, ellipsis, `×`, `·`, `≥`, `≤`) documented and covered by the fallback
- [ ] Item catalog is 1,368 addressable base items from 1,609 renders (241 collapsed variants),
      curated 53 first; `MC_ICON_SET` is an array of slugs while `MC_ICON_NAMES` and
      `MC_ICON_STACKS` are slug-keyed objects; the manifest carries name/stack/sha256/lighting;
      the five `flat_pixel_mismatches` are disclosed
- [ ] Picker pages in 120-tile batches through `#icon-sentinel`, no cap, every slug reachable;
      `#icon-count-hint` uses the frozen `showing N of 1368 — scroll for more` wording; typing
      resets to the first batch
- [ ] Needed is edited in the row's text cell (`input[type=text][inputmode=numeric]`): Enter or
      blur commits one integer, Escape restores the old value, zero/malformed is refused; no
      `.stepper`, `data-stepper`, `#mat-steps` or `data-step` remains
- [ ] One shared world inventory, columns `Needed | In world | Allocated | Left | Surplus`: In
      world is the world stock, Allocated is this build's share, Left = needed − allocated;
      Surplus is always present (`–` when empty, `+N surplus` only when stock > total need); done
- [ ] One `#inventory-dialog` (icon, item, builds using it, live `200 → 264` preview) from the
      row and from a compact tile: absolute then delta (`+64`, `-32`, `2s`, `2s+10`), Enter commits,
      Escape writes nothing, one write and one Undo; `#tile-dialog`/`#tile-*` are gone
- [ ] `#paste-preview` lists every parsed line and keeps **Import list** disabled while any line is
      unmatched; the batch is one write with one Undo; `#bulk-dialog` is gone
- [ ] Notes view mode is `<p class="notes__text">` with no field skin; edit controls live in the
      label row (hint, save, cancel); Ctrl/Cmd+Enter saves, Escape cancels, `No notes yet.` is muted
- [ ] Worlds and builds show "Updated <relative>" (just now / N min ago / N h / N days) with the
      exact UTC timestamp and raw ISO in `title`; no Created line; malformed values show `—`
- [ ] World sidebar `#world-panel`: 200 px track or 56 px rail, `#sidebar-toggle` state persisted in
      `mbt.sidebar`; progress line + `#world-bar`, `#inactive-mode`, `#unit-toggle`, **Shopping
      list**, world actions; hidden on Worlds and in Compact
- [ ] Compact mode: Standard/Compact persisted in `mbt.buildsView`, full-width canvas, 560 px cards,
      tiles show the total need above the remaining count and open the shared `#inventory-dialog`;
      inactive builds still render, dimmed, and finished tiles dim + sort last
- [ ] Both build columns' section heads share one 44 px box and rule position within 0.5 px
- [ ] Tooltip is the single `#mc-tooltip` in the top layer; no `.slot[data-tip]::after` rule
      remains; bubbling `pointerover`/`pointerout` + `relatedTarget`, clamped, flips below,
      hides on Escape and dialog close
- [ ] Build list: drag reorders the stored `world.builds` array (one write, selection kept), the
      rendered list keeps the stored order (= allocation priority), shows a `data-rank` badge,
      and hover Edit/Activate/Delete; `Alt+↑/↓` reorders; `#inactive-mode` persists
- [ ] Progress: `#world-progress-text` is `M.progressText(M.worldSummary)` — `"<covered> / <needed>
      items gathered (<pct>%)"` — with `#world-bar`/`#world-fill` ARIA 0/100/now; blank with no
      world or zero needed; `#world-remaining` and `#world-summary` are gone
- [ ] Import dialog: `#import-file` uses `accept=".json"`, JSON files are visible in the
      chooser, real drop target, paste path works with no chooser, backup list restores,
      inline `#import-error`, restored world selects its first build
- [ ] Custom materials: three registries (`state/world/build.customItems`), `custom:<slug>`,
      immutable positional create, resolved stack/icon, name validates on input and icon
      commits on save, pre-EDICT-0017 backups import through the one-time migration
- [ ] Storage: `mc-build-tracker:v2`; a v1 document migrates once (collected summed per world and
      item, case-insensitively, then deleted from the materials) and the v1 key is left untouched;
      `mbt.units` / `mbt.sort` / `mbt.hideDone` / `mbt.sidebar` / `mbt.inactiveMode` (plus the
      pre-existing `mbt.buildsView`) restore only frozen values, a stale key falls back silently
- [ ] Units are display-only: Items / Stacks / Shulkers re-render every number from the same
      counts and write nothing; `M.formatUnits` uses the item's own stack size (shulker = 27 stacks)
- [ ] Backdrop: one `.backdrop__layer`, `800vh` / `400vh auto` geometry, `backdrop-drift`
      120 s linear infinite, bake 2.0, per-layer `blur(1px)` / 1.5 px at ≤640 px, 0.2 scrim,
      wrap-seamless 2,560×640 strip; `#backdrop-pause` persists; `prefers-reduced-motion`
      pauses by default and never sets `animation: none`
- [ ] Budget measured on `tests/qa/edict-0017-fixtures/` at 1280×900 and 390×844: no horizontal
      scroll, ≥6 table rows visible, `200/360/≥640` columns inside the 1600 px shell,
      one-column ladder ≤900, chips at most 4 per row at 390; compact tiles need-above-count
- [ ] Themed select probe: `CSS.supports('appearance', 'base-select')` true on the pinned
      Chromium and the `::picker(select)` computed panel/border/font match the frozen values
- [ ] Headless Chrome screenshots at 1280 px and at 390 px: no overflow, no missing icons,
      tab state matches the visible panel
- [ ] Every new colour is a token; every new component has a bevel spec above
- [ ] `prefers-reduced-motion` still honoured (content static, scenery paused by default);
      focus ring visible on every control

