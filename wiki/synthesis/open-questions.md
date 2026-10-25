---
title: Open questions
type: synthesis
summary: What this wiki still does not know or has not decided — lint findings, untested claims from the source, and next sources worth ingesting.
updated: 2026-10-25
sources: [2026-10-25-llm-wiki-pattern]
tags: [open-questions, lint]
---

# Open questions

Filed by the agent during ingest and lint ([[Ingest, query and lint]]). Each item is a
question that a future source or a future session could close.

## Untested claims from the first source

- `index.md` is claimed to work "surprisingly well at moderate scale (~100 sources,
  ~hundreds of pages)" — no evidence given. **Test**: instrument `search` vs index-only
  navigation and record miss rates as the corpus grows ([[LLM Wiki pattern]]).
- "Maintenance cost is near zero" measures *mechanical* work only; the judgement cost is
  unmeasured and plausibly dominant ([[Maintenance cost]]).
- Compiled answers are claimed to be better for synthesis, with no accuracy comparison
  against retrieval ([[RAG and LLM Wiki compared]]).

## Undecided in this instance

- ~~**Is "always update the wiki" enforceable, or merely promised?**~~ **Resolved by
  EDICT-0008.** The `edict-sync` lint rule now reads the governance ledger, takes every edict
  that reached `S6` after the enforcement baseline, and requires an `ingest`/`edit` log entry
  dated on or after completion that cites the edict id. `node src/wiki/cli.mjs sync` explains
  the mapping. Remaining gap: a session could still write a token entry that cites the edict
  without doing real work — lint proves presence, not quality ([[Wiki schema]]).
- **Tracker: sync or no sync.** [[Local-first tracking]] refuses accounts and servers; two
  players must exchange JSON. Whether that stays acceptable depends on real use.
- **Tracker: icon coverage.** 18 item icons with a lettered fallback; expanding to a full block
  list is mechanical but large. Where is the line?
- **Tracker: is the archive worth keeping?** `legacy/superseded-dashboard/` preserves the v1
  design and its audit; it also doubles the design narrative in the repo
  ([[Vanilla GUI over a neon dashboard]]).
- **Mobile verification.** 390 px was checked in an iframe harness, not a real narrow window
  (headless Chrome's ~500 px minimum). A real device check has not happened.
- **Corpus domain.** The wiki now covers its own pattern plus one product. A third domain
  (reading, research, team knowledge) would test whether the page taxonomy holds
  ([[Implementation decisions]] D1).
- **Contradiction protocol.** The rule "record both claims, dated" exists in the schema, but
  no page has yet been through a real contradiction. The first one should be treated as a
  test of the rule ([[Wiki schema]]).
- **Multi-writer authority.** Several offices can write under governance; the wiki assumes a
  single maintainer voice. Unowned: who arbitrates when two ingests disagree
  ([[Maintenance cost]]).
- **Query→page promotion threshold.** When is an answer worth filing? "More than chat" is not
  a criterion. Candidate rule: file if it contains a comparison, a decision, or a connection
  not present on any existing page ([[Ingest, query and lint]]).

## Next sources worth looking for

- Vannevar Bush, *As We May Think* (1945) — primary text for [[Memex]].
- qmd's own documentation — to evaluate whether it beats the in-repo `search` ([[qmd]]).
- Obsidian's official docs on Web Clipper and attachment handling — to make the image
  pipeline concrete ([[Obsidian]]).
- A critique of LLM-maintained knowledge bases, if one exists — the first source is an
  advocacy document with no counter-argument in the corpus ([[LLM Wiki pattern]]).

## Relations

- Fed by [[Ingest, query and lint]]; recorded as part of [[Implementation decisions]].
- Reported to the Emperor at the end of every lint pass ([[LLM Wiki]]).
