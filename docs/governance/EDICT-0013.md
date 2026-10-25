# EDICT-0013 — Interaction pass: the emperor's ten corrections

- **Issued by:** 皇帝 — *"use this font instead"* … *"make the background image less blurred so that users can actually tell what it is"*
- **Drafted and recorded by:** 礼部 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (app UI), 工部 (icon and backdrop generators), 礼部 (design system,
  docs, wiki), 测试部 (`S5Q`, delegated verifier)
- **Browser execution:** the Lead runs every Chrome launch at `S5` — “browser hands, not
  verifier”; 测试部 authors the frozen cases and analyses the artefacts it produces.
- **Recorded:** 2026-10-25 (Asia/Singapore) · **Status:** `S1 DRAFTED` — not enacted; see §6
- **Relates:** [EDICT-0011](EDICT-0011.md) — its R1 deferred expanding the curated 53-item icon
  set; item 6 below is that decision. [EDICT-0012](EDICT-0012.md) — icon rendering and the
  brightness correction this edict builds on.

## 1. The report

On 2026-10-25 the emperor reviewed the running app and filed ten corrections. They are
reproduced verbatim from the dispatch brief; each is followed by the acceptance sentence the
edict will be judged by. Items 1–10 map to `AC1`–`AC10`; `AC11` is non-regression. `AC5` and
`AC9` carry the audit's split between browser behaviour, audit rule and screenshot evidence.

Repo facts are marked *(repo)* and were checked against the working tree on 2026-10-25.
Everything else is the plan, a claim from the dispatch brief, or a finding in the §3 audit, to be
checked in review.

1. *"use this font instead: https://www.dafont.com/minecraft.font"*
   **AC1.** After `document.fonts.ready`, `document.fonts.check('16px Minecraft')` is true, and
   the computed `font-family` of the body and of the build title starts with `Minecraft`;
   Pixelify Sans remains in the chain as the fallback face for the glyphs the TTF lacks.

2. *"for the Build title, remove the text field below it for editing its name. Instead add an
   edit icon to the left of the Delete button beside the build title to edit the Build title"*
   **AC2.** The detail panel has no Name field row; `#build-rename` (aria-label “Edit build
   name”) sits left of `#build-delete`; clicking hides `#detail-heading` and reveals `#build-name`
   plus `#build-name-save`/`#build-name-cancel`; saving persists across reload; cancel or Escape
   restores the previous title and returns focus to `#build-rename`; a blank or whitespace-only
   title is rejected with the model's error.

3. *"add a copy button to the right of the text field for the build coords"*
   **AC3.** `#copy-coords` writes the current coords through `navigator.clipboard` (asserted via
   a stub) or the fallback path and toasts “Coordinates copied”; it is disabled while the coords
   are empty or whitespace.

4. *"Keep the Notes text area only when it is being edited. When only viewing, just display the
   Note text in the Notes section, without the textarea. You decide what UI/UX is best for
   toggling edit and saving the Notes"*
   **AC4.** View mode shows `#notes-text` with the note text and no visible textarea;
   `#notes-edit` switches to `#build-notes` with `#notes-save`/`#notes-cancel`; saving persists
   across reload; a value of `  x  ` trims to `x`; stored HTML is escaped, not rendered; empty
   notes show a muted “No notes yet.”; Ctrl/Cmd+Enter saves and Escape cancels, returning focus
   to `#notes-edit`.

5. *"For each material, the Needed section should have buttons for +1, +10, +stack (depends on
   the material), and same for -1, -10 and -stack. Keep the Got section as-is for now. The text
   fields under the Needed section should not be type number as the browser default up and down
   arrows are showing to increment/decrement the numbers. Or if you can find a way to keep them
   as type number but hide the up and down arrows, that would be great"*
   **AC5.** (a) Browser: each material row renders `div.mat-steps` with exactly six
   `button.mat-step[data-mat][data-step][data-stack]` buttons; `stack` matches the item (stone
   64, egg 16, bucket 16, `water_bucket` 1, `diamond_sword` 1, `potion` 1, `honey_bottle` 16,
   `armor_stand` 16); ±1/±10/±stack clamp the Needed value at ≥ 1 and persist across reload; the
   field stays `input[type="number"][data-mat-field="needed"]`; at 390×844 the builds view has no
   horizontal overflow. (b) `tests/qa/mc_ui_audit.py` asserts the three spinner-hiding CSS rules
   exist. (c) A computed `::-webkit-inner-spin-button` assertion is added only if the probe
   reports `display: none`; screenshots at 1280×900 and 390×844 are evidence.

6. *"Please add the rest of the items in the game to be available for selection in the icon
   selector"*
   **AC6.** `manifest.count >= 1363` (measured 1,368), `manifest.count ===
   window.MC_ICON_SET.length` and `manifest.collapsed_variants === 241`; the curated 53 lead the
   picker; `window.MC_ICON_NAMES` is an object keyed by slug (`{slug: "Display Name"}`), complete
   for every slug — the legacy array is tolerated by the app, not by the contract; every manifest
   entry carries `slug`, `name`, `stack`, `sha256` and `lighting`, exactly one of `block` /
   `flat` / `3d-other` (`block` applies the EDICT-0012 per-face gain, `flat` applies none,
   `3d-other` is disclosed; no `none` survives); the catalog includes `diamond_sword`, `glass`,
   `oak_log` and `red_concrete`; `window.MC_ICON_STACKS` exists; `PROVENANCE.md` is updated; a
   brightness sanity case shows `anvil` and `chest` classified `3d-other` and lit, not flat
   silhouettes, beside `stone`; `hopper` is `flat` in 1.21.4 (jar `item/generated`) and disclosed,
   so the old “hopper must not be a silhouette” check is void. Item 6 is delivered at base-item
   granularity: 246 variant renders collapse onto 5 representatives (§2 D6, §6).

7. *"Remove the Item and Image buttons below "Choose an Icon" in the icon selector dialog, as
   they are redundant and do nothing"*
   **AC7.** No `.picker-tabs`, `#icon-tab-*`, `#icon-pane-*` or `.picker-pane` remains, and image
   upload still works from `#icon-upload` in the dialog footer.

8. *"Reuse/create a similar item selector for adding new materials for builds"*
   **AC8.** The add-material `#mat-choice` control opens the picker in pick-item mode; one click
   on a tile sets `#mat-choice-name` and the hidden `#mat-item`; the added row shows its icon
   immediately; a submit with no selection shows `#mat-error` instead of proceeding.

9. *"Find if there is a way to make the popup menu for dropdown components match the theme of
   the app, instead of the browser default"*
   **AC9.** The build-time probe records the Chrome version,
   `CSS.supports('appearance', 'base-select')` and
   `getComputedStyle(select.mc-select, '::picker(select)')` (`background-color`
   `rgb(111, 111, 111)`, `border-top-color` `rgb(0, 0, 0)`, `font-family` starting `Minecraft`),
   plus a screenshot of the closed control. The case fails unless the probe reports support on
   the same binary that stamps and the values match; if the pseudo-element cannot be read, AC9 is
   re-scoped to a source audit plus pixel evidence through a Q5 waiver — never silently skipped.

10. *"make the background image less blurred so that users can actually tell what it is"*
    **AC10.** The panorama manifest's `blur_radius` is 2.5 (was 8; `--blur` argument under a 0–3
    guard, `max(4, …)` floor removed) and the CSS backdrop blur is ≤ 1 px (mobile ≤ 1.5 px), with
    `backdrop.webp` at 45,664 B and sha256
    `249a1598a120a142aebe73d5a54c7fd612e1d11a82298a3dcfa5734063635978`, before evidence preserved
    (`reports/qa/evidence/edict-0012/01-builds-view-corrected.png` and copies under
    `.tmp/before-edict-0013/`, SHA-256 recorded) and after captures at 1280×900 and 390×844.

**AC11 (non-regression).** Every unit and acceptance suite passes, every browser flow passes,
`tests/qa/mc_ui_audit.py` is updated to the new UI and green, and the browser console has no
errors. The Lead executes `node scripts/app-qa.mjs run` and `node src/wiki/cli.mjs app-qa`
(“browser hands, not verifier”); 测试部 analyses the artefacts; the three new asset hashes (font
TTF, panorama WebP and panorama manifest) and the changed app hashes must predate the stamp,
which is valid only from a green suite.

## 2. Planned architecture

D1–D10 are the Lead's decisions, restated here with file-level touch points; the frozen DOM
contract at the end of this section arbitrates every control name. Four decisions were
under-specified against the working tree and carry a **Recon correction**. The audit in §3 is the
`S2` freeze; the reversible work begun at 17:03 under the Lead's authorisation is recorded in §6
and the ledger (P1).

Write scopes: 兵部 `src/index.html`, `src/styles.css`, `src/app.js`, `src/tracker/model.js`,
`tests/unit/**`; 工部 `scripts/mc-icons.py`, `scripts/mc-backdrop.py`, `src/assets/**`; 测试部
`tests/qa/**`, `qa/**`, `reports/qa/**`; 礼部 `design-system/**`, `wiki/**`; Lead
`docs/governance/ledger.jsonl`, `docs/governance/wiki-sync.json`.

### D1 Font

`src/assets/fonts/Minecraft.ttf` becomes the primary pixel face. `src/styles.css` gains its
`@font-face` beside the existing Pixelify declaration (lines 8–10); `--font-pixel` (line 51)
becomes `'Minecraft','Pixelify',ui-monospace,monospace`. Pixelify Sans stays bundled as the
fallback face because the Minecraft TTF lacks `× · — – … ≥ ≤` and arrows, and the material-row
delete glyph is `×` *(repo: `src/app.js:787`)*. No CDN, no new binary downloaded. The type scale
is unchanged (13/14 meta, 16 body, 20 section, 22 dialog, title `clamp(40px,7vw,72px)`).
Minecraft's lowercase renders as small capitals — accepted as the vanilla look.

The TTF is 14,488 B *(repo: `src/assets/fonts/Minecraft.ttf`)*. 太子's sealed raw source
`raw/sources/2026-10-25-minecraft-font-licence.md` resolves the coverage (sha256
`2e06df49…f5eba7`; seal 7 → 8 entries): the DaFont page and `maxp.numGlyphs` say **110
glyphs**, but the `cmap` maps **107 codepoints** — ASCII `0x20–0x7E` complete, plus U+00A0,
U+00A1–U+00A9, **U+20AC EURO** and U+3000; there are **no accented letters**; arrows, em/en
dash, ellipsis, `×`, `·`, `≥` and `≤` are absent. The name table is `CraftronGaming` /
`Minecraft`; OS/2 `fsType = 0` is an embedding bit, not a redistribution licence. 工部 ships
`src/assets/fonts/Minecraft-LICENCE.md` beside the font before the TTF is committed; 礼部 records
the raw slug, the seal and these numbers in `PROVENANCE.md` and the design system. AC1 stands on
that basis.

Touches: `src/styles.css:8-10,51`; `src/assets/fonts/Minecraft.ttf`, `Minecraft-LICENCE.md`;
`raw/sources/2026-10-25-minecraft-font-licence.md` (太子); no HTML change.

### D2 Build title

Delete the Name field row (`src/index.html:83-86`) and add an icon-only pencil button
`#build-rename` (aria-label “Edit build name”) in `.section-head` between `#detail-heading`
(`:78`) and `#build-delete` (`:80`). The existing `#build-name` input (`:85`, same id) stays in
the DOM, hidden unless editing. The pencil hides `#detail-heading` and reveals that input plus
`#build-name-save` / `#build-name-cancel`; Save and Enter commit through `M.updateBuild`; cancel
and Escape restore the heading and return focus to the pencil; a blank title is rejected with the
model's error.

**Recon correction.** `src/app.js:380` commits the name on `change`, which fires on blur: with
the pencil flow, clicking Save blurs the input, commits and re-renders before the click lands,
and Escape can be preempted. That handler leaves the always-on path and is replaced by the
single commit function shared with D4.

Touches: `src/index.html:75-86`; `src/app.js:380`, `renderDetail`; `src/styles.css` `.detail__head`.

### D3 Coords copy

Icon-only `#copy-coords` button immediately right of `#build-coords` (`src/index.html:97-100`),
disabled while the field is empty or whitespace. The existing clipboard logic (`copyList`,
`src/app.js:932-945`; `fallbackCopy`, `:947-962`) is generalised into one helper used by both Copy
list and Copy coords; success toasts “Coordinates copied”, failure toasts an error. The coords
change handler (`src/app.js:388`) is unchanged.

Touches: `src/index.html:97-100`; `src/app.js:388,932-962`; `src/styles.css` `.field--coords`.

### D4 Notes

The always-visible textarea block (`src/index.html:103-106`) becomes a view/edit pair. View mode
renders `#notes-text` (`class="notes__text"`, pre-wrap, escaped, muted “No notes yet.” when empty)
and `#notes-edit`; edit mode reveals the existing `#build-notes` textarea with `#notes-save` /
`#notes-cancel`. Ctrl/Cmd+Enter saves, Escape cancels and returns focus to `#notes-edit`, the
value is trimmed only, empty becomes null. One commit path shared with D2; no per-keystroke
persistence.

**Recon correction.** The notes `change` handler (`src/app.js:393`) has the same blur-commit
problem as D2 and also moves into the shared path.

Touches: `src/index.html:103-106`; `src/app.js:393`, `renderDetail`; `src/styles.css`.

### D5 Needed steppers

Each material row gets a `div.mat-steps` with exactly six micro buttons —
`button.mat-step[data-mat="<materialId>"][data-step="+1|+10|+stack|-1|-10|-stack"][data-stack="64|16|1"]`
— the plus row above the Needed value, the minus row below or in a compact cluster, with no
horizontal overflow at 390×844. Rows are generated by `renderDetail` (`src/app.js:776-789`,
Needed input `:781-782`), so this is a template change plus one click handler; Needed clamps at
≥ 1 and persists through the material change handler (`:406-414`). The field stays
`input[type="number"][data-mat-field="needed"]` — the emperor's preferred option — with the
native spinners hidden by CSS only (`::-webkit-inner-spin-button`, `::-webkit-outer-spin-button`,
`-moz-appearance:textfield`). The add-material Needed field (`src/index.html:144`) gets the same
treatment.

`stack` is the material's maximum stack size, resolved from the catalog emitted by
`scripts/mc-icons.py` (`window.MC_ICON_STACKS[slug]`, manifest `stack`), defaulting to 64 for
unknown or typed names. **Recon correction:** the export is PNGs only and carries no
max-stack-size data, so the generator ships a checked-in exception table; default-64 is wrong for
tools and armour (1), eggs/snowballs/ender pearls/signs (16) and potions (1). An empty bucket is
16; a water bucket is 1. The frozen samples are stone 64, egg 16, bucket 16, `water_bucket` 1,
`diamond_sword` 1, `potion` 1, `honey_bottle` 16 and `armor_stand` 16. The in-flight fix has
already moved `_bucket` out of `STACK_16_SUFFIX` into `STACK_1_SUFFIX`.

Touches: `src/app.js:406-414,776-789`; `src/styles.css` spinner rules; `scripts/mc-icons.py`
catalog data (with D6); unit fixtures under `tests/unit/**` (兵部).

### D6 Icon catalog

`scripts/mc-icons.py` stops emitting the curated 53-item lists (`BLOCKS`/`ITEMS`, `:73`,
`:374-375`) and emits the whole local export at `%APPDATA%\.minecraft\icon-exports-x256`. It
writes the frozen catalog contract: `window.MC_ICON_SET` (slug array), `window.MC_ICON_NAMES`
(an **object keyed by slug**, `{slug: "Display Name"}`, complete for every slug) and
`window.MC_ICON_STACKS` (`{slug: 64|16|1}`, absent key = 64) into `icons.js`; the regenerated set
is 1,368 icons, 81 KB `icons.js` and 434 KB `manifest.json`. `manifest.json` is `{count, renders,
collapsed_variants, icons: [{slug, name, stack, sha256, bytes, source, lighting}]}`, with
`count = 1368`, `renders = 1609` and `collapsed_variants = 241` (246 variant renders collapse onto
5 representatives). `lighting` is exactly `block` / `flat` / `3d-other`, migrated `faces` →
`block`, `uniform` → `flat`, and `none` split by the jar item-model chain (`item/generated` →
`flat`, anything 3D-ish → `3d-other`). **The jar confirms `hopper` is `flat` in 1.21.4**
(`models/item/hopper.json` parent `item/generated`, verified by 工部), so it is disclosed as flat
and the old “hopper must not be a silhouette” check is void; `anvil` and `chest` are `3d-other`.
No `none` survives. Migrated counts: **block 407 / flat 620 / 3d-other 341 = 1368**; the
341-name list is in 工部's report and `.tmp/3d-other.txt`. `PROVENANCE.md` is updated. The picker stays fast: `loading="lazy"`
`.icon-tile`s, name search, a render cap around 150 visible matches with a count hint, curated 53
first. Generation writes to a temporary directory and swaps, or a failed run is rerun and verified
by count and sha256 — no partial catalog.

**Recon correction — the export is not a clean item list.** *(repo, counted 2026-10-25)* The
directory holds 1,614 PNGs: 1,609 `minecraft__*` item renders and 5 `fluid__*` renders
(empty/flowing water and lava). 246 of the 1,609 are component/NBT variants whose filenames carry
braces and quotes — 46 each for `potion`, `splash_potion`, `lingering_potion`, `tipped_arrow`
and `painting`, plus 10 `suspicious_stew`, 4 `ominous_bottle` and 2 `firework_rocket` — so a
naive expansion would create slugs no typed material name can ever match. Policy: emit only
`minecraft__*`, drop the braces/quotes variants, and keep one deterministic representative per
base item: the plain render where one exists (`painting`, `ominous_bottle`, `firework_rocket` do;
`potion`, `splash_potion`, `lingering_potion`, `tipped_arrow` and `suspicious_stew` do not
*(repo)*, so the representative is the first variant in sorted order, carrying the base display
name). 测试部 counted 1,368 addressable icons; AC6's floor is 1,363.

**Recon correction — brightness and stack sizes.** The old curated-only generator classified
silhouette shape and would ship dark 3D renders (`anvil`, `chest`, `enchanting_table`,
`brewing_stand`, `cauldron`) with the flat-item gain; the jar model chain removes the guess.
`hopper` is not one of them: the jar says `flat` (1.21.4, `models/item/hopper.json` parent
`item/generated`), so it is disclosed as flat and its silhouette check is void. Five flat sprites
— `enchanted_book`, `enchanted_golden_apple`, `end_crystal`, `experience_bottle`, `nether_star` —
are byte-for-byte copies with no lighting correction and are disclosed as `flat_pixel_mismatches`.
The stack exception table from D5 is product data with no source in the export; 测试部 audits it
against the frozen eight samples and a category sample, not three. `category` has no source in a
flat PNG export and is dropped rather than guessed.

Touches: `scripts/mc-icons.py` (`:73,:374-375,:547,:565,:613`); `src/assets/icons/icons.js`,
`manifest.json`, `PROVENANCE.md`; acceptance fixtures under `tests/qa/**`.

### D7 Icon picker

One dialog, no tabs. Keep `#icon-dialog`, `#icon-search`, `#icon-grid`, `#icon-file`,
`#icon-preview`, `#icon-use`, `#icon-cancel` and `#icon-error`; add `#icon-upload` (footer
secondary, “Upload image…”), `#icon-count-hint` and `#icon-dialog-title`. Delete the
`.picker-tabs` strip and its buttons (`src/index.html:299-301`), `.picker-tab`, `.picker-pane`,
`#icon-pane-item`, `#icon-pane-image`, the image pane (`:309-319`) and the mode switching in
`src/app.js` (`ui.iconMode` at `:168`, `renderIconPicker` at `:177-200`; there is no
`setIconMode` function *(repo)*). Item search and grid stay (`:303-307`); tiles are
`.icon-tile`. Image upload drives the existing hidden `#icon-file` (`:314`), `#icon-preview`
(`:312`) and `processImageFile` (`src/app.js:110`), so no capability is lost. The footer keeps
Cancel/Use icon (`:321-324`). `pick-item` mode for D8 hides `#icon-use` and `#icon-upload`; a
single click on a tile picks it and closes, with no Use-icon commit.

Touches: `src/index.html:296-326`; `src/app.js:110,168,177-202,530-551`; `src/styles.css`
`.picker-tabs`, `.picker-tab`, `.picker-pane`.

### D8 Material selector

Replace the free-text `#mat-item` (`src/index.html:139`) and its datalist (`:140`) with
`#mat-choice`, a chooser showing `#mat-choice-slot` (30×30 `.slot` plus the icon) and
`#mat-choice-name`, opening the picker in `pick-item` mode. `#mat-item` stays the hidden input the
submit handler reads; choosing a tile fills it and the chip. The generated `#item-options`
datalist and its population code (`src/app.js:890`) go away.

**Recon correction — validation.** A hidden input no longer participates in native constraint
validation, so the add-material form (`:135-151`) must check the selection itself and show
`#mat-error`; the submit handler (`src/app.js:424-439`) must stop focusing `#mat-item` (`:438`)
and focus `#mat-choice` after reset. Needed and Got stay number fields with spinners hidden.

Touches: `src/index.html:135-151`; `src/app.js:424-439,890`; `src/styles.css` `.add__item`.

### D9 Themed dropdowns

The four `.mc-select` controls (`src/index.html:36,173,229,269`) are native selects with the
browser popup. Chromium 155.0.8059.86 implements `appearance: base-select` and `::picker(select)`
— pinned by R6. Within `@supports (appearance: base-select)`, `select.mc-select` gets
`appearance: base-select` and `::picker(select)` takes the app theme: frozen computed values
`background-color: rgb(111, 111, 111)`, `border-top-color: rgb(0, 0, 0)`, `font-family` starting
`Minecraft`; inset bevel highlights, vanilla hover/selected option rows, and
`::picker-icon { display: none }` so the existing drawn chevron stays. Browsers without the
feature keep the native popup — a progressive enhancement with no JavaScript. The probe must
report `CSS.supports('appearance', 'base-select')` from the same binary that stamps; headless
cannot open a native popup, so it reads the computed pseudo-element and screenshots the closed
control.

Touches: `src/styles.css` `.mc-select` plus a new `@supports` block; no HTML or JS change.

### D10 Backdrop

Regenerate `src/assets/panorama/backdrop.webp` from `scripts/mc-backdrop.py` with far less blur.
*(repo)* The script blurs by `BLUR_RATIO = 1/320` (line 39; its comment misstates the divisor)
through `max(4, round(width * BLUR_RATIO))` (line 180) — 8 px at the 2,560 px bake — and writes
`blur_radius` into the manifest (line 205); brightness 0.95 and saturation 0.92 are baked in
(lines 181–182), with faces 4 and crossfade 64. The bake runs with `--blur` 2.5 under a 0–3 guard
and the `max(4, …)` floor removed: `backdrop.webp` goes from 15,280 B to 45,664 B with sha256
`249a1598a120a142aebe73d5a54c7fd612e1d11a82298a3dcfa5734063635978`; faces, crossfade, 2,560×640,
brightness and saturation stay unchanged. CSS `:root.has-panorama .backdrop::before` goes from
`blur(2px)` (`src/styles.css:780`) to ≤ 1 px, mobile from `blur(3px)` (`:939-941`) to ≤ 1.5 px; the
scrim may rise from 0.12 (`--backdrop-scrim-alpha`, `:48`) to about 0.2 so title and tab text keep
contrast. The old assets (with their SHA-256) stay in `.tmp/before-edict-0013/`, the side-by-side
preview is `.tmp/panorama-before-after.png`, and
`reports/qa/evidence/edict-0012/01-builds-view-corrected.png` is the before capture; after
captures at 1280×900 and 390×844 are evidence.

Touches: `scripts/mc-backdrop.py:39,180-182,205`; `src/styles.css:48,780,939-941`;
`src/assets/panorama/backdrop.webp` and its manifest (工部); `.tmp/before-edict-0013/`; evidence
under `reports/qa/evidence/edict-0013/` (测试部).

### Frozen DOM contract (F1)

Reproduced verbatim from `.tmp/plan/contract.md` (Lead decision, 2026-10-25 17:10). It is the
single source of truth for `task-3` and `task-5`; neither side renames anything without a Lead
note there.

```markdown
# EDICT-0013 — FROZEN DOM CONTRACT (Lead decision, 2026-10-25 17:10)

This is the single source of truth for `task-3` (兵部) and `task-5` (测试部). Cases are frozen
against these names; neither side renames anything without a Lead note here. 测试部's F1 list
and 兵部's §6 list differed in three names — the Lead's names below win.

## 1. Build detail — title rename (D2)
| role | selector | notes |
|---|---|---|
| heading (view) | `#detail-heading` | hidden while editing |
| edit trigger | `#build-rename` | icon-only pencil, sits LEFT of `#build-delete`; aria-label "Edit build name" |
| name input | `#build-name` | same id as today; hidden unless editing |
| save | `#build-name-save` | commits via `M.updateBuild`, visible only in edit mode |
| cancel | `#build-name-cancel` | discards, visible only in edit mode |
The old "Name" field row/label is gone from the detail panel.

## 2. Build detail — coords copy (D3)
`#copy-coords` — icon-only button immediately RIGHT of `#build-coords`; `disabled` when the
coords field is empty or whitespace; copies the current value; toast "Coordinates copied".

## 3. Build detail — notes (D4)
| role | selector | notes |
|---|---|---|
| view text | `#notes-text` | `class="notes__text"`, `pre-wrap`, escaped; muted "No notes yet." when empty |
| edit trigger | `#notes-edit` | icon-only pencil |
| editor | `#build-notes` | same id/textarea as today; hidden unless editing |
| save | `#notes-save` | Ctrl/Cmd+Enter also saves |
| cancel | `#notes-cancel` | Escape also cancels |

## 4. Material needed steppers (D5)
Each material row renders a container `div.mat-steps` with exactly six buttons:
`button.mat-step[data-mat="<materialId>"][data-step="+1|+10|+stack|-1|-10|-stack"]`
plus `data-stack="<64|16|1>"` (the resolved stack size) on every button.
Visible labels: `+1`, `+10`, `+stack`, `-1`, `-10`, `-stack`.
Layout: `+` row above the Needed input, `-` row below (or a compact cluster) — must not
overflow at 390x844. The Needed input stays `input[type=number][data-mat-field="needed"]`
and clamps at 1. Native spinners are hidden by CSS only (AC5 split per F2).

## 5. Icon picker (D6/D7)
Kept: `#icon-dialog`, `#icon-search`, `#icon-grid`, `#icon-file` (hidden file input),
`#icon-preview`, `#icon-use`, `#icon-cancel`, `#icon-error`.
Added: `#icon-upload` (footer secondary action "Upload image…" — drives `#icon-file`),
`#icon-count-hint` (result cap / total hint), `#icon-dialog-title`.
Removed entirely: `.picker-tabs`, `.picker-tab`, `#icon-tab-item`, `#icon-tab-image`,
`#icon-pane-item`, `#icon-pane-image`, `.picker-pane`, and the `setIconMode`/`icon-mode` path.
In pick-item mode (`#icon-use` hidden, upload hidden): a single click on a tile picks and
closes.

## 6. Add-material item selector (D8)
| role | selector | notes |
|---|---|---|
| chooser button | `#mat-choice` | shows slot + name, opens the picker in pick-item mode |
| slot | `#mat-choice-slot` | 30x30 `.slot` |
| name | `#mat-choice-name` | hidden input or span holding the chosen name — kept as hidden `#mat-item` value too |
| name value | `#mat-item` | stays in the DOM as the hidden input the submit handler reads |
| form error | `#mat-error` | inline error text (was a toast/datalist path) |
Removed: `#item-options` datalist and its render function path.

## 7. Themed dropdowns (D9)
No DOM change; `.mc-select` gains an `@supports (appearance: base-select)` block that sets
`appearance: base-select`, hides `::picker-icon`, and themes `::picker(select)` + `option`.
Frozen computed values for the assertion: `::picker(select)` `background-color` = the panel
face (`rgb(111,111,111)`), `border-top-color` `rgb(0,0,0)`, `font-family` starting with
`Minecraft`. 工部/Lead add a build-time probe line (F4) so the assertion cannot pass
vacuously: the probe must report `CSS.supports('appearance','base-select')` from the same
Chrome binary the stamp was made with.

## 8. Catalog data contract (工部 emits, 兵部 consumes) — corrected 17:2x per 测试部/太子
- `window.MC_ICON_SET` — array of slugs (existing shape, unchanged).
- `window.MC_ICON_NAMES` — **object keyed by slug** `{slug: "Display Name"}`, complete for
  every slug (this is what 工部's regenerated `icons.js` ships, and `src/app.js` indexes it
  that way while tolerating the legacy array). Canonical emitted shape = object; tests
  migrate off the legacy array expectation.
- `window.MC_ICON_STACKS` — `{slug: 64|16|1}` for every icon; absent key = 64.
- `manifest.json` — `{count, renders, collapsed_variants, icons:[{slug, name, stack, sha256,
  bytes, source, lighting}]}`; `count === MC_ICON_SET.length`.
- Counts as measured: `renders = 1609`, `count = 1368`, so **`collapsed_variants = 241`**
  (246 variant renders collapse onto 5 representatives; 246 is the variant count, not the
  collapsed count). Floor: `count >= 1363`, curated 53 first in ordering.
- `lighting` enum is exactly `"block"` (cube-ish render, EDICT-0012 per-face gain applied),
  `"flat"` (`item/generated` sprite, no gain), `"3d-other"` (shaded/3D but not per-face
  calibrated; no gain; count and list disclosed in the report). No `"none"`. The current
  489 `faces` / 3 `uniform` / 876 `none` migrate by: `faces` → `block`; `uniform` → `flat`;
  `none` split by jar item-model chain (`item/generated` → `flat`, anything 3D-ish →
  `3d-other`). **Correction from the jar (工部, verified): `hopper` is genuinely flat in
  1.21.4** (`models/item/hopper.json` parent `item/generated`) → `hopper` is `flat`,
  disclosed; the "hopper must not be a silhouette" check is void for this version. `anvil`
  and `chest` → `3d-other`. Migrated counts: block 407 / flat 620 / 3d-other 341 = 1368.
- Font glyph truth (from 太子's sealed raw source): page and `maxp.numGlyphs` say 110;
  `cmap` maps 107 codepoints. Non-ASCII present: U+00A0, U+00A1-U+00A9, **U+20AC EURO**,
  U+3000. No accented letters. Absent: arrows, em/en dash, ellipsis, ×, ·, ≥, ≤.
```

## 3. Review record

测试部 replaces each `PENDING` with `PASS` or `FAIL` plus a finding id. R1–R10 are the
state-machine gate items.

| Id | Risk / question | Draft position | Verdict (测试部) |
|----|-----------------|----------------|------------------|
| R1 | Scope: ten founder items, one edict, four files of app code plus two generators and the whole icon set. Is this one dispatch? | One edict with two work streams (兵部 UI, 工部 generators) and shared QA; item 6 is the deferred EDICT-0011 R1 decision and cannot be split off without leaving the open question open. | **PASS** — F9 |
| R2 | Decomposition: are the write scopes disjoint and the tasks orderable? | 兵部: `src/index.html`, `src/styles.css`, `src/app.js`; 工部: `scripts/mc-icons.py`, `scripts/mc-backdrop.py`, `src/assets/**`; 测试部: `tests/qa/**`, `qa/**`, `reports/qa/**`; 礼部: `design-system/**`, `wiki/**`. D6 catalog data must land before D5's stack lookup and before D7/D8's picker. | **PASS** — F1 (scope text omits `src/tracker/model.js` and `tests/unit/**` from 兵部) |
| R3 | Acceptance: do AC1–AC11 pin the ten items without over- or under-reaching? | One AC per item plus AC11 non-regression; AC5 samples stack sizes across 64/16/1; AC6 has a 1,000-icon floor and names four items the export carries *(repo)*; AC9 is computed-style only because headless cannot open the popup. | **FAIL** — F1, F2, F3, F4, F9, F13 |
| R4 | Ordering: does anything depend on a later change? | D6 before D5/D7/D8; D7's picker mode before D8; D2/D4 share one commit path; font and backdrop are independent; QA after all; no founder input pending except the taste acceptance on D10. | **FAIL** — F7, F8, F16, P1 |
| R5 | Risk: what is most likely to go wrong? | (a) 246 component-variant filenames — handled by the D6 filter and representative policy; (b) stack sizes are product data with no export source — exception table plus a category audit; (c) a ~1,300-tile catalog could be slow — lazy tiles, cap ~150, search; (d) `Minecraft.ttf` is untracked with an unsealed licence claim — 太子 raw snapshot or accept the brief's DaFont label in the record. | **FAIL** — F3, F6, F14, F15 |
| R6 | Environment: can the toolchain run here? | Node v22.14.0; `python` and `py -3` are 3.13.3 without Pillow or fontTools *(repo)* while the ledger records Pillow 12.3.0, so 工部 must name the interpreter before dispatching D10; browser suites need headless Chrome and `danger-full-access` approval per command; no network required; generated PNGs stay ignored. | **FAIL** — F4, F5, F10, F11, F12 |
| R7 | Failure paths: what happens on a red suite or a bad bake? | No partial enactment: a red browser suite means no app-qa restamp and S6 is blocked; generated icons and backdrop are ignored and regenerable from the local export; app code reverts with `git checkout`; the stored-data schema is unchanged, so no migration; a failed backdrop bake leaves the previous WebP and manifest in place. | **FAIL** — F14, F16 |
| R8 | Escalation: who decides if review disagrees? | 测试部 may FAIL any row and block dispatch; unresolved disagreements go to the Lead and, if still open, the emperor. The likely ones are the D6 variant policy, the font licence (R5) and the two open-question closures (R9). | **PASS** — F4, F6 (adds the Q5 waiver routes) |
| R9 | Wiki upkeep (EDICT-0006): is the impact named? | Section 5 lists every page and document; the two questions EDICT-0011 deferred are closed or rewritten; `lint`'s `edict-sync` requires an ingest/edit log entry citing EDICT-0013 dated on or after S6. | **PASS** — F6, F9 |
| R10 | App QA freshness (EDICT-0009): will the stamp be valid at S6? | No. Four of the five hashed files change (`src/index.html`, `src/styles.css`, `src/app.js`, `src/assets/icons/icons.js`; `src/tracker/model.js` does not). `docs/governance/app-qa.json` is verified today and stale after the first edit. 测试部 reruns `node scripts/app-qa.mjs run` with `danger-full-access` and restamps only from a green suite; `node src/wiki/cli.mjs app-qa` must report verified at S6. | **FAIL** — F5, F8 |

### 3.1 Independent recon (测试部, 2026-10-25)

Everything below was measured on this machine, not copied from the brief or the draft.

- Export set `%APPDATA%\.minecraft\icon-exports-x256`: **1,614 PNGs** = **1,363** `minecraft__[a-z0-9_]+.png` + **246** component-variant renders + **5** `fluid__*` renders. Variant families: 46 each for `potion`, `splash_potion`, `lingering_potion`, `tipped_arrow`, `painting`; 10 `suspicious_stew`; 4 `ominous_bottle`; 2 `firework_rocket`. Plain renders exist for `painting`, `ominous_bottle`, `firework_rocket`; none for `potion`, `splash_potion`, `lingering_potion`, `tipped_arrow`, `suspicious_stew`. So D6's dedup policy yields **1,368 addressable icons** — the draft's "roughly 1,363–1,371" is right.
- `src/assets/fonts/Minecraft.ttf` (struct parse; `fontTools` absent): 14,488 B, name table `CraftronGaming` / `Minecraft` / `Medium` / `Version 001.000`, UPEM 1024, **107 codepoints** (ASCII `0x20–0x7E` complete; `× · — – … ≥ ≤` and arrows absent — the brief's "110 glyphs" counts glyph records, not mapped codepoints), **no copyright/licence name record**, OS/2 `fsType = 0` (installable embedding, not a redistribution licence). Untracked in git (`??`).
- Toolchain: Node **v22.14.0**; Chrome **155.0.8059.86**; bundled interpreter `C:\Users\KZ\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe` = **3.12.14 + Pillow 12.3.0** (PATH `python`/`py` are 3.13.3 without Pillow).
- **Headless Chrome cannot start in the verifier's sandbox**: `FATAL:mojo\public\cpp\platform\platform_channel.cc:112 Check failed: . : Access is denied. (0x5)` — reproduced with plain `--headless=new`, with the harness flag set, and with `--no-zygote --single-process`; the CDP port never opens. Approval prompts are disabled for this delegated seat, so the `danger-full-access` retry is auto-rejected. See F5.
- Baseline today (before the build): `tracker.acceptance` 16/16, `tracker-icons.acceptance` 8/8, `tracker-icon-resolution` 7/7, `app-qa.acceptance` 7/7, `wiki.acceptance` 13/13, `wiki-sync.acceptance` 8/8 (59 Node cases, exit 0); `tests/qa/mc_ui_audit.py` **72/72** with the bundled interpreter; `node scripts/app-qa.mjs status` → verified, **36 UI cases**. The audit's update ledger (F10b) is the exact list of assertions that must change.
- Working tree: `docs/governance/EDICT-0013.md` is the only untracked governance file; `scripts/mc-icons.py` and `tests/unit/tracker-model.test.mjs` are already modified — see P1.

### 3.2 Findings

Blocking findings must be folded into §1/§2/§5 (or resolved by the Lead) before `S3` dispatch; non-blocking ones are corrections and tracked as conditions.

| Id | Gate | Severity | Finding | Concrete fix |
|----|------|----------|---------|--------------|
| F1 | R2/R3 | **Blocking** | The plan invents ~12 controls (pencil, Save/Cancel, copy, notes view/edit, six steppers per row, picker footer upload, refine hint, material chooser/chip/error) but freezes no id/attribute contract for any of them. G4 requires the cases to be authored and frozen at build submission, so without a contract the suite would be written against whatever the build happened to pick — a process defect, and untestable-by-design for "Save/Cancel" in AC2/AC4. | Add this contract to §2 and freeze it at S3: `#build-rename` (button, `aria-label="Rename build"`), `#build-name-save`, `#build-name-cancel`, `#build-name` carries the `hidden` attribute while idle; `#copy-coords` (button, `aria-label="Copy coordinates"`, `disabled` iff `#build-coords.value.trim()===''`, success toast matching `/Coordinates copied/`); `#notes-text` (`p.notes__text`, empty state text exactly `No notes yet.`), `#notes-edit`, `#notes-save`, `#notes-cancel`, `#build-notes` hidden while idle; per-row steppers `button[data-mat-step="+1\|+10\|+stack\|-1\|-10\|-stack"][data-mat="<material id>"]` with the stack button also exposing `data-stack="<n>"`, Needed input keeps `[data-mat-field="needed"]` and `type="number"`; `#icon-upload` (footer action, `aria-label="Upload image"`), `#icon-file`, `#icon-preview`, `#icon-use`, `#icon-cancel`, `#icon-grid .icon-tile`, `#icon-refine-hint` (visible only when matches exceed the cap); `#mat-choose` (button, `aria-label="Choose item"`), `#mat-item` (`type="hidden"`, value = item name), `#mat-chip`, `#mat-error` (`role="alert"`). List `src/tracker/model.js` and `tests/unit/**` in 兵部's scope in R2. |
| F2 | R3 | **Blocking** | AC5's "native spinners not displayed" has no verified black-box method. `::-webkit-inner-spin-button` is a UA pseudo-element outside the CSSOM pseudo-element list; `getComputedStyle(el, '::-webkit-inner-spin-button')` may return `null`, and a source-string check is an internal audit, not a user-visible assertion. As written the suite would either skip the claim or lie about it. | Split AC5: (a) browser — field stays `type="number"`, the six `[data-mat-step]` buttons change, clamp at ≥1 and persist, builds view at 390×844 has no horizontal overflow; (b) `tests/qa/mc_ui_audit.py` — the three spinner-hiding rules exist in `src/styles.css`; (c) evidence — 1280×900 and 390×844 screenshots of a material row (Lead-captured, see F5/F7). Run a build-time probe of `getComputedStyle(document.createElement('input'), '::-webkit-inner-spin-button').display`; only if it returns `none` may the browser case add that assertion. |
| F3 | R3/R5 | **Blocking** | Two defects in AC6. (1) The 1,000 floor under-delivers "the rest of the items": 1,368 are addressable (recon), so a build could ship 1,000 and pass. (2) The catalog's brightness contract regresses EDICT-0012: the in-flight generator classifies uncurated icons by silhouette only — `kind:"auto"` becomes `cube` if the silhouette equals the stone reference box, otherwise `item` with `lighting:"none"` — so non-cube 3D items (verified in the export: `anvil`, `chest`, `hopper`, `enchanting_table`, `brewing_stand`, `cauldron`) would ship with the IconExporter dark-lighting bug that EDICT-0012 recorded as corrected, disclosed only in PROVENANCE prose. | (a) AC6 floor: `manifest.count >= 1363`, `manifest.count == MC_ICON_SET.length`, and the manifest's own `renders` / `collapsed_variants` accounting must reconcile. (b) D6 must classify 3D vs flat from the client jar's `assets/minecraft/models/item/<slug>.json` parent chain (the jar is already opened for calibration) and apply the face-area-weighted gain (`lighting:"uniform"`) to every non-flat item; if that is genuinely out of scope, AC6/§6 must state the regression and S3 must request a Q5 waiver instead of shipping it silently. (c) Frozen cases: every manifest icon carries `kind` and `lighting`; sampled known-3D items (`anvil`, `chest`, `hopper`, `furnace`, `torch`) are corrected; a 3-item brightness spot check on uncurated blocks lands within the vanilla face ratios. |
| F4 | R3/R6 | **Blocking** | AC9's method is unproven and can pass vacuously: "where `@supports (appearance: base-select)` applies" is trivially true if the feature is absent, and this reviewer could not verify the premise (no browser can start here — F5). Chrome 155.0.8059.86 is installed, but the brief's "verified" is a claim, not evidence. | Add a build-time probe run by the Lead/兵部 with escalation, recording: Chrome version, `CSS.supports('appearance','base-select')`, `getComputedStyle(document.querySelector('select.mc-select'), '::picker(select)').backgroundColor / borderColor / fontFamily`, and the closed-control screenshot. The frozen case must fail unless `CSS.supports(...) === true` on the verification machine and the pseudo-element values match the theme; if the pseudo-element cannot be read, AC9 is re-scoped to source-audit + pixel evidence through a Q5 waiver — never silently skipped. |
| F5 | R6 | **Blocking** | The verifier seat cannot execute the browser suite at all (exact FATAL in §3.1; approval prompts disabled, so the `danger-full-access` retry is auto-rejected). §4 and R10 assume 测试部 runs `node scripts/app-qa.mjs run` with escalation; as written, S5 can produce neither the stamp nor the screenshots. | Lead decision before S3: (a) the Lead runs the frozen suite and captures in a session with escalation — 测试部 authors the suite, observes the raw log and performs all pixel/JSON analysis, disclosed as a process note in the QA report (Q1 remains structurally intact; it is not a waiver of Q4); or (b) the verifier seat is re-provisioned with escalation. Do not plan an S6 that assumes this seat can start Chrome. |
| F6 | R5/R9 | **Blocking** | The font licence is unsealed and the TTF is untracked. The draft offers "太子 raw snapshot **or** accept the brief's DaFont label"; accepting an unrecorded web label is not a licence record. Recon adds: the font file itself carries no copyright/licence string and `fsType=0` is an embedding bit, not a redistribution grant. | §5 must commit 太子 to seal one raw source containing the DaFont listing/licence text and the TTF SHA-256; 工部 must ship `src/assets/fonts/Minecraft-LICENCE.md` (source URL, licence statement, SHA-256) beside the font before the TTF is committed, and 礼部 records it in PROVENANCE/MASTER. If the licence text cannot be obtained, AC1 escalates to 皇帝 (Q5) with the fallback (Pixelify primary), rather than committing the file on an unsealed claim. |
| F7 | R4/R7 | **Blocking** | AC10 requires before/after captures, but `src/assets/panorama/backdrop.webp` is git-ignored and D10 overwrites it; after S4 starts there is no "before" state to capture. No owner or step is assigned for the before side, so the evidence cannot exist. | Add to §4 ordering: 工部 copies `src/assets/panorama/{backdrop.webp,manifest.json}` to `.tmp/before-edict-0013/` (SHA-256 recorded) **before** regenerating, and the Lead captures the 1280×900 "before" screenshot in the same step; 测试部 analyses only evidence it did not generate (Pillow pixel/contrast analysis of the supplied PNGs). |
| F8 | R10 | **Blocking** | Stamp freshness gap: `APP_SOURCE_FILES` (`src/wiki/lib.mjs:456-462`) hashes only `index.html`, `styles.css`, `app.js`, `tracker/model.js`, `icons.js`; the font and `src/assets/panorama/*` are rendered input but outside the stamp. A green run can therefore be stamped before the backdrop is regenerated, and S6 would claim "verified" for pixels nobody re-tested. | Order all asset work before the final `node scripts/app-qa.mjs run`, and add a frozen S5 case asserting every rendered asset (`src/assets/fonts/Minecraft.ttf`, `src/assets/panorama/backdrop.webp`, `src/assets/panorama/manifest.json`, `src/assets/icons/icons.js`, `src/assets/icons/manifest.json`) has `mtime <` the stamp's `verified_at`. Extending `APP_SOURCE_FILES` is optional if this case holds. |
| F15 | R5 | **Blocking (in-flight fix)** | The in-flight `stack_size()` returns **16 for `water_bucket`** because `STACK_16_SUFFIX` contains `_bucket` (`scripts/mc-icons.py:162`), contradicting AC5/D5 ("water bucket 1"; an empty bucket is 16 — the draft's own D5 recon). Filled buckets stack to 1 in vanilla. | Remove `_bucket` from `STACK_16_SUFFIX`, add `_bucket` to `STACK_1_SUFFIX` and keep exact `bucket = 16`. Frozen samples: `stone 64`, `egg 16`, `bucket 16`, `water_bucket 1`, `diamond_sword 1`, `potion 1`, `honey_bottle 16`, `armor_stand 16`. |
| F9 | R1/R3 | Non-blocking | Item 6 is delivered at base-item granularity (246 variant renders collapse onto 5 representatives), which is a defensible policy but contradicts "the rest of the items" unless stated. | AC6 and §6 say so explicitly; §5's closure of "Tracker: icon coverage" records that potion/painting variants are represented by one render. |
| F10 | R3/R6 | Non-blocking | (a) AC11 and §4 cite `qa/mc_ui_audit.py`; the audit is `tests/qa/mc_ui_audit.py` (`qa/` holds only `qa-evidence-template.md`; README.md:117, design-system MASTER.md:107 and EDICT-0005.md:59 all cite `tests/qa/`) — the stated command would fail. (b) No update ledger for existing assertions that item 7/8/5/1/6/9 necessarily change. | (a) Correct AC11, §4 and the task-5 command to `tests/qa/mc_ui_audit.py`. (b) Freeze this update ledger (change, never weaken, never delete the hash/no-game-pixels/no-stale-PNG checks): `ui.e2e.test.mjs` cases 09, 12, 14, 23, 26, 27, 30, 31; `tracker-icon-resolution.acceptance.test.mjs` AC-R1/R2/R3 (`ICON_COUNT = 53`, exact `source` path for the 5 collapsed representatives); `tracker-icons.acceptance.test.mjs` AC-I3 (`#icon-tab-*`/`#icon-pane-*` ids) and AC-I5 (`.picker-tab`); `tracker.acceptance.test.mjs` AC-10 (count/kind/lighting/stack), AC-13 (`class="picker-tab"` count 2); `mc_ui_audit.py` `a11y/tablist` (`picker_tabs == 2`), `html/local-font` (Pixelify path), `identity/css-*` (`.picker-tab`). |
| F11 | R6 | Non-blocking | R6's interpreter line is incomplete: the working interpreter is the bundled `C:\Users\KZ\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe` (3.12.14 + Pillow 12.3.0, verified); only PATH `python`/`py` are 3.13.3 without Pillow. | Name the bundled interpreter in §4 as 工部's required command; keep the PATH note as the reason not to use it. |
| F12 | R6 | Non-blocking | Chrome's version is not pinned, so AC9's support claim floats. | Record Chrome 155.0.8059.86 in R6/§4 and have the probe report it. |
| F13 | R3 | Non-blocking | AC1/AC2/AC4 omit failure paths and the semantics they rely on: empty/whitespace title rejection (the model answers "A build needs a name."), Escape/cancel restoring the previous title, focus return to the trigger, notes trim (`'  x  '` → `x`), notes HTML escaping, Ctrl/Cmd+Enter, `document.fonts.ready` before `document.fonts.check`. | Add those sentences to AC1/AC2/AC4 and cover them in the frozen cases (§3.3: 09a–09g, 26). |
| F14 | R5/R7 | Non-blocking | Regeneration cost and partial-write behaviour of ~1,368 PNGs are unstated: icons are written in place with stale cleanup at the end (`scripts/mc-icons.py:1017-1020`), so a crash or timeout mid-run leaves a mixed directory, and the plan gives no runtime/disk expectation. | State expected runtime and `total_bytes`, and either write to a temp directory and swap, or document that a failed run must be rerun and verified by count + sha256 before the stamp. |
| F16 | R4/R7 | Non-blocking | The UI suite hardcodes `EVIDENCE = reports/qa/evidence/edict-0009` (`tests/qa/ui.e2e.test.mjs:20`), so the edict-0013 screenshot evidence cannot come from the suite as-is (EDICT-0011 `E1` accepted the same refresh). | 测试部 parameterises the evidence directory for the edict-0013 run (own scope) and the S5 report says explicitly which files it refreshed; or the captures are taken by the capture step from F7/F5. |
| P1 | process | Note | Build work began before the audit verdict: `git status` shows `scripts/mc-icons.py` +364 lines (mtime 17:03:30) and `tests/unit/tracker-model.test.mjs` +66 lines (17:03:14), while `ledger.jsonl` has no EDICT-0013 entry and task-3/task-4 are still `blocked_by task-2`; §2 states "Nothing is executed before the audit verdict". | Lead confirms whether this was an authorised head start and records the actual order honestly in the ledger. The cases below are frozen against the F1 contract, not against ids the in-flight build happens to pick; if the build chose different hooks, the F1 contract wins or the audit re-opens. |

### 3.3 Frozen case list (`S2` freeze — executed at `S5`, authored by 测试部)

The names recorded in this section are the pre-amendment draft's; the shipped suites are listed in
§3.3a and supersede them. F1's first-draft hook names (`#mat-choose`, `#icon-refine-hint`,
`#mat-chip`, `aria-label "Rename build"`, and the `uniform` lighting word in F3) are superseded by
the frozen DOM contract reproduced in §2 and the `block` / `flat` / `3d-other` enum.

Frozen at this audit; 兵部/工部 do not edit `tests/qa/**`. "Updated" means an existing case is changed only as listed in F10b; assertions are never deleted or weakened.

- `tests/qa/ui.e2e.test.mjs` — updated: 09 (split into 09a–09g), 12 (12a–12c), 14 (14a–14e), 23, 26, 27, 30, 31, 32; kept: 01–08, 10, 11, 13, 15–22, 24, 25, 28, 29, 33–36; new: 37 (dropdown theming), 38 (backdrop blur). Case names: `09a title rename via pencil (reveal→save→persist)`; `09b title rename rejects blank and Escape restores`; `09c coords copy writes, toasts, disabled while empty`; `09d coords copy fallback when navigator.clipboard is absent`; `09e notes view mode (text, no textarea, muted empty)`; `09f notes edit (save/persist/trim/Ctrl+Enter/Escape)`; `09g notes text is escaped`; `12a add material via Choose item (picker→name→row icon)`; `12b add material without a selection shows the inline error`; `12c duplicate merge still sums (regression)`; `14a steppers +1/+10/+stack and -1/-10/-stack move the value`; `14b ±stack use the material's stack size (stone 64, egg 16, water bucket 1)`; `14c steppers clamp at 1 and persist through reload`; `14d Needed stays type=number (spinner claim only if the F2 probe passes)`; `14e builds view at 390 has no stepper overflow`; `23 a11y (no picker tablist, every control labelled)`; `26 visual contract (Minecraft face loaded, family starts with Minecraft, Pixelify retained as fallback)`; `27 picker full-catalog search (render cap + refine hint + oak_log)`; `30 picker footer Upload image crops and persists`; `31 non-image upload refused`; `32 picker search and Escape focus return`; `37 dropdown ::picker(select) theme (base-select supported)`; `38 backdrop CSS blur ≤1px / ≤1.5px mobile`; `36 no console errors` kept last.
- `tests/qa/mc_ui_audit.py` — updated: `a11y/tablist` (3 section tabs, 0 picker tabs), `html/local-font` (`@font-face 'Minecraft'` + `assets/fonts/Minecraft.ttf`, Pixelify retained), `identity/css-*` (drop `.picker-tab`); new: `font/fallback-chain`, `picker/no-tabs`, `picker/footer-upload`, `picker/refine-hint`, `steppers/attributes`, `steppers/spinner-rules`, `notes/view-structure`, `title/rename-control`, `coords/copy-control`, `material/choose-control`, `dropdown/supports-block`, `dropdown/picker-theme`, `dropdown/picker-icon-hidden`, `catalog/count`, `catalog/stacks`, `catalog/variant-slugs`, `catalog/curated-first`, `contrast/picker-panel`; unchanged: every contrast pair, offline/no-inline-handler/button-type/square/breakpoint check.
- `tests/qa/tracker-icon-resolution.acceptance.test.mjs` — updated: AC-R1 (count ≥ 1,363 + accounting), AC-R2 (per-icon `slug`/`name`/`kind`/`image`/`pixels`/`sha256`; `source` may be a variant filename for the 5 representatives), AC-R3 (slug→name object + `MC_ICON_STACKS`), AC-R6 (new catalog/stack/lighting provenance lines); new: AC-R8 (stack samples per F15), AC-R9 (catalog samples: `diamond_sword`, `glass`, `oak_log`, `red_concrete`); unchanged: AC-R4 (PNG-per-icon + sha256), AC-R5, AC-R7.
- `tests/qa/tracker-icons.acceptance.test.mjs` — updated: AC-I3 (drop `icon-tab-*`/`icon-pane-*`; add `#icon-upload`, `#icon-count-hint`, `#mat-choice`), AC-I5 (drop `.picker-tab`); unchanged: AC-I1, AC-I2, AC-I4, AC-I6, AC-I7, AC-I8.
- `tests/qa/tracker.acceptance.test.mjs` — updated: AC-10 (count/kind/lighting/stack, keep sha256 + no-game-pixels + one-PNG-per-icon), AC-11 (labelling of the new hidden input/buttons), AC-12 (cached ids), AC-13 (`class="picker-tab"` → 0); unchanged: AC-1–AC-9, AC-14–AC-16.
- `tests/qa/edict-0013-assets.acceptance.test.mjs` — new file, static asset contract: `AC-A1 panorama manifest` (`compose.blur_radius === 2.5`, 2560×640, brightness 0.95, saturation 0.92, regenerated provenance); `AC-A2 backdrop.webp` (valid WebP 2560×640, sha256 matches the manifest when present); `AC-A3 CSS backdrop blur` (desktop ≤1px, mobile ≤1.5px, rule-level parse); `AC-A4 font asset` (TTF sha256 + `Minecraft-LICENCE.md` ships — F6); `AC-A5 stamp freshness` (every rendered asset older than `app-qa.json verified_at` — F8); `AC-A6 manifest accounting` (`count == icons.length == MC_ICON_SET.length`, `curated == 53`, `renders`/`collapsed_variants` reconcile, `stack_groups` sums to `count`).
- `tests/qa/ui/harness.mjs` — unchanged (no new capability needed; pseudo-element reads go through `Runtime.evaluate`).
- Evidence (not cases): `reports/qa/edict-0013-qa.md` + `reports/qa/evidence/edict-0013/` (before/after from F7/F5 captures; 1280×900 and 390×844 for builds, materials, picker, add-material, dropdown, notes view/edit; Pillow analyses of blur-adjacent contrast and the spinner region).

### 3.3a Shipped case list (post-amendment, supersedes the names in §3.3)

The actual frozen suite, verified on disk at the delta audit. Ids are §2's contract ids.

- `tests/qa/ui.e2e.test.mjs` — **49 cases**, evidence dir `reports/qa/evidence/edict-0013/`,
  Lead-run Chrome: 01 empty state; 02 blank build name refused then created; 03 demo seed;
  04 section-tab ARIA + ArrowRight/Enter roving; 05 world dialog create (edition/version);
  06 world edit; 07 world delete guarded; 08 build dialog create (status/coords);
  09 rename from the section head (D2: no Name row, pencil left of Delete, heading hidden,
  save persists reload); 10 status buttons; 11 build delete confirm + empty panel;
  12 add material merges duplicates case-insensitively (D8); 13 unknown item lettered slot;
  14 inline needed/got edits drive pct/bar/summary; 15 remove material + empty state;
  16 shopping-list aggregation; 17 filters; 18 copy-list stub; 19 dated JSON export;
  20 import valid/malformed/foreign; 21 persistence + `?tab=`; 22 a11y invariants;
  23 skip link first in the tab order; 24 390px reflow + screenshot; 25 visual contract
  (panel `rgb(198, 198, 198)`, radius 0, family starts `Minecraft`,
  `document.fonts.check('16px Minecraft')`); 26 panorama + reduced motion; 27 missing-texture
  letter; 28 no picker tabs / one dialog (D7); 29 footer upload → 128px icon persisted (D7);
  30 non-image refused inline; 31 full-catalog search, 150 cap + count hint + lazy (D6);
  32 Escape clears the query then closes and refocuses; 33 title Enter saves / Escape cancels;
  34 blank rename refused, editor stays open; 35 notes view/edit (D4); 36 notes line breaks
  persist reload; 37 "No notes yet." empty state; 38 coords copy + disabled while empty (D3);
  39 six steppers per row (D5); 40 +1/+10/+stack climb; 41 clamp at 1; 42 per-item stack
  (egg +16, water bucket +1); 43 `type=number` + spinner CSS (pseudo assertion only if
  readable); 44 material chooser pick-item mode (D8); 45 chip + icon row; 46 no-selection
  inline error; 47 `CSS.supports('appearance','base-select')` + computed appearance (D9);
  48 CSS blur ≤1px + 2560×640 decode (D10); 49 no console errors.
- `tests/qa/mc_ui_audit.py` — **138 checks** in five groups (contrast, icons, structure,
  identity, edict0013): a11y/tablist 3 section tabs / 0 picker tabs, `html/local-font`
  (`@font-face 'Minecraft'` + `assets/fonts/Minecraft.ttf`, Pixelify retained), identity css
  drops `.picker-tab`; new `icons/count` ≥1363 + accounting + curated-first + lighting enum /
  summary / split (`hopper` flat), `icons/stack-table` (frozen samples incl `slime_ball` 64),
  `picker/*` (no tabs, footer upload, refine hint), `steppers/*`, `notes/*`, `title/*`,
  `coords/*`, `material/choose`, `dropdown/*` (`@supports`, `::picker(select)` theme, hidden
  picker icon), `font/page-vs-cmap` + raw seal, `panorama/*` (blur, composition, CSS, generator),
  `picker/probe-artifact`.
- `tests/qa/tracker-icon-resolution.acceptance.test.mjs` — AC-R1…AC-R7 (7 cases): pipeline +
  accounting (`renders - count === collapsed_variants`), per-icon render of its own slug
  (`source` may be a variant filename for the 5 representatives), `MC_ICON_SET` length equals
  `manifest.count` and **`MC_ICON_NAMES` is the canonical slug→name object** agreeing with the
  manifest names (AC-R3), 256px PNG sha256, image-rendering, provenance/gitignore, retired
  16×16 path.
- `tests/qa/tracker-icons.acceptance.test.mjs` — AC-I1…AC-I8 unchanged (8 cases): identity
  API/caps, seeded slugs in the manifest, picker/upload/avatar markup, avatar + upload +
  backdrop probe, visual contract, no game pixels, extractor contract, README.
- `tests/qa/tracker.acceptance.test.mjs` — AC-1…AC-17 (17 cases): AC-10 expanded catalog
  (≥1363, accounting, lighting enum, stack lookup, provenance, gitignore, variant `source`),
  AC-11 labels/no inline handlers, AC-12 cached ids all exist, AC-13 single h1/tabs/skip link,
  AC-14 no radius/no blur/local bitmap font, AC-17 EDICT-0013 controls under the frozen names;
  the rest unchanged.
- `tests/qa/edict-0013-assets.acceptance.test.mjs` — new file, 11 cases AC-A1…AC-A11: font
  bytes + sealed raw sha256, `--font-pixel` Minecraft-first with the Pixelify face retained,
  panorama `blur_radius` = 2.5, WebP sha256/bytes/geometry, CSS blur ≤1px desktop /
  ≤1.5px mobile, catalog accounting + 1363 floor, frozen stack samples (incl `slime_ball` 64)
  + curated-first, lighting classes + `hopper` flat disclosed, `MC_ICON_NAMES` object agreement,
  stamp newer than every rendered asset (F8), before/after evidence present.
- `tests/qa/ui/harness.mjs` — unchanged.
- Evidence (not cases): `reports/qa/edict-0013-qa.md` + `reports/qa/evidence/edict-0013/`
  (Lead captures at 1280×900 and 390×844; Pillow analyses).

### 3.4 Verdict

**`BLOCK`** — F1–F8 and F15 must be folded into the edict (or resolved by the Lead) before `S3`. F9–F14 and F16 are corrections/conditions to carry into the build; P1 needs the Lead's confirmation. The frozen case list in §3.3 is the `Q3`/`G4` freeze: it was written before the build's app-side DOM exists, so the F1 contract — not the in-flight implementation — is what the suite will assert.
**Delta re-audit:** the amendment closed F1–F8 and F15 and the review gate items; see §3.5.

### 3.5 Delta verdict — amendment re-audit (测试部, 2026-10-25)

The amendment was audited delta-only: §1 (14–114), §2 (112–433, including the frozen contract
reproduced at 341–433), §4 (505–527) and §5 (529–619). The F1–F16 rows above stand as the record
of the draft they were written against; this section closes them against the amendment.

**(a) Contract fidelity — PASS.** §2 reproduces `.tmp/plan/contract.md` for §1–§7 (341–408) and
the corrected §8 (409–433): `MC_ICON_NAMES` is an **object keyed by slug** (411–414), `hopper` is
`flat` (jar `item/generated`; 426–429), lighting is block 407 / flat 620 / 3d-other 341 = 1368,
floor 1363, `collapsed_variants` 241, 110 `maxp.numGlyphs` vs 107 `cmap` (430–432). Where §1, §2
and §5 name an id they now agree with the contract; F1's first-draft names survive only inside
F1's own cell and are superseded by §3.3a.

**(b) Gate items — R2, R3, R4, R5, R6, R7, R10 now PASS.** R2: 兵部's scope includes
`src/tracker/model.js` and `tests/unit/**` (124–125). R3: AC5 splits browser / audit / probe-gated
computed style (57–64); AC9 makes a vacuous pass impossible (93–99); AC6 freezes floor 1363, the
lighting enum and the hopper correction (68–79); AC11 names `tests/qa/mc_ui_audit.py` (110).
R4: F7/F8/F16 are ordered — before-copies in `.tmp/before-edict-0013/`, assets before the stamp,
evidence dir `reports/qa/evidence/edict-0013/` (106, 326–329, 508–511, 525). R5: the font licence
is a sealed raw source `2026-10-25-minecraft-font-licence.md` (sha256 `2e06df49…f5eba7`, seal 7→8)
with `Minecraft-LICENCE.md` beside the TTF (139–148, 575–582); the five `flat_pixel_mismatches`
are disclosed (256–258). R6: the bundled interpreter 3.12.14 + Pillow 12.3.0 is named (515) and
Chrome 155.0.8059.86 is pinned (301); the probe is a build-time artefact (405–407); Lead-runs-Chrome
is written as a process fact, not a hidden assumption (7–8, 508–511). R7: no partial enactment —
temporary swap or rerun verified by count + sha256, and a red suite writes no stamp (237–238,
513–527). R10: AC11 + §4 + F8's case force every rendered asset to predate the stamp, and
`node scripts/app-qa.mjs run` is the Lead's step before `node src/wiki/cli.mjs app-qa` (109–114,
525). R1, R8 and R9 remain PASS (item 6 is the EDICT-0011 R1 decision; §5 names every page, the
font raw source and the two closed open questions).

**(c) Remaining conditions (S5, not blockers to S3).** (i) 测试部's own prose corrections are
applied in this revision: the 110-vs-107 wording in §3.1 and the shipped case list in §3.3a.
(ii) `reports/qa/evidence/edict-0013/picker-probe.json` does not exist yet —
`picker/probe-artifact` fails until the Lead's S5 capture, and AC9 stays conditional on it.
(iii) `edict-0013-assets` AC-A10 and `app-qa.acceptance` AC-Q7 are red by design until the final
`node scripts/app-qa.mjs run` after all assets land; no stamp may predate them. (iv) The 49
browser cases are frozen but unexecuted in this seat (F5): the Lead runs them at S5 and hands over
logs and captures for analysis.

**Verdict: `PASS` (delta)** — the amendment folds F1–F8 and F15; the §3.4 `BLOCK` is lifted for
`S3` dispatch. The remaining reds are S5 artefacts and must clear before `S6`. No new blocking
finding.

### 3.5a S5 case corrections (post-freeze, before judgment)

The cases in §3.3a were frozen at `S3` (`Q3`/`G4`). The first `S5` browser run (Lead seat, headed
Chrome 155) returned **39/49 green**; 10 reds were attributed to **6 mis-specified cases** (corrected
here, `tests/qa/ui.e2e.test.mjs` only, app untouched) and **4 app defects** (兵部). These are
recorded as process findings, not silently applied: each corrected assertion was wrong about the
*browser or the DOM shape*, never a weaker version of an acceptance criterion, and each correction
was verified in headed Chrome by the Lead before landing.

| Case | Wrong assertion | Correction | Why it was wrong |
|------|-----------------|------------|------------------|
| 14 | `#build-pct` hard-coded to `100%` / `25%` after editing one row | compute the whole-build expectation from the rendered rows (`buildTotals()`) and compare | `#build-pct` is build-wide; Iron Farm (spawn) seeds 4 materials, so completing one row cannot reach 100% |
| 17 | counted `#world-material-body .mat-row` right after the tab switch and treated that as "everything" | pin the product default (`#mat-filter` = `remaining`, "Still needed"), then set `all` explicitly and take that count as the baseline; later reads are re-taken per assertion | the default filter is "Still needed" (6 rows), not "Everything" (8 rows: `Coal`, `Glass` were hidden), so the restore assertion compared 8 against 6 — the case depended on the product default instead of pinning it |
| 27 | queried the first `#icon-grid .icon-tile` (the None tile has no `<img>`) | scope to `.icon-tile[data-icon-slug]` | D7 keeps a None tile first in icon mode |
| 42 / 45 | picker helper matched the first name *containing* `egg` → "Allay Spawn Egg" | match the exact display name, or the frozen slug (`egg`, `water_bucket`) | substring matching picked the wrong item; spawn eggs stack 64 and the row is named "Allay Spawn Egg" |
| 43 | asserted computed `getComputedStyle(input,'::-webkit-inner-spin-button').appearance === 'none'` | keep the three stylesheet-rule proofs; document the pseudo check as unassertable | Chromium 155 reports `textfield` for that pseudo even when the rule hides the spinner (F2's problem, now proven) |
| 29 | read `state.activeBuildId` from persisted state | fall back to the world's first build (as case 10 does) | `activeBuildId` is not a model key by design (selection lives in the session UI state) |

Case 17 needed a **second** correction after the first corrected runs (48/49): the rewrite still
treated the first rendered row set as "everything", but the product's default materials filter is
**"Still needed"** (`src/index.html`, `#mat-filter` = `remaining`), so the fresh list holds the 6
rows with work left while the "Everything" filter holds all 8. The case now pins the default as a
behaviour assertion, switches to `all` explicitly for its baseline, and re-reads the count at each
assertion instead of reusing the first number.


## 4. Planned verification

Planned checks only — no result exists before the build. All commands run from the repo root.
**Execution split:** 测试部 authors the frozen cases; the Lead runs every Chrome launch at `S5`
(“browser hands, not verifier”) and hands over logs and captures; 测试部 analyses the artefacts
and judges. The verifier seat's approval prompts are disabled and it cannot start headless Chrome
(F5), so no browser command belongs to it.

| Check | Command / evidence | Planned result |
|-------|--------------------|----------------|
| Environment | `node --version`; bundled `python.exe --version`; `python -c "import PIL"`; Chrome version | Node v22.14.0; bundled Python 3.12.14 with Pillow 12.3.0 at `C:\Users\KZ\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`; Chrome 155.0.8059.86 pinned. PATH `python`/`py` (3.13.3, no Pillow) is not used. |
| Model units | `node tests/unit/tracker-model.test.mjs` | Green; model API untouched; the test-first cases added at 17:03 under the Lead's authorisation (P1). |
| Icon units | `node tests/unit/tracker-icons.test.mjs` | Green with expanded fixtures; stack lookup, variant collapse and lighting cases. |
| Acceptance | `node tests/qa/tracker.acceptance.test.mjs`; `tracker-icons.acceptance.test.mjs`; `tracker-icon-resolution.acceptance.test.mjs`; new `edict-0013-assets.acceptance.test.mjs` | Green; font/rename/coords/notes/steppers/selector/dropdown, catalog accounting and the asset contract (panorama, backdrop, CSS blur, font + licence, stamp freshness). |
| UI audit | `<bundled python> tests/qa/mc_ui_audit.py` | Updated to the new controls and green; spinner rules and the a11y/tablist assertions follow the frozen case list. |
| Browser flows | `node scripts/app-qa.mjs run` — **Lead only**, `danger-full-access` | 49 flows green including rename, coords copy, notes, steppers, picker, selector and dropdown; restamps `docs/governance/app-qa.json`; captures in `reports/qa/evidence/edict-0013/`. |
| Catalog | Inspect `icons.js` + `manifest.json`; `node tests/qa/edict-0013-assets.acceptance.test.mjs` | `count >= 1363`, `count === MC_ICON_SET.length`, curated 53 first, no brace/quote slugs, every entry has name/stack/sha256/lighting, `PROVENANCE.md` updated. |
| Brightness | Probe over the classified icons; sanity capture | `anvil` and `chest` classify `3d-other` and are lit beside `stone`; `hopper` is `flat` (jar-verified, disclosed); the 341-name `3d-other` list and the five `flat_pixel_mismatches` are disclosed. |
| Dropdown theme | `Runtime.evaluate` probe: version, `CSS.supports`, `getComputedStyle(::picker(select))`; screenshot | `rgb(111, 111, 111)` face, `rgb(0, 0, 0)` top border, Minecraft family; unsupported browsers keep the native popup; a vacuous pass is impossible. |
| Backdrop | Manifest `blur_radius`; computed filter; 2,560×640 bake; before/after | `blur_radius` 2.5 (was 8; `--blur` 0–3), CSS ≤ 1 px (mobile ≤ 1.5 px), 2,560×640, 45,664 B, sha256 `249a…5978`, faces 4 / crossfade 64 unchanged; `.tmp/before-edict-0013/` SHA-256 recorded before the bake; the EDICT-0012 before capture retained; provenance and manifest regenerated. |
| Stamp freshness | `node src/wiki/cli.mjs app-qa`; mtimes of rendered assets vs `verified_at` | All three new asset hashes (font TTF, panorama WebP, panorama manifest) and the changed app hashes predate the stamp; `APP_SOURCE_FILES` (`src/wiki/lib.mjs:456`) extended by those three. |
| Wiki contract | `node src/wiki/cli.mjs index --check && node src/wiki/cli.mjs lint && node src/wiki/cli.mjs sync` | Clean; the log entry cites EDICT-0013; `app-qa` reports verified. |
| Bounded diff | `git status`, `git diff --stat`; `raw/manifest.json` unchanged | Only scoped files change; raw stays sealed; no generated PNGs added to the index. |

### 4.1 Verification record (`S5Q`, 测试部, 2026-10-25)

Filled after execution: the rows below are the actual results behind the `S5Q` verdict, with the
evidence link required by `G3`. Cases were frozen at `S3` (`G4`); the six corrections made after
the freeze are recorded in §3.5a. Browser execution is the Lead seat's (`F5`, "browser hands, not
verifier") — disclosed, not hidden. **Verdict: `QA_PASS, cycle 1`.**

| Check | Actual result | Evidence |
|-------|---------------|----------|
| Environment | Node v22.14.0; bundled Python 3.12.14 + Pillow 12.3.0; Chrome 155.0.8059.86 (headed for the `::picker(select)` probe) | `reports/qa/evidence/edict-0013/picker-probe.json`, `font-probe.txt` |
| Model units | green; 22/22 in `tracker-model.test.mjs` (60/60 with the other five unit files) | run log 2026-10-25 |
| Icon units | green; 9/9 (`tracker-icons.test.mjs`) | run log |
| Acceptance | 71/71 in seven files: tracker 17, tracker-icons 8, tracker-icon-resolution 7, wiki 13, wiki-sync 8, app-qa 7, `edict-0013-assets` 11 | run log |
| UI audit | **138/138**, exit 0 (contrast, icons, structure, identity, edict0013) | bundled Python run |
| Browser flows | **49/49**, exit 0, 40.9 s; stamp `app-qa: verified — 2026-10-25T10:02:35.160Z (49 UI cases)`; suite captures in `reports/qa/evidence/edict-0013/` | `docs/governance/app-qa.json`; `node scripts/app-qa.mjs status` → verified |
| Catalog | 1,368 icons / 1,609 renders / 241 collapsed; curated 53 first; `MC_ICON_NAMES` an object keyed by slug; lighting 407 block / 620 flat / 341 3d-other | audit `icons/*`; assets AC-A1–A9 |
| Brightness | `anvil`/`chest` classify `3d-other` and are lit beside `stone`; `hopper` is `flat` (jar-verified) and disclosed; five `flat_pixel_mismatches` copied byte-for-byte and disclosed | audit `icons/lighting-*`; `icons.js` manifest |
| Dropdown theme | probe: `base-select` supported on Chrome 155, `::picker(select)` panel `rgb(111, 111, 111)`, border `2px solid rgb(0, 0, 0)`, Minecraft family; the closed control is visible in `01`; the open popup is an OS-level window, so no screenshot of it exists (Lead's controlled finding) | `picker-probe.json`; case 47; audit `picker/*` |
| Backdrop | bake 8 → **2.5** (0–3 guard, floor removed); CSS `blur(1px)` (390: `1.5px`); `backdrop.webp` **45,664 B** sha256 `249a1598…5978`, 2,560×640; before archived (`.tmp/before-edict-0013/`, sha recorded); screenshot strip edge-variance **1,132.6 → 1,379.9**; generator preview 8 vs 2.5 unambiguous | `blur-probe.txt`; `10b-backdrop-generator-preview.png`; `reports/qa/evidence/edict-0012/01-builds-view-corrected.png`; `11` (1280×900), `48` (390-wide) |
| Stamp freshness | verified; stamp covers `src/index.html`, `styles.css`, `app.js`, `tracker/model.js`, `icons.js`, `Minecraft.ttf`, `backdrop.webp` and panorama `manifest.json` (8 files); no `src/` drift since | `node src/wiki/cli.mjs app-qa` → verified |
| Wiki contract | `index --check` clean; `lint` clean (22 pages, 0 errors, 0 warnings); `sync` 5/5 (EDICT-0013 is not `S6`, so its ingest entry is still to come) | CLI runs |
| Bounded diff | 22 tracked files modified + 7 new, all inside the declared scopes; `raw/manifest.json` sealed 7 → 8 with the font-licence source; no generated PNGs added to the index | `git status`; `git diff --stat` |

Evidence-integrity note (recorded, non-blocking): the crate has **22 PNGs with 22 distinct
SHA-256 hashes — no duplicates**. Two labels were corrected against the pixels before judgment:
`07-dropdown-open-1280x900.png` shows the builds view scrolled below the topbar (neither an open
popup nor the closed control is in frame — AC9's closed-control screenshot is `01`), and
`10-backdrop-before.png` is statistically identical to `11` (it is the current build, not the old
blur — the genuine pre-change capture AC10 names is `reports/qa/evidence/edict-0012/01-builds-view-corrected.png`).
`reports/qa/evidence/edict-0013/README.md` carries the corrected descriptions.

## 5. R9 wiki impact

Every wiki page and design-system document this edict creates or updates. No new wiki page is
planned; the two open questions that EDICT-0011 deferred are closed or rewritten in place.

- [`wiki/entities/minecraft-build-tracker.md`](../wiki/entities/minecraft-build-tracker.md) —
  font face (Minecraft primary, Pixelify Sans fallback, 110 glyphs by page/`maxp.numGlyphs` and
  107 `cmap` codepoints, U+20AC euro present, no accented letters, arrows/em-en dash/ellipsis/
  ×/·/≥/≤ absent, licence file, raw slug `2026-10-25-minecraft-font-licence`, seal 7 → 8), the
  detail-panel controls (rename, coords copy, notes view/edit), the steppers and stack table
  (default 64; 16: egg, snowball, `ender_pearl`, `honey_bottle`, `armor_stand`, empty bucket,
  signs, banners; 1: filled buckets, tools, armour, elytra, potions, boats, minecarts, shulker
  boxes, beds, cakes/stews, books, maps, banner patterns, discs; `slime_ball` 64) and frozen
  samples (including the F15 fix: `bucket` 16, `water_bucket` 1), catalog size (1,368 icons,
  81 KB `icons.js`, 434 KB `manifest.json`; `MC_ICON_NAMES` an object keyed by slug; 246 variant
  renders → 5 representatives, `collapsed_variants` 241), base-item granularity, lighting
  classification (block 407 / flat 620 / 3d-other 341, `hopper` flat, five
  `flat_pixel_mismatches`), single-dialog picker, themed dropdowns and the new backdrop numbers
  (blur 2.5, 45,664 B, sha256 `249a…5978`); update Verification and Tensions.
- [`wiki/concepts/in-game-gui-design.md`](../wiki/concepts/in-game-gui-design.md) — typography
  rule (bitmap face primary; Pixelify fallback for the missing glyphs; 110 glyphs vs 107 `cmap`
  codepoints, euro present, no accented letters; why the licence is recorded), native-control
  theming via `::picker(select)` as a load-bearing detail, the frozen control contract as the
  implementation of the GUI pattern, and the backdrop treatment values.
- [`wiki/synthesis/atmosphere-and-identity.md`](../wiki/synthesis/atmosphere-and-identity.md) —
  “convert taste into measurable properties” gains the new numbers (bake blur 8 → 2.5 via `--blur`
  with a 0–3 guard and the floor removed, CSS 2 → 1, scrim 0.12 → ~0.2; faces 4 / crossfade 64 /
  2,560×640 / brightness 0.95 / saturation 0.92 unchanged; `backdrop.webp` 15,280 → 45,664 B,
  sha256 `249a1598a120a142aebe73d5a54c7fd612e1d11a82298a3dcfa5734063635978`; side-by-side
  `.tmp/panorama-before-after.png`); the physical-display caveat stays.
- [`wiki/synthesis/vanilla-assets-without-redistribution.md`](../wiki/synthesis/vanilla-assets-without-redistribution.md)
  — coverage moves from 53 curated icons to 1,368 addressable base items (1,609 item renders:
  1,363 plain renders + 246 variant renders → 5 representatives; `collapsed_variants` 241),
  81 KB `icons.js` and 434 KB `manifest.json`, no new pixels committed, manifest and provenance
  growth, and the lighting classification: block 407 / flat 620 / 3d-other 341 (`hopper` flat,
  jar-verified), with the five `flat_pixel_mismatches` (`enchanted_book`,
  `enchanted_golden_apple`, `end_crystal`, `experience_bottle`, `nether_star` — copied
  byte-for-byte, no correction) disclosed; the “separate product decision” sentence is
  superseded.
- [`wiki/synthesis/testing-a-ui-like-a-user.md`](../wiki/synthesis/testing-a-ui-like-a-user.md) —
  new browser flows, the Lead-runs-Chrome split as a QA-independence fact, and the
  computed-style workaround for native popups; evidence counts.
- [`wiki/synthesis/open-questions.md`](../wiki/synthesis/open-questions.md) — **close** “Tracker:
  icon coverage” (decision: whole export at base-item granularity, 1,368 addressable; 246 variant
  renders → 5 representatives, `collapsed_variants` 241; stack sizes from the exception table with
  default 64, including `slime_ball` 64; lighting block 407 / flat 620 / 3d-other 341 with
  `hopper` flat; licence sealed; residual risk is the stack table's completeness, the
  `flat_pixel_mismatches` and the `3d-other` set, not coverage); **rewrite** “Menu atmosphere
  is taste” to record the emperor's direction on blur/scrim while keeping the physical-display
  comparison open; **add** the new durable question that themed dropdowns exist only where
  `appearance: base-select` is supported, and one for any `3d-other` icons whose lighting remains
  a judgement call.
- [`wiki/overview.md`](../wiki/overview.md) — touch only if the standing synthesis is read as
  naming typography or coverage; check at ingest.
- [`wiki/index.md`](../wiki/index.md) — regenerate with `node src/wiki/cli.mjs index --write`;
  never hand-edit.
- [`wiki/log.md`](../wiki/log.md) — append a dated `ingest` entry citing EDICT-0013 and naming
  every page above, so `edict-sync` passes.
- [`design-system/minecraft-tracker/MASTER.md`](../design-system/minecraft-tracker/MASTER.md) —
  typography face, licence file and glyph coverage (110 glyphs by page/`maxp.numGlyphs`, 107
  `cmap` codepoints, U+20AC euro present, no accented letters, arrows/em-en dash/ellipsis/×/·/
  ≥/≤ absent), Pixelify fallback; icon-picker spec
  (one dialog, footer upload, pick-item mode, `.icon-tile`); new components: icon button, frozen
  `mat-step` grid, notes view/edit, `#mat-choice` chip, themed select with frozen computed
  values; backdrop values (bake blur 2.5, CSS ≤ 1 px desktop / ≤ 1.5 px mobile, scrim ~0.2,
  45,664 B, sha256 `249a…5978`, faces 4 / crossfade 64); stack table (16/1 categories, default 64,
  `slime_ball` 64); lighting enum with `hopper` flat and the five `flat_pixel_mismatches`;
  checklist counts.
- [`design-system/minecraft-tracker/pages/tracker.md`](../design-system/minecraft-tracker/pages/tracker.md)
  — page anatomy and interaction for title rename, coords copy, notes toggle, steppers,
  add-material selector, single picker and dropdown theme; the frozen DOM contract as the
  component-level source of truth; amend AC-8 (font), AC-10 (backdrop) and AC-11 (icon set);
  refresh known gaps.
- `README.md` (not wiki; 礼部) — font line and licence, icon count, interaction description,
  check counts.

Raw sources: no raw source is required by precedent for the report itself — the state-machine
sanitisation keeps the verbatim wording in §1. The font licence is the one unsealed claim and it
is now committed: 太子's sealed `raw/sources/2026-10-25-minecraft-font-licence.md` (SHA-256
`2e06df49…f5eba7`; seal 7 → 8 entries) holds the DaFont listing and the TTF hash, and records the
glyph truth (page and `maxp.numGlyphs` 110; `cmap` 107 codepoints; U+20AC euro present; no
accented letters; arrows, em/en dash, ellipsis, ×, ·, ≥, ≤ absent). 工部 ships
`src/assets/fonts/Minecraft-LICENCE.md` beside the TTF; 礼部 records the raw slug, the seal and
those numbers in `PROVENANCE.md` and the design system. 礼部 does not write `raw/**`.

## 6. Limits

- Themed dropdowns only exist where `appearance: base-select` is supported (pinned to Chromium
  155.0.8059.86); every other browser keeps the native popup. That is the price of not rewriting
  selects in JavaScript, and the probe makes the supported case honest.
- The catalog covers the local export only: 1,614 PNGs, of which 1,609 are item renders — 1,363
  plain renders plus 5 representatives, 1,368 addressable (246 variant renders → 5
  representatives; `collapsed_variants` 241). The other 241 variant renders are collapsed, not
  selectable: a user who wants a specific potion or painting variant cannot pick it. Items the
  export lacks — and any item added to the game after the export — stay lettered. `MC_ICON_NAMES`
  is emitted as an object keyed by slug; the app tolerates the legacy array only as a
  compatibility path, so a stale emitter would not fail fast — the manifest and count check are
  the guard.
- Stack sizes are curated product data, not derivable from the PNG export. The exception table's
  completeness is the limit, and a wrong default-64 is a plausibility bug, not a crash: 16-stack
  covers egg, snowball, `ender_pearl`, `honey_bottle`, `armor_stand`, empty buckets, signs and
  banners; 1-stack covers filled buckets, tools, armour, elytra, potions, boats, minecarts,
  shulker boxes, beds, cakes/stews, books, maps, banner patterns and discs; everything else
  defaults to 64, `slime_ball` included. The frozen eight samples are the audit's spot check, not
  proof of the whole table.
- Lighting is classified from the jar model chain into exactly `block` / `flat` / `3d-other`
  (no `none`); the measured split is 407 / 620 / 341 of 1,368, with the 341-name `3d-other` list
  disclosed. Anything the classifier cannot resolve ships as `3d-other` and is listed, not
  silently given the flat-item or the block gain. `anvil` and `chest` are `3d-other`; `hopper` is
  `flat` (jar-verified, `models/item/hopper.json` parent `item/generated`). Five flat sprites —
  `enchanted_book`, `enchanted_golden_apple`, `end_crystal`, `experience_bottle`, `nether_star` —
  are byte-for-byte copies with no lighting correction and are disclosed as
  `flat_pixel_mismatches` rather than rewritten.
- `Minecraft.ttf` is untracked and has no in-tree licence text today. The font is primary only
  because 太子 sealed `raw/sources/2026-10-25-minecraft-font-licence.md` and 工部 ships
  `src/assets/fonts/Minecraft-LICENCE.md` before the TTF is committed; if either is missing, the
  font work waits rather than shipping an unsealed asset. The glyph count is 110 by the page and
  `maxp.numGlyphs` but 107 by `cmap`: ASCII is complete, euro U+20AC is present, no accented
  letters exist, and arrows, em/en dash, ellipsis, ×, ·, ≥, ≤ are absent (Pixelify covers them).
- Blur, scrim and the small-caps look are taste verified against screenshots and the emperor's
  direction, not against a physical display — the open question keeps that gap. The bake is 2.5
  (`--blur` under a 0–3 guard), `backdrop.webp` is 45,664 B with sha256
  `249a1598a120a142aebe73d5a54c7fd612e1d11a82298a3dcfa5734063635978`, CSS is ≤ 1 px (mobile
  ≤ 1.5 px), and the scrim sits near 0.2.
- The app-qa stamp is verified today but goes stale the moment any hashed file changes. S6 waits
  for a fresh green browser suite, executed by the Lead (the only seat whose escalations are
  approved) and analysed by 测试部; the three asset hashes and the app hashes must predate it.
- No data migration: `localStorage` and the export/import schema are untouched.
- Process note (P1): reversible asset regeneration and 兵部's read-only recon plus test-first unit
  cases began at 17:03, before the `S2` verdict, under the Lead's authorisation. Nothing was
  enacted and no founder-visible state changed; the ledger records the actual order rather than
  pretending the build started after review.
- Accepted scope deviation: 工部 extended `src/wiki/lib.mjs` — `APP_SOURCE_FILES` (line 456) now
  lists the font TTF, panorama WebP and panorama manifest, and the `appHash` helper (line 474)
  consumes them — outside its declared scope. F8 requires those hashes, so the deviation is
  accepted and recorded here rather than reverted.
- Process note: the header uses the dispatch brief's `S1 DRAFTED`. The canonical state machine
  places a plan carrying R1–R10 at `S2 PLANNED`, audited at `S3 REVIEWED`; the label should be
  corrected in the ledger at dispatch.
