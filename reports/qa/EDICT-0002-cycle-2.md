# QA Evidence — EDICT-0002 · Cycle 2 · **QA_PASS**

| Field | Value |
|-------|-------|
| Edict | EDICT-0002 — 测试部 (QA Ministry) amendment |
| Cycle | 2 of 2 (budget exhausted at this point; a further failure would escalate to `X1`) |
| Artifact under test | `docs/governance/EDICT-0001.md`, `EDICT-0002.md`, `office-registry.md`, `state-machine.md`, `ledger.jsonl`, `qa/qa-evidence-template.md` — **pinned** by path |
| Submitted by | 礼部 (D1 fix), 吏部-HR (registry) |
| Verifier | 测试部 — independent of submitter (`Q1` ✓) |
| Environment | Windows, PowerShell 7.6.7, workspace `D:\minecraft-tracker` |
| Entry criteria `G1` | ✓ artifact set pinned, command and environment recorded above |

## Defect closure

| Id | Status | Verification |
|----|--------|--------------|
| `D1` | **Fixed** | `17` in-scope links, `0` broken; `qa-evidence-template.md` reachable from `EDICT-0002.md` §7 |
| `P1` | **Fixed in test** | scope pinned to the 5 artifacts; `.tmp/` excluded; `0` out-of-scope files scanned |

## Test revision disclosed (`G4`)

Cycle 2 found a defect in **the test**, not the artifact: cycle 2's first assertion required
`≥ 8` markdown links inside `EDICT-0002.md` (actual `7`). That threshold was invented during
authoring; the accepted criterion is *"every changed artifact is named in the effective-changes
table"*. The case was rewritten (`v1` → `v2`) to assert the 5 named rows by path. The artifact
was **not** changed to satisfy the test, the revision is recorded here rather than silently
applied, and the rewrite makes the assertion stricter about what the AC actually says.

## AC traceability (`G2`)

| AC | Case | Result | Evidence |
|----|------|--------|----------|
| AC-1 测试部 exists in the registry with a binding verdict | `registry-qa-row` | Pass | seat 10, `QA_PASS`/`QA_FAIL` rights |
| AC-2 builder ≠ verifier rules exist | `registry-independence` | Pass | `Q1`–`Q5` present |
| AC-3 write scopes are disjoint | `registry-scope-split` | Pass | `tests/unit/**` = 兵部, `tests/qa/**` = 测试部 |
| AC-4 verification is a real state with a bounded failure loop | `sm-state`, `sm-transitions`, `sm-budget` | Pass | `S5Q`; 4 transitions; cycle budget 2 |
| AC-5 gate criteria defined, no silent bypass | `sm-gates`, `sm-nonverifiable` | Pass | `G1`–`G6`; `NON_VERIFIABLE` waiver path |
| AC-6 evidence format is executable on day one | `tpl-verdicts` | Pass | template emits `QA_PASS`/`QA_FAIL` |
| AC-7 amendment recorded, original charter untouched | `e1-amended`, `e2-status` | Pass | amendment note + EDICT-0002 `ENACTED` |
| AC-8 all transitions ledgered | `ledger-parse`, `ledger-seq`, `ledger-schema` | Pass | contiguous, schema-complete |

## Result

`24` checks, `24` pass, `0` failing. `17` relative links, `0` broken. `5/5` changed
artifacts named in the effective-changes table. Ledger contiguous through `seq 8` at the
time of this run; the QA verdict lines are appended immediately after.

## Verdict

```
VERDICT: QA_PASS
cases: total=24 pass=24 fail=0 skipped=0
defects: blocking=0 major=0 minor=0
open_questions: .tmp/ housekeeping (149 vendored md files) — for 工部, non-blocking
```
