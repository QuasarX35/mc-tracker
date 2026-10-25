# EDICT-0006 — Wiki upkeep is mandatory

- **Issued by:** 皇帝
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 礼部 (wiki, schema, state machine) · **Verified by:** 测试部 (`S5Q`)
- **Recorded:** 2026-10-25 (Asia/Singapore)
- **Status:** `ENACTED` — `S6`
- **Amends:** [EDICT-0001](EDICT-0001.md) (pipeline), [EDICT-0003](EDICT-0003.md) (wiki instance)

## 1. Edict as received

> always update it

*Context:* answered immediately after the question "was the llm wiki updated?", whose honest
answer was **no** — EDICT-0005 had shipped without an ingest. So this is not a request for one
more ingest; it is a standing instruction that the wiki is a required output of every task.

## 2. The rule

**Every piece of work updates the wiki before it is reported.** No size exemption. A task that
ends without an ingest is unfinished, regardless of whether its code, tests and QA passed.

Three enforcement layers, none of them decorative:

| Layer | Where | Effect |
|-------|-------|--------|
| Agent contract | [`AGENTS.md`](../../AGENTS.md) §6.5 "(End of every edict — standing rule)" | Loaded into every session as workspace instructions, so the rule is present before work starts |
| Plan gate | [`state-machine.md`](state-machine.md) review item `R9` | 门下省 rejects a plan that does not name the wiki pages it will create/update — or does not justify "no wiki impact" in one line |
| Verification | `S5Q` | An edict with no corresponding `wiki/log.md` entry cannot pass; the lint pass is the evidence that the ingest happened rather than being claimed |

The order matters: the rule is stated in the schema **and** checked at the gate **and** recorded
in the ledger, so a future session cannot satisfy one layer while skipping the others.

## 3. First application — the outstanding ingest

The rule was applied immediately to the previously un-ingested EDICT-0005.

**New raw sources (sealed):**
- `raw/sources/2026-10-25-minecraft-build-tracker-spec.md` — product spec, data model,
  behavioural rules, acceptance criteria, non-goals.
- `raw/sources/2026-10-25-minecraft-gui-design-system.md` — palette tokens, component rules,
  hard pixel rules, the accessibility compromise.

**New wiki pages (4):**
- [[Minecraft Build Tracker]] — entity: features, architecture, verification, tensions.
- [[In-game GUI design]] — concept: what actually sells the Minecraft look; contrast fix.
- [[Local-first tracking]] — concept: `localStorage` + export/import, failure modes.
- [[Vanilla GUI over a neon dashboard]] — synthesis: overriding an inherited design system.

**Updated:** [[LLM Wiki]] overview now declares both domains and the standing rule;
[[Open questions]] gains the enforcement gap, tracker sync/icon scope, archive retention and
the mobile-verification caveat; `wiki/log.md` gains the ingest and the rule-change entries.

## 4. Verification (`S5Q`)

| Check | Result |
|-------|--------|
| `node src/wiki/cli.mjs lint` | clean — 19 pages, 173 wikilinks, 0 orphans, 0 malformed log entries |
| `node src/wiki/cli.mjs index --check` | up to date (regenerated after the ingest) |
| `node src/wiki/cli.mjs raw` | 3 sources match the sealed manifest |
| Relative links across 42 project markdown files | 34 links, 0 broken |
| Rule present in the contract and the gate | `AGENTS.md` §6.5 ✓ · `state-machine.md` `R9` ✓ |
| Ingest describes the shipped work, not the plan | pages cite the sealed raw sources and the QA outcomes |

QA is verification-only for a documentation edict — no code changed, so the test suites are not
re-run beyond the wiki's own lint. [Evidence](../../reports/qa/EDICT-0006-cycle-1.md).

## 5. What this cannot enforce

- A session that ignores `AGENTS.md` entirely. The rule is prompt-level plus gate-level; there
  is no runtime hook that fails a report.
- Mechanical drift detection between the ledger and the log. Candidate mechanism, filed in
  [[Open questions]]: a lint rule comparing the newest ledger `edict` with the newest log entry's
  subject.
- Quality of the ingest. Lint proves presence and consistency, not that the page is worth
  reading — that stays a human judgement.

## 6. State

`S6`. Wiki: 19 pages, 3 sealed raw sources, 173 wikilinks, 0 orphans, lint clean. Every future
edict now carries a wiki deliverable in its plan and a log entry at its gate.
