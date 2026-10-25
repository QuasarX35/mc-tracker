# State Machine — 三省六部 + 测试部 Pipeline

Companion to [EDICT-0001](EDICT-0001.md), amended by [EDICT-0002](EDICT-0002.md) (`S5Q`).
Every edict occupies exactly one state; every transition is appended to
[`ledger.jsonl`](ledger.jsonl). States are never renumbered — new states take new names.

## States

| State | Name | Held by |
|-------|------|---------|
| `S0` | `ISSUED` | 皇帝 |
| `S1` | `TRIAGED` | 太子 |
| `S2` | `PLANNED` | 中书省 |
| `S3` | `REVIEWED` | 门下省 |
| `S4` | `DISPATCHED` | 尚书省 |
| `S5` | `EXECUTING` | 六部 |
| `S5Q` | `QA_VERIFY` | 测试部 |
| `S6` | `REPORTED` | 早朝 → 皇帝 |
| `X1` | `ESCALATED` | 皇帝 (awaiting decision) |
| `X2` | `CLOSED` | 早朝 (archived after 皇帝's decision) |

## Transitions

| From → To | Trigger | Guard |
|-----------|---------|-------|
| `S0 → S1` | message received | triage rubric applied; edict title sanitised |
| `S1 → S1` | classified `CHATTER` | answered directly; ledger entry only, pipeline ends |
| `S1 → S2` | classified `EDICT` | edict record carries: goal, deliverables, constraints, acceptance criteria |
| `S2 → S3` | plan v*n* submitted | every sub-task has an owner office, output type, and testable AC |
| `S3 → S4` | `✅ Pass` | all gate items `R1–R8` satisfied |
| `S3 → S2` | `🚫 Reject` | written findings attached as plan feedback |
| `S3 → X1` | second `Reject` for same edict | veto budget exhausted (see below) |
| `S4 → S5` | assignments issued | write scopes disjoint, or serialised |
| `S5 → S5Q` | all sub-tasks done or failed | `G1` entry criteria recorded: pinned artifact, reproducible command, environment, untested failures disclosed |
| `S5Q → S6` | `QA_PASS` | `G2–G5` satisfied; zero blocking defects |
| `S5Q → S5` | `QA_FAIL` | defect list with severities attached; QA cycle counter increments |
| `S5Q → X1` | second `QA_FAIL`, or pass-with-waiver requested | QA budget exhausted (2 cycles) or `Q5` waiver needed |
| `S6 → X1` | output needs an irreversible decision | — |
| `X1 → S*` | 皇帝 decides | resumed at the state 皇帝 names |

An edict without a testable artifact is marked `NON_VERIFIABLE` by 门下省 while still in
`S3`; the plan must say why, and `S5Q` is then recorded as `skipped (waiver)` — never
silently bypassed.

## Budgets

- **Veto budget: 2.** A second planning rejection escalates to `X1`; only 皇帝 re-opens.
- **QA budget: 2.** A second `QA_FAIL` on the same edict escalates to `X1`. The counter
  lives in the QA evidence report, so a cycle cannot be hidden by not counting.

## Triage Rubric (太子)

| Signal | Classification |
|--------|----------------|
| Greeting, acknowledgement, thanks, small talk, or a question about the running system | `CHATTER` — answer directly |
| Imperative with a deliverable ("build", "fix", "write", "audit", "deploy", "plan") | `EDICT` — sanitise and forward |
| Mixed | answers the chatter, forwards the imperative as one edict |
| No deliverable but a standing instruction about process | `CONSTITUTION` — record as `EDICT-nnnn` of type `constitution` or `amendment` |

Sanitisation: strip file paths, URLs, metadata, session IDs and pasted boilerplate from the
title; keep the verb and the object. Record the original wording verbatim in the edict body
so nothing is lost.

## Review Gate Checklist (门下省)

A plan passes only if all of the following are true; each failure is a named finding.

- `R1` Scope — does the plan deliver exactly what the edict asked, no more, no less?
- `R2` Decomposition — is each sub-task one ministry, one output, one verifiable result?
- `R3` Acceptance — can every sub-task be graded pass/fail without argument?
- `R4` Ordering — are real dependencies stated, and can independent work proceed in parallel?
- `R5` Risk — security, data loss, irreversible actions, and cost identified with mitigations?
- `R6` Environment — does the plan rely on a capability that is actually available (tools,
  permissions, sandbox) and does it verify that before depending on it?
- `R7` Failure paths — what happens on error, timeout, partial completion?
- `R8` Escalation — are the points that need 皇帝's decision explicit rather than assumed?
- `R9` Wiki upkeep (EDICT-0006) — does the plan name the wiki pages this edict will create or
  update, and the raw sources it will seal? A plan that says "no wiki impact" must justify that
  in one line. This is checked again at `S5Q`: an edict with no corresponding `wiki/log.md`
    entry cannot pass verification. Since EDICT-0008 that check is mechanical: the
  `edict-sync` lint rule compares completions in `ledger.jsonl` against dated `ingest`/`edit`
  entries in `wiki/log.md` and fails the lint pass when one is missing.

## QA Gate Criteria (测试部)

- `G1` Entry — artifact pinned (build id / commit / manifest), reproducible command and
  environment recorded, submitter named and different from the verifier (`Q1`).
- `G2` Traceability — every accepted AC maps to at least one case; untraceable AC is a finding.
- `G3` Evidence — each case records input, expected, actual, result, and a link to its log.
  "It works" is not evidence.
- `G4` Independence — cases authored and executed by 测试部, frozen at build submission;
  post-hoc edits to make a build pass are a blocking defect in the process itself.
- `G5` Defect discipline — any blocking defect ⇒ `QA_FAIL`; flaky cases are counted,
  reproduced, and filed, never silently retried.
- `G6` Budget — at most 2 QA cycles per edict; then `X1`.

## Ledger Record

One JSON object per line in `ledger.jsonl`:

```json
{"seq":0,"ts":"ISO-8601","edict":"EDICT-0001","from":"S0","to":"S1","office":"太子",
 "verdict":"EDICT","artifacts":["docs/governance/EDICT-0001.md"],"note":"..."}
```

`verdict` is one of `EDICT`, `CONSTITUTION`, `PASS`, `REJECT`, `DISPATCH`, `DONE`,
`FAILED`, `QA_PASS`, `QA_FAIL`, `ESCALATE`, `DECISION`. Ledger is append-only; corrections
are new lines.
