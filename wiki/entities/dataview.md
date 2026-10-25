---
title: Dataview
type: entity
summary: Obsidian plugin that queries YAML frontmatter to generate dynamic tables and lists across wiki pages.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [tooling, metadata]
---

# Dataview

An Obsidian plugin that runs queries over page frontmatter and renders dynamic tables and
lists ([[LLM Wiki pattern]]). It turns structured metadata into views without writing prose.

## What it changes

- It gives the wiki a *second* reader: besides the agent reading pages, Dataview can answer
  "which pages are stale?", "which sources are tagged `security`?" directly from frontmatter.
- It makes frontmatter discipline pay off twice — once for the agent's tooling, once for the
  human's dashboards — which is why this repository treats frontmatter as required
  ([[Wiki schema]]).

## Relations

- Human-side complement to the local `stats`/`lint` commands ([[Implementation decisions]]);
  both read the same frontmatter contract.
- Works with the generated `index.md` rather than replacing it ([[Wiki schema]]).
- Sits with [[Obsidian]] and [[Marp]] in the optional tooling layer.

## Tensions

- Dataview queries live inside Obsidian; they are invisible to the agent and to git diffs.
  A dashboard that exists only in the app is a second, undocumented source of truth.
- Frontmatter drift breaks Dataview silently — one missing `updated` field and a query
  quietly omits a page. The linter exists partly to prevent exactly that
  ([[Ingest, query and lint]]).
