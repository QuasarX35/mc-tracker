# AGENTS.md — operating schema for this LLM Wiki

This repository is a working instance of the **LLM Wiki** pattern: a persistent,
interlinked knowledge base that an LLM compiles and maintains between you and your raw
sources. This file is the **schema** — the conventions and workflows that make an agent a
disciplined maintainer rather than a chatbot. It co-evolves with the Emperor's preferences;
when a workflow changes, change this file in the same commit.

Institutional context: this workspace is governed by the 三省六部 pipeline in
[`docs/governance/`](docs/governance/EDICT-0001.md). Documentation and wiki content belong to
礼部; tooling to 兵部; independent verification to 测试部. Governance rules do not override
this schema, and this schema does not override the governance gate.

## 1. The three layers

| Layer | Path | Owner | Rule |
|-------|------|-------|------|
| Raw sources | `raw/` | 太子 (write-once, on intake) | **Immutable.** Read them; never edit, rename or reformat them. Sealed by `raw/manifest.json`. |
| The wiki | `wiki/` | 礼部 (the agent) | The agent owns it entirely: create, revise, cross-reference, merge duplicates. |
| Schema | `AGENTS.md` (this file) | 皇帝 + agent | The contract. Edited deliberately, not casually. |

Images and other binaries live in `raw/assets/` and are referenced from raw sources as
local relative paths.

## 2. Wiki layout

```
wiki/
  index.md          # generated catalogue — never hand-edit
  log.md            # append-only chronological record
  overview.md       # the standing synthesis: what this knowledge base is about, what it claims
  concepts/         # ideas, mechanisms, patterns
  entities/         # specific named things: tools, products, people, organisations
  sources/          # one summary page per raw source
  synthesis/        # comparisons, analyses, open questions — answers filed back
```

## 3. Frontmatter (required on every wiki page)

```yaml
---
title: Compiled knowledge          # unique, matches the [[wikilink]] used elsewhere
type: concept                      # overview | concept | entity | source | synthesis
summary: One sentence, ≤ 160 chars  # used verbatim in index.md
updated: 2026-10-25                # ISO date of the last substantive edit
sources:                           # raw source slugs backing this page, or [] for synthesis
  - 2026-10-25-llm-wiki-pattern
tags: [knowledge-management]
---
```

`type` must match the directory: `concepts/` → `concept`, `entities/` → `entity`,
`sources/` → `source`, `synthesis/` → `synthesis`; `overview.md` is `overview`. `index.md`
and `log.md` are generated/append-only and are exempt.

## 4. Linking

- Wiki-to-wiki links use **`[[Page Title]]`** (Obsidian wikilinks). The target is the
  page's `title`, not its filename.
- Links to raw sources, assets, or governance documents use relative markdown links.
- External URLs are plain markdown links and are never counted as wiki structure.
- **Every page must have at least one inbound wikilink** other than `index.md`. A page that
  nothing links to is either not integrated yet or does not deserve to exist.
- Do not leave a bare mention of an existing page; link it. If a concept is mentioned
  repeatedly and has no page, create one or record the gap in
  [`wiki/synthesis/open-questions.md`](wiki/synthesis/open-questions.md).

## 5. Page template

```markdown
---
title: <Title>
type: <type>
summary: <one sentence>
updated: <YYYY-MM-DD>
sources: [<raw slugs>]
tags: [<tags>]
---

# <Title>

<What it is, in two or three sentences, written for someone who has not read the source.>

## Key claims

- <Claim> — [[Source Page]]

## Relations

- Part of [[Bigger Idea]]
- Contrasts with [[Other Idea]]
- Enabled by [[Some Tool]]

## Tensions / open questions

- <Where the sources disagree, or what is still unknown>
```

The `Tensions` section is not decoration: contradictions between sources are the most
valuable thing a maintained wiki can hold, and they must be written down where the next
query will find them.

## 6. Workflows

### 6.1 Ingest a source

1. A new file appears under `raw/sources/` (clipped article, note, transcript, PDF text).
   It is never edited afterwards.
2. Read the source in full. Read `wiki/index.md` and the relevant existing pages first, so
   you update rather than duplicate.
3. Discuss the takeaways with the Emperor when they are present; otherwise state the three
   most load-bearing claims in your report.
4. Write `wiki/sources/<slug>.md` — the summary page. `title`, `type: source`, the raw slug
   in `sources`, and a `[[...]]` link to every page it touches.
5. Update every affected page: entity pages, concept pages, `overview.md`. A source that
   only produces its own summary page has not been ingested.
6. Where the new source contradicts an existing claim, do **not** silently overwrite: record
   both claims, dated, with a `Tensions` entry, and say which one the newer evidence favours.
7. Regenerate the index: `node src/wiki/cli.mjs index --write`.
8. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <Source Title>` + 2–5 lines of what
   changed, and which pages were touched.
9. Seal raw integrity: `node src/wiki/cli.mjs raw --seal` (refreshes hashes for *new* files
   only — it refuses to re-seal a file whose hash already exists and changed).
10. Run `node src/wiki/cli.mjs lint` and resolve every finding.

### 6.2 Answer a query

1. Read `wiki/index.md`, then `wiki/log.md` tail, then the pages the index points at.
2. Use `node src/wiki/cli.mjs search "<query>"` when the index is no longer enough.
3. Answer with citations — `[[Page Title]]` for wiki pages, the raw filename for sources.
4. **File the answer back** if it is more than chat: a comparison, a connection, a decision,
   an open question → `wiki/synthesis/<slug>.md`, update the index, append a
   `## [YYYY-MM-DD] query | <Question>` log entry.

### 6.3 Lint

1. `node src/wiki/cli.mjs lint` — structural checks: frontmatter validity, unresolved
   wikilinks, orphans, stale index, log format, raw integrity, type/directory mismatch.
2. Then judge, which the tool cannot: contradictions between pages, stale claims newer
   sources superseded, thin pages, concepts mentioned everywhere but lacking a page,
   questions worth researching next.
3. File findings in `wiki/synthesis/open-questions.md`, fix what is mechanical, append
   `## [YYYY-MM-DD] lint | <scope>` to the log.

### 6.4 Start of every session

Read `wiki/index.md`; `tail` the last 5 log entries; run `node src/wiki/cli.mjs lint` and
report any findings before doing new work.

### 6.5 End of every edict — standing rule (EDICT-0006)

**Every piece of work updates this wiki before it is reported.** No exceptions, no "small
change" exemption. A task that ends without a wiki update is an unfinished task.

Minimum sequence:

1. Decide the wiki impact *before* starting: which pages this work creates, which it changes,
   which raw sources it adds. An approved plan must state this (review item `R9` in
   [`docs/governance/state-machine.md`](docs/governance/state-machine.md)).
2. Ingest the outcome: new/updated pages for entities, concepts and decisions, plus anything
   the product's behaviour implies for existing pages.
3. Update `overview.md` if the change alters the standing synthesis.
4. Record durable questions and caveats in `synthesis/open-questions.md`, including QA
   findings that were worked around rather than fixed.
5. `node src/wiki/cli.mjs index --write` and append a
   `## [YYYY-MM-DD] ingest|edit | <subject>` entry to `wiki/log.md` naming the pages touched.
6. `node src/wiki/cli.mjs raw --seal` for any new raw source, then
   `node src/wiki/cli.mjs lint` until clean — the lint pass is the check that the ingest
   actually happened rather than being claimed.

## 7. Tooling

Zero dependencies, Node ≥ 18, no network. All commands print human-readable output and
exit non-zero on findings, so they compose with `&&`.

| Command | Purpose |
|---------|---------|
| `node src/wiki/cli.mjs index --write` | Regenerate `wiki/index.md` from page frontmatter. |
| `node src/wiki/cli.mjs index --check` | Fail if the index is stale (independent validation, not a regeneration). |
| `node src/wiki/cli.mjs lint` | All structural checks; exit 1 on any error. |
| `node src/wiki/cli.mjs search "<query>"` | Naive ranked search over page titles, summaries and bodies. |
| `node src/wiki/cli.mjs raw --seal` | Record SHA-256 of every raw source in `raw/manifest.json`. |
| `node src/wiki/cli.mjs stats` | Counts by type, links, orphans. |
| `node tests/unit/wiki-core.test.mjs && node tests/qa/wiki.acceptance.test.mjs` | Unit + independent acceptance suites. **Do not use `node --test`**: it spawns child processes with piped stdio, which the sandbox denies (`spawn EPERM`). Run each test file directly, in one process. |

`index.md` is generated. Hand-editing it is a defect: the next regeneration overwrites the
edit and `--check` will fail in the meantime.

## 8. Naming and style

- Page titles: nouns, sentence case, no dates (`Compiled knowledge`, not `compiled_knowledge_2026`). Source slugs keep their date: `2026-10-25-llm-wiki-pattern`.
- One idea per page. If a page needs two `## Key claims` groups on unrelated subjects, split it.
- Write for retrieval: concrete nouns, explicit relations, no "as discussed above".
- Claims that come from a source cite that source's summary page. Claims that come from the
  Emperor's reasoning are marked as synthesis and live in `synthesis/`.
- Never invent a citation. If a claim is unsourced, say so.

## 9. What this instance deliberately does *not* do (yet)

- No embeddings, no vector store: `index.md` + `search` is enough below ~100 sources.
- No Obsidian plugins required: Marp, Dataview, graph view are optional human-side tools.
- No image pipeline beyond local relative links in `raw/assets/`.
- No scheduled lint: it is run on demand and at session start.
