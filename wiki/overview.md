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
interlinked set of markdown pages and keeps them current. It covers two things: the pattern
itself — [[LLM Wiki pattern]] — and the product this repository ships, the
[[Minecraft Build Tracker]]. That makes the wiki partly self-describing: it is a working
example of the thing it documents.

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

## What this repository tracks

The live product is the [[Minecraft Build Tracker]] — worlds → builds → materials, with a
summed shopping list. Its visual language is [[In-game GUI design]] (grey panels, 2px bevels,
square corners, slots, XP bars), chosen over the inherited violet dashboard in
[[Vanilla GUI over a neon dashboard]]. Its persistence model is [[Local-first tracking]]:
`localStorage` plus validated JSON export/import, no server. Its item icons — 1,368 of the
game's own 256 px inventory renders — and its title-screen backdrop are the game's own assets,
exported/extracted locally and never committed ([[Vanilla assets without redistribution]]); the
interface face is the game's own bitmap font, bundled with its licence ([[In-game GUI design]]).
Worlds and builds take item icons or uploaded pictures as their faces
([[Atmosphere and identity without shipping assets]]).

Standing rule since EDICT-0006: **every piece of work updates this wiki** before it is
reported — pages, index, log, raw seal, lint. Work that is not ingested is work that will be
re-derived. Since EDICT-0008 this is not a promise: `lint`'s `edict-sync` rule fails when a
completed edict has no citing log entry ([[Wiki schema]]).

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
