# QA Evidence — EDICT-0006 · Cycle 1 · **QA_PASS**

| Field | Value |
|-------|-------|
| Edict | EDICT-0006 — wiki upkeep is mandatory |
| Cycle | 1 of 2 |
| Artifact under test | `AGENTS.md` (§6.5), `docs/governance/state-machine.md` (`R9`), `docs/governance/EDICT-0006.md`, `wiki/**` (4 new pages, 2 updated), `raw/sources/` (2 new, sealed), `wiki/log.md` |
| Submitted by | 礼部 (all of the above) |
| Verifier | 测试部 — mechanical checks only; no code shipped, so the app suites are out of scope |
| Environment | Node v22.14.0, PowerShell 7.6.7, workspace `D:\minecraft-tracker` |
| Entry criteria `G1` | ✓ artifact paths pinned; commands recorded |

## What was checked, and why it is enough

A documentation edict's risk is not a crash; it is **claiming an ingest that did not happen**.
The checks therefore target presence, consistency and the integrity of the raw layer.

| Case | Check | Result |
|------|-------|--------|
| `W1` | Wiki lint passes (frontmatter, types, summaries ≤160, wikilinks, orphans, log format, index freshness, raw integrity) | Pass — 19 pages, 173 wikilinks, 0 errors |
| `W2` | Index is current, not hand-edited | Pass — `index: up to date` |
| `W3` | Raw sources sealed and unchanged | Pass — 3/3 match the manifest |
| `W4` | New pages are reachable: no orphans | Pass — 0 orphans, every page has an inbound wikilink |
| `W5` | Relative links across all project docs resolve | Pass — 34 links over 42 markdown files, 0 broken |
| `W6` | The rule is in the contract the agent actually loads | Pass — `AGENTS.md` §6.5 present |
| `W7` | The rule is in the review gate | Pass — `state-machine.md` `R9` present, with the `S5Q` log-entry requirement |
| `W8` | The ingest covers the outstanding work (EDICT-0005), not a plan | Pass — pages cite `2026-10-25-minecraft-build-tracker-spec` and `2026-10-25-minecraft-gui-design-system`, and record the QA failures |
| `W9` | Log entry names the pages touched and is parseable | Pass — 6 entries, all matching `## [YYYY-MM-DD] verb \| subject` |
| `W10` | Superseded material is marked, not silently contradictory | Pass — `pages/dashboard.md` carries the supersession note; `legacy/` retained |

## Deliberate non-checks

- No app test suite re-run: no application code changed in this edict (the change is
  documentation, governance and the wiki corpus).
- No screenshot review: there is no UI change.
- No content-quality assertion: lint proves structure, not that the prose is worth reading. That
  judgement stays with the Emperor, and the pages were written to be read cold.

## Observations (not defects)

- The "always update" rule has no runtime enforcement; a session that ignores `AGENTS.md` can
  still report without ingesting. Filed in `wiki/synthesis/open-questions.md` with a candidate
  lint rule (compare newest ledger edict against newest log subject).
- Two design narratives now coexist in the repo (v1 archive, v2 live). The supersession note is
  load-bearing; if it is ever removed, a future agent could follow the dead system.

## Post-commit regression (disclosed)

Re-running the full suites *after* committing found a real failure that this report originally
missed: `tests/qa/wiki.acceptance.test.mjs` `AC-3` asserted `pages.length === 15`, so the
ingest itself (15 → 19 pages) broke the wiki's own acceptance suite — 12/13 passed. The report
had declared all suites out of scope because "no application code changed", which was the wrong
call: a documentation edict changes the corpus that those tests assert on.

- Fixed by rewriting `AC-3` to be count-agnostic and stricter: every page appears exactly once,
  the number of catalogue rows equals the page count, no duplicate rows.
- Re-verified: wiki acceptance **13/13**, wiki unit 10/10, tracker unit 15/15, tracker
  acceptance 16/16, lint clean, index current, raw 3/3.
- The pass below is the pass *after* the fix, not the original claim. Ledger `seq 62–64`.

## Verdict

```
VERDICT: QA_PASS
cases: total=10 pass=10 fail=0 skipped=0
defects: blocking=0 major=0 minor=0
open_questions: enforcement hook for the standing rule (documented, non-blocking)
```

Released to `S6`; 早朝 reported to the Emperor.
