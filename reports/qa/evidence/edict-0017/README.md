# EDICT-0017 evidence crate

Captured 2026-10-26 by `.tmp/s13/evidence-0017.mjs` (Chrome via `tests/qa/ui/harness.mjs`,
dedicated profile, DevTools port 9421) after the last source change and before the app-qa stamp:

- `app-qa.json` → `verified_at 2026-10-26T06:37:19.750Z`, `cases 128`,
  `artifact_hash 4bec95d9…`
- `probe.json` → `captured_at 2026-10-26T06:35:22.694Z`

Every PNG here was written by that capture pass except the seven `NN-*.png` files, which are the
matching browser-suite shots (`shot()` in `tests/qa/ui.e2e.test.mjs`) from the 128/128 run — they
are kept because the §3.5 crate names and the suite's own evidence names overlap for empty state,
demo seed, 390 layout, visual contract, icon fallback, themed select and the panorama probe.

## §3.5 required names

| File | Shows |
|---|---|
| `builds-table.png` | Standard view, demo Iron Farm, materials table above the fold |
| `grid-view.png` | `#material-grid` chips for the same build, ≥44 px squares |
| `inventory-dialog-empty.png` | `#inventory-dialog` opened from a row, absolute prefilled, empty delta |
| `inventory-dialog-2s10.png` | delta `2s+10` typed, preview/context state |
| `surplus-row.png` | `surplus-state.json`: 97 needed, 482 in stock, `+385 surplus` |
| `shopping-dialog.png` | `#shopping-dialog` deficits once, descending, per-row builds |
| `sidebar-collapsed.png` | rail at 56 px with `#sidebar-toggle` pressed |
| `unit-toggle-items.png` / `unit-toggle-stacks.png` | items → stacks rendering of Needed/Got |
| `paste-preview.png` | `#paste-preview` after `64 stone bricks / 32 glass / 1 mystery widget` |
| `drag-before.png` / `drag-after.png` | build list before and after moving the last build to the top |
| `mobile-table.png` | 390×844 stacked table (no horizontal scroll) |
| `mobile-grid.png` | 390×844 grid, scrolled to the grid, ≤4 chips per row |
| `probe.json` | measured geometry, dialog state, units, paste, drag, retired-id probes |

## probe.json highlights

- Desktop 1280×900: `#main` 1232, `#world-panel` 200, list 360, detail 646, toolbar top 500,
  no horizontal overflow; 4 fully visible rows on the demo Iron Farm (as many as it has).
- Inventory dialog: title `Update Stone Bricks`, context
  `Iron Farm (spawn) · 384 needed · 200 in the world · 200 covered`, `#inv-absolute` is a number
  field, delta placeholder `+64, -32, 2s, 2s+10`, error hidden.
- Surplus fixture: needed `97`, got `482`, remaining `0`, `+385 surplus` with class
  `num is-surplus`.
- Shopping dialog: 6 rows, first `Cobblestone`, counts `468 / 448 / 440`, builds `Nether Hub`.
- Collapsed rail: 56 px, `body.is-sidebar-collapsed`.
- Units: needed `6 stacks`, got `3 stacks + 8`, pressed `items:false,stacks:true,shulkers:false`.
- Paste: 2 matched, 1 rejected, `#paste-errors` names the raw line, `#paste-ok` enabled.
- Drag: `Iron Farm, Storage Hall, Nether Hub` → `Iron Farm (0), Nether Hub (1), Storage Hall (2)`.
- 390×844: `scrollWidth` 390, no horizontal overflow, Got width 48 px.
- Retired probes all false/zero: `#mat-collected`, `#item-options`, `#tile-dialog`,
  `#bulk-dialog`, steppers `0`, URL fragment `no-hash`.

## QA trail

The QA report is [`../../edict-0017-qa.md`](../../edict-0017-qa.md); suite logs are
`.tmp/s13/run8.log` (128/0), `.tmp/s13/appqa-run.log` (stamp), `.tmp/s13/npmtest.log` (chain).
