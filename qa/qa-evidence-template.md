# QA Evidence Record — 测试部

Every `S5Q` verdict rests on records in this format. One file per QA cycle:
`reports/qa/EDICT-nnnn-cycle-n.md`. A verdict without records is void.

## Header

| Field | Value |
|-------|-------|
| Edict | `EDICT-nnnn` |
| Cycle | `1` … (QA budget: 2, then `X1`) |
| Artifact under test | build id / commit / file manifest — pinned, never "latest" |
| Submitted by | 兵部 / 工部 / 户部 … (never 测试部) |
| Verifier | 测试部 (must differ from submitter — rule `Q1`) |
| Environment | OS, runtime version, exact command(s) |
| Entry criteria | `G1` satisfied? cite the recorded command and environment |

## Acceptance traceability (`G2`)

Every acceptance criterion from the approved plan maps to at least one case. Untraceable
criteria are a finding, not a pass.

| AC | Case id | Result | Evidence |
|----|---------|--------|----------|
| AC-1 | `T-001` | Pass | `reports/qa/logs/edict-nnnn-t001.txt` |
| AC-2 | `T-002`, `T-003` | Fail | `…/t002.txt`, screenshot path |

## Case record

| Field | Rule |
|-------|------|
| Id | Stable, never reused after a defect is filed |
| Input | Concrete data or command, reproducible by a third party |
| Expected | Written before execution, derived from the accepted AC |
| Actual | Observed output, quoted or linked — not paraphrased |
| Result | `Pass` / `Fail` / `Skipped (reason)` |
| Severity | For failures: `Blocking`, `Major`, `Minor` |

## Severity discipline (`G5`)

- `Blocking` — violates an accepted AC, crashes, or loses/corrupts data. Any blocking
  defect ⇒ `QA_FAIL`; no exceptions, no averaging.
- `Major` — accepted behaviour degraded without data loss. Blocks `S6` unless 皇帝 waives.
- `Minor` — cosmetic or documentation-level. Recorded, does not block.
- Flaky — a case that changes result on unchanged input is `Blocking` until reproduced 3×
  and filed; retries are counted and reported, never hidden.

## Verdict block

```
VERDICT: QA_PASS | QA_FAIL
cases: total=<n> pass=<n> fail=<n> skipped=<n>
defects: blocking=<n> major=<n> minor=<n>
open_questions: <list or none>
```

Append the matching ledger line in the same action as the verdict:

```json
{"seq":N,"ts":"ISO-8601","edict":"EDICT-nnnn","from":"S5Q","to":"S6","office":"测试部",
 "verdict":"QA_PASS","artifacts":["reports/qa/EDICT-nnnn-cycle-1.md"],"note":"cases ..."}
```
