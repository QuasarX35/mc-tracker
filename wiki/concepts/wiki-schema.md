---
title: Wiki schema
type: concept
summary: The configuration document (here AGENTS.md) that fixes a wiki's structure, conventions and workflows, turning a generic model into a disciplined maintainer.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [configuration, conventions]
---

# Wiki schema

The third layer of the [[LLM Wiki]] architecture: a document — `CLAUDE.md`, `AGENTS.md` or
similar — that tells the agent how the wiki is organised, what the conventions are, and which
workflows to follow when ingesting, answering or linting ([[LLM Wiki pattern]]).

## Key claims

- It is what separates a *maintainer* from a generic chatbot. Without it, every session
  reinvents conventions and produces inconsistent pages.
- It is **co-evolved**: you and the agent revise it as you discover what works for the domain
  ([[LLM Wiki pattern]]).
- It should encode the non-obvious rules — where pages live, what frontmatter is required,
  what counts as an ingest, when to escalate — because those are the rules a fresh session
  cannot infer from the corpus.
- In this repository the schema is [`AGENTS.md`](../../AGENTS.md); it also carries the
  governance mapping (who writes what) so a fresh agent inherits both conventions and
  authority.

## Relations

- Load-bearing for [[Compiled knowledge]]: a consistent page shape is what makes compilation
  cheap and retrieval-by-index workable.
- Expressed in practice by [[Ingest, query and lint]]; the schema is the written form of those
  workflows.
- Depends on [[Maintenance cost]] being low, because a schema that is expensive to follow gets
  ignored.
- Machine-checkable parts are enforced by the local tooling (see [[Implementation decisions]]).

## Tensions

- The source gives no guidance on *how* to co-evolve a schema without it becoming a
  dumping-ground of accumulated anecdotes. This instance's rule is that every schema change
  must be paired with a tool check or a concrete workflow step, otherwise it is prose.
- A schema can drift from reality: rules are added, practice diverges, nobody notices. Lint
  covers the mechanical half; the rest is judgement ([[Ingest, query and lint]]).
