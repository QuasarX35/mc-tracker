---
title: Compiled knowledge
type: concept
summary: Knowledge that is extracted, reconciled and stored once in a maintained artifact, rather than re-derived per query.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [knowledge-management, architecture]
---

# Compiled knowledge

The output of reading sources *ahead of questions*: their claims are extracted, reconciled
with what is already known, and written into pages that later questions read directly. The
opposite of assembling fragments at query time ([[Query-time retrieval]]).

## Key claims

- Compilation is an *investment*: the work is done once per source, not once per question.
  The cost is paid up front and amortises across every future query ([[LLM Wiki pattern]]).
- Compilation is where **contradictions get reconciled** — a page can hold "A said X in
  2019, B said not-X in 2024" and the reader sees the tension immediately. A retrieval system
  hands the reader two chunks and lets them notice ([[LLM Wiki pattern]]).
- Cross-references are part of the artifact, not a runtime computation. The structure
  survives between sessions; it is not re-derived by the model each time.
- The artifact can be *wrong*, and wrongness persists. That is why the pattern needs lint
  ([[Ingest, query and lint]]): a compiled claim that has been superseded is a liability
  until it is updated.

## Relations

- The core of the [[LLM Wiki]] approach.
- Depends on a [[Wiki schema]] for page conventions, otherwise compilation produces
  unstructured notes.
- Enables the compounding effect described in [[LLM Wiki pattern]].
- Not free: it front-loads effort and requires [[Maintenance cost]] to stay near zero.

## Tensions

- "Compiled once" overstates stability: in a fast-moving domain the compile step may be
  out of date before the query arrives. The pattern's answer is frequent lint, not less
  compilation.
- There is no evidence in the source that compiled answers are *more accurate* than
  retrieval answers — only that they are cheaper to produce again and richer in context. The
  accuracy claim is untested ([[Open questions]]).
