# Mass-input research — how other apps make multi-field entry fast

Status: research note for **EDICT-0015, item 9** (task-18). Research and proposals only — no
implementation, no app changes.
Author: 工部 (tooling seat). Date: 2026-10-25.

## What this file is

The founder asked for "deep research into as many other apps with mass input functionality …
how they improve this user flow, then suggest these improvements in a backlog file with
references."

So this file does three things:

1. **Proves where our own flow is slow**, with `file:line` evidence from `src/index.html` and
   `src/app.js` — not opinions.
2. **Catalogue of 11 apps plus 2 standards**, each with the concrete mechanism it uses and a URL
   for the claim. Primary sources only: product help centres, design-system docs, official mod
   pages and repositories.
3. **A ranked copy-next list** of 12 proposals, each mapped to an existing screen, sized S/M/L,
   with an acceptance sketch so 兵部 can implement and 测试部 can test it without re-deriving the
   intent.

Sizes: **S** ≈ half a day of implementation, **M** ≈ one to three days, **L** ≈ more than three
days (including tests and review). Everything here stays inside the repo's zero-dependency
constraints: plain HTML, CSS and JS.

**Source count: 13 references — 11 apps (Airtable, Google Sheets, Microsoft Excel, Linear,
Shopify, Todoist, EMI, JEI, Litematica, Mouse Tweaks, Ragic) and 2 standards (W3C WAI-ARIA
listbox/combobox patterns, GOV.UK Design System text input).** One claim is marked **UNVERIFIED**
and listed again at the end.

## 1. What our mass input looks like today

| # | Surface | Element ids | Where |
|---|---------|-------------|-------|
| 1 | Add-material form | `#add-material-form`, `#mat-item` (hidden), `#mat-choice`, `#mat-needed`, `#mat-collected` | `src/index.html:156-177` |
| 2 | Shared item/icon picker | `#icon-dialog`, `#icon-search`, `#icon-grid` | `src/index.html:326-332`; behaviour `src/app.js:298-435`, `src/app.js:1067-1142` |
| 3 | Build material rows | needed/got inputs, ±1/±10/±stack buttons | `src/app.js:896-930`, `src/app.js:1400-1411` |
| 4 | Materials tab (shopping list) | `#mat-search`, `#mat-filter`, `#btn-copy-list` | `src/index.html:184-217`; render `src/app.js:1606-1636` |
| 5 | Bulk paste dialog | `#bulk-paste`, `#bulk-dialog`, `#bulk-input`, review rows | `src/index.html:352-356`; `src/app.js:1178-1196`, `1434-1477` |
| 6 | Import / export | `#btn-import` → `#file-import`, `<input type="file">`; `importData()` | `src/app.js:981-982`, `src/app.js:1719` |

The picker is fed by a 1,368-item catalog (curated building materials first, then alphabetical);
it renders in batches of 120 (`PICKER_BATCH = 120`, `src/app.js:240`) and appends more when you
scroll (`src/app.js:317-323`, sentinel `src/app.js:405-407`).

## 2. Slow spots we can prove from the code

### S1 — Every material costs a full picker round-trip

The add form keeps the chosen item in a **hidden** input (`#mat-item`, `src/index.html:160`);
the only way to fill it is the `#mat-choice` button, which opens the picker
(`src/app.js:940-943`). On a successful add the code **clears the choice again**:

```js
setMaterialChoice('');                 // src/app.js:962
els['mat-needed'].value = '1';         // src/app.js:963
els['mat-collected'].value = '0';      // src/app.js:964
els['mat-choice'].focus();             // src/app.js:966
```

So adding a second material always means: click `Choose item…` → dialog opens → type a query →
click a tile → dialog closes → set Needed → Add. That is the whole loop, per material. A 20-item
material list is 20 modal round-trips.

### S2 — Keyboard users cannot pick an item without tabbing through the grid

The picker's search field deliberately does **nothing** on Enter in item mode:

```js
if (event.key !== 'Enter') return;
event.preventDefault();
if (ui.pickerMode === 'item') return;   // src/app.js:1079 — "a click on a tile is the only way to choose"
```

The only other keyboard handlers are Escape (`src/app.js:1129-1142`). Tiles are plain buttons
(`<button … role="option">`, `src/app.js:400-403`), so with 120 rendered tiles the keyboard path
to the first item is up to 120 Tab presses. There is no arrow-key navigation, no Home/End, no
type-ahead over the grid.

### S3 — `Needed` has no unit, no hint, and no link to stack size

```html
<label class="field__label" for="mat-needed">Needed</label>
<input class="mc-input" id="mat-needed" type="number" min="1" step="1" value="1" required>
```

(`src/index.html:167-168`.) The field is items, but nothing on screen says so, while the app
already knows each item's stack size (`stackSizeFor()`, `src/app.js:78-80`, backed by
`window.MC_ICON_STACKS`). A first-time user has to guess whether "64" means 64 blocks or one
stack.

### S4 — Paste is one-material-per-line, with no columns and no "did you mean"

`M.parseBulk` splits strictly on newlines (`src/tracker/model.js`, `parseBulk`) with the line
shape

```js
var BULK_LINE = /^\s*([-+]?)\s*(\d+)?\s*(?:[x×]\s*)?(.+?)\s*$/;   // src/tracker/model.js:313
```

so `64 stone bricks`, `- 32 glass`, `20x oak log` work — but a spreadsheet block
(`Needed <TAB> Got <TAB> Item`) does not, because the whole line becomes one item label. Review
rows for unmatched lines are rendered as `not in the catalogue`
(`src/app.js:1445`) with no nearest-match suggestion, so a typo must be fixed by retyping the
line.

### S5 — The Materials tab is read-only

The aggregated shopping list renders plain text spans, not inputs:

```js
'<span class="num">' + row.needed + '</span>' +                 // src/app.js:1625
'<span class="num got-col">' + row.collected + '</span>' +      // src/app.js:1626
```

(`src/app.js:1621-1631`.) Editable quantity fields exist only inside a build's material rows
(`[data-mat-field="needed"]` / `collected`, `src/app.js:1402-1411`). To correct a quantity you
must find the build that owns the row and edit it there — and a row aggregated across three
builds has no single owner.

### S6 — Import is file-only

`#btn-import` forwards to a hidden file input (`src/app.js:981-982`) and `importData()` reads a
`File` (`src/app.js:1719`). There is no paste path, so moving a backup between two machines
requires a filesystem round-trip. (The Lead's plan for an `#import-dialog` is not in the tree yet:
a grep for `import-dialog` in `src/index.html` and `src/app.js` returns nothing.)

## 3. The catalogue — what each product actually does

Each entry: the mechanism, the evidence, and the one rule we should take from it.

### 3.1 Paste a whole block, then review before committing

**Airtable** — the canonical "paste a table into an app" flow. You copy a block of cells, click
the `+` on a new blank record and paste into its primary cell; Airtable offers to widen the view
first ("You may need to **'Expand the table'** by clicking Continue in the modal that appears
after you paste the data"), then creates one record per pasted row. Two documented caveats matter
for us: **"Pasting matches fields by position, not by name"**, and size limits (100,000
characters per pasted record; large pastes should be batched, roughly 200–300 records at a time,
~1,000 for linked fields).
https://support.airtable.com/articles/4087973664-adding-duplicating-and-deleting-airtable-records

Airtable's CSV *import extension* goes further: a mapping step with one dropdown per CSV column,
and the mapping is remembered for later imports (25,000-row limit).
https://support.airtable.com/articles/3067164948-csv-import-extension

*Rule for us:* pasted text should open a **review dialog** before anything is written, rows must
be large enough to check, and a row that cannot be fully understood must stay visible rather
than be dropped. Never write on paste alone.

**Google Sheets** — handles the other half of the problem: pasted text that arrives as one
column. `Data > Split text to columns` offers a separator choice (with auto-detect), and the
paste-options control can split immediately after pasting.
https://support.google.com/docs/answer/6325535

*Rule for us:* when a pasted line contains tabs, split it into columns instead of treating the
whole line as an item name (directly fixes S4).

**Microsoft Excel** — *Flash Fill*: "Flash Fill automatically fills your data when it senses a
pattern." You type one example in a neighbouring column, the rest of the column previews the
inferred values, and Enter accepts them; it can also be set to run automatically.
https://support.microsoft.com/en-us/office/using-flash-fill-in-excel-3f9bcf1e-db93-4890-94a0-1578341f73f7

*Rule for us:* if we ever infer a column (for example "quantity = first integer"), infer it once,
**show the preview**, and only write on explicit confirmation. Silent inference is not acceptable
in a budget tracker.

### 3.2 Select many, then act once

**Linear** — a keyboard-first selection model: `X` selects, `Shift`+click/arrows select ranges,
`Cmd/Ctrl+A` selects everything the current filter shows, and "Common bulk actions will show up at
the bottom" as an action bar; `Cmd/Ctrl+K` opens a command bar. `Esc` clears the selection.
https://linear.app/docs/select-issues

*Rule for us:* if the picker ever becomes multi-select, the selected count and the single commit
button must be visible together, and Escape must clear the selection before it closes the dialog.

**Shopify admin** — the bulk editor: select list items with checkboxes, click *Bulk edit*, choose
which properties to update, then make the change once for all selected items.
https://help.shopify.com/es/manual/shopify-admin/productivity-tools/bulk-editing (Spanish locale;
the `/en/` path returned 404 on 2026-10-25 — see §6)

*Rule for us:* "choose the property, then edit once" is the mental model to reuse for stack
buttons applied to a filtered set of material rows.

**Ragic** — spreadsheet-like multi-cell work inside a form grid: select fields by dragging or
with arrows, then **"drag the lower-right corner of a field value cell to select other fields and
copy the value to all selected fields"** — a fill handle.
https://ragic.co/intl/en/doc-kb/267/selecting-multiple-fields-at-once-for-operations

*Rule for us:* a fill-down affordance on the Needed/Got columns would make "20 rows all need 64"
one gesture instead of 20 edits (see S5).

### 3.3 One visible field, explicit syntax

**Todoist** — quick add: `Q` opens a single field; inline tokens carry the structure
(`@label`, `#project`, `/section`, `p1`–`p3`, `!reminder`, `{deadline}`, `+person`), natural
language covers dates ("tomorrow at 4pm"), and there is a global shortcut on desktop. The help
page also documents the failure mode: recognition can misread ordinary words — their example is
"monthly" being taken as a date — and the user clicks the highlighted word to turn it back into
plain text.
https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz

*Rule for us:* a one-field add ("`64 stone bricks`" → item + quantity) is legitimate and fast,
but the parse must be **visible and reversible** before commit; no guessing behind the user's
back.

### 3.4 Pickers and keyboard models

**W3C WAI-ARIA listbox pattern** (what `#icon-grid` already declares) — a vertical listbox takes
Down/Up for the next/previous option, Home/End for first/last ("strongly recommended for lists
with more than five options"), type-ahead for all listboxes ("especially those with more than
seven options"), Space to toggle selection, and supports `aria-activedescendant` as an
alternative to moving DOM focus between options.
https://www.w3.org/WAI/ARIA/apg/patterns/listbox/

*Rule for us:* the 1,368-tile grid needs arrow keys + Home/End + type-ahead with
`aria-activedescendant`, not 120 tab stops (fixes S2).

**W3C WAI-ARIA combobox pattern** — the model for "type to filter, arrow into the results":
`role=combobox` with `aria-expanded`, `aria-controls` and `aria-activedescendant`, popup
`role=listbox`; Down opens or moves into the popup, Enter accepts the active option, Escape
dismisses.
https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

*Rule for us:* the add form's item control should be an editable combobox that owns the search
field, so "type the name and press Enter" works without a modal at all.

**JEI** (Minecraft recipe viewer) — the item/ingredient list is the ecosystem's keyboard
benchmark; the repository's commit list includes *"Close #4540 Add keyboard navigation to the
ingredient list"* across the Common/Fabric/Gui/NeoForge modules.
https://github.com/mezz/JustEnoughItems · https://github.com/mezz/JustEnoughItems/wiki

*Rule for us:* Minecraft players already expect to search and pick items by keyboard; our picker
should match JEI's model rather than a web-only click target.

**EMI** (Minecraft recipe viewer) — recipe trees exist "for breaking down the cost of a complex
craft, showing you every step, how many base ingredients you need, and what you'll have leftover";
it also supports tag-aware display — "such as 'Planks' instead of slowly rotating through every
plank in the game" — plus craftable mode and favourites.
https://modrinth.com/mod/emi

*Rule for us:* two ideas map directly: (a) show the material total as a *sum across variants*, the
way EMI sums a recipe tree; (b) group by tag for search ("planks", "wool") instead of forcing the
user to remember 11 wood names.

### 3.5 The Minecraft material-list analogue

**Litematica** — client-side schematic mod whose material list is the closest analogue to our
shopping list: it analyses the loaded schematic, tracks your inventory, and shows required blocks
with icons/names in a HUD. The material-filter addon documents "filter the material list by search
query and display only the required blocks in the Info HUD" (Material List → Open Filter).
https://github.com/maruohon/litematica ·
https://github.com/EnotikSergo/litematica-material-filter
(Secondary description of the list/inventory tracking:
https://deepwiki.com/maruohon/litematica/8.2-material-lists-and-inventory)

*Rule for us:* our Materials tab already speaks this language; the missing piece is that
Litematica's list is a **live HUD you can filter**, while ours cannot be edited where it is read
(S5). Adding search-to-edit and a fill handle closes the gap.

**Mouse Tweaks** — the inventory-input habits our users arrive with: drag placement, and the wheel
moving items — "When you scroll down on an item stack, its items will be moved one by one. When
you scroll up, items will be moved into it."
https://modrinth.com/mod/mouse-tweaks

*Rule for us:* wheel-over-a-quantity is a familiar gesture, but in an inventory a mis-scroll is
visible immediately; in a tracker it is silent data loss. If we add wheel steps, clamp to the
model and show a live total (see §5).

### 3.6 Form-field guidance

**GOV.UK Design System — text input** — the reference for the individual fields:

- labels are visible and above the input; placeholder text is never the label;
- hint text exists "for help that's relevant to the majority of users", and should be "a single
  short sentence";
- units belong in a **prefix or suffix** ("Cost, in pounds"), not in the label;
- "Do not use `<input type="number">` unless your user research shows that there's a need for
  it" — their stated reason is accidental increment by scroll and no explicit feedback;
- never disable copy/paste; error messages are specific to the state ("must be a number, like
  30").

https://design-system.service.gov.uk/components/text-input/

*Rule for us:* add a hint and a unit suffix to `Needed`/`Got` (fixes S3); keep `type="number"`
because the frozen app contract requires it and the spinners are already hidden
(`tests/qa` AC5), but treat arrow/wheel stepping as a feature we must clamp and announce.

## 4. Ranked: copy these next

Ordered by value ÷ effort for the founder's complaint ("adding many materials is slow").
All proposals are additive: no proposal removes an existing path, so they are safe to land one at
a time.

| # | Proposal | Where | Effort | Drawn from | Acceptance sketch |
|---|----------|-------|--------|-----------|-------------------|
| 1 | **Arrow-key picker navigation, and Enter picks the active tile in item mode** | `#icon-grid`, `#icon-search` | S | W3C listbox + combobox; JEI | From `#mat-choice`: Enter opens the picker, type `stone b`, Down, Enter → the item is filled and the dialog closes; zero mouse events; `role=listbox`/`option` unchanged and `aria-activedescendant` tracks the active tile. |
| 2 | **"Add and choose another": keep the picker open across adds** | `#add-material-form` | S | Linear/Shopify "act once, stay in the flow" | With the toggle on, Add commits the row and reopens the picker on the search field; three materials added in one dialog session; Needed resets to 1 per row. |
| 3 | **Column-aware paste**: accept `Needed <TAB> Got <TAB> Item` (and 2-column) in the bulk dialog | `#bulk-input`, `M.parseBulk` | M | Google Sheets split; Airtable import mapping | Pasting a 3-row tab block from a spreadsheet produces 3 review rows with both quantities; unknown names still listed; 2-column paste leaves Got = 0. |
| 4 | **Editable Materials-tab rows + fill-down** | `#world-material-body` | M | Ragic fill handle; Shopify bulk edit | Needed/Got cells are editable in place with `type=number`; dragging the fill handle down a column copies the value; one commit per gesture; the tab keeps `role=table` semantics. |
| 5 | **Unit hint + suffix on Needed/Got, and the chosen item's stack size** | `#mat-needed`, `#mat-collected` | S | GOV.UK hint/prefix-suffix | Hint text "in items" (single sentence, linked via `aria-describedby`); after choosing an item the form shows "stack of 64"; `type=number` retained and spinners stay hidden (`src/styles.css:371-372`). |
| 6 | **"Did you mean …" on unmatched paste rows** | bulk review | S | Airtable review rows; Excel preview | A typo like `oc log` renders a suggestion chip that fills the row on click; no row is silently dropped; the count of unmatched rows is announced. |
| 7 | **One-field quick add (combobox) alongside the dialog** | `#add-material-form` | M | Todoist quick add; W3C combobox | Typing `64 oak log` + Enter adds Oak Log with Needed 64 without opening the dialog; the parse is shown before commit and can be edited. |
| 8 | **Multi-select in the picker → "Add N materials"** | `#icon-dialog` | L | Linear multi-select; W3C listbox multi-select | With multi-select on, tiles toggle with Space and show a count badge; one commit adds N rows with Needed 1; Escape clears the selection first, then closes. |
| 9 | **Copy the shopping list as TSV** | `#btn-copy-list` | S | Google Sheets/Airtable column mapping | The clipboard payload is header + tab-separated columns (item, needed, got, left); pasting into a spreadsheet fills 4 columns. |
| 10 | **Paste-a-backup import dialog with preview** | new `#import-dialog` (planned) | L | Airtable import mapping screen | Paste JSON → preview counts (worlds/builds/materials) → choose merge or replace → apply; malformed input shows a specific error and writes nothing. |
| 11 | **Tag-aware search** (`planks`, `wool`, `logs`) | `#icon-search`, `#mat-search` | M | EMI tag display | Searching `planks` returns all plank variants via `MC_ICON_CATEGORIES`/a small synonym table; matches are grouped and the count hint reflects the group. |
| 12 | **Undo for bulk and multi-add commits** | toasts | M | Linear action bar; Airtable review (safety net) | After a bulk add the toast offers Undo; activating it (mouse or keyboard) restores the exact previous state; a second add replaces the undo window. |

Notes on the ranking:

- **1 and 2 are the cheapest real fix** for the founder's complaint. Together they turn
  "click, dialog, type, click, type, Add" into "Enter, type, Down, Enter, type, Enter" and remove
  the per-material dialog round-trip.
- **3, 4, 6 and 9** improve the paste/edit loop without touching the frozen app contract.
- **8 and 10** are the large pieces; they should not start before 1–4 land, because both depend
  on the same state/reset discipline.
- **11** already has its data: EDICT-0013 added `window.MC_ICON_CATEGORIES` with the derivable
  categories (spawn egg, potion, tool, armour, vehicle, music disc).

## 5. Patterns we should not copy

| Pattern | Where it comes from | Why not |
|---------|---------------------|---------|
| **Positional paste** ("field by position, not name") | Airtable | Silent misalignment: a list with three columns pasted under four headers quietly shifts values into the wrong fields. Our review must always show the parsed name and both quantities. |
| **Automatic pattern fill without confirmation** | Excel Flash Fill (auto mode) | A wrong column in a budget is data corruption the user may not notice. Preview + explicit accept only. |
| **Free-form natural-language parsing as the only path** | Todoist | Todoist's own docs admit misfires ("monthly" read as a date). Keep the structured forms and the paste review; make any parsing visible and editable. |
| **Modifier-only shortcuts as the only multi-select** | Linear (`X`) | Undiscoverable for keyboard-only and touch users. If multi-select ships, give it a visible toggle and document it in the picker's hint line. |
| **Wheel-scroll value changes with no clamp/announcement** | Mouse Tweaks (fine in an inventory) | In an inventory a mis-scroll is visible; in a tracker it silently changes a number that later drives the shopping list. Any wheel stepping must clamp at the model and update the visible total. |
| **Infinite scroll as the only way to reach later items** | our picker today | With 1,368 items and no arrow keys, "later items" means scrolling and tabbing. The hint (`showing N of M`) is good; it needs keyboard navigation to be a complete answer. |

## 6. UNVERIFIED and open limits

- **Shopify English help URL** — `https://help.shopify.com/en/manual/shopify-admin/productivity-tools/bulk-editing`
  returned HTTP 404 when fetched on 2026-10-25; the locale-stemmed pages (`/es/`, `/de/`, `/ko/`,
  `/zh-TW/`) resolve and describe the same three-step flow. The English canonical URL is therefore
  **UNVERIFIED**; the mechanism is not.
- **Notion paste-into-database** — only a third-party blog describes it; no primary Notion help
  page was found, so it is deliberately omitted from the catalogue rather than cited weakly.
- **JEI commit date** — the repository listing shows the keyboard-navigation commit with a date
  that reads as 2026-10-25; the commit *subject* is quoted, the date is **UNVERIFIED** and not
  relied on.
- **Litematica material-list detail** — the HUD/inventory behaviour is documented by the addon
  README and a generated wiki (secondary); the base repo is linked for identity, not for that
  claim.
- **Airtable "Expand table" wording** — quoted from the help page as fetched; the button label
  may have changed since.
- **GOV.UK numeric-input advice** is general web guidance, not Minecraft-specific; it conflicts
  with our frozen AC5 (`type="number"`), which is why the proposal keeps the type and adds hints
  instead.

## 7. References

| Reference | Supports |
|-----------|----------|
| https://support.airtable.com/articles/4087973664-adding-duplicating-and-deleting-airtable-records | paste-into-grid flow, expand-table modal, positional mapping, size limits |
| https://support.airtable.com/articles/3067164948-csv-import-extension | column mapping, remembered mappings, row limit |
| https://support.google.com/docs/answer/6325535 | split text to columns, separator auto-detect |
| https://support.microsoft.com/en-us/office/using-flash-fill-in-excel-3f9bcf1e-db93-4890-94a0-1578341f73f7 | Flash Fill pattern inference + preview |
| https://linear.app/docs/select-issues | multi-select model, bulk action bar, command bar |
| https://help.shopify.com/es/manual/shopify-admin/productivity-tools/bulk-editing | select → bulk edit → choose properties → edit once |
| https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz | quick-add syntax, natural-language dates, misparse correction |
| https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ | listbox keyboard interaction, `aria-activedescendant`, multi-select |
| https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ | combobox roles/states and keyboard model |
| https://github.com/mezz/JustEnoughItems · https://github.com/mezz/JustEnoughItems/wiki | ingredient-list keyboard navigation |
| https://modrinth.com/mod/emi | recipe-tree cost breakdown, tag display, craftable mode |
| https://github.com/maruohon/litematica · https://github.com/EnotikSergo/litematica-material-filter | material list + HUD filter |
| https://modrinth.com/mod/mouse-tweaks | wheel/drag item-moving habits |
| https://ragic.co/intl/en/doc-kb/267/selecting-multiple-fields-at-once-for-operations | multi-cell select + fill handle |
| https://design-system.service.gov.uk/components/text-input/ | labels, hints, prefix/suffix units, number-input caution |
