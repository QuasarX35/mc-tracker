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

## [2026-10-25] ingest | identity avatars + the real menu panorama backdrop (EDICT-0010)

The tracker gained the two things that make it feel personal and atmospheric, without shipping
a single Mojang pixel.

- New raw source `raw/sources/2026-10-25-minecraft-panorama-provenance.md`: the decoy discovery
  (jar panorama files are 1×1; real 1024×1024 faces live behind the asset index), the composition
  and blur spec, the identity-image caps, and the licensing/fallback rules.
- New synthesis [[Atmosphere and identity without shipping assets]]: extractor + runtime probe +
  measurable "menu-like" properties; identity as item icon or inline uploaded image.
- Updated [[Minecraft Build Tracker]] (Identity + Atmosphere sections, new verification numbers:
  24 unit, 24 acceptance, 65 audit, 36 browser flows), [[In-game GUI design]] (panorama
  treatment), [[Local-first tracking]] (upload storage economics) and [[Open questions]]
  (storage economics, taste, physical device).
- Evidence: `reports/qa/evidence/edict-0010/` (5 screenshots); QA found and the cycle fixed a
  black-letterbox backdrop, an Escape keyboard trap in the picker, and a silently-failing upload
  harness.

## [2026-10-25] ingest | high-resolution item icons (EDICT-0011)

All 53 item icons became the game's own 256×256 inventory renders instead of the hand-composited
16×16 textures.

- New raw source `raw/sources/2026-10-25-minecraft-icon-render-provenance.md`: the local
  IconExporter export (1614 renders at 256×256, 2025-05-06, NeoForge 1.21.4, exporter 1.3.1),
  why copying the game's render beats re-compositing textures, the smooth-downscale display
  policy, and the labelled 16×16 jar fallback.
- Updated [[Minecraft Build Tracker]] (Icons + Verification + Tensions), [[In-game GUI design]]
  (render-based icons, the scoped smooth-downscale exception), [[Vanilla assets without
  redistribution]] ("source choice is part of fidelity"; model-only items are excluded by
  curation, not impossibility), [[Atmosphere and identity without shipping assets]] and
  [[Open questions]] (icon coverage, fidelity vs. pixel purity).
- Extractor: `scripts/mc-icons.py` now auto-detects the export, validates and copies renders
  byte-for-byte, and records `mode`/`pixels`/`source`/`sha256` in the manifest; the jar path
  survives as `jar-fallback`.
- App: item icons render with `image-rendering: auto` (256 px source), tiled textures keep
  `pixelated`; the visual-contract case asserts natural size 256 and smooth rendering.
- Verification: 24 unit, 31 acceptance (7 new high-resolution cases authored by 测试部),
  70 audit, 36 browser flows, app-qa restamped; zero game pixels tracked. Wiki: 22 pages,
  6 sealed raw sources.
- QA: a separate 测试部 teammate authored and ran the independent resolution suite and filed
  `QA_PASS` cycle 1 (161/161 cases; 53/53 renders byte-identical to the owner's export). All
  findings minor: verifier zoom-capture tooling (fixed), the accepted refresh of the hardcoded
  EDICT-0009 evidence screenshots, and two documentation figures corrected after the verdict.

## [2026-10-25] edit | icon brightness: fixing the IconExporter dark 3D renders (EDICT-0012)

The icons added in EDICT-0011 looked dark. Nothing in the app filtered them — the darkening was
baked into the exported PNGs for 3D models only.

- Diagnosis: flat sprites were still byte-identical to the game, while full-cube renders sat at
  0.62 / 0.47 / 0.46 of the texture brightness instead of vanilla's 0.99 / 0.65 / 0.40.
  IconExporter 1.3.1 scales the icon pose non-uniformly, which squashes the vertex normals and
  flattens Minecraft's GUI diffuse lighting (CyclopsMC/IconExporter PR #41; the fix exists only
  on an unreleased branch, and no 1.21.4 release contains it).
- New raw source `raw/sources/2026-10-25-iconexporter-dark-light-bug.md`: the cause, the
  upstream measurement table, the unreleased fix, and the compensation's calibration and limits.
- `scripts/mc-icons.py` now derives the three cube face masks from the export silhouette and
  applies a per-face gain calibrated against the client jar (measured 0.6227 / 0.4738 / 0.4569 →
  gains ×1.5898 / ×1.3720 / ×0.8755; 3D props get the area-weighted ×1.2565; flat sprites stay
  byte-identical). The manifest records the correction and a per-icon `lighting` mode,
  `PROVENANCE.md` documents it, and the 16×16 jar fallback now shades with the same vanilla
  ratios.
- Updated [[Minecraft Build Tracker]] (Icons + verification + tension), [[In-game GUI design]]
  (the reference-measurement lesson), [[Vanilla assets without redistribution]] ("a correct
  source can still be wrong") and [[Open questions]] (drop the compensation when upstream
  ships).
- Verification: corrected face medians 0.991 / 0.651 / 0.403 vs targets; 11/11 flat sprites
  byte-identical; 24 unit / 31 acceptance / 72 audit / 36 browser flows; app-qa stamp still
  verified because no app source changed. Evidence: `reports/qa/evidence/edict-0012/`.
- QA: a separate 测试部 teammate rebuilt the face masks from each PNG's alpha silhouette,
  measured against textures resolved from the client jar's own block models, and filed
  `QA_PASS` cycle 1 — 292/292 independent checks, corrected medians 0.9901 / 0.6509 / 0.4010 vs
  targets, raw export 0.6228 / 0.4745 / 0.4571 (the bug reproduced), 11/11 flat sprites
  byte-identical, 42/42 3D icons corrected with alpha preserved. Notes only: the brightest
  top faces overshoot by up to +0.048, and emissive prop cores clip in 8-bit (torch 20 %,
  lantern 32 %) — both inherent to an offline compensation.

## [2026-10-25] ingest | EDICT-0013 — interaction pass, the whole item export, and a clearer title screen

The ten-item report changed the app's controls, its typeface, its icon set and its backdrop.

- Font: the UI face is now `src/assets/fonts/Minecraft.ttf` (Craftron Gaming via DaFont,
  "100% Free"), 110 glyphs page vs 107 `cmap`, U+20AC present, arrows/dashes/ellipsis/×/·/≥/≤
  absent — Pixelify Sans stays bundled as the fallback. Licence sealed as
  `raw/sources/2026-10-25-minecraft-font-licence.md`; `src/assets/fonts/Minecraft-LICENCE.md`
  ships with the binary.
- Catalog: 53 curated → **1,368** addressable icons from 1,609 export renders (1,363 plain +
  5 representatives of 246 variants; 241 `collapsed_variants`), curated first, stack table
  1,136×64 / 46×16 / 186×1; brightness classification preserved block 407 / flat 620 /
  `3d-other` 341 — `hopper` jar-flat, `anvil`/`chest` 3d-other, five flat-pixel mismatches
  disclosed.
- Detail controls: inline title rename (`#build-rename`/`#build-name-save`/`#build-name-cancel`),
  `#copy-coords`, notes view/edit (`#notes-text`/`#notes-edit`/`#build-notes`), six
  `button.mat-step` per material with `data-stack`; one picker dialog with footer upload and a
  pick-item mode for `#mat-choice`.
- Themed native select: `@supports (appearance: base-select)` + `::picker(select)` (panel
  `rgb(111, 111, 111)`, 2 px black border, Minecraft face) on Chrome 155; other browsers keep
  the OS popup.
- Backdrop: bake radius 8 → 2.5 (0–3 guard), CSS 2 → 1 px (1.5 px ≤640 px), scrim 0.12 → 0.2;
  `backdrop.webp` 15,280 → 45,664 B, edge-variance 1,132.6 → 1,379.9.
- Updated [[Minecraft Build Tracker]], [[In-game GUI design]],
  [[Atmosphere and identity without shipping assets]], [[Vanilla assets without redistribution]],
  [[Testing a UI like a user]], [[Open questions]] (icon coverage and menu atmosphere closed;
  the physical comparison is now its own entry), [[LLM Wiki]]; design-system `MASTER.md` and
  `pages/tracker.md`; `README.md`.
- Verification: 22 + 9 unit, 71 acceptance (7 suites + `edict-0013-assets` 11), 138/138 audit,
  49/49 browser flows under the Lead's hands, app-qa restamped `2026-10-25T10:02:35Z` covering
  8 hashed files (app sources + font + panorama WebP + manifest); evidence
  `reports/qa/evidence/edict-0013/` (27 files, 22 distinct PNGs). Chrome cannot start in the DSH
  verifier sandbox, so 测试部 authored and analysed while the Lead executed — disclosed.

## [2026-10-25] ingest | EDICT-0014 — friction pass: seamless scenery, paging, tooltips, empty states, bulk paste, undo, recents, suggestion

- Scenery: six resolved panorama inputs, four side faces stitched with a wrap crossfade; bake
  8 → **2.0**, strip **2,560×640** (55,096 B, sha256 `331253bd…bf1a5`); two `.backdrop__layer`
  copies translated −50 % over **180 s** (`backdrop-translate`) replace the 120 s ping-pong;
  reduced motion `none`; dirt fallback kept.
- Picker: all **1,368** items reachable in 120-tile append batches (`#icon-sentinel`), no render
  cap; count hint `showing N of 1368 — scroll for more`; names wrap in tiles/rows/chip; recent
  picks lead; one top-layer `#mc-tooltip`; five empty states with working controls
  (`#detail-empty-action`, `#btn-empty-create-world`, `#btn-empty-pick-material`,
  `#btn-empty-reset-filter`, `#btn-first-build`).
- Steppers: labels resolve to the stack size (`+64` / `+16`), stack-1 items get four buttons,
  `data-step` keeps the shipped `+stack` literal while `data-mat-step` carries the resolved
  amount. Bulk paste (`#bulk-paste` → `#bulk-dialog`) 4 matched + 3 unknown; undo restores a
  deep-equal snapshot for 6 s; `suggestIcon` (38 frozen-fixture cases) display-only via
  `iconAuto`; recents in `mc-build-tracker:recent`.
- Updated [[Minecraft Build Tracker]], [[In-game GUI design]],
  [[Atmosphere and identity without shipping assets]], [[Vanilla assets without redistribution]],
  [[Testing a UI like a user]], [[Open questions]] (new entries: suggestion coverage, scroll-only
  paging, bulk partial adds, single-level undo, e2e evidence folder); design-system `MASTER.md`
  and `pages/tracker.md`; `README.md`.
- Verification: **98** unit (22 model + 9 identity + 38 suggestion + 9 app-qa + 20 wiki), **85**
  acceptance (17 + 8 + 7 + 11 + 14 + 7 + 13 + 8), **147/147** audit, **66/66** browser flows,
  stamp `app-qa: verified — 2026-10-25T12:27:45.271Z` over 8 hashed files; evidence
  `reports/qa/evidence/edict-0014/` (20 PNGs with distinct hashes + `probe.json` + README +
  `panorama-tile-proof.png`). Chrome cannot start in the DSH verifier sandbox, so the Lead seat
  ran every launch and 测试部 authored/analysed/judged — disclosed.

## [2026-10-25] ingest | EDICT-0015 — layout pass: rotation fix, status ordering, header stats, custom materials, chooser-free import

- Scenery: diagnosed the still-static background (this machine reports
  `prefers-reduced-motion: reduce`, and the strip was drawn at 50 % × 100 % instead of its 4:1
  aspect). Replaced the two-copy 180 s loop with **one** `.backdrop__layer` 800vh wide over
  `background-size: 400vh auto`, translated −50 % over **120 s**; `#backdrop-pause` is the WCAG
  control, `mc-build-tracker:motion` persists the choice, reduce defaults to paused with the frame
  painted and never `animation: none`; the global reduce reset excludes the layer. Strip stays
  2,560×640, 55,096 B, sha256 `331253bd…bf1a5`.
- Layout: build list ranks **Building → Planned → Done**, stable within a rank by registry order,
  never by completion ratio; `#world-summary` retired in favour of `#world-meta` identity,
  derived `#world-progress` (`"X% gathered"`), `#world-remaining` with thousands separators and
  `#world-bar` (10 px) > `#world-fill` (6 px) with ARIA 0/100/now, hidden with no world or a
  zero-total `needed`; compact density meets **900 px desktop / 1,423 px mobile** (threshold
  1,500) on the injected 4-build/6-material fixture, with pairwise label↔control alignment at
  1280×900 and 390×844.
- Materials: custom items at build/world/account scope, id `custom:<slug>`, nearest scope wins,
  name 1–60, stack 1–999, icon catalogue-or-upload, immutable
  `M.createCustomItem(state, world, build, target, spec)` → `{ state, entry } | { error }`,
  four frozen errors, `custom` badge, name-on-input/icon-on-save, `SCHEMA = 1` so v1 backups
  import with empty registries; the add form gains a three-step strip (`+1/+10/+stack`, hidden
  until an item is chosen); the import dialog uses `accept=".json"` (the extension-token fix),
  drop, paste, a backup list and inline errors.
- Updated [[Minecraft Build Tracker]], [[In-game GUI design]], [[Local-first tracking]],
  [[Atmosphere and identity without shipping assets]], [[Testing a UI like a user]],
  [[Open questions]] and the standing synthesis; created [[Material registry]] and
  [[Status-ranked build ordering]]; design-system `MASTER.md`; `README.md`; referenced the two
  `docs/backlog/` research files.
- Verification: **109** unit, **96** acceptance, **187/187** audit, **80/80** browser flows,
  stamp `app-qa: verified — 2026-10-25T14:39:07.404Z` over 8 hashed files; evidence
  `reports/qa/evidence/edict-0015/` (30 artefacts + README + `probe.json`). Disclosed: the Lead
  seat was the browser hands (Chrome cannot start in the DSH verifier sandbox); the first green
  was withdrawn after the Lead's containment measurement found `.materials` outside the detail
  panel; R7 inverted EDICT-0014's reduce rule (reduce now excludes the scenery rather than
  freezing it); the e2e suite still has no output-directory argument.

## [2026-10-26] ingest | EDICT-0016 withdrawn; game-icon coverage research

- Recorded the withdrawal of EDICT-0016, the fourteen-item visual-density and compact-view
  round, before S5: the founder withdrew it in full, every `src/` change was discarded, the
  tree returned to `e1308d6`, and `app-qa` re-verified at 80 cases
  (`2026-10-26T01:58:43.177Z`). The discarded work is archived outside the repository; no
  tests, fixtures or evidence from the round remain.
- Updated [[Minecraft Build Tracker]] with a withdrawal note and the remaining icon-coverage
  pointer, and [[Open questions]] with the reopened density/readability question and the
  remaining icon-coverage question.
- Referenced `docs/backlog/game-icons.md` (research note: 1,368 icons, twelve hidden or stateful
  1.21.4 items plus collapsed variant states; registry-driven extractor and coverage gate).
- Design system and `README.md` unchanged: nothing in this round shipped.

## [2026-10-26] edit | EDICT-0016 reinstated

- The founder reversed the withdrawal and chose the fourteen-item round exactly as built. The
  archived tree was restored from `stash@{0}` (`67285ab`), byte-identical to the audited round:
  suite 96/96, stamp `app-qa: verified — 2026-10-26T02:59:39.552Z` (96 UI cases), audit 186/186,
  `npm test` 120 cases. The original `QA_PASS, cycle 1` stands; no second verdict.
- Updated [[Minecraft Build Tracker]] (reinstated outcome: enlarged type scale, stepper, notes
  presentation, timestamps, world sidebar, aligned rules, compact builds view) and
  [[Open questions]] (density/readability decided enlarged). Ledger seq 170 records the
  reinstatement next to the retained WITHDRAWN row (seq 169).
- The S6 R9 documentation pass is still outstanding: `design-system/minecraft-tracker/MASTER.md`,
  `pages/tracker.md` and `README.md` were never updated during the round (they still describe
  EDICT-0015), and the three concept pages planned in EDICT-0016 §5 do not exist yet.

## [2026-10-26] edit | EDICT-0016 R9 docs pass — stepper, compact view, world sidebar

- `design-system/minecraft-tracker/MASTER.md` — type scale is now the one 18 px knob
  (body 18 / muted 17 / meta 15 / tiny 13; nothing reads 16), one `.stepper` component replaces
  the six-button strip and every `data-step`, notes view/edit and its label-row controls are
  documented, plus created/updated ISO stamps, the left world sidebar, the shared 44 px
  section-head box, and the compact view/card/tile with its quick-update dialog. Never list
  untouched; checklist now asserts `npm test` 120, audit 186, browser 96 at stamp
  `2026-10-26T02:59:39.552Z`.
- `README.md` — feature list names the stepper (Shift = stack, Ctrl/⌘ = 16), the world sidebar,
  created/updated timestamps, the notes view/edit behaviour and the Standard/Compact switch; the
  960 px desktop / 1,700 px mobile budgets replace the pre-round figures, and the checks line
  moves to 120 test cases, 186 audit cases and 96 browser flows.
- Created [[Number stepper]], [[Compact view]] and [[World sidebar]] (frontmatter, `sources: []`,
  inbound links from [[Minecraft Build Tracker]] and between each other); [[Open questions]]
  records compact phase 2 as deferred with its backlog split.
- `wiki/index.md` regenerated (27 pages); `lint` clean, 27 pages; `sync` 9/9 once ledger seq 171
  records this pass.

## [2026-10-26] ingest | EDICT-0017 R9 docs pass — shared inventory, allocation, corrected row

- `design-system/minecraft-tracker/MASTER.md` — the component table now carries the world
  inventory and its allocation (one `world.inventory`, computed In/Left/Surplus, `shared with N
  builds`), the eight-cell material row (Needed as the one text cell; Got/In/Left/Surplus read
  only; Update and row menu), the `#inventory-dialog` with absolute-or-delta syntax and Undo, the
  paste preview (`#paste-preview`, `#paste-ok`), the toolbar (sort, hide-done, table/grid), the
  remaining-first compact matrix opening the same dialog, the sidebar progress/units/inactive
  modes with its 56 px rail, UTC stamp text with ISO `title`/`data-iso`, schema 2 with the
  one-time migration, and the 1,232/1,240 px frame; `.stepper`, `#bulk-dialog`, `#tile-*`,
  `#world-remaining` and the 264 px cap are recorded as retired.
- `design-system/minecraft-tracker/pages/tracker.md` — the same behaviour as rules 7–8, 15 and
  19–21 plus new 23–27; AC-1/2, 12, 18 and 21–23 rewritten and AC-25–28 added for allocation, the
  dialog, migration and preferences; the EDICT-0016 verification record is marked superseded and
  points at the EDICT-0017 S5 record.
- `README.md` — capabilities and honesty updated: one world inventory with positional allocation,
  the Needed cell plus the Update dialog (`+64` / `-32` / `2s` / `2s+10`), drag order and pause
  modes, the 1,232 px screen, compact tiles opening the shared dialog, schema 2 and the migration,
  `tests/unit/tracker-0017.test.mjs`, and the stamp/S5 status.
- Created [[Shared inventory]] (`type: concept`, `sources: []`) — the v2 model, allocation in
  build order, surplus/shared semantics, the case-insensitive migration sum, the retired
  per-build `collected` counter and stepper model, and the tensions that remain.
- Updated [[Minecraft Build Tracker]] (what it does, the material row and the sidebar, a
  "shared-inventory round" section, verification marked superseded/pending S5, new tensions) and
  [[Open questions]] (positional allocation, one-way migration, unattributed inventory writes,
  display-only units, two stale concept pages, the `mbt.density`/`mbt.hideDone` drift and the
  height-cap question).
- `wiki/index.md` was not regenerated and `lint` was not run here: the app-qa stamp still covers
  the pre-0017 sources, so lint fails for an unrelated reason. The Lead runs index, lint and the
  S5 record.

## [2026-10-26] edit | EDICT-0017 S5 verification — 128 browser cases, evidence crate, stamp

- `reports/qa/edict-0017-qa.md` created: QA_PASS cycle 1 (ledger seq 178), pinned sha256 for
  `src/app.js` / `src/index.html` / `src/styles.css` / `src/tracker/model.js` and the suites,
  environment, reproducible commands, AC1–AC22 → case traceability, G1–G5 accounting, and the
  disclosed deviations (Lead as browser hands, case amendments, `#unit-label` ruling,
  focus-within stand-in for hover).
- `reports/qa/evidence/edict-0017/` created: 14 §3.5 captures, seven matching suite shots,
  `README.md` and `probe.json` (measured desktop geometry 1232/200/360/646, dialog context, the
  `+385 surplus` row, shopping rows, 56 px rail, unit renderings, paste preview, drag
  before/after, retired-id probes). Captured 2026-10-26T06:35:22.694Z, before the stamp at
  06:37:19.750Z, so every artefact postdates the last source change.
- Verification: browser 128/128, audit 186/186, `npm test` 152/152 (12 suites), app-qa stamp
  `cases 128`; `lint` clean at 28 pages, `sync` 9/9, `index --check` up to date.
- Updated [[Minecraft Build Tracker]] verdict wording from "pending S5" to the passed stamp and
  [[Open questions]] to drop the now-answered height-cap question, keeping the positional
  allocation, one-way migration and unattributed-write caveats.
- EDICT-0017 header status is `S5Q QA_VERIFY`; ledger rows 172–178 carry S0–S5Q.

## [2026-10-26] edit | EDICT-0018 — the 33-item polish round

- Recorded `docs/governance/EDICT-0018.md`: the founder's 33 defects grouped as drag/priority,
  compact, view controls, columns/progress, layout, build list/header, dialog and verification; the
  changes per file; the deliberate limits (no independent verifier this round, keyboard reorder not
  drivable through CDP `press`).
- Build list is now the priority order itself (registry order = allocation order), with a rank
  badge, painted fill bar, hover Edit/Activate/Delete, `Alt+↑/↓` reordering and a drop indicator.
- Material columns read `Needed | In world | Allocated | Left | Surplus` with an always-present
  dash, a dimmed done row plus check, a plain-text Needed cell that becomes an input on click and an
  icon Update button; one `pctOf`/progress helper feeds every panel.
- Compact tiles carry the total need above the remaining count, dim when done and sort last; the
  Table|Grid toggle genuinely swaps (a stray `[hidden]` override removed) and Hide completed is a
  real checkbox that filters both views.
- Layout: the shell caps at 1600 px, one-column ladder below 900 px, the collapsed rail loses its
  stray bar, the world select spans the panel, the footer is one line; coords read
  `X 120  Y 64  Z -40`; stamps read "Updated 5 min ago" with the exact UTC time in the tooltip.
- Inventory dialog: icon + item + the builds using it + a live `200 → 264` preview, short
  placeholder, absolute-then-relative commit, Enter confirms, Escape cancels, one Undo.
- Verification: browser 128/128, audit 186/186 (ordering rule restated, 186 kept), `npm test`
  152/152 across 12 suites, app-qa stamped 128 cases at `2026-10-26T08:05:42.834Z`
  (`artifact_hash b667495d1e91c66a…`); evidence crate `reports/qa/evidence/edict-0018/`.
- Updated [[Minecraft Build Tracker]] verification wording and the design-system MASTER rows for
  the material row, compact tile, build-list ordering, inventory dialog, stamps, sidebar progress
  and the 1600 px layout budget; [[Open questions]] keeps the untouched caveats.

## [2026-10-27] edit | publish project repository

- Regenerated [[LLM Wiki]]'s catalogue before publishing the project.
- Prepared the repository for the requested GitHub remote; no product behavior changed.

## [2026-10-27] edit | UI review fixes

- Updated [[Minecraft Build Tracker]] for the requested table units, compact chips/cards, contrast,
  sidebar reflow, empty states, plural labels, checkbox/remove affordances and Materials-tab
  inventory editing; preserved the reviewed allocation, drag/drop, dialog, surplus and Undo paths.
- Expanded the browser verification to cover Items, Stacks, Shulkers and Hide completed in both
  Standard and Compact views; regenerated the app-QA evidence/stamp after the pass.
