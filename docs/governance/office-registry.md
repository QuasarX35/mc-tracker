# Office Registry — 三省六部 + 测试部

**Status:** `ENACTED` under [EDICT-0001](EDICT-0001.md) · **Amended by** [EDICT-0002](EDICT-0002.md) — 测试部 added
**Seats:** 13 = 12 offices + 皇帝 · **Owner of registry:** 吏部 (Libu-HR)

Each office below is a *role contract*, not a separate process. The Crown Prince
(太子) executes the contract in-context unless the Duties column or [Execution
Modes](#execution-modes) requires delegation.

## Registry

| # | Office | Chinese | Duty (single sentence) | Produces | Hard rights |
|---|--------|---------|------------------------|----------|-------------|
| 1 | Crown Prince | 太子 | Gateway: classify every inbound message, sanitise the edict, log it. | `EDICT-nnnn` record, triage verdict | May answer chatter directly; may refuse to forward an ambiguous edict |
| 2 | Planning Dept | 中书省 | Turn one sanitised edict into numbered, granular, testable sub-tasks with acceptance criteria and order. | Plan v*n* with task table + ACs | May declare an edict under-specified and return it to triage |
| 3 | Review Dept | 门下省 | Audit the plan adversarially against the gate checklist; pass or veto with written feedback. | `✅ Pass` / `🚫 Reject` + findings | **Veto is absolute**; no execution may start without `Pass` |
| 4 | Dispatch Dept | 尚书省 | Route passed sub-tasks to ministries, set execution order, own the critical path. | Assignment table, execution log | May reorder or split sub-tasks; may not alter scope |
| 5 | Hubu | 户部 | Data processing, quantitative analysis, metrics and resource tracking. | Datasets, calculations, report tables | — |
| 6 | Libu | 礼部 | Documentation, technical writing, standards, formatting. | Docs, READMEs, specs, changelog | — |
| 7 | Bingbu | 兵部 | Engineering: implementation and algorithmic logic. | Source code, unit tests | May reject a spec it cannot implement, back to 尚书省 |
| 8 | Xingbu | 刑部 | Compliance, security scanning, vulnerability and policy audit. | Findings report, severity table | May block a release on a critical finding |
| 9 | Gongbu | 工部 | Infrastructure, DevOps, CI/CD, deployment scripts, containerisation. | Build/run scripts, CI config | — |
| 10 | **QA Ministry** | 测试部 | Independently verify delivered artifacts against accepted acceptance criteria and hold a binding verdict. **For the app: run the comprehensive UI suite on every change** (`.e2e`, 27 flows incl. failure paths, a11y, responsive, visual contract) and restamp. | Test cases, evidence records, `QA_PASS` / `QA_FAIL`, `docs/governance/app-qa.json` | **May block `S6`** on any blocking defect **or a stale/missing app-qa stamp**; may not waive, may not fix |
| 11 | Libu-HR | 吏部 | Permission scope, office health, this registry. | Registry revision, permission audit | May revoke an office's write scope |
| 12 | Briefing Desk | 早朝 | Digest of completed edicts; scheduled reports. | Digest entry | — |
| 13 | Emperor | 皇帝 | Issue edicts, resolve escalations, approve irreversible actions. | Edicts, approvals | Final authority |

## QA Independence Rules

`Q1` author ≠ verifier (a distinct teammate in delegated mode) ·
`Q2` 测试部 writes nothing under `src/**` ·
`Q3` 兵部 writes nothing under `tests/qa/**`; cases freeze at build submission ·
`Q4` `QA_FAIL` is binding ·
`Q5` only 皇帝 waives a blocking defect, recorded in the ledger as `DECISION`.

Full rationale: [EDICT-0002 §4](EDICT-0002.md). Gate criteria and the `S5Q` state:
[state-machine.md](state-machine.md). Evidence format: [qa-evidence-template.md](../../qa/qa-evidence-template.md).

## App QA doctrine (EDICT-0009)

The app is not "done" because its unit tests pass. Before any app change can reach `S6`:

1. **Run the browser suite** — `node scripts/app-qa.mjs run`. It drives real Chrome over the
   DevTools Protocol through every user flow, failure path, accessibility expectation,
   responsive breakpoint and the visual contract. A failing suite writes no stamp.
2. **The stamp is the proof** — a passing run writes `docs/governance/app-qa.json` with a
   SHA-256 per app source. `lint`'s `app-qa-stamp` rule fails when those hashes drift, so the
   next clean pass is impossible without re-testing. `node src/wiki/cli.mjs app-qa` shows
   `verified` or `STALE`.
3. **Evidence is regenerated, not remembered** — screenshots land in
   `reports/qa/evidence/edict-*/` on every run.

Independence caveat, recorded rather than hidden: 测试部 authors and runs this suite, so its
independence is structural (assertions derive from acceptance criteria and recompute
expectations independently; internals are reached only through persisted state), not
organisational.

## Execution Modes

- **Simulated (default).** One agent narrates each office under its own heading, and the
  Review Dept critiques the Planning Dept's output before any artifact is produced. Use for
  small or single-thread edicts and for all governance decisions. 测试部 still files real
  evidence — narration is not a substitute for records.
- **Delegated.** Spawn distinct DSH teammates (one per ministry with disjoint write scope)
  only when an edict yields **≥2 independent, parallelisable** work packages, or when one
  package is long enough to block the critical path. 尚书省 records each teammate's write
  scope before dispatch; overlapping scopes are serialised. 测试部 must be a *separate*
  teammate from 兵部 — collapsing them voids rule `Q1`.

## Permission Scope (current)

| Scope | Paths | Granted to |
|-------|-------|-----------|
| Read | whole workspace | all offices |
| Write | `docs/governance/**` | 礼部, 吏部 |
| Write | `src/**`, `tests/unit/**` | 兵部 |
| Write | `tests/qa/**`, `qa/**`, `reports/qa/**` | 测试部 |
| Write | `.github/**`, `scripts/**`, `Dockerfile*` | 工部 |
| Write | `data/**`, `reports/**` (except `reports/qa/**`) | 户部 |
| Write | `docs/security/**` | 刑部 |
| Write | `design-system/**` | 礼部 |
| Write | `legacy/**` (archive of retired work) | 礼部 |
| Write | `wiki/**`, `AGENTS.md`, `README.md`, `.gitignore` | 礼部 |
| Write | `raw/**` (write-once on intake, then sealed) | 太子 |
| Write | `package.json` | 兵部 |
| Write | `—` (read-only audit) | 门下省, 中书省, 尚书省 |

**Revision 2 (EDICT-0003).** Added the four rows above: the wiki instance needed write
authority that the original twelve-scope table did not grant (`R5` finding). `raw/**` is
write-once and hash-sealed, so 太子 can intake a source but nothing can edit it afterwards.

**Revision 3 (EDICT-0004).** Added `design-system/**` for 礼部. The `ui-ux-pro-max` skill
mandates `design-system/<project-slug>/MASTER.md` at the project root, a path no office
held. Disclosed rather than glossed: the two design-system files were written at 11:56–11:57,
minutes before this grant was recorded at 12:09. No other office claimed the path, so no
scope was taken from anyone, but the order is logged as a minor process finding (`R5`).

Any office needing a path outside its scope must obtain a registry revision from 吏部-HR,
recorded in the ledger. A grant to one office is never widened by another office's need:
split the path instead.

**Revision 4 (EDICT-0005).** `design-system/**` was rewritten from the EDICT-0004 v1
(neon dashboard) to v2 (Minecraft in-game GUI) by 礼部 on 皇帝's explicit direction; the old
page override is retained and marked as archive. `legacy/**` was added so the retired
dashboard SPA is preserved in git instead of deleted.
