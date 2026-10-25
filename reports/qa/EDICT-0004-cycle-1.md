# QA Evidence — EDICT-0004 · Cycle 1 · **QA_FAIL**

| Field | Value |
|-------|-------|
| Edict | EDICT-0004 — apply the `ui-ux-pro-max` skill to this workspace |
| Cycle | 1 of 2 |
| Artifact under test | `src/index.html` `6DE4819A56FA5FB2` · `src/styles.css` `DCE0DC5A7608F4FE` · `src/dashboard.js` `496D8EEA9C91F787` · `design-system/minecraft-tracker/MASTER.md` `E1EC83A257956D5E` · `design-system/minecraft-tracker/pages/dashboard.md` `B69BE33413BFAA52` (SHA-256 prefixes, pinned) |
| Submitted by | 兵部 (code), 礼部 (design docs) |
| Verifier | 测试部 — independent of submitter (`Q1` ✓) |
| Environment | Windows, PowerShell 7.6.7, Python 3.13.3, Chrome 141 headless, workspace `D:\minecraft-tracker` |
| Entry criteria `G1` | ✓ artifact set pinned by hash; commands: `python tests/qa/contrast_audit.py`, headless-Chrome render + runtime probe (commands in the report) |

## Defects found (returned to 尚书省; QA modified nothing — `Q2`)

| Id | Severity | Finding | Gate |
|----|----------|---------|------|
| `D1` | **Blocking** | Brand-mark `<svg class="icon icon--lg">` carried no `aria-hidden`: 1 of 18 inline icons exposed to assistive tech as an unlabelled graphic. Case `html/icon-aria` failed. | AC-3 |
| `D2` | Major | Three colour literals outside `:root` — skeleton gradient stops `#26243e` / `#322f52` and SVG axis text `#b6c2d4` — breaking the "semantic tokens only" rule the design system states. Case `css/token-discipline` failed. | AC-1 (tokens) |
| `D3` | **Blocking** | Chart axis text illegible at 375 px: the trend SVG pinned `viewBox` width `720` inside a `~311 px` column — a 2.31× downscale — so 11-unit labels rendered at **≈4.8 CSS px**. Observed in render `375×1750`. | AC-4 |
| `D4` | Major | Right-axis tick and direct label overlapped at 1440 px: tick block `x = W − 8` (≈688–712) versus direct label starting `x = last + 12` (≈674–694) — a **6 px** collision of "100" and "94". | AC-2 |
| `D5` | Minor | Heat-map sub-heading said "darker is busier" while the encoding *brightens* with intensity. Copy only. | AC-2 |
| `D6` | **Blocking** | AC-6 requires loading, empty **and error** states. Only loading (skeleton) and empty (no matches) existed; there was no failure path at all. The acceptance criterion was not met by the artifact. | AC-6 |

## Test defect disclosed (`G4`)

The harness was wrong before the artifact was judged: `tokens()` kept the `color-` prefix on
parsed keys (`color-primary`) while the pair table addressed them without it (`primary`),
producing **28 spurious "token missing" failures**. First run: **65 cases, 35 pass, 30 fail**
— 28 of those failures were the harness, 2 were real (`D1`, `D2`). The harness was fixed
(keys normalised), not the artifact: the artifact was only changed for `D1` and `D2`.
Case count rose from 65 to 66 because one pair (`on-secondary` → badge) was added, so the
denominator is not comparable across runs; this is recorded rather than smoothed over.

## Result

`30` failures at first run, of which `28` were test-side. Six defects raised, three
blocking (`D1`, `D3`, `D6`). Artifact returned; `S5Q → S5`. `D3`, `D4`, `D6` were found by
reviewing the render against the AC set, not by the harness — the harness alone would have
passed the artifact.

## Verdict

```
VERDICT: QA_FAIL
cases: total=65 pass=35 fail=30 skipped=0
defects: blocking=3 major=2 minor=1
open_questions: .tmp/ holds vendored third-party trees (skill repo, npm cache, chrome profile) — excluded, for 工部
```
