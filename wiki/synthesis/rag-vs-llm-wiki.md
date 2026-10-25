---
title: RAG and LLM Wiki compared
type: synthesis
summary: Side-by-side comparison of query-time retrieval and a compiled maintained wiki, including where each actually wins.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [comparison, architecture]
---

# RAG and LLM Wiki compared

Written as a query answer and filed back into the wiki, per the pattern's instruction that
good answers should not disappear into chat history ([[Ingest, query and lint]]). Sources:
[[LLM Wiki pattern]].

## Comparison

| Dimension | [[Query-time retrieval]] (RAG) | [[Compiled knowledge]] (LLM Wiki) |
|-----------|-------------------------------|-----------------------------------|
| Where work happens | Per question | Once per source, then incremental updates |
| Between questions | Nothing accumulates | The artifact compounds |
| Cross-document synthesis | Reconstructed every time | Already written into relations and tensions |
| Contradictions | Reader notices, or does not | Flagged explicitly by the maintainer |
| Staleness | Low — corpus is re-read | Real — pages are cached claims |
| Setup cost | Index + embedding pipeline | Schema + conventions + discipline |
| Ongoing cost | Query compute | Maintenance, kept low by the LLM ([[Maintenance cost]]) |
| Failure mode | Missing/incorrect fragments; inconsistent answers | Confident stale pages; orphan sprawl |
| Human effort | Upload, ask | Curate sources, direct, ask, judge |
| Scale behaviour | Degrades gracefully with corpus size | Needs `index.md`, then [[qmd]] |

## Where each actually wins

- **RAG wins** when the corpus is large, changing, or shallowly queried: no maintenance, no
  stale claims, no schema to co-evolve.
- **The wiki wins** when the same territory is revisited, when synthesis spans many sources,
  and when the *history of claims* matters — the pattern's own examples (research thesis,
  book companion, personal tracking) are all of that shape ([[LLM Wiki pattern]]).
- The dichotomy is soft: the pattern's own upgrade path adds hybrid search over wiki pages
  ([[qmd]]), i.e. retrieval returns as a service on top of compilation.

## What the source does not establish

- No measurements, no error rates, no cost comparison. The argument is architectural, not
  empirical ([[Open questions]]).
- It implicitly compares a *well-maintained* wiki against a *naive* RAG pipeline. A tuned RAG
  system with good chunking and re-ranking is not the strawman.

## Relations

- Contrast pair: [[Compiled knowledge]] ↔ [[Query-time retrieval]].
- Motivating economics: [[Maintenance cost]]; lineage: [[Memex]].
