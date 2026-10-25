---
title: Ingest, query and lint
type: concept
summary: The three operations that keep a wiki alive — file new sources, answer and file answers back, and periodically health-check the whole graph.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [workflow, operations]
---

# Ingest, query and lint

The operational triad of the [[LLM Wiki]] pattern. Each operation is a workflow the
[[Wiki schema]] specifies in detail; this page is the conceptual map.

## Key claims

- **Ingest**: read a new raw source, write its summary page, then *update every affected page*
  — a source may touch 10–15 pages. A source that produces only its own summary page has not
  been ingested ([[LLM Wiki pattern]]).
- **Query**: read `index.md` first, drill into the pages it points at, answer with citations —
  then **file good answers back** as synthesis pages so exploration compounds instead of
  evaporating into chat history ([[LLM Wiki pattern]]).
- **Lint**: periodically look for contradictions, stale claims, orphans, missing pages for
  much-mentioned concepts, missing cross-references and data gaps worth researching. The agent
  is also expected to *suggest what to investigate next* ([[LLM Wiki pattern]]).
- The three are asymmetric: ingest adds, query recombines, lint subtracts rot. A wiki that
  only ingests grows unreadable; one that only lints stabilises around nothing.

## Relations

- Executed under the [[Wiki schema]]; enforced mechanically by the tooling in
  [[Implementation decisions]].
- Ingest is what builds [[Compiled knowledge]]; lint is what keeps it from decaying
  ([[Maintenance cost]]).
- Filing answers back is how a [[Memex]]-style trail gets built without anyone curating it.

## Tensions

- The source recommends ingesting one source at a time while staying involved, but also allows
  batch ingestion with less supervision. Those produce different wikis: supervised ingests
  encode judgement, batch ingests encode coverage.
- Lint's judgement half is not testable. Structural lint (links, orphans, frontmatter) can be a
  test; "is this claim stale" cannot, and that is where the real risk lives.
- Query output has no canonical home: a query answer, a lint finding and a source summary all
  want to be pages, which invites duplication across `synthesis/` and `concepts/`.
