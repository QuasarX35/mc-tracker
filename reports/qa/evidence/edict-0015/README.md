# EDICT-0015 evidence crate

Produced by the Lead's evidence script (`tests/qa/ui/edict-0015-evidence.mjs`) in headed/headless Chrome 155.
Verifier: 测试部. The measured oracle is `probe.json`; screenshots are visual corroboration, not the oracle.

| File | Covers | What it must show |
|------|--------|-------------------|
| `probe.json` | AC1, AC2, AC5, AC6, AC7, AC8, AC9, AC11 + measured probes | 16 numbered steps, each `ok`; no duplicate evidence hashes |
| `01-builds-1280x900.png` | AC2 ordering, AC3 stats, AC7 height | builds ordered building → planned → done; header stats row; one page height |
| `02-builds-390x844.png` | AC7 mobile | builds reflow, no horizontal overflow |
| `03-header-stats-clip.png` | AC3 | `#world-progress` / `#world-remaining` / `#world-bar` + `#world-fill` row |
| `04-add-form-clip.png` | AC6 | `#mat-steps` after Needed, stack button hidden until a pick |
| `05-row-stack1-clip.png` | AC6 | a stack-1 row with four buttons (no stack pair) |
| `05-row-stack16-clip.png` | AC6 | a 16-stack row labelled `+16` |
| `06-custom-dialog.png` | AC4 / AC5 | `#custom-dialog` fields, scope select, icon pick + upload |
| `07-custom-tile-clip.png` | AC5 | custom tile `custom` badge after catalogue tiles |
| `08-import-dialog.png` | AC8 | `#import-dialog` with file, drop and paste paths |
| `09-backdrop-t0/t1/t2.png` | AC11 | single layer scrolling between frames |
| `10-backdrop-reduced-motion.png` | AC11 / R7 | default paused frame under reduce, never a blank/dirt frame |
| `11-budget-1280x900.png` | AC7 | `budget-state.json` fixture, no page scroll |
| `11-budget-390x844.png` | AC7 | same at 390×844 |
| `13m-materials-390x844.png`, `13m-worlds-390x844.png` | AC7 | mobile layouts of the other views |

Expected integrity: no two PNGs share a SHA-256; `probe.json` is regenerated with the crate and must be newer than the last `src/**` write. Duplicate/identical files are recorded as findings, not silently accepted.

## Integrity check after the re-issue (22:39:27Z, re-nested tree)

30 artefacts + this README; **0 duplicate hash groups**; `probe.json` `generated_at 2026-10-25T14:39:27.783Z`, newer than the stamp (`14:39:07.404Z`) and the last source write (`src/index.html`, 22:34:36 local). All **17** artefacts listed in `probe.json` were independently re-hashed and re-sized by 測試部: **0 mismatches**, 16/16 steps `ok`. Browser suite `run13.log`: `# tests 80 / # pass 80 / # fail 0`. Case 80 (detail-panel containment + pairwise non-overlap) is assertion-only by design — it captures no screenshot; the visual corroboration stays the budget and detail captures above. The mobile height for AC7 is **1,423 px** (desktop **900**).
