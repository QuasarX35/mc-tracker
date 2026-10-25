# EDICT-0015 — independent QA report (S5Q, cycle 1)

**Verdict: QA_PASS, cycle 1 — re-issued 2026-10-25 22:40 after the detail-panel re-nest.**

**Withdrawal and re-issue (history, kept for the record).** The first PASS (22:30) was withdrawn
when the Lead re-measured the same tree and found `.materials` moved out of the detail panel:
`#build-detail` children were `.empty`, `.detail` (191.5 px) and `.materials`, `#detail-body
.materials` was `false`, depth 4 against 5 in `HEAD`. Div balance was 82/82 before and after, so
this was a moved close, not a stray tag; the earlier readings of clipping, heading overlap and
top-bar overlap were **not** supported by the measured rects. 兵部 re-nested the block, the frozen
suite grew **case 80** (containment + non-overlap), and the re-issued PASS below is on the fresh
package. Case 80's own first run failed in the case (bare IIFE in the CDP `evaluate` wrapper, no
`return`) — fixed by 測試部, disclosed in the edict §3.8.

| Field | Value |
|-------|-------|
| Edict | EDICT-0015 (items 1–10 of the round-3 report) |
| Cycle | 1 (re-issued after the S5Q containment defect) |
| Artifact pinned | HEAD `9c9fe1a` + the S5/S5Q working tree after the 22:34 `src/index.html` re-nest (8 source hashes in `docs/governance/app-qa.json`) |
| Submitter | 兵部 (items 1–7, 10) / 工部 (item 9 research) |
| Verifier | 測試部 — different seat (Q1) |
| Environment | Node v22.14.0; bundled Python 3.12.14 + Pillow 12.3.0; Chrome 155.0.8059.86 |
| Browser execution | Lead seat (verifier sandbox cannot launch Chrome); disclosed per the EDICT-0012 precedent |
| Evidence | `reports/qa/evidence/edict-0015/` (31 files, 30 artefacts + README) |
| Date | 2026-10-25 |

## Commands and counts

| Gate | Command | Expected | Result |
|------|---------|----------|--------|
| Browser suite | `node scripts/app-qa.mjs run` (Lead seat, `.tmp/s8/run13.log`) | 80/80, exit 0 | **PASS** — `# tests 80 / # pass 80 / # fail 0`, 66.7 s (run 12 was 79/80, case-80 bug, fixed) |
| Stamp | `node src/wiki/cli.mjs app-qa`; independent sha256 re-hash of the 8 stamped files | verified, 80 cases, after the last source write | **PASS** — `verified — 2026-10-25T14:39:07.404Z (80 UI cases)`, **8/8 re-hashed, 0 mismatches**; `artifact_hash c36dee79…`; last source write 22:34:36 < stamp 22:39:07 |
| UI audit | bundled Python `tests/qa/mc_ui_audit.py` | ≥187/187 | **PASS** — 187/187, exit 0 |
| Static acceptance (this edict) | `node tests/qa/edict-0015.acceptance.test.mjs` | 11/11 | **PASS** — 11/11 |
| Unit | every `tests/unit/*.test.mjs` run directly | all green | **PASS** — 109/109 (app-qa 9, tracker-0015 11, tracker-icons 9, tracker-model 22, tracker-suggest 38, wiki-core 10, wiki-sync 10) |
| Acceptance | every `tests/qa/*.acceptance.test.mjs` run directly | all green | **PASS** — 96/96 (7+11+14+11+7+8+17+8+13) |
| Wiki | `index --check` / `sync` / `lint` | up to date / clean / sync | **PASS** — up to date, 7/7, clean (22 pages, 0 errors, 0 warnings) |
| Evidence | `reports/qa/evidence/edict-0015/` | named files, no duplicates, probe fresh | **PASS** — 30 artefacts + README, 0 duplicate hash groups; `probe.json.generated_at 2026-10-25T14:39:27.783Z` (after stamp and last source write), 16/16 steps `ok`, 17 recorded artefacts re-hashed **and re-sized: 0 mismatches** |

All non-browser gates above were re-run by 測試部 on the re-issued tree; the browser run is the
Lead's and is cited from `run13.log`, as agreed for this round.

## AC by AC (contract-0015)

| AC | Surface | Evidence | Result |
|----|---------|----------|--------|
| AC1 | build ordering (building → planned → done, stable, selection preserved) | case 67, probe `A builds order ok` | **PASS** |
| AC2 | header stats retire `#world-summary`, add `#world-progress`/`#world-remaining`/`#world-bar`/`#world-fill`, derived 33 % on the budget fixture, `#world-meta` identity-only, empty-world/no-world rules | cases 68/69/79, `03-header-stats-clip.png`, `67-world-header-stats.png`, probe `A header stats ok` | **PASS** |
| AC3 | alignment measured ± 1 at 1280×900 and 390×844 (per-row interpretation) | case 70, `68-alignment-1280.png`, `69-alignment-390.png`, probe `C alignment ok` (label lefts 452 / 731 / 878, one control height per row) | **PASS** |
| AC4 | custom material model: shape, three registries, resolver precedence build→world→account→catalogue, four exact error strings, export/import, v1 backups | cases 74/75/77, static A7/A11, probe `D` steps | **PASS** |
| AC5 | custom-material UI: picker footer `#btn-new-custom` (material mode only), `#custom-dialog`, scope select, catalogue icon or upload, badge + catalogue-first ordering | cases 74/76, `06-custom-dialog.png`, `07-custom-tile-clip.png` | **PASS** |
| AC6 | add-form steppers: `#mat-steps`, unsigned `data-step`, hidden stack until pick, labels from the resolver (64/16/clamped 1), never below 1, Got untouched | case 72, `04-add-form-clip.png`, `05-row-stack1-clip.png`, `05-row-stack16-clip.png`, probe `B row steps ok` | **PASS** |
| AC7 | height/overflow budget on `tests/qa/edict-0015-fixtures/budget-state.json` | case 71 — desktop **900**/900, mobile **1,423**/1,500, `scrollWidth === clientWidth` both, `11-budget-*.png`, probe `H` | **PASS** |
| AC8 | import: `.json` accept, dialog, paste + drop restore without the chooser, model errors, re-render | case 73, `08-import-dialog.png`, probe `E` | **PASS** |
| AC9 | `docs/backlog/ux.md` living table ≥ 8 rows | static A8 | **PASS** |
| AC10 | `docs/backlog/mass-input-research.md` ≥ 6 named apps + `_index.md` links | static A8 | **PASS** |
| AC11 | rotation: one layer, 800vh width / 400vh auto size, `backdrop-drift 120s linear infinite`, pause control + stored state, paused-under-reduce with opt-in (R7) | cases 26/48/78, `09-backdrop-t0/t1/t2.png`, `10-backdrop-reduced-motion.png`, probe `F` (transform advances ≈54 px/frame pair, `state running`, pause flips to `paused`) | **PASS** |
| AC12 | non-regression: 66 prior cases kept (26/48 amended, disclosed), 14 new 67–80, audit 187, unit 109, acceptance 96, stamp, wiki | suite count **80**, audit 187, unit 109, acceptance 96, stamp verified, lint/sync clean | **PASS** |

## Findings during verification (all resolved; owners named)

| # | Severity | Surface | Finding and resolution | Owner |
|---|----------|---------|------------------------|-------|
| 1 | Major | test | Case 67's ordering fixture was not a valid backup (materials lacked `id`); the app was right to refuse it. Fixture regenerated with ids + A11 round-trip guard. §3.8. | 測試部 (case) |
| 2 | Major | test | Case 68 read `#world-fill` mid-transition; the case settles the animation before measuring (bar 10 px, inner fill 6 px per the S2 box-model clarification). | 測試部 (case) |
| 3 | Major | test | Case 70 initially required three flat labels; the frozen contract pairs each label with its own control. Corrected, then re-scoped per-row by the Lead's S5 ruling. | 測試部 (case) |
| 4 | Major | test | Case 74 saved without an explicit scope and read a stale `#custom-error`; it now picks a scope and uses a fresh dialog per refusal. | 測試部 (case) |
| 5 | Major | test | Case 78 ran under the host's emulated `prefers-reduced-motion: reduce`; it now clears emulation first. | 測試部 (case) |
| 6 | Minor | test | `#backdrop-pause` static assertion used a non-contract `.backdrop__pause` class; fixed. Lazy `#icon-sentinel` check moved to `src/app.js`. | 測試部 (case) |
| 7 | Major | test | Case 80's first version returned `undefined` from the CDP `evaluate` wrapper (bare IIFE); fixed with a leading `return` after run 12 (79/80). | 測試部 (case) |
| 8 | Blocking→fixed | app | `#world-progress`/`#world-remaining`/`#world-bar` were not `hidden` with no world; the empty-state rule now hides them (case 69). | 兵部 |
| 9 | Blocking→fixed | app | Creating a custom item from the picker left the icon dialog open; custom-icon pick now closes only the icon dialog (case 74). | 兵部 |
| 10 | Major→fixed | app | `#custom-error` persisted across dialog opens; cleared on open (case 74 refusals). | 兵部 |
| 11 | Blocking→fixed | app | Unconditional `.mat-choice__name` nowrap broke case 52 at 390; the scoped fix still tripped it via `text-overflow: ellipsis`. Final: zero `text-overflow` in `src/**`, placeholder rule at `src/styles.css:1374`, ≥170 px item column at ≤640. | 兵部 |
| 12 | Blocking→fixed | app | Paging stopped accumulating after a search reset (case 53 batch count); accumulation restored. | 兵部 |
| 13 | Major→fixed | app | Height budget missed at 1,019 → 952 px; final CSS trims land **900** at 1280×900 and **1,423** at 390×844 (mobile threshold 1,500 per the Lead's §7 S5 amendment; §1 AC7/§4 planned row still cite the pre-trim 1,436 — S6 should reconcile the figure). | 兵部 |
| 14 | Blocking→fixed | app | `.materials` was moved out of the detail panel during the S5 CSS work (`#detail-body .materials` false; depth 4 vs 5; `.detail` 191.5 px) — all 79 frozen cases passed it. Found by the Lead's re-measurement after the first PASS; 兵部 re-nested it, **case 80** now asserts containment and pairwise non-overlap at both viewports. | 兵部 |
| 15 | Minor→fixed | app | Top-bar control centres spread 10.16 px (pause 28 px vs select 41 px); the top bar now centres its own items (case 70). | 兵部 |

## Disclosed amendments (frozen in §3.8 of the edict)

- `EVIDENCE` path changed to `reports/qa/evidence/edict-0015/`; suite captures stay inside the crate.
- Cases 26 and 48 rewritten for contract §1 + R7 (one layer; paused under `reduce`; play opt-in) —
  the EDICT-0014 assertions are superseded, not deleted.
- 13 new browser cases 67–79, plus **case 80** added after run 11 for the containment defect;
  case 70 additionally asserts the `Item` label `for="mat-choice"`.
- Static acceptance grows to 11 cases with A11 (valid fixtures round-trip, invalid refused with
  exact strings, the ordering fixture sorts to its oracle).
- The mobile height figure moved 1,419 → **1,423** (+4 px) with the re-nest; threshold unchanged.
- No prior case deleted; no AC weakened.

## Residual limits (also appended to EDICT-0015 §6)

1. **Pause state persists; the paused phase does not** — `#backdrop-pause` and
   `mc-build-tracker:motion` survive a reload, but the animation restarts at phase 0, so the
   frozen frame re-calibrates on reload (state and paused style are asserted, not the pixels).
2. **`backdrop-filter` (backdrop blur) is unsupported in this environment** — the scenery
   sharpening remains the EDICT-0014 paint-level `filter` treatment; no rule depends on
   `backdrop-filter`.

## Evidence manifest

`reports/qa/evidence/edict-0015/` — 31 files (30 artefacts + `README.md`), **0 duplicate hash
groups**, `probe.json` generated `2026-10-25T14:39:27.783Z` (after the stamp and the last source
write) with Chrome UA `HeadlessChrome/155.0.0.0`, 16/16 steps `ok`, 17 recorded artefacts whose
sha256 **and byte sizes** were re-verified by 測試部: 0 mismatches. Key captures:
`01-builds-1280x900.png`, `03-header-stats-clip.png`, `04-add-form-clip.png`,
`05-row-stack1-clip.png`, `05-row-stack16-clip.png`, `06-custom-dialog.png`,
`07-custom-tile-clip.png`, `08-import-dialog.png`, `09-backdrop-t0/t1/t2.png`,
`10-backdrop-reduced-motion.png`, `11-budget-1280x900.png`, `11-budget-390x844.png`,
`67-world-header-stats.png`, `68-alignment-1280.png`, `69-alignment-390.png`,
`70-height-1280.png`, `71-height-390.png` — plus the suite's own captures
(`01-empty-state`, `03-demo-seed`, `24-mobile-390`, `25-visual-contract`,
`27-icon-fallback-probe`, `47-themed-select`, `48-backdrop-narrow-blur`).
