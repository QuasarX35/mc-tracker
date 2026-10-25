---
title: Memex
type: concept
summary: Vannevar Bush's 1945 vision of a private, curated knowledge store with associative trails — missing only a maintainer, which the LLM supplies.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [history, hypertext]
---

# Memex

Vannevar Bush's 1945 proposal for a personal, curated knowledge device: documents with
**associative trails** between them, private and actively maintained, where the connections
matter as much as the documents ([[LLM Wiki pattern]]).

## Key claims

- Bush's vision was closer to a maintained personal wiki than to the web that actually
  emerged: private, curated, trails deliberately built rather than links thrown at a crawler.
- The unsolved problem was **who does the maintenance**. Trails decay unless someone rebuilds
  them as material changes ([[LLM Wiki pattern]]).
- The [[LLM Wiki]] pattern's claim to the lineage is that an LLM supplies that missing
  maintainer, making [[Maintenance cost]] negligible.
- The closer technical ancestor for "connections as first-class content" is the interlinked
  page graph — in this instance, the `[[wikilink]]` structure and Obsidian's graph view
  ([[Obsidian]]).

## Relations

- Historical framing for [[Compiled knowledge]].
- Contrasts with [[Query-time retrieval]], which has no persistent trail object at all.
- The wiki's links are the trails; orphans are broken trails ([[Ingest, query and lint]]).

## Tensions

- The analogy flatters the pattern: Bush imagined a machine with microfilm and a desk, and
  the hard part he identified was economic and social, not merely mechanical. An LLM makes
  trail-building cheap but says nothing about whether the trails are *worth* building.
- "Associative trails" were private and per-reader; a shared wiki blurs whose trails they are
  once several people (or agents) write into one graph.
