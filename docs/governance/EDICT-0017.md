# EDICT-0017 — Shared world inventory, priority allocation, and the Standard-view rework

- **Issued by:** 皇帝 — 2026-10-26, round 5. The wording quoted in §1 is the S0 brief's
  transcription (`.tmp/s13/brief-0017.md`) of the founder's message (m04166); this round has no
  raw source of its own, so the EDICT-0013 sanitisation precedent applies: the sanitised wording
  is recorded here, in the edict body.
- **Drafted and recorded by:** 礼部 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (`src/tracker/model.js` schema 2, migration, allocation, units;
  `src/index.html` + `src/app.js` + `src/styles.css` for the Standard-view rework, the inventory
  dialog, build-list rows, sidebar and grid), 工部 (no product-side change expected; no asset
  regeneration), 礼部 (design system, README, wiki), 测试部 (`S5Q`, delegated verifier). 太子: no
  raw intake planned for this round.
- **Browser execution:** the Lead runs every Chrome launch at `S5` — "browser hands, not
  verifier"; 测试部 authors the frozen cases, analyses the artefacts, and judges.
- **Recorded:** 2026-10-26 (Asia/Singapore) · **Status:** `S5Q QA_VERIFY` — QA_PASS cycle 1 at
  ledger seq 178; the report is [`reports/qa/edict-0017-qa.md`](../../reports/qa/edict-0017-qa.md)
- **S5 outcome:** browser 128/128, audit 186/186, npm test 152/152, app-qa stamped 128 cases at
  `2026-10-26T06:37:19.750Z`; evidence crate in `reports/qa/evidence/edict-0017/`
- **Amends:** [EDICT-0016](EDICT-0016.md) — the Standard-view number stepper retires from
  material rows (inventory is shared and row quantities are only `Needed`; contract §3), the
  materials table loses its fixed-height inner scroll box, the notes/status/coords surfaces
  regroup into `#build-header`, and the sidebar/build-list behaviour is reworked; the Compact view
  and its phase boundary are untouched. [EDICT-0015](EDICT-0015.md) — the sidebar, its persisted
  state, the import dialog and the section-head alignment are reused. [EDICT-0014](EDICT-0014.md)
  — `#mc-tooltip` carries the grid-chip and stamp tooltips; paging, empty states, bulk paste,
  undo and recents keep working. [EDICT-0013](EDICT-0013.md) — the notes affordances and stamp
  surfaces are reused, not redesigned.
- **Supersedes:** contract-0016 §2 (the Standard-view number stepper) where it disagrees, and any
  earlier top-bar statistics rule; every id not named in contract-0017 keeps its current
  behaviour.
- **Relates:** [EDICT-0012](EDICT-0012.md) — `M.stackSizeFor` powers the per-item stack unit and
  the shulker arithmetic. [EDICT-0010](EDICT-0010.md) — no asset change is expected.

## 1. The report

**S2 amendment 2026-10-26:** contract corrected for B1–B8; block re-frozen at 176 lines / sha256
`486b1f5c…` (this is the file's raw-byte hash; §2 block bytes equal the file bytes — the earlier
`4dab6447…` note was an LF-normalised splice hash and is superseded).

On 2026-10-26 the emperor filed round 5: a shared per-world inventory, deterministic priority
allocation, and a full Standard-view rework. Four decisions were taken before S0 and are binding:

- **Two rounds.** This edict carries the shared-inventory foundation and the complete
  Standard-view rework; the Compact rewrite, phases, recipes and the visible effort estimate are
  EDICT-0018. Nothing here may leave the app in a state where round 6 needs a second migration.
- **Migration.** Each material's per-build `collected` sums into one per-world inventory per item
  (`Σ collected` across builds, matched case-insensitively on the item name).
- **Effort rate.** A fixed **30 items/min** constant lives in the model; this round does not show
  minutes in the UI (round 6 does where a row already shows `~stacks`).
- **Stacks unit.** Each item's own stack size (`MC_ICON_STACKS`, default 64); a shulker box is
  27 × that item's stack size, so a shulker of Ender Pearls is 432, not 1,728.

The items are reproduced below as the S0 brief's transcription, grouped as filed. Each is followed
by the acceptance sentence the round is judged by; the numbering within each group is one-to-one.

### 1.1 Standard view

> 1. One progress summary everywhere: `213 / 727 items gathered (29%)`, one bar per panel. The three current phrasings (progress-block, "N of M items gathered · K to go", list subtitle `53% gathered · 4 materials · 120 / 64 / -40`) all disappear.
> 2. Materials table grows with its content; the page scrolls. No fixed-height inner scroll box; the "Add a material" panel stays below the last row and never overlaps it.
> 3. Stamps are relative (`Updated 5 min ago`) with the exact local timestamp in a tooltip.
> 4. `Got` comes from the world's shared inventory. Three builds needing Stone Bricks all show the same inventory count and how much of it each one is covered by.
> 5. Allocation is deterministic in priority order: a surplus in one build is never double-counted in another. Show a `surplus` / `shared with N builds` indicator.
> 6. Surplus shown honestly: `Got 482 / Needed 97` → `+385 surplus` in the positive colour; never a negative "Left".
> 7. Row simplification: `Needed` is editable text (click to edit), `Got` is the shared inventory value (read-only), one `Update` action opens the dialog, `Remove` lives in a row overflow menu (confirmation + undo toast).
> 8. Row click or item icon opens **Update inventory**: two inputs — `Inventory` (absolute) and `Add/Subtract` (delta; leading `-` subtracts; `2s+10` stack shorthand) — green check confirms, Escape cancels. Same dialog everywhere (round 6 reuses it).
> 9. Above the table: sort by `remaining | name | category` and a `Hide completed` toggle.
> 10. `Table | Grid` toggle in the detail pane. Grid = icon chips, left-to-right then top-to-bottom, remaining above the icon (total required when complete), completed chips dimmed, incomplete bright; hover tooltip carries the name and stack notation (`184 = 2 stacks + 56`).
> 11. Clicking a chip opens the same inventory dialog.

**AC1.** Each panel renders exactly one progress sentence, produced by `M.progressText(covered,
needed)` in the form `"213 / 727 items gathered (29%)"`; the three retired phrasings are absent
from the DOM, and a zero-need world renders `"0 / 0 items gathered (0%)"`.

**AC2.** At 1280×900 the materials region has no element with `overflow: auto|scroll` wrapping
`#material-body`; the page's `scrollHeight` grows with row count, and the add-material form's top
is at or below the last row's bottom (no overlap, no fixed-height box).

**AC3.** Every `.stamp[data-iso]` renders visible text equal to the UTC slice `YYYY-MM-DD HH:MM`
(asserted against `M.formatStamp`) and carries a `title` attribute equal to the raw ISO stamp
(asserted separately on each stamp surface); no stamp renders a local-time conversion.

**AC4.** For any item, every active build listing it shows the same `[data-mat-got]` value — the
world's shared inventory count — and its own split from `M.allocate`: `[data-mat-covered]`,
`[data-mat-remaining]` and, when the world has surplus, `[data-mat-surplus]` with class
`is-surplus`; no Left/remaining value is negative.

**AC5.** `M.allocate` is deterministic and priority-ordered: for a fixture where two builds need
the same item and the inventory covers only the first, the first is fully covered, the second is
not, and the sum of covered amounts never exceeds the inventory; the DOM shows `[data-mat-shared]`
reading `shared with N builds` for that item, present only when `N > 1` and absent when one or
zero builds list it.

**AC6.** A row whose inventory exceeds its need renders `+N surplus` with class `is-surplus`; no
count in the DOM is negative and no `Left` cell can show a minus sign.

**AC7.** A row has editable `Needed` (`input[type="text"][inputmode="numeric"]`, click selects,
blur/Enter commits, Escape reverts), read-only Got, `[data-mat-update]`, and either no Remove
control or one inside `[data-mat-menu]`; no `[data-step]`, `.stepper__btn` or `.mat-steps` exists
anywhere in the Standard detail.

**AC8.** Clicking the row (not an input or button) or the item icon opens `#inventory-dialog` with
`#inv-absolute` and `#inv-delta`; `2s+10` parses and commits, an invalid value shows `#inv-error`
without committing, `#inv-ok` confirms and Escape cancels unchanged; the same dialog opens from
every entry point.

**AC9.** `#mat-sort` offers `remaining` (default), `name`, `category`; changing it re-renders
deterministically; `#mat-hide-done` hides only rows with `remaining === 0` and defaults off.

**AC10.** `#mat-view-table` / `#mat-view-grid` switch between `#material-table` and
`#material-grid`; grid chips are `button.mat-chip[data-mat]` in DOM order, remaining above the
icon (total required when complete), completed chips carry `is-done` and dim, and a chip's tooltip
carries the item name and stack notation.

**AC11.** Clicking any `.mat-chip` opens `#inventory-dialog` in the same state as the row action.

### 1.2 Build list (middle column)

> 1. Compact rows: icon, name, status badge, mini progress bar; the long subtitle goes away.
> 2. Drag-and-drop reordering sets priority; the top-priority build gets a distinct accent and a `1` marker.
> 3. Hover reveals `Activate/Deactivate` and `Remove` (confirm + undo toast).
> 4. Inactive builds are excluded from totals and the shopping list, shown dimmed, and follow a sidebar setting: `Priority order | Move to end | Hide`.

**AC12.** `.build-entry[data-build]` contains a slot, a name, a badge and a mini bar/fill; no
subtitle line and no percentage subtitle remain.

**AC13.** Dragging `.build-entry__grab` and dropping reorders the world's `builds` array via
`M.moveBuild`, persists across reload, and index 0 carries `build-entry--top`, a distinct accent
and a visible `1` marker.

**AC14.** Hovering a build row reveals `[data-build-activate]` and `[data-build-remove]`; remove
asks for confirmation and offers an Undo toast, and the activation toggle flips `active`.

**AC15.** Inactive builds are excluded from `#world-progress`, `#detail-progress` and
`#shopping-list`; they render dimmed under `priority`, at the end under `end`, and not at all under
`hide`, per `#inactive-mode`.

### 1.3 Sidebar and layout

> 1. Wider list and detail panes, collapsible sidebar, less empty space at the page bottom.
> 2. Sidebar shows the world's overall progress once, plus a `Shopping list` button opening the combined remaining materials across active builds.
> 3. Unit toggle `Items | Stacks | Shulkers` applied consistently to Needed, Got, Left and the progress numbers, in the Standard detail and everywhere else this round touches.

**AC16.** At 1280×900 `#main` is 1232 px wide, `#world-panel` 190–210 px, the build list is at
least 360 px and the detail pane at least 640 px (EDICT-0016 baseline 230 / 340 / 608 — the change
widens the content columns, never narrows them); `#sidebar-toggle` collapses `#world-panel` to a
rail, the page-bottom space is reduced, and the collapsed state survives reload.

**AC17.** The sidebar renders one progress summary (`#world-progress` via `M.progressText`) and
`#btn-shopping-list` opens `#shopping-dialog` whose rows equal `M.shoppingList(world)` — active
builds only, combined remaining, descending.

**AC18.** `#unit-toggle` (`items` default, `stacks`, `shulkers`, `aria-pressed`, persisted)
formats Needed, Got, Left/remaining, chips, progress numbers and the shopping list through
`M.formatUnits`; switching units never changes stored values; shulker formatting uses 27 × the
item's stack size.

### 1.4 Item picker and notes

> 1. `Paste list…` gains a preview (parsed rows, duplicates merged, errors listed) before import.
> 2. Notes, Status and Coords group into one compact header card above the materials.

**AC19.** `#bulk-paste` opens `#paste-preview` with `#paste-rows` (parsed, duplicates merged) and
`#paste-errors` before anything imports; `#paste-ok` imports only the reviewed rows and
`#paste-cancel` imports nothing.

**AC20.** `#build-header` groups the name/actions, status control, coords and notes above the
materials; `#build-notes`/`#notes-text` and the existing edit affordances keep working inside it.

### 1.5 Accessibility and persistence

> 1. Tab reaches each material row, Enter opens the inventory dialog, Escape closes it.
> 2. Everything persists in localStorage; Export/Import JSON keeps working and accepts both schema generations.

**AC21.** Tab order reaches each `.mat-row` and its controls; Enter on a focused row opens
`#inventory-dialog`; Escape closes it; focus returns to the invoking element.

**AC22.** State persists to `localStorage` (`mc-build-tracker:v2`); Export emits version 2; Import
accepts a v1 or v2 document, migrates v1 once, and leaves data untouched on a refused file.

## 2. Planned architecture

The frozen integration contract is `.tmp/s13/contract-0017.md`, reproduced byte-identically in
§2.5. Where this plan and that file disagree, the file wins; where the file and the shipped code
disagree about something neither names, the builder reports it to the Lead instead of inventing a
third name. The work is split into two disjoint packages for 兵部: the model/migration/allocation
unit (`src/tracker/model.js`, unit-tested first) and the Standard-view surfaces
(`src/index.html`, `src/app.js`, `src/styles.css`). No `src/**` change lands without the app-qa
stamp being refreshed after it (R10).

### D1 — Schema 2 with one automatic migration

`SCHEMA` becomes `2`; the storage key is `mc-build-tracker:v2` and the old `:v1` key is read once.
`M.migrateV1(state)` is pure, idempotent and never throws on malformed input; the loader calls it
automatically and stamps `migratedFrom: 1` on the state for one session, surfaced once in the
save/import path without modal spam. `M.validate` accepts v2 and rejects a v2 shape that still
carries `material.collected`.

### D2 — The migration sums `collected` into the world inventory

For each world: `inventory = {}`; for each build's material, `inventory[itemSlug(item)] +=
toInt(collected)` (case-insensitive name match, malformed numbers clamp to 0); `collected` is
dropped; `build.active = true` unless the stored value was `false`; `builds` order is preserved
exactly; unknown fields are dropped. Fixtures are taken from the real v1 shape.

### D3 — Allocation is computed in priority order, never stored

`M.allocate(world)` walks active builds in array order with a running inventory balance; each
material's covered amount is `min(needed, remaining)` in material order, per-build totals are
sums, `surplus` is the positive remainder and `shared` is the count of active builds with a
positive need. A completed build still consumes inventory (it was built) unless `active: false`;
`remaining` surfaced to the DOM is `max(0, needed - covered)`.

### D4 — One progress sentence and one bar per panel

`M.progressText(covered, needed)` returns `"213 / 727 items gathered (29%)"` and the zero-need
form `"0 / 0 items gathered (0%)"`, rounded once at the end. The detail panel, the sidebar and the
shopping summary consume it; the progress-block phrasing, the "N of M items gathered · K to go"
line and the list subtitle are deleted.

### D5 — Units are formatting, not stored values

`M.formatUnits(n, slug, unit, stacks)` formats `items`, `stacks` (`n stacks + r`, `n stacks`,
`n`) and `shulkers` (27 × the item's stack size); `M.stackNotation` provides the tooltip form.
The persisted unit toggle applies to every touched surface; switching never mutates the model.

### D6 — Rows simplify to Needed, Got, remaining, surplus and one action

The row's `Needed` is an editable text input (`inputmode="numeric"`, click selects, blur/Enter
commit, Escape revert); `Got` is read-only world inventory and `remaining` is read-only; surplus
gets `is-surplus`. `Remove` moves into `[data-mat-menu]`; `Update` opens the shared dialog. The
EDICT-0016 stepper (`.stepper`, `#mat-steps`, `data-step`) is retired from the Standard detail and
the add form's initial `collected` field is removed.

### D7 — One inventory dialog, reused by every entry point

`#inventory-dialog` carries the absolute input and the delta input; the delta accepts `+64`,
`-32`, `2s`, `2s+10` through the model's parsers; the green check commits, Escape cancels, an
invalid value shows `#inv-error` and does not commit. The row/slot click and the chip click open
the same dialog, and round 6 reuses it unchanged.

### D8 — Toolbar sorting, hiding and the table/grid switch

`#mat-sort` (remaining default, name, category), `#mat-hide-done` (default off) and the
pressed-state buttons switching `#material-table` and `#material-grid`. Chips are ordered by the
current sort, dim when complete, and carry the item name plus stack notation in `data-tip`.

### D9 — Build rows become compact and draggable

`.build-entry[data-build]` keeps only slot, name, badge and mini bar; dragging the grab handle
splices `world.builds` through `M.moveBuild`; index 0 gets `build-entry--top`, the accent and the
`1` marker; hover exposes activate/remove, and inactive rows are dimmed and excluded everywhere
according to `#inactive-mode`.

### D10 — The sidebar owns progress once; the shopping list becomes a dialog

`#world-panel` keeps the world identity, the one progress summary, the collapse rail and the
`Shopping list` button; `#shopping-dialog` lists `M.shoppingList(world)` for active builds. The
top-bar's duplicated progress markup is removed, the panels widen, and the page-bottom gap
shrinks without reintroducing a fixed-height scroller.

### D11 — The header card groups name, status, coords and notes

`#build-header` wraps the existing rename/delete affordances, the status group, the coords copy
and the notes view/edit surfaces in one compact card above the materials. No id in contract §3 is
renamed.

### D12 — Bulk paste gains a review step

`#bulk-paste` now opens `#paste-preview` first: `#paste-rows` shows parsed rows with duplicates
merged, `#paste-errors` lists unmatched/ambiguous lines, and only `#paste-ok` commits. The
existing matcher (exact name → exact slug → unique ≥3-character prefix) is unchanged.

### D13 — Stamps become relative with an exact tooltip

`.stamp[data-iso]` renders relative wording from the ISO value and puts the exact local stamp in
`title`; `M.formatStamp`'s UTC slice remains the source of the tooltip text, and a malformed value
still displays `—` without rewriting the raw value.

### D14 — Keyboard and persistence

Rows are tabbable and Enter opens the inventory dialog; Escape closes it and restores focus. All
state persists under the v2 key; Export emits v2; Import accepts v1 and v2 and migrates v1 once.
The v1 key is never deleted by the app.

### D15 — Evidence and stamp ordering

The S5 record uses `reports/qa/evidence/edict-0017/` (table, grid, inventory dialog empty and
typed, surplus row, shopping list, collapsed sidebar, unit toggle ×3, drag before/after, paste
preview, mobile table/grid, `probe.json`). The app-qa stamp is refreshed after the last source
change and before S6.

### 2.5 Frozen integration contract (contract-0017.md, verbatim)

# contract-0017 — frozen integration contract for EDICT-0017

Binding for 兵部 (build seats) and 測試部 (auditor). Ids and signatures here are the single
alphabet: if the shipped code needs a different name, the seat reports it before writing it.
Supersedes contract-0016 where they disagree; everything not listed here keeps its current
behaviour.

Corrections applied after the S2 audit (2026-10-26, blockers B1–B8): allocation return shape
pinned (§1), compact/dialog retirement made explicit (§3), paste/bulk retirement stated (§3),
covered/shared selectors named (§3), `2s+10` oracle and `#mat-needed` type stated (§1, §3),
migration surfacing named (§3), persistence keys named (§4), stamps reworded to UTC (§3, §5),
column budgets frozen (§6), migration clamp order and sort tiebreak stated (§5).

## 1. Model (`src/tracker/model.js`)

Schema `2`; new storage key `mc-build-tracker:v2`, old key `mc-build-tracker:v1` read once for
migration.

```
world = { id, name, edition, version, notes, createdAt, updatedAt, icon?,
          inventory: { [slug]: integer },
          builds: [ { id, name, status, coords, notes, icon?,
                      active: boolean, materials: [ { id, item, needed } ] } ] }
state = { version: 2, activeWorldId, worlds: [...], migratedFrom?: 1 }
```

New/changed exports (all pure unless stated):

| Export | Contract |
|---|---|
| `SCHEMA` | `2` |
| `migrateV1(state)` | pure v1→v2 per brief §Migration; clamps and coerces every count **before** `validate` runs (a v1 row may carry `collected: "garbage"`); idempotent; never throws on malformed rows |
| `inventoryOf(world)` | `{ slug: count }` (missing key = 0) |
| `setInventory(world, slug, value)` | integer ≥ 0, returns next `{ state, world }` |
| `addInventory(world, slug, delta)` | signed delta, clamps at 0 |
| `allocate(world)` | deterministic; shape below; the only place counts are decided |
| `buildProgress(alloc, buildId)` | `{ covered, needed, remaining }` read from `alloc.perBuild` |
| `progressText(covered, needed)` | `"213 / 727 items gathered (29%)"`; 0/0 → `"0 / 0 items gathered (0%)"` |
| `formatUnits(n, slug, unit, stacks)` | unit = `items` → `n`; `stacks` → `"{qty} stacks + {rem}"` / `"{qty} stacks"` / `"{n}"`; `shulkers` → same with 27×stack; never negative |
| `stackNotation(n, slug, stacks)` | `"184 = 2 stacks + 56"`; shulkers only when the unit is `shulkers` |
| `parseRelative(text, stack)` | `+12`, `-12`, `2s`, `2st`, `2s+10`, plain integer; anchored; oracle: `parseRelative('2s+10', 64) === 138`; anything else → `{ error }` |
| `shoppingList(world)` | `[{ slug, item, remaining, builds: [buildId] }]` across **active** builds, descending remaining |
| `setBuildActive(world, buildId, active)` | boolean, next state |
| `moveBuild(world, buildId, toIndex)` | splices the array; clamps index |

`allocate(world)` returns:

```
{ perMaterial: { [materialId]: covered },        // integer, ≤ material.needed
  perBuild:    { [buildId]: { covered, needed } },
  slugs:       { [slug]: { inventory, covered, remaining, surplus, shared } } }
```

`material.collected` no longer exists after migration. `M.validate` accepts v2 and rejects a
v2 shape carrying `collected`.

## 2. Allocation (the only place counts are decided)

```
allocate(world):
  order = builds in array order
  for each slug in union(materials of active builds):
     remaining = inventory[slug]
     for each build in order:
        need = Σ needed of that build's materials with this slug
        covered = min(need, remaining); remaining -= covered
        record per (build, material): coveredForThisMaterial = min(material.needed, covered left)
  surplus[slug] = max(0, remaining)
  shared[slug] = number of active builds with need > 0
```

- Only builds with `active !== false` AND `status !== 'done'` participate in allocation: a
  `done` build is complete, shows `covered === needed` in its own detail, and does not consume
  inventory. `#inactive-mode` accepts `priority`, `end`, `hide` only — there is no `all` mode.
- `coveredForThisMaterial` is allocated in material order within a build; the per-build totals
  are the sums of per-material entries.
- `supply` shown to the user is `covered`; `remaining` is `max(0, needed - covered)` — never
  negative anywhere in the DOM.

## 3. DOM — Standard detail

Kept from EDICT-0016: `#detail-avatar`, `#detail-heading`, `#build-rename`, `#build-name`,
`#build-name-save`, `#build-name-cancel`, `#build-delete`, `#build-coords`, `#build-notes`,
`#notes-text`, `#notes-edit`, `#notes-save`, `#notes-cancel`, `#status-group` buttons,
`#add-material-form`, `#mat-choice`, `#mat-item`, `#mat-needed`, `#mat-collected` is **retired**
(the add form no longer seeds a collected count; the shared inventory decides), `#material-body`
stays as the tbody container; `#item-options` is retired (EDICT-0016 D8 — the picker
`#mat-choice` is the only chooser; `#mat-item` keeps the chosen slug).

New:

| Id / selector | Contract |
|---|---|
| `#build-header` | compact card grouping name+actions, status, coords, notes |
| `#detail-progress`, `#detail-progress-text`, `#detail-bar`, `#detail-fill` | the **single** progress summary + bar; text exactly `progressText()` |
| `#mat-toolbar` | row above the table: sort, hide-completed, view toggle |
| `#mat-sort` | `<select>` options `remaining` (default) / `name` / `category`; `category` sorts by `MC_ICON_CATEGORIES[slug]` (unknown → `Misc`), ties by name then slug |
| `#mat-hide-done` | toggle, default **off** |
| `#mat-view-table`, `#mat-view-grid` | pressed-state buttons; containers `#material-table`, `#material-grid` |
| `.mat-row[data-mat]` | one row; cells in order: slot+name, Needed, Got, Left, surplus, Update, overflow |
| `[data-mat-field="needed"]` | `input type="text" inputmode="numeric"`; click selects; blur/Enter commits; Escape reverts |
| `[data-mat-got]` | read-only text = world inventory for the item (unit-formatted) |
| `[data-mat-covered]` | read-only = `perMaterial` covered for that row |
| `[data-mat-remaining]` | read-only = `max(0, needed-covered)` |
| `[data-mat-surplus]` | `+N surplus` only when the world has surplus for that slug; class `is-surplus` |
| `[data-mat-shared]` | `shared with N builds` when `shared > 1`; element absent otherwise |
| `[data-mat-update]` | button `Update` opening `#inventory-dialog` |
| `[data-mat-menu]` | overflow button; menu contains `[data-mat-remove]` |
| `.mat-chip[data-mat]` | grid chip: icon, `[data-mat-chip-count]` above, dimmed class `is-done`, tooltip via `data-tip` |
| `#inventory-dialog` | `<dialog>`; `#inv-title`, `#inv-context`, `#inv-absolute`, `#inv-delta`, `#inv-error`, `#inv-ok` (green check), `#inv-cancel` |
| `#paste-preview` | preview dialog for `Paste list…`: `#paste-rows`, `#paste-errors`, `#paste-ok`, `#paste-cancel` |
| `#migrated-from` | one-line notice shown once per load when `state.migratedFrom === 1`, absent on reload |
| `.stamp[data-iso]` | relative-time text with `title` = raw ISO; the visible text is the UTC slice `YYYY-MM-DD HH:MM` (same rule as EDICT-0016) |

Retired ids (must be gone from the DOM): `#mat-collected`, `#item-options`, `#mat-steps`, `.mat-steps`,
`.mat-step`, `data-step`, `.stepper__btn`, `#tile-dialog`, `#tile-absolute`, `#tile-relative`,
`#tile-save`, `#tile-error`, `#bulk-dialog`, `#bulk-input`, `#bulk-review`, `#bulk-add`.

Compact view reads the shared inventory: `.ctile` opens `#inventory-dialog` and renders from
`allocate()`; it never reads `material.collected`. `Paste list…` (`#bulk-paste`) opens
`#paste-preview`.

Rules: no `overflow: hidden/auto` scroll box around `#material-body`; `Remove` only via
`[data-mat-menu]`; the add-form `#mat-needed` stays `input[type="number"]` (spinners already
hidden in CSS), the row field is the text input above.

## 4. DOM — build list, sidebar, units

| Id / selector | Contract |
|---|---|
| `.build-entry[data-build]` | compact row: `.build-entry__slot`, `.build-entry__name`, `.build-entry__badge`, `.build-entry__bar`/`__fill`; **no** subtitle |
| `.build-entry--top` | distinct accent class on index 0 |
| `.build-entry--inactive` | dimmed class |
| `.build-entry__grab` | drag handle; row is `draggable="true"`; drop reorders via `M.moveBuild` |
| `[data-build-activate]`, `[data-build-remove]` | hover action buttons (tooltips); remove confirms then offers Undo toast |
| `#sidebar-toggle` | collapses `#world-panel`; state persisted |
| `#world-progress`, `#world-progress-text`, `#world-bar`, `#world-fill` | the sidebar shows progress **once**, using `progressText()` |
| `#btn-shopping-list` | opens `#shopping-dialog` (`#shopping-body`, `#shopping-close`) |
| `#inactive-mode` | `<select>`: `priority` (default) / `end` / `hide` |
| `#unit-toggle` | group with `[data-unit="items|stacks|shulkers"]`, `aria-pressed`; applied to Needed, Got, Left, chips, totals, shopping list |

Persistence keys (exact strings): `mbt.units`, `mbt.sidebar`, `mbt.inactiveMode`, `mbt.sort`,
`mbt.density`. The pre-existing builds-view key keeps its name.

## 5. Behaviour contracts (asserted by cases)

1. The string `gathered` appears once per panel; the list subtitle `"N% gathered · M materials · …"`
   no longer exists.
2. Percentages come from `progressText`; no `-` sign in any count.
3. Row click (not on an input/button) or `.mat-row__slot` click opens `#inventory-dialog` with
   the item context; Enter on a focused row does the same; Escape closes.
4. `#inv-absolute` commits the absolute inventory; `#inv-delta` accepts `+64`, `-32`, `2s`,
   `2s+10`; invalid input shows `#inv-error` and does not commit.
5. Sorting/filtering re-renders deterministically; `Hide completed` hides rows whose
   `remaining === 0`.
6. Drag reorder persists (array order) and survives reload; the top row keeps `.build-entry--top`.
7. Inactive builds are excluded from `#world-progress`, `#detail-progress` and the shopping
   list; per `#inactive-mode` they render dimmed in place, at the end, or not at all. `done` builds are excluded from allocation (see §2) and never
   consume inventory.
8. Unit toggle changes all visible quantities without changing stored values.
9. Migration: a v1 fixture loads, writes v2, and the world's inventory equals the summed
   collected; `material.collected` is absent afterwards. Coercion happens before validation, so
   `collected: "garbage"` becomes `0` rather than an import error.
10. Paste list opens `#paste-preview` first; confirming imports the parsed rows only.

## 6. Budgets

- 1280×900: `#main` stays 1232 wide; `#world-panel` 190–210; build list ≥ 360; detail ≥ 640
  (today: 230 / 340 / 608 — the change must widen the content columns, never narrow them);
  `#build-header` + `#detail-progress` + `#mat-toolbar` + ≥ 6 `.mat-row` visible without
  scrolling; the page may grow beyond 900 for longer lists.
- 390×844: no horizontal page overflow; grid ≤ 4 chips per row; row layout stacks (as today).
- Grid chip target ≥ 44×44 px.

## 7. Evidence and stamp

- Browser suite grows from 96 cases; the auditor freezes the list in §3.3 of the edict.
- Evidence crate `reports/qa/evidence/edict-0017/`: builds table, grid view, inventory dialog
  (empty + typed `2s+10`), surplus row, shopping list, sidebar collapsed, unit toggle ×3,
  drag-reorder before/after, paste preview, mobile 390 table + grid, probe.json.

## 3. Review record

### 3.1 Reconnaissance (test-side, against the shipped tree)

Auditor: 測試部 (ceshibu), 2026-10-26 11:5x. Tree: HEAD of round 4 (EDICT-0016
delivered); no `src/**` bytes written by 測試部. Numbers marked *measured* are the Lead's
headed-Chrome run in `.tmp/s13/baseline.json` (`?demo=1&tab=builds`); the rest are my greps.

**Model and store (today, before this edict).**

- `src/tracker/model.js:29` `var SCHEMA = 1`; `:79` `nowIso`; `:571` `createWorld` writes
  `createdAt` only; `:633` `createBuild` writes no timestamps; `:481` `createCustomItem`
  writes no timestamps.
- Every material carries `collected` at `src/tracker/model.js:898-1033` (`validate` requires
  `material.collected >= 0` at `:1027`); `:1006` rejects any state whose
  `version !== SCHEMA`, so a v2 state fails validation today. `materialProgress` (`:785`)
  and `worldSummary`/`aggregateWorld` (`:1196-1199`) are `collected`-based.
- `parseRelative` (`src/tracker/model.js:1004`) accepts the anchored forms `2s`, `+64`,
  `-32`; it does **not** accept `2s+10` — contract §5.4 names it, so §3.3 case 111 freezes
  `2s+10` = `2 × stack + 10` and R6 records the parser change that must accompany it.
- Storage is `STORAGE_KEY` (`src/tracker/model.js:1160`); nothing in the app or suite reads
  any other key for state. The exported API (`:1157-1211`) has no `migrateV1`, no
  `allocateInventory`, no `formatMixed`, no `parseMixed`, no v2 helpers.
- Loader pattern: `M.load(storage)` + `M.save(storage, state)`; `importJSON`
  (`src/tracker/model.js:1039-1056`) returns `{state}` from validated text.

**App surfaces that this edict rewrites.**

- `renderBuilds` (`src/app.js:1081`) derives `done`/`gathered` from `material.collected`
  (`:1049-1058`); the entry template is `:1108-1121` (`.build-entry__top`, name, status chip,
  `.build-entry__meta` subtitle `N materials · x / y / z`, bar/fill, `#build-pct`).
- `renderDetail` (`src/app.js:1195`) calls `paintBuildProgress` (`:1218-1242`), which prints
  the retired phrase `X of Y items gathered · Z to go` into `#build-summary` (`:1230`) with
  `#build-pct` (`:1229`); the shipping markup is `src/index.html:146-150`
  (`#build-summary`, `#build-pct`, `#build-bar`, `#build-fill`).
- Material rows are built at `src/app.js:2350-2410`: direct children
  `.mat-row__item`, two `.stepper` clusters (needed/collected, `:2374-2404`), `<span class="num">`,
  `.row-delete`. *Measured* children per row at 1280: `mat-row__item, stepper, stepper, num,
  row-delete`; row 48 px, inputs `44×28` (`type=number`, min 1 / min 0), delete button 30×30.
- `#material-body` is a plain div (`src/index.html:161`) but is styled as the scroll box
  `src/styles.css:1206` (`max-height: 264px; overflow-y: auto`), repeated at `:1228` (mobile)
  and `:1268` (mobile ≤640). *Measured* at 4 rows: table 608×222, `overflow-y: visible`,
  `max-height: none` on `.mtable` — the clipping box is the inner `#material-body`, so with
  ≥6 rows the list scrolls/clips instead of growing. This is the box AC2 retires.
- Add form `src/index.html:168-196`: `#mat-item` (hidden), `#mat-needed` **and
  `#mat-collected`** (both `type=number`, `44×36` *measured*), `#bulk-paste`.
- Sidebar `src/index.html:42-64`: `#world-panel` (aside) holds `#world-avatar`, `#world-select`,
  `#world-panel-name` (`:50`), `#world-meta` (`:51`), `#world-stats` with `#world-progress`
  (the text line, `:53`), `#world-remaining` (`:54`), `#world-bar` (`:55`), `#world-fill`
  (`:56`), and the three action buttons (`:60-62`). *Measured* 230×411 at 1280, 346 wide at 390.
- Bulk paste `src/index.html:195` opens `#bulk-dialog` (`#bulk-input`, `#bulk-review`
  `:383`, `#bulk-add`); contract §3 introduces `#paste-preview` (`#paste-rows`,
  `#paste-errors`, `#paste-ok`, `#paste-cancel`) and does not say which ids retire — R1/B2.
- Compact view **does** read the field v2 removes: `src/app.js:1541-1560`
  (`compactTileHtml` uses `material.collected`) and the quick-update dialog commits
  `M.updateMaterial(..., {collected})` (`:1681-1700`, `#tile-dialog`). Contract §6 calls
  compact a non-goal while §D7 says "same dialog everywhere"; R2/B1.
- Timestamps: `stampNode`/`timeHtml` (`src/app.js:1418-1449`) use `M.formatStamp` (UTC slice,
  `src/tracker/model.js:79-97`) with `datetime`/`title` = the raw ISO; `#world-meta`
  textContent already contains `<time>` nodes (round-4 behaviour to keep).
- The browser suite seeds through `localStorage 'mc-build-tracker:v1'` at
  `tests/qa/ui.e2e.test.mjs:60,86,1883-1912` (`injectState`, `fixture`, `fixture16`,
  `loadBackupText`) plus ~16 direct reads — every one of those changes with the key rename;
  §3.3 discloses them as a mechanical rewrite (seed helper + read helper to v2, one new
  v1-injection helper kept for migration cases).
- Build rows are `<button class="build-entry">` containers today; AC13's `draggable` row,
  delete trigger, inactive checkbox and drag handle cannot nest inside that button
  (invalid nested interactive controls). Freeze §3.3 case 113 as "no `button button`
  nesting" so 兵部 may restructure the row element freely.

**Measured baseline (Lead; cite as measured, do not invent).** Desktop 1280×900:
doc `1280×984`, `#main 1232×816` (bottom 953), sidebar `230×411`, list `340`, detail
`608×696` (bottom 906), 3 build entries (`63.75` px, children `build-entry__top`,
`build-entry__meta`), 4 material rows `48` px, `.mtable` `608×222`, add form `82`, top bar
`1204×42`, `#world-progress` text `202×20`, material inputs `44×28`, delete `30×30`;
missing ids: `#build-head`, `#build-header`, `#detail-progress`, `#mat-toolbar`,
`#material-table`, `#material-grid`, `#inventory-dialog`, `#paste-preview`,
`#sidebar-toggle`, `#shopping-dialog`, `#inactive-mode`, `#unit-toggle`, `#sidebar`.
Present: `#material-body`, `#mat-collected`; `#mat-steps` absent. Mobile 390×844: doc
`390×1567`, no horizontal overflow, detail `346×849`, row 93 (stacked), sidebar 346,
top bar `346×76`, table `246`, form `132`.

### 3.2 Review gate (R1–R10)

| Id | Risk | Verdict | Evidence / required fix |
|---|---|---|---|
| R1 | Scope creep | **BLOCK — B2** | Contract §3 pastes `#paste-preview` over the shipped `#bulk-dialog` without retiring it; §D12 says "#bulk-paste opens #paste-preview first", but the old ids stay reachable in the page. Fix: contract §3 states `#bulk-dialog`/`#bulk-form`/`#bulk-input`/`#bulk-review`/`#bulk-add`/`#bulk-error` retire, `#bulk-paste` opens `#paste-preview`, and `#paste-preview` is the only paste surface (keep `#bulk-paste` as the trigger). |
| R2 | Symptom vs root cause | **BLOCK — B1** | The symptom (slower inventory entry) is caused by per-row numeric edit + no world inventory. The contract fixes the model but leaves compact view reading `material.collected` (§6 non-goal; §D7 "same dialog everywhere"), so the built app would show `undefined / 384` in compact and a dialog that writes a dropped field. Fix: contract §3 rule — `.ctile` click opens `#inventory-dialog`; `#tile-dialog` and its `#tile-absolute`/`#tile-relative`/`#tile-save`/`#tile-cancel`/`#tile-error` ids retire this round; 兵部 rewires `compactCardHtml`/compact tiles to `M.allocateInventory`. (If the founder insists compact stays untouched, then the dialog must remain but commit the **world inventory**; either way the contract must name one behaviour.) |
| R3 | Testability of acceptance | **BLOCK — B3, B4, B6, B9** | AC4 names a "covered/remaining split" but contract §3 has no `[data-mat-covered]`; AC5 names "shared with N builds" with no selector; AC3 says "exact local timestamp" while `M.formatStamp` is a UTC slice (EDICT-0016 ruling); §4 persistence keys for `#inactive-mode`/`#sidebar-toggle`/`#unit-toggle` are unnamed. Fixes: add `[data-mat-covered]` (or reword AC4 to Got + remaining + surplus), add `[data-mat-shared]` text `shared with N builds`, reword AC3 to "the existing UTC `YYYY-MM-DD HH:MM` slice", and name the keys (`mbt.units`, `mbt.sidebar`, `mbt.inactiveMode`, `mbt.sort`, `mbt.density`) in contract §4. |
| R4 | Ordering / dependencies | PASS | S1 frozen → S2 audit (this §3) → R6 unit suite must land before any browser case is frozen (Lead rule); §4 planned table already orders migration → allocation → browser. |
| R5 | Risk of data loss | PASS with case freeze | Migration is the only destructive path; §3.4 fixture `v1-migration-state.json` + cases 97–100 + the unit suite pin sums, idempotence and v2 rejection of `collected`. Requirement: the v1 key is never written after migration (case 97), and a migrated export re-imports without doubling (case 125). |
| R6 | Environment capability | PASS (with measured chrome) | Headed Chrome 155 is the only browser (Lead); all new cases use existing harness primitives (`evaluate`/`click`/`fill`/`press`/`drag` via synthetic `DragEvent`, clipboard stub pattern, `localStorage` seeding). `2s+10`, sticky geometry and drag order are measured by the Lead before freeze; today's parser rejects `2s+10` (see 3.1) — that is a **R6/B5 blocker on the code, not on the environment**: contract §5.4 must name `M.parseRelative('2s+10', stack)` as the oracle and the model must implement it. |
| R7 | Failure paths | PASS with cases | Invalid paste lines (case 112), invalid delta (111), v2 `collected` rejection (100), empty/negative absolute (111), migration of malformed v1 numbers (97/98). Every path asserts dialog stays open / no partial write. |
| R8 | Escalation points | PASS | Blockers B1–B9 are raised here with exact fixes; 礼部 amends contract §3/§4/§5, 兵部 rebuilds compact tile wiring + paste surface + parser; nothing proceeds to S4 until Lead re-freezes the contract hash. |
| R9 | Wiki upkeep | PASS (as planned) | §5 names `wiki/concepts/number-stepper.md`, `compact-view.md`, `shared-inventory.md`, `selective-sidebar.md`, 7 pages + design-system MASTER/pages/tracker + README + log; shared-inventory concept is new and required by the new model — no gap. |
| R10 | App-QA freshness | PASS with re-stamp | Any accepted build must re-run `node scripts/app-qa.mjs run` (96+ cases) and restamp `docs/governance/app-qa.json`, verified by `node src/wiki/cli.mjs app-qa`; `APP_SOURCE_FILES` already covers `src/**` sources incl. `tracker/model.js`; the frozen suite grows to 128 and must be the stamped count. |

### 3.3 Frozen case list (96 → 128; never shrink, never fix a case to make an app bug pass)

**Existing cases this edict rewrites (and why), all in `tests/qa/ui.e2e.test.mjs`:**

- *Seeding mechanics* — `injectState`/`fixture`/`fixture16`/`loadBackupText` and every direct
  `localStorage.getItem('mc-build-tracker:v1')` read (lines 60, 86, 1883–1912, and the 16
  call sites) move to `mc-build-tracker:v2`; a new `injectV1State(state)` writes `:v1` with
  `:v2` cleared for migration cases. No assertion may change, only the key and state shape.
- *Case 20/21 (import round-trip / bad file)* — accept v1 **and** v2; the former asserts a
  v1 file migrates to v2 exactly once.
- *Case 24 (`#material-body` rows)* — v2 row shape: item, Needed text editor
  (`type="text" inputmode="numeric"`), no stepper nodes (`[data-step]`/`.stepper`/`.stepper__btn`/
  `.mat-step`/`.mat-steps`/`#mat-steps` absent), `[data-mat-got]` read-only,
  `[data-mat-covered]`, `[data-mat-remaining]`, `[data-mat-surplus]` hidden,
  `[data-mat-update]` present.
- *Cases 39, 40, 41, 42, 45, 64, 72, 75 (0016 stepper strip)* — retarget to the v2 row,
  where contract §3 retires the stepper entirely (AC7): row cells in contract order —
  `.mat-row__item`, `[data-mat-field="needed"]` (text), `[data-mat-got]`,
  `[data-mat-covered]`, `[data-mat-remaining]`, `[data-mat-surplus]` (`.is-surplus`),
  `[data-mat-update]`, overflow menu — not steppers. `[data-mat-field="needed"]` commits on
  blur/Enter, clamps ≥ 1, Escape reverts, opens no dialog; `[data-step]`/`.stepper`/
  `.stepper__btn`/`.mat-step`/`.mat-steps`/`#mat-steps` count 0; Got read-only. Stack-size
  behaviour moves to `M.formatUnits`/`M.stackNotation` (cases 40/41/64) and the `2s` delta to
  `#inventory-dialog` (case 75). No case is deleted.
- *Case 86 (row geometry)* — v2 row cell geometry per contract §3 (`.mat-row__item`,
  `[data-mat-field="needed"]`, `[data-mat-got]`, `[data-mat-covered]`,
  `[data-mat-remaining]`, `[data-mat-surplus]`, `[data-mat-update]`, overflow); no
  `.stepper__btn` exists. Widths/heights as measured by the Lead and cited, never invented.
- *Case 88 (select-all on click)* — capability-safe as in 0016.
- *Cases 93/94/95/96 (0016 bars/compact/tile dialog)* — 93 retargets to
  `#detail-progress`/`#detail-progress-text`/`#detail-bar`/`#detail-fill` (retired
  `#build-pct/#build-summary/#build-bar/#build-fill` absent); 94/95/96 move to the
  compact-vs-v2 resolution of B1 — `#tile-*` is retired and `#inventory-dialog` is the only
  dialog, compact `.ctile` renders from `M.allocate` — and to `#world-progress-text`.
- *Cases 68/69/70/79/80 (world strip + top bar + containment)* — world ids become
  `#world-progress`/`#world-progress-text`/`#world-bar`/`#world-fill` inside `#world-panel`;
  container-overlap and centre-grouping checks keep their measured oracles (Lead re-measures
  after the layout change; numbers are replaced by measurement, not by guess).
- *Cases 12/13/14/25/52/58 (entry table, row painting, visual contract, budget)* — entry
  markup loses `.build-entry__meta` and `#build-pct`; row table gains the new columns
  (Needed/Got/Inventory/Remaining/Surplus/actions); visual contract loses the 0016
  gathered-only phrasing; budget uses the contract §6 numbers.

**New cases 97–128 (32 cases).** Names + intent; every number is "as measured by the Lead"
unless the contract fixes it.

| # | Case name | Intent |
|---|---|---|
| 97 | `v1 state migrates once to v2 (storage key)` | seed `:v1` (fixture `v1-migration-state.json`), clear `:v2`, load → state version 2, `:v2` written, `:v1` untouched, one-time note `#migrated-from` visible once; second load adds no second note and changes nothing. |
| 98 | `migration sums collected per world/item case-insensitively` | same fixture: each world inventory equals Σ`collected` for its items (case-folded keys), `collected` absent, order/active flag preserved, negative/garbage numbers clamped to 0. |
| 99 | `v1 file imports as v2 and does not double count` | import dialog with v1 backup → v2 state; importing the same file again replaces (no doubling), no `collected` key survives. |
| 100 | `v2 backup imports and rejects collected` | valid v2 fixture imports; a v2 file with `material.collected` gets the model's error string and the dialog stays open. |
| 101 | `allocation priority for duplicate items across builds` | two builds each need Stone Bricks; inventory covers the first fully and part of the second; first row covered`=min`, second `remaining>0`; Σcovered + remainder = needed; no double count. |
| 102 | `surplus appears once inventory exceeds total need` | inventory 482 against total needed 97 (single build) → `[data-mat-surplus]` visible `+385`; with a second build needing more, surplus hides until all needs are met. |
| 103 | `inline Needed editor is a text field` | row Needed: `type="text"`, `inputmode="numeric"`, value = needed; Enter commits (no dialog), Escape reverts; `needed` min 1 enforced with the model's error toast. |
| 104 | `Got shows world inventory and is read-only` | `[data-mat-got]` equals the world inventory for that slug, no `min`/`max`, typing/Enter changes nothing, all builds listing the slug show the same number. |
| 105 | `units toggle switches counts and stacks` | `#unit-toggle` cycles items→stacks, aria-pressed + label change, `[unitCount]` text matches contract syntax (`2 stacks + 10`, `1 stack`, `0`), reload keeps the choice (persisted key). |
| 106 | `hide completed hides done rows` | toggle hides `[data-state="done"]` rows and the count reflects visible rows; toggling back restores; state persists per contract §4 key. |
| 107 | `three sort modes reorder deterministically` | `#mat-sort` offers exactly three modes — `remaining` (default), `name`, `category`; `category` uses `MC_ICON_CATEGORIES[slug]` (unknown → `Misc`, ties by name then slug); DOM order equals the fixture expectation for `duplicate-allocation-state.json`; the choice persists under `mbt.sort`. |
| 108 | `grid density renders tiles with deficit` | `#material-grid` tile count = row count; open tiles show deficit, done tiles the target; tile ≥44×44 (≤64); every `.mat-chip[data-mat]` is a focusable button, Enter/Space opens `#inventory-dialog` for its material, and Tab order follows the DOM (no roving tabindex, no arrow-key requirement — not in the contract). |
| 109 | `inventory dialog opens from the row` | open from Needed cell: title includes the item, `#inv-absolute` prefilled with world inventory, `#inv-delta` empty default, focus lands on `#inv-absolute` with the value selected, Escape closes with no write. |
| 110 | `absolute replacement commits and clamps` | `#inv-absolute` 300 + Enter → world inventory 300 (no `collected` write), remaining recomputed, one `commit` (Undo restores). |
| 111 | `delta forms: 2s+10, +32, -1s, clamp` | empty `#inv-absolute` + `2s+10` = +2·stack+10, `+32`, `-1s` clamps at 0; invalid `abc`/`2s+`/`+1e9` keeps the dialog open with the model's error; the parser oracle is `M.parseRelative('2s+10', stack)`. |
| 112 | `paste preview parses and creates` | paste 3 lines (one unknown) into `#paste-preview`: preview lists 2 matched/1 unmatched with counts, `#paste-ok` creates 2 materials for this build (case-insensitive merge), `#paste-cancel` writes nothing. |
| 113 | `drag reorder persists and is not a no-op` | drag build A below B: `#build-list` order changes, `data-order`, reload keeps it, compact order follows, no `button button` nesting; same status order after restart. |
| 114 | `keyboard-only inventory path` | from row Needed: Enter opens `#inventory-dialog`, focus `#inv-absolute`, type, Enter commits, Tab reaches Copy; dialogs close on Escape with focus restored to the trigger. |
| 115 | `copy list puts the count in plain text` | stub clipboard; `#btn-copy-list` writes the count string (e.g. `Stone Bricks: 5 stacks` or `600 items` per unit mode), plain text (no `**`, no `[ ]`, no `- ` markup), toast names the list. |
| 116 | `row dialogs are icon, name, delete only` | clicking a material row (not a control) opens `#inventory-dialog` for that item (AC8); icon chooser, rename and delete are reachable; delete asks confirmation and the toast offers Undo (6 s) restoring the row. |
| 117 | `sidebar controls collapse, filter and carry world actions` | `#sidebar-toggle` collapses to a rail (≥56 px) with `#sidebar` present, `#inactive-mode` offers `priority`/`end`/`hide` only, unit toggle visible, `#btn-shopping-list`, export/import/new world reachable; collapsed state survives reload. |
| 118 | `world progress agrees with allocation` | `#world-progress-text` equals the contract `progressText` from the allocation; with `#inactive-mode=hide` the inactive build is not rendered and the progress still reflects only participating builds (no mode-specific 100% cap). |
| 119 | `shopping list dialog lists deficits once` | `#btn-shopping-list` opens `#shopping-dialog`: one row per slug with remaining>0, descending, no per-build duplicates, done builds excluded; count = distinct items; copy works. |
| 120 | `done build leaves the rollup but not the list` | a done build is excluded from allocation (`covered === needed`, consumes nothing); its own progress still visible; the `priority`/`end`/`hide` inactive matrix matches contract §5.7. |
| 121 | `compact view renders v2 counts` | compact cards/tiles render from `M.allocate` (no `undefined`); `.ctile` opens `#inventory-dialog` (B1) and committing changes the world inventory once. |
| 122 | `mobile 390 stacks the material table` | 390×844: table stacks (no inner scroll box, page grows), grid tiles reflow, page ≤ contract §6 budget, no horizontal overflow; tapping a row opens the dialog. |
| 123 | `sticky toolbar stays above the viewport bottom` | with a long build: `#mat-toolbar` sticky, Update bar ≥16 px above the viewport bottom, no overlap with the last row's controls. |
| 124 | `timestamps show UTC slice and raw ISO title` | `.stamp[data-iso]` visible text matches `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/` and equals `M.formatStamp(iso)` (UTC); `title` === the element's `data-iso`; freshness is asserted on `data-iso` (ISO, not relative text), no `just now`/local wording; the migration notice appears once and not on every load (flags cleared on the first save). |
| 125 | `export v2 round-trips` | export has `version:2`, `inventory`, no `collected`; re-import restores inventory/surplus/inactive/drag order and does not double-count. |
| 126 | `materials region scrolls the page, not itself` | at 1280×900 no ancestor of `#material-body` has `overflow: auto|scroll`; page `scrollHeight` grows with rows; the add-form top ≥ last `.mat-row` bottom (no overlap); `#mat-toolbar` stays visible while scrolling. |
| 127 | `inactive builds follow priority/end/hide` | hover a build row → `[data-build-activate]`/`[data-build-remove]`; activation flips `active`; remove confirms + Undo restores; with `#inactive-mode=priority|end|hide` the row renders dimmed in place / at the end / not at all, and `hide` drops it from totals. |
| 128 | `build header groups identity and notes` | `#build-header` contains the name/actions, `#status-group`, `#build-coords` and the notes view/edit affordances above `#material-body`; editing notes inside it saves and shows in `#notes-text`. |

### 3.4 Fixtures (`tests/qa/edict-0017-fixtures/`)

| File | Contents | Frozen expectation |
|---|---|---|
| `v1-migration-state.json` | schema-1 backup, two worlds, sums to migrate, one duplicate item across builds, one malformed (`collected` string), valid ISO stamps | imports; inventory = Σ collected case-folded; garbage → 0; `:v2` written once, `:v1` untouched; `#migrated-from` once |
| `duplicate-allocation-state.json` | v2, one world, two active builds, Stone Bricks in both (needs 300 + 200), inventory 350, Glass done, one inactive build | allocation covers first 300, second 50, remaining 150; Σ = needed − remaining; surplus 0 |
| `surplus-state.json` | v2, one build, needed 97, inventory 482 | `[data-mat-surplus]` `+385`; second build needing 100 hides it |
| `inactive-state.json` | v2, one active + one inactive build + one done build, overlapping items | inactive excluded from the rollup; a done build is excluded from allocation (`covered === needed`, consumes nothing); `priority`/`end`/`hide` render as contract §5.7 — there is no `all` mode |
| `invalid-delta-inputs.json` | `["abc","2s+","+1e9","--1","2s+10"]` with the item stack 64 | errors for the first four, `+138` for the last (oracle printed in the case) |

README.md records each file's schema, the frozen expectation, and the load path
(`M.importJSON` for file fixtures; `injectV1State`/`injectState` for browser ones).

### 3.5 Evidence plan (`reports/qa/evidence/edict-0017/`)

Captured by the Lead's browser hands at the S5 gate: `builds-table.png` (v2 rows, inventory/
remaining/surplus), `grid-view.png`, `inventory-dialog-empty.png`, `inventory-dialog-2s10.png`,
`surplus-row.png`, `shopping-dialog.png`, `sidebar-collapsed.png`, `unit-toggle-items.png`,
`unit-toggle-stacks.png`, `paste-preview.png`, `drag-before.png`, `drag-after.png`,
`mobile-table.png`, `mobile-grid.png`, `probe.json` (viewport, ids present/absent, key hashes,
`generated_at` ≥ last source write). The stamp must be regenerated after the assets/HTML/CSS/JS
freeze, and every evidence mtime must be after the last source write.

### 3.6 Risks

- **Migration data loss** (highest): a wrong sum or a dropped item silently zeroes a world's
  inventory. Mitigation: unit suite first (Lead rule), fixtures 97/98, case 125 round-trip,
  and the v1 file is never rewritten.
- **Double counting**: allocation + migration both add inventory; cases 98/99/101/110 assert
  one commit and no doubling (Undo restores the prior world count).
- **Compact/v2 divergence** (B1): if 兵部 rewires compact only partially, tiles show
  `undefined`; case 121 is the guard and fails loudly.
- **Paste surface drift** (B2): two paste UIs would both write, producing duplicates; case 112
  asserts one surface and one write per confirm.
- **`2s+10` parser drift** (B5): the contract names the form but not the function; the oracle
  must be `M.parseRelative`, unit-tested, and case 111 prints the expected delta.
- **Row re-layout** (R6): the new single-cluster row + inventory column must fit the measured
  608 px detail; any overflow is measured by the Lead and frozen in §3.3, never guessed.

### 3.7 Verdict

**BLOCK** — the case list above is frozen (96 shipped + 29 new = **125**), but the build may
not start until 礼部 amends the contract on B1 (compact/tile-dialog v2 behaviour), B2 (paste
surface retirement), B3 (`[data-mat-covered]` or AC4 reword; `[data-mat-shared]`), B4
(`#mat-needed` type and the `2s+10` oracle), B6 (persistence keys), and B9 (AC3 UTC wording).
R6/B5 (`2s+10` parser) and B8 (stamp ordering) are build-time obligations. With those
amendments, §3.3–§3.5 are PASS-WITH-CASES and every AC in §1 maps to at least one case above
or to a rewritten shipped case.

**Delta re-audit 2026-10-26 (S2 amendment):** §3.7's BLOCK is superseded — see §3.8; the delta verdict is **PASS-WITH-CASES** (B1–B8 closed, §2 byte-identical, cases 128).

### 3.8 Delta re-audit (S2 amendment, 2026-10-26)

Scope: §1 amendment lines 31–175 (AC3/AC4/AC5/AC16 reworded) and §2 re-splice lines 291–466 (canonical contract, 176 lines). §3.1–§3.7 stay as the first-pass record; this section is the delta judgement, append-only.

**D1 — §2 identity: PASS.** Block 291–466 (176 lines) is byte-identical to `.tmp/s13/contract-0017.md`: raw-byte sha256 `486b1f5c9fd2f56b80e1e876637e458357476f710213ea2c00dba4938ea63285`, identical length 11,027 B (line 467 is the file's trailing newline; hashing through it yields the same digest). The `4dab6447…` in the Lead's first note is the same bytes with the final newline trimmed — superseded, and §1 lines 33–34 record `486b1f5c…` correctly. The amendment added one line before §2, so the block starts at 291 in the current 784-line edict (§3 at 468).

**D2 — B1–B8 closure:**

| Blocker | Contract evidence | Verdict |
|---|---|---|
| B1 compact/`#tile-dialog` read `collected` | §1 lines 46–52 (`allocate` shape `perMaterial`/`perBuild`/`slugs`); §3 lines 116–118 (`.ctile` opens `#inventory-dialog`, renders from `allocate()`, never `material.collected`); `#tile-*` in the retirement list | PASS |
| B2 two paste surfaces | §3 lines 117–118 (`#bulk-paste` opens `#paste-preview`); `#bulk-*` retired §3 lines 112–114 | PASS — NOTE: `#bulk-form`/`#bulk-error`/`#bulk-cancel` (`src/index.html:378/384/386`) are children of the retired `#bulk-dialog`, so asserting the subtree absent covers them; doc nit only |
| B3 missing selectors | §3 lines 100–103 (`[data-mat-covered]`, `[data-mat-remaining]`, `[data-mat-surplus].is-surplus`, `[data-mat-shared]` only N>1); §2 lines 75–76 "never negative" | PASS |
| B4 `2s+10` / `#mat-needed` type | §1 line 41 oracle `parseRelative('2s+10', 64) === 138`; §3 line 98 row field `type="text" inputmode="numeric"`; §3 lines 121–122 add-form `#mat-needed` stays `type="number"` | PASS |
| B5 migration surfaced | §3 line 109 `#migrated-from` when `state.migratedFrom === 1` | PASS with one build obligation: the contract does not say what clears the flag, so "absent on reload" holds only if the first v2 save drops `migratedFrom`; case 97 is frozen as "visible after migration, absent after the first commit + reload" and 兵部 must drop it on save |
| B6 persistence keys | §4 lines 139–140 `mbt.units`, `mbt.sidebar`, `mbt.inactiveMode`, `mbt.sort`, `mbt.density` | PASS |
| B7 stamps | §3 line 110 `.stamp[data-iso]` visible text = UTC slice, `title` = raw ISO; AC3 lines 74–76 | PASS — NOTE: contract line 110 still opens "relative-time text" and the founder item (§1.1 item 3, line 56) says "relative (`Updated 5 min ago`)". Both are superseded by AC3 + the Lead's B7 ruling: visible text is `M.formatStamp` (UTC), no relative/local wording (case 124 refrozen, D7). Stale words should be removed at the next splice |
| B8 budgets | §6 lines 164–169 `#main` 1232, `#world-panel` 190–210, list ≥360, detail ≥640, ≥6 rows; 390 no horizontal overflow, grid ≤4 chips/row, chip ≥44×44 | PASS |

**D3 — four ACs measurable: PASS.** AC3 names `.stamp[data-iso]` + `M.formatStamp` + per-surface `title`; AC4 names `[data-mat-got]`/`[data-mat-covered]`/`[data-mat-remaining]`/`[data-mat-surplus].is-surplus` and forbids a negative Left; AC5 names `[data-mat-shared]` reading `shared with N builds`, only when N>1; AC16 freezes 1232/190–210/≥360/≥640 against the 0016 baseline 230/340/608.

**D4 — case-list correction (steppers are retired).** Contract §3 lines 112–114 retire `.stepper__btn` and AC7 lines 92–95 assert none exists in the Standard detail. §3.3's rewrite bullet is therefore amended (rewrites, no deletions): 39/42/45 → row shape/absence with the contract §3 line 97 cell order (slot+name, Needed, Got, Left, surplus, Update, overflow) and zero `.stepper__btn`/`[data-step]`/`.mat-step`/`#mat-steps`; 40/41 → Needed text commit/blur/Enter clamp and Escape revert, no dialog; 64 → stack-size behaviour via `M.formatUnits`/`M.stackNotation` (stack-1 item `0 stacks + 1`, shulker 27×); 72 → add form keeps `#mat-needed` `type="number"`, `#mat-collected` absent, no stepper; 75 → `2s` delta resolves the item stack through the dialog; 86 → row cell geometry per contract §3; 88 → click selects all on the row text field. `#mat-collected` is retired (§3 line 83), so 0016's add-form Got assertions go with it.

**D5 — case count.** Three ACs had no case in §3.3; add 126 (AC2: no `overflow:auto|scroll` wrapper around `#material-body`, page grows, add-form top ≥ last-row bottom at 1280), 127 (AC14: hover `[data-build-activate]`/`[data-build-remove]`, confirm + Undo, `active` flips, `#inactive-mode` priority/end/hide), 128 (AC20: `#build-header` groups name/actions/status/coords/notes above materials, notes edit works inside). Frozen total **128 (96 shipped + 32 new)**, superseding §3.3's 125.

**D6 — AC1 materials tab.** AC1 (one progress sentence per panel via `M.progressText`) retires the Materials-tab `#mat-totals` phrasing (today `8 items · 800 / 2252 gathered · 1452 to go · 36%`); cases 16/17 are added to D4's rewrite list (progressText + old phrase absent).

**D7 — case 124 refrozen:** `.stamp[data-iso]` visible text === `M.formatStamp(iso)` (UTC `YYYY-MM-DD HH:MM`), `title` === raw ISO, no relative "just now"/local wording (contract §3 line 110 + AC3).

**D8 — fixtures corrected.** v2 carries inventory per world (`world.inventory`, contract §1 lines 20–24), never top level: `duplicate-allocation-state.json` (350 / 100; Glass 96+32 inside one build), `surplus-state.json` (482 vs 97 → `+385`), `inactive-state.json` (60 / 10) rewritten with the inventory inside `w1`, expectations unchanged; `v1-migration-state.json` unchanged (v1 has no inventory; migration creates it). README records the location.

**D9 — id nits (NOTE, not blockers; frozen in cases).** (a) AC15 line 129 says `#shopping-list` while contract §4 line 135 says `#shopping-dialog`/`#shopping-body` — cases 119/127 freeze on the dialog ids; (b) contract §4 line 134 names both `#world-progress` and `#world-progress-text` but only says "progress once" — freeze the sentence in `#world-progress-text`, `#world-progress` as its container, exactly one progressText occurrence in the sidebar (case 118); (c) contract §3 line 85 keeps `#item-options` as the datalist — it is not retired with the `#bulk-*` subtree.

**Delta verdict: PASS-WITH-CASES.** B1–B8 closed (D2), §2 byte-identical to the canonical 176-line contract (D1), AC3/AC4/AC5/AC16 measurable (D3); the case list and fixtures are corrected (D4–D8) and three build obligations are recorded: drop `migratedFrom` on the first v2 save, no relative/local stamp wording, and the D4 rewrite scopes. No further contract amendment is needed to start the build; S5 is frozen at **128 cases** with `tests/unit/tracker-0017.test.mjs` passing as the R4 precondition (Lead rule).

### 3.9 Second re-freeze delta (2026-10-26)

Scope: §2 re-spliced again (block lines 291–469) plus the Lead's §1 hash record and the seven build-seat divergence rulings (m05295). §3.1–§3.8 stay as written; this section is append-only.

**D10 — §2 identity after the second re-freeze: PASS.** `.tmp/s13/contract-0017.md` is 179 lines / 11,302 B, raw-byte sha256 `f655d95ef5324cf562f1954f106a0a3bcf910fc29dfe7880738bd14db775cbea`. EDICT §2 block lines 291–469 is byte-identical to it: extracting 291–469 and trimming the outer trailing newline reproduces the same 11,302 bytes and the same raw digest; the Lead's block hash `2feee210…d31b` is the line-joined normalisation of the same block (re-hashed, matches). The two edits are present and unambiguous: contract C72–C74 "Only builds with `active !== false` AND `status !== 'done'` participate in allocation: a `done` build is complete, shows `covered === needed` in its own detail, and does not consume inventory. `#inactive-mode` accepts `priority`, `end`, `hide` only — there is no `all` mode." The sentence is repeated in §5.7 (C156–C158) with `#inactive-mode` pinned at C138. Doc is **816 lines** after this section (§1 31–176, §2 177–470, §3.1 473, §3.9 730–750, §4 751, §5 765, §6 793); the +4-line shift from the first re-freeze is recorded in §3.8 D1.

**D11 — rulings folded into the frozen case list (all applied).**
1. `#inv-total` → `#inv-absolute` (contract C109/C151): cases 109/110/111 name `#inv-absolute`, and case 114 gains the id; `#inv-total` no longer appears in §3.3.
2. Sort modes: exactly three — `remaining` (default) / `name` / `category`, with the `MC_ICON_CATEGORIES` tiebreak (contract C96); case 107 re-frozen; a fourth mode is an app defect.
3. A row click opens `#inventory-dialog` (AC8): case 116 re-frozen — the case asserts the dialog opens for the clicked item; "opens nothing" is not the contract.
4. Import dropping an empty `customItems: {}` is accepted model behaviour (B-4); no case asserts retention.
5. B5/B7 stand as §3.8 records: no relative/local stamp wording, and the build clears `migratedFrom` on the first v2 save.
6. `inactive-state.json`'s `all` row was a case-side defect (B-6): retargeted to `hide` (excluded), keeping `priority` (dimmed in place) and `end` (sorted last); no `includeInactive` option is requested because it would break AC15. The fixture itself stored no mode, so no state edit was needed.
7. B-1…B-7 all resolved contract-side — the rows above follow the contract literally.

**D12 — case count frozen at 128** = 96 shipped + 32 new. Amended existing: 24, 39, 40, 41, 42, 45, 64, 72, 75, 86, 93, 94, 95, 96, 107, 109, 110, 111, 114, 116, 117, 118, 120, 121, 124 (25); new: 97–128 (32); the other 71 shipped cases unchanged; none deleted.

**D13 — residual notes (not blockers).** (a) Contract C136 names both `#world-progress` and `#world-progress-text`; freeze stands — the sentence sits in `#world-progress-text`, its container is `#world-progress`, exactly one progressText occurrence (case 118). (b) AC15's `#shopping-list` vs contract C137 `#btn-shopping-list`/`#shopping-dialog`/`#shopping-body`: freeze on the contract ids (case 119); `#shopping-list` is read as the button label. (c) The row field is `type="text" inputmode="numeric"` (C100) while the add form's `#mat-needed` stays `type="number"` (C123); both asserted as written. (d) §3.2's R2 text names `M.allocateInventory`; the frozen export is `M.allocate` (contract §1 lines 46–52) — the historical row stays, cases use `M.allocate`. (e) C72–C74 is the single authority for done builds; case 120 asserts it.

**Delta verdict: PASS-WITH-CASES.** The re-frozen sha `f655d95e…` is re-audited; §2 block byte-identical; both edits present; B1–B8 plus the seven divergence rulings resolved contract-side; the case list is frozen at **128** with the amendment record above. S5 may run against this list once `tests/unit/tracker-0017.test.mjs` exists and passes (R4 precondition).

### 3.10 Case sweep confirmation (third delta, 2026-10-26)

Scope: 兵部-c's static read of the frozen list reported three contradictions. The live §3.3 was already amended at 12:18–12:20 (doc mtime 12:20:05) — that read was of the 12:16 revision — but this section re-freezes the three points explicitly so the run cannot diverge. Count stays **128**; no case deleted.

**S1 — steppers are retired, not resurrected (AC7).** The v2 row alphabet is frozen as: `.mat-row__item`, `[data-mat-field="needed"]` (`type="text" inputmode="numeric"`), `[data-mat-got]`, `[data-mat-covered]`, `[data-mat-remaining]`, `[data-mat-surplus]` (`.is-surplus`), `[data-mat-update]`, overflow menu. `#mat-steps`, `.mat-steps`, `.mat-step`, `.stepper`, `.stepper__btn`, `[data-step]`, `[data-mat-step]` count 0 in every one of these cases; the add form keeps `#mat-needed` `type="number"` and has no `#mat-collected`, no stepper.

Amended cases (25) and their re-anchors: **24** full row alphabet + zero stepper nodes; **39/42/45** cell order + zero retired nodes; **40/41** Needed text commit/clamp/Escape, no dialog; **64** `M.formatUnits`/`M.stackNotation` (stack-1 `0 stacks + 1`, shulker 27×); **72** add-form `#mat-needed` number, `#mat-collected` absent; **75** `2s` delta via `#inventory-dialog`; **86** geometry on the alphabet, no `.stepper__btn`; **93** `#detail-progress`/`#detail-progress-text`/`#detail-bar`/`#detail-fill`; **94/95/96** `.ctile` → `#inventory-dialog`, compact from `M.allocate`, `#world-progress-text`; **107** three sort modes; **109/110/111/114** `#inv-absolute`; **116** row click opens `#inventory-dialog`; **117** `#inactive-mode` `priority`/`end`/`hide` only; **118** one progressText occurrence in `#world-progress-text`; **120** done excluded (`covered === needed`); **121** `M.allocate` + dialog.

**S2 — case 124 (stamps).** Frozen as: `.stamp[data-iso]` visible text matches `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/` and equals `M.formatStamp(iso)`; `title` === the element's `data-iso`; freshness asserted on `data-iso` (ISO), never relative text; no `just now`/local wording (contract §3 line 112 + AC3; founder's "relative" wording stays superseded as recorded in §3.8 D7).

**S3 — fixture README.** `inactive-state.json` row names `#inactive-mode=priority|end|hide` only and "there is no `all` mode"; no `active-only`/`all` row remains; the v1 row records the `#migrated-from` clearing rule. No fixture state changed.

**Sweep verdict: PASS-WITH-CASES** — the three contradictions are absent from the live §3.3/§3.4 and are now explicitly re-frozen; the frozen list is unchanged at **128** (96 shipped + 32 new; 25 amended, none deleted). This is the list the S5 run measures.

### 3.11 Audit rule retirements (fourth delta, 2026-10-26)

Scope: the Lead's first gate run reported `tests/qa/mc_ui_audit.py` at **175/186** with eleven reds, every one asserting a surface EDICT-0017 retires deliberately. This section records each retirement/supersession (origin edict → replacement rule). §3.1–§3.10 are unchanged; the audit rule count stays **186**.

**§2 identity after the datalist retirement.** `.tmp/s13/contract-0017.md` is 180 lines / 11,408 B, raw-byte sha256 `257ea9cb948bd5a610c04f26370fbe7d6a79576506d4aa49c0acc6233d1e3d8d`. EDICT §2 block **lines 291–470** is byte-identical (extraction reproduces the same 11,408 bytes and the same raw digest; `equal True`). This supersedes the `f655d95e…` freeze recorded in §3.9 — the delta is exactly the `#item-options` retirement, now in contract C87/C115.

| Rule (origin) | Why it is stale | Replacement (same rule count) |
|---|---|---|
| `html/no-datalist` (EDICT-0013 D8 → 0016 D8) | `#item-options` is now formally retired (contract C87/C115) | strengthened in place: no `id="item-options"` and no `item-options` reference in code. **Still red on the current tree** — see below. |
| `html/steppers` (EDICT-0016 §2) | the two-button `.stepper` is retired (AC7, C115) | `html/steppers-retired`: no `stepper`/`data-stepper-step`/`stepperHtml` in markup or code; the row Needed field is `type="text"` + `inputmode="numeric"` + `data-mat-field="needed"` |
| `html/needed-number` (EDICT-0016 AC5b) | the row Needed is a text field (C100), not a number input | add-form `#mat-needed` stays `type="number"` (C123); row field text/inputmode; no stepper renderer |
| `identity/css-.stepper` (EDICT-0016) | `.stepper` CSS is retired | `identity/css-.mat-chip` (grid chips, C109) |
| `edict0014/step-labels` (EDICT-0014 §8 → 0016 §2) | step labels die with the stepper | inverted: no `data-stepper-step`; stack sizing via `M.formatUnits`/`M.stackNotation` over `MC_ICON_STACKS` |
| `edict0014/bulk` (EDICT-0014 §12) | the `#bulk-*` dialog is retired (C115) | `#paste-preview` (`#paste-rows`/`#paste-errors`/`#paste-ok`/`#paste-cancel`) + `M.parseBulk`; `#bulk-dialog` absent |
| `edict0014/suggestion` (EDICT-0014 §8) | picker hooks moved on; EDICT-0017 §3 names no picker ids | re-anchored on the shipped hook: `M.suggestIcon`, `iconAuto`, `#icon-suggest-note`, `data-icon-suggested`, `"Suggested from"`; the 0014-era `#picker-note`/`.picker[data-mode]`/`data-icon-auto` are retired (note below) |
| `edict0015/id-world-remaining` (EDICT-0015 AC2) | `#world-remaining` is retired (contract C136) | loop id becomes `#world-progress-text`; absence of `world-remaining` in markup and code folded into `edict0015/world-summary-retired` (net-1 swap) |
| `edict0015/stats` (EDICT-0015 AC2) | header/detail stats are now one `progressText` sentence (AC1) | `progressText` in app+model, `#world-progress-text` in markup, and `M.worldSummary` still the allocation source; the retired `#world-summary` ids are asserted absent by their own rule |
| `edict0015/import-ui` (EDICT-0015 AC8) | the paste path moved (C111) | the import ids **plus** the `#paste-preview` family (`#paste-rows`/`#paste-errors`/`#paste-ok`/`#paste-cancel`); `#bulk-dialog` absent |
| `edict0015/add-steps` (EDICT-0015 AC6) | the add-form stepper is retired with AC7 | `#mat-needed` stays `type="number"` (C123); no `data-stepper-step` in markup or code; the row editor stays `[data-mat-field="needed"]` |

**Audit result on the current tree: 185/186.** The one red is `html/no-datalist`, and it is **app-side, not rule-side**: `src/index.html:194` still ships `<datalist id="item-options"></datalist>` and `src/app.js:2047-2049` still renders it (`/* §3: #item-options stays the datalist for the add-material form. */`), while contract C87/C115 require it gone from the DOM. Removing that element from `src/index.html` and the two references in `src/app.js` returns the audit to **186/186** with no further rule or case change; I will not weaken the rule to accommodate the residue (Q4).

**Retirement note (EDICT-0014 hook).** `data-icon-auto` on `#detail-avatar` (EDICT-0014 §8) is no longer emitted by the shipped app; the model flag remains and is display-only. Per "contract wins" this hook is recorded as retired here; no EDICT-0017 AC depends on it. If the Lead wants the marker restored, that is an app-side line plus a case, not an audit rule.

**Case 108 re-frozen** (no count change): `#material-grid` tile count = row count; open tiles show deficit, done tiles the target; tile ≥44×44 (≤64); every `.mat-chip[data-mat]` is a focusable button; Enter/Space opens `#inventory-dialog` for its material; Tab order follows the DOM — no roving tabindex and no arrow-key requirement (not in the contract).

**Delta verdict: PASS-WITH-CASES.** Rule retirements are recorded; the canonical contract identity is `257ea9cb…` over block 291–470; the frozen list stays **128** (96 shipped + 32 new; case 108 amended); audit is 185/186 pending the one-line app-side datalist removal. S5 is authorised on the same terms as §3.9 (unit suite `tests/unit/tracker-0017.test.mjs` must exist and pass first).

## 4. Planned verification

| Check | Command / evidence | Planned result |
|---|---|---|
| Migration | `tests/unit/tracker-0017.test.mjs` with v1 fixtures | sums `collected` per world/item case-insensitively, drops `collected`, preserves build order and `active`, clamps malformed numbers to 0, idempotent, never throws |
| Allocation | the same unit suite | priority order, no double counting, surplus/shared counts, covered+remaining = needed, completed builds consume unless inactive |
| Units and text | the same unit suite | `progressText` exact strings including 0/0; `formatUnits` items/stacks/shulkers, shulker = 27 × stack; `stackNotation`; never negative |
| Model API | the same unit suite | `inventoryOf`, `setInventory`, `addInventory`, `shoppingList`, `setBuildActive`, `moveBuild`, `buildProgress` match contract §1 |
| Browser suite | `node scripts/app-qa.mjs run` (Lead runs Chrome) | grows from the shipped 96 cases; the frozen list is §3.3, authored by 測試部; every item in §1 has at least one case |
| UI audit | `python tests/qa/mc_ui_audit.py` | additions: no fixed-height materials scroll box, no negative remaining text, surplus class, unit-toggle wiring, relative stamps, inventory-dialog wiring, retired stepper |
| Budgets | `probe.json` at 1280×900 and 390×844 | header + progress + toolbar + ≥6 rows visible without page scroll; page may grow; no horizontal overflow at 390; grid ≤4 chips/row; chip target ≥44×44 |
| Evidence | `reports/qa/evidence/edict-0017/` | the D15 crate, all hashes distinct |
| Non-regression | `npm test`, audit, browser suite, stamp | all green, no deleted case, stamp refreshed after the last source change; v1 import still works |

## 5. R9 wiki impact

Every page this edict creates or updates:

- `design-system/minecraft-tracker/MASTER.md` — shared inventory and allocation (Got is the
  world's count; surplus/shared indicators), the simplified row (editable Needed text, read-only
  Got/remaining, Update action, overflow Remove), the inventory dialog, the toolbar
  (sort/hide/table-grid), grid chips, compact draggable build rows with priority accent and
  inactive states, the collapsible sidebar with one progress summary and the shopping-list dialog,
  the grouped header card, relative stamps, unit toggle and the retired stepper; checklist counts
  move to the S5 record.
- `design-system/minecraft-tracker/pages/tracker.md` — page anatomy, rules, AC references,
  verification table and known gaps for this round.
- `README.md` — the feature list names the shared inventory, deterministic priority allocation,
  surplus, the inventory dialog, table/grid, build ordering/activation, the shopping list and the
  unit toggle; local-first/export framing and licence note stay.
- **Create** `wiki/concepts/shared-inventory.md` — one per-world inventory, the v1→v2 migration,
  priority allocation, surplus/shared semantics, the inventory dialog and the v2 shape.
- **Update** `wiki/entities/minecraft-build-tracker.md` — shared inventory, allocation, units,
  table/grid, build-list priority and activation, sidebar/shopping list, and refreshed
  verification counts.
- **Update** `wiki/synthesis/open-questions.md` — recipe expansion and phases (with phase targets)
  deferred to round 6 / EDICT-0018; keep the deferred compact items honest.
- **Update** `wiki/index.md` (generated) and **append** `wiki/log.md` with an `ingest` entry citing
  EDICT-0017.
- Ledger: EDICT-0017 lifecycle rows from the first free seq, one per event with the document hash.
- `node src/wiki/cli.mjs index --write`, `lint` and `sync` must be clean at S6.

## 6. Limits

- **No phases and no recipes.** Phase targets, "Advance Phase", crafted→raw expansion, crafting
  procs and the effort-in-minutes UI belong to EDICT-0018; the 30 items/min constant may exist in
  the model now but is not surfaced in this round.
- **No Compact rewrite.** Compact cards, tiles, action bar, Manage Priority/Inventory bars and
  Compact responsiveness are untouched; its phase boundary stays as recorded in EDICT-0016.
- **No asset change.** Icons, fonts, backdrop and panorama are untouched; no regeneration, no new
  hashed asset beyond the app files the stamp already covers.
- **Schema 2 is additive.** v1 backups import and migrate once; round 6 must not need a second
  migration, so the inventory shape and `active` flag are frozen here.
- **Allocation is computed, never stored.** No cached allocation, no per-build coverage field.
- **No second progress phrasing.** Any new surface that shows progress uses `M.progressText`; the
  retired strings are not re-added.
- **The stepper is retired, not moved.** No `data-step`, `.stepper__btn` or `.mat-steps` node may
  survive in the Standard detail or the add form; the two-value inventory dialog replaces the
  quantity workflow.
- **Browser execution stays with the Lead** (the verifier sandbox cannot launch Chrome); 測試部
  authors and judges, 礼部 records. The app-qa stamp is rerun after the last source change.
- **Budget discipline.** Desktop ≥6 rows visible without page scroll; 390 no horizontal overflow;
  grid chip target ≥44×44. The EDICT-0016 page ceilings are not binding here.
- **Status label.** `S1 DRAFTED` follows the dispatch board; the canonical machine has S2 audit /
  S3 builds / S5 QA_PASS / S6 report, and the ledger records the real order.
- **No raw source** is planned; the sanitised report lives in §1 under the EDICT-0013 precedent.
