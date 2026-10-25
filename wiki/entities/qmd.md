---
title: qmd
type: entity
summary: A local markdown search engine with hybrid BM25/vector search and LLM re-ranking, exposed as a CLI and an MCP server.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [tooling, search]
---

# qmd

A local, on-device search engine for markdown files: hybrid BM25 plus vector search, with LLM
re-ranking ([[LLM Wiki pattern]]). Recommended by the pattern as the upgrade path once
`wiki/index.md` stops being enough to find things.

## Why it is relevant

- It gives an agent two integration surfaces: a **CLI** (shell out) and an **MCP server**
  (native tool call) — so the search layer does not dictate the agent's runtime.
- It keeps retrieval local, matching the pattern's preference for private, file-based
  knowledge stores.
- It shows the pattern's architecture is not anti-retrieval: [[Query-time retrieval]] returns
  as a *service over the compiled wiki*, not as a replacement for it ([[Compiled knowledge]]).

## Relations

- Optional tooling for [[Ingest, query and lint]] — specifically the query operation.
- Complements the generated `index.md` described in [[Wiki schema]].
- Alternative to writing your own search: this instance ships a naive in-repo `search`
  command first (see [[Implementation decisions]]).

## Tensions

- Adding qmd means adding a dependency and a second source of truth about what is "relevant";
  the pattern offers it as a milestone, not a default, and gives no threshold for adopting it.
- The source describes qmd in one paragraph and links its repository; it has not been
  evaluated here, so its ranking quality is unverified ([[Open questions]]).
