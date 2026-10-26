# EDICT-0018 evidence crate

Captured 2026-10-26 (Asia/Singapore) against the verified tree; the app-qa stamp
`2026-10-26T08:05:42.834Z` (cases 128, artifact_hash `b667495d1e91c66a…`) was written after
every artefact here, so each file postdates the last source change.

## Round captures

| File | Proves |
|------|--------|
| `builds-table.png` | the standard view at 1280×900: rank badges, painted build bars, the eight-column table (`Needed | In world | Allocated | Left | Surplus`), icon Update buttons, the merged footer |
| `compact.png` | compact cards with need-above-count tiles, dimmed/done tiles and the revealed action icons |
| `inventory-dialog.png` | the dialog head (icon, item, builds using the item), the live preview and the short `+64` placeholder with the rule in the hint |
| `inventory-dialog-delta.png` | the preview after typing `2s+10` |
| `allocation-hut.png` | the later build sees the reduced stock — allocation priority follows the list order |
| `surplus-row.png` | `+385 surplus` on a world whose stock exceeds the total need |
| `shopping-dialog.png` | the shopping list dialog, one row per item |
| `sidebar-collapsed.png` | the 56 px rail without a stray bar |
| `mobile-table.png` / `mobile-grid.png` | the 390×844 ladder: stacked rows, no horizontal scroll, the grid view |
| `probe.json` | measured geometry and counts (main 1232 / panel 200 / list 360 / detail 646, six 48 px rows at the budget fixture, dialog context, coords `X 120  Y 64  Z -40`, "Updated just now", compact `doneDim 0.6`, svg 14 px, rail 56) |

The seven numbered files are the suite's own mid-run shots (`shot()` calls in
`tests/qa/ui.e2e.test.mjs`) for the legacy cases 01/03/24/25/27/47/48.

## Verification commands

```
node tests/qa/ui.e2e.test.mjs        # 128/128
python tests/qa/mc_ui_audit.py       # 186/186
npm test                             # 152 across 12 suites, exit 0
node scripts/app-qa.mjs run          # re-runs the suite and stamps
```

## Known limit

The keyboard reorder (`Alt+↑/↓`) is exercised through a scripted `KeyboardEvent` with
`altKey: true` because the CDP `press` helper carries no modifier flag; the drag path is the one
the suite drives.
