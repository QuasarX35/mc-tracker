# QA Evidence — EDICT-0003 · Cycle 1 · **QA_FAIL**

| Field | Value |
|-------|-------|
| Edict | EDICT-0003 — instantiate the LLM Wiki pattern |
| Cycle | 1 of 2 |
| Artifact under test | pinned manifest: `AGENTS.md`, `wiki/**` (15 pages), `src/wiki/lib.mjs`, `src/wiki/cli.mjs`, `tests/unit/wiki-core.test.mjs`, `tests/qa/wiki.acceptance.test.mjs`, `raw/manifest.json`, `package.json` |
| Submitted by | 礼部 (docs, wiki), 兵部 (tooling) |
| Verifier | 测试部 — independent suites and fixtures, submitter not involved |
| Environment | Windows, Node v22.14.0, PowerShell 7.6.7, workspace `D:\minecraft-tracker` |
| Entry criteria `G1` | ✓ manifest pinned, commands and versions recorded |

## Result

Acceptance suite: **12/13** (1 fail). 兵部 unit suite: **9/10** (1 fail). Lint: clean.
Verdict is `QA_FAIL` because one blocking product defect was found.

| Id | Severity | Finding | Evidence |
|----|----------|---------|----------|
| `L1` | **Blocking** | A malformed log heading (`## 2026-10-25 ingest without prefix`) passed lint clean. The checker only inspected lines beginning `## [`, so an entry that violated the format entirely was *invisible* — the worst kind of validator: silent on the exact input it exists to catch. | `AC-11` failed: `lint: clean — 2 pages, 0 errors` |
| `T1` | Major (test, 兵部) | Unit test `checkIndex detects edits` asserted that a **body** edit makes the index stale. The index is generated from frontmatter only, so the assumption was wrong, not the product. | unit suite: 9/10 |
| `E1` | Major (environment) | `node --test tests/unit tests/qa` fails with `spawn EPERM`: the runner spawns child processes with piped stdio, which the sandbox denies. Test invocation had to change. | TAP output: `spawn EPERM` for both directories |

## Assessment notes

- `L1` is a **test-derived** finding: the acceptance suite was written from the schema's log
  format rule, not from the implementation, and it caught a gap the author had not seen. This
  is the gate working as intended.
- `T1` is a defect in the builder's own tests and is disclosed rather than quietly deleted;
  the corrected case is stricter in what it asserts about the index's inputs.
- `E1` is not a product defect but changed the contract: tests run per-file in one process,
  and [`AGENTS.md`](../../AGENTS.md) §7 now says so.

## Verdict

```
VERDICT: QA_FAIL
cases: total=25 pass=23 fail=2 skipped=0   (13 acceptance + 10 unit + 2 manual lint runs)
defects: blocking=1 major=2 minor=0
open_questions: none blocking; E1 recorded in the schema
```

Returned to 尚书省 → 兵部: fix the log checker (any `## ` heading is a candidate entry), fix
unit test `T1` with the correction disclosed, and update the schema's test command.
