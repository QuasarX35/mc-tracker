# EDICT-0016 — independent QA report (S5Q, cycle 1)

**Verdict: QA_PASS, cycle 1.** The frozen 96-case suite, the 186-check UI audit, the unit and acceptance
suites and the R10 stamp all agree on one tree. No case was deleted; every amendment to a shipped case is
disclosed in `docs/governance/EDICT-0016.md` §3.8 (append-only, §3.8.1–§3.8.12) and restated in its §4.1.

| Field | Value |
|-------|-------|
| Edict | EDICT-0016 (round-4 items 1–14, Compact Mode phase 1) |
| Cycle | 1 |
| Artifact pinned | `HEAD e1308d6` + the S5 working tree (21 modified paths); stamp over 8 sources |
| Submitter | 兵部 (packages A/B) + 工部 (contract research) |
| Verifier | 測試部 — different seat (Q1); wrote every case, ran the static gate, re-hashed the stamp, judged the evidence |
| Environment | Node v22.14.0; bundled Python 3.12.14 + Pillow 12.3.0; Chrome 155.0.8059.86 |
| Browser execution | Lead seat (`.tmp/s11/run10.log`); verifier sandbox cannot launch Chrome — EDICT-0012 precedent, disclosed |
| Evidence | `reports/qa/evidence/edict-0016/` — 13 designed artefacts + 4 suite-captured shots + `probe.json` + `README.md` (19 files) |
| Date | 2026-10-25 |

## Commands and counts

| Gate | Command | Expected | Result |
|------|---------|----------|--------|
| Browser suite | `node scripts/app-qa.mjs run` (Lead seat, `.tmp/s11/run10.log`; the stamping run re-ran the same suite) | 96/96, exit 0 | **PASS** — `# tests 96 / # pass 96 / # fail 0 / # duration_ms 68382`, exit 0 |
| Stamp | `node src/wiki/cli.mjs app-qa`; independent sha256 re-hash of all 8 stamped files | verified, 96 cases, after the last source write | **PASS** — `verified — 2026-10-25T16:45:20.403Z (96 UI cases)`; **8/8 re-hashed, 0 mismatches**; suite `tests/qa/ui.e2e.test.mjs`; last source write 00:39:59 < stamp 00:45:20 |
| UI audit | bundled Python `tests/qa/mc_ui_audit.py` | the shipped count, honest | **PASS** — **186/186**, exit 0 (187 − 2 retired-strip checks + 1 `.stepper` identity check; §3.8.6) |
| Unit | every `tests/unit/*.test.mjs` run directly | all green | **PASS** — 123/123 (app-qa 9, tracker-0015 11, tracker-0016 14, tracker-icons 9, tracker-model 22, tracker-suggest 38, wiki-core 10, wiki-sync 10) |
| Acceptance | every `tests/qa/*.acceptance.test.mjs` run directly | all green | **PASS** — 97/97 (7+11+15+11+7+8+17+8+13) |
| Wiki | `app-qa` / `index --check` / `sync` / `lint` | verified / up to date / sync / clean | **PASS** — verified; up to date; 8/8; clean (24 pages, 0 errors, 0 warnings) |
| Evidence | directory audit | named files, fresh, distinct | **PASS with one note** — 19 files at 00:47:29–00:48:21 (after the stamp); `03-world-sidebar.png` and `13-metadata-stamps.png` share one SHA-256 (disclosed); `probe.json` has no `generated_at` (freshness by mtime) |

All non-browser gates were re-run by 測試部 on the S5 tree. The browser run and the screenshots are the
Lead's, as agreed for this round; the evidence values are cross-checked against `probe.json` and the cases.

## AC by AC (contract-0016 + the §3 rulings)

| AC | What was measured | Result |
|----|-------------------|--------|
| AC1 | case 81 green: root 18 px, body 18 px, masthead `clamp(28px,3.8vw,44px)` = 44 at 1280 (≤46), `.mc-btn` ≥34, inputs ≥42/18, no scale/zoom; 390 `scrollWidth === clientWidth` (probe overflow 0) | PASS |
| AC2 | probe `gathered` padding `10px 14px`, label↔pct gap 404.6 px (≥12) on one baseline; case 82 bar spans inner width | PASS |
| AC3 | probe `notesView`: transparent bg, `rgb(63,63,63)` text, textarea not visible; case 83 border/shadow/padding `0px 2px`/pre-wrap; empty state case 35 (`No notes yet.` + `notes__text--empty`) | PASS |
| AC4 | probe `notesEdit`: Save 36×32, Cancel 36×32, glyph 14×14, hint `Ctrl+Enter to Save` left of Save, hint bottom 414 vs field bottom 495; case 84 order/tops + Escape/Ctrl+Enter | PASS |
| AC5 | case 85: every check svg 14×14, viewBox 14, exact path `M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z` (`#notes-save`, `#build-name-save`, dialog confirms incl. `#import-dialog`, `#tile-save`) | PASS |
| AC6 | cases 72/75: add form uses `div.stepper[data-stepper]` around `#mat-needed`, no `#mat-steps`/`.mat-step` strip, Shift resolves 1/16/64 via `M.stackSizeFor`, one material per submit | PASS |
| AC7 | probe `stamps`: `Created 2026-10-25 16:47` / `Updated 2026-10-25 16:47` in `<time datetime>` with ISO `title`; unit tracker-0016 14/14 (createdAt immutable, updatedAt advance, absent-safe `—`, export shape, SCHEMA 1); `v1-no-timestamps.json` and `malformed-timestamps.json` import and display `—` without rewriting the raw value | PASS |
| AC8 | probe `selectAll`: `selectionStart`/`End` `null` on `type=number` but `value` fully selected; case 88 asserts capability-safely | PASS |
| AC9 | case 89: wheel on focused input ±1 / Shift ±stack / Ctrl ±16, `scrollTop` unchanged; unfocused wheel ignored | PASS |
| AC10 | probe `enterNext` Needed → next row Needed (value 64); case 90 needed/got columns, last keeps focus, add form Needed → Got | PASS |
| AC11 | case 91: panel 1240, sidebar ≥220 first, DOM order `#world-avatar,#world-select,#world-panel-name,#world-meta,#world-stats,#btn-new-world,#btn-import,#btn-export`, no world node in the top bar, hidden on Worlds/Compact; 390 stacks (probe `budget390.sidebar` 174), actions reachable; list 300; item column **252 at 1280 / ≈140 at 390** — the contract's 390 is superseded with arithmetic (§3.8.9) | PASS (supersession disclosed) |
| AC12 | probe `steppers`: four 28×28 buttons, input 44×28, `+` left of input, aria `Increase needed for Stone Bricks`; cases 86/92 (cluster 28 rows / 36 add form; spinners CSS-only; `#mat-steps`, `.mat-steps`, `.mat-step`, `materialStepsHtml`, `data-step` all absent); cases 89/90 cover wheel/Enter; row inputs 28, dialog 42 (§3.8.9) | PASS (supersession disclosed) |
| AC13 | case 93: both section-head rules ≤0.5 px apart at 1280, `padding-bottom: 4px`, `min-height: 44px`, centred | PASS |
| AC14 | probe `compact`: 3 cards / 2 columns / 9 tiles, `#compact-world` = `Survival SMP · Java 1.21.4 · 36% gathered · 1,452 of 2,252 items still to collect`; tile tooltip `Stone Bricks: 200 / 384 (3 stacks + 8 / 6 stacks + 0) · Updated 2026-10-25 16:47`; quick-update absolute 200 / relative 0, Enter commits + Undo; cases 94/95/96; 390 overflow 0 | PASS |

## Case-side work and disclosures

The frozen suite grew from the EDICT-0015 set of 80 to **96** cases (16 new: 81–96) and amended the cases
the contract invalidated. All of it is recorded append-only in §3.8; the short list:

- **Retired strips**: cases 39, 40, 41, 42, 45, 64, 72, 75 rewritten to the two-button `.stepper` shape
  (order `['1','-1']`, `+`/`−`, plus-left geometry, Shift/Ctrl resolution, no `data-step`/`data-mat-step`).
- **World strip / sidebar**: case 79 identity-substring re-freeze (the meta now carries timestamps); case 80
  containment guard rescoped to the sidebar cluster; case 70's top-bar sample is the bar's own row after the
  run-8/9 rulings (stepper is a grid column: 5 children vs 5 header cells, `row.children` compared directly);
  case 91 samples the sidebar's own order.
- **Notes/type/bars**: cases 35–37 (notes view/edit), 52 (type scale) re-anchored; case 71 budgets 960→1,000
  desktop / 1,700 mobile; case 93 floors 300→250 (1280) and 240→130 (390) with arithmetic.
- **Timestamps/stamps**: case 87 model oracle + malformed fixture display; case 96 agrees to
  `(Created … · )?Updated …` inside `<time>`, ISO `datetime` unchanged.
- **Compact**: case 94 sets its own 1280 viewport (it used to inherit 390 from case 93); case 95 waits on
  `dialog.open` (a `<dialog>` never toggles `hidden`) and asserts the resulting `collected`; case 96 covers
  the stamp surfaces.

Fixtures added under `tests/qa/edict-0016-fixtures/` (README + generator): `v1-no-timestamps.json`,
`malformed-timestamps.json`, `stepper-state.json`, `no-icon-state.json`, `compact-state.json` — all five
import through `M.importJSON`.

## Findings and residual risks

1. **No blocking finding.** Every red seen during S5 was triaged to its owner (case oracle vs app) and
   closed: the last case-side red was case 70's stale `.stepper` filter (§3.8.12); the last app-side reds
   were the 390 top-bar wrap, mobile 1,703 > 1,700 and case-80 containment at 390, plus case 95's missing
   Undo toast (all fixed before this package).
2. **Superseded numbers** — item column ≥390 → 250/130; `.mat-row` ≤62 → ≤78/≤96; row inputs → 28 (dialog
   42); clusters 28/36; top-bar centre grouping; `<time>` display prefix; quick-update Enter + Undo. Each has
   a measured value and arithmetic in §3.8.9–§3.8.12; 礼部 must carry them into the contract at S6.
3. **Audit count** is 186, not the shipped 187: two retired-strip checks were replaced by the `.stepper`
   identity check and a `.stepper` order/geometry check; no other check changed (§3.8.6).
4. **Evidence duplicate:** `03-world-sidebar.png` ≡ `13-metadata-stamps.png` (same SHA-256). The stamps are
   verified by `probe.stamps` and case 96; regenerate or relabel 13 before S6 (non-blocking).
5. **`probe.json` has no `generated_at`**; freshness is the file mtime 00:47:33, after the last source write
   (00:39:59) and the stamp (00:45:20). EDICT-0015's probe carried the field; this one does not.
6. **Mobile budget headroom** is +80 px on the binding fixture (1,620 vs 1,700); the demo page is 1,567.
   Desktop fixture 976 vs the S5 ceiling 1,000; demo 984.
7. **Seat separation** (Q1/Q4): browser run, screenshots and stamping are the Lead's; this seat authored all
   cases, ran the static gate, re-hashed the 8 stamped sources and judged the evidence. QA_PASS is binding.

## Evidence manifest

`reports/qa/evidence/edict-0016/` (19 files): `01-standard-builds-1280x900.png`,
`02-standard-builds-390x844.png`, `03-world-sidebar.png`, `04-notes-view.png`, `05-notes-edit.png`,
`06-gathered-block.png`, `07-stepper-cluster.png`, `08-number-field-focus.png`, `10-compact-view-1280x900.png`,
`11-compact-tile-tooltip.png`, `12-compact-quick-update.png`, `13-metadata-stamps.png`,
`14-budget-390x844.png`, `68-alignment-1280.png`, `69-alignment-390.png`, `70-height-1280.png`,
`71-height-390.png`, `probe.json`, `README.md` — 16 PNGs with one disclosed duplicate hash pair; probe
carries page heights/overflow, notes styles, gathered padding/gap, stepper geometry, select-all, Enter walk,
compact counts, tooltip text, quick-update prefill, stamp displays and the 390 budget row.
