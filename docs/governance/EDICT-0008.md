# EDICT-0008 — Mechanical enforcement of wiki upkeep (`edict-sync`)

- **Issued by:** 皇帝 — *"build this for the llm wiki"*, quoting the recorded gap that the rule
  was "contract- and gate-level, not runtime"
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (rule, CLI, tests) · **Verified by:** 测试部 (`S5Q`)
- **Recorded:** 2026-10-25 (Asia/Singapore)
- **Status:** `ENACTED` — `S6`
- **Amends:** [EDICT-0006](EDICT-0006.md) (adds the mechanical layer it did not have)

## 1. The gap being closed

EDICT-0006 made wiki upkeep a rule (contract), a plan requirement (`R9`) and a gate claim
(`S5Q`). All three are *prose*. A session that ignores `AGENTS.md` and self-reports can still
end an edict without ingesting anything. The fix was already named: compare the governance
ledger with the wiki log.

## 2. The rule

`lint` now includes rule `edict-sync`:

1. Read `docs/governance/ledger.jsonl`; for every edict take its **latest** record with
   `to = "S6"` and verdict `DONE` or `QA_PASS` — that is its completion point.
2. Ignore completions at or before the baseline in `docs/governance/wiki-sync.json`
   (`enforced_from_seq: 78`, grandfathered: EDICT-0001…0007 completed before the rule existed).
3. For each remaining completion, require a `wiki/log.md` entry where:
   - verb is **`ingest` or `edit`** (a `query` or `lint` entry that merely discusses the edict
     does not count),
   - date is **on or after** the completion date,
   - the entry text **cites the edict id** (e.g. `EDICT-0008`).
4. Otherwise lint fails with a message naming the edict, its ledger seq and the missing entry.

`node src/wiki/cli.mjs sync` prints the same mapping (`OK`/`MISS` per completion) for humans
and for the report.

## 3. Review record

**Round 1 — 🚫 Reject.** The plan was a substring test: "does log.md contain the edict id".

| # | Finding | Fix |
|---|---------|-----|
| R3 | Satisfied by a *pre-completion* mention, or by a `query`/`lint` entry that just discusses the edict. | Date-aware and verb-aware matching. |
| R7 | Adding the rule retroactively failed EDICT-0001…0007, whose entries predate it. | Explicit, documented, raise-only baseline. |
| R6 | A missing or malformed config would silently disable enforcement. | Malformed ledger/config **fails**; a repository with no ledger at all is skipped so a standalone wiki still works. |
| R3 | The mapping was invisible when a check failed. | `sync` command explains every completion. |

**Round 2 — ✅ Pass**, conditional on: proving the rule on the **live ledger**, not only
fixtures (fail, then ingest, then pass), test coverage for date/verb/baseline/missing-ledger,
and documentation in the schema and the gate.

## 4. Proof on the live repository

```
$ node src/wiki/cli.mjs sync      # before ingesting this edict
  MISS  EDICT-0008  seq 89  -> no log entry
sync: 0/1 completed edicts ingested — 1 missing          (exit 1)

$ node src/wiki/cli.mjs lint
ERROR [edict-sync] wiki/log.md: EDICT-0008 reached S6 at ledger seq 89 but no wiki log entry
      on/after 2026-10-25 cites it — ingest it (AGENTS.md §6.5)     (exit 1)

# ... after adding the log entry ...
$ node src/wiki/cli.mjs sync
  OK    EDICT-0008  seq 89  -> 2026-10-25 edit | mechanical wiki upkeep: ...
sync: 1/1 completed edicts ingested                        (exit 0)
$ node src/wiki/cli.mjs lint
lint: clean — 20 pages, 0 errors, 0 warnings
```

That failing run is the point: the mechanism rejected the very edict that introduced it until
the ingest existed.

## 5. Verification

| Check | Result |
|-------|--------|
| Unit tests (`tests/unit/wiki-sync.test.mjs`) | 10/10 — parsing, completions, blocks, date, verb, baseline, missing ledger |
| Acceptance (`tests/qa/wiki-sync.acceptance.test.mjs`) | 8/8 — CLI exit codes, messages, live repo |
| Wiki suite unaffected | 10/10 unit, 13/13 acceptance |
| App suites unaffected | 15/15 unit, 16/16 acceptance, 41/41 UI audit |
| Live repo | `lint` clean, `sync` 1/1, ledger `seq 0–89` contiguous |
| Config | `enforced_from_seq: 78`, raise-only, documented in the file itself |

## 6. Limits, stated honestly

- **Presence, not quality.** A session could satisfy the rule with a token entry that cites the
  edict and says nothing. Lint cannot judge whether an ingest was worth making; that remains a
  reading judgement, and is recorded in the wiki's open questions.
- **One repository, one ledger.** The check is scoped to this workspace's governance record.
- **The baseline is a policy lever.** Raising it is legitimate when a batch predates the rule;
  lowering it is never valid and would be a governance error, so the file says so.
- **No hooks.** It runs inside `lint`; there is no git hook or CI job. If the lint pass is
  skipped entirely, nothing fires — but `S5Q` requires the lint pass, so the path is closed as
  far as this pipeline goes.
