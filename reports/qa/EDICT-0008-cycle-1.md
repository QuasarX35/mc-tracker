# QA Evidence — EDICT-0008 · Cycle 1 · **QA_PASS**

| Field | Value |
|-------|-------|
| Edict | EDICT-0008 — mechanical enforcement of wiki upkeep |
| Cycle | 1 of 2 |
| Artifact under test | `src/wiki/lib.mjs` (`edict-sync`, `checkEdictSync`, `logBlocks`, `edictCompletions`), `src/wiki/cli.mjs` (`sync`), `docs/governance/wiki-sync.json`, both new test suites, `AGENTS.md`, `state-machine.md` |
| Submitted by | 兵部 (rule + CLI + tests), 礼部 (docs + wiki) |
| Verifier | 测试部 — CLI-driven acceptance plus a live-ledger proof |
| Environment | Node v22.14.0, PowerShell 7.6.7, workspace `D:\minecraft-tracker` |
| Entry criteria `G1` | ✓ pinned rule/config/tests; commands recorded |

## Cases

| Case | Check | Result |
|------|-------|--------|
| `S1` | Completed edict with no citing entry → lint exits 1, message names edict + seq | Pass |
| `S2` | Citing `ingest` entry dated on completion → lint exits 0 | Pass |
| `S3` | A citation dated **before** completion does not satisfy the rule | Pass |
| `S4` | `query` / `lint` entries that mention the edict do not count | Pass |
| `S5` | Baseline grandfathers older completions | Pass |
| `S6` | Repository with no governance ledger → lint skips cleanly, `sync` says skipped | Pass |
| `S7` | `sync` prints `MISS`/`OK`, exits 1/0, counts completions | Pass |
| `S8` | The live repository satisfies its own rule | Pass |
| `U1–U10` | Unit coverage: malformed ledger, missing ledger, latest-completion-wins, block parsing, baseline, verb/date rules | Pass — 10/10 |
| `L1` | Existing wiki suite unaffected | Pass — 10/10 unit, 13/13 acceptance |
| `A1` | App suites unaffected (no app code touched) | Pass — 15/15, 16/16, 41/41 audit |

## Live-ledger proof (the part fixtures cannot show)

With this edict's ledger records appended but **no wiki entry yet**:

```
sync:   MISS EDICT-0008 seq 89 -> no log entry            exit 1
lint:   ERROR [edict-sync] EDICT-0008 reached S6 at ledger seq 89 but no wiki log entry ... exit 1
```

After adding the citing log entry:

```
sync:   OK EDICT-0008 seq 89 -> 2026-10-25 edit | mechanical wiki upkeep ...   exit 0
lint:   clean — 20 pages, 0 errors, 0 warnings                                  exit 0
```

The gate rejected the edict that introduced it until the ingest existed. That is the
behaviour the edict asked for.

## Process notes (disclosed)

- The first documentation patch script aborted on an **anchor mismatch of my own making** (a
  multi-line anchor without its leading indentation). Investigation plus a repository-wide
  sweep confirmed **no encoding corruption** in any committed file: the apparent `�` was the
  console rendering a correct em dash (`U+2014`). The patch was redone with line-based edits.
- `AGENTS.md` had the rule documented in §6.5 but was missing the `sync` row in the tooling
  table; QA caught the omission by asserting the documented command actually exists in the
  table. Fixed in the same cycle.

## Verdict

```
VERDICT: QA_PASS
cases: total=21 pass=21 fail=0
defects: blocking=0 major=0 minor=0
open_questions: lint proves presence, not ingest quality — recorded in the wiki
```

Released to `S6`.
