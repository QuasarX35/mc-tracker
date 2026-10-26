---
title: Open questions
type: synthesis
summary: What this wiki still does not know or has not decided — lint findings, untested claims from the source, and next sources worth ingesting.
updated: 2026-10-26
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
- ~~**Tracker: icon coverage.**~~ **Resolved by EDICT-0013.** The line is the whole export at
  base-item granularity: **1,368 addressable icons** from 1,609 item renders (1,363 plain + 5
  representatives of 246 component variants; 241 `collapsed_variants`), curated 53 first; items
  the export lacks stay lettered. Stack sizes come from a curated table with default 64 (16: egg,
  snowball, ender pearl, honey bottle, armour stand, empty bucket, signs, banners; 1: filled
  buckets, tools, armour, elytra, potions, boats, minecarts, shulker boxes, beds, cakes/stews,
  books, maps, banner patterns, discs). Residual risks have their own entries below
  ([[Vanilla assets without redistribution]]).
- ~~**Tracker: remaining icon coverage.**~~ **Decided 2026-10-26.** The catalogue keeps one
  canonical icon per item; stateful items show their first catalogue icon (water bucket, filled
  map, tipped arrows, banner/shield patterns as the base item), and item states are not exposed
  in the picker. The twelve hidden items stay out unless the game gives them an item form — the
  declared gap. The registry-driven extractor and coverage gate is recommended but not approved:
  awaiting a round ([[Vanilla assets without redistribution]],
  [game-icon coverage note](../../docs/backlog/game-icons.md)).
- **Tracker: icon fidelity vs. pixel purity.** Item icons are 256 px renders downscaled smoothly
  while tiled textures stay nearest-neighbour; nobody has compared the smooth 22 px slots
  against integer-scaled pixel art on a physical HiDPI display. The design contract has a scoped
  exception here — is it the right one? ([[In-game GUI design]])
- **Tracker: remove the icon brightness compensation when upstream ships.** IconExporter PR #41
  fixes the dark 3D renders but is unreleased for 1.21.4; the tracker restores the vanilla face
  ratios offline instead. A future session should re-export with the fixed build, verify the
  0.99 / 0.65 / 0.40 face ratios, and delete the compensation — the compensation itself is a
  documented workaround, not the desired end state
  ([[Vanilla assets without redistribution]]).
- **Tracker: stack-table completeness.** 1,136 icons default to 64, 46 to 16 and 186 to 1.
  The table is curated product data, not derivable from the PNG export; the audit freezes eight
  samples (stone 64, egg 16, bucket 16, `water_bucket` 1, `diamond_sword` 1, potion 1,
  `honey_bottle` 16, `armour_stand` 16), which is a spot check, not proof. An unusual item can
  still get a plausible wrong increment.
- **Tracker: collapsed variants are not pickable.** 246 potion/painting/tipped-arrow/etc. renders
  collapse to 5 representatives (`collapsed_variants` 241) so the catalog stays at base items.
  A user who wants one specific potion or painting variant cannot choose it; whether that matters
  is untested with real use.
- **Tracker: `3d-other` lighting is a judgement call.** 341 of 1,368 icons are classified
  `3d-other` from the jar model chain and lit; `anvil` and `chest` are in it, `hopper` is flat.
  The list is disclosed, but nobody has inspected every one against the game's own inventory
  appearance — a per-icon fidelity check remains open
  ([[Vanilla assets without redistribution]]).
- **Tracker: dropdown theming is Chromium-only.** `appearance: base-select` + `::picker(select)`
  styles the popup on Chrome 155; Firefox and Safari keep the OS popup. If cross-browser identity
  matters more than keeping a native control, a JavaScript listbox is the alternative and it
  costs the platform behaviour the current design deliberately keeps ([[In-game GUI design]]).
- **Tracker: is the archive worth keeping?** `legacy/superseded-dashboard/` preserves the v1
  design and its audit; it also doubles the design narrative in the repo
  ([[Vanilla GUI over a neon dashboard]]).
- **Mobile verification.** Superseded the iframe workaround: the UI suite now overrides the
  viewport through the DevTools Protocol, so 390 px is a real layout. Still no physical device,
  touch input or OS file dialog coverage ([[Testing a UI like a user]]).
- **QA independence is structural, not organisational.** 测试部 normally writes and runs the suite
  it grades. Assertions recompute expectations from the DOM and read only persisted state, but a
  reviewer should treat suite quality as the thing to audit. EDICT-0013 moved the split again: the
  verifier's sandbox could not launch Chrome, so the Lead seat was the browser hands, 测试部
  authored the frozen cases and judged, and the stamp is the execution trace; EDICT-0014 repeated
  the arrangement for 66 cases, with the suggestion fixtures as an independent oracle. EDICT-0015
  repeated it for 80 cases and then withdrew the first PASS when the Lead's containment
  measurement found a defect the suite had missed — the most direct evidence yet that the stamp
  proves execution, not coverage ([[Testing a UI like a user]]).
- **Avatar storage economics.** 128×128 WebP at ≤120 000 chars keeps single images tiny, but the
  point where several uploads start hurting `localStorage` and backup size is untested
  ([[Atmosphere and identity without shipping assets]]).
- ~~**Menu atmosphere is taste.**~~ **Resolved by EDICT-0013, EDICT-0014 and EDICT-0015.** The
  emperor's direction settled it: less blur, more readable backdrop. Bake radius 8 → 2.5 and CSS
  2 → 1 px (1.5 px at ≤640 px), scrim 0.12 → 0.2, edge-variance 1,132.6 → 1,379.9 on the same
  1,280×900 strip (EDICT-0013); EDICT-0014 made the rotation seamless — six resolved inputs, four
  stitched sides, 2,560×640, bake 2.0, 55,096 B. EDICT-0015 then diagnosed why "still not
  rotating" persisted — this machine reports `prefers-reduced-motion: reduce`, and the strip was
  drawn at 50 % × 100 % instead of its 4:1 aspect — and replaced the two copies with one 800vh
  layer drifting over 120 s, a pause control and a default-paused state under reduce. The
  remaining question is the side-by-side comparison below, not the direction
  ([[In-game GUI design]]).
- **Tracker: backdrop side-by-side comparison.** Nobody has yet watched the treatment beside the
  real title screen on a physical display. The numbers bound the change and show the image is
  sharper and the loop seamless; they cannot judge whether it feels right
  ([[In-game GUI design]]).
- **Tracker: suggestion coverage is only as good as its table.** `suggestIcon` ranks a frozen
  keyword table (notes, then world name, name, most-needed material, world icon) and 38 unit
  cases run on 23 frozen builds. Keywords outside the table, irregular item names and builds with
  no signal all fall to `null`; whether users accept a suggested icon that is plausible but wrong
  is untested ([[Minecraft Build Tracker]]).
- **Tracker: paging is scroll-only discovery.** All 1,368 items are reachable by scrolling 120 at
  a time, but there is no letter jump or virtual list; an obscure item depends on search, recents
  or the suggestion. Whether that is enough for real use is unmeasured
  ([[In-game GUI design]]).
- **Tracker: custom items are create-only.** `M.createCustomItem` returns `{ state, entry }` or
  `{ error }`; there is no edit or delete API, no per-build stack override, and no migration for
  free-text materials. The account-level list is a quota liability, and a backup carries whichever
  scopes the exporter wrote, so a recipient cannot tell shared vocabulary from private labels
  ([[Material registry]], [[Local-first tracking]]).
- **Tracker: undo is one level and import has no restore summary.** Round 3 deferred per-row undo
  and a post-import summary/size guard; the dialog makes validation errors visible before
  replacement, but an accidental import still relies on the user having a backup
  ([[Local-first tracking]]).
- **Tracker: dialog keyboard contract and pause-control accessibility are unowned.**
  `#backdrop-pause` passes the obvious checks, but focus trapping, Escape order across stacked
  dialogs and a screen-reader announcement for the paused state are not frozen. The e2e evidence
  folder also still needs an output-directory argument
  ([[Testing a UI like a user]]).
- **Tracker: bulk paste adds only the matched set.** Unknown lines are shown unmatched and are
  not added; the matcher is exact name/slug then a unique ≥3-character prefix, no edit distance.
  A user pasting a misspelled list gets a partial add, and the review rows are the only recovery
  ([[Minecraft Build Tracker]]).
- **Tracker: undo is one level and expires.** Six seconds, invalidated by any later commit; two
  deletions in a row leave only the last restorable. Whether that meets a user's mental model of
  "undo" is untested ([[In-game GUI design]]).
- **Testing: e2e evidence can land in the previous edict's folder.** A few EDICT-0014
  screenshots were written under `reports/qa/evidence/edict-0013/`; the Lead restored those
  artefacts, and EDICT-0015's 30-artefact crate is internally consistent, but the suite still has
  no output-directory argument, so a run's evidence is not guaranteed to be reproducible in one
  place ([[Testing a UI like a user]]).
- **Physical device + real OS motion preference.** Both mobile layout and reduced-motion are
  emulated in headless Chrome, not observed on hardware ([[Testing a UI like a user]]).
- ~~**Tracker: density and readability.**~~ **Decided 2026-10-26: enlarged.** The founder first
  withdrew the larger type scale and compact builds view, then reinstated the built round and
  chose it after seeing both: body 18 / muted 17 / meta 15 / tiny 13, a `−`/`+` stepper with
  resolved stack labels, a world sidebar and a compact builds view. The dense-only alternative
  is retired ([[Minecraft Build Tracker]]).
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

## Decided vs deferred after round 3

EDICT-0015 decided the ten round-3 items (ordering, header stats, alignment, custom materials,
add-form steppers, compact height, import, background). The UX backlog keeps the residue explicit
instead of silently dropping it: rows 9–15 of `docs/backlog/ux.md` hold custom editing/deletion,
the pause-control accessibility review, an import restore summary/size guard, the dialog keyboard
contract, an e2e evidence output folder, per-row undo and an empty-state review.
`docs/backlog/mass-input-research.md` adds twelve ranked mass-input proposals; only bulk paste is
adopted, and the rest stay research ([[Material registry]], [[Status-ranked build ordering]],
[[Testing a UI like a user]]).

EDICT-0016 (the fourteen-item density and compact-view round) was withdrawn and then reinstated
by the founder on 2026-10-26 as built; it now ships, and density/readability is decided enlarged.
Remaining icon coverage was decided on 2026-10-26: one canonical icon per item, hidden items out,
and the coverage gate recommended but awaiting a round; the details are in the
[game-icon coverage note](../../docs/backlog/game-icons.md). Compact-view phase 2 — the global
user inventory and the FRD 4.2 deficit formula, phases/targets, Ascend, crafting/smelting,
crafting procs and the Power toggle — is deferred, not dropped; the split is in
[the phase-2 backlog](../../docs/backlog/compact-view-phase-2.md).

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
