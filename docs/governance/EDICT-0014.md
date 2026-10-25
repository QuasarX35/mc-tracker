# EDICT-0014 — Friction pass: the emperor's second interaction round

- **Issued by:** 皇帝 — 2026-10-25, round 2. The wording quoted in §1 is the S0 brief's
  transcription (`.tmp/plan/brief-0014.md`); this round has no raw source of its own, so the
  EDICT-0013 precedent applies: the sanitised wording is recorded here, in the edict body.
  The brief's own framing: *"the five-link list from round 1 was delivered; these are
  follow-ups."*
- **Drafted and recorded by:** 礼部 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (app UI, `src/tracker/model.js`, unit tests), 工部
  (`scripts/mc-backdrop.py`, `src/assets/panorama/*`), 礼部 (design system, README, wiki),
  测试部 (`S5Q`, delegated verifier). 太子: no raw intake planned for this round.
- **Browser execution:** the Lead runs every Chrome launch at `S5` — "browser hands, not
  verifier"; 测试部 authors the frozen cases, analyses the artefacts, and judges.
- **Recorded:** 2026-10-25 (Asia/Singapore) · **Status:** `S6 REPORTED` — `QA_PASS`, cycle 1;
  stamp `app-qa: verified — 2026-10-25T12:27:45.271Z (66 UI cases)`; see §4.1 and §6
- **Amends:** [EDICT-0013](EDICT-0013.md) — its frozen DOM contract is extended by
  `.tmp/plan/contract-0014.md`, reproduced verbatim in §2. The detail-card, picker and
  stepper surfaces stay frozen except where contract-0014 amends them: empty-state container
  controls, step-button labels and stack-1 omission, and the new `#mc-tooltip`,
  `#icon-sentinel`, `#bulk-*`, `#toast-action` and `#icon-suggest-note` surfaces.
  [EDICT-0010](EDICT-0010.md) — its title-screen panorama record (four side faces,
  2,560 × 640, 120 s ping-pong, blur 2.5) is deliberately amended in its pan and bake: this
  edict keeps the four-side 2,560 × 640 geometry, declares six resolved inputs and ships
  `loop_seconds: 180`, blur ≤ 2.
- **Relates:** [EDICT-0012](EDICT-0012.md) — the icon lighting classification this edict
  preserves. [EDICT-0009](EDICT-0009.md) — the app-qa stamp discipline.

## 1. The report

On 2026-10-25 the emperor filed a second round: eleven request items and one non-regression
floor, kept below in the brief's order and numbering. Items 1–7 are corrections after use,
8 is a new capability, 9–11 are QoL selections, and 12 is the acceptance floor. Each item is
followed by its acceptance sentence; expanded identifiers are the frozen contract's, not the
brief's, and the notes record where the plan resolves something the brief left open.

1. **Rotating 360° scenery.** *"The backdrop must be the game's six panorama faces composed
   into a circular strip that pans continuously in one direction and wraps invisibly
   (`transform` animation over two copies; no ping-pong, no visible seam). Today it is four
   faces ping-ponging `background-position`."*
   **AC1.** The panorama manifest declares `faces: 6` (six resolved inputs
   `panorama_0…5`, each with its sha256), `sides: 4` stitched, `seamless: true`,
   `loop_seconds: 180`, `width: 2560`, `height: 640`, `width === 4 * height` and
   `blur_radius <= 2`; two screenshots taken 1 s apart differ; with
   `prefers-reduced-motion: reduce` the animation is `none`; with the asset missing the
   existing dirt fallback still renders.
   *Plan note:* the sealed raw source records **four side faces** (`panorama_0…3`) and calls
   `panorama_4…5` the top/bottom caps. The Lead's R1 ruling keeps the visual truth: the six
   inputs are resolved and declared, the four sides are stitched, and the caps are recorded
   but not stitched — a horizontal 360° strip cannot stitch caps.

2. **Infinite-scroll item selector.** *"Every one of the 1,368 catalogue items must be
   reachable by scrolling the picker, not just the first 150. Batched rendering (120 per
   batch, sentinel-triggered), search resets to batch 1, last tile reachable without freezing
   the UI."*
   **AC2.** Rendering starts at 120 tiles; scrolling to the end eventually renders all 1,368
   distinct slugs; the last one is interactable; `#icon-count-hint` reports the number
   rendered.

3. **Full item names.** *"No truncation in the picker tiles, material rows or chooser chip;
   names wrap to 2–3 lines and remain fully visible at 1280 and 390."*
   **AC3.** For the longest names in the catalogue, `scrollWidth <= clientWidth + 1` on every
   name node in the picker tile, the material row and the chooser chip at both 1280 px and
   390 px.

4. **Tooltip must not be covered.** *"One shared tooltip surface painted in the top layer
   (inside the open `<dialog>`), viewport-clamped, flips below when there is no room above;
   delete the pseudo-element tooltips that get clipped by `overflow` and painted under later
   siblings."*
   **AC4.** For a picker tile, a material-row slot and a world-dialog slot, `#mc-tooltip` is
   the topmost element at its own rect, fully inside the viewport, and it disappears on
   leaving the slot and on Escape.

5. **A real empty state.** *"With zero worlds / zero builds / zero materials / zero filter
   matches, every view must offer the next action instead of an error toast or a dead
   panel."*
   **AC5.** All five zero states are reachable in a fresh browser, each with its named
   control: `#build-empty` + `#btn-first-build`, `#world-empty` +
   `#btn-empty-create-world`, `#detail-empty` + `#detail-empty-action`, `#material-empty` +
   `#btn-empty-pick-material`, `#world-material-empty` + `#btn-empty-reset-filter`; every
   control works, and none responds only with an error toast.

6. **Stack buttons show the real amount.** *"`+stack`/`-stack` become `+64`/`-64`,
   `+16`/`-16` (the item's resolved vanilla stack size)."*
   **AC6.** A stone-brick material row shows `+64`; an egg or sign row shows `+16`.

7. **No stack buttons for non-stackable items.** *"For the 186 items with stack size 1 the
   two stack buttons are absent from the DOM (not disabled). Four step buttons remain."*
   **AC7.** A water-bucket row has exactly four `.mat-step` buttons and no
   `[data-step$="stack"]`; a stackable row has six.

8. **Context-aware icon suggestion, no AI.** *"A deterministic scoring function proposes an
   icon for a build from its name, notes, coords, world and its material list; it never
   overwrites a manual choice, shows its reason, and is fully unit-tested."*
   **AC8.** A fixed fixture table of at least 20 builds yields stable slugs and reasons; no
   signal yields `null`; a manually chosen icon is never replaced; the picker opened on an
   unsuggested build carries the suggested tile marked and the reason note.
   *Plan note:* the contract freezes the two-argument call `M.suggestIcon(build, world)` but
   `model.js` holds no catalogue. D8 adds the optional third `catalog` argument (R4) and
   records the `iconAuto` display-only reading.

9. **Bulk paste add.** *"Paste `64 stone bricks`, `- 32 glass`, `20x oak log` (or a whole
   description) into one dialog; parse quantity+name lines, fuzzy-match against the
   catalogue, show matched/unmatched review rows, add all on confirm. This is the 'copy the
   list from a guide' path."*
   **AC9.** The three line forms parse; noise lines are ignored and listed as unmatched;
   duplicates merge case-insensitively; quantities clamp to at least 1; a 12-line fixture
   adds exactly the matched set.
   *Plan note:* "fuzzy-match" is frozen in §2 D9 (exact name/slug, then a unique prefix of at
   least 3 characters; ambiguous means unknown).

10. **Undo for destructive edits.** *"Deleting a material, build or world offers `Undo` in
    the toast for 6 s; clicking restores a deep-equal snapshot."*
    **AC10.** Undo within the window restores the exact prior state; after the window, undo
    does nothing.

11. **Recent picks first.** *"The last ~8 chosen items lead the picker, per browser."*
    **AC11.** After choosing three items they render first on reopen; the order survives a
    reload.

12. **No regressions.** **AC12.** Every existing unit and acceptance suite passes; the UI
    audit is at least its EDICT-0013 count (138) and grows with the new checks; the browser
    suite passes with no deleted cases; `node scripts/app-qa.mjs run` restamps
    `docs/governance/app-qa.json` from a green suite after the assets land; `node
    src/wiki/cli.mjs lint` and `node src/wiki/cli.mjs sync` stay clean.

## 2. Planned architecture

The plan implements the twelve entries in the frozen contract below. `.tmp/plan/contract-0014.md`
is reproduced verbatim; where it and the brief disagree, it wins. The decisions D1–D12 then
name the touch points and say where the contract needs a ruling rather than a guess. Every
line reference is to the current working tree at `9d899ec`.

### Frozen DOM contract (contract-0014.md, verbatim)

# EDICT-0014 — frozen DOM contract (Lead arbitration, 2026-10-25)

Amends `.tmp/plan/contract.md` (the EDICT-0013 contract). Everything there still applies
unless restated here. 兵部 implements to this; 測試部 asserts against this; neither seat
renames without a Lead ruling.

## 1. Step buttons (amends EDICT-0013 §4)

- Markup unchanged: `button.mat-step[data-mat][data-step][data-stack]` inside
  `div.mat-steps` in each material row.
- Visible labels are the resolved amounts: `+1`, `+10`, `+<stack>`, `-1`, `-10`, `-<stack>`.
  `+<stack>` renders as `+64` / `+16` text — never the literal string `stack`.
- `data-step` keeps the **shipped EDICT-0013 literals** `+1|+10|+stack|-1|-10|-stack`
  (`src/app.js:1210`). No rename: the frozen EDICT-0013 cases stay valid as written, and only
  the visible label text changes. `data-mat-step` keeps carrying the resolved amount
  (`+64`/`-16`), `data-stack` keeps the resolved integer.
- **Stack buttons are omitted from the DOM when the resolved stack size is 1** (not
  disabled): four `.mat-step` buttons for non-stackable items, six otherwise. `aria-label`
  for the removed pair is not emitted at all.
- Aria labels: `Add a full stack (64) to Stone Bricks needed`, `… (16) …`; the ±1/±10 keep
  `Add 1 …` / `Add 10 …`. No button may read "full stack" for a stack size of 1 (the
  button does not exist).

## 2. Icon picker paging (amends EDICT-0013 §5)

- `#icon-search` unchanged. `#icon-grid` keeps `role="listbox"`, tiles stay
  `button.icon-tile[data-icon-slug]`.
- First render is 120 tiles; each sentinel hit appends 120. New element
  `div#icon-sentinel[data-icon-sentinel]` (aria-hidden) sits as the last child of
  `#icon-grid`.
- `#icon-count-hint` text is `showing N of 1368 — scroll for more` (N = rendered) and
  `showing N of M for "query"` while narrowed.
- Typing in the search resets the batch to 120 and clears the sentinel.
- Every catalogue slug must be reachable; no `slice` cap.

## 3. Tooltip

- A single element `#mc-tooltip` (role `tooltip`) exists in the document while a tooltip is
  shown; implementation appends it to the open `<dialog>` when one is open, else to `body`.
- It carries the text of the source slot's `data-tip`.
- No `::after`/`::before` tooltip rules may remain on `.slot`, `.icon-tile`, `.mc-input` or
  `.mat-row`.
- It is positioned fixed, clamped inside the viewport, flips below when the slot's top lacks
  44 px of room.
- Delegation uses **bubbling** events: one `pointerover`/`pointerout` pair on `document`,
  checking `event.relatedTarget` against the slot. `pointerenter`/`pointerleave` do not
  bubble, so they are only acceptable with `{capture:true}`. No per-slot hover listeners.

## 4. Empty states

- Containers that already exist and must stay non-empty when their zero state applies:
  `#build-empty` (builds list), `#detail-empty` (detail panel), `#world-material-empty`
  (materials filter with no match), `#world-empty` (world picker). No plural `#builds-empty`
  / `#worlds-empty` ids — those names were a contract typo.
- Controls (stable ids, reuse what ships):
  - `#build-empty` keeps `#btn-first-build` (must open the right dialog, never toast).
  - `#world-empty` gains `#btn-empty-create-world` (opens the world dialog).
  - `#detail-empty` gains `#detail-empty-action` (opens the build dialog, or the world
    dialog when there is no world).
  - `#material-empty` is no longer a bare paragraph: it becomes a container holding
    `#btn-empty-pick-material` (focuses the add-material item chooser).
  - `#world-material-empty` gains `#btn-empty-reset-filter` (clears search + filter).
- No control in a zero state may respond only with an error toast.

## 5. Bulk paste dialog

- Trigger: `button#bulk-paste` in the add-material area, label `Paste list…`.
- Dialog `#bulk-dialog` > `form#bulk-form` with `textarea#bulk-input`,
  `div#bulk-review` (rows `.bulk-row[data-bulk-state="matched"|"unknown"]`,
  `[data-bulk-qty]`), `button#bulk-add` (label `Add matched`), `button#bulk-cancel`,
  `p#bulk-error`.
- Parse forms: `64 stone bricks`, `- 32 glass`, `+1 oak log`, `20x oak log` (optional
  `x`), case-insensitive; blank lines ignored; unknown names stay in the review list with
  `data-bulk-state="unknown"` and are not added.
- Adds merge into the build's materials case-insensitively; quantity clamps to ≥ 1.

## 6. Undo

- `#toast` (existing global toast) may carry `button#toast-action` with text `Undo`.
- Only material/build/world deletion offers it; the toast lives 6000 ms.
- Undo restores the pre-delete state (`JSON.stringify` deep-equal).

## 7. Recents

- Storage key `mc-build-tracker:recent` (array of slugs, max 8), browser-local, not part of
  the exported state.
- Tiles for recent slugs carry `data-icon-recent="true"` and render before non-recent tiles
  on the unfiltered list (first batch).
- Choosing an item (icon or material chooser) records it; unknown slugs are dropped on load.

## 8. Icon suggestion

- `M.suggestIcon(build, world, catalog)` returns `{slug, name, reason}|null`; pure, no I/O,
  stable. The third argument is optional: with two arguments the function returns `null`.
- **Matching rule (frozen; oracle = `.tmp/plan/suggestion-table.md`, 104 keyword rows,
  every slug validated against `MC_ICON_SET`).** The keyword list is DATA, not an algorithm:
  1. the longest whole-word, case-insensitive keyword found in `build.name` (weight 2);
  2. otherwise in `build.notes` (checked first), then the **world name** (weight 1); coords are
     not scanned — the frozen reason vocabulary has no coords string;
  3. otherwise the material with the largest `needed` (ties: catalogue order), reason
     `most of the materials are <Display Name>`;
  4. otherwise the world icon, reason `came from the world icon`;
  5. otherwise `null`.
  Multi-word keywords (`log cabin`, `end island`) match as phrases. No edit distance and no
  token-prefix scoring.
- Optional state field `iconAuto: true|false` on builds and worlds; `validate` accepts a
  boolean, `exportJSON`/`importJSON` pass it through, absence = false.
- `#detail-avatar` gains `data-icon-auto="true"` while the avatar is showing a suggestion
  (no stored icon but a suggestion exists) and `title` = the reason.
- When the picker is opened on such a build: `p#icon-suggest-note` reads
  `Suggested from "<matched text>"` and the suggested tile carries
  `data-icon-suggested="true"`.
- Choosing any tile stores it normally and sets `iconAuto=false`; applying the suggestion
  sets `iconAuto=true`; suggestion never rewrites a stored icon on rename.
- Reason strings are short and stable, and are the oracle in
  `tests/qa/edict-0014-fixtures/suggestion-fixtures.json`:
  `matched "<keyword>" in the name` (the keyword exactly as tabulated, lowercase),
  `most of the materials are <Display Name>` (title case, e.g. `Stone Bricks`),
  `came from the world icon`.

## 9. Unchanged surfaces

- Every EDICT-0013 id not listed above stays exactly as frozen in
  `.tmp/plan/contract.md`: `#build-rename`, `#build-name`, `#build-name-save`,
  `#build-name-cancel`, `#detail-heading`, `#copy-coords`, `#notes-text`, `.notes__text`,
  `#notes-edit`, `#notes-save`, `#notes-cancel`, `#build-notes`, `#icon-dialog`,
  `#icon-dialog-title`, `#icon-use`, `#icon-cancel`, `#icon-upload`, `#icon-file`,
  `#icon-preview`, `#icon-error`, `#mat-choice*`, `#mat-item`, `#mat-error`, `#bulk-*`
  (new), `#world-*`, `#build-dlg-*`.
- `#item-options` (datalist) stays removed.

### D1 — Six resolved inputs, four stitched sides, one seamless strip

The backdrop becomes a two-copy transform loop. `src/index.html:15` keeps the single
`.backdrop` element; two child divs (classes only, no ids, so the frozen id contract is
untouched) hold the strip, and the CSS animates `translateX(0 → -50%)` linearly and
infinitely over `loop_seconds: 180`. The strip is the four square side faces: 2,560 × 640
(`width === 4 * height`); the last-to-first seam is crossfaded, so the loop has no visible
seam and no ping-pong.

- `scripts/mc-backdrop.py:41` resolves six inputs `panorama_0…5`; `:42` still refuses a face
  under 512 px. `compose` (`:122-151`) stitches the four side faces (`0…3`) at 2,560 × 640,
  adds the 64 px crossfade at the three internal seams **and at the wrap seam**, and records
  the caps `panorama_4/5` as resolved but unstitched inputs.
- Manifest (`:210-223`) declares `faces: 6` (resolved inputs, each with its sha256),
  `sides: 4` stitched, `seamless: true`, `loop_seconds: 180`, `width: 2560`,
  `height: 640`, `width === 4 * height` and `blur_radius: 2` (≤ 2 guard), with brightness
  0.95 and saturation 0.92 unchanged. EDICT-0010's 120 s ping-pong and 2.5 blur are
  superseded (R1); its 2,560 × 640 geometry is kept.
- `src/styles.css:865-882` loses `panorama-drift` over `background-position` and the
  `ease-in-out alternate`; the element holds two strip copies (a 200%-wide twin) and moves by
  half that width once per 180 s. `src/styles.css:1049-1054`'s reduced-motion `animation:
  none` stays. `src/app.js:349` still adds `has-panorama` and sets `--panorama-image`; only
  the value changes.
- The dirt fallback is unchanged: `probeBackdrop` simply never adds the class when the image
  fails, and the base `.backdrop` rule (`src/styles.css:847-862`) keeps the dirt texture.
- Evidence: the regenerated manifest, two screenshots 1 s apart, a reduced-motion screenshot,
  a missing-asset screenshot, and `reports/qa/evidence/edict-0014/panorama-tile-proof.png`
  showing the six inputs and the four-side stitch.

### D2 — Picker paging: 120-tile batches, sentinel, no cap

`renderIconPicker` (`src/app.js:270-308`) stops slicing at 150 (`:280-281`) and renders the
first 120 of the filtered list. It appends `div#icon-sentinel[data-icon-sentinel]` as the
last child of `#icon-grid` (`src/index.html:322`), observes it with an
`IntersectionObserver` rooted on the grid, and adds 120 more per hit, re-rendering the grid.
Typing (`src/app.js:828`) resets the batch and removes the sentinel. `#icon-count-hint`
(`src/index.html:323`, text built at `src/app.js:297-304`) reads
`showing N of 1368 — scroll for more` and `showing N of M for "query"` while narrowed; 1368
is `ICON_SET.length`, and the count-hint contract's literal must match it.

No `slice` cap remains. Item mode (material chooser) and icon mode share the same list. The
observer is disconnected when the dialog closes (`openIconPicker`'s close path and the
dialog's `close` event), and re-created on open. When `IntersectionObserver` is unavailable,
the fallback appends the next 120 rows when the grid's scroll position comes within two tile
heights of the end, so every slug stays reachable without the observer (測試部 case 50b).

### D3 — Full names by wrapping, not truncation

The three truncation rules are removed and replaced by wrapping:
`src/styles.css:615` (`.mat-row__name`), `:750` (`.mat-choice__name`) and `:1028`
(`.icon-tile__name`) lose `white-space: nowrap`, `overflow: hidden` and `text-overflow:
ellipsis`; they gain `white-space: normal`, `overflow-wrap: break-word` and a line-height
that fits 2–3 lines. No `-webkit-line-clamp`: AC3 measures every name node, so clipping
fails the test.

- The material row grid must keep `grid-auto-rows: auto` so a wrapped name grows the row
  instead of overlapping the stepper cluster.
- The picker tile keeps `min-width: 60px` / `max-width: 220px` at 390 px
  (`src/styles.css:1040-1047`); its name block grows downwards.
- The chooser chip (`#mat-choice-name`, `src/index.html:159`) wraps inside the chip; the
  slot stays 30 × 30.
- 測試部 freezes the longest-name list used by AC3 at S3; 兵部 does not pick it.

### D4 — One shared tooltip in the top layer

A single `#mc-tooltip` (`role="tooltip"`, hidden by default) is added to `src/index.html`
after the icon dialog and before `#confirm-dialog` (`src/index.html:342`). It is painted
inside the open `<dialog>` when one is open, else on `body`. The source is the existing
`data-tip` attribute already emitted by `slotHtml` (`src/app.js:65-72`), the picker tile
markup (`:284-293`), the world-icon preview (`renderIconPreview`, `:220-234`) and the
material-row slots.

The pseudo-element CSS at `src/styles.css:647-662` (`.slot[data-tip]:hover::after`) is
deleted, together with any `.icon-tile[data-tip]`/`.mat-row[data-tip]` variant. The JS
delegates bubbling `pointerover`/`pointerout` on the document with an `event.relatedTarget`
containment check (capture-phase `pointerenter`/`pointerleave` is not used), plus
`focusin`/`focusout`; it moves `#mc-tooltip` and clamps its rect 8 px inside the viewport.
When the slot's top is under 44 px from the viewport top it flips below. Escape hides it;
closing the dialog hides it; scroll/resize reposition it. No timers.

### D5 — Empty states that offer the next action

The five containers keep their shipped ids; only controls are added. R3 supersedes the
draft's rename: the plural ids in the first contract were a drafting slip, corrected before
audit, so the frozen EDICT-0013 assertions on `#build-empty`/`#world-empty`/`#detail-empty`
(`tests/qa/ui.e2e.test.mjs:171-173,359`) stay valid as written.

- `#build-empty` (`src/index.html:57-60`) keeps `#btn-first-build` (`:59`) as its control.
  The click handler (`src/app.js:510`) no longer calls `openBuildDialog` blindly: it asks the
  state which dialog to open (world dialog when there are zero worlds, build dialog
  otherwise). The `Create a world first.` toast at `src/app.js:968` is deleted.
- `#world-empty` (`src/index.html:225-228`) keeps `#btn-sample` (`:227`) and gains
  `#btn-empty-create-world`, which opens the world dialog.
- `#detail-empty` (`src/index.html:71-73`) gains `#detail-empty-action`: with zero worlds it
  opens the world dialog, otherwise the build dialog. It is the only control in that panel.
- `#material-empty` (`src/index.html:150`, the build detail's zero-materials line) becomes a
  container carrying `#btn-empty-pick-material`, which focuses the add-material item chooser.
- `#world-material-empty` (`src/index.html:213`) becomes a container carrying
  `#btn-empty-reset-filter`: it clears `#mat-search` and `#mat-filter` and re-renders.
- No zero-state control may respond only with an error toast, and `#btn-first-build` may not
  toast `Create a world first.` again.

### D6 — Resolved step labels, shipped data-step kinds

`materialStepsHtml` (`src/app.js:1191-1217`) keeps `div.mat-steps` and six buttons for
stackable items, but takes the resolved amount from `stackSizeFor`
(`src/tracker/model.js:121`) and renders the label as `+`/`-` plus that amount (`+64`,
`+16`, `+1`), never the literal `stack`.

No rename (R2): `data-step` keeps the shipped EDICT-0013 literals
`+1|+10|+stack|-1|-10|-stack` (`src/app.js:1210`); `data-mat-step` keeps carrying the
resolved amount (`+64`/`-16`), `data-stack` keeps the resolved integer, and
`adjustNeeded`'s parser (`src/app.js:676-690`) is untouched. The frozen EDICT-0013 cases
stay valid as written; only the visible label text changes. `title`/`aria-label` are the
contract's phrases.

Frozen samples for AC6: stone bricks 64, egg 16, bucket 16, water bucket 1, diamond sword 1,
potion 1, honey bottle 16, armour stand 16.

### D7 — Omit the stack buttons at stack 1

Inside the same renderer, when `stackSizeFor` returns 1, only the four `±1`/`±10` buttons are
emitted — no stack-pair buttons, no disabled twins, no "full stack" aria text. The six-button
form keeps the shipped `data-step` literals `+stack`/`-stack` (R2; no rename). The 186
stack-1 catalogue items are the affected set; `[data-step$="stack"]` remains a valid selector
because the two stack kinds end in `stack`. The `±1`/`±10` buttons keep their existing
behaviour, including the clamp at 1, and the step cluster's layout does not shift when two
buttons disappear (`src/styles.css:689-710` uses a grid with fixed columns; the row reserves
the same two columns).

### D8 — Deterministic suggestion, display-only

`M.suggestIcon(build, world, catalog)` is added to `src/tracker/model.js` next to
`setBuildIcon` (`:269`) and exported with the other model functions (`:618`). The contract's
two-argument call stays valid and returns `null`; R4 accepts one optional third argument
named `catalog`, an array of `{slug, name}` in curated order, because `model.js` has no
catalogue and must stay pure. The app calls `M.suggestIcon(build, world, ICON_CATALOG)`.

The matching rule is frozen and is a table lookup, not token scoring (A1). The keyword list
is DATA in `.tmp/plan/suggestion-table.md` (104 rows; every slug validated against
`MC_ICON_SET` at authoring and by the unit test):

1. the longest whole-word, case-insensitive keyword found in `build.name` (weight 2);
2. otherwise the same lookup in `build.notes` (checked first), then the world name (weight 1);
   coords are not scanned — the frozen reason vocabulary has no coords string;
3. otherwise the material with the largest `needed` (ties broken by catalogue order), reason
   `most of the materials are <Display Name>`;
4. otherwise the world icon, reason `came from the world icon`;
5. otherwise `null`.

Multi-word keywords (`log cabin`, `end island`) match as phrases. There is no edit distance
and no token-prefix scoring. Ties break by catalogue order, then slug, and the reason is the
matched row's frozen string, so the same build always yields the same `{slug, name, reason}`.
The reason strings are the oracle in `tests/qa/edict-0014-fixtures/suggestion-fixtures.json`:
`matched "<keyword>" in the name` with the keyword exactly as tabulated (lowercase),
`most of the materials are <Display Name>` in title case, and `came from the world icon`.

State: `iconAuto` is accepted on builds and worlds by `validate` (`src/tracker/model.js:464`),
passed through `exportJSON`/`importJSON` (`:486-490`), default false. In this edict the field
is **display-only**: there is no apply control, so nothing sets it true; choosing a tile
stores the icon and sets it false (absence). The avatar (`#detail-avatar`, `src/index.html:77`;
render at `src/app.js:1132`) shows the suggestion only when the build has no stored icon, with
`data-icon-auto="true"` and `title=reason`. The picker (`src/app.js:237-308`) shows
`p#icon-suggest-note` and marks the tile `data-icon-suggested="true"` for such a build. The
worlds half of `iconAuto` has no UI in this edict; the field is carried but inert.

The fixture table (≥ 20 builds with expected slug + reason) is authored and frozen by 测试部
at S3; 兵部 implements against it.

### D9 — Bulk paste with a frozen matching rule

A `button#bulk-paste` labeled `Paste list…` is added after `#mat-error` (`src/index.html:171`)
inside the add-material area; it opens `#bulk-dialog`, inserted before `#confirm-dialog`
(`:342`). The dialog follows contract §5's structure exactly.

The parser is a pure model function `M.parseBulk(text, catalogue)` returning rows
`{raw, qty, name, matchedSlug, state}` plus `matched`/`unknown` counts:

- line regex: optional bullet (`-`, `*`, `•`), optional `+`, digits, optional `x`/`×`,
  then the name; blank lines ignored; a line without a leading quantity is shown in the
  review as `unknown` and is never added;
- matching: case-insensitive exact display name, then exact slug, then a **unique** prefix
  of the display name of at least 3 characters; no match and ambiguous both become
  `unknown` (no edit distance, no recipe lookup);
- duplicates within the paste merge by matched slug and sum quantities; adding into the
  build reuses `M.addMaterial`, whose existing merge is already case-insensitive
  (`src/tracker/model.js:300-302`); quantities clamp to ≥ 1.

`#bulk-add` adds every `matched` row in one commit; unmatched rows stay visible with their
reason; `#bulk-error` reports the empty case. Escape/Cancel closes the dialog. The matching
rule is frozen (R5): exact display name, then exact slug, then a unique ≥ 3-char prefix;
ambiguous or missing means unmatched; no edit distance, no synonyms.

### D10 — Undo: one snapshot, six seconds, invalidated by the next commit

`toast()` (`src/app.js:364-372`) is extended to accept an optional action. When a delete is
offered undo, `#toast` (`src/index.html:353`) contains a real `button#toast-action` labeled
`Undo` and stays for 6000 ms instead of 3200 ms; the live region and error styling stay.

Before deleting a material (`src/app.js:669`), a build (`:630-641`) or a world
(`:1298-1308`), the app deep-clones the state (`JSON.parse(JSON.stringify(state))`) plus the
selection/view context into one `pendingUndo = {snapshot, context, token}`. Any successful
`commit()` clears `pendingUndo` unless it *is* the restore; that invalidation is the R6
ruling on "undo after a later edit". Clicking Undo calls `commit()`
with the snapshot, restores the view/selection, and focuses the restored row. The two
confirm texts "…cannot be undone" (`src/app.js:633`, `:1300`) are rewritten to say "You can
undo for 6 seconds." One snapshot only; no stack, no persistence across reload.

### D11 — Recent picks first

`mc-build-tracker:recent` is read at load (wrapped in `try/catch`, so a denied localStorage is
a silent no-op) as an array of slugs, filtered against `ICON_SET`, truncated to 8. Choosing an
item in the picker — the item-mode pick (`src/app.js:842-849`), the icon-mode commit
(`useIconDraft`, `:310`) and a world icon pick — records the slug at the front, de-duplicated.

The catalogue surfaces are unchanged and must not be reshaped: `MC_ICON_SET` is an array of
slug strings, `MC_ICON_NAMES` is a `slug → display name` map and `MC_ICON_STACKS` is a
`slug → stack` map. The dispatch task's "array of slug/name objects" reading of `MC_ICON_SET`
is wrong; the app's derived `ICON_CATALOG` is `[{slug, name}]` in curated order.

Rendering (`renderIconPicker`, `:270-308`) puts recent slugs first only when the query is
empty; each such tile carries `data-icon-recent="true"`. The first 120-tile batch therefore
leads with recents, the sentinel appends the rest, and the ordering is stable for the session.
The store is not exported and unknown slugs are dropped on load.

### D12 — Non-regression, stamp and evidence

The 49 existing browser cases are kept as written where the contract reuses a surface, and
updated only where it amends one (empty-state controls, stack-1 button omission, picker
paging, tooltip); every update is disclosed in the S5 record, and none is deleted. 测试部
freezes the new cases at S3. The audit
(`tests/qa/mc_ui_audit.py`) grows past 138 with its new static checks. The stamp
(`docs/governance/app-qa.json`) is invalid by construction — `src/index.html`,
`src/styles.css`, `src/app.js` and `src/tracker/model.js` all change, as do
`src/assets/panorama/backdrop.webp` and its manifest, all of them in
`APP_SOURCE_FILES` (`src/wiki/lib.mjs:456-467`) — so it is restamped only after the assets
land, by the Lead at S5, and `node src/wiki/cli.mjs app-qa` must read verified afterwards.

Bounded diff: `src/index.html`, `src/styles.css`, `src/app.js`, `src/tracker/model.js`,
`tests/unit/**`, `tests/qa/**`, `scripts/mc-backdrop.py`, `src/assets/panorama/*`, plus the
S5 documentation scope (design system, README, wiki). No `raw/**` write; no new dependency;
no network.

### 2.5 Post-audit amendments (A1–A5)

- **A1 (F3)** — D8's token scorer is replaced by the frozen table rule in contract §8; the
  keyword data is `.tmp/plan/suggestion-table.md` (104 rows), and the ≥ 20-build fixture
  table stays 測試部's to author and freeze at S3.
- **A2 (F4)** — D4 delegates bubbling `pointerover`/`pointerout` with an `event.relatedTarget`
  containment check (capture-phase `pointerenter`/`pointerleave` is not used), plus
  `focusin`/`focusout`.
- **A3 (F14/F15)** — D7 states the shipped `+stack`/`-stack` `data-step` literals explicitly;
  §1's stale "R2/R3 questions"/"R3 must freeze this one" notes now point at §2 D8/D9.
- **A4 (R1 correction)** — the strip is the four square side faces: 2,560 × 640
  (`width === 4 * height`), replacing the rejected six-face arithmetic; AC1 and D1 carry the
  corrected manifest fields, while §3's frozen case text keeps the old numbers as the audit
  record.
- **A5 (C1/C5)** — contract §8 amended: matching checks `build.notes` first, then the world
  name; the reason strings' casing is frozen — `most of the materials are <Display Name>`
  in title case, `matched "<keyword>" in the name` with the keyword exactly as tabulated
  (lowercase), and `came from the world icon` — with the oracle in
  `tests/qa/edict-0014-fixtures/suggestion-fixtures.json`.

## 3. Review record

The ten gate items from `docs/governance/state-machine.md`. Verdicts are deliberately blank:
测试部 fills them at `S2`/`S3`; this draft does not pre-judge its own audit.

| Id | Risk / question | Draft position | Verdict (测试部) |
|----|-----------------|----------------|------------------|
| R1 | Scope: this edict touches the app, the panorama generator, the model and the tests; the docs seat must not drift into `src/**`. | Write scopes: 兵部 `src/index.html`, `src/styles.css`, `src/app.js`, `src/tracker/model.js`, `tests/unit/**`; 工部 `scripts/mc-backdrop.py` + `src/assets/panorama/**`; 礼部 `design-system/**`, `README.md`, `wiki/**` at S5; 测试部 `tests/qa/**`, `qa/**`, `reports/qa/**`; Lead `docs/governance/ledger.jsonl` + `wiki-sync.json`. No `src/assets/icons/**` change. | **PASS after correction** — the draft still assigned `tests/qa/**` to 兵部, a Q3 independence violation (F1); the cell now matches the contract (app code + unit tests only for 兵部). |
| R2 | Decomposition: twelve items, one frozen contract, one new model helper, one generator change. | D1–D12 cover AC1–AC12; contract §1–§9 is the implementation surface; model gets `suggestIcon` and `parseBulk`, `validate`/export gain `iconAuto`. R2 must rule on the optional third argument and the empty-state id rename. | **PASS** — the twelve items map one-to-one onto AC1–AC12, the contract is the single implementation surface, and the two open questions the draft flags are already ruled (optional third `catalog` arg, R4; shipped empty-state ids, R3). Draft-position residue is recorded as F15 and lands with the amendment. |
| R3 | Acceptance: AC1's "six faces" contradicts the sealed raw source (four side faces); AC5's container/control ids do not exist; AC8's catalogue and `iconAuto` lifecycle; AC9's "fuzzy"; AC10's invalidation. | The draft records resolutions, not silence: six inputs/four stitched (D1), one-id-per-view reading (D5), optional catalogue + display-only `iconAuto` (D8), exact/prefix rule (D9), commit-invalidated snapshot (D10). R3 freezes or rejects each. | **BLOCK** — the resolutions are right, but three are not implementable as written: the §2 reproduction dropped one contract sentence (F2; restored by this audit), D8's token scorer contradicts the frozen keyword table the Lead supplied (F3), and D4 delegates `pointerenter`/`pointerleave` on `document`, which do not bubble (F4). AC2/AC3/AC4/AC5/AC6/AC7/AC9/AC10 are testable as planned; fixtures are frozen in §3.4. **→ Superseded by §3.5: PASS** (A1–A4 close F1–F4). |
| R4 | Ordering: the generator, assets, app code and tests can land in either order; the stamp must come last. | Order: contract → 兵部 model (pure helpers + unit tests) and 工部 assets in parallel → app DOM/CSS → browser cases → assets final → Lead-run stamp → wiki. No stamp before the final asset hash. | **PASS** — order is safe: pure model helpers and unit tests first, generator/assets in parallel, app DOM/CSS after, browser cases frozen before the Lead's run, assets final, then the stamp (R10) and wiki. |
| R5 | Risk: 1,368 tiles in the DOM (no virtualisation); tooltip in the top layer; six-face strip may be impossible; undo can restore a stale state; fuzzy matching can bind a wrong item. | Batches cap DOM growth at 120 per hit; the tooltip is a single element; D1 records the four-side constraint; D10 has one snapshot and commit invalidation; D9 has no edit distance. 测试部 may add cases for each. | **PASS** — 120-tile batching keeps DOM growth bounded (all 1,368 still reachable, case 50); one tooltip element; the four-side stitch is the disclosed R1 constraint; one undo snapshot invalidated by the next commit; no edit distance. Cases 50–65 cover each risk. |
| R6 | Environment: Node v22.14.0, bundled Python 3.12.14 + Pillow 12.3.0, Chrome 155.0.8059.86; headless Chrome cannot start in the verifier sandbox (mojo access denied); no network. | Browser evidence is Lead-run headed Chrome with `danger-full-access`; 测试部 authors/analyses/judges; the generator uses the bundled Python; no dependency is added. | **PASS** — browser evidence is the Lead's headed Chrome (this verifier seat cannot launch Chrome inside the sandbox; disclosed in every S5 record); the generator uses the bundled Python 3.12.14 + Pillow 12.3.0; no dependency added. |
| R7 | Failure paths: missing panorama asset, denied localStorage, no IntersectionObserver, zero matched bulk lines, undo after the window, tooltip with no dialog. | Dirt fallback (D1); silent recents no-op (D11); scroll-position fallback to load the next batch when `IntersectionObserver` is missing (D2); `#bulk-error` (D9); timed undo (D10); tooltip falls back to `body` (D4). | **PASS with case coverage** — dirt fallback (case 26), missing-`IntersectionObserver` paging fallback (case 50b: must work or D2's promise is dropped), `#bulk-error` (case 62), undo after the window and after a later commit (case 65), tooltip body fallback (case 55). |
| R8 | Escalation: the contract's remaining conflicts are Lead rulings, not implementation choices. | The unresolved questions are named in §1's plan notes, §2's D5/D6/D8 and §6; 测试部 may block on any; no sandbox escalation is available to the seats, so the browser path is the Lead's alone. | **PASS** — the remaining questions are Lead rulings, not implementation choices; the stale §1 plan notes and the D7 `plusstack` wording are recorded as F14/F15 and land with the amendment; no seat can escalate the sandbox, so the Lead runs Chrome. |
| R9 | Wiki upkeep: EDICT-0006 and the `edict-sync` lint; the pages must be named before the work starts. | §5 names every page: design-system MASTER and tracker page, README, wiki entity/concept/atmosphere/vanilla-assets/testing/open-questions/overview, generated index, log entry citing EDICT-0014, and lint/sync. Ledger rows follow the ingest. | **PASS** — §5 names every page (design-system MASTER + tracker page, README, wiki entity/concept/atmosphere/vanilla-assets/testing/open-questions/overview, generated index and a log entry citing EDICT-0014), plus lint and sync; ledger rows land at S6. |
| R10 | App QA freshness: the current stamp (`2026-10-25T10:02:35.160Z`, 8 files, 49 cases) goes stale the moment the app files change. | Restamp only after the final asset hash, from a green Lead-run suite; `node src/wiki/cli.mjs app-qa` must report verified; the stamp's file list is `APP_SOURCE_FILES` (`src/wiki/lib.mjs:456-467`). | **PASS conditional** — restamp only after the final asset hash, from a green Lead-run suite; `APP_SOURCE_FILES` (8 files) already covers every file this edict changes (no new shipped source file: the sentinel, empty-state controls, tooltip and bulk dialog live in existing `index.html`/`styles.css`/`app.js`), so only the ordering rule applies. |

### 3.1 Independent recon (测试部, 2026-10-25)

Read-only grounding against the working tree at `9d899ec` (clean except this untracked
draft). Nothing here is taken from the draft's own claims; every line reference was read.

- **Contract reproduction.** `.tmp/plan/contract-0014.md` (6,215 B, 112 lines) was diffed
  against the block under §2 with `git diff --no-index`. One sentence was missing (F2);
  restored by this audit. Leading/trailing blank lines are formatting, not content.
- **Catalogue.** `src/assets/icons/icons.js`: `MC_ICON_SET` is an **array of 1,368 slug
  strings** (first `stone`, `cobblestone`, `stone_bricks`, `deepslate`, `cobbled_deepslate`;
  `diamond_sword` index 437, `egg` 456, `water_bucket` 48), `MC_ICON_NAMES` maps 1,368
  slugs to display names, `MC_ICON_STACKS` maps 1,368 stacks, `MC_ICON_CATEGORIES` exists.
  Stack histogram: **186 stack-1, 46 stack-16, 1,136 stack-64 (sum 1,368)** — AC7's 186
  confirmed. Samples: stone 64, egg 16, bucket 16, water_bucket 1, oak_sign 16,
  honey_bottle 16, armor_stand 16, potion 1, slime_ball 64.
- **Longest display names** (frozen list for AC3): 38 `Wayfinder Armor Trim Smithing
  Template`, 36 `Silence Armor Trim Smithing Template`, 35 `Netherite Upgrade Smithing
  Template`, 35 `Raiser`/`Sentry`/`Shaper Armor Trim Smithing Template`, 34 `Coast Armor
  Trim Smithing Template`, `Cracked Polished Blackstone Bricks`, `Polished Blackstone
  Pressure Plate`.
- **Surfaces to change.** `src/index.html`: `#build-empty` L57 (`#btn-first-build` L59),
  `#detail-empty` L71, `#material-empty` L150 (a `<p>` today), `#world-material-empty` L213
  (a `<p>` today), `#world-empty` L225 (`#btn-sample` L227), `#icon-grid` L322,
  `#icon-count-hint` L323, `#toast` L353. `src/app.js`: `renderIconPicker` L270, the 150
  slice L280, hint L299 `showing … — refine your search`, `#btn-first-build` handler L510
  (blind `openBuildDialog`), `toast('Create a world first.', true)` L968, stepper markup
  L1210-1211, `toast()` L364-372 (writes `textContent`), ids array L385-402.
  `src/styles.css`: `.icon-grid` L1001 (`max-height:280px; overflow:auto` — the sentinel
  strategy is viable), `.mat-row__name` L615, `.mat-choice__name` L750, `.icon-tile__name`
  L1028-1033 (all three truncate today), `.slot[data-tip]:hover::after` L647-660, panorama
  L854-882 (`animation: panorama-drift 120s ease-in-out infinite alternate` L869),
  reduced-motion L1049-1054. `src/tracker/model.js`: `stackSizeFor` L121, `setBuildIcon`
  L269, `addMaterial` L292, `validateIcon` L439, `validate` L464, `exportJSON` L486,
  `importJSON` L490 — no `iconAuto` yet.
- **Suite.** `tests/qa/ui.e2e.test.mjs`, 1,116 lines, 49 cases. Cases that change: 26
  (panorama drift/dimensions), 31 (150-tile cap + hint), 39 (six steps + `+stack` labels),
  42 (water bucket stack-1), 48 (backdrop 2,560×640 / blur ≤1). Case 01's empty-state
  assertions stay valid because R3 keeps the shipped ids. Nothing in the suite tests the
  first-build toast, undo, recents or bulk paste.
- **Suggestion data.** `.tmp/plan/suggestion-table.md` holds **104 validated keyword→slug
  rows** (every slug exists in `MC_ICON_SET`; `.tmp/plan/make-suggestion-table.mjs` also
  lists rejected candidates such as `cracked`, whose slugs do not exist). Its rule — name
  keyword first, then notes/world, then dominant material, then the world icon — cannot be
  reproduced by D8's token scorer (F3). The audit's generator
  (`.tmp/gen-suggestion-fixtures.mjs`) implements the table rule and produced §3.4's 23
  fixtures.
- **Environment.** Node v22.14.0 / bundled Python 3.12.14 + Pillow 12.3.0 / Chrome
  155.0.8059.86 (probe in the previous stamp record). Headless Chrome cannot start in the
  verifier sandbox; the Lead runs it.

### 3.2 Findings

| Id | Severity | Finding | Fix / owner |
|----|----------|---------|-------------|
| F1 | **R1 / Q3 — blocking, corrected** | §3 R1's draft position gave 兵部 `tests/qa/**`. 测试部 must be the only author of cases (Q3). | Cell corrected by this audit; 兵部 keeps `src/**` + `tests/unit/**` only. |
| F2 | **R3 — blocking, corrected** | The §2 contract reproduction omitted contract §1's final sentence: “`aria-label` for the removed pair is not emitted at all.” A frozen contract reproduced with a hole is not frozen. | Restored verbatim by this audit; blank-line padding ignored when diffing. |
| F3 | **R3 — blocking (needs amendment)** | D8's token-scoring algorithm (exact 3 / prefix 2 / substring 1, weights) contradicts the Lead's frozen keyword table and cannot reproduce it: “Wheat Farm” must map to `wheat` via the keyword `farm`, which no display name contains, and multi-word keywords (“log cabin”, “end island”) are unmatchable by tokens. | 礼部 replaces D8's scorer paragraph with the table rule: scan the build **name** first (longest whole-word keyword, weight 2), then **notes + world name** (weight 1; coords are *not* scanned — the frozen reason vocabulary has no coords string), then the material with the largest `needed` (ties by catalogue order; reason `most of the materials are <Display Name>`), then the world icon, then `null`. 兵部 implements that; fixtures in §3.4 are the oracle. |
| F4 | **R3 — blocking (one-line fix)** | D4 delegates `pointerenter`/`pointerleave` on `document`. Those events do not bubble, so the delegated listener never fires and AC4's hover path is silently dead. | Use `pointerover`/`pointerout` (bubbling) or register `pointerenter`/`pointerleave` with `{capture:true}`. 兵部. |
| F5 | R3 — recorded, no fix | AC2 testability: the full scan must not cost 5 minutes. Algorithm frozen in §3.3 (scroll loop, 12 sentinel hits, ~2–4 s). | Case 50. |
| F6 | R7 — must be honoured or dropped | D2 promises a scroll-position fallback when `IntersectionObserver` is missing, but AC2 does not require it. | Case 50b deletes `IntersectionObserver` before load and asserts paging still reaches 1,368. If 兵部 does not implement the fallback, delete the promise from D2. |
| F7 | R3 — recorded | D1 puts the strip in “two child divs (classes only, no ids)”, so no frozen hook exists. The cases must not depend on a class nobody froze. | Cases assert structurally: `.backdrop` has exactly **two element children**, each with `background-image: url(assets/panorama/backdrop.webp)`, animation on the children, `none` under reduced motion. 兵部 must keep exactly two children. |
| F8 | R3 — recorded | AC3's “every name node” needs a frozen name list. | §3.1's longest-name list is the fixture; cases measure picker tile, material row and chooser chip at 1280 and 390. |
| F9 | R3 — recorded | AC5's five zero states: `#material-empty` and `#world-material-empty` are `<p>` elements today and become containers; `#build-empty`, `#world-empty`, `#detail-empty` ship as containers. | Keep the ids; cases assert each state is visible with its named control and that the control works (case 56/57). |
| F10 | R3 — recorded | AC9 needs a frozen fixture; quantities must clamp ≥1 and duplicates merge. | §3.4's 12-line fixture: 8 matched rows after merge, 2 unmatched, 1 blank ignored (case 62 + unit test). |
| F11 | R3 — recorded | AC10's invalidation (“a later commit clears undo”) needs a second action inside 6 s. | Cases 63–65. |
| F12 | R3 — recorded | AC6/AC7 labels and aria strings must be literal. | Stone bricks: `['+1','+10','+64','-1','-10','-64']`, aria `Add a full stack (64) to Stone Bricks needed`; water bucket: four `.mat-step`, no `[data-step$="stack"]`, no “full stack” aria. |
| F13 | R10 — condition | The stamp is only valid after the final asset hash; `APP_SOURCE_FILES` already lists all eight files, so no new file must be added. | Order: assets final → Lead suite → `node scripts/app-qa.mjs run` → `node src/wiki/cli.mjs app-qa`. |
| F14 | R3 — recorded | D7 still says “no `plusstack`/`minusstack` node”; the shipped literals are `+stack`/`-stack` (R2 keeps them). | Wording fix at S3 (兵部/礼部); no behaviour change. |
| F15 | R2 — recorded | §1 AC8/AC9 plan notes still call ruled questions open (“R2/R3 questions”, “R3 must freeze this one”). | Strip the notes when the amendment lands. |
| F16 | R2 — recorded | Draft header says 608 lines where the Lead's handoff said 517; the file is what matters, no action. | — |

**Overall verdict: BLOCK** — F3 and F4 need an amendment/one-line fix before 兵部 builds
against D8/D4; F1 and F2 are already corrected in this record. F5–F16 are covered by the
frozen cases below and do not block.

### 3.3 Frozen case list (S3 — authoritative at S5, authored by 测试部)

New browser cases in `tests/qa/ui.e2e.test.mjs` (suite goes from 49 to 66; nothing deleted):

| # | Case | Asserts |
|---|------|---------|
| 50 | paging reaches every item (and without IntersectionObserver) | 120 `[data-icon-slug]` tiles first, `#icon-sentinel` last child of `#icon-grid` and `aria-hidden`, scroll loop reaches 1,368 distinct slugs, the last tile is clickable and commits, hint `showing 120 of 1368 — scroll for more`; then `delete window.IntersectionObserver` and scrolling still pages (D2 fallback) |
| 51 | search resets the batch | typing a query resets to one batch and the hint becomes `showing N of M for "query"`; clearing restores 120 + the scroll hint; 240 loaded tiles drop back to ≤120 |
| 52 | full names wrap at 1280 and 390 | `scrollWidth <= clientWidth + 1`, no `text-overflow: ellipsis`, `white-space` not `nowrap` on `.icon-tile__name`, `.mat-row__name` (longest frozen name), `#mat-choice-name`; both viewports |
| 53 | tooltip in the picker | `#mc-tooltip` visible, appended inside the open dialog, clamped into the viewport, topmost at its own centre (`elementFromPoint`), hidden on Escape |
| 54 | tooltips outside a dialog and in the world dialog | material-row slot → tooltip parent is `body`, hides on pointer-out; world-dialog slot → tooltip inside that dialog |
| 55 | five zero states | fresh browser: `#world-empty` + `#btn-empty-create-world`, `#build-empty` + `#btn-first-build` (opens the build dialog once a world exists), `#detail-empty` + `#detail-empty-action`, `#material-empty` + `#btn-empty-pick-material` (focuses `#mat-choice`), `#world-material-empty` + `#btn-empty-reset-filter` (clears the search); no toast-only path |
| 56 | suggestion shown, not applied | new build `Gold Vault`: `#detail-avatar[data-icon-auto="true"]`, `title` = `matched "gold" in the name`, gold-block artwork shown, stored `icon` still `null`; picker shows `#icon-suggest-note` = `Suggested from "gold"` and a `[data-icon-suggested="true"]` tile; choosing it stores gold_block and sets `iconAuto: false` |
| 57 | manual icon is never replaced | pick apple manually, rename to `Wheat Farm`: apple survives, no `data-icon-auto` |
| 58 | bulk paste end to end | 7 lines: 4 matched (duplicates merged: stone bricks 67, oak log 21), 1 unknown listed but not added; one `#bulk-add` commit yields exactly the 4 rows |
| 59 | undo a material delete (+ expiry) | `#toast-action` restores the pre-delete state (`JSON.stringify` deep-equal); after ~6.8 s the action is gone |
| 60 | undo a build delete | deep-equal restore, the build is selected again |
| 61 | undo a world delete | deep-equal restore of the world and its builds |
| 62 | recent picks first | two picks (`apple`, `dirt`): recent tiles are the first two tiles in latest-first order (`data-icon-recent`) |
| 63 | recents persistence and cap | seeded 12 slugs (unknown + duplicate): exactly 8 survive in order after a reload; the key is not in `exportJSON` |
| 64 | resolved labels and stack-1 omission | stone `+64`, egg `+16`, water bucket four `.mat-step` only, `data-step` literals kept |
| 65 | suggestion purity | 2-arg → `null`, 3-arg deterministic, state untouched, `Gold Vault` → `gold_block` with the frozen reason |
| 66 | whole-run console cleanliness | case 49's historical check stays; case 66 asserts the run (including the new surfaces) logged no console errors |

Changed existing cases (AC12, all disclosed in S5):

| Case | Change |
|------|--------|
| 26 | backdrop: exactly two child divs, both with `backdrop.webp`, transform loop on the layer (name not frozen), two samples 1 s apart differ, `none` under reduced motion; manifest `faces:6`/`sides:4`/`seamless:true`/`loop_seconds:180`/2,560×640/`blur_radius <= 2` |
| 31 | initial batch 120 slug tiles (+ None) instead of 150, hint `showing 120 of 1368 — scroll for more` |
| 39 | label array `['+1','+10','+64','-1','-10','-64']`; `data-mat-step` mirrors the label; aria `Add a full stack (64) …` |
| 42 | egg `+16`; water bucket four buttons / no “full stack” aria / no `[data-step$="stack"]` |
| 48 | backdrop 2,560×640 (4:1), blur ≤1 on the layer, manifest fields |
| 01 | add: `#btn-first-build` lives inside `#build-empty` |

### 3.3b S5 case amendments (disclosed after run 2)

The five run-2 reds were case mis-specifications, not app defects — the app was not changed for
them (兵部's run-2 patch fixed a separate `currentBuild` scope bug). Freeze amended as below; no
AC weakened, no case deleted.

| # | Run-2 red | Ground truth (headed Chrome, demo state, verbatim) | Amendment |
|---|-----------|---------------------------------------------------|-----------|
| 48 | `.backdrop::before` computes `filter: none` | blur moved onto the two real layers: `.backdrop > .backdrop__layer` → `filter: blur(1px) brightness(0.95) saturate(1)`, `background-image: url(assets/panorama/backdrop.webp)`, `animation: backdrop-translate 180s linear infinite` (none under `reduce`); transform −763.222 → −758.129 over 1.2 s | read the two layers: both blur ≤1, both carry the strip, 180 s duration, transform advances; assert the pseudo-element is `none`; keep 2560×640 / 4:1; add the reduce-motion stop |
| 50 | `Cannot read properties of undefined (reading 'icon')` | the model stores `activeWorldId` + `ui.selectedBuildId`; there is **no** `state.activeBuildId` (兵部 flagged the same) | resolve the selected build from the `#detail-heading` name inside `activeWorldId`'s world; never synthesize a state field |
| 52 | timeout `#material-body .mat-row` length === 1 | after `reset()` the demo's first build (Iron Farm (spawn)) already has **4** materials (`materialRows: 4`) | baseline = current row count; assert "one more than before" and that the Wayfinder row is present |
| 55 | `visible \|\| !action` fails by construction | with a build selected `#detail-empty` is hidden **while** `#detail-empty-action` exists inside it (`detailEmptyHidden: true`, `detailEmptyAction: true`) | assert the action exists, lives inside `#detail-empty`, is rendered, and the container is hidden when a build is selected; the click-through assertions keep the no-toast-only intent |
| 59 | timeout `#material-body .mat-row` length === 0 | deleting one of the four seeded rows yields **3** (`Material removed.Undo`, `#toast-action` visible); undo restores **4** with storage at 4 | baseline = current row count; expect count−1 after the first delete, count after Undo (deep-equal), then delete again for the 6 s expiry unchanged |

New static acceptance/audit files (测试部 authoring, fail = QA_FAIL):

- `tests/qa/edict-0014.acceptance.test.mjs`: contract ids present (`#icon-sentinel`,
  `#mc-tooltip`, `#toast-action`, `#bulk-*`, five empty-state controls); no tooltip
  `::after`/`::before` rules on `.slot`/`.icon-tile`/`.mc-input`/`.mat-row`; sentinel +
  hint literal; step `data-step` literals and resolved labels; stack-1 omission markup;
  recents key `mc-build-tracker:recent`; `iconAuto` passes `validate`/export/import;
  panorama manifest fields; static case-count floor (no deleted case); stamp ordering note.
- `tests/unit/tracker-suggest.test.mjs` (兵部, fixture-owned by 测试部): the 23 fixtures in
  §3.4, `2-arg → null`, stability (two calls equal), `iconAuto` never auto-applied.
- `tests/qa/mc_ui_audit.py`: grew from 138 to **147 checks** at S3 (9 new
  `edict0014/*` rules — `sentinel`, `tooltip`, `empty-states`, `bulk`, `undo`, `recents`,
  `suggestion`, `step-labels`, `backdrop-two-copies`), plus the panorama rules re-bound to
  the amended strip (blur ≤2, `faces:6`/`sides:4`/`seamless`/`loop_seconds:180`/2,560×640/
  `width === 4 * height`/six input hashes). 138/138 still pass; the nine new rules are red
  until 兵部 lands, by design (TDD).

### 3.3c S5 rule-side corrections (disclosed after the S5 run)

The seven reds the Lead reported in `mc_ui_audit.py` (140/147) were **audit-rule defects, not app
defects**: the app was not changed for any of them, and the behaviour they assert is proven by
the frozen browser cases. Two further static tests had the same stale EDICT-0010 assumptions and
were corrected the same way. All corrections are in `tests/qa/**` only.

| Rule | Was asserted (stale) | Corrected to (shipped) |
|------|----------------------|------------------------|
| `identity/panorama-layer` | `:root.has-panorama .backdrop::before` | `:root.has-panorama .backdrop__layer` present, `::before` absent |
| `identity/panorama-pan` | `@keyframes panorama-drift` | `@keyframes backdrop-translate` + `backdrop-translate 180s` |
| `panorama/css-blur` | blur scraped from `.backdrop::before` | blur read from `.backdrop__layer` (1px, ceiling 1) |
| `edict0014/sentinel` | `HTML.count("icon-sentinel")` | `icon-sentinel` in APP (created lazily inside an open picker) |
| `edict0014/tooltip` | `HTML.count("mc-tooltip")` | `mc-tooltip` in APP (created on first hover) |
| `edict0014/undo` | `HTML` `toast-action` + `pendingUndo` | `toast-action`/`offerUndo` in APP + the 6 s timer |
| `edict0014/recents` | helper `recentIconSlugs` | `RECENT_KEY` + `data-icon-recent` + `pickerRecents` in APP |
| `edict-0013-assets` AC-A5 | blur on `::before` | blur on `.backdrop__layer` (desktop ≤1, mobile ≤1.5, `::before` has none) |
| `tracker-icons` AC-I5 | `panorama-drift` pan | `.backdrop__layer` ×2 + `backdrop-translate 180s` |

Also recorded for the record: the five run-2 case amendments in §3.3b are accepted — no AC
weakened, no case deleted — and the final audit state is **147/147**, reached after these
rule-side corrections (app untouched by 测试部 throughout).

### 3.4 Frozen fixtures

**Suggestion (AC8)** — 23 builds, generated from `.tmp/plan/suggestion-table.md` by the
table rule frozen in F3 (`.tmp/gen-suggestion-fixtures.mjs`); the frozen copy 兵部's unit
test must consume is `tests/qa/edict-0014-fixtures/suggestion-fixtures.json`. World is
`Survival SMP` with no icon unless stated.

| Id | Build signal | Expected |
|----|--------------|----------|
| gold_vault | name `Gold Vault` | `gold_block` — matched “gold” in the name |
| diamond_mine | name `Diamond Mine` | `diamond_block` — matched “diamond” in the name |
| wheat_farm | name `Wheat Farm` | `wheat` — matched “farm” in the name |
| storage_hall | name `Storage Hall` | `chest` — matched “storage” in the name |
| nether_highway | name `Nether Highway` | `netherrack` — matched “nether” in the name |
| iron_golem_grinder | name `Iron Golem Grinder` | `torch` — matched “grinder” (longest keyword wins) |
| greenhouse | name `Greenhouse` | `glass` — matched “greenhouse” in the name |
| kitchen | name `Kitchen` | `furnace` — matched “kitchen” in the name |
| railway_station | name `Railway Station` | `rail` — matched “railway” in the name |
| sheep_pen | name `Sheep Pen` | `white_wool` — matched “sheep” in the name |
| aquarium | name `Aquarium` | `water_bucket` — matched “aquarium” in the name |
| notes_library | name `Build 13`, notes “needs a big library inside” | `bookshelf` — matched “library” in the notes |
| notes_brew | name `Build 14`, notes “brew potions here” | `brewing_stand` — matched “brew” in the notes |
| notes_greenhouse | name `Outpost`, notes “greenhouse for crops” | `glass` — matched “greenhouse” in the notes |
| notes_bridge | name `Build 16`, notes “build a bridge over the moat” | `stone_bricks` — matched “bridge” in the notes |
| name_beats_notes | name `Iron Barn`, notes “storage wall” | `iron_block` — a name hit beats a longer notes keyword |
| material_stone_bricks | no name hit, materials stone bricks 300 / torch 10 | `stone_bricks` — most of the materials are Stone Bricks |
| material_dominant | materials oak planks 64 / dirt 500 | `dirt` — largest `needed` wins |
| world_icon | no other signal, world icon `grass_block` | `grass_block` — came from the world icon |
| null_plain | name `Build 42`, nothing else | `null` |
| coords_ignored | name `Build 43`, coords `100 / 64 / 100` | `null` — coords are not scanned |
| notes_beats_material | name `Nothing Here`, notes “add a lamp later”, dirt 64 | `lantern` — notes hit beats material fallback |
| enchanting_room | name `Enchanting Room`, no keyword, no material | `null` (keyword table has no `enchant…` entry; documents the no-signal path) |

**Bulk paste (AC9)** — frozen 12 lines in `#bulk-input`; expectations after Add matched on
a fresh build:

| Line | Parsed | Result |
|------|--------|--------|
| `64 stone bricks` | stone_bricks 64 | matched |
| `- 32 glass` | glass 32 | matched |
| `+1 oak log` | oak_log 1 | matched |
| `20x oak log` | oak_log 20 | matched (merges to 21) |
| `3 Stone Bricks` | stone_bricks 3 | matched (merges to 67, case-insensitive) |
| *(blank line)* | — | ignored |
| `here is my farm plan` | — | unknown (no leading quantity) |
| `5 diamond sword` | diamond_sword 5 | matched |
| `* 12 torch` | torch 12 | matched |
| `7x Unobtainium` | — | unknown (no slug/name/prefix match) |
| `0 cobblestone` | cobblestone 0 → 1 | matched (clamp ≥1) |
| `1 water bucket` | water_bucket 1 | matched |

Matched rows after merge: **8**; unknown: **2**; blank ignored; added materials and their
`needed` values equal that table.

**Longest names (AC3)** — the list in §3.1 is the frozen fixture for cases 52/53.

### 3.5 Delta re-audit of the A1–A4 amendment (测试部, 2026-10-25)

Scope: delta only, against the changed ranges named by 礼部 — header 21–24, §1 AC1 39–48 and
the AC8/AC9 notes, §2 D1 264–289 / D2 302–306 / D4 330–340 / D7 381–390 / D8 392–427, new
§2.5 502–515, §4 Scenery 729, §6 787–795. §3 was re-read, not rewritten (Lead's call: it is
the audit record; see C2).

**Verified — PASS**
- Frozen contract: the block under §2 is byte-identical to `.tmp/plan/contract-0014.md`
  (130 lines / 7,511 B, sha256 `57b3cd0e…` after the Lead's C1/C5 amendment); a normalized
  diff is clean, including the F2 sentence. F1's scope
  correction is intact (兵部: app code + `tests/unit/**` only).
- **F3 closed.** D8 now implements the frozen table rule: 104-row data oracle, longest
  whole-word case-insensitive keyword in `build.name` (weight 2), then `build.notes` / world
  name (weight 1, coords explicitly not scanned), then largest-`needed` material (ties by
  catalogue order) with reason `most of the materials are <Display Name>`, then the world
  icon, then `null`; multi-word phrases match; no edit distance. Checked row by row against
  the 23 fixtures in `tests/qa/edict-0014-fixtures/suggestion-fixtures.json` — same slugs and
  same reason strings.
- **F4 closed.** D4 delegates bubbling `pointerover`/`pointerout` on `document` with an
  `event.relatedTarget` containment check and explicitly rejects capture-phase
  `pointerenter`/`pointerleave`; contract §3 (lines 45–47) says the same. Single
  `#mc-tooltip`, fixed, clamped 8 px, flips below 44 px, hidden on Escape and on dialog close.
- **F14/F15 closed.** D7 states the shipped `+stack`/`-stack` `data-step` literals; §1's
  AC8/AC9 notes now point at §2 D8/D9 with no “R2/R3 question” residue.
- **A4 geometry is coherent.** Header, AC1, D1, §4 and §6 agree: six resolved inputs (each
  with its sha256), four stitched sides, `seamless: true`, `loop_seconds: 180`,
  `width: 2560`, `height: 640`, `width === 4 * height`, `blur_radius <= 2`; §6 states
  EDICT-0010 is amended in pan/bake only and explicitly rejects the six-face 2,568 × 428
  arithmetic. The four-face strip is 2,560 × 640 as EDICT-0010 already had it; six inputs
  are declared, caps unstitched — implementable and testable.
- **D2 fallback** now specifies the missing-`IntersectionObserver` scroll-proximity paging
  (case 50b); **AC1 evidence** (two screenshots 1 s apart, reduced-motion, missing asset, seam
  proof) is testable against the two-children structure.

**Verdict: R3 → PASS (delta closes F1–F4). Amendment overall: PASS.** Conditions below do
not block dispatch:

- **C1 — reason-string case — CLOSED by the Lead's contract §8 ruling.** The Lead amended
  `.tmp/plan/contract-0014.md` §8 (now 130 lines / 7,511 B, sha256
  `57b3cd0edb882e1562df5766b62d8c7f8288cd811ba6eb7e81471436e6d065a9`): the material reason is
  title case (`most of the materials are <Display Name>`), the keyword reason quotes the
  tabulated keyword exactly (lowercase), and the oracle is named as
  `tests/qa/edict-0014-fixtures/suggestion-fixtures.json`. The §2 block re-copies the contract
  verbatim (130 lines; normalized diff clean) — 兵部 implements to the fixtures.
- **C2 — frozen-text geometry note (no action).** §3.3's cases 26/48 still read 2,568×428 —
  the pre-A4 audit record, per the Lead. At S5 the cases assert A4's numbers (`width: 2560`,
  `height: 640`, `width === 4 * height`, `blur_radius <= 2`); 兵部 reads §2.5 A4, not §3.3,
  for dimensions.
- **C3 — accepted disclosure.** Contract §8's “applying the suggestion sets `iconAuto=true`”
  has no apply control; D8 and §6 carry `iconAuto` display-only. No UI is built for it this
  round (already recorded in §6).
- **C4 — cross-seat note.** The task-12 brief was corrected in place; task-14 (design
  system/wiki) still mentions the rejected “six-face 2,568×428” arithmetic and 礼部 is fixing
  that line. Task-14 is behind task-13 anyway.
- **C5 — notes-vs-world-name precedence — CLOSED by the same amendment.** Contract §8 step 2
  now reads `build.notes` (checked first), then the **world name** (weight 1). No frozen
  fixture exercises a world-name keyword, so the rule is frozen but unexercised — recorded,
  not blocking.

## 4. Planned verification

Planned only; results are the S5 record's job. Every command runs from the repo root; each
test file is run directly (no `node --test`: the sandbox denies its piped child stdio).

| Check | Command / evidence | Planned result |
|-------|--------------------|----------------|
| Environment | `node --version`; bundled Python `C:\Users\KZ\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe -c "import PIL; print(PIL.__version__)"`; Chrome pin probe | Node v22.14.0; Python 3.12.14 + Pillow 12.3.0; Chrome 155.0.8059.86 |
| Model unit | `node tests/unit/tracker-model.test.mjs` + new `tests/unit/tracker-suggest.test.mjs`; bulk-parser and `iconAuto` cases | 22 existing + new pass; AC8 fixture ≥ 20 builds stable; AC9 12-line fixture; validate/export/import round-trip `iconAuto` |
| Identity unit | `node tests/unit/tracker-icons.test.mjs` | 9/9 unchanged |
| Acceptance | existing 71 + new `tests/qa/edict-0014.acceptance.test.mjs` (static ids, contract CSS rules, parser, recents, stamp ordering) | 71 existing + new cases pass, 0 fail; no deleted case |
| Audit | bundled Python `tests/qa/mc_ui_audit.py` | ≥ 138 checks, 0 fail; new rules for paging, tooltip, empty states, step labels |
| Browser suite | `node scripts/app-qa.mjs run` — Lead only, headed Chrome, `danger-full-access` | 49 updated + new cases (frozen at S3), no deletions; restamped `docs/governance/app-qa.json` |
| Scenery | manifest probe; two screenshots 1 s apart; reduced-motion and missing-asset captures; `panorama-tile-proof.png` | AC1; `faces:6` inputs (six sha256s) / `sides:4` stitched / `seamless:true` / `width:2560` / `height:640` / `width === 4 * height` / 180 s / blur ≤2; animation `none` under reduce; dirt fallback intact |
| Paging | browser case: scroll to end, count distinct slugs, last-tile interact, hint text | AC2: 1,368 rendered, last interactable, hint reports loaded count |
| Names | browser measurement at 1280 × 800 and 390 × 844 on the frozen longest-name list | AC3: `scrollWidth <= clientWidth + 1` on every name node |
| Tooltip | browser case at a picker tile, a material row slot and a world-dialog slot; Escape | AC4: topmost at its rect, inside viewport, hides on leave/Escape |
| Empty states | fresh browser, five zero states, click every named next-step control | AC5: five states reachable via the five named controls, each works, no error-toast-only |
| Steppers | browser: stone-brick `+64`, egg `+16`, water bucket four buttons; audit CSS | AC6/AC7 |
| Suggestion | `tracker-suggest` unit fixture + picker case on an unsuggested build | AC8; `iconAuto` display-only; no manual-icon overwrite |
| Bulk | parser unit cases + browser dialog: three forms, noise, duplicate, 12-line fixture | AC9 |
| Undo | browser: delete material/build/world, Undo within 6 s; then after the window | AC10: deep-equal restore; no-op after window |
| Recents | browser: choose three items, reopen, reload | AC11 |
| Evidence | `reports/qa/evidence/edict-0014/` — manifests, screenshots, probe JSON, audit output | Named files; screenshots at 1280 and 390; Lead-run |
| Stamp | `node src/wiki/cli.mjs app-qa` + `docs/governance/app-qa.json` hash list | verified, 8 hashed files, 49+ cases, after assets |
| Wiki | `node src/wiki/cli.mjs index --write`, `lint`, `sync` | index current (22 pages + any new), lint 0 errors, sync clean |
| Bounded diff | `git status --porcelain` before S6 | only the declared paths; no `raw/**`; no ledger write before S6 |

### 4.1 Verification record (S5Q, 测试部, 2026-10-25)

Artifact pinned: HEAD `9d899ec` + 兵部/工部's run-2 working tree; stamp
`verified — 2026-10-25T12:27:45.271Z (66 UI cases)` over the eight `APP_SOURCE_FILES`. Chrome
155.0.8059.86, Node v22.14.0, Python 3.12.14 / Pillow 12.3.0. Browser run by the Lead seat
(disclosed; this seat cannot launch Chrome), cases/static suites authored and judged here.

| Check | Result |
|-------|--------|
| Browser suite (`node scripts/app-qa.mjs run`) | **66/66**, exit 0; stamp written (66 cases); no case deleted, case 49 console check preserved |
| `mc_ui_audit.py` | **147/147**, exit 0 (7 rule-side corrections disclosed in §3.3c; app untouched) |
| `edict-0014.acceptance` / `edict-0013-assets` / `app-qa.acceptance` | 14/14 · 11/11 · 7/7 |
| `tracker` / `tracker-icons` / `tracker-icon-resolution` / `wiki-sync` / `wiki` | 17/17 · 8/8 · 7/7 · 8/8 · 13/13 |
| Units | 98/98 (app-qa 9, tracker-icons 9, tracker-model 22, wiki-core 10, wiki-sync 10, tracker-suggest 38) |
| `index --check` / `lint` / `app-qa` | up to date · clean 22 pages · verified 66 cases |
| AC1 scenery | six inputs / four sides / seamless / 2,560×640 / 180 s / blur 2.0; two `.backdrop__layer` copies, `::before` none, per-layer `blur(1px)`; transforms advance −1277.63 → −1266.61 → −1255.59; reduced motion `none` |
| AC2 paging | first batch 121 tiles; end `zombified_piglin_spawn_egg`, 1,369 tiles (1,368 + None), hint `showing 1368 of 1368` |
| AC3 names | 0 overflow at 1280 and 390 on the frozen longest-name samples |
| AC4 tooltip | rect (367, 312, 123×30) inside viewport, topmost, hidden after pointer-out |
| AC5–AC7 | five zero states + controls; `+1 +10 +64 -1 -10 -64` (sign `+16`); water bucket `count:4`/`stackButtons:0` |
| AC8–AC11 | suggestion `stone_bricks` `matched "tower" in the name`; bulk 4 matched / 3 unknown; undo 3 → 4 deep-equal; recents `["red_wool"]` first |
| AC12 | suite 66 no deletions, audit 147, stamp verified 66, lint/sync clean |
| Evidence | 20 PNGs all hashes distinct + `probe.json` + README; generator proofs `panorama-tile-proof.png` |
| Findings | S5-1..S5-7 rule-side (closed, the app was never changed for them); S5-8/S5-9 five case amendments (§3.3b) — no AC weakened, no case deleted |

**QA_PASS, cycle 1.** Every AC1–AC12 PASS; no open blocker. 礼部 may start the S6 wiki ingest.

## 5. R9 wiki impact

No new wiki page is expected; every page below is an update, and the questions touched here
are annotated rather than deleted. 礼部 writes them after the S5 record exists, never before.

- `wiki/entities/minecraft-build-tracker.md` — six-input circular scenery, picker paging
  (120/batch, 1,368 reachable), full names, single top-layer tooltip, the five empty states,
  resolved step labels and omitted stack-1 buttons, deterministic suggestion and `iconAuto`,
  bulk paste, undo, recents; verification counts and the Lead-run browser split.
- `wiki/concepts/in-game-gui-design.md` — native top-layer tooltip vs pseudo-elements,
  batched incremental rendering as a vanilla picker pattern, empty state as an affordance,
  the seamless two-copy strip, and the "no JS listbox" line for the themed select.
- `wiki/synthesis/atmosphere-and-identity.md` — the 360° strip changes the atmosphere
  contract: one direction, no seam, 180 s; record six resolved inputs vs four stitched sides
  and the raw source's four-face statement. The regenerated manifest already reports
  2,560 × 640, `blur_radius` 2.0, faces 6 / sides 4, 55,096 B and sha256 `331253bd…`; cite
  those as the new atmosphere numbers.
- `wiki/synthesis/vanilla-assets-without-redistribution.md` — the panorama manifest now
  records six resolved inputs and four stitched sides; still the game's own pixels, exported
  locally and never committed; no new asset class, no font change.
- `wiki/synthesis/testing-a-ui-like-a-user.md` — the new interaction cases, the Lead's
  browser-hands split, the OS-level popup that cannot be screenshotted, and the stamp that
  covers assets as well as code.
- `wiki/synthesis/open-questions.md` — keep the resolved icon-coverage note; rewrite the
  panorama entry with the seamless decision and the four-vs-six source question; add durable
  questions for the bulk-matching rule, the suggestion fixture, and the undo invalidation
  policy if R3 leaves them open.
- `wiki/overview.md` — one sentence only if the standing synthesis still describes the
  ping-pong backdrop; otherwise untouched.
- `wiki/index.md` — regenerated (`index --write`); `wiki/log.md` — append
  `## [2026-10-25] ingest | EDICT-0014 — friction pass` naming every page above and this
  edict; then `lint`, `sync` and the `edict-sync` contract.
- `design-system/minecraft-tracker/MASTER.md` — new components: paging sentinel and count
  hint, shared tooltip, empty-state action, bulk-paste dialog, undo toast, recents ordering,
  suggestion note, seamless strip; counts updated to the S5 record.
- `design-system/minecraft-tracker/pages/tracker.md` — page-level anatomy, the new ACs and
  the updated verification record for this round.
- `README.md` — scenery, picker paging, full names, tooltip, empty states, step labels,
  suggestion, paste, undo, recents, and the checks/status block.
- Ledger `docs/governance/ledger.jsonl` — new rows after seq 149; 礼部's S5/S6 rows cite the
  log entry and the page list above. No raw seal row is expected: this round adds no raw
  source, so `raw/manifest.json` stays at its eight sealed entries.

## 6. Limits

- **AC1 "six faces" is six inputs, four stitched sides.** The sealed provenance says four
  side faces (`panorama_0…3`) compose the strip and `panorama_4/5` are the top/bottom caps.
  Caps are not stitchable into a horizontal 360° strip, so R1 records all six inputs and
  stitches the four sides; the manifest declares both counts.
- **Scenery numbers supersede EDICT-0010 in pan and bake only.** EDICT-0010's 2,560 × 640 /
  120 s ping-pong / blur 2.5 is amended to the same four-side 2,560 × 640 (`width === 4 *
  height`) strip with `loop_seconds: 180` and blur ≤ 2; the dispatch board's pre-A4 strip
  arithmetic is rejected. Disclosed in the header; this is the amendment's ruling, not a
  drift.
- **Suggestion is heuristic, not AI.** No model call, no network, no learning; the reasons
  are a frozen vocabulary and the fixture is 测试部's. A wrong-but-deterministic suggestion is
  an accepted limitation, not a bug.
- **`iconAuto` is display-only in this edict.** The contract's "applying the suggestion sets
  `iconAuto=true`" has no apply control frozen; the plan carries the field (validate, export,
  import) and sets it only to false on a manual choice. The world half of the suggestion and
  of `iconAuto` is out of scope this round (R4); the field is carried but inert.
- **Bulk matching is exact/prefix only.** No edit distance, no synonyms, no recipe/JEI data;
  ambiguous names stay unmatched. The 12-line fixture is the contract's.
- **Undo is one snapshot, six seconds, in memory.** A later commit clears it (the draft's
  invalidation rule); it does not survive a reload; material/bulk edits inside the window are
  not merged into the snapshot.
- **Paging has no virtualisation.** The DOM can hold up to 1,368 tiles once fully scrolled;
  batches cap the growth, not the ceiling. Below-sentinel rendering assumes
  `IntersectionObserver`; the fallback loads the next batch on scroll proximity.
- **Recents are per browser and not exported.** `localStorage` denial is silent; a private
  window starts empty; the order is not part of the JSON backup.
- **Tooltip is pointer/focus only.** No long-press on touch, no hover on keyboard-less
  surfaces; while a dialog is open the surface is its child in the top layer, and outside a
  dialog it is a body child positioned fixed in the viewport.
- **Non-goals (brief §D, do not implement):** accounts, sync, sharing, any network call;
  screenshot/OCR import, recipe/JEI data, game-mod integration; gather-mode tap on the
  Materials tab; build templates or duplicate build (own edict); any deliberate weakening of
  the 49 browser cases — updates are allowed and disclosed, deletions are not.
- **Browser evidence is the Lead's.** Chrome cannot start in the DSH sandbox (`FATAL:mojo`
  platform-channel access denied), so 测试部 cannot run it; the Lead executes every launch
  with `danger-full-access`, 测试部 authors the cases and analyses the artefacts. This edict
  does not widen any seat's sandbox.
- **Stamp ordering.** Any source edit after the stamp invalidates it; the stamp runs after
  `backdrop.webp` and its manifest are final, and `node src/wiki/cli.mjs app-qa` must read
  verified at S6.
- **No raw source for this round.** The founder's wording is transcribed in §1 per the
  EDICT-0013 sanitisation precedent; nothing is added to `raw/**`, and no existing raw file
  is edited.
- **Status label.** The drafting phase used the dispatch brief's `S1 DRAFTED`; the canonical
  state machine calls that gate `S1 TRIAGED` and places a plan carrying R1–R10 at `S2 PLANNED`.
  The header now records the final state, `S6 REPORTED`, and the ledger rows 150–156 record the
  actual order.
- **Post-S6 documentation.** The design system, README and wiki were written after the S5
  record (task-14); this document and the ledger rows are the final record.
