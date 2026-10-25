# Log

Append-only. Newest entries at the bottom. Format: `## [YYYY-MM-DD] <verb> | <subject>`,
then 2–5 lines on what changed. Verbs: `ingest`, `query`, `lint`, `edit`.

## [2026-10-25] ingest | LLM Wiki — a pattern for building personal knowledge bases using LLMs

- Captured the edict verbatim as `raw/sources/2026-10-25-llm-wiki-pattern.md` (immutable).
- Created the summary page [[LLM Wiki pattern]], the standing synthesis [[LLM Wiki]], and
  6 concept pages: [[Compiled knowledge]], [[Query-time retrieval]], [[Maintenance cost]],
  [[Memex]], [[Wiki schema]], [[Ingest, query and lint]].
- Created 4 entity pages: [[Obsidian]], [[qmd]], [[Marp]], [[Dataview]].
- Schema written as [`AGENTS.md`](../AGENTS.md): layout, frontmatter contract, ingest/query/
  lint workflows, tooling.
- Decision recorded: 3-layer layout, wikilinks by title, generated index, sealed raw manifest
  ([[Implementation decisions]]). Questions filed: [[Open questions]].

## [2026-10-25] query | How does a compiled wiki differ from RAG?

- Answered under [[RAG and LLM Wiki compared]] with a 10-dimension table, and filed the page
  back rather than leaving the answer in chat.
- Conclusion recorded that the dichotomy is soft: the pattern re-introduces retrieval
  ([[qmd]]) as a service over the compiled wiki.

## [2026-10-25] lint | first full pass over 15 pages

- `node src/wiki/cli.mjs lint` clean: 15 pages, 146 wikilinks, 0 orphans, 1 sealed source,
  0 malformed log entries.
- Fixed during bring-up, before the pass: `index.md`/`log.md` were being counted as pages;
  the log checker silently ignored headings that did not start with `## [` (so a malformed
  entry was invisible); a unit test wrongly assumed a body edit makes the index stale.
- Environment finding: `node --test` cannot run here — the sandbox denies the child
  processes it spawns (`spawn EPERM`). Test files are run directly instead; recorded in the
  schema (§7).

## [2026-10-25] edit | schema: test invocation, title style, type list

- `AGENTS.md` §7 documents running test files directly and why `node --test` is unusable.
- §8 title-style example and §3 `type` enum cleaned up.
