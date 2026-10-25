---
title: Marp
type: entity
summary: Markdown-based slide-deck format with an Obsidian plugin, used to turn wiki content into presentations.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [tooling, output]
---

# Marp

A markdown-based presentation format: slides are written as markdown, so any page's content
can become a deck without leaving the wiki's source format ([[LLM Wiki pattern]]).

## Why it matters for a wiki

- The pattern lists deck as one **answer format** for a query: a comparison table, a Marp
  deck, a chart, a canvas are all legitimate outputs of the same underlying pages
  ([[Ingest, query and lint]]).
- Keeping answers in markdown means they can be filed back into the wiki and remain
  diffable, rather than living in a binary deck nobody can review.

## Relations

- Output-side companion to [[Obsidian]] (plugin) and [[Dataview]] (data-side).
- Part of the optional tooling layer of the [[LLM Wiki]], not of its architecture.
- This instance ships no deck output yet ([[Implementation decisions]]).

## Tensions

- Slides invite summary loss: compressing a page into bullets is where nuance and the
  recorded contradictions disappear. If a deck is generated, its source page should stay the
  authority.
- Not evaluated here; claim is the source's ([[LLM Wiki pattern]]).
