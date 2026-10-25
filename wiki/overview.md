---
title: LLM Wiki
type: overview
summary: A persistent, LLM-maintained knowledge base of interlinked pages that sits between the Emperor and an immutable raw source collection.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [knowledge-management, meta]
---

# LLM Wiki

This knowledge base is an instance of the **LLM Wiki** pattern: instead of retrieving
chunks from documents at query time, an LLM compiles what it reads into a persistent,
interlinked set of markdown pages and keeps them current. The first source ingested here is
the pattern's own description — [[LLM Wiki pattern]] — which makes this wiki partly
self-describing: it is a working example of the thing it documents.

## The thesis

Retrieval-augmented generation rediscovers knowledge on every question
([[Query-time retrieval]]). A maintained wiki compiles it once and then compounds
([[Compiled knowledge]]). The difference is visible in exactly the cases that matter —
synthesis across five documents, contradictions between sources, the state of a question
six weeks in.

A wiki like this normally dies of bookkeeping: the cross-references, the current summaries,
the contradictions that need flagging. The pattern's central claim is that an LLM makes the
maintenance cost approach zero ([[Maintenance cost]]), which is the first proposal to solve
the part of Vannevar Bush's [[Memex]] that he could not.

## The three layers

1. **Raw sources** — `raw/`, immutable, sealed by a SHA-256 manifest. The Emperor curates
   these; the agent reads but never edits them.
2. **The wiki** — `wiki/`, owned entirely by the agent: pages, cross-references, the
   chronological record, the standing synthesis.
3. **The [[Wiki schema]]** — [`AGENTS.md`](../AGENTS.md), the contract that makes an agent a
   maintainer instead of a chatbot.

Three operations maintain it: [[Ingest, query and lint]].

## How this instance is configured

- Zero-dependency Node tooling under `src/wiki/` provides `lint`, `index`, `search`,
  `raw --seal` and `stats`; see [[Implementation decisions]].
- Wiki-to-wiki links are Obsidian wikilinks by page title; raw sources are cited by
  relative path. Human browsing happens in [[Obsidian]].
- `wiki/index.md` is generated, never hand-edited; `wiki/log.md` is append-only.
- No embeddings or vector store yet — deliberate, and revisited when the corpus outgrows the
  index (see [[Open questions]]).

## Standing tensions

- The pattern is deliberately abstract and prescribes no structure; every convention here is
  a choice, not a requirement. See [[Open questions]] for what is still undecided.
- A compiled wiki can go *stale* in a way a retrieval system cannot: the answer is cached and
  then the world moves. Lint is the mitigation, and it is a judgement call, not a test
  ([[Ingest, query and lint]]).
