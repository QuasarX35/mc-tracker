# QA Evidence — EDICT-0002 · Cycle 1 · **QA_FAIL**

| Field | Value |
|-------|-------|
| Edict | EDICT-0002 — 测试部 (QA Ministry) amendment |
| Cycle | 1 of 2 |
| Artifact under test | 5 changed artifacts + ledger (see scope note — **not pinned**, finding `P1`) |
| Submitted by | 礼部 (documentation), 吏部-HR (registry) |
| Verifier | 测试部 — independent of submitter (`Q1` ✓) |
| Environment | Windows, PowerShell 7.6.7, workspace `D:\minecraft-tracker` |
| Command | inline checks: link resolution by regex over `*.md`, registry row count, state/transition assertions, JSONL parse |
| Entry criteria `G1` | **Partial.** Artifacts enumerated, but the link scan recursed the entire workspace instead of the artifact set. |

## Result

`16` checks, `15` pass, `1` fail. Structural checks all passed; the failure is a broken
documentation link, plus a process finding against this very run.

| Id | Severity | Finding | Evidence |
|----|----------|---------|----------|
| `D1` | **Blocking** | `EDICT-0002.md` §7 links `../qa/qa-evidence-template.md`, which resolves to `docs/qa/…` — the file is at `qa/`. Contradicts the same table's own claim that the artifact is delivered. | `17` relative links scanned in-scope; `1` unresolved |
| `P1` | **Major** (process) | Scan scope was not pinned to the artifacts under test: `154` markdown files scanned, `149` of them vendored third-party under `.tmp/` (uiux-skill tree and npm cache). The second reported "broken link" — `node_modules/yaml/README.md => docs/CONTRIBUTING.md` — belongs to a third-party package README and is out of scope. Violates `G1` (pinned artifact) and `G2` (traceability). | `Get-ChildItem -Recurse -Filter *.md -Force`: total `154`, `.tmp` `149`, project `5` |

## Notes

- The `.tmp/` tree is **not** part of this project: it contains a vendored UI-skills
  repository and an npm cache. It must be excluded from QA scope and gitignored once a
  repository is initialised.
- No artifact was modified by this QA run (`Q2` respected; 测试部 wrote only this report).

## Verdict

```
VERDICT: QA_FAIL
cases: total=16 pass=15 fail=1 skipped=0
defects: blocking=1 major=1 minor=0
open_questions: should .tmp/ be deleted or gitignored by 工部? (requires 皇帝/工部 decision)
```

Returned to 尚书省 → 礼部 for `D1`; the QA run itself is repeated with a pinned scope (`P1`,
this is a defect in the *test*, disclosed rather than corrected silently).
