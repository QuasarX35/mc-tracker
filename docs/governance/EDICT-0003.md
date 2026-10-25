# EDICT-0003 — Instantiation of the LLM Wiki

- **Issued by:** 皇帝
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 礼部 (schema + wiki + ingest), 兵部 (tooling + unit tests), 吏部-HR (scopes), 工部 (repo)
- **Verified by:** 测试部 (`S5Q`)
- **Recorded:** 2026-10-25 (Asia/Singapore)
- **Status:** `ENACTED` — pipeline state `S6`

## 1. Edict as received

> implement the following: # LLM Wiki — A pattern for building personal knowledge bases
> using LLMs. …

The full text is filed verbatim as the wiki's first raw source:
[`raw/sources/2026-10-25-llm-wiki-pattern.md`](../../raw/sources/2026-10-25-llm-wiki-pattern.md)
(sealed in `raw/manifest.json`).

*Sanitised title:* "Instantiate the LLM Wiki pattern in this workspace."
*Stripped:* nothing — the paste was self-contained. *Flagged:* "implement" spans three
optional layers (schema, corpus, tooling) and the document explicitly says every component
is optional; the edict did not say which. Planning therefore had to choose and defend.

## 2. What was built

| Layer | Artifact | Office |
|-------|----------|--------|
| Schema | [`AGENTS.md`](../../AGENTS.md) — layout, frontmatter contract, ingest/query/lint workflows, tooling, style | 礼部 |
| Raw layer | `raw/sources/2026-10-25-llm-wiki-pattern.md` + sealed `raw/manifest.json` (SHA-256) | 太子 |
| Wiki | `wiki/` — 15 pages: 1 overview, 6 concepts, 4 entities, 1 source summary, 3 synthesis + generated `index.md` + append-only `log.md` | 礼部 |
| Tooling | `src/wiki/lib.mjs`, `src/wiki/cli.mjs` — zero-dependency: `lint`, `index --write/--check`, `search`, `raw --seal`, `stats` | 兵部 |
| Tests | `tests/unit/wiki-core.test.mjs` (10), `tests/qa/wiki.acceptance.test.mjs` (13, independent, fixtures) | 兵部 / 测试部 |
| Scopes | Registry revision 2: `wiki/**`+root docs → 礼部, `raw/**` write-once → 太子, `package.json` → 兵部 | 吏部-HR |
| Repo | `git init`, `.gitignore` (`.tmp/` excluded), first commit | 工部 |

## 3. Review record

**Round 1 — 🚫 Reject.**

| # | Finding | Gate |
|---|---------|------|
| F1 | "Implement" ungraded; a wiki with zero sources proves nothing. Required one end-to-end ingest touching many pages. | R3 |
| F2 | **No write scope existed** for `wiki/**`, `raw/**` or root manifests — the plan was illegal to execute under EDICT-0001's own law. | R5 |
| F3 | No tooling ⇒ index, links and raw immutability unverifiable, and 测试部 had no testable artifact. | R2, R3 |
| F4 | A linter that regenerates the index cannot also validate it — the check would be circular. Validation had to be an independent staleness compare. | R3 |
| F5 | Raw immutability asserted by convention only; nothing stopped an ingest from rewriting a source. | R5, R7 |
| F6 | Root files unowned, and Node tooling cannot rely on installing packages offline. | R6 |

**Round 2 — ✅ Pass**, conditional on: the first source being the edict itself (nothing
invented), every page earning an inbound link, lint failing (not warning) on structural
findings, and QA driving the CLI as a black box against its own fixtures.

## 4. Verification (`S5Q`)

Two cycles, budget 2, no escalation.

| Cycle | Result | Defects |
|-------|--------|---------|
| 1 | **QA_FAIL** | `L1` blocking — a malformed log heading (`## 2026-…`) was invisible to the linter, which only inspected headings starting `## [`. `T1` unit-test defect — asserted that a body edit makes the index stale. `E1` environment — `node --test` spawns piped child processes and dies with `spawn EPERM` in the sandbox. |
| 2 | **QA_PASS** | 13/13 acceptance, 10/10 unit, lint clean (15 pages, 146 wikilinks, 0 orphans), index current, 1 source verified. |

Evidence: [cycle 1](../../reports/qa/EDICT-0003-cycle-1.md) · [cycle 2](../../reports/qa/EDICT-0003-cycle-2.md).

## 5. Deliberate omissions (with reasons)

- **No embeddings / vector store.** The pattern offers [[qmd]] as a later upgrade; the corpus
  is one source. Revisit at ~100 sources or on first search miss.
- **No Marp decks, Dataview dashboards, image pipeline.** Optional in the source; none is
  needed to prove the architecture. Recorded in the wiki as deliberate decisions.
- **No scheduled lint.** Runs at session start and on demand instead.
- **No real knowledge domain yet.** The wiki currently documents its own pattern; the domain
  determines whether the page taxonomy survives. Filed as the first open question.

## 6. Environment findings (for the record)

1. `node --test` is unusable here (piped-stdio denial). Test files are executed directly;
   the schema documents this so a future session does not rediscover it.
2. `.tmp/` holds 149 vendored markdown files (UI-skills tree + npm cache), excluded from
   lint scope and now gitignored. Deletion still awaits 皇帝.
3. The sandbox previously blocked all shell execution on this workspace; that was repaired in
   EDICT-0001 and remains stable through this edict.
4. **Concurrent author detected.** Between EDICT-0002 and EDICT-0003, a *different* session
   authored `design-system/minecraft-tracker/**`, `src/index.html`, `src/dashboard.js`,
   `src/styles.css` and `tests/qa/contrast_audit.py` in this same workspace; those files
   reference their own, unrelated "EDICT-0003". They are **not** products of this edict, they
   overlap the registry's `src/**` (兵部) and `tests/qa/**` (测试部) scopes, and the git commit
   is deliberately limited to this edict's artifacts — the foreign files are left untracked
   pending 皇帝's decision. Scope collision recorded for 吏部-HR.

## 7. State

`S6`. 15 wiki pages, 1 sealed source, 4 log entries, 146 wikilinks, 0 orphans, 0 lint
findings. The wiki is now ready to receive its second source — the first that is *not* about
itself.
