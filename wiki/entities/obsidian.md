---
title: Obsidian
type: entity
summary: Local markdown knowledge-base app used as the human-facing IDE for this wiki — graph view, wikilinks, plugins, Web Clipper.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [tooling, editor]
---

# Obsidian

A local-first markdown application. In the [[LLM Wiki]] pattern it is the **human's** window
into the wiki: the agent edits files on disk, Obsidian renders them live — follow links, check
the graph, read the updated page ([[LLM Wiki pattern]]).

## What it contributes

- **Wikilinks and backlinks** — the `[[Page Title]]` link convention this wiki uses is
  Obsidian's native link syntax, which is why page titles are the link targets.
- **Graph view** — the best way to see the shape of the wiki: hubs, clusters, orphans
  ([[Ingest, query and lint]]).
- **Obsidian Web Clipper** — browser extension that converts a web article to markdown, the
  fastest route from "found a source" to `raw/sources/`.
- **Attachment management** — set *Files and links → Attachment folder path* to `raw/assets/`,
  then bind *Download attachments for current file* to a hotkey: clipped articles get their
  images stored locally instead of as fragile remote URLs.
- Plugin ecosystem: [[Dataview]] for frontmatter queries, [[Marp]] for slide decks.

## Relations

- The "IDE" in the pattern's analogy: Obsidian is the IDE, the LLM is the programmer, the
  wiki is the codebase ([[LLM Wiki pattern]]).
- Pairs with [[qmd]] when the corpus outgrows `index.md`.
- Cosmology of the pattern's recommended human-side tooling ([[Implementation decisions]]).

## Tensions

- The pattern notes LLMs cannot read a markdown file *and* its inline images in one pass; the
  workaround is text first, then images separately. That is a real friction point for
  image-heavy sources, and this instance currently has no image pipeline.
- Obsidian is optional: the wiki is plain markdown, readable without it. Depending on the app
  would violate the "the wiki is the artifact, the tool is the window" split.

## Source note

All claims on this page come from [[LLM Wiki pattern]]; no independent evaluation of Obsidian
has been performed in this repository.
