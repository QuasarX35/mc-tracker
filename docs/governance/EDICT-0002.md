# EDICT-0002 — Constitution of the 测试部 (QA Ministry)

- **Issued by:** 皇帝
- **Drafted by:** 礼部 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Recorded:** 2026-10-25 (Asia/Singapore)
- **Status:** `ENACTED` — amends [EDICT-0001](EDICT-0001.md)
- **Seats after amendment:** 13 = 12 offices + 皇帝

## 1. Edict as received

> add another ministry for QA testing

*Sanitised title:* "Add a QA testing ministry to the 三省六部 hierarchy."
*Nothing was stripped — the edict was one sentence with no metadata.*

## 2. Decision

The hierarchy gains a twelfth office, **测试部 (QA Ministry)**, holding the independent
verification mandate. Three deliberate choices:

1. **The 六部 stay six.** 户礼兵刑工吏 are historical; QA has no seat in that count.
   测试部 is a separate 衙署 on the model of 大理寺 — a tribunal that examines and rules,
   rather than a ministry that builds. Calling it a seventh ministry would be inaccurate
   and would muddy who reports to whom.
2. **It is an office of execution, not of policy.** 门下省 audits *plans*; 测试部 audits
   *artifacts*. They are not substitutes and a plan pass does not pre-approve a build.
3. **Build and verification are separated.** 兵部 may no longer certify its own work. This
   is the entire value of the amendment; without it the office is decoration.

## 3. Mandate

Verify delivered artifacts against the accepted acceptance criteria, produce reproducible
evidence, and hold a binding verdict over the `S5 → S6` transition.

It **does** write and run its own test cases, record evidence, and classify defects.
It **does not** modify product code, edit its own test cases after a build to make them
pass, or waive a defect. It returns work to 尚书省; it never repairs it.

## 4. Independence rules

| # | Rule |
|---|------|
| `Q1` | The author of an artifact is never its verifier. In delegated mode, 测试部 must be a different teammate from 兵部. |
| `Q2` | 测试部 holds no write scope under `src/**`. It cannot fix what it grades. |
| `Q3` | 兵部 holds no write scope under `tests/qa/**`; QA cases are frozen when a build is submitted and changes are versioned, never silent. |
| `Q4` | A `QA_FAIL` verdict is binding: the edict cannot reach `S6` while any blocking defect stands. |
| `Q5` | Only 皇帝 may waive a blocking defect, and only as an explicit ledger `DECISION` recorded in `X1`. |

## 5. Pipeline change

A verification state is inserted before reporting:

```
S4 DISPATCHED -> S5 EXECUTING -> S5Q QA_VERIFY -> S6 REPORTED
                                     |  ^
                              QA_FAIL  |  |  fix + resubmit
                                     v  |
                                    S5
                          budget exhausted -> X1 ESCALATED
```

`S5Q` is owned by 测试部. Its entry criteria are recorded before execution ends — see `G1`
in [state-machine.md](state-machine.md). No edict may skip `S5Q`; an edict with no testable
artifact is classified `NON_VERIFIABLE` by 门下省 at plan time and must state why.

## 6. Review record

**Round 1 — 🚫 Reject.** Findings, all of which changed the design above:

| # | Finding | Gate |
|---|---------|------|
| F1 | "QA testing" was unbounded — functional only, or also performance, security, data integrity? An office with undefined scope grades against its own mood. | R1, R3 |
| F2 | Ownership collision: `tests/**` was granted wholly to 兵部. QA would edit the tests it grades, or be locked out of them. | R5 |
| F3 | No independence rule. Without `Q1–Q5` the ministry invites self-certification and the amendment adds ceremony, not control. | R3, R5 |
| F4 | QA failure path was unbounded — an unfixable defect could loop forever exactly as the plan veto could before EDICT-0001's budget. | R7 |
| F5 | Nothing in the state machine represented verification; `S5 → S6` would still skip it entirely. | R2, R3 |
| F6 | Entry criteria missing: without a pinned build and a reproducible command, QA cannot execute at all. | R6 |

**Round 2 — ✅ Pass**, conditional on: the gate being inserted as a real state (`S5Q`)
with transitions and budget, not described in prose; scopes split so neither office can
write the other's graded material; and the office shipping one executable artifact on day
one rather than existing only on paper.

## 7. Effective changes

| Artifact | Change |
|----------|--------|
| [office-registry.md](office-registry.md) | 测试部 added; seats 13; scopes split (`tests/unit/**` → 兵部, `tests/qa/**` + `qa/**` + `reports/qa/**` → 测试部); independence rules `Q1–Q5` |
| [state-machine.md](state-machine.md) | `S5Q` state, three transitions, QA gate criteria `G1–G6`, `QA_PASS`/`QA_FAIL` verdicts |
| [qa/qa-evidence-template.md](../../qa/qa-evidence-template.md) | 测试部's first executable deliverable: the evidence record format |
| [EDICT-0001.md](EDICT-0001.md) | Amendment note added; original text untouched (append-only constitution) |
| [ledger.jsonl](ledger.jsonl) | Records `seq 9+` for every transition of this amendment |

## 8. Deferred, with reasons

- **Test framework and runner choice** — deferred to the first edict that ships code. `R6`
  forbids promising tooling that is not installed; the choice depends on the language of
  that build, which does not exist yet.
- **CI integration** — 工部 owns it once a build exists; a hook with nothing to run is noise.
- **Headcount for delegated mode** — 测试部 is a role contract today. It gains a real
  teammate only when a code edict yields parallel work packages; the independence rule
  `Q1` then applies to the teammate, not just to the role.
