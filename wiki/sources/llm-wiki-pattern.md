---
title: LLM Wiki pattern
type: source
summary: Summary of the pattern document that defines this wiki — compiled persistent pages instead of query-time retrieval, maintained by an LLM.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [knowledge-management, primary-source]
---

# LLM Wiki pattern

Raw source: [`raw/sources/2026-10-25-llm-wiki-pattern.md`](../../raw/sources/2026-10-25-llm-wiki-pattern.md)
(captured 2026-10-25, verbatim from Emperor EDICT-0003). This page summarises what the
pattern claims; the raw file remains the source of truth.

## What the pattern is

An alternative to RAG for personal and team knowledge bases: an LLM **incrementally builds
and maintains a persistent wiki** of interlinked markdown files between you and your raw
sources. A new source is read, its information extracted, and integrated into existing
entity and topic pages — not merely indexed for later retrieval. The knowledge is compiled
once and then kept current ([[Compiled knowledge]]).

## Key claims

- The wiki is a **persistent, compounding artifact**: cross-references, contradictions and
  synthesis already exist before the question is asked ([[Compiled knowledge]]).
- The human never writes the wiki; the human sources, explores and asks. The LLM does the
  filing and bookkeeping ([[Maintenance cost]]).
- Three layers: immutable raw sources, a fully agent-owned wiki, and a schema document that
  encodes conventions and workflows ([[Wiki schema]]).
- Three operations: **ingest**, **query**, **lint** ([[Ingest, query and lint]]).
- Good answers should be **filed back** into the wiki as synthesis pages rather than lost to
  chat history ([[Ingest, query and lint]]).
- `index.md` (content catalogue) plus `log.md` (chronological prefix-parseable record) is
  enough structure to avoid embeddings at moderate scale ([[Wiki schema]]).
- Workflow analogy: Obsidian is the IDE, the LLM is the programmer, the wiki is the codebase
  ([[Obsidian]]).
- Lineage: Vannevar Bush's 1945 [[Memex]] gets its missing maintenance layer.

## Where the pattern is applied

Personal tracking, long research theses, chapter-by-chapter book wikis (the Tolkien Gateway
comparison), team wikis fed by Slack/meetings, competitive analysis, due diligence, trip
planning, course notes. All of them share one shape: knowledge accumulating over time that
needs organising rather than scattering.

## Relations

- Contrasts with [[Query-time retrieval]] (RAG, NotebookLM, ChatGPT file uploads) — see
  [[RAG and LLM Wiki compared]].
- Recommends specific human-side tools: [[Obsidian]], [[qmd]], [[Marp]], [[Dataview]].
- Explicitly modular: image handling, search engines, slide decks are optional.

## Tensions

- The source is deliberately abstract and prescribes no directory structure, page format or
  tooling. Every concrete convention in this repository is this instance's interpretation,
  not the source's requirement ([[Implementation decisions]]).
- It claims `index.md` "works surprisingly well at moderate scale (~100 sources, ~hundreds
  of pages)" but gives no evidence or measurement; this instance treats that as an untested
  claim ([[Open questions]]).
- It asserts contradictions are "already flagged" — true only if the maintainer follows the
  rule; a lazy ingest silently overwrites and the wiki loses the tension.
