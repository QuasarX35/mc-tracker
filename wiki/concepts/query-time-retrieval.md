---
title: Query-time retrieval
type: concept
summary: The RAG family of approaches — retrieve relevant chunks per question and generate an answer, accumulating nothing between questions.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [retrieval, architecture]
---

# Query-time retrieval

The dominant pattern for "LLM plus documents": index the raw corpus, retrieve the chunks most
relevant to the current question, and generate an answer from them. NotebookLM, ChatGPT file
uploads and most RAG systems behave this way ([[LLM Wiki pattern]]).

## Key claims

- Every question starts from the raw corpus; the model **rediscovers the knowledge** each
  time. Nothing accrues between questions ([[LLM Wiki pattern]]).
- Cross-document synthesis is the weak case: a question spanning five documents requires the
  retriever to surface fragments from all five in one pass, and the model to piece them
  together correctly, every single time.
- It scales gracefully *down*: no maintenance, no stale pages, no schema. The corpus can be
  replaced wholesale with no bookkeeping.
- It is bounded by retrieval quality rather than by accumulated understanding: if a
  fragment is not retrieved, no amount of prior work helps.

## Relations

- Contrasts with [[Compiled knowledge]]; the comparison is written up in
  [[RAG and LLM Wiki compared]].
- Requires embedding or hybrid search infrastructure; the [[LLM Wiki]] pattern replaces it
  with an index page at moderate scale, and optionally [[qmd]] at larger scale.
- The relevant failure mode: synthesis that is *recomputed* and therefore inconsistent
  between two askings of the same question.

## Tensions

- The pattern's dismissal is partly unfair: retrieval never goes stale, and freshness is a
  real advantage in domains where sources change weekly.
- Hybrid designs are not excluded by the source — it explicitly recommends local hybrid
  search ([[qmd]]) as an *addition* to a wiki once it grows, which means the dichotomy is a
  starting point, not a law.
