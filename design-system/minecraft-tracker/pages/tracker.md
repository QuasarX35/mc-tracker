# Page Override — `tracker` (the app)

> Overrides `../MASTER.md` for the single-page build tracker (`src/index.html`), per the
> Master + Overrides pattern. Rules not listed here come from the Master unchanged.
> **Authored in EDICT-0005.** Supersedes `dashboard.md` (the EDICT-0004 server dashboard),
> which is retained only as an archived record. **Updated by EDICT-0013** — Minecraft face,
> inline title/notes editing, coords copy, needed steppers, one full-catalog icon picker,
> material chooser, themed native dropdowns and the sharper backdrop. **Updated by EDICT-0014**
> — seamless 360° scenery, paged picker with full names, one top-layer tooltip, working empty
> states, resolved stack labels (and no stack buttons at stack 1), deterministic icon
> suggestion, bulk paste, six-second undo and recent picks. **Updated by EDICT-0015** — status
> ordering, derived header stats, custom material registries, chooser-free import and the
> 120 s single-layer scenery. **Updated by EDICT-0016** — 18 px type scale, one `.stepper`
> replacing the six-button rows, notes view/edit controls in the label row, created/updated
> stamps, the left world sidebar, aligned section rules and the Standard/Compact builds view.

## 1. Page pattern

**Data-entry application, not a landing page.** One screen with three tabs
(Builds / Materials / Worlds), a world selector in the panel top bar, and modal dialogs for
create/edit/confirm. No hero, no marketing sections, no charts: this is a working tool that
is opened repeatedly while playing.

## 2. Screen anatomy

| Region | Contents | Notes |
|--------|----------|-------|
| Masthead | "Minecraft" eyebrow (aqua), "Build Tracker" title, tagline | Title uses the vanilla 4px hard shadow; sits directly on the dirt backdrop |
| Tab strip | 3 tabs, `role="tablist"`, arrow-key navigation | Selected tab merges into the panel |
| Panel top bar | World `<select>`, world meta (edition/version/builds/percent), New World / Import / Export | Wraps at ≤640px |
| Builds view | Build list (left, each row with its 28px avatar) + build detail (right, 40px avatar button that opens the icon picker) | Stacks to one column at ≤900px; empty state `#build-empty` offers `#btn-first-build`, which opens the world dialog when there are zero worlds and the build dialog otherwise — never an error toast |
| Detail | Title with a rename pencil (`#build-rename`) left of Delete, status segmented control, coords with a copy micro-button (`#copy-coords`), notes view/edit (`#notes-text`/`#build-notes`), XP progress, material table with `button.mat-step` clusters (four buttons at stack 1, six otherwise, resolved labels), add-material chooser (`#mat-choice`) and **Paste list…** (`#bulk-paste`) | Title and notes commit explicitly (Save/Enter; Escape restores); quantities still commit on `change`, so typing never re-renders; deleting a row offers `#toast-action` **Undo** for 6 s; empty material list offers `#btn-empty-pick-material` |
| Materials view | Aggregated shopping list with per-item XP bars, search, filter, copy-list | "Used by" column collapses at ≤900px; got-column at ≤640px; zero filter matches shows `#world-material-empty` with `#btn-empty-reset-filter` (clears search + filter) |
| Worlds view | World cards with a 40px avatar beside the name plus per-world roll-up and select/edit/delete | Auto-fill grid, min 280px |
| Icon picker | One dialog, no tabs: searchable `.icon-tile` grid with incremental paging (`#icon-sentinel`) and a count hint, wrapped names, recent picks first, **Upload image…** footer, shared by the world dialog, build dialog, detail avatar and the material chooser | First batch 120 tiles, 120 more per sentinel hit, all 1,368 slugs reachable; typing resets; `#icon-count-hint` text frozen; pick-item mode hides upload and Use and one click selects and closes; on a build with a display-only suggestion the dialog shows `#icon-suggest-note` and marks `data-icon-suggested` |
| Status | `aria-live="polite"` line + toast (`#toast`, may carry `#toast-action` **Undo** after a delete for 6 s) | Announces saves, imports, errors, undo |

## 3. Interaction rules

1. Every mutation goes through `TrackerModel`; the UI never writes state directly.
2. State persists to `localStorage` after each mutation; a failed write surfaces a toast and
   never throws.
3. Destructive actions (world, build) require the confirm dialog with the object named in it.
4. Import **replaces** the whole state only after `TrackerModel.importJSON` validates it; a
   malformed or foreign file is refused with the reason, and existing data is untouched.
5. `?demo=1` seeds the sample worlds only when nothing is stored; `?tab=builds|materials|worlds`
   deep-links a view (used by the screenshot QA).
6. Tabs are reachable by keyboard (←/→), `aria-selected` always matches the visible panel.
7. Title and notes are explicit editors: `#build-rename` → `#build-name` + `#build-name-save`/
   `#build-name-cancel`; `#notes-edit` → `#build-notes` + `#notes-save`/`#notes-cancel`.
   Enter (notes: `Ctrl/Cmd+Enter`) saves, Escape cancels and restores, blank titles are refused,
   notes are trimmed, and focus returns to the invoking button. Material quantities keep
   committing on `change`.
8. Every number field is a `.stepper` (`div.stepper[data-stepper]`): `−` button, `type=number`
   input with hidden native spinners, `+` button. A click changes by 1; **Shift** applies one
   stack (custom entry or `MC_ICON_STACKS`, default 64) and **Ctrl/⌘** 16, Shift winning; the
   input selects all on click, the wheel over it steps and never scrolls the page, Enter moves to
   the next same-kind field, and `needed` clamps at 1 (got ≥0). The same control is used in
   material rows, the add-material form, the custom-item dialog and the compact tile dialog.
   The six-button `#mat-steps`/`.mat-step` strip, `materialStepsHtml` and every `data-step` are
   retired.
9. `#copy-coords` copies the coords field and toasts; it is disabled when the field is empty or
   whitespace. Required fields are validated in the form handler even though `#mat-item` is a
   hidden input.
10. Dropdowns stay native `<select>`s. `@supports (appearance: base-select)` themes
    `::picker(select)` in Chromium; elsewhere the OS popup is unchanged — no JavaScript listbox
    emulation.
11. One shared `#mc-tooltip` (`role="tooltip"`) is the only tooltip surface: appended to the open
    `<dialog>` (else `body`), carrying the source slot's `data-tip`, fixed and clamped 8 px
    inside the viewport, flipping below the slot when under 44 px of room remains above. No
    `.slot[data-tip]::after` (or tile/row) tooltip rule survives. Delegation uses bubbling
    `pointerover`/`pointerout` with an `event.relatedTarget` containment check plus
    `focusin`/`focusout`; Escape and dialog close hide it.
12. The picker pages in 120-tile batches through `div#icon-sentinel` (aria-hidden, last child of
    `#icon-grid`); every one of the 1,368 slugs is reachable and no slice cap remains. Typing
    resets to the first batch and removes the sentinel. `#icon-count-hint` reads
    `showing N of 1368 — scroll for more` (or `showing N of M for "query"`); item names wrap
    instead of truncating.
13. The five zero states each name their next action: `#build-empty` → `#btn-first-build`
    (world dialog when there are no worlds, otherwise the build dialog), `#world-empty` →
    `#btn-empty-create-world`, `#detail-empty` → `#detail-empty-action`, `#material-empty` →
    `#btn-empty-pick-material`, `#world-material-empty` → `#btn-empty-reset-filter` (clears
    search and filter). No control may answer only with an error toast.
14. Icon suggestion is display-only and deterministic: `M.suggestIcon(build, world, catalog)`
    uses the frozen keyword table (longest whole-word keyword in the name; then notes, then the
    world name; then the largest material; then the world icon; else `null`). `#detail-avatar`
    shows `data-icon-auto` + `title` while a suggestion is displayed; the picker shows
    `#icon-suggest-note` and marks the tile; choosing stores the icon and clears the marker.
    A suggestion never replaces a stored icon.
15. **Paste list…** (`#bulk-paste`) opens `#bulk-dialog` with a review list: the matcher is
    case-insensitive exact display name → exact slug → unique prefix of at least 3 characters;
    unknown or ambiguous lines stay unmatched and are not added; duplicates merge; quantities
    clamp ≥1; **Add matched** commits once.
16. Deletion of a material, build or world offers **Undo** in the toast for 6,000 ms; one
    deep-equal snapshot restores state, view and focus, and any later commit clears it. The
    confirm copy says “You can undo for 6 seconds.”
17. Recent picks (`mc-build-tracker:recent`, at most 8 slugs) are browser-local, not exported,
    and lead the unfiltered first picker batch; choosing an item records it at the front.
18. Picker and material rows keep the catalogue surfaces unchanged: `MC_ICON_SET` is an array of
    slug strings, `MC_ICON_NAMES` and `MC_ICON_STACKS` are slug-keyed objects.
19. The active world lives in the left `aside#world-panel` (name `#world-panel-name`, identity,
    edition/version, derived stats and the new/import/export actions): 230 px at ≥1100, 200 px at
    ≥900, stacked above the content below 900. It is hidden on the Worlds tab and in Compact
    mode, where the panel takes the full canvas. The dialog keeps `#world-name`.
20. `#view-standard` / `#view-compact` switch the Builds tab only and persist in
    `localStorage['mbt.buildsView']`. Compact hides the sidebar, renders the derived
    `#compact-world` line and one `article.ccard` per build in `#compact-grid`
    (`minmax(560px, 1fr)`), with a material matrix of `button.ctile` tiles — deficit when
    `data-state="open"`, target (dimmed, check badge) when done; a tile opens `#tile-dialog`
    (`#tile-absolute` number, `#tile-relative` signed text parsing `+64`/`-32`/`2s`/`2st`,
    Enter commits, Escape cancels unchanged).
21. Worlds, builds and custom items carry created/updated ISO stamps (`createdAt` immutable,
    `updatedAt` on every successful mutation); absent stays absent and is never fabricated, a
    malformed value is preserved raw and shown as `—`. `M.formatStamp` slices the strict UTC
    `YYYY-MM-DDTHH:MM` prefix and never converts to local time.
22. Both build columns pin their section head to the same box (`padding-bottom: 4px`,
    `min-height: 44px`, centred), so the head rules agree within 0.5 px; the `#notes-text` view
    row has no field skin and the notes edit controls sit in the label row.

## 4. Acceptance criteria

- `AC-1` Aggregated shopping list equals the sum of every build's materials, computed
  independently of the implementation.
- `AC-2` `remaining` is never negative when the player over-farms; totals stay consistent.
- `AC-3` Duplicate item names (case-insensitive) merge into one row with summed quantities.
- `AC-4` Deleting a world removes its builds and never leaves a dangling active world.
- `AC-5` Backup round-trips byte-for-byte in meaning; bad files are refused without data loss.
- `AC-6` Offline: no remote fonts/scripts/images; all assets resolve locally; works from
  `file://` (classic scripts, no ES modules).
- `AC-7` Every control is labelled; no inline handlers; visible focus; reduced-motion honoured.
- `AC-8` Pixel contract: square corners, 2px bevels, tiled block textures stay
  `image-rendering: pixelated`, bundled **Minecraft** bitmap face (Craftron Gaming; licence in
  `src/assets/fonts/Minecraft-LICENCE.md`, raw evidence
  `raw/sources/2026-10-25-minecraft-font-licence.md`) with **Pixelify Sans** as the fallback for
  the glyphs it lacks (arrows, dashes, ellipsis, `×`, `·`, `≥`, `≤`), and no CDN. Lowercase
  renders as small capitals — the vanilla look, accepted.
- `AC-9` Identity: every world and build can carry an item icon or an uploaded image; it appears
  in the topbar, world cards, build rows and the detail header; clearing it restores the letter;
  uploads are 128×128 data URLs and survive reload/export/import.
- `AC-10` Backdrop: one `.backdrop__layer` 800vh wide over `background-size: 400vh auto`,
  `repeat-x`, translating `translateX(-50%) → 0` over **120 s** linear infinite, baked at blur
  radius **2.0** (ceiling 2) from six resolved inputs `panorama_0…5` — four side faces stitched
  with a 64 px wrap crossfade, caps recorded but not stitched — into a 2,560×640 WebP (55,096 B,
  sha256 `331253bd…bf1a5`), with per-layer CSS `blur(1px)` desktop / `blur(1.5px)` at ≤640 px
  over a **0.2** scrim. `#backdrop-pause` is the WCAG control and persists in
  `mc-build-tracker:motion`; `prefers-reduced-motion: reduce` defaults to paused with the frame
  painted (never `animation: none`), and the global reduce reset excludes the layer. Blocked or
  absent files fall back to dirt without console errors.
- `AC-11` Icon resolution and catalog: every material/avatar icon comes from the game's own
  **256×256 inventory renders** (IconExporter export; `manifest.json` → `mode: hires-exports`,
  `pixels: 256`), shown smoothly downscaled (22 px slot, 28–48 px avatars) and never
  nearest-neighbour-scaled; the PNGs stay git-ignored and a missing render falls back to a
  letter. The catalog is **1,368 addressable base items** (1,609 item renders: 1,363 plain + 5
  representatives of 246 variant renders; 241 collapsed variants), curated 53 first,
  `MC_ICON_NAMES` emitted as an object keyed by slug, stacks from the exception table (default
  64). Lighting is classified from the jar model chain as exactly `block` / `flat` /
  `3d-other` (407 / 620 / 341; `hopper` is flat, jar-verified), and the five
  `flat_pixel_mismatches` are copied byte-for-byte and disclosed. Because IconExporter 1.3.1
  exports 3D icons too dark (it flattens Minecraft's GUI diffuse lighting; upstream fix PR #41
  unreleased), the extractor applies and records a documented per-face brightness correction
  restoring the vanilla inventory ratios (top 0.99, left 0.65, right 0.40 of the block texture);
  flat 2D sprites are copied unchanged.
- `AC-12` Detail interaction: `#build-rename` sits left of `#build-delete` and swaps the heading
  for `#build-name` + `#build-name-save`/`#build-name-cancel`; Enter saves, Escape restores,
  blank titles are refused, focus returns. Notes show `#notes-text` in view mode and
  `#notes-hint`/`#notes-save`/`#notes-cancel` replace `#notes-edit` in the section label row in
  edit mode; `Ctrl/Cmd+Enter` saves, Escape cancels, an empty note shows a muted placeholder.
  `#copy-coords` copies and toasts, disabled when empty. Every number field is a `.stepper`
  (`−` / `type=number` input with hidden spinners / `+`): click = 1, Shift = one stack,
  Ctrl/⌘ = 16, Shift wins, wheel steps without scrolling the page, Enter moves to the next
  same-kind field, `needed` clamps at 1 (got ≥0), and the control dispatches `input` then
  `change`. The six-button `#mat-steps`/`.mat-step` strip and every `data-step` are gone.
  `#mat-choice` opens the picker in pick-item mode; `#bulk-paste` opens the paste dialog; a
  deleted material offers Undo.
- `AC-21` World sidebar: at 1280×900 the left `aside#world-panel` is 230 px wide with its own
  border and contains `#world-panel-name`, identity, derived stats and the new/import/export
  actions; at 900–1099 it is 200 px; below 900 it stacks above the content with no horizontal
  overflow. It is absent on the Worlds tab and in Compact mode, where the full 1240 px canvas is
  used. The world dialog keeps `#world-name`.
- `AC-22` Compact view: the Standard/Compact switch changes only the Builds tab and persists
  across reload; Compact hides the sidebar, shows the derived `#compact-world` line and one
  `article.ccard` per build in `#compact-grid` (`minmax(560px, 1fr)`, two cards at 1280); each
  card carries the title link, status chip, percent, actions and matrix of `button.ctile` tiles
  whose count is the deficit when open and the target when done. A tile opens `#tile-dialog`;
  `#tile-absolute` accepts an absolute number, `#tile-relative` a signed delta (`+64`, `-32`,
  `2s`, `2st`), Enter commits one `M.updateMaterial` + one `commit()`, Escape leaves collected
  unchanged.
- `AC-23` Stamps: worlds keep `createdAt` and gain `updatedAt`; builds and every custom-item
  scope carry both, ISO-8601, `createdAt` immutable and `updatedAt` refreshed on each successful
  mutation; absent stays absent (never fabricated), a present-but-unparseable value is preserved
  raw and displayed as `—`; `M.formatStamp` slices the UTC prefix without local conversion; the
  stamps round-trip through export/import.
- `AC-24` Notes and scale: the view row is a `<p class="notes__text" id="notes-text">` with no
  field skin, transparent and unfocused-looking; the edit controls sit left-to-right as hint,
  save, cancel in the label row; the root font knob is 18 px and computed body, input and button
  text are 18 / 18 / 16 px — nothing reads 16 px body text.
- `AC-13` Tooltip: one `#mc-tooltip` is topmost at its rect (`elementFromPoint`), fully inside the
  viewport, flips below when under 44 px of space remains, and is hidden after pointer-out,
  Escape and dialog close. No pseudo-element tooltip rule remains.
- `AC-14` Paging: first batch is 121 tiles (120 slugs + the None tile); scrolling to the end
  renders all 1,368 slugs, the last (`zombified_piglin_spawn_egg`) is interactable, and the hint
  reads `showing 1368 of 1368`; typing resets to the first batch.
- `AC-15` Names: on the frozen longest-name samples, `scrollWidth <= clientWidth + 1` on every
  name node at 1280 and 390; no ellipsis, no line clamp.
- `AC-16` Empty states: all five zero states are reachable in a fresh browser, each named
  next-step control works, and no zero-state control answers only with an error toast.
- `AC-17` Suggestion: the ≥ 20-build fixture yields stable slugs and reasons (`stone_bricks`,
  `matched "tower" in the name`); no signal → `null`; a stored icon is never replaced; the picker
  shows `Suggested from "tower"` and marks the tile; `iconAuto` is accepted/exported but
  display-only.
- `AC-18` Bulk paste: 7 review rows, 4 matched (quantities 64/32/1/20) and 3 unknown; one
  **Add matched** commit adds exactly Stone Bricks 64, Glass 32, Oak Log 1, Oak Planks 20;
  duplicates merge and quantities clamp ≥1.
- `AC-19` Undo: deleting a material offers Undo for 6 s and restores the state deep-equal
  (3 → 4 rows); after the window it does nothing; a later commit clears the pending snapshot.
- `AC-20` Recents: after three picks the last (`red_wool`) leads the unfiltered first batch,
  survives reload, caps at 8 and never appears in the exported state.

## 5. Verification record (2026-10-26, reinstated tree)

| Check | Command | Result |
|-------|---------|--------|
| Tests | `npm test` | **120/120** across 11 suites (units + acceptance), 0 fail |
| Browser UI suite | `node scripts/app-qa.mjs run` | **96/96**, exit 0; stamp `app-qa: verified — 2026-10-26T02:59:39.552Z (96 UI cases)` covering the 8 hashed sources |
| UI audit | `python tests/qa/mc_ui_audit.py` | **186/186** |
| Budgets | `probe.json` | desktop 1280×900 `scrollHeight` 900 ≤ 960; mobile 390×844 1,423 ≤ 1,700, no horizontal overflow |
| Stepper | browser `07-stepper-cluster` + cases | one `.stepper` per field; Shift = stack, Ctrl/⌘ = 16; wheel steps without page scroll; Enter moves on; six-button rows gone |
| Sidebar / compact | `03-world-sidebar`, `10-compact-view`, `11-compact-tile-tooltip`, `12-compact-quick-update` | sidebar 230 px and hidden in Compact; cards two-up at 1280; tile dialog commit and Escape verified |
| Notes / stamps | `04-notes-view`, `05-notes-edit`, `13-metadata-stamps` | `notes__text` has no field skin; hint/save/cancel in the label row; ISO created/updated stamps and `—` for malformed |
| Evidence | `reports/qa/evidence/edict-0016/` | 25 files incl. `probe.json` and README, hashes distinct |

## 6. Known gaps (deliberate)

- Item icons are the game's own **256×256 inventory renders**, 1,368 addressable base items
  generated locally with `scripts/mc-icons.py` and git-ignored; without the export the script
  falls back to the 16×16 client-jar textures and labels the manifest. The export holds 1,609
  item renders (1,363 plain + 246 component variants), and the 246 variants collapse to 5
  representatives (`collapsed_variants` 241) — a specific potion or painting variant cannot be
  picked. Items the export lacks, including anything added to the game after the export, keep the
  lettered fallback.
- Stack sizes are curated product data, not derivable from the PNG export: default 64 except
  egg/snowball/`ender_pearl`/`honey_bottle`/`armor_stand`/empty buckets/signs/banners (16) and
  filled buckets/tools/armour/elytra/potions/boats/minecarts/shulker boxes/beds/cakes & stews/
  books/maps/banner patterns/discs (1); `slime_ball` is 64. The stepper resolves Shift to one
  stack and Ctrl/⌘ to 16 (Shift wins); stack-1 items still step by 1 or 16 — there is no special
  row shape. The exception table's completeness is the risk — a wrong default is a plausibility
  bug, not a crash.
- Lighting is the jar model chain classified into `block` / `flat` / `3d-other` (407 / 620 / 341
  of 1,368); `hopper` is `flat` (jar-verified), `anvil` and `chest` are `3d-other`. The 341-name
  `3d-other` list is disclosed rather than assumed correct, and five flat sprites
  (`enchanted_book`, `enchanted_golden_apple`, `end_crystal`, `experience_bottle`,
  `nether_star`) are byte-for-byte copies disclosed as `flat_pixel_mismatches`.
- **IconExporter 1.3.1 exports 3D icons too dark** (non-uniform pose scale flattens the GUI
  diffuse lighting). The extractor restores vanilla face brightness on the exported render and
  records the measured factors/gains in `manifest.json`; this is a compensation, not a
  re-render. The upstream fix exists (IconExporter PR #41) but is unreleased for 1.21.4 — when
  it ships, re-export and drop the correction.
- Themed dropdowns exist only where `appearance: base-select` is supported (pinned Chrome
  155.0.8059.86); every other browser keeps the native OS popup. That is the price of not
  rewriting selects in JavaScript.
- The face maps 107 codepoints: arrows, dashes, ellipsis, `×`, `·`, `≥`, `≤` come from the
  Pixelify fallback. `Minecraft.ttf` stays untracked until its licence file and the sealed raw
  source are both present.
- Storage is per-browser only: the footer says so and Export exists for backups; there is no
  server sync.
- No image/screenshot attachments on builds; no sharing links; no multi-user.
- Avatar uploads are capped at 128×128 WebP/PNG data URLs (≤120 000 chars) inside the saved
  state; many uploads grow backups and count against browser storage.
- The menu backdrop is generated locally from the owner's client; without extraction the dirt
  texture remains. Blur/scrim were re-tuned in EDICT-0013 and the strip became a seamless 120 s
  single-layer drift in EDICT-0015 (six inputs, four sides, 2,560×640, pause control, paused by
  default under reduced motion); the side-by-side comparison with the real title screen on a
  physical display is still untested.
- Compact view is Builds-only and hides both the world sidebar and the standard list/detail
  split; Worlds and Materials keep the standard layout. Phase-2 compact scope (global inventory,
  phases, crafting) is deferred to `docs/backlog/compact-view-phase-2.md`.
- The e2e suite currently writes a few screenshots into an evidence folder of an earlier edict;
  the Lead restored those artifacts byte-for-byte, but the suite should take an output-directory
  argument so runs never share an evidence folder.
- The catalogue shape is deliberately mixed: `MC_ICON_SET` is an array of slug strings while
  `MC_ICON_NAMES` and `MC_ICON_STACKS` are slug-keyed objects. Consumers must not assume one
  shape for all three.
- Paging is append-only scroll: 1,368 tiles in 120-row batches, no virtualisation and no
  "jump to letter"; the count hint is the only progress signal.

