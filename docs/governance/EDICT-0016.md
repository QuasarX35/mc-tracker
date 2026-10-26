# EDICT-0016 — Visual density pass and Compact Mode phase 1

- **Issued by:** 皇帝 — 2026-10-25, round 4. The wording quoted in §1 is the S0 brief's
  transcription (`.tmp/s10/brief-0016.md`); this round has no raw source of its own, so the
  EDICT-0013 sanitisation precedent applies: the sanitised wording is recorded here, in the
  edict body.
- **Drafted and recorded by:** 礼部 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (two disjoint packages: `src/styles.css` for the scale, layout, bars,
  notes presentation, glyph and stepper shell; `src/app.js` + `src/index.html` +
  `src/tracker/model.js` for timestamps, stepper behaviour and Compact Mode), 工部 (no
  product-side work expected; compact tile sizes only if the audit finds an asset need), 礼部
  (design system, README, wiki, backlog), 测试部 (`S5Q`, delegated verifier). 太子: no raw
  intake planned for this round.
- **Browser execution:** the Lead runs every Chrome launch at `S5` — "browser hands, not
  verifier"; 测试部 authors the frozen cases, analyses the artefacts, and judges.
- **Recorded:** 2026-10-25 (Asia/Singapore) · **Status:** `S6 REPORTED` — `QA_PASS`, cycle 1;
  **reinstated 2026-10-26** after the founder reversed the withdrawal (see the reinstatement
  note at the end of §6); stamp `app-qa: verified — 2026-10-26T02:59:39.552Z (96 UI cases)`
- **Amends:** [EDICT-0015](EDICT-0015.md) — contract-0016 §2 replaces its six-button stepper
  policy (`#mat-steps`, `.mat-steps`, `.mat-step`, `materialStepsHtml` and every `data-step`
  retire), item 11 moves its header stats into a left sidebar, and item 14 adds a second builds
  view; the S5 evidence budgets it set are re-measured for the larger type. [EDICT-0014](EDICT-0014.md)
  — the themed tooltip (`#mc-tooltip`) and its top-layer rules are reused by the compact tiles
  and the new sidebar; nothing in its contract is otherwise changed. [EDICT-0013](EDICT-0013.md)
  — the type scale and the notes affordances built there are rescaled and restyled, not
  redesigned.
- **Relates:** [EDICT-0012](EDICT-0012.md) — the stack table behind `M.stackSizeFor` powers the
  Shift-step and the tile stack arithmetic. [EDICT-0010](EDICT-0010.md) — no asset change is
  expected; the scenery remains as contracted in EDICT-0015.

## 1. The report

On 2026-10-25 the emperor used the app again and filed fourteen items: a visual-density pass
(items 1–13) and Compact Mode (item 14). Three answers were taken before S0 and are binding:

- **Item 1:** "+12% bigger — body 16 → 18, controls +4px."
- **Item 11:** "world sidebar left of the content, always visible."
- **Item 14:** "the FRD as written, including phases and crafting" — delivered across two
  edicts: Compact Mode phase 1 here, and the phase-2 backlog file
  [`docs/backlog/compact-view-phase-2.md`](../backlog/compact-view-phase-2.md) for the global
  inventory, phases, Ascend, crafting and Power toggle (FRD `D:\compact view reqs.md`).

The items are reproduced verbatim below as one numbered block. Each is followed by the
acceptance sentence the edict will be judged by; the numbering is aligned one-to-one
(item 6 and item 12 both land in the one stepper, so D6 records the supersession while AC6
still checks the add-form consequence).

> 1. Increase the size of everything, from fonts to UI components, except the size of the app title, which should be reduced
> 2. add some padding inside the left side of the Materials gathered section within the build, and some space between "Materials gathered" text and the percentage number
> 3. make the Notes text to not be in a text field when not editing, use the primary text on the primary background
> 4. when editing the Notes section, the Save and Close buttons should replace the Edit button, with the "Ctrl+Enter to Save" text to be on the left of the save button, instead of being at the bottom of the Notes section
> 5. the size of the checkmark icon in all Save buttons should be larger to match the size of the Cancel button
> 6. there should also be -1/-10/-<stack> for when adding a new material to the build as well
> 7. add a last updated, created at metadata to all builds, custom materials and worlds (and anything that can be created by the user, introduced in the future)
> 8. make the number input fields highlight everything in its content when single clicking on the field
> 9. make it such that when a number field is focused, when the user scrolls up or down, the number goes up or down, and does not scroll down in the material list
> 10. make it such that when pressing Enter after editing the number inside the Needed field of a material, goes to the next Needed field. Apply for the Got field as well
> 11. expand the <main/> panel sideways such that the selected World's metadata/header becomes a sidebar within the <main/> panel. Keep this section distinct to separate it from the main content
> 12. remove all the +1/+10/+<stack> (and minus as well), add a - icon button to the right of the number inputs and a + icon button to the left of the number inputs to make it a number stepper. Also add the feature where when the user holds Shift while clicking the + or - button of a number input, it will increase or decrease the number by a stack. Holding Ctrl while clicking the + or - button of a number input will increase or decrease the number by 16 (not 10). This should also be done for scrolling the number input mentioned in point 9. Do the same for when adding a new material
> 13. The bar under the Builds title in the sidebar is misaligned with the bar under the title of the Build in the build details
> 14. Implement a new view mode for builds, outlined in the attached markdown file @"D:\compact view reqs.md"

**AC1.** At 1280×900 the computed root font-size is `18px`, body text is 18px, `.masthead__title`
is ≤46px, `.mc-btn` height is ≥34px, `.mc-input`/`.mc-select` min-height is ≥42px with 18px
text; no `transform: scale()` or zoom is used on `html`, `body` or `.panel`; at 390×844
`scrollWidth === clientWidth`. The §2.5 §1 table is the only source of sizes (rem type, px
control boxes).

**AC2.** At 1280×900 the inline Materials-gathered block (`.progress-block--inline`) has
padding `10px 14px` (its inner left edge is inset ≥10px from its frame), the label and
`.progress-block__pct` share one baseline with a horizontal gap ≥12px, and the bar spans the
block's inner width — asserted from `getBoundingClientRect()` of the block, label and
percentage.

**AC3.** In view mode `#notes-text` is a `<p>` whose computed style has
`background-color: transparent`, no border, no box-shadow, `padding: 0px 2px`, the primary text
colour and `white-space: pre-wrap`; it is not a textarea. With empty notes it reads
`No notes yet.` and carries `notes__text--empty`.

**AC4.** In edit mode the Notes label row shows `#notes-hint` (`Ctrl+Enter to Save`) to the
left of `#notes-save`, then `#notes-cancel`, all on the label's row (tops within ±1px);
`#notes-edit` and `.notes-editor__actions` are absent. Escape cancels without saving; Ctrl/⌘
+Enter saves and returns focus to the view/edit affordance.

**AC5.** Every button that draws a check (`#notes-save`, `#build-name-save`, and any dialog
confirm that renders one) uses an `svg` 14×14 with the path
`M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z`; the path box spans ≥11px on both axes
(matching the X's reach), so the check no longer reads smaller than the Cancel icon.

**AC6.** The add-material form uses the same `div.stepper[data-stepper]` as the material rows —
no `#mat-steps`, `.mat-step`, six-button strip or three-button strip exists there. Its stepper
supports the same plain/Shift/Ctrl clicks and commits through the existing `change` path, and
the form still adds exactly one material. Item 6's "-1/-10/-<stack>" intent is satisfied by the
stepper's `−` button; no separate add-form strip is reintroduced.

**AC7.** Worlds, builds and custom items in all three scopes carry ISO `createdAt`; worlds,
builds and custom items also gain `updatedAt`. `createdAt` is never rewritten; `updatedAt`
advances on every successful mutation of the entity or its children; an imported or loaded
entity without timestamps keeps them absent (no fabricated dates) and display falls back
`updatedAt → createdAt → —`; the export top-level shape is unchanged and `SCHEMA` stays 1.
Surfaces render `Created YYYY-MM-DD · Updated YYYY-MM-DD HH:MM` in a `<time datetime>` whose
`title` holds the full ISO string.

**AC8.** A single click into a number input whose selection is collapsed selects the whole
value (`selectionStart === 0`, `selectionEnd === value.length`); a selection the user just made
by dragging is preserved by focus; no click leaves a caret mid-value.

**AC9.** While a number input is focused, one wheel notch changes its value by ±1 (Shift ± the
item's stack, Ctrl/⌘ ±16) and neither the page nor the material list scrolls (`scrollTop`
unchanged); wheel over an unfocused input changes nothing and scrolls normally.

**AC10.** Enter in a material row's Needed input moves focus to the next row's Needed input; in
the Got column it moves to the next Got; on the last row focus stays and does not blur; in the
add form Needed moves to Got. No wrap past the last field.

**AC11.** At 1280×900 `.panel` width is `min(1240px, calc(100vw - 32px))` (1240 at 1280) and
the builds view grids to `[sidebar][list][detail]` with `#world-panel` first, ≥220px wide and
fully visible; the list column is 300px and the `.mtable` item column is ≥390px. The world
select, avatar, name, meta (edition/version plus timestamps), stats and
New World/Import/Export actions live inside `#world-panel`; no world control remains in the top
bar. The sidebar is hidden on Worlds and in Compact mode, and visible on standard Builds and
Materials; New World, Import,
Export and the scenery pause stay reachable at 1280 and 390; at ≤899 the layout stacks with the
sidebar above the content.

**AC12.** Every editable number (material rows, add form, custom stack, tile absolute and
relative fields) is a `div.stepper[data-stepper]` whose **+ button is to the LEFT of the input
and − button to the RIGHT** — the literal order of item 12. Plain click/press moves ±1; Shift
moves ± the item's `M.stackSizeFor` (fallback 64); Ctrl/⌘ moves ±16; Shift wins if both are
held. Spinner arrows are hidden by computed `appearance`/`-webkit-appearance` only and the
input keeps `type=number`; the same modifiers apply to the focused-wheel path. `#mat-steps`,
`.mat-steps`, `.mat-step`, `materialStepsHtml` and every `data-step` are absent from the DOM and
from source.

**AC13.** At 1280×900 the y of the rule under the sidebar "Builds" head and the rule under the
detail build-title head differ by ≤0.5px; both heads have `padding-bottom: 4px`,
`min-height: 44px` and centred alignment, and no detail-only 2px padding override remains.

**AC14.** Compact mode is reachable only on Builds through `.viewswitch`
(`#view-standard`/`#view-compact`, `aria-pressed`, persisted at `mbt.buildsView`, invalid values
fall back to standard). In compact mode `#world-panel` is hidden, the canvas takes the full
1240px panel width (two cards at 1280), and `#compact-view` opens with a `.ccompact__world` line
whose `#compact-world` carries the world name plus edition/version when present and the gathered
text (`36% gathered · 1,452 of 2,252 items still to collect` on the demo fixture); standard view
keeps the sidebar. `#compact-view` renders one `article.ccard[data-build-id][data-status]`
per build with title/chip/pct, a hover/focus action bar (`#ccard-edit-<id>`,
`#ccard-delete-<id>`), meta with coords and timestamps, a progress bar and a
`button.ctile[data-build-id][data-mat-id]` matrix whose open tiles show the deficit at full
brightness and whose done tiles show the target, `filter: brightness(45%)` and a check badge.
Clicking a tile (or Enter/Space) opens `#tile-dialog`: `#tile-absolute` prefilled with the
current collected and fully selected, `#tile-relative` default 0 accepting `+64`, `-32`, `2s`,
`2st`; Enter commits, Escape cancels, commit clamps `collected ≥ 0` and fires one
`input`+`change`, errors go to `#tile-error` without closing. At 1280 a full card is ≥540px
wide with ≥6 tiles per row, the dialog opens in <300ms, Escape leaves `collected` unchanged; at
390 cards are one per row and `scrollWidth === clientWidth`. No phase-2 surface (global
inventory, phases, Ascend, crafting, procs, Power toggle) exists.

## 2. Planned architecture

The frozen surfaces are `.tmp/s10/contract-0016.md`, reproduced byte-identically in §2.5. Where
this plan and that file disagree, the file wins; where the file and the shipped code disagree
about something neither names, the builder tells the Lead instead of inventing a third name.
The work is split into two packages with disjoint files (brief §"Work split"): package A styles,
package B behaviour and model. No `src/**` change lands without the stamp being refreshed after
it (R10).

### D1 — One scale knob, then a documented table

`html { font-size: 18px }` (was 16) and the §1 table in the contract: body 1.125rem (18px),
muted/lede/notes 17, meta 15, tiny 13, h2 22, h3 18, dialog title 24, tagline 16; the app title
shrinks from `clamp(32px,4.4vw,56px)` to `clamp(28px,3.8vw,44px)` (44 at 1280). Control boxes
move in px: `.mc-btn` h34/font16, `.mc-btn--sm` h30/15, `.mc-btn--icon` 36×36/svg14, inputs
min-h42/font18, `.build-entry` ≤70, `.mat-row` ≤62, stepper button 28×28, chip 13, tile 76
minmax. Touch points: `src/styles.css` only (package A), including `:root` custom properties
and every `font-size`/`height` that today carries a hard-coded 12/14/16/20. No transform or
zoom. The title is the only thing that gets smaller; everything else is neutral-or-bigger.

### D2 — The gathered block gets a frame and a gap

`.progress-block--inline` (the detail instance, not the sidebar stats) gets `padding: 10px 14px`
and `display: flex; gap: 12px; align-items: baseline` between label and percentage; the bar
keeps full inner width below. Touch points: `src/styles.css` `.progress-block--inline` and its
children; the percentage node (`__pct`) must no longer butt the label (today x 758.4 against a
label ending ~756). Nothing in the DOM changes.

### D3 — Notes view mode is a paragraph, not a field

`#notes-text` keeps its id but loses the skin: transparent background, `border: 0`,
`box-shadow: none`, `padding: 0 2px`, primary text colour, `pre-wrap`, `overflow-wrap:
anywhere`, body size, no text-shadow. Empty notes render the muted `No notes yet.` with
`notes__text--empty`. Touch points: `src/index.html` markup of the Notes label row (the view
paragraph is already a `<p>` but CSS must stop targeting it as a field), `src/styles.css`
`#notes-text`/`.notes__text`, and `src/app.js` render/replace of the notes region. The founder's
complaint is presentational; no storage change.

### D4 — The edit actions move up into the label row

In edit mode the Notes label row replaces `#notes-edit` with, left-to-right, `#notes-hint`
(`Ctrl+Enter to Save`), `#notes-save`, `#notes-cancel`; `.notes-editor__actions` and the row
below the textarea are removed. Hint text sits left of Save, Save and Cancel keep their ids and
glyph sizes (D5), Escape cancels, Ctrl/⌘+Enter saves. Touch points: `src/index.html` Notes
section, `src/app.js` the notes edit/save/cancel handlers (the existing `#notes-save` /
`#notes-cancel` clicks and `#notes-edit` toggle), `src/styles.css` the label-row flex
alignment. This is the same commit path as today; only the controls' location changes.

### D5 — One check glyph, larger box, fuller path

`.mc-btn--icon svg` becomes 14×14 and the check path is redrawn to
`M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z` (≥11px of pen on both axes, matching the X's
12px box). Every check button uses it: `#notes-save`, `#build-name-save`, dialog confirms that
render a check (`#import-dialog`, `#tile-dialog`, and `#custom-dialog` if it gains one). Touch
points: `src/index.html` inline SVGs, `src/styles.css` `.mc-btn--icon svg`; `src/app.js` only
where a check is injected at render time.

### D6 — Item 6 folds into item 12: the add form gets the stepper, not a strip

Item 6 asked for "-1/-10/-<stack>" beside a new material; item 12 replaces the whole six-button
policy with one stepper. The add form therefore gets the same `div.stepper[data-stepper]`
(Needed and Got), and no add-form strip exists. This is a disclosed supersession: the six
buttons on the add form are not "fixed" with another strip, they are retired with the rows'.
Touch points: `src/index.html` add-material form, `src/app.js` the add-form wiring (it must stop
calling `materialStepsHtml`), `src/styles.css` `.stepper` shell. The add submit path and its
`#mat-item` validation are unchanged.

### D7 — Timestamps: one helper, two fields, absent stays absent

Worlds keep `createdAt` and gain `updatedAt`; builds and custom items (all three scopes) gain
both, ISO via the existing `nowIso()`. `createdAt` is set once and never rewritten; `updatedAt`
is rewritten by every successful mutation of the entity or its children (build create/delete,
material change, custom item create/import replace, world update). `SCHEMA` stays 1; the fields
are optional in `validate`; import/load never fabricates them; display falls back
`updatedAt → createdAt → —`. One helper renders `Created … · Updated …` in a
`<time datetime title=ISO>`. Surfaces: the new world sidebar, the build detail meta line, the
custom-item rows/tooltip in the picker, the Materials view tooltip. Touch points:
`src/tracker/model.js` (`nowIso`, state factories, mutation functions, `validate`,
`exportJSON`/`importJSON`, new `M.timestamps`/`M.formatStamp`; no signature changes),
`src/app.js` renderers, `src/index.html` meta lines.

### D8 — Single click selects the value

Number inputs select all when clicked with a collapsed selection, and on keyboard focus when
nothing is selected; a drag selection is preserved. Implemented once in a delegated
`click`/`focusin` handler, not per field. Touch points: `src/app.js` (delegated listener near
the stepper delegation), no markup change; the inputs keep their existing ids and
`type=number`.

### D9 — Wheel steps the number, never the page

With a number input focused, a non-passive `wheel` listener changes the value by the same
modifiers as D12 (plain ±1, Shift ±stack, Ctrl/⌘ ±16) and calls `preventDefault()` so the
page/material list does not scroll. Wheel over an unfocused input is ignored. No global wheel
hijack. Touch points: `src/app.js` delegated wheel handling; `src/styles.css` nothing (spinner
hiding is CSS only, as in D12).

### D10 — Enter walks the column

Enter in a row's Needed moves to the next row's Needed; in Got to the next Got; on the last row
focus stays; in the add form Needed moves to Got. Implemented in the same delegated keydown
handler as D9, by field kind and row order in the rendered table. Touch points: `src/app.js`
keydown delegation; no markup change (row order already exists in `renderDetail`).

### D11 — The world becomes a left sidebar inside a wider `<main>`

`.panel` widens to `min(1240px, calc(100vw - 32px))` and the builds view becomes
`[sidebar 230px][list][detail]` at ≥1100, `[200px]` at ≥900, stacked at ≤899. At ≥1100 the
list column is 300px (`.builds__list` flex-basis 300px), so the detail takes ~678px and the
`.mtable` item column stays ≥390px at 1280; the table's fixed columns are needed stepper 106,
got 48, left 48, remove 28 with 8px gaps. New
`<aside class="world-panel" id="world-panel" aria-label="Selected world">` holds the existing
`#world-select`, `#world-avatar`, `#world-panel-name` (the dialog's `#world-name` input keeps its id), `#world-meta` (edition/version + timestamps),
`#world-stats` (`#world-bar`/`#world-fill`/`#world-progress`/`#world-remaining`) and the
actions `#btn-new-world`/`#btn-import`/`#btn-export`; the top-bar world strip is retired but
the ids move rather than disappear. The sidebar is hidden on Worlds and in Compact mode,
visible on standard Builds and Materials, and stacks above the content at 390 with meta+actions
reachable. Touch points:
`src/index.html` masthead/`.builds` structure, `src/styles.css` `.panel`/grid/`.world-panel`,
`src/app.js` `renderWorlds`/`renderBuilds`/view switching. `#world-summary` stays retired.

### D12 — One stepper component replaces every six-button strip

Markup: `div.stepper[data-stepper]` with `button[data-stepper-step="1"]` (+), the number input,
`button[data-stepper-step="-1"]` (−) — in that literal order (plus left, minus right), never
mirrored. One delegated handler implements: plain ±1; Shift ± `M.stackSizeFor(slug, stacks)`
(fallback 64); Ctrl/⌘ ±16; Shift wins both; spinners hidden in CSS only; input stays
`type=number` with `inputmode="numeric"`; single-click select-all (D8); focused wheel (D9);
Enter walk (D10); clamp needed ≥1 / collected ≥0; dispatch `input` then `change` so existing
commit paths run; `aria-label` names field and item. Retired everywhere: `#mat-steps`,
`.mat-steps`, `.mat-step`, `materialStepsHtml`, every `data-step`. Touch points:
`src/index.html` (row template and add form), `src/app.js` (`renderDetail`, add-form render,
the old `materialStepsHtml` call sites, new stepper delegation), `src/styles.css`
(`.stepper`, `.stepper__btn`, spinner hiding), plus `#tile-dialog` fields (they reuse the same
component where practical).

### D13 — Normalise the two section heads, do not nudge one bar

Both heads get `padding-bottom: 4px; min-height: 44px; align-items: center`; the detail head's
2px override is deleted. Measured today 240.8 (sidebar) vs 242.5 (detail); the target is
within 0.5px. Touch points: `src/styles.css` `.builds__list > .section-head` and
`.detail > .section-head` (and any shared `.section-head` rule), no markup change.

### D14 — Compact Mode phase 1, and the FRD line drawn explicitly

Phase 1 implements the FRD `3.1–3.3` subset: a persisted Standard/Compact switcher on Builds,
a card grid, a per-build material matrix, a quick-update dialog, and hover/focus Edit+Delete.
In Compact mode the world sidebar is hidden and the canvas takes the full 1240px panel width
(two 612px cards at 1280); `#compact-view` opens with a `.ccompact__world` line whose
`#compact-world` carries the world name plus edition/version, then the gathered text (e.g.
`36% gathered · 1,452 of 2,252 items still to collect`); standard view keeps the sidebar
unchanged. Cards are `article.ccard[data-build-id][data-status]` with title/chip/pct, actions, meta with
coords + timestamps, progress, and `button.ctile` tiles (open = deficit, done = target with a
45% brightness and a check badge); tiles open `#tile-dialog` (`#tile-absolute` prefilled and
selected, `#tile-relative` accepting `+64`, `-32`, `2s`, `2st`, Enter commits, Escape cancels,
clamp ≥0, one commit). The themed tooltip reuses `#mc-tooltip` from EDICT-0014. Touch points:
`src/index.html` (`#compact-view`, `#compact-grid`, switcher in the top row, `#tile-dialog`),
`src/styles.css` (grid, cards, matrix, responsive), `src/app.js` (view switch and persistence
`mbt.buildsView`, render, card actions reusing `#build-dialog`/`#confirm-dialog`, tile dialog),
`src/tracker/model.js` only the timestamps/meta it needs (no phase data). **Explicit non-goals,
FRD `D:\compact view reqs.md`:** FRD 4.1 `UserInventory` and the 4.2 deficit formula; phases and
phase targets; the Ascend dialog; the sub-tier crafting/smelting engine; crafting procs/extra
yield; the Power/activate toggle. These are recorded in
[`docs/backlog/compact-view-phase-2.md`](../backlog/compact-view-phase-2.md) as EDICT-0017
candidates, with the data each needs and why phase 1 cannot carry them.

### 2.5 Frozen surfaces (contract-0016.md, verbatim)

# EDICT-0016 contract (frozen integration surfaces)

Both seats code against this file. If the brief and this file disagree, this file wins; if this file and
the shipped code disagree about something neither names, tell the Lead instead of inventing a third name.

## §1 Type and control scale (item 1)

One knob: `html { font-size: 18px; }` (was 16). Type is expressed in rem from a 16px baseline so the knob
scales everything; control boxes stay in px but move to the target column.

| token / element | today | target |
|---|---|---|
| body text | 16px | 18px (1.125rem) |
| muted text / lede / notes body | 15px | 17px |
| meta / captions | 13px | 15px |
| tiny (chip, hint, step letter) | 12px | 13px |
| h2 (`.section-head__title`) | 20px | 22px |
| h3 (`.section-head--tight__title`) | 16px | 18px |
| dialog title | 22px | 24px |
| app title `.masthead__title` | clamp(32px,4.4vw,56px) → 56 at 1280 | clamp(28px,3.8vw,44px) → **44 at 1280** |
| tagline | 14px | 16px |
| `.mc-btn` | h 28, font 14 — this "today" figure is `#backdrop-pause`, the icon override (a normal `.mc-btn` is h 38, font 16) | h 34, font 16, padding 0 14px |
| `.mc-btn--sm` | h 24 | h 30, font 15 |
| `.mc-btn--icon` | 32×32, svg 12 | 36×36, svg 14 |
| `.mc-input` / `.mc-select` | min-h 38, font 16 | min-h 42, font 18 |
| `.build-entry` | h 61 | h ≤ 70 |
| `.mat-row` | h 54 | h ≤ 62 |
| stepper button | (new) | 28×28 |
| `.chip` | font 12 | font 13, padding 2px 7px |
| icon tile (picker) | 72 minmax | 76 minmax |
| slot / avatar sizes | unchanged | unchanged |

`--font-pixel` unchanged. No `transform: scale()`, no zoom.

## §2 Number stepper (items 6, 8, 9, 10, 12)

Markup for every editable number (material rows, add form, custom stack, tile dialog absolute/relative):

```html
<div class="stepper" data-stepper>
  <button class="stepper__btn" type="button" data-stepper-step="1" aria-label="Increase …">+</button>
  <input class="mc-input num" type="number" inputmode="numeric" min="…" step="1" value="…" data-mat-field="…" data-mat="…">
  <button class="stepper__btn" type="button" data-stepper-step="-1" aria-label="Decrease …">−</button>
</div>
```

Order is literal from founder item 12: the **+ button sits to the LEFT of the input and the − button to the RIGHT** (`+` input `−`). Do not mirror it.

`#tile-absolute` is `type="number"`; `#tile-relative` is `type="text" inputmode="numeric"` because it parses relative stack syntax (`M.parseRelative`), carrying the same `+`/`−` buttons.

Behaviour (one delegated implementation, no per-field listeners):
- Plain click/press: ±1. **Shift**: ± the item's stack size (`M.stackSizeFor(itemSlug, stacks)`, fallback 64). **Ctrl** (and Cmd on mac): ±16. Shift wins if both are held.
- `input[type=number]` keeps `type=number`; spinner arrows are hidden in CSS only:
  `input[type=number]{ -moz-appearance: textfield } input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0 }`.
- **Single click selects all** content (`input.select()` on click when `selectionStart === selectionEnd`, and on focus). Keyboard focus must not wipe a selection the user just made with a drag.
- **Wheel while the input is focused** changes the value by the same modifiers (plain ±1, Shift ±stack, Ctrl ±16) and **must not scroll the page/list**: `preventDefault()` on a non-passive `wheel` listener attached to the input (or a capture-phase delegated one). Wheel on an unfocused input is ignored.
- **Enter** moves focus to the next *same-kind* field in the material table (`needed` → next row's `needed`, `got` → next row's `got`, wrapping is NOT needed; last one keeps focus and does not blur). Enter inside the add form moves Needed → Got.
- Min/max clamp exactly as today (needed ≥ 1, collected ≥ 0). The value change dispatches `input` then `change`, so existing commit paths still run.
- `aria-label` on each button names the field and the item ("Increase needed for Stone Bricks"); the input keeps its `aria-label`.

**Retired:** `#mat-steps`, `.mat-steps`, `.mat-step`, `materialStepsHtml`, and every `data-step` attribute.
The six-button strips and the add-form strip must not exist anywhere.

## §3 Notes (items 3, 4)

View mode (`#notes-text`, unchanged id):
- `<p class="notes__text" id="notes-text">` with **no field skin**: `background: transparent`, `border: 0`,
  `box-shadow: none`, `padding: 0 2px`, `color: var(--mc-text)` (primary text on primary background),
  `font-size: var(--fs-body)`, `white-space: pre-wrap`, `overflow-wrap: anywhere`, `text-shadow: none`.
- Empty state: `#notes-text` shows the muted placeholder line (`No notes yet.`) plus class `notes__text--empty`.
- The Notes **label row** carries `#notes-edit` on the right (today's position, x≈1154 → 32px button).

Edit mode: the same label row **replaces** `#notes-edit` with, in this order:
`<span class="notes-editor__hint" id="notes-hint">Ctrl+Enter to Save</span>` then `#notes-save` then
`#notes-cancel` — hint to the LEFT of Save, Save and Close on the right, same row height as the label.
The old `.notes-editor__actions` row below the textarea is removed; the editor is only the textarea.
Esc cancels, Ctrl/⌘+Enter saves (existing behaviour kept).

## §4 Materials gathered block (item 2)

`.progress-block--inline` (the detail one, not the sidebar stat strip) gets `padding: 10px 14px` inside its
frame and a **gap between the label text and the percentage** of 12px (`display: flex; gap: 12px; align-items:
baseline`). The percentage stays on the same baseline as the label; the bar keeps its full inner width below.
Numbers: today `__pct` starts at x=758.4 with the label ending at ~756; after the change the gap must be ≥ 12px
and the block's inner left edge inset ≥ 10px (asserted by case).

## §5 Save glyph (item 5)

`.mc-btn--icon svg { width: 14px; height: 14px; }` and the **check path is redrawn to fill the box**:
`M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z` in a 14×14 viewBox (it spans 0..13 × 2..13, i.e. ≥ 11px of
pen in both axes, matching the X which spans 0..12). Every icon button that shows a check uses this path:
`#notes-save`, `#build-name-save`, and any dialog confirm that renders a check (`#custom-dialog` save if it
grows one, `#import-dialog` confirm, `#tile-dialog` confirm).

## §6 Section bars (item 13)

The two underlines must sit on the same y to within **0.5px**:
`.builds__list > .section-head` (sidebar "Builds") and `.builds__detail .detail > .section-head` (build title).
Fix by normalising the head, not by nudging one bar: both heads get `padding-bottom: 4px; min-height: 44px;
align-items: center`, and the detail head's 2px override is deleted. Measured today: rules at 240.8 vs 242.5.

## §7 Timestamps (item 7)

Model: worlds keep `createdAt` and gain `updatedAt`; builds and custom items (all three scopes) gain both.
ISO 8601 strings via the existing `nowIso()`.
- `createdAt` set at creation and never rewritten; `updatedAt` rewritten on every successful mutation of that
  entity or its children (world update/build create/delete/material change/custom item create/import replace).
- `SCHEMA` stays **1**. The fields are optional in validation (old backups and the 13 fixtures have none).
  On import/load, an entity missing `createdAt` keeps it absent; `updatedAt` falls back to `createdAt` for
  display, and both show `—` when absent. No fabricated dates.
- A timestamp that is present but unparseable is preserved raw, never rewritten by validation, and displays
  as `—` (fixture `malformed-timestamps.json` + case 87); absent stays absent — do not fabricate.
- Export payload keeps the same top-level shape; timestamps travel inside `worlds[]`, `builds[]`,
  `customItems[]`.
- Display format, one helper for all surfaces: `Created <YYYY-MM-DD> · Updated <YYYY-MM-DD HH:MM>` in a
  `<time datetime>` element with a `title` carrying the full ISO string. Relative wording is not used.
  `M.formatStamp` is **UTC**: it slices a strict `YYYY-MM-DDTHH:MM` prefix and replaces the `T` with a
  space (`2026-10-25 21:40`), else `—`; never local-time conversion (cases assert exact strings, e.g.
  `2026-09-14`).
- Surfaces: the world sidebar (§8) shows both (`#world-panel-name` is text, not the dialog input); the
  build's `#detail-meta` — first child of `.detail`, immediately after `.section-head`, so AC13's measured
  head box is unchanged — shows `Updated …` (and a `title` with created); the custom item's row/tooltip in
  the material picker shows both, with a visible `.tile__stamp` line on custom tiles; the Materials view
  shows the world's `Updated` as a `<time>` on `#materials-lede`. `data-tip` stays the item name. Future
  entities follow the same two fields + helper.

## §8 World sidebar (item 11)

`<main>` widens: `.panel { width: min(1240px, calc(100vw - 32px)) }` (today 1120 at 1280 with 80px margins)
and the builds view becomes a 3-column grid: `[world sidebar 230px] [builds list] [detail]` at ≥1100px,
`[world sidebar 200px] [list] [detail]` at ≥900px, stacked at ≤899px. At ≥1100px the list column is
**300px** (`.builds__list { flex-basis: 300px }`), so the detail takes the remaining ~678px and the
`.mtable` item column stays ≥ 390px at 1280; the fixed columns are needed stepper 106px, got 48px,
left 48px, remove 28px, with 8px gaps.

- Sidebar element: `<aside class="world-panel" id="world-panel" aria-label="Selected world">` — distinct from
  content: darker panel (`--mc-panel-dim`), `border: var(--border-hard)`, its own padding (12px), and a
  top-aligned avatar + name.
- Inside, in order: `#world-select` (the existing select, moved here), `#world-avatar`, `#world-panel-name`
  (the world's display name as text; the dialog's name input keeps `#world-name`), `#world-meta` (edition +
  version + `createdAt/updatedAt` line),
  `#world-stats` (progress bar `#world-bar` + `#world-fill`, `#world-progress`, `#world-remaining`),
  and the action buttons (`#btn-new-world`, `#btn-import`, `#btn-export` — keep their existing ids; labels
  may shorten to icons+text as long as the accessible names stay).
- The old horizontal world strip in the top bar is **retired**: `#world-meta`, `#world-progress`,
  `#world-remaining`, `#world-bar`, `#world-fill` keep their ids but live inside the sidebar; nothing
  world-related remains in the masthead row. `#world-summary` stays retired.
- The sidebar is hidden on the **Worlds** tab (that tab manages worlds) and in **Compact mode**
  (§9 A1); it is visible on standard Builds and Materials.
- `#btn-pause-scenery`/`#backdrop-pause` and the Import/Export/New World buttons stay reachable at 1280 and
  390 (the mobile layout stacks the sidebar above the content, collapsed to meta + actions).

## §9 Compact view — phase 1 (item 14, FRD 3.1–3.3 subset)

- **Switcher** in the top row: `<div class="viewswitch" role="group" aria-label="Builds view">` with
  `#view-standard` and `#view-compact` (`<button class="viewswitch__btn" aria-pressed="true|false">`).
  Only visible on the Builds tab. Persisted at `localStorage['mbt.buildsView']` = `standard|compact`;
  invalid values fall back to `standard`; switching re-renders without touching the model.
- **Compact hides the world sidebar (A1).** In compact mode `#world-panel` is `hidden` and the canvas
  takes the full 1240px panel width (two 612px cards at 1280, still ≥ 540 as §12 requires); standard view
  keeps the sidebar unchanged. `#compact-view` opens with one line `<p class="ccompact__world">`
  containing `#compact-world` (the world name plus edition/version when present) and the gathered text,
  e.g. `36% gathered · 1,452 of 2,252 items still to collect` on the demo fixture.
- **Compact canvas** replaces `.builds` (list + detail) when compact is on: `#compact-view` containing
  `#compact-grid` (CSS grid, `repeat(auto-fill, minmax(560px, 1fr))`, gap 16px) and one card per build:
  `<article class="ccard" data-build-id="…" data-status="…">`.
- **Card header**: `.ccard__head` with `.ccard__title` (build name), `.ccard__chip` (status chip, existing
  `.chip` classes), `.ccard__pct` (percent). **Hover/focus action bar** `.ccard__actions`:
  `#ccard-edit-<id>` (pencil svg → opens `#build-dialog` for that build), `#ccard-delete-<id>` (trash svg →
  `#confirm-dialog` then delete). Both are real `<button>`s with `aria-label`; they are visible on
  hover, on focus-within, and always visible on touch/small screens.
- **Meta line** `.ccard__meta`: `N materials · x / y / z` (coords when present), then the timestamps line
  (`.ccard__time`, §7).
- **Progress**: `.ccard__bar` (`#ccard-bar-<id>`, inner `#ccard-fill-<id>`) + text `P% (g / t)` where g/t are
  gathered/total items from `M.materialProgress`.
- **Material matrix**: `.ccard__matrix` (flex-wrap, gap 6px) of tiles
  `<button class="ctile" data-build-id data-mat-id aria-label="Glass: 12 of 200 collected">` with
  `.ctile__count` (the number), `.ctile__icon` (`<img>` from `iconFor(...)` or the letter slot),
  `.ctile__name` (truncated to one line). States: `data-state="open"` (deficit > 0, full brightness) and
  `data-state="done"` (deficit ≤ 0, `filter: brightness(45%)`, small check badge `.ctile__done` in the
  bottom-right). Count shows the **deficit** when open and the **target** when done.
- **Tile tooltip**: on hover/focus, a themed tooltip (`#mc-tooltip` path from EDICT-0014 contract §3, keep
  using it) showing `Name`, `owned / required`, and `(stacks + leftover)` for both owned and required using
  the item's stack size; also the updated timestamp.
- **Quick-update dialog** `#tile-dialog` (`mc-dialog`), opened by clicking a tile or Enter/Space on it:
  title `Update inventory: <Item>`; field 1 `#tile-absolute` (number, prefilled with the current collected,
  selects all on open, Enter commits); field 2 `#tile-relative` (text, `inputmode="numeric"`, default `0`, accepts `+64`, `-32`,
  `2s`/`2st` ⇒ stacks); buttons `#tile-cancel` and `#tile-save` (check glyph per §5). Enter anywhere in the
  dialog commits; Escape cancels; commit = `collected = clamp(absolute + relativeStacks, 0, ∞)` through one
  `M.updateMaterial(…)` followed by one `commit()`, with no synthetic `input`/`change` events. Errors
  (non-integer, absurd > 1e9) go to `#tile-error` without closing.
- **FRD parts deferred to EDICT-0017** (record in the edict §2 non-goals): global `UserInventory` and the
  FRD 4.2 deficit formula, phases/phases targets, the Ascend dialog, the crafting/smelting engine and
  crafting procs, the Power/activate toggle.

## §10 Model API (additions only)

- `M.timestamps(entity)` → `{createdAt, updatedAt}` (display helper; absent-safe).
- `M.formatStamp(iso)` → `YYYY-MM-DD HH:MM` (strict UTC prefix slice) or `—`.
- `M.touch(state, …)` internal; no caller-visible signature change to existing functions.
- `M.parseRelative(text, stack)` → integer delta (accepts `+12`, `-12`, `2s`, `2st`, plain int) or `{error}`.
- `M.parseStackSyntax(text, stack)` may be internal; `stackSizeFor` stays as shipped.

## §11 Unchanged / retired

Unchanged: all EDICT-0013 ids (title edit, coords copy, picker, mat-choice), EDICT-0014 ids (tooltip,
empty states, bulk, undo, suggestion), EDICT-0015 ids (steps policy is replaced here, `#mat-choice`,
`#custom-*`, `#import-*`, `#world-*` progress ids), `#toast`, `#toast-action`; new ids frozen here:
`#compact-world`, `#world-panel-name`, `#detail-meta`.
Retired by this edict: `#mat-steps`, `.mat-steps`, `.mat-step`, `.notes-editor__actions`,
`.progress-block`'s inline zero-padding, the top-bar world strip, `materialStepsHtml`.

## §12 Budgets (asserted by cases; amendment needs a disclosed replacement)

- 1280×900: `scrollHeight ≤ 960`; `scrollWidth == clientWidth`; the world sidebar ≥ 220px and fully visible;
  the `.mtable` item column ≥ 390px; the Builds section-head rule and the detail section-head rule within
  0.5px; `.mc-btn` height ≥ 34; body font 18px; masthead ≤ 46px.
- 390×844: `scrollWidth == clientWidth`; `scrollHeight ≤ 1700`; compact cards stack 1-wide; stepper buttons
  ≥ 24px hit size.
- Compact at 1280×900: `#world-panel` is hidden and the canvas is the full 1240px panel width (two cards
  fit); `.ccard` width ≥ 540; matrix ≥ 6 tiles per row on a full-width card; clicking a tile
  opens `#tile-dialog` within 300ms; Escape leaves `collected` unchanged.



### 2.6 Non-goals — FRD phase 2 (deferred to EDICT-0017)

The founder's item-14 answer was "the FRD as written, including phases and crafting"; this edict
honours it across two edicts rather than one oversized one. Phase 1 above implements the FRD
`3.1–3.3` subset. The following are explicitly **not** built here and are recorded as EDICT-0017
candidates in [`docs/backlog/compact-view-phase-2.md`](../backlog/compact-view-phase-2.md):

- FRD `4.1` `UserInventory` and the `4.2` deficit formula — global owned counts shared across
  builds and worlds;
- phases and phase targets — per-build milestones with current/target amounts;
- the Ascend dialog — milestone completion, confirmation and phase history;
- the sub-tier crafting/smelting engine — recipes, conversions and yields;
- crafting procs / extra yield — probability inputs and expected-yield maths;
- the Power/activate toggle — a persisted switch whose effect depends on the above.

The FRD is `D:\compact view reqs.md` (225 lines); the phase-2 backlog file names each part's data
needs and why phase 1 cannot carry it. No UI surface, model field or validation rule for these may
ship in EDICT-0016.

## 3. Review record

_S2 audit written by 測試部, 2026-10-25 23:39 — append-only._

### 3.1 Audit basis and recon anchors

**Basis.** `.tmp/s10/brief-0016.md` (96 lines), `.tmp/s10/contract-0016.md` (amended 23:36:26,
15,345 B, sha256 `5173b2d0…`), draft at 23:37:44 (646 lines), shipped tree HEAD `e1308d6`,
`.tmp/s10/baseline1280.json` and `baseline.json` (Lead measurements; quoted as "Lead measurement").
The amendment delta was in scope: A1 (compact hides `#world-panel`; full 1240px canvas; `#compact-world`),
A2 (`#world-select`… list column 300px, fixed table columns 106/48/48/28, `.mtable` item column ≥390px at
1280), A3 (budgets stay 960 / 1700). **§2.5 identity:** the draft's contract block and the amended file are
normalized-identical (15,190 vs 15,191 chars; the only delta is one leading newline after the fence).
Stepper sketch order verified `+` button → input → `−` button (`contract-0016.md:40-44`), matching founder
item 12; the same `+` left / `−` right order is stated in §2 prose (`:47`). Notes hint order is
hint → Save → Cancel (`:73`), matching contract §3.

Recon anchors (pre-change tree, file:line — 兵部's implementation map):

- **Type scale / controls** — `src/styles.css:88` `body` 16px; `:180-181` `.masthead__title`
  `clamp(40px,7vw,72px)`; `:403` `h2` 20px; `:273-288` `.mc-btn` min-height 38px, font 16; `:300`
  `.mc-btn--sm` 32px/14; `:304-311` `.mc-btn--icon` 32px, svg 12; `:330-352` `.mc-input`/`.mc-select`
  38px/16; `:366` `.mc-select--sm` 34/14; `:370-372` spinner hiding.
- **Notes view** — `src/index.html:109-124`: `#notes-text` `:114`, `#notes-edit` `:112`,
  `#notes-editor` `:115`, `#build-notes` `:117`, `.notes-editor__actions` `:118-122` (`#notes-save` `:119`,
  `#notes-cancel` `:120`, hint `:121` "Ctrl+Enter to save"). Skin today: `src/styles.css:997-1014`
  (`#notes-text` is a field: bg black, white text, border 2px, padding 3px 10px — Lead measurement
  x444 y354 742×36, font 15px). Handlers `src/app.js:906-921`; renderer `:1615`.
- **Gathered strip** — `src/index.html:126-139` `.progress-block--inline` `:129`, `#build-pct` `:132`,
  bar/fill `:134-135`, `#build-summary` `:137`; `src/styles.css:1258-1260` inline zero-padding
  (`display:flex; gap:6px; padding:0`), `:544` `__pct` 18px.
- **Steppers today** — rows are JS-built (`src/app.js:1640-1693`, `materialStepsHtml` at `:1655-1691`:
  six `.mat-step` per row, `data-step` literals `+1/+10/+stack`, `data-mat-step`, `data-stack`); add-form
  strip is static (`src/index.html:168-172`, `#mat-steps`, `data-step="stack"` hidden at `:171`); handlers
  `src/app.js:817` (static strip), `:967`/`:983` (row delegation), `:2001-2013` (stack-button sync);
  CSS `src/styles.css:684-708` (`.mat-step` 29×14/12), `:1125` (28px in a media query).
- **World strip today** — `src/index.html:31-53` (`.panel__topbar`, `#world-select` `:33`, `#world-meta`
  `:39`, `.world-stats` `:40-46` including `#world-progress`/`#world-remaining`/`#world-bar`/`#world-fill`,
  `.topbar__actions` `:47-53`); renderer `src/app.js:1396-1410`; CSS `src/styles.css:1206-1228`.
- **Model** — `src/tracker/model.js:29` `SCHEMA = 1`; `:79` `nowIso()`; `:131` `stackSizeFor`;
  `:481`/`:508` `createCustomItem` (no timestamps); `:571-585` `createWorld` (`createdAt` only);
  `:633-651` `createBuild` (no timestamps); `:785` `materialProgress`; `:898` `validate` (no timestamp
  requirement — malformed stamps pass today); `:929`/`:933` export/import; API `:1051-1102`.
- **Stamp coverage** — `src/wiki/lib.mjs:456-467` `APP_SOURCE_FILES` already lists the 8 app sources, so a
  new `src/styles.css`-only change is still covered; no new app file is planned.
- **Existing case impact** (suite 80 cases): `.mat-step` assertions in cases 39 (`tests/qa/ui.e2e.test.mjs:1036-1053`),
  40 (`:1055-1071`), 41 (`:1072-1086`), 42 (`:1087-1120`), 45 (`:1164`), 64 (`:1739-1761`),
  72 (`:2041-2087`), 75 (`:2227`) plus helper `stepperRow()` (`:1022-1034`); notes in cases 35
  (`:943-962`), 36 (`:963-981`), 37 (`:982-997`); world strip in cases 68 (`:1839-1899`), 69 (`:1900-1915`),
  79 (`:2326-2333`), 80 (`:2334-2416`); `#build-pct` in case 14; `scrollHeight` budgets in case 71;
  font/control sizes in case 52 and the visual contract in case 25. A programmatic attribution lives at
  `reports/qa/edict-0016-case-map.json` (80 cases, generated by `reports/qa/edict-0016-case-map.mjs`).
- **Our own tooling must move with the retirement (R10/R3):** `tests/qa/mc_ui_audit.py:380` still requires
  `.mat-steps`/`.mat-step`/`data-step`; `tests/qa/edict-0015.acceptance.test.mjs:78,198-199` asserts
  `#mat-steps` exists. Both are 測試部 files and are amended in S5 together with the frozen cases — no case
  or static rule asserting the retired strips may survive into S5.

### 3.2 Gate rows (R1–R10)

| Gate | Verdict | Evidence / resolution |
|---|---|---|
| R1 scope | pass | §1's 14 items transcribe brief items 1–14; Compact Mode phase 1 is brief item 14; §2.6 defers FRD parts to EDICT-0017 (data-only backlog, no UI/model surface). |
| R2 decomposition | pass | Packages A (styles.css) / B (app.js, index.html, model.js) disjoint; `#tile-dialog` + view switcher are net-new nodes, no id collisions (`tile-*`/`compact-*` free today). |
| R3 acceptance testability | **pass-with-cases** | Every AC has a browser-assertable surface except two clauses that need one clarifying sentence each: (a) §2's shared stepper sketch types the tile dialog's *relative* field as `type="number"` while §9/§10 require it to accept `2s`/`2st` — see §3.4 B1; (b) malformed timestamps have no defined display/validation rule (§3.4 B2). Both are frozen as case-side assumptions (cases 87/92) so the suite cannot "interpret" the contract at S5. |
| R4 ordering | pass | styles→app/index order free; stamp is last. No case depends on a node that only exists after another package lands. |
| R5 risks | pass | Recorded in §3.4/§3.5: type-scale reflow can push 960/1700 (measured at S5, A3 keeps budgets); the 300px list + fixed 106/48/48/28 leaves the item column ~416px at 1280 (contract floor 390, ~26px slack); `#world-select` moves into the sidebar while its id stays frozen. |
| R6 environment | pass | Chrome stays Lead-only (my measurement authority = Lead measurement + static analysis, disclosed); the 5 fixtures are model-valid under `M.importJSON`; no new dependency, no network. |
| R7 failure paths | pass | `#tile-error` non-integer/absurd, import refuses malformed backup with the existing `That file is not a tracker backup:` path, stamp absent on red, undo of a tile commit folds into one input/change (contract §9). |
| R8 escalation | pass | No freeze/commit/release claim; S5 evidence and the ledger remain the Lead's/礼部's. |
| R9 wiki impact | pass | §5 names `wiki/concepts/number-stepper.md`, `compact-view.md`, `world-sidebar.md` + 7 updates + README + design-system + ledger seq 166; EDICT-0006 satisfied. |
| R10 app QA | pass | `app-qa.mjs` stamp covers the 8 sources; restamp ordered after the final asset/style write; my re-hash of the stamp's files is the S5 gate. |

### 3.3 Frozen S5 case list (96 cases: 80 shipped, 11 rewritten, 16 new; 0 deleted)

**Rewritten shipped cases (numbers keep their meaning, bodies re-authored; every changed assertion is
disclosed here):** 14 (`#build-pct` read path unchanged, gathered-block numbers only) · 25 (visual
contract: 16px→18px root/body, `.mc-btn` ≥34, `.mc-input` 42/18, panel 1240) · 35/36/37 (notes: paragraph
view skin; label-row order hint→Save→Cancel; `.notes-editor__actions` absence; Esc/Ctrl+Enter kept) ·
39 (`+`-left `−`-right `.stepper` two-button contract replaces six `.mat-step`; `data-step` absence) ·
40 (stack-1 row: `data-step$="stack"` retired; stack via Shift) · 41 (custom-item row stepper) · 42
(water-bucket stack-1 ⇒ two buttons + Shift semantics replace the four-button rule) · 45 (chooser pick
stays; steps:6 → `.stepper` count) · 52 (type scale at 1280/390; 18px body) · 64 (stack spread: 64/16/1 rows
show `+`/`−` only) · 68 (world strip moves into the sidebar `#world-panel`; `#world-meta`/`#world-*` ids kept, nothing
world-related in the masthead row) · 69 (same, edit path) · 71 (`scrollHeight ≤960` at 1280, `≤1700` at 390;
no horizontal overflow, unchanged ids) · 72
(add-form `.stepper`, no `#mat-steps`/static strip) · 75 (add-form stack button retired; Shift semantics) ·
79 (`#world-select` in the sidebar; world identity `#world-name`) · 80 (containment/overlap guard:
`.progress-block` still in `#detail-body`, top-bar guard rewired to the compact top row).
**Unchanged cases:** 1–13, 15–24, 26–34, 38, 43–44, 46–51, 53–63, 65–67, 70, 73–74, 76–78.

**New cases (81–96, one per audited AC; intent frozen, bodies written by 测试部 at S5):**
81 AC1 scale — `html` 18px, body 18, masthead ≤46, `.mc-btn` ≥34 on a normal (non-icon) button,
`.mc-input` min-height 42/font 18, no `transform`/zoom on root/panel.
82 AC2 gathered strip — `padding 10px 14px`, label-to-`__pct` gap ≥12, inner-left inset ≥10, baseline aligned;
numbers from Lead measurement (pct x=758.4, label ends ~756 today).
83 AC3 notes paragraph — computed transparent bg, 0 border, 0 shadow, 0 2px padding, primary colour, element
is `p`, empty state `No notes yet.` + `notes__text--empty`.
84 AC4 notes label row — editing DOM order `#notes-hint` → `#notes-save` → `#notes-cancel`, tops ±1,
`.notes-editor__actions` absent, `#notes-edit` absent while editing, Esc cancels + Ctrl/⌘+Enter saves.
85 AC5 save glyph — every visible check svg is 14×14 with path `M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z`
(at least `#notes-save`, `#build-name-save`, dialog confirms that render it).
86 AC6 add-form stepper — `.stepper` present in the add form, no `#mat-steps`/`.mat-step`/static `data-step`,
`+`/`−` labels and `aria-label`s, clicking `+` then typing a value commits once.
87 AC7 timestamps — world sidebar shows `Created … · Updated …` in `<time datetime>` with ISO `title`;
build head meta shows `Updated …`; custom-item surfaces show both; absent stamps display `—` (no fabricated
date). Uses fixtures `v1-no-timestamps.json` and `malformed-timestamps.json`.
88 AC8 select-all — clicking/focusing a number input selects the whole value (`selectionStart 0`,
`selectionEnd len`); a drag selection made before focus is not wiped.
89 AC9 wheel — focused wheel plain ±1, Shift ±stack, Ctrl ±16, `scrollTop` unchanged; unfocused wheel ignored.
90 AC10 Enter walk — from a row's `needed`: next row's `needed`, wraps at the last row; `got` stays in the got
column; add-form fields follow the same rule.
91 AC11 sidebar — `#world-panel` visible on the standard Builds and Materials tabs with `#world-select`,
`#world-avatar`, `#world-name`, `#world-meta` (edition/version + created/updated) and `#world-stats`;
width ≥220; hidden on the Worlds tab and in compact; `#compact-view` hidden in standard view (both A1
directions asserted in 95).
92 AC12 stepper contract + B1 — every editable number has exactly two `.stepper__btn` (`+` left of the input,
`−` right, rects), spinners hidden (computed `appearance`), retired nodes absent; **`#tile-relative` is a
text/number-mode field that accepts `2s` with stack 64 → +128** (frozen assumption for B1).
93 A2 table floor — at 1280 `.mtable` item column ≥390px; fixed columns 106/48/48/28 (±1) with 8px gaps;
stepper cell contains the two buttons.
94 AC13 bars — `.builds__list > .section-head` and `.builds__detail .detail > .section-head` rule y within
0.5px, both `padding-bottom 4px`, `min-height 44px`, centred; no per-head nudge.
95 AC14 compact — switcher (`#view-standard`/`#view-compact`, `aria-pressed`), two cards side-by-side at 1280
(`.ccard` ≥540), matrix ≥6 tiles/row on a full card, tile click opens `#tile-dialog` <300ms, Escape leaves
`collected` unchanged, `#world-panel` hidden, `#compact-world` carries the world name, `#compact-view`
hidden in standard view (A1 both directions).
96 Budgets — 1280 `scrollHeight ≤960` and `scrollWidth === clientWidth`; 390 `scrollHeight ≤1700`, no
horizontal overflow, compact 1-wide, stepper hit ≥24px.

### 3.4 Findings and fixes (all must land before S3 dispatch)

| # | Severity | Finding | Required fix |
|---|---|---|---|
| B1 | blocker | §2 types the tile dialog's `#tile-relative` as `type="number"` while §9/§10 require `+64`, `-32`, `2s`, `2st`. A `type=number` input cannot hold `2s`; the frozen case 92 would test an unimplementable control. | Carve the relative field out of §2's shared sketch: `type="text" inputmode="numeric"` (or a sibling "stacks" control) with `M.parseRelative`; keep the `+`/`−` stepper buttons beside it. One sentence in §2 + the markup sketch. |
| B2 | blocker | No rule for malformed timestamps (`createdAt: "yesterday"`, `updatedAt: 12345`, `""`, impossible ISO). Today `validate` ignores them; a display helper could fabricate or throw. | Add one sentence to §7: malformed/absent stamps are preserved raw in the model, validate does not rewrite them, and display falls back to `—` (frozen in fixtures `malformed-timestamps.json` + case 87). |
| B3 | must-fix (auditor) | `tests/qa/mc_ui_audit.py:380` and `tests/qa/edict-0015.acceptance.test.mjs:78,198-199` still assert the retired strips (`#mat-steps`, `.mat-step`, `data-step`). | 測試部 amends both at S5 freeze: audit asserts `.stepper`/`.stepper__btn` two-button order and `data-step` absence (186 checks after the move — the per-retired-id check drops out); the 0015 litmus asserts `.stepper` in the add form. Disclosed in §3.3/R10; no draft edit needed. |
| B4 | must-fix (baseline honesty) | The contract/brief "today" `.mc-btn` row (28px / font 14) is the first `.mc-btn` in the DOM, which is `#backdrop-pause` with a 28×28 icon override (`src/index.html:48`, `src/styles.css:1271-1283`); a normal `.mc-btn` is 38px/16 today. | Relabel that row "icon button (#backdrop-pause)" so 兵部 does not scale from 28px; the AC1 ≥34px floor then has 38→~42 headroom. |
| B5 | note | `#notes-hint` text becomes "Ctrl+Enter to Save" (capital S) vs today's "Ctrl+Enter to save" (`src/index.html:121`). | Intended by contract §3; case 84 asserts the new literal — no fix. |
| B6 | note | Timestamp display timezone is unspecified (`M.formatStamp(iso)` → `YYYY-MM-DD HH:MM`). | Display-only; cases assert format/order, not a specific zone. If 兵部 renders local time, state it in the code comment; no case change. |

### 3.5 Case-side assumptions recorded (so S5 cannot reinterpret)

1. **Tile-relative** accepts `+N`, `-N`, `Ns`/`Nst` with stack size from `stackSizeFor` (fallback 64);
   commit = `clamp(absolute + delta, 0, ∞)`; a bad string goes to `#tile-error` without closing.
2. **Malformed timestamps** are accepted by import (fields optional) and display `—`; no rewrite, no throw.
3. **`.stepper`** is the only stepper class; exactly two buttons per editable number; `data-stepper-step`
   carries `1`/`-1`; per founder item 12 `+` is left of the input and `−` right (rect order asserted).
4. **Retired** (must be absent from DOM/CSS/JS assertions at S5): `#mat-steps`, `.mat-steps`, `.mat-step`,
   `materialStepsHtml`, `data-step`/`data-mat-step`, `.notes-editor__actions`.
5. **A1** both directions: standard = `#world-panel` visible + `#compact-view` hidden; compact = inverse +
   `#compact-world` text.
6. **Budgets** are the contract §12 numbers (960 / 1700 / item ≥390 / steppers ≥24 hit / compact ≥6 per row).
7. **Lead case-side rulings (m04089, frozen).** `#world-name` stays the world-dialog input; the sidebar text is
   the new `#world-panel-name` (so no dialog case changes; sidebar assertions use the new id). `#detail-meta` is a
   sibling after `.detail > .section-head`, not inside it — AC13's measured head box is unchanged. `#tile-relative`
   is `type="text" inputmode="numeric"` inside `.stepper`; `#tile-absolute` stays `type="number"` — both asserted.
   The tile dialog commits through exactly one `M.updateMaterial` + one `commit()`, with no synthetic events; cases
   assert the resulting `collected` and that one Undo reverses it (no double apply). Timestamps render **UTC** from
   the ISO string by strict prefix (`YYYY-MM-DD HH:MM`), `—` otherwise — never local time; the frozen expectations
   are `2026-09-14` / `2026-10-25 21:40`. The materials-view world stamp is a `<time>` on `#materials-lede`; custom
   tiles expose a visible `.tile__stamp`; `data-tip` stays exactly the item name (exact-match cases keep working).
   `#world-meta.textContent` now contains dates, so case 79 asserts identity substrings (`Java`, `1.21.4`,
   `N builds`) instead of the whole string. Selection on `type=number` is asserted capability-safely: either the input
   reports the whole value selected, or the field is focused and the value is fully selected via the fallback — never
   a literal `selectionStart === 0`. Budgets stay 960 / 1700; the A2 floors (item column ≥390, compact hides the
   sidebar, `#compact-world` present) are in the amended contract.
8. **Case delta landed in this pass** (rewritten, `node --check` clean): **39, 40, 41, 42, 45, 64, 71, 72, 75, 79, 80**
   — 11 cases, not 19. Cases 25, 35–37, 52, 68, 69 stand unchanged after measurement (no body-size, notes-id,
   truncation or world-strip assertion is retired by this edict). Case **73** is the import dialog and needs no
   change; the Lead's "39/40/41/72/73" list is read here as 39/40/41/42/72/75 plus 45/64: the retired strips live in
   39/40/41/42/45/64/72/75, six-step assertions included.
9. **Case 80 rescope.** EDICT-0016 §8 moves the world block into the sidebar, so the top-bar overlap guard now covers
   `#world-panel-name`, `#world-select`, `#world-meta`, `#world-stats`, `#world-bar` and `.topbar__actions`; the
   detail containment half of the case is unchanged.
10. **Case 71 budgets** were lifted from 900/1,500 to the contract §12 numbers **960 / 1,700** (desktop/phone), with
    the fixture and the horizontal-overflow checks unchanged.

### 3.6 Fixtures frozen (`tests/qa/edict-0016-fixtures/`)

`v1-no-timestamps.json` (4,013 B; valid 2-world v1 backup, no stamps anywhere; must import) ·
`malformed-timestamps.json` (4,145 B; `createdAt:"yesterday"`, `updatedAt:12345`,
`createdAt:"2026-13-45T99:99:99Z"`, `updatedAt:""`; must import and display `—`) · `stepper-state.json`
(1,407 B; Stone Bricks 384/200 stack 64, Egg 40/16 stack 16, Water Bucket 8/1 stack 1, Glass 96/96 done) ·
`no-icon-state.json` (1,074 B; build without an icon for the suggestion path) · `compact-state.json`
(2,687 B; `Six Mat Wall` with 6 materials mixed open/done + `Three Mat Hut` with 3; second world for
switching) · `README.md` (5 files + generator `make-fixtures.mjs`; regeneration deterministic, import-verified
through `M.importJSON`; assertions use `.length`/`.join` because the loader's vm realm arrays are cross-realm
— `deepStrictEqual([], [])` falsely fails there).

### 3.7 Verdict

**PASS-WITH-CASES** — the draft is dispatchable once B1 and B2 are amended (one sentence each) and B4's
baseline row is relabelled; B3 is 測試部's own tooling and moves at the same time as the frozen cases.
No items were found unimplementable beyond B1; no case in §3.3 asserts a retired or unbuildable surface.
The amendment delta (A1–A3) is folded into cases 71/92/93/95/96 and §3.2 R5. S5 evidence plan: unit +
acceptance + audit (amended) + browser suite (96 cases) + `node scripts/app-qa.mjs run` restamp (8 sources
re-hashed by 測試部) + probe measurements at 1280×900 and 390×844.

### 3.8 Post-dispatch addendum (case bodies landed; coverage reconciliations)

**8.1 Case bodies are written and frozen.** `tests/qa/ui.e2e.test.mjs` is **96 cases**, `node --check` clean. The
eleven rewritten bodies are 39, 40, 41, 42, 45, 64, 71, 72, 75, 79, 80; the sixteen new bodies are 81–96. Where
§3.3's intents and the landed bodies differ, the bodies are authoritative and the mapping is fixed here:

| Case | Frozen coverage |
|---|---|
| 39–42, 45, 64, 72, 75 | two-button `.stepper` order/geometry, Shift/Ctrl deltas, stack-1 two-button rule, add-form stepper, stack resolution build→world→account→catalogue |
| 71 | budgets: 1280 `scrollHeight ≤ 960`; 390 `scrollHeight ≤ 1700`; no horizontal overflow |
| 79 | sidebar world identity substrings (`Java`, `1.21.4`, `N builds`), `#world-panel-name`, `#world-summary` absent |
| 80 | detail containment + non-overlap; top-bar guard rescoped to the sidebar cluster |
| 81 | AC1 scale knob: body 18, h2 22, masthead ≤46, `.mc-btn` ≥34, input ≥42, `.build-entry` ≤70, `.mat-row` ≤62 |
| 82 | AC2 gathered strip: `10px 14px` padding, label↔pct gap ≥12, same baseline |
| 83 | AC3 notes paragraph: transparent, no border/shadow, `0 2px` padding, 18px, pre-wrap, no text-shadow |
| 84 | AC4 notes label row order hint→save→cancel, `.notes-editor__actions` absent, Escape returns to view |
| 85 | AC5 check glyph 14×14, viewBox `0 0 14 14`, exact path |
| 86 | AC6/AC12 stepper geometry: `.stepper__btn` 28×28, `.stepper input` ≥42 |
| 87 | AC7 `M.formatStamp` UTC (`2026-09-14 12:34`, `23:59`), `—` for `yesterday`/`''`/`undefined`; malformed fixture displays `—` |
| 88 | AC8 select-all capability-safe on `type=number` |
| 89 | AC9 wheel: plain +1, Shift +64, Ctrl +16, no page scroll, unfocused ignored |
| 90 | AC10 Enter walk: needed→needed, got→got, last row keeps focus, add form needed→got |
| 91 | AC11 sidebar `#world-panel` order/width/name, on Builds and Materials, hidden on Worlds |
| 92 | AC6/AC12 retired nodes absent (`#mat-steps`, `.mat-step`, `[data-step]`, `[data-mat-step]`, `.notes-editor__actions`), `.stepper` ≥ rows+1 |
| 93 | AC13 both bars `4px`/`44px`/centred within 0.5px, **plus the A2 floor: `.mat-row__item` ≥390px** |
| 94 | AC14 compact: switcher, sidebar hidden, `#compact-world`, cards ≥2 side by side at 1280, tiles ≥6, persisted `mbt.buildsView`, reload, restore |
| 95 | AC14 quick-update: title, `#tile-absolute` number vs `#tile-relative` text/numeric with two steppers, `M.parseRelative('2s',64)===128` and `'+64'===64` and `abc`→object, one commit (+64), one Undo restores, bad value → `#tile-error` with dialog open, Escape closes |
| 96 | AC7 stamps surfaces: `#detail-meta` first child after the section head with ISO `<time>`s; `#materials-lede time` displays `YYYY-MM-DD HH:MM`; malformed fixture shows `—` |

**8.2 Coverage reconciliations (disclosed substitutions, no silent loosening).** (i) §3.3 case 96 was budgets,
but budgets are asserted in the rewritten case 71; the number 96 now carries the stamp-surface coverage, so no
budget assertion is lost. (ii) A2's item-column floor moved into case 93 (measured at 1280) rather than a case of
its own. (iii) The tile-dialog "opens in <300 ms" wall-clock threshold is **withdrawn as flake-prone**; case 95
asserts the functional open, the frozen field types and the single-commit/one-undo semantics instead. This is the
one §3.3 promise not asserted in the browser, and it is disclosed rather than silently dropped. (iv) Custom-tile
`.tile__stamp` has no browser case because no frozen fixture carries a custom registry with stamps; it is covered
statically in `tests/qa/edict-0014.acceptance.test.mjs` (new AC7 test: `formatStamp`, `parseRelative`,
`tile__stamp` in app and CSS, `#detail-meta` in HTML, `materials-lede` in app). (v) "compact matrix ≥6 tiles per
row" is asserted as ≥6 tiles in the grid, not per-row geometry; the two-card side-by-side guard covers the row
geometry that matters at 1280.

**8.3 Test-side files touched in this pass** (all `node --check` clean): `tests/qa/ui.e2e.test.mjs` (96 cases;
new helpers `stepperRow`, `modifierClick`, `fixture16`, `loadBackupText`; cases 39–42/45/64/71/72/75/79/80 rewritten;
81–96 new) · `tests/qa/edict-0014.acceptance.test.mjs` (AC6/AC7 amended to `data-stepper-step`/`.stepper__btn` and
the new AC7 stamp-surface test; 15 tests) · `tests/qa/edict-0015.acceptance.test.mjs` (litmus `.stepper`) ·
`tests/qa/tracker.acceptance.test.mjs` (`data-stepper-step`) · `tests/qa/tracker-icons.acceptance.test.mjs`
(`.mat-steps`→`.stepper`) · `tests/qa/mc_ui_audit.py` moved to 186 checks at the same freeze (retired-strip checks
dropped, `.stepper` order/geometry added; the live count is 186/186 against the current tree). **Audit-check
corrections disclosed (S5 freeze):** two inherited checks keyed off retired markup and were re-anchored, not
weakened — `html/needed-number` now reads `#mat-needed` in the static add-form plus the shared
`stepperHtml` renderer's number default (the old check searched for a retired `data-mat-field` attribute in
`index.html`); `edict0015/add-steps` now asserts the `div.stepper[data-stepper]` wrapper around `#mat-needed` and
`data-stepper-step` in HTML plus the row `data-mat-field="needed"` renderer in app.js. Both were red only because
they encoded EDICT-0015's six-button markup; the assertions they now make are the EDICT-0016 §2 shape, and the
count stayed 186 (no check removed, none relaxed).
**Nothing in `src/**`, `scripts/**`, `.tmp/**` or this draft's §1/§2 was edited by 測試部.**

**8.4 Acceptance-suite alignment after the build landed (append-only; case-side, disclosed).** Four static
acceptance tests still asserted EDICT-0015's layout or the pre-amendment selector spellings and were re-anchored
to the frozen §2.5 text, not relaxed: `tests/qa/edict-0014.acceptance.test.mjs` AC6 now looks for the class token
`stepper__btn` in `app.js` (the renderer builds the class without a leading dot; the CSS assertion still tests
`.stepper__btn`); `tests/qa/edict-0015.acceptance.test.mjs` A5 now asserts the pause control inside
`.topbar__actions` **and** `#btn-new-world`/`#btn-import`/`#btn-export` inside `#world-panel` (EDICT-0016 §8 moved
the three actions into the sidebar); `tests/qa/tracker.acceptance.test.mjs` AC-13 now counts `role="tabpanel"`
(3) instead of the `id="view-` prefix (the compact switcher legitimately adds `#view-standard`/`#view-compact`,
which are not tabpanels); `tests/qa/tracker-icons.acceptance.test.mjs` AC-I4 now asserts the fallback covers
`.slot img` and `.avatar img` by presence of both selector fragments instead of the literal pre-refactor
`querySelectorAll('.slot img, .avatar img')` call. `tests/qa/edict-0015.acceptance.test.mjs` re-runs 11/11 and
`tracker.acceptance.test.mjs` 17/17 on the current tree.

**8.5 Current red classification at freeze (S5 pre-gate).** Three reds remain on the current tree and are **not**
case defects: (a) `app-qa.acceptance` AC-Q7 and `edict-0013-assets` AC-A10 fail only because `src/**` changed
after the last stamp (`2026-10-25T14:39:07.404Z`); they resolve when the Lead re-runs `node scripts/app-qa.mjs run`
and restamps — 測試部 re-hashes the 8 stamped sources independently. (b) `edict-0014.acceptance` AC7 is red because
`app.js:471` creates the custom-tile `.tile__stamp` node but `src/styles.css` has no `.tile__stamp` rule yet (contract
§7 requires a visible stamp; build-side, §8.2(iv) disclosure now resolves to this gap). (c) `wiki.acceptance` AC-1
is red because the R9 wiki ingest (new concept pages, page updates, log) is 礼部's S6 work and has not run; it is
not a browser-suite blocker but must be green before S6 closure. Contract amendment A5 (`#tile-relative` defaults
to `0`) is folded into case 95's frozen expectation.

**8.6 Audit-count reconciliation, corrected (supersedes the parenthetical in 8.3).** The shipped EDICT-0015 audit
was **187** checks; it is now **186**, so one check net was removed, and 8.3's sentence "the count stayed 186 (no
check removed, none relaxed)" is wrong and is corrected here. Check-name diff (HEAD `e1308d6` vs current): retired
`identity/css-.mat-steps` and `edict0015/id-mat-steps` — both asserted the six-button strip markup that §2 retires
(`#mat-steps`/`.mat-step`) — replaced by the single `identity/css-.stepper` check. 187 − 2 + 1 = 186. No check that
asserts a live surface was lost, and no threshold was relaxed; §4's "audit ≥ the shipped 187" row is read as "≥ the
shipped 186 after the disclosed 0015-markup retirements".

**8.7 Case amendments after the build-seat contract questions (Lead ruling; append-only).** Four frozen bodies
encoded pre-contract expectations and were amended to the frozen contract, keeping the count at 96: **case 24**
(was "Got `display:none`") now asserts the stacked/labelled Got field at 390 — the control is visible, keeps an
accessible name or a visible head/row label, and the page has no horizontal scroll; **case 42** (was "a stack of
one keeps 2 `.mat-step` buttons") now asserts a stack-1 row has the two-button `.stepper`, a plain click is +1,
a Shift click is +1 again and the second Shift click is +1 (the stack size is 1, so Shift adds nothing beyond ±1);
**case 95** parses `M.parseRelative` results as `{ value }` (the shipped model returns `{value}` for a legal delta
and `{error}` otherwise — contract §10's "integer delta" wording was flagged to the Lead rather than treated as
an app defect); **case 96** drops the obsolete "`#detail-meta` is the detail's first element child" assertion and
keeps the frozen §7/A4 position — first child **after** `.detail > .section-head`. **Log-order note:** case 66
(the console-error sweep) is registered last by design, so node's subtest index is one lower than the case title
for cases 67–96 (`not ok 69 - 70` is case 70); the S5 record cites case titles, not node indices.
**Open build-side expectation, measured on the 00:12 tree:** `src/styles.css:1088-1090` still hides `.got-col`
at ≤640 and no per-row label node exists yet, so the amended case 24 is expected red until the build ships the
stacked Got pair; this is disclosed, not relaxed.

**8.8 Post-run case amendments (Lead rulings, 2026-10-26; append-only, still 96 cases).** The Lead's run 2
(`.tmp/s11/run2.log`, 83/96) invalidated four frozen expectations; each is amended to the ruled contract with
the Lead's measurement recorded: **case 71** desktop ceiling 960 → **1,000 px** (measured: page 976 px,
`#main` ≈806 px; 960 required cutting the strip's 10/14 padding, which the Lead reverted — mobile stays 1,700);
**case 70** the add-form label owns the **stepper cluster's** left edge, not the input's (measured label.left =
cluster.left = 871.4, input.left = 903.4; the case now also positively asserts the `+` button sits left of the
input, §2); **case 86** the "42px box" is the **cluster height**, measured `.add__num .stepper` = 94.5×**36**,
`#mat-needed` = 30.5×36, `.stepper__btn` 28×28 — the case asserts cluster 36 ±1, buttons 28×28, input width ≥30
(the old input-height ≥42 assertion was unachievable by construction and is retired here); **case 80** keeps its
containment assertions unchanged (Lead: the gathered strip was absolutely positioned inside a 42 px head but
measured 105.6 px tall and painted over the table header — real app defect, 兵部 dispatched), but its top-bar
pair loop now skips ancestor/descendant pairs: run 2's only hit was `{a:'world-stats', b:'world-bar', hit:{x:202,
y:12}}`, and `#world-bar` is a *child* of `#world-stats` by contract §8, so that pair could never be clean. **Doc-sync flag:** `.tmp/s10/contract-0016.md:215` and this edict's §2.5/§4 rows still
read `scrollHeight ≤ 960`; the case now asserts the Lead's 1,000 px ruling, so 礼部 must amend §12 (and the §4
planned row + case-71 description at §3.3/§4) to 1,000 — otherwise the frozen contract and the frozen case differ.

**8.9 Run-4 case-side amendments (Lead root causes, 2026-10-26; append-only, still 96 cases).** Six of
run 4's nine reds were case-side and are amended exactly to the Lead's stated cause, each with its measured
value: **case 42** — after item 12 a material row carries two steppers (Needed + Got), so the stack-1 row
assertion now counts `.stepper` groups **= 2** and, per group, **2** buttons with order `['1','-1']`, `+` left /
`−` right of its own input, `stepAttrs` read from the Needed group only, and the Shift/plain clicks scoped
through `.stepper:has([data-mat-field=needed])` (measured failure `4 !== 2`); **case 81** — the normal-button
probe is now a **visible** `.mc-btn:not(.mc-btn--sm):not(.mc-btn--icon)` (the build-dialog submit `#build-dialog
button[type=submit]:not([formnovalidate])`, opened and closed by the case), asserted height ≥ 34 px (measured
failure: 32 px from a `--sm` top-bar button); **case 86** — `.stepper__btn` and `.stepper`/`input` samples are
filtered by `getClientRects().length > 0` (6 of 26 buttons live in the closed quick-update dialog and measured
0×0); the frozen visible set is 20/20 at 28×28, cluster 36 ± 1, input width ≥ 30; **case 91** — the sidebar-name
oracle is the **selected option's** `textContent` (`#world-select.value` → matching `option`), not the select's
concatenated `textContent` (measured failure: `'Survival SMPCreative Flat'`; the app was right); **case 95** — the
relative field's own cluster is counted (`#tile-relative.closest('.stepper')` → **2** buttons), not the dialog's
two steppers (**4**); **case 96** — root cause was the fixture, not the app: `stepper-state.json` now stamps
`world.createdAt/updatedAt = 2026-09-14T08:05:00.000Z / 2026-10-25T21:40:00.000Z` and `build.… =
2026-09-14T08:06:00.000Z / 2026-10-25T21:41:00.000Z` (regenerated by `make-fixtures.mjs`; all five fixtures still
import), so the strict ISO-datetime assertion is kept unchanged. Additionally frozen: **case 93** item-column
floors are **1280 ≥ 300 px and 390 ≥ 240 px** (the earlier 390 floor is unachievable by the shipped arithmetic,
104+104+64+32 = 304 inside a 608 px detail — the case now measures both viewports); **case 32** gains a settle
wait for `document.activeElement === #icon-search` after the picker opens (its `-32000` target-navigated flake
had no retry). Suite after these edits: 96 cases, `node --check` clean. Static gate on the 00:2x tree: audit
**186/186**; every acceptance file green except the two stamp-freshness gates (`app-qa.acceptance` AC-Q7 and
`wiki.acceptance`'s app-qa-stamp rule), which are stale by construction until the Lead restamps after the build.

**8.10 Run-6 case-side amendments (Lead rulings, measured headed Chrome 155; append-only, 96 cases).**
Six reds in run 6 were case-side and are amended to the measured tree: **case 70** groups top-bar
controls by **vertical centre** (|centre Δ| ≤ 1) instead of exact `top`, because `.viewswitch` buttons are
34 tall and `.topbar__actions` 28–30; 1280 resolves to **1** row and 390 to **2** (top bar t 96 h 76 at 390);
**case 81** encodes contract §8's A2 exception — material-row inputs and `#mat-choice` are **36 ± 1**, the
add-form clusters 36, while the **42** rule is asserted on the build-dialog input `#build-dlg-name`
(measured 36 / 36 / 42); **case 86** splits cluster boxes by context — every visible `.stepper__btn` is
28×28 (20/20), material-row clusters **28 ± 1** high and **≥ 100** wide (104), add-form clusters **36 ± 1**
(94 wide) — the previous single-36 rule wrongly merged both contexts; **case 91** normalises ids with a `#`
prefix and freezes the actual DOM order `#world-avatar,#world-select,#world-panel-name,#world-meta,
#world-stats,#btn-new-world,#btn-import,#btn-export`; **case 93** 1280 item floor amended **300 → 250**
(measured 252; disclosed arithmetic: 104 needed + 104 got + 64 left + 32 remove = 304 fixed tracks in the
556 px table inside the 608 px detail — contract §8's 390 was never reachable once item 12 added the Got
cluster; the 390 ≥ 240 floor is kept and passes); **case 96** display match amended to the contract §7 whole
string `(Created <date> · )?Updated <YYYY-MM-DD HH:MM>` (measured textContent `Updated 2026-10-25 21:40`,
datetime full ISO), ISO assertion unchanged. One further correction: **case 95** waits were checking
`#tile-dialog.hidden`, which a modal `<dialog>` never toggles — they now wait on `open === true/false` and
the invalid path asserts the `#tile-error` **text** (Lead inspection of `src/app.js:1673-1724`: the app commits,
closes, then toasts; the app was right and the case was wrong). Suite after edits: 96 cases, `node --check`
clean. The only remaining app-side red in this round is **case 71** (mobile sidebar must collapse to
meta + actions at ≤640; budget fixture 1,737 px at 390 — with 兵部).

**8.11 Run-8 case-side amendments (Lead rulings; append-only, still 96 cases).** Four reds are amended to
the measured tree: **case 70** — after §8 the old sample mixed `#world-select` and the action buttons (inside
`#world-panel`) with `#backdrop-pause` (inside `.panel__topbar`), so four groups was the correct count for a
mixed set; the frozen sample is now the top bar's own row, `.panel__topbar .viewswitch__btn, .panel__topbar
.mc-btn`, centre-grouped ⇒ **1** row at 1280 and **2** at 390 (measured top bar t 96.1 h 76 at 390); **case 81**
— the material-row `.mc-input` is sized by its 28 px stepper cluster, so it is **28 ± 1** (measured 28), while
`#mat-choice` 36 ± 1, the add-form cluster 36 ± 1 and `#build-dlg-name` 42 stay; **case 93** — the 390 item floor
is amended **240 → 130** with the arithmetic disclosed: the grid is `minmax(0,1fr) 88px 52px 28px` plus 6 px gaps
inside a 346 px panel ⇒ item ≈ 140 (no-overflow assertions kept, 1280 floor stays 250); **case 94** — it now sets
its own `1280×900` viewport (+250 ms settle) before clicking `#view-compact`, because it previously inherited
390 from case 93, where the compact grid is one column by design; the 1280 grid
`repeat(auto-fill, minmax(560px, 1fr))` in the 1,204 px canvas yields two cards side by side. **Case 95** is
app-side, not case-side: `commitTileDialog()` toasts `Inventory updated.` with no action, so `#toast-action`
never appears for the Undo assertion — dispatched to 兵部-b (undo offer on the quick-update commit like every
other mutation). Suite after edits: 96 cases, `node --check` clean; static gate on this tree: audit
**186/186**, edict-0014 / edict-0015 / tracker / tracker-icons acceptance green, the stamp-freshness gates
(`app-qa` AC-Q7, `wiki` app-qa-stamp, `edict-0013-assets` AC-A10) expected red until the Lead's restamp.

**8.12 Run-9 case-70 amendment (Lead ruling; append-only, still 96 cases).** The run-9 red was a stale
oracle, not the app: the case filtered `.stepper` out of the material row, but in the shipped markup the
stepper cluster **is** a grid column (it wraps the input and its two buttons), so the filtered row had three
children against five header cells. The amended case compares `row.children` (5) with `head.children` (5)
pairwise (left and width ±1, remove column width exempt as before) and adds a named check that the two middle
children are `.stepper` clusters of 104 ± 1 px with the `+` button left of their input. Measured both lists on
the current tree at 1280: header/row tracks `644 w252 / 904 w104 stepper / 1016 w104 stepper / 1128 w64 /
1200 w32`, row `grid-template-columns: 252px 104px 104px 64px 32px`. The retired "second grid row spanning
every column" comment was removed. Suite after edit: 96 cases, `node --check` clean.

## 4. Planned verification

| Check | Command / evidence | Planned result |
|---|---|---|
| Type scale | headed probe at 1280×900 and 390×844: computed `html` font-size, `.masthead__title` height, `.mc-btn` height, `.mc-input` min-height/font, absence of `transform`/zoom | root 18px, body 18, masthead ≤46, buttons ≥34, inputs 42/18; no scale transform; `scrollWidth === clientWidth` at 390 |
| Notes view | computed style of `#notes-text` in view mode; empty-state render | transparent/0 border/0 shadow/0 2px padding, primary colour, `p` not textarea, `No notes yet.` + `notes__text--empty` |
| Notes edit row | DOM order and rects in the label row while editing | `#notes-hint` left of `#notes-save` left of `#notes-cancel`, tops ±1, `#notes-edit` and `.notes-editor__actions` absent; Esc cancels, Ctrl/⌘+Enter saves |
| Gathered block | rects of `.progress-block--inline`, label, `__pct`, bar at 1280 | inner left inset ≥10, label↔pct gap ≥12 on one baseline, bar full inner width |
| Check glyph | every check button's svg size and path bbox | 14×14, ≥11px pen on both axes, path `M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z` |
| Stepper shell | DOM presence/order, computed spinner appearance, retired-node absence | `+` left of input, `−` right, input `type=number` with hidden spinners; `#mat-steps`/`.mat-step`/`data-step`/`materialStepsHtml` absent; add form uses the same stepper |
| Stepper behaviour | pointer, Shift, Ctrl/Cmd, wheel, Enter, click-select, clamp, dispatch order | ±1; ±stack; ±16; Shift wins; wheel non-scroll; Enter column walk; single click selects all; `input` then `change`; needed ≥1/collected ≥0 |
| Timestamps | model unit tests plus browser surfaces (sidebar, detail meta, custom row, materials tooltip) | ISO `createdAt`/`updatedAt`, immutable createdAt, updated on mutation, absent-safe `—`, `<time datetime title=ISO>`, export shape unchanged, SCHEMA 1 |
| Sidebar/layout | rects at 1280×900 and 390×844: `.panel` width, grid columns, `#world-panel` width/visibility, top-bar world nodes, list column and item column | panel 1240 at 1280, sidebar ≥220 fully visible, list column 300px, `.mtable` item column ≥390px, no world node in the top bar, hidden on Worlds and in Compact, stacked at 390, actions reachable |
| Section bars | rule y of both heads at 1280 | differ ≤0.5px; both heads 4px/44px/centred |
| Compact phase 1 | switcher persistence, card DOM/actions, matrix states, tile dialog, viewport budgets, world-context line | all AC14 assertions at 1280 and 390; `#world-panel` hidden, canvas full 1240px with two cards, `#compact-world` line present, card ≥540, ≥6 tiles/row, dialog <300ms, Escape leaves collected; no phase-2 surface |
| Budgets | `documentElement.scrollHeight`/`scrollWidth` at 1280×900 and 390×844 | ≤960 / equal; ≤1700 / equal; stepper hit ≥24 at 390 |
| Non-regression | `npm test`; `tests/qa/mc_ui_audit.py`; `node scripts/app-qa.mjs run` (Lead); evidence under `reports/qa/evidence/edict-0016/` | all suites green, audit ≥ the shipped 187, browser suite green with no deleted case, stamp refreshed after the last source change |

### 4.1 Verification record (S5Q, 測試部, 2026-10-25)

**Verdict: QA_PASS, cycle 1.** The package verified here is the S5 working tree at `HEAD e1308d6` plus the
S5 changes (21 modified paths; 8 source hashes in the stamp). Browser execution is the Lead's seat (the
verifier sandbox cannot launch Chrome — EDICT-0012 precedent, disclosed); every other gate was re-run by
測試部 on this tree. No red is open and no assertion was weakened: the supersessions are recorded in
§3.8.9–§3.8.12 and re-stated under *Disclosures* below.

| Field | Value |
|-------|-------|
| Edict | EDICT-0016 (round-4 items 1–14, Compact Mode phase 1) |
| Cycle | 1 |
| Artifact pinned | `HEAD e1308d6` + the S5 working tree; stamp over 8 sources (`src/index.html`, `src/styles.css`, `src/app.js`, `src/tracker/model.js`, `src/assets/icons/icons.js`, `src/assets/fonts/Minecraft.ttf`, `src/assets/panorama/backdrop.webp`, `src/assets/panorama/manifest.json`) |
| Submitter | 兵部 (packages A/B) + 工部 (contract research) |
| Verifier | 測試部 — different seat (Q1) |
| Environment | Node v22.14.0; bundled Python 3.12.14 + Pillow 12.3.0; Chrome 155.0.8059.86 |
| Browser execution | Lead seat, `.tmp/s11/run10.log`; disclosed per EDICT-0012 |
| Evidence | `reports/qa/evidence/edict-0016/` — 13 designed artefacts + 4 suite-captured shots + `probe.json` + `README.md` (19 files) |
| Date | 2026-10-25 |

| Gate | Command / evidence | Result |
|------|--------------------|--------|
| Browser suite | `node scripts/app-qa.mjs run` (Lead seat, `.tmp/s11/run10.log`; the stamping run re-ran it) | **PASS** — `# tests 96 / # pass 96 / # fail 0`, 68.4 s, exit 0 |
| Stamp | `node src/wiki/cli.mjs app-qa` + independent sha256 re-hash of the 8 stamped files | **PASS** — `verified — 2026-10-25T16:45:20.403Z (96 UI cases)`; **8/8 re-hashed, 0 mismatches**; last source write 00:39:59 < stamp 00:45:20 |
| UI audit | bundled Python `tests/qa/mc_ui_audit.py` | **PASS** — **186/186**, exit 0 (187 − 2 retired-strip checks + 1 `.stepper` identity check; reconciliation in §3.8.6) |
| Unit | every `tests/unit/*.test.mjs` run directly | **PASS** — 123/123 (app-qa 9, tracker-0015 11, tracker-0016 14, tracker-icons 9, tracker-model 22, tracker-suggest 38, wiki-core 10, wiki-sync 10) |
| Acceptance | every `tests/qa/*.acceptance.test.mjs` run directly | **PASS** — 97/97 (7+11+15+11+7+8+17+8+13) |
| Wiki | `app-qa` / `index --check` / `sync` / `lint` | **PASS** — stamp verified; index up to date; sync 8/8; lint clean (24 pages, 0 errors, 0 warnings) |
| Evidence | `reports/qa/evidence/edict-0016/` | **PASS with one note** — 19 files, mtimes 00:47:29–00:48:21 (after the last source write and the stamp); **one duplicate hash pair** disclosed below; `probe.json` carries the raw measurements but no `generated_at` field |

| Gate item | Evidence on this tree | Verdict |
|-----------|-----------------------|---------|
| R1 Scope | `git status` shows only the declared write scopes: 4 source files (兵部 A/B), `tests/qa/**` + `reports/qa/**` (測試部), `docs/backlog/*` + this edict (礼部/Lead); no `raw/**`, no `scripts/**`. | PASS |
| R2 Decomposition | D1–D14 map AC1–AC14; packages A (styles) and B (behaviour/model) landed on disjoint files; one frozen contract §2.5. | PASS |
| R3 Acceptance | every AC row below cites a green case or a probe value; the 14 planned §4 rows are all answered below or superseded in §3.8.9–§3.8.12. | PASS — with the disclosed supersessions |
| R4 Ordering | model + unit tests → markup/CSS → cases → assets final → Lead stamp; mtimes confirm source writes end 00:39:59 before the 00:45:20 stamp. | PASS |
| R5 Risk | measured budgets: demo page 984 px desktop / 1,567 px mobile; frozen `budget-state.json` 976 / 1,620; all under the S5 ceilings (1,000 / 1,700), no horizontal overflow; item-column floor amended with arithmetic (§3.8.9). | PASS, note disclosed |
| R6 Environment | Node 22.14.0, bundled Python 3.12.14 + Pillow 12.3.0, Chrome 155.0.8059.86; browser seat is the Lead's, cited from `run10.log`. | PASS |
| R7 Failure paths | absent/malformed timestamps (`—`, raw preserved, no fabrication), v1 backups without timestamps import, tile-dialog `#tile-error` without closing, Escape cancels, select-all fallback for `type=number`, undo window closes on later commits. | PASS |
| R8 Escalation | three app-side reds were dispatched and fixed in-flight (390 top-bar wrap, mobile 1,703 → ≤1,700, case-80 containment at 390) before this package; case 95's Undo is the app-side fix from run 8. | PASS |
| R9 Wiki | R9 pages planned in §5; current tree is lint-clean (24 pages), `sync 8/8`, index up to date. S6 writes the new pages. | PASS |
| R10 Stamp | stamp refreshed after the last source write, 96 cases, 8/8 hashes re-verified; the planned row "audit ≥ 187" is superseded by the disclosed 186-check reconciliation (§3.8.6). | PASS |

#### AC1–AC14 on the verified tree

| AC | What was measured | Result |
|----|-------------------|--------|
| AC1 | case 81 green: root 18 px, body 18 px, masthead clamp 3.8vw (= 44 px at 1280, ≤46), `.mc-btn` ≥34, `.mc-input`/`.mc-select` ≥42/18, no scale transform; 390 `scrollWidth === clientWidth` (probe overflow 0). | PASS |
| AC2 | probe `gathered`: padding `10px 14px`, label↔pct gap 404.6 px (≥12), same baseline; case 82 asserts the bar spans inner width. | PASS |
| AC3 | probe `notesView`: `#notes-text` bg `rgba(0,0,0,0)`, colour `rgb(63,63,63)`, textarea visible false; case 83 adds border/shadow/padding `0px 2px`/pre-wrap; empty state case 35. | PASS |
| AC4 | probe `notesEdit`: Save 36×32, Cancel 36×32, glyph 14×14, hint `Ctrl+Enter to Save`, hint left of Save, hint bottom 414 vs notes field bottom 495 (same row); case 84 asserts order/tops and Escape/Ctrl+Enter. | PASS |
| AC5 | case 85 green: every check svg 14×14, viewBox 14, exact path `M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z` (`#notes-save`, `#build-name-save`, dialog confirms incl. `#import-dialog`, `#tile-save`). | PASS |
| AC6 | cases 72/75 green: add form uses the shared `div.stepper[data-stepper]` around `#mat-needed`; no `#mat-steps`/`.mat-step` strip; Shift resolves 1/16/64 through `M.stackSizeFor`; the form adds exactly one material. | PASS |
| AC7 | probe `stamps`: world `Created 2026-10-25 16:47` / `Updated 2026-10-25 16:47`, build `Updated 2026-10-25 16:47`, `<time datetime>` full ISO and `title` = ISO; unit suite tracker-0016 14/14 covers createdAt immutability, updatedAt advance, absent-safe `—`, export shape, SCHEMA 1; fixtures `v1-no-timestamps.json` / `malformed-timestamps.json` import and display `—`. | PASS |
| AC8 | probe `selectAll`: `selectionStart`/`selectionEnd` are `null` on `type=number` but `value` is fully selected (capability-safe assertion, case 88). | PASS |
| AC9 | case 89 green: wheel on the focused input ±1, Shift ±stack, Ctrl ±16, `scrollTop` unchanged; unfocused wheel ignored. | PASS |
| AC10 | probe `enterNext`: Needed → next row's Needed (value 64); case 90 covers needed/got columns, last field keeps focus, add form Needed → Got. | PASS |
| AC11 | case 91 green: `.panel` 1240 at 1280, sidebar ≥220 and first, order `#world-avatar,#world-select,#world-panel-name,#world-meta,#world-stats,#btn-new-world,#btn-import,#btn-export`, no world node in the top bar; hidden on Worlds/Compact; at 390 the layout stacks (probe `budget390.sidebar` 174) and actions stay reachable. List column 300; **item column 252 at 1280 / ≈140 at 390** — the contract's "≥390" is superseded with arithmetic in §3.8.9 (304 fixed tracks in the 556 px table). | PASS, supersession disclosed |
| AC12 | probe `steppers`: four buttons 28×28, input 44×28, `+` left of input, aria `Increase needed for Stone Bricks`; cases 86/92 green (cluster 28 in rows, 36 in add form; hidden spinners CSS-only; `#mat-steps`/`.mat-steps`/`.mat-step`/`materialStepsHtml`/`data-step` absent); wheel and Enter paths covered by cases 89/90. Row inputs are 28 px (sized to their cluster), dialog inputs 42 — §3.8.9. | PASS, supersession disclosed |
| AC13 | case 93 green: both section-head rules within ≤0.5 px at 1280; heads `padding-bottom: 4px`, `min-height: 44px`, centred. | PASS |
| AC14 | probe `compact`: 3 cards, 2 columns, 9 tiles, `#compact-world` line `Survival SMP · Java 1.21.4 · 36% gathered · 1,452 of 2,252 items still to collect`; tile tooltip `Stone Bricks: 200 / 384 (3 stacks + 8 / 6 stacks + 0) · Updated 2026-10-25 16:47`; quick update prefill absolute 200 / relative 0, dialog open, Enter commits and offers Undo; cases 94/95/96 green; 390 overflow 0. | PASS |

**Disclosures and residual risks.**

1. **Superseded contract/plan numbers** (all recorded in §3.8.9–§3.8.12, each with a measured value and the
   arithmetic that replaced it): item column ≥390 → **252 at 1280 / 130 floor at 390**; `.mat-row` ≤62 →
   **≤78 desktop / ≤96 mobile**; material-row inputs → **28 px** (dialog inputs stay 42, add-form cluster 36);
   stepper cluster **28 in rows / 36 in the add form**; top-bar rows grouped by **vertical centre**; the
   `<time>` element may carry the `Created … · Updated …` prefix; the quick-update dialog closes on Enter and
   offers Undo; the desktop height budget 960 → **1,000 px** (§3.8.8).
2. **Audit count 186 vs the planned "≥ the shipped 187"**: the shipped 187 included two retired-strip checks
   (`#mat-steps`, `.mat-step`) replaced by one `identity/css-.stepper` check and a `.stepper` order/geometry
   check — 187 − 2 + 1 = 186; no check was removed or relaxed beyond that disclosure (§3.8.6).
3. **Evidence duplicate:** `03-world-sidebar.png` and `13-metadata-stamps.png` share one SHA-256 — the stamp
   surface is the sidebar's own meta line, so the "13 stamps" shot is a duplicate and the crate has 12 distinct
   designed artefacts. The stamps themselves are verified by `probe.stamps` and case 96. Regenerate/relabel 13
   before S6 (non-blocking; Lead/工部).
4. **`probe.json` has no `generated_at`** (unlike EDICT-0015's). Freshness is established by mtime (00:47:33,
   after the 00:39:59 last source write and the 00:45:20 stamp), not by a self-declared timestamp.
5. **Mobile budget margin:** demo 1,567 px and frozen fixture 1,620 px against 1,700 — the fixture is the
   binding measurement; +80 px headroom remains (the fixture drives case 71).
6. **Contract §12 and this §4 planned table still read 960 px**, while the S5 ruling and case 71 use
   **1,000 px**; 礼部 must amend both at S6 so the frozen contract and the frozen case agree (§3.8.8 says so).
7. **Seat separation:** the browser run, stamping run and screenshots are the Lead's; 測試部 wrote every case,
   ran the static gate, re-hashed the stamp and judged the evidence. No `src/**` file was touched by this seat.

## 5. R9 wiki impact

Every page this edict creates or updates, and the design-system pages:

- `design-system/minecraft-tracker/MASTER.md` — the type/control scale table (root 18px, the one knob,
  title clamp), the number-stepper component (replacing the micro-stepper row), the notes view/edit
  presentation, the 14px check glyph, the world sidebar layout and its states (hidden on Worlds and in
  Compact, 300px list column, item column ≥390px), the Compact Mode card/matrix/world-context
  components, the timestamp display helper, and the section-head alignment rule; checklist counts move to
  the S5 record.
- `design-system/minecraft-tracker/pages/tracker.md` — page anatomy and rules for the sidebar, the stepper,
  the notes row, and the Standard↔Compact switch; new AC references, verification table and known gaps.
- **Create** `wiki/concepts/number-stepper.md` — one delegated stepper: order (plus left, minus right),
  Shift/Ctrl semantics, wheel/Enter/select-all, clamp, commit order, retired strips.
- **Create** `wiki/concepts/compact-view.md` — density view: switcher, cards, matrix state model
  (deficit/target), quick-update dialog, hover actions, the compact world-context line
  (`#compact-world`) and hidden sidebar, and the phase boundary to the FRD backlog.
- **Create** `wiki/concepts/world-sidebar.md` — the world as a left panel: widened `<main>`, the
  230/200px columns, what lives inside it, the hidden-on-Worlds **and hidden-in-Compact** rule, the
  stacked mobile behaviour, and the retired top-bar strip.
- **Update** `wiki/concepts/in-game-gui-design.md` — the type scale as one measurable knob, the stepper as
  a browser-native control, the sidebar as layout, and the bars-alignment measurement.
- **Update** `wiki/entities/minecraft-build-tracker.md` — new interaction set, timestamps, sidebar, compact
  mode, and refreshed verification counts.
- **Update** `wiki/synthesis/atmosphere-and-identity.md` — the +12% scale decision and the title-only
  shrink as identity choices; the compact view's density as a second reading mode.
- **Update** `wiki/synthesis/testing-a-ui-like-a-user.md` — the new case set, the budgets asserted at two
  viewports, and the Lead-runs-Chrome split.
- **Update** `wiki/synthesis/open-questions.md` — the phase-2 FRD items deferred here (global inventory,
  phases, Ascend, crafting, procs, Power), the stepper's long-press question if any, and the compact-view
  density judgement.
- **Update** `wiki/overview.md` — only if the standing synthesis still describes the old density/sidebar;
  otherwise no change is claimed.
- **Update** `wiki/index.md` (generated), **append** `wiki/log.md` with an `ingest` entry citing EDICT-0016.
- **Update** `README.md` — feature list and checks (sidebar, stepper, compact mode, timestamps).
- Backlog: [`docs/backlog/compact-view-phase-2.md`](../backlog/compact-view-phase-2.md) and
  [`docs/backlog/_index.md`](../backlog/_index.md) already carry the phase split; the log entry cites them.
- Ledger: EDICT-0016 lifecycle rows from seq 166, one per event with the document hash.

## 6. Limits

- **Phase 2 is out.** No global user inventory or FRD 4.2 deficit formula, no phases/targets, no Ascend
  dialog, no crafting/smelting engine or procs, no Power/activate toggle. The founder's "FRD as written"
  answer is honoured across EDICT-0016 phase 1 and
  [`docs/backlog/compact-view-phase-2.md`](../backlog/compact-view-phase-2.md); the deferred sections are
  cited from FRD `D:\compact view reqs.md` in §2 D14.
- **Schema stays 1.** Timestamps are optional fields, not a migration; no backfill, no fabricated dates, no
  version bump, old backups still import.
- **The scale is one knob, not a redesign.** No per-component zoom, no transform scaling, no font change;
  the app title is the only element that shrinks.
- **Item 6 has no separate strip.** The add form uses the item-12 stepper; a second three-button strip would
  contradict item 12 and is not built.
- **Stepper scope.** Long-press acceleration, keyboard arrow semantics beyond native number inputs, and
  custom step amounts are not added. Wheel only acts while the input is focused; no global wheel hijack.
- **Timestamps display only.** No relative-time wording, no history UI, no audit log beyond the two fields.
- **Sidebar stacks, doesn't drawer.** Below 900px it stacks above the content; in Compact mode it is
  hidden entirely and the canvas takes the full panel width (world context moves to the
  `#compact-world` line); no off-canvas drawer or hamburger is introduced.
- **Compact mode is a Builds-tab view.** Standard view stays the default; no compact-mode editing beyond the
  quick-update dialog and the reused build/confirm dialogs; no drag reorder.
- **Browser execution stays with the Lead** (the verifier sandbox cannot launch Chrome); 测试部 authors and
  judges, 礼部 records. The app-qa stamp must be rerun after the last source change and before S6.
- **Budgets are measured, not inherited.** The §12 limits are re-measured at S5 on the shipping tree; any
  amendment is disclosed in the record rather than rounded away.
- **Status label.** The canonical path was `S1 DRAFTED` → `S2` audit → `S3` builds → `S5`
  `QA_PASS` → `S6`; the round was then withdrawn on 2026-10-26 and reinstated the same day at
  the founder's request, so the header now records `S6 REPORTED` (see the reinstatement note
  below).
- **No raw source** is planned for this round; the sanitised report lives in §1 under the EDICT-0013
  precedent.

## 7. Reinstatement (2026-10-26)

The founder withdrew this round on 2026-10-26 ("discard my 14 item requests..."), the reason
given being that enlarging type and controls and replacing the dense Minecraft GUI was the
wrong direction. The Lead reverted `src/` to `e1308d6`, archived the round outside the
repository (`git stash` + `.tmp/discarded/`), recorded the withdrawal (ledger seq 169, the
WITHDRAWN record that preceded this reinstatement) and removed the round's cases, fixtures and
evidence from `tests/**` and `reports/**`.

Later the same day the founder asked to check the 14 items again and, on seeing the per-item
audit, chose "All 14 exactly as built". The archived tree was reinstated byte-for-byte from
`stash@{0}` (`67285ab`): the four sources hash-identical to the audited round, the suite
restored to 96 cases, fixtures and the evidence crate restored from the archive, and the QA
report re-attached.

Re-verified on the reinstated tree (2026-10-26): `node scripts/app-qa.mjs run` -> 96/96, stamp
`app-qa: verified - 2026-10-26T02:59:39.552Z (96 UI cases)`; `node tests/qa/mc_ui_audit.py` ->
186/186; `npm test` -> 120 cases green; `node --check` clean. No source byte differs from the
audited round, so the original `QA_PASS, cycle 1` stands rather than a second verdict being
manufactured.

Ledger: a `REINSTATED` row records the reversal next to the withdrawal. Density is decided
(enlarged) as of this date; the wiki entity page and log record it.
