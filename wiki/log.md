# Log

Append-only. Newest entries at the bottom. Format: `## [YYYY-MM-DD] <verb> | <subject>`,
then 2–5 lines on what changed. Verbs: `ingest`, `query`, `lint`, `edit`.

## [2026-10-25] ingest | LLM Wiki — a pattern for building personal knowledge bases using LLMs

- Captured the edict verbatim as `raw/sources/2026-10-25-llm-wiki-pattern.md` (immutable).
- Created the summary page [[LLM Wiki pattern]], the standing synthesis [[LLM Wiki]], and
  6 concept pages: [[Compiled knowledge]], [[Query-time retrieval]], [[Maintenance cost]],
  [[Memex]], [[Wiki schema]], [[Ingest, query and lint]].
- Created 4 entity pages: [[Obsidian]], [[qmd]], [[Marp]], [[Dataview]].
- Schema written as [`AGENTS.md`](../AGENTS.md): layout, frontmatter contract, ingest/query/
  lint workflows, tooling.
- Decision recorded: 3-layer layout, wikilinks by title, generated index, sealed raw manifest
  ([[Implementation decisions]]). Questions filed: [[Open questions]].

## [2026-10-25] query | How does a compiled wiki differ from RAG?

- Answered under [[RAG and LLM Wiki compared]] with a 10-dimension table, and filed the page
  back rather than leaving the answer in chat.
- Conclusion recorded that the dichotomy is soft: the pattern re-introduces retrieval
  ([[qmd]]) as a service over the compiled wiki.

## [2026-10-25] lint | first full pass over 15 pages

- `node src/wiki/cli.mjs lint` clean: 15 pages, 146 wikilinks, 0 orphans, 1 sealed source,
  0 malformed log entries.
- Fixed during bring-up, before the pass: `index.md`/`log.md` were being counted as pages;
  the log checker silently ignored headings that did not start with `## [` (so a malformed
  entry was invisible); a unit test wrongly assumed a body edit makes the index stale.
- Environment finding: `node --test` cannot run here — the sandbox denies the child
  processes it spawns (`spawn EPERM`). Test files are run directly instead; recorded in the
  schema (§7).

## [2026-10-25] edit | schema: test invocation, title style, type list

- `AGENTS.md` §7 documents running test files directly and why `node --test` is unusable.
- §8 title-style example and §3 `type` enum cleaned up.

## [2026-10-25] ingest | Minecraft Build Tracker — product + in-game GUI + local-first storage

Triggered by the standing rule in EDICT-0006 (*always update the wiki*), after EDICT-0005 had
shipped without an ingest. Filed two raw sources:
`raw/sources/2026-10-25-minecraft-build-tracker-spec.md` and
`raw/sources/2026-10-25-minecraft-gui-design-system.md` (both sealed).

- New [[Minecraft Build Tracker]] entity page: features, architecture, verification, tensions.
- New concepts: [[In-game GUI design]] (what actually sells the Minecraft look, and the
  contrast compromise) and [[Local-first tracking]] (storage, failure modes, mitigations).
- New synthesis: [[Vanilla GUI over a neon dashboard]] — why explicit direction overrode the
  inherited design system, and what was archived rather than deleted.
- Updated [[LLM Wiki]] to declare both domains, and [[Open questions]] with the enforcement
  gap, sync/icon scope and the mobile-verification caveat.
- Index regenerated; 15 → 19 pages, 1 → 3 sealed sources.

## [2026-10-25] edit | standing rule: every edict updates this wiki

EDICT-0006 amends the constitution: `AGENTS.md` gains §6.5 (end-of-edict ingest), the
state machine gains review item `R9` (a plan that does not say what it will add to the wiki is
rejected), and the ledger records the rule.

## [2026-10-25] edit | how to run the tracker (file:// persistence verified)

Answered "how do I run the app" and turned the answer into a check rather than an assurance:
seeded in one browser run, re-opened in a second, data was read back from `localStorage` with
no error. Added a **Running it** section to [[Local-first tracking]] covering the double-click
path, the `python -m http.server` fallback for browsers that refuse local storage, and the
recovery caveat (no server-side copy exists).

## [2026-10-25] ingest | Minecraft's real item icons (and the licensing rule that shapes them)

Triggered by *"use the actual Minecraft item icons instead"* and the standing rule that every
edict updates the wiki.

- New raw source `raw/sources/2026-10-25-minecraft-asset-provenance.md`: usage-guideline
  reading, jar paths, isometric calibration, animation/tint handling, commit policy.
- New synthesis [[Vanilla assets without redistribution]]: extractor + filename manifest +
  git-ignore + graceful fallback, and why the first attempt (committing the PNGs) was wrong.
- Updated [[Minecraft Build Tracker]]: icon pipeline, provenance, and the three model-only
  items that cannot have flat icons.
- Updated [[In-game GUI design]] (real assets vs drawn ones) and
  [[Local-first tracking]] (icons are generated locally, absence is survivable).
- [[LLM Wiki]] overview now names the asset policy alongside the product and storage notes.
- 53 icons; 4 sealed raw sources; index regenerated.

## [2026-10-25] edit | mechanical wiki upkeep: the edict-sync rule (EDICT-0008)

Resolved the open question about enforcing ingest mechanically, and proved it on this
repository rather than on fixtures.

- New `lint` rule `edict-sync`: every edict whose latest `S6` record is after the baseline in
  `docs/governance/wiki-sync.json` must be cited by an `ingest`/`edit` log entry dated on or
  after completion. Prefix-mentions and `query`/`lint` entries do not count.
- New `node src/wiki/cli.mjs sync` prints `OK`/`MISS` per completion.
- Proof: with this edict's ledger records appended but no wiki entry yet, `lint` failed with
  `edict-sync ... EDICT-0008 reached S6 at ledger seq 89 but no wiki log entry`; after this
  entry, both `lint` and `sync` pass.
- Updated [[Wiki schema]] (mechanical enforcement section), [[LLM Wiki]] (the rule is no longer
  a promise) and [[Open questions]] (item resolved, with the remaining quality gap stated).

## [2026-10-25] ingest | comprehensive UI QA, enforced on every app change (EDICT-0009)

The QA ministry now tests the whole app in a real browser, and cannot skip it after an app
change.

- Harness: `tests/qa/ui/harness.mjs` drives real Chrome over the DevTools Protocol using
  Node's built-in WebSocket — no packages, works offline, throwaway profile.
- Suite: `tests/qa/ui.e2e.test.mjs`, 27 cases covering every flow, failure path,
  accessibility expectation, responsive breakpoint and the visual contract; zero console
  errors tolerated. Evidence screenshots regenerate on each run.
- Enforcement: `scripts/app-qa.mjs run` stamps per-file SHA-256 of the app sources only after
  a green run; `lint`'s `app-qa-stamp` rule fails when they drift. Proven red-before-stamp,
  green-after on this repository.
- New synthesis [[Testing a UI like a user]] records the approach, its independence caveat and
  the headless-only limits.
- Updated [[Minecraft Build Tracker]] verification entry and [[Open questions]] (mobile now
  emulated properly; QA independence flagged).
