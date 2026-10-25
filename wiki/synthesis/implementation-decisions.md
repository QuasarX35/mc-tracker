---
title: Implementation decisions
type: synthesis
summary: The concrete choices made in instantiating this wiki — directories, frontmatter, wikilinks, zero-dependency tooling, sealed raw sources.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [decisions, architecture]
---

# Implementation decisions

The pattern is deliberately abstract ([[LLM Wiki pattern]]); this page records what *this*
instance chose, and why. Decisions here are revisable — they are synthesis, not scripture.

| # | Decision | Rationale | Reversal trigger |
|---|----------|-----------|------------------|
| D1 | Directory split `raw/` + `wiki/{concepts,entities,sources,synthesis}` | Matches the three-layer architecture; page type is visible from the path | A page type that does not fit any bucket |
| D2 | `AGENTS.md` as the schema file | The harness loads it automatically, so every session inherits conventions | A different agent runtime becomes primary |
| D3 | Wikilinks by **page title**, not filename | Obsidian-native; titles are stable, filenames are not | Title collisions become common |
| D4 | Required frontmatter incl. `summary` used verbatim in the index | One source of truth for index text; no duplicate summarising | Index needs richer metadata |
| D5 | `index.md` **generated**, never hand-edited | Hand-editing guarantees drift; generation makes completeness mechanical | Index outgrows a single file |
| D6 | Zero-dependency Node tooling in `src/wiki/` | Works offline in the sandbox; no install step, no supply chain | Needs real BM25/vector search (then see [[qmd]]) |
| D7 | `raw/manifest.json` sealing raw sources by SHA-256 | "Immutable" as a *check*, not a promise | Manifest churn becomes noisy |
| D8 | Lint fails (exit 1) on structural findings | A warning is ignored; a failed command blocks a pipeline | — |
| D9 | No embeddings, no vector store yet | `index.md` + naive `search` is enough below ~100 sources; the claim is untested, so revisit with data | Corpus > ~100 sources or search misses |
| D10 | Answers filed under `synthesis/` | Separates the agent's own reasoning from sourced claims | Synthesis pages multiply past navigation |

## What was deliberately skipped

- Marp decks, Dataview dashboards, image pipeline: the pattern calls them optional, and none
  is needed to prove the architecture ([[Marp]], [[Dataview]], [[Obsidian]]).
- Scheduled lint: the workflow runs at session start instead ([[Ingest, query and lint]]).

## Relations

- Implements the [[Wiki schema]].
- Open items that this page does not settle: [[Open questions]].
