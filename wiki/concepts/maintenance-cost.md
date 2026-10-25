---
title: Maintenance cost
type: concept
summary: The bookkeeping burden — cross-references, current summaries, flagged contradictions — that kills human-maintained wikis and which LLMs reduce to near zero.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [knowledge-management, economics]
---

# Maintenance cost

The reason personal wikis die is not reading or thinking. It is bookkeeping: updating
cross-references, keeping summaries current, noticing when new data contradicts old claims,
holding dozens of pages consistent ([[LLM Wiki pattern]]).

## Key claims

- The cost curve is the problem: maintenance grows faster than the value a wiki returns, so
  the rational human abandons it. The wiki does not fail loudly; it drifts and hollows out.
- LLMs change the slope of that curve: they do not get bored, do not forget an edit, and can
  touch 15 pages in one pass ([[LLM Wiki pattern]]).
- Because maintenance is cheap, the wiki can stay current, which is what makes
  [[Compiled knowledge]] worth having at all.
- Division of labour: the human curates sources, directs analysis, asks good questions and
  decides what it means; the agent does everything else ([[LLM Wiki pattern]]).

## Relations

- The economic justification for the whole [[LLM Wiki]] approach.
- Structured by the [[Ingest, query and lint]] workflows, which are where the bookkeeping
  actually happens.
- Relies on the [[Wiki schema]] to make edits consistent enough to be cheap.
- Historical analogue: the unsolved half of the [[Memex]].

## Tensions

- "Near zero" is an estimate about *mechanical* cost. Judgement remains expensive: deciding
  that a contradiction matters, or that a page is stale, is exactly the work an LLM does not
  do reliably.
- Cheap maintenance invites **over-writing**: an agent with no cost constraint can churn pages
  until their history is unreadable. Git history and deliberate, small edits are the counter-
  practice ([[Implementation decisions]]).
- The pattern's economics assume one trusted maintainer. With several agents writing, the
  bookkeeping cost returns as coordination cost (in this repository, the governance gate
  plays that role).
